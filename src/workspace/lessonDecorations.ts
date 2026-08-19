import * as vscode from "vscode";
import * as path from "path";
import getCurriculum, { APICurriculum } from "./getCurriculum";
import { Mapping } from "../lib/mapping";

function isDirectChild(parent: vscode.Uri, child: vscode.Uri): boolean {
    if (parent.scheme !== child.scheme || parent.authority !== child.authority) {
        return false;
    }

    if (parent.scheme === "file") {
        return path.dirname(child.fsPath).toLowerCase() === parent.fsPath.toLowerCase();
    }

    return path.posix.dirname(child.path) === parent.path;
}

class LessonDecorationController implements vscode.FileDecorationProvider, vscode.Disposable {
    private readonly statusEmitter = new vscode.EventEmitter<undefined>();
    private readonly registration: vscode.Disposable;
    private readonly curriculumUris = new Map<string, vscode.Uri>();
    private readonly lessonUris = new Map<string, vscode.Uri>();
    private completedUris = new Set<string>();
    private completedLessonUris: vscode.Uri[] = [];
    private incorrectUris = new Set<string>();
    private incorrectLessonUris: vscode.Uri[] = [];

    readonly onDidChangeFileDecorations = this.statusEmitter.event;

    constructor(mappings: Mapping[]) {
        for (const mapping of mappings) {
            this.curriculumUris.set(mapping.data.idx, mapping.filePath);

            for (const lesson of mapping.lessons) {
                this.lessonUris.set(lesson.data.idx, lesson.filePath);
            }
        }

        this.registration = vscode.window.registerFileDecorationProvider(this);
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        const uriString = uri.toString();
        const isCompleted = this.completedUris.has(uriString) ||
            this.completedLessonUris.some((lessonUri) => isDirectChild(lessonUri, uri));

        if (isCompleted) {
            return new vscode.FileDecoration(
                "✓",
                "완료됨",
                new vscode.ThemeColor("testing.iconPassed"),
            );
        }

        const isIncorrect = this.incorrectUris.has(uriString) ||
            this.incorrectLessonUris.some((lessonUri) => isDirectChild(lessonUri, uri));

        if (isIncorrect) {
            return new vscode.FileDecoration(
                "×",
                "수강중",
                new vscode.ThemeColor("testing.iconFailed"),
            );
        }

        return undefined;
    }

    update(curriculums: APICurriculum): void {
        const completedUris = new Set<string>();
        const completedLessonUris: vscode.Uri[] = [];
        const incorrectUris = new Set<string>();
        const incorrectLessonUris: vscode.Uri[] = [];

        for (const curriculum of curriculums) {
            const curriculumUri = this.curriculumUris.get(curriculum.index);
            if (curriculumUri && curriculum.allLessons === curriculum.completedLessons) {
                completedUris.add(curriculumUri.toString());
            }

            for (const lesson of curriculum.lessons) {
                const lessonUri = this.lessonUris.get(lesson.index);
                if (lessonUri && lesson.score === 100) {
                    completedUris.add(lessonUri.toString());
                    completedLessonUris.push(lessonUri);
                } else if (lessonUri && lesson.first_access) {
                    incorrectUris.add(lessonUri.toString());
                    incorrectLessonUris.push(lessonUri);
                }
            }
        }

        this.completedUris = completedUris;
        this.completedLessonUris = completedLessonUris;
        this.incorrectUris = incorrectUris;
        this.incorrectLessonUris = incorrectLessonUris;

        // Compact Folders로 lesson/project가 합쳐진 경우 project URI도 다시 조회한다.
        this.statusEmitter.fire(undefined);
    }

    dispose(): void {
        this.registration.dispose();
        this.statusEmitter.dispose();

        if (activeController === this) activeController = undefined;
    }
}

let activeController: LessonDecorationController | undefined;

export async function refreshLessonDecorations(
    context: vscode.ExtensionContext,
    lectureSequence: number,
): Promise<void> {
    const curriculums = await getCurriculum(lectureSequence, context);
    if (curriculums) activeController?.update(curriculums);
}

export default async function registerLessonDecorations(
    context: vscode.ExtensionContext,
    mappings: Mapping[],
    lectureSequence?: number,
): Promise<vscode.Disposable> {
    activeController?.dispose();
    activeController = new LessonDecorationController(mappings);

    if (lectureSequence !== undefined) {
        await refreshLessonDecorations(context, lectureSequence);
    }

    return activeController;
}
