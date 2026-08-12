import * as path from "path";
import * as vscode from "vscode";
import getInitialState, { InitialState, LectureInitialState } from "../initialState";
import getQuiz from "../lib/getQuiz";
import { jsonToMapping, Mapping } from "../lib/mapping";
import {
    createQuizMetadata,
    getQuizMetadataUri,
    isQuizMetadata,
    QuizMetadata,
} from "../lib/quizMetadata";
import { ActiveQuiz } from "./quizContext";
import {
    findExamples,
    getQuizDescription,
    getQuizTitle,
} from "./quizPresentation";

type LessonMapping = Mapping["lessons"][number];
type StoredQuizFile = QuizMetadata["result"]["project"][string]["files"][number];

function isUriInside(parent: vscode.Uri, child: vscode.Uri): boolean {
    if (parent.scheme !== child.scheme || parent.authority !== child.authority) {
        return false;
    }

    const relative = parent.scheme === "file"
        ? path.relative(parent.fsPath, child.fsPath)
        : path.posix.relative(parent.path, child.path);

    return (
        relative !== "" &&
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !relative.startsWith("../") &&
        !path.isAbsolute(relative) &&
        !path.posix.isAbsolute(relative)
    );
}

function getFolderName(folder: vscode.WorkspaceFolder): string {
    return folder.uri.scheme === "file"
        ? path.basename(folder.uri.fsPath)
        : path.posix.basename(folder.uri.path);
}

function getFileUris(projectUri: vscode.Uri, file: StoredQuizFile): vscode.Uri[] {
    const rawPath = file.filepath.replaceAll("\\", "/");
    const normalizedPath = path.posix.normalize(rawPath || ".");
    const isSafePath = (
        normalizedPath !== ".." &&
        !normalizedPath.startsWith("../") &&
        !path.posix.isAbsolute(normalizedPath) &&
        !path.win32.isAbsolute(normalizedPath)
    );
    const relativePath = isSafePath && normalizedPath !== "."
        ? path.posix.basename(normalizedPath) === file.filename
            ? normalizedPath
            : path.posix.join(normalizedPath, file.filename)
        : file.filename;
    const candidates = [
        vscode.Uri.joinPath(projectUri, relativePath),
        vscode.Uri.joinPath(projectUri, file.filename),
    ];

    return candidates.filter(
        (uri, index) => candidates.findIndex(
            (candidate) => candidate.toString() === uri.toString(),
        ) === index,
    );
}

