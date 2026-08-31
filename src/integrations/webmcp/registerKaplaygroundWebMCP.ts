/** Connects browser WebMCP tools to KAPLAYGROUND's live editor stores. */
import { Decode } from "console-feed";
import { SANDBOX_ORIGIN, VERSION } from "../../config/common";
import { assetBrewCatalog } from "../../data/assetBrewCatalog.ts";
import { demos, getDemo } from "../../data/demos.ts";
import { waitForPlaygroundReady } from "../../features/Projects/application/playgroundReadiness";
import type { FileKind } from "../../features/Projects/models/FileKind";
import { useProject } from "../../features/Projects/stores/useProject";
import { useEditor } from "../../hooks/useEditor";
import { createBoundedConsoleCapture } from "./boundedConsoleCapture";
import { createCodexPlayGuideForContext } from "./codexPlayContext.ts";
import { readCodexPlayStepIndex } from "./codexPlayProgress.ts";
import {
    createKaplaygroundWebMCP,
    type KaplaygroundConsoleEntry,
} from "./kaplaygroundWebMCP";
import { collectMonacoDiagnostics } from "./monacoDiagnostics";
import {
    resetWebMCPActivityOnProjectReplacement,
    useWebMCPActivity,
} from "./webMCPActivity";

const MAX_RETAINED_LOGS = 500;
const FILE_KIND_BY_FOLDER: Record<string, FileKind> = {
    scenes: "scene",
    objects: "obj",
    utils: "util",
};

