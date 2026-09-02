import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assetPrompt, matchesGameAsset } from "../src/data/gameAssetSearch.ts";
import {
    compareStartingPoints,
    inStartingPointCollection,
    isPlayableStartingPoint,
    matchesStartingPoint,
} from "../src/data/startingPoints.ts";
import { createActiveProjectPersister } from "../src/features/Projects/stores/activeProjectPersistence.ts";
import { isActiveGameConsoleMessage } from "../src/hooks/consoleMessages.ts";

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

function persistenceFixture(write) {
    let state = {
        generation: 1,
        revision: 0,
        key: null,
        project: {
            name: "Draft",
            files: new Map([["main.js", { value: "one" }]]),
        },
    };
    let status = "draft";
    let savedRevision = 0;
    const writes = [];
    const save = createActiveProjectPersister({
        getActiveProject: () => state,
        getActiveIdentity: () => state,
        snapshotProject: project => structuredClone(project),
        getDraftId: () => `draft-${state.generation}`,
        writeProject: async (id, project) => {
            writes.push({ id, project });
            await write?.(id, project);
        },
        onSaving: () => {
            status = "saving";
        },
        onError: (_error, captured) => {
            if (
                state.generation === captured.generation
                && state.revision === captured.revision
            ) status = "error";
        },
        onSaved: (id, captured) => {
            if (state.generation !== captured.generation) return;
            savedRevision = captured.revision;
            state = { ...state, key: id };
            status = state.revision === captured.revision ? "saved" : "saving";
        },
    });
    return {
        save,
        writes,
        get state() {
            return state;
        },
        get status() {
            return status;
        },
        get savedRevision() {
            return savedRevision;
        },
        edit(value) {
            state = {
                ...state,
                revision: state.revision + 1,
                project: {
                    ...state.project,
                    files: new Map([["main.js", { value }]]),
                },
            };
        },
        replace() {
            state = {
                ...state,
                generation: state.generation + 1,
                revision: state.revision + 1,
                key: null,
            };
            status = "draft";
        },
    };
}

describe("generation-bound project persistence", () => {
    it("doesn't persist a pristine draft until explicitly asked", async () => {
        const fixture = persistenceFixture();
        assert.equal(fixture.status, "draft");
        assert.equal(fixture.writes.length, 0);
        assert.equal(await fixture.save(), "draft-1");
        assert.equal(fixture.status, "saved");
        assert.equal(fixture.state.revision, 0);
    });

    it("uses one stable id for rapid edits, snapshots, and explicit saves", async () => {
        const pending = deferred();
        const fixture = persistenceFixture(() => pending.promise);
        fixture.edit("two");
        const first = fixture.save();
        const firstRejected = assert.rejects(
            first,
            /changed while it was saving/,
        );
        await Promise.resolve();
        fixture.edit("three");
        const second = fixture.save();
        assert.equal(fixture.status, "saving");
        assert.equal(fixture.writes.length, 1);
        pending.resolve();
        await firstRejected;
        await second;
        await fixture.save();
        assert.deepEqual(fixture.writes.map(entry => entry.id), [
            "draft-1",
            "draft-1",
            "draft-1",
        ]);
        assert.equal(
            fixture.writes[0].project.files.get("main.js").value,
            "two",
        );
        assert.equal(
            fixture.writes[1].project.files.get("main.js").value,
            "three",
        );
        assert.equal(fixture.status, "saved");
        assert.equal(fixture.savedRevision, 2);
    });

    it("keeps pending edits and the same id after a write fails", async () => {
        let failing = true;
        const fixture = persistenceFixture(() => {
            if (failing) throw new Error("disk full");
        });
        fixture.edit("unsaved");
        await assert.rejects(fixture.save(), /disk full/);
        assert.equal(fixture.state.key, null);
        assert.equal(fixture.status, "error");
        assert.equal(
            fixture.state.project.files.get("main.js").value,
            "unsaved",
        );
        failing = false;
        assert.equal(await fixture.save(), "draft-1");
        assert.equal(fixture.status, "saved");
        assert.deepEqual(fixture.writes.map(entry => entry.id), [
            "draft-1",
            "draft-1",
        ]);
    });

    it("acknowledges an older snapshot without marking a newer edit saved", async () => {
        const pending = deferred();
        const fixture = persistenceFixture(() => pending.promise);
        fixture.edit("older");
        const rejected = assert.rejects(fixture.save(), /changed/);
        await Promise.resolve();
        fixture.edit("newer");
        pending.resolve();
        await rejected;
        assert.equal(fixture.state.key, "draft-1");
        assert.equal(fixture.savedRevision, 1);
        assert.equal(fixture.state.revision, 2);
        assert.equal(fixture.status, "saving");
    });

    it("doesn't promote a replacement project or write an abandoned queued snapshot", async () => {
        const pending = deferred();
        const fixture = persistenceFixture(() => pending.promise);
        const first = assert.rejects(fixture.save(), /changed/);
        await Promise.resolve();
        fixture.edit("queued");
        const queued = assert.rejects(fixture.save(), /changed/);
        fixture.replace();
        pending.resolve();
        await Promise.all([first, queued]);
        assert.equal(fixture.writes.length, 1);
        assert.equal(fixture.state.key, null);
        assert.equal(fixture.status, "draft");
        assert.equal(await fixture.save(), "draft-2");
    });
});

