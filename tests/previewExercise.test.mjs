import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    MAX_PREVIEW_EXERCISE_DURATION_MS,
    normalizePreviewKey,
    parsePreviewExerciseActions,
    PREVIEW_PROTOCOL_VERSION,
} from "../shared/previewProtocol.ts";
import {
    createRuntimeExercise,
    evaluateCheckpoint,
} from "../sandbox/runtimeExercise.js";
import {
    KAPLAYGROUND_WEBMCP_TOOL_SURFACE,
} from "../src/integrations/webmcp/gameTools.ts";

function event(type, options) {
    const value = new Event(type, { bubbles: true, cancelable: true });
    for (const [key, item] of Object.entries(options)) {
        Object.defineProperty(value, key, { value: item, enumerable: true });
    }
    return value;
}

function canvasFixture() {
    const canvas = new EventTarget();
    const events = [];
    canvas.hasAttribute = () => false;
    canvas.focus = () => events.push({ type: "focus" });
    canvas.getBoundingClientRect = () => ({
        left: 10,
        top: 20,
        width: 200,
        height: 100,
    });
    for (const type of ["mousemove", "mousedown", "mouseup", "click"]) {
        canvas.addEventListener(type, value => events.push({
            type: value.type,
            clientX: value.clientX,
            clientY: value.clientY,
            buttons: value.buttons,
        }));
    }
    return { canvas, events };
}

function exerciseFixture(options) {
    let frames = 0;
    return createRuntimeExercise({ getFrameCount: () => frames++, ...options });
}

