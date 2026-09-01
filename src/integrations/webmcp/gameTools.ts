/// <reference types="webmcp-types" preserve="true" />

export const MAX_GAME_CHANGES = 20;
export const MAX_GAME_FILE_BYTES = 512 * 1024;
export const MAX_GAME_UPDATE_BYTES = 2 * 1024 * 1024;
export const MAX_FILES_PER_READ = 10;
export const MAX_TOTAL_READ_BYTES = MAX_GAME_FILE_BYTES;
export const MAX_LISTED_FILES = 100;
export const MAX_ASSET_RESULTS = 50;
export const MAX_EXAMPLE_RESULTS = 100;
export const MAX_CONSOLE_RESULTS = 200;
export const MAX_PREVIEW_OBJECTS = 50;
export const MAX_RESULT_OFFSET = 100_000;

export interface KaplaygroundToolSurface {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations?: WebMCP.ToolAnnotations;
}

/** The single public browser-agent contract, without application handlers. */
export const KAPLAYGROUND_WEBMCP_TOOL_SURFACE = [
    {
        name: "kaplayground_inspect_game",
        title: "Inspect the open KAPLAYGROUND game",
        description:
            "Use this before changing the game. Returns the current game, one bounded page of file metadata, editor state, and the revision required by update, run, save, and example-opening tools.",
        inputSchema: inspectGameSchema(),
        annotations: readAnnotations(),
    },
    {
        name: "kaplayground_read_files",
        title: "Read KAPLAYGROUND game files",
        description:
            "Read up to ten exact files, within one aggregate 512 KiB response budget. Use the revision from inspect_game and read every file needed for the requested change before updating.",
        inputSchema: readFilesSchema(),
        annotations: readAnnotations(),
    },
    {
        name: "kaplayground_update_game",
        title: "Update the KAPLAYGROUND game",
        description:
            "Apply all related file replacements, creations, and removals together. The update succeeds completely or changes nothing. It does not run the game; call run_game afterward with the returned revision.",
        inputSchema: updateGameSchema(),
    },
    {
        name: "kaplayground_run_game",
        title: "Run and check the KAPLAYGROUND game",
        description:
            "Restart the exact requested game revision and check it, or inspect the current run after the user has played without restarting it. Returns editor errors, run-specific console errors, and a bounded scene snapshot.",
        inputSchema: runGameSchema(),
        annotations: { untrustedContentHint: true },
    },
    {
        name: "kaplayground_find_assets",
        title: "Find KAPLAYGROUND game assets",
        description:
            "Find matching assets already in the game and reusable items from KAPLAYGROUND's built-in library. Returns metadata and exact loader code, never binary files or hidden URLs.",
        inputSchema: findAssetsSchema(),
        annotations: readAnnotations(),
    },
    {
        name: "kaplayground_save_game",
        title: "Save the KAPLAYGROUND game",
        description:
            "Save the current game after checking that it still matches the requested revision. Temporary work becomes a saved project; existing saved projects are flushed to storage.",
        inputSchema: revisionSchema(),
    },
    {
        name: "kaplayground_find_examples",
        title: "Find KAPLAYGROUND starting games",
        description:
            "Find ready-made games and examples by idea or tag when the user asks for a different starting point.",
        inputSchema: findExamplesSchema(),
        annotations: readAnnotations(),
    },
    {
        name: "kaplayground_open_example",
        title: "Open a KAPLAYGROUND starting game",
        description:
            "Replace the open game with one exact result from find_examples. Unsaved work is discarded only after an in-page confirmation clicked by the user.",
        inputSchema: openExampleSchema(),
    },
] as const satisfies readonly KaplaygroundToolSurface[];

export type KaplaygroundToolName =
    (typeof KAPLAYGROUND_WEBMCP_TOOL_SURFACE)[number]["name"];

export const KAPLAYGROUND_WEBMCP_TOOL_NAMES: readonly KaplaygroundToolName[] =
    Object.freeze(
        KAPLAYGROUND_WEBMCP_TOOL_SURFACE.map(({ name }) => name),
    );

export function kaplaygroundToolSurface<Name extends KaplaygroundToolName>(
    name: Name,
): Extract<
    (typeof KAPLAYGROUND_WEBMCP_TOOL_SURFACE)[number],
    { name: Name }
> {
    const surface = KAPLAYGROUND_WEBMCP_TOOL_SURFACE.find((tool) =>
        tool.name === name
    );
    if (!surface) throw new Error(`Unknown KAPLAYGROUND tool: ${name}`);
    return surface as Extract<
        (typeof KAPLAYGROUND_WEBMCP_TOOL_SURFACE)[number],
        { name: Name }
    >;
}

