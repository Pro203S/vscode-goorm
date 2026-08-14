declare global {
    interface SubmitQuizResult {
        "saved": boolean,
        "result": boolean,
        "solved": boolean,
        "all_pass"?: boolean,
        "submit_mode"?: boolean,
        "isStateUpdated": boolean,
        "quizState": 1,
        "score"?: number
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