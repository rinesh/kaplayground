import type { Monaco } from "@monaco-editor/react";
import confetti from "canvas-confetti";
import { editor } from "monaco-editor";
import { toast } from "react-toastify";
import { create } from "zustand";
import { SANDBOX_ORIGIN, SANDBOX_URL } from "../config/common";
import { kaplayVersions } from "../data/kaplayVersions.json";
import { wrapGame } from "../features/Projects/application/wrapGame";
import { useProject } from "../features/Projects/stores/useProject";
import { parseAssetPath } from "../util/assetsParsing";
import { debug } from "../util/logs";
import { MATCH_ASSET_URL_REGEX } from "../util/regex";
import {
    emptyPreviewAssets,
    type PreviewAssets,
    receivePreviewAssets,
} from "./previewAssets";
import {
    MAX_PREVIEW_INSPECTION_OBJECTS,
    PREVIEW_PROTOCOL_VERSION,
    type PreviewExerciseAction,
    type PreviewExerciseResult,
    type PreviewInspection,
    type PreviewInspectionOptions,
    type PreviewPauseResult,
    type PreviewReadiness,
    PreviewRunError,
    type PreviewRunResult,
    type SandboxExerciseResultMessage,
    type SandboxInspectionResultMessage,
    type SandboxPauseResultMessage,
    type SandboxRunResultMessage,
} from "./previewProtocol";
import { createPreviewRunCoordinator } from "./previewRunCoordinator";
import { useWorkspace } from "./useWorkspace";

const PREVIEW_READY_TIMEOUT_MS = 10_000;
const PREVIEW_RUN_TIMEOUT_MS = 30_000;
const PREVIEW_CONTROL_TIMEOUT_MS = 10_000;
const PREVIEW_EXERCISE_TIMEOUT_MS = 15_000;
const LAYOUT_POLL_INTERVAL_MS = 100;
const previewRunCoordinator = createPreviewRunCoordinator();
let previewSessionController = new AbortController();

interface EditorRuntime {
    /**
     * The monaco code editor instance
     */
    editor: editor.IStandaloneCodeEditor | null;
    /**
     * The monaco instance
     */
    monaco: Monaco | null;
    /**
     * The stored view states for each file
     */
    viewStates: Record<string, editor.ICodeEditorViewState | null>;
    /**
     * The current selection in the editor
     */
    currentFile: string;
    /**
     * The last saved editor value
     */
    editorLastSavedValue: string | null;
    /**
     * If file was modified and not saved
     */
    hasUnsavedChanges: boolean;
    /**
     * Decorations for the glyph images
     */
    glyphDecorations: editor.IEditorDecorationsCollection | null;
    /**
     * Iframe element for the game view
     */
    iframe: HTMLIFrameElement | null;
    /**
     * Iframe element for the game view
     */
    iframeSrc: string;
    /**
     * Console element for the game view
     */
    console: Console | null;
    /**
     * Versions cached
     */
    kaplayVersions: string[];
    /**
     * The confetti canvas
     */
    confettiCanvas:
        | HTMLCanvasElement & {
            confetti: confetti.CreateTypes;
        }
        | null;
}

export interface EditorStore {
    runtime: EditorRuntime;
    stopped: boolean;
    previewRunId: string | null;
    /** Executable identity attached only to runs verified by run_game. */
    previewContentRevision: string | null;
    previewRuntimeFingerprint: string | null;
    previewReadiness: PreviewReadiness | null;
    previewAssets: PreviewAssets;
    previewProjectGeneration: number | null;
    paused: boolean | null;
    update: (value?: string) => void;
    run: () => Promise<PreviewRunResult>;
    runWithSignal: (signal?: AbortSignal) => Promise<PreviewRunResult>;
    setPaused: (
        paused: boolean,
        signal?: AbortSignal,
    ) => Promise<PreviewPauseResult>;
    inspectPreview: (
        options?: PreviewInspectionOptions,
        signal?: AbortSignal,
    ) => Promise<PreviewInspection>;
    exercisePreview: (
        actions: PreviewExerciseAction[],
        signal?: AbortSignal,
        expectedRunId?: string | null,
    ) => Promise<PreviewExerciseResult>;
    pause: () => void;
    stop: () => void;
    getRuntime: () => EditorRuntime;
    setRuntime: (runtime: Partial<EditorRuntime>) => void;
    getIframeSrc: () => string;
    setCurrentFile: (currentFile: string) => void;
    resetEditorModel: () => void;
    setTheme: (theme: string) => void;
    /**
     * Update glyph image decorations for loadXXXX functions
     */
    updateImageDecorations: () => void;
    updateModelMarkers: () => void;
    showNotification: (message: string) => void;
    setEditorValue: (value: string) => void;
    updateEditorLastSavedValue: (value?: string) => void;
    updateHasUnsavedChanges: () => void;
    updateAndRun: () => void;
    focusGame: () => void;
}

