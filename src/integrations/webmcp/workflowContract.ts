export const WEBMCP_WORKFLOW_CONTRACT_VERSION = "1.0";
export const WEBMCP_WORKFLOW_GUIDE_VERSION = 1;
export const WEBMCP_WORKFLOW_TOOL_ORDER = [
    "start_session",
    "apply_change_set",
    "verify_change",
] as const;

export const DEFAULT_MAX_CHANGE_OPERATIONS = 20;
export const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
export const DEFAULT_MAX_CHANGE_SET_BYTES = 2 * 1024 * 1024;
const MAX_PATH_LENGTH = 512;

export type WorkflowToolName =
    (typeof WEBMCP_WORKFLOW_TOOL_ORDER)[number];

export interface ProjectRevisionState {
    projectGeneration: number;
    projectRevision: number;
}

export interface WorkflowFile {
    path: string;
    language: string;
    kind: string;
    value: string;
}

export interface WorkflowAsset {
    name?: string;
    path: string;
    kind?: string;
    url?: string;
    importFunction?: string;
}

export interface WorkflowProjectSnapshot {
    mode?: string;
    buildMode?: string;
    kaplayVersion?: string;
    files: ReadonlyMap<string, WorkflowFile>;
    assets?: ReadonlyMap<string, WorkflowAsset>;
}

export type WorkflowChangeOperation =
    | {
        type: "replace";
        path: string;
        content: string;
        expectedFileRevision: string;
    }
    | {
        type: "create";
        path: string;
        content: string;
        language?: string;
        kind?: string;
    }
    | {
        type: "remove";
        path: string;
        expectedFileRevision: string;
    };

export interface PreparedWorkflowChange {
    type: WorkflowChangeOperation["type"];
    path: string;
    previousFileRevision: string | null;
    nextFileRevision: string | null;
    sizeBytes: number;
}

export interface PreparedWorkflowChangeSet {
    files: Map<string, WorkflowFile>;
    changes: PreparedWorkflowChange[];
    totalBytes: number;
}

export interface PrepareWorkflowChangeSetOptions {
    maxOperations?: number;
    maxFileBytes?: number;
    maxTotalBytes?: number;
}

export class WorkflowContractError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly requiredNextTool?: string;

    constructor(
        code: string,
        message: string,
        options: { retryable?: boolean; requiredNextTool?: string } = {},
    ) {
        super(`[${code}] ${message}`);
        this.name = "WorkflowContractError";
        this.code = code;
        this.retryable = options.retryable ?? false;
        this.requiredNextTool = options.requiredNextTool;
    }
}

export function projectInstanceRevision(
    state: ProjectRevisionState,
): string {
    assertRevisionNumber(state.projectGeneration, "projectGeneration");
    return `project-${state.projectGeneration}`;
}

export function workspaceRevision(state: ProjectRevisionState): string {
    assertRevisionNumber(state.projectGeneration, "projectGeneration");
    assertRevisionNumber(state.projectRevision, "projectRevision");
    return `workspace-${state.projectGeneration}-${state.projectRevision}`;
}

export function assertRevisionState(
    state: ProjectRevisionState,
    expectedProjectInstanceRevision: string,
    expectedWorkspaceRevision: string,
): void {
    const actualProjectInstanceRevision = projectInstanceRevision(state);
    if (actualProjectInstanceRevision !== expectedProjectInstanceRevision) {
        throw new WorkflowContractError(
            "PROJECT_INSTANCE_CHANGED",
            `Expected ${expectedProjectInstanceRevision}, found ${actualProjectInstanceRevision}. Start a new workflow session and inspect the active project again.`,
            {
                retryable: true,
                requiredNextTool: "kaplayground_start_session",
            },
        );
    }

    const actualWorkspaceRevision = workspaceRevision(state);
    if (actualWorkspaceRevision !== expectedWorkspaceRevision) {
        throw new WorkflowContractError(
            "WORKSPACE_REVISION_CHANGED",
            `Expected ${expectedWorkspaceRevision}, found ${actualWorkspaceRevision}. Re-read the affected files before applying another change.`,
            {
                retryable: true,
                requiredNextTool: "kaplayground_start_session",
            },
        );
    }
}