describe("preview exercise contract", () => {

    it("publishes bounded actions on the existing run tool", () => {
        const run = KAPLAYGROUND_WEBMCP_TOOL_SURFACE.find(({ name }) =>
            name === "kaplayground_run_game"
        );
        const actions = run.inputSchema.properties.actions;
        assert.equal(actions.maxItems, 30);
        assert.deepEqual(
            actions.items.oneOf.map(option => option.properties.type.enum[0]),
            ["press", "hold", "click", "wait", "checkpoint"],
        );
        assert.deepEqual(run.inputSchema.anyOf, [
            { required: ["expectedRevision"] },
            { required: ["expectedContentRevision"] },
        ]);
    });

    it("uses one shared protocol version and normalizes common game keys", () => {
        assert.equal(PREVIEW_PROTOCOL_VERSION, 3);
        assert.deepEqual(normalizePreviewKey("Space"), {
            key: " ",
            code: "Space",
            keyCode: 32,
        });
        assert.deepEqual(normalizePreviewKey("w"), {
            key: "w",
            code: "KeyW",
            keyCode: 87,
        });
        for (const key of ["constructor", "toString", "__proto__"]) {
            assert.throws(() => normalizePreviewKey(key), /key must be/i);
        }
    });

    it("bounds actions and aggregate waiting", () => {
        assert.throws(
            () => parsePreviewExerciseActions([]),
            /between 1 and 30/i,
        );
        assert.throws(
            () => parsePreviewExerciseActions([
                { type: "wait", durationMs: 2_000 },
                { type: "hold", key: "ArrowRight", durationMs: 2_000 },
                {
                    type: "hold",
                    key: "ArrowDown",
                    durationMs: MAX_PREVIEW_EXERCISE_DURATION_MS - 3_999,
                },
            ]),
            /sequence limit/i,
        );
        assert.throws(
            () => parsePreviewExerciseActions([
                { type: "click", x: 2, y: 0.5 },
            ]),
            /between 0 and 1/i,
        );
    });

    it("dispatches bounded input and returns checkpoint evidence", async () => {
        const { canvas, events } = canvasFixture();
        const keyboard = [];
        for (const type of ["keydown", "keyup"]) {
            canvas.addEventListener(type, value => keyboard.push({
                type: value.type,
                key: value.key,
            }));
        }
        let runId = "run-1";
        const snapshots = [
            {
                runId,
                scene: "game",
                canvasFocused: true,
                objectCount: 1,
                objects: [{ id: 1, text: "Score 1 / 5", position: { x: 10, y: 20 } }],
                layoutWarnings: [],
                layoutAvailable: true,
            },
            {
                runId,
                scene: "game",
                canvasFocused: true,
                objectCount: 1,
                objects: [{ id: 1, position: { x: 30, y: 20 } }],
                layoutWarnings: [],
                layoutAvailable: true,
            },
        ];
        const exercise = exerciseFixture({
            getRunId: () => runId,
            inspectRuntime: () => snapshots.shift(),
            findCanvas: () => canvas,
            sleep: async () => {},
            createKeyboardEvent: event,
            createMouseEvent: event,
        });
        const result = await exercise({
            runId,
            actions: [
                { type: "hold", key: "ArrowRight", durationMs: 20 },
                { type: "click", x: 0.5, y: 0.25 },
                {
                    type: "checkpoint",
                    name: "score",
                    tag: "score",
                    expect: {
                        scene: "game",
                        textIncludes: ["1 / 5"],
                        objectCountAtLeast: 1,
                        firstObjectPosition: { xAtLeast: 10 },
                        layoutWarningsEmpty: true,
                    },
                },
                {
                    type: "checkpoint",
                    name: "moved",
                    tag: "player",
                    expect: {
                        firstObjectMovedFrom: {
                            checkpoint: "score",
                            minDistance: 15,
                            axis: "x",
                        },
                    },
                },
            ],
        });
        assert.deepEqual(keyboard, [
            { type: "keydown", key: "ArrowRight" },
            { type: "keyup", key: "ArrowRight" },
        ]);
        assert(events.some(value =>
            value.type === "click" && value.clientX === 110 && value.clientY === 45
        ));
        assert.equal(result.inputProvenance, "sandbox-simulated");
        assert.equal(result.inputActionCount, 2);
        assert.equal(result.assertionCount, 6);
        assert.equal(result.checkpoints[0].passed, true);
        assert.equal(result.checkpoints[1].passed, true);
        assert.equal(result.passed, true);

        runId = "run-2";
        await assert.rejects(
            exercise({ runId: "run-1", actions: [{ type: "press", key: "r" }] }),
            /no longer active/i,
        );
    });


    it("rejects duplicate checkpoint names and does not focus for snapshots alone", async () => {
        assert.throws(
            () => parsePreviewExerciseActions([
                { type: "checkpoint", name: "same" },
                { type: "checkpoint", name: "same" },
            ]),
            /more than one checkpoint named/i,
        );
        let focused = false;
        const exercise = exerciseFixture({
            getRunId: () => "run-1",
            inspectRuntime: () => ({
                runId: "run-1",
                objects: [],
                layoutWarnings: [],
            }),
            findCanvas: () => ({
                hasAttribute: () => false,
                focus: () => { focused = true; },
            }),
        });
        const result = await exercise({
            runId: "run-1",
            actions: [{ type: "checkpoint", name: "snapshot" }],
        });
        assert.equal(focused, false);
        assert.equal(result.assertionCount, 0);
        assert.equal(result.checkpointCount, 1);
        assert.equal(result.checkpoints[0].passed, null);
        assert.throws(() => parsePreviewExerciseActions([{
            type: "checkpoint",
            name: "later",
            expect: { firstObjectMovedFrom: { checkpoint: "missing", minDistance: 1 } },
        }]), /earlier checkpoint/i);
    });

    it("releases a simulated mouse button on cancellation", async () => {
        const { canvas, events } = canvasFixture();
        const controller = new AbortController();
        let waitCount = 0;
        const exercise = exerciseFixture({
            getRunId: () => "run-1",
            inspectRuntime: () => ({}),
            findCanvas: () => canvas,
            createMouseEvent: event,
            sleep: () => {
                waitCount++;
                if (waitCount === 1) return Promise.resolve();
                return new Promise(() => controller.abort());
            },
        });
        const pending = exercise({
            runId: "run-1",
            actions: [{ type: "click", x: 0.5, y: 0.5, button: 2 }],
            signal: controller.signal,
        });
        await assert.rejects(pending, error => error.name === "AbortError");
        assert.deepEqual(events.filter(value => value.type !== "focus").map(
            ({ type, buttons }) => ({ type, buttons }),
        ), [
            { type: "mousemove", buttons: 0 },
            { type: "mousedown", buttons: 2 },
            { type: "mouseup", buttons: 0 },
        ]);
    });

    it("processes pointer movement before pressing a click target", async () => {
        const { canvas } = canvasFixture();
        let clock = 0;
        const frame = () => Math.floor(clock / 100);
        const transitions = [];
        for (const type of ["mousemove", "mousedown", "mouseup", "click"]) {
            canvas.addEventListener(type, () => transitions.push({ type, frame: frame() }));
        }
        const exercise = exerciseFixture({
            getRunId: () => "run-1",
            findCanvas: () => canvas,
            inspectRuntime: () => ({}),
            getFrameCount: frame,
            now: () => clock,
            sleep: async milliseconds => { clock += milliseconds; },
            createMouseEvent: event,
        });
        await exercise({ runId: "run-1", actions: [
            { type: "click", x: 0.5, y: 0.5, button: 0 },
        ] });
        assert.deepEqual(transitions, [
            { type: "mousemove", frame: 0 },
            { type: "mousedown", frame: 1 },
            { type: "mouseup", frame: 2 },
            { type: "click", frame: 2 },
        ]);
        assert.equal(frame(), 3, "The release must reach the game too.");
    });

    it("keeps repeated taps on separate input frames in a slow game", async () => {
        const { canvas } = canvasFixture();
        let clock = 0;
        const frame = () => Math.floor(clock / 100);
        const transitions = [];
        for (const type of ["keydown", "keyup"]) {
            canvas.addEventListener(type, () => transitions.push({ type, frame: frame() }));
        }
        const exercise = exerciseFixture({
            getRunId: () => "run-1",
            findCanvas: () => canvas,
            inspectRuntime: () => ({}),
            getFrameCount: frame,
            now: () => clock,
            sleep: async milliseconds => { clock += milliseconds; },
            createKeyboardEvent: event,
        });
        await exercise({ runId: "run-1", actions: [
            { type: "press", key: "r" },
            { type: "press", key: "r" },
        ] });
        assert.deepEqual(transitions, [
            { type: "keydown", frame: 0 },
            { type: "keyup", frame: 1 },
            { type: "keydown", frame: 2 },
            { type: "keyup", frame: 3 },
        ]);
        assert.equal(frame(), 4, "The final release must reach the game too.");
    });

    it("bounds waiting for a stalled game and still releases its key", async () => {
        const { canvas } = canvasFixture();
        let clock = 0;
        const transitions = [];
        canvas.addEventListener("keydown", () => transitions.push("down"));
        canvas.addEventListener("keyup", () => transitions.push("up"));
        const exercise = exerciseFixture({
            getRunId: () => "run-1",
            findCanvas: () => canvas,
            inspectRuntime: () => ({}),
            getFrameCount: () => 0,
            now: () => clock,
            sleep: async milliseconds => { clock += milliseconds; },
            createKeyboardEvent: event,
        });
        await assert.rejects(exercise({ runId: "run-1", actions: [
            { type: "press", key: "r" },
        ] }), error => error.name === "TimeoutError");
        assert.deepEqual(transitions, ["down", "up"]);
        assert(clock >= 1_000 && clock < 1_050);
    });

    it("keeps unavailable and truncated checkpoint evidence inconclusive", () => {
        for (const inspection of [
            { available: false, objects: [], layoutWarnings: [] },
            { available: true, objects: [], objectsTruncated: true, layoutWarnings: [], layoutAvailable: false },
            { available: true, objects: [{ text: "some text", textTruncated: true }], layoutWarnings: [], layoutWarningsTruncated: true },
        ]) {
            const checks = evaluateCheckpoint(inspection, {
                textIncludes: ["Victory"],
                layoutWarningsEmpty: true,
            });
            assert(checks.every(check => check.passed === null));
        }
        const [movement] = evaluateCheckpoint({
            objects: [{ id: 2, position: { x: 100, y: 0 } }],
        }, { firstObjectMovedFrom: { checkpoint: "before", axis: "x", minDistance: 5 } }, [{
            name: "before",
            inspection: { objects: [{ id: 1, position: { x: 0, y: 0 } }] },
        }]);
        assert.equal(movement.passed, null, "Different objects must not count as movement.");
    });

    it("requires game-state assertions after the input being verified", async () => {
        const { canvas } = canvasFixture();
        const exercise = exerciseFixture({
            getRunId: () => "run-1",
            inspectRuntime: () => ({ available: true, scene: "game", canvasFocused: true }),
            findCanvas: () => canvas,
            createKeyboardEvent: event,
            sleep: async () => {},
        });
        const result = await exercise({ runId: "run-1", actions: [
            { type: "checkpoint", name: "before", expect: { scene: "game" } },
            { type: "press", key: "r" },
            { type: "checkpoint", name: "focus", expect: { canvasFocused: true } },
        ] });
        assert.equal(result.unassertedInputActionCount, 1);
    });

    it("cancels a held key and always releases it", async () => {
        const { canvas } = canvasFixture();
        const events = [];
        canvas.addEventListener("keydown", event => events.push(event.type));
        canvas.addEventListener("keyup", event => events.push(event.type));
        const controller = new AbortController();
        let releaseSleep;
        const exercise = exerciseFixture({
            getRunId: () => "run-1",
            inspectRuntime: () => ({
                runId: "run-1",
                objects: [],
                layoutWarnings: [],
            }),
            findCanvas: () => canvas,
            sleep: () => new Promise(resolve => { releaseSleep = resolve; }),
            createKeyboardEvent: event,
        });
        const pending = exercise({
            runId: "run-1",
            actions: [{ type: "hold", key: "ArrowRight", durationMs: 500 }],
            signal: controller.signal,
        });
        await Promise.resolve();
        controller.abort(new DOMException("Canceled", "AbortError"));
        await assert.rejects(pending, error => error.name === "AbortError");
        releaseSleep?.();
        assert.deepEqual(events, ["keydown", "keyup"]);
    });

    it("reports expectation failures without claiming the game crashed", () => {
        const checks = evaluateCheckpoint({
            scene: "lose",
            canvasFocused: true,
            objectCount: 0,
            objects: [{ text: "Try again" }],
            layoutWarnings: [{ code: "CLIPPED" }],
        }, {
            scene: "win",
            textIncludes: ["Victory"],
            objectCountAtLeast: 1,
            layoutWarningsEmpty: true,
        });
        assert(checks.every(value => value.passed === false));
    });
});
