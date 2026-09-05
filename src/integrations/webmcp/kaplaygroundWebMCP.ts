/// <reference types="webmcp-types" preserve="true" />

import {
    parsePreviewExerciseActions,
    PREVIEW_PROTOCOL_VERSION,
} from "../../../shared/previewProtocol.ts";

import {
    assetBrewCatalog,
    type AssetBrewKind,
    searchAssetBrewEntries,
} from "../../data/assetBrewCatalog.ts";
import { demos, getDemo } from "../../data/demos.ts";
import { matchesGameAsset } from "../../data/gameAssetSearch";
import {
    compareStartingPoints,
    matchesStartingPoint,
} from "../../data/startingPoints";
import { waitForPlaygroundReady } from "../../features/Projects/application/playgroundReadiness";
import { validateProjectName } from "../../features/Projects/application/validateProjectName";
import { getVersion } from "../../util/compiler";
import type { File } from "../../features/Projects/models/File";
import { useProject } from "../../features/Projects/stores/useProject";
import { useEditor } from "../../hooks/useEditor";
import { gameConsoleCapture } from "../../hooks/useGameConsole";
import { useWorkspace } from "../../hooks/useWorkspace";
import { confirm } from "../../util/confirm";
import type { BoundedConsoleCapture } from "./boundedConsoleCapture";
import {
    assertGameRevision,
    classifyGameRun,
    createSerialTaskQueue,
    type GameChange,
    gamePath,
    gameReadSize,
    gameRevision,
    type KaplaygroundToolName,
    kaplaygroundToolSurface,
    MAX_ASSET_RESULTS,
    MAX_CONSOLE_RESULTS,
    MAX_EXAMPLE_RESULTS,
    MAX_FILES_PER_READ,
    MAX_LISTED_FILES,
    MAX_PREVIEW_OBJECTS,
    MAX_RESULT_OFFSET,
    prepareGameUpdate,
    registerGameToolDefinitions,
    requiresExampleDiscardConfirmation,
} from "./gameTools.ts";
import {
    KAPLAYGROUND_BUILD_IDENTITY,
    engineRuntimeIdentity,
} from "./buildIdentity";
import {
    assertGameContentRevision,
    gameContentRevision,
    gameProjectFingerprint,
    gameRuntimeFingerprint,
} from "./gameIdentity";
import {
    KaplaygroundToolError,
    normalizeToolError,
    toolErrorCode,
    withToolResultEnvelope,
} from "./toolResults";
import {
    calculateSpriteFrameDimensions,
    readImageDimensions,
    spriteFrameGridFromLoader,
} from "./imageDimensions";
import { collectMonacoDiagnostics } from "./monacoDiagnostics";
import { useWebMCPActivity } from "./webMCPActivity";

const MAX_DIAGNOSTIC_RESULTS = 200;
const MAX_VISIBLE_STRING = 10_000;
const MAX_PROJECT_NAME_LENGTH = 120;
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
    errorCode?: string;
    result?: Record<string, unknown>;
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
    sourcePath: string | null;
    sourceCurrent: boolean;
    diagnostics: readonly KaplaygroundDiagnostic[];
}

type ToolName = KaplaygroundToolName;

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
    const consoleCapture = gameConsoleCapture;
    const registeredNames: string[] = [];
    let invocationSerial = 0;
    let cleanedUp = false;

    const hasUnsavedChanges = () =>
        useProject.getState().hasUnsavedProjectChanges();

    useWebMCPActivity.getState().setConnection("registering", []);
    const tools = createTools(consoleCapture, hasUnsavedChanges);

    void registerTools().catch((error: unknown) => {
        if (cleanedUp) return;
        console.error("[webmcp] KAPLAYGROUND registration failed", error);
        cleanup("error");
    });

    function cleanup(status: "error" | "destroyed"): void {
        if (!controller.signal.aborted) controller.abort();
        if (!cleanedUp) {
            cleanedUp = true;
        }
        registeredNames.length = 0;
        useWebMCPActivity.getState().setConnection(status, []);
    }

    async function registerTools(): Promise<void> {
        await waitWithAbort(waitForPlaygroundReady(), controller.signal);
        const definitions = tools.map((tool): WebMCP.ModelContextTool => ({
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
                    const rawResult = await tool.execute(
                        invocation.input,
                        signal,
                    );
                    const result = withToolResultEnvelope(
                        tool.name,
                        rawResult,
                    );
                    useWebMCPActivity.getState().recordInvocation({
                        ...invocation,
                        status: "succeeded",
                        durationMs: Date.now() - startedAt,
                        result,
                    });
                    return result;
                } catch (error) {
                    const normalized = normalizeToolError(error, tool.name);
                    useWebMCPActivity.getState().recordInvocation({
                        ...invocation,
                        status: "failed",
                        durationMs: Date.now() - startedAt,
                        error: errorMessage(normalized),
                        errorCode: toolErrorCode(normalized),
                    });
                    throw normalized;
                }
            },
        }));
        await registerGameToolDefinitions(
            context,
            definitions,
            controller,
            (name) => {
                registeredNames.push(name);
                useWebMCPActivity.getState().setConnection(
                    "registering",
                    registeredNames,
                );
            },
        );
        if (!controller.signal.aborted) {
            useWebMCPActivity.getState().setConnection(
                "ready",
                registeredNames,
            );
        }
    }

    return () => {
        cleanup("destroyed");
    };
}

