import * as vscode from "vscode";
import { getActiveQuiz } from "../workspace/quizContext";
import { getSocket } from "../lib/socketContext";
import getInitialState, { QuizInitialState } from "../initialState";
import { refreshLessonDecorations } from "../workspace/lessonDecorations";
import { axios } from "../rest";
import { getGoormUrl } from "../lib/validateURL";

export const command = "goormEDU.submitQuiz";
let isSubmitting = false;

export async function callback(context: vscode.ExtensionContext): Promise<void> {
    if (isSubmitting) {
        await vscode.window.showErrorMessage("이미 제출하고 있습니다!");
        return;
    }

    try {
        const root = await getGoormUrl();
        if (!root) return;

        const quiz = getActiveQuiz();
        if (!quiz) {
            vscode.window.showErrorMessage("구름EDU 워크스페이스에서만 사용할 수 있습니다.");
            return;
        }

        if (quiz.metadata.result.quizMode === "run_mode") {
            vscode.window.showErrorMessage("이 문제는 실행 전용이므로 제출할 수 없습니다.");
            return;
        }

        const socket = getSocket();
        if (!socket) {
            vscode.window.showErrorMessage("구름EDU 서버와 연결되어있지 않습니다.");
            return;
        }

        const file = quiz.file;
        if (!file) {
            vscode.window.showErrorMessage("파일 정보를 가져오는 데 실패했습니다.");
            return;
        }

        isSubmitting = true;

        try {
            await vscode.window.withProgress(
                {
                    "location": vscode.ProgressLocation.Notification,
                    "title": "제출하고 있습니다...",
                    "cancellable": false
                },
                async () => {
                    const state = await getInitialState<QuizInitialState>(`/learn/lecture/${quiz.metadata.lecture.sequence}/${quiz.metadata.lecture.urlSlug}/lesson/${quiz.lesson.data.seq}/${quiz.metadata.lesson.urlSlug}`, context);
                    const userData = state?.userData;
                    if (!userData) {
                        const login = await vscode.window.showErrorMessage(
                            "로그인 후 제출 할 수 있습니다.",
                            "로그인",
                        );

                        if (login === "로그인") {
                            await vscode.commands.executeCommand("goormEDU.login");
                        }

                        return;
                    }

                    await quiz.document.save();

                    socket.send("/submit_quiz/programming", {
                        "id": Date.now(),
                        "filetype": quiz.project.mainFiletype,
                        "lang": quiz.project.language,
                        "lecture_index": quiz.lecture.index,
                        "lesson_index": quiz.lesson.index,
                        "quiz_index": quiz.metadata.result.quizIndex,
                        "user_id": userData.id,
                        "userData": userData,
                        "removed_bookmarks": [],
                        "source": [
                            quiz.document.getText()
                        ]
                    });

                    const result = await socket.waitUntil<SubmitQuizResult>("/submit_quiz/programming");

                    await axios({
                        context,
                        "url": `${root}/api/log/tutorial/submit`,
                        "method": "POST",
                        "params": {
                            "tag": "submit",
                            "lectureIndex": state.lecture.index,
                            "lessonIndex": state.lesson.index,
                            "quizIndex": state.lesson.tutorial_quiz_index,
                            "lectureType": state.lecture.type.toString(),
                            "form": state.lesson.quiz_form,
                            "lang": quiz.project.language
                        }
                    });

                    await refreshLessonDecorations(
                        context,
                        quiz.metadata.lecture.sequence,
                    );

                    if (result.submit_mode) {
                        vscode.window.showInformationMessage("제출되었습니다.");
                        return;
                    }

                    if (result.solved && result.all_pass) {
                        vscode.window.showInformationMessage("정답입니다.");
                        return;
                    }

                    vscode.window.showErrorMessage(`오답입니다. ${result.score ? `(${result.score}/100)` : ``}`);
                    return;
                },
            );
        } finally {
            isSubmitting = false;
        }
    } catch (err) {
        const e = err as Error;
        vscode.window.showErrorMessage("구름EDU: " + e.message);
    }
}
