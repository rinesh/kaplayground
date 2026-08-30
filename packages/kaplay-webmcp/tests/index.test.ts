import type { GameObj, KAPLAYCtx } from "kaplay";
import { describe, expect, it, vi } from "vitest";
import {
    createKaplayWebMCP,
    type KaplayWebMCPTool,
} from "../src/index";

class FakeModelContext extends EventTarget implements WebMCP.ModelContext {
    readonly registered: Array<{
        tool: WebMCP.ModelContextTool;
        options: WebMCP.ModelContextRegisterToolOptions | undefined;
    }> = [];

    ontoolchange: ((this: WebMCP.ModelContext, ev: Event) => unknown) | null = null;

    async registerTool(
        tool: WebMCP.ModelContextTool,
        options?: WebMCP.ModelContextRegisterToolOptions,
    ): Promise<void> {
        this.registered.push({ tool, options });
    }

    async getTools(): Promise<WebMCP.RegisteredTool[]> {
        return [];
    }

    tool(name: string): WebMCP.ModelContextTool {
        const match = this.registered.find(({ tool }) => tool.name === name)?.tool;
        if (!match) throw new Error(`Missing tool ${name}`);
        return match;
    }
}

function gameObject(
    id: number,
    tags: string[],
    extra: Record<string, unknown> = {},
): GameObj {
    return {
        id,
        tags,
        hidden: false,
        paused: false,
        inspect: () => ({ tags: tags.join(", "), custom: "ok" }),
        ...extra,
    } as unknown as GameObj;
}

function fakeKaplay(objects: GameObj[] = []): KAPLAYCtx {
    return {
        VERSION: "3001.0.19",
        get: vi.fn((tag: string) => tag === "*"
            ? objects
            : objects.filter((object) => object.tags.includes(tag))),
        getSceneName: vi.fn(() => "arena"),
        width: vi.fn(() => 800),
        height: vi.fn(() => 600),
        time: vi.fn(() => 12.5),
        getCamPos: vi.fn(() => ({ x: 400, y: 300 })),
        getCamScale: vi.fn(() => ({ x: 1, y: 1 })),
        getCamRot: vi.fn(() => 0),
        debug: { paused: false },
    } as unknown as KAPLAYCtx;
}

function execute(
    context: FakeModelContext,
    name: string,
    input: Record<string, unknown> = {},
    signal: AbortSignal = new AbortController().signal,
): Promise<unknown> {
    try {
        return Promise.resolve(context.tool(name).execute(input, { signal }));
    }
    catch (error) {
        return Promise.reject(error);
    }
}