/** Registers one complete surface in order using a shared lifecycle signal. */
export async function registerGameToolDefinitions(
    context: Pick<WebMCP.ModelContext, "registerTool">,
    tools: readonly WebMCP.ModelContextTool[],
    controller: AbortController,
    onRegistered?: (name: string) => void,
): Promise<void> {
    try {
        for (const tool of tools) {
            controller.signal.throwIfAborted();
            await context.registerTool(tool, { signal: controller.signal });
            onRegistered?.(tool.name);
        }
    } catch (error) {
        if (!controller.signal.aborted) controller.abort(error);
        throw error;
    }
}

function inspectGameSchema(): object {
    return {
        type: "object",
        properties: {
            fileOffset: {
                type: "integer",
                minimum: 0,
                maximum: MAX_RESULT_OFFSET,
                default: 0,
                description:
                    "Zero-based file offset. Use nextFileOffset from the previous page.",
            },
            fileLimit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_LISTED_FILES,
                default: MAX_LISTED_FILES,
                description:
                    "Maximum number of file metadata entries to return.",
            },
        },
        additionalProperties: false,
    };
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
                uniqueItems: true,
                description:
                    "Exact normalized project-relative paths to read. Their combined source must fit the aggregate read budget.",
                items: {
                    type: "string",
                    minLength: 1,
                    maxLength: 512,
                    description: "An exact path returned by inspect_game.",
                },
            },
        },
        required: ["expectedRevision", "paths"],
        additionalProperties: false,
    };
}

function updateGameSchema(): object {
    const path = {
        type: "string",
        minLength: 1,
        maxLength: 512,
        description: "A normalized project-relative game file path.",
    };
    const content = {
        type: "string",
        maxLength: MAX_GAME_FILE_BYTES,
        description: "Complete replacement or new-file source code.",
    };
    return {
        type: "object",
        properties: {
            expectedRevision: revisionProperty(),
            changes: {
                type: "array",
                minItems: 1,
                maxItems: MAX_GAME_CHANGES,
                description:
                    "All file changes to validate and commit as one atomic project update.",
                items: {
                    oneOf: [
                        changeSchema(
                            "replace",
                            "Replace an existing file completely.",
                            path,
                            content,
                        ),
                        changeSchema(
                            "create",
                            "Create one JavaScript or TypeScript file in scenes/, objects/, or utils/.",
                            path,
                            content,
                        ),
                        {
                            type: "object",
                            properties: {
                                action: {
                                    type: "string",
                                    enum: ["remove"],
                                    description:
                                        "Remove one JavaScript or TypeScript file from scenes/, objects/, or utils/.",
                                },
                                path,
                            },
                            required: ["action", "path"],
                            additionalProperties: false,
                        },
                    ],
                },
            },
            focusPath: {
                type: "string",
                minLength: 1,
                maxLength: 512,
                description:
                    "Optional file to show in the editor after the update commits. It must exist after the update.",
            },
        },
        required: ["expectedRevision", "changes"],
        additionalProperties: false,
    };
}

function changeSchema(
    action: "replace" | "create",
    description: string,
    path: object,
    content: object,
): object {
    return {
        type: "object",
        properties: {
            action: { type: "string", enum: [action], description },
            path,
            content,
        },
        required: ["action", "path", "content"],
        additionalProperties: false,
    };
}

function runGameSchema(): object {
    return {
        type: "object",
        properties: {
            expectedRevision: revisionProperty(),
            mode: {
                type: "string",
                enum: ["restart-and-check", "check-current"],
                default: "restart-and-check",
                description:
                    "Restart the requested revision, or inspect the current run without resetting user gameplay.",
            },
            inspectTag: {
                type: "string",
                minLength: 1,
                maxLength: 128,
                description:
                    "Optional KAPLAY tag used to filter scene objects.",
            },
            consoleLimit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_CONSOLE_RESULTS,
                default: 50,
                description: "Maximum newest console entries to return.",
            },
            objectLimit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_PREVIEW_OBJECTS,
                default: MAX_PREVIEW_OBJECTS,
                description:
                    "Maximum shallow scene object snapshots to return.",
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
            query: {
                type: "string",
                maxLength: 120,
                description:
                    "Case-insensitive name, path, description, or tag search.",
            },
            kind: {
                type: "string",
                enum: ["sprite", "sound", "font"],
                description: "Optional asset kind filter.",
            },
            source: {
                type: "string",
                enum: ["all", "game", "library"],
                default: "all",
                description:
                    "Search the open game, the built-in library, or both.",
            },
            limit: pageLimitSchema(MAX_ASSET_RESULTS, 20),
            offset: pageOffsetSchema(),
        },
        additionalProperties: false,
    };
}

