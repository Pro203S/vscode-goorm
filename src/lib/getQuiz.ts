import { ExtensionContext } from "vscode";
import { axios } from "../rest";

export type QuizResult = {
    result: {
        removedBookmarks: unknown[];
        bookmarks: unknown[];
        quizIndex: string;
        quizOutputFile: {
            use: boolean;
            filepath: string;
        };
        quizSequence: number;
        quizUrlSlug: string;
        quizForm: string;
        quizType: string;
        quizMode: string;
        quizSkeletonType: string;
        project: Record<
            string,
            {
                projectKey: string;
                language: string;
                langVersion: string;
                projectCode: string;
                label: string;
                mainFiletype: string;
                files: {
                    filepath: string;
                    filename: string;
                    label: string;
                    isDir: boolean;
                    isMain: boolean;
                    content: {
                        hidden: boolean;
                        readonly: boolean;
                        source: string;
                    }[];
                }[];
            }
        >;
        quizRunTimeLimit: number;
    };
};

export default async function getQuiz(lecIdx: string, lesIdx: string, userId: string, context: ExtensionContext) {
    const a = await axios({
        context,
        "url": `https://sunrint-hs.goorm.io/api/workspace/lesson`,
        "params": {
            "lectureIndex": lecIdx,
            "lessonIndex": lesIdx,
            "collaborationUserId": userId,
        }
    });
    if (!a) return;
    if (a.status !== 200) return;

    return a.data as QuizResult;
}
