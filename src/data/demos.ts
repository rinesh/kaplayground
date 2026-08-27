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
    formattedName: "WebMCP Agent Playground",
    sortName: "0-basics-basics-00-webmcpAgent",
    category: "basics",
    group: "basics",
    description:
        "A starter game designed for an AI agent to inspect, edit, run, and verify through WebMCP.",
    code: `// This example is a small, agent-friendly project for trying KAPLAYGROUND WebMCP.
// Ask your agent to read this file, change agentSettings, run the preview,
// and inspect diagnostics and console output.

kaplay({
    background: "#111827",
});

loadBean();

const agentSettings = {
    title: "WebMCP Agent Playground",
    beanColor: "#8b5cf6",
    speed: 180,
};

add([
    rect(width() - 64, height() - 64, { radius: 18 }),
    pos(32, 32),
    color("#1f2937"),
    outline(3, color("#8b5cf6")),
]);

add([
    text(agentSettings.title, { size: 34 }),
    pos(center().x, 70),
    anchor("top"),
]);

add([
    text([
        "WEBMCP READY",
        "Try: change the bean color and speed",
        "Then run the preview and check diagnostics + console",
    ].join("\\n"), { size: 19, align: "center", lineSpacing: 10 }),
    pos(center().x, 135),
    anchor("top"),
    color("#c4b5fd"),
]);

const bean = add([
    sprite("bean"),
    pos(96, height() - 120),
    anchor("center"),
    scale(2),
    rotate(0),
    color(agentSettings.beanColor),
]);

let direction = 1;
onUpdate(() => {
    bean.pos.x += direction * agentSettings.speed * dt();
    bean.angle += direction * 90 * dt();
    if (bean.pos.x >= width() - 96) direction = -1;
    if (bean.pos.x <= 96) direction = 1;
});

console.log("[webmcp-example] Ready", agentSettings);`,
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
