import { assets } from "@kaplayjs/crew";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { openProjectPreferences } from "../../features/Projects/services/projectActions";
import { useProject } from "../../features/Projects/stores/useProject";
import { ToolbarButton } from "./ToolbarButton";

export const ProjectStatus = () => {
    const name = useProject(state => state.project.name);
    const generation = useProject(state => state.projectGeneration);
    const status = useProject(state => state.saveStatus);
    const error = useProject(state => state.saveError);
    const [value, setValue] = useState(name);
    useEffect(() => setValue(name), [generation, name]);

    const saveProject = () => {
        void useProject.getState().persistActiveProject().catch(error =>
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Couldn't save this project.",
            )
        );
    };

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1 py-1 min-[900px]:w-48 min-[900px]:flex-1 min-[900px]:max-w-72">
            <button
                type="button"
                className="btn btn-xs shrink-0 rounded-full px-2 uppercase"
                aria-label="Project settings"
                aria-haspopup="dialog"
                aria-controls="project-preferences"
                onClick={() => openProjectPreferences()}
            >
                Project
            </button>
            <div className="min-w-0 flex-1">
                <input
                    id="projectNameInput"
                    aria-label="Project name"
                    className="input input-xs min-w-0 w-full px-2 font-medium text-white"
                    value={value}
                    maxLength={120}
                    onChange={event => {
                        const name = event.target.value;
                        setValue(name);
                        useProject.getState().setProject({ name });
                    }}
                    onBlur={() => {
                        const normalized = value.trim() || "Untitled";
                        setValue(normalized);
                        useProject.getState().setProject({ name: normalized });
                    }}
                    onKeyDown={event => {
                        if (event.key === "Enter") event.currentTarget.blur();
                    }}
                />
            </div>
            <ToolbarButton
                id="project-save-button"
                type="button"
                icon={assets.save.outlined}
                text={status === "error"
                    ? "Retry save"
                    : status === "saving"
                    ? "Autosaving project"
                    : status === "saved"
                    ? "Save project — autosave on"
                    : "Save project"}
                compact
                aria-busy={status === "saving"}
                aria-describedby={status === "error"
                    ? "project-save-error"
                    : undefined}
                tip={status === "error"
                    ? "Autosave couldn't save your changes. Click to retry."
                    : status === "draft"
                    ? "Your first edit saves a copy to My games automatically. Click to save a copy now."
                    : status === "saving"
                    ? "Autosaving to My games in this browser…"
                    : "Autosave on — your changes are saved to My games in this browser. Click to save now."}
                className={`h-9 shrink-0 px-1.5 ${
                    status === "saved"
                        ? "opacity-45 hover:opacity-100"
                        : status === "error"
                        ? "text-error"
                        : ""
                }`}
                disabled={status === "saving"}
                onClick={saveProject}
            />
            {status === "error" && (
                <div
                    id="project-save-error"
                    role="alert"
                    className="flex basis-full items-center gap-1 px-2 text-xs leading-4 text-error"
                    title={error ?? undefined}
                >
                    <span>Couldn’t save</span>
                    <span aria-hidden="true">·</span>
                    <button
                        id="project-save-retry"
                        type="button"
                        className="link min-h-6 px-1 font-semibold"
                        aria-label="Retry saving project"
                        onClick={saveProject}
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
};
