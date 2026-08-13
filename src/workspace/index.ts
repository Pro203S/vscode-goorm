import * as vscode from 'vscode';
import getInitialState from '../initialState';
import { jsonToMapping, Mapping } from '../lib/mapping';
import registerGuideAnchors from './guideAnchors';
import registerLessonDecorations from './lessonDecorations';
import registerQuizWorkspace from './quiz';
import { getGoormUrl } from '../lib/validateURL';
import { saveWorkspaceFolder } from './workspaceHistory';

export default async function workspace(context: vscode.ExtensionContext) {
    const folder = vscode.workspace.workspaceFolders?.[0] as vscode.WorkspaceFolder;
    const directory = await vscode.workspace.fs.readDirectory(folder.uri);
    if (!directory.find(v => v[0] === ".goorm" && v[1] === 2)) return;

    const state = await getInitialState("/", context);
    if (!state?.userData) {
        await vscode.window.showErrorMessage(
            "구름EDU 오류",
            {
                "modal": true,
                "detail": "구름EDU의 계정 정보를 가져올 수 없습니다.",
            }
        );
        await vscode.commands.executeCommand("workbench.action.closeFolder");
        return;
    }

    const lecture = state.channelLectureList.allLectures
        .filter((item) => {
            const slug = item.url_slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            return new RegExp(`^${slug}\\d*$`, "i").test(folder.name);
        })
        .sort((left, right) => right.url_slug.length - left.url_slug.length)[0];

    await saveWorkspaceFolder(context, folder, lecture?.subject ?? folder.name);

    let mappings: Mapping[] = [];

    try {
        const mappingBytes = await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(folder.uri, ".goorm", "mapping.json"),
        );
        mappings = (JSON.parse(new TextDecoder().decode(mappingBytes)) as unknown[])
            .map((mapping) =>
                jsonToMapping(mapping as Parameters<typeof jsonToMapping>[0], folder.uri),
            );
    } catch (error) {
        console.error("[goormEDU] lesson mapping을 읽지 못했습니다.", error);
    }

    const url = await getGoormUrl();
    if (!url) {
        await vscode.window.showErrorMessage(
            "구름EDU 오류",
            {
                "modal": true,
                "detail": "구름EDU의 URL이 잘못되었습니다.",
            }
        );
        await vscode.commands.executeCommand("workbench.action.closeFolder");
        return;
    }

    vscode.window.showInformationMessage(`현재 ${state.userData.name}으로 구름EDU에 로그인되어있습니다.`);

    context.subscriptions.push(
        registerGuideAnchors(),
        await registerLessonDecorations(context, mappings, lecture?.sequence),
        registerQuizWorkspace(context, folder, state),
        vscode.workspace.onDidSaveTextDocument(() => vscode.commands.executeCommand("goormEDU.save")),
    );
}
