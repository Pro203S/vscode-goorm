import * as vscode from "vscode";
import { getCookie } from "../rest";
import { getActiveQuiz } from "../workspace/quizContext";
import getInitialState, { QuizInitialState } from "../initialState";
import SocketIO from "../lib/socketIo";
import { getSocket, setSocket } from "../lib/socketContext";
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

                getSocket()?.close();
                setSocket(undefined);

                const socket = new SocketIO(root, {
                    "cookies": await getCookie(context)
                });

                socket.on("error", (error: Error) => {
                    if (getSocket() === socket) setSocket(undefined);
                    vscode.window.showErrorMessage("실행 준비 중에 오류가 발생했습니다. " + error.message);
                });

                socket.on("close", ({ code, reason }) => {
                    if (getSocket() === socket) setSocket(undefined);
                    vscode.window.showErrorMessage("실행 준비 중에 오류가 발생했습니다. " + code + " " + Buffer.from(reason).toString("utf-8"));
                });

                await socket.connect();
                setSocket(socket);

                socket.send("enterance_to_lesson", {
                    "user_id": state.userData.id,
                    "lesson_index": state.lesson.index,
                    "room_id": state.userData.id,
                    "room_type": "user",
                    "lecture_index": state.lecture.index,
                    "channel_index": state.channel.index
                });
                socket.send("enterance_to_quiz", {
                    "lectureIndex": state.lecture.index,
                    "examIndex": state.lesson.index,
                    "quizIndex": state.lesson.tutorial_quiz_index,
                    "userId": state.userData.id,
                    "isLesson": true
                });

                socket.send("updateBrowserState", {
                    "userId": state.userData.id,
                    "lectureIndex": state.lecture.index,
                    "lessonIndex": state.lesson.index,
                    "isBrowserActive": true,
                    "isOnline": true,
                    "userData": state.userData,
                    "channelIndex": state.channel.index
                });

                socket.send("entrance_to_collaboration", {
                    "lecture_index": state.lecture.index,
                    "lesson_index": state.lesson.index,
                    "collaboration_option": "personal",
                    "owner_id": state.userData.id,
                    "user_id": state.userData.id,
                    "user_name": state.userData.name,
                    "room_id": state.userData.id,
                    "room_type": "user"
                });
            }
        );
    } catch (err) {
        const e = err as Error;
        vscode.window.showErrorMessage("구름EDU: " + e.message);
    }
}
