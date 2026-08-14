import * as vscode from "vscode";
import chalk from "chalk";

export const terminalChalk = new chalk.Instance({ level: 3 });

export default class DebugTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    private inputEmitter = new vscode.EventEmitter<string>();
    private closeEmitter = new vscode.EventEmitter<number | void>();
    onDidWrite = this.writeEmitter.event;
    onDidClose = this.closeEmitter.event;
    onDidInput = this.inputEmitter.event;

    constructor() { }

    open() {
        this.write(
            terminalChalk.gray.bold("프로세스가 시작되었습니다.") +
            " " +
            terminalChalk.gray("입력값을 직접 입력해주세요.") +
            "\r\n",
        );
    }

    write(data: string) {
        this.writeEmitter.fire(data);
    }

    handleInput(data: string) {
        if (data === "\r")
            return this.inputEmitter.fire("\r");

        this.inputEmitter.fire(data);
    }

    close() {

    }
}
