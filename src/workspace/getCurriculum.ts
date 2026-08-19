import { ExtensionContext } from "vscode";
import { axios } from "../rest";
import { getGoormUrl } from "../lib/validateURL";

export type APICurriculum = {
    label: string;
    index: string;
    name: string;
    allLessons: number;
    completedLessons: number;
    new: boolean;
    lessons: {
        index: string;
        sequence: number;
        urlSlug: string;
        type: string;
        name: string;
        isOpen: boolean;

        first_access?: string;
        last_access?: string;
        completedAt?: string;

        isSample: boolean;
        // 0 DEFAULT
        // 1 COMPLETE
        // 2 CHALLENGE
        // 3 FAILURE
        // 4 LOCKED
        state: 0 | 1 | 2 | 3 | 4;
        score: number;
        create_time: string;
        new: boolean;

        tutorialQuizIndex: string;

        hasSubmittedSource?: boolean;

        icon: string;
        hasVideo: boolean;
        isPreview: boolean;
        isLocked: boolean;
        isPrivate: boolean;
        ackTime: number;
    }[];
}[];

export default async function getCurriculum(lectureSequence: number, context: ExtensionContext): Promise<APICurriculum | undefined> {
    const root = await getGoormUrl();
    if (!root) return;

    const r = await axios({
        context,
        "url": `${root}/api/lecture/curriculum/user?sequence=${lectureSequence}`
    });

    return r?.data;
}