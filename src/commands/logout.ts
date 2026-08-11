import * as vscode from 'vscode';
import { openBrowser } from '../browser';
import { getGoormUrl } from '../lib/validateURL';

export const command = "goormEDU.logout";

export async function callback(context: vscode.ExtensionContext) {
    const root = await getGoormUrl();
    if (!root) return;

    await context.secrets.delete("session");

    const cookies = await openBrowser({
        "url": `${root}/logout`,
        "completedURL": root,
        "verbose": true,
    });

    vscode.window.showInformationMessage("로그아웃되었습니다.");

    console.log(cookies);
}