function createTools(
    consoleCapture: BoundedConsoleCapture,
    hasUnsavedChanges: () => boolean,
): ToolDefinition[] {
    const projectMutations = createSerialTaskQueue();

    return [
        {
            ...kaplaygroundToolSurface("kaplayground_inspect_game"),
            execute: async (input, signal) => {
                throwIfAborted(signal);
                const fileOffset = boundedInteger(
                    input.fileOffset,
                    "fileOffset",
                    0,
                    MAX_RESULT_OFFSET,
                    0,
                );
                const fileLimit = boundedInteger(
                    input.fileLimit,
                    "fileLimit",
                    1,
                    MAX_LISTED_FILES,
                    MAX_LISTED_FILES,
                );
                const projectStore = useProject.getState();
                const editor = useEditor.getState();
                const identity = currentGameIdentity(projectStore);
                const files = [...projectStore.project.files.values()]
                    .sort((left, right) => left.path.localeCompare(right.path));
                const filePage = files.slice(
                    fileOffset,
                    fileOffset + fileLimit,
                );
                const nextFileOffset =
                    fileOffset + filePage.length < files.length
                        ? fileOffset + filePage.length
                        : null;
                return {
                    revision: identity.revision,
                    contentRevision: identity.contentRevision,
                    runtimeFingerprint: identity.runtimeFingerprint,
                    buildIdentity: KAPLAYGROUND_BUILD_IDENTITY,
                    engine: identity.engine,
                    previewProtocolVersion: PREVIEW_PROTOCOL_VERSION,
                    name: projectStore.project.name,
                    projectId: projectStore.projectKey,
                    storage: projectStore.getProjectStorageState(),
                    saveStatus: projectStore.saveStatus,
                    editorVisible: useWorkspace.getState().activeTab === "code"
                        && useWorkspace.getState().visiblePanels.tools,
                    selectedAsset: boundedSelectedAsset(),
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
                    activeRunId: editor.previewRunId,
                    activeRunIdentity: {
                        contentRevision: editor.previewContentRevision,
                        runtimeFingerprint: editor.previewRuntimeFingerprint,
                    },
                    readiness: editor.previewReadiness,
                    hasUnsavedChanges: hasUnsavedChanges(),
                    fileCount: files.length,
                    fileOffset,
                    fileLimit,
                    filesTruncated: nextFileOffset !== null,
                    nextFileOffset,
                    files: filePage.map((file) => ({
                        path: file.path,
                        language: file.language,
                        kind: file.kind,
                        sizeBytes: utf8Size(file.value),
                    })),
                    assetCount: projectStore.project.assets.size,
                    loadedAssets: {
                        available:
                            editor.previewProjectGeneration
                                === projectStore.projectGeneration
                            && editor.previewAssets.available,
                        truncated:
                            editor.previewProjectGeneration
                                === projectStore.projectGeneration
                            && editor.previewAssets.truncated,
                        assets:
                            editor.previewProjectGeneration
                                    === projectStore.projectGeneration
                                ? editor.previewAssets.assets.map((
                                    { name, kind },
                                ) => ({ name, kind }))
                                : [],
                    },
                };
            },
        },
        {
            ...kaplaygroundToolSurface("kaplayground_read_files"),
            execute: async (input, signal) => {
                const expected = expectedExecutableIdentity(input, false);
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
                assertExpectedExecutableIdentity(before, expected);
                const selectedFiles = paths.map((path) => {
                    const file = before.project.files.get(path);
                    if (!file) throw new Error(`Game file not found: ${path}`);
                    return file;
                });
                const totalBytes = gameReadSize(selectedFiles);
                const files = selectedFiles.map((file) => {
                    const sizeBytes = utf8Size(file.value);
                    return {
                        path: file.path,
                        language: file.language,
                        kind: file.kind,
                        sizeBytes,
                        content: file.value,
                    };
                });
                throwIfAborted(signal);
                const after = useProject.getState();
                assertExpectedExecutableIdentity(after, expected);
                const identity = currentGameIdentity(after);
                return {
                    revision: identity.revision,
                    contentRevision: identity.contentRevision,
                    runtimeFingerprint: identity.runtimeFingerprint,
                    totalBytes,
                    files,
                };
            },
        },
        {
            ...kaplaygroundToolSurface("kaplayground_update_game"),
            execute: async (input, signal) => {
                return await projectMutations.run(async () => {
                    throwIfAborted(signal);
                    const expected = expectedExecutableIdentity(input, false);
                    const changes = parseGameChanges(input.changes);
                    const focusPath = input.focusPath === undefined
                        ? undefined
                        : gamePath(
                            requiredString(input.focusPath, "focusPath"),
                        );
                    const current = useProject.getState();
                    assertExpectedExecutableIdentity(current, expected);
                    const previousIdentity = currentGameIdentity(current);
                    const prepared = prepareGameUpdate(
                        current.project.files,
                        changes,
                    );
                    if (focusPath && !prepared.files.has(focusPath)) {
                        throw new Error(
                            `The focus file does not exist after this update: ${focusPath}`,
                        );
                    }

                    throwIfAborted(signal);
                    assertExpectedExecutableIdentity(
                        useProject.getState(),
                        expected,
                    );
                    useProject.getState().setProject({
                        files: prepared.files as Map<string, File>,
                    });
                    const editorSync = synchronizeEditorModels(
                        prepared.files,
                        prepared.changes,
                        focusPath,
                    );

                    const identity = currentGameIdentity();
                    return {
                        updated: true,
                        committed: true,
                        previousRevision: previousIdentity.revision,
                        previousContentRevision:
                            previousIdentity.contentRevision,
                        revision: identity.revision,
                        contentRevision: identity.contentRevision,
                        runtimeFingerprint: identity.runtimeFingerprint,
                        changeCount: prepared.changes.length,
                        totalBytes: prepared.totalBytes,
                        changes: prepared.changes,
                        focusPath: focusPath ?? null,
                        editorSync,
                        previewRan: false,
                    };
                });
            },
        },
        {
            ...kaplaygroundToolSurface("kaplayground_run_game"),
            execute: async (input, signal) => {
                const expected = expectedExecutableIdentity(input, true);
                const mode = optionalEnum(
                    input.mode,
                    "mode",
                    ["restart-and-check", "check-current"] as const,
                ) ?? "restart-and-check";
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
                const focusRequested = optionalBoolean(input.focus, false);
                const actions = input.actions === undefined
                    ? null
                    : parsePreviewExerciseActions(input.actions);

                const requestedState = useProject.getState();
                assertExpectedExecutableIdentity(requestedState, expected);
                const requestedIdentity = currentGameIdentity(requestedState);
                if (
                    expected.expectedRuntimeFingerprint !== undefined
                    && mode === "restart-and-check"
                    && expected.expectedRuntimeFingerprint
                        !== requestedIdentity.runtimeFingerprint
                ) {
                    throw new KaplaygroundToolError(
                        "STALE_RUNTIME_FINGERPRINT",
                        `The requested runtime fingerprint ${expected.expectedRuntimeFingerprint} does not match the current executable runtime ${requestedIdentity.runtimeFingerprint}. Inspect the game again before restarting it.`,
                        {
                            retryable: true,
                            details: {
                                expectedRuntimeFingerprint:
                                    expected.expectedRuntimeFingerprint,
                                actualRuntimeFingerprint:
                                    requestedIdentity.runtimeFingerprint,
                            },
                        },
                    );
                }

                let runId: string | null = null;
                let runReadiness: unknown = null;
                if (mode === "restart-and-check") {
                    // Verification only concerns the run started by this call.
                    // Resetting prevents evictions from older runs making every
                    // later run look incomplete.
                    consoleCapture.clear();
                    try {
                        const run = await useEditor.getState().runWithSignal(
                            signal,
                        );
                        runId = run.runId;
                        runReadiness = run.readiness;
                    } catch (error) {
                        if (signal.aborted) throw abortReason(signal);
                        return failedRunResult({
                            mode,
                            identity: currentGameIdentity(),
                            runId: previewRunId(error),
                            readiness: null,
                            focusRequested,
                            summary: "The game could not start.",
                            error: errorMessage(error),
                            notChecked: [
                                "Playing the controls",
                                "Visual quality",
                            ],
                        });
                    }

                    const currentIdentity = currentGameIdentity();
                    if (
                        currentIdentity.contentRevision
                            !== requestedIdentity.contentRevision
                        || currentIdentity.runtimeFingerprint
                            !== requestedIdentity.runtimeFingerprint
                        || useEditor.getState().previewRunId !== runId
                    ) {
                        return failedRunResult({
                            mode,
                            identity: currentIdentity,
                            runId,
                            readiness: runReadiness,
                            focusRequested,
                            summary:
                                "The executable game or active preview changed while starting, so this run can no longer be verified.",
                            notChecked: [
                                "Playing the controls",
                                "Visual quality",
                            ],
                        });
                    }
                    useEditor.setState({
                        previewContentRevision:
                            requestedIdentity.contentRevision,
                        previewRuntimeFingerprint:
                            requestedIdentity.runtimeFingerprint,
                    });
                } else {
                    const editor = useEditor.getState();
                    runId = editor.previewRunId;
                    runReadiness = editor.previewReadiness;
                    if (editor.stopped || runId === null) {
                        return failedRunResult({
                            mode,
                            identity: requestedIdentity,
                            runId: null,
                            readiness: runReadiness,
                            focusRequested,
                            summary:
                                "There is no current game run to inspect. Restart and check the game first.",
                            notChecked: [
                                "Playing the controls",
                                "Visual quality",
                            ],
                        });
                    }
                    if (
                        editor.previewContentRevision !== null
                        && editor.previewContentRevision
                            !== requestedIdentity.contentRevision
                    ) {
                        return failedRunResult({
                            mode,
                            identity: requestedIdentity,
                            runId,
                            readiness: runReadiness,
                            focusRequested,
                            summary:
                                "The current game run belongs to older executable content. Restart it before checking this content revision.",
                            runIdentity: {
                                contentRevision:
                                    editor.previewContentRevision,
                                runtimeFingerprint:
                                    editor.previewRuntimeFingerprint,
                            },
                            notChecked: [
                                "Playing the controls",
                                "Visual quality",
                            ],
                        });
                    }
                    if (
                        expected.expectedRuntimeFingerprint !== undefined
                        && editor.previewRuntimeFingerprint
                            !== expected.expectedRuntimeFingerprint
                    ) {
                        return failedRunResult({
                            mode,
                            identity: requestedIdentity,
                            runId,
                            readiness: runReadiness,
                            focusRequested,
                            summary:
                                "The current game run does not match the requested runtime fingerprint. Restart it before checking this runtime.",
                            runIdentity: {
                                contentRevision:
                                    editor.previewContentRevision,
                                runtimeFingerprint:
                                    editor.previewRuntimeFingerprint,
                            },
                            notChecked: [
                                "Playing the controls",
                                "Visual quality",
                            ],
                        });
                    }
                }

                if (focusRequested) useEditor.getState().focusGame();
                await settleEditor(signal);

                let gameplay: Record<string, unknown> | null = null;
                let gameplayError: string | null = null;
                let scene: Record<string, unknown> = {
                    available: false,
                    runId,
                    readiness: runReadiness,
                };
                if (actions !== null) {
                    try {
                        const exercised = await useEditor.getState()
                            .exercisePreview(actions, signal, runId);
                        gameplay = {
                            runId: exercised.runId,
                            inputProvenance: exercised.inputProvenance,
                            actionCount: exercised.actionCount,
                            inputActionCount: exercised.inputActionCount,
                            checkpointCount: exercised.checkpointCount,
                            assertionCount: exercised.assertionCount,
                            unassertedInputActionCount: exercised.unassertedInputActionCount,
                            incompleteReasons: exercised.incompleteReasons,
                            passed: exercised.passed,
                            checkpoints: exercised.checkpoints.map(checkpoint => ({
                                name: checkpoint.name,
                                passed: checkpoint.passed,
                                checks: checkpoint.checks.map(check => safeSerializable(check)),
                                inspection: safeSerializable(checkpoint.inspection),
                            })),
                            finalInspection: safeSerializable(exercised.finalInspection),
                        };
                    } catch (error) {
                        if (signal.aborted) throw abortReason(signal);
                        gameplayError = errorMessage(error);
                        gameplay = {
                            available: false,
                            error: gameplayError,
                        };
                    }
                }
                try {
                    scene = safeSerializable(
                        await useEditor.getState().inspectPreview(
                            { tag: inspectTag, limit: objectLimit },
                            signal,
                        ),
                    ) as Record<string, unknown>;
                } catch (error) {
                    if (signal.aborted) throw abortReason(signal);
                    scene = {
                        available: false,
                        runId,
                        readiness: runReadiness,
                        error: errorMessage(error),
                    };
                }

                // Scene inspection can execute object getters and component methods.
                // Let their asynchronous console messages arrive before sampling.
                await settleEditor(signal);
                const projectStore = useProject.getState();
                const editor = useEditor.getState();
                const diagnosticsCapture = await waitWithAbort(
                    collectMonacoDiagnostics(
                        editor.runtime.monaco ?? undefined,
                        projectStore.project.files,
                        editor.runtime.currentFile,
                    ),
                    signal,
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
                const consoleEntries = runEntries.slice(-consoleLimit).map((
                    entry,
                ) => ({
                    timestamp: entry.timestamp,
                    runId: entry.runId ?? null,
                    level: entry.level,
                    values: entry.values.map((value) =>
                        safeSerializable(value)
                    ),
                }));

                const currentIdentity = currentGameIdentity();
                const currentEditor = useEditor.getState();
                if (
                    currentIdentity.contentRevision
                        !== requestedIdentity.contentRevision
                    || currentIdentity.runtimeFingerprint
                        !== requestedIdentity.runtimeFingerprint
                    || currentEditor.stopped
                    || currentEditor.previewRunId !== runId
                ) {
                    return failedRunResult({
                        mode,
                        identity: currentIdentity,
                        runId,
                        readiness: scene.readiness ?? runReadiness,
                        focusRequested,
                        canvasFocused: scene.canvasFocused === true,
                        summary:
                            "The executable game or active preview changed while checks were running, so the results are no longer current.",
                        notChecked: runNotChecked(gameplay),
                    });
                }

                const readiness = scene.readiness ?? runReadiness;
                const incompleteReasons: string[] = [];
                if (
                    mode === "check-current"
                    && editor.previewRuntimeFingerprint === null
                ) {
                    incompleteReasons.push(
                        "The current run was not started by a verified browser-agent check, so its runtime fingerprint could not be confirmed.",
                    );
                }
                if (!diagnosticsCapture.available) {
                    incompleteReasons.push(
                        "Editor error checking was unavailable.",
                    );
                } else if (!diagnosticsCapture.sourceCurrent) {
                    incompleteReasons.push(
                        "Editor diagnostics did not match the current source file.",
                    );
                }
                if (!consoleSnapshot.available) {
                    incompleteReasons.push(
                        "Run-specific console capture was unavailable.",
                    );
                }
                if (consoleTruncated) {
                    incompleteReasons.push(
                        "Only the newest console messages were returned.",
                    );
                }
                if (consoleSnapshot.droppedCount > 0) {
                    incompleteReasons.push(
                        "Some older console messages were no longer available.",
                    );
                }
                if (!isReadyEvidence(readiness)) {
                    incompleteReasons.push(
                        readinessIncompleteReason(readiness),
                    );
                }
                if (scene.available !== true) {
                    incompleteReasons.push(
                        "The running scene could not be inspected.",
                    );
                }
                if (scene.available === true && scene.runId !== runId) {
                    incompleteReasons.push(
                        "The scene snapshot belonged to a different run.",
                    );
                }
                if (scene.objectsAvailable !== true) {
                    incompleteReasons.push(
                        "The running scene objects could not be inspected.",
                    );
                }
                if (scene.objectsTruncated === true) {
                    incompleteReasons.push(
                        "Only part of the running scene was inspected.",
                    );
                }
                const inputWasRequested = actions?.some(action =>
                    action.type !== "checkpoint" && action.type !== "wait"
                ) ?? false;
                if (
                    (focusRequested || inputWasRequested)
                    && scene.canvasFocused !== true
                ) {
                    incompleteReasons.push(
                        "The preview canvas did not confirm keyboard focus.",
                    );
                }
                if (gameplayError) {
                    incompleteReasons.push(
                        `The requested gameplay sequence could not be completed. ${gameplayError}`,
                    );
                }
                if (Array.isArray(gameplay?.incompleteReasons)) {
                    incompleteReasons.push(...gameplay.incompleteReasons.filter(
                        (reason): reason is string => typeof reason === "string",
                    ));
                }
                if (
                    gameplay
                    && Number(gameplay.unassertedInputActionCount) > 0
                ) {
                    incompleteReasons.push(
                        "Some controls were sent without a later checkpoint asserting a game-state result.",
                    );
                }
                const failedGameplayCheckpoints = gameplay
                    && Array.isArray(gameplay.checkpoints)
                    ? gameplay.checkpoints.filter((checkpoint) =>
                        typeof checkpoint === "object"
                        && checkpoint !== null
                        && (checkpoint as Record<string, unknown>).passed
                            === false
                    ).length
                    : 0;
                const status = classifyGameRun(
                    diagnosticErrors.length,
                    consoleErrors.length,
                    incompleteReasons,
                    failedGameplayCheckpoints,
                );

                return {
                    status,
                    mode,
                    revision: currentIdentity.revision,
                    contentRevision: requestedIdentity.contentRevision,
                    runtimeFingerprint:
                        requestedIdentity.runtimeFingerprint,
                    runId,
                    readiness: safeSerializable(readiness),
                    focus: {
                        requested: focusRequested || inputWasRequested,
                        canvasFocused: scene.canvasFocused === true,
                    },
                    summary: status === "passed"
                        ? gameplay && Number(gameplay.assertionCount) > 0
                            ? "The game loaded, has no detected code or console errors, and every requested gameplay checkpoint passed."
                            : mode === "restart-and-check"
                            ? "The game loaded its assets, rendered a frame, and has no detected code or console errors."
                            : "The current game run is ready and has no detected code or console errors."
                        : status === "failed"
                        ? "The game run or a requested gameplay checkpoint has detected errors."
                        : "The game run was checked, but some evidence was unavailable or not ready.",
                    diagnostics: {
                        available: diagnosticsCapture.available,
                        sourcePath: diagnosticsCapture.sourcePath,
                        sourceCurrent: diagnosticsCapture.sourceCurrent,
                        errorCount: diagnosticErrors.length,
                        total: diagnosticsCapture.diagnostics.length,
                        truncated: diagnosticsCapture.diagnostics.length
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
                    gameplay,
                    scene,
                    incompleteReasons,
                    notChecked: runNotChecked(gameplay),
                };
            },
        },
        {
            ...kaplaygroundToolSurface("kaplayground_find_assets"),
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
                const offset = boundedInteger(
                    input.offset,
                    "offset",
                    0,
                    MAX_RESULT_OFFSET,
                    0,
                );

                const before = useProject.getState();
                const revision = gameRevision(before);
                const preview = useEditor.getState();
                const loadedAssets =
                    preview.previewProjectGeneration
                            === before.projectGeneration
                        ? preview.previewAssets.assets
                        : [];
                const descriptors: Array<{
                    asset: Record<string, unknown> & { kind: string };
                    imageSource: string | null;
                    frameGrid: { columns: number; rows: number } | null;
                }> = [];

                if (source !== "library") {
                    for (const asset of before.project.assets.values()) {
                        if (!matchesGameAsset(asset, query, kind)) continue;
                        descriptors.push({
                            asset: {
                                source: "game",
                                name: asset.name.slice(0, 256),
                                path: asset.path.slice(0, 512),
                                kind: asset.kind,
                                loaded: loadedAssets.some(loaded =>
                                    loaded.name === asset.name
                                    && loaded.kind === asset.kind
                                    && loaded.url === asset.url
                                ),
                                importFunction: asset.importFunction.slice(
                                    0,
                                    2_048,
                                ),
                                storage: assetSource(asset.url),
                                sizeBytes: embeddedAssetSize(asset.url) ?? null,
                            },
                            imageSource: asset.kind === "sprite"
                                ? asset.url
                                : null,
                            frameGrid: asset.kind === "sprite"
                                ? spriteFrameGridFromLoader(
                                    asset.importFunction,
                                )
                                : null,
                        });
                    }
                    for (const asset of loadedAssets) {
                        if (!matchesGameAsset(asset, query, kind)) continue;
                        if (
                            descriptors.some(({ asset: entry }) =>
                                entry.loaded === true
                                && entry.name === asset.name
                                && entry.kind === asset.kind
                            )
                        ) continue;
                        descriptors.push({
                            asset: {
                                source: "game",
                                name: asset.name,
                                kind: asset.kind,
                                loaded: true,
                            },
                            imageSource: null,
                            frameGrid: null,
                        });
                    }
                }

                if (source !== "game") {
                    for (
                        const asset of searchAssetBrewEntries(
                            assetBrewCatalog,
                            {
                                query,
                                kind: kind as AssetBrewKind | undefined,
                            },
                        )
                    ) {
                        descriptors.push({
                            asset: {
                                source: "library",
                                key: asset.key,
                                name: asset.name,
                                description: asset.description.slice(0, 1_000),
                                kind: asset.kind,
                                tags: asset.tags.slice(0, 30),
                                animations: asset.animations.slice(0, 50),
                                importFunction: asset.importFunction.slice(
                                    0,
                                    2_048,
                                ),
                                outlinedImportFunction:
                                    asset.outlinedImportFunction?.slice(
                                        0,
                                        2_048,
                                    ) ?? null,
                            },
                            imageSource: asset.imageSource ?? null,
                            frameGrid: asset.spriteFrameGrid ?? null,
                        });
                    }
                }

                const descriptorPage = descriptors.slice(
                    offset,
                    offset + limit,
                );
                const page = await Promise.all(descriptorPage.map(
                    async ({ asset, imageSource, frameGrid }) => {
                        const imageDimensions = imageSource
                            ? await readImageDimensions(imageSource, signal)
                            : null;
                        return {
                            ...asset,
                            imageDimensions,
                            spriteFrameGrid: asset.kind === "sprite"
                                ? frameGrid
                                : null,
                            spriteFrameDimensions: asset.kind === "sprite"
                                ? calculateSpriteFrameDimensions(
                                    imageDimensions,
                                    frameGrid,
                                )
                                : null,
                        };
                    },
                ));
                const nextOffset = offset + page.length < descriptors.length
                    ? offset + page.length
                    : null;
                throwIfAborted(signal);
                assertGameRevision(useProject.getState(), revision);
                return {
                    revision,
                    query: query || null,
                    kind: kind ?? null,
                    source,
                    activeRunId: preview.previewRunId,
                    loadedAssetsAvailable:
                        preview.previewProjectGeneration
                            === before.projectGeneration
                        && preview.previewAssets.available,
                    loadedAssetsTruncated:
                        preview.previewProjectGeneration
                            === before.projectGeneration
                        && preview.previewAssets.truncated,
                    total: descriptors.length,
                    offset,
                    limit,
                    truncated: nextOffset !== null,
                    nextOffset,
                    assets: page,
                };
            },
        },
        {
            ...kaplaygroundToolSurface("kaplayground_save_game"),
            execute: async (input, signal) => {
                return await projectMutations.run(async () => {
                    const expectedRevision = requiredString(
                        input.expectedRevision,
                        "expectedRevision",
                    );
                    const requestedName = input.name === undefined
                        ? undefined
                        : projectName(input.name);
                    const before = useProject.getState();
                    assertGameRevision(before, expectedRevision);
                    throwIfAborted(signal);

                    if (
                        requestedName !== undefined
                        && requestedName !== before.project.name
                    ) {
                        const [valid, validationMessage] =
                            await validateProjectName(
                                requestedName,
                                before.projectKey,
                            );
                        throwIfAborted(signal);
                        assertGameRevision(
                            useProject.getState(),
                            expectedRevision,
                        );
                        if (!valid) {
                            throw new KaplaygroundToolError(
                                "INVALID_PROJECT_NAME",
                                validationMessage
                                    ?? "The requested project name is invalid.",
                                { retryable: true },
                            );
                        }
                        useProject.getState().setProject({
                            name: requestedName,
                        });
                    }

                    const renamedRevision = gameRevision(useProject.getState());
                    const projectId = await useProject.getState()
                        .persistActiveProject();
                    // Persistence is committed once the write resolves. Complete
                    // read-back instead of reporting a canceled failure afterward.
                    const saved = useProject.getState();
                    const persisted = await saved.getProject(projectId);
                    const expectedHash = gameProjectFingerprint(saved.project);
                    const persistedHash = gameProjectFingerprint(persisted);
                    const readbackVerified = expectedHash === persistedHash;
                    if (!readbackVerified) {
                        throw new KaplaygroundToolError(
                            "SAVE_READBACK_MISMATCH",
                            "Browser storage acknowledged the save, but the stored project did not match the active project.",
                            {
                                retryable: true,
                                details: {
                                    projectId,
                                    expectedHash,
                                    persistedHash,
                                    writeAcknowledged: true,
                                    readbackVerified: false,
                                },
                            },
                        );
                    }
                    const identity = currentGameIdentity(saved);
                    const savedAt = new Date().toISOString();
                    return {
                        saved: true,
                        committed: true,
                        previousRevision: expectedRevision,
                        revision: identity.revision,
                        contentRevision: identity.contentRevision,
                        runtimeFingerprint: identity.runtimeFingerprint,
                        name: saved.project.name,
                        projectId,
                        storage: "autosaved",
                        renamed: renamedRevision !== expectedRevision,
                        writeAcknowledged: true,
                        readbackVerified,
                        persistedHash,
                        savedAt,
                    };
                });
            },
        },
        {
            ...kaplaygroundToolSurface("kaplayground_find_examples"),
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
                const offset = boundedInteger(
                    input.offset,
                    "offset",
                    0,
                    MAX_RESULT_OFFSET,
                    0,
                );
                const revision = gameRevision(useProject.getState());
                const examples = demos
                    .filter((example) =>
                        !tag
                        || example.tags.some(({ name }) => name === tag)
                    )
                    .filter(example => matchesStartingPoint(example, query))
                    .sort(compareStartingPoints)
                    .map((example) => ({
                        key: example.key,
                        title: example.formattedName,
                        description: example.description?.slice(0, 1_000)
                            ?? null,
                        tags: example.tags.slice(0, 30).map(({ name }) => name),
                    }));
                const page = examples.slice(offset, offset + limit);
                const nextOffset = offset + page.length < examples.length
                    ? offset + page.length
                    : null;
                throwIfAborted(signal);
                assertGameRevision(useProject.getState(), revision);
                return {
                    revision,
                    total: examples.length,
                    offset,
                    limit,
                    truncated: nextOffset !== null,
                    nextOffset,
                    examples: page,
                };
            },
        },
        {
            ...kaplaygroundToolSurface("kaplayground_open_example"),
            execute: async (input, signal) => {
                return await projectMutations.run(async () => {
                    throwIfAborted(signal);
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
                    const example = getDemo(key);
                    if (!example) {
                        throw new Error(
                            `Starting point not found: ${key}. Find starting points again before opening one.`,
                        );
                    }

                    if (hasUnsavedChanges()) {
                        try {
                            await useProject.getState().persistActiveProject();
                        } catch {
                            // Failed edits stay pending; only the page's explicit
                            // discard confirmation may allow replacement below.
                        }
                        throwIfAborted(signal);
                        assertGameRevision(
                            useProject.getState(),
                            expectedRevision,
                        );
                    }

                    if (
                        requiresExampleDiscardConfirmation(
                            hasUnsavedChanges(),
                            discardUnsavedChanges,
                        )
                    ) {
                        let approved: boolean;
                        try {
                            approved = await waitWithAbort(
                                confirm(
                                    `Open ${example.formattedName}?`,
                                    "This replaces the open game and discards its unsaved changes. The page requires your confirmation before continuing.",
                                    {
                                        type: "warning",
                                        confirmText: "Discard and open",
                                        dismissText: "Keep my game",
                                        cancelImmediate: true,
                                    },
                                ),
                                signal,
                            );
                        } catch (error) {
                            document.querySelector<HTMLDialogElement>(
                                "#confirm-dialog",
                            )?.close();
                            throw error;
                        }
                        if (!approved) {
                            return {
                                opened: null,
                                committed: false,
                                revision: expectedRevision,
                                reason: "user_declined",
                            };
                        }
                    }

                    throwIfAborted(signal);
                    assertGameRevision(useProject.getState(), expectedRevision);
                    const generationBefore =
                        useProject.getState().projectGeneration;
                    let postCommitWarning: string | null = null;
                    try {
                        await useProject.getState().createNewProject(
                            "ex",
                            {},
                            key,
                            false,
                            () => {
                                throwIfAborted(signal);
                                assertGameRevision(
                                    useProject.getState(),
                                    expectedRevision,
                                );
                            },
                        );
                    } catch (error) {
                        const state = useProject.getState();
                        if (
                            state.projectGeneration <= generationBefore
                            || state.demoKey !== key
                        ) {
                            throw error;
                        }
                        postCommitWarning = errorMessage(error);
                    }
                    return {
                        opened: key,
                        committed: true,
                        revision: gameRevision(useProject.getState()),
                        postCommitWarning,
                    };
                });
            },
        },
    ];
}

