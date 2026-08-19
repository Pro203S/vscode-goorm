declare global {
    interface SubmitQuizResult {
        "saved": boolean,
        "result": boolean,
        "solved": boolean,
        "all_pass"?: boolean,
        "submit_mode"?: boolean,
        "isStateUpdated": boolean,
        // 1 = SUCCESS, 3 = FAILURE
        "quizState": 0 | 1 | 2 | 3 | 4,
        "score"?: number,
        "err_msg"?: string
    }

    type ContainerCompleteResponse = {
        "app": string,
        "cwd": string,
        "daemon": boolean,
        "main": string,
        "run_option": string,
        "secure": boolean,
        "socket": {
            "url": string,
            "options": {
                "secure": boolean,
                "force new connection": boolean,
                "path": string,
                "withCredentials": boolean
            }
        },
        "token": string,
        "user_id": string
    }
}

export { }; 