import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createActiveProjectPersister } from "../src/features/Projects/stores/activeProjectPersistence.ts";
import { createPreviewRunCoordinator } from "../src/hooks/previewRunCoordinator.ts";
import { createBoundedConsoleCapture } from "../src/integrations/webmcp/boundedConsoleCapture.ts";
import {
    createCodexPlayGuide,
    createCodexPlayGuideKey,
} from "../src/integrations/webmcp/codexPlayGuide.ts";
import {
    readCodexPlayStepIndex,
    writeCodexPlayStepIndex,
} from "../src/integrations/webmcp/codexPlayProgress.ts";
import {
    createKaplaygroundWebMCP,
    kaplaygroundContentRevision,
} from "../src/integrations/webmcp/kaplaygroundWebMCP.ts";
import { WEBMCP_TOOL_ORDER } from "../src/integrations/webmcp/agentContract.ts";
import { collectMonacoDiagnostics } from "../src/integrations/webmcp/monacoDiagnostics.ts";
import {
    resetWebMCPActivityOnProjectReplacement,
    useWebMCPActivity,
} from "../src/integrations/webmcp/webMCPActivity.ts";

class FakeModelContext extends EventTarget {
    registered = [];

    async registerTool(tool, options) {
        this.registered.push({ tool, options });
    }

    async getTools() {
        return [];
    }

    tool(name) {
        const match = this.registered.find(({ tool }) => tool.name === name);
        assert.ok(match, `Missing registered tool: ${name}`);
        return match.tool;
    }
}

class DelayedRegistrationModelContext extends FakeModelContext {
    constructor(delayedToolName) {
        super();
        this.delayedToolName = delayedToolName;
        this.delayReached = deferred();
        this.releaseDelay = deferred();
    }

    async registerTool(tool, options) {
        this.registered.push({ tool, options });
        if (tool.name !== this.delayedToolName) return;
        this.delayReached.resolve();
        await this.releaseDelay.promise;
    }
}

const PROJECT_REVISION = "project-revision-1";
const FULL_TOOL_NAMES = WEBMCP_TOOL_ORDER.map((name) =>
    `kaplayground_${name}`
);
const KAPLAY_PLUGIN_FIXTURE = JSON.parse(readFileSync(
    new URL("./fixtures/kaplay-plugin-contract.json", import.meta.url),
    "utf8",
));

function createAdapter() {
    const files = new Map([
        [
            "main.js",
            {
                path: "main.js",
                language: "javascript",
                kind: "main",
                content: "add([rect(32, 32)])\n",
            },
        ],
    ]);
    const assets = [
        {
            name: "hero.png",
            path: "assets/sprites/hero.png",
            kind: "sprite",
            importFunction:
                "loadSprite(\"hero\", \"assets/sprites/hero.png\");",
            source: "embedded",
            url: "data:image/png;base64,not-returned",
        },
        {
            name: "theme.ogg",
            path: "assets/sounds/theme.ogg",
            kind: "sound",
            importFunction:
                "loadSound(\"theme\", \"assets/sounds/theme.ogg\");",
            source: "remote",
            url: "https://assets.example/theme.ogg",
        },
        {
            name: "zapper.png",
            path: "assets/sprites/zapper.png",
            kind: "sprite",
            importFunction:
                "loadSprite(\"zapper\", \"assets/sprites/zapper.png\");",
            source: "blob",
            url: "blob:https://example.test/zapper",
        },
    ];
    const assetBrew = [
        {
            key: "bean",
            name: "Bean",
            description: "A bean character.",
            kind: "sprite",
            tags: ["crew"],
            searchTerms: ["player"],
            animations: [],
            importFunction: "loadSprite(\"bean\", \"/crew/bean.png\");",
            outlinedImportFunction:
                "loadSprite(\"bean-o\", \"/crew/bean-o.png\");",
            url: "https://assets.example/bean.png",
        },
        {
            key: "cloud",
            name: "Cloud",
            description: "A cloud in the sky.",
            kind: "sprite",
            tags: ["objects"],
            searchTerms: [],
            animations: [],
            importFunction: "loadSprite(\"cloud\", \"/crew/cloud.png\");",
        },
        {
            key: "wizarding",
            name: "Wizarding",
            description: "Bean Wizard is casting math.",
            kind: "sprite",
            tags: ["emojis"],
            searchTerms: ["bean", "magic"],
            animations: ["anim"],
            importFunction:
                "loadSprite(\"wizarding\", \"/crew/wizarding.png\", { anims: {} });",
        },
        {
            key: "mark_voice",
            name: "Mark Voice",
            description: "Mark's voice.",
            kind: "sound",
            tags: ["sounds", "crew"],
            searchTerms: ["speech"],
            animations: [],
            importFunction:
                "loadSound(\"mark_voice\", \"/crew/mark_voice.wav\");",
        },
        {
            key: "happy",
            name: "Happy",
            description: "A happy bitmap font.",
            kind: "font",
            tags: ["fonts"],
            searchTerms: ["typeface"],
            animations: [],
            importFunction:
                "loadBitmapFont(\"happy\", \"/crew/happy.png\", 28, 37);",
        },
    ];
    const consoleEntries = [
        {
            timestamp: 1,
            runId: "run-old",
            level: "warn",
            values: ["old warning"],
        },
        {
            timestamp: 2,
            runId: "run-latest",
            level: "log",
            values: ["latest ready"],
        },
        {
            timestamp: 3,
            runId: "run-latest",
            level: "error",
            values: ["latest error"],
        },
    ];
    const state = {
        projectId: null,
        projectRevision: PROJECT_REVISION,
        storageState: "transient",
        paused: false,
        activeRunId: "run-latest",
        hasUnsavedChanges: false,
        example: {
            key: "basicsStart",
            title: "Starting a Game",
            description: "Learn the smallest playable KAPLAY scene.",
            tags: ["basics"],
        },
        codexGuide: {
            key: "basicsStart:project-1",
            subjectTitle: "Starting a Game",
            activeStepIndex: 2,
            activeStep: {
                id: "remix",
                eyebrow: "FIRST REMIX",
                title: "Give it your own look",
                description: "Choose the feeling.",
                prompt: "Use @Browser to remix this game.",
            },
        },
    };
    const calls = {
        selected: [],
        previewRuns: 0,
        saves: 0,
        pauseStates: [],
        inspections: [],
        openedExamples: [],
    };
    const examples = [
        state.example,
        {
            key: "platformer",
            title: "Tiny Platformer",
            description: "Jump across a small level.",
            tags: ["game", "movement"],
        },
    ];

    const assertProjectRevision = (expectedProjectRevision) => {
        assert.equal(
            expectedProjectRevision,
            state.projectRevision,
            "mutation must receive the current expectedProjectRevision",
        );
    };

    return {
        files,
        assets,
        assetBrew,
        consoleEntries,
        state,
        calls,
        adapter: {
            waitUntilReady: () => undefined,
            getProject: () => ({
                name: "Agent game",
                projectId: state.projectId,
                projectRevision: state.projectRevision,
                storageState: state.storageState,
                fileCount: files.size,
                assetCount: assets.length,
                currentFile: "main.js",
                previewState: state.paused ? "paused" : "running",
                hasUnsavedChanges: state.hasUnsavedChanges,
                example: state.example,
                codexGuide: state.codexGuide,
            }),
            getProjectRevision: () => state.projectRevision,
            listExamples: () => examples,
            openExample: (
                key,
                expectedProjectRevision,
                discardUnsavedChanges,
            ) => {
                assertProjectRevision(expectedProjectRevision);
                if (
                    state.hasUnsavedChanges
                    && !discardUnsavedChanges
                ) {
                    throw new Error("The active project has unsaved changes.");
                }
                calls.openedExamples.push(key);
                state.example = examples.find((example) => example.key === key);
                state.projectRevision = `${PROJECT_REVISION}-opened`;
            },
            listFiles: () => [...files.values()],
            listAssets: () => assets,
            listAssetBrew: () => assetBrew,
            readFile: (path) => files.get(path) ?? null,
            writeFile: (path, content, expectedProjectRevision) => {
                assertProjectRevision(expectedProjectRevision);
                const file = files.get(path);
                assert.ok(file);
                files.set(path, { ...file, content });
            },
            createFile: (file, expectedProjectRevision) => {
                assertProjectRevision(expectedProjectRevision);
                files.set(file.path, file);
            },
            removeFile: (path, expectedProjectRevision) => {
                assertProjectRevision(expectedProjectRevision);
                files.delete(path);
            },
            selectFile: (path) => {
                calls.selected.push(path);
            },
            saveProject: (expectedProjectRevision) => {
                assertProjectRevision(expectedProjectRevision);
                calls.saves += 1;
                state.projectId ??= "project-saved-1";
                state.storageState = "autosaved";
                return {
                    projectId: state.projectId,
                    storageState: state.storageState,
                };
            },
            runPreview: () => {
                calls.previewRuns += 1;
                state.activeRunId = `run-${calls.previewRuns}`;
                state.paused = false;
                return { runId: state.activeRunId, status: "loaded" };
            },
            setPreviewPaused: (paused) => {
                calls.pauseStates.push(paused);
                state.paused = paused;
                return { runId: state.activeRunId, paused };
            },
            stopPreview: () => {
                state.activeRunId = null;
                state.paused = false;
            },
            inspectPreview: (options) => {
                calls.inspections.push(options);
                return {
                    runId: state.activeRunId,
                    available: true,
                    scene: "main",
                    paused: state.paused,
                    viewport: { width: 640, height: 360 },
                    objectCount: 3,
                    objectsTruncated: true,
                    objects: [
                        { id: 1, tags: ["enemy"], position: { x: 10, y: 20 } },
                        { id: 2, tags: ["enemy"], position: { x: 30, y: 40 } },
                        { id: 3, tags: ["friend"], position: { x: 50, y: 60 } },
                    ],
                };
            },
            getDiagnostics: () => ({
                available: true,
                diagnostics: [],
            }),
            getConsoleEntries: () => ({
                available: true,
                entries: consoleEntries,
                droppedCount: 0,
            }),
            getPreviewRunId: () => state.activeRunId,
        },
    };
}

