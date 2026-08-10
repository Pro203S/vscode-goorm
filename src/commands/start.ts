import * as vscode from 'vscode';
import getInitialState, { LectureInitialState } from '../initialState';
import * as fs from 'fs';

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

export const command = "goormEDU.start";

export async function callback(context: vscode.ExtensionContext) {
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

    await vscode.commands.executeCommand("vscode.openFolder", uri, false);
}
