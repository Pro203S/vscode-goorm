import * as vscode from 'vscode';
import getInitialState from '../initialState';

export const command = "goormEDU.start";

export async function callback(context: vscode.ExtensionContext) {
    const state = getInitialState(context);
    if (!state) {
        const flag = await vscode.window.showErrorMessage("로그인 후 구름EDU의 문제를 풀 수 있습니다.", "로그인") === "로그인";
        if (!flag) return;
        return await vscode.commands.executeCommand("goormEDU.login");
    }

    
}
