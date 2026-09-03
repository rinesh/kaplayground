import { CODEX_PLAY_STEPS, type CodexPlayStep } from "./agentGuide.ts";
import type { ExampleCoachPrompts } from "./exampleCoachPrompts.ts";

export type CodexPlayPresentation = "interactive" | "visual" | "output";

export type CodexPlaySubject = {
    key: string;
    title: string;
    editorOrigin?: string;
    source?: string;
    isStarter?: boolean;
    prompts?: ExampleCoachPrompts;
    lesson?: string;
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
    const editorOrigin = subject.editorOrigin ?? "https://promptmygame.com";

    if (subject.isStarter) {
        return {
            key: subject.key,
            subjectTitle: title,
            presentation: "interactive",
            steps: CODEX_PLAY_STEPS.map((step) =>
                step.prompt
                    ? {
                        ...step,
                        prompt: promptForOpenEditor(step.prompt, editorOrigin),
                    }
                    : step
            ),
        };
    }

    const presentation = classifyPresentation(subject.source ?? "");
    const playStep = createPlayStep(title, presentation);
    if (subject.lesson) {
        playStep.eyebrow = "LEARN BY PLAYING";
        playStep.description = subject.lesson;
    }
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
                title: "Understand it, then change it",
                description: subject.lesson
                    ?? "Ask Codex about this sample's behavior, then use the next ideas to remix it or build on it.",
                prompt: promptForOpenEditor(prompts.explain, editorOrigin),
            },
            {
                id: "remix",
                eyebrow: "FIRST REMIX",
                title: "Give it your own look",
                description:
                    "Keep the useful behavior and give it a concrete new look, reaction, or personality.",
                prompt: promptForOpenEditor(prompts.remix, editorOrigin),
            },
            {
                id: "build",
                eyebrow: "BUILD A GAME",
                title: "Turn this idea into a tiny game",
                description:
                    "Use the starting point as the main mechanic for a short game with a clear finish.",
                prompt: promptForOpenEditor(prompts.build, editorOrigin),
            },
            {
                id: "invent",
                eyebrow: "YOUR TURN",
                title: "Describe the version you want",
                description:
                    "Replace the bracketed parts with your own choices and keep the starting point's central idea.",
                prompt: promptForOpenEditor(prompts.invent, editorOrigin),
            },
        ],
    };
}

function promptForOpenEditor(prompt: string, editorOrigin: string): string {
    return `Use the game editor already open at ${editorOrigin} in the in-app browser. Inspect its current game first. ${prompt} Keep any changes in that project and run its preview afterward. Don't create a separate local app; tell me if you can't access the editor.`;
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
        || /\bdebug\s*\.\s*log\s*\(|\bdebug\s*\.\s*inspect\s*=\s*true\b/
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