interface ExpectedExecutableIdentity {
    expectedRevision?: string;
    expectedContentRevision?: string;
    expectedRuntimeFingerprint?: string;
}

interface CurrentGameIdentity {
    revision: string;
    contentRevision: string;
    runtimeFingerprint: string;
    engineModuleUrl: string;
    engine: Record<string, unknown>;
}

function currentGameIdentity(
    state = useProject.getState(),
): CurrentGameIdentity {
    const engineModuleUrl = getVersion(
        false,
        state.project.kaplayVersion,
    ) as string;
    const contentRevision = gameContentRevision(state);
    return {
        revision: gameRevision(state),
        contentRevision,
        runtimeFingerprint: gameRuntimeFingerprint(state, {
            applicationCommit:
                KAPLAYGROUND_BUILD_IDENTITY.applicationCommit,
            engineCommit: KAPLAYGROUND_BUILD_IDENTITY.engineCommit,
            protocolVersion: PREVIEW_PROTOCOL_VERSION,
            engineModuleUrl,
        }),
        engineModuleUrl,
        engine: engineRuntimeIdentity(
            state.project.kaplayVersion,
            engineModuleUrl,
        ),
    };
}

function expectedExecutableIdentity(
    input: Record<string, unknown>,
    includeRuntimeFingerprint: boolean,
): ExpectedExecutableIdentity {
    const expectedRevision = input.expectedRevision === undefined
        ? undefined
        : boundedString(input.expectedRevision, "expectedRevision", 64);
    const expectedContentRevision = input.expectedContentRevision === undefined
        ? undefined
        : boundedString(
            input.expectedContentRevision,
            "expectedContentRevision",
            64,
        );
    if (
        expectedRevision === undefined
        && expectedContentRevision === undefined
    ) {
        throw new TypeError(
            "expectedRevision or expectedContentRevision is required.",
        );
    }
    if (
        expectedRevision !== undefined
        && !/^[0-9]+:[0-9]+$/.test(expectedRevision)
    ) {
        throw new TypeError(
            "expectedRevision must match the project revision returned by inspect_game.",
        );
    }
    if (
        expectedContentRevision !== undefined
        && !/^[0-9]+:c:[0-9a-f]{16}$/.test(expectedContentRevision)
    ) {
        throw new TypeError(
            "expectedContentRevision must match the content revision returned by inspect_game.",
        );
    }
    const expectedRuntimeFingerprint = !includeRuntimeFingerprint
            || input.expectedRuntimeFingerprint === undefined
        ? undefined
        : boundedString(
            input.expectedRuntimeFingerprint,
            "expectedRuntimeFingerprint",
            64,
        );
    if (
        expectedRuntimeFingerprint !== undefined
        && !/^r:[0-9a-f]{16}$/.test(expectedRuntimeFingerprint)
    ) {
        throw new TypeError(
            "expectedRuntimeFingerprint must match a runtime fingerprint returned by inspect_game or run_game.",
        );
    }
    return {
        expectedRevision,
        expectedContentRevision,
        expectedRuntimeFingerprint,
    };
}

