import {
    normalizePreviewKey,
    parsePreviewExerciseActions,
    PREVIEW_PRESS_DURATION_MS,
} from "../shared/previewProtocol.ts";

const INPUT_PROVENANCE = "sandbox-simulated";

export function createRuntimeExercise({
    getRunId,
    inspectRuntime,
    findCanvas = () => document.querySelector("canvas"),
    getWindow = () => window,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    createKeyboardEvent = (type, options) => new KeyboardEvent(type, options),
    createPointerEvent = (type, options) =>
        typeof PointerEvent === "function"
            ? new PointerEvent(type, options)
            : new MouseEvent(type.replace("pointer", "mouse"), options),
}) {
    return async function exerciseRuntime({ runId, actions, signal }) {
        throwIfAborted(signal);
        if (runId !== getRunId()) {
            throw new Error("The requested preview run is no longer active.");
        }
        const parsed = parsePreviewExerciseActions(actions);
        const inputWasRequested = parsed.some(action =>
            action.type === "press"
            || action.type === "hold"
            || action.type === "click"
        );
        const canvas = findCanvas();
        if (inputWasRequested && !canvas) {
            throw new Error("The running game has no canvas for input.");
        }
        if (inputWasRequested && canvas) {
            if (!canvas.hasAttribute?.("tabindex")) canvas.tabIndex = 0;
            canvas.focus?.({ preventScroll: true });
        }

        const checkpoints = [];
        let inputActionCount = 0;
        let assertionCount = 0;
        for (const action of parsed) {
            throwIfAborted(signal);
            assertActiveRun(getRunId, runId);
            if (action.type === "checkpoint") {
                const inspection = inspectRuntime({
                    tag: action.tag,
                    limit: action.limit,
                });
                const evaluation = evaluateCheckpoint(
                    inspection,
                    action.expect,
                    checkpoints,
                );
                assertionCount += evaluation.length;
                checkpoints.push({
                    name: action.name,
                    passed: evaluation.every(check => check.passed),
                    checks: evaluation,
                    inspection,
                });
                continue;
            }

            if (action.type === "press") {
                inputActionCount++;
                dispatchKey(getWindow(), action.key, false, createKeyboardEvent);
                try {
                    await waitWithAbort(
                        sleep,
                        PREVIEW_PRESS_DURATION_MS,
                        signal,
                    );
                } finally {
                    dispatchKey(
                        getWindow(),
                        action.key,
                        true,
                        createKeyboardEvent,
                    );
                }
                assertActiveRun(getRunId, runId);
                continue;
            }
            if (action.type === "hold") {
                inputActionCount++;
                dispatchKey(getWindow(), action.key, false, createKeyboardEvent);
                try {
                    await waitWithAbort(sleep, action.durationMs, signal);
                } finally {
                    dispatchKey(
                        getWindow(),
                        action.key,
                        true,
                        createKeyboardEvent,
                    );
                }
                assertActiveRun(getRunId, runId);
                continue;
            }
            if (action.type === "wait") {
                await waitWithAbort(sleep, action.durationMs, signal);
                throwIfAborted(signal);
                assertActiveRun(getRunId, runId);
                continue;
            }
            inputActionCount++;
            dispatchClick(canvas, action, createPointerEvent);
        }

        throwIfAborted(signal);
        assertActiveRun(getRunId, runId);
        const finalInspection = inspectRuntime({ limit: 0 });
        return {
            runId,
            inputProvenance: INPUT_PROVENANCE,
            actionCount: parsed.length,
            inputActionCount,
            checkpointCount: checkpoints.length,
            assertionCount,
            passed: checkpoints.every(checkpoint => checkpoint.passed),
            checkpoints,
            finalInspection,
        };
    };
}

