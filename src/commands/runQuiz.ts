import * as vscode from "vscode";
import { getCookie } from "../rest";
import { getActiveQuiz } from "../workspace/quizContext";
import getInitialState, { QuizInitialState } from "../initialState";
import { getGoormUrl } from "../lib/validateURL";

export const command = "goormEDU.runQuiz";

export async function callback(context: vscode.ExtensionContext): Promise<void> {
    try {
        await vscode.window.withProgress(
            {
                "location": vscode.ProgressLocation.Notification,
                "cancellable": false,
                "title": "실행 준비 중..."
            },
            async () => {
                const quiz = getActiveQuiz();

                if (!quiz) {
                    await vscode.window.showErrorMessage("구름EDU 워크스페이스에서만 사용할 수 있습니다.");
                    return;
                }

                const cookie = await getCookie(context);
                const state = await getInitialState<QuizInitialState>(`/learn/lecture/${quiz.metadata.lecture.sequence}/${quiz.metadata.lecture.urlSlug}/lesson/${quiz.lesson.data.seq}/${quiz.metadata.lesson.urlSlug}`, context);
                if (!state?.userData || !cookie) {
                    const login = await vscode.window.showErrorMessage(
                        "로그인 후 구름EDU의 문제를 풀 수 있습니다.",
                        "로그인",
                    );

                    if (login === "로그인") {
                        await vscode.commands.executeCommand("goormEDU.login");
                    }

                    return;
                }

                const root = await getGoormUrl();
                if (!root) return;

            }
        );
    } catch (err) {
        const e = err as Error;
        vscode.window.showErrorMessage("구름EDU: " + e.message);
    }
}
