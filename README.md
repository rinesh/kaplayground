# 🧰 KAPLAYGROUND — Web Editor for KAPLAY Games

<div align="center">
  <img src="./kaplayground.png">
</div>

---

**KAPLAYGROUND** lets anyone play a small game, ask Codex to change it, and try the new version immediately. You do not need to know a game engine or understand the code to start remixing.

## Play, change, repeat

Open KAPLAYGROUND in Codex Browser and start with **Bean's Snack Dash**. Move the bean with the arrow keys or WASD, collect the apples, then use the small Codex coach below the game.

The coach shows one playful idea at a time. Copy the idea into Codex, keep the game open, and watch Codex update and run it. Play the result, move to the next idea, or write your own request in ordinary language.

The full code editor stays beside the game for anyone who wants it, while technical activity is tucked under advanced details.

## 🚀 Features

- 🤖 **Play-first Codex coach**\
  Start inside a real mini-game and remix it through one friendly idea at a time.

- 🎯 **Multi-file Editing**\
  Work on full projects with **multiple files** or quickly prototype with a **single script**.

- 📂 **Project Browser**\
  Open and load KAPLAY projects directly from your local machine.

- 🍺 **Asset Brew**\
  Quickly import a curated set of default assets to kickstart your projects or examples.

- 🌲 **File Tree Navigation**\
  Browse your project structure with an intuitive file tree sidebar.

- 🛠️ **Code Editor**\
  Use a modern, powerful code editor based in VS Code, with features like auto-completion, syntax highlighting and special KAPLAY snippets and autocompletion.

- 🤖 **Browser agent tools**\
  Let a compatible agent inspect, update, run, check, and save the game directly in the open page.

## WebMCP

KAPLAYGROUND registers eight focused tools through the browser's WebMCP API. A compatible browser agent can work with the page directly without a separate MCP server, plugin, or skill installation.

The normal flow is intentionally small:

```text
inspect the game → read the needed files → update the game → run and check it
```

The page exposes one revision value for the open game. It changes whenever the active project or its contents change. Updates must include the revision they were based on, preventing the agent from overwriting a newer user edit.

`kaplayground_inspect_game` pages file metadata in groups of at most 100, and `kaplayground_read_files` reads at most ten exact paths within a 512 KiB aggregate response budget. This keeps discovery and source responses bounded without splitting the normal workflow into more tools.

`kaplayground_update_game` accepts several related file changes and applies them together. Every path and size is validated before the project is changed, so an invalid multi-file update changes nothing. It may focus one requested file for the user after committing, while editor-model synchronization errors are reported separately from the already-committed project update. Running remains a separate step, making it clear whether an edit failed or the updated game failed to start.

`kaplayground_run_game` normally builds and starts the requested revision, then checks editor diagnostics, run-specific console errors, and a bounded snapshot of the running scene. Its `check-current` mode performs the same checks after the user has played without restarting the game. It reports `passed`, `failed`, or `incomplete`; playing the controls and judging visual quality remain browser-level checks rather than hidden claims made by the page.

The remaining tools page through reusable assets and examples, save the game, and open a selected example. File updates and example replacements are serialized, and replacements recheck their revision at the commit point. Replacing unsaved work requires a confirmation clicked in the page—the tool's Boolean argument can request that prompt but cannot approve it. Source file contents are hidden from the visible activity history; the panel retains only useful details such as paths, counts, timing, and errors.

The Codex coach deliberately uses ordinary creative requests. Its copied prompts do not mention WebMCP, tool names, revision values, or browser-routing syntax.

Run the verification suite with:

```sh
npm run verify:webmcp
```

The app and preview sandbox use a versioned message protocol and must be released together. Deploy `sandbox/` with `npm run sandbox:deploy`, then set `VITE_SANDBOX_URL` to that deployment when building the app. An older sandbox is rejected before project code is sent because it cannot acknowledge runs, pause state, or inspection requests.

## Hosting

This fork is deployed through OpenAI Sites. The Sites Vite plugin copies `.openai/hosting.json` into the production artifact, while the Cloudflare Vite plugin and `worker/index.ts` serve the generated assets with a single-page-app fallback. The Sites plugin requires Vite 8, so the Vite, React plugin, and static-copy upgrades are part of the hosting configuration rather than the WebMCP feature itself.

If the OpenAI Sites deployment is retired, remove the Sites and Cloudflare plugins, the worker and hosting metadata together, then restore the upstream Vite dependencies and configuration.

The former private `rinesh/kaplay-connect` repository contained an earlier stdio bridge. Browser-native KAPLAYGROUND integration now belongs here; the legacy server is retained only as migration history.

## 📚 Resources

- [Roadmap](https://github.com/orgs/kaplayjs/projects/14/views/1) -
  See what features are planned for the future.
- [KAPLAYGROUND Wiki](https://github.com/kaplayjs/kaplayground/wiki) -
  Explore the wiki for in-depth guides, tutorials, and documentation.
