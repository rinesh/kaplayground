import { create } from "zustand";
import type { AssetKind } from "../features/Projects/models/AssetKind";

export type SelectedAsset = {
    name: string;
    kind: AssetKind;
} & ({ source: "library"; key: string } | { source: "game"; path: string });

interface WorkspaceState {
    activeTab: "assets" | "code";
    selectedAsset: SelectedAsset | null;
    setActiveTab(tab: "assets" | "code"): void;
    selectAsset(asset: SelectedAsset | null): void;
}

/** Presentation state is deliberately excluded from game revisions and storage. */
export const useWorkspace = create<WorkspaceState>(set => ({
    activeTab: "assets",
    selectedAsset: null,
    setActiveTab: activeTab => set({ activeTab }),
    selectAsset: selectedAsset => set({ selectedAsset }),
}));
