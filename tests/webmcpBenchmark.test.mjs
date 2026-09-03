import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";

const script = resolve("scripts/webmcpBenchmark.ts");

function run(id, workflow, durationMs) {
    return {
        id,
        workflow,
        applicationCommit: "app-commit",
        engineIdentity: "engine-commit",
        starterHash: "starter-hash",
        model: "model",
        reasoningSetting: "medium",
        viewport: { width: 1280, height: 720 },
        durationMs,
        firstSuccessfulRunMs: durationMs / 2,
        firstFullyVerifiedRunMs: durationMs * 0.75,
        outerInteractions: 2,
        sourceWrites: 1,
        retries: 0,
        browserInputOperations: 1,
        acceptance: { startup: "passed" },
        unsupportedClaims: [],
    };
}

async function withFiles(operation) {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-benchmark-"));
    try {
        await operation(join(directory, "input.json"), join(directory, "output.json"));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

describe("matched WebMCP benchmark", () => {
    it("uses interpolated distributions instead of returning the lower sample", async () => {
        await withFiles(async (inputPath, outputPath) => {
            await writeFile(inputPath, JSON.stringify({
                schemaVersion: 1,
                promptHash: "prompt-hash",
                runs: [
                    run("web-1", "webmcp", 100),
                    run("web-2", "webmcp", 200),
                    run("standard-1", "standard-editor", 150),
                ],
            }));
            execFileSync(process.execPath, [
                "--experimental-strip-types", script, inputPath, outputPath,
            ]);
            const summary = JSON.parse(await readFile(outputPath, "utf8"));
            assert.equal(summary.workflows.webmcp.durationMs.median, 150);
            assert.equal(summary.workflows.webmcp.durationMs.p90, 190);
        });
    });

    it("rejects unknown workflows and impossible verification timing", async () => {
        await withFiles(async (inputPath, outputPath) => {
            const input = {
                schemaVersion: 1,
                promptHash: "prompt-hash",
                runs: [
                    run("web", "webmcp", 100),
                    run("standard", "standard-editor", 100),
                    run("invalid", "browser", 100),
                ],
            };
            await writeFile(inputPath, JSON.stringify(input));
            const unknown = spawnSync(process.execPath, [
                "--experimental-strip-types", script, inputPath, outputPath,
            ], { encoding: "utf8" });
            assert.notEqual(unknown.status, 0);
            assert.match(unknown.stderr, /workflow must be/i);

            input.runs.pop();
            input.runs[1].firstSuccessfulRunMs = 80;
            input.runs[1].firstFullyVerifiedRunMs = 70;
            await writeFile(inputPath, JSON.stringify(input));
            const timing = spawnSync(process.execPath, [
                "--experimental-strip-types", script, inputPath, outputPath,
            ], { encoding: "utf8" });
            assert.notEqual(timing.status, 0);
            assert.match(timing.stderr, /firstFullyVerifiedRunMs/);
        });
    });
});
