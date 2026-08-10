import * as vscode from "vscode";
import WebSocket from "ws";

export type BrowserCookie = {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    size: number;
    httpOnly: boolean;
    secure: boolean;
    session: boolean;
    sameSite?: "Strict" | "Lax" | "None";
};

type CDPProxyInfo = {
    host: string;
    port: number;
    path: string;
};

type CDPTargetInfo = {
    targetId: string;
    type: string;
    url: string;
    openerId?: string;
};

type CDPResponse<T> = {
    id: number;
    result?: T;
    error?: {
        code: number;
        message: string;
    };
};

type IntegratedBrowserSessions = {
    wrapper: vscode.DebugSession;
    target: vscode.DebugSession;
};

export type BrowserVerboseLogger = (
    message: string,
    details?: Record<string, unknown>,
) => void;

type VerboseLogger = BrowserVerboseLogger;

let commandId = 0;

const silentLogger: VerboseLogger = () => {};

function createVerboseLogger(
    enabled: boolean | BrowserVerboseLogger | undefined,
): VerboseLogger {
    if (typeof enabled === "function") {
        return enabled;
    }

    if (!enabled) {
        return silentLogger;
    }

    return (message, details) => {
        if (details) {
            console.log(
                `[browser:verbose] ${message}`,
                details,
            );

            return;
        }

        console.log(`[browser:verbose] ${message}`);
    };
}

function safeURLForLog(
    value: string,
): string {
    try {
        const url = new URL(value);

        return `${url.origin}${url.pathname}`;
    } catch {
        return value.split(/[?#]/, 1)[0];
    }
}

function isIntegratedBrowserSession(
    session: vscode.DebugSession,
): boolean {
    return (
        session.type === "editor-browser" ||
        session.type === "pwa-editor-browser"
    );
}

function isConcreteDebugSession(
    session: vscode.DebugSession,
): boolean {
    return Boolean(
        session.configuration.__pendingTargetId,
    );
}

function waitForDebugSession(
    name: string,
    log: VerboseLogger,
): Promise<IntegratedBrowserSessions> {
    log("디버그 세션 시작 이벤트를 기다립니다.");

    return new Promise((resolve) => {
        let wrapperSession: vscode.DebugSession | undefined;

        const disposable = vscode.debug.onDidStartDebugSession(
            (session) => {
                const isConcrete = isConcreteDebugSession(
                    session,
                );

                log("디버그 세션 시작 이벤트를 받았습니다.", {
                    sessionId: session.id,
                    sessionType: session.type,
                    sessionName: session.configuration.name,
                    isConcrete,
                    parentSessionId:
                        session.configuration.__parentId,
                });

                if (!isIntegratedBrowserSession(session)) {
                    return;
                }

                if (
                    !isConcrete &&
                    session.configuration.name === name
                ) {
                    wrapperSession = session;
                    log("Integrated Browser 래퍼 세션을 찾았습니다.", {
                        sessionId: session.id,
                    });

                    return;
                }

                if (
                    !isConcrete ||
                    !wrapperSession ||
                    session.configuration.__parentId !==
                    wrapperSession.id
                ) {
                    return;
                }

                disposable.dispose();

                log("CDP를 지원하는 실제 페이지 세션을 찾았습니다.", {
                    sessionId: session.id,
                    sessionType: session.type,
                });

                resolve({
                    wrapper: wrapperSession,
                    target: session,
                });
            },
        );
    });
}

async function connectCDP(
    session: vscode.DebugSession,
    log: VerboseLogger,
): Promise<WebSocket> {
    log("CDP 프록시를 요청합니다.", {
        sessionId: session.id,
    });

    const proxy = await vscode.commands.executeCommand<CDPProxyInfo>(
        "extension.js-debug.requestCDPProxy",
        session.id,
        true,
    );

    if (!proxy) {
        throw new Error(
            "Integrated Browser CDP Proxy를 가져오지 못했습니다.",
        );
    }

    const url = `ws://${proxy.host}:${proxy.port}${proxy.path}`;

    log("CDP WebSocket 연결을 시작합니다.", {
        host: proxy.host,
        port: proxy.port,
    });

    const socket = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
        socket.once("open", () => {
            resolve();
        });

        socket.once("error", (error) => {
            reject(error);
        });
    });

    log("CDP WebSocket이 연결됐습니다.");

    return socket;
}

