type ConsoleLog = { method: string; data: unknown[] };

const MAX_DEPTH = 8;
const MAX_ITEMS = 50;
const MAX_NODES = 1_000;
const MAX_TEXT = 16_384;
const TRUNCATED = "[truncated]";

/** Read console-feed's wire format as bounded data, never as live JS objects. */
export function decodeConsoleLog(encoded: unknown): ConsoleLog | null {
    if (!Array.isArray(encoded)) return null;
    const envelope = record(encoded[0]);
    if (!envelope || !Array.isArray(envelope.data)) return null;

    let remainingNodes = MAX_NODES;
    let remainingText = MAX_TEXT;
    const active = new Set<object>();
    const text = (value: string) => {
        const result = value.slice(0, Math.max(0, remainingText));
        remainingText -= result.length;
        return result.length === value.length ? result : result + TRUNCATED;
    };
    const visit = (value: unknown, depth: number): unknown => {
        if (--remainingNodes < 0 || depth > MAX_DEPTH) return TRUNCATED;
        if (typeof value === "string") return text(value);
        if (value === null || typeof value === "boolean") return value;
        if (typeof value === "number") {
            return Number.isFinite(value)
                ? value
                : null;
        }
        if (typeof value !== "object") return "[unavailable]";
        if (active.has(value)) return "[circular]";
        active.add(value);
        try {
            if (Array.isArray(value)) {
                const last = value.at(-1);
                const count = typeof last === "string"
                        && /^__console_feed_remaining__\d+$/.test(last)
                    ? value.length - 1
                    : value.length;
                const result = value.slice(0, Math.min(count, MAX_ITEMS))
                    .map(item => visit(item, depth + 1));
                if (count > MAX_ITEMS) result.push(TRUNCATED);
                return result;
            }
            const object = record(value);
            if (!object) return "[unavailable]";
            if (Object.prototype.hasOwnProperty.call(object, "@r")) {
                const index = object["@r"];
                return typeof index === "number" && Number.isSafeInteger(index)
                        && index >= 0 && index < encoded.length
                    ? visit(encoded[index], depth + 1)
                    : "[invalid reference]";
            }
            // Preserve type information for display without calling constructors,
            // coercing values, creating DOM nodes, or reconstructing functions.
            if (typeof object["@t"] === "string") {
                return {
                    type: text(object["@t"]),
                    value: visit(object.data, depth + 1),
                };
            }
            const result: Record<string, unknown> = Object.create(null);
            let count = 0;
            for (const key in object) {
                if (!Object.prototype.hasOwnProperty.call(object, key)) {
                    continue;
                }
                if (count++ >= MAX_ITEMS || remainingNodes <= 0) {
                    result[TRUNCATED] = true;
                    break;
                }
                const decodedKey = /^#+@(t|r)$/.test(key) ? key.slice(1) : key;
                result[text(decodedKey.slice(0, 256))] = visit(
                    object[key],
                    depth + 1,
                );
            }
            return result;
        } finally {
            active.delete(value);
        }
    };

    return {
        method: typeof envelope.method === "string"
            ? envelope.method.slice(0, 64)
            : "log",
        data: visit(envelope.data, 0) as unknown[],
    };
}

function record(value: unknown): Record<string, unknown> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null
        ? value as Record<string, unknown>
        : null;
}
