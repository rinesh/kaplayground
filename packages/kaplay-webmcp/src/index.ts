/// <reference types="webmcp-types" preserve="true" />

import type { GameObj, KAPLAYCtx, KAPLAYPlugin } from "kaplay";

const DEFAULT_PREFIX = "kaplay";
const DEFAULT_MAX_OBJECTS = 50;
const MAX_OBJECT_LIMIT = 200;
const MAX_INSPECT_VALUE_LENGTH = 500;
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const NEVER_ABORTED_SIGNAL = new AbortController().signal;

export type KaplayWebMCPStatus =
    | "unsupported"
    | "registering"
    | "ready"
    | "error"
    | "destroyed";

export interface KaplayWebMCPBuiltins {
    /** Exposes the scene, clock, viewport, camera, pause state, and object count. */
    gameState?: boolean;
    /** Lists bounded, shallow snapshots of game objects. */
    listObjects?: boolean;
    /** Returns a shallow snapshot of one game object by its KAPLAY id. */
    inspectObject?: boolean;
    /** Lets an agent pause or resume the local game. */
    setPaused?: boolean;
}

export interface KaplayToolExecutionContext {
    kaplay: KAPLAYCtx;
    signal: AbortSignal;
}

export interface KaplayWebMCPTool<
    TInput extends Record<string, unknown> = Record<string, unknown>,
> {
    /** Unqualified name. The configured prefix is added during registration. */
    name: string;
    title?: string;
    description: string;
    inputSchema?: object;
    annotations?: WebMCP.ToolAnnotations;
    /** Overrides the bridge-wide cross-origin exposure list for this tool. */
    exposedTo?: string[];
    execute(
        input: TInput,
        context: KaplayToolExecutionContext,
    ): WebMCP.MaybePromise<unknown>;
}

export interface KaplayWebMCPOptions {
    /** Prefix applied to every tool name. Defaults to `kaplay`. */
    prefix?: string;
    /** Built-in tools to register. Pass `false` to register custom tools only. */
    builtins?: false | KaplayWebMCPBuiltins;
    /** Maximum number of objects returned by `list_objects`. Defaults to 50. */
    maxObjects?: number;
    /** Game-specific tools registered alongside the built-ins. */
    tools?: KaplayWebMCPTool[];
    /** Origins allowed to execute tools through an author-provided iframe agent. */
    exposedTo?: string[];
    /** Inject a model context, primarily for tests or host-provided adapters. */
    modelContext?: WebMCP.ModelContext;
    /** Receives asynchronous registration failures. */
    onError?: (error: unknown) => void;
}

export interface KaplayObjectSnapshot {
    id: number | null;
    tags: string[];
    hidden: boolean;
    paused: boolean;
    position?: { x: number; y: number };
    angle?: number;
    scale?: { x: number; y: number };
    components: Record<string, string | null>;
}

export interface KaplayWebMCPPluginApi {
    webmcp: KaplayWebMCP;
}

/**
 * Owns the WebMCP tools registered for one KAPLAY context.
 */
export class KaplayWebMCP {
    readonly ready: Promise<void>;
    readonly supported: boolean;

    private readonly kaplay: KAPLAYCtx;
    private readonly context: WebMCP.ModelContext | undefined;
    private readonly prefix: string;
    private readonly maxObjects: number;
    private readonly exposedTo: string[] | undefined;
    private readonly registrationController = new AbortController();
    private readonly names = new Set<string>();
    private readonly pendingNames = new Set<string>();
    private currentStatus: KaplayWebMCPStatus;

    constructor(kaplay: KAPLAYCtx, options: KaplayWebMCPOptions = {}) {
        this.kaplay = kaplay;
        this.context = options.modelContext ?? getDocumentModelContext();
        this.prefix = validateNamePart(options.prefix ?? DEFAULT_PREFIX, "prefix");
        this.maxObjects = normalizeMaxObjects(options.maxObjects);
        this.exposedTo = options.exposedTo;
        this.supported = this.context !== undefined;
        this.currentStatus = this.supported ? "registering" : "unsupported";

        if (!this.context) {
            this.ready = Promise.resolve();
            return;
        }

        const initialTools = [
            ...this.createBuiltinTools(options.builtins),
            ...(options.tools ?? []),
        ];

        this.ready = this.registerInitialTools(initialTools);
        void this.ready.catch((error: unknown) => options.onError?.(error));
    }

