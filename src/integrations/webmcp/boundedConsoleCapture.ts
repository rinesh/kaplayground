import type {
    KaplaygroundConsoleCapture,
    KaplaygroundConsoleEntry,
} from "./kaplaygroundWebMCP";

const DEFAULT_MAX_ENTRY_BYTES = 16 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 512 * 1024;
const MAX_VALUE_DEPTH = 4;
const MAX_COLLECTION_ITEMS = 50;
const MAX_KEY_BYTES = 256;
const TRUNCATED = "[truncated]";
const encoder = new TextEncoder();

export interface BoundedConsoleCapture {
    add(entry: KaplaygroundConsoleEntry): void;
    clear(): void;
    snapshot(): KaplaygroundConsoleCapture;
}

export interface BoundedConsoleCaptureOptions {
    maxEntries: number;
    maxEntryBytes?: number;
    maxTotalBytes?: number;
}

interface RetainedEntry {
    entry: KaplaygroundConsoleEntry;
    sizeBytes: number;
}

interface ByteBudget {
    remaining: number;
    truncated: boolean;
}

export function createBoundedConsoleCapture(
    limitOrOptions: number | BoundedConsoleCaptureOptions,
): BoundedConsoleCapture {
    const options = normalizeOptions(limitOrOptions);
    const entries: RetainedEntry[] = [];
    let retainedBytes = 0;
    let droppedCount = 0;

    return {
        add(entry) {
            const retained = sanitizeEntry(entry, options.maxEntryBytes);
            entries.push(retained);
            retainedBytes += retained.sizeBytes;

            while (
                entries.length > options.maxEntries
                || retainedBytes > options.maxTotalBytes
            ) {
                const removed = entries.shift();
                if (!removed) break;
                retainedBytes -= removed.sizeBytes;
                droppedCount = Math.min(
                    Number.MAX_SAFE_INTEGER,
                    droppedCount + 1,
                );
            }
        },
        clear() {
            entries.length = 0;
            retainedBytes = 0;
            droppedCount = 0;
        },
        snapshot() {
            return {
                available: true,
                entries: entries.map(({ entry }) => entry),
                droppedCount,
            };
        },
    };
}

function normalizeOptions(
    value: number | BoundedConsoleCaptureOptions,
): Required<BoundedConsoleCaptureOptions> {
    const options = typeof value === "number"
        ? { maxEntries: value }
        : value;
    const maxEntries = positiveInteger(options.maxEntries, "maxEntries");
    const maxTotalBytes = boundedByteLimit(
        options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
        "maxTotalBytes",
    );
    const maxEntryBytes = Math.min(
        boundedByteLimit(
            options.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES,
            "maxEntryBytes",
        ),
        maxTotalBytes,
    );
    return { maxEntries, maxEntryBytes, maxTotalBytes };
}

