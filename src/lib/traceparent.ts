import crypto from "crypto";

export function generateTraceParent(): string {
    return `00-${generateHex(32)}-${generateHex(16)}-01`;
}

export function generateHex(length: number): string {
    const bytesNeeded = length / 2;

    return crypto.randomBytes(bytesNeeded).toString("hex");
}