    get status(): KaplayWebMCPStatus {
        return this.currentStatus;
    }

    get toolNames(): readonly string[] {
        return [...this.names];
    }

    /**
     * Registers a game-specific tool after the bridge is ready.
     * Returns false when the browser does not expose WebMCP.
     */
    async registerTool(tool: KaplayWebMCPTool): Promise<boolean> {
        if (!this.context) return false;
        this.assertNotDestroyed();

        await this.ready;
        this.assertNotDestroyed();
        await this.register(tool);
        return true;
    }

    /** Unregisters every tool owned by this bridge. */
    destroy(): void {
        if (this.currentStatus === "destroyed") return;
        this.registrationController.abort();
        this.names.clear();
        this.pendingNames.clear();
        this.currentStatus = "destroyed";
    }

    private async registerInitialTools(tools: KaplayWebMCPTool[]): Promise<void> {
        try {
            for (const tool of tools) {
                if (this.currentStatus === "destroyed") return;
                await this.register(tool);
            }
            if (this.currentStatus !== "destroyed") this.currentStatus = "ready";
        }
        catch (error) {
            if (this.currentStatus === "destroyed") return;
            this.registrationController.abort();
            this.names.clear();
            this.pendingNames.clear();
            this.currentStatus = "error";
            throw error;
        }
    }

    private async register(tool: KaplayWebMCPTool): Promise<void> {
        const context = this.context;
        if (!context) return;

        const qualifiedName = this.qualifyName(tool.name);
        if (this.names.has(qualifiedName) || this.pendingNames.has(qualifiedName)) {
            throw new Error(`A WebMCP tool named "${qualifiedName}" is already registered.`);
        }

        const definition: WebMCP.ModelContextTool = {
            name: qualifiedName,
            description: tool.description,
            execute: async (input, options) => {
                const signal = options?.signal ?? NEVER_ABORTED_SIGNAL;
                throwIfAborted(signal);

                const result = await tool.execute(input, {
                    kaplay: this.kaplay,
                    signal,
                });

                throwIfAborted(signal);
                return result;
            },
        };

        if (tool.title !== undefined) definition.title = tool.title;
        if (tool.inputSchema !== undefined) definition.inputSchema = tool.inputSchema;
        if (tool.annotations !== undefined) definition.annotations = tool.annotations;

        const exposedTo = tool.exposedTo ?? this.exposedTo;
        const registrationOptions: WebMCP.ModelContextRegisterToolOptions = {
            signal: this.registrationController.signal,
        };
        if (exposedTo !== undefined) registrationOptions.exposedTo = exposedTo;

        this.pendingNames.add(qualifiedName);
        try {
            await context.registerTool(definition, registrationOptions);
            if (!this.registrationController.signal.aborted && this.currentStatus !== "destroyed") {
                this.names.add(qualifiedName);
            }
        }
        finally {
            this.pendingNames.delete(qualifiedName);
        }
    }

    private qualifyName(name: string): string {
        validateNamePart(name, "tool name");
        const qualifiedName = `${this.prefix}_${name}`;
        if (!TOOL_NAME_PATTERN.test(qualifiedName)) {
            throw new Error(
                `Qualified WebMCP tool name "${qualifiedName}" must be 1-128 characters and contain only ASCII letters, digits, '_', '-', or '.'.`,
            );
        }
        return qualifiedName;
    }

    private createBuiltinTools(
        configured: KaplayWebMCPOptions["builtins"],
    ): KaplayWebMCPTool[] {
        if (configured === false) return [];

        const enabled = configured ?? {};
        const tools: KaplayWebMCPTool[] = [];

        if (enabled.gameState !== false) tools.push(this.createGameStateTool());
        if (enabled.listObjects !== false) tools.push(this.createListObjectsTool());
        if (enabled.inspectObject !== false) tools.push(this.createInspectObjectTool());
        if (enabled.setPaused !== false) tools.push(this.createSetPausedTool());

        return tools;
    }

