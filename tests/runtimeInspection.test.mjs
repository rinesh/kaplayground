import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRuntimeInspector } from "../sandbox/runtimeInspection.js";
import {
    emptyPreviewAssets,
    PREVIEW_ASSET_LIMITS,
    receivePreviewAssets,
    trackPreviewAssets,
} from "../src/hooks/previewAssets.ts";

function pendingAsset() {
    const callbacks = [];
    return {
        data: null,
        onLoad(callback) {
            if (this.data) callback(this.data);
            else callbacks.push(callback);
            return this;
        },
        succeed(data = {}) {
            this.data = data;
            callbacks.forEach(callback => callback(data));
        },
    };
}

function trackedAssets(limits = PREVIEW_ASSET_LIMITS) {
    const sprites = new Map();
    const sounds = new Map();
    const fonts = new Map();
    const context = {
        loadRoot: () => "",
        getSprite: name => sprites.get(name),
        getSound: name => sounds.get(name),
        getFont: name => fonts.get(name),
        loadSprite(name) {
            const result = pendingAsset();
            sprites.set(name, result);
            return result;
        },
        loadSound(name) {
            const result = pendingAsset();
            sounds.set(name, result);
            return result;
        },
        loadFont(name) {
            const result = pendingAsset();
            fonts.set(name, result);
            return result;
        },
        loadBean(name = "bean") {
            const result = pendingAsset();
            sprites.set(name, result);
            return result;
        },
        loadSpriteAtlas() {
            return pendingAsset();
        },
    };
    const globals = {
        ...context,
        location: { href: "https://sandbox.example/" },
    };
    const events = [];
    // Exercise the same isolated function source that wrapGame injects.
    const install = new Function(`return (${trackPreviewAssets.toString()})`)();
    install(context, event => events.push(event), limits, globals);
    return {
        context,
        globals,
        events,
        sprites,
        loaded: () =>
            events.filter(event => event.action === "loaded").map(event =>
                event.asset
            ),
    };
}

describe("assets loaded by the running game", () => {
    it("observes successful global and context loaders using their exact names", () => {
        const fixture = trackedAssets();
        const hero = fixture.globals.loadSprite(
            "player alias",
            "/sprites/bean.png",
        );
        const sound = fixture.context.loadSound("pop", "/sounds/score.mp3");
        const font = fixture.context.loadFont(
            "score text",
            "/fonts/score.woff2",
        );
        const bean = fixture.context.loadBean();
        assert.equal(fixture.globals.loadSprite, fixture.context.loadSprite);
        assert.equal(hero, fixture.context.getSprite("player alias"));
        assert.deepEqual(fixture.loaded(), []);
        hero.succeed();
        sound.succeed();
        font.succeed();
        bean.succeed();
        assert.deepEqual(
            fixture.loaded().map(({ name, kind }) => ({ name, kind })),
            [
                { name: "player alias", kind: "sprite" },
                { name: "pop", kind: "sound" },
                { name: "score text", kind: "font" },
                { name: "bean", kind: "sprite" },
            ],
        );
        assert.equal(
            fixture.loaded()[0].url,
            "https://sandbox.example/sprites/bean.png",
        );
        assert.equal(fixture.loaded()[3].loader, "loadBean");
    });

    it("doesn't report pending, unused, or superseded loads", () => {
        const fixture = trackedAssets();
        const old = fixture.context.loadSprite("hero", "/old.png");
        const current = fixture.context.loadSprite("hero", "/current.png");
        fixture.context.loadSprite("pending", "/pending.png");
        if (false) fixture.context.loadSprite("unused", "/unused.png");
        current.succeed();
        old.succeed();
        assert.deepEqual(fixture.loaded().map(asset => asset.name), ["hero"]);
        assert.equal(
            fixture.loaded()[0].url,
            "https://sandbox.example/current.png",
        );
        fixture.context.loadSprite("hero", "/replacement.png");
        assert.deepEqual(fixture.events.at(-1), {
            action: "remove",
            name: "hero",
            kind: "sprite",
        });
    });

    it("discovers atlas entries after loading, including names supplied by JSON", () => {
        const fixture = trackedAssets();
        const atlas = fixture.context.loadSpriteAtlas(
            "/atlas.png",
            "/atlas.json",
        );
        const data = { player: {}, coin: {} };
        for (const [name, sprite] of Object.entries(data)) {
            fixture.sprites.set(name, { data: sprite });
        }
        atlas.succeed(data);
        assert.deepEqual(fixture.loaded().map(asset => asset.name), [
            "player",
            "coin",
        ]);
        assert(
            fixture.loaded().every(asset =>
                asset.url === "https://sandbox.example/atlas.png"
            ),
        );
    });

    it("honors loadRoot while retaining loader errors and return values", () => {
        const fixture = trackedAssets();
        fixture.context.loadRoot = () => "https://assets.example/game/";
        fixture.context.loadSprite("hero", "hero.png").succeed();
        assert.equal(
            fixture.loaded()[0].url,
            "https://assets.example/game/hero.png",
        );
        const failure = new Error("invalid image");
        const context = {
            loadSprite() {
                throw failure;
            },
        };
        trackPreviewAssets(context, () => {}, PREVIEW_ASSET_LIMITS, {});
        assert.throws(
            () => context.loadSprite("bad", "/bad.png"),
            error => error === failure,
        );
    });

    it("bounds discovery without truncating canonical names or large media into invalid URLs", () => {
        const fixture = trackedAssets({
            ...PREVIEW_ASSET_LIMITS,
            count: 2,
            urlLength: 50,
        });
        fixture.context.loadSprite(
            "hero",
            `data:image/png;base64,${"a".repeat(60)}`,
        ).succeed();
        fixture.context.loadSprite("coin", "/coin.png").succeed();
        fixture.context.loadSprite("third", "/third.png").succeed();
        fixture.context.loadSprite("x".repeat(257), "/long-name.png").succeed();
        assert.deepEqual(fixture.loaded().map(asset => asset.name), [
            "hero",
            "coin",
        ]);
        assert.equal(fixture.loaded()[0].url, null);
        assert.equal(
            fixture.events.filter(event => event.action === "limit").length,
            1,
        );
    });
});

