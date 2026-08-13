declare global {
    interface SubmitQuizResult {
        "saved": boolean,
        "result": boolean,
        "solved": boolean,
        "all_pass"?: boolean,
        "submit_mode"?: boolean,
        "isStateUpdated": boolean,
        "quizState": 1
    }
}

export { }; 