export const useEditor = create<EditorStore>((set, get) => ({
    runtime: {
        editor: null,
        monaco: null,
        currentFile: "main.js",
        editorLastSavedValue: null,
        hasUnsavedChanges: false,
        glyphDecorations: null,
        iframe: null,
        iframeSrc: SANDBOX_URL,
        console: null,
        viewStates: {},
        kaplayVersions: kaplayVersions,
        confettiCanvas: null,
    },
    stopped: (new URL(window.location.href)).searchParams.has("stopped"),
    previewRunId: null,
    previewContentRevision: null,
    previewRuntimeFingerprint: null,
    previewReadiness: null,
    previewAssets: emptyPreviewAssets(),
    previewProjectGeneration: null,
    paused: null,
    setRuntime: (runtime) => {
        set((state) => ({
            runtime: {
                ...state.runtime,
                ...runtime,
            },
        }));
    },
    getRuntime: () => get().runtime,
    setCurrentFile: (newCurrentFile) => {
        const editor = get().runtime.editor;
        const monaco = get().runtime.monaco;
        const currentFile = get().runtime.currentFile;
        const viewStates = get().runtime.viewStates;
        // remove initial /
        newCurrentFile = newCurrentFile.replace(/^\/|\/$/g, "");

        if (!editor || !monaco) {
            return set({
                runtime: {
                    ...get().runtime,
                    currentFile: newCurrentFile,
                },
            });
        }

        // Previous view state saving
        viewStates[currentFile] = editor.saveViewState();

        // Model changing logic
        let currentFileModel = monaco.editor.getModel(
            monaco.Uri.file(newCurrentFile),
        );

        if (!currentFileModel) {
            currentFileModel = monaco.editor.createModel(
                useProject.getState().getFile(newCurrentFile)?.value ?? "",
                useProject.getState().getFile(newCurrentFile)?.language
                    ?? "javascript",
                monaco.Uri.file(newCurrentFile),
            );
        }

        editor.setModel(currentFileModel);

        // Workaround to refresh TS diagnostics decorations
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
        });

        // Load new view state
        const viewState = viewStates[newCurrentFile];

        if (viewState) {
            editor.restoreViewState(viewState);
        }

        if (useWorkspace.getState().activeTab === "code") editor.focus();

        set((state) => ({
            runtime: {
                ...state.runtime,
                currentFile: newCurrentFile,
                viewStates: viewStates,
            },
        }));

        get().updateEditorLastSavedValue();
    },
    resetEditorModel: () => {
        const monaco = get().runtime.monaco;
        if (!monaco) return;

        set((state) => ({
            runtime: {
                ...state.runtime,
                viewStates: {},
            },
        }));

        monaco.editor.getModels().forEach(model => model.dispose());
    },
    update: (customValue?: string) => {
        if (customValue) {
            debug(0, "[codeEditor] Editor value updated with custom value");

            get().setEditorValue(customValue);
            return;
        }

        const currentFile = useProject.getState().getFile(
            get().getRuntime().currentFile,
        );
        if (!currentFile) return;

        debug(
            0,
            "[monaco] Editor value forced updated with",
            currentFile.path.slice(0, 25) + "...",
        );

        get().updateEditorLastSavedValue(currentFile.value);

        get().setEditorValue(currentFile.value);
        get().updateImageDecorations();
    },
    setTheme: (theme: string) => {
        const editor = get().runtime.editor;
        if (!editor) return;

        editor.updateOptions({
            theme,
        });
    },
    getIframeSrc: () => {
        const url = new URL(get().runtime.iframeSrc);
        url.searchParams.set(
            "console",
            "true",
        );
        return url.href;
    },
    run() {
        return get().runWithSignal();
    },
    runWithSignal(callerSignal) {
        if (
            get().stopped
            && new URLSearchParams(window.location.search).has("stopped")
        ) {
            const url = new URL(window.location.href);
            url.searchParams.delete("stopped");
            window.history.replaceState({}, "", url);
        }

        const runId = createRequestId("run");
        const sessionSignal = beginPreviewSession();
        clearPreviewAssetSelection();
        set({
            stopped: false,
            previewRunId: runId,
            previewContentRevision: null,
            previewRuntimeFingerprint: null,
            previewReadiness: null,
            previewAssets: emptyPreviewAssets(),
            previewProjectGeneration: useProject.getState().projectGeneration,
            paused: null,
        });

        const waitForIframeLayout = async (
            iframeContentWindow: Window,
            signal: AbortSignal,
        ): Promise<HTMLIFrameElement | null> => {
            const timeoutAt = performance.now() + PREVIEW_READY_TIMEOUT_MS;

            while (performance.now() < timeoutAt) {
                signal.throwIfAborted();
                const gameIframe = get().runtime.iframe
                    ?? document.querySelector<HTMLIFrameElement>("#game-view");
                const rect = gameIframe?.getBoundingClientRect();

                if (
                    gameIframe?.contentWindow === iframeContentWindow
                    && rect
                    && rect.width > 0
                    && rect.height > 0
                ) {
                    // Let the sandbox complete layout before KAPLAY measures its canvas.
                    await waitForLayoutTick(signal);
                    await waitForLayoutTick(signal);
                    signal.throwIfAborted();
                    return gameIframe;
                }

                await waitForLayoutTick(signal);
            }

            return null;
        };

        const updateCode = async (
            iframeContentWindow: Window,
            signal: AbortSignal,
        ): Promise<PreviewRunResult> => {
            const gameIframe = await waitForIframeLayout(
                iframeContentWindow,
                signal,
            );
            if (!gameIframe) {
                throw new Error("[game] iframe did not become visible in time");
            }

            signal.throwIfAborted();
            console.log("[game] iframe loaded");
            const code = await wrapGame(runId);
            signal.throwIfAborted();

            if (gameIframe.contentWindow !== iframeContentWindow) {
                throw new Error(
                    "[game] iframe changed before code could be posted",
                );
            }

            const onAssets = (event: MessageEvent) => {
                if (get().previewRunId !== runId) return;
                const next = receivePreviewAssets(get().previewAssets, event, {
                    origin: SANDBOX_ORIGIN,
                    source: iframeContentWindow,
                    runId,
                });
                if (next) set({ previewAssets: next });
            };
            window.addEventListener("message", onAssets);
            sessionSignal.addEventListener("abort", () => {
                window.removeEventListener("message", onAssets);
            }, { once: true });

            const result = await requestSandbox(
                iframeContentWindow,
                {
                    type: "UPDATE_CODE",
                    runId,
                    code,
                },
                (data): data is SandboxRunResultMessage =>
                    isRecord(data)
                    && data.type === "RUN_RESULT"
                    && data.runId === runId,
                signal,
                PREVIEW_RUN_TIMEOUT_MS,
                "[game] sandbox did not acknowledge the preview run in time",
            );

            if (result.status === "failed") {
                throw new PreviewRunError(
                    runId,
                    result.error ?? "The preview module failed to execute.",
                );
            }

            set({
                previewRunId: runId,
                previewReadiness: result.readiness,
                paused: typeof result.paused === "boolean"
                    ? result.paused
                    : null,
            });
            return { runId, status: "loaded", readiness: result.readiness };
        };

        const runPromise = previewRunCoordinator.run(
            async (coordinatorSignal) => {
                const operation = createOperationSignal(
                    [coordinatorSignal, sessionSignal, callerSignal],
                    PREVIEW_RUN_TIMEOUT_MS,
                    "The preview run timed out.",
                );

                try {
                    const iframe = document.querySelector<HTMLIFrameElement>(
                        "#game-view",
                    );

                    if (iframe) {
                        const iframeReady = waitForIframeReady(
                            operation.signal,
                        );
                        iframe.src = get().getIframeSrc();
                        return await updateCode(
                            await iframeReady,
                            operation.signal,
                        );
                    }

                    return await updateCode(
                        await waitForIframeReady(operation.signal),
                        operation.signal,
                    );
                } catch (error) {
                    if (get().previewRunId === runId) {
                        set({
                            stopped: true,
                            previewRunId: null,
                            previewContentRevision: null,
                            previewRuntimeFingerprint: null,
                            previewReadiness: null,
                            previewAssets: emptyPreviewAssets(),
                            previewProjectGeneration: null,
                            paused: null,
                        });
                    }
                    if (operation.signal.aborted) throw operation.signal.reason;
                    if (error instanceof PreviewRunError) throw error;
                    throw new PreviewRunError(runId, errorMessage(error));
                } finally {
                    operation.dispose();
                }
            },
        );
        // UI actions intentionally fire and forget preview runs. Consume expected
        // cancellations and log other failures; awaited callers still receive them.
        void runPromise.catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            console.error("[game] Preview run failed", error);
        });
        return runPromise;
    },
    async setPaused(paused, callerSignal) {
        if (get().stopped || get().previewRunId === null) {
            await get().runWithSignal(callerSignal);
        }

        const iframeWindow = getPreviewWindow(get().runtime.iframe);
        const runId = get().previewRunId;
        if (runId === null) throw new Error("The preview has no active run.");
        const requestId = createRequestId("pause");
        const operation = createOperationSignal(
            [previewSessionController.signal, callerSignal],
            PREVIEW_CONTROL_TIMEOUT_MS,
            "Changing the preview pause state timed out.",
        );

        try {
            const result = await requestSandbox(
                iframeWindow,
                { type: "SET_PAUSED", requestId, runId, paused },
                (data): data is SandboxPauseResultMessage =>
                    isRecord(data)
                    && data.type === "PAUSE_RESULT"
                    && data.requestId === requestId,
                operation.signal,
                PREVIEW_CONTROL_TIMEOUT_MS,
                "[game] sandbox did not acknowledge the pause state in time",
            );

            if (
                result.error
                || result.runId !== runId
                || typeof result.paused !== "boolean"
            ) {
                throw new Error(
                    result.error
                        ?? "The sandbox did not acknowledge the active preview run.",
                );
            }

            set({
                previewRunId: result.runId,
                paused: result.paused,
            });
            return {
                runId: result.runId,
                paused: result.paused,
            };
        } finally {
            operation.dispose();
        }
    },
    async inspectPreview(options = {}, callerSignal) {
        if (get().stopped) {
            throw new Error(
                "The preview is stopped. Run it before inspecting it.",
            );
        }

        const tag = normalizeInspectionTag(options.tag);
        const limit = normalizeInspectionLimit(options.limit);
        const iframeWindow = getPreviewWindow(get().runtime.iframe);
        const runId = get().previewRunId;
        if (runId === null) throw new Error("The preview has no active run.");
        const requestId = createRequestId("inspection");
        const operation = createOperationSignal(
            [previewSessionController.signal, callerSignal],
            PREVIEW_CONTROL_TIMEOUT_MS,
            "Inspecting the preview timed out.",
        );

        try {
            const result = await requestSandbox(
                iframeWindow,
                {
                    type: "INSPECT_RUNTIME",
                    requestId,
                    runId,
                    tag,
                    limit,
                },
                (data): data is SandboxInspectionResultMessage =>
                    isRecord(data)
                    && data.type === "RUNTIME_INSPECTION_RESULT"
                    && data.requestId === requestId,
                operation.signal,
                PREVIEW_CONTROL_TIMEOUT_MS,
                "[game] sandbox did not return runtime inspection in time",
            );

            if (
                result.error
                || result.runId !== runId
                || !result.inspection
                || result.inspection.runId !== runId
            ) {
                throw new Error(
                    result.error
                        ?? "The sandbox did not inspect the active preview run.",
                );
            }

            set({
                previewReadiness: result.inspection.readiness,
                ...(typeof result.inspection.paused === "boolean"
                    ? { paused: result.inspection.paused }
                    : {}),
            });
            return result.inspection;
        } finally {
            operation.dispose();
        }
    },
    async exercisePreview(actions, callerSignal, expectedRunId) {
        if (get().stopped) {
            throw new Error(
                "The preview is stopped. Run it before exercising it.",
            );
        }

        const iframeWindow = getPreviewWindow(get().runtime.iframe);
        const runId = get().previewRunId;
        if (runId === null) throw new Error("The preview has no active run.");
        if (expectedRunId !== undefined && runId !== expectedRunId) {
            throw new Error("The preview run changed before the input sequence could start.");
        }
        const requestId = createRequestId("exercise");
        const operation = createOperationSignal(
            [previewSessionController.signal, callerSignal],
            PREVIEW_EXERCISE_TIMEOUT_MS,
            "Exercising the preview timed out.",
        );

        const cancelExercise = () => {
            iframeWindow.postMessage(
                { type: "CANCEL_EXERCISE", requestId, runId },
                SANDBOX_ORIGIN,
            );
        };
        operation.signal.addEventListener("abort", cancelExercise, {
            once: true,
        });

        try {
            const result = await requestSandbox(
                iframeWindow,
                {
                    type: "EXERCISE_RUNTIME",
                    requestId,
                    runId,
                    actions,
                },
                (data): data is SandboxExerciseResultMessage =>
                    isRecord(data)
                    && data.type === "RUNTIME_EXERCISE_RESULT"
                    && data.requestId === requestId,
                operation.signal,
                PREVIEW_EXERCISE_TIMEOUT_MS,
                "[game] sandbox did not complete the input sequence in time",
            );

            if (
                result.error
                || result.runId !== runId
                || !result.exercise
                || result.exercise.runId !== runId
            ) {
                throw new Error(
                    result.error
                        ?? "The sandbox did not exercise the active preview run.",
                );
            }

            set({
                previewReadiness: result.exercise.finalInspection.readiness,
                ...(typeof result.exercise.finalInspection.paused === "boolean"
                    ? { paused: result.exercise.finalInspection.paused }
                    : {}),
            });
            return result.exercise;
        } finally {
            operation.signal.removeEventListener("abort", cancelExercise);
            operation.dispose();
        }
    },
    pause() {
        if (get().stopped) {
            void get().run();
            return;
        }

        const pausePromise = get().setPaused(!(get().paused ?? false));
        void pausePromise.catch((error: unknown) => {
            if (isAbortError(error)) return;
            console.error("[game] Changing pause state failed", error);
        });
    },
    stop() {
        previewRunCoordinator.cancel();
        cancelPreviewSession("The preview was stopped.");
        clearPreviewAssetSelection();
        set({
            stopped: true,
            previewRunId: null,
            previewContentRevision: null,
            previewRuntimeFingerprint: null,
            previewReadiness: null,
            previewAssets: emptyPreviewAssets(),
            previewProjectGeneration: null,
            paused: null,
        });
    },
    updateImageDecorations() {
        debug(0, "[monaco] Updating glyph decorations");
        const { editor, monaco, glyphDecorations } = get().runtime;
        const model = editor?.getModel();

        if (!editor || !monaco || !model || !glyphDecorations) return;

        const supportedLoadTypes = ["Sprite", "SpriteAtlas", "BitmapFont"];
        const lines = model.getLinesContent() ?? [];
        const decorations: editor.IModelDeltaDecoration[] = [];

        lines.forEach((line, index) => {
            const match = [...line.matchAll(MATCH_ASSET_URL_REGEX)]?.[0];
            const url = match?.[1];
            const loadType = match?.[0]?.match(/^load(\w+)/s)?.[1] ?? "";
            if (!url || !supportedLoadTypes.includes(loadType)) return;

            const image = parseAssetPath(url, match[0]);
            const classId = `monaco-glyph-${btoa(url).replace(/=/g, "")}`;
            const className = `.monaco-glyph-margin-preview-image.${classId}`;

            if (!document.getElementById(classId)) {
                const style = document.createElement("style");
                style.id = classId;
                style.textContent =
                    `${className} { background-image: url("${image}") }`;
                document.head.appendChild(style);
            }

            decorations.push({
                range: new monaco.Range(index + 1, 1, index + 1, 1),
                options: {
                    glyphMarginClassName: className,
                    glyphMarginHoverMessage: {
                        value: `![image](${image})`,
                        isTrusted: true,
                    },
                },
            });
        });

        glyphDecorations.set(decorations);
    },
    updateModelMarkers() {
        debug(0, "[monaco] Updating glyph decorations");
        const editor = get().runtime.editor;
        const monaco = get().runtime.monaco;
        const model = editor?.getModel();

        if (!editor || !monaco || !model) return;

        const regexAdd = /add\(\[[^"]\]\)/g;

        // for each every line
        const lines = editor.getModel()?.getLinesContent() ?? [];

        let linesRange: {
            image: string;
            line: number;
        }[] = [];

        lines.forEach((line, index) => {
            const match = line.match(regexAdd);
            if (!match) return;

            const url = line.replace(regexAdd, (_, url) => {
                return url;
            });

            const normalizedUrl = url.replace(/^\/|\/$/g, "").replace(
                /"/g,
                "",
            ).replace(";", "");

            const projectAsset = useProject.getState().project.assets
                .get(
                    normalizedUrl.replace("assets/", ""),
                );

            if (projectAsset) {
                return linesRange.push({
                    image: projectAsset.url,
                    line: index + 1,
                });
            }

            linesRange.push({
                image: `http://localhost:5173/${normalizedUrl}`,
                line: index + 1,
            });
        });
    },
    showNotification(message) {
        toast(message);
    },
    setEditorValue(value) {
        const editor = get().runtime.editor;
        if (!editor) return;

        debug(
            0,
            "[editor] Setting editor value to",
            value.slice(0, 25) + "...",
        );

        editor.setValue(value);
    },
    updateEditorLastSavedValue(value) {
        set((state) => ({
            runtime: {
                ...state.runtime,
                editorLastSavedValue:
                    (value ?? get().runtime.editor?.getValue()) ?? null,
            },
        }));
    },
    updateHasUnsavedChanges() {
        set((state) => ({
            runtime: {
                ...state.runtime,
                hasUnsavedChanges: useProject.getState()
                    .hasUnsavedProjectChanges(),
            },
        }));
    },
    updateAndRun() {
        get().getRuntime().editor?.setScrollTop(0);
        get().update();
        void get().run();
    },
    focusGame() {
        const iframe = get().getRuntime().iframe;
        if (!iframe) return;

        iframe.contentWindow?.focus();
        iframe.contentWindow?.postMessage({ type: "FOCUS" }, SANDBOX_ORIGIN);
        iframe.dispatchEvent(new CustomEvent("focusiframe"));
    },
}));

