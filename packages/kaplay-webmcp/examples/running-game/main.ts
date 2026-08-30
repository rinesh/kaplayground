import kaplay from "kaplay";
import { createKaplayWebMCP } from "../../src/index";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const status = document.querySelector<HTMLElement>("#status");
if (!canvas || !status) throw new Error("The example page is incomplete.");

const k = kaplay({
    canvas,
    width: 640,
    height: 360,
    background: [16, 20, 17],
    global: false,
});

const player = k.add([
    k.rect(48, 48, { radius: 8 }),
    k.pos(k.center()),
    k.anchor("center"),
    k.color(182, 255, 117),
    "player",
]);

function movePlayer(x: number, y: number): { x: number; y: number } {
    player.pos.x = k.clamp(player.pos.x + x, 24, k.width() - 24);
    player.pos.y = k.clamp(player.pos.y + y, 24, k.height() - 24);
    return { x: player.pos.x, y: player.pos.y };
}

k.onKeyPress("left", () => movePlayer(-24, 0));
k.onKeyPress("right", () => movePlayer(24, 0));
k.onKeyPress("up", () => movePlayer(0, -24));
k.onKeyPress("down", () => movePlayer(0, 24));

const bridge = createKaplayWebMCP(k, {
    tools: [{
        name: "move_player",
        title: "Move the example player",
        description: "Move the square by a bounded horizontal and vertical offset.",
        inputSchema: {
            type: "object",
            properties: {
                x: { type: "number", minimum: -100, maximum: 100 },
                y: { type: "number", minimum: -100, maximum: 100 },
            },
            required: ["x", "y"],
            additionalProperties: false,
        },
        execute: (input) => {
            if (!isBoundedOffset(input.x) || !isBoundedOffset(input.y)) {
                throw new RangeError("x and y must be finite numbers between -100 and 100.");
            }
            return { player: movePlayer(input.x, input.y) };
        },
    }],
    onError: (error) => console.error("WebMCP registration failed", error),
});

if (!bridge.supported) {
    status.textContent = "WebMCP is unavailable; keyboard controls still work.";
}
else {
    void bridge.ready.then(() => {
        status.textContent = `${bridge.toolNames.length} browser-agent tools are ready.`;
    }).catch(() => {
        status.textContent = "WebMCP registration failed.";
    });
}

window.addEventListener("pagehide", () => bridge.destroy(), { once: true });

function isBoundedOffset(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value)
        && value >= -100 && value <= 100;
}
