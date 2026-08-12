import DebugSocket from "./debugSocket";
import SocketIO from "./socketIo";

let socket: SocketIO | undefined;

export function getSocket() {
    return socket;
}

export function setSocket(value: typeof socket): void {
    socket = value;
}

let debugSocket: DebugSocket | undefined;

export function getDebugSocket() {
    return debugSocket;
}

export function setDebugSocket(value: typeof debugSocket): void {
    debugSocket = value;
}

let collabSocket: SocketIO | undefined;

export function getCollabSocket() {
    return collabSocket;
}

export function setCollabSocket(value: typeof collabSocket): void {
    collabSocket = value;
}
