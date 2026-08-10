import { load } from "cheerio";
import { QuizExample, QuizMetadata } from "../lib/quizMetadata";

type TextCandidate = {
    value: string;
    score: number;
};

const descriptionKeys = new Map<string, number>([
    ["quizdescription", 120],
    ["problemdescription", 120],
    ["problemstatement", 115],
    ["quizcontents", 110],
    ["problemcontents", 110],
    ["question", 105],
    ["description", 100],
    ["contents", 90],
    ["content", 80],
    ["body", 70],
    ["text", 60],
]);

const titleKeys = new Map<string, number>([
    ["quiztitle", 120],
    ["problemtitle", 120],
    ["title", 100],
    ["subject", 90],
    ["name", 80],
]);

const ignoredObjectKeys = new Set([
    "project",
    "bookmarks",
    "removedbookmarks",
    "source",
]);

function normalizeKey(key: string): string {
    return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function stringsFromValue(value: unknown, depth = 0): string[] {
    if (typeof value === "string") {
        const text = value.trim();

        return text ? [text] : [];
    }

    if (!value || typeof value !== "object" || depth >= 2) {
        return [];
    }

    if (Array.isArray(value)) {
        const parts = value.flatMap((item) => stringsFromValue(item, depth + 1));

        return parts.length > 1
            ? [parts.join("\n"), ...parts]
            : parts;
    }

    const record = value as Record<string, unknown>;
    const localized = ["ko", "default", "en"]
        .flatMap((key) => stringsFromValue(record[key], depth + 1));

    if (localized.length > 0) {
        return localized;
    }

    const parts = Object.values(record).flatMap((item) => stringsFromValue(item, depth + 1));

    return parts.length > 1
        ? [parts.join("\n"), ...parts]
        : parts;
}

function getKeyScore(key: string, keys: Map<string, number>): number | undefined {
    const exact = keys.get(key);

    if (exact !== undefined) {
        return exact;
    }

    if (keys === descriptionKeys) {
        if (key.includes("description") || key.includes("statement")) {
            return 95;
        }

        if (key.includes("question")) {
            return 90;
        }

        if (key.includes("contents") || key.includes("content")) {
            return 75;
        }
    }

    if (keys === titleKeys && key.includes("title")) {
        return 95;
    }

    return undefined;
}

function findText(
    value: unknown,
    keys: Map<string, number>,
    depth = 0,
    candidates: TextCandidate[] = [],
): TextCandidate[] {
    if (!value || typeof value !== "object" || depth > 5) {
        return candidates;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            findText(item, keys, depth + 1, candidates);
        }

        return candidates;
    }

    for (const [rawKey, child] of Object.entries(value as Record<string, unknown>)) {
        const key = normalizeKey(rawKey);

        if (ignoredObjectKeys.has(key)) {
            continue;
        }

        const keyScore = getKeyScore(key, keys);
        if (keyScore !== undefined) {
            for (const text of stringsFromValue(child)) {
                candidates.push({
                    value: text,
                    score:
                        keyScore - depth * 3 +
                        Math.min(text.length / 200, 15) +
                        (/<[a-z][\s\S]*>/i.test(text) ? 5 : 0),
                });
            }
        }

        findText(child, keys, depth + 1, candidates);
    }

    return candidates;
}

function bestText(value: unknown, keys: Map<string, number>): string | undefined {
    const candidates = findText(value, keys);

    if (value && typeof value === "object") {
        for (const [rawKey, child] of Object.entries(value as Record<string, unknown>)) {
            const key = normalizeKey(rawKey);

            if (
                key.includes("quiz") ||
                key.includes("problem") ||
                key.includes("lesson")
            ) {
                for (const candidate of findText(child, keys)) {
                    candidates.push({
                        ...candidate,
                        score: candidate.score + (
                            key.includes("quiz") || key.includes("problem")
                                ? 35
                                : 20
                        ),
                    });
                }
            }
        }
    }

    return candidates
        .sort((left, right) => right.score - left.score)[0]
        ?.value;
}

function isExampleKey(key: string): boolean {
    return key.includes("sample") || key.includes("example");
}

