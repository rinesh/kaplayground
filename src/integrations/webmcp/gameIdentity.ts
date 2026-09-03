import { KaplaygroundToolError } from "./toolResults.ts";

export interface GameIdentityState {
    projectGeneration: number;
    project: {
        files: ReadonlyMap<string, unknown>;
        assets: ReadonlyMap<string, unknown>;
        kaplayVersion: string;
        mode: string;
        buildMode: string;
        [key: string]: unknown;
    };
}

export interface RuntimeIdentityInput {
    applicationCommit: string;
    engineCommit: string;
    protocolVersion: number;
    engineModuleUrl: string;
}

const mapHashCache = new WeakMap<ReadonlyMap<string, unknown>, string>();

export function gameContentRevision(state: GameIdentityState): string {
    assertGeneration(state.projectGeneration);
    const hash = createHash();
    hash.add("kaplayground-content-v1");
    hash.add(state.project.kaplayVersion);
    hash.add(state.project.mode);
    hash.add(state.project.buildMode);
    hash.add(mapDigest(state.project.files));
    hash.add(mapDigest(state.project.assets));
    return `${state.projectGeneration}:c:${hash.digest()}`;
}

export function gameRuntimeFingerprint(
    state: GameIdentityState,
    runtime: RuntimeIdentityInput,
): string {
    const hash = createHash();
    hash.add("kaplayground-runtime-v1");
    hash.add(gameContentRevision(state));
    hashValue(hash, runtime);
    return `r:${hash.digest()}`;
}

export function gameProjectFingerprint(project: unknown): string {
    const hash = createHash();
    hash.add("kaplayground-project-v1");
    hashValue(hash, canonicalProject(project));
    return `p:${hash.digest()}`;
}

export function assertGameContentRevision(
    state: GameIdentityState,
    expectedContentRevision: string,
): void {
    const actualContentRevision = gameContentRevision(state);
    if (actualContentRevision === expectedContentRevision) return;
    throw new KaplaygroundToolError(
        "STALE_CONTENT_REVISION",
        `The executable game changed since it was inspected. Expected content revision ${expectedContentRevision}, found ${actualContentRevision}. Inspect the game again before continuing.`,
        {
            retryable: true,
            details: {
                expectedContentRevision,
                actualContentRevision,
                suggestedAction: "kaplayground_inspect_game",
            },
        },
    );
}

export function assertGameRuntimeFingerprint(
    actualRuntimeFingerprint: string | null,
    expectedRuntimeFingerprint: string,
): void {
    if (actualRuntimeFingerprint === expectedRuntimeFingerprint) return;
    throw new KaplaygroundToolError(
        "STALE_RUNTIME_FINGERPRINT",
        actualRuntimeFingerprint === null
            ? "The active preview has no verified runtime fingerprint. Restart and check the game before continuing."
            : `The active preview belongs to runtime ${actualRuntimeFingerprint}, not ${expectedRuntimeFingerprint}. Restart and check the requested game first.`,
        {
            retryable: true,
            details: {
                expectedRuntimeFingerprint,
                actualRuntimeFingerprint,
                suggestedAction: "kaplayground_run_game",
            },
        },
    );
}

function canonicalProject(value: unknown): unknown {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return value;
    }
    if (value instanceof Map || value instanceof Date) return value;
    const project = value as Record<string, unknown>;
    return Object.fromEntries(
        Object.entries(project).filter(([key]) => key !== "id"),
    );
}

function mapDigest(value: ReadonlyMap<string, unknown>): string {
    const cached = mapHashCache.get(value);
    if (cached) return cached;
    const hash = createHash();
    hashMap(hash, value);
    const digest = hash.digest();
    mapHashCache.set(value, digest);
    return digest;
}

function hashMap(hash: IncrementalHash, value: ReadonlyMap<string, unknown>): void {
    hash.add("map");
    // Map order is executable state for legacy builds, so preserve insertion
    // order instead of canonicalizing by path.
    const entries = [...value.entries()];
    hash.add(String(entries.length));
    for (const [key, item] of entries) {
        hash.add(key);
        hashValue(hash, item);
    }
}

function hashValue(
    hash: IncrementalHash,
    value: unknown,
    seen = new WeakSet<object>(),
): void {
    if (value === null) {
        hash.add("null");
        return;
    }
    const type = typeof value;
    if (type === "string") {
        hash.add("string");
        hash.add(value as string);
        return;
    }
    if (type === "number" || type === "boolean" || type === "bigint") {
        hash.add(type);
        hash.add(String(value));
        return;
    }
    if (type === "undefined") {
        hash.add("undefined");
        return;
    }
    if (type !== "object") {
        hash.add(type);
        hash.add(String(value));
        return;
    }

    const object = value as object;
    if (seen.has(object)) {
        hash.add("circular");
        return;
    }
    seen.add(object);
    if (value instanceof Map) {
        hashMap(hash, value as ReadonlyMap<string, unknown>);
        return;
    }
    if (Array.isArray(value)) {
        hash.add("array");
        hash.add(String(value.length));
        for (const item of value) hashValue(hash, item, seen);
        return;
    }
    if (value instanceof Date) {
        hash.add("date");
        hash.add(value.toISOString());
        return;
    }

    hash.add("object");
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    hash.add(String(keys.length));
    for (const key of keys) {
        hash.add(key);
        hashValue(hash, record[key], seen);
    }
}

interface IncrementalHash {
    add(value: string): void;
    digest(): string;
}

function createHash(): IncrementalHash {
    let value = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    const mask = 0xffffffffffffffffn;
    const encoder = new TextEncoder();
    return {
        add(input) {
            const bytes = encoder.encode(`${input.length}:`);
            for (const byte of bytes) {
                value ^= BigInt(byte);
                value = (value * prime) & mask;
            }
            const content = encoder.encode(input);
            for (const byte of content) {
                value ^= BigInt(byte);
                value = (value * prime) & mask;
            }
        },
        digest() {
            return value.toString(16).padStart(16, "0");
        },
    };
}

function assertGeneration(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(
            "projectGeneration must be a non-negative safe integer.",
        );
    }
}
