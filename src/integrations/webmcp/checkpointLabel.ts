export const MAX_CHECKPOINT_LABEL_LENGTH = 120;

/** Optional user-visible intent, not a claim that a preview has passed checks. */
export function validateCheckpointLabel(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
        throw new TypeError("checkpointLabel must be a string.");
    }
    if (value.length > MAX_CHECKPOINT_LABEL_LENGTH || value.trim().length === 0) {
        throw new RangeError(`checkpointLabel must contain 1 to ${MAX_CHECKPOINT_LABEL_LENGTH} characters.`);
    }
    if (/[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(value)) {
        throw new TypeError("checkpointLabel cannot contain control or direction-override characters.");
    }
    return value.trim();
}
