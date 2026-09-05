const MAX_VISIBLE_STRING = 300;
const MAX_VISIBLE_ITEMS = 20;
const REDACTED_KEYS = new Set(["content", "sourceCode", "projectSource"]);

/** Keeps the visible activity trail useful without retaining source files. */
export function summarizeWebMCPActivityInput(
    input: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(input).slice(0, MAX_VISIBLE_ITEMS).map(([key, value]) => [
            key,
            summarizeValue(value, 0, key),
        ]),
    );
}

/** Stores an allowlisted verification receipt instead of arbitrary tool output. */
export function summarizeWebMCPActivityResult(
    toolName: string,
    value: unknown,
): Record<string, unknown> | undefined {
    const result = asRecord(value);
    if (!result) return undefined;
    const common = pick(result, [
        "contractVersion",
        "tool",
        "ok",
        "complete",
        "status",
        "summary",
        "revision",
        "contentRevision",
        "runtimeFingerprint",
        "runId",
    ]);

    if (toolName === "kaplayground_run_game") {
        const diagnostics = asRecord(result.diagnostics);
        const consoleResult = asRecord(result.console);
        const scene = asRecord(result.scene);
        const gameplay = asRecord(result.gameplay);
        return compact({
            ...common,
            mode: result.mode,
            readiness: summarizeReadiness(result.readiness),
            failure: asRecord(result.failure)
                ? pick(result.failure as Record<string, unknown>, ["phase", "elapsedMs", "timeoutMs", "code", "retryable"])
                : undefined,
            focus: summarizeValue(result.focus, 0),
            diagnostics: diagnostics
                ? pick(diagnostics, [
                    "available",
                    "sourcePath",
                    "sourceCurrent",
                    "errorCount",
                    "total",
                    "truncated",
                ])
                : undefined,
            console: consoleResult
                ? pick(consoleResult, [
                    "available",
                    "errorCount",
                    "total",
                    "truncated",
                    "droppedCount",
                ])
                : undefined,
            scene: scene
                ? {
                    available: scene.available,
                    scene: scene.scene,
                    objectCount: scene.objectCount,
                    objectsTruncated: scene.objectsTruncated,
                    inspectionScope: asRecord(scene.inspectionScope)
                        ? pick(scene.inspectionScope as Record<string, unknown>, [
                            "selection", "tag", "matchingObjectCount", "returnedObjectCount",
                            "objects", "layoutSelection", "layout", "wholeSceneObjects",
                        ])
                        : undefined,
                    layoutWarningCount: Array.isArray(scene.layoutWarnings)
                        ? scene.layoutWarnings.length
                        : undefined,
                    layoutWarningsTruncated: scene.layoutWarningsTruncated,
                    layoutAvailable: scene.layoutAvailable,
                }
                : undefined,
            gameplay: summarizeGameplay(gameplay),
            incompleteReasons: stringList(result.incompleteReasons),
            notChecked: stringList(result.notChecked),
        });
    }

    if (toolName === "kaplayground_inspect_game") {
        return compact({
            ...common,
            name: result.name,
            projectId: result.projectId,
            storage: result.storage,
            saveStatus: result.saveStatus,
            preview: result.preview,
            activeRunId: result.activeRunId,
            fileCount: result.fileCount,
            assetCount: result.assetCount,
            hasUnsavedChanges: result.hasUnsavedChanges,
            buildIdentity: summarizeValue(result.buildIdentity, 0),
            engine: summarizeValue(result.engine, 0),
        });
    }

    if (toolName === "kaplayground_update_game") {
        return compact({
            ...common,
            committed: result.committed,
            previousRevision: result.previousRevision,
            previousContentRevision: result.previousContentRevision,
            changeCount: result.changeCount,
            totalBytes: result.totalBytes,
            changes: summarizeChanges(result.changes),
            focusPath: result.focusPath,
            editorSync: summarizeValue(result.editorSync, 0),
            previewRan: result.previewRan,
        });
    }

    if (toolName === "kaplayground_read_files") {
        return compact({
            ...common,
            totalBytes: result.totalBytes,
            paths: Array.isArray(result.files)
                ? result.files.slice(0, MAX_VISIBLE_ITEMS).flatMap(file => {
                    const record = asRecord(file);
                    return typeof record?.path === "string"
                        ? [record.path]
                        : [];
                })
                : undefined,
        });
    }

    if (toolName === "kaplayground_save_game") {
        return compact({
            ...common,
            saved: result.saved,
            committed: result.committed,
            previousRevision: result.previousRevision,
            name: result.name,
            projectId: result.projectId,
            storage: result.storage,
            renamed: result.renamed,
            writeAcknowledged: result.writeAcknowledged,
            readbackVerified: result.readbackVerified,
            persistedHash: result.persistedHash,
            savedAt: result.savedAt,
        });
    }

    if (toolName === "kaplayground_find_assets") {
        return compact({
            ...common,
            query: result.query,
            source: result.source,
            assetKind: result.kind,
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            truncated: result.truncated,
            nextOffset: result.nextOffset,
        });
    }

    if (toolName === "kaplayground_find_examples") {
        return compact({
            ...common,
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            truncated: result.truncated,
            nextOffset: result.nextOffset,
        });
    }

    if (toolName === "kaplayground_open_example") {
        return compact({
            ...common,
            opened: result.opened,
            committed: result.committed,
            reason: result.reason,
            postCommitWarning: result.postCommitWarning,
        });
    }

    return common;
}

