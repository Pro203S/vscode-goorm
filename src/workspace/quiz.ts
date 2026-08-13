import * as vscode from "vscode";
import getInitialState, { InitialState, QuizInitialState } from "../initialState";
import { getActiveQuiz, setActiveQuiz } from "./quizContext";
import { QuizPanel } from "./quizPanel";
import { QuizRepository } from "./quizRepository";
import { getCollabSocket, getSocket, setCollabSocket, setSocket } from "../lib/socketContext";
import { axios, getCookie } from "../rest";
import { getGoormUrl } from "../lib/validateURL";
import SocketIO from "../lib/socketIo";
import { refreshLessonDecorations } from "./lessonDecorations";

const QUIZ_FILE_CONTEXT = "goormEDU.isQuizFile";
const SUBMIT_QUIZ_CONTEXT = "goormEDU.canSubmitQuiz";
const NON_EDITOR_URI_SCHEMES = new Set([
    "output",
    "debug",
    "terminal",
    "vscode-terminal",
]);

function isWorkbenchPanel(editor: vscode.TextEditor): boolean {
    return NON_EDITOR_URI_SCHEMES.has(editor.document.uri.scheme);
}

const closeWithError = async (message: string) => {
    await vscode.window.showErrorMessage(
        "구름EDU 오류",
        {
            "modal": true,
            "detail": message,
        }
    );
    await vscode.commands.executeCommand("workbench.action.closeFolder");
    return;
};

function getClientColor(clientId: string) {
    const colors = [
        "#E53935",
        "#8E24AA",
        "#5E35B1",
        "#3949AB",
        "#1E88E5",
        "#00897B",
        "#43A047",
        "#F4511E",
        "#6D4C41",
        "#D81B60",
    ];

    let hash = 0;

    for (let i = 0; i < clientId.length; i++) {
        hash = (hash * 31 + clientId.charCodeAt(i)) | 0;
    }

    const borderColor = colors[Math.abs(hash) % colors.length];

    return {
        borderColor,
        backgroundColor: `${borderColor}40`,
    };
}

let applyingRemoteOperation = false;

type CollaborationSelection = {
    ranges: {
        anchor: number;
        head: number;
    }[];
};

type OperationMetadata = {
    user: string;
    name: string;
    time: string;
    project_path: string;
    quiz_index: string;
    language: string;
    service_type: "edu";
    channel_index: string;
};

type OperationEmit = [
    revision: number,
    operation: (number | string)[],
    selection: CollaborationSelection | null,
    filepath: string,
    metadata: OperationMetadata,
];

function getCollaborationSelection(
    editor: vscode.TextEditor,
): CollaborationSelection {
    return {
        ranges: editor.selections.map((selection) => ({
            anchor: editor.document.offsetAt(selection.anchor),
            head: editor.document.offsetAt(selection.active),
        })),
    };
}

function createOperation(
    event: vscode.TextDocumentChangeEvent,
): (number | string)[] {
    const changes = [...event.contentChanges].sort(
        (left, right) => left.rangeOffset - right.rangeOffset,
    );
    const newDocumentLength = event.document.getText().length;
    const lengthDelta = changes.reduce(
        (total, change) => total + change.text.length - change.rangeLength,
        0,
    );
    const oldDocumentLength = newDocumentLength - lengthDelta;
    const operation: (number | string)[] = [];
    let offset = 0;

    for (const change of changes) {
        if (change.rangeOffset < offset) {
            throw new Error("Overlapping document changes cannot be converted to an operation");
        }

        const retain = change.rangeOffset - offset;
        if (retain > 0) operation.push(retain);
        if (change.rangeLength > 0) operation.push(-change.rangeLength);
        if (change.text.length > 0) operation.push(change.text);

        offset = change.rangeOffset + change.rangeLength;
    }

    const finalRetain = oldDocumentLength - offset;
    if (finalRetain < 0) {
        throw new Error("Document changes exceed the previous document length");
    }
    if (finalRetain > 0) operation.push(finalRetain);

    return operation;
}

