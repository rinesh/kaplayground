import { useMemo } from "react";
import { useProject } from "../../features/Projects/stores/useProject.ts";
import { createCodexPlayGuideForContext } from "./codexPlayContext.ts";

export function useCodexPlayGuide() {
    const demoKey = useProject((state) => state.demoKey);
    const projectKey = useProject((state) => state.projectKey);
    const projectName = useProject((state) => state.project.name);
    const sourceDemoKey = useProject((state) => state.project.sourceDemoKey);
    const projectCreatedAt = useProject((state) => state.project.createdAt);
    const projectRevision = useProject((state) => state.projectRevision);

    return useMemo(
        () =>
            createCodexPlayGuideForContext({
                demoKey,
                sourceDemoKey,
                projectKey,
                projectName,
                projectCreatedAt,
                projectSource: [
                    ...useProject.getState().project.files.values(),
                ].map((file) => file.value).join("\n"),
            }),
        [
            demoKey,
            projectCreatedAt,
            projectKey,
            projectName,
            projectRevision,
            sourceDemoKey,
        ],
    );
}
