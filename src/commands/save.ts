import * as vscode from "vscode";
import { getActiveQuiz } from "../workspace/quizContext";

export const command = "goormEDU.save";

export async function callback(): Promise<void> {
    const quiz = getActiveQuiz();

    if (!quiz) {
        return;
    }

    const saved = await quiz.document.save();

    if (!saved) {
        await vscode.window.showErrorMessage("문제 파일을 저장하지 못했습니다.");
    }
}