async function applyOperation(
    editor: vscode.TextEditor,
    operation: (number | string)[],
): Promise<boolean> {
    const document = editor.document;
    const documentLength = document.getText().length;
    let offset = 0;
    const changes: {
        from: number;
        to: number;
        insert: string;
    }[] = [];
    let currentChange: {
        from: number;
        to: number;
        insert: string;
    } | null = null;

    const flushChange = () => {
        if (!currentChange) return;

        changes.push(currentChange);
        currentChange = null;
    };

    for (const op of operation) {
        if (typeof op === "number") {
            if (op > 0) {
                flushChange();
                offset += op;

                if (offset > documentLength) {
                    throw new Error(`Invalid retain: ${offset} > ${documentLength}`);
                }
            } else if (op < 0) {
                const length = -op;

                if (!currentChange) {
                    currentChange = {
                        from: offset,
                        to: offset,
                        insert: "",
                    };
                }

                currentChange.to += length;
                offset += length;

                if (offset > documentLength) {
                    throw new Error(`Invalid delete: ${offset} > ${documentLength}`);
                }
            }
        } else {
            if (!currentChange) {
                currentChange = {
                    from: offset,
                    to: offset,
                    insert: "",
                };
            }

            currentChange.insert += op;
        }
    }

    flushChange();

    if (offset !== documentLength) {
        throw new Error(
            `Invalid operation: consumed ${offset}/${documentLength} characters`,
        );
    }

    applyingRemoteOperation = true;

    try {
        return await editor.edit(
            (edit) => {
                for (const change of changes) {
                    edit.replace(
                        new vscode.Range(
                            document.positionAt(change.from),
                            document.positionAt(change.to),
                        ),
                        change.insert,
                    );
                }
            },
            {
                undoStopBefore: false,
                undoStopAfter: false,
            },
        );
    } finally {
        applyingRemoteOperation = false;
    }
}