function sendCDP<T>(
    socket: WebSocket,
    method: string,
    params: Record<string, unknown> = {},
): Promise<T> {
    const id = ++commandId;

    return new Promise<T>((resolve, reject) => {
        const handleMessage = (data: WebSocket.RawData) => {
            let response: CDPResponse<T>;

            try {
                response = JSON.parse(
                    data.toString(),
                ) as CDPResponse<T>;
            } catch {
                return;
            }

            if (response.id !== id) {
                return;
            }

            socket.off(
                "message",
                handleMessage,
            );

            if (response.error) {
                reject(
                    new Error(
                        `${response.error.code}: ${response.error.message}`,
                    ),
                );

                return;
            }

            if (response.result === undefined) {
                reject(
                    new Error(
                        `${method} 응답에 result가 없습니다.`,
                    ),
                );

                return;
            }

            resolve(response.result);
        };

        socket.on(
            "message",
            handleMessage,
        );

        socket.send(
            JSON.stringify({
                id,
                method,
                params,
            }),
            (error) => {
                if (!error) {
                    return;
                }

                socket.off(
                    "message",
                    handleMessage,
                );

                reject(error);
            },
        );
    });
}

async function getCurrentURL(
    socket: WebSocket,
): Promise<string> {
    const response = await sendCDP<{
        result: {
            type: string;
            value?: string;
        };
    }>(
        socket,
        "Runtime.evaluate",
        {
            expression: "location.href",
            returnByValue: true,
        },
    );

    return response.result.value ?? "";
}

async function getRelatedPageURLs(
    socket: WebSocket,
    initialTargetId?: string,
): Promise<string[]> {
    const currentURL = await getCurrentURL(
        socket,
    );

    if (!initialTargetId) {
        return [currentURL];
    }

    let targetInfos: CDPTargetInfo[];

    try {
        const response = await sendCDP<{
            targetInfos: CDPTargetInfo[];
        }>(
            socket,
            "Target.getTargets",
        );

        targetInfos = response.targetInfos;
    } catch {
        return [currentURL];
    }

    const relatedTargetIds = new Set([
        initialTargetId,
    ]);
    let targetAdded = true;

    while (targetAdded) {
        targetAdded = false;

        for (const target of targetInfos) {
            if (
                relatedTargetIds.has(target.targetId) ||
                !target.openerId ||
                !relatedTargetIds.has(target.openerId)
            ) {
                continue;
            }

            relatedTargetIds.add(target.targetId);
            targetAdded = true;
        }
    }

    const urls = targetInfos
        .filter(
            (target) =>
                target.type === "page" &&
                relatedTargetIds.has(target.targetId) &&
                target.url,
        )
        .map((target) => target.url);

    return [...new Set([
        currentURL,
        ...urls,
    ])];
}

async function getCookiesForURL(
    socket: WebSocket,
    url: string,
): Promise<BrowserCookie[]> {
    const response = await sendCDP<{
        cookies: BrowserCookie[];
    }>(
        socket,
        "Network.getCookies",
        {
            urls: [url],
        },
    );

    return response.cookies;
}

