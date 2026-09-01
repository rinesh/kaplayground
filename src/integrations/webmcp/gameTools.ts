export const KAPLAYGROUND_WEBMCP_TOOL_NAMES = [
    "kaplayground_inspect_game",
    "kaplayground_read_files",
    "kaplayground_update_game",
    "kaplayground_run_game",
    "kaplayground_find_assets",
    "kaplayground_save_game",
    "kaplayground_find_examples",
    "kaplayground_open_example",
] as const;

export const MAX_GAME_CHANGES = 20;
export const MAX_GAME_FILE_BYTES = 512 * 1024;
export const MAX_GAME_UPDATE_BYTES = 2 * 1024 * 1024;

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
            throw new Error(`The update contains more than one change for "${path}".`);
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
            if (files.has(path)) throw new Error(`Game file already exists: ${path}`);
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
        throw new RangeError(`path must contain at most ${MAX_PATH_LENGTH} characters.`);
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
