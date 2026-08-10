import * as vscode from "vscode";
import { getActiveQuiz } from "../workspace/quizContext";

export const command = "goormEDU.submitQuiz";

export async function callback(context: vscode.ExtensionContext): Promise<void> {
    const quiz = getActiveQuiz();

    if (!quiz) {
        vscode.window.showErrorMessage("구름EDU 워크스페이스에서만 사용할 수 있습니다.");
        return;
    }

    const action = await vscode.window.showInformationMessage(
        "VS Code 직접 제출 연동은 아직 준비되지 않았습니다.",
        "구름EDU 문제 열기",
    );


}
