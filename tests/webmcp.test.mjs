import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { virtualResolveDirectory } from "../src/features/Projects/application/virtualPaths.ts";
import { summarizeWebMCPActivityInput } from "../src/integrations/webmcp/activitySummary.ts";
import { CODEX_PLAY_STEPS } from "../src/integrations/webmcp/agentGuide.ts";
import { createBoundedConsoleCapture } from "../src/integrations/webmcp/boundedConsoleCapture.ts";
import {
    createCodexPlayGuide,
    createCodexPlayGuideKey,
} from "../src/integrations/webmcp/codexPlayGuide.ts";
import { EXAMPLE_COACH_PROMPTS } from "../src/integrations/webmcp/exampleCoachPrompts.ts";
import {
    EXAMPLE_LESSONS,
    getExampleLesson,
} from "../src/integrations/webmcp/exampleLessons.ts";
import {
    assertGameRevision,
    classifyGameRun,
    createSerialTaskQueue,
    gameReadSize,
    gameRevision,
    KAPLAYGROUND_WEBMCP_TOOL_NAMES,
    KAPLAYGROUND_WEBMCP_TOOL_SURFACE,
    MAX_TOTAL_READ_BYTES,
    prepareGameUpdate,
    registerGameToolDefinitions,
    requiresExampleDiscardConfirmation,
} from "../src/integrations/webmcp/gameTools.ts";
import {
    calculateSpriteFrameDimensions,
    spriteFrameGridFromLoader,
} from "../src/integrations/webmcp/imageDimensions.ts";
import { collectMonacoDiagnostics } from "../src/integrations/webmcp/monacoDiagnostics.ts";

const FRIENDLY_PROMPT_FORBIDDEN =
    /@Browser|WebMCP|kaplayground_|contract|revision|\btool\b/i;

class FakeModelContext {
    constructor(failOnName = null) {
        this.failOnName = failOnName;
        this.registered = [];
        this.active = new Map();
    }

    async registerTool(tool, options = {}) {
        if (tool.name === this.failOnName) {
            throw new Error(`Registration rejected for ${tool.name}`);
        }
        this.registered.push({ tool, options });
        this.active.set(tool.name, tool);
        options.signal?.addEventListener(
            "abort",
            () => this.active.delete(tool.name),
            { once: true },
        );
    }

    tool(name) {
        const tool = this.active.get(name);
        assert.ok(tool, `Missing active tool: ${name}`);
        return tool;
    }
}

