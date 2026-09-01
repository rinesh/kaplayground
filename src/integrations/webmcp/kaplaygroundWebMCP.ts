/// <reference types="webmcp-types" preserve="true" />

import { Decode } from "console-feed";
import { SANDBOX_ORIGIN } from "../../config/common";
import {
    assetBrewCatalog,
    type AssetBrewKind,
    searchAssetBrewEntries,
} from "../../data/assetBrewCatalog.ts";
import { demos, getDemo } from "../../data/demos.ts";
import { waitForPlaygroundReady } from "../../features/Projects/application/playgroundReadiness";
import type { File } from "../../features/Projects/models/File";
import { useProject } from "../../features/Projects/stores/useProject";
import { useEditor } from "../../hooks/useEditor";
import { createBoundedConsoleCapture } from "./boundedConsoleCapture";
import {
    assertGameRevision,
    gamePath,
    gameRevision,
    type GameChange,
    KAPLAYGROUND_WEBMCP_TOOL_NAMES,
    MAX_GAME_CHANGES,
    MAX_GAME_FILE_BYTES,
    prepareGameUpdate,
} from "./gameTools.ts";
import { collectMonacoDiagnostics } from "./monacoDiagnostics";
import {
    resetWebMCPActivityOnProjectReplacement,
    useWebMCPActivity,
} from "./webMCPActivity";

const MAX_RETAINED_LOGS = 500;
const MAX_FILES_PER_READ = 20;
const MAX_LISTED_FILES = 500;
const MAX_ASSET_RESULTS = 50;
const MAX_EXAMPLE_RESULTS = 100;
const MAX_CONSOLE_RESULTS = 200;
const MAX_DIAGNOSTIC_RESULTS = 200;
const MAX_PREVIEW_OBJECTS = 50;
const MAX_VISIBLE_STRING = 10_000;
const NEVER_ABORTED_SIGNAL = new AbortController().signal;

export type KaplaygroundWebMCPStatus =
    | "unsupported"
    | "registering"
    | "ready"
    | "error"
    | "destroyed";

export type KaplaygroundWebMCPInvocationStatus =
    | "running"
    | "succeeded"
    | "failed";

export interface KaplaygroundWebMCPInvocation {
    id: string;
    toolName: string;
    input: Record<string, unknown>;
    startedAt: number;
    status: KaplaygroundWebMCPInvocationStatus;
    durationMs?: number;
    error?: string;
}

export interface KaplaygroundConsoleEntry {
    timestamp: string | number;
    runId?: string | null;
    level: "debug" | "log" | "info" | "warn" | "error" | string;
    values: readonly unknown[];
}

export interface KaplaygroundConsoleCapture {
    available: boolean;
    entries: readonly KaplaygroundConsoleEntry[];
    droppedCount: number;
}

export interface KaplaygroundDiagnostic {
    path: string;
    severity: "error" | "warning" | "info" | "hint" | string;
    message: string;
    startLine: number;
    startColumn: number;
    endLine?: number;
    endColumn?: number;
    source?: string;
    code?: string | number;
}

export interface KaplaygroundDiagnosticsCapture {
    available: boolean;
    diagnostics: readonly KaplaygroundDiagnostic[];
}

type ToolName = (typeof KAPLAYGROUND_WEBMCP_TOOL_NAMES)[number];

type ToolDefinition = {
    name: ToolName;
    title: string;
    description: string;
    inputSchema: object;
    annotations?: WebMCP.ToolAnnotations;
    execute(
        input: Record<string, unknown>,
        signal: AbortSignal,
    ): Promise<unknown>;
};

