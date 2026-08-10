import * as vscode from 'vscode';
import getInitialState from '../initialState';
import registerGuideAnchors from './guideAnchors';

export default async function workspace(context: vscode.ExtensionContext) {
    const folder = vscode.workspace.workspaceFolders?.[0] as vscode.WorkspaceFolder;
    const directory = await vscode.workspace.fs.readDirectory(folder.uri);
    if (!directory.find(v => v[0] === ".goorm" && v[1] === 2)) return;

    const { userData } = await getInitialState("/", context) ?? {};
    if (!userData) {
        await vscode.window.showErrorMessage(
            "구름EDU 오류",
            {
                "modal": true,
                "detail": "구름EDU의 계정 정보를 가져올 수 없습니다.",
            },
            "로그아웃"
        );
        await vscode.commands.executeCommand("goormEDU.logout");
        await vscode.commands.executeCommand("workbench.action.closeFolder");
        return;
    }

    vscode.window.showInformationMessage(`현재 ${userData.name}으(로) 구름EDU에 로그인되어있습니다.`);

    const fs = vscode.workspace.fs;

    context.subscriptions.push(
        registerGuideAnchors(),
        //vscode.workspace.onDidOpenTextDocument()
    );
}