function executableSurface(executions = []) {
    return KAPLAYGROUND_WEBMCP_TOOL_SURFACE.map((tool) => ({
        ...tool,
        async execute(input, options) {
            executions.push({ name: tool.name, input, signal: options.signal });
            options.signal.throwIfAborted();
            return { name: tool.name, input };
        },
    }));
}

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
        assert.deepEqual(
            KAPLAYGROUND_WEBMCP_TOOL_SURFACE.map(({ name }) => name),
            KAPLAYGROUND_WEBMCP_TOOL_NAMES,
        );
        assert.equal(KAPLAYGROUND_WEBMCP_TOOL_SURFACE.length, 8);
    });

    it("publishes bounded, self-describing schemas and trust annotations", () => {
        for (const tool of KAPLAYGROUND_WEBMCP_TOOL_SURFACE) {
            assert.equal(tool.inputSchema.type, "object", tool.name);
            assert.equal(
                tool.inputSchema.additionalProperties,
                false,
                tool.name,
            );
            assert.doesNotThrow(() => JSON.stringify(tool.inputSchema));
        }

        const read = KAPLAYGROUND_WEBMCP_TOOL_SURFACE.find(({ name }) =>
            name === "kaplayground_read_files"
        );
        assert.equal(read.inputSchema.properties.paths.uniqueItems, true);
        assert.equal(read.inputSchema.properties.paths.maxItems, 10);
        assert.equal(read.annotations.readOnlyHint, true);
        assert.equal(read.annotations.untrustedContentHint, true);

        const run = KAPLAYGROUND_WEBMCP_TOOL_SURFACE.find(({ name }) =>
            name === "kaplayground_run_game"
        );
        assert.deepEqual(run.inputSchema.properties.mode.enum, [
            "restart-and-check",
            "check-current",
        ]);
        assert.equal(run.inputSchema.properties.focus.type, "boolean");

        const save = KAPLAYGROUND_WEBMCP_TOOL_SURFACE.find(({ name }) =>
            name === "kaplayground_save_game"
        );
        assert.equal(save.inputSchema.properties.name.maxLength, 120);

        const update = KAPLAYGROUND_WEBMCP_TOOL_SURFACE.find(({ name }) =>
            name === "kaplayground_update_game"
        );
        assert.equal(
            update.inputSchema.properties.expectedRevision.pattern,
            "^[0-9]+:[0-9]+$",
        );
        assert.match(
            update.inputSchema.properties.focusPath.description,
            /select in the editor.*without activating Code/i,
        );
    });

    it("registers the complete production surface and forwards cancellation", async () => {
        const context = new FakeModelContext();
        const controller = new AbortController();
        const registeredNames = [];
        const executions = [];

        await registerGameToolDefinitions(
            context,
            executableSurface(executions),
            controller,
            name => registeredNames.push(name),
        );

        assert.deepEqual(registeredNames, KAPLAYGROUND_WEBMCP_TOOL_NAMES);
        assert.equal(context.active.size, 8);
        assert.equal(
            new Set(context.registered.map(({ options }) => options.signal))
                .size,
            1,
        );

        const invocation = new AbortController();
        const result = await context.tool("kaplayground_read_files").execute(
            { expectedRevision: "1:0", paths: ["main.js"] },
            { signal: invocation.signal },
        );
        assert.equal(result.name, "kaplayground_read_files");
        assert.equal(executions[0].signal, invocation.signal);

        controller.abort();
        assert.equal(context.active.size, 0);
    });

    it("rolls back every registered tool when one registration fails", async () => {
        const rejectedName = KAPLAYGROUND_WEBMCP_TOOL_NAMES[4];
        const context = new FakeModelContext(rejectedName);
        const controller = new AbortController();

        await assert.rejects(
            registerGameToolDefinitions(
                context,
                executableSurface(),
                controller,
            ),
            /registration rejected/i,
        );

        assert.equal(controller.signal.aborted, true);
        assert.equal(context.registered.length, 4);
        assert.equal(context.active.size, 0);
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

    it("bounds aggregate multi-file reads", () => {
        assert.equal(
            gameReadSize([
                { path: "main.js", value: "kaplay();\n" },
                { path: "scenes/game.js", value: "scene('game', () => {});\n" },
            ]),
            35,
        );
        assert.throws(
            () =>
                gameReadSize([
                    { path: "scenes/one.js", value: "a".repeat(300_000) },
                    { path: "scenes/two.js", value: "b".repeat(300_000) },
                ]),
            new RegExp(`${MAX_TOTAL_READ_BYTES}-byte read limit`),
        );
    });

    it("serializes project mutations so a queued stale replacement cannot win", async () => {
        const queue = createSerialTaskQueue();
        const firstCanCommit = Promise.withResolvers();
        let revision = "1:0";
        const commits = [];

        const first = queue.run(async () => {
            assert.equal(revision, "1:0");
            await firstCanCommit.promise;
            assert.equal(revision, "1:0");
            revision = "2:0";
            commits.push("first");
        });
        const second = queue.run(async () => {
            assert.equal(revision, "1:0", "queued revision must be rechecked");
            revision = "3:0";
            commits.push("second");
        });

        firstCanCommit.resolve();
        await first;
        await assert.rejects(second, /queued revision must be rechecked/);
        assert.deepEqual(commits, ["first"]);
        assert.equal(revision, "2:0");
    });

    it("classifies every run-check outcome without overstating incomplete checks", () => {
        assert.equal(classifyGameRun(0, 0, []), "passed");
        assert.equal(classifyGameRun(1, 0, []), "failed");
        assert.equal(classifyGameRun(0, 1, []), "failed");
        assert.equal(
            classifyGameRun(0, 0, ["Editor error checking was unavailable."]),
            "incomplete",
        );
        assert.equal(
            classifyGameRun(0, 0, ["Only part of the scene was inspected."]),
            "incomplete",
        );
        assert.equal(
            classifyGameRun(1, 0, [
                "Only the newest console messages were returned.",
            ]),
            "failed",
        );
    });

    it("resolves imports from each virtual importing directory", () => {
        assert.equal(virtualResolveDirectory("/main.js"), "/");
        assert.equal(
            virtualResolveDirectory("/scenes/game.js"),
            "/scenes",
        );
        assert.equal(
            virtualResolveDirectory("objects/player.ts"),
            "/objects",
        );
    });

    it("derives sprite-frame dimensions from loader slices", () => {
        const grid = spriteFrameGridFromLoader(
            "loadSprite(\"runner\", \"runner.png\", { sliceX: 4, sliceY: 2 });",
        );
        assert.deepEqual(grid, { columns: 4, rows: 2 });
        assert.deepEqual(
            calculateSpriteFrameDimensions(
                { width: 128, height: 64 },
                grid,
            ),
            { width: 32, height: 32 },
        );
    });

    it("treats the discard argument as a request for page confirmation", () => {
        assert.equal(
            requiresExampleDiscardConfirmation(false, false),
            false,
        );
        assert.throws(
            () => requiresExampleDiscardConfirmation(true, false),
            /request a page confirmation/i,
        );
        assert.equal(
            requiresExampleDiscardConfirmation(true, true),
            true,
        );
    });
});