function clearPreviewAssetSelection() {
    if (useWorkspace.getState().selectedAsset?.source === "runtime") {
        useWorkspace.getState().selectAsset(null);
    }
}

function waitForLayoutTick(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };
        const abort = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(signal.reason);
        };
        const animationFrame = requestAnimationFrame(finish);
        const timeout = window.setTimeout(finish, LAYOUT_POLL_INTERVAL_MS);
        const cleanup = () => {
            cancelAnimationFrame(animationFrame);
            window.clearTimeout(timeout);
            signal.removeEventListener("abort", abort);
        };

        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
    });
}

function waitForIframeReady(signal: AbortSignal): Promise<Window> {
    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("[game] iframe did not become ready in time"));
        }, PREVIEW_READY_TIMEOUT_MS);
        const abort = () => {
            cleanup();
            reject(signal.reason);
        };
        const ready = (
            {
                origin,
                data,
                source,
            }: MessageEvent<{ type?: string; protocolVersion?: number }>,
        ) => {
            if (
                origin !== SANDBOX_ORIGIN || data?.type !== "READY" || !source
            ) {
                return;
            }

            const iframe = useEditor.getState().runtime.iframe
                ?? document.querySelector<HTMLIFrameElement>("#game-view");
            if (iframe?.contentWindow !== source) return;

            if (data.protocolVersion !== PREVIEW_PROTOCOL_VERSION) {
                cleanup();
                reject(
                    new Error(
                        `[game] sandbox protocol ${PREVIEW_PROTOCOL_VERSION} is required; deploy the matching sandbox build`,
                    ),
                );
                return;
            }

            cleanup();
            resolve(source as Window);
        };
        const cleanup = () => {
            window.clearTimeout(timeout);
            window.removeEventListener("message", ready);
            signal.removeEventListener("abort", abort);
        };

        window.addEventListener("message", ready);
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
    });
}

