import * as vscode from "vscode";
import { getActiveQuiz } from "../workspace/quizContext";

export const command = "goormEDU.submitQuiz";

export async function callback(): Promise<void> {
    const quiz = getActiveQuiz();

    if (!quiz) {
        return;
    }

    const action = await vscode.window.showInformationMessage(
        "VS Code 직접 제출 연동은 아직 준비되지 않았습니다.",
        "구름EDU 문제 열기",
    );

    if (action !== "구름EDU 문제 열기") {
        return;
    }

    const root = vscode.workspace
        .getConfiguration("goormEDU")
        .get<string>("url");

    if (!root) {
        await vscode.window.showErrorMessage("goormEDU.url 설정이 필요합니다.");
        return;
    }

    const { lecture, lesson } = quiz.metadata;
    const lessonPath = [
        "learn",
        "lecture",
        lecture.sequence,
        lecture.urlSlug,
        "lesson",
        lesson.sequence,
        lesson.urlSlug,
    ].map((part) => encodeURIComponent(String(part))).join("/");
    const url = new URL(lessonPath, root.endsWith("/") ? root : `${root}/`);

    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
}