describe("preview asset message boundary", () => {
    const source = {};
    const expected = {
        source,
        origin: "https://sandbox.example",
        runId: "run-1",
    };
    const asset = {
        name: "hero",
        kind: "sprite",
        loader: "loadSprite",
        url: "data:image/png;base64,AAAA",
    };
    const event = {
        source,
        origin: expected.origin,
        data: {
            type: "PREVIEW_ASSETS",
            runId: "run-1",
            action: "loaded",
            asset,
        },
    };

    it("rejects other origins, windows, and preview runs", () => {
        for (
            const invalid of [
                { ...event, source: {} },
                { ...event, origin: "https://foreign.example" },
                { ...event, data: { ...event.data, runId: "run-old" } },
                { ...event, data: { ...event.data, type: "CONSOLE" } },
            ]
        ) {
            assert.equal(
                receivePreviewAssets(emptyPreviewAssets(), invalid, expected),
                null,
            );
        }
    });

    it("replaces duplicate names, removes reloading assets, and clears a new context", () => {
        const first = receivePreviewAssets(
            emptyPreviewAssets(),
            event,
            expected,
        );
        const replace = {
            ...event,
            data: {
                ...event.data,
                asset: { ...asset, url: "https://assets.example/hero.png" },
            },
        };
        const next = receivePreviewAssets(first, replace, expected);
        assert.equal(next.assets.length, 1);
        assert.equal(next.assets[0].url, replace.data.asset.url);
        assert.equal(first.assets[0].url, asset.url);
        const removed = receivePreviewAssets(next, {
            ...event,
            data: {
                ...event.data,
                action: "remove",
                name: "hero",
                kind: "sprite",
            },
        }, expected);
        assert.deepEqual(removed.assets, []);
        const reset = receivePreviewAssets(next, {
            ...event,
            data: { ...event.data, action: "reset" },
        }, expected);
        assert.deepEqual(reset, {
            available: true,
            assets: [],
            truncated: false,
        });
    });

    it("drops unsupported and oversized media and bounds the full collection", () => {
        for (
            const url of [
                "javascript:alert(1)",
                "data:text/html,<script>",
                "data:image/png;base64,"
                + "a".repeat(PREVIEW_ASSET_LIMITS.urlLength),
            ]
        ) {
            const state = receivePreviewAssets(emptyPreviewAssets(), {
                ...event,
                data: {
                    ...event.data,
                    asset: { ...asset, url, secret: "not metadata" },
                },
            }, expected);
            assert.equal(state.assets[0].url, null);
            assert.equal("secret" in state.assets[0], false);
        }
        let state = emptyPreviewAssets();
        for (let index = 0; index <= PREVIEW_ASSET_LIMITS.count; index++) {
            state = receivePreviewAssets(state, {
                ...event,
                data: {
                    ...event.data,
                    asset: { ...asset, name: `asset-${index}` },
                },
            }, expected);
        }
        assert.equal(state.assets.length, PREVIEW_ASSET_LIMITS.count);
        assert.equal(state.truncated, true);
    });
});

