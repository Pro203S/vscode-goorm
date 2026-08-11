import { ExtensionContext } from "vscode";
import { axios } from "./rest";
import { load } from "cheerio";
import { getGoormUrl, validateURL } from "./lib/validateURL";
import * as vscode from 'vscode';

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

export type QuizInitialState = {
    isIE: boolean;
    locale: string;
    host: string;

    userData: {
        id: string;
        name: string;
        email: string;
        language: string;
        isTeacher: boolean;
        isAdmin: boolean;
        hasLoginId: boolean;
        isDevelupUser: boolean;
    };

    channel: {
        index: string;
        name: string;
        channelType: string;
        useAssessment: boolean;
        hideChat: boolean;
        hideQna: boolean;
        hideAllCategory: boolean;
        hideSearchBar: boolean;
        useTTSAudio: boolean;
    };

    isChannel: boolean;
    isChannelGroup: boolean;
    isMobile: boolean;

    collaborationRoomId: string;
    collaborationRoomName: string;
    isMine: boolean;

    lesson: {
        _id: string;

        badge: {
            name: string;
            src: string;
        };

        completionConditionOptions: {
            resolveQuiz: number;
            watchVideo: boolean;
        };

        files: unknown[];
        not_opened: unknown[];

        tutorial_quiz_contents_components: {
            type: string;
            content: string;
            componentKey: string;
        }[];

        repl_lang: string[];

        view_count: number;
        is_preview: boolean;
        collaboration: string;

        contentsCategory: null;
        contentsType: string;

        useAISA: boolean;

        contents_components: {
            type: string;
            content: string;

            playerOptions: {
                captions: unknown[];
            };

            index_arr: unknown[];
            inflearnUnitList: unknown[];

            _id: string;
            componentKey: string;
        }[];

        llmQuizList: unknown[];

        index: string;
        lecture_index: string;
        subject: string;
        instructor: string;
        create_time: string;
        type: string;
        updated: string;

        tutorial_quiz_index: string;
        quiz_form: string;
        lecture_subject: string;

        is_sample: boolean;
        is_open: boolean;

        connected_lesson: string;
        origin_lesson_index: string;

        url_slug: string;
        sequence: number;

        __v: number;

        enableCopyPasteCode: boolean;

        state: number;

        completedConditions: {
            resolveQuiz: number;
        };

        quiz: {
            answer_language: string[];

            contentsType: string;
            contents: string;

            useRunScreenExample: boolean;
            runScreenExample: string;

            inputExample: string[];
            outputExample: string[];

            isCollaborationQuizForm: boolean;

            options: Record<string, never>;

            markOptions: {
                mark_trim: boolean;
                mark_line_trim: boolean;
                mark_all_trim: boolean;
                mark_delete_comma: boolean;
                mark_delete_period: boolean;
                mark_ignore_capital: boolean;
            };
        };
    };

    userAgent: string;

    isIE11: boolean;
    isHelpChannel: boolean;

    embed: null;

    ideHost: string;
    entryHostPath: string;
    microbitHostPath: string;
    codingpartyEntryHostPath: string;

    serviceNotice: null;

    accountHost: string;

    thirdPartySettings: {
        exp: {
            active: boolean;
        };

        aiGoormee: {
            active: boolean;
            lectureSettingActive: boolean;
        };

        mOTP: Record<string, never>;
    };

    isStudent: boolean;
    isTeacher: boolean;

    lecture: {
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

        estimatedTime: number;
        period: null;

        use_certificate: boolean;

        curriculum: {
            text: string;
            id: string;

            children: {
                text: string;
                id: string;
                type: string;

                children: {
                    text: string;
                    id: string;

                    sequence: number;

                    url_slug: string;

                    type: string;
                    quiz_form: string;

                    time_set?: boolean;
                    open_date?: string | null;
                    close_date?: string | null;

                    is_preview: boolean;
                }[];
            }[];
        }[];

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

        operationStartDate: null;
        operationEndDate: null;

        applicant_limit_number: number;

        review: {
            total_score: number;
            participants_count: number;
            grade: number;
            active: boolean;
        };

        base_lecture_index: string;

        is_subscribing: boolean;

        recommend: {
            text: string;
            _id: string;
        }[];

        introVideo: null;

        disable_tutoring: boolean;
        hideLectureChat: boolean;
        useLive: boolean;

        attendanceType: number;

        useIdeProject: boolean;

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

        editorVersion: null;

        url_slug: string;

        sequence: number;

        joinDate: string;

        students_length: number;

        live: null;

        isEvaluatable: number;

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

                type: string;
                name: string;

                isOpen: boolean;

                first_access?: string;
                last_access?: string;
                completedAt?: string;

                isSample: boolean;

                state: number;
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

                contentsCategory: null;
                contentsType: string;
            }[];
        }[];

        lastAccessLesson: {
            lessonCount: number;
            completedLessonCount: number;

            lesson: {
                text: string;
                id: string;

                sequence: number;

                url_slug: string;

                type: string;
                quiz_form: string;

                time_set: boolean;

                open_date: string;
                close_date: string;

                is_preview: boolean;

                contents_components: {
                    type: string;
                    content: string;

                    playerOptions: {
                        captions: unknown[];
                    };

                    index_arr: unknown[];
                    inflearnUnitList: unknown[];

                    _id: string;
                }[];

                index: string;

                create_time: string;
                updated: string;

                tutorial_quiz_index: string;

                is_sample: boolean;

                origin_lesson_index: string;

                isPrivate: boolean;
            };

            chapter: string;
            chapterNumber: number;

            isOpen: boolean;

            wasReviewModalOpened: {
                first: boolean;
                last: boolean;
            };
        };

        isEvaluated: boolean;

        educatorsData: {
            _id: string;
            id: string;
            name: string;
        };

        certificateId: boolean;

        videoStartTimes: Record<string, never>;
    };

    collaborationRoomType: string;
    isCollaboration: boolean;
    isGuest: boolean;
    isCollaborationQuizForm: boolean;
    showFileShareTab: boolean;
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
    const root = await getGoormUrl();
    if (!root) return;

    const data = (await axios({ "url": "https://sunrint-hs.goorm.io" + path, context }))?.data;
    if (!data) return;
    return g(data) as T;
}