export class QuizRepository {
    private readonly metadataCache = new Map<string, QuizMetadata | null>();
    private mappings: Mapping[] = [];

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly folder: vscode.WorkspaceFolder,
        private readonly state: InitialState,
    ) {}

    async initialize(): Promise<void> {
        try {
            const mappingUri = vscode.Uri.joinPath(this.folder.uri, ".goorm", "mapping.json");
            const bytes = await vscode.workspace.fs.readFile(mappingUri);
            const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

            if (!Array.isArray(json)) {
                throw new Error("mapping.json의 최상위 값이 배열이 아닙니다.");
            }

            this.mappings = json.map((item) => jsonToMapping(item, this.folder.uri));
        } catch (error) {
            console.error("[goormEDU] 문제 파일 mapping을 읽지 못했습니다.", error);
        }
    }

    async resolve(document: vscode.TextDocument): Promise<ActiveQuiz | undefined> {
        const lesson = this.findLesson(document.uri);
        if (!lesson) {
            return undefined;
        }

        const storedMetadata = await this.readMetadata(lesson.data.idx);
        if (!storedMetadata) {
            return undefined;
        }

        const metadata = await this.ensurePresentation(storedMetadata);
        const projectEntry = this.findProject(document.uri, lesson, metadata);
        if (!projectEntry) {
            return undefined;
        }

        const [projectKey, project] = projectEntry;
        const projectUri = vscode.Uri.joinPath(lesson.filePath, projectKey);
        const fileIndex = project.files.findIndex((file) =>
            getFileUris(projectUri, file).some(
                (uri) => uri.toString() === document.uri.toString(),
            ),
        );
        const file = fileIndex >= 0
            ? {
                ...project.files[fileIndex],
                index: fileIndex,
                uri: document.uri,
            }
            : undefined;

        return {
            document,
            lecture: metadata.lecture,
            lesson: {
                ...lesson,
                ...metadata.lesson,
            },
            project: {
                ...project,
                key: projectKey,
                uri: projectUri,
            },
            file,
            metadata,
        };
    }

    private findLesson(uri: vscode.Uri): LessonMapping | undefined {
        return this.mappings
            .flatMap((mapping) => mapping.lessons)
            .find((lesson) => isUriInside(lesson.filePath, uri));
    }

    private findProject(
        documentUri: vscode.Uri,
        lesson: LessonMapping,
        metadata: QuizMetadata,
    ): [string, QuizMetadata["result"]["project"][string]] | undefined {
        return Object.entries(metadata.result.project).find(([projectKey]) =>
            isUriInside(vscode.Uri.joinPath(lesson.filePath, projectKey), documentUri),
        );
    }

    private async readMetadata(lessonIndex: string): Promise<QuizMetadata | undefined> {
        if (this.metadataCache.has(lessonIndex)) {
            return this.metadataCache.get(lessonIndex) ?? undefined;
        }

        let metadata: QuizMetadata | undefined;

        try {
            const uri = getQuizMetadataUri(this.folder.uri, lessonIndex);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

            if (!isQuizMetadata(value)) {
                throw new Error("지원하지 않는 문제 메타데이터 형식입니다.");
            }

            metadata = value;
        } catch {
            metadata = await this.fetchMissingMetadata(lessonIndex);
        }

        this.metadataCache.set(lessonIndex, metadata ?? null);
        return metadata;
    }

    private async fetchMissingMetadata(lessonIndex: string): Promise<QuizMetadata | undefined> {
        const lecture = this.findLecture();

        if (!lecture) {
            console.warn(`[goormEDU] ${lessonIndex} 문제의 강좌를 현재 폴더 이름으로 찾지 못했습니다.`);
            return undefined;
        }

        try {
            const lectureState = await getInitialState<LectureInitialState>(
                `/learn/lecture/${lecture.sequence}/${lecture.url_slug}`,
                this.context,
            );
            const lesson = lectureState?.lectureData.curriculumData
                .flatMap((curriculum) => curriculum.lessons)
                .find((item) => item.index === lessonIndex);

            if (!lesson) {
                return undefined;
            }

            const quiz = await getQuiz(
                lecture.index,
                lesson.index,
                this.state.userData.id,
                this.context,
            );

            if (!quiz) {
                return undefined;
            }

            const metadata = createQuizMetadata(
                quiz,
                {
                    index: lecture.index,
                    sequence: lecture.sequence,
                    urlSlug: lecture.url_slug,
                },
                {
                    index: lesson.index,
                    sequence: lesson.sequence,
                    urlSlug: lesson.urlSlug,
                    name: lesson.name,
                },
            );

            await this.writeMetadata(metadata);
            return metadata;
        } catch (error) {
            console.error(`[goormEDU] ${lessonIndex} 문제 메타데이터를 가져오지 못했습니다.`, error);
            return undefined;
        }
    }

    private findLecture(): InitialState["channelLectureList"]["allLectures"][number] | undefined {
        const folderName = getFolderName(this.folder);

        return this.state.channelLectureList.allLectures
            .filter((lecture) => {
                const escapedSlug = lecture.url_slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

                return new RegExp(`^${escapedSlug}\\d*$`, "i").test(folderName);
            })
            .sort((left, right) => right.url_slug.length - left.url_slug.length)[0];
    }

    private async ensurePresentation(metadata: QuizMetadata): Promise<QuizMetadata> {
        const resultTitle = getQuizTitle(metadata.result);
        const resultDescription = getQuizDescription(metadata.result);
        const resultExamples = findExamples(metadata.result);
        const needsDescription = !metadata.presentation?.description && !resultDescription;
        const needsExamples = metadata.presentation?.examples === undefined && resultExamples.length === 0;

        if (!needsDescription && !needsExamples) {
            return metadata;
        }

        try {
            const lessonState = await getInitialState<Record<string, unknown>>(
                this.getLessonPath(metadata),
                this.context,
            );

            if (!lessonState) {
                return metadata;
            }

            metadata.presentation = {
                title:
                    metadata.presentation?.title ??
                    getQuizTitle(lessonState) ??
                    resultTitle ??
                    metadata.lesson.name,
                description:
                    metadata.presentation?.description ??
                    resultDescription ??
                    getQuizDescription(lessonState),
                examples:
                    metadata.presentation?.examples ??
                    (resultExamples.length > 0 ? resultExamples : findExamples(lessonState)),
            };

            await this.writeMetadata(metadata);
        } catch (error) {
            console.error(`[goormEDU] ${metadata.lesson.index} 문제 설명을 가져오지 못했습니다.`, error);
        }

        return metadata;
    }

    private getLessonPath(metadata: QuizMetadata): string {
        const { lecture, lesson } = metadata;
        const parts = [
            "learn",
            "lecture",
            lecture.sequence,
            lecture.urlSlug,
            "lesson",
            lesson.sequence,
            lesson.urlSlug,
        ];

        return `/${parts.map((part) => encodeURIComponent(String(part))).join("/")}`;
    }

    private async writeMetadata(metadata: QuizMetadata): Promise<void> {
        await vscode.workspace.fs.createDirectory(
            vscode.Uri.joinPath(this.folder.uri, ".goorm", "quizzes"),
        );
        await vscode.workspace.fs.writeFile(
            getQuizMetadataUri(this.folder.uri, metadata.lesson.index),
            new TextEncoder().encode(JSON.stringify(metadata, null, 2)),
        );
    }
}
