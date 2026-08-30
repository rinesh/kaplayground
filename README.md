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

- 🤖 **WebMCP Agent Tools**\
  Let compatible browser agents inspect the current project, read and safely replace files, select files, run or stop the preview, and inspect diagnostics and console output.

## WebMCP

This fork registers sixteen `kaplayground_*` tools through the browser's WebMCP
API after IndexedDB, esbuild, and the active project are ready. File mutations
require the opaque project revision and, where applicable, the content revision
returned by the read tools, so an agent cannot write through a project switch or
silently overwrite a newer editor change.

`kaplayground_get_agent_guide` gives the agent a private inspect → edit → run →
verify workflow, so the user-facing coach can stay simple while the tool contract
remains safe and explicit.

KAPLAYGROUND-specific tools can persist a transient project, list bounded asset
metadata, and inspect a bounded shallow snapshot of the running game. Preview
runs resolve only after the sandbox acknowledges module execution, pause changes
are explicit and acknowledged, and console reads are scoped to a preview run.
Diagnostic responses include `available`, so a missing Monaco instance is not
reported as a clean project. Console responses likewise include `available`,
plus `truncated` for per-call result limits and a bounded `droppedCount` for the
500-entry capture buffer. WebMCP capture stays active when the visible console
preference is disabled; that preference only controls the console panel.

The WebMCP implementation is intentionally scoped to KAPLAYGROUND. Its Zustand,
Monaco, preview, diagnostics, console, and activity integrations live in
`src/integrations/webmcp` and `src/components/WebMCP` because they depend on the
editor's application state.

Run the complete WebMCP verification suite with:

```sh
npm run verify:webmcp
```

The app and preview sandbox use a versioned message protocol and must be
released together. Deploy `sandbox/` with `npm run sandbox:deploy`, then set
`VITE_SANDBOX_URL` to that deployment when building the app; an older sandbox
is rejected before project code is sent, because it cannot acknowledge runs,
pause state, or inspection requests.

## Hosting

This fork is deployed through OpenAI Sites. The Sites Vite plugin copies
`.openai/hosting.json` into the production artifact, while the Cloudflare Vite
plugin and `worker/index.ts` serve the generated assets with a single-page-app
fallback. The Sites plugin requires Vite 8, so the Vite, React plugin, and
static-copy upgrades are part of the hosting configuration rather than the
WebMCP feature itself.

If the OpenAI Sites deployment is retired, remove the Sites and Cloudflare
plugins, the worker and hosting metadata together, then restore the upstream
Vite dependencies and configuration.

The former private `rinesh/kaplay-connect` repository contained an earlier
stdio bridge. Browser-native KAPLAYGROUND integration now belongs here; the
legacy server is retained only as migration history.

## 📚 Resources

- [Roadmap](https://github.com/orgs/kaplayjs/projects/14/views/1) -
  See what features are planned for the future.
- [KAPLAYGROUND Wiki](https://github.com/kaplayjs/kaplayground/wiki) -
  Explore the wiki for in-depth guides, tutorials, and documentation.
