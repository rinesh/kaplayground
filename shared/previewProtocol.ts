export const PREVIEW_PROTOCOL_VERSION = 3;
export const MAX_PREVIEW_EXERCISE_ACTIONS = 30;
export const MAX_PREVIEW_EXERCISE_DURATION_MS = 5_000;
export const MAX_PREVIEW_ACTION_DURATION_MS = 2_000;
export const MAX_PREVIEW_CHECKPOINTS = 12;
export const MAX_PREVIEW_CHECKPOINT_OBJECTS = 20;
export const MAX_PREVIEW_EXPECTED_TEXT = 10;
export const PREVIEW_PRESS_DURATION_MS = 34;

export type PreviewExerciseInputAction =
    | { type: "press"; key: string }
    | { type: "hold"; key: string; durationMs: number }
    | { type: "click"; x: number; y: number; button: 0 | 1 | 2 }
    | { type: "wait"; durationMs: number };

export interface PreviewPositionExpectation {
    xAtLeast?: number;
    xAtMost?: number;
    yAtLeast?: number;
    yAtMost?: number;
}

export interface PreviewMovementExpectation {
    checkpoint: string;
    minDistance: number;
    axis: "x" | "y" | "either";
}

export interface PreviewCheckpointExpectation {
    scene?: string;
    textIncludes?: string[];
    objectCountAtLeast?: number;
    objectCountAtMost?: number;
    canvasFocused?: boolean;
    layoutWarningsEmpty?: boolean;
    firstObjectPosition?: PreviewPositionExpectation;
    firstObjectMovedFrom?: PreviewMovementExpectation;
}

export interface PreviewExerciseCheckpointAction {
    type: "checkpoint";
    name: string;
    tag?: string;
    limit: number;
    expect?: PreviewCheckpointExpectation;
}

export type PreviewExerciseAction =
    | PreviewExerciseInputAction
    | PreviewExerciseCheckpointAction;

export interface NormalizedPreviewKey {
    key: string;
    code: string;
    keyCode: number;
}

const NAMED_KEYS: Record<string, NormalizedPreviewKey> = {
    ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    ArrowRight: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
    Space: { key: " ", code: "Space", keyCode: 32 },
    Enter: { key: "Enter", code: "Enter", keyCode: 13 },
    Escape: { key: "Escape", code: "Escape", keyCode: 27 },
    Tab: { key: "Tab", code: "Tab", keyCode: 9 },
    Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
    Delete: { key: "Delete", code: "Delete", keyCode: 46 },
    Home: { key: "Home", code: "Home", keyCode: 36 },
    End: { key: "End", code: "End", keyCode: 35 },
    PageUp: { key: "PageUp", code: "PageUp", keyCode: 33 },
    PageDown: { key: "PageDown", code: "PageDown", keyCode: 34 },
};

export function normalizePreviewKey(value: unknown): NormalizedPreviewKey {
    const requested = boundedString(value, "key", 32);
    const named = NAMED_KEYS[requested];
    if (named) return { ...named };
    if (requested === " ") return { ...NAMED_KEYS.Space };

    if (/^[a-z]$/i.test(requested)) {
        const upper = requested.toUpperCase();
        return {
            key: requested,
            code: `Key${upper}`,
            keyCode: upper.charCodeAt(0),
        };
    }
    if (/^[0-9]$/.test(requested)) {
        return {
            key: requested,
            code: `Digit${requested}`,
            keyCode: requested.charCodeAt(0),
        };
    }

    throw new TypeError(
        "key must be a letter, digit, arrow, Space, Enter, Escape, Tab, Backspace, Delete, Home, End, PageUp, or PageDown.",
    );
}

