import { useEffect, useState } from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useCodexPlayGuide } from "../../integrations/webmcp/useCodexPlayGuide";
import { CodexCoach } from "../WebMCP";
import { GameView } from "./GameView";

export const WorkspacePreview = () => {
    const guide = useCodexPlayGuide();
    const tipsVisible = useWorkspace(state => state.visiblePanels.tips);
    const setPanelVisible = useWorkspace(state => state.setPanelVisible);
    const [tipsMinimized, setTipsMinimized] = useState(false);

    useEffect(() => {
        setTipsMinimized(false);
        const visible = useWorkspace.getState().visiblePanels;
        if (visible.tools && !visible.tips) setPanelVisible("tips", true);
    }, [guide.key]);

    return (
        <div
            id="workspace-preview"
            className="workspace-preview"
            data-tips-visible={tipsVisible}
            data-tips-minimized={tipsMinimized}
        >
            <div id="workspace-preview-first" className="min-h-0 flex-1">
                <GameView />
            </div>
            <div
                id="workspace-preview-second"
                className="workspace-ideas"
                aria-hidden={!tipsVisible || undefined}
                {...{ inert: tipsVisible ? undefined : "" }}
            >
                <CodexCoach
                    guide={guide}
                    minimized={tipsMinimized}
                    onMinimizedChange={setTipsMinimized}
                />
            </div>
        </div>
    );
};
