export default function sanitizeFileName(name: string): string {
    return name
        // Windows 금지 문자
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        // trailing dot/space 제거 (Windows)
        .replace(/[. ]+$/, "")
        // 예약 이름 방지 (Windows)
        .replace(/^(con|prn|aux|nul|com\d|lpt\d)$/i, "_$1")
        // 너무 길면 잘라내기 (255 제한 대응)
        .slice(0, 255);
}