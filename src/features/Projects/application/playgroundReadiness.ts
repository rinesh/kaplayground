export type PlaygroundReadinessStatus = "initializing" | "ready" | "error";

export interface PlaygroundReadinessSnapshot {
    status: PlaygroundReadinessStatus;
    databaseReady: boolean;
    esbuildReady: boolean;
    projectReady: boolean;
    /** Monaco is optional in layouts such as portrait project mode. */
    editorReady: boolean;
    error: Error | null;
}

type ReadinessListener = (snapshot: PlaygroundReadinessSnapshot) => void;
type ReadinessWaiter = {
    resolve: (snapshot: PlaygroundReadinessSnapshot) => void;
    reject: (error: Error) => void;
};

const listeners = new Set<ReadinessListener>();
const waiters = new Set<ReadinessWaiter>();

let snapshot: PlaygroundReadinessSnapshot = Object.freeze({
    status: "initializing",
    databaseReady: false,
    esbuildReady: false,
    projectReady: false,
    editorReady: false,
    error: null,
});

/** Resets readiness before Playground starts its application initialization. */
export function beginPlaygroundInitialization(): void {
    publish({
        status: "initializing",
        databaseReady: false,
        esbuildReady: false,
        projectReady: false,
        editorReady: false,
        error: null,
    });
}

export function markPlaygroundDatabaseReady(): void {
    publish({ databaseReady: true });
}

export function markPlaygroundEsbuildReady(): void {
    publish({ esbuildReady: true });
}

export function markPlaygroundProjectReady(): void {
    publish({ projectReady: true });
}

export function markPlaygroundEditorReady(): void {
    publish({ editorReady: true });
}

export function failPlaygroundInitialization(error: unknown): void {
    publish({
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
    });
}

export function getPlaygroundReadiness(): PlaygroundReadinessSnapshot {
    return snapshot;
}

/**
 * Waits for IndexedDB, esbuild, and the active project. Monaco is intentionally
 * reported separately because portrait project mode does not mount an editor.
 */
export function waitForPlaygroundReady(): Promise<PlaygroundReadinessSnapshot> {
    if (snapshot.status === "ready") return Promise.resolve(snapshot);
    if (snapshot.status === "error") {
        return Promise.reject(
            snapshot.error ?? new Error("Playground initialization failed"),
        );
    }

    return new Promise((resolve, reject) => {
        waiters.add({ resolve, reject });
    });
}

export function subscribeToPlaygroundReadiness(
    listener: ReadinessListener,
): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function publish(update: Partial<PlaygroundReadinessSnapshot>): void {
    const next = { ...snapshot, ...update };
    const coreReady = next.databaseReady && next.esbuildReady
        && next.projectReady;

    if (next.status !== "error") {
        next.status = coreReady ? "ready" : "initializing";
        next.error = null;
    }

    snapshot = Object.freeze(next);

    for (const listener of listeners) {
        try {
            listener(snapshot);
        } catch {
            // Readiness observers must not interrupt application initialization.
        }
    }

    if (snapshot.status === "ready") {
        for (const waiter of waiters) waiter.resolve(snapshot);
        waiters.clear();
    } else if (snapshot.status === "error") {
        const error = snapshot.error
            ?? new Error("Playground initialization failed");
        for (const waiter of waiters) waiter.reject(error);
        waiters.clear();
    }
}