/** Registers the complete KAPLAYGROUND browser-agent surface. */
export function registerKaplaygroundWebMCP(): () => void {
    const modelContext = getDocumentModelContext();
    if (!modelContext) {
        useWebMCPActivity.getState().setConnection("unsupported", []);
        return () => {
            useWebMCPActivity.getState().setConnection("destroyed", []);
        };
    }

    const context = modelContext;
    const controller = new AbortController();
    const consoleCapture = createBoundedConsoleCapture(MAX_RETAINED_LOGS);
    const registeredNames: string[] = [];
    let invocationSerial = 0;
    let transientBaselineRevision = useProject.getState().projectRevision;

    const hasUnsavedChanges = () => {
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

    useWebMCPActivity.getState().setConnection("registering", []);
    const tools = createTools(consoleCapture, hasUnsavedChanges);

    void registerTools().catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[webmcp] KAPLAYGROUND registration failed", error);
        useWebMCPActivity.getState().setConnection("error", []);
    });

    async function registerTools(): Promise<void> {
        await waitWithAbort(waitForPlaygroundReady(), controller.signal);
        for (const tool of tools) {
            throwIfAborted(controller.signal);
            await context.registerTool({
                name: tool.name,
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
                annotations: tool.annotations,
                execute: async (input, options) => {
                    const signal = options?.signal ?? NEVER_ABORTED_SIGNAL;
                    const startedAt = Date.now();
                    const invocation: KaplaygroundWebMCPInvocation = {
                        id: `${startedAt}-${++invocationSerial}`,
                        toolName: tool.name,
                        input: toRecord(input),
                        startedAt,
                        status: "running",
                    };
                    useWebMCPActivity.getState().recordInvocation(invocation);

                    try {
                        throwIfAborted(signal);
                        const result = await tool.execute(invocation.input, signal);
                        throwIfAborted(signal);
                        useWebMCPActivity.getState().recordInvocation({
                            ...invocation,
                            status: "succeeded",
                            durationMs: Date.now() - startedAt,
                        });
                        return result;
                    } catch (error) {
                        useWebMCPActivity.getState().recordInvocation({
                            ...invocation,
                            status: "failed",
                            durationMs: Date.now() - startedAt,
                            error: errorMessage(error),
                        });
                        throw error;
                    }
                },
            }, { signal: controller.signal });
            registeredNames.push(tool.name);
            useWebMCPActivity.getState().setConnection(
                "registering",
                registeredNames,
            );
        }
        useWebMCPActivity.getState().setConnection("ready", registeredNames);
    }

    return () => {
        controller.abort();
        unsubscribeProject();
        window.removeEventListener("message", handleMessage);
        useWebMCPActivity.getState().setConnection("destroyed", []);
    };
}