export function parsePreviewExerciseActions(
    value: unknown,
): PreviewExerciseAction[] {
    if (!Array.isArray(value)) {
        throw new TypeError("actions must be an array.");
    }
    if (value.length === 0 || value.length > MAX_PREVIEW_EXERCISE_ACTIONS) {
        throw new RangeError(
            `actions must contain between 1 and ${MAX_PREVIEW_EXERCISE_ACTIONS} items.`,
        );
    }

    let totalDurationMs = 0;
    let checkpoints = 0;
    const checkpointNames = new Set<string>();
    const actions = value.map((item, index): PreviewExerciseAction => {
        const action = record(item, `actions[${index}]`);
        const type = boundedString(action.type, `actions[${index}].type`, 20);

        if (type === "press") {
            assertKeys(action, ["type", "key"], `actions[${index}]`);
            const key = boundedString(action.key, `actions[${index}].key`, 32);
            normalizePreviewKey(key);
            totalDurationMs += PREVIEW_PRESS_DURATION_MS;
            return { type, key };
        }

        if (type === "hold") {
            assertKeys(
                action,
                ["type", "key", "durationMs"],
                `actions[${index}]`,
            );
            const key = boundedString(action.key, `actions[${index}].key`, 32);
            normalizePreviewKey(key);
            const durationMs = integer(
                action.durationMs,
                `actions[${index}].durationMs`,
                1,
                MAX_PREVIEW_ACTION_DURATION_MS,
            );
            totalDurationMs += durationMs;
            return { type, key, durationMs };
        }

        if (type === "click") {
            assertKeys(
                action,
                ["type", "x", "y", "button"],
                `actions[${index}]`,
            );
            const button = action.button === undefined
                ? 0
                : integer(action.button, `actions[${index}].button`, 0, 2);
            return {
                type,
                x: unitNumber(action.x, `actions[${index}].x`),
                y: unitNumber(action.y, `actions[${index}].y`),
                button: button as 0 | 1 | 2,
            };
        }

        if (type === "wait") {
            assertKeys(action, ["type", "durationMs"], `actions[${index}]`);
            const durationMs = integer(
                action.durationMs,
                `actions[${index}].durationMs`,
                1,
                MAX_PREVIEW_ACTION_DURATION_MS,
            );
            totalDurationMs += durationMs;
            return { type, durationMs };
        }

        if (type === "checkpoint") {
            assertKeys(
                action,
                ["type", "name", "tag", "limit", "expect"],
                `actions[${index}]`,
            );
            checkpoints++;
            if (checkpoints > MAX_PREVIEW_CHECKPOINTS) {
                throw new RangeError(
                    `actions may contain at most ${MAX_PREVIEW_CHECKPOINTS} checkpoints.`,
                );
            }
            const tag = action.tag === undefined
                ? undefined
                : boundedString(action.tag, `actions[${index}].tag`, 128);
            const name = boundedString(
                action.name,
                `actions[${index}].name`,
                80,
            );
            if (checkpointNames.has(name)) {
                throw new TypeError(
                    `actions contains more than one checkpoint named "${name}".`,
                );
            }
            checkpointNames.add(name);
            return {
                type,
                name,
                tag,
                limit: action.limit === undefined
                    ? 10
                    : integer(
                        action.limit,
                        `actions[${index}].limit`,
                        0,
                        MAX_PREVIEW_CHECKPOINT_OBJECTS,
                    ),
                expect: action.expect === undefined
                    ? undefined
                    : parseExpectation(
                        action.expect,
                        `actions[${index}].expect`,
                    ),
            };
        }

        throw new TypeError(
            `actions[${index}].type must be press, hold, click, wait, or checkpoint.`,
        );
    });

    if (totalDurationMs > MAX_PREVIEW_EXERCISE_DURATION_MS) {
        throw new RangeError(
            `actions request ${totalDurationMs} ms of input time, above the ${MAX_PREVIEW_EXERCISE_DURATION_MS} ms sequence limit.`,
        );
    }
    return actions;
}

export function previewExerciseActionsSchema(): object {
    const duration = {
        type: "integer",
        minimum: 1,
        maximum: MAX_PREVIEW_ACTION_DURATION_MS,
    };
    const key = {
        type: "string",
        minLength: 1,
        maxLength: 32,
        description:
            "A letter, digit, arrow, Space, Enter, Escape, Tab, Backspace, Delete, Home, End, PageUp, or PageDown.",
    };
    return {
        type: "array",
        minItems: 1,
        maxItems: MAX_PREVIEW_EXERCISE_ACTIONS,
        description:
            "Optional bounded controls and verification checkpoints. Input is sandbox-simulated and explicitly identified as such in the result.",
        items: {
            oneOf: [
                actionSchema("press", { key }, ["key"]),
                actionSchema(
                    "hold",
                    { key, durationMs: duration },
                    ["key", "durationMs"],
                ),
                actionSchema(
                    "click",
                    {
                        x: { type: "number", minimum: 0, maximum: 1 },
                        y: { type: "number", minimum: 0, maximum: 1 },
                        button: {
                            type: "integer",
                            enum: [0, 1, 2],
                            default: 0,
                        },
                    },
                    ["x", "y"],
                ),
                actionSchema(
                    "wait",
                    { durationMs: duration },
                    ["durationMs"],
                ),
                actionSchema(
                    "checkpoint",
                    {
                        name: {
                            type: "string",
                            minLength: 1,
                            maxLength: 80,
                        },
                        tag: {
                            type: "string",
                            minLength: 1,
                            maxLength: 128,
                        },
                        limit: {
                            type: "integer",
                            minimum: 0,
                            maximum: MAX_PREVIEW_CHECKPOINT_OBJECTS,
                            default: 10,
                        },
                        expect: checkpointExpectationSchema(),
                    },
                    ["name"],
                ),
            ],
        },
    };
}

