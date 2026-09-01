export type CodexPlayStep = {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    prompt?: string;
    calloutTitle?: string;
    calloutDescription?: string;
};

export const CODEX_PLAY_STEPS: readonly CodexPlayStep[] = [
    {
        id: "play",
        eyebrow: "START HERE",
        title: "Play the tiny game",
        description:
            "Click the game, move the bean with the arrow keys or WASD, and collect a few apples.",
        calloutTitle: "Chase the apples",
        calloutDescription: "There is no wrong way to play.",
    },
    {
        id: "restyle",
        eyebrow: "FIRST REMIX",
        title: "Give it a new look",
        description:
            "Copy this idea into Codex. Keep the game open so you can watch it change.",
        prompt:
            "Give this game a candy-cloud theme. Rename it Sweet Bean Dreams, make the bean bubble-gum pink, and use a soft sunset background. Keep the controls and score working, then let me try the updated game.",
    },
    {
        id: "surprise",
        eyebrow: "ADD A SURPRISE",
        title: "Make collecting feel magical",
        description:
            "Now ask Codex for one playful reaction. You can keep this idea or change the wording.",
        prompt:
            "Make collecting an apple feel magical. Add a cheerful burst of colorful dots and make the bean grow for a moment. Keep the controls and score working, then let me try it.",
    },
    {
        id: "challenge",
        eyebrow: "LEVEL IT UP",
        title: "Add a silly challenge",
        description:
            "A tiny rule turns the toy into your game. Codex can build the details while you decide what sounds fun.",
        prompt:
            "Add a sleepy purple cloud that slowly follows the bean. Touching it should scatter the apples and show a funny message, but the game should continue. Make sure it stays easy and fun to play.",
    },
    {
        id: "invent",
        eyebrow: "YOUR TURN",
        title: "Ask for your own twist",
        description:
            "Describe anything you want to see, even if you do not know how games are made. Start with the idea below and replace the bracketed words.",
        prompt:
            "Make this game feel like [a place or theme I love]. Add [a character, sound, power, or surprise], keep it easy to play, and let me try the result.",
    },
] as const;