describe("new-player Codex prompts", () => {
    function assertOpenEditorPrompt(prompt, idea) {
        assert.ok(prompt.startsWith(
            "Use the game editor already open at https://promptmygame.com in the in-app browser.",
        ));
        assert.doesNotMatch(prompt, /https?:\/\/(?:localhost|127\.0\.0\.1)/);
        assert.match(prompt, /Inspect its current game first\./);
        if (idea) assert.ok(prompt.includes(idea), "The creative idea was lost.");
        assert.match(
            prompt,
            /Keep any changes in that project and run its preview afterward\./,
        );
        assert.match(
            prompt,
            /Don't create a separate local app; tell me if you can't access the editor\.$/,
        );
        assert.doesNotMatch(prompt, FRIENDLY_PROMPT_FORBIDDEN);
        assert.ok(prompt.length < 800);
    }

    it("keeps the starter ideas free of integration jargon", () => {
        for (const step of CODEX_PLAY_STEPS) {
            if (!step.prompt) continue;
            assert.doesNotMatch(step.prompt, FRIENDLY_PROMPT_FORBIDDEN);
            assert.ok(step.prompt.length < 400);
        }
    });

    it("targets the open editor in every starter idea without changing the source ideas", () => {
        const originalSteps = structuredClone(CODEX_PLAY_STEPS);
        const subject = {
            key: "starter",
            title: "Moonlit Apple Run",
            isStarter: true,
        };
        const guide = createCodexPlayGuide(subject);

        assert.equal(guide.steps[0].prompt, undefined);
        for (let index = 1; index < guide.steps.length; index++) {
            assertOpenEditorPrompt(
                guide.steps[index].prompt,
                CODEX_PLAY_STEPS[index].prompt,
            );
        }
        assert.deepEqual(CODEX_PLAY_STEPS, originalSteps);
        assert.deepEqual(createCodexPlayGuide(subject), guide);
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
            assertOpenEditorPrompt(step.prompt);
        }
    });

    it("always targets promptmygame.com for sample, starter, and custom-game prompts", () => {
        for (const subject of [
            { isStarter: true },
            { prompts: EXAMPLE_COACH_PROMPTS.basicsStart },
            { source: "add([rect(10, 10)]); onKeyPress('space', jump);" },
            { source: "add([rect(10, 10)]);" },
            { source: "console.log('ready');" },
        ]) {
            const guide = createCodexPlayGuide({
                key: "current-game",
                title: "Signal / Drift",
                // A legacy caller must not override the production address.
                editorOrigin: "http://127.0.0.1:5173",
                ...subject,
            });
            for (const step of guide.steps) {
                if (!step.prompt) continue;
                assertOpenEditorPrompt(step.prompt);
            }
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

    it("pairs every sample with a short feature lesson and its existing prompts", () => {
        assert.deepEqual(
            Object.keys(EXAMPLE_LESSONS).sort(),
            Object.keys(EXAMPLE_COACH_PROMPTS).sort(),
        );
        for (const [key, lesson] of Object.entries(EXAMPLE_LESSONS)) {
            assert.ok(lesson.length > 50 && lesson.length < 300, key);
            assert.doesNotMatch(lesson, FRIENDLY_PROMPT_FORBIDDEN, key);
            const guide = createCodexPlayGuide({
                key,
                title: key,
                lesson,
                prompts: EXAMPLE_COACH_PROMPTS[key],
            });
            assert.equal(guide.steps[0].description, lesson);
            assert.equal(guide.steps[1].description, lesson);
            for (
                const [index, kind] of ["explain", "remix", "build", "invent"]
                    .entries()
            ) {
                assertOpenEditorPrompt(
                    guide.steps[index + 1].prompt,
                    EXAMPLE_COACH_PROMPTS[key][kind],
                );
            }
        }
        assert.match(
            getExampleLesson("spriteAnim"),
            /frame sequences.*walk cycle/,
        );
        assert.equal(getExampleLesson("unknown-custom-game"), undefined);
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
        for (const [index, idea] of Object.values(prompts).entries()) {
            assertOpenEditorPrompt(guide.steps[index + 1].prompt, idea);
        }
    });

    it("keeps one guide identity when temporary work is saved", () => {
        const createdAt = "2026-09-01T10:00:00.000Z";
        assert.equal(
            createCodexPlayGuideKey("starter", createdAt, null),
            createCodexPlayGuideKey("starter", createdAt, "saved-id"),
        );
    });

    it("distinguishes interactive, visual, and output-only examples", () => {
        for (
            const source of [
                "kaplay({ maxFPS: 70 }); debug.inspect = true;",
                "const k = kaplay({ global: false }); k.debug.log('Hello');",
            ]
        ) {
            assert.equal(
                createCodexPlayGuide({
                    key: "visible-debug-output",
                    title: "Visible output",
                    source,
                }).presentation,
                "visual",
            );
        }
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

    it("requires a language worker and matching source models", async () => {
        const files = new Map([
            ["main.js", { value: "kaplay();\n" }],
        ]);
        assert.deepEqual(
            await collectMonacoDiagnostics(undefined, files, "main.js"),
            {
                available: false,
                sourcePath: "main.js",
                sourceCurrent: false,
                diagnostics: [],
            },
        );

        const { monaco, models } = diagnosticsFixture(files);
        assert.deepEqual(
            await collectMonacoDiagnostics(monaco, files, "main.js"),
            {
                available: true,
                sourcePath: "main.js",
                sourceCurrent: true,
                diagnostics: [],
            },
        );

        models.get("main.js").value = "stale source";
        assert.equal(
            (await collectMonacoDiagnostics(monaco, files, "main.js"))
                .sourceCurrent,
            false,
        );
    });

    it("checks every source through the worker instead of trusting cached markers", async () => {
        const files = new Map([
            ["main.js", { value: "kaplay();" }],
            ["utils/score.ts", { value: "const score: number = 'wrong';" }],
        ]);
        const { monaco, worker, checkedUris } = diagnosticsFixture(files);
        monaco.editor.getModelMarkers = () => [];
        worker.getSemanticDiagnostics = async (uri) =>
            uri.endsWith("score.ts")
                ? [{
                    category: 1,
                    code: 2322,
                    start: 6,
                    length: 5,
                    messageText:
                        "Type 'string' is not assignable to type 'number'.",
                }]
                : [];
        const result = await collectMonacoDiagnostics(monaco, files, "main.js");
        assert.equal(result.sourceCurrent, true);
        assert.deepEqual(checkedUris.sort(), [
            "file:///main.js",
            "file:///utils/score.ts",
        ]);
        assert.equal(result.diagnostics.length, 1);
        assert.equal(result.diagnostics[0].path, "utils/score.ts");
        assert.equal(result.diagnostics[0].code, 2322);
        assert.equal(result.diagnostics[0].startColumn, 7);
    });

    it("rejects stale worker source and source changed during diagnostics", async () => {
        const files = new Map([["main.js", { value: "kaplay();" }]]);
        const { monaco, worker, models } = diagnosticsFixture(files);
        worker.getScriptText = async () => "previous source";
        assert.equal(
            (await collectMonacoDiagnostics(monaco, files, "main.js"))
                .sourceCurrent,
            false,
        );

        let release;
        let started;
        const checking = new Promise((resolve) => {
            started = resolve;
        });
        worker.getScriptText = async () => "kaplay();";
        worker.getSemanticDiagnostics = () => {
            started();
            return new Promise((resolve) => {
                release = resolve;
            });
        };
        const pending = collectMonacoDiagnostics(monaco, files, "main.js");
        await checking;
        models.get("main.js").version += 1;
        release([{ category: 1, code: 1, messageText: "Old error" }]);
        const result = await pending;
        assert.equal(result.sourceCurrent, false);
        assert.deepEqual(result.diagnostics, []);
    });

    it("reports unavailable diagnostics when the language worker fails", async () => {
        const files = new Map([["main.js", { value: "kaplay();" }]]);
        const { monaco, worker } = diagnosticsFixture(files);
        worker.getSemanticDiagnostics = async () => {
            throw new Error("Worker unavailable");
        };
        const result = await collectMonacoDiagnostics(monaco, files, "main.js");
        assert.equal(result.available, false);
        assert.equal(result.sourceCurrent, false);
    });
});

function diagnosticsFixture(files) {
    const uriFor = (path) => ({ toString: () => `file:///${path}` });
    const models = new Map([...files].map(([path, { value }]) => {
        const model = {
            value,
            version: 1,
            uri: uriFor(path),
            getValue: () => model.value,
            getVersionId: () => model.version,
            getLanguageId: () =>
                path.endsWith(".ts") ? "typescript" : "javascript",
            isDisposed: () => false,
            getPositionAt(offset) {
                const lines = model.value.slice(0, offset).split("\n");
                return {
                    lineNumber: lines.length,
                    column: lines.at(-1).length + 1,
                };
            },
        };
        return [path, model];
    }));
    const checkedUris = [];
    const worker = {
        async getSyntacticDiagnostics(uri) {
            checkedUris.push(uri);
            return [];
        },
        getSemanticDiagnostics: async () => [],
        getScriptText: async (uri) =>
            models.get(uri.slice("file:///".length))?.value,
    };
    const getWorker = async () => async () => worker;
    return {
        models,
        worker,
        checkedUris,
        monaco: {
            Uri: { file: uriFor },
            editor: {
                getModel: (uri) =>
                    models.get(uri.toString().slice("file:///".length)),
            },
            languages: {
                typescript: {
                    getJavaScriptWorker: getWorker,
                    getTypeScriptWorker: getWorker,
                },
            },
        },
    };
}
