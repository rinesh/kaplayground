import { assets, type CrewItem, type Tag } from "@kaplayjs/crew";

export type AssetBrewKind = "sprite" | "sound" | "font";

export interface AssetBrewCatalogEntry {
    key: string;
    name: string;
    description: string;
    kind: AssetBrewKind;
    tags: readonly string[];
    searchTerms: readonly string[];
    animations: readonly string[];
    importFunction: string;
    outlinedImportFunction?: string;
}

export interface AssetBrewSearchOptions {
    query?: string;
    kind?: AssetBrewKind;
    tag?: string;
}

const preferredOrder = [
    "bean",
    "bean_voice",
    "mark",
    "mark_voice",
    "ghosty",
    "ghostiny",
    "bobo",
    "bag",
    "kat",
    "tga",
    "burpman",
    "burp",
];

const preferredTagsOrder: Tag[] = [
    "crew",
    "animals",
    "food",
    "objects",
    "tiles",
    "icons",
    "ui",
    "emojis",
    "books",
    "brand",
];

const assetKeys = (Object.keys(assets) as Array<keyof typeof assets>).sort(
    (left, right) => {
        const assetA = assets[left];
        const assetB = assets[right];
        const prefA = preferredOrder.indexOf(left);
        const prefB = preferredOrder.indexOf(right);

        if (prefA !== -1 || prefB !== -1) {
            if (prefA === -1) return 1;
            if (prefB === -1) return -1;
            return prefA - prefB;
        }

        const rankA = tagRank(assetA);
        const rankB = tagRank(assetB);
        if (rankA !== rankB) return rankA - rankB;
        return left.localeCompare(right);
    },
);

export const assetBrewCatalog: readonly AssetBrewCatalogEntry[] = assetKeys.map(
    (key) => {
        const asset = assets[key];
        const searchTerms = [
            ...(asset.searchTerms ?? []),
            ...(asset.aliases ?? []).map((alias) => alias.name),
        ];
        const animations = asset.kind === "Sprite"
            ? Object.keys(asset.loadSpriteOpt?.anims ?? {})
            : [];

        return {
            key,
            name: asset.name,
            description: asset.description,
            kind: asset.kind.toLowerCase() as AssetBrewKind,
            tags: [...asset.tags],
            searchTerms: [...new Set(searchTerms)],
            animations,
            importFunction: asset.imports.importInPG.original,
            ...(asset.imports.importInPG.outlined
                ? {
                    outlinedImportFunction: asset.imports.importInPG.outlined,
                }
                : {}),
        };
    },
);

export function searchAssetBrewEntries<
    T extends AssetBrewCatalogEntry,
>(
    entries: readonly T[],
    options: AssetBrewSearchOptions = {},
): T[] {
    const query = normalize(options.query ?? "");
    const tag = normalize(options.tag ?? "");

    return entries
        .map((entry, index) => ({
            entry,
            index,
            rank: searchRank(entry, query),
        }))
        .filter(({ entry, rank }) =>
            (options.kind === undefined || entry.kind === options.kind)
            && (
                tag.length === 0
                || entry.tags.some((entryTag) => normalize(entryTag) === tag)
            )
            && rank !== null
        )
        .sort((left, right) =>
            (left.rank ?? 0) - (right.rank ?? 0)
            || left.index - right.index
        )
        .map(({ entry }) => entry);
}

function tagRank(asset: CrewItem): number {
    const ranks = asset.tags
        .map((tag) => preferredTagsOrder.indexOf(tag))
        .filter((rank) => rank !== -1);
    return ranks.length > 0 ? Math.min(...ranks) : Infinity;
}

function searchRank(
    entry: AssetBrewCatalogEntry,
    query: string,
): number | null {
    if (query.length === 0) return 0;

    const fields = searchFields(entry);
    const phraseRank = bestFieldRank(fields, query);
    if (phraseRank !== null) return phraseRank;

    const tokens = [...new Set(query.split(" ").filter(Boolean))];
    const tokenRanks = tokens
        .map((token) => bestFieldRank(fields, token))
        .filter((rank): rank is number => rank !== null);
    if (tokenRanks.length === 0) return null;

    return 100
        + (tokens.length - tokenRanks.length) * 100
        + tokenRanks.reduce((total, rank) => total + rank, 0);
}

function searchFields(
    entry: AssetBrewCatalogEntry,
): Array<{ value: string; weight: number }> {
    return [
        { value: normalize(entry.key), weight: 0 },
        { value: normalize(entry.name), weight: 1 },
        ...entry.searchTerms.map((term) => ({
            value: normalize(term),
            weight: 3,
        })),
        ...entry.tags.map((tag) => ({
            value: normalize(tag),
            weight: 4,
        })),
        { value: normalize(entry.description), weight: 6 },
    ];
}

function bestFieldRank(
    fields: Array<{ value: string; weight: number }>,
    query: string,
): number | null {
    let best: number | null = null;
    for (const field of fields) {
        const matchRank = field.value === query
            ? field.weight
            : field.value.startsWith(query)
            ? 10 + field.weight
            : field.value.includes(query)
            ? 20 + field.weight
            : null;
        if (matchRank !== null && (best === null || matchRank < best)) {
            best = matchRank;
        }
    }
    return best;
}

function normalize(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}
