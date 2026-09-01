export type CodexPlayStep = {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    prompt?: string;
    calloutTitle?: string;
    calloutDescription?: string;
};

const WORKFLOW_BOOTSTRAP =
    "First call kaplayground_start_session and follow the live workflow it returns.";

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
            `Use @Browser to work with the KAPLAYGROUND game already open. ${WORKFLOW_BOOTSTRAP} Turn it into a candy-cloud world. Rename it to Sweet Bean Dreams, make the bean bubble-gum pink, and give the background a soft sunset color. Run the game so I can play the result, and fix anything that breaks.`,
    },
    {
        id: "surprise",
        eyebrow: "ADD A SURPRISE",
        title: "Make collecting feel magical",
        description:
            "Now ask Codex for one playful reaction. You can keep this idea or change the wording.",
        prompt:
            `Use @Browser to work with the KAPLAYGROUND game already open. ${WORKFLOW_BOOTSTRAP} When the bean collects an apple, add a cheerful burst of tiny colorful dots and make the bean grow for a moment. Keep the controls and score working, then run the game so I can try it. Fix anything that breaks.`,
    },
    {
        id: "challenge",
        eyebrow: "LEVEL IT UP",
        title: "Add a silly challenge",
        description:
            "A tiny rule turns the toy into your game. Codex can build the details while you decide what sounds fun.",
        prompt:
            `Use @Browser to work with the KAPLAYGROUND game already open. ${WORKFLOW_BOOTSTRAP} Add one sleepy purple cloud that slowly chases the bean. Touching it should scatter the apples and show a funny message, but the game should continue. Run it and make sure it is still fun to play.`,
    },
    {
        id: "invent",
        eyebrow: "YOUR TURN",
        title: "Ask for your own twist",
        description:
            "Describe anything you want to see, even if you do not know how games are made. Start with the idea below and replace the bracketed words.",
        prompt:
            `Use @Browser to work with the KAPLAYGROUND game already open. ${WORKFLOW_BOOTSTRAP} Make this game feel like [a place or theme I love]. Add [a character, sound, power, or surprise], keep it easy to play, and run it so I can try the new version. Fix anything that breaks.`,
    },
] as const;