function assertExpectedExecutableIdentity(
    state: ReturnType<typeof useProject.getState>,
    expected: ExpectedExecutableIdentity,
): void {
    if (expected.expectedRevision !== undefined) {
        assertGameRevision(state, expected.expectedRevision);
    }
    if (expected.expectedContentRevision !== undefined) {
        assertGameContentRevision(state, expected.expectedContentRevision);
    }
}

function failedRunResult({
    mode,
    identity,
    runId,
    readiness,
    focusRequested,
    canvasFocused = false,
    summary,
    error,
    runIdentity,
    notChecked,
}: {
    mode: "restart-and-check" | "check-current";
    identity: CurrentGameIdentity;
    runId: string | null;
    readiness: unknown;
    focusRequested: boolean;
    canvasFocused?: boolean;
    summary: string;
    error?: string;
    runIdentity?: {
        contentRevision: string | null;
        runtimeFingerprint: string | null;
    };
    notChecked: string[];
}): Record<string, unknown> {
    return {
        status: "failed",
        mode,
        revision: identity.revision,
        contentRevision: identity.contentRevision,
        runtimeFingerprint: identity.runtimeFingerprint,
        runId,
        readiness: safeSerializable(readiness),
        focus: {
            requested: focusRequested,
            canvasFocused,
        },
        summary,
        error: error ?? null,
        runIdentity: runIdentity ?? null,
        diagnostics: {
            available: false,
            sourcePath: null,
            sourceCurrent: false,
            errorCount: 0,
            total: 0,
            truncated: false,
            items: [],
        },
        console: {
            available: false,
            errorCount: 0,
            total: 0,
            truncated: false,
            droppedCount: 0,
            entries: [],
        },
        gameplay: null,
        scene: {
            available: false,
            runId,
            readiness: safeSerializable(readiness),
        },
        incompleteReasons: [],
        notChecked,
    };
}

