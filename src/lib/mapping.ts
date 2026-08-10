import * as vscode from 'vscode';
import * as path from 'path';

export type MappingSequence = {
    "seq": number,
    "idx": string
}

export type Mapping<T = MappingSequence> = {
    "filePath": vscode.Uri,
    "data": T,
    "lessons": {
        "filePath": vscode.Uri,
        "data": T
    }[]
};

type JsonMapping = Omit<Mapping, "filePath" | "lessons"> & {
    "filePath": string,
    "lessons": (Omit<Mapping["lessons"][number], "filePath"> & {
        "filePath": string
    })[]
};

type SerializedUri = Parameters<typeof vscode.Uri.from>[0];
type LegacyJsonMapping = Omit<Mapping, "filePath" | "lessons"> & {
    "filePath": SerializedUri,
    "lessons": (Omit<Mapping["lessons"][number], "filePath"> & {
        "filePath": SerializedUri
    })[]
};

function toWorkspaceRelativePath(workspaceUri: vscode.Uri, fileUri: vscode.Uri): string {
    if (workspaceUri.scheme !== fileUri.scheme || workspaceUri.authority !== fileUri.authority) {
        throw new Error("Workspace와 다른 파일 시스템의 경로는 mapping에 저장할 수 없습니다.");
    }

    const relativePath = path.posix.relative(workspaceUri.path, fileUri.path);
    if (relativePath === ".." || relativePath.startsWith("../") || path.posix.isAbsolute(relativePath)) {
        throw new Error("Workspace 외부 경로는 mapping에 저장할 수 없습니다.");
    }

    return relativePath || ".";
}

function fromWorkspaceRelativePath(workspaceUri: vscode.Uri, relativePath: string): vscode.Uri {
    const normalizedPath = path.posix.normalize(relativePath.replaceAll("\\", "/"));
    if (
        normalizedPath === ".." ||
        normalizedPath.startsWith("../") ||
        path.posix.isAbsolute(normalizedPath) ||
        path.win32.isAbsolute(normalizedPath)
    ) {
        throw new Error("mapping에 Workspace 외부 경로가 포함되어 있습니다.");
    }

    return normalizedPath === "."
        ? workspaceUri
        : vscode.Uri.joinPath(workspaceUri, normalizedPath);
}

export function mappingToJson(mapping: Mapping, workspaceUri: vscode.Uri): JsonMapping {
    return {
        ...mapping,
        "filePath": toWorkspaceRelativePath(workspaceUri, mapping.filePath),
        "lessons": mapping.lessons.map(v => ({
            ...v,
            "filePath": toWorkspaceRelativePath(workspaceUri, v.filePath)
        }))
    };
}

export function jsonToMapping(json: JsonMapping | LegacyJsonMapping, workspaceUri: vscode.Uri) {
    const curriculumUri = typeof json.filePath === "string"
        ? fromWorkspaceRelativePath(workspaceUri, json.filePath)
        : vscode.Uri.joinPath(workspaceUri, path.posix.basename(vscode.Uri.from(json.filePath).path));

    return {
        ...json,
        "filePath": curriculumUri,
        "lessons": json.lessons.map(v => ({
            ...v,
            "filePath": typeof v.filePath === "string"
                ? fromWorkspaceRelativePath(workspaceUri, v.filePath)
                : vscode.Uri.joinPath(curriculumUri, path.posix.basename(vscode.Uri.from(v.filePath).path))
        }))
    } satisfies Mapping;
}
