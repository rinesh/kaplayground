import * as ContextMenu from "@radix-ui/react-context-menu";
import { type FC } from "react";
import type { Asset } from "../../features/Projects/models/Asset";
import { useProject } from "../../features/Projects/stores/useProject";
import { useWorkspace } from "../../hooks/useWorkspace";

export type ResourceProps = {
    asset: Asset;
    visibleIcon?: string;
};

const AssetsItem: FC<ResourceProps> = ({ asset, visibleIcon }) => {
    const removeAsset = useProject((s) => s.removeAsset);

    const handleResourceDelete = () => {
        removeAsset(asset.path);
    };

    return (
        <ContextMenu.Root>
            <ContextMenu.Trigger
                draggable={false}
                id={asset.name}
                data-label={asset.name}
                data-url={asset.url}
                data-tooltip-id="global"
                data-tooltip-content={asset.name}
                data-tooltip-place="top"
                data-tooltip-delay-show={300}
            >
                <li draggable={false}>
                    <button
                        type="button"
                        onClick={() =>
                            useWorkspace.getState().selectAsset({
                                source: "game",
                                name: asset.name,
                                path: asset.path,
                                kind: asset.kind,
                            })}
                        className="p-2 rounded-lg hover:bg-base-300 h-20 w-20"
                    >
                        <img
                            draggable={false}
                            src={visibleIcon ?? asset.url}
                            alt={`Asset ${asset.name}`}
                            className="h-12 w-12 object-scale-down mx-auto"
                        />
                        <p className="text-xs text-center text-gray-500 truncate">
                            {asset.name}
                        </p>
                    </button>
                </li>
            </ContextMenu.Trigger>

            <ContextMenu.Portal>
                <ContextMenu.Content className="rounded-btn p-1 bg-base-300 flex flex-col">
                    <ContextMenu.Item
                        className="btn btn-sm btn-ghost justify-start rounded-md"
                        onClick={handleResourceDelete}
                    >
                        Delete
                    </ContextMenu.Item>
                </ContextMenu.Content>
            </ContextMenu.Portal>
        </ContextMenu.Root>
    );
};

export default AssetsItem;
