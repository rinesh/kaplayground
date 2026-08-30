import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    createKaplaygroundWebMCP,
    kaplaygroundContentRevision,
} from "../src/integrations/webmcp/kaplaygroundWebMCP.ts";
import { createPreviewRunCoordinator } from "../src/hooks/previewRunCoordinator.ts";
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
    const calls = {
        selected: [],
        previewRuns: 0,
    };

    return {
        files,
        calls,
        adapter: {
            getProject: () => ({
                name: "Agent game",
                fileCount: files.size,
                currentFile: "main.js",
                previewState: "running",
            }),
            listFiles: () => [...files.values()],
            readFile: (path) => files.get(path) ?? null,
            writeFile: (path, content) => {
                const file = files.get(path);
                assert.ok(file);
                files.set(path, { ...file, content });
            },
            createFile: (file) => {
                files.set(file.path, file);
            },
            removeFile: (path) => {
                files.delete(path);
            },
            selectFile: (path) => {
                calls.selected.push(path);
            },
            runPreview: () => {
                calls.previewRuns += 1;
            },
            togglePreviewPause: () => undefined,
            stopPreview: () => undefined,
            getDiagnostics: () => [],
            getConsoleEntries: () => [],
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
    it("registers the complete editor tool surface", async () => {
        const context = new FakeModelContext();
        const { adapter } = createAdapter();
        const bridge = createKaplaygroundWebMCP({ adapter, modelContext: context });

        await bridge.ready;

        assert.deepEqual(bridge.toolNames, [
            "kaplayground_get_project",
            "kaplayground_list_files",
            "kaplayground_read_file",
            "kaplayground_replace_file",
            "kaplayground_create_file",
            "kaplayground_remove_file",
            "kaplayground_select_file",
            "kaplayground_run_preview",
            "kaplayground_toggle_preview_pause",
            "kaplayground_stop_preview",
            "kaplayground_get_diagnostics",
            "kaplayground_get_console",
        ]);
    });

    it("waits for the editor to finish running the preview", async () => {
        const context = new FakeModelContext();
        const { adapter, calls } = createAdapter();
        const previewFinished = deferred();
        adapter.runPreview = async () => {
            calls.previewRuns += 1;
            await previewFinished.promise;
        };
        const bridge = createKaplaygroundWebMCP({ adapter, modelContext: context });
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
        assert.deepEqual(await invocation, { previewState: "running" });
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
        const bridge = createKaplaygroundWebMCP({ adapter, modelContext: context });
        await bridge.ready;

        const original = files.get("main.js").content;
        await execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([circle(24)])\n",
            expectedRevision: kaplaygroundContentRevision(original),
            runPreview: true,
        });

        assert.equal(files.get("main.js").content, "add([circle(24)])\n");
        assert.equal(calls.previewRuns, 1);
        await assert.rejects(
            execute(context, "kaplayground_replace_file", {
                path: "main.js",
                content: "stale write",
                expectedRevision: kaplaygroundContentRevision(original),
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
        adapter.writeFile = async (path, content) => {
            writeCount += 1;
            if (writeCount === 1) {
                signalFirstWriteStarted();
                await firstWriteReleased;
            }
            originalWriteFile(path, content);
        };

        const bridge = createKaplaygroundWebMCP({ adapter, modelContext: context });
        await bridge.ready;

        const first = execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([circle(24)])\n",
            expectedRevision: kaplaygroundContentRevision(original),
        });
        await firstWriteStarted;
        const second = execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([sprite(\"bean\")])\n",
            expectedRevision: kaplaygroundContentRevision(original),
        });

        releaseFirstWrite();
        const [firstResult, secondResult] = await Promise.allSettled([first, second]);

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
        adapter.writeFile = async (path, content) => {
            firstWriteStarted.resolve();
            await releaseFirstWrite.promise;
            originalWriteFile(path, content);
        };

        const bridge = createKaplaygroundWebMCP({ adapter, modelContext: context });
        await bridge.ready;

        const replacement = execute(context, "kaplayground_replace_file", {
            path: "main.js",
            content: "add([circle(24)])\n",
            expectedRevision: kaplaygroundContentRevision(original),
        });
        await firstWriteStarted.promise;
        const removal = execute(context, "kaplayground_remove_file", {
            path: "main.js",
            expectedRevision: kaplaygroundContentRevision(original),
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
        adapter.createFile = async (file) => {
            createCount += 1;
            if (createCount === 1) {
                firstCreateStarted.resolve();
                await releaseFirstCreate.promise;
            }
            originalCreateFile(file);
        };

        const bridge = createKaplaygroundWebMCP({ adapter, modelContext: context });
        await bridge.ready;

        const first = execute(context, "kaplayground_create_file", {
            path: "scenes/level.js",
            content: "scene(\"first\", () => {});\n",
        });
        await firstCreateStarted.promise;
        const second = execute(context, "kaplayground_create_file", {
            path: "scenes/level.js",
            content: "scene(\"second\", () => {});\n",
        });

        releaseFirstCreate.resolve();
        const [firstResult, secondResult] = await Promise.allSettled([first, second]);

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
        const bridge = createKaplaygroundWebMCP({ adapter, modelContext: context });
        await bridge.ready;

        const content = "scene(\"level\", () => {});\n";
        await execute(context, "kaplayground_create_file", {
            path: "scenes/level.js",
            content,
            kind: "scene",
            runPreview: true,
        });

        assert.equal(files.get("scenes/level.js").content, content);
        assert.deepEqual(calls.selected, ["scenes/level.js"]);
        assert.equal(calls.previewRuns, 1);

        await execute(context, "kaplayground_remove_file", {
            path: "scenes/level.js",
            expectedRevision: kaplaygroundContentRevision(content),
        });

        assert.equal(files.has("scenes/level.js"), false);
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
        assert.equal(connections.at(-1).toolNames.length, 12);

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