function requestSandbox<T>(
    iframeWindow: Window,
    request: Record<string, unknown>,
    matches: (data: unknown) => data is T,
    signal: AbortSignal,
    timeoutMs: number,
    timeoutMessage: string,
): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
            finish(() =>
                reject(new DOMException(timeoutMessage, "TimeoutError"))
            );
        }, timeoutMs);
        const abort = () => {
            finish(() => reject(signal.reason ?? abortError()));
        };
        const message = (event: MessageEvent<unknown>) => {
            const data = event.data;
            if (
                event.origin !== SANDBOX_ORIGIN
                || event.source !== iframeWindow
                || !matches(data)
            ) return;

            finish(() => resolve(data));
        };
        const cleanup = () => {
            window.clearTimeout(timeout);
            window.removeEventListener("message", message);
            signal.removeEventListener("abort", abort);
        };
        const finish = (settle: () => void) => {
            if (settled) return;
            settled = true;
            cleanup();
            settle();
        };

        window.addEventListener("message", message);
        if (signal.aborted) {
            abort();
            return;
        }
        signal.addEventListener("abort", abort, { once: true });

        try {
            iframeWindow.postMessage(request, SANDBOX_ORIGIN);
        } catch (error) {
            finish(() => reject(error));
        }
    });
}

function beginPreviewSession(): AbortSignal {
    cancelPreviewSession("A newer preview run replaced this session.");
    previewSessionController = new AbortController();
    return previewSessionController.signal;
}

