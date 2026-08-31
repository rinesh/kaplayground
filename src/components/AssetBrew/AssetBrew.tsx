import { assets } from "@kaplayjs/crew";
import { useMemo, useRef, useState } from "react";
import {
    assetBrewCatalog,
    searchAssetBrewEntries,
} from "../../data/assetBrewCatalog";
import { useIsScrolling } from "../../hooks/useIsScrolling";
import { cn } from "../../util/cn";
import { AssetBrewItem } from "./AssetBrewItem";

export const AssetBrew = () => {
    const [search, setSearch] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const isScrolling = useIsScrolling(scrollRef);

    const assetList = useMemo(() => {
        return searchAssetBrewEntries(assetBrewCatalog, { query: search })
            .filter((asset) =>
                search.trim().length > 0 || asset.kind !== "font"
            )
            .map((asset) => asset.key);
    }, [search]);

    return (
        <>
            <div className="relative bg-base-200 rounded-xl h-full w-full overflow-clip z-0">
                <div
                    ref={scrollRef}
                    className={cn(
                        "flex flex-row max-h-56 gap-1 items-center p-2 overflow-auto scrollbar-thin",
                        { "*:pointer-events-none": isScrolling },
                    )}
                >
                    <div className="sticky -left-2 -m-2 -mr-1 p-2 pr-1 bg-base-200 rounded-r-3xl z-10">
                        <input
                            type="search"
                            aria-label="Search Asset Brew"
                            className={"flex items-center justify-center bg-base-300 rounded-lg min-h-14 w-40 input"}
                            value={search}
                            placeholder="Search assets..."
                            onInput={(e) => {
                                setSearch(e.currentTarget.value);
                            }}
                        >
                        </input>
                    </div>
                    {assetList.map(key => (
                        <AssetBrewItem
                            key={key}
                            asset={key as keyof typeof assets}
                        />
                    ))}
                </div>
            </div>
        </>
    );
};
