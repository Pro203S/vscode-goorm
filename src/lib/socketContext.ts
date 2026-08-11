import SocketIO from "./socketIo";

let socket: SocketIO | undefined;

export function getSocket(): SocketIO | undefined {
    return socket;
}

export function setSocket(value: SocketIO | undefined): void {
    socket = value;
}