function findExamplesSchema(): object {
    return {
        type: "object",
        properties: {
            query: {
                type: "string",
                maxLength: 120,
                description:
                    "Case-insensitive example title, description, key, or tag search.",
            },
            tag: {
                type: "string",
                maxLength: 64,
                description: "Optional exact example tag.",
            },
            limit: pageLimitSchema(MAX_EXAMPLE_RESULTS, 30),
            offset: pageOffsetSchema(),
        },
        additionalProperties: false,
    };
}

function pageLimitSchema(maximum: number, fallback: number): object {
    return {
        type: "integer",
        minimum: 1,
        maximum,
        default: fallback,
        description: "Maximum results in this page.",
    };
}

function pageOffsetSchema(): object {
    return {
        type: "integer",
        minimum: 0,
        maximum: MAX_RESULT_OFFSET,
        default: 0,
        description: "Zero-based result offset. Use nextOffset to continue.",
    };
}

function openExampleSchema(): object {
    return {
        type: "object",
        properties: {
            expectedRevision: revisionProperty(),
            key: {
                type: "string",
                minLength: 1,
                maxLength: 128,
                description: "Exact example key returned by find_examples.",
            },
            discardUnsavedChanges: {
                type: "boolean",
                default: false,
                description:
                    "Requests an in-page user confirmation when unsaved work exists. This value never substitutes for the user's click.",
            },
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
        pattern: "^[0-9]+:[0-9]+$",
        description: "Revision returned by inspect_game or update_game.",
    };
}

function readAnnotations(): WebMCP.ToolAnnotations {
    return { readOnlyHint: true, untrustedContentHint: true };
}

const MAX_PATH_LENGTH = 512;
const FILE_KIND_BY_FOLDER = {
    scenes: "scene",
    objects: "obj",
    utils: "util",
} as const;

export interface GameRevisionState {
    projectGeneration: number;
    projectRevision: number;
}

export interface EditableGameFile {
    path: string;
    value: string;
    language: string;
    kind: string;
}

export type GameChange =
    | { action: "replace"; path: string; content: string }
    | { action: "create"; path: string; content: string }
    | { action: "remove"; path: string };

export interface PreparedGameChange {
    action: GameChange["action"];
    path: string;
    sizeBytes: number;
}

export interface PreparedGameUpdate {
    files: Map<string, EditableGameFile>;
    changes: PreparedGameChange[];
    totalBytes: number;
}

export interface GameReadFile {
    path: string;
    value: string;
}

export function gameRevision(state: GameRevisionState): string {
    assertRevisionNumber(state.projectGeneration, "projectGeneration");
    assertRevisionNumber(state.projectRevision, "projectRevision");
    return `${state.projectGeneration}:${state.projectRevision}`;
}

export function assertGameRevision(
    state: GameRevisionState,
    expectedRevision: string,
): void {
    const actualRevision = gameRevision(state);
    if (actualRevision !== expectedRevision) {
        throw new Error(
            `The game changed since it was inspected. Expected revision ${expectedRevision}, found ${actualRevision}. Inspect the game again before continuing.`,
        );
    }
}

export function gameReadSize(files: readonly GameReadFile[]): number {
    if (files.length === 0 || files.length > MAX_FILES_PER_READ) {
        throw new RangeError(
            `A file read must contain between 1 and ${MAX_FILES_PER_READ} files.`,
        );
    }

    let totalBytes = 0;
    for (const file of files) {
        const sizeBytes = new TextEncoder().encode(file.value).byteLength;
        if (sizeBytes > MAX_GAME_FILE_BYTES) {
            throw new RangeError(
                `"${file.path}" is ${sizeBytes} bytes, which is larger than the ${MAX_GAME_FILE_BYTES}-byte file limit.`,
            );
        }
        totalBytes += sizeBytes;
        if (totalBytes > MAX_TOTAL_READ_BYTES) {
            throw new RangeError(
                `The requested files contain ${totalBytes} bytes, which is larger than the ${MAX_TOTAL_READ_BYTES}-byte read limit. Read fewer files in this call.`,
            );
        }
    }
    return totalBytes;
}

export function createSerialTaskQueue(): {
    run<T>(operation: () => Promise<T>): Promise<T>;
} {
    let tail: Promise<void> = Promise.resolve();
    return {
        run<T>(operation: () => Promise<T>): Promise<T> {
            const result = tail.then(operation, operation);
            tail = result.then(
                () => undefined,
                () => undefined,
            );
            return result;
        },
    };
}

export type GameRunStatus = "passed" | "failed" | "incomplete";

export function classifyGameRun(
    diagnosticErrorCount: number,
    consoleErrorCount: number,
    incompleteReasons: readonly string[],
): GameRunStatus {
    if (diagnosticErrorCount > 0 || consoleErrorCount > 0) return "failed";
    return incompleteReasons.length > 0 ? "incomplete" : "passed";
}

export function requiresExampleDiscardConfirmation(
    hasUnsavedChanges: boolean,
    discardRequested: boolean,
): boolean {
    if (!hasUnsavedChanges) return false;
    if (!discardRequested) {
        throw new Error(
            "The open game has unsaved changes. Save it first, or request a page confirmation before discarding it.",
        );
    }
    return true;
}

export function prepareGameUpdate(
    currentFiles: ReadonlyMap<string, EditableGameFile>,
    changes: readonly GameChange[],
): PreparedGameUpdate {
    if (!Array.isArray(changes) || changes.length === 0) {
        throw new Error("At least one file change is required.");
    }
    if (changes.length > MAX_GAME_CHANGES) {
        throw new Error(
            `A game update can contain at most ${MAX_GAME_CHANGES} file changes.`,
        );
    }

    const files = new Map(
        [...currentFiles.entries()].map(([path, file]) => [path, { ...file }]),
    );
    const seenPaths = new Set<string>();
    const preparedChanges: PreparedGameChange[] = [];
    let totalBytes = 0;

    for (const change of changes) {
        const path = gamePath(change.path);
        if (seenPaths.has(path)) {
            throw new Error(
                `The update contains more than one change for "${path}".`,
            );
        }
        seenPaths.add(path);

        if (change.action === "replace") {
            const current = files.get(path);
            if (!current) throw new Error(`Game file not found: ${path}`);
            const sizeBytes = contentSize(change.content, path);
            totalBytes += sizeBytes;
            files.set(path, { ...current, value: change.content });
            preparedChanges.push({ action: change.action, path, sizeBytes });
            continue;
        }

        if (change.action === "create") {
            if (files.has(path)) {
                throw new Error(`Game file already exists: ${path}`);
            }
            const metadata = newFileMetadata(path);
            const sizeBytes = contentSize(change.content, path);
            totalBytes += sizeBytes;
            files.set(path, {
                path,
                value: change.content,
                language: metadata.language,
                kind: metadata.kind,
            });
            preparedChanges.push({ action: change.action, path, sizeBytes });
            continue;
        }

        const current = files.get(path);
        if (!current) throw new Error(`Game file not found: ${path}`);
        assertRemovablePath(path);
        files.delete(path);
        preparedChanges.push({ action: change.action, path, sizeBytes: 0 });
    }

    if (totalBytes > MAX_GAME_UPDATE_BYTES) {
        throw new Error(
            `The update contains ${totalBytes} bytes, which is larger than the ${MAX_GAME_UPDATE_BYTES}-byte limit.`,
        );
    }

    return { files, changes: preparedChanges, totalBytes };
}

export function gamePath(value: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("path must be a non-empty string.");
    }
    if (value.length > MAX_PATH_LENGTH) {
        throw new RangeError(
            `path must contain at most ${MAX_PATH_LENGTH} characters.`,
        );
    }
    if (value.includes("\\") || value.includes("\0")) {
        throw new TypeError(
            "path must use forward slashes and cannot contain null bytes.",
        );
    }
    if (
        value.split("/").some((part) =>
            part.length === 0 || part === "." || part === ".."
        )
    ) {
        throw new TypeError("path must be a normalized project-relative path.");
    }
    return value;
}

