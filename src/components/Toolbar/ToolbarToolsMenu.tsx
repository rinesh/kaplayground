import { assets } from "@kaplayjs/crew";
import { toast } from "react-toastify";
import { useProject } from "../../features/Projects/stores/useProject";
import { useEditor } from "../../hooks/useEditor";
import { WebMCPButton } from "../WebMCP";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarMoreActionsDropdown } from "./ToolbarMoreActionsDropdown";
import { ToolbarProjectDropdown } from "./ToolbarProjectDropdown";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { AboutButton } from "./ToolButtons/AboutButton";
import { ConfigButton } from "./ToolButtons/ConfigButton";
import { ShareButton } from "./ToolButtons/ShareButton";
import { WorkspaceViewButton } from "./WorkspaceViewButton";

const ToolbarToolsMenu = () => {
    const canShareLink = useProject(state =>
        state.project.files.size === 1 && state.project.assets.size === 0
    );

    return (
        <div className="col-span-3 flex h-11 shrink-0 items-center justify-end bg-base-300 min-[900px]:ml-auto">
            <WebMCPButton />
            <WorkspaceViewButton />
            <ToolbarButton
                icon={assets.play.outlined}
                iconFirst
                text="Run"
                compact
                aria-label="Run game"
                onClick={() =>
                    void useEditor.getState().run().catch(error =>
                        toast.error(String(error))
                    )}
                tip="Run game"
                keys={["ctrl", "s"]}
                className="pr-1.5"
            />
            <ToolbarMoreActionsDropdown />
            <ToolbarSeparator className="mx-0 px-0" />
            {canShareLink && <ShareButton />}
            <ToolbarProjectDropdown />
            <AboutButton />
            <ConfigButton />
        </div>
    );
};

export default ToolbarToolsMenu;
