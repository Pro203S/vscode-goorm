import * as vscode from 'vscode';
import { openBrowser } from '../browser';
import { SESSION_SECRET_KEY } from '../rest';
import { getGoormUrl, validateURL } from '../lib/validateURL';
import getInitialState from '../initialState';

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
    const root = await getGoormUrl();
    if (!root) return;

    const cookies = await openBrowser({
        "url": `${root}/login`,
        "completedURL": createLoginCompletedPredicate(root),
        //"verbose": true,
    });

    await context.secrets.store(
        SESSION_SECRET_KEY,
        JSON.stringify(cookies),
    );
    
    const state = await getInitialState("/", context);
    if (!state) {
        vscode.window.showErrorMessage("사용자의 정보를 가져오는데 실패했습니다.");
        return;
    }

    vscode.window.showInformationMessage(`${state.userData.name}으로 로그인되었습니다.`);

    console.log("[goormEDU] Login completed.");
}