async function execute(context, name, input = {}) {
    return context.tool(name).execute(input, {
        signal: new AbortController().signal,
    });
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

describe("coding-agent play guides", () => {
    it("keeps one guide identity across save without leaking between projects", () => {
        const createdAt = "2026-08-30T10:00:00.000Z";
        const transientKey = createCodexPlayGuideKey(
            "basicsStart",
            createdAt,
            null,
        );
        const savedKey = createCodexPlayGuideKey(
            "basicsStart",
            createdAt,
            "saved-project-id",
        );

        assert.equal(savedKey, transientKey);
        assert.notEqual(
            transientKey,
            createCodexPlayGuideKey(
                "basicsStart",
                "2026-08-30T10:01:00.000Z",
                null,
            ),
        );
    });

    it("stores and bounds each guide's visible idea independently", () => {
        const values = new Map();
        const storage = {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
        };

        writeCodexPlayStepIndex("guide-a", 3, storage);
        writeCodexPlayStepIndex("guide-b", 1, storage);
        assert.equal(readCodexPlayStepIndex("guide-a", 5, storage), 3);
        assert.equal(readCodexPlayStepIndex("guide-b", 5, storage), 1);
        assert.equal(readCodexPlayStepIndex("guide-a", 2, storage), 1);
    });

    it("keeps the hand-authored starter path for the Codex game", () => {
        const guide = createCodexPlayGuide({
            key: "webmcpAgent",
            title: "Play & Remix with Codex",
            isStarter: true,
        });

        assert.equal(guide.steps.length, 5);
        assert.equal(guide.steps[0].title, "Play the tiny game");
        for (const step of guide.steps.filter((step) => step.prompt)) {
            assert.match(step.prompt, /@Browser/);
        }

        const demoSource = readFileSync(
            new URL("../src/data/demos.ts", import.meta.url),
            "utf8",
        );
        assert.match(demoSource, /Moonlit Apple Run/);
        assert.doesNotMatch(demoSource, /title: "Sweet Bean Dreams"/);
        assert.doesNotMatch(demoSource, /sleepy-cloud/);
        assert.doesNotMatch(demoSource, /cheerfulBurst/);
    });

    it("creates a complete, example-specific prompt path for every generated example", () => {
        const examples = JSON.parse(
            readFileSync(
                new URL("../src/data/exampleList.json", import.meta.url),
                "utf8",
            ),
        );

        assert.ok(examples.length > 100);
        const presentations = new Set();
        const presentationsByName = new Map();
        for (const example of examples) {
            const guide = createCodexPlayGuide({
                key: example.name,
                title: example.formattedName,
                source: example.code,
            });
            presentations.add(guide.presentation);
            presentationsByName.set(example.name, guide.presentation);

            assert.equal(guide.steps.length, 5, example.name);
            assert.equal(guide.subjectTitle, example.formattedName);
            for (const step of guide.steps) {
                assert.ok(step.title.trim(), `${example.name}:${step.id}`);
                assert.ok(
                    step.description.trim(),
                    `${example.name}:${step.id}`,
                );
                if (!step.prompt) continue;
                assert.match(step.prompt, /@Browser/, example.name);
                assert.ok(
                    step.prompt.includes(example.formattedName),
                    `${example.name}:${step.id}`,
                );
                assert.doesNotMatch(step.prompt, /\b(?:undefined|null)\b/);
            }

            for (const stepId of ["remix", "build", "invent"]) {
                const prompt = guide.steps.find((step) => step.id === stepId)
                    ?.prompt;
                assert.match(prompt, /run/i, `${example.name}:${stepId}`);
                assert.match(prompt, /fix/i, `${example.name}:${stepId}`);
            }
        }
        assert.deepEqual(
            [...presentations].sort(),
            ["interactive", "output", "visual"],
        );
        for (const name of ["button", "clicktopmost", "hover"]) {
            assert.equal(presentationsByName.get(name), "interactive", name);
        }
        assert.equal(presentationsByName.get("kaboom"), "interactive");
        assert.equal(presentationsByName.get("onLoadError"), "output");
        assert.equal(presentationsByName.get("basicsStart"), "visual");
    });

    it("uses friendly output copy when an example has no visible scene", () => {
        const guide = createCodexPlayGuide({
            key: "blank-example",
            title: "  Blank   Example  ",
            source: "kaplay(); console.log('done');",
        });

        assert.equal(guide.subjectTitle, "Blank Example");
        assert.equal(guide.presentation, "output");
        assert.match(guide.steps[0].description, /game area may be blank/i);
        assert.match(guide.steps[1].prompt, /live output/i);
    });

    it("classifies combined executable source without trusting comments or strings", () => {
        const combined = createCodexPlayGuide({
            key: "project",
            title: "Project",
            source:
                "import './scenes/game.js'; go('game');\nadd([rect(32, 32)]); onKeyPress('space', jump);",
        });
        const commentsOnly = createCodexPlayGuide({
            key: "comments",
            title: "Comments",
            source:
                "kaplay(); // addKaboom(vec2(10, 10))\nconsole.log('onClick addSprite');",
        });

        assert.equal(combined.presentation, "interactive");
        assert.equal(commentsOnly.presentation, "output");
    });
});

describe("KAPLAYGROUND WebMCP", () => {
    it("keeps the sandbox side of the preview protocol in the repository", () => {
        const sandbox = readFileSync(
            new URL("../sandbox/index.html", import.meta.url),
            "utf8",
        );
        for (
            const messageType of [
                "RUN_RESULT",
                "SET_PAUSED",
                "PAUSE_RESULT",
                "INSPECT_RUNTIME",
                "RUNTIME_INSPECTION_RESULT",
            ]
        ) {
            assert.match(sandbox, new RegExp(`\\b${messageType}\\b`));
        }
        assert.match(sandbox, /protocolVersion:\s*PREVIEW_PROTOCOL_VERSION/);
        assert.match(sandbox, /import \* as HookModule/);
        assert.match(sandbox, /module\?\.default\?\.default/);
        assert.match(sandbox, /consoleHook\(true\)/);
        assert.doesNotMatch(sandbox, /hookedConsole\.unhook/);
    });

    it("keeps WebMCP console capture active when the visible console preference is false", () => {
        const sandbox = readFileSync(
            new URL("../sandbox/index.html", import.meta.url),
            "utf8",
        );
        const toggleHandler = sandbox.match(
            /TOGGLE_CONSOLE\(\)\s*\{(?<body>[\s\S]*?)\n\s*\},/,
        );

        assert.ok(toggleHandler?.groups?.body);
        assert.doesNotMatch(toggleHandler.groups.body, /hook|unhook/i);
        assert.match(sandbox, /consoleHook\(true\)/);
    });

    it("binds queued transient saves to their call-time project snapshot", async () => {
        const firstWriteStarted = deferred();
        const releaseFirstWrite = deferred();
        const writes = [];
        const deleted = [];
        const committed = [];
        let nextId = 0;
        const state = {
            generation: 1,
            key: null,
            revision: 1,
            project: {
                name: "Project A",
                sourceDemoKey: "basicsStart",
                files: new Map([["main.js", { value: "A" }]]),
            },
        };
        const persist = createActiveProjectPersister({
            getActiveProject: () => state,
            getActiveIdentity: () => ({
                generation: state.generation,
                key: state.key,
                revision: state.revision,
            }),
            snapshotProject: (project) => ({
                ...project,
                files: new Map(
                    [...project.files].map(([path, file]) => [
                        path,
                        { ...file },
                    ]),
                ),
            }),
            generateId: () => `project-a-${++nextId}`,
            writeProject: async (id, snapshot) => {
                writes.push({ id, snapshot });
                if (writes.length === 1) {
                    firstWriteStarted.resolve();
                    await releaseFirstWrite.promise;
                }
            },
            deleteProject: async (id) => {
                deleted.push(id);
            },
            commitTransientProject: (id) => {
                committed.push(id);
                state.key = id;
            },
        });

        const first = persist();
        await firstWriteStarted.promise;
        const second = persist();

        state.project.files.get("main.js").value = "mutated A";
        state.generation = 2;
        state.key = null;
        state.project = {
            name: "Project B",
            files: new Map([["main.js", { value: "B" }]]),
        };
        releaseFirstWrite.resolve();

        const results = await Promise.allSettled([first, second]);
        assert.deepEqual(results.map(({ status }) => status), [
            "rejected",
            "rejected",
        ]);
        for (const result of results) {
            assert.match(result.reason.message, /active project changed/i);
        }
        assert.equal(writes.length, 1);
        assert.equal(writes[0].snapshot.name, "Project A");
        assert.equal(writes[0].snapshot.sourceDemoKey, "basicsStart");
        assert.equal(writes[0].snapshot.files.get("main.js").value, "A");
        assert.deepEqual(deleted, ["project-a-1"]);
        assert.deepEqual(committed, []);
        assert.equal(state.generation, 2);
        assert.equal(state.key, null);
        assert.equal(state.project.name, "Project B");
        assert.equal(state.project.files.get("main.js").value, "B");
    });

    it("does not mark edited transient contents saved after a stale write", async () => {
        const firstWriteStarted = deferred();
        const releaseFirstWrite = deferred();
        const writes = [];
        const deleted = [];
        const committed = [];
        let nextId = 0;
        const state = {
            generation: 1,
            key: null,
            revision: 1,
            project: {
                name: "Transient project",
                files: new Map([["main.js", { value: "v1" }]]),
            },
        };
        const persist = createActiveProjectPersister({
            getActiveProject: () => state,
            getActiveIdentity: () => ({
                generation: state.generation,
                key: state.key,
                revision: state.revision,
            }),
            snapshotProject: (project) => ({
                ...project,
                files: new Map(
                    [...project.files].map(([path, file]) => [
                        path,
                        { ...file },
                    ]),
                ),
            }),
            generateId: () => `transient-${++nextId}`,
            writeProject: async (id, snapshot) => {
                writes.push({ id, snapshot });
                if (writes.length === 1) {
                    firstWriteStarted.resolve();
                    await releaseFirstWrite.promise;
                }
            },
            deleteProject: async (id) => {
                deleted.push(id);
            },
            commitTransientProject: (id) => {
                committed.push(id);
                state.key = id;
            },
        });

        const staleSave = persist();
        await firstWriteStarted.promise;

        state.project.files.set("main.js", { value: "v2" });
        state.revision += 1;
        releaseFirstWrite.resolve();

        await assert.rejects(staleSave, /active project changed/i);
        assert.equal(writes[0].snapshot.files.get("main.js").value, "v1");
        assert.deepEqual(deleted, ["transient-1"]);
        assert.deepEqual(committed, []);
        assert.equal(state.key, null);

        await persist();
        assert.equal(writes[1].snapshot.files.get("main.js").value, "v2");
        assert.deepEqual(committed, ["transient-2"]);
        assert.equal(state.key, "transient-2");
    });

    it("registers the complete editor tool surface", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            appVersion: "2.5.3",
            modelContext: context,
        });

        await bridge.ready;

        assert.deepEqual(bridge.toolNames, FULL_TOOL_NAMES);
        assert.deepEqual(bridge.toolNames, KAPLAY_PLUGIN_FIXTURE.fullSurface);

        const guide = await execute(
            context,
            "kaplayground_get_agent_guide",
        );
        assert.equal(guide.title, "KAPLAYGROUND coding-agent workflow");
        assert.equal(guide.contractVersion, "1.1");
        assert.equal(guide.guideVersion, 5);
        assert.equal(guide.appVersion, "2.5.3");
        assert.equal(Object.hasOwn(guide, "version"), false);
        assert.deepEqual(guide.availableTools, bridge.toolNames);
        assert.match(guide.starterPrompt, /kaplayground_get_project/);
        assert.match(guide.starterPrompt, /kaplayground_search_asset_brew/);
        assert.equal(
            guide.assetBrew.tool,
            "kaplayground_search_asset_brew",
        );
        assert.doesNotMatch(guide.starterPrompt, /gameSettings/);
        assert.ok(guide.workflow.length >= 9);
        assert.equal(guide.capabilities.guidance.complete, true);
        assert.equal(guide.capabilities.browser.available, false);
        assert.ok(
            guide.capabilities.browser.unsupportedOperations.includes(
                "screenshots",
            ),
        );
        assert.equal(
            guide.workflow.find(({ id }) => id === "inspect").available,
            true,
        );
        assert.deepEqual(
            guide.referenceTopics.map(({ topic }) => topic),
            [
                "file-editing",
                "preview-verification",
                "kaplay-patterns",
                "assets",
                "persistence",
                "failure-recovery",
            ],
        );
    });

    it("waits for registration before returning the agent guide", async () => {
        const context = new DelayedRegistrationModelContext(
            "kaplayground_get_reference",
        );
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });

        await context.delayReached.promise;
        assert.deepEqual(bridge.toolNames, [
            "kaplayground_get_agent_guide",
        ]);

        let guideSettled = false;
        const guidePromise = execute(
            context,
            "kaplayground_get_agent_guide",
        ).finally(() => {
            guideSettled = true;
        });
        const abortController = new AbortController();
        const abortedGuidePromise = context.tool(
            "kaplayground_get_agent_guide",
        ).execute({}, { signal: abortController.signal });
        const abortedGuideAssertion = assert.rejects(
            abortedGuidePromise,
            (error) => error?.name === "AbortError",
        );
        abortController.abort();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const settledBeforeRelease = guideSettled;

        await abortedGuideAssertion;

        context.releaseDelay.resolve();
        const guide = await guidePromise;
        await bridge.ready;

        assert.equal(settledBeforeRelease, false);
        assert.deepEqual(guide.availableTools, bridge.toolNames);
        assert.deepEqual(guide.availableTools, FULL_TOOL_NAMES);
    });

    it("derives guide capabilities and workflow blockers from a reduced adapter", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        for (
            const capability of [
                "listExamples",
                "openExample",
                "listAssets",
                "listAssetBrew",
                "createFile",
                "removeFile",
                "selectFile",
                "saveProject",
                "runPreview",
                "setPreviewPaused",
                "stopPreview",
                "inspectPreview",
                "getDiagnostics",
                "getConsoleEntries",
                "getPreviewRunId",
            ]
        ) {
            delete adapter[capability];
        }
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });

        await bridge.ready;

        assert.deepEqual(bridge.toolNames, [
            "kaplayground_get_agent_guide",
            "kaplayground_get_reference",
            "kaplayground_get_project",
            "kaplayground_list_files",
            "kaplayground_read_file",
            "kaplayground_replace_file",
        ]);
        const guide = await execute(
            context,
            "kaplayground_get_agent_guide",
        );
        assert.equal(guide.appVersion, null);
        assert.deepEqual(guide.availableTools, bridge.toolNames);
        assert.equal(guide.capabilities.guidance.complete, true);
        assert.equal(guide.capabilities.projects.available, true);
        assert.equal(guide.capabilities.projects.complete, false);
        assert.equal(guide.capabilities.assets.available, false);
        assert.equal(guide.capabilities.preview.available, false);
        assert.equal(guide.capabilities.diagnostics.available, false);
        assert.doesNotMatch(guide.starterPrompt, /search_asset_brew/);
        assert.doesNotMatch(guide.starterPrompt, /list_examples/);
        assert.match(
            guide.starterPrompt,
            /runtime verification is unavailable/,
        );
        assert.equal(
            guide.workflow.find(({ id }) => id === "inspect").available,
            true,
        );
        assert.equal(
            guide.workflow.find(({ id }) => id === "edit").available,
            true,
        );
        const runStep = guide.workflow.find(({ id }) => id === "run");
        assert.equal(runStep.available, false);
        assert.deepEqual(runStep.missingTools, [
            "kaplayground_run_preview",
        ]);
        const discoverStep = guide.workflow.find(({ id }) => id === "discover");
        assert.equal(discoverStep.available, false);
        assert.deepEqual(discoverStep.missingTools, [
            "kaplayground_list_examples",
            "kaplayground_open_example",
        ]);
    });

    it("returns six static focused references without project-derived content", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            appVersion: "2.5.3",
            modelContext: context,
        });
        await bridge.ready;

        const topics = [
            "file-editing",
            "preview-verification",
            "kaplay-patterns",
            "assets",
            "persistence",
            "failure-recovery",
        ];
        for (const topic of topics) {
            const reference = await execute(
                context,
                "kaplayground_get_reference",
                { topic },
            );
            assert.equal(reference.contractVersion, "1.1");
            assert.equal(reference.guideVersion, 5);
            assert.equal(reference.appVersion, "2.5.3");
            assert.equal(reference.topic, topic);
            assert.equal(Object.hasOwn(reference, "version"), false);
            assert.ok(reference.guidance.summary.length > 0);
            assert.ok(reference.guidance.steps.length > 0);
            assert.ok(reference.guidance.invariants.length > 0);
            assert.ok(reference.guidance.failureCases.length > 0);
            assert.deepEqual(reference.kaplayVersions.families, [
                "3001.0",
                "4000.0",
                "master",
            ]);
            assert.doesNotMatch(
                JSON.stringify(reference),
                /Agent game|project-revision-1|main\.js.*add\(/,
            );
        }

        await assert.rejects(
            execute(context, "kaplayground_get_reference", {
                topic: "not-a-topic",
            }),
            /Unknown reference topic/,
        );
    });

    it("marks every project and guidance read as read-only untrusted content", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        for (
            const toolName of [
                "kaplayground_get_agent_guide",
                "kaplayground_get_reference",
                "kaplayground_list_examples",
                "kaplayground_get_project",
                "kaplayground_list_files",
                "kaplayground_list_assets",
                "kaplayground_search_asset_brew",
                "kaplayground_read_file",
                "kaplayground_inspect_preview",
                "kaplayground_get_diagnostics",
                "kaplayground_get_console",
            ]
        ) {
            assert.deepEqual(context.tool(toolName).annotations, {
                readOnlyHint: true,
                untrustedContentHint: true,
            });
        }
    });

    it("waits for application readiness before registering tools", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const applicationReady = deferred();
        adapter.waitUntilReady = () => applicationReady.promise;

        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        let settled = false;
        void bridge.ready.then(() => {
            settled = true;
        });
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(settled, false);
        assert.equal(bridge.status, "registering");
        assert.equal(context.registered.length, 0);

        applicationReady.resolve();
        await bridge.ready;
        assert.equal(bridge.status, "ready");
        assert.equal(context.registered.length, 20);
    });

    it("lets the agent find and open an exact game starting point", async () => {
        const context = new FakeModelContext();
        const { adapter, calls, state } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(
            context,
            "kaplayground_list_examples",
            { query: "platform", tag: "game" },
        );
        assert.equal(result.total, 1);
        assert.equal(result.examples[0].key, "platformer");
        assert.equal(result.projectRevision, PROJECT_REVISION);

        state.hasUnsavedChanges = true;
        await assert.rejects(
            execute(context, "kaplayground_open_example", {
                key: "platformer",
                expectedProjectRevision: result.projectRevision,
            }),
            /unsaved changes/i,
        );
        assert.deepEqual(calls.openedExamples, []);
        state.hasUnsavedChanges = false;

        const opened = await execute(
            context,
            "kaplayground_open_example",
            {
                key: "platformer",
                expectedProjectRevision: result.projectRevision,
            },
        );
        assert.deepEqual(calls.openedExamples, ["platformer"]);
        assert.deepEqual(opened, {
            openedExample: "platformer",
            projectRevision: `${PROJECT_REVISION}-opened`,
        });
    });

    it("serializes concurrent starting-point replacements", async () => {
        const context = new FakeModelContext();
        const { adapter, calls, state } = createAdapter();
        const firstStarted = deferred();
        const releaseFirst = deferred();
        adapter.openExample = async (
            key,
            expectedProjectRevision,
        ) => {
            assert.equal(expectedProjectRevision, state.projectRevision);
            firstStarted.resolve();
            await releaseFirst.promise;
            calls.openedExamples.push(key);
            state.projectRevision = `${PROJECT_REVISION}-${key}`;
        };
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const first = execute(context, "kaplayground_open_example", {
            key: "platformer",
            expectedProjectRevision: PROJECT_REVISION,
        });
        await firstStarted.promise;
        const second = execute(context, "kaplayground_open_example", {
            key: "basicsStart",
            expectedProjectRevision: PROJECT_REVISION,
        });
        releaseFirst.resolve();

        assert.equal((await first).openedExample, "platformer");
        await assert.rejects(second, /Project changed/i);
        assert.deepEqual(calls.openedExamples, ["platformer"]);
    });

    it("rechecks unsaved state at the example adapter boundary", async () => {
        const context = new FakeModelContext();
        const { adapter, calls, state } = createAdapter();
        const listExamples = adapter.listExamples;
        adapter.listExamples = () => {
            state.hasUnsavedChanges = true;
            return listExamples();
        };
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        await assert.rejects(
            execute(context, "kaplayground_open_example", {
                key: "platformer",
                expectedProjectRevision: PROJECT_REVISION,
            }),
            /unsaved changes/i,
        );
        assert.deepEqual(calls.openedExamples, []);
    });

    it("waits for the preview to acknowledge that its run loaded", async () => {
        const context = new FakeModelContext();
        const { adapter, calls } = createAdapter();
        const previewFinished = deferred();
        adapter.runPreview = async () => {
            calls.previewRuns += 1;
            await previewFinished.promise;
            return { runId: "run-acknowledged", status: "loaded" };
        };
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        let settled = false;
        const invocation = execute(context, "kaplayground_run_preview");
        void invocation.then(() => {
            settled = true;
        });
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(calls.previewRuns, 1);
        assert.equal(settled, false);

        previewFinished.resolve();
        assert.deepEqual(await invocation, {
            previewState: "running",
            runId: "run-acknowledged",
            status: "loaded",
        });
    });

    it("coalesces superseded preview runs until the newest run finishes", async () => {
        const coordinator = createPreviewRunCoordinator();
        const firstStarted = deferred();
        const secondFinished = deferred();
        let firstAborted = false;
        let newestPosted = false;

        const first = coordinator.run(async (signal) => {
            firstStarted.resolve();
            await new Promise((resolve) => {
                signal.addEventListener("abort", () => {
                    firstAborted = true;
                    resolve();
                }, { once: true });
            });
        });
        await firstStarted.promise;

        const second = coordinator.run(async (signal) => {
            await secondFinished.promise;
            signal.throwIfAborted();
            newestPosted = true;
        });

        assert.strictEqual(first, second);
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(firstAborted, true);

        let settled = false;
        void first.then(() => {
            settled = true;
        });
        await Promise.resolve();
        assert.equal(settled, false);

        secondFinished.resolve();
        await Promise.all([first, second]);
        assert.equal(newestPosted, true);
    });

    it("rejects an explicitly cancelled preview run with AbortError", async () => {
        const coordinator = createPreviewRunCoordinator();
        const started = deferred();
        const invocation = coordinator.run(async (signal) => {
            started.resolve();
            await new Promise((_resolve, reject) => {
                signal.addEventListener(
                    "abort",
                    () => reject(signal.reason),
                    { once: true },
                );
            });
        });
        await started.promise;

        coordinator.cancel();

        await assert.rejects(invocation, (error) => {
            assert.equal(error.name, "AbortError");
            return true;
        });
    });

    it("replaces files only when their revision is current", async () => {
        const context = new FakeModelContext();
        const { adapter, files, calls } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const original = files.get("main.js").content;
        await execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([circle(24)])\n",
            expectedRevision: kaplaygroundContentRevision(original),
            expectedProjectRevision: PROJECT_REVISION,
            runPreview: true,
        });

        assert.equal(files.get("main.js").content, "add([circle(24)])\n");
        assert.equal(calls.previewRuns, 1);
        await assert.rejects(
            execute(context, "kaplayground_replace_file", {
                path: "main.js",
                content: "stale write",
                expectedRevision: kaplaygroundContentRevision(original),
                expectedProjectRevision: PROJECT_REVISION,
            }),
            /Revision conflict/,
        );
    });

    it("serializes concurrent replacements before checking their revisions", async () => {
        const context = new FakeModelContext();
        const { adapter, files } = createAdapter();
        const original = files.get("main.js").content;
        const originalWriteFile = adapter.writeFile;
        let releaseFirstWrite;
        const firstWriteReleased = new Promise((resolve) => {
            releaseFirstWrite = resolve;
        });
        let signalFirstWriteStarted;
        const firstWriteStarted = new Promise((resolve) => {
            signalFirstWriteStarted = resolve;
        });
        let writeCount = 0;
        adapter.writeFile = async (path, content, expectedProjectRevision) => {
            writeCount += 1;
            if (writeCount === 1) {
                signalFirstWriteStarted();
                await firstWriteReleased;
            }
            originalWriteFile(path, content, expectedProjectRevision);
        };

        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const first = execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([circle(24)])\n",
            expectedRevision: kaplaygroundContentRevision(original),
            expectedProjectRevision: PROJECT_REVISION,
        });
        await firstWriteStarted;
        const second = execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([sprite(\"bean\")])\n",
            expectedRevision: kaplaygroundContentRevision(original),
            expectedProjectRevision: PROJECT_REVISION,
        });

        releaseFirstWrite();
        const [firstResult, secondResult] = await Promise.allSettled([
            first,
            second,
        ]);

        assert.equal(firstResult.status, "fulfilled");
        assert.equal(secondResult.status, "rejected");
        assert.match(secondResult.reason.message, /Revision conflict/);
        assert.equal(writeCount, 1);
        assert.equal(files.get("main.js").content, "add([circle(24)])\n");
    });

    it("serializes replacement and removal before checking revisions", async () => {
        const context = new FakeModelContext();
        const { adapter, files } = createAdapter();
        const original = files.get("main.js").content;
        const originalWriteFile = adapter.writeFile;
        const firstWriteStarted = deferred();
        const releaseFirstWrite = deferred();
        adapter.writeFile = async (path, content, expectedProjectRevision) => {
            firstWriteStarted.resolve();
            await releaseFirstWrite.promise;
            originalWriteFile(path, content, expectedProjectRevision);
        };

        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const replacement = execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([circle(24)])\n",
            expectedRevision: kaplaygroundContentRevision(original),
            expectedProjectRevision: PROJECT_REVISION,
        });
        await firstWriteStarted.promise;
        const removal = execute(context, "kaplayground_remove_file", {
            path: "main.js",
            expectedRevision: kaplaygroundContentRevision(original),
            expectedProjectRevision: PROJECT_REVISION,
        });

        releaseFirstWrite.resolve();
        const [replaceResult, removeResult] = await Promise.allSettled([
            replacement,
            removal,
        ]);

        assert.equal(replaceResult.status, "fulfilled");
        assert.equal(removeResult.status, "rejected");
        assert.match(removeResult.reason.message, /Revision conflict/);
        assert.equal(files.get("main.js").content, "add([circle(24)])\n");
    });

    it("serializes concurrent creates for the same path", async () => {
        const context = new FakeModelContext();
        const { adapter, files } = createAdapter();
        const originalCreateFile = adapter.createFile;
        const firstCreateStarted = deferred();
        const releaseFirstCreate = deferred();
        let createCount = 0;
        adapter.createFile = async (file, expectedProjectRevision) => {
            createCount += 1;
            if (createCount === 1) {
                firstCreateStarted.resolve();
                await releaseFirstCreate.promise;
            }
            originalCreateFile(file, expectedProjectRevision);
        };

        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const first = execute(context, "kaplayground_create_file", {
            path: "scenes/level.js",
            content: "scene(\"first\", () => {});\n",
            expectedProjectRevision: PROJECT_REVISION,
        });
        await firstCreateStarted.promise;
        const second = execute(context, "kaplayground_create_file", {
            path: "scenes/level.js",
            content: "scene(\"second\", () => {});\n",
            expectedProjectRevision: PROJECT_REVISION,
        });

        releaseFirstCreate.resolve();
        const [firstResult, secondResult] = await Promise.allSettled([
            first,
            second,
        ]);

        assert.equal(firstResult.status, "fulfilled");
        assert.equal(secondResult.status, "rejected");
        assert.match(secondResult.reason.message, /already exists/);
        assert.equal(createCount, 1);
        assert.equal(
            files.get("scenes/level.js").content,
            "scene(\"first\", () => {});\n",
        );
    });

    it("creates and removes project files through revision-safe calls", async () => {
        const context = new FakeModelContext();
        const { adapter, files, calls } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const content = "scene(\"level\", () => {});\n";
        await execute(context, "kaplayground_create_file", {
            path: "scenes/level.js",
            content,
            kind: "scene",
            expectedProjectRevision: PROJECT_REVISION,
            runPreview: true,
        });

        assert.equal(files.get("scenes/level.js").content, content);
        assert.deepEqual(calls.selected, ["scenes/level.js"]);
        assert.equal(calls.previewRuns, 1);

        await execute(context, "kaplayground_remove_file", {
            path: "scenes/level.js",
            expectedRevision: kaplaygroundContentRevision(content),
            expectedProjectRevision: PROJECT_REVISION,
        });

        assert.equal(files.has("scenes/level.js"), false);
    });

    it("rejects a stale project revision before mutating a file", async () => {
        const context = new FakeModelContext();
        const { adapter, files } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const original = files.get("main.js").content;
        await assert.rejects(
            execute(context, "kaplayground_replace_file", {
                path: "main.js",
                content: "add([circle(8)])\n",
                expectedRevision: kaplaygroundContentRevision(original),
                expectedProjectRevision: "stale-project-revision",
            }),
            /Project changed/,
        );

        assert.equal(files.get("main.js").content, original);
    });

    it("rejects extensionless aliases instead of selecting a different exact path", async () => {
        const context = new FakeModelContext();
        const { adapter, files } = createAdapter();
        const readExactFile = adapter.readFile;
        adapter.readFile = (path) =>
            path === "main"
                ? files.get("main.js")
                : readExactFile(path);
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        await assert.rejects(
            execute(context, "kaplayground_read_file", { path: "main" }),
            /not an exact project path.*main\.js/,
        );
        await assert.rejects(
            execute(context, "kaplayground_read_file", { path: "/main.js" }),
            /normalized project-relative path/,
        );
        await assert.rejects(
            execute(context, "kaplayground_read_file", { path: "main.js/" }),
            /normalized project-relative path/,
        );
    });

    it("saves the current project with its opaque project revision", async () => {
        const context = new FakeModelContext();
        const { adapter, calls, state } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const project = await execute(context, "kaplayground_get_project");
        assert.equal(project.projectRevision, PROJECT_REVISION);
        assert.equal(project.storageState, "transient");
        assert.deepEqual(project.example, {
            key: "basicsStart",
            title: "Starting a Game",
            description: "Learn the smallest playable KAPLAY scene.",
            tags: ["basics"],
        });
        assert.equal(project.codexGuide.activeStepIndex, 2);
        assert.equal(project.codexGuide.activeStep.id, "remix");
        assert.match(project.codexGuide.activeStep.prompt, /@Browser/);

        const result = await execute(context, "kaplayground_save_project", {
            expectedProjectRevision: project.projectRevision,
        });

        assert.deepEqual(result, {
            projectRevision: PROJECT_REVISION,
            projectId: "project-saved-1",
            storageState: "autosaved",
        });
        assert.equal(state.projectId, "project-saved-1");
        assert.equal(state.storageState, "autosaved");
        assert.equal(calls.saves, 1);
    });

    it("filters and paginates asset metadata without exposing URLs", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(context, "kaplayground_list_assets", {
            kind: "sprite",
            offset: 1,
            limit: 1,
        });

        assert.equal(result.projectRevision, PROJECT_REVISION);
        assert.equal(result.kind, "sprite");
        assert.equal(result.total, 2);
        assert.equal(result.offset, 1);
        assert.equal(result.limit, 1);
        assert.equal(result.assets.length, 1);
        assert.equal(result.assets[0].path, "assets/sprites/zapper.png");
        assert.equal(result.assets[0].source, "blob");
        assert.equal("url" in result.assets[0], false);
    });

    it("searches Asset Brew metadata and ranks the strongest semantic match", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(
            context,
            "kaplayground_search_asset_brew",
            {
                query: "magic bean",
                kind: "sprite",
                limit: 10,
            },
        );

        assert.equal(result.query, "magic bean");
        assert.equal(result.kind, "sprite");
        assert.equal(result.total, 2);
        assert.equal(result.assets[0].key, "wizarding");
        assert.deepEqual(result.assets[0].animations, ["anim"]);
        assert.match(result.assets[0].importFunction, /wizarding\.png/);
        assert.equal("url" in result.assets[0], false);
    });

    it("filters Asset Brew by kind and exact tag", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(
            context,
            "kaplayground_search_asset_brew",
            {
                query: "voice",
                kind: "sound",
                tag: "sounds",
            },
        );

        assert.equal(result.total, 1);
        assert.equal(result.assets[0].key, "mark_voice");
        assert.match(result.assets[0].importFunction, /^loadSound/);
    });

    it("bounds strings in asset metadata", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        adapter.listAssets = () => [{
            name: "x".repeat(1_000),
            path: "assets/sprites/large.png",
            kind: "sprite",
            importFunction: "y".repeat(20_000),
            source: "embedded",
        }];
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(context, "kaplayground_list_assets");
        assert.equal(result.assets[0].name.length, 256);
        assert.equal(result.assets[0].importFunction.length, 2_048);
        assert.equal(result.assets[0].metadataTruncated, true);
    });

    it("sets an explicit preview pause state and returns the acknowledged state", async () => {
        const context = new FakeModelContext();
        const { adapter, calls } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        assert.deepEqual(
            await execute(context, "kaplayground_set_preview_paused", {
                paused: true,
            }),
            {
                previewState: "paused",
                runId: "run-latest",
                paused: true,
            },
        );
        assert.deepEqual(
            await execute(context, "kaplayground_set_preview_paused", {
                paused: false,
            }),
            {
                previewState: "running",
                runId: "run-latest",
                paused: false,
            },
        );
        assert.deepEqual(calls.pauseStates, [true, false]);
    });

    it("returns a bounded preview inspection", async () => {
        const context = new FakeModelContext();
        const { adapter, calls } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(context, "kaplayground_inspect_preview", {
            tag: "enemy",
            limit: 2,
        });

        assert.deepEqual(calls.inspections, [{ tag: "enemy", limit: 2 }]);
        assert.equal(result.runId, "run-latest");
        assert.equal(result.scene, "main");
        assert.equal(result.objectCount, 3);
        assert.equal(result.objectsTruncated, true);
        assert.deepEqual(result.objects.map(({ id }) => id), [1, 2]);
    });

    it("reports diagnostics as unavailable when Monaco is missing", async () => {
        const capture = collectMonacoDiagnostics(
            undefined,
            new Map([["main.js", {}]]),
        );
        assert.deepEqual(capture, {
            available: false,
            diagnostics: [],
        });

        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        adapter.getDiagnostics = () => capture;
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(
            context,
            "kaplayground_get_diagnostics",
        );
        assert.equal(result.available, false);
        assert.equal(result.total, 0);
        assert.equal(result.truncated, false);
        assert.deepEqual(result.diagnostics, []);
    });

    it("reports available Monaco with no markers as a clean result", async () => {
        const capture = collectMonacoDiagnostics({
            MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
            editor: { getModelMarkers: () => [] },
        }, new Map([["main.js", {}]]));
        assert.deepEqual(capture, {
            available: true,
            diagnostics: [],
        });

        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        adapter.getDiagnostics = () => capture;
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(
            context,
            "kaplayground_get_diagnostics",
        );
        assert.equal(result.available, true);
        assert.equal(result.total, 0);
        assert.equal(result.truncated, false);
        assert.deepEqual(result.diagnostics, []);
    });

    it("defaults console reads to the active run and supports an explicit run filter", async () => {
        const context = new FakeModelContext();
        const { adapter, state } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const latest = await execute(context, "kaplayground_get_console");
        assert.equal(latest.available, true);
        assert.equal(latest.truncated, false);
        assert.equal(latest.droppedCount, 0);
        assert.equal(latest.runId, "run-latest");
        assert.equal(latest.total, 2);
        assert.deepEqual(
            latest.entries.map(({ values }) => values[0]),
            ["latest ready", "latest error"],
        );

        const old = await execute(context, "kaplayground_get_console", {
            runId: "run-old",
        });
        assert.equal(old.runId, "run-old");
        assert.equal(old.total, 1);
        assert.equal(old.entries[0].values[0], "old warning");

        state.activeRunId = "run-without-output";
        const emptyCurrentRun = await execute(
            context,
            "kaplayground_get_console",
        );
        assert.equal(emptyCurrentRun.runId, "run-without-output");
        assert.equal(emptyCurrentRun.available, true);
        assert.equal(emptyCurrentRun.total, 0);
        assert.deepEqual(emptyCurrentRun.entries, []);
    });

    it("distinguishes unavailable console capture from an available empty run", async () => {
        const context = new FakeModelContext();
        const { adapter, state } = createAdapter();
        state.activeRunId = "run-empty";
        adapter.getConsoleEntries = () => ({
            available: false,
            entries: [],
            droppedCount: 0,
        });
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const unavailable = await execute(
            context,
            "kaplayground_get_console",
        );
        assert.equal(unavailable.available, false);
        assert.equal(unavailable.runId, "run-empty");
        assert.equal(unavailable.total, 0);
        assert.deepEqual(unavailable.entries, []);
    });

    it("reports response truncation and console retention overflow", async () => {
        const capture = createBoundedConsoleCapture(500);
        for (let index = 0; index < 501; index++) {
            capture.add({
                timestamp: index,
                runId: "run-overflow",
                level: "log",
                values: [index],
            });
        }

        const context = new FakeModelContext();
        const { adapter, state } = createAdapter();
        state.activeRunId = "run-overflow";
        adapter.getConsoleEntries = () => capture.snapshot();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const result = await execute(context, "kaplayground_get_console", {
            limit: 200,
        });
        assert.equal(result.available, true);
        assert.equal(result.total, 500);
        assert.equal(result.entries.length, 200);
        assert.equal(result.truncated, true);
        assert.equal(result.droppedCount, 1);
        assert.equal(result.entries[0].values[0], 301);
        assert.equal(result.entries.at(-1).values[0], 500);
    });

    it("reports connection state and visible invocation lifecycles", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const connections = [];
        const invocations = [];
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
            onStatusChange: (status, toolNames) => {
                connections.push({ status, toolNames: [...toolNames] });
            },
            onInvocation: (invocation) => invocations.push(invocation),
        });
        await bridge.ready;

        assert.equal(connections.at(-1).status, "ready");
        assert.equal(connections.at(-1).toolNames.length, 20);

        await execute(context, "kaplayground_get_project");
        assert.deepEqual(
            invocations.slice(-2).map(({ status }) => status),
            ["running", "succeeded"],
        );

        await assert.rejects(
            execute(context, "kaplayground_read_file", { path: "missing.js" }),
            /No project file exists/,
        );
        assert.deepEqual(
            invocations.slice(-2).map(({ status }) => status),
            ["running", "failed"],
        );
        assert.match(invocations.at(-1).error, /missing\.js/);
    });

    it("keeps cleared project activity empty when an old invocation finishes", () => {
        const activity = useWebMCPActivity.getState();
        const running = {
            id: "old-project-run",
            toolName: "kaplayground_run_preview",
            input: {},
            startedAt: Date.now(),
            status: "running",
        };

        activity.recordInvocation(running);
        assert.equal(useWebMCPActivity.getState().entries.length, 1);

        activity.clearInvocations();
        activity.recordInvocation({
            ...running,
            status: "succeeded",
            durationMs: 25,
        });

        assert.deepEqual(useWebMCPActivity.getState().entries, []);
    });

    it("clears activity when the project is replaced under the same key", () => {
        const activity = useWebMCPActivity.getState();
        activity.recordInvocation({
            id: "same-key-project-run",
            toolName: "kaplayground_get_project",
            input: {},
            startedAt: Date.now(),
            status: "running",
        });
        const consoleEntries = [{ level: "log" }];

        resetWebMCPActivityOnProjectReplacement(
            { projectKey: "project-1", demoKey: null, projectGeneration: 1 },
            { projectKey: "project-1", demoKey: null, projectGeneration: 1 },
            () => consoleEntries.splice(0),
        );
        assert.equal(consoleEntries.length, 1);
        assert.equal(useWebMCPActivity.getState().entries.length, 1);

        resetWebMCPActivityOnProjectReplacement(
            { projectKey: "project-1", demoKey: null, projectGeneration: 2 },
            { projectKey: "project-1", demoKey: null, projectGeneration: 1 },
            () => consoleEntries.splice(0),
        );

        assert.deepEqual(consoleEntries, []);
        assert.deepEqual(useWebMCPActivity.getState().entries, []);
    });
});