describe("createKaplayWebMCP", () => {
    it("does not break a game when WebMCP is unavailable", async () => {
        const bridge = createKaplayWebMCP(fakeKaplay(), { builtins: false });

        await bridge.ready;

        expect(bridge.supported).toBe(false);
        expect(bridge.status).toBe("unsupported");
        expect(await bridge.registerTool(customTool())).toBe(false);
    });

    it("registers qualified built-in tools with bounded schemas", async () => {
        const context = new FakeModelContext();
        const bridge = createKaplayWebMCP(fakeKaplay(), {
            modelContext: context,
            maxObjects: 12,
        });

        await bridge.ready;

        expect(bridge.status).toBe("ready");
        expect(bridge.toolNames).toEqual([
            "kaplay_get_game_state",
            "kaplay_list_objects",
            "kaplay_inspect_object",
            "kaplay_set_paused",
        ]);
        expect(context.tool("kaplay_list_objects").inputSchema).toMatchObject({
            properties: { limit: { maximum: 12 } },
        });
        expect(context.tool("kaplay_get_game_state").annotations).toEqual({
            readOnlyHint: true,
            untrustedContentHint: true,
        });
    });

    it("returns a compact game snapshot", async () => {
        const context = new FakeModelContext();
        const bridge = createKaplayWebMCP(fakeKaplay([gameObject(1, ["player"])]), {
            modelContext: context,
        });
        await bridge.ready;

        await expect(execute(context, "kaplay_get_game_state")).resolves.toEqual({
            kaplayVersion: "3001.0.19",
            scene: "arena",
            paused: false,
            time: 12.5,
            viewport: { width: 800, height: 600 },
            camera: {
                position: { x: 400, y: 300 },
                scale: { x: 1, y: 1 },
                rotation: 0,
            },
            objectCount: 1,
        });
    });

    it("filters, paginates, and snapshots objects", async () => {
        const objects = [
            gameObject(1, ["enemy"], { pos: { x: 10, y: 20 }, angle: 45 }),
            gameObject(2, ["friend"], { pos: { x: 30, y: 40 } }),
            gameObject(3, ["enemy"], { scale: { x: 2, y: 3 } }),
        ];
        const context = new FakeModelContext();
        const bridge = createKaplayWebMCP(fakeKaplay(objects), { modelContext: context });
        await bridge.ready;

        await expect(execute(context, "kaplay_list_objects", {
            tag: "enemy",
            offset: 1,
            limit: 1,
        })).resolves.toEqual({
            tag: "enemy",
            total: 2,
            offset: 1,
            limit: 1,
            objects: [{
                id: 3,
                tags: ["enemy"],
                hidden: false,
                paused: false,
                scale: { x: 2, y: 3 },
                components: { tags: "enemy", custom: "ok" },
            }],
        });
    });

    it("looks up an object by id and reports a missing id", async () => {
        const context = new FakeModelContext();
        const bridge = createKaplayWebMCP(fakeKaplay([
            gameObject(7, ["player"], { pos: { x: 5, y: 9 } }),
        ]), { modelContext: context });
        await bridge.ready;

        await expect(execute(context, "kaplay_inspect_object", { id: 7 }))
            .resolves.toMatchObject({ id: 7, position: { x: 5, y: 9 } });
        await expect(execute(context, "kaplay_inspect_object", { id: 99 }))
            .rejects.toThrow("No active KAPLAY object has id 99");
    });

    it("pauses and resumes the KAPLAY context", async () => {
        const context = new FakeModelContext();
        const kaplay = fakeKaplay();
        const bridge = createKaplayWebMCP(kaplay, { modelContext: context });
        await bridge.ready;

        await expect(execute(context, "kaplay_set_paused", { paused: true }))
            .resolves.toEqual({ paused: true });
        expect(kaplay.debug.paused).toBe(true);
    });

    it("rejects an already-cancelled execution before a built-in mutates the game", async () => {
        const context = new FakeModelContext();
        const kaplay = fakeKaplay();
        const bridge = createKaplayWebMCP(kaplay, { modelContext: context });
        await bridge.ready;

        const controller = new AbortController();
        const cancellation = new Error("Execution cancelled before it started.");
        controller.abort(cancellation);

        await expect(execute(
            context,
            "kaplay_set_paused",
            { paused: true },
            controller.signal,
        )).rejects.toBe(cancellation);
        expect(kaplay.debug.paused).toBe(false);
    });

    it("rejects an async tool result when execution is cancelled in flight", async () => {
        const context = new FakeModelContext();
        const controller = new AbortController();
        const cancellation = new Error("Execution cancelled while the tool was running.");
        let finishTool: ((value: unknown) => void) | undefined;
        const run = vi.fn((_input, executionContext) => {
            expect(executionContext.signal).toBe(controller.signal);
            return new Promise<unknown>((resolve) => {
                finishTool = resolve;
            });
        });
        const bridge = createKaplayWebMCP(fakeKaplay(), {
            builtins: false,
            modelContext: context,
            tools: [{
                name: "wait",
                description: "Wait for a test-controlled result.",
                execute: run,
            }],
        });
        await bridge.ready;

        const pending = execute(context, "kaplay_wait", {}, controller.signal);
        expect(run).toHaveBeenCalledOnce();
        controller.abort(cancellation);
        finishTool?.({ ok: true });

        await expect(pending).rejects.toBe(cancellation);
    });

    it("registers custom tools with the KAPLAY context and execution signal", async () => {
        const context = new FakeModelContext();
        const kaplay = fakeKaplay();
        const run = vi.fn(({ amount }: { amount: number }, executionContext) => ({
            amount,
            sameContext: executionContext.kaplay === kaplay,
            aborted: executionContext.signal.aborted,
        }));
        const bridge = createKaplayWebMCP(kaplay, {
            prefix: "game",
            builtins: false,
            modelContext: context,
            tools: [{
                name: "jump",
                description: "Jump a number of tiles.",
                execute: run,
            }],
        });
        await bridge.ready;

        await expect(execute(context, "game_jump", { amount: 2 })).resolves.toEqual({
            amount: 2,
            sameContext: true,
            aborted: false,
        });
        expect(run).toHaveBeenCalledOnce();
    });

    it("uses one abort signal to unregister every owned tool", async () => {
        const context = new FakeModelContext();
        const bridge = createKaplayWebMCP(fakeKaplay(), { modelContext: context });
        await bridge.ready;

        const signals = context.registered.map(({ options }) => options?.signal);
        expect(signals.every((signal) => signal && !signal.aborted)).toBe(true);

        bridge.destroy();

        expect(signals.every((signal) => signal?.aborted)).toBe(true);
        expect(bridge.status).toBe("destroyed");
        expect(bridge.toolNames).toEqual([]);
        await expect(bridge.registerTool(customTool())).rejects.toThrow("destroyed");
    });

    it("stays destroyed when teardown races an in-flight registration", async () => {
        let finishRegistration: (() => void) | undefined;
        const context = new FakeModelContext();
        context.registerTool = vi.fn(() => new Promise<void>((resolve) => {
            finishRegistration = resolve;
        }));
        const bridge = createKaplayWebMCP(fakeKaplay(), {
            builtins: false,
            modelContext: context,
            tools: [customTool()],
        });

        bridge.destroy();
        finishRegistration?.();
        await bridge.ready;

        expect(bridge.status).toBe("destroyed");
        expect(bridge.toolNames).toEqual([]);
    });

    it("rejects duplicate and invalid qualified tool names", async () => {
        const duplicateContext = new FakeModelContext();
        const duplicate = createKaplayWebMCP(fakeKaplay(), {
            builtins: false,
            modelContext: duplicateContext,
            tools: [customTool(), customTool()],
        });

        await expect(duplicate.ready).rejects.toThrow("already registered");
        expect(duplicate.status).toBe("error");

        expect(() => createKaplayWebMCP(fakeKaplay(), {
            prefix: "bad prefix",
        })).toThrow("prefix");
    });
});

function customTool(): KaplayWebMCPTool {
    return {
        name: "custom",
        description: "A custom test tool.",
        execute: () => ({ ok: true }),
    };
}