function contentSize(content: string, path: string): number {
    if (typeof content !== "string") {
        throw new TypeError(`content for "${path}" must be a string.`);
    }
    const sizeBytes = new TextEncoder().encode(content).byteLength;
    if (sizeBytes > MAX_GAME_FILE_BYTES) {
        throw new RangeError(
            `"${path}" is ${sizeBytes} bytes, which is larger than the ${MAX_GAME_FILE_BYTES}-byte limit.`,
        );
    }
    return sizeBytes;
}

function newFileMetadata(path: string): { language: string; kind: string } {
    const match = path.match(/^(scenes|objects|utils)\/[^/]+\.(js|ts)$/);
    if (!match) {
        throw new Error(
            "New files must be JavaScript or TypeScript files directly inside scenes/, objects/, or utils/.",
        );
    }
    const folder = match[1] as keyof typeof FILE_KIND_BY_FOLDER;
    return {
        language: path.endsWith(".ts") ? "typescript" : "javascript",
        kind: FILE_KIND_BY_FOLDER[folder],
    };
}

function assertRemovablePath(path: string): void {
    if (!/^(scenes|objects|utils)\/[^/]+\.(js|ts)$/.test(path)) {
        throw new Error(
            "Only JavaScript or TypeScript files directly inside scenes/, objects/, or utils/ can be removed.",
        );
    }
}

function assertRevisionNumber(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer.`);
    }
}
