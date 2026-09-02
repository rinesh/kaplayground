import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useCodexPlayGuide } from "../../integrations/webmcp/useCodexPlayGuide";
import { allotmentStorage } from "../../util/allotmentStorage";
import { CodexCoach } from "../WebMCP";
import { GameView } from "./GameView";
import { WorkspaceSplit } from "./WorkspaceSplit";

const sizes = allotmentStorage("game-first-preview");

export const WorkspacePreview = () => {
    const guide = useCodexPlayGuide();
    const tipsVisible = useWorkspace(state => state.visiblePanels.tips);
    const setPanelVisible = useWorkspace(state => state.setPanelVisible);
    const [tipsMinimized, setTipsMinimized] = useState(false);
    const currentSizes = useRef<number[]>([]);

    const setMinimized = (minimized: boolean) => {
        if (
            minimized && currentSizes.current.length === 2
            && currentSizes.current.every(size => size > 0)
        ) {
            sizes.setAllotmentSize("console", currentSizes.current);
        }
        setTipsMinimized(minimized);
    };

    useEffect(() => {
        setTipsMinimized(false);
        const visible = useWorkspace.getState().visiblePanels;
        if (visible.tools && !visible.tips) setPanelVisible("tips", true);
    }, [guide.key]);

    return (
        <div className="h-full min-h-0 w-full p-px pt-0">
            <WorkspaceSplit
                id="workspace-preview"
                label="Resize game and Codex ideas"
                vertical
                layoutKey={tipsMinimized ? "minimized" : "open"}
                defaultSizes={sizes.getAllotmentSize("console", [640, 240])}
                minSizes={[180, tipsMinimized ? 40 : 140]}
                maxSizes={[undefined, tipsMinimized ? 40 : undefined]}
                snap={[false, false]}
                visible={[true, tipsVisible]}
                onChange={value => {
                    currentSizes.current = value;
                }}
                onVisibleChange={(index, visible) => {
                    if (index === 1) setPanelVisible("tips", visible);
                }}
                onDragEnd={value => {
                    if (!tipsMinimized && value.every(size => size > 0)) {
                        sizes.setAllotmentSize("console", value);
                    }
                }}
            >
                <GameView />
                <div className="h-full min-h-0 pt-px">
                    <CodexCoach
                        guide={guide}
                        minimized={tipsMinimized}
                        onMinimizedChange={setMinimized}
                    />
                </div>
            </WorkspaceSplit>
        </div>
    );
};