    private createGameStateTool(): KaplayWebMCPTool {
        return {
            name: "get_game_state",
            title: "Get KAPLAY game state",
            description:
                "Read the active KAPLAY scene, viewport, camera, clock, pause state, and object count.",
            inputSchema: emptyObjectSchema(),
            annotations: {
                readOnlyHint: true,
                untrustedContentHint: true,
            },
            execute: () => {
                const cameraPosition = this.kaplay.getCamPos();
                const cameraScale = this.kaplay.getCamScale();

                return {
                    kaplayVersion: this.kaplay.VERSION,
                    scene: this.kaplay.getSceneName(),
                    paused: this.kaplay.debug.paused,
                    time: finiteNumber(this.kaplay.time()),
                    viewport: {
                        width: finiteNumber(this.kaplay.width()),
                        height: finiteNumber(this.kaplay.height()),
                    },
                    camera: {
                        position: pointSnapshot(cameraPosition),
                        scale: pointSnapshot(cameraScale),
                        rotation: finiteNumber(this.kaplay.getCamRot()),
                    },
                    objectCount: this.allObjects().length,
                };
            },
        };
    }

    private createListObjectsTool(): KaplayWebMCPTool {
        return {
            name: "list_objects",
            title: "List KAPLAY game objects",
            description:
                "List shallow snapshots of active KAPLAY game objects, optionally filtered by one exact tag. Results are paginated and bounded.",
            inputSchema: {
                type: "object",
                properties: {
                    tag: {
                        type: "string",
                        description: "Exact KAPLAY tag to match. Omit to list all objects.",
                    },
                    offset: {
                        type: "integer",
                        minimum: 0,
                        default: 0,
                    },
                    limit: {
                        type: "integer",
                        minimum: 1,
                        maximum: this.maxObjects,
                        default: this.maxObjects,
                    },
                },
                additionalProperties: false,
            },
            annotations: {
                readOnlyHint: true,
                untrustedContentHint: true,
            },
            execute: (input) => {
                const tag = optionalString(input.tag, "tag");
                const offset = boundedInteger(input.offset, "offset", 0, Number.MAX_SAFE_INTEGER, 0);
                const limit = boundedInteger(input.limit, "limit", 1, this.maxObjects, this.maxObjects);
                const objects = tag === undefined
                    ? this.allObjects()
                    : this.kaplay.get(tag, { recursive: true });

                return {
                    tag: tag ?? null,
                    total: objects.length,
                    offset,
                    limit,
                    objects: objects.slice(offset, offset + limit).map(snapshotObject),
                };
            },
        };
    }

    private createInspectObjectTool(): KaplayWebMCPTool {
        return {
            name: "inspect_object",
            title: "Inspect a KAPLAY game object",
            description:
                "Read a shallow snapshot of one active KAPLAY game object using its numeric object id.",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        minimum: 0,
                        description: "KAPLAY game object id returned by list_objects.",
                    },
                },
                required: ["id"],
                additionalProperties: false,
            },
            annotations: {
                readOnlyHint: true,
                untrustedContentHint: true,
            },
            execute: (input) => {
                const id = boundedInteger(input.id, "id", 0, Number.MAX_SAFE_INTEGER);
                const object = this.allObjects().find((candidate) => candidate.id === id);
                if (!object) throw new RangeError(`No active KAPLAY object has id ${id}.`);
                return snapshotObject(object);
            },
        };
    }

    private createSetPausedTool(): KaplayWebMCPTool {
        return {
            name: "set_paused",
            title: "Pause or resume the KAPLAY game",
            description: "Pause or resume updates and audio for the active local KAPLAY game.",
            inputSchema: {
                type: "object",
                properties: {
                    paused: {
                        type: "boolean",
                        description: "True to pause the game; false to resume it.",
                    },
                },
                required: ["paused"],
                additionalProperties: false,
            },
            execute: (input) => {
                if (typeof input.paused !== "boolean") {
                    throw new TypeError("paused must be a boolean.");
                }
                this.kaplay.debug.paused = input.paused;
                return { paused: this.kaplay.debug.paused };
            },
        };
    }

    private allObjects(): GameObj[] {
        return this.kaplay.get("*", { recursive: true });
    }

    private assertNotDestroyed(): void {
        if (this.currentStatus === "destroyed") {
            throw new Error("Cannot register a tool after the WebMCP bridge is destroyed.");
        }
    }
}

