import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
    assertRevisionState,
    prepareWorkflowChangeSet,
    projectInstanceRevision,
    sourceRevision,
    stableContentRevision,
    WEBMCP_WORKFLOW_CONTRACT_VERSION,
    WEBMCP_WORKFLOW_GUIDE_VERSION,
    WEBMCP_WORKFLOW_TOOL_ORDER,
    workspaceRevision,
    WorkflowContractError,
} from "../src/integrations/webmcp/workflowContract.ts";
import { summarizeWebMCPActivityInput } from "../src/integrations/webmcp/activitySummary.ts";

const fixture = JSON.parse(readFileSync(
    new URL("./fixtures/webmcp-workflow-contract.json", import.meta.url),
    "utf8",
));

function projectFiles() {
    return new Map([
        ["main.js", {
            path: "main.js",
            language: "javascript",
            kind: "main",
            value: "add([rect(32, 32)])\n",
        }],
        ["scenes/game.js", {
            path: "scenes/game.js",
            language: "javascript",
            kind: "scene",
            value: "scene(\"game\", () => {})\n",
        }],
    ]);
}

describe("WebMCP workflow contract", () => {
    it("matches the checked-in workflow surface fixture", () => {
        assert.equal(
            WEBMCP_WORKFLOW_CONTRACT_VERSION,
            fixture.workflowContractVersion,
        );
        assert.equal(WEBMCP_WORKFLOW_GUIDE_VERSION, fixture.workflowGuideVersion);
        assert.deepEqual(
            WEBMCP_WORKFLOW_TOOL_ORDER.map((name) => `kaplayground_${name}`),
            fixture.workflowSurface,
        );
    });

    it("separates active-project identity from workspace content revision", () => {
        const state = { projectGeneration: 7, projectRevision: 19 };
        assert.equal(projectInstanceRevision(state), "project-7");
        assert.equal(workspaceRevision(state), "workspace-7-19");
        assert.doesNotThrow(() =>
            assertRevisionState(state, "project-7", "workspace-7-19")
        );
        assert.throws(
            () => assertRevisionState(state, "project-6", "workspace-7-19"),
            (error) => error instanceof WorkflowContractError
                && error.code === "PROJECT_INSTANCE_CHANGED",
        );
        assert.throws(
            () => assertRevisionState(state, "project-7", "workspace-7-18"),
            (error) => error instanceof WorkflowContractError
                && error.code === "WORKSPACE_REVISION_CHANGED",
        );
    });

    it("computes deterministic source revisions across map insertion order", () => {
        const left = projectFiles();
        const right = new Map(
            [...left.entries()].reverse().map(([path, file]) => [
                path,
                { ...file },
            ]),
        );
        assert.equal(
            sourceRevision({
                mode: "ex",
                buildMode: "esbuild",
                kaplayVersion: "3001.0.19",
                files: left,
            }),
            sourceRevision({
                mode: "ex",
                buildMode: "esbuild",
                kaplayVersion: "3001.0.19",
                files: right,
            }),
        );
        right.get("main.js").value += "add([text(\"changed\")])\n";
        assert.notEqual(
            sourceRevision({ files: left }),
            sourceRevision({ files: right }),
        );
    });

    it("prepares a multi-file change without mutating the current project", () => {
        const files = projectFiles();
        const previousMain = files.get("main.js").value;
        const previousGame = files.get("scenes/game.js").value;
        const prepared = prepareWorkflowChangeSet(files, [
            {
                type: "replace",
                path: "main.js",
                content: `${previousMain}go(\"game\")\n`,
                expectedFileRevision: stableContentRevision(previousMain),
            },
            {
                type: "replace",
                path: "scenes/game.js",
                content: `${previousGame}console.log(\"ready\")\n`,
                expectedFileRevision: stableContentRevision(previousGame),
            },
            {
                type: "create",
                path: "utils/state.ts",
                content: "export const score = 0\n",
            },
        ]);

        assert.equal(files.size, 2);
        assert.equal(files.get("main.js").value, previousMain);
        assert.equal(prepared.files.size, 3);
        assert.equal(prepared.files.get("utils/state.ts").language, "typescript");
        assert.equal(prepared.files.get("utils/state.ts").kind, "util");
        assert.equal(prepared.changes.length, 3);
    });

    it("rejects the entire change set before mutation when one revision is stale", () => {
        const files = projectFiles();
        assert.throws(
            () => prepareWorkflowChangeSet(files, [
                {
                    type: "replace",
                    path: "main.js",
                    content: "changed\n",
                    expectedFileRevision: stableContentRevision(
                        files.get("main.js").value,
                    ),
                },
                {
                    type: "replace",
                    path: "scenes/game.js",
                    content: "changed\n",
                    expectedFileRevision: "stale-revision",
                },
            ]),
            (error) => error instanceof WorkflowContractError
                && error.code === "FILE_REVISION_CONFLICT",
        );
        assert.match(files.get("main.js").value, /rect/);
    });

    it("rejects duplicate paths and destructive root-file removal", () => {
        const files = projectFiles();
        const revision = stableContentRevision(files.get("main.js").value);
        assert.throws(
            () => prepareWorkflowChangeSet(files, [
                {
                    type: "replace",
                    path: "main.js",
                    content: "one\n",
                    expectedFileRevision: revision,
                },
                {
                    type: "replace",
                    path: "main.js",
                    content: "two\n",
                    expectedFileRevision: revision,
                },
            ]),
            (error) => error instanceof WorkflowContractError
                && error.code === "DUPLICATE_CHANGE_PATH",
        );
        assert.throws(
            () => prepareWorkflowChangeSet(files, [{
                type: "remove",
                path: "main.js",
                expectedFileRevision: revision,
            }]),
            (error) => error instanceof WorkflowContractError
                && error.code === "REMOVE_PATH_NOT_ALLOWED",
        );
    });
});

describe("WebMCP activity summaries", () => {
    it("redacts complete source content before activity state stores it", () => {
        const summary = summarizeWebMCPActivityInput({
            path: "main.js",
            content: "secret game source",
            operations: [
                {
                    type: "replace",
                    path: "main.js",
                    content: "nested secret source",
                },
            ],
        });

        assert.equal(summary.path, "main.js");
        assert.equal(summary.content, "[redacted 18 characters]");
        assert.equal(
            summary.operations[0].content,
            "[redacted 20 characters]",
        );
    });
});
