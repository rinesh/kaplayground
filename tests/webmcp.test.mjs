import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CODEX_PLAY_STEPS } from "../src/integrations/webmcp/agentGuide.ts";
import { createBoundedConsoleCapture } from "../src/integrations/webmcp/boundedConsoleCapture.ts";
import {
    createCodexPlayGuide,
    createCodexPlayGuideKey,
} from "../src/integrations/webmcp/codexPlayGuide.ts";
import { EXAMPLE_COACH_PROMPTS } from "../src/integrations/webmcp/exampleCoachPrompts.ts";
import {
    assertGameRevision,
    gameRevision,
    KAPLAYGROUND_WEBMCP_TOOL_NAMES,
    prepareGameUpdate,
} from "../src/integrations/webmcp/gameTools.ts";
import { collectMonacoDiagnostics } from "../src/integrations/webmcp/monacoDiagnostics.ts";
import { summarizeWebMCPActivityInput } from "../src/integrations/webmcp/activitySummary.ts";

const FRIENDLY_PROMPT_FORBIDDEN =
    /@Browser|WebMCP|kaplayground_|contract|revision|\btool\b/i;

describe("simple KAPLAYGROUND browser tools", () => {
    it("exposes one small tool surface", () => {
        assert.deepEqual(KAPLAYGROUND_WEBMCP_TOOL_NAMES, [
            "kaplayground_inspect_game",
            "kaplayground_read_files",
            "kaplayground_update_game",
            "kaplayground_run_game",
            "kaplayground_find_assets",
            "kaplayground_save_game",
            "kaplayground_find_examples",
            "kaplayground_open_example",
        ]);
    });

    it("uses one revision token for project replacement and content changes", () => {
        assert.equal(
            gameRevision({ projectGeneration: 3, projectRevision: 8 }),
            "3:8",
        );
        assert.notEqual(
            gameRevision({ projectGeneration: 4, projectRevision: 8 }),
            gameRevision({ projectGeneration: 3, projectRevision: 8 }),
        );
        assert.notEqual(
            gameRevision({ projectGeneration: 3, projectRevision: 9 }),
            gameRevision({ projectGeneration: 3, projectRevision: 8 }),
        );
    });

    it("rejects a stale revision before an update", () => {
        assert.throws(
            () =>
                assertGameRevision(
                    { projectGeneration: 1, projectRevision: 5 },
                    "1:4",
                ),
            /changed since it was inspected/i,
        );
    });

    it("prepares a multi-file update without changing the original map", () => {
        const original = new Map([
            [
                "main.js",
                {
                    path: "main.js",
                    value: "import './scenes/game.js';\n",
                    language: "javascript",
                    kind: "main",
                },
            ],
            [
                "scenes/game.js",
                {
                    path: "scenes/game.js",
                    value: "scene('game', () => {});\n",
                    language: "javascript",
                    kind: "scene",
                },
            ],
        ]);

        const prepared = prepareGameUpdate(original, [
            {
                action: "replace",
                path: "scenes/game.js",
                content: "scene('game', () => add([rect(32, 32)]));\n",
            },
            {
                action: "create",
                path: "objects/player.ts",
                content: "export const speed = 320;\n",
            },
        ]);

        assert.equal(
            original.get("scenes/game.js")?.value,
            "scene('game', () => {});\n",
        );
        assert.equal(
            prepared.files.get("objects/player.ts")?.language,
            "typescript",
        );
        assert.equal(prepared.files.get("objects/player.ts")?.kind, "obj");
        assert.equal(prepared.changes.length, 2);
        assert.ok(prepared.totalBytes > 0);
    });

    it("rejects duplicate paths and unsafe creation or removal", () => {
        const files = new Map([
            [
                "main.js",
                {
                    path: "main.js",
                    value: "kaplay();\n",
                    language: "javascript",
                    kind: "main",
                },
            ],
        ]);

        assert.throws(
            () =>
                prepareGameUpdate(files, [
                    { action: "replace", path: "main.js", content: "a" },
                    { action: "replace", path: "main.js", content: "b" },
                ]),
            /more than one change/i,
        );
        assert.throws(
            () =>
                prepareGameUpdate(files, [
                    { action: "create", path: "src/game.js", content: "" },
                ]),
            /directly inside/i,
        );
        assert.throws(
            () =>
                prepareGameUpdate(files, [
                    { action: "remove", path: "main.js" },
                ]),
            /only JavaScript or TypeScript files/i,
        );
    });
});

