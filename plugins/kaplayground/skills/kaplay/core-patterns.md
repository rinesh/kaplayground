# KAPLAY v3001 Core Patterns

These patterns use KAPLAY `3001.0.19` as a conservative stable baseline. For live editor work, read the active selection from `kaplayground_get_project` before choosing version-sensitive APIs. Treat `master` as a moving target and inspect KAPLAY's runtime `VERSION` value after initialization when exact version behavior matters. KAPLAYGROUND examples commonly expose the API globally, so these examples call `kaplay()`, `add()`, `scene()`, and other functions without importing the `kaplay` package; preserve an existing scoped `k.*` style when the project uses one. Refer to KAPLAY's official [installation](https://kaplayjs.com/docs/guides/install/), [components](https://kaplayjs.com/docs/guides/components/), [events](https://kaplayjs.com/docs/guides/events/), and [scenes](https://kaplayjs.com/docs/guides/scenes/) guides when a change needs API details beyond these patterns.

## Kaplayground File Layout

The editor bundles a virtual filesystem with `/main.js` as its fixed entry point. Keep that file in JavaScript even if supporting files use TypeScript. A normal project groups files as:

```text
main.js
kaplay.js
assets.js
scenes/
objects/
utils/
```

Use relative imports between these editor files. WebMCP can create only direct JavaScript or TypeScript files in `scenes/`, `objects/`, and `utils/`, while root files can only be replaced when they already exist. Do not create `src/`, `core/`, `systems/`, `audio/`, or `ui/` directories because KAPLAYGROUND does not group them as part of its standard project layout. A one-file Example can keep all code in `main.js`.

## Object Composition

Build game objects from components and tags:

```js
const player = add([
    rect(40, 40, { radius: 8 }),
    pos(center()),
    anchor("center"),
    area(),
    color(90, 210, 255),
    { speed: 320 },
    "player",
]);
```

Components provide behavior. `pos()` provides movement and position, `area()` provides collision events, `body()` adds physics, `fixed()` keeps HUD elements independent of the camera, and `sprite()` draws a loaded asset. Tags such as `"player"` or `"coin"` let handlers target groups of objects.

Both objects in a collision need an area component. In v3001, `area()` participates in collision detection without a body. Starting with [KAPLAY v4000 alpha 26](https://kaplayjs.com/blog/release-v4000-alpha-26/), a body-less area must be a sensor, while objects with `body()` remain eligible automatically. Use `body()` only for gravity, solidity, or physical resolution.

For a project pinned to exact v4000, use `area({ isSensor: true })` on overlap-only objects. For `master` or code intended to survive either major, feature-detect the returned component without passing a v4000-only option to v3001:

```js
function overlapArea() {
    const collider = area();
    if ("isSensor" in collider) collider.isSensor = true;
    return collider;
}
```

With a scoped context, use `k.area()` in the same helper. This keeps v3001 behavior unchanged and enables the v4000 collision system when that property exists.

## Scenes and Restart

Put gameplay in a named scene and restart by entering it again:

```js
scene("game", () => {
    // Create all scene-owned objects and handlers here.
    onKeyPress("r", () => go("game"));
});

go("game");
```

`go()` destroys ordinary scene objects, which makes it the clean reset boundary. Avoid creating restart-sensitive objects and handlers before the scene definition. Use `stay()` only for an object that deliberately survives scene changes.

## Input

- Use `onKeyDown` for continuous movement.
- Use `onKeyPress` for jump, fire, pause, and restart.
- Use object-scoped handlers when their lifetime should match an object.
- For mobile games, add explicit touch or pointer behavior and show the control affordance on screen.

Movement APIs use speed over time, so `player.move(x, y)` or `player.move(direction.scale(speed))` should receive units per second. Do not multiply KAPLAY's `move()` values by frame rate again.

## Assets and Audio

Load assets before using their registered names:

```js
loadSprite("bean", "/sprites/bean.png");
loadSound("score", "/sounds/score.mp3");
```

Only use paths already present in the current project or exact loader code returned by Kaplayground's Asset Brew search. For a new prototype without a suitable catalog match, primitives are safer than guessing asset paths. Call `play("score")` from a meaningful interaction; browsers may defer audio until the player has interacted with the page.

## Single-File Starter

Use this as a shape for a one-file Example or an otherwise empty open project, not as a mandatory game design. Adapt the metadata, colors, mechanic, and controls to the request. When the editor already contains the multi-file project seed, preserve it and distribute the same responsibilities across its existing files.

```js
/**
 * @file Target Dash
 * @description Collect targets before time runs out.
 * @difficulty 0
 * @tags game, input
 * @minver 3001.0
 * @category games
 */

kaplay({
    background: [18, 22, 34],
});

function overlapArea() {
    const collider = area();
    if ("isSensor" in collider) collider.isSensor = true;
    return collider;
}

const CONFIG = {
    playerSize: 42,
    playerSpeed: 340,
    targetRadius: 16,
    edgePadding: 32,
    roundSeconds: 30,
};

const gameState = {
    mode: "playing",
    score: 0,
    timeLeft: CONFIG.roundSeconds,
};

let player = null;

scene("game", () => {
    gameState.mode = "playing";
    gameState.score = 0;
    gameState.timeLeft = CONFIG.roundSeconds;
    console.log(`[target-dash] ready version=${VERSION}`);

    const scoreLabel = add([
        text("Score: 0", { size: 24 }),
        pos(16, 16),
        fixed(),
    ]);

    const timeLabel = add([
        text(`Time: ${CONFIG.roundSeconds}`, { size: 24 }),
        pos(16, 48),
        fixed(),
    ]);

    add([
        text("Move: arrows / WASD • R: restart", { size: 18 }),
        pos(16, 82),
        fixed(),
        opacity(0.8),
    ]);

    player = add([
        rect(CONFIG.playerSize, CONFIG.playerSize, { radius: 8 }),
        pos(center()),
        anchor("center"),
        overlapArea(),
        color(90, 210, 255),
        { speed: CONFIG.playerSpeed },
        "player",
    ]);

    function spawnTarget() {
        add([
            circle(CONFIG.targetRadius),
            pos(
                rand(CONFIG.edgePadding, width() - CONFIG.edgePadding),
                rand(CONFIG.edgePadding, height() - CONFIG.edgePadding),
            ),
            anchor("center"),
            overlapArea(),
            color(255, 205, 80),
            "target",
        ]);
    }

    spawnTarget();

    const move = (direction) => {
        if (gameState.mode === "playing") {
            player.move(direction.scale(player.speed));
        }
    };
    onKeyDown("left", () => move(vec2(-1, 0)));
    onKeyDown("a", () => move(vec2(-1, 0)));
    onKeyDown("right", () => move(vec2(1, 0)));
    onKeyDown("d", () => move(vec2(1, 0)));
    onKeyDown("up", () => move(vec2(0, -1)));
    onKeyDown("w", () => move(vec2(0, -1)));
    onKeyDown("down", () => move(vec2(0, 1)));
    onKeyDown("s", () => move(vec2(0, 1)));

    player.onUpdate(() => {
        const halfSize = CONFIG.playerSize / 2;
        player.pos.x = Math.max(halfSize, Math.min(width() - halfSize, player.pos.x));
        player.pos.y = Math.max(halfSize, Math.min(height() - halfSize, player.pos.y));
    });

    player.onCollide("target", (target) => {
        if (gameState.mode !== "playing") return;
        destroy(target);
        gameState.score += 1;
        scoreLabel.text = `Score: ${gameState.score}`;
        console.log(`[target-dash] score=${gameState.score}`);
        spawnTarget();
    });

    loop(1, () => {
        if (gameState.mode !== "playing") return;
        gameState.timeLeft = Math.max(0, gameState.timeLeft - 1);
        timeLabel.text = `Time: ${gameState.timeLeft}`;
        if (gameState.timeLeft === 0) {
            gameState.mode = "game_over";
            add([
                text("TIME! Press R to restart", { size: 36 }),
                pos(center()),
                anchor("center"),
                fixed(),
            ]);
            console.log(`[target-dash] game_over score=${gameState.score}`);
        }
    });

    onKeyPress("r", () => {
        console.log("[target-dash] restart");
        go("game");
    });
});

window.__KAPLAY_STATE__ = gameState;

window.render_game_to_text = () => JSON.stringify({
    coordinates: "origin top-left; +x right; +y down; units are pixels",
    runtimeVersion: typeof VERSION === "string" ? VERSION : "unknown",
    mode: gameState.mode,
    score: gameState.score,
    timeLeft: gameState.timeLeft,
    player: player
        ? { x: Math.round(player.pos.x), y: Math.round(player.pos.y) }
        : null,
    targets: get("target").map((target) => ({
        x: Math.round(target.pos.x),
        y: Math.round(target.pos.y),
    })),
});

go("game");
```

## Review Checklist

- Gameplay begins without an unnecessary title screen.
- Every collision participant has an area component; body-less overlap participants use the version-correct `overlapArea()` behavior.
- Movement and timers are frame-rate independent.
- Restart uses `go("game")` and produces the same initial state repeatedly.
- The HUD uses `fixed()` if the camera can move.
- Asset names are loaded before use and paths are verified.
- `render_game_to_text()` reports only current, visible state and uses the same values the game renders.
- Logs cover discrete state transitions without emitting every frame.
