import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRuntimeInspector } from "../sandbox/runtimeInspection.js";

function inspectorFor(context, options = {}) {
    const canvas = options.canvas ?? { width: 320, height: 240 };
    return createRuntimeInspector({
        getRunId: () => "run-1",
        getReadiness: () => ({ status: "ready" }),
        getDebug: () => options.debug ?? { paused: false },
        getContext: () => context,
        readPaused: () => false,
        findCanvas: () => canvas,
        getActiveElement: () => options.focused ? canvas : null,
    });
}

describe("sandbox runtime inspection", () => {
    it("preserves scene, focus, geometry, and object evidence", () => {
        const object = {
            id: "player-1",
            tags: ["player"],
            pos: { x: 40, y: 120 },
            width: 24,
            height: 32,
            anchor: "center",
            worldArea() {
                return {
                    pos: { x: 28, y: 104 },
                    width: 24,
                    height: 32,
                };
            },
        };
        const context = {
            getSceneName: () => "game",
            width: () => 320,
            height: () => 240,
            camPos: () => ({ x: 160, y: 120 }),
            isFocused: () => true,
            get: () => [object],
        };

        const result = inspectorFor(context)({ tag: "player", limit: 10 });
        assert.equal(result.runId, "run-1");
        assert.equal(result.scene, "game");
        assert.equal(result.canvasFocused, true);
        assert.equal(result.objectsAvailable, true);
        assert.equal(result.objectCount, 1);
        assert.deepEqual(result.objects[0].renderedBounds, {
            x: -12,
            y: -16,
            width: 24,
            height: 32,
        });
        assert.deepEqual(result.objects[0].collisionBounds.world, {
            x: 28,
            y: 104,
            width: 24,
            height: 32,
        });
    });

    it("reports unavailable objects when the active context cannot query them", () => {
        const result = inspectorFor({})({ tag: "player", limit: 10 });
        assert.equal(result.available, true, "the preview canvas is still evidence");
        assert.equal(result.objectsAvailable, false);
        assert.deepEqual(result.objects, []);
    });
});