class QuizWorkspaceController implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly panel = new QuizPanel();
    private readonly repository: QuizRepository;
    private updateId = 0;
    private collaborationRevision: number | undefined;
    private operationMetadata: Omit<OperationMetadata, "time"> | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        folder: vscode.WorkspaceFolder,
        state: InitialState,
    ) {
        this.repository = new QuizRepository(context, folder, state);
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (!editor || isWorkbenchPanel(editor)) return;

                void this.updateActiveEditor(editor);
            }),
            vscode.window.onDidChangeTextEditorSelection(
                (event) => this.changeSelection(event),
            ),
            vscode.workspace.onDidChangeTextDocument(
                (event) => this.changeDocument(event),
            ),
        );

        void this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.repository.initialize();
        await this.updateActiveEditor(vscode.window.activeTextEditor);
    }

    private changeSelection(event: vscode.TextEditorSelectionChangeEvent): void {
        if (applyingRemoteOperation) return;

        const quiz = getActiveQuiz();
        const filepath = quiz?.file?.collabFileName;
        if (
            !quiz ||
            !filepath ||
            event.textEditor.document.uri.toString() !== quiz.document.uri.toString()
        ) {
            return;
        }

        const socket = getCollabSocket();
        if (!socket) return;

        try {
            socket.sendRaw([
                "selection",
                getCollaborationSelection(event.textEditor),
                filepath,
            ]);
        } catch (error) {
            console.error("Failed to send collaboration selection:", error);
        }
    }

    private changeDocument(event: vscode.TextDocumentChangeEvent): void {
        if (applyingRemoteOperation || event.contentChanges.length === 0) return;

        const quiz = getActiveQuiz();
        const filepath = quiz?.file?.collabFileName;
        if (
            !quiz ||
            !filepath ||
            event.document.uri.toString() !== quiz.document.uri.toString()
        ) {
            return;
        }

        const socket = getCollabSocket();
        const revision = this.collaborationRevision;
        const metadata = this.operationMetadata;
        if (!socket || revision === undefined || !metadata) return;

        const activeEditor = vscode.window.activeTextEditor;
        const editor = activeEditor?.document.uri.toString() === event.document.uri.toString()
            ? activeEditor
            : vscode.window.visibleTextEditors.find(
                (candidate) => candidate.document.uri.toString() === event.document.uri.toString(),
            );

        try {
            const payload: OperationEmit = [
                revision,
                createOperation(event),
                editor ? getCollaborationSelection(editor) : null,
                filepath,
                {
                    ...metadata,
                    time: new Date().toISOString(),
                },
            ];

            socket.sendRaw(["operation", ...payload]);
            this.collaborationRevision = revision + 1;
        } catch (error) {
            console.error("Failed to send collaboration operation:", error);
        }

    }

    private async updateActiveEditor(editor?: vscode.TextEditor): Promise<void> {
        const id = ++this.updateId;
        const quiz = editor
            ? await this.repository.resolve(editor.document)
            : undefined;

        if (id !== this.updateId) {
            return;
        }

        const activeQuizUri = getActiveQuiz()?.document.uri.toString();
        const nextQuizUri = quiz?.document.uri.toString();
        if (activeQuizUri === nextQuizUri) return;

        this.collaborationRevision = undefined;
        this.operationMetadata = undefined;

        await Promise.all([
            vscode.commands.executeCommand("setContext", QUIZ_FILE_CONTEXT, Boolean(quiz)),
            vscode.commands.executeCommand(
                "setContext",
                SUBMIT_QUIZ_CONTEXT,
                Boolean(quiz && quiz.metadata.result.quizMode !== "run_mode"),
            ),
        ]);
        if (id !== this.updateId) return;

        setActiveQuiz(quiz);
        if (!quiz || !editor) return this.panel.hide();

        this.panel.show(quiz.metadata);

        await vscode.window.withProgress(
            {
                "location": vscode.ProgressLocation.Notification,
                "title": "구름EDU 서버에 연결 중...",
                'cancellable': false
            },
            async () => {
                try {
                    // 소켓 연결 전

                    const url = await getGoormUrl();
                    if (!url) return;

                    const cookie = await getCookie(this.context);
                    const state = await getInitialState<QuizInitialState>(`/learn/lecture/${quiz.metadata.lecture.sequence}/${quiz.metadata.lecture.urlSlug}/lesson/${quiz.lesson.data.seq}/${quiz.metadata.lesson.urlSlug}`, this.context);
                    if (!state?.userData || !cookie) {
                        return closeWithError("구름EDU의 계정 정보를 가져올 수 없습니다.");
                    }

                    if ((state as any).errorCode) {
                        if ((state as any).errorData === "NotStudent") {
                            return closeWithError(`수강신청이 되어있지 않습니다.`);
                        }
                        return closeWithError(`${(state as any).errorCode} 오류가 발생했습니다.`);
                    }

                    await refreshLessonDecorations(
                        this.context,
                        quiz.metadata.lecture.sequence,
                    );

                    this.operationMetadata = {
                        user: state.userData.id,
                        name: state.userData.name,
                        project_path: quiz.project.key,
                        quiz_index: quiz.metadata.result.quizIndex,
                        language: quiz.project.language,
                        service_type: "edu",
                        channel_index: state.channel.index,
                    };

                    //#region 소켓 연결

                    const originalSocket = getSocket();
                    if (originalSocket) {
                        originalSocket.close();
                        setSocket(undefined);
                    }

                    const socket = new SocketIO(url, {
                        "cookies": await getCookie(this.context),
                        "verbose": true
                    });
                    setSocket(socket);

                    socket.on("error", async (error: Error) => {
                        setSocket(undefined);
                        closeWithError(`${error.message}`);
                    });

                    socket.on("close", async ({ code, reason }) => {
                        setSocket(undefined);
                        closeWithError(`${code} ${Buffer.from(reason).toString("utf-8")}`);
                    });

                    await socket.connect();

                    //#endregion

                    // 콜라보 소켓 연결
                    socket.on("entrance_to_collaboration", async (ev) => {
                        //#region 소켓 연결
                        const data: {
                            "result": boolean,
                            "_id": string,
                            "collaborationRoomName": string
                        } = ev;

                        const collabProxy = await axios({
                            "context": this.context,
                            "url": `${url}/api/ot/available`,
                            "params": {
                                "collaborationId": data._id
                            }
                        });
                        if (!collabProxy) return await closeWithError("구름EDU 서버와의 연결에 실패했습니다.");

                        if (getCollabSocket()) {
                            const c = getCollabSocket();
                            // 위에서 확인했는데 설마 몇 마이크로초 안에 값이 바뀌겠어
                            c?.close();
                            setCollabSocket(undefined);
                        }

                        const collab = new SocketIO(`wss://${collabProxy.data.proxyHost}/app/${collabProxy.data.host}/${collabProxy.data.port}`, {
                            "verbose": true
                        });

                        setCollabSocket(collab);

                        collab.on("error", async (error: Error) => {
                            await vscode.window.showErrorMessage("구름EDU: " + error.message);
                            setCollabSocket(undefined);
                        });

                        collab.on("close", async ({ code, reason }) => {
                            await vscode.window.showErrorMessage("구름EDU: 소켓이 닫혔어요. " + code + " " + Buffer.from(reason).toString("utf-8"));
                            setCollabSocket(undefined);
                        });

                        await collab.connect();

                        //#endregion

                        // 첫 문서 정보 가져오기
                        collab.once(`doc.${quiz.file?.collabFileName}`, async (ev: {
                            str: string;
                            revision: number;
                        }) => {
                            const document = editor.document;

                            this.collaborationRevision = ev.revision;

                            const fullRange = new vscode.Range(
                                document.positionAt(0),
                                document.positionAt(document.getText().length),
                            );

                            applyingRemoteOperation = true;

                            try {
                                await editor.edit((edit) => {
                                    edit.replace(fullRange, ev.str);
                                });
                            } finally {
                                applyingRemoteOperation = false;
                            }
                            await editor.document.save();
                        });

                        //#region selection
                        const peerDecorations = new Map<
                            string,
                            vscode.TextEditorDecorationType
                        >();
                        const peerNames = new Map<string, string>();
                        const peerSelections = new Map<string, vscode.Range[]>();

                        const renderPeerSelection = (clientId: string) => {
                            const ranges = peerSelections.get(clientId) ?? [];
                            let decoration = peerDecorations.get(clientId);

                            if (ranges.length === 0 && !decoration) return;

                            if (!decoration) {
                                decoration = vscode.window.createTextEditorDecorationType(
                                    getClientColor(clientId),
                                );
                                peerDecorations.set(clientId, decoration);
                            }

                            const color = getClientColor(clientId).borderColor;
                            const name = peerNames.get(clientId);
                            const decorations = ranges.map((range, index): vscode.DecorationOptions => ({
                                range,
                                renderOptions: index === 0 && name
                                    ? {
                                        after: {
                                            "contentText": name,
                                            "backgroundColor": color,
                                            "color": "#111111",
                                            "fontWeight": "600",
                                        },
                                    }
                                    : undefined,
                            }));

                            editor.setDecorations(decoration, decorations);
                        };

                        const setPeerName = (clientId: string, name?: string) => {
                            if (!name || peerNames.get(clientId) === name) return;

                            peerNames.set(clientId, name);
                            renderPeerSelection(clientId);
                        };

                        const updatePeerSelection = (
                            clientId: string,
                            selection: {
                                ranges: {
                                    anchor: number;
                                    head: number;
                                }[];
                            },
                        ) => {
                            const ranges = selection.ranges.map((range) => {
                                return new vscode.Range(
                                    editor.document.positionAt(range.anchor),
                                    editor.document.positionAt(range.head),
                                );
                            });

                            peerSelections.set(clientId, ranges);
                            renderPeerSelection(clientId);
                        };

                        collab.on("set_name", (
                            clientId: string,
                            name: string,
                            filepath: string,
                        ) => {
                            if (filepath !== quiz.file?.collabFileName) return;

                            setPeerName(clientId, name);
                        });

                        collab.on("selection", (
                            clientId: string,
                            selection: {
                                ranges: {
                                    anchor: number;
                                    head: number;
                                }[];
                            } | null,
                            filepath: string,
                        ) => {
                            if (filepath !== quiz.file?.collabFileName) {
                                return;
                            }

                            // blur 등으로 selection이 제거된 경우
                            if (!selection) {
                                peerSelections.delete(clientId);
                                renderPeerSelection(clientId);
                                return;
                            }

                            updatePeerSelection(clientId, selection);
                        });

                        collab.on("operation", async (
                            clientId: string,
                            operation: (number | string)[],
                            selection: {
                                ranges: {
                                    anchor: number;
                                    head: number;
                                }[];
                            } | null,
                            filepath: string,
                        ) => {
                            if (filepath !== quiz.file?.collabFileName) return;

                            try {
                                const success = await applyOperation(editor, operation);

                                if (!success) {
                                    console.error("Failed to apply collaboration operation");
                                }

                                if (this.collaborationRevision !== undefined) {
                                    this.collaborationRevision += 1;
                                }

                                if (selection) {
                                    updatePeerSelection(clientId, selection);
                                }
                            } catch (error) {
                                console.error(
                                    "Failed to apply collaboration operation:",
                                    error,
                                );
                            }
                        });
                        //#endregion

                        //#region join / leave
                        collab.on("join_room", (ev) => {
                            vscode.window.showInformationMessage(`${ev.name}님이 입장했습니다.`);
                        });
                        collab.on("left_room", (ev) => {
                            vscode.window.showInformationMessage(`${ev.name}님이 나갔습니다.`);
                        });

                        collab.on("client_left", (clientId: string) => {
                            // selection 정리
                            const decoration = peerDecorations.get(clientId);
                            if (decoration) {
                                editor.setDecorations(decoration, []);
                                decoration.dispose();
                            }

                            peerDecorations.delete(clientId);
                            peerSelections.delete(clientId);
                            peerNames.delete(clientId);
                        });
                        //#endregion

                        // 콜라보 방에 입장
                        collab.send("join", JSON.stringify({
                            "channel": "ot",
                            "service_type": "edu",
                            "user_id": state.userData.id,
                            "user_name": state.userData.name,
                            "filename": quiz.file?.collabFileName,
                            "value": editor.document.getText(),
                            "guideAnchorList": [],
                            "channel_index": state.channel.index,
                            "examIndex": state.lesson.index,
                            "quizIndex": state.lesson.tutorial_quiz_index
                        }));

                        this.disposables.push({
                            "dispose": () => {
                                for (const decoration of peerDecorations.values()) {
                                    decoration.dispose();
                                }
                                peerDecorations.clear();
                                peerSelections.clear();
                                peerNames.clear();

                                const socket = getCollabSocket();
                                if (!socket) return;
                                socket.close();
                                setCollabSocket(undefined);
                            }
                        });
                    });

                    // 소켓 정리
                    socket.on("check_existing_socket_disconnect", (data) => {
                        socket.send("check_existing_socket_disconnect_lesson", data);
                    });

                    // 소켓 연결했을 때 send
                    socket.send("entrance_to_lesson", {
                        "user_id": state.userData.id,
                        "lesson_index": state.lesson.index,
                        "room_id": state.userData.id,
                        "room_type": "user",
                        "lecture_index": state.lecture.index,
                        "channel_index": state.channel.index
                    });
                    socket.send("entrance_to_quiz", {
                        "lectureIndex": state.lecture.index,
                        "examIndex": state.lesson.index,
                        "quizIndex": state.lesson.tutorial_quiz_index,
                        "userId": state.userData.id,
                        "isLesson": true
                    });
                    socket.once("id_check_done", () => socket.send("entrance_to_collaboration", {
                        "lecture_index": state.lecture.index,
                        "lesson_index": state.lesson.index,
                        "collaboration_option": "personal",
                        "owner_id": state.userData.id,
                        "user_id": state.userData.id,
                        "user_name": state.userData.name,
                        "room_id": state.userData.id,
                        "room_type": "user"
                    }));

                    this.disposables.push({
                        "dispose": () => {
                            const socket = getSocket();
                            if (!socket) return;
                            socket.close();
                            setSocket(undefined);
                        }
                    });
                } catch (e) {
                    vscode.window.showErrorMessage(`구름EDU: ${(e as any).stack}`);
                }
            }
        );
    }

    dispose(): void {
        this.updateId++;
        this.collaborationRevision = undefined;
        this.operationMetadata = undefined;
        this.panel.dispose();
        setActiveQuiz(undefined);

        for (const disposable of this.disposables) {
            disposable.dispose();
        }

        void vscode.commands.executeCommand("setContext", QUIZ_FILE_CONTEXT, false);
        void vscode.commands.executeCommand("setContext", SUBMIT_QUIZ_CONTEXT, false);
    }
}

export default function registerQuizWorkspace(
    context: vscode.ExtensionContext,
    folder: vscode.WorkspaceFolder,
    state: InitialState,
): vscode.Disposable {
    return new QuizWorkspaceController(context, folder, state);
}