function createTools(
    consoleCapture: ReturnType<typeof createBoundedConsoleCapture>,
    hasUnsavedChanges: () => boolean,
): ToolDefinition[] {
    return [
        {
            name: "kaplayground_inspect_game",
            title: "Inspect the open KAPLAYGROUND game",
            description:
                "Use this before changing the game. Returns the current game, files, editor state, and one revision value required by update, run, save, and example-opening tools.",
            inputSchema: emptyObjectSchema(),
            annotations: readAnnotations(),
            execute: async (_input, signal) => {
                throwIfAborted(signal);
                const projectStore = useProject.getState();
                const editor = useEditor.getState();
                const files = [...projectStore.project.files.values()]
                    .sort((left, right) => left.path.localeCompare(right.path));
                return {
                    revision: gameRevision(projectStore),
                    name: projectStore.project.name,
                    projectId: projectStore.projectKey,
                    storage: projectStore.getProjectStorageState(),
                    kaplayVersion: projectStore.project.kaplayVersion,
                    mode: projectStore.project.mode,
                    buildMode: projectStore.project.buildMode,
                    currentFile: editor.runtime.currentFile,
                    preview: editor.stopped
                        ? "stopped"
                        : editor.paused
                        ? "paused"
                        : editor.previewRunId
                        ? "running"
                        : "unknown",
                    hasUnsavedChanges: hasUnsavedChanges(),
                    fileCount: files.length,
                    filesTruncated: files.length > MAX_LISTED_FILES,
                    files: files.slice(0, MAX_LISTED_FILES).map((file) => ({
                        path: file.path,
                        language: file.language,
                        kind: file.kind,
                        sizeBytes: utf8Size(file.value),
                    })),
                    assetCount: projectStore.project.assets.size,
                };
            },
        },
        {
            name: "kaplayground_read_files",
            title: "Read KAPLAYGROUND game files",
            description:
                "Read up to twenty exact files from the open game in one call. Use the revision from inspect_game and read every file needed for the requested change before updating.",
            inputSchema: readFilesSchema(),
            annotations: readAnnotations(),
            execute: async (input, signal) => {
                const expectedRevision = requiredString(
                    input.expectedRevision,
                    "expectedRevision",
                );
                const paths = stringArray(
                    input.paths,
                    "paths",
                    1,
                    MAX_FILES_PER_READ,
                ).map(gamePath);
                if (new Set(paths).size !== paths.length) {
                    throw new Error("paths must not contain duplicates.");
                }

                const before = useProject.getState();
                assertGameRevision(before, expectedRevision);
                const files = paths.map((path) => {
                    const file = before.project.files.get(path);
                    if (!file) throw new Error(`Game file not found: ${path}`);
                    const sizeBytes = utf8Size(file.value);
                    if (sizeBytes > MAX_GAME_FILE_BYTES) {
                        throw new Error(
                            `"${path}" is too large to read through this tool.`,
                        );
                    }
                    return {
                        path: file.path,
                        language: file.language,
                        kind: file.kind,
                        sizeBytes,
                        content: file.value,
                    };
                });
                throwIfAborted(signal);
                assertGameRevision(useProject.getState(), expectedRevision);
                return { revision: expectedRevision, files };
            },
        },
        {
            name: "kaplayground_update_game",
            title: "Update the KAPLAYGROUND game",
            description:
                "Apply all related file replacements, creations, and removals together. The update succeeds completely or changes nothing. It does not run the game; call run_game afterward with the returned revision.",
            inputSchema: updateGameSchema(),
            execute: async (input, signal) => {
                const expectedRevision = requiredString(
                    input.expectedRevision,
                    "expectedRevision",
                );
                const changes = parseGameChanges(input.changes);
                const current = useProject.getState();
                assertGameRevision(current, expectedRevision);
                const prepared = prepareGameUpdate(
                    current.project.files,
                    changes,
                );

                throwIfAborted(signal);
                assertGameRevision(useProject.getState(), expectedRevision);
                useProject.getState().setProject({
                    files: prepared.files as Map<string, File>,
                });
                synchronizeEditorModels(prepared.files, prepared.changes);

                const revision = gameRevision(useProject.getState());
                return {
                    updated: true,
                    previousRevision: expectedRevision,
                    revision,
                    changeCount: prepared.changes.length,
                    totalBytes: prepared.totalBytes,
                    changes: prepared.changes,
                    previewRan: false,
                };
            },
        },
        {
            name: "kaplayground_run_game",
            title: "Run and check the KAPLAYGROUND game",
            description:
                "Build and start the exact requested game revision, then check editor errors, console errors, and a bounded snapshot of the running scene. Use this after update_game.",
            inputSchema: runGameSchema(),
            annotations: { untrustedContentHint: true },
            execute: async (input, signal) => {
                const expectedRevision = requiredString(
                    input.expectedRevision,
                    "expectedRevision",
                );
                const inspectTag = input.inspectTag === undefined
                    ? undefined
                    : boundedString(input.inspectTag, "inspectTag", 128);
                const consoleLimit = boundedInteger(
                    input.consoleLimit,
                    "consoleLimit",
                    1,
                    MAX_CONSOLE_RESULTS,
                    50,
                );
                const objectLimit = boundedInteger(
                    input.objectLimit,
                    "objectLimit",
                    1,
                    MAX_PREVIEW_OBJECTS,
                    MAX_PREVIEW_OBJECTS,
                );

                assertGameRevision(useProject.getState(), expectedRevision);
                // Verification only concerns the run started by this call. Without
                // resetting the bounded capture, evictions from older runs would
                // make every later run look incomplete.
                consoleCapture.clear();
                let runId: string | null = null;
                try {
                    const run = await useEditor.getState().runWithSignal(signal);
                    runId = run.runId;
                } catch (error) {
                    return {
                        status: "failed",
                        revision: gameRevision(useProject.getState()),
                        runId: previewRunId(error),
                        summary: "The game could not start.",
                        error: errorMessage(error),
                        notChecked: ["Playing the controls", "Visual quality"],
                    };
                }

                if (gameRevision(useProject.getState()) !== expectedRevision) {
                    return {
                        status: "failed",
                        revision: gameRevision(useProject.getState()),
                        runId,
                        summary:
                            "The game changed while it was starting, so this run no longer matches the requested revision.",
                        notChecked: ["Playing the controls", "Visual quality"],
                    };
                }

                await settleEditor(signal);
                const projectStore = useProject.getState();
                const editor = useEditor.getState();
                const diagnosticsCapture = collectMonacoDiagnostics(
                    editor.runtime.monaco ?? undefined,
                    projectStore.project.files,
                );
                const diagnosticErrors = diagnosticsCapture.diagnostics.filter(
                    ({ severity }) => severity === "error",
                );
                const diagnostics = diagnosticsCapture.diagnostics
                    .slice(0, MAX_DIAGNOSTIC_RESULTS)
                    .map((value) => safeSerializable(value));

                const consoleSnapshot = consoleCapture.snapshot();
                const runEntries = consoleSnapshot.entries.filter((entry) =>
                    entry.runId === runId
                );
                const consoleErrors = runEntries.filter(({ level }) =>
                    level === "error"
                );
                const consoleTruncated = runEntries.length > consoleLimit;
                const consoleEntries = runEntries.slice(-consoleLimit).map((entry) => ({
                    timestamp: entry.timestamp,
                    runId: entry.runId ?? null,
                    level: entry.level,
                    values: entry.values.map((value) => safeSerializable(value)),
                }));

                let scene: Record<string, unknown> = {
                    available: false,
                    runId,
                };
                try {
                    scene = safeSerializable(
                        await useEditor.getState().inspectPreview(
                            { tag: inspectTag, limit: objectLimit },
                            signal,
                        ),
                    ) as Record<string, unknown>;
                } catch (error) {
                    scene = {
                        available: false,
                        runId,
                        error: errorMessage(error),
                    };
                }

                if (gameRevision(useProject.getState()) !== expectedRevision) {
                    return {
                        status: "failed",
                        revision: gameRevision(useProject.getState()),
                        runId,
                        summary:
                            "The game changed while checks were running, so the results are no longer current.",
                        notChecked: ["Playing the controls", "Visual quality"],
                    };
                }

                const incompleteReasons = [
                    ...!diagnosticsCapture.available
                        ? ["Editor error checking was unavailable."]
                        : [],
                    ...consoleTruncated
                        ? ["Only the newest console messages were returned."]
                        : [],
                    ...consoleSnapshot.droppedCount > 0
                        ? ["Some older console messages were no longer available."]
                        : [],
                    ...scene.available !== true
                        ? ["The running scene could not be inspected."]
                        : [],
                    ...scene.available === true && scene.runId !== runId
                        ? ["The scene snapshot belonged to a different run."]
                        : [],
                    ...scene.objectsTruncated === true
                        ? ["Only part of the running scene was inspected."]
                        : [],
                ];
                const status = diagnosticErrors.length > 0
                        || consoleErrors.length > 0
                    ? "failed"
                    : incompleteReasons.length > 0
                    ? "incomplete"
                    : "passed";

                return {
                    status,
                    revision: expectedRevision,
                    runId,
                    summary: status === "passed"
                        ? "The game started without detected code or console errors."
                        : status === "failed"
                        ? "The game started, but errors were detected."
                        : "The game started, but some checks were unavailable.",
                    diagnostics: {
                        available: diagnosticsCapture.available,
                        errorCount: diagnosticErrors.length,
                        total: diagnosticsCapture.diagnostics.length,
                        truncated:
                            diagnosticsCapture.diagnostics.length
                                > MAX_DIAGNOSTIC_RESULTS,
                        items: diagnostics,
                    },
                    console: {
                        available: consoleSnapshot.available,
                        errorCount: consoleErrors.length,
                        total: runEntries.length,
                        truncated: consoleTruncated,
                        droppedCount: consoleSnapshot.droppedCount,
                        entries: consoleEntries,
                    },
                    scene,
                    incompleteReasons,
                    notChecked: ["Playing the controls", "Visual quality"],
                };
            },
        },
        {
            name: "kaplayground_find_assets",
            title: "Find KAPLAYGROUND game assets",
            description:
                "Find matching assets already in the game and reusable items from KAPLAYGROUND's built-in library. Returns metadata and exact loader code, never binary files or hidden URLs.",
            inputSchema: findAssetsSchema(),
            annotations: readAnnotations(),
            execute: async (input, signal) => {
                const query = optionalBoundedString(input.query, "query", 120)
                    ?.toLowerCase() ?? "";
                const kind = optionalEnum(
                    input.kind,
                    "kind",
                    ["sprite", "sound", "font"] as const,
                );
                const source = optionalEnum(
                    input.source,
                    "source",
                    ["all", "game", "library"] as const,
                ) ?? "all";
                const limit = boundedInteger(
                    input.limit,
                    "limit",
                    1,
                    MAX_ASSET_RESULTS,
                    20,
                );

                const before = useProject.getState();
                const revision = gameRevision(before);
                const gameAssets = source === "library"
                    ? []
                    : [...before.project.assets.values()]
                        .filter((asset) => kind === undefined || asset.kind === kind)
                        .filter((asset) =>
                            query.length === 0
                            || `${asset.name} ${asset.path} ${asset.kind}`
                                .toLowerCase()
                                .includes(query)
                        )
                        .map((asset) => ({
                            source: "game",
                            name: asset.name,
                            path: asset.path,
                            kind: asset.kind,
                            importFunction: asset.importFunction,
                            storage: assetSource(asset.url),
                            sizeBytes: embeddedAssetSize(asset.url) ?? null,
                        }));
                const libraryAssets = source === "game"
                    ? []
                    : searchAssetBrewEntries(assetBrewCatalog, {
                        query,
                        kind: kind as AssetBrewKind | undefined,
                    }).map((asset) => ({
                        source: "library",
                        key: asset.key,
                        name: asset.name,
                        description: asset.description.slice(0, 1_000),
                        kind: asset.kind,
                        tags: asset.tags.slice(0, 30),
                        animations: asset.animations.slice(0, 50),
                        importFunction: asset.importFunction.slice(0, 2_048),
                        outlinedImportFunction:
                            asset.outlinedImportFunction?.slice(0, 2_048) ?? null,
                    }));
                const results = [...gameAssets, ...libraryAssets];
                throwIfAborted(signal);
                assertGameRevision(useProject.getState(), revision);
                return {
                    revision,
                    query: query || null,
                    kind: kind ?? null,
                    source,
                    total: results.length,
                    truncated: results.length > limit,
                    assets: results.slice(0, limit),
                };
            },
        },
        {
            name: "kaplayground_save_game",
            title: "Save the KAPLAYGROUND game",
            description:
                "Save the current game after checking that it still matches the requested revision. Temporary work becomes a saved project; existing saved projects are flushed to storage.",
            inputSchema: revisionSchema(),
            execute: async (input, signal) => {
                const expectedRevision = requiredString(
                    input.expectedRevision,
                    "expectedRevision",
                );
                assertGameRevision(useProject.getState(), expectedRevision);
                const projectId = await useProject.getState().persistActiveProject();
                throwIfAborted(signal);
                assertGameRevision(useProject.getState(), expectedRevision);
                return {
                    saved: true,
                    revision: expectedRevision,
                    projectId,
                    storage: "autosaved",
                };
            },
        },
        {
            name: "kaplayground_find_examples",
            title: "Find KAPLAYGROUND starting games",
            description:
                "Find ready-made games and examples by idea or tag when the user asks for a different starting point.",
            inputSchema: findExamplesSchema(),
            annotations: readAnnotations(),
            execute: async (input, signal) => {
                const query = optionalBoundedString(input.query, "query", 120)
                    ?.toLowerCase() ?? "";
                const tag = optionalBoundedString(input.tag, "tag", 64);
                const limit = boundedInteger(
                    input.limit,
                    "limit",
                    1,
                    MAX_EXAMPLE_RESULTS,
                    30,
                );
                const revision = gameRevision(useProject.getState());
                const examples = demos
                    .filter((example) =>
                        !tag
                        || example.tags.some(({ name }) => name === tag)
                    )
                    .filter((example) =>
                        query.length === 0
                        || `${example.key} ${example.formattedName} ${
                            example.description ?? ""
                        } ${example.tags.map(({ name }) => name).join(" ")}`
                            .toLowerCase()
                            .includes(query)
                    )
                    .map((example) => ({
                        key: example.key,
                        title: example.formattedName,
                        description: example.description,
                        tags: example.tags.map(({ name }) => name),
                    }));
                throwIfAborted(signal);
                assertGameRevision(useProject.getState(), revision);
                return {
                    revision,
                    total: examples.length,
                    truncated: examples.length > limit,
                    examples: examples.slice(0, limit),
                };
            },
        },
        {
            name: "kaplayground_open_example",
            title: "Open a KAPLAYGROUND starting game",
            description:
                "Replace the open game with one exact result from find_examples. Unsaved work is preserved unless the user explicitly approves discarding it.",
            inputSchema: openExampleSchema(),
            execute: async (input, signal) => {
                const expectedRevision = requiredString(
                    input.expectedRevision,
                    "expectedRevision",
                );
                const key = boundedString(input.key, "key", 128);
                const discardUnsavedChanges = optionalBoolean(
                    input.discardUnsavedChanges,
                    false,
                );
                assertGameRevision(useProject.getState(), expectedRevision);
                if (hasUnsavedChanges() && !discardUnsavedChanges) {
                    throw new Error(
                        "The open game has unsaved changes. Save it first, or discard it only after the user explicitly agrees.",
                    );
                }
                if (!getDemo(key)) {
                    throw new Error(
                        `Starting game not found: ${key}. Find examples again before opening one.`,
                    );
                }
                await useProject.getState().createNewProject("ex", {}, key);
                throwIfAborted(signal);
                return {
                    opened: key,
                    revision: gameRevision(useProject.getState()),
                };
            },
        },
    ];
}

