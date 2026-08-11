import * as path from "path";
import * as vscode from "vscode";
import getInitialState, { InitialState, LectureInitialState } from "../initialState";
import getQuiz from "../lib/getQuiz";
import { jsonToMapping, Mapping } from "../lib/mapping";
import {
    createQuizMetadata,
    getQuizMetadataUri,
    isQuizMetadata,
    QuizMetadata,
} from "../lib/quizMetadata";
import { setActiveQuiz } from "./quizContext";
import {
    findExamples,
    getQuizDescription,
    getQuizTitle,
    getWebviewHtml,
} from "./quizPresentation";

const QUIZ_FILE_CONTEXT = "goormEDU.isQuizFile";

function isUriInside(parent: vscode.Uri, child: vscode.Uri): boolean {
    if (parent.scheme !== child.scheme || parent.authority !== child.authority) {
        return false;
    }

    const relative = parent.scheme === "file"
        ? path.relative(parent.fsPath, child.fsPath)
        : path.posix.relative(parent.path, child.path);

    return (
        relative !== "" &&
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !relative.startsWith("../") &&
        !path.isAbsolute(relative) &&
        !path.posix.isAbsolute(relative)
    );
}

class QuizWorkspaceController implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly metadataCache = new Map<string, QuizMetadata | null>();
    private mappings: Mapping[] = [];
    private panel: vscode.WebviewPanel | undefined;
    private updateId = 0;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly folder: vscode.WorkspaceFolder,
        private readonly state: InitialState,
    ) {
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
        try {
            const mappingUri = vscode.Uri.joinPath(this.folder.uri, ".goorm", "mapping.json");
            const bytes = await vscode.workspace.fs.readFile(mappingUri);
            const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

            if (!Array.isArray(json)) {
                throw new Error("mapping.json의 최상위 값이 배열이 아닙니다.");
            }

            this.mappings = json.map((item) => jsonToMapping(item, this.folder.uri));
        } catch (error) {
            console.error("[goormEDU] 문제 파일 mapping을 읽지 못했습니다.", error);
        }

        await this.updateActiveEditor(vscode.window.activeTextEditor);
    }

    private findLesson(uri: vscode.Uri): Mapping["lessons"][number] | undefined {
        return this.mappings
            .flatMap((mapping) => mapping.lessons)
            .find((lesson) => isUriInside(lesson.filePath, uri));
    }

    private async readMetadata(lessonIndex: string): Promise<QuizMetadata | undefined> {
        if (this.metadataCache.has(lessonIndex)) {
            return this.metadataCache.get(lessonIndex) ?? undefined;
        }

        try {
            const uri = getQuizMetadataUri(this.folder.uri, lessonIndex);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

            if (!isQuizMetadata(value)) {
                throw new Error("지원하지 않는 문제 메타데이터 형식입니다.");
            }

            this.metadataCache.set(lessonIndex, value);

            return value;
        } catch {
            const metadata = await this.fetchMissingMetadata(lessonIndex);
            this.metadataCache.set(lessonIndex, metadata ?? null);

            return metadata;
        }
    }

    private async fetchMissingMetadata(lessonIndex: string): Promise<QuizMetadata | undefined> {
        const folderName = path.basename(this.folder.uri.fsPath);
        const lecture = this.state.channelLectureList.allLectures
            .filter((item) => {
                const escapedSlug = item.url_slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

                return new RegExp(`^${escapedSlug}\\d*$`, "i").test(folderName);
            })
            .sort((left, right) => right.url_slug.length - left.url_slug.length)[0];

        if (!lecture) {
            console.warn(`[goormEDU] ${lessonIndex} 문제의 강좌를 현재 폴더 이름으로 찾지 못했습니다.`);
            return undefined;
        }

        try {
            const lectureState = await getInitialState<LectureInitialState>(
                `/learn/lecture/${lecture.sequence}/${lecture.url_slug}`,
                this.context,
            );
            const lesson = lectureState?.lectureData.curriculumData
                .flatMap((curriculum) => curriculum.lessons)
                .find((item) => item.index === lessonIndex);

            if (!lesson) {
                return undefined;
            }

            const quiz = await getQuiz(
                lecture.index,
                lesson.index,
                this.state.userData.id,
                this.context,
            );

            if (!quiz) {
                return undefined;
            }

            const metadata = createQuizMetadata(
                quiz,
                {
                    index: lecture.index,
                    sequence: lecture.sequence,
                    urlSlug: lecture.url_slug,
                },
                {
                    index: lesson.index,
                    sequence: lesson.sequence,
                    urlSlug: lesson.urlSlug,
                    name: lesson.name,
                },
            );
            const metadataUri = getQuizMetadataUri(this.folder.uri, lesson.index);

            await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(this.folder.uri, ".goorm", "quizzes"),
            );
            await vscode.workspace.fs.writeFile(
                metadataUri,
                new TextEncoder().encode(JSON.stringify(metadata, null, 2)),
            );

            return metadata;
        } catch (error) {
            console.error(`[goormEDU] ${lessonIndex} 문제 메타데이터를 가져오지 못했습니다.`, error);
            return undefined;
        }
    }

    private async updateActiveEditor(editor?: vscode.TextEditor): Promise<void> {
        const id = ++this.updateId;
        const document = editor?.document;
        const lesson = document ? this.findLesson(document.uri) : undefined;
        const storedMetadata = lesson ? await this.readMetadata(lesson.data.idx) : undefined;
        const metadata = storedMetadata
            ? await this.ensurePresentation(storedMetadata)
            : undefined;
        const projectEntry = document && lesson && metadata
            ? Object.entries(metadata.result.project).find(([projectKey]) =>
                isUriInside(vscode.Uri.joinPath(lesson.filePath, projectKey), document.uri),
            )
            : undefined;

        if (id !== this.updateId) {
            return;
        }

        const isQuizFile = Boolean(document && lesson && metadata && projectEntry);
        await vscode.commands.executeCommand("setContext", QUIZ_FILE_CONTEXT, isQuizFile);

        if (!document || !lesson || !metadata || !projectEntry) {
            setActiveQuiz(undefined);
            this.panel?.dispose();
            this.panel = undefined;
            return;
        }

        const [projectKey, project] = projectEntry;

        setActiveQuiz({
            document,
            lecture: metadata.lecture,
            lesson: {
                ...lesson,
                ...metadata.lesson,
            },
            project: {
                ...project,
                key: projectKey,
                uri: vscode.Uri.joinPath(lesson.filePath, projectKey),
            },
            metadata,
        });
        this.showDescription(metadata);
    }

    private async ensurePresentation(metadata: QuizMetadata): Promise<QuizMetadata> {
        const resultTitle = getQuizTitle(metadata.result);
        const resultDescription = getQuizDescription(metadata.result);
        const resultExamples = findExamples(metadata.result);
        const needsDescription = !metadata.presentation?.description && !resultDescription;
        const needsExamples = metadata.presentation?.examples === undefined && resultExamples.length === 0;

        if (!needsDescription && !needsExamples) {
            return metadata;
        }

        const { lecture, lesson } = metadata;
        const lessonPath = [
            "learn",
            "lecture",
            lecture.sequence,
            lecture.urlSlug,
            "lesson",
            lesson.sequence,
            lesson.urlSlug,
        ].map((part) => encodeURIComponent(String(part))).join("/");

        try {
            const lessonState = await getInitialState<Record<string, unknown>>(
                `/${lessonPath}`,
                this.context,
            );

            if (!lessonState) {
                return metadata;
            }

            metadata.presentation = {
                title:
                    metadata.presentation?.title ??
                    getQuizTitle(lessonState) ??
                    resultTitle ??
                    lesson.name,
                description:
                    metadata.presentation?.description ??
                    resultDescription ??
                    getQuizDescription(lessonState),
                examples:
                    metadata.presentation?.examples ??
                    (resultExamples.length > 0 ? resultExamples : findExamples(lessonState)),
            };

            await vscode.workspace.fs.writeFile(
                getQuizMetadataUri(this.folder.uri, lesson.index),
                new TextEncoder().encode(JSON.stringify(metadata, null, 2)),
            );
        } catch (error) {
            console.error(`[goormEDU] ${lesson.index} 문제 설명을 가져오지 못했습니다.`, error);
        }

        return metadata;
    }

    private showDescription(metadata: QuizMetadata): void {
        const rootUrl = vscode.workspace
            .getConfiguration("goormEDU")
            .get<string>("url");

        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                "goormEDU.quizDescription",
                `문제 · ${metadata.lesson.name}`,
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: true,
                },
                {
                    enableScripts: false,
                    retainContextWhenHidden: true,
                },
            );

            this.panel.onDidDispose(
                () => {
                    this.panel = undefined;
                },
                undefined,
                this.disposables,
            );
        } else {
            this.panel.title = `문제 · ${metadata.lesson.name}`;
            this.panel.reveal(vscode.ViewColumn.Beside, true);
        }

        this.panel.webview.html = getWebviewHtml(metadata, rootUrl);
    }

    dispose(): void {
        this.updateId++;
        this.panel?.dispose();
        this.panel = undefined;
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
