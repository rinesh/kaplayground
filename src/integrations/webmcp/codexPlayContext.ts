import { getDemo, WEBMCP_EXAMPLE_NAME } from "../../data/demos.ts";
import {
    type CodexPlayGuide,
    createCodexPlayGuide,
    createCodexPlayGuideKey,
} from "./codexPlayGuide.ts";
import { getExampleCoachPrompts } from "./exampleCoachPrompts.ts";
import { getExampleLesson } from "./exampleLessons.ts";

export type CodexPlayContext = {
    editorOrigin?: string;
    demoKey: string | null;
    sourceDemoKey?: string;
    projectKey: string | null;
    projectName: string;
    projectCreatedAt: string;
    projectSource?: string;
};

export function createCodexPlayGuideForContext(
    context: CodexPlayContext,
): CodexPlayGuide {
    const activeDemo = getDemo(context.demoKey);
    const sourceDemo = activeDemo ?? getDemo(context.sourceDemoKey);

    return createCodexPlayGuide({
        key: createCodexPlayGuideKey(
            sourceDemo?.key,
            context.projectCreatedAt,
            context.projectKey,
        ),
        title: activeDemo?.formattedName ?? context.projectName,
        editorOrigin: context.editorOrigin,
        source: context.projectSource ?? sourceDemo?.code,
        isStarter: sourceDemo?.key === WEBMCP_EXAMPLE_NAME,
        prompts: getExampleCoachPrompts(sourceDemo?.key),
        lesson: getExampleLesson(sourceDemo?.key),
    });
}