function synchronizeEditorModels(
    files: ReadonlyMap<string, { value: string; language: string }>,
    changes: readonly { action: GameChange["action"]; path: string }[],
): void {
    const editorStore = useEditor.getState();
    const { monaco, currentFile } = editorStore.runtime;
    if (!monaco) return;

    for (const change of changes) {
        const uri = monaco.Uri.file(change.path);
        const model = monaco.editor.getModel(uri);
        if (change.action === "remove") {
            model?.dispose();
            if (currentFile === change.path) editorStore.setCurrentFile("main.js");
            continue;
        }

        const file = files.get(change.path);
        if (!file) continue;
        if (model) {
            if (model.getValue() !== file.value) model.setValue(file.value);
        } else {
            monaco.editor.createModel(file.value, file.language, uri);
        }
    }
}

function readFilesSchema(): object {
    return {
        type: "object",
        properties: {
            expectedRevision: revisionProperty(),
            paths: {
                type: "array",
                minItems: 1,
                maxItems: MAX_FILES_PER_READ,
                items: {
                    type: "string",
                    minLength: 1,
                    maxLength: 512,
                },
            },
        },
        required: ["expectedRevision", "paths"],
        additionalProperties: false,
    };
}

function updateGameSchema(): object {
    const path = { type: "string", minLength: 1, maxLength: 512 };
    const content = { type: "string", maxLength: MAX_GAME_FILE_BYTES };
    return {
        type: "object",
        properties: {
            expectedRevision: revisionProperty(),
            changes: {
                type: "array",
                minItems: 1,
                maxItems: MAX_GAME_CHANGES,
                items: {
                    oneOf: [
                        {
                            type: "object",
                            properties: {
                                action: { type: "string", enum: ["replace"] },
                                path,
                                content,
                            },
                            required: ["action", "path", "content"],
                            additionalProperties: false,
                        },
                        {
                            type: "object",
                            properties: {
                                action: { type: "string", enum: ["create"] },
                                path,
                                content,
                            },
                            required: ["action", "path", "content"],
                            additionalProperties: false,
                        },
                        {
                            type: "object",
                            properties: {
                                action: { type: "string", enum: ["remove"] },
                                path,
                            },
                            required: ["action", "path"],
                            additionalProperties: false,
                        },
                    ],
                },
            },
        },
        required: ["expectedRevision", "changes"],
        additionalProperties: false,
    };
}

