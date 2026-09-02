import { assets, SpriteCrewItem } from "@kaplayjs/crew";
import type { FC } from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { cn } from "../../util/cn";

interface AssetBrewItemProps {
    asset: keyof typeof assets;
}

export const AssetBrewItem: FC<AssetBrewItemProps> = ({ asset: assetKey }) => {
    const asset = assets[assetKey];
    const typeTip = "loadSpriteOpt" in asset && asset.loadSpriteOpt?.anims
        ? "Anim"
        : asset.kind != "Sprite"
        ? asset.kind
        : null;

    const handleClick = () => {
        useWorkspace.getState().selectAsset({
            source: "library",
            key: assetKey,
            name: asset.name,
            kind: asset.kind === "Sound"
                ? "sound"
                : asset.kind === "Font"
                ? "font"
                : "sprite",
        });
    };

    return (
        <button
            type="button"
            className="relative flex flex-col items-center justify-center bg-base-300 min-w-14 min-h-14 rounded-lg hover:bg-base-100 active:bg-base-50 transition-colors focus:outline-none focus-visible:ring-2 ring-base-content/20 focus-visible:z-[1]"
            draggable={false}
            onClick={handleClick}
            data-tooltip-id="global"
            data-tooltip-content={asset.name + (typeTip ? ` (${typeTip})` : "")}
            data-tooltip-place="top"
            data-tooltip-delay-show={300}
        >
            <img
                src={asset.kind == "Sound"
                    ? "relatedSprite" in asset
                        ? (assets[
                            asset.relatedSprite as keyof typeof assets
                        ] as SpriteCrewItem).sprite
                        : assets.sounds.sprite
                    : asset.sprite}
                className={cn("h-10 w-10 object-scale-down", {
                    "scale-[0.6] mt-1.5": asset.kind == "Sound",
                })}
                draggable={false}
                alt={asset.name}
            />

            {asset.kind == "Sound" && (
                <img
                    src={assets.sounds.sprite}
                    className="absolute top-1.5 right-1.5 w-5 h-5 drop-shadow-[-1px_1px_0_currentColor] text-base-100 hover:text-base-100 active:text-base-50"
                    draggable={false}
                    alt={asset.name}
                    title={asset.name}
                />
            )}
            <span className="text-xs">{assetKey}</span>
        </button>
    );
};