async function sleep(
    ms: number,
): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function waitForResult(
    socket: WebSocket,
    predicate: (url: string) => boolean,
    cookieDomain?: string,
    timeout = 5 * 60 * 1000,
    log: VerboseLogger = silentLogger,
    initialTargetId?: string,
): Promise<BrowserCookie[]> {
    const startedAt = Date.now();
    let lastURLState = "";
    let lastCookieCount = -1;
    let lastError = "";

    log("로그인 완료 URL과 쿠키를 기다립니다.", {
        cookieDomain: cookieDomain ?? "(전체)",
        timeout,
    });

    while (Date.now() - startedAt < timeout) {
        try {
            const pageURLs = await getRelatedPageURLs(
                socket,
                initialTargetId,
            );
            const currentURL = pageURLs[0] ?? "";
            const completedURL = pageURLs.find(predicate);
            const completedURLMatched = completedURL !== undefined;
            const urlState = JSON.stringify(pageURLs);

            lastError = "";

            if (urlState !== lastURLState) {
                lastURLState = urlState;
                log("브라우저 페이지 URL이 변경됐습니다.", {
                    url: safeURLForLog(currentURL),
                    completedURLMatched,
                    pageTargetCount: pageURLs.length,
                    matchedURL: completedURL && completedURL !== currentURL
                        ? safeURLForLog(completedURL)
                        : undefined,
                });
            }

            if (completedURL) {
                let cookies = await getCookiesForURL(
                    socket,
                    completedURL,
                );

                if (cookieDomain) {
                    cookies = cookies.filter(
                        (cookie) =>
                            matchesDomain(
                                cookie.domain,
                                cookieDomain,
                            ),
                    );

                    if (cookies.length !== lastCookieCount) {
                        lastCookieCount = cookies.length;
                        log("대상 도메인 쿠키를 조회했습니다.", {
                            cookieCount: cookies.length,
                        });
                    }

                    // URL 이동 직후 Set-Cookie 처리가 끝나지 않았을 수 있음
                    if (cookies.length === 0) {
                        await sleep(300);

                        continue;
                    }
                }

                log("로그인 완료 조건과 쿠키 조건을 충족했습니다.", {
                    url: safeURLForLog(completedURL),
                    cookieCount: cookies.length,
                    cookieNames: cookies.map(
                        (cookie) => cookie.name,
                    ),
                });

                return cookies;
            }
        } catch (error) {
            // 페이지 이동 중 Runtime context가 잠깐 사라질 수 있음
            const message = error instanceof Error
                ? error.message
                : String(error);

            if (message !== lastError) {
                lastError = message;
                log("CDP 조회에 실패해 재시도합니다.", {
                    error: message,
                });
            }
        }

        await sleep(300);
    }

    throw new Error(
        "브라우저 로그인 또는 쿠키 대기 시간이 초과되었습니다.",
    );
}

export type OpenBrowserOptions = {
    url: string;

    /**
     * 이 조건을 만족하는 URL로 이동하면
     * 로그인이 완료됐다고 판단합니다.
     *
     * 문자열을 지정하면 해당 문자열로 시작하는 URL을 허용합니다.
     */
    completedURL?: string | RegExp | ((url: string) => boolean);

    /**
     * 가져올 쿠키 도메인.
     *
     * example.com을 넣으면:
     * example.com
     * .example.com
     * api.example.com
     * 등을 허용합니다.
     */
    cookieDomain?: string;

    timeout?: number;

    /**
     * true이면 브라우저와 쿠키 수집 과정을 Debug Console에 출력합니다.
     * 로그 콜백을 직접 지정할 수도 있습니다.
     * 쿠키 값과 URL의 query/hash는 출력하지 않습니다.
     */
    verbose?: boolean | BrowserVerboseLogger;
};

function matchesDomain(
    cookieDomain: string,
    domain: string,
): boolean {
    const cookie = cookieDomain
        .toLowerCase()
        .replace(/^\./, "");

    const target = domain
        .toLowerCase()
        .replace(/^\./, "");

    return (
        cookie === target ||
        cookie.endsWith(`.${target}`)
    );
}

function createURLPredicate(
    completedURL: OpenBrowserOptions["completedURL"],
): (url: string) => boolean {
    if (typeof completedURL === "function") {
        return completedURL;
    }

    if (completedURL instanceof RegExp) {
        return (url) => {
            completedURL.lastIndex = 0;

            return completedURL.test(url);
        };
    }

    if (typeof completedURL === "string") {
        return (url) =>
            url.startsWith(completedURL);
    }

    return () => true;
}