function runGameSchema(): object {
    return {
        type: "object",
        properties: {
            expectedRevision: revisionProperty(),
            inspectTag: {
                type: "string",
                minLength: 1,
                maxLength: 128,
            },
            consoleLimit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_CONSOLE_RESULTS,
                default: 50,
            },
            objectLimit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_PREVIEW_OBJECTS,
                default: MAX_PREVIEW_OBJECTS,
            },
        },
        required: ["expectedRevision"],
        additionalProperties: false,
    };
}

function findAssetsSchema(): object {
    return {
        type: "object",
        properties: {
            query: { type: "string", maxLength: 120 },
            kind: { type: "string", enum: ["sprite", "sound", "font"] },
            source: {
                type: "string",
                enum: ["all", "game", "library"],
                default: "all",
            },
            limit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_ASSET_RESULTS,
                default: 20,
            },
        },
        additionalProperties: false,
    };
}

function findExamplesSchema(): object {
    return {
        type: "object",
        properties: {
            query: { type: "string", maxLength: 120 },
            tag: { type: "string", maxLength: 64 },
            limit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_EXAMPLE_RESULTS,
                default: 30,
            },
        },
        additionalProperties: false,
    };
}

function openExampleSchema(): object {
    return {
        type: "object",
        properties: {
            expectedRevision: revisionProperty(),
            key: { type: "string", minLength: 1, maxLength: 128 },
            discardUnsavedChanges: { type: "boolean", default: false },
        },
        required: ["expectedRevision", "key"],
        additionalProperties: false,
    };
}

