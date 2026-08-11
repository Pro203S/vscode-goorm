import * as vscode from 'vscode';

export function validateURL(url?: string): url is string {
	try {
		if (!url) return false;
		const u = new URL(url);
		if (!u.hostname.includes(".goorm.io")) return false;

		return true;
	} catch {
		return false;
	}
}

export async function getGoormUrl() {
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
			vscode.window.showErrorMessage("구름EDU의 루트 URL이 잘못되었습니다.");
			return;
		}

		root = newRoot;
		await config.update("url", newRoot, 1);
	}

	return root;
}