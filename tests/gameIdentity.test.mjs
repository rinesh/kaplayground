import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    assertGameContentRevision,
    gameContentRevision,
    gameProjectFingerprint,
    gameRuntimeFingerprint,
} from "../src/integrations/webmcp/gameIdentity.ts";

function state(overrides = {}) {
    return {
        projectGeneration: 2,
        project: {
            name: "Original name",
            kaplayVersion: "3001.0.19",
            mode: "pj",
            buildMode: "esbuild",
            files: new Map([
                ["main.js", {
                    path: "main.js",
                    value: "kaplay();\n",
                    language: "javascript",
                    kind: "main",
                }],
            ]),
            assets: new Map(),
            ...overrides,
        },
    };
}

describe("game identity", () => {
    it("keeps metadata renames out of the executable content revision", () => {
        const original = state();
        const renamed = state({ name: "Renamed project" });
        assert.equal(gameContentRevision(original), gameContentRevision(renamed));
        assert.notEqual(
            gameProjectFingerprint(original.project),
            gameProjectFingerprint(renamed.project),
        );
    });

    it("changes content and runtime fingerprints for executable inputs", () => {
        const original = state();
        const edited = state({
            files: new Map([
                ["main.js", {
                    path: "main.js",
                    value: "kaplay(); add([rect(20, 20)]);\n",
                    language: "javascript",
                    kind: "main",
                }],
            ]),
        });
        assert.notEqual(gameContentRevision(original), gameContentRevision(edited));
        const runtime = {
            applicationCommit: "app-1",
            engineCommit: "engine-1",
            protocolVersion: 3,
            engineModuleUrl: "https://example.test/kaplay.mjs",
        };
        assert.notEqual(
            gameRuntimeFingerprint(original, runtime),
            gameRuntimeFingerprint(edited, runtime),
        );
        assert.notEqual(
            gameRuntimeFingerprint(original, runtime),
            gameRuntimeFingerprint(original, {
                ...runtime,
                applicationCommit: "app-2",
            }),
        );
    });


    it("treats file insertion order as executable state for legacy builds", () => {
        const first = state({
            buildMode: "legacy",
            files: new Map([
                ["main.js", { path: "main.js", value: "kaplay();\n", language: "javascript", kind: "main" }],
                ["scenes/game.js", { path: "scenes/game.js", value: "scene('game', () => {});\n", language: "javascript", kind: "scene" }],
            ]),
        });
        const reordered = state({
            buildMode: "legacy",
            files: new Map([...first.project.files].reverse()),
        });
        assert.notEqual(
            gameContentRevision(first),
            gameContentRevision(reordered),
        );
        assert.notEqual(
            gameProjectFingerprint(first.project),
            gameProjectFingerprint(reordered.project),
        );
    });

    it("invalidates content for assets, engine selection, build mode, and project replacement", () => {
        const original = state();
        const originalRevision = gameContentRevision(original);
        for (const changed of [
            state({ kaplayVersion: "4000.0.0" }),
            state({ buildMode: "legacy" }),
            state({ mode: "ex" }),
            state({ assets: new Map([["hero", { url: "data:image/png;base64,AA", kind: "sprite" }]]) }),
            { ...original, projectGeneration: original.projectGeneration + 1 },
        ]) {
            assert.notEqual(gameContentRevision(changed), originalRevision);
        }
    });

    it("ignores the IndexedDB id in project read-back fingerprints", () => {
        const project = state().project;
        assert.equal(
            gameProjectFingerprint(project),
            gameProjectFingerprint({ ...project, id: "stored-id" }),
        );
    });

    it("returns a structured stale-content error", () => {
        assert.throws(
            () => assertGameContentRevision(state(), "2:c:deadbeefdeadbeef"),
            error => error.code === "STALE_CONTENT_REVISION"
                && error.retryable === true
                && error.details.suggestedAction === "kaplayground_inspect_game",
        );
    });
});
