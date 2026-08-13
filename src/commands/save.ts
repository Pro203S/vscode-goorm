import * as path from "path";
import * as vscode from "vscode";
import getInitialState from "../initialState";
import getQuiz, { QuizResult } from "../lib/getQuiz";
import { axios } from "../rest";
import { getActiveQuiz } from "../workspace/quizContext";
import { getGoormUrl } from "../lib/validateURL";

export const command = "goormEDU.save";

type QuizProject = QuizResult["result"]["project"][string];
type QuizFile = QuizProject["files"][number];

function isUriInside(parent: vscode.Uri, child: vscode.Uri): boolean {
    if (parent.scheme !== child.scheme || parent.authority !== child.authority) {
        return false;
    }

    const relative = parent.scheme === "file"
        ? path.relative(parent.fsPath, child.fsPath)
        : path.posix.relative(parent.path, child.path);

    return (
        relative === "" ||
        (
            relative !== ".." &&
            !relative.startsWith(`..${path.sep}`) &&
            !relative.startsWith("../") &&
            !path.isAbsolute(relative) &&
            !path.posix.isAbsolute(relative)
        )
    );
}

function getFileCandidates(projectUri: vscode.Uri, file: QuizFile): vscode.Uri[] {
    const rawPath = file.filepath.replaceAll("\\", "/");
    const normalizedPath = path.posix.normalize(rawPath || ".");
    const isSafePath = (
        normalizedPath !== ".." &&
        !normalizedPath.startsWith("../") &&
        !path.posix.isAbsolute(normalizedPath) &&
        !path.win32.isAbsolute(normalizedPath)
    );
    const relativePath = isSafePath && normalizedPath !== "."
        ? path.posix.basename(normalizedPath) === file.filename
            ? normalizedPath
            : path.posix.join(normalizedPath, file.filename)
        : file.filename;
    const candidates = [
        vscode.Uri.joinPath(projectUri, relativePath),
        vscode.Uri.joinPath(projectUri, file.filename),
    ];

    return candidates.filter(
        (uri, index) => candidates.findIndex((candidate) => candidate.toString() === uri.toString()) === index,
    );
}

async function readLocalSource(
    projectUri: vscode.Uri,
    file: QuizFile,
): Promise<string | undefined> {
    if (file.isDir) {
        return undefined;
    }

    for (const uri of getFileCandidates(projectUri, file)) {
        const document = vscode.workspace.textDocuments.find(
            (item) => item.uri.toString() === uri.toString(),
        );

        if (document) {
            return document.getText();
        }

        try {
            const bytes = await vscode.workspace.fs.readFile(uri);

            return new TextDecoder().decode(bytes);
        } catch {
            // 이전 버전에서 파일 경로를 평탄화했을 수 있어 다음 후보를 확인합니다.
        }
    }

    return undefined;
}

function applySource(file: QuizFile, source: string): QuizFile {
    if (file.content.length === 0) {
        return {
            ...file,
            content: [{
                hidden: false,
                readonly: false,
                source,
            }],
        };
    }

    const editableIndex = file.content.findIndex(
        (content) => !content.hidden && !content.readonly,
    );
    const targetIndex = editableIndex >= 0 ? editableIndex : 0;

    return {
        ...file,
        content: file.content.map((content, index) =>
            index === targetIndex
                ? { ...content, source }
                : content,
        ),
    };
}

async function createProjectPayload(
    projectUri: vscode.Uri,
    project: QuizProject,
): Promise<QuizProject> {
    const files = await Promise.all(
        project.files.map(async (file) => {
            const source = await readLocalSource(projectUri, file);

            return source === undefined
                ? file
                : applySource(file, source);
        }),
    );

    return { ...project, files };
}

export async function callback(context: vscode.ExtensionContext): Promise<void> {
    const activeQuiz = getActiveQuiz();

    if (!activeQuiz) {
        await vscode.window.showErrorMessage("구름EDU 문제 파일에서만 사용할 수 있습니다.");
        return;
    }

    try {
        const state = await getInitialState("/", context);
        if (!state?.userData) {
            const login = await vscode.window.showErrorMessage(
                "로그인 후 구름EDU 문제를 저장할 수 있습니다.",
                "로그인",
            );

            if (login === "로그인") {
                await vscode.commands.executeCommand("goormEDU.login");
            }

            return;
        }

        if (!await activeQuiz.document.save()) {
            throw new Error("현재 문제 파일을 로컬에 저장하지 못했습니다.");
        }

        const url = await getGoormUrl();
        if (!url) return;

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.SourceControl,
                cancellable: false,
            },
            async () => {
                const { metadata, lesson, document } = activeQuiz;
                const quiz = await getQuiz(
                    metadata.lecture.index,
                    metadata.lesson.index,
                    state.userData.id,
                    context,
                );

                if (!quiz) {
                    throw new Error("문제 데이터를 가져오지 못했습니다.");
                }

                const projectEntry = Object.entries(quiz.result.project).find(([projectKey]) =>
                    isUriInside(vscode.Uri.joinPath(lesson.filePath, projectKey), document.uri),
                );

                if (!projectEntry) {
                    throw new Error("현재 파일이 속한 문제 프로젝트를 찾지 못했습니다.");
                }

                const [projectKey, project] = projectEntry;
                const projectUri = vscode.Uri.joinPath(lesson.filePath, projectKey);
                const projectPayload = await createProjectPayload(projectUri, project);
                const response = await axios({
                    context,
                    "method": "POST",
                    "url": url + "/api/workspace/save",
                    "data": {
                        "lectureIndex": metadata.lecture.index,
                        "examIndex": metadata.lesson.index,
                        "quizIndex": quiz.result.quizIndex,
                        "form": quiz.result.quizForm,
                        "project": projectPayload,
                        "userId": state.userData.id,
                        "removedBookmarks": quiz.result.removedBookmarks,
                        "collaborationRoomId": state.userData.id,
                        "collaborationRoomType": "user",
                    },
                });

                if (!response || response.status < 200 || response.status >= 300) {
                    throw new Error(
                        response
                            ? `저장 요청이 실패했습니다. (HTTP ${response.status})`
                            : "로그인 세션을 찾지 못했습니다.",
                    );
                }
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        console.error("[goormEDU] 문제 저장에 실패했습니다.", error);
        await vscode.window.showErrorMessage(`문제를 저장하지 못했습니다: ${message}`);
    }
}
