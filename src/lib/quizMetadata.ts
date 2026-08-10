import * as vscode from "vscode";
import { QuizResult } from "./getQuiz";

export const QUIZ_METADATA_VERSION = 1;

type QuizProject = QuizResult["result"]["project"][string];

export type StoredQuizProject = Omit<QuizProject, "files"> & {
    files: (Omit<QuizProject["files"][number], "content"> & {
        content: Omit<QuizProject["files"][number]["content"][number], "source">[];
    })[];
};

export type QuizExample = {
    input: string;
    output: string;
};

export type QuizMetadata = {
    version: typeof QUIZ_METADATA_VERSION;
    presentation?: {
        title?: string;
        description?: string;
        examples?: QuizExample[];
    };
    lecture: {
        index: string;
        sequence: number;
        urlSlug: string;
    };
    lesson: {
        index: string;
        sequence: number;
        urlSlug: string;
        name: string;
    };
    result: Omit<QuizResult["result"], "project"> & {
        project: Record<string, StoredQuizProject>;
    };
};

export function getQuizMetadataUri(
    workspaceUri: vscode.Uri,
    lessonIndex: string,
): vscode.Uri {
    const filename = `${Buffer.from(lessonIndex, "utf8").toString("base64url")}.json`;

    return vscode.Uri.joinPath(
        workspaceUri,
        ".goorm",
        "quizzes",
        filename,
    );
}

export function createQuizMetadata(
    quiz: QuizResult,
    lecture: QuizMetadata["lecture"],
    lesson: QuizMetadata["lesson"],
): QuizMetadata {
    const project = Object.fromEntries(
        Object.entries(quiz.result.project).map(([key, value]) => [
            key,
            {
                ...value,
                files: value.files.map((file) => ({
                    ...file,
                    content: file.content.map(({ source: _source, ...content }) => content),
                })),
            },
        ]),
    );

    return {
        version: QUIZ_METADATA_VERSION,
        lecture,
        lesson,
        result: {
            ...quiz.result,
            project,
        },
    };
}

export function isQuizMetadata(value: unknown): value is QuizMetadata {
    if (!value || typeof value !== "object") {
        return false;
    }

    const metadata = value as Partial<QuizMetadata>;

    return (
        metadata.version === QUIZ_METADATA_VERSION &&
        typeof metadata.lecture?.index === "string" &&
        typeof metadata.lesson?.index === "string" &&
        typeof metadata.lesson?.name === "string" &&
        Boolean(metadata.result && typeof metadata.result === "object")
    );
}
