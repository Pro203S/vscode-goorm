import * as vscode from "vscode";
import { QuizMetadata } from "../lib/quizMetadata";
import { getWebviewHtml } from "./quizPresentation";

export class QuizPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private panelDisposable: vscode.Disposable | undefined;

    show(metadata: QuizMetadata): void {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                "goormEDU.quizDescription",
                this.getTitle(metadata),
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: true,
                },
                {
                    enableScripts: false,
                    retainContextWhenHidden: true,
                },
            );
            this.panelDisposable = this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.panelDisposable?.dispose();
                this.panelDisposable = undefined;
            });
        } else {
            this.panel.title = this.getTitle(metadata);
            this.panel.reveal(vscode.ViewColumn.Beside, true);
        }

        const rootUrl = vscode.workspace
            .getConfiguration("goormEDU")
            .get<string>("url");

        this.panel.webview.html = getWebviewHtml(metadata, rootUrl);
    }

    hide(): void {
        const panel = this.panel;

        this.panel = undefined;
        this.panelDisposable?.dispose();
        this.panelDisposable = undefined;
        panel?.dispose();
    }

    dispose(): void {
        this.hide();
    }

    private getTitle(metadata: QuizMetadata): string {
        return `문제 · ${metadata.lesson.name}`;
    }
}
