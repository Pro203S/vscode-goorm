import { ExtensionContext } from "vscode";
import { BrowserCookie } from "./browser";
import { default as Axios, AxiosRequestConfig } from "axios";

export const SESSION_SECRET_KEY = "goormEDU.session";

export let instance = Axios.create({
    "validateStatus": () => true,
    "withCredentials": true
});

export async function axios(config: AxiosRequestConfig & {
    context: ExtensionContext
}) {
    const { context } = config;
    const session = await context.secrets.get(SESSION_SECRET_KEY);
    if (!session) return;

    const cookies: BrowserCookie[] = JSON.parse(session);
    const header = cookies.map(v => `${v.name}=${v.value}`).join("; ");

    return instance({
        ...config,
        "headers": {
            ...config.headers,
            "Cookie": header
        }
    });
}