function revisionSchema(): object {
    return {
        type: "object",
        properties: { expectedRevision: revisionProperty() },
        required: ["expectedRevision"],
        additionalProperties: false,
    };
}

function revisionProperty(): object {
    return {
        type: "string",
        minLength: 3,
        maxLength: 64,
        description: "Revision returned by inspect_game or update_game.",
    };
}

function emptyObjectSchema(): object {
    return { type: "object", properties: {}, additionalProperties: false };
}

function readAnnotations(): WebMCP.ToolAnnotations {
    return { readOnlyHint: true, untrustedContentHint: true };
}

function parseGameChanges(value: unknown): GameChange[] {
    if (!Array.isArray(value)) throw new TypeError("changes must be an array.");
    return value.map((item, index) => {
        const change = toRecord(item);
        const action = requiredString(change.action, `changes[${index}].action`);
        const path = requiredString(change.path, `changes[${index}].path`);
        if (action === "remove") return { action, path };
        if (action === "replace" || action === "create") {
            return {
                action,
                path,
                content: stringValue(
                    change.content,
                    `changes[${index}].content`,
                ),
            };
        }
        throw new TypeError(
            `changes[${index}].action must be replace, create, or remove.`,
        );
    });
}

function isConsoleMessage(
    value: unknown,
): value is {
    type: "CONSOLE";
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
            return new TextEncoder().encode(decodeURIComponent(data)).byteLength;
        } catch {
            return undefined;
        }
    }
    const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor(data.length * 3 / 4) - padding);
}

