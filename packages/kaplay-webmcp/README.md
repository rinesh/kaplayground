# KAPLAY WebMCP

`kaplay-webmcp` exposes a running [KAPLAY](https://github.com/kaplayjs/kaplay) game as structured browser-agent tools through WebMCP. It is a reusable library package inside the KAPLAYGROUND repository; the editor-specific KAPLAYGROUND bridge stays in the application because it owns project files, Monaco state, preview controls, diagnostics, and console capture.

The package is private while its publication name and release process are decided.

## Use it in a game

```ts
import kaplay from "kaplay";
import { createKaplayWebMCP } from "kaplay-webmcp";

const k = kaplay({ global: false });
const bridge = createKaplayWebMCP(k, {
    tools: [{
        name: "read_score",
        description: "Read the player's current score.",
        annotations: { readOnlyHint: true },
        execute: () => ({ score: 0 }),
    }],
});

if (bridge.supported) await bridge.ready;
```

By default, the bridge registers four tools under the `kaplay_` prefix:

- `kaplay_get_game_state` reads the scene, clock, viewport, camera, pause state, and object count.
- `kaplay_list_objects` returns bounded, shallow object snapshots with optional tag filtering and pagination.
- `kaplay_inspect_object` returns one shallow object snapshot by KAPLAY object ID.
- `kaplay_set_paused` pauses or resumes the local game.

Call `bridge.destroy()` when the page or game is torn down. If the browser does not provide `document.modelContext`, the bridge reports `supported === false` and leaves the game running normally.

The default export is an idiomatic KAPLAY plugin:

```ts
import kaplay from "kaplay";
import webmcp from "kaplay-webmcp";

const k = kaplay({
    global: false,
    plugins: [webmcp({ builtins: false })],
});

await k.webmcp.ready;
```

## Run the example

From this package directory:

```sh
npm install
npm run example
```

The page under `examples/running-game` demonstrates the built-in inspection tools and a game-specific `kaplay_move_player` tool. The game still accepts keyboard input when WebMCP is unavailable.

## Verify

```sh
npm run check
npm run check:consumer
npm test
npm run build:example
```

`check:consumer` builds the declaration files and then compiles a fixture as an external consumer, which catches public types that accidentally depend on the package's internal compiler configuration.

The generated `dist` directory stays ignored. npm runs the package's `prepare` build during a fresh workspace install and before packing, so consumers never depend on committed build artifacts.

## Provenance

The initial running-game implementation, unit tests, and public-type fixtures were migrated on 2026-08-30 from the standalone local `KaplayWebMCP` prototype at commit `f57aa9a2cd1d247367de09c89d007c9a752c24b0` (authored 2026-08-27). See [NOTICE.md](./NOTICE.md) for the migration boundary. The prototype's older KAPLAYGROUND-specific bridge and editor demo were intentionally excluded because the application contains the newer canonical implementation.
