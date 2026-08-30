import type {
    KaplaygroundConsoleCapture,
    KaplaygroundConsoleEntry,
} from "./kaplaygroundWebMCP";

export interface BoundedConsoleCapture {
    add(entry: KaplaygroundConsoleEntry): void;
    clear(): void;
    snapshot(): KaplaygroundConsoleCapture;
}

export function createBoundedConsoleCapture(
    limit: number,
): BoundedConsoleCapture {
    const entries: KaplaygroundConsoleEntry[] = [];
    let droppedCount = 0;

    return {
        add(entry) {
            entries.push(entry);
            const overflow = entries.length - limit;
            if (overflow <= 0) return;

            entries.splice(0, overflow);
            droppedCount = Math.min(
                Number.MAX_SAFE_INTEGER,
                droppedCount + overflow,
            );
        },
        clear() {
            entries.length = 0;
            droppedCount = 0;
        },
        snapshot() {
            return {
                available: true,
                entries: [...entries],
                droppedCount,
            };
        },
    };
}
