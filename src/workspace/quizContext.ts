import * as vscode from "vscode";
import { Mapping } from "../lib/mapping";
import { QuizMetadata } from "../lib/quizMetadata";

export type ActiveQuiz = {
    document: vscode.TextDocument;
    lesson: Mapping["lessons"][number];
    metadata: QuizMetadata;
};

let activeQuiz: ActiveQuiz | undefined;

export function getActiveQuiz(): ActiveQuiz | undefined {
    return activeQuiz;
}

export function setActiveQuiz(value: ActiveQuiz | undefined): void {
    activeQuiz = value;
}
