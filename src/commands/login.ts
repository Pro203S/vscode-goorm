import * as vscode from 'vscode';
import { openBrowser } from '../browser';
import { SESSION_SECRET_KEY } from '../rest';

function validateURL(url?: string): url is string {
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

function createLoginCompletedPredicate(
    root: string,
): (url: string) => boolean {
    const expected = new URL(root);
    const rootPath = expected.pathname.replace(/\/+$/, "");
    const loginPath = `${rootPath}/login` || "/login";

    return (url) => {
        try {
            const current = new URL(url);
            const sameSchool =
                current.hostname.toLowerCase() ===
                expected.hostname.toLowerCase() &&
                current.port === expected.port;
            const isLoginPage =
                current.pathname === loginPath ||
                current.pathname.startsWith(`${loginPath}/`);

            return sameSchool && !isLoginPage;
        } catch {
            return false;
        }
    };
}

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
        "completedURL": createLoginCompletedPredicate(root),
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
