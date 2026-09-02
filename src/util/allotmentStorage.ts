export type Allotments = "editor" | "brew" | "console" | "files";

const getAllotmentKey = (prefix: string, id: Allotments): string => {
    return `allotment-${prefix}-${id}`;
};

export const allotmentStorage = (prefix: string) => ({
    getAllotmentSize: (id: Allotments, initial: number[] = []): number[] => {
        try {
            const stored = JSON.parse(
                localStorage.getItem(getAllotmentKey(prefix, id)) ?? "null",
            );
            if (
                Array.isArray(stored) && stored.length === initial.length
                && stored.every(size =>
                    typeof size === "number" && Number.isFinite(size)
                    && size >= 0
                )
                && stored.some(size => size > 0)
            ) return stored;
        } catch { /* Pane preferences must never block opening a game. */ }
        return initial;
    },
    setAllotmentSize: (id: Allotments, size: number[]): void => {
        try {
            localStorage.setItem(
                getAllotmentKey(prefix, id),
                JSON.stringify(size),
            );
        } catch { /* Game persistence reports its own storage failures. */ }
    },
});
