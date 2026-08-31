import {
    difficulties as difficultiesData,
    tags,
} from "../../kaplay/examples/examples.json";
import examplesList from "./exampleList.json";

export type ExamplesDataRecord = Record<string, {
    displayName?: string;
    description?: string;
    order?: number;
}>;

export type Tag = {
    name: string;
} & ExamplesDataRecord[string];

export type Example = {
    key: string;
    type: string;
    name: string;
    formattedName: string;
    sortName: string;
    category: string;
    group: string;
    description: string | null;
    code: string;
    version: string;
    minVersion: string;
    tags: Tag[];
    difficulty?: {
        level: number;
        name: string;
    };
    createdAt: string;
    updatedAt: string;
    locked?: boolean;
};

export const WEBMCP_EXAMPLE_NAME = "webmcpAgent";

const webMCPExample = {
    id: -1,
    name: WEBMCP_EXAMPLE_NAME,
    formattedName: "Play & Remix with Codex",
    sortName: "0-basics-basics-00-webmcpAgent",
    category: "basics",
    group: "basics",
    description:
        "Race through a moonlit orchard, then ask Codex to transform its colors, rules, or character while you play.",
    code: `// Want a different game? Ask Codex to change these values.
const gameSettings = {
    title: "Moonlit Apple Run",
    backgroundColor: "#0d1630",
    beanColor: "#8ff1d6",
    playerSpeed: 260,
    goal: 5,
    applesAtOnce: 3,
};

kaplay({
    background: gameSettings.backgroundColor,
});

loadBean();
loadSprite("apple", "/sprites/apple.png");
loadSound("pop", "/sounds/score.mp3");

const playArea = () => {
    const top = Math.min(106, height() * 0.32);
    return {
        left: Math.min(48, width() * 0.2),
        right: Math.max(Math.min(48, width() * 0.2), width() - 48),
        top,
        bottom: Math.max(top, height() - 48),
    };
};

const decorations = [
    [0.10, 0.27, 10, rgb(255, 201, 71)],
    [0.22, 0.76, 7, rgb(147, 197, 253)],
    [0.43, 0.34, 6, rgb(196, 181, 253)],
    [0.69, 0.73, 9, rgb(253, 164, 175)],
    [0.86, 0.30, 7, rgb(134, 239, 172)],
    [0.93, 0.62, 5, rgb(255, 201, 71)],
];

add([
    z(-100),
    {
        draw() {
            drawRect({
                pos: vec2(12, 12),
                width: Math.max(0, width() - 24),
                height: Math.max(0, height() - 24),
                radius: 24,
                color: rgb(20, 34, 65),
                outline: { width: 2, color: rgb(57, 86, 125) },
            });
            drawRect({
                pos: vec2(13, 13),
                width: Math.max(0, width() - 26),
                height: Math.min(78, Math.max(0, height() - 26)),
                radius: 23,
                color: rgb(28, 48, 86),
            });
            decorations.forEach(([x, y, radius, dotColor]) => {
                drawCircle({
                    pos: vec2(width() * x, height() * y),
                    radius,
                    color: dotColor,
                    opacity: 0.32,
                });
            });
        },
    },
]);

const title = add([
    text(gameSettings.title, {
        size: Math.max(18, Math.min(28, width() / 20)),
        width: Math.max(140, width() - 48),
    }),
    pos(28, 22),
    color("#f8e7a1"),
]);

const scoreLabel = add([
    text("", { size: 15 }),
    pos(29, 58),
    color("#8ee3ef"),
]);

const controls = add([
    text("Move: arrows / WASD  •  or click anywhere", {
        size: 13,
        align: "center",
        width: Math.max(160, width() - 40),
    }),
    anchor("bot"),
    pos(width() / 2, height() - 20),
    color("#b7c9df"),
]);

let score = 0;
let won = false;
let clickTarget = null;
let winMessage = null;

function randomPlayPosition() {
    const bounds = playArea();
    return vec2(
        rand(bounds.left, bounds.right),
        rand(bounds.top, bounds.bottom),
    );
}

const player = add([
    sprite("bean"),
    pos(randomPlayPosition()),
    anchor("center"),
    scale(clamp(Math.min(width(), height()) / 360, 0.8, 1.35)),
    color(gameSettings.beanColor),
    area({ scale: 0.75, isSensor: true }),
    rotate(0),
    z(10),
    "player",
]);

function addApple() {
    const apple = add([
        sprite("apple"),
        pos(randomPlayPosition()),
        anchor("center"),
        scale(0.9),
        area({ scale: 0.7, isSensor: true }),
        rotate(0),
        z(5),
        "snack",
        { wiggle: rand(0, Math.PI * 2) },
    ]);

    if (apple.pos.dist(player.pos) < 90) {
        apple.pos = randomPlayPosition();
    }
}

function fillApples() {
    const remaining = Math.max(0, gameSettings.goal - score);
    const wanted = Math.min(gameSettings.applesAtOnce, remaining);
    while (get("snack").length < wanted) addApple();
}

function updateScore() {
    scoreLabel.text = "Apples  " + score + " / " + gameSettings.goal;
}

function celebrate() {
    won = true;
    clickTarget = null;
    addKaboom(player.pos);
    winMessage = add([
        rect(Math.max(80, Math.min(360, width() - 48)), 92, { radius: 18 }),
        pos(center()),
        anchor("center"),
        color("#244b72"),
        outline(3, color("#8ee3ef")),
        z(50),
    ]);
    winMessage.add([
        text("You did it!\\nPress R to play again", {
            size: 20,
            align: "center",
            width: Math.max(60, Math.min(330, width() - 70)),
            lineSpacing: 8,
        }),
        anchor("center"),
        color("#ffffff"),
        z(51),
    ]);
}

player.onCollide("snack", (apple) => {
    if (won) return;
    destroy(apple);
    play("pop", { volume: 0.35 });
    score += 1;
    updateScore();
    addKaboom(player.pos);
    if (score >= gameSettings.goal) celebrate();
    else wait(0, fillApples);
});

onUpdate("snack", (apple) => {
    apple.angle = Math.sin(time() * 3 + apple.wiggle) * 9;
});

player.onUpdate(() => {
    const direction = vec2(
        (isKeyDown("right") || isKeyDown("d") ? 1 : 0)
            - (isKeyDown("left") || isKeyDown("a") ? 1 : 0),
        (isKeyDown("down") || isKeyDown("s") ? 1 : 0)
            - (isKeyDown("up") || isKeyDown("w") ? 1 : 0),
    );

    if (!won && direction.len() > 0) {
        clickTarget = null;
        player.move(direction.unit().scale(gameSettings.playerSpeed));
        player.angle = direction.x * 8;
    }
    else if (!won && clickTarget) {
        player.moveTo(clickTarget, gameSettings.playerSpeed);
        if (player.pos.dist(clickTarget) < 4) clickTarget = null;
    }
    else {
        player.angle = Math.sin(time() * 4) * 3;
    }

    const bounds = playArea();
    player.pos.x = clamp(player.pos.x, bounds.left, bounds.right);
    player.pos.y = clamp(player.pos.y, bounds.top, bounds.bottom);
    controls.pos = vec2(width() / 2, height() - 20);
});

onMousePress(() => {
    if (won) return;
    const bounds = playArea();
    clickTarget = vec2(
        clamp(mousePos().x, bounds.left, bounds.right),
        clamp(mousePos().y, bounds.top, bounds.bottom),
    );
});

onKeyPress("r", () => {
    if (!won) return;
    score = 0;
    won = false;
    destroy(winMessage);
    winMessage = null;
    player.pos = randomPlayPosition();
    updateScore();
    fillApples();
});

updateScore();
fillApples();`,
    difficulty: 0,
    version: "master",
    minVersion: "3001.0",
    tags: ["basics"],
    createdAt: "2026-08-27T00:00:00Z",
    updatedAt: "2026-08-27T00:00:00Z",
};

export const difficulties = [
    ...difficultiesData.map(({ displayName }, index: number) => ({
        level: index,
        name: displayName,
    })),
    {
        level: difficultiesData.length,
        name: "Unknown",
    },
];

export const difficultyByName = (name: string) =>
    difficulties.find(d => d.name === name);

export const demos = [webMCPExample, ...examplesList].map((example) => {
    const obj: Example = {
        ...example,
        tags: example.tags.map(tag => ({
            name: tag,
            ...(tags as ExamplesDataRecord)?.[tag],
        })),
        difficulty: difficulties[example.difficulty ?? difficulties.length - 1],
        key: example.name,
        type: "Example",
    };

    return obj;
});

export const getDemo = (key: string | null | undefined) =>
    key ? demos.find((demo) => demo.key === key) : undefined;

export const demoVersions = Object.fromEntries(
    [...new Set(demos.map(d => d.minVersion))].filter(Boolean)
        .sort((a, b) => parseFloat(b) - parseFloat(a))
        .map(version => {
            const v = parseFloat(version);
            const count = demos.filter(d => {
                const min = parseFloat(d.minVersion ?? "");
                return d.locked ? min === v : min <= v;
            }).length;
            return [version, count];
        }),
);
