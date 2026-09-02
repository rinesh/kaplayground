import type { AssetKind } from "../features/Projects/models/AssetKind";

export const PREVIEW_ASSET_LIMITS = {
    count: 200,
    nameLength: 256,
    urlLength: 262_144,
    totalUrlLength: 4_194_304,
};

export interface PreviewAsset {
    name: string;
    kind: AssetKind;
    loader: string;
    /** Private preview media. Never include this field in agent tool results. */
    url: string | null;
}

export interface PreviewAssets {
    available: boolean;
    assets: PreviewAsset[];
    truncated: boolean;
}

export function emptyPreviewAssets(): PreviewAssets {
    return { available: false, assets: [], truncated: false };
}

type AssetEvent =
    | { action: "reset" | "limit" }
    | { action: "remove"; name: string; kind: AssetKind }
    | { action: "loaded"; asset: PreviewAsset };

/**
 * Installed by wrapGame before user code receives its KAPLAY context. Keep this
 * function self-contained: its source is also executed inside the preview.
 */
export function trackPreviewAssets(
    context: Record<string, unknown>,
    report: (event: AssetEvent) => void,
    limits: typeof PREVIEW_ASSET_LIMITS,
    globals: Record<string, unknown> = globalThis,
): void {
    const pending = new Map<string, object>();
    let limited = false;
    const limit = () => {
        if (limited) return;
        limited = true;
        report({ action: "limit" });
    };
    const identify = (kind: AssetKind, name: unknown) => {
        if (
            typeof name !== "string" || !name.length
            || name.length > limits.nameLength || /\p{Cc}/u.test(name)
        ) {
            limit();
            return null;
        }
        const key = `${kind}:${name}`;
        if (!pending.has(key) && pending.size >= limits.count) {
            limit();
            return null;
        }
        return { key, name };
    };
    const mediaUrl = (source: unknown, loader: string): string | null => {
        if (Array.isArray(source)) source = source[0];
        if (typeof source === "object" && source !== null && "src" in source) {
            source = source.src;
        }
        if (typeof source !== "string" || source.length > limits.urlLength) {
            return null;
        }
        const root = loader !== "loadFont"
                && typeof context.loadRoot === "function"
            ? context.loadRoot()
            : "";
        const path = source.startsWith("data:") || source.startsWith("blob:")
            ? source
            : `${typeof root === "string" ? root : ""}${source}`;
        const location = globals.location as { href?: string } | undefined;
        const url = new URL(path, location?.href).href;
        return url.length <= limits.urlLength ? url : null;
    };
    const watch = (result: unknown, callback: (data: unknown) => void) => {
        if (typeof result !== "object" || result === null) return;
        const onLoad = (result as { onLoad?: unknown }).onLoad;
        if (typeof onLoad !== "function") return;
        onLoad.call(result, (data: unknown) => {
            // Asset discovery must never change game execution or error handling.
            try {
                callback(data);
            } catch {
                limit();
            }
        });
    };
    const methods: Array<[string, AssetKind, string]> = [
        ["loadSprite", "sprite", "getSprite"],
        ["loadBean", "sprite", "getSprite"],
        ["loadAseprite", "sprite", "getSprite"],
        ["loadPedit", "sprite", "getSprite"],
        ["loadSound", "sound", "getSound"],
        ["loadMusic", "sound", ""],
        ["loadFont", "font", "getFont"],
        ["loadBitmapFont", "font", "getBitmapFont"],
        ["loadBitmapFontFromSprite", "font", "getBitmapFont"],
        ["loadSpriteAtlas", "sprite", "getSprite"],
    ];

    report({ action: "reset" });
    for (const [loader, kind, getter] of methods) {
        const original = context[loader];
        if (typeof original !== "function") continue;
        const wrapped = function(this: unknown, ...args: unknown[]) {
            const result = original.apply(this, args);
            try {
                const getAsset = context[getter];
                const url =
                    ["loadBean", "loadPedit", "loadBitmapFontFromSprite"]
                            .includes(loader)
                        ? null
                        : mediaUrl(
                            args[loader === "loadSpriteAtlas" ? 0 : 1],
                            loader,
                        );

                if (loader === "loadSpriteAtlas") {
                    watch(result, data => {
                        if (typeof data !== "object" || data === null) return;
                        for (const [name, sprite] of Object.entries(data)) {
                            const identity = identify(kind, name);
                            if (!identity) break;
                            if (
                                typeof getAsset === "function"
                                && getAsset.call(context, name)?.data !== sprite
                            ) continue;
                            pending.set(identity.key, {});
                            report({
                                action: "loaded",
                                asset: { name, kind, loader, url },
                            });
                        }
                    });
                    return result;
                }

                const identity = identify(
                    kind,
                    args[0] ?? (loader === "loadBean" ? "bean" : null),
                );
                if (!identity) return result;
                const token = {};
                pending.set(identity.key, token);
                report({ action: "remove", name: identity.name, kind });
                const loaded = () => {
                    if (pending.get(identity.key) !== token) return;
                    if (
                        typeof getAsset === "function"
                        && getAsset.call(context, identity.name) !== result
                    ) return;
                    report({
                        action: "loaded",
                        asset: { name: identity.name, kind, loader, url },
                    });
                };
                if (loader === "loadMusic") loaded();
                else watch(result, loaded);
            } catch {
                limit();
            }
            return result;
        };
        context[loader] = wrapped;
        if (globals[loader] === original) globals[loader] = wrapped;
    }
}

/** Accept only bounded updates from the active run's actual preview window. */
export function receivePreviewAssets(
    state: PreviewAssets,
    event: Pick<MessageEvent, "origin" | "source" | "data">,
    expected: { origin: string; source: unknown; runId: string },
): PreviewAssets | null {
    if (
        !expected.source || event.source !== expected.source
        || event.origin !== expected.origin
    ) return null;
    const data = event.data;
    if (
        !data || typeof data !== "object" || data.type !== "PREVIEW_ASSETS"
        || data.runId !== expected.runId
    ) return null;
    if (data.action === "reset") {
        return { ...emptyPreviewAssets(), available: true };
    }
    if (data.action === "limit") return { ...state, truncated: true };
    const value = data.action === "loaded" ? data.asset : data;
    if (
        !value || typeof value !== "object"
        || typeof value.name !== "string" || !value.name.length
        || value.name.length > PREVIEW_ASSET_LIMITS.nameLength
        || /\p{Cc}/u.test(value.name)
        || !["sprite", "sound", "font"].includes(value.kind)
    ) return null;
    const rest = state.assets.filter(asset =>
        asset.name !== value.name || asset.kind !== value.kind
    );
    if (data.action === "remove") return { ...state, assets: rest };
    if (
        data.action !== "loaded" || typeof value.loader !== "string"
        || !/^load[A-Za-z]{1,32}$/.test(value.loader)
    ) return null;
    if (rest.length >= PREVIEW_ASSET_LIMITS.count) {
        return { ...state, truncated: true };
    }
    const totalUrlLength = rest.reduce(
        (total, asset) => total + (asset.url?.length ?? 0),
        0,
    );
    const url = typeof value.url === "string"
            && value.url.length <= PREVIEW_ASSET_LIMITS.urlLength
            && totalUrlLength + value.url.length
                <= PREVIEW_ASSET_LIMITS.totalUrlLength
            && /^(https?:\/\/|blob:|data:(image|audio)\/)/i.test(value.url)
        ? value.url
        : null;
    return {
        ...state,
        available: true,
        assets: [...rest, {
            name: value.name,
            kind: value.kind,
            loader: value.loader,
            url,
        }],
    };
}
