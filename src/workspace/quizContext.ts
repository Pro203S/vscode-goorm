import * as vscode from "vscode";
import { Mapping } from "../lib/mapping";
import { QuizMetadata, StoredQuizProject } from "../lib/quizMetadata";

export type ActiveQuizLesson = Mapping["lessons"][number] & QuizMetadata["lesson"];

export type ActiveQuizProject = StoredQuizProject & {
    key: string;
    uri: vscode.Uri;
};

export type ActiveQuiz = {
    document: vscode.TextDocument;
    lecture: QuizMetadata["lecture"];
    lesson: ActiveQuizLesson;
    project: ActiveQuizProject;
    metadata: QuizMetadata;
};

let activeQuiz: ActiveQuiz | undefined;

export function getActiveQuiz(): ActiveQuiz | undefined {
    return activeQuiz;
}

export function setActiveQuiz(value: ActiveQuiz | undefined): void {
    activeQuiz = value;
}
