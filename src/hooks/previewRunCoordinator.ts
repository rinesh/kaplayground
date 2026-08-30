export interface PreviewRunCoordinator {
    run(task: (signal: AbortSignal) => Promise<void>): Promise<void>;
    cancel(): void;
}

interface PreviewRunBatch {
    controller: AbortController | null;
    generation: number;
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: unknown) => void;
}

/** Coalesces overlapping preview runs while canceling every superseded task. */
export function createPreviewRunCoordinator(): PreviewRunCoordinator {
    let activeBatch: PreviewRunBatch | null = null;

    const run = (task: (signal: AbortSignal) => Promise<void>) => {
        let batch = activeBatch;

        if (!batch) {
            let resolve!: () => void;
            let reject!: (error: unknown) => void;
            const promise = new Promise<void>((onResolve, onReject) => {
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

        let execution: Promise<void>;
        try {
            controller.signal.throwIfAborted();
            execution = task(controller.signal);
        }
        catch (error) {
            execution = Promise.reject(error);
        }

        void execution.then(
            () => {
                if (
                    activeBatch !== batch
                    || batch.generation !== generation
                ) return;

                activeBatch = null;
                batch.resolve();
            },
            (error: unknown) => {
                if (
                    activeBatch !== batch
                    || batch.generation !== generation
                ) return;

                activeBatch = null;
                if (controller.signal.aborted) batch.resolve();
                else batch.reject(error);
            },
        );

        return batch.promise;
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
