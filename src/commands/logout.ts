import * as vscode from 'vscode';
import { openBrowser } from '../browser';
import { getGoormUrl } from '../lib/validateURL';
import { SESSION_SECRET_KEY } from '../rest';
import { getActiveQuiz } from '../workspace/quizContext';

export const command = "goormEDU.logout";

export async function callback(context: vscode.ExtensionContext) {
    const root = await getGoormUrl();
    if (!root) return;

    await context.secrets.delete(SESSION_SECRET_KEY);

    await openBrowser({
        "url": `${root}/logout`,
        "completedURL": root,
        //"verbose": true,
    });

    if (getActiveQuiz())
        await vscode.commands.executeCommand("workbench.action.closeFolder");

    vscode.window.showInformationMessage("로그아웃되었습니다.");
}
