import { create } from "zustand";
import type { AssetKind } from "../features/Projects/models/AssetKind";

export type SelectedAsset =
    & {
        name: string;
        kind: AssetKind;
    }
    & (
        | { source: "library"; key: string }
        | { source: "game"; path: string }
        | { source: "runtime" }
    );

type WorkspacePanel = "game" | "tools" | "tips";

interface WorkspaceState {
    activeTab: "assets" | "code";
    selectedAsset: SelectedAsset | null;
    visiblePanels: Record<WorkspacePanel, boolean>;
    setActiveTab(tab: "assets" | "code"): void;
    selectAsset(asset: SelectedAsset | null): void;
    setPanelVisible(panel: WorkspacePanel, visible: boolean): void;
    expandGame(): void;
    restorePanels(): void;
}

/** Presentation state is deliberately excluded from game revisions and storage. */
export const useWorkspace = create<WorkspaceState>(set => ({
    activeTab: "assets",
    selectedAsset: null,
    visiblePanels: { game: true, tools: true, tips: true },
    setActiveTab: activeTab =>
        set(state => ({
            activeTab,
            visiblePanels: { ...state.visiblePanels, tools: true },
        })),
    selectAsset: selectedAsset => set({ selectedAsset }),
    setPanelVisible: (panel, visible) =>
        set(state => ({
            visiblePanels: { ...state.visiblePanels, [panel]: visible },
        })),
    expandGame: () =>
        set({ visiblePanels: { game: true, tools: false, tips: false } }),
    restorePanels: () =>
        set({ visiblePanels: { game: true, tools: true, tips: true } }),
}));