function summarizeGameplay(
    gameplay: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
    if (!gameplay) return undefined;
    const checkpoints = Array.isArray(gameplay.checkpoints)
        ? gameplay.checkpoints.slice(0, MAX_VISIBLE_ITEMS).map(item => {
            const checkpoint = asRecord(item);
            const checks = Array.isArray(checkpoint?.checks)
                ? checkpoint.checks
                : [];
            return compact({
                name: checkpoint?.name,
                passed: checkpoint?.passed,
                checkCount: checks.length,
                failedChecks: checks.flatMap(check => {
                    const record = asRecord(check);
                    return record?.passed === false
                        && typeof record.name === "string"
                        ? [record.name]
                        : [];
                }).slice(0, MAX_VISIBLE_ITEMS),
            });
        })
        : undefined;
    return compact({
        inputProvenance: gameplay.inputProvenance,
        actionCount: gameplay.actionCount,
        inputActionCount: gameplay.inputActionCount,
        checkpointCount: gameplay.checkpointCount,
        assertionCount: gameplay.assertionCount,
        unassertedInputActionCount: gameplay.unassertedInputActionCount,
        status: gameplay.status,
        passed: gameplay.passed,
        checkpoints,
    });
}

function summarizeReadiness(value: unknown): unknown {
    const readiness = asRecord(value);
    return readiness
        ? pick(readiness, [
            "status",
            "moduleExecuted",
            "contextCaptured",
            "assetsLoaded",
            "firstFrame",
            "canvasPresent",
            "reason",
        ])
        : summarizeValue(value, 0);
}

function summarizeChanges(value: unknown): unknown {
    if (!Array.isArray(value)) return undefined;
    return value.slice(0, MAX_VISIBLE_ITEMS).map(item => {
        const change = asRecord(item);
        return change
            ? pick(change, ["action", "path", "sizeBytes"])
            : summarizeValue(item, 1);
    });
}

function stringList(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.slice(0, MAX_VISIBLE_ITEMS).flatMap(item =>
        typeof item === "string" ? [boundedText(item)] : []
    );
}

function summarizeValue(
    value: unknown,
    depth: number,
    key?: string,
): unknown {
    if (key !== undefined && REDACTED_KEYS.has(key)) {
        return typeof value === "string"
            ? `[${value.length} characters hidden]`
            : "[hidden]";
    }
    if (typeof value === "string") return boundedText(value);
    if (value === null || typeof value !== "object") return value;
    if (depth >= 4) return "[more details hidden]";
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_VISIBLE_ITEMS).map(item =>
            summarizeValue(item, depth + 1)
        );
        if (value.length > MAX_VISIBLE_ITEMS) {
            items.push(`… ${value.length - MAX_VISIBLE_ITEMS} more`);
        }
        return items;
    }
    return Object.fromEntries(
        Object.entries(value).slice(0, MAX_VISIBLE_ITEMS).map(([childKey, item]) => [
            childKey,
            summarizeValue(item, depth + 1, childKey),
        ]),
    );
}

function boundedText(value: string): string {
    return value.length <= MAX_VISIBLE_STRING
        ? value
        : `${value.slice(0, MAX_VISIBLE_STRING)}…`;
}

function pick(
    value: Record<string, unknown>,
    keys: readonly string[],
): Record<string, unknown> {
    return compact(Object.fromEntries(keys.map(key => [key, value[key]])));
}

function compact<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}
