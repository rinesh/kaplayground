import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { demos, type Example } from "../../data/demos";
import { compareStartingPoints } from "../../data/startingPoints";
import { loadProject } from "../../features/Projects/application/loadProject";
import { useProject } from "../../features/Projects/stores/useProject";
import { confirmNavigate } from "../../util/confirmNavigate";
import {
    openDemoBrowser,
    openProjectBrowser,
} from "../ProjectBrowser/ProjectBrowser";

const startingPoints = [...demos].sort(compareStartingPoints);

const ExampleList = () => {
    const savedIds = useProject(state => state.savedProjects);
    const projectKey = useProject(state => state.projectKey);
    const demoKey = useProject(state => state.demoKey);
    const name = useProject(state => state.project.name);
    const [projects, setProjects] = useState<Example[]>([]);
    const selectedValue = projectKey
        ? `project:${projectKey}`
        : demoKey
        ? `starter:${demoKey}`
        : "draft";

    useEffect(() => {
        let current = true;
        void Promise.all(
            savedIds.map(id => useProject.getState().getProjectMetadata(id)),
        )
            .then(entries => {
                if (current) setProjects(entries);
            })
            .catch(() => {
                if (current) setProjects([]);
            });
        return () => {
            current = false;
        };
    }, [savedIds, projectKey]);

    const savedGames = useMemo(() =>
        projects
            .filter(project => savedIds.includes(project.key))
            .sort((left, right) =>
                right.updatedAt.localeCompare(left.updatedAt)
            ), [projects, savedIds]);

    const changeGame = (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value;
        event.currentTarget.value = selectedValue;
        if (value === selectedValue) return;
        const project = savedGames.find(entry =>
            `project:${entry.key}` === value
        );
        const starter = startingPoints.find(entry =>
            `starter:${entry.key}` === value
        );
        if (!project && !starter) return;
        void confirmNavigate(async () => {
            if (project) await loadProject(project.key);
            else if (starter) {
                await useProject.getState().createNewProject(
                    "ex",
                    {},
                    starter.key,
                );
            }
        }).catch(error =>
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Couldn't open that game.",
            )
        );
    };

    return (
        <div className="join flex min-w-0 border border-base-100 min-[900px]:w-52 min-[1200px]:w-72">
            <select
                aria-label="Choose a game or starting point"
                className="join-item select select-xs min-w-0 w-full truncate pr-6"
                value={selectedValue}
                onChange={changeGame}
            >
                {(!projectKey && !demoKey) && (
                    <option value="draft">{name}</option>
                )}
                {projectKey
                    && !savedGames.some(project => project.key === projectKey)
                    && <option value={selectedValue}>{name}</option>}
                {savedGames.length > 0 && (
                    <optgroup label="My games">
                        {savedGames.map(project => (
                            <option
                                key={project.key}
                                value={`project:${project.key}`}
                            >
                                {project.key === projectKey
                                    ? name
                                    : project.formattedName}
                            </option>
                        ))}
                    </optgroup>
                )}
                <optgroup label="Game starting points">
                    {startingPoints.map(starter => (
                        <option
                            key={starter.key}
                            value={`starter:${starter.key}`}
                        >
                            {starter.formattedName}
                        </option>
                    ))}
                </optgroup>
            </select>
            <button
                type="button"
                className="join-item btn btn-xs shrink-0 px-2"
                onClick={() =>
                    projectKey ? openProjectBrowser() : openDemoBrowser()}
            >
                Browse all
            </button>
        </div>
    );
};

export default ExampleList;
