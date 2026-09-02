import { assets } from "@kaplayjs/crew";
import { toast } from "react-toastify";
import { useProject } from "../../features/Projects/stores/useProject";
import { WEBMCP_EXAMPLE_NAME } from "../../integrations/webmcp/constants";
import { confirmNavigate } from "../../util/confirmNavigate";
import ExampleList from "./ExampleList";
import { ProjectStatus } from "./ProjectStatus";
import ToolbarToolsMenu from "./ToolbarToolsMenu";

export const Toolbar = () => (
    <div
        className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)] min-h-11 items-center gap-x-2 bg-base-300 rounded-b-xl px-1 min-[900px]:flex"
        role="toolbar"
        aria-label="Game workspace"
    >
        <a
            href={`/?example=${WEBMCP_EXAMPLE_NAME}`}
            aria-label="KAPLAYGROUND home"
            title="Open Play & Remix with Codex"
            className="btn btn-ghost h-9 min-h-0 w-7 shrink-0 rounded-sm p-0"
            onClick={event => {
                if (
                    event.button !== 0 || event.metaKey || event.ctrlKey
                    || event.shiftKey || event.altKey
                ) return;
                event.preventDefault();
                void confirmNavigate(() =>
                    useProject.getState().createNewProject(
                        "ex",
                        {},
                        WEBMCP_EXAMPLE_NAME,
                    )
                ).catch(error =>
                    toast.error(
                        error instanceof Error
                            ? error.message
                            : "Couldn't open the starting point.",
                    )
                );
            }}
        >
            <img
                src={assets.ka.outlined}
                alt=""
                draggable={false}
                className="h-6 w-7 object-contain"
            />
        </a>
        <ProjectStatus />
        <ExampleList />
        <ToolbarToolsMenu />
    </div>
);
