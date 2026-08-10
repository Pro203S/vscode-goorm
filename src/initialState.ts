import { ExtensionContext } from "vscode";
import { axios } from "./rest";
import { load } from "cheerio";

export type InitialState = {
    isIE: boolean;
    locale: string;
    contactType: string;
    contactAppId: string;
    bootpayAppId: string;

    publicLectureList: Record<string, never>;
    promotionLectureList: Record<string, never>;

    channelLectureList: {
        allLectures: {
            student_count: number;
            sequence: number;

            category: {
                first: {
                    id: string;
                };
                second: {
                    id: string;
                };
                _id: string;
            };

            description: string;
            myLecture: boolean;
            type: number;

            recommend: {
                text: string;
                _id: string;
            }[];

            origin_channel_index: string;
            coverImage: string;

            review: {
                total_score: number;
                participants_count: number;
                grade: number;
                active: boolean;
            };

            cover_image?: string;

            subject: string;
            url_slug: string;

            owner: {
                id: string;
                name: string;
                email: string;
            };

            use_certificate: boolean;
            classification: string[];

            _id: string;
            first_started_time: string;
            id: string;
            index: string;

            userDivisionIndex: unknown[];

            difficulty: number;
        }[];
    };

    userData: {
        id: string;
        name: string;
        email: string;
        language: string;

        isTeacher: boolean;
        isAdmin: boolean;

        channelIndex: string;
        role: string;
        signupDate: string;

        hasLoginId: boolean;
        isDevelupUser: boolean;

        userDivisionIndex: unknown[];

        belongData: Record<string, never>;
    };

    channelData: {
        index: string;
        name: string;
        colorLogo: string;
        channelType: string;

        useCustomMain: boolean;
        isInvited: boolean;
        isAdmin: boolean;
        isTeacher: boolean;

        useLecture: boolean;
        useAssessment: boolean;

        hideQna: boolean;
        hideContactWidget: boolean;
        hideStudentSignUp: boolean;
        hideTeacherSignUp: boolean;
        hideJoinNotice: boolean;
        hideAllCategory: boolean;
        hideSearchBar: boolean;
        hideCoverPhrase: boolean;

        disableLectureApply: boolean;
        usePublicChannelLectureCardStyle: boolean;
        useUserDivision: boolean;
        hideMainBanner: boolean;
    };

    isChannel: boolean;
    isChannelGroup: boolean;
    isHelpChannel: boolean;
    isSchoolChannel: boolean;

    hostUrl: string;
    path: string;

    isMobile: boolean;

    serviceNotice: null;

    isLectureIntroTarget: boolean;
    timerBar: boolean;
    isExistNoticeNew: boolean;

    settings: {
        exp: {
            active: boolean;
        };

        exelearnce: Record<string, never>;
    };

    useRoute: boolean;

    gemHost: string;

    categoryList: {
        _id: string;
        index: string;
        channelIndex: string;

        hierarchy: number;

        label: {
            default: string;
            ko: string;
            en: string;
            ja: string;
        };

        order: number;
        value: string;
    }[];

    lectureCategories: {
        "programming.algorithm": number;
        "programming.programming-fundamentals": number;
    };

    showsEmptyCategory: boolean;

    channelNoticeList: unknown[];
    curations: unknown[];
};

function g(html: string): unknown {
    const $ = load(html);

    for (const element of $("script").toArray()) {
        const content = $(element).html();

        if (!content?.includes("window.__INITIAL_STATE__")) {
            continue;
        }

        let window: any = {};
        eval(content);
        if (window["__INITIAL_STATE__"]) {
            return window["__INITIAL_STATE__"];
        }

        continue;
    }

    return null;
}

export default async function getInitialState(context: ExtensionContext) {
    const data = (await axios({ "url": "https://sunrint-hs.goorm.io", context }))?.data;
    if (!data) return;
    return g(data) as InitialState;
}