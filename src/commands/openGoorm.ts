import * as vscode from 'vscode';
import { getGoormUrl } from '../lib/validateURL';
import { getActiveQuiz } from '../workspace/quizContext';

export const command = "goormEDU.openGoorm";

export async function callback(context: vscode.ExtensionContext) {
    const root = await getGoormUrl();
    if (!root) return;

    const quiz = getActiveQuiz();
    if (!quiz) {
        vscode.window.showErrorMessage("구름EDU 워크스페이스에서만 사용할 수 있습니다.");
        return;
    }

    vscode.env.openExternal(vscode.Uri.parse(`${root}/learn/lecture/${quiz.metadata.lecture.sequence}/${quiz.metadata.lecture.urlSlug}/lesson/${quiz.lesson.data.seq}/${quiz.metadata.lesson.urlSlug}`));
}
