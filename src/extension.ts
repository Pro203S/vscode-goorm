import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import workspace from "./workspace";
import axios from "axios";

export async function activate(context: vscode.ExtensionContext) {
	// 명령어 추가
	const commands = fs.readdirSync(path.join(context.extensionPath, "./out/commands"), "utf-8")
		.filter(v => v.endsWith(".js"))
		.map(v => `./commands/${v}`);

	for await (const command of commands) {
		try {
			const cmd = await import(command);
			if (
				typeof cmd?.command !== "string" ||
				typeof cmd?.callback !== "function"
			) throw new Error("Invalid type");

			context.subscriptions.push(
				vscode.commands.registerCommand(
					cmd.command,
					(...args: unknown[]) => cmd.callback(context, ...args),
				)
			);
		} catch (err) {
			console.error("[goormEDU] An error occurred when importing " + command);
			console.error(err);
		}
	}

	// 설정 변경 (files.exclude)
	const config = vscode.workspace.getConfiguration("files");

	await config.update(
		"exclude",
		{
			...config.get<Record<string, boolean>>("exclude"),
			"**/.goorm": true,
		},
		vscode.ConfigurationTarget.Global,
	);

	// 상태바 아이콘
	const statusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

	statusbar.name = "구름EDU";
	statusbar.command = "goormEDU.start";
	statusbar.text = "$(goormEDU-logo)";
	statusbar.tooltip = "구름EDU 문제 풀기";

	statusbar.show();

	context.subscriptions.push(statusbar);

	// 만약 workspace가 열려있을 때

	const folder = vscode.workspace.workspaceFolders?.[0];

	if (folder) {
		void workspace(context);
	}
}