function positiveInteger(value: number, name: string): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive safe integer.`);
    }
    return value;
}

function boundedByteLimit(value: number, name: string): number {
    const result = positiveInteger(value, name);
    if (result < 256) {
        throw new RangeError(`${name} must be at least 256 bytes.`);
    }
    return result;
}

function sanitizeEntry(
    source: KaplaygroundConsoleEntry,
    maxEntryBytes: number,
): RetainedEntry {
    const budget: ByteBudget = {
        // Reserve room for the entry envelope and JSON punctuation.
        remaining: Math.max(32, maxEntryBytes - 256),
        truncated: false,
    };
    const seen = new WeakSet<object>();
    const sourceValues = Array.isArray(source.values) ? source.values : [];
    const values: unknown[] = [];
    for (let index = 0; index < sourceValues.length; index++) {
        if (index >= MAX_COLLECTION_ITEMS) {
            budget.truncated = true;
            break;
        }
        try {
            values.push(sanitizeValue(sourceValues[index], budget, 0, seen));
        } catch (error) {
            budget.truncated = true;
            values.push(truncateUtf8(
                `[unavailable: ${
                    error instanceof Error ? error.message : String(error)
                }]`,
                Math.max(0, budget.remaining),
            ));
        }
    }
    const candidate: KaplaygroundConsoleEntry = {
        timestamp: sanitizeTimestamp(source.timestamp),
        level: truncateUtf8(safeString(source.level), 64),
        values,
    };
    if (source.runId !== undefined) {
        candidate.runId = source.runId === null
            ? null
            : truncateUtf8(safeString(source.runId), 128);
    }
    if (budget.truncated) {
        candidate.values = appendMarker(candidate.values);
    }

    let sizeBytes = serializedSize(candidate);
    if (sizeBytes <= maxEntryBytes) return { entry: candidate, sizeBytes };

    const retainedValues = [...candidate.values];
    while (retainedValues.length > 0 && sizeBytes > maxEntryBytes) {
        retainedValues.pop();
        candidate.values = appendMarker(retainedValues);
        sizeBytes = serializedSize(candidate);
    }

    if (sizeBytes > maxEntryBytes) {
        candidate.values = [TRUNCATED];
        sizeBytes = serializedSize(candidate);
    }

    return { entry: candidate, sizeBytes };
}

function appendMarker(values: readonly unknown[]): readonly unknown[] {
    if (values.at(-1) === TRUNCATED) return values;
    return [...values, TRUNCATED];
}

function sanitizeTimestamp(value: string | number): string | number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : safeString(value);
    }
    return truncateUtf8(safeString(value), 128);
}

function safeString(value: unknown): string {
    try {
        return String(value);
    } catch {
        return "[unavailable]";
    }
}

function sanitizeValue(
    value: unknown,
    budget: ByteBudget,
    depth: number,
    seen: WeakSet<object>,
): unknown {
    if (budget.remaining <= 16) {
        budget.truncated = true;
        return TRUNCATED;
    }
    if (value === null || typeof value === "boolean") {
        consume(budget, value === null ? 4 : value ? 4 : 5);
        return value;
    }
    if (typeof value === "number") {
        const result = Number.isFinite(value) ? value : null;
        consume(budget, String(result).length);
        return result;
    }
    if (typeof value === "string") return boundedBudgetString(value, budget);
    if (typeof value === "bigint") {
        return boundedBudgetString(value.toString(), budget);
    }
    if (
        typeof value === "undefined" || typeof value === "function"
        || typeof value === "symbol"
    ) {
        return boundedBudgetString(String(value), budget);
    }

    if (depth >= MAX_VALUE_DEPTH) {
        budget.truncated = true;
        return boundedBudgetString("[max depth]", budget);
    }
    if (seen.has(value)) {
        budget.truncated = true;
        return boundedBudgetString("[circular]", budget);
    }
    seen.add(value);

    if (value instanceof Date) {
        return boundedBudgetString(
            Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString(),
            budget,
        );
    }
    if (value instanceof Error) {
        return {
            name: boundedBudgetString(value.name, budget),
            message: boundedBudgetString(value.message, budget),
            stack: value.stack
                ? boundedBudgetString(value.stack, budget)
                : undefined,
        };
    }
    if (value instanceof ArrayBuffer) {
        return boundedBudgetString(`[ArrayBuffer ${value.byteLength} bytes]`, budget);
    }
    if (ArrayBuffer.isView(value)) {
        return boundedBudgetString(
            `[${value.constructor.name} ${value.byteLength} bytes]`,
            budget,
        );
    }

    if (Array.isArray(value)) {
        const result: unknown[] = [];
        const length = Math.min(value.length, MAX_COLLECTION_ITEMS);
        consume(budget, 2);
        for (let index = 0; index < length; index++) {
            if (budget.remaining <= 16) {
                budget.truncated = true;
                break;
            }
            consume(budget, 1);
            result.push(sanitizeValue(value[index], budget, depth + 1, seen));
        }
        if (value.length > length) budget.truncated = true;
        return budget.truncated ? appendMarker(result) : result;
    }

    const result: Record<string, unknown> = {};
    let count = 0;
    for (const key in value as Record<string, unknown>) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (count >= MAX_COLLECTION_ITEMS || budget.remaining <= 16) {
            budget.truncated = true;
            break;
        }
        count++;
        const safeKey = truncateUtf8(key, MAX_KEY_BYTES);
        consume(budget, utf8Size(safeKey) + 3);
        try {
            result[safeKey] = sanitizeValue(
                (value as Record<string, unknown>)[key],
                budget,
                depth + 1,
                seen,
            );
        } catch (error) {
            result[safeKey] = boundedBudgetString(
                `[unavailable: ${error instanceof Error ? error.message : String(error)}]`,
                budget,
            );
        }
    }
    if (budget.truncated && !(TRUNCATED in result)) {
        result[TRUNCATED] = true;
    }
    return result;
}

function boundedBudgetString(value: string, budget: ByteBudget): string {
    const allowance = Math.max(0, budget.remaining - 4);
    const result = truncateUtf8(value, allowance);
    const size = utf8Size(result) + 2;
    if (result !== value) budget.truncated = true;
    consume(budget, size);
    return result;
}

function consume(budget: ByteBudget, bytes: number): void {
    if (bytes > budget.remaining) budget.truncated = true;
    budget.remaining = Math.max(0, budget.remaining - bytes);
}

function truncateUtf8(value: string, maxBytes: number): string {
    if (maxBytes <= 0) return "";
    if (value.length <= maxBytes && utf8Size(value) <= maxBytes) return value;

    const marker = "…[truncated]";
    const markerBytes = utf8Size(marker);
    if (markerBytes >= maxBytes) {
        return prefixWithinBytes(value, maxBytes);
    }
    return prefixWithinBytes(value, maxBytes - markerBytes) + marker;
}

function prefixWithinBytes(value: string, maxBytes: number): string {
    let low = 0;
    let high = Math.min(value.length, maxBytes);
    while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (utf8Size(value.slice(0, middle)) <= maxBytes) {
            low = middle;
        } else {
            high = middle - 1;
        }
    }
    return value.slice(0, low);
}

function serializedSize(value: unknown): number {
    return utf8Size(JSON.stringify(value));
}

function utf8Size(value: string): number {
    return encoder.encode(value).byteLength;
}
