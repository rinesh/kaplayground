import type { Asset } from "../features/Projects/models/Asset";

export function matchesGameAsset(
    asset: Pick<Asset, "name" | "kind"> & { path?: string },
    query: string,
    kind?: string,
): boolean {
    return (!kind || asset.kind === kind)
        && `${asset.name} ${asset.path ?? ""} ${asset.kind}`.toLowerCase()
            .includes(
                query.trim().toLowerCase(),
            );
}

export function assetPrompt(
    asset: {
        name: string;
        kind: string;
        source: string;
        key?: string;
        path?: string;
    },
): string {
    const identity = asset.source === "runtime"
        ? `the ${asset.kind} named ${
            JSON.stringify(asset.name)
        } that's already loaded in my game`
        : asset.source === "library"
        ? `the built-in ${asset.key} ${
            asset.kind === "sprite" ? "character or picture" : asset.kind
        }`
        : `my ${
            asset.kind === "sprite" ? "picture" : asset.kind
        } named ${asset.name} (${asset.path})`;
    return `Use ${identity} in my game. Ask me what it should replace or do if that isn't clear, and keep the rest of the game working as it does now.`;
}
