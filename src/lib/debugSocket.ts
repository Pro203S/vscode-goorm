import WebSocket, { RawData } from "ws";

type Listener = (data: any) => void;

export default class DebugSocket {
    private ws!: WebSocket;

    private listeners = new Map<string, Listener[]>();

    constructor(
        private baseUrl: string,
        private sid: string
    ) { }

    async connect() {
        const wsUrl = this.baseUrl.replace(/^http/, "ws");
        this.ws = new WebSocket(`${wsUrl}/?EIO=4&transport=websocket&sid=${this.sid}`);

        this.ws.on("error", (e) => {
            console.error("[goormEdu] DEBUG SOCKET", e);
            this.emitLocal("error", e);
            this.close();
        });

        this.ws.on("close", (code, reason) => {
            console.log("[goormEdu]", "DebugSocketClose", code, Buffer.from(reason).toString("utf-8"));
            this.emitLocal("close", { code, reason });
        });

        this.ws.on("open", () => {
            try {
                console.log("[goormEdu]", "DS 2probe");
                this.ws.send("2probe");
            } catch (err) {
                const e = err as Error;
                this.emitLocal("error", e);
                this.close();
            }
        });

        this.ws.on("message", (msg) => {
            try {
                const str = msg.toString();
                console.log("[goormEdu]", "DebugDown", str);

                if (str === "2") {
                    console.log("[goormEdu]", "DS 3");
                    this.ws.send("3");
                    return;
                }

                if (str.startsWith("42")) {
                    const [ev, data] = JSON.parse(str.slice(2));
                    this.emitLocal(ev, data);
                }
            } catch (err) {
                const e = err as Error;
                this.emitLocal("error", e);
                this.close();
            }
        });

        return new Promise<void>(resolve => {
            const listener = async (msg: RawData) => {
                try {
                    const str = msg.toString();
                    if (str === "3probe") {
                        console.log("[goormEdu]", "DS 5");
                        this.ws.send("5");
                        return;
                    }

                    if (str.startsWith("40")) {
                        resolve();
                        this.ws.off("message", listener);
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

    async sendRaw(data: string) {
        if (!this.ws) throw new Error("not connected");

        console.log("[goormEdu]", "DebugSend", data);
        this.ws.send(data);
    }

    async send(event: string, data: any) {
        if (!this.ws) throw new Error("not connected");

        const payload = `42${JSON.stringify([event, data])}`;
        console.log("[goormEdu]", "DebugSend", payload);
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

    private emitLocal(event: string, data: any) {
        const list = this.listeners.get(event);
        if (!list) return;

        for (const l of list) {
            l(data);
        }
    }

    close() {
        this.ws.close();
    }
}