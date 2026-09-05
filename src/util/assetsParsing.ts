/*
KAPLAYGROUND do different transformations to asset urls

/crew - load from Crew package
/assets - load from assets

others are assumed as our hosted assets in public
*/

import { assets } from "@kaplayjs/crew";
import { SANDBOX_URL } from "../config/common";
import publicAssetPaths from "../data/publicAssetPaths.json";
import type { Asset } from "../features/Projects/models/Asset";
import { useProject } from "../features/Projects/stores/useProject";

const builtInPaths = new Map<string, string | null>(
    Object.entries(publicAssetPaths),
);

export const parseAssetPath = (
    path: string,
    match?: string,
    projectAssets: ReadonlyMap<string, Asset> =
        useProject.getState().project.assets,
    embeddedAssets?: ReadonlyMap<string, string>,
) => {
    let normalPath = normalize(path);

    const loadType = match?.match(/^load(\w+)/s)?.[1] ?? null;

    if (normalPath.startsWith("assets/")) {
        const pathInAssets = projectAssets.get(normalPath);

        if (pathInAssets) {
            path = pathInAssets.url;
            return path;
        }

        return path;
    }

    if (builtInPaths.has(normalPath)) {
        return embeddedAssets?.get(normalPath)
            ?? builtInPaths.get(normalPath)
            ?? new URL(normalPath, SANDBOX_URL).href;
    }

    const isCrew = normalPath.startsWith("crew/");

    if (isCrew) {
        const crewName = normalPath.split("/").pop()?.split(".").slice(0, -1)
            .join(
                ".",
            );
        const isOutlined = crewName?.endsWith("-o");
        const crewKey = crewName?.replace(/-o$/, "");
        const crewEntry = assets[crewKey as keyof typeof assets];

        if (!crewEntry) return normalPath;

        if (loadType == "Sound" && "sound" in crewEntry) {
            normalPath = crewEntry.sound;
        } else if ("spritesheet" in crewEntry) {
            normalPath = crewEntry.spritesheet
                ?.[isOutlined ? "outlined" : "sprite"]!;
        } else if (isOutlined && "outlined" in crewEntry) {
            normalPath = crewEntry.outlined;
        } else if ("sprite" in crewEntry) {
            normalPath = crewEntry.sprite;
        }

        return normalPath;
    }

    return path;
};

const normalize = (path: string) => {
    const normalizedPath = path.replace(/^(?:\.\/)+/, "")
        .replace(/^\/|\/$/g, "").replace(/"/g, "");

    return normalizedPath;
};
