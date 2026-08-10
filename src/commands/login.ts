import * as vscode from 'vscode';
import { openBrowser } from '../browser';
import { SESSION_SECRET_KEY } from '../rest';

function validateURL(url?: string) {
	try {
		if (!url) return false;
		const u = new URL(url);
		if (!u.hostname.includes(".goorm.io")) return false;

		return true;
	} catch {
		return false;
	}
}

export const command = "goormEDU.login";

export async function callback(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration("goormEDU");

    let root = config.get<string>("url");
    if (!validateURL(root)) {
        const newRoot = await vscode.window.showInputBox({
            "title": "goormEDU 설정",
            "prompt": "구름EDU의 루트 URL을 입력해주세요. (예시: https://sunrint-hs.goorm.io)",
            "ignoreFocusOut": false,
            "placeHolder": "https://sunrint-hs.goorm.io"
        });
        if (!validateURL(newRoot)) {
            vscode.window.showErrorMessage("구름EDU의 루트 URL이 잘못되었기 때문에 로그인 할 수 없습니다.");
            return;
        }

        root = newRoot;
        await config.update("url", newRoot, 1);
    }

    const cookies = await openBrowser({
        "url": `${root}/login`,
        "completedURL": root,
        "cookieDomain": ".goorm.io",
        "verbose": true,
    });

    await context.secrets.store(
        SESSION_SECRET_KEY,
        JSON.stringify(cookies),
    );

    console.log("[goormEDU] Login completed.", {
        cookieCount: cookies.length,
    });
}
