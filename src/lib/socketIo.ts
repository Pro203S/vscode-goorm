import WebSocket, { RawData } from "ws";

type Listener = (...data: any) => void;

export default class SocketIO {
    private ws!: WebSocket;
    public sid?: string;

    private listeners = new Map<string, Listener[]>();

    constructor(
        private baseUrl: string,
        private opts?: {
            cookies?: string;
            verbose?: boolean;
        }
    ) { }

    async connect() {
        // 2️⃣ websocket 연결
        const wsUrl = this.baseUrl.replace(/^http/, "ws");
        this.ws = new WebSocket(
            `${wsUrl}/socket.io/?EIO=4&transport=websocket`,
            {
                headers: {
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
                    ...this.opts?.cookies ? {
                        "cookie": this.opts?.cookies
                    } : {}
                }
            }
        );

        if (this.opts?.verbose) {
            this.ws.on("open", () => {
                console.log("[goormEdu]", "SocketOpen", wsUrl);
            });

            this.ws.on("unexpected-response", (req, res) => {
                console.log("[goormEdu]", "Socket unexpected-response", req, res);
            });

            this.ws.on("ping", () => {
                console.log("[goormEdu]", "Socket ping");
            });

            this.ws.on("pong", () => {
                console.log("[goormEdu]", "Socket pong");
            });

            this.ws.on("upgrade", (req) => {
                console.log("[goormEdu]", "Socket upgrade", req);
            });

            this.ws.on("redirect", (req) => {
                console.log("[goormEdu]", "Socket redirect", req);
            });
        }

        this.ws.on("close", (code, reason) => {
            if (this.opts?.verbose)
                console.log("[goormEdu]", "SocketClosed", code, Buffer.from(reason).toString("utf-8"));
            if (code - 1000 < 1000) return;

            this.emitLocal("close", { code, reason });
        });

        let received40 = false;

        // 4️⃣ 메시지 처리
        this.ws.on("message", (msg) => {
            try {
                const str = msg.toString();
                if (this.opts?.verbose)
                    console.log("[goormEdu]", "SocketDown", str);

                // ping
                if (str === "2") {
                    if (this.opts?.verbose)
                        console.log("[goormEdu]", "SocketSend 3");
                    this.ws.send("3");
                    return;
                }

                // 연결 처리
                if (str.startsWith("0")) {
                    if (this.opts?.verbose)
                        console.log("[goormEdu]", "SocketSend 40");
                    this.ws.send("40");
                    return;
                }

                // event
                if (str.startsWith("42")) {
                    const [event, ...data] = JSON.parse(str.slice(2));
                    this.emitLocal(event, ...data);
                }
            } catch (err) {
                const e = err as Error;
                if (this.opts?.verbose)
                    console.error("[goormEdu]", e);

                this.emitLocal("error", e);
                this.close();
            }
        });

        return new Promise<void>(resolve => {
            const listener = (msg: RawData) => {
                try {
                    const str = msg.toString();

                    if (str.startsWith("40") && !received40) {
                        received40 = true;
                        const obj = JSON.parse(str.slice(2));
                        this.sid = obj.sid;
                        this.ws.off("message", listener);
                        resolve();
                        return;
                    }
                } catch (err) {
                    const e = err as Error;
                    this.emitLocal("error", e);
                    this.close();
                }
            };
            this.ws.on("message", listener);
        });
    }

    send(event: string, data: any) {
        if (!this.ws) throw new Error("not connected");

        const payload = `42${JSON.stringify([event, data])}`;
        if (this.opts?.verbose)
            console.log("[goormEdu]", "SocketSend", payload);
        this.ws.send(payload);
    }

    sendRaw(data: any) {
        if (!this.ws) throw new Error("not connected");

        const payload = `42${JSON.stringify(data)}`;
        if (this.opts?.verbose)
            console.log("[goormEdu]", "SocketSend", payload);
        this.ws.send(payload);
    }

    on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    once(event: string, listener: Listener) {
        const wrapper: Listener = (data) => {
            this.off(event, wrapper); // 실행 후 제거
            listener(data);
        };

        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        this.listeners.get(event)!.push(wrapper);
    }

    off(event: string, listener: Listener) {
        const list = this.listeners.get(event);
        if (!list) return;

        const idx = list.indexOf(listener);
        if (idx !== -1) {
            list.splice(idx, 1);
        }
    }

    async waitUntil<T = any>(event: string, timeout?: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const listener = (msg: RawData) => {
                const str = msg.toString();

                if (timeout) {
                    setTimeout(() => {
                        reject(new Error("Timeout exceeded."));
                        this.ws.off("message", listener);
                    }, timeout);
                }

                if (str.startsWith("42")) {
                    const [ev, data] = JSON.parse(str.slice(2));
                    if (ev === event) {
                        this.ws.off("message", listener);
                        return resolve(data);
                    }
                }
            };
            this.ws.on("message", listener);
        });
    }

    private emitLocal(event: string, ...data: any) {
        const list = this.listeners.get(event);
        if (!list) return;

        for (const l of list) {
            l(...data);
        }
    }

    close() {
        this.ws.close();
    }
}