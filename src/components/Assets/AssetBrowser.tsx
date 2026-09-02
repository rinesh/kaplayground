import { assets, type SpriteCrewItem } from "@kaplayjs/crew";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
    assetBrewCatalog,
    type AssetBrewCatalogEntry,
    type AssetBrewKind,
    searchAssetBrewEntries,
} from "../../data/assetBrewCatalog";
import { assetPrompt, matchesGameAsset } from "../../data/gameAssetSearch";
import type { Asset } from "../../features/Projects/models/Asset";
import { useProject } from "../../features/Projects/stores/useProject";
import type { PreviewAsset } from "../../hooks/previewAssets";
import { useEditor } from "../../hooks/useEditor";
import { type SelectedAsset, useWorkspace } from "../../hooks/useWorkspace";
import { cn } from "../../util/cn";
import { Assets } from "./Assets";
import { SoundPreview } from "./SoundPreview";

type BrowserAsset = { identity: SelectedAsset; image: string; sound?: string };
const libraryAssets = new Map(
    assetBrewCatalog.map(asset => [asset.key, libraryAsset(asset)]),
);

export const AssetBrowser = () => {
    const [query, setQuery] = useState("");
    const [source, setSource] = useState<"library" | "game">("library");
    const [kind, setKind] = useState<AssetBrewKind>();
    const [managing, setManaging] = useState(false);
    const projectAssets = useProject(state => state.project.assets);
    const generation = useProject(state => state.projectGeneration);
    const previewAssets = useEditor(state => state.previewAssets);
    const previewGeneration = useEditor(state =>
        state.previewProjectGeneration
    );
    const running = useEditor(state => state.previewRunId !== null);
    const loading = useEditor(state =>
        state.previewRunId !== null && state.previewReadiness === null
    );
    const currentPreview = generation === previewGeneration;
    const selection = useWorkspace(state => state.selectedAsset);
    const selectAsset = useWorkspace(state => state.selectAsset);
    const entries = useMemo<BrowserAsset[]>(() =>
        source === "library"
            ? searchAssetBrewEntries(assetBrewCatalog, { query, kind }).map(
                asset => libraryAssets.get(asset.key)!,
            )
            : (currentPreview ? previewAssets.assets : []).filter(
                asset => matchesGameAsset(asset, query, kind),
            ).map(runtimeAsset), [
        query,
        source,
        kind,
        currentPreview,
        previewAssets,
    ]);
    const hasFilters = query.length > 0 || kind !== undefined;
    const resetFilters = () => {
        setQuery("");
        setKind(undefined);
    };
    const selectedProjectAsset = selection?.source === "game"
        ? projectAssets.get(selection.path)
        : null;
    const selectedRuntimeAsset =
        selection?.source === "runtime" && currentPreview
            ? previewAssets.assets.find(asset =>
                asset.name === selection.name && asset.kind === selection.kind
            )
            : null;
    const selected = selection?.source === "library"
        ? libraryAssets.get(selection.key)
        : selectedRuntimeAsset
        ? runtimeAsset(selectedRuntimeAsset)
        : selectedProjectAsset
        ? gameAsset(selectedProjectAsset)
        : null;
    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast("Copied — paste it into Codex when you're ready.");
        } catch {
            toast.error(
                "Couldn't copy. Select the asset name and copy it manually.",
            );
        }
    };

    return (
        <section
            className="asset-browser flex h-full min-h-0 flex-col"
            aria-label="Asset browser"
        >
            {managing
                ? (
                    <div className="flex shrink-0 items-center justify-between p-3">
                        <h3 className="text-sm font-medium">My assets</h3>
                        <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            aria-label="Back to asset browser"
                            onClick={() => setManaging(false)}
                        >
                            ← Back
                        </button>
                    </div>
                )
                : (
                    <div className="shrink-0 space-y-2 p-3">
                        <input
                            type="search"
                            aria-label="Search assets"
                            placeholder={source === "library"
                                ? "Search names, tags, or descriptions…"
                                : "Search this game's assets…"}
                            value={query}
                            className="input input-sm w-full bg-base-200"
                            onChange={event => setQuery(event.target.value)}
                        />
                        <div
                            role="group"
                            aria-label="Asset source"
                            className="grid grid-cols-2 gap-1 rounded-lg bg-base-200 p-1"
                        >
                            {([
                                ["library", "Library"],
                                ["game", "In game"],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={source === value}
                                    className={cn(
                                        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                                        source === value
                                            ? "bg-base-100 text-primary shadow-sm"
                                            : "text-base-content/65 hover:bg-base-100/50 hover:text-base-content",
                                    )}
                                    onClick={() => setSource(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div
                            role="group"
                            aria-label="Asset kinds"
                            className="flex flex-wrap items-center gap-1"
                        >
                            {([
                                [undefined, "All types"],
                                ["sprite", "Art"],
                                ["sound", "Sounds"],
                                ["font", "Fonts"],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value ?? "all"}
                                    type="button"
                                    aria-pressed={kind === value}
                                    className={cn(
                                        "btn btn-xs btn-ghost rounded-full focus-visible:outline-primary",
                                        kind === value
                                            && "bg-primary/10 text-primary",
                                    )}
                                    onClick={() => setKind(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span
                                role="status"
                                className="text-base-content/65"
                            >
                                {entries.length} {entries.length === 1
                                    ? "asset"
                                    : "assets"}
                                {source === "game" && currentPreview
                                    && previewAssets.truncated && " shown"}
                            </span>
                            {hasFilters && (
                                <button
                                    type="button"
                                    aria-label="Reset asset filters"
                                    className="btn btn-xs btn-ghost"
                                    onClick={resetFilters}
                                >
                                    Reset
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-xs btn-ghost ml-auto"
                                onClick={() => setManaging(true)}
                            >
                                My assets
                            </button>
                        </div>
                    </div>
                )}
            {managing
                ? (
                    <div className="min-h-0 flex-1">
                        <Assets />
                    </div>
                )
                : (
                    <div className="min-h-0 flex-1 overflow-auto px-3 pb-3 scrollbar-thin">
                        <div className="grid grid-cols-3 gap-2">
                            {entries.map(entry => (
                                <button
                                    key={assetId(entry.identity)}
                                    type="button"
                                    draggable={false}
                                    aria-label={`Select ${
                                        assetName(entry.identity)
                                    }`}
                                    aria-pressed={selection !== null
                                        && assetId(selection)
                                            === assetId(entry.identity)}
                                    onClick={() => selectAsset(entry.identity)}
                                    className={cn(
                                        "flex min-w-0 flex-col items-center gap-2 rounded-lg border border-transparent bg-base-200/40 p-2 hover:bg-base-100 focus-visible:outline-primary",
                                        selection
                                            && assetId(selection)
                                                === assetId(entry.identity)
                                            && "!border-primary bg-primary/10",
                                    )}
                                >
                                    <img
                                        src={entry.image}
                                        alt=""
                                        draggable={false}
                                        loading="lazy"
                                        className="size-12 object-contain pixelated"
                                    />
                                    <span className="w-full break-words text-center text-xs">
                                        {assetName(entry.identity)}
                                    </span>
                                    {entry.identity.source === "runtime" && (
                                        <span className="text-[10px] text-base-content/60">
                                            {entry.identity.kind === "sprite"
                                                ? "Art"
                                                : entry.identity.kind
                                                        === "sound"
                                                ? "Sound"
                                                : "Font"}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        {entries.length === 0 && (
                            <div className="space-y-2 px-2 py-6 text-center">
                                <p className="text-sm text-base-content/80">
                                    {source === "game"
                                            && (!currentPreview
                                                || previewAssets.assets.length
                                                    === 0)
                                        ? loading
                                            ? "Loading game assets…"
                                            : !running || !currentPreview
                                                    || !previewAssets.available
                                            ? "Run the game to see its assets."
                                            : previewAssets.truncated
                                            ? "Some game assets couldn't be listed."
                                            : "This game hasn't loaded any assets."
                                        : "No assets match these filters."}
                                </p>
                                <p className="text-xs text-base-content/65">
                                    {source === "game"
                                            && (!currentPreview
                                                || previewAssets.assets.length
                                                    === 0)
                                        ? "Art, sounds, and fonts appear here when the game loads them."
                                        : "Try another search or reset the filters."}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            {selection
                ? (
                    <div
                        className="shrink-0 border-t border-base-content/10 p-3"
                        aria-live="polite"
                    >
                        <div className="flex items-center gap-3">
                            {selected && (
                                <img
                                    src={selected.image}
                                    alt="Selected asset preview"
                                    draggable={false}
                                    className="size-12 object-contain pixelated"
                                />
                            )}
                            <div className="min-w-0">
                                <p className="break-words font-medium text-white">
                                    {assetName(selection)}
                                </p>
                                <p className="break-words text-xs text-base-content/65">
                                    {selection.source === "library"
                                        ? "Built-in library"
                                        : selection.source === "runtime"
                                        ? "Loaded in this game"
                                        : selection.path}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Clear asset selection"
                                className="btn btn-ghost btn-xs ml-auto"
                                onClick={() => selectAsset(null)}
                            >
                                ×
                            </button>
                        </div>
                        {selected?.sound && (
                            <SoundPreview
                                key={assetId(selection)}
                                src={selected.sound}
                                name={assetName(selection)}
                            />
                        )}
                        <div className="mt-2 flex gap-2">
                            <button
                                type="button"
                                className="btn btn-xs btn-ghost"
                                onClick={() => void copy(assetName(selection))}
                            >
                                Copy name
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs bg-primary/10 text-primary border-primary/20"
                                onClick={() =>
                                    void copy(assetPrompt(selection))}
                            >
                                Copy prompt
                            </button>
                        </div>
                    </div>
                )
                : (
                    <p className="shrink-0 border-t border-base-content/10 px-3 py-2 text-xs text-base-content/65">
                        Choose an asset to preview it and copy a prompt.
                    </p>
                )}
        </section>
    );
};

function assetId(asset: SelectedAsset): string {
    return asset.source === "library"
        ? `library:${asset.key}`
        : asset.source === "runtime"
        ? `runtime:${asset.kind}:${asset.name}`
        : `game:${asset.path}`;
}
function assetName(asset: SelectedAsset): string {
    return asset.source === "library" ? asset.key : asset.name;
}
function gameAsset(asset: Asset): BrowserAsset {
    return {
        identity: {
            source: "game",
            name: asset.name,
            path: asset.path,
            kind: asset.kind,
        },
        image: asset.kind === "sprite"
            ? asset.url
            : assets[asset.kind === "sound" ? "sounds" : "fonts"].sprite,
        sound: asset.kind === "sound" ? asset.url : undefined,
    };
}
function runtimeAsset(asset: PreviewAsset): BrowserAsset {
    return {
        identity: { source: "runtime", name: asset.name, kind: asset.kind },
        image: asset.kind === "sprite"
            ? asset.url
                ?? assets[asset.loader === "loadBean" ? "bean" : "art"].sprite
            : assets[asset.kind === "sound" ? "sounds" : "fonts"].sprite,
        sound: asset.kind === "sound" ? asset.url ?? undefined : undefined,
    };
}
function libraryAsset(asset: AssetBrewCatalogEntry): BrowserAsset {
    const crew = assets[asset.key as keyof typeof assets];
    return {
        identity: {
            source: "library",
            key: asset.key,
            name: asset.name,
            kind: asset.kind,
        },
        image: crew.kind === "Sound"
            ? ("relatedSprite" in crew
                ? (assets[
                    crew.relatedSprite as keyof typeof assets
                ] as SpriteCrewItem)?.sprite
                : null) ?? assets.sounds.sprite
            : crew.sprite,
        // Served files have the correct audio MIME type; some Crew data URLs
        // use audio/wave or application/octet-stream, which disable playback.
        sound: crew.kind === "Sound"
            ? asset.importFunction.match(/"(\/crew\/[\w-]+\.[\w]+)"/)?.[1]
            : undefined,
    };
}