function actionSchema(
    type: PreviewExerciseAction["type"],
    properties: Record<string, object>,
    required: string[],
): object {
    return {
        type: "object",
        properties: {
            type: { type: "string", enum: [type] },
            ...properties,
        },
        required: ["type", ...required],
        additionalProperties: false,
    };
}

function checkpointExpectationSchema(): object {
    return {
        type: "object",
        properties: {
            scene: { type: "string", minLength: 1, maxLength: 128 },
            textIncludes: {
                type: "array",
                maxItems: MAX_PREVIEW_EXPECTED_TEXT,
                uniqueItems: true,
                items: { type: "string", minLength: 1, maxLength: 128 },
            },
            objectCountAtLeast: {
                type: "integer",
                minimum: 0,
                maximum: 10_000,
            },
            objectCountAtMost: {
                type: "integer",
                minimum: 0,
                maximum: 10_000,
            },
            canvasFocused: { type: "boolean" },
            layoutWarningsEmpty: { type: "boolean" },
            firstObjectPosition: {
                type: "object",
                properties: {
                    xAtLeast: { type: "number" },
                    xAtMost: { type: "number" },
                    yAtLeast: { type: "number" },
                    yAtMost: { type: "number" },
                },
                additionalProperties: false,
            },
            firstObjectMovedFrom: {
                type: "object",
                properties: {
                    checkpoint: {
                        type: "string",
                        minLength: 1,
                        maxLength: 80,
                    },
                    minDistance: {
                        type: "number",
                        minimum: 0,
                        maximum: 100_000,
                    },
                    axis: {
                        type: "string",
                        enum: ["x", "y", "either"],
                        default: "either",
                    },
                },
                required: ["checkpoint", "minDistance"],
                additionalProperties: false,
            },
        },
        additionalProperties: false,
    };
}

function parseExpectation(
    value: unknown,
    name: string,
): PreviewCheckpointExpectation {
    const expectation = record(value, name);
    assertKeys(
        expectation,
        [
            "scene",
            "textIncludes",
            "objectCountAtLeast",
            "objectCountAtMost",
            "canvasFocused",
            "layoutWarningsEmpty",
            "firstObjectPosition",
            "firstObjectMovedFrom",
        ],
        name,
    );

    const minimum = expectation.objectCountAtLeast === undefined
        ? undefined
        : integer(
            expectation.objectCountAtLeast,
            `${name}.objectCountAtLeast`,
            0,
            10_000,
        );
    const maximum = expectation.objectCountAtMost === undefined
        ? undefined
        : integer(
            expectation.objectCountAtMost,
            `${name}.objectCountAtMost`,
            0,
            10_000,
        );
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        throw new RangeError(
            `${name}.objectCountAtLeast cannot exceed objectCountAtMost.`,
        );
    }

    return {
        scene: expectation.scene === undefined
            ? undefined
            : boundedString(expectation.scene, `${name}.scene`, 128),
        textIncludes: expectation.textIncludes === undefined
            ? undefined
            : stringArray(
                expectation.textIncludes,
                `${name}.textIncludes`,
                MAX_PREVIEW_EXPECTED_TEXT,
                128,
            ),
        objectCountAtLeast: minimum,
        objectCountAtMost: maximum,
        canvasFocused: optionalBoolean(
            expectation.canvasFocused,
            `${name}.canvasFocused`,
        ),
        layoutWarningsEmpty: optionalBoolean(
            expectation.layoutWarningsEmpty,
            `${name}.layoutWarningsEmpty`,
        ),
        firstObjectPosition: expectation.firstObjectPosition === undefined
            ? undefined
            : parsePositionExpectation(
                expectation.firstObjectPosition,
                `${name}.firstObjectPosition`,
            ),
        firstObjectMovedFrom: expectation.firstObjectMovedFrom === undefined
            ? undefined
            : parseMovementExpectation(
                expectation.firstObjectMovedFrom,
                `${name}.firstObjectMovedFrom`,
            ),
    };
}


