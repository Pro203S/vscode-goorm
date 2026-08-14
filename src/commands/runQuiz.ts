import * as vscode from "vscode";
import { axios, getCookie } from "../rest";
import { getActiveQuiz } from "../workspace/quizContext";
import getInitialState, { QuizInitialState } from "../initialState";
import { getGoormUrl } from "../lib/validateURL";
import { getSocket } from "../lib/socketContext";
import DebugSocket from "../lib/debugSocket";
import DebugTerminal, { terminalChalk } from "../lib/debugTerminal";

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

                const socket = getSocket();
                if (!socket) {
                    await vscode.window.showErrorMessage("구름EDU 서버에 연결되어있지 않습니다.");
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

                socket.send("run_in_collaboration", {
                    "type": "term",
                    "target": quiz.project.label
                });

                socket.send("build_in_container", {
                    "filetype": quiz.project.mainFiletype,
                    "form": state.lesson.quiz_form,
                    "href": `${root}/learn/lecture/${quiz.metadata.lecture.sequence}/${quiz.metadata.lecture.urlSlug}/lesson/${quiz.lesson.data.seq}/${quiz.metadata.lesson.urlSlug}`,
                    "input": "",
                    "output": "",
                    "lang": quiz.project.language,
                    "label": quiz.project.label,
                    "lecture_index": state.lecture.index,
                    "lesson_index": state.lesson.index,
                    "quiz_index": state.lesson.tutorial_quiz_index,
                    "show_runtime": true,
                    "source": [
                        quiz.document.getText()
                    ],
                    "stat": false,
                    "collaboration": true
                });

                socket.once("container_fail", (data: { "err_msg": string }) => {
                    vscode.window.showErrorMessage("컴파일 실패: " + data.err_msg);
                });

                socket.once("container_complete", async (data: ContainerCompleteResponse) => {
                    const containerSocket = data.socket;
                    const date36 = () => new Date().getTime().toString(36);
                    const socketUrl = `${containerSocket.options.secure ? "https" : "http"}://${containerSocket.url}${containerSocket.options.path}/`;

                    const pollingSid = await axios({
                        context,
                        "url": socketUrl,
                        "params": {
                            "EIO": 4,
                            "transport": "polling",
                            "t": date36()
                        }
                    });
                    if (!pollingSid || typeof pollingSid.data !== "string") {
                        vscode.window.showErrorMessage("구름EDU: 서버 연결에 실패했습니다. (1)");
                        return;
                    }
                    const pollingSidData = JSON.parse(pollingSid.data.slice(1));
                    const sid = pollingSidData.sid;

                    const pollingMustBeOk = await axios({
                        context,
                        "url": socketUrl,
                        "method": "POST",
                        "data": "40",
                        "params": {
                            "EIO": 4,
                            "transport": "polling",
                            "t": date36(),
                            sid
                        }
                    });
                    if (!pollingMustBeOk || pollingMustBeOk.data !== "ok") {
                        vscode.window.showErrorMessage("구름EDU: 서버 연결에 실패했습니다. (2)");
                        return;
                    }

                    const pollingRun = await axios({
                        context,
                        "url": socketUrl,
                        "data": `42${JSON.stringify([
                            "run",
                            {
                                "token": data.token,
                                "daemon": data.daemon,
                                "app": data.app,
                                "main": data.main,
                                "run_option": data.run_option,
                                "stat": false,
                                "tty_mode": false,
                                "collaboration": true
                            }
                        ])}`,
                        "method": "POST",
                        "params": {
                            "EIO": 4,
                            "transport": "polling",
                            "t": date36(),
                            "sid": sid
                        }
                    });
                    if (!pollingRun || pollingRun.data !== "ok") {
                        vscode.window.showErrorMessage("구름EDU: 서버 연결에 실패했습니다. (3)");
                        return;
                    }

                    const debugSocket = new DebugSocket(socketUrl, sid);

                    const terminalProvider = new DebugTerminal();
                    const terminal = vscode.window.createTerminal({
                        "name": "구름EDU",
                        "pty": terminalProvider
                    });

                    const disposeAll = () => {
                        terminal.dispose();
                        terminalProvider.close();
                        inputEvent.dispose();
                        closeEvent.dispose();
                    };

                    let containerStopped = false;

                    terminal.show();

                    const closeEvent = vscode.window.onDidCloseTerminal((e) => {
                        if (e !== terminal) return;

                        socket.send("container_stop", { "index": data.token });
                        debugSocket.sendRaw("41");
                        debugSocket.close();
                        containerStopped = true;

                        disposeAll();
                    });

                    const inputEvent = terminalProvider.onDidInput((e) => {
                        if (containerStopped && e.includes("\r")) {
                            disposeAll();
                            return;
                        }
                        debugSocket.send("pty_execute_command", {
                            "index": data.token,
                            "command": e
                        });
                    });

                    debugSocket.on("pty_command_result", (data) => {
                        terminalProvider.write(data.stdout);
                    });

                    debugSocket.on("terminal_exited." + data.token, () => {
                        debugSocket.sendRaw("41");
                        debugSocket.close();
                    });

                    debugSocket.on("close", () => {
                        terminalProvider.write(
                            "\r\n" +
                            terminalChalk.white.bold("프로세스가 종료되었습니다.") +
                            "\r\n",
                        );
                        containerStopped = true;

                        return;
                    });

                    await debugSocket.connect();
                });
            }
        );
    } catch (err) {
        const e = err as Error;
        vscode.window.showErrorMessage("구름EDU: " + e.message);
    }
}
