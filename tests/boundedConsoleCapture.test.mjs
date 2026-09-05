import { Encode } from "console-feed/lib/Transform/index.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeConsoleLog } from "../src/hooks/decodeConsoleLog.ts";
import { createBoundedConsoleCapture } from "../src/integrations/webmcp/boundedConsoleCapture.ts";

const byteSize = value =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe("untrusted console decoding", () => {
    it("reads real wire messages and circular references as display data", () => {
        const cyclic = { score: 3 };
        cyclic.self = cyclic;
        const result = decodeConsoleLog(
            Encode({
                method: "error",
                data: ["boom", new Error("game failed"), cyclic],
            }),
        );
        assert.equal(result.method, "error");
        assert.equal(result.data.length, 3);
        assert.equal(result.data[0], "boom");
        assert.match(JSON.stringify(result.data[1]), /game failed/);
        assert.equal(result.data[2].score, 3);
        assert.equal(result.data[2].self, "[circular]");
    });

    it("never executes constructor payloads sent by the active game", () => {
        const encoded = [{
            method: "error",
            data: [{
                "@t": "[[Error]]",
                data: {
                    name: "Error",
                    message: {
                        toString: {
                            "@t": "[[TypedArray]]",
                            data: {
                                ctorName: "Function",
                                arr: "globalThis.__consoleDecodeExecuted = true; return \"probe\";",
                            },
                        },
                    },
                    stack: "probe",
                },
            }, "__console_feed_remaining__0"],
        }];
        delete globalThis.__consoleDecodeExecuted;
        const result = decodeConsoleLog(encoded);
        assert.equal(globalThis.__consoleDecodeExecuted, undefined);
        assert.equal(result.data[0].type, "[[Error]]");
        assert.equal(typeof result.data[0].value.message.toString, "object");
        assert.doesNotThrow(() => JSON.stringify(result));
    });

    it("bounds work before retaining deep, large, or malformed wire data", () => {
        let nested = "end";
        for (let index = 0; index < 100; index++) nested = { nested };
        const result = decodeConsoleLog([{
            method: "log",
            data: [nested, "x".repeat(1_000_000), Array(10_000).fill(1), {
                "@r": -1,
            }],
        }]);
        assert.ok(JSON.stringify(result).length < 20_000);
        assert.match(JSON.stringify(result), /truncated/);
        assert.equal(result.data[3], "[invalid reference]");
        for (const malformed of [null, {}, [], [null], [{ data: {} }]]) {
            assert.equal(decodeConsoleLog(malformed), null);
        }
    });
});

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
