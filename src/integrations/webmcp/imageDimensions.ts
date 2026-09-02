export interface ImageDimensions {
    width: number;
    height: number;
}

export interface SpriteFrameGrid {
    columns: number;
    rows: number;
}

const imageDimensionsCache = new Map<
    string,
    Promise<ImageDimensions | null>
>();

/** Read image dimensions without exposing or copying the source URL. */
export async function readImageDimensions(
    source: string,
    signal: AbortSignal,
): Promise<ImageDimensions | null> {
    if (typeof Image !== "function") return null;
    let pending = imageDimensionsCache.get(source);
    if (!pending) {
        pending = loadImageDimensions(source);
        imageDimensionsCache.set(source, pending);
    }
    return await waitWithAbort(pending, signal);
}

export function spriteFrameGridFromLoader(
    loaderSource: string,
): SpriteFrameGrid {
    return {
        columns: readPositiveInteger(loaderSource, "sliceX") ?? 1,
        rows: readPositiveInteger(loaderSource, "sliceY") ?? 1,
    };
}

export function calculateSpriteFrameDimensions(
    image: ImageDimensions | null,
    grid: SpriteFrameGrid | null | undefined,
): ImageDimensions | null {
    if (!image) return null;
    const columns = positiveInteger(grid?.columns) ?? 1;
    const rows = positiveInteger(grid?.rows) ?? 1;
    return {
        width: image.width / columns,
        height: image.height / rows,
    };
}

function loadImageDimensions(source: string): Promise<ImageDimensions | null> {
    return new Promise((resolve) => {
        const image = new Image();
        let settled = false;
        const finish = (dimensions: ImageDimensions | null) => {
            if (settled) return;
            settled = true;
            image.onload = null;
            image.onerror = null;
            resolve(dimensions);
        };
        image.onload = () => {
            const width = positiveNumber(image.naturalWidth);
            const height = positiveNumber(image.naturalHeight);
            finish(width !== null && height !== null ? { width, height } : null);
        };
        image.onerror = () => finish(null);
        image.decoding = "async";
        image.src = source;
    });
}

function readPositiveInteger(source: string, property: string): number | null {
    const match = source.match(
        new RegExp(`\\b${property}\\s*:\\s*(\\d+)`, "u"),
    );
    return match ? positiveInteger(Number(match[1])) : null;
}

function positiveInteger(value: unknown): number | null {
    return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function positiveNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : null;
}

async function waitWithAbort<T>(
    promise: Promise<T>,
    signal: AbortSignal,
): Promise<T> {
    signal.throwIfAborted();
    return await new Promise<T>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        void promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", abort);
        });
    });
}
