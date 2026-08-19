import { ExtensionContext } from "vscode";
import { BrowserCookie } from "./browser";
import { default as Axios, AxiosRequestConfig } from "axios";
import { generateTraceParent } from "./lib/traceparent";

export const SESSION_SECRET_KEY = "goormEDU.session";

export let instance = Axios.create({
    "validateStatus": () => true,
    "withCredentials": true
});

export async function getCookie(context: ExtensionContext) {
    const session = await context.secrets.get(SESSION_SECRET_KEY);
    if (!session) return;

    const cookies: BrowserCookie[] = JSON.parse(session);
    const header = cookies.map(v => `${v.name}=${v.value}`).join("; ");

    return header;
}

export async function axios({
    context,
    ...config
}: AxiosRequestConfig & {
    context: ExtensionContext
}) {
    const session = await context.secrets.get(SESSION_SECRET_KEY);
    if (!session) return;

    const cookies: BrowserCookie[] = JSON.parse(session);
    const header = cookies.map(v => `${v.name}=${v.value}`).join("; ");

    return instance({
        ...config,
        "headers": {
            "accept": "application/json, text/plain, */*",
            "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7,ja-JP;q=0.6,ja;q=0.5",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Not=A?Brand\";v=\"99\", \"Google Chrome\";v=\"151\", \"Chromium\";v=\"151\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "traceparent": generateTraceParent(),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
            ...config.headers,
            "Cookie": header
        }
    });
}
