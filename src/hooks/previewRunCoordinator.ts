export interface PreviewRunCoordinator {
    run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>;
    cancel(): void;
}

interface PreviewRunBatch {
    controller: AbortController | null;
    generation: number;
    promise: Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
}

/** Coalesces overlapping preview runs while canceling every superseded task. */
export function createPreviewRunCoordinator(): PreviewRunCoordinator {
    let activeBatch: PreviewRunBatch | null = null;

    const run = <T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> => {
        let batch = activeBatch;

        if (!batch) {
            let resolve!: (value: unknown) => void;
            let reject!: (error: unknown) => void;
            const promise = new Promise<unknown>((onResolve, onReject) => {
                resolve = onResolve;
                reject = onReject;
            });

            batch = {
                controller: null,
                generation: 0,
                promise,
                resolve,
                reject,
            };
            activeBatch = batch;
        } else {
            batch.controller?.abort();
        }

        const generation = batch.generation + 1;
        const controller = new AbortController();
        batch.controller = controller;
        batch.generation = generation;

        let execution: Promise<T>;
        try {
            controller.signal.throwIfAborted();
            execution = task(controller.signal);
        } catch (error) {
            execution = Promise.reject(error);
        }

        void execution.then(
            (value) => {
                if (
                    activeBatch !== batch
                    || batch.generation !== generation
                ) return;

                activeBatch = null;
                batch.resolve(value);
            },
            (error: unknown) => {
                if (
                    activeBatch !== batch
                    || batch.generation !== generation
                ) return;

                activeBatch = null;
                batch.reject(controller.signal.reason ?? error);
            },
        );

        // Every caller in a coalesced batch receives the newest task's result.
        return batch.promise as Promise<T>;
    };

    return {
        run,
        cancel() {
            const batch = activeBatch;
            if (!batch) return;

            activeBatch = null;
            const error = new DOMException(
                "The preview run was cancelled.",
                "AbortError",
            );
            batch.controller?.abort(error);
            batch.reject(error);
        },
    };
}
