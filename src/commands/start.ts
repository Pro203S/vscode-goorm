import * as vscode from 'vscode';
import getInitialState, { LectureInitialState } from '../initialState';
import sanitizeFileName from '../lib/sanitizeFileName';
import { Mapping, mappingToJson } from '../lib/mapping';
import getQuiz from '../lib/getQuiz';
import { createQuizMetadata, getQuizMetadataUri } from '../lib/quizMetadata';
import { getSavedWorkspaceFolders, WORKSPACE_FOLDERS_KEY } from '../workspace/workspaceHistory';
import { getGoormUrl } from '../lib/validateURL';

export async function getUniqueFolderName(
    parentUri: vscode.Uri,
    folderName: string,
): Promise<string> {
    let name = folderName;
    let index = 1;

    while (true) {
        const uri = vscode.Uri.joinPath(parentUri, name);

        try {
            await vscode.workspace.fs.stat(uri);

            name = `${folderName}${index}`;
            index++;
        } catch {
            return name;
        }
    }
}

async function checkFileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

export const command = "goormEDU.start";

async function createWorkspace(context: vscode.ExtensionContext) {
    try {
        const state = await getInitialState("/", context);
        if (!state || !state.userData) {
            const flag = await vscode.window.showErrorMessage("로그인 후 구름EDU의 문제를 풀 수 있습니다.", "로그인") === "로그인";
            if (!flag) return;
            return await vscode.commands.executeCommand("goormEDU.login");
        }

        const lectures = state.channelLectureList.allLectures;
        const rawLecture = await vscode.window.showQuickPick(
            lectures.map(v => ({
                "label": v.subject,
                "description": v.description,
            } satisfies vscode.QuickPickItem)),
            {
                "canPickMany": false,
                "ignoreFocusOut": false,
                "title": "구름EDU",
                "placeHolder": "강좌를 선택해주세요.",
                "matchOnDescription": true
            }
        );
        if (!rawLecture) return;

        const lecture = lectures.find(v => v.subject === rawLecture.label && v.description === rawLecture.description);
        if (!lecture) return vscode.window.showErrorMessage("강좌를 찾지 못했습니다.");

        const lectureState = await getInitialState<LectureInitialState>(`/learn/lecture/${lecture.sequence}/${lecture.url_slug}`, context);
        if (!lectureState) return vscode.window.showErrorMessage("강좌 데이터를 가져오지 못했습니다.");

        if (!lectureState.lectureData.myLecture) {
            const a = await vscode.window.showErrorMessage("수강신청을 먼저 해주세요.", "구름EDU에서 보기");
            if (a !== "구름EDU에서 보기") return;

            const url = await getGoormUrl();
            if (!url) return;

            const base = vscode.Uri.parse(url);
            vscode.env.openExternal(vscode.Uri.joinPath(base, `/learn/lecture/${lecture.sequence}/${lecture.url_slug}`));
            return;
        }

        const targetPath = await vscode.window.showOpenDialog({
            "canSelectFiles": false,
            "canSelectFolders": true,
            "canSelectMany": false,
            "title": "문제 풀기에 사용할 폴더 선택"
        });
        if (!targetPath?.[0]) return;

        let unique = await getUniqueFolderName(targetPath[0], lecture.url_slug);
        const uri = vscode.Uri.joinPath(targetPath[0], unique);
        await vscode.workspace.fs.createDirectory(uri);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".goorm"));

        await vscode.window.withProgress(
            {
                "title": "작업 환경을 세팅하고 있습니다...",
                "location": vscode.ProgressLocation.Notification,
                "cancellable": false
            },
            async () => {
                const data = lectureState.lectureData;

                const fs = vscode.workspace.fs;
                const join = vscode.Uri.joinPath;
                const goormPath = vscode.Uri.joinPath(uri, ".goorm");
                const quizzesPath = join(goormPath, "quizzes");
                await fs.createDirectory(quizzesPath);

                const mapping: Mapping[] = [];

                for await (const curriculum of data.curriculumData) {
                    const curriculumUri = join(uri, sanitizeFileName(curriculum.name));
                    const map = {
                        "data": {
                            "seq": curriculum.sequence,
                            "idx": curriculum.index
                        },
                        "filePath": curriculumUri,
                        "lessons": []
                    } as Mapping;

                    await fs.createDirectory(curriculumUri);
                    for await (const lesson of curriculum.lessons) {
                        const quiz = await getQuiz(lecture.index, lesson.index, state.userData.id, context);
                        if (!quiz?.result) continue;

                        const lessonUri = join(curriculumUri, sanitizeFileName(lesson.name));
                        await fs.createDirectory(lessonUri);

                        map.lessons.push({
                            "filePath": lessonUri,
                            "data": {
                                "idx": lesson.index,
                                "seq": lesson.sequence
                            }
                        });

                        const quizMetadata = createQuizMetadata(
                            quiz,
                            {
                                "index": lecture.index,
                                "sequence": lecture.sequence,
                                "urlSlug": lecture.url_slug,
                            },
                            {
                                "index": lesson.index,
                                "sequence": lesson.sequence,
                                "urlSlug": lesson.urlSlug,
                                "name": lesson.name,
                            },
                        );

                        await fs.writeFile(
                            getQuizMetadataUri(uri, lesson.index),
                            new TextEncoder().encode(JSON.stringify(quizMetadata, null, 2)),
                        );

                        const projectKeys = Object.keys(quiz.result.project);
                        for await (const projectKey of projectKeys) {
                            const project = quiz.result.project[projectKey];
                            const files = project.files;
                            const projectUri = join(lessonUri, projectKey);
                            await fs.createDirectory(projectUri);

                            for await (const file of files) {
                                await fs.writeFile(join(projectUri, file.filename), new TextEncoder().encode(file.content[0].source));
                            }
                        }
                    }

                    mapping.push(map);
                }

                await fs.writeFile(
                    join(goormPath, "mapping.json"),
                    new TextEncoder().encode(JSON.stringify(mapping.map(v => mappingToJson(v, uri)), null, 2))
                );
            }
        );

        await vscode.commands.executeCommand("vscode.openFolder", uri, false);
    } catch (err) {
        console.error(err);
        vscode.window.showErrorMessage((err as any).stack);
    }
}

