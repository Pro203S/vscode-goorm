import * as vscode from "vscode";
import { getActiveQuiz } from "../workspace/quizContext";

export const command = "goormEDU.runQuiz";

export async function callback(context: vscode.ExtensionContext): Promise<void> {
    const quiz = getActiveQuiz();

    if (!quiz) {
        vscode.window.showErrorMessage("구름EDU 워크스페이스에서만 사용할 수 있습니다.");
        return;
    }


}
