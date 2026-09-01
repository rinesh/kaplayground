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
    if (typeof value === "string") {
        return value.length <= MAX_VISIBLE_STRING
            ? value
            : `${value.slice(0, MAX_VISIBLE_STRING)}…`;
    }
    if (value === null || typeof value !== "object") return value;
    if (depth >= 4) return "[more details hidden]";
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_VISIBLE_ITEMS).map((item) =>
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
