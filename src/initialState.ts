import { ExtensionContext } from "vscode";
import { axios } from "./rest";
import { load } from "cheerio";

export type LectureInitialState = {
    isIE: boolean;
    locale: string;
    contactType: string;
    contactAppId: string;

    userData: {
        id: string;
        name: string;
        email: string;
        language: string;
        isTeacher: boolean;
        isAdmin: boolean;
        channelIndex: string;
        role: string;
        isKdtTrainee: boolean;
        hasLoginId: boolean;
        isDevelupUser: boolean;
    };

    isChannel: boolean;
    isChannelGroup: boolean;
    isMobile: boolean;
    isAssessLecture: boolean;

    channelData: {
        index: string;
        name: string;
        colorLogo: string;
        channelType: string;
        isInvited: boolean;
        isAdmin: boolean;
        isTeacher: boolean;
        useLecture: boolean;
        useAssessment: boolean;
        hideContactWidget: boolean;
        hideQna: boolean;
        hideAllCategory: boolean;
        hideSearchBar: boolean;
    };

    hostUrl: string;
    serviceNotice: null;
    currentPath: string;
    accountHost: string;
    isExistNoticeNew: boolean;

    settings: {
        exp: {
            active: boolean;
        };

        kdt: Record<string, never>;
        exelearnce: Record<string, never>;
        mOTP: Record<string, never>;
    };

    useRoute: boolean;

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

    categoryCount: {
        "programming.algorithm": number;
        "programming.programming-fundamentals": number;
    };

    showsEmptyCategory: boolean;

    lectureData: {
        _id: string;
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
            };

            second: {
                id: string;
            };

            _id: string;
        };

        estimatedTime: number;
        period: null;

        is_started: boolean;
        is_sample: boolean;
        use_certificate: boolean;

        curriculum: string;

        connect_ide: boolean;
        connect_external_url: boolean;

        open_lesson: string;
        open_print: boolean;
        open_copy: boolean;

        difficulty: number;

        classification: unknown[];

        is_toll: boolean;

        price: null;
        discount: null;
        discountStartDate: null;

        discounted_price: number;

        time_set: boolean;
        useOperationTime: boolean;

        operationStartDate: null;
        operationEndDate: null;

        applicant_limit_number: number;

        review: {
            total_score: number;
            participants_count: number;
            grade: number;
            active: boolean;
        };

        recommend: {
            text: string;
            _id: string;
        }[];

        introVideo: null;

        disable_tutoring: boolean;

        ogImage: string;

        forms: unknown[];

        hideLectureChat: boolean;
        useLive: boolean;

        aiGoormee: {
            problemHint: {
                active: boolean;
            };

            codeSolution: {
                active: boolean;
            };

            codeExplanation: {
                active: boolean;
            };

            aiReport: {
                active: boolean;
            };
        };

        showFileShareTab: boolean;
        allowDuplicateAccess: boolean;

        userDivisionIndex: unknown[];

        editorVersion: null;

        create_time: string;
        first_started_time: string;

        url_slug: string;
        sequence: number;

        students_length: number;

        myLecture: boolean;
        isInvited: boolean;

        curriculumData: {
            label: string;
            index: string;
            name: string;
            sequence: number;

            lessons: {
                index: string;
                sequence: number;
                urlSlug: string;
                type: string;
                name: string;

                hasVideo: boolean;

                icon: string;

                isPreview: boolean;
                isOpen: boolean;

                contentsType: string;

                isPrivate: boolean;

                state: number;
            }[];
        }[];

        userDivision: unknown[];

        educatorsData: {
            _id: string;
            id: string;
            name: string;
        };

        recentUpdate: string;

        showLearnLectureExamTab: boolean;
        is_certificate_exam: boolean;
    };
};

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

export default async function getInitialState<T = InitialState>(path: string, context: ExtensionContext): Promise<T | undefined> {
    const data = (await axios({ "url": "https://sunrint-hs.goorm.io" + path, context }))?.data;
    if (!data) return;
    return g(data) as T;
}