/** Creates and immediately starts registering WebMCP tools for a KAPLAY context. */
export function createKaplayWebMCP(
    kaplay: KAPLAYCtx,
    options: KaplayWebMCPOptions = {},
): KaplayWebMCP {
    return new KaplayWebMCP(kaplay, options);
}

/**
 * Idiomatic KAPLAY plugin wrapper. The returned API is available as `k.webmcp`.
 */
export function webmcp(
    options: KaplayWebMCPOptions = {},
): KAPLAYPlugin<KaplayWebMCPPluginApi> {
    return (kaplay) => ({
        webmcp: createKaplayWebMCP(kaplay, options),
    });
}

export default webmcp;

function getDocumentModelContext(): WebMCP.ModelContext | undefined {
    return typeof document === "undefined" ? undefined : document.modelContext;
}

function validateNamePart(value: string, label: string): string {
    if (!TOOL_NAME_PATTERN.test(value)) {
        throw new Error(
            `WebMCP ${label} "${value}" must be 1-128 characters and contain only ASCII letters, digits, '_', '-', or '.'.`,
        );
    }
    return value;
}

function normalizeMaxObjects(value: number | undefined): number {
    if (value === undefined) return DEFAULT_MAX_OBJECTS;
    if (!Number.isInteger(value) || value < 1 || value > MAX_OBJECT_LIMIT) {
        throw new RangeError(`maxObjects must be an integer between 1 and ${MAX_OBJECT_LIMIT}.`);
    }
    return value;
}

function emptyObjectSchema(): object {
    return {
        type: "object",
        properties: {},
        additionalProperties: false,
    };
}

function boundedInteger(
    value: unknown,
    name: string,
    minimum: number,
    maximum: number,
    fallback?: number,
): number {
    if (value === undefined && fallback !== undefined) return fallback;
    if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
        throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}.`);
    }
    return value as number;
}

function optionalString(value: unknown, name: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError(`${name} must be a non-empty string.`);
    }
    return value;
}

function snapshotObject(object: GameObj): KaplayObjectSnapshot {
    const snapshot: KaplayObjectSnapshot = {
        id: object.id,
        tags: [...object.tags],
        hidden: object.hidden,
        paused: object.paused,
        components: inspectComponents(object),
    };

    if (hasPoint(object, "pos")) snapshot.position = pointSnapshot(object.pos);
    if (hasFiniteNumber(object, "angle")) snapshot.angle = object.angle;
    if (hasPoint(object, "scale")) snapshot.scale = pointSnapshot(object.scale);

    return snapshot;
}

function inspectComponents(object: GameObj): Record<string, string | null> {
    try {
        return Object.fromEntries(
            Object.entries(object.inspect()).map(([name, value]) => [
                name,
                typeof value === "string" && value.length > MAX_INSPECT_VALUE_LENGTH
                    ? `${value.slice(0, MAX_INSPECT_VALUE_LENGTH)}…`
                    : value,
            ]),
        );
    }
    catch (error) {
        return {
            inspectionError: error instanceof Error ? error.message : "Object inspection failed.",
        };
    }
}

function hasFiniteNumber<T extends string>(
    value: object,
    property: T,
): value is object & Record<T, number> {
    return property in value && typeof (value as Record<string, unknown>)[property] === "number"
        && Number.isFinite((value as Record<string, number>)[property]);
}

function hasPoint<T extends string>(
    value: object,
    property: T,
): value is object & Record<T, { x: number; y: number }> {
    if (!(property in value)) return false;
    const point = (value as Record<string, unknown>)[property];
    return typeof point === "object" && point !== null
        && hasFiniteNumber(point, "x") && hasFiniteNumber(point, "y");
}

function pointSnapshot(point: { x: number; y: number }): { x: number; y: number } {
    return {
        x: point.x,
        y: point.y,
    };
}

function finiteNumber(value: number): number | null {
    return Number.isFinite(value) ? value : null;
}

function throwIfAborted(signal: AbortSignal): void {
    if (!signal.aborted) return;
    throw signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}
