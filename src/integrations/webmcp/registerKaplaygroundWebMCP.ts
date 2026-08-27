/** Connects browser WebMCP tools to KAPLAYGROUND's live editor stores. */
import { Decode } from "console-feed";
import {
    createKaplaygroundWebMCP,
    type KaplaygroundConsoleEntry,
    type KaplaygroundDiagnostic,
} from "./kaplaygroundWebMCP";
import { useWebMCPActivity } from "./webMCPActivity";
import { SANDBOX_ORIGIN } from "../../config/common";
import type { FileKind } from "../../features/Projects/models/FileKind";
import { useProject } from "../../features/Projects/stores/useProject";
import { useEditor } from "../../hooks/useEditor";

const MAX_RETAINED_LOGS = 500;
const FILE_KIND_BY_FOLDER: Record<string, FileKind> = {
    scenes: "scene",
    objects: "obj",
    utils: "util",
};

export function registerKaplaygroundWebMCP(): () => void {
    const consoleEntries: KaplaygroundConsoleEntry[] = [];

    const handleMessage = (event: MessageEvent<unknown>) => {
        const iframeWindow = useEditor.getState().runtime.iframe?.contentWindow;
        if (event.origin !== SANDBOX_ORIGIN || event.source !== iframeWindow) return;
        if (!isConsoleMessage(event.data)) return;

        const decoded = Decode(event.data.log) as {
            method?: string;
            data?: unknown[];
        };
        const values = decoded.data ?? [];
        if (values.some((value) => String(value).startsWith("[sandbox]"))) return;
        if (values.some((value) => String(value).startsWith("[vite]"))) return;

        consoleEntries.push({
            timestamp: Date.now(),
            level: normalizeConsoleLevel(decoded.method),
            values,
        });
        if (consoleEntries.length > MAX_RETAINED_LOGS) {
            consoleEntries.splice(0, consoleEntries.length - MAX_RETAINED_LOGS);
        }
    };

    window.addEventListener("message", handleMessage);
    const unsubscribeProject = useProject.subscribe((state, previous) => {
        if (state.projectKey !== previous.projectKey || state.demoKey !== previous.demoKey) {
            consoleEntries.length = 0;
        }
    });

    const bridge = createKaplaygroundWebMCP({
        onStatusChange(status, toolNames) {
            useWebMCPActivity.getState().setConnection(status, toolNames);
        },
        onInvocation(invocation) {
            useWebMCPActivity.getState().recordInvocation(invocation);
        },
        adapter: {
            getProject() {
                const { project } = useProject.getState();
                const editor = useEditor.getState();
                return {
                    name: project.name,
                    version: project.version,
                    kaplayVersion: project.kaplayVersion,
                    mode: project.mode,
                    buildMode: project.buildMode,
                    fileCount: project.files.size,
                    assetCount: project.assets.size,
                    currentFile: editor.runtime.currentFile,
                    previewState: editor.stopped ? "stopped" : "running",
                    hasUnsavedChanges: editor.runtime.hasUnsavedChanges,
                };
            },

            listFiles() {
                return [...useProject.getState().project.files.values()].map((file) => ({
                    path: file.path,
                    language: file.language,
                    kind: file.kind,
                    sizeBytes: new TextEncoder().encode(file.value).byteLength,
                }));
            },

            readFile(path) {
                const file = useProject.getState().getFile(path);
                if (!file) return null;
                return {
                    path: file.path,
                    language: file.language,
                    kind: file.kind,
                    content: file.value,
                };
            },

            writeFile(path, content) {
                const projectStore = useProject.getState();
                const file = projectStore.getFile(path);
                if (!file) throw new Error(`Project file not found: ${path}`);

                projectStore.updateFile(file.path, content);

                const { editor, monaco } = useEditor.getState().runtime;
                const model = monaco?.editor.getModel(monaco.Uri.file(file.path));
                if (model && model.getValue() !== content) model.setValue(content);
                if (editor && editor.getModel() === model && editor.getValue() !== content) {
                    editor.setValue(content);
                }
            },

            createFile(file) {
                const match = file.path.match(
                    /^(scenes|objects|utils)\/([^/]+)\.(js|ts)$/,
                );
                if (!match) {
                    throw new Error(
                        "New files must be JavaScript or TypeScript files directly inside scenes/, objects/, or utils/.",
                    );
                }

                const projectStore = useProject.getState();
                if (projectStore.getFile(file.path)) {
                    throw new Error(`Project file already exists: ${file.path}`);
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

            removeFile(path) {
                const projectStore = useProject.getState();
                const file = projectStore.getFile(path);
                if (!file) throw new Error(`Project file not found: ${path}`);
                if (!/^(scenes|objects|utils)\/[^/]+\.(js|ts)$/.test(file.path)) {
                    throw new Error(
                        "Only files inside scenes/, objects/, or utils/ can be removed through WebMCP.",
                    );
                }

                const editorStore = useEditor.getState();
                const { monaco, currentFile } = editorStore.runtime;
                monaco?.editor.getModel(monaco.Uri.file(file.path))?.dispose();
                projectStore.removeFile(file.path);
                if (currentFile === file.path) editorStore.setCurrentFile("main.js");
            },

            selectFile(path) {
                useEditor.getState().setCurrentFile(path);
            },

            runPreview() {
                useEditor.getState().run();
            },

            togglePreviewPause() {
                useEditor.getState().pause();
            },

            stopPreview() {
                useEditor.getState().stop();
            },

            getDiagnostics() {
                return getMonacoDiagnostics();
            },

            getConsoleEntries() {
                return consoleEntries;
            },
        },
    });

    return () => {
        unsubscribeProject();
        window.removeEventListener("message", handleMessage);
        bridge.destroy();
    };
}

function getMonacoDiagnostics(): KaplaygroundDiagnostic[] {
    const { monaco } = useEditor.getState().runtime;
    if (!monaco) return [];
    const files = useProject.getState().project.files;

    return monaco.editor.getModelMarkers({}).flatMap((marker) => {
        const path = decodeURIComponent(marker.resource.path).replace(/^\/+/, "");
        if (!files.has(path)) return [];

        const diagnostic: KaplaygroundDiagnostic = {
            path,
            severity: markerSeverity(monaco.MarkerSeverity, marker.severity),
            message: marker.message,
            startLine: marker.startLineNumber,
            startColumn: marker.startColumn,
            endLine: marker.endLineNumber,
            endColumn: marker.endColumn,
        };
        if (marker.source) diagnostic.source = marker.source;
        if (marker.code !== undefined) {
            diagnostic.code = typeof marker.code === "string"
                ? marker.code
                : marker.code.value;
        }
        return [diagnostic];
    });
}

function markerSeverity(
    markerSeverity: { Error: number; Warning: number; Info: number; Hint: number },
    value: number,
): KaplaygroundDiagnostic["severity"] {
    if (value === markerSeverity.Error) return "error";
    if (value === markerSeverity.Warning) return "warning";
    if (value === markerSeverity.Info) return "info";
    if (value === markerSeverity.Hint) return "hint";
    return String(value);
}

function isConsoleMessage(
    value: unknown,
): value is { type: string; log: Parameters<typeof Decode>[0] } {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as { type?: unknown; log?: unknown };
    return candidate.type === "CONSOLE" && Array.isArray(candidate.log);
}

function normalizeConsoleLevel(method: string | undefined): KaplaygroundConsoleEntry["level"] {
    const level = method?.toLowerCase();
    if (level === "debug" || level === "info" || level === "warn" || level === "error") {
        return level;
    }
    return "log";
}