function cancelPreviewSession(message: string): void {
    if (previewSessionController.signal.aborted) return;
    previewSessionController.abort(new DOMException(message, "AbortError"));
}

function createOperationSignal(
    signals: Array<AbortSignal | undefined>,
    timeoutMs: number,
    timeoutMessage: string,
): { signal: AbortSignal; dispose: () => void } {
    const controller = new AbortController();
    const listeners: Array<{ signal: AbortSignal; listener: () => void }> = [];
    const abortFrom = (signal: AbortSignal) => {
        if (controller.signal.aborted) return;
        controller.abort(signal.reason ?? abortError());
    };

    for (const signal of signals) {
        if (!signal) continue;
        if (signal.aborted) {
            abortFrom(signal);
            break;
        }

        const listener = () => abortFrom(signal);
        signal.addEventListener("abort", listener, { once: true });
        listeners.push({ signal, listener });
    }

    const timeout = window.setTimeout(() => {
        if (controller.signal.aborted) return;
        controller.abort(new DOMException(timeoutMessage, "TimeoutError"));
    }, timeoutMs);

    return {
        signal: controller.signal,
        dispose() {
            window.clearTimeout(timeout);
            for (const { signal, listener } of listeners) {
                signal.removeEventListener("abort", listener);
            }
        },
    };
}