export function registerKaplaygroundWebMCP(): () => void {
    const consoleCapture = createBoundedConsoleCapture(MAX_RETAINED_LOGS);
    let transientBaselineRevision = useProject.getState().projectRevision;

    const hasUnsavedProjectChanges = () => {
        const projectStore = useProject.getState();
        return useEditor.getState().runtime.hasUnsavedChanges
            || (
                projectStore.projectKey === null
                && projectStore.projectRevision !== transientBaselineRevision
            );
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
        const iframeWindow = useEditor.getState().runtime.iframe?.contentWindow;
        if (event.origin !== SANDBOX_ORIGIN || event.source !== iframeWindow) {
            return;
        }
        if (!isConsoleMessage(event.data)) return;

        let decoded: { method?: string; data?: unknown[] };
        try {
            decoded = Decode(event.data.log) as typeof decoded;
        } catch {
            return;
        }
        const values = decoded.data ?? [];
        if (values.some((value) => String(value).startsWith("[sandbox]"))) {
            return;
        }
        if (values.some((value) => String(value).startsWith("[vite]"))) return;

        consoleCapture.add({
            timestamp: Date.now(),
            runId: event.data.runId,
            level: normalizeConsoleLevel(decoded.method),
            values,
        });
    };

    window.addEventListener("message", handleMessage);
    const unsubscribeProject = useProject.subscribe((state, previous) => {
        if (state.projectGeneration !== previous.projectGeneration) {
            const generation = state.projectGeneration;
            queueMicrotask(() => {
                const current = useProject.getState();
                if (current.projectGeneration === generation) {
                    transientBaselineRevision = current.projectRevision;
                }
            });
        }
        resetWebMCPActivityOnProjectReplacement(
            state,
            previous,
            () => consoleCapture.clear(),
        );
    });

    const bridge = createKaplaygroundWebMCP({
        appVersion: VERSION,
        onStatusChange(status, toolNames) {
            useWebMCPActivity.getState().setConnection(status, toolNames);
        },
        onInvocation(invocation) {
            useWebMCPActivity.getState().recordInvocation(invocation);
        },
        adapter: {
            async waitUntilReady(signal) {
                await waitWithAbort(waitForPlaygroundReady(), signal);
            },

            getProject() {
                const projectStore = useProject.getState();
                const { project } = projectStore;
                const example = getDemo(
                    projectStore.demoKey ?? project.sourceDemoKey,
                );
                const codexGuide = createCodexPlayGuideForContext({
                    demoKey: projectStore.demoKey,
                    sourceDemoKey: project.sourceDemoKey,
                    projectKey: projectStore.projectKey,
                    projectName: project.name,
                    projectCreatedAt: project.createdAt,
                    projectSource: [...project.files.values()]
                        .map((file) => file.value)
                        .join("\n"),
                });
                const activeStepIndex = readCodexPlayStepIndex(
                    codexGuide.key,
                    codexGuide.steps.length,
                );
                const editor = useEditor.getState();
                const previewAvailable =
                    editor.runtime.iframe?.isConnected === true
                    || document.querySelector("#game-view") !== null;
                return {
                    name: project.name,
                    projectId: projectStore.projectKey,
                    projectRevision: getProjectRevision(),
                    storageState: projectStore.getProjectStorageState(),
                    version: project.version,
                    kaplayVersion: project.kaplayVersion,
                    mode: project.mode,
                    buildMode: project.buildMode,
                    fileCount: project.files.size,
                    assetCount: project.assets.size,
                    currentFile: editor.runtime.currentFile,
                    previewState: editor.stopped
                        ? "stopped"
                        : !previewAvailable
                        ? "unknown"
                        : editor.paused
                        ? "paused"
                        : "running",
                    hasUnsavedChanges: hasUnsavedProjectChanges(),
                    example: example
                        ? {
                            key: example.key,
                            title: example.formattedName,
                            description: example.description,
                            tags: example.tags.map((tag) => tag.name),
                        }
                        : null,
                    codexGuide: {
                        key: codexGuide.key,
                        subjectTitle: codexGuide.subjectTitle,
                        activeStepIndex,
                        activeStep: codexGuide.steps[activeStepIndex] ?? null,
                    },
                };
            },

            getProjectRevision,

            listExamples() {
                return demos.map((example) => ({
                    key: example.key,
                    title: example.formattedName,
                    description: example.description,
                    tags: example.tags.map((tag) => tag.name),
                }));
            },

            async openExample(
                key,
                expectedProjectRevision,
                discardUnsavedChanges,
            ) {
                assertProjectRevision(expectedProjectRevision);
                if (
                    hasUnsavedProjectChanges()
                    && !discardUnsavedChanges
                ) {
                    throw new Error(
                        "The active project has unsaved changes. Save it first or explicitly approve replacing them.",
                    );
                }
                await useProject.getState().createNewProject("ex", {}, key);
            },

            listFiles() {
                return [...useProject.getState().project.files.values()].map((
                    file,
                ) => ({
                    path: file.path,
                    language: file.language,
                    kind: file.kind,
                    sizeBytes: new TextEncoder().encode(file.value).byteLength,
                }));
            },

            listAssets() {
                return [...useProject.getState().project.assets.values()].map(
                    (asset) => {
                        const sizeBytes = embeddedAssetSize(asset.url);
                        return {
                            name: asset.name,
                            path: asset.path,
                            kind: asset.kind,
                            importFunction: asset.importFunction,
                            source: assetSource(asset.url),
                            ...(sizeBytes === undefined ? {} : { sizeBytes }),
                        };
                    },
                );
            },

            listAssetBrew() {
                return assetBrewCatalog;
            },

            readFile(path) {
                const file = useProject.getState().project.files.get(path);
                if (!file) return null;
                return {
                    path: file.path,
                    language: file.language,
                    kind: file.kind,
                    content: file.value,
                };
            },

            writeFile(path, content, expectedProjectRevision) {
                assertProjectRevision(expectedProjectRevision);
                const projectStore = useProject.getState();
                const file = projectStore.project.files.get(path);
                if (!file) throw new Error(`Project file not found: ${path}`);

                projectStore.updateFile(file.path, content);

                const { editor, monaco } = useEditor.getState().runtime;
                const model = monaco?.editor.getModel(
                    monaco.Uri.file(file.path),
                );
                if (model && model.getValue() !== content) {
                    model.setValue(content);
                }
                if (
                    editor && editor.getModel() === model
                    && editor.getValue() !== content
                ) {
                    editor.setValue(content);
                }
            },

            createFile(file, expectedProjectRevision) {
                assertProjectRevision(expectedProjectRevision);
                const match = file.path.match(
                    /^(scenes|objects|utils)\/([^/]+)\.(js|ts)$/,
                );
                if (!match) {
                    throw new Error(
                        "New files must be JavaScript or TypeScript files directly inside scenes/, objects/, or utils/.",
                    );
                }

                const projectStore = useProject.getState();
                if (projectStore.project.files.has(file.path)) {
                    throw new Error(
                        `Project file already exists: ${file.path}`,
                    );
                }

                const folder = match[1]!;
                const extension = match[3]!;
                const kind = FILE_KIND_BY_FOLDER[folder]!;
                if (file.kind !== undefined && file.kind !== kind) {
                    throw new Error(
                        `File kind "${file.kind}" does not match the ${folder}/ folder.`,
                    );
                }

                projectStore.addFile({
                    path: file.path,
                    value: file.content,
                    language: file.language
                        ?? (extension === "ts" ? "typescript" : "javascript"),
                    kind,
                });
            },

            removeFile(path, expectedProjectRevision) {
                assertProjectRevision(expectedProjectRevision);
                const projectStore = useProject.getState();
                const file = projectStore.project.files.get(path);
                if (!file) throw new Error(`Project file not found: ${path}`);
                if (
                    !/^(scenes|objects|utils)\/[^/]+\.(js|ts)$/.test(file.path)
                ) {
                    throw new Error(
                        "Only files inside scenes/, objects/, or utils/ can be removed through WebMCP.",
                    );
                }

                const editorStore = useEditor.getState();
                const { monaco, currentFile } = editorStore.runtime;
                monaco?.editor.getModel(monaco.Uri.file(file.path))?.dispose();
                projectStore.removeFile(file.path);
                if (currentFile === file.path) {
                    editorStore.setCurrentFile("main.js");
                }
            },

            selectFile(path) {
                if (!useProject.getState().project.files.has(path)) {
                    throw new Error(`Project file not found: ${path}`);
                }
                useEditor.getState().setCurrentFile(path);
            },

            async saveProject(expectedProjectRevision) {
                assertProjectRevision(expectedProjectRevision);
                const projectId = await useProject.getState()
                    .persistActiveProject();
                assertProjectRevision(expectedProjectRevision);
                return { projectId, storageState: "autosaved" as const };
            },

            runPreview(signal) {
                assertPreviewLayoutAvailable();
                return useEditor.getState().runWithSignal(signal);
            },

            setPreviewPaused(paused, signal) {
                assertPreviewLayoutAvailable();
                return useEditor.getState().setPaused(paused, signal);
            },

            stopPreview() {
                useEditor.getState().stop();
            },

            inspectPreview(options, signal) {
                assertPreviewLayoutAvailable();
                return useEditor.getState().inspectPreview(options, signal);
            },

            getDiagnostics() {
                const { monaco } = useEditor.getState().runtime;
                return collectMonacoDiagnostics(
                    monaco ?? undefined,
                    useProject.getState().project.files,
                );
            },

            getConsoleEntries() {
                return consoleCapture.snapshot();
            },

            getPreviewRunId() {
                return useEditor.getState().previewRunId;
            },
        },
    });

    return () => {
        unsubscribeProject();
        window.removeEventListener("message", handleMessage);
        bridge.destroy();
    };
}

