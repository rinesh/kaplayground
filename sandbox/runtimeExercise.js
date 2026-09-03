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
    getFrameCount = () => globalThis._k_ctx?.debug?.numFrames?.(),
    now = () => performance.now(),
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    createKeyboardEvent = (type, options) => new KeyboardEvent(type, options),
    createMouseEvent = (type, options) => new MouseEvent(type, options),
}) {
    function readFrameCount() {
        const count = getFrameCount();
        if (!Number.isFinite(count) || count < 0) {
            throw new Error("The game cannot confirm that it processed simulated input.");
        }
        return count;
    }

    async function waitForInputFrame(previousFrame, minimumMs, signal) {
        const deadline = now() + Math.max(minimumMs, 1_000);
        await waitWithAbort(sleep, minimumMs, signal);
        // A timer can fire between game frames, especially in a slow browser.
        // Wait for the engine's frame counter so each press and release reaches
        // a separate input tick, including across scene transitions.
        while (readFrameCount() <= previousFrame) {
            if (now() >= deadline) {
                throw new DOMException("The game did not process the input before the frame deadline.", "TimeoutError");
            }
            await waitWithAbort(sleep, 16, signal);
        }
        return readFrameCount();
    }

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
        const incompleteReasons = [];
        let inputActionCount = 0;
        let assertionCount = 0;
        let assertedInputActionCount = 0;
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
                const incomplete = evaluation.some(check => check.passed === null);
                if (incomplete || inspection.available === false) {
                    incompleteReasons.push(`Checkpoint "${action.name}" did not have enough inspection evidence.`);
                }
                if (evaluation.some(check =>
                    check.passed !== null
                    && check.name !== "canvasFocused"
                    && check.name !== "layoutWarningsEmpty"
                )) {
                    assertedInputActionCount = inputActionCount;
                }
                checkpoints.push({
                    name: action.name,
                    passed: evaluation.some(check => check.passed === false)
                        ? false
                        : incomplete || evaluation.length === 0 ? null : true,
                    checks: evaluation,
                    inspection,
                });
                continue;
            }

            if (action.type === "press" || action.type === "hold") {
                inputActionCount++;
                let processedFrame = readFrameCount();
                dispatchKey(canvas, action.key, false, createKeyboardEvent);
                try {
                    processedFrame = await waitForInputFrame(
                        processedFrame,
                        action.type === "hold" ? action.durationMs : PREVIEW_PRESS_DURATION_MS,
                        signal,
                    );
                } finally {
                    dispatchKey(
                        canvas,
                        action.key,
                        true,
                        createKeyboardEvent,
                    );
                }
                assertActiveRun(getRunId, runId);
                await waitForInputFrame(processedFrame, PREVIEW_PRESS_DURATION_MS, signal);
                continue;
            }
            if (action.type === "wait") {
                await waitWithAbort(sleep, action.durationMs, signal);
                throwIfAborted(signal);
                assertActiveRun(getRunId, runId);
                continue;
            }
            inputActionCount++;
            await dispatchClick(
                canvas,
                action,
                createMouseEvent,
                readFrameCount,
                waitForInputFrame,
                () => assertActiveRun(getRunId, runId),
                signal,
            );
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
            unassertedInputActionCount: inputActionCount - assertedInputActionCount,
            incompleteReasons,
            passed: checkpoints.every(checkpoint => checkpoint.passed !== false),
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
    const available = inspection.available !== false;
    const objectsAvailable = available && inspection.objectsAvailable !== false
        && Array.isArray(inspection.objects);
    if (expectation.scene !== undefined) {
        checks.push(check(
            "scene",
            inspection.scene === expectation.scene,
            expectation.scene,
            inspection.scene,
            available,
        ));
    }
    if (expectation.canvasFocused !== undefined) {
        checks.push(check(
            "canvasFocused",
            inspection.canvasFocused === expectation.canvasFocused,
            expectation.canvasFocused,
            inspection.canvasFocused,
            available && typeof inspection.canvasFocused === "boolean",
        ));
    }
    if (expectation.objectCountAtLeast !== undefined) {
        checks.push(check(
            "objectCountAtLeast",
            typeof inspection.objectCount === "number"
                && inspection.objectCount >= expectation.objectCountAtLeast,
            expectation.objectCountAtLeast,
            inspection.objectCount,
            available && typeof inspection.objectCount === "number",
        ));
    }
    if (expectation.objectCountAtMost !== undefined) {
        checks.push(check(
            "objectCountAtMost",
            typeof inspection.objectCount === "number"
                && inspection.objectCount <= expectation.objectCountAtMost,
            expectation.objectCountAtMost,
            inspection.objectCount,
            available && typeof inspection.objectCount === "number",
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
            available && warningCount !== null && (
                warningCount > 0
                || (inspection.layoutAvailable === true
                    && inspection.layoutWarningsTruncated !== true)
            ),
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
                objectsAvailable && typeof actual === "number",
            ));
        }
    }
    if (expectation.firstObjectMovedFrom !== undefined) {
        const previous = previousCheckpoints.find(checkpoint =>
            checkpoint.name === expectation.firstObjectMovedFrom.checkpoint
        );
        const before = previous?.inspection?.objects?.[0]?.position ?? null;
        const after = inspection.objects?.[0]?.position ?? null;
        const beforeId = previous?.inspection?.objects?.[0]?.id;
        const afterId = inspection.objects?.[0]?.id;
        const sameObject = beforeId !== undefined && beforeId !== null
            && beforeId === afterId;
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
            objectsAvailable && sameObject && typeof distance === "number",
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
            objectsAvailable && (text.includes(expectedText)
                || (inspection.objectsTruncated !== true
                    && !inspection.objects.some(object => object.textTruncated === true))),
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

async function dispatchClick(canvas, action, createMouseEvent, readFrameCount, waitForInputFrame, assertRun, signal) {
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + rect.width * action.x;
    const clientY = rect.top + rect.height * action.y;
    const base = {
        bubbles: true,
        cancelable: true,
        button: action.button,
        buttons: [1, 4, 2][action.button],
        clientX,
        clientY,
    };
    // KAPLAY consumes mouse events. Synthetic pointer events don't generate
    // compatibility mouse events and cannot establish native pointer capture.
    let processedFrame = readFrameCount();
    canvas.dispatchEvent(createMouseEvent("mousemove", { ...base, buttons: 0 }));
    processedFrame = await waitForInputFrame(processedFrame, PREVIEW_PRESS_DURATION_MS, signal);
    assertRun();
    canvas.dispatchEvent(createMouseEvent("mousedown", base));
    try {
        processedFrame = await waitForInputFrame(processedFrame, PREVIEW_PRESS_DURATION_MS, signal);
    } finally {
        canvas.dispatchEvent(createMouseEvent("mouseup", { ...base, buttons: 0 }));
    }
    throwIfAborted(signal);
    canvas.dispatchEvent(createMouseEvent("click", { ...base, buttons: 0 }));
    await waitForInputFrame(processedFrame, PREVIEW_PRESS_DURATION_MS, signal);
}

function assertActiveRun(getRunId, expectedRunId) {
    if (getRunId() !== expectedRunId) {
        throw new Error("The preview run changed while the input sequence was executing.");
    }
}

function check(name, passed, expected, actual, available = true) {
    return { name, passed: available ? passed : null, expected, actual };
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
