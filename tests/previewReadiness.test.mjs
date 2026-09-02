import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPreviewReadinessTracker } from "../sandbox/readiness.js";

function fixture(options = {}) {
    let runId = "run-1";
    let draw;
    let load;
    let progress = options.progress ?? 0;
    let loaded = progress >= 1;
    const context = {
        canvas: {},
        onDraw(callback) {
            draw = callback;
        },
        onLoad(callback) {
            if (loaded) callback();
            else load = callback;
        },
        loadProgress() {
            return progress;
        },
    };
    const tracker = createPreviewReadinessTracker({
        timeoutMs: options.timeoutMs ?? 100,
        pollIntervalMs: 5,
        getRunId: () => runId,
        findCanvas: () => null,
    });
    tracker.reset(runId);
    tracker.captureContext(context, runId);
    return {
        context,
        tracker,
        draw: () => draw?.(),
        load() {
            loaded = true;
            progress = 1;
            load?.();
        },
        setProgress(value) {
            progress = value;
            loaded = value >= 1;
        },
        setRunId(value) {
            runId = value;
        },
    };
}

describe("preview readiness", () => {
    it("keeps early load and draw evidence until module execution completes", async () => {
        const test = fixture();
        test.load();
        test.draw();
        assert.equal(test.tracker.snapshot().moduleExecuted, false);
        test.tracker.markModuleExecuted("run-1");
        const result = await test.tracker.waitFor("run-1");
        assert.deepEqual(result, {
            status: "ready",
            moduleExecuted: true,
            contextCaptured: true,
            assetsLoaded: true,
            firstFrame: true,
            canvasPresent: true,
            reason: null,
        });
    });

    it("does not mark assets ready before module code queues its loads", async () => {
        const test = fixture({ progress: 1, timeoutMs: 15 });
        test.setProgress(0);
        test.draw();
        test.tracker.markModuleExecuted("run-1");

        const result = await test.tracker.waitFor("run-1");
        assert.equal(result.status, "timed-out");
        assert.equal(result.assetsLoaded, false);
    });

    it("polls loadProgress when onLoad is not emitted", async () => {
        const test = fixture();
        test.draw();
        test.tracker.markModuleExecuted("run-1");
        test.setProgress(1);
        const result = await test.tracker.waitFor("run-1");
        assert.equal(result.status, "ready");
        assert.equal(result.assetsLoaded, true);
    });

    it("reports a bounded incomplete reason after timeout", async () => {
        const test = fixture({ timeoutMs: 15 });
        test.tracker.markModuleExecuted("run-1");
        const result = await test.tracker.waitFor("run-1");
        assert.equal(result.status, "timed-out");
        assert.match(result.reason, /asset loading/);
        assert.match(result.reason, /first game frame/);
    });

    it("settles the previous waiter when a run is replaced", async () => {
        const test = fixture();
        const previous = test.tracker.waitFor("run-1");
        test.setRunId("run-2");
        test.tracker.reset("run-2");

        const result = await previous;
        assert.equal(result.status, "unavailable");
        assert.match(result.reason, /run changed/i);
        test.tracker.destroy();
    });
});
