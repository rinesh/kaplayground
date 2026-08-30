const STORAGE_KEY_PREFIX = "kaplayground-codex-play-step-v3";
const inMemorySteps = new Map<string, number>();

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export function readCodexPlayStepIndex(
    guideKey: string,
    stepCount: number,
    storage: StorageReader = localStorage,
): number {
    const inMemoryStep = inMemorySteps.get(guideKey);
    if (inMemoryStep !== undefined) {
        return clampCodexPlayStep(inMemoryStep, stepCount);
    }

    try {
        const storedStep = clampCodexPlayStep(
            Number(storage.getItem(codexPlayStorageKey(guideKey)) ?? 0),
            stepCount,
        );
        inMemorySteps.set(guideKey, storedStep);
        return storedStep;
    } catch {
        return 0;
    }
}

export function writeCodexPlayStepIndex(
    guideKey: string,
    stepIndex: number,
    storage: StorageWriter = localStorage,
): void {
    inMemorySteps.set(guideKey, stepIndex);
    try {
        storage.setItem(codexPlayStorageKey(guideKey), String(stepIndex));
    } catch {
        // The tutorial still works when browser storage is unavailable.
    }
}

export function clampCodexPlayStep(
    value: number,
    stepCount: number,
): number {
    if (!Number.isInteger(value)) return 0;
    return Math.max(0, Math.min(Math.max(0, stepCount - 1), value));
}

function codexPlayStorageKey(guideKey: string): string {
    return `${STORAGE_KEY_PREFIX}:${guideKey}`;
}