function getPreviewWindow(runtimeIframe: HTMLIFrameElement | null): Window {
    const iframe = runtimeIframe
        ?? document.querySelector<HTMLIFrameElement>("#game-view");
    if (!iframe?.isConnected || !iframe.contentWindow) {
        throw new Error(
            "The preview sandbox is not available in the current layout.",
        );
    }
    return iframe.contentWindow;
}

function normalizeInspectionTag(tag: string | undefined): string | undefined {
    if (tag === undefined) return undefined;
    if (typeof tag !== "string" || tag.length === 0 || tag.length > 128) {
        throw new RangeError("tag must contain between 1 and 128 characters.");
    }
    if (/\p{Cc}/u.test(tag)) {
        throw new RangeError("tag cannot contain control characters.");
    }
    return tag;
}

function normalizeInspectionLimit(limit: number | undefined): number {
    if (limit === undefined) return 0;
    if (
        !Number.isInteger(limit)
        || limit < 0
        || limit > MAX_PREVIEW_INSPECTION_OBJECTS
    ) {
        throw new RangeError(
            `limit must be an integer between 0 and ${MAX_PREVIEW_INSPECTION_OBJECTS}.`,
        );
    }
    return limit;
}

function createRequestId(scope: string): string {
    const randomId = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${scope}-${randomId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

function abortError(): DOMException {
    return new DOMException("The preview operation was aborted.", "AbortError");
}
