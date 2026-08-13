import * as vscode from "vscode";

export const WORKSPACE_FOLDERS_KEY = "goormEDU.workspaceFolders";
const MAX_WORKSPACE_FOLDERS = 20;

type StoredWorkspaceFolder = {
    uri: string;
    lectureName: string;
};

export type SavedWorkspaceFolder = {
    uri: vscode.Uri;
    lectureName: string;
};

function normalizeWorkspaceFolder(
    value: StoredWorkspaceFolder | string,
): StoredWorkspaceFolder {
    if (typeof value !== "string") return value;

    const uri = vscode.Uri.parse(value);

    return {
        uri: value,
        lectureName: uri.path.split("/").filter(Boolean).at(-1) ?? uri.toString(true),
    };
}

export function getSavedWorkspaceFolders(
    context: vscode.ExtensionContext,
): SavedWorkspaceFolder[] {
    return context.globalState
        .get<(StoredWorkspaceFolder | string)[]>(WORKSPACE_FOLDERS_KEY, [])
        .map((value) => {
            const folder = normalizeWorkspaceFolder(value);

            return {
                uri: vscode.Uri.parse(folder.uri),
                lectureName: folder.lectureName,
            };
        });
}

export async function saveWorkspaceFolder(
    context: vscode.ExtensionContext,
    folder: vscode.WorkspaceFolder,
    lectureName: string,
): Promise<void> {
    const uri = folder.uri.toString(true);
    const folders = context.globalState.get<(StoredWorkspaceFolder | string)[]>(
        WORKSPACE_FOLDERS_KEY,
        [],
    );
    const nextFolders: StoredWorkspaceFolder[] = [
        { uri, lectureName },
        ...folders
            .map(normalizeWorkspaceFolder)
            .filter((value) => value.uri !== uri),
    ].slice(0, MAX_WORKSPACE_FOLDERS);

    await context.globalState.update(WORKSPACE_FOLDERS_KEY, nextFolders);
}