export async function callback(context: vscode.ExtensionContext) {
    let workspaceFolders = getSavedWorkspaceFolders(context);
    if (workspaceFolders.length <= 0) {
        return await createWorkspace(context);
    }

    for await (const folder of workspaceFolders) {
        if (await checkFileExists(folder.uri)) continue;

        await context.globalState.update(WORKSPACE_FOLDERS_KEY, workspaceFolders.filter(v => v.uri.fsPath !== folder.uri.fsPath));
        workspaceFolders = getSavedWorkspaceFolders(context);
    }

    const folder = await vscode.window.showQuickPick(
        [
            ...workspaceFolders.map(v => ({
                "label": v.lectureName,
                "description": v.uri.fsPath,
            } satisfies vscode.QuickPickItem)),
            {
                "label": "새 워크스페이스 만들기",
                "description": "새 워크스페이스를 만듭니다."
            },
            {
                "label": "워크스페이스 기록 삭제",
                "description": "기록을 삭제합니다."
            }
        ],
        {
            "canPickMany": false,
            "ignoreFocusOut": false,
            "title": "구름EDU",
            "placeHolder": "워크스페이스 선택",
            "matchOnDescription": true
        }
    );
    if (!folder) return;

    if (
        folder.label === "워크스페이스 기록 삭제" &&
        folder.description === "기록을 삭제합니다."
    ) {
        await context.globalState.update(WORKSPACE_FOLDERS_KEY, []);
        vscode.window.showInformationMessage("기록을 삭제했습니다.");
        return;
    }

    if (
        folder.label === "새 워크스페이스 만들기" &&
        folder.description === "새 워크스페이스를 만듭니다."
    ) {
        return await createWorkspace(context);
    }

    const v = workspaceFolders.find(v => folder.label === v.lectureName && folder.description === v.uri.fsPath);
    if (!v) return;

    await vscode.commands.executeCommand("vscode.openFolder", v.uri, false);
}