export function stableContentRevision(content: string): string {
    const bytes = new TextEncoder().encode(content);
    let hash = 0x811c9dc5;
    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193);
    }
    return `${bytes.byteLength}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function sourceRevision(project: WorkflowProjectSnapshot): string {
    const rows = [
        "source-revision-v1",
        `mode:${project.mode ?? ""}`,
        `build:${project.buildMode ?? ""}`,
        `kaplay:${project.kaplayVersion ?? ""}`,
    ];

    for (const [path, file] of [...project.files.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
    )) {
        rows.push(
            `file:${path}:${file.language}:${file.kind}:${stableContentRevision(file.value)}`,
        );
    }

    for (const [key, asset] of [...project.assets?.entries() ?? []].sort(
        ([left], [right]) => left.localeCompare(right),
    )) {
        rows.push([
            "asset",
            key,
            asset.path,
            asset.name ?? "",
            asset.kind ?? "",
            stableContentRevision(asset.url ?? ""),
            stableContentRevision(asset.importFunction ?? ""),
        ].join(":"));
    }

    return `source-v1-${stableContentRevision(rows.join("\n"))}`;
}

export function prepareWorkflowChangeSet(
    currentFiles: ReadonlyMap<string, WorkflowFile>,
    operations: readonly WorkflowChangeOperation[],
    options: PrepareWorkflowChangeSetOptions = {},
): PreparedWorkflowChangeSet {
    const maxOperations = positiveInteger(
        options.maxOperations,
        DEFAULT_MAX_CHANGE_OPERATIONS,
        "maxOperations",
    );
    const maxFileBytes = positiveInteger(
        options.maxFileBytes,
        DEFAULT_MAX_FILE_BYTES,
        "maxFileBytes",
    );
    const maxTotalBytes = positiveInteger(
        options.maxTotalBytes,
        DEFAULT_MAX_CHANGE_SET_BYTES,
        "maxTotalBytes",
    );

    if (!Array.isArray(operations as unknown) || operations.length === 0) {
        throw new WorkflowContractError(
            "EMPTY_CHANGE_SET",
            "At least one file operation is required.",
        );
    }
    if (operations.length > maxOperations) {
        throw new WorkflowContractError(
            "CHANGE_SET_TOO_LARGE",
            `A change set may contain at most ${maxOperations} operations.`,
        );
    }

    const files = new Map(
        [...currentFiles.entries()].map(([path, file]) => [path, { ...file }]),
    );
    const seenPaths = new Set<string>();
    const changes: PreparedWorkflowChange[] = [];
    let totalBytes = 0;

    for (const operation of operations) {
        const path = projectPath(operation.path);
        if (seenPaths.has(path)) {
            throw new WorkflowContractError(
                "DUPLICATE_CHANGE_PATH",
                `The change set contains more than one operation for "${path}".`,
            );
        }
        seenPaths.add(path);

        if (operation.type === "replace") {
            const current = files.get(path);
            if (!current) {
                throw new WorkflowContractError(
                    "FILE_NOT_FOUND",
                    `No project file exists at "${path}".`,
                    { retryable: true, requiredNextTool: "kaplayground_start_session" },
                );
            }
            assertExpectedFileRevision(
                path,
                current.value,
                operation.expectedFileRevision,
            );
            const sizeBytes = assertContentSize(
                operation.content,
                path,
                maxFileBytes,
            );
            totalBytes += sizeBytes;
            files.set(path, { ...current, value: operation.content });
            changes.push({
                type: operation.type,
                path,
                previousFileRevision: stableContentRevision(current.value),
                nextFileRevision: stableContentRevision(operation.content),
                sizeBytes,
            });
            continue;
        }

        if (operation.type === "create") {
            if (files.has(path)) {
                throw new WorkflowContractError(
                    "FILE_ALREADY_EXISTS",
                    `A project file already exists at "${path}".`,
                    { retryable: true, requiredNextTool: "kaplayground_start_session" },
                );
            }
            const metadata = newFileMetadata(path, operation.language, operation.kind);
            const sizeBytes = assertContentSize(
                operation.content,
                path,
                maxFileBytes,
            );
            totalBytes += sizeBytes;
            files.set(path, {
                path,
                value: operation.content,
                language: metadata.language,
                kind: metadata.kind,
            });
            changes.push({
                type: operation.type,
                path,
                previousFileRevision: null,
                nextFileRevision: stableContentRevision(operation.content),
                sizeBytes,
            });
            continue;
        }

        if (operation.type === "remove") {
            const current = files.get(path);
            if (!current) {
                throw new WorkflowContractError(
                    "FILE_NOT_FOUND",
                    `No project file exists at "${path}".`,
                    { retryable: true, requiredNextTool: "kaplayground_start_session" },
                );
            }
            assertRemovablePath(path);
            assertExpectedFileRevision(
                path,
                current.value,
                operation.expectedFileRevision,
            );
            files.delete(path);
            changes.push({
                type: operation.type,
                path,
                previousFileRevision: stableContentRevision(current.value),
                nextFileRevision: null,
                sizeBytes: 0,
            });
            continue;
        }

        const unreachable: never = operation;
        throw new WorkflowContractError(
            "UNKNOWN_CHANGE_OPERATION",
            `Unsupported operation: ${String(unreachable)}`,
        );
    }

    if (totalBytes > maxTotalBytes) {
        throw new WorkflowContractError(
            "CHANGE_SET_BYTES_EXCEEDED",
            `The change set contains ${totalBytes} UTF-8 bytes; the limit is ${maxTotalBytes}.`,
        );
    }

    return { files, changes, totalBytes };
}

export function projectPath(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new WorkflowContractError(
            "INVALID_PATH",
            "Every operation requires a non-empty project-relative path.",
        );
    }
    if (value.length > MAX_PATH_LENGTH) {
        throw new WorkflowContractError(
            "INVALID_PATH",
            `A project path may contain at most ${MAX_PATH_LENGTH} characters.`,
        );
    }
    if (value.includes("\\") || value.includes("\0")) {
        throw new WorkflowContractError(
            "INVALID_PATH",
            "Project paths must use forward slashes and cannot contain null bytes.",
        );
    }
    if (
        value.split("/").some((part) =>
            part === "" || part === "." || part === ".."
        )
    ) {
        throw new WorkflowContractError(
            "INVALID_PATH",
            "Project paths must be normalized and project-relative.",
        );
    }
    return value;
}

function assertExpectedFileRevision(
    path: string,
    content: string,
    expected: string,
): void {
    const actual = stableContentRevision(content);
    if (actual === expected) return;
    throw new WorkflowContractError(
        "FILE_REVISION_CONFLICT",
        `Revision conflict for "${path}": expected ${expected}, found ${actual}. Read the file again before applying the change.`,
        { retryable: true, requiredNextTool: "kaplayground_read_file" },
    );
}

function newFileMetadata(
    path: string,
    language: string | undefined,
    kind: string | undefined,
): { language: string; kind: string } {
    const match = path.match(/^(scenes|objects|utils)\/([^/]+)\.(js|ts)$/);
    if (!match) {
        throw new WorkflowContractError(
            "CREATE_PATH_NOT_ALLOWED",
            "New files must be JavaScript or TypeScript files directly inside scenes/, objects/, or utils/.",
        );
    }

    const folder = match[1]!;
    const extension = match[3]!;
    const expectedKind = folder === "scenes"
        ? "scene"
        : folder === "objects"
        ? "obj"
        : "util";
    if (kind !== undefined && kind !== expectedKind) {
        throw new WorkflowContractError(
            "FILE_KIND_MISMATCH",
            `File kind "${kind}" does not match the ${folder}/ folder.`,
        );
    }

    return {
        language: language ?? (extension === "ts" ? "typescript" : "javascript"),
        kind: expectedKind,
    };
}

function assertRemovablePath(path: string): void {
    if (/^(scenes|objects|utils)\/[^/]+\.(js|ts)$/.test(path)) return;
    throw new WorkflowContractError(
        "REMOVE_PATH_NOT_ALLOWED",
        "Only JavaScript or TypeScript files inside scenes/, objects/, or utils/ can be removed through the workflow tool.",
    );
}

function assertContentSize(
    content: unknown,
    path: string,
    maxFileBytes: number,
): number {
    if (typeof content !== "string") {
        throw new WorkflowContractError(
            "INVALID_FILE_CONTENT",
            `Complete string content is required for "${path}".`,
        );
    }
    const sizeBytes = new TextEncoder().encode(content).byteLength;
    if (sizeBytes > maxFileBytes) {
        throw new WorkflowContractError(
            "FILE_BYTES_EXCEEDED",
            `"${path}" contains ${sizeBytes} UTF-8 bytes; the per-file limit is ${maxFileBytes}.`,
        );
    }
    return sizeBytes;
}

function assertRevisionNumber(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer.`);
    }
}

function positiveInteger(
    value: number | undefined,
    fallback: number,
    name: string,
): number {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError(`${name} must be a positive safe integer.`);
    }
    return value;
}