function runNotChecked(
    gameplay: Record<string, unknown> | null,
): string[] {
    const inputActionCount = Number(gameplay?.inputActionCount ?? 0);
    const unassertedInputActionCount = Number(gameplay?.unassertedInputActionCount ?? inputActionCount);
    if (inputActionCount > 0 && unassertedInputActionCount === 0) {
        return ["Visual quality"];
    }
    if (inputActionCount > 0) {
        return ["Control effects", "Visual quality"];
    }
    return ["Playing the controls", "Visual quality"];
}


function synchronizeEditorModels(
    files: ReadonlyMap<string, { value: string; language: string }>,
    changes: readonly { action: GameChange["action"]; path: string }[],
    focusPath?: string,
): { available: boolean; complete: boolean; errors: string[] } {
    const editorStore = useEditor.getState();
    const { monaco, currentFile } = editorStore.runtime;
    const errors: string[] = [];
    if (!monaco) {
        if (focusPath) {
            try {
                editorStore.setCurrentFile(focusPath);
            } catch (error) {
                errors.push(`${focusPath}: ${errorMessage(error)}`);
            }
        }
        return {
            available: false,
            complete: errors.length === 0,
            errors,
        };
    }

    for (const change of changes) {
        try {
            const uri = monaco.Uri.file(change.path);
            const model = monaco.editor.getModel(uri);
            if (change.action === "remove") {
                model?.dispose();
                if (currentFile === change.path) {
                    editorStore.setCurrentFile("main.js");
                }
                continue;
            }

            const file = files.get(change.path);
            if (!file) continue;
            if (model) {
                if (model.getValue() !== file.value) model.setValue(file.value);
            } else {
                monaco.editor.createModel(file.value, file.language, uri);
            }
        } catch (error) {
            errors.push(`${change.path}: ${errorMessage(error)}`);
        }
    }

    if (focusPath) {
        try {
            editorStore.setCurrentFile(focusPath);
        } catch (error) {
            errors.push(`${focusPath}: ${errorMessage(error)}`);
        }
    }

    if (errors.length > 0) {
        console.error(
            "[webmcp] Project committed but editor synchronization failed",
            {
                errors,
            },
        );
    }
    return { available: true, complete: errors.length === 0, errors };
}

