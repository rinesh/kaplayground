import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    summarizeWebMCPActivityInput,
    summarizeWebMCPActivityResult,
} from "../src/integrations/webmcp/activitySummary.ts";
import {
    KAPLAYGROUND_WEBMCP_CONTRACT_VERSION,
    KaplaygroundToolError,
    normalizeToolError,
    withToolResultEnvelope,
} from "../src/integrations/webmcp/toolResults.ts";

describe("WebMCP result contract", () => {
    it("adds one backward-compatible versioned envelope", () => {
        assert.deepEqual(
            withToolResultEnvelope("kaplayground_run_game", {
                status: "incomplete",
                revision: "1:2",
            }),
            {
                status: "incomplete",
                revision: "1:2",
                contractVersion: KAPLAYGROUND_WEBMCP_CONTRACT_VERSION,
                tool: "kaplayground_run_game",
                ok: true,
                complete: false,
            },
        );
    });

    it("marks an explicitly declined mutation incomplete without calling it an error", () => {
        const result = withToolResultEnvelope("kaplayground_open_example", {
            committed: false,
            reason: "The user kept the current game.",
        });
        assert.equal(result.ok, true);
        assert.equal(result.complete, false);
    });

    it("uses stable structured codes for expected and input failures", () => {
        const stale = new KaplaygroundToolError(
            "STALE_CONTENT_REVISION",
            "stale",
            { retryable: true, details: { actual: "1:c:a" } },
        );
        assert.equal(
            normalizeToolError(stale, "kaplayground_update_game"),
            stale,
        );
        const invalid = normalizeToolError(
            new RangeError("too many actions"),
            "kaplayground_run_game",
        );
        assert.equal(invalid.code, "INVALID_TOOL_INPUT");
        assert.equal(invalid.retryable, true);
    });

    it("stores verification receipts without source or raw scene objects", () => {
        const input = summarizeWebMCPActivityInput({
            changes: [{
                action: "replace",
                path: "main.js",
                content: "secret source",
            }],
        });
        assert.doesNotMatch(JSON.stringify(input), /secret source/);

        const result = summarizeWebMCPActivityResult(
            "kaplayground_run_game",
            {
                status: "passed",
                revision: "1:3",
                contentRevision: "1:c:0123456789abcdef",
                diagnostics: { errorCount: 0, items: [{ message: "hidden" }] },
                console: { errorCount: 0, entries: [{ values: ["hidden"] }] },
                gameplay: {
                    inputProvenance: "sandbox-simulated",
                    inputActionCount: 2,
                    checkpointCount: 1,
                    checkpoints: [{
                        name: "moved",
                        passed: true,
                        checks: [{ name: "scene", passed: true }],
                        inspection: { objects: [{ text: "secret state" }] },
                    }],
                },
                scene: {
                    scene: "game",
                    objectCount: 20,
                    objects: [{ text: "secret state" }],
                    layoutWarnings: [],
                },
            },
        );
        const text = JSON.stringify(result);
        assert.match(text, /sandbox-simulated/);
        assert.match(text, /moved/);
        assert.doesNotMatch(text, /secret state|hidden/);
    });
});