function isInputKey(key: string, exampleContext: boolean): boolean {
    return (
        key.includes("input") &&
        (isExampleKey(key) || exampleContext)
    ) || (exampleContext && key === "stdin");
}

function isOutputKey(key: string, exampleContext: boolean): boolean {
    return (
        key.includes("output") &&
        (isExampleKey(key) || exampleContext)
    ) || (exampleContext && key === "stdout");
}

function exampleValues(value: unknown): string[] {
    if (typeof value === "string") {
        return [value];
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return [String(value)];
    }

    if (!value || typeof value !== "object") {
        return [];
    }

    if (Array.isArray(value)) {
        return value.flatMap((item) => exampleValues(item));
    }

    const record = value as Record<string, unknown>;
    const localized = record.ko ?? record.default ?? record.en;

    return localized === undefined
        ? []
        : exampleValues(localized);
}

function normalizeExampleText(value: string): string {
    if (!/<[a-z][\s\S]*>/i.test(value)) {
        return value.replaceAll("\r\n", "\n").trimEnd();
    }

    const $ = load(value, undefined, false);
    $("br").replaceWith("\n");
    $("p, div, li, pre").each((_index, element) => {
        $(element).append("\n");
    });

    return $.root().text().replaceAll("\r\n", "\n").trim();
}

