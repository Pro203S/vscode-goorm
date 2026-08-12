import * as vscode from "vscode";
import getInitialState, { InitialState, QuizInitialState } from "../initialState";
import { setActiveQuiz } from "./quizContext";
import { QuizPanel } from "./quizPanel";
import { QuizRepository } from "./quizRepository";
import { getCollabSocket, getSocket, setCollabSocket } from "../lib/socketContext";
import { axios, getCookie } from "../rest";
import { getGoormUrl } from "../lib/validateURL";
import { generateHex } from "../lib/traceparent";
import SocketIO from "../lib/socketIo";

const QUIZ_FILE_CONTEXT = "goormEDU.isQuizFile";

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

class QuizWorkspaceController implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly panel = new QuizPanel();
    private readonly repository: QuizRepository;
    private updateId = 0;

    constructor(
        private readonly context: vscode.ExtensionContext,
        folder: vscode.WorkspaceFolder,
        state: InitialState,
    ) {
        this.repository = new QuizRepository(context, folder, state);
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    void this.updateActiveEditor(editor);
                }
            }),
        );

        void this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.repository.initialize();
        await this.updateActiveEditor(vscode.window.activeTextEditor);
    }

    private async updateActiveEditor(editor?: vscode.TextEditor): Promise<void> {
        const id = ++this.updateId;
        const quiz = editor
            ? await this.repository.resolve(editor.document)
            : undefined;

        if (id !== this.updateId) {
            return;
        }
        await vscode.commands.executeCommand("setContext", QUIZ_FILE_CONTEXT, Boolean(quiz));
        if (id !== this.updateId) return;

        setActiveQuiz(quiz);
        if (!quiz || !editor) return this.panel.hide();

        this.panel.show(quiz.metadata);

        // 소켓 연결 전

        const url = await getGoormUrl();
        if (!url) return;

        const cookie = await getCookie(this.context);
        const state = await getInitialState<QuizInitialState>(`/learn/lecture/${quiz.metadata.lecture.sequence}/${quiz.metadata.lecture.urlSlug}/lesson/${quiz.lesson.data.seq}/${quiz.metadata.lesson.urlSlug}`, this.context);
        if (!state?.userData || !cookie) {
            const login = await vscode.window.showErrorMessage(
                "로그인 후 구름EDU의 문제를 풀 수 있습니다.",
                "로그인",
            );

            if (login === "로그인") {
                await vscode.commands.executeCommand("goormEDU.login");
            }

            return;
        }

        const socket = getSocket();
        if (!socket) return await closeWithError("구름EDU 서버와 연결이 되어있지 않습니다.");

        // 소켓 연결

        socket.on("entrance_to_collaboration", async (ev) => {
            // 콜라보 소켓 연결
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

            const collab = new SocketIO(`wss://${collabProxy.data.proxyHost}/app/${collabProxy.data.host}/${collabProxy.data.port}`, { "verbose": true });
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

            console.log(editor.document.getText());

            collab.send("join", {
                "channel": "ot",
                "service_type": "edu",
                "user_id": state.userData.id,
                "user_name": state.userData.name,
                "filename": data.collaborationRoomName,
                "value": editor.document.getText(),
                "guideAnchorList": [],
                "channel_index": state.channel.index,
                "examIndex": state.lesson.index,
                "quizIndex": state.lesson.tutorial_quiz_index
            });
        });

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

        socket.send("updateBrowserState", {
            "userId": state.userData.id,
            "lectureIndex": state.lecture.index,
            "lessonIndex": state.lesson.index,
            "isBrowserActive": true,
            "isOnline": true,
            "userData": state.userData,
            "channelIndex": state.channel.index
        });

        socket.send("entrance_to_collaboration", {
            "lecture_index": state.lecture.index,
            "lesson_index": state.lesson.index,
            "collaboration_option": "personal",
            "owner_id": state.userData.id,
            "user_id": state.userData.id,
            "user_name": state.userData.name,
            "room_id": state.userData.id,
            "room_type": "user"
        });
    }

    dispose(): void {
        this.updateId++;
        this.panel.dispose();
        setActiveQuiz(undefined);

        for (const disposable of this.disposables) {
            disposable.dispose();
        }

        void vscode.commands.executeCommand("setContext", QUIZ_FILE_CONTEXT, false);
    }
}

export default function registerQuizWorkspace(
    context: vscode.ExtensionContext,
    folder: vscode.WorkspaceFolder,
    state: InitialState,
): vscode.Disposable {
    return new QuizWorkspaceController(context, folder, state);
}
