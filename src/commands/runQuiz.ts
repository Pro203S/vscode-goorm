import * as vscode from "vscode";
import { getActiveQuiz } from "../workspace/quizContext";

export const command = "goormEDU.runQuiz";

export async function callback(): Promise<void> {
    const quiz = getActiveQuiz();

    if (!quiz) {
        return;
    }

    await quiz.document.save();
    await vscode.commands.executeCommand("workbench.action.debug.run");
}