function getOpenTabs(): vscode.Tab[] {
    return vscode.window.tabGroups.all.flatMap(
        (group) => [...group.tabs],
    );
}

export async function openBrowser(
    options: OpenBrowserOptions,
): Promise<BrowserCookie[]> {
    const log = createVerboseLogger(
        options.verbose,
    );
    const sessionName =
        `Extension Browser ${crypto.randomUUID()}`;

    log("Integrated Browser를 시작합니다.", {
        url: safeURLForLog(options.url),
        completedURL: typeof options.completedURL === "string"
            ? safeURLForLog(options.completedURL)
            : typeof options.completedURL,
        cookieDomain: options.cookieDomain ?? "(전체)",
    });

    const existingTabs = new Set(
        getOpenTabs(),
    );
    const openedTabs: vscode.Tab[] = [];
    const tabListener = vscode.window.tabGroups.onDidChangeTabs(
        (event) => {
            for (const tab of event.opened) {
                if (!existingTabs.has(tab)) {
                    openedTabs.push(tab);
                }
            }
        },
    );

    const sessionPromise = waitForDebugSession(
        sessionName,
        log,
    );

    let started: boolean;

    try {
        started = await vscode.debug.startDebugging(
            undefined,
            {
                type: "editor-browser",
                request: "launch",
                name: sessionName,
                url: options.url,
            },
        );
    } catch (error) {
        tabListener.dispose();

        throw error;
    }

    if (!started) {
        tabListener.dispose();
        log("Integrated Browser 시작 요청이 거부됐습니다.");

        throw new Error(
            "Integrated Browser를 열지 못했습니다.",
        );
    }

    log("Integrated Browser 시작 요청이 승인됐습니다.");

    const sessions = await sessionPromise;

    for (const tab of getOpenTabs()) {
        if (
            !existingTabs.has(tab) &&
            !openedTabs.includes(tab)
        ) {
            openedTabs.push(tab);
        }
    }

    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    const browserTab = activeTab && !existingTabs.has(activeTab)
        ? activeTab
        : openedTabs.at(-1);

    tabListener.dispose();

    log("Integrated Browser 에디터 탭을 추적했습니다.", {
        found: Boolean(browserTab),
        openedTabCount: openedTabs.length,
    });

    let socket: WebSocket | undefined;
    let completed = false;

    try {
        socket = await connectCDP(
            sessions.target,
            log,
        );

        const cookies = await waitForResult(
            socket,
            createURLPredicate(
                options.completedURL,
            ),
            options.cookieDomain,
            options.timeout,
            log,
            typeof sessions.target.configuration.__pendingTargetId === "string"
                ? sessions.target.configuration.__pendingTargetId
                : undefined,
        );

        completed = true;

        return cookies;
    } finally {
        log("CDP WebSocket 연결을 종료합니다.");
        socket?.close();

        if (completed) {
            log("로그인 완료 후 Integrated Browser를 닫습니다.", {
                sessionId: sessions.wrapper.id,
            });

            try {
                await vscode.debug.stopDebugging(
                    sessions.wrapper,
                );

                log("Integrated Browser 종료 요청을 처리했습니다.");
            } catch (error) {
                log("Integrated Browser 디버그 세션을 종료하지 못했습니다.", {
                    error: error instanceof Error
                        ? error.message
                        : String(error),
                });
            }

            if (browserTab) {
                try {
                    const tabClosed = await vscode.window.tabGroups.close(
                        browserTab,
                        true,
                    );

                    log("Integrated Browser 에디터 탭을 닫았습니다.", {
                        closed: tabClosed,
                    });
                } catch (error) {
                    log("Integrated Browser 에디터 탭을 닫지 못했습니다.", {
                        error: error instanceof Error
                            ? error.message
                            : String(error),
                    });
                }
            } else {
                log("닫을 Integrated Browser 에디터 탭을 찾지 못했습니다.");
            }
        }
    }
}
