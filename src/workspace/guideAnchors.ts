import * as vscode from "vscode";

const guideAnchorPattern =
    /\[\[\s*\(\s*guide-anchor\s*\)\s*:\s*\([\s\S]*?\)\s*\]\]/g;

function getGuideAnchorRanges(
    document: vscode.TextDocument,
): vscode.Range[] {
    const source = document.getText();
    const ranges: vscode.Range[] = [];

    guideAnchorPattern.lastIndex = 0;

    for (const match of source.matchAll(guideAnchorPattern)) {
        const start = match.index ?? 0;

        ranges.push(
            new vscode.Range(
                document.positionAt(start),
                document.positionAt(start + match[0].length),
            ),
        );
    }

    return ranges;
}

export default function registerGuideAnchors(): vscode.Disposable {
    const decorationType = vscode.window.createTextEditorDecorationType({
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });

    const updateEditor = (editor: vscode.TextEditor) => {
        if (
            editor.document.uri.scheme !== "file" ||
            !vscode.workspace.getWorkspaceFolder(editor.document.uri)
        ) {
            editor.setDecorations(decorationType, []);

            return;
        }

        editor.setDecorations(
            decorationType,
            getGuideAnchorRanges(editor.document),
        );
    };

    const updateVisibleEditors = () => {
        for (const editor of vscode.window.visibleTextEditors) {
            updateEditor(editor);
        }
    };

    const visibleEditorsListener =
        vscode.window.onDidChangeVisibleTextEditors(
            updateVisibleEditors,
        );
    const documentListener = vscode.workspace.onDidChangeTextDocument(
        (event) => {
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document === event.document) {
                    updateEditor(editor);
                }
            }
        },
    );

    updateVisibleEditors();

    return vscode.Disposable.from(
        decorationType,
        visibleEditorsListener,
        documentListener,
    );
}
