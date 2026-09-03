# 🧰 KAPLAYGROUND — Web Editor for KAPLAY Games

<div align="center">
  <img src="./kaplayground.png">
</div>

---

**KAPLAYGROUND** lets anyone play a small game, ask Codex to change it, and try the new version immediately. You do not need to know a game engine or understand the code to start remixing.

## Play, change, repeat

Open KAPLAYGROUND in Codex Browser and start with **Moonlit Apple Run**. Click an apple or move the bean with the arrow keys or WASD, collect five apples, then use the small Codex coach below the game. Click or press R to replay after winning.

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

The page exposes a project revision and a separate executable content revision. Metadata-only changes such as renaming advance the project revision without invalidating an identical running game. Runs also expose a runtime fingerprint tied to the content, application commit, checked-out engine identity, module reference, and shared sandbox protocol.

`kaplayground_inspect_game` pages file metadata in groups of at most 100, and `kaplayground_read_files` reads at most ten exact paths within a 512 KiB aggregate response budget. This keeps discovery and source responses bounded without splitting the normal workflow into more tools.

`kaplayground_update_game` accepts several related file changes and applies them together. Every path and size is validated before the project is changed, so an invalid multi-file update changes nothing. It may focus one requested file for the user after committing, while editor-model synchronization errors are reported separately from the already-committed project update. Running remains a separate step, making it clear whether an edit failed or the updated game failed to start.

`kaplayground_run_game` normally builds and starts the requested executable content, then checks diagnostics, run-specific console errors, and a bounded scene snapshot. It can also execute a bounded sequence of sandbox-simulated key or pointer actions with named checkpoints that assert scenes, text, object counts, positions, movement, focus, and objective layout warnings. The result labels this input provenance explicitly. Its `check-current` mode preserves gameplay. Visual quality remains unjudged rather than being inferred from geometry.

The remaining tools page through reusable assets and examples, save the game, and open a selected example. Saves return a persistence receipt only after IndexedDB acknowledges the write and a canonical read-back hash matches the active project. File updates and example replacements are serialized, and replacements recheck their revision at the commit point. Replacing unsaved work still requires an in-page user confirmation. Source contents remain hidden from visible history; the panel stores allowlisted verification receipts instead.

The Codex coach deliberately uses ordinary creative requests. Every copied idea adds only “Use the open editor at https://promptmygame.com.” before the original creative prompt, including in local previews. Prompts do not include project links, query strings, WebMCP, tool names, revision values, or browser-routing syntax.

Run the verification suite with:

```sh
npm run verify:webmcp
```

For a complete starting-point and coach audit, run `npm run test:catalog`.
It opens every sample, records startup readiness and errors, and checks all four
copyable ideas for each sample. The regular browser suite also exercises
clipboard failures, modal focus, delayed copy responses, saved projects, and
desktop and portrait layouts.

For repeated matched comparisons, record pinned workflow runs and use `npm run benchmark:webmcp -- <runs.json> <summary.json>`. The benchmark reports distributions, acceptance coverage, retries, unsupported claims, interactions, and cached and uncached tokens separately; it is intentionally not a pull-request gate.

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
