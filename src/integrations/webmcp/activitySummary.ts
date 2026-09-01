const MAX_VISIBLE_STRING = 800;
const MAX_VISIBLE_ITEMS = 20;
const REDACTED_INPUT_KEYS = new Set([
    "content",
    "projectSource",
    "sourceCode",
]);

/**
 * Produces the bounded, source-redacted input shown in the visible WebMCP
 * activity trail. This runs before an invocation enters application state.
 */
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
    if (key !== undefined && REDACTED_INPUT_KEYS.has(key)) {
        if (typeof value === "string") {
            return `[redacted ${value.length} characters]`;
        }
        return "[redacted]";
    }
    if (typeof value === "string") {
        if (value.length <= MAX_VISIBLE_STRING) return value;
        return `${value.slice(0, MAX_VISIBLE_STRING)}\n… [${value.length} characters]`;
    }
    if (value === null || typeof value !== "object") return value;
    if (depth >= 4) return "[Max depth]";
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_VISIBLE_ITEMS).map((item) =>
            summarizeValue(item, depth + 1)
        );
        if (value.length > MAX_VISIBLE_ITEMS) {
            items.push(`… [${value.length - MAX_VISIBLE_ITEMS} more items]`);
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