function previewRunId(error: unknown): string | null {
    if (typeof error !== "object" || error === null) return null;
    const value = (error as { runId?: unknown }).runId;
    return typeof value === "string" ? value : null;
}

function getDocumentModelContext(): WebMCP.ModelContext | undefined {
    return typeof document === "undefined" ? undefined : document.modelContext;
}

function toRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError("Tool input must be an object.");
    }
    return value as Record<string, unknown>;
}

function stringValue(value: unknown, name: string): string {
    if (typeof value !== "string") throw new TypeError(`${name} must be a string.`);
    return value;
}

function requiredString(value: unknown, name: string): string {
    const result = stringValue(value, name);
    if (result.length === 0) throw new TypeError(`${name} must not be empty.`);
    return result;
}

function boundedString(value: unknown, name: string, maxLength: number): string {
    const result = requiredString(value, name);
    if (result.length > maxLength) {
        throw new RangeError(`${name} must contain at most ${maxLength} characters.`);
    }
    return result;
}

function optionalBoundedString(
    value: unknown,
    name: string,
    maxLength: number,
): string | undefined {
    if (value === undefined) return undefined;
    const result = stringValue(value, name).trim();
    if (result.length > maxLength) {
        throw new RangeError(`${name} must contain at most ${maxLength} characters.`);
    }
    return result;
}