describe("new-player Codex prompts", () => {
    it("keeps the starter ideas free of integration jargon", () => {
        for (const step of CODEX_PLAY_STEPS) {
            if (!step.prompt) continue;
            assert.doesNotMatch(step.prompt, FRIENDLY_PROMPT_FORBIDDEN);
            assert.ok(step.prompt.length < 400);
        }
    });

    it("creates friendly example-specific prompts", () => {
        const guide = createCodexPlayGuide({
            key: "tiny-platformer",
            title: "Tiny Platformer",
            source: "kaplay(); add([rect(32, 32)]); onKeyPress('space', jump);",
        });

        assert.equal(guide.presentation, "interactive");
        assert.equal(guide.steps.length, 5);
        for (const step of guide.steps) {
            if (!step.prompt) continue;
            assert.match(step.prompt, /Tiny Platformer/);
            assert.doesNotMatch(step.prompt, FRIENDLY_PROMPT_FORBIDDEN);
        }
    });

    it("gives every built-in example its own grounded prompt set", () => {
        const examples = JSON.parse(readFileSync(
            new URL("../src/data/exampleList.json", import.meta.url),
            "utf8",
        ));
        const expectedKeys = examples.map(example => example.name).sort();
        const promptKeys = Object.keys(EXAMPLE_COACH_PROMPTS).sort();

        assert.deepEqual(promptKeys, expectedKeys);
        for (const prompts of Object.values(EXAMPLE_COACH_PROMPTS)) {
            assert.equal(Object.keys(prompts).length, 4);
            assert.equal(new Set(Object.values(prompts)).size, 4);
            for (const prompt of Object.values(prompts)) {
                assert.doesNotMatch(prompt, FRIENDLY_PROMPT_FORBIDDEN);
                assert.doesNotMatch(prompt, /[“”]/);
                assert.ok(prompt.length < 400);
            }
        }
    });

    it("uses the prompt set supplied for a built-in example", () => {
        const prompts = EXAMPLE_COACH_PROMPTS.basicsStart;
        const guide = createCodexPlayGuide({
            key: "basics-start",
            title: "Create your first game",
            source: "kaplay({ background: '#5ba675' });",
            prompts,
        });

        assert.match(prompts.explain, /green canvas/);
        assert.doesNotMatch(prompts.explain, /Create your first game/);
        assert.deepEqual(
            guide.steps.slice(1).map(step => step.prompt),
            [prompts.explain, prompts.remix, prompts.build, prompts.invent],
        );
    });

    it("keeps one guide identity when temporary work is saved", () => {
        const createdAt = "2026-09-01T10:00:00.000Z";
        assert.equal(
            createCodexPlayGuideKey("starter", createdAt, null),
            createCodexPlayGuideKey("starter", createdAt, "saved-id"),
        );
    });

    it("distinguishes interactive, visual, and output-only examples", () => {
        assert.equal(
            createCodexPlayGuide({
                key: "interactive",
                title: "Interactive",
                source: "add([rect(10, 10)]); onKeyPress('space', jump);",
            }).presentation,
            "interactive",
        );
        assert.equal(
            createCodexPlayGuide({
                key: "visual",
                title: "Visual",
                source: "add([rect(10, 10)]);",
            }).presentation,
            "visual",
        );
        assert.equal(
            createCodexPlayGuide({
                key: "output",
                title: "Output",
                source: "console.log('ready');",
            }).presentation,
            "output",
        );
    });
});

describe("bounded agent-visible data", () => {
    it("hides nested source content before storing activity", () => {
        const summary = summarizeWebMCPActivityInput({
            expectedRevision: "1:4",
            changes: [
                {
                    action: "replace",
                    path: "main.js",
                    content: "secret source code",
                },
            ],
        });

        assert.equal(summary.expectedRevision, "1:4");
        assert.doesNotMatch(JSON.stringify(summary), /secret source code/);
        assert.match(JSON.stringify(summary), /characters hidden/);
    });

    it("bounds retained console entries", () => {
        const capture = createBoundedConsoleCapture(2);
        capture.add({ timestamp: 1, runId: "run", level: "log", values: [1] });
        capture.add({ timestamp: 2, runId: "run", level: "log", values: [2] });
        capture.add({ timestamp: 3, runId: "run", level: "log", values: [3] });

        const snapshot = capture.snapshot();
        assert.equal(snapshot.entries.length, 2);
        assert.equal(snapshot.droppedCount, 1);
    });

    it("resets console eviction state before checking a new run", () => {
        const capture = createBoundedConsoleCapture(1);
        capture.add({ timestamp: 1, runId: "old", level: "log", values: [1] });
        capture.add({ timestamp: 2, runId: "old", level: "log", values: [2] });

        capture.clear();
        capture.add({ timestamp: 3, runId: "new", level: "log", values: [3] });

        assert.deepEqual(capture.snapshot(), {
            available: true,
            entries: [
                { timestamp: 3, runId: "new", level: "log", values: [3] },
            ],
            droppedCount: 0,
        });
    });

    it("distinguishes unavailable diagnostics from a clean editor", () => {
        assert.deepEqual(collectMonacoDiagnostics(undefined, new Map()), {
            available: false,
            diagnostics: [],
        });

        const monaco = {
            MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
            editor: { getModelMarkers: () => [] },
        };
        assert.deepEqual(collectMonacoDiagnostics(monaco, new Map()), {
            available: true,
            diagnostics: [],
        });
    });
});
