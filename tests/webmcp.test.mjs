import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createPreviewRunCoordinator } from "../src/hooks/previewRunCoordinator.ts";
import {
    createKaplaygroundWebMCP,
    kaplaygroundContentRevision,
} from "../src/integrations/webmcp/kaplaygroundWebMCP.ts";
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

const PROJECT_REVISION = "project-revision-1";

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
    };
    const calls = {
        selected: [],
        previewRuns: 0,
        saves: 0,
        pauseStates: [],
        inspections: [],
    };

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
            }),
            getProjectRevision: () => state.projectRevision,
            listFiles: () => [...files.values()],
            listAssets: () => assets,
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
            getDiagnostics: () => [],
            getConsoleEntries: () => consoleEntries,
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
    });

    it("registers the complete editor tool surface", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });

        await bridge.ready;

        assert.deepEqual(bridge.toolNames, [
            "kaplayground_get_project",
            "kaplayground_list_files",
            "kaplayground_list_assets",
            "kaplayground_read_file",
            "kaplayground_replace_file",
            "kaplayground_create_file",
            "kaplayground_remove_file",
            "kaplayground_select_file",
            "kaplayground_save_project",
            "kaplayground_run_preview",
            "kaplayground_set_preview_paused",
            "kaplayground_stop_preview",
            "kaplayground_inspect_preview",
            "kaplayground_get_diagnostics",
            "kaplayground_get_console",
        ]);
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
        assert.equal(context.registered.length, 15);
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

    it("defaults console reads to the active run and supports an explicit run filter", async () => {
        const context = new FakeModelContext();
        const { adapter, state } = createAdapter();
        const bridge = createKaplaygroundWebMCP({
            adapter,
            modelContext: context,
        });
        await bridge.ready;

        const latest = await execute(context, "kaplayground_get_console");
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
        assert.equal(emptyCurrentRun.total, 0);
        assert.deepEqual(emptyCurrentRun.entries, []);
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
        assert.equal(connections.at(-1).toolNames.length, 15);

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