function stringArray(
    value: unknown,
    name: string,
    minimum: number,
    maximum: number,
): string[] {
    if (!Array.isArray(value)) throw new TypeError(`${name} must be an array.`);
    if (value.length < minimum || value.length > maximum) {
        throw new RangeError(
            `${name} must contain between ${minimum} and ${maximum} items.`,
        );
    }
    return value.map((item, index) => requiredString(item, `${name}[${index}]`));
}

function boundedInteger(
    value: unknown,
    name: string,
    minimum: number,
    maximum: number,
    fallback: number,
): number {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
        throw new RangeError(
            `${name} must be an integer between ${minimum} and ${maximum}.`,
        );
    }
    return Number(value);
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    if (typeof value !== "boolean") throw new TypeError("Expected a boolean.");
    return value;
}

function optionalEnum<const T extends readonly string[]>(
    value: unknown,
    name: string,
    allowed: T,
): T[number] | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !allowed.includes(value)) {
        throw new TypeError(`${name} must be one of: ${allowed.join(", ")}.`);
    }
    return value;
}

function utf8Size(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

async function settleEditor(signal: AbortSignal): Promise<void> {
    await waitForAnimationFrame(signal);
    await waitForAnimationFrame(signal);
    await waitWithAbort(
        new Promise<void>((resolve) => window.setTimeout(resolve, 50)),
        signal,
    );
}

function waitForAnimationFrame(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        throwIfAborted(signal);
        const frame = window.requestAnimationFrame(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        });
        const abort = () => {
            window.cancelAnimationFrame(frame);
            reject(abortReason(signal));
        };
        signal.addEventListener("abort", abort, { once: true });
    });
}

async function waitWithAbort<T>(
    promise: Promise<T>,
    signal: AbortSignal,
): Promise<T> {
    throwIfAborted(signal);
    return await new Promise<T>((resolve, reject) => {
        const abort = () => reject(abortReason(signal));
        signal.addEventListener("abort", abort, { once: true });
        void promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", abort);
        });
    });
}

function throwIfAborted(signal: AbortSignal): void {
    if (!signal.aborted) return;
    throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
    return signal.reason instanceof Error
        ? signal.reason
        : new DOMException("The operation was cancelled.", "AbortError");
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function safeSerializable(
    value: unknown,
    depth = 0,
    seen = new WeakSet<object>(),
): unknown {
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") {
        return value.length <= MAX_VISIBLE_STRING
            ? value
            : `${value.slice(0, MAX_VISIBLE_STRING)}…[truncated]`;
    }
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "bigint") return value.toString();
    if (typeof value !== "object") return String(value);
    if (depth >= 5 || seen.has(value)) return "[bounded]";
    seen.add(value);
    if (Array.isArray(value)) {
        return value.slice(0, 100).map((item) =>
            safeSerializable(item, depth + 1, seen)
        );
    }
    return Object.fromEntries(
        Object.entries(value).slice(0, 100).map(([key, item]) => [
            key,
            safeSerializable(item, depth + 1, seen),
        ]),
    );
}