function parseGameChanges(value: unknown): GameChange[] {
    if (!Array.isArray(value)) throw new TypeError("changes must be an array.");
    return value.map((item, index) => {
        const change = toRecord(item);
        const action = requiredString(
            change.action,
            `changes[${index}].action`,
        );
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

function boundedSelectedAsset() {
    const selected = useWorkspace.getState().selectedAsset;
    if (!selected) return null;
    const identity = {
        source: selected.source,
        kind: selected.kind,
        name: selected.name.slice(0, 256),
    };
    return selected.source === "library"
        ? { ...identity, key: selected.key.slice(0, 256) }
        : selected.source === "game"
        ? { ...identity, path: selected.path.slice(0, 512) }
        : identity;
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
    if (typeof value !== "string") {
        throw new TypeError(`${name} must be a string.`);
    }
    return value;
}

function requiredString(value: unknown, name: string): string {
    const result = stringValue(value, name);
    if (result.length === 0) throw new TypeError(`${name} must not be empty.`);
    return result;
}

function boundedString(
    value: unknown,
    name: string,
    maxLength: number,
): string {
    const result = requiredString(value, name);
    if (result.length > maxLength) {
        throw new RangeError(
            `${name} must contain at most ${maxLength} characters.`,
        );
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
        throw new RangeError(
            `${name} must contain at most ${maxLength} characters.`,
        );
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
    return value.map((item, index) =>
        requiredString(item, `${name}[${index}]`)
    );
}

function boundedInteger(
    value: unknown,
    name: string,
    minimum: number,
    maximum: number,
    fallback: number,
): number {
    if (value === undefined) return fallback;
    if (
        !Number.isInteger(value) || Number(value) < minimum
        || Number(value) > maximum
    ) {
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

function projectName(value: unknown): string {
    const name = stringValue(value, "name").trim();
    if (name.length === 0) {
        throw new TypeError("name must not be blank.");
    }
    if (name.length > MAX_PROJECT_NAME_LENGTH) {
        throw new RangeError(
            `name must contain at most ${MAX_PROJECT_NAME_LENGTH} characters.`,
        );
    }
    if (/\p{Cc}/u.test(name)) {
        throw new TypeError("name cannot contain control characters.");
    }
    return name;
}

function isReadyEvidence(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const readiness = value as Record<string, unknown>;
    return readiness.status === "ready"
        && readiness.moduleExecuted === true
        && readiness.contextCaptured === true
        && readiness.assetsLoaded === true
        && readiness.firstFrame === true
        && readiness.canvasPresent === true;
}

function readinessIncompleteReason(value: unknown): string {
    if (typeof value !== "object" || value === null) {
        return "Preview asset and first-frame readiness evidence was unavailable.";
    }
    const readiness = value as Record<string, unknown>;
    const status = typeof readiness.status === "string"
        ? ` (${readiness.status})`
        : "";
    const reason = typeof readiness.reason === "string" && readiness.reason
        ? ` ${readiness.reason}`
        : "";
    return `The preview did not confirm asset loading and a first game frame${status}.${reason}`;
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