function isConsoleMessage(
    value: unknown,
): value is {
    type: string;
    runId: string | null;
    log: Parameters<typeof Decode>[0];
} {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as {
        type?: unknown;
        runId?: unknown;
        log?: unknown;
    };
    return candidate.type === "CONSOLE"
        && (
            candidate.runId === null
            || (typeof candidate.runId === "string"
                && candidate.runId.length <= 128)
        )
        && Array.isArray(candidate.log);
}

function normalizeConsoleLevel(
    method: string | undefined,
): KaplaygroundConsoleEntry["level"] {
    const level = method?.toLowerCase();
    if (
        level === "debug" || level === "info" || level === "warn"
        || level === "error"
    ) {
        return level;
    }
    return "log";
}

function getProjectRevision(): string {
    return `project-${useProject.getState().projectGeneration}`;
}

function assertProjectRevision(expectedProjectRevision: string): void {
    const actualProjectRevision = getProjectRevision();
    if (actualProjectRevision !== expectedProjectRevision) {
        throw new Error(
            `Project changed: expected revision ${expectedProjectRevision}, found ${actualProjectRevision}.`,
        );
    }
}

function assertPreviewLayoutAvailable(): void {
    const isUnsupportedPortraitProject =
        useProject.getState().project.mode === "pj"
        && window.matchMedia("(orientation: portrait)").matches;
    if (isUnsupportedPortraitProject) {
        throw new Error(
            "The preview is unavailable for projects in the current portrait layout.",
        );
    }
}

function assetSource(
    url: string,
): "embedded" | "remote" | "blob" | "unknown" {
    if (url.startsWith("data:")) return "embedded";
    if (url.startsWith("blob:")) return "blob";
    if (/^https?:\/\//.test(url)) return "remote";
    return "unknown";
}

function embeddedAssetSize(url: string): number | undefined {
    if (!url.startsWith("data:")) return undefined;
    const separator = url.indexOf(",");
    if (separator < 0) return undefined;
    const metadata = url.slice(0, separator);
    const data = url.slice(separator + 1);
    if (!metadata.endsWith(";base64")) {
        try {
            return new TextEncoder().encode(decodeURIComponent(data))
                .byteLength;
        } catch {
            return undefined;
        }
    }
    const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor(data.length * 3 / 4) - padding);
}

async function waitWithAbort<T>(
    promise: Promise<T>,
    signal: AbortSignal,
): Promise<T> {
    if (signal.aborted) throw abortReason(signal);

    return await new Promise<T>((resolve, reject) => {
        const abort = () => reject(abortReason(signal));
        signal.addEventListener("abort", abort, { once: true });
        void promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", abort);
        });
    });
}

function abortReason(signal: AbortSignal): Error {
    return signal.reason instanceof Error
        ? signal.reason
        : new DOMException("The WebMCP bridge was destroyed.", "AbortError");
}
