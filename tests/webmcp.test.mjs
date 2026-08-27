import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    createKaplaygroundWebMCP,
    kaplaygroundContentRevision,
} from "../src/integrations/webmcp/kaplaygroundWebMCP.ts";

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
});
