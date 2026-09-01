import { CODEX_PLAY_STEPS, type CodexPlayStep } from "./agentGuide.ts";
import type { ExampleCoachPrompts } from "./exampleCoachPrompts.ts";

export type CodexPlayPresentation = "interactive" | "visual" | "output";

export type CodexPlaySubject = {
    key: string;
    title: string;
    source?: string;
    isStarter?: boolean;
    prompts?: ExampleCoachPrompts;
};

export type CodexPlayGuide = {
    key: string;
    subjectTitle: string;
    presentation: CodexPlayPresentation;
    steps: readonly CodexPlayStep[];
};

export function createCodexPlayGuideKey(
    sourceKey: string | undefined,
    projectCreatedAt: string,
    projectKey: string | null,
): string {
    const identity = projectCreatedAt || projectKey || "current-example";
    return `${sourceKey ?? "custom"}:${identity}`;
}

export function createCodexPlayGuide(
    subject: CodexPlaySubject,
): CodexPlayGuide {
    const title = cleanText(subject.title) || "this starting point";

    if (subject.isStarter) {
        return {
            key: subject.key,
            subjectTitle: title,
            presentation: "interactive",
            steps: CODEX_PLAY_STEPS,
        };
    }

    const presentation = classifyPresentation(subject.source ?? "");
    const playStep = createPlayStep(title, presentation);
    const prompts = subject.prompts
        ?? createFallbackCoachPrompts(title, presentation);

    return {
        key: subject.key,
        subjectTitle: title,
        presentation,
        steps: [
            playStep,
            {
                id: "explain",
                eyebrow: "ASK CODEX",
                title: "Find out what you can try",
                description:
                    "Start with what is already on screen, then make one small change you can see or play.",
                prompt: prompts.explain,
            },
            {
                id: "remix",
                eyebrow: "FIRST REMIX",
                title: "Give it your own look",
                description:
                    "Keep the useful behavior and give it a concrete new look, reaction, or personality.",
                prompt: prompts.remix,
            },
            {
                id: "build",
                eyebrow: "BUILD A GAME",
                title: "Turn this idea into a tiny game",
                description:
                    "Use the example as the main mechanic for a short game with a clear finish.",
                prompt: prompts.build,
            },
            {
                id: "invent",
                eyebrow: "YOUR TURN",
                title: "Describe the version you want",
                description:
                    "Replace the bracketed parts with your own choices and keep the example's central idea.",
                prompt: prompts.invent,
            },
        ],
    };
}

function createFallbackCoachPrompts(
    title: string,
    presentation: CodexPlayPresentation,
): ExampleCoachPrompts {
    const explain = presentation === "interactive"
        ? `Help me explore ${title}. Tell me exactly what to click or press, explain the main behavior in plain language, and make one small visible change so I can compare the result.`
        : presentation === "visual"
        ? `Help me explore ${title}. Describe what changes on screen, explain the main behavior in plain language, and make one small visible change so I can compare the result.`
        : `Help me explore ${title}. Read the game messages, explain the result in plain language, and add a simple on-screen view that makes the behavior easy to see.`;

    return {
        explain,
        remix:
            `Remix ${title} with a clear new theme, stronger visual feedback, and on-screen guidance. Preserve its central behavior and leave the result ready to try.`,
        build:
            `Build a tiny game around the main behavior in ${title}. Add one clear goal, simple controls, a short win or lose moment, and one playful surprise.`,
        invent:
            `Keep the central behavior from ${title}, but make it feel like [a theme or place I love] and add [one character, sound, power, or challenge] that fits it.`,
    };
}

function cleanText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function classifyPresentation(source: string): CodexPlayPresentation {
    const executableSource = stripCommentsAndStrings(source);
    const hasVisualOutput =
        /\b(?:add(?:[A-Z]\w*)?|draw[A-Z]\w*|loadBean|loadSprite|scene|setBackground)\s*\(/
            .test(executableSource)
        || /\bkaplay\s*\(\s*{[\s\S]{0,500}\bbackground\s*:/.test(
            executableSource,
        );
    if (!hasVisualOutput) return "output";

    const hasInteraction =
        /\b(?:onKey|onMouse|onClick|onHover|onScroll|onTouch|onGamepad|onButton|onCharInput|onTextInput|textInput|isKey|isMouse|isButton|keyDown|mousePos)/
            .test(executableSource);
    return hasInteraction ? "interactive" : "visual";
}

function stripCommentsAndStrings(source: string): string {
    let result = "";
    let state: "code" | "line" | "block" | "string" = "code";
    let quote = "";

    for (let index = 0; index < source.length; index++) {
        const char = source[index]!;
        const next = source[index + 1];

        if (state === "line") {
            if (char === "\n") {
                result += "\n";
                state = "code";
            } else {
                result += " ";
            }
            continue;
        }

        if (state === "block") {
            if (char === "*" && next === "/") {
                result += "  ";
                index++;
                state = "code";
            } else {
                result += char === "\n" ? "\n" : " ";
            }
            continue;
        }

        if (state === "string") {
            if (char === "\\") {
                result += "  ";
                index++;
            } else if (char === quote) {
                result += " ";
                state = "code";
            } else {
                result += char === "\n" ? "\n" : " ";
            }
            continue;
        }

        if (char === "/" && next === "/") {
            result += "  ";
            index++;
            state = "line";
        } else if (char === "/" && next === "*") {
            result += "  ";
            index++;
            state = "block";
        } else if (char === "\"" || char === "'" || char === "`") {
            result += " ";
            quote = char;
            state = "string";
        } else {
            result += char;
        }
    }

    return result;
}

function createPlayStep(
    title: string,
    presentation: CodexPlayPresentation,
): CodexPlayStep {
    if (presentation === "output") {
        return {
            id: "play",
            eyebrow: "START HERE",
            title: `Meet ${title}`,
            description:
                "This starting point works behind the scenes, so the game area may be blank. Go to the next idea and let Codex explain the result in plain language.",
            calloutTitle: "A blank game can be expected",
            calloutDescription:
                "Some starting points show their result as live output instead of graphics.",
        };
    }

    if (presentation === "visual") {
        return {
            id: "play",
            eyebrow: "START HERE",
            title: `Watch ${title}`,
            description:
                "This starting point shows one focused behavior on screen. Watch what happens, then ask Codex to explain or remix it.",
            calloutTitle: "Watch the game area",
            calloutDescription:
                "It may move or draw on its own without needing any controls.",
        };
    }

    return {
        id: "play",
        eyebrow: "START HERE",
        title: `Try ${title}`,
        description:
            "This starting point shows one focused behavior you can build into a game. Click it and try the keyboard or mouse.",
        calloutTitle: "Play with the starting point",
        calloutDescription:
            "If the controls are not obvious, the next idea asks Codex for help.",
    };
}