export function findExamples(
    value: unknown,
    parentKey = "",
    depth = 0,
    candidates: QuizExample[] = [],
): QuizExample[] {
    if (!value || typeof value !== "object" || depth > 6) {
        return candidates;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            findExamples(item, parentKey, depth + 1, candidates);
        }

        return candidates;
    }

    const record = value as Record<string, unknown>;
    const normalizedRecord = Object.fromEntries(
        Object.entries(record).map(([key, child]) => [normalizeKey(key), child]),
    );
    const isHidden = normalizedRecord.hidden === true || normalizedRecord.ishidden === true;
    const isExplicitExample = (
        isExampleKey(parentKey) ||
        normalizedRecord.issample === true ||
        normalizedRecord.isexample === true
    );

    if (isHidden || normalizedRecord.visible === false) {
        return candidates;
    }

    const inputEntry = Object.entries(record).find(([key]) =>
        isInputKey(normalizeKey(key), isExplicitExample),
    );
    const outputEntry = Object.entries(record).find(([key]) =>
        isOutputKey(normalizeKey(key), isExplicitExample),
    );

    if (inputEntry || outputEntry) {
        const inputs = exampleValues(inputEntry?.[1]);
        const outputs = exampleValues(outputEntry?.[1]);
        const length = Math.max(inputs.length, outputs.length);

        for (let index = 0; index < length; index++) {
            const input = normalizeExampleText(inputs[index] ?? "");
            const output = normalizeExampleText(outputs[index] ?? "");

            if (input || output) {
                candidates.push({ input, output });
            }
        }
    }

    for (const [rawKey, child] of Object.entries(record)) {
        const key = normalizeKey(rawKey);

        if (
            ignoredObjectKeys.has(key) ||
            key === normalizeKey(inputEntry?.[0] ?? "") ||
            key === normalizeKey(outputEntry?.[0] ?? "")
        ) {
            continue;
        }

        findExamples(child, key, depth + 1, candidates);
    }

    if (depth !== 0) {
        return candidates;
    }

    const seen = new Set<string>();

    return candidates.filter((example) => {
        const key = `${example.input}\u0000${example.output}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function toAllowedWebUrl(value: string, baseUrl?: string): string | undefined {
    if (value.startsWith("#")) {
        return value;
    }

    if (value.startsWith("data:image/")) {
        return value;
    }

    try {
        const url = baseUrl ? new URL(value, baseUrl) : new URL(value);

        return url.protocol === "https:" || url.protocol === "http:"
            ? url.toString()
            : undefined;
    } catch {
        return undefined;
    }
}

function sanitizeDescription(raw: string, baseUrl?: string): string {
    if (!/<[a-z][\s\S]*>/i.test(raw)) {
        return `<div class="plain-text">${escapeHtml(raw)}</div>`;
    }

    const $ = load(`<main id="quiz-description">${raw}</main>`, undefined, false);

    $("script, iframe, frame, object, embed, form, input, button, textarea, select, link, meta, base").remove();

    $("*").each((_index, element) => {
        if (!("attribs" in element) || !("tagName" in element)) {
            return;
        }

        const attributes = { ...element.attribs };

        for (const [name, value] of Object.entries(attributes)) {
            const lowerName = name.toLowerCase();

            if (
                lowerName.startsWith("on") ||
                lowerName === "srcdoc" ||
                lowerName === "style" ||
                lowerName === "action" ||
                lowerName === "formaction"
            ) {
                $(element).removeAttr(name);
                continue;
            }

            if (["href", "src", "poster"].includes(lowerName)) {
                const safeUrl = toAllowedWebUrl(value, baseUrl);

                if (safeUrl) {
                    $(element).attr(name, safeUrl);
                } else {
                    $(element).removeAttr(name);
                }
            }
        }

        if (element.tagName === "a") {
            $(element).attr("target", "_blank");
            $(element).attr("rel", "noreferrer noopener");
        }
    });

    return $("#quiz-description").html() ?? "";
}

function createNonce(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";

    for (let index = 0; index < 32; index++) {
        nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return nonce;
}

export function getQuizTitle(value: unknown): string | undefined {
    return bestText(value, titleKeys);
}

export function getQuizDescription(value: unknown): string | undefined {
    return bestText(value, descriptionKeys);
}

export function getWebviewHtml(metadata: QuizMetadata, baseUrl?: string): string {
    const nonce = createNonce();
    const title = metadata.presentation?.title ?? getQuizTitle(metadata.result) ?? metadata.lesson.name;
    const description = metadata.presentation?.description ?? getQuizDescription(metadata.result);
    const examples = metadata.presentation?.examples ?? findExamples(metadata.result);
    const body = description
        ? sanitizeDescription(description, baseUrl)
        : `<div class="empty">문제 설명 데이터를 찾지 못했습니다.<br>문제를 다시 내려받아 주세요.</div>`;
    const examplesHtml = examples.length > 0
        ? `<section class="examples">
            ${examples.map((example, index) => `
                <div class="example">
                    ${examples.length > 1 ? `<h2>예제 ${index + 1}</h2>` : ""}
                    <div class="example-grid">
                        <section>
                            <h3>입력 예시</h3>
                            <pre class="example-value"><code>${escapeHtml(example.input)}</code></pre>
                        </section>
                        <section>
                            <h3>출력 예시</h3>
                            <pre class="example-value"><code>${escapeHtml(example.output)}</code></pre>
                        </section>
                    </div>
                </div>`).join("")}
        </section>`
        : "";

    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; style-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        :root { color-scheme: light dark; }
        body {
            box-sizing: border-box;
            max-width: 920px;
            margin: 0 auto;
            padding: 28px 30px 56px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.65;
        }
        h1 { margin: 0 0 24px; font-size: 1.65rem; line-height: 1.35; }
        h2, h3, h4 { margin-top: 1.8em; line-height: 1.4; }
        img { max-width: 100%; height: auto; }
        pre, code {
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
        }
        pre { overflow-x: auto; padding: 14px 16px; }
        code { padding: 0.1em 0.3em; }
        pre code { padding: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 10px; border: 1px solid var(--vscode-panel-border); }
        a { color: var(--vscode-textLink-foreground); }
        blockquote {
            margin-left: 0;
            padding-left: 14px;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            color: var(--vscode-descriptionForeground);
        }
        .plain-text { white-space: pre-wrap; }
        .empty {
            padding: 18px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            color: var(--vscode-descriptionForeground);
        }
        .examples {
            margin-top: 32px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .example + .example { margin-top: 28px; }
        .example h2 { margin-bottom: 6px; }
        .example h3 { margin: 14px 0 8px; font-size: 1rem; }
        .example-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
        }
        .example-value {
            min-height: 1.5em;
            margin: 0;
            white-space: pre;
        }
        @media (max-width: 680px) {
            .example-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    <article>${body}</article>
    ${examplesHtml}
</body>
</html>`;
}
