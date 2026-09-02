import { useWorkspace } from "../../hooks/useWorkspace";

export const WorkspaceViewButton = () => {
    const visible = useWorkspace(state => state.visiblePanels);
    const expandGame = useWorkspace(state => state.expandGame);
    const restorePanels = useWorkspace(state => state.restorePanels);
    const restore = !visible.game || !visible.tools || !visible.tips;
    const label = restore ? "Restore panels" : "Expand game";

    return (
        <button
            type="button"
            className="btn btn-xs btn-ghost h-full w-9 shrink-0 rounded-sm px-2 focus-visible:-outline-offset-2"
            aria-label={label}
            title={label}
            onClick={restore ? restorePanels : expandGame}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path
                    d={restore
                        ? "M4 9h5V4M15 4v5h5M20 15h-5v5M9 20v-5H4"
                        : "M9 4H4v5M15 4h5v5M20 15v5h-5M9 20H4v-5"}
                />
            </svg>
        </button>
    );
};
