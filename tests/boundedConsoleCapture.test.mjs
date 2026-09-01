import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBoundedConsoleCapture } from "../src/integrations/webmcp/boundedConsoleCapture.ts";

const byteSize = value =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe("byte-bounded console capture", () => {
    it("copies and truncates values before retaining them", () => {
        const huge = "x".repeat(1_000_000);
        const nested = { message: huge };
        nested.self = nested;
        const capture = createBoundedConsoleCapture({
            maxEntries: 10,
            maxEntryBytes: 1_024,
            maxTotalBytes: 2_048,
        });

        capture.add({
            timestamp: 1,
            runId: "run",
            level: "log",
            values: [huge, nested],
        });
        nested.message = "changed after capture";

        const snapshot = capture.snapshot();
        assert.equal(snapshot.entries.length, 1);
        assert.ok(byteSize(snapshot.entries[0]) <= 1_024);
        assert.doesNotMatch(
            JSON.stringify(snapshot),
            /changed after capture/,
        );
        assert.match(JSON.stringify(snapshot), /truncated|circular/);
    });

    it("evicts by total retained bytes before the entry limit", () => {
        const capture = createBoundedConsoleCapture({
            maxEntries: 10,
            maxEntryBytes: 400,
            maxTotalBytes: 350,
        });

        for (let index = 0; index < 3; index++) {
            capture.add({
                timestamp: index,
                runId: "run",
                level: "log",
                values: [String(index).repeat(300)],
            });
        }

        const snapshot = capture.snapshot();
        assert.ok(snapshot.entries.length < 3);
        assert.ok(snapshot.droppedCount > 0);
        assert.ok(byteSize(snapshot.entries) <= 350);
    });

    it("preserves the original small-entry behavior", () => {
        const capture = createBoundedConsoleCapture(2);
        capture.add({
            timestamp: 1,
            runId: "run",
            level: "log",
            values: [1],
        });
        capture.add({
            timestamp: 2,
            runId: "run",
            level: "log",
            values: [2],
        });
        capture.add({
            timestamp: 3,
            runId: "run",
            level: "log",
            values: [3],
        });

        assert.deepEqual(capture.snapshot(), {
            available: true,
            entries: [
                {
                    timestamp: 2,
                    runId: "run",
                    level: "log",
                    values: [2],
                },
                {
                    timestamp: 3,
                    runId: "run",
                    level: "log",
                    values: [3],
                },
            ],
            droppedCount: 1,
        });
    });
});