export function evaluateCheckpoint(
    inspection,
    expectation,
    previousCheckpoints = [],
) {
    if (!expectation) return [];
    const checks = [];
    if (expectation.scene !== undefined) {
        checks.push(check(
            "scene",
            inspection.scene === expectation.scene,
            expectation.scene,
            inspection.scene,
        ));
    }
    if (expectation.canvasFocused !== undefined) {
        checks.push(check(
            "canvasFocused",
            inspection.canvasFocused === expectation.canvasFocused,
            expectation.canvasFocused,
            inspection.canvasFocused,
        ));
    }
    if (expectation.objectCountAtLeast !== undefined) {
        checks.push(check(
            "objectCountAtLeast",
            typeof inspection.objectCount === "number"
                && inspection.objectCount >= expectation.objectCountAtLeast,
            expectation.objectCountAtLeast,
            inspection.objectCount,
        ));
    }
    if (expectation.objectCountAtMost !== undefined) {
        checks.push(check(
            "objectCountAtMost",
            typeof inspection.objectCount === "number"
                && inspection.objectCount <= expectation.objectCountAtMost,
            expectation.objectCountAtMost,
            inspection.objectCount,
        ));
    }
    if (expectation.layoutWarningsEmpty !== undefined) {
        const warningCount = Array.isArray(inspection.layoutWarnings)
            ? inspection.layoutWarnings.length
            : null;
        checks.push(check(
            "layoutWarningsEmpty",
            warningCount !== null
                && (warningCount === 0) === expectation.layoutWarningsEmpty,
            expectation.layoutWarningsEmpty,
            warningCount === null ? null : warningCount === 0,
        ));
    }
    if (expectation.firstObjectPosition !== undefined) {
        const position = inspection.objects?.[0]?.position ?? null;
        for (
            const [name, expected, operation] of [
                ["xAtLeast", expectation.firstObjectPosition.xAtLeast, (value, target) => value >= target],
                ["xAtMost", expectation.firstObjectPosition.xAtMost, (value, target) => value <= target],
                ["yAtLeast", expectation.firstObjectPosition.yAtLeast, (value, target) => value >= target],
                ["yAtMost", expectation.firstObjectPosition.yAtMost, (value, target) => value <= target],
            ]
        ) {
            if (expected === undefined) continue;
            const axis = name[0];
            const actual = position?.[axis] ?? null;
            checks.push(check(
                `firstObjectPosition:${name}`,
                typeof actual === "number" && operation(actual, expected),
                expected,
                actual,
            ));
        }
    }
    if (expectation.firstObjectMovedFrom !== undefined) {
        const previous = previousCheckpoints.find(checkpoint =>
            checkpoint.name === expectation.firstObjectMovedFrom.checkpoint
        );
        const before = previous?.inspection?.objects?.[0]?.position ?? null;
        const after = inspection.objects?.[0]?.position ?? null;
        const axis = expectation.firstObjectMovedFrom.axis;
        let distance = null;
        if (before && after) {
            distance = axis === "x"
                ? Math.abs(after.x - before.x)
                : axis === "y"
                ? Math.abs(after.y - before.y)
                : Math.hypot(after.x - before.x, after.y - before.y);
        }
        checks.push(check(
            "firstObjectMovedFrom",
            typeof distance === "number"
                && distance >= expectation.firstObjectMovedFrom.minDistance,
            expectation.firstObjectMovedFrom,
            { before, after, distance },
        ));
    }
    for (const expectedText of expectation.textIncludes ?? []) {
        const text = (inspection.objects ?? [])
            .map(object => typeof object.text === "string" ? object.text : "")
            .join("\n");
        checks.push(check(
            `textIncludes:${expectedText}`,
            text.includes(expectedText),
            expectedText,
            text.slice(0, 500),
        ));
    }
    return checks;
}

function dispatchKey(target, requestedKey, released, createKeyboardEvent) {
    const key = normalizePreviewKey(requestedKey);
    target.dispatchEvent(createKeyboardEvent(released ? "keyup" : "keydown", {
        bubbles: true,
        cancelable: true,
        key: key.key,
        code: key.code,
        keyCode: key.keyCode,
        which: key.keyCode,
    }));
}

function dispatchClick(canvas, action, createPointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + rect.width * action.x;
    const clientY = rect.top + rect.height * action.y;
    const base = {
        bubbles: true,
        cancelable: true,
        button: action.button,
        buttons: 1 << action.button,
        clientX,
        clientY,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
    };
    canvas.dispatchEvent(createPointerEvent("pointermove", base));
    canvas.dispatchEvent(createPointerEvent("pointerdown", base));
    canvas.dispatchEvent(createPointerEvent("pointerup", { ...base, buttons: 0 }));
    canvas.dispatchEvent(createPointerEvent("click", { ...base, buttons: 0 }));
}

function assertActiveRun(getRunId, expectedRunId) {
    if (getRunId() !== expectedRunId) {
        throw new Error("The preview run changed while the input sequence was executing.");
    }
}

function check(name, passed, expected, actual) {
    return { name, passed, expected, actual };
}


function waitWithAbort(sleep, milliseconds, signal) {
    if (!signal) return sleep(milliseconds);
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = operation => value => {
            if (settled) return;
            settled = true;
            signal.removeEventListener("abort", aborted);
            operation(value);
        };
        const succeeded = finish(resolve);
        const failed = finish(reject);
        const aborted = () => failed(abortReason(signal));
        signal.addEventListener("abort", aborted, { once: true });
        Promise.resolve(sleep(milliseconds)).then(succeeded, failed);
    });
}

function throwIfAborted(signal) {
    if (!signal?.aborted) return;
    throw abortReason(signal);
}

function abortReason(signal) {
    return signal?.reason instanceof Error
        ? signal.reason
        : new DOMException("The input sequence was canceled.", "AbortError");
}