describe("shared console message boundary", () => {
    const frame = {};
    const origin = "https://sandbox.example";
    const data = { type: "CONSOLE", runId: "run-1", log: [] };
    const event = { source: frame, origin, data };
    it("accepts only the active iframe and configured origin", () => {
        assert.equal(isActiveGameConsoleMessage(event, origin, frame), true);
        assert.equal(
            isActiveGameConsoleMessage({ ...event, source: {} }, origin, frame),
            false,
        );
        assert.equal(
            isActiveGameConsoleMessage(
                { ...event, origin: "https://foreign.example" },
                origin,
                frame,
            ),
            false,
        );
        assert.equal(isActiveGameConsoleMessage(event, origin, null), false);
    });
    it("rejects malformed payloads and oversized run ids", () => {
        for (
            const invalid of [
                null,
                [],
                { ...data, type: "READY" },
                { ...data, log: {} },
                { ...data, runId: "x".repeat(129) },
                { ...data, runId: undefined },
            ]
        ) {
            assert.equal(
                isActiveGameConsoleMessage(
                    { ...event, data: invalid },
                    origin,
                    frame,
                ),
                false,
            );
        }
    });
});

describe("promptable asset and starting point identifiers", () => {
    const asset = {
        name: "My apple.png",
        path: "sprites/My apple.png",
        kind: "sprite",
    };
    it("searches project names, paths, and kinds with identical normalization", () => {
        assert.equal(matchesGameAsset(asset, "  MY APPLE ", "sprite"), true);
        assert.equal(matchesGameAsset(asset, "sprites/my apple.png"), true);
        assert.equal(matchesGameAsset(asset, "apple", "sound"), false);
    });
    it("copies canonical library keys and project paths into ordinary prompts", () => {
        const builtIn = assetPrompt({
            source: "library",
            key: "bean",
            name: "Bean display name",
            kind: "sprite",
        });
        assert.match(builtIn, /built-in bean/);
        assert.doesNotMatch(
            builtIn,
            /loadSprite|WebMCP|kaplayground_|@Browser/,
        );
        assert.match(
            assetPrompt({ source: "game", ...asset }),
            /My apple.png \(sprites\/My apple.png\)/,
        );
    });
    it("ranks the Codex starter first and the existing Games category next", () => {
        const base = {
            description: "",
            tags: [],
            formattedName: "",
            sortName: "",
            group: "basics",
        };
        const entries = [
            { ...base, key: "basic", category: "basics", sortName: "0" },
            { ...base, key: "game", category: "games", sortName: "1" },
            { ...base, key: "webmcpAgent", category: "basics", sortName: "2" },
        ];
        assert.deepEqual(
            entries.sort(compareStartingPoints).map(entry => entry.key),
            ["webmcpAgent", "game", "basic"],
        );
        assert.deepEqual(
            entries.filter(entry => inStartingPointCollection(entry, "all")),
            entries,
        );
        assert.deepEqual(
            entries.filter(isPlayableStartingPoint).map(entry => entry.key),
            ["webmcpAgent", "game"],
        );
        assert.deepEqual(
            entries.filter(entry =>
                inStartingPointCollection(entry, "features")
            ).map(entry => entry.key),
            ["basic"],
        );
        assert.deepEqual(
            entries.filter(entry => inStartingPointCollection(entry, "games"))
                .map(entry => entry.key),
            ["webmcpAgent", "game"],
        );
        assert.equal(
            matchesStartingPoint(
                {
                    ...base,
                    key: "dino",
                    category: "games",
                    tags: [{
                        name: "platformer",
                        displayName: "Platform game",
                    }],
                },
                " PLATFORM ",
                "platformer",
            ),
            true,
        );
    });
});
