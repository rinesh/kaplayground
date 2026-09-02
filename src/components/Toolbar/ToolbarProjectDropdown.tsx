import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "react-toastify";
import { buildProject } from "../../features/Projects/application/buildProject";
import {
    confirmAndDeleteProject,
    exportProject,
    openProjectDetails,
    openProjectPreferences,
} from "../../features/Projects/services/projectActions";
import { useProject } from "../../features/Projects/stores/useProject";
import { confirmNavigate } from "../../util/confirmNavigate";
import { downloadBlob } from "../../util/download";
import { KDropdownMenuSeparator } from "../UI/KDropdown/KDropdownSeparator";
import { ToolbarDropdown } from "./ToolbarDropdown";
import { ToolbarDropdownButton } from "./ToolbarDropdownButton";

export const ToolbarProjectDropdown = () => {
    const projectKey = useProject(state => state.projectKey);
    const newFileInput = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const attempt = (action: () => Promise<unknown>) =>
        void action().catch(error =>
            toast.error(error instanceof Error ? error.message : String(error))
        );

    const handleHTMLBuild = async () => {
        const { project } = useProject.getState();
        const projectCode = await buildProject();
        if (!projectCode) throw new Error("Couldn't export this game as HTML.");
        downloadBlob(
            new Blob([projectCode], { type: "text/html" }),
            `${project.name.trim()}.html`,
        );
    };

    const handleProjectUpload = async (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const generation = useProject.getState().projectGeneration;
        try {
            const project = useProject.getState().unserializeProject(
                await file.text(),
            );
            if (useProject.getState().projectGeneration !== generation) return;
            await confirmNavigate(() =>
                useProject.getState().createNewProject(project.mode, project)
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Couldn't import that project.",
            );
        }
    };

    return (
        <>
            <ToolbarDropdown
                icon={assets.toolbox.outlined}
                text="Project options"
                compact
                tip="Project options"
                open={open}
                setOpen={setOpen}
            >
                <ToolbarDropdownButton
                    onClick={() =>
                        attempt(() =>
                            useProject.getState().persistActiveProject()
                        )}
                >
                    Save project
                </ToolbarDropdownButton>
                <ToolbarDropdownButton onClick={() => openProjectPreferences()}>
                    Project settings
                </ToolbarDropdownButton>
                <ToolbarDropdownButton
                    onClick={() => attempt(() => openProjectDetails())}
                    disabled={!projectKey}
                >
                    Project details
                </ToolbarDropdownButton>
                <KDropdownMenuSeparator />
                <ToolbarDropdownButton
                    onClick={() => newFileInput.current?.click()}
                >
                    Import project
                </ToolbarDropdownButton>
                <ToolbarDropdownButton
                    onClick={() => attempt(() => exportProject())}
                >
                    Export project
                </ToolbarDropdownButton>
                <ToolbarDropdownButton onClick={() => attempt(handleHTMLBuild)}>
                    Export playable HTML
                </ToolbarDropdownButton>
                <KDropdownMenuSeparator />
                <ToolbarDropdownButton
                    type="danger"
                    disabled={!projectKey}
                    onClick={() => attempt(() => confirmAndDeleteProject())}
                >
                    Delete project
                </ToolbarDropdownButton>
            </ToolbarDropdown>
            <input
                type="file"
                className="hidden"
                aria-label="Import project file"
                onChange={event => void handleProjectUpload(event)}
                accept=".kaplay"
                ref={newFileInput}
            />
        </>
    );
};
import { assets } from "@kaplayjs/crew";