function inspectorFor(context, options = {}) {
    const canvas = options.canvas ?? { width: 320, height: 240 };
    return createRuntimeInspector({
        getRunId: () => "run-1",
        getReadiness: () => ({ status: "ready" }),
        getDebug: () => options.debug ?? { paused: false },
        getContext: () => context,
        readPaused: () => false,
        findCanvas: () => canvas,
        getActiveElement: () => options.focused ? canvas : null,
    });
}

describe("sandbox runtime inspection", () => {
    it("reads modern camera getters without calling deprecated aliases", () => {
        const deprecated = () => {
            throw new Error("Deprecated getter called");
        };
        const result = inspectorFor({
            getCamPos: () => ({ x: 100, y: 80 }),
            getCamScale: () => ({ x: 2, y: 2 }),
            getCamRot: () => 15,
            camPos: deprecated,
            camScale: deprecated,
            camRot: deprecated,
        })({ limit: 10 });
        assert.deepEqual(result.camera, {
            position: { x: 100, y: 80 },
            scale: { x: 2, y: 2 },
            rotation: 15,
        });
    });

    it("preserves scene, focus, geometry, and object evidence", () => {
        const object = {
            id: "player-1",
            tags: ["player"],
            pos: { x: 40, y: 120 },
            width: 24,
            height: 32,
            anchor: "center",
            worldArea() {
                return {
                    pos: { x: 28, y: 104 },
                    width: 24,
                    height: 32,
                };
            },
        };
        const context = {
            getSceneName: () => "game",
            width: () => 320,
            height: () => 240,
            camPos: () => ({ x: 160, y: 120 }),
            isFocused: () => true,
            get: () => [object],
        };

        const result = inspectorFor(context)({ tag: "player", limit: 10 });
        assert.equal(result.runId, "run-1");
        assert.equal(result.scene, "game");
        assert.equal(result.canvasFocused, true);
        assert.equal(result.objectsAvailable, true);
        assert.equal(result.objectCount, 1);
        assert.deepEqual(result.objects[0].renderedBounds, {
            x: -12,
            y: -16,
            width: 24,
            height: 32,
        });
        assert.deepEqual(result.objects[0].collisionBounds.world, {
            x: 28,
            y: 104,
            width: 24,
            height: 32,
        });
    });

    it("reports unavailable objects when the active context cannot query them", () => {
        const result = inspectorFor({})({ tag: "player", limit: 10 });
        assert.equal(
            result.available,
            true,
            "the preview canvas is still evidence",
        );
        assert.equal(result.objectsAvailable, false);
        assert.deepEqual(result.objects, []);
    });

    it("reports bounded objective layout warnings without judging visual quality", () => {
        const score = {
            id: "score",
            tags: ["score"],
            pos: { x: 5, y: 20 },
            width: 40,
            height: 20,
            anchor: "center",
        };
        const player = {
            id: "player",
            tags: ["player"],
            pos: { x: -100, y: 120 },
            width: 20,
            height: 20,
            anchor: "center",
        };
        const context = {
            width: () => 320,
            height: () => 240,
            get: tag => tag === "player" ? [player] : [score, player],
        };

        const general = inspectorFor(context)({ limit: 10 });
        assert.deepEqual(
            general.layoutWarnings.map(warning => warning.code),
            ["OBJECT_CLIPPED"],
        );
        assert.equal(general.layoutWarnings[0].objectId, "score");
        assert.equal(general.layoutWarningsTruncated, false);

        const explicit = inspectorFor(context)({ tag: "player", limit: 10 });
        assert.deepEqual(
            explicit.layoutWarnings.map(warning => warning.code),
            ["OBJECT_OUTSIDE_VIEWPORT"],
        );

        const emptyCanvas = inspectorFor(context, {
            canvas: { width: 0, height: 0 },
        })({ limit: 0 });
        assert.equal(
            emptyCanvas.layoutWarnings.filter(warning =>
                warning.code === "CANVAS_EMPTY"
            ).length,
            2,
        );
    });

});