function parsePositionExpectation(
    value: unknown,
    name: string,
): PreviewPositionExpectation {
    const position = record(value, name);
    assertKeys(
        position,
        ["xAtLeast", "xAtMost", "yAtLeast", "yAtMost"],
        name,
    );
    const result = {
        xAtLeast: optionalFiniteNumber(position.xAtLeast, `${name}.xAtLeast`),
        xAtMost: optionalFiniteNumber(position.xAtMost, `${name}.xAtMost`),
        yAtLeast: optionalFiniteNumber(position.yAtLeast, `${name}.yAtLeast`),
        yAtMost: optionalFiniteNumber(position.yAtMost, `${name}.yAtMost`),
    };
    if (
        result.xAtLeast !== undefined
        && result.xAtMost !== undefined
        && result.xAtLeast > result.xAtMost
    ) {
        throw new RangeError(`${name}.xAtLeast cannot exceed xAtMost.`);
    }
    if (
        result.yAtLeast !== undefined
        && result.yAtMost !== undefined
        && result.yAtLeast > result.yAtMost
    ) {
        throw new RangeError(`${name}.yAtLeast cannot exceed yAtMost.`);
    }
    return result;
}

function parseMovementExpectation(
    value: unknown,
    name: string,
): PreviewMovementExpectation {
    const movement = record(value, name);
    assertKeys(movement, ["checkpoint", "minDistance", "axis"], name);
    const axis = movement.axis === undefined ? "either" : movement.axis;
    if (axis !== "x" && axis !== "y" && axis !== "either") {
        throw new TypeError(`${name}.axis must be x, y, or either.`);
    }
    const minDistance = finiteNumber(movement.minDistance, `${name}.minDistance`);
    if (minDistance < 0 || minDistance > 100_000) {
        throw new RangeError(
            `${name}.minDistance must be between 0 and 100000.`,
        );
    }
    return {
        checkpoint: boundedString(
            movement.checkpoint,
            `${name}.checkpoint`,
            80,
        ),
        minDistance,
        axis,
    };
}

function record(value: unknown, name: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError(`${name} must be an object.`);
    }
    return value as Record<string, unknown>;
}

function assertKeys(
    value: Record<string, unknown>,
    allowed: readonly string[],
    name: string,
): void {
    const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
    if (unexpected) {
        throw new TypeError(
            `${name} contains unsupported property "${unexpected}".`,
        );
    }
}

function boundedString(value: unknown, name: string, maxLength: number): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError(`${name} must be a non-empty string.`);
    }
    if (value.length > maxLength || /\p{Cc}/u.test(value)) {
        throw new RangeError(
            `${name} must contain at most ${maxLength} visible characters.`,
        );
    }
    return value;
}

function integer(
    value: unknown,
    name: string,
    minimum: number,
    maximum: number,
): number {
    if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
        throw new RangeError(
            `${name} must be an integer between ${minimum} and ${maximum}.`,
        );
    }
    return Number(value);
}

function unitNumber(value: unknown, name: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(`${name} must be a number between 0 and 1.`);
    }
    return value;
}

function stringArray(
    value: unknown,
    name: string,
    maximum: number,
    maxLength: number,
): string[] {
    if (!Array.isArray(value) || value.length > maximum) {
        throw new RangeError(`${name} must contain at most ${maximum} items.`);
    }
    const items = value.map((item, index) =>
        boundedString(item, `${name}[${index}]`, maxLength)
    );
    if (new Set(items).size !== items.length) {
        throw new TypeError(`${name} must not contain duplicates.`);
    }
    return items;
}


function finiteNumber(value: unknown, name: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }
    return value;
}

function optionalFiniteNumber(
    value: unknown,
    name: string,
): number | undefined {
    return value === undefined ? undefined : finiteNumber(value, name);
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") {
        throw new TypeError(`${name} must be a boolean.`);
    }
    return value;
}
