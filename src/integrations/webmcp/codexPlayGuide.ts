import { CODEX_PLAY_STEPS, type CodexPlayStep } from "./agentGuide.ts";

const BROWSER_PROMPT_PREFIX =
    "Use @Browser to work with the KAPLAYGROUND game already open.";

export type CodexPlayPresentation = "interactive" | "visual" | "output";

export type CodexPlaySubject = {
    key: string;
    title: string;
    source?: string;
    isStarter?: boolean;
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
                    "You do not need to understand the code. Ask Codex for a quick tour of what is already on screen.",
                prompt:
                    `${BROWSER_PROMPT_PREFIX} The open starting point is “${title}”. Inspect the game, its source, and any live output. Tell me in plain language what it does and what it could become in a game. Keep it short, do not teach me code, and leave the game running.`,
            },
            {
                id: "remix",
                eyebrow: "FIRST REMIX",
                title: "Give it your own look",
                description:
                    "Choose the feeling and let Codex handle the implementation while you keep the part that makes this example useful.",
                prompt:
                    `${BROWSER_PROMPT_PREFIX} Remix “${title}”. First inspect what makes this starting point distinct, then keep that behavior working while you add a playful theme, clear on-screen instructions, and satisfying feedback. Run it so I can try it, then fix anything that breaks.`,
            },
            {
                id: "build",
                eyebrow: "BUILD A GAME",
                title: "Turn this idea into a tiny game",
                description:
                    "The example is your building block. Codex can add the goal, controls, and playful details around it.",
                prompt:
                    `${BROWSER_PROMPT_PREFIX} Turn “${title}” into a tiny complete game. First inspect the behavior it demonstrates, then build a simple goal, easy controls, a win or lose moment, and one fun surprise around that behavior. Run it, try it, and fix anything that breaks so I can play immediately.`,
            },
            {
                id: "invent",
                eyebrow: "YOUR TURN",
                title: "Describe the version you want",
                description:
                    "Name a theme and one fun addition. You can stay focused on the result and let Codex work out the code.",
                prompt:
                    `${BROWSER_PROMPT_PREFIX} Use “${title}” as the starting point. Make it feel like [a theme or place I love], add [a character, power, sound, or challenge], keep its original main behavior working, and run it so I can try the result. Fix anything that breaks.`,
            },
        ],
    };
}

function cleanText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function classifyPresentation(source: string): CodexPlayPresentation {
    const executableSource = stripCommentsAndStrings(source);
    const hasVisualOutput =
        /\b(?:add(?:[A-Z]\w*)?|draw[A-Z]\w*|loadBean|loadSprite|scene|setBackground)\s*\(/
            .test(
                executableSource,
            )
        || /\bkaplay\s*\(\s*{[\s\S]{0,500}\bbackground\s*:/.test(
            executableSource,
        );
    if (!hasVisualOutput) return "output";

    const hasInteraction =
        /\b(?:onKey|onMouse|onClick|onHover|onScroll|onTouch|onGamepad|onButton|onCharInput|onTextInput|textInput|isKey|isMouse|isButton|keyDown|mousePos)/
            .test(
                executableSource,
            );
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
