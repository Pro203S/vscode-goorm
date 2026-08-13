import { ExtensionContext } from "vscode";
import { axios } from "../rest";
import { getGoormUrl } from "./validateURL";

export type APILearn = {
    index: string;
    type: number;
    subject: string;
    description: string;
    contents: string;
    coverImage: string;
    id: string;
    student_count: number;
    origin_channel_index: string;

    category: {
        first: {
            id: string;
            label: {
                default: string;
                ko: string;
                en: string;
                ja: string;
            };
        };
        second: {
            id: string;
            label: {
                default: string;
                ko: string;
                en: string;
                ja: string;
            };
        };
        _id: string;
    };

    lessons: string[];

    week: null;
    estimatedTime: number;
    use_certificate: boolean;

    curriculumData: {
        label: string;
        index: string;
        name: string;

        isUserPermission: boolean;

        allLessons: number;
        completedLessons: number;

        new: boolean;

        lessons: {
            index: string;
            sequence: number;

            urlSlug: string;

            type: 'contents' | 'tutorial' | string;

            name: string;

            useTimeSet?: boolean;

            open_date?: string | null;
            close_date?: string | null;

            isOpen: boolean;

            first_access?: string;
            last_access?: string;
            completedAt?: string;

            isSample: boolean;

            state: number;
            score: number;

            create_time: string;

            new: boolean;

            hasSubmittedSource?: boolean;

            tutorialQuizIndex?: string;

            icon: string;

            hasVideo: boolean;

            isPreview: boolean;
            isLocked: boolean;
            isPrivate: boolean;

            contentsCategory: string | null;

            contentsType: string;
        }[];
    }[];
};

export default async function getLectureLearn(lecSeq: number, context: ExtensionContext) {
    const url = await getGoormUrl();
    if (!url) return;

    const a = await axios({
        context,
        "url": `${url}/api/learn`,
        "params": {
            "sequence": lecSeq
        }
    });
    if (!a) return;
    if (a.status !== 200) return;

    return a.data as APILearn;
}
