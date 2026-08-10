import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { SESSION_SECRET_KEY } from "./session";

export async function activate(context: vscode.ExtensionContext) {
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

	const session = await context.secrets.get(SESSION_SECRET_KEY);
	if (!session) return;

	
}
