import { useEffect } from "react";
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

    useEffect(() => {
        const visible = useWorkspace.getState().visiblePanels;
        if (visible.tools && !visible.tips) setPanelVisible("tips", true);
    }, [guide.key]);

    return (
        <div className="h-full min-h-0 w-full p-px pt-0">
            <WorkspaceSplit
                id="workspace-preview"
                label="Resize game and Codex ideas"
                vertical
                defaultSizes={sizes.getAllotmentSize("console", [640, 240])}
                minSizes={[180, 140]}
                snap={[false, true]}
                visible={[true, tipsVisible]}
                onVisibleChange={(index, visible) => {
                    if (index === 1) setPanelVisible("tips", visible);
                }}
                onDragEnd={value => {
                    if (value.every(size => size > 0)) {
                        sizes.setAllotmentSize("console", value);
                    }
                }}
            >
                <GameView />
                <div className="h-full overflow-y-auto pt-px scrollbar-thin">
                    <CodexCoach
                        guide={guide}
                        onClose={() => setPanelVisible("tips", false)}
                    />
                </div>
            </WorkspaceSplit>
        </div>
    );
};
