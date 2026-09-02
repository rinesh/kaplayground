import { type FC, type MouseEvent, useRef } from "react";
import { toast } from "react-toastify";
import type { Tag } from "../../data/demos";
import { WEBMCP_EXAMPLE_NAME } from "../../data/demos";
import { loadProject } from "../../features/Projects/application/loadProject";
import { useProject } from "../../features/Projects/stores/useProject";
import { confirmNavigate } from "../../util/confirmNavigate";
import { ConditionalWrap } from "../Util/ConditionalWrap";
import { ProjectContextMenu } from "./ProjectContextMenu";

export type ProjectEntryProject = {
    key: string;
    name: string;
    formattedName: string;
    description: string | null;
    difficulty?: { level: number; name: string };
    tags?: Tag[];
    version: string;
    minVersion: string;
    createdAt: string;
    updatedAt: string;
    locked?: boolean;
};

interface ProjectEntryProps {
    project: ProjectEntryProject;
    isProject?: boolean;
    toggleTag?: (tag: string) => void;
}

export const ProjectEntry: FC<ProjectEntryProps> = (
    { project, isProject, toggleTag },
) => {
    const projectKey = useProject(state => state.projectKey);
    const demoKey = useProject(state => state.demoKey);
    const isCurrent = isProject
        ? projectKey === project.key
        : demoKey === project.key;
    const contextMenuRef = useRef<{ trigger: HTMLDivElement | null }>(null);

    const open = () => {
        const dialog = document.querySelector<HTMLDialogElement>(
            "#examples-browser",
        );
        if (!dialog?.open) return;
        if (isCurrent) {
            dialog.close();
            return;
        }
        void confirmNavigate(async () => {
            if (isProject) await loadProject(project.key);
            else {await useProject.getState().createNewProject(
                    "ex",
                    {},
                    project.key,
                );}
            dialog.close();
        }).catch(error =>
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Couldn't open the project.",
                { containerId: "projects-browser-toasts" },
            )
        );
    };
    const manage = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        contextMenuRef.current?.trigger?.dispatchEvent(
            new MouseEvent("contextmenu", {
                bubbles: true,
                clientX: rect.x,
                clientY: rect.y,
            }),
        );
    };

    return (
        <ConditionalWrap
            condition={isProject}
            wrap={children => (
                <ProjectContextMenu project={project} ref={contextMenuRef}>
                    {children}
                </ProjectContextMenu>
            )}
        >
            <article
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={event => {
                    if (
                        event.target === event.currentTarget
                        && (event.key === "Enter" || event.key === " ")
                    ) {
                        event.preventDefault();
                        open();
                    }
                }}
                data-current={isCurrent || undefined}
                className="group relative flex min-h-32 cursor-pointer flex-col gap-2 rounded-xl border border-transparent bg-base-200 p-4 hover:bg-base-content/10 focus-visible:outline-primary data-[current]:border-primary/40"
            >
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-medium text-white">
                        {project.formattedName}
                    </h3>
                    {isProject && (
                        <button
                            type="button"
                            aria-label={`Manage ${project.formattedName}`}
                            className="btn btn-xs btn-ghost text-lg"
                            onClick={manage}
                        >
                            ⋯
                        </button>
                    )}
                </div>
                {!isProject && project.key === WEBMCP_EXAMPLE_NAME && (
                    <span className="text-xs font-semibold text-primary">
                        Start here · Play and remix with Codex
                    </span>
                )}
                {!isProject && (
                    <p className="text-sm leading-relaxed">
                        {project.description
                            || "A starting point to play with and make your own."}
                    </p>
                )}
                {isProject && (
                    <p className="text-xs text-base-content/60">
                        Saved locally ·{" "}
                        {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                )}
                {!isProject && (
                    <div className="mt-auto flex flex-wrap gap-1 pt-1">
                        {project.tags?.map(tag => (
                            <button
                                type="button"
                                key={tag.name}
                                className="btn btn-xs btn-ghost rounded-full bg-base-content/10 font-normal"
                                onClick={event => {
                                    event.stopPropagation();
                                    toggleTag?.(tag.name);
                                }}
                            >
                                {tag.displayName ?? tag.name}
                            </button>
                        ))}
                    </div>
                )}
            </article>
        </ConditionalWrap>
    );
};
