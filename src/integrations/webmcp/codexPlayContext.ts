import { getDemo, WEBMCP_EXAMPLE_NAME } from "../../data/demos.ts";
import {
    type CodexPlayGuide,
    createCodexPlayGuide,
    createCodexPlayGuideKey,
} from "./codexPlayGuide.ts";
import { getExampleCoachPrompts } from "./exampleCoachPrompts.ts";
import { getExampleLesson } from "./exampleLessons.ts";

export type CodexPlayContext = {
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
    // Provenance survives saves and remixes; it is not evidence that the
    // starter's controls or objectives still describe the current source.
    const unchangedSource = context.projectSource === undefined
        || context.projectSource.trim() === sourceDemo?.code.trim();
    const guideDemo = unchangedSource ? sourceDemo : undefined;

    return createCodexPlayGuide({
        key: createCodexPlayGuideKey(
            guideDemo?.key,
            context.projectCreatedAt,
            context.projectKey,
        ),
        title: unchangedSource
            ? activeDemo?.formattedName ?? context.projectName
            : context.projectName === sourceDemo?.formattedName ? "your game" : context.projectName,
        source: context.projectSource ?? sourceDemo?.code,
        isStarter: guideDemo?.key === WEBMCP_EXAMPLE_NAME,
        prompts: getExampleCoachPrompts(guideDemo?.key),
        lesson: getExampleLesson(guideDemo?.key),
    });
}
