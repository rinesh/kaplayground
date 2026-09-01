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
  Let compatible browser agents inspect the current project, apply revision-safe atomic changes, run and verify an exact source snapshot, and inspect diagnostics and console output.

## WebMCP

This fork registers twenty granular `kaplayground_*` tools through the browser's
WebMCP API after IndexedDB, esbuild, and the active project are ready. It also
registers three optional high-level workflow tools. A compatible browser agent
can use the page directly without installing a skill, plugin, or separate MCP
server. The app-owned live guide, focused references, and workflow bootstrap are
the zero-install entry point and the authority for the current page contract.

`kaplayground_start_session` is the preferred first call for create, edit,
debug, run, and verification tasks. It reports the core Contract 1.1 and guide
version 5 alongside workflow Contract 1.0, the tools actually available, live
operation profiles, and three independent state tokens:

- `projectInstanceRevision` changes when the active project is replaced.
- `workspaceRevision` changes whenever the active project's contents change.
- `sourceRevision` identifies the complete build input, including sorted file
  revisions, the selected KAPLAY runtime, build mode, and asset metadata.

`kaplayground_apply_change_set` validates those workspace revisions and every
existing file revision before committing up to twenty related creates,
replacements, or removals in one project-store update. A stale or invalid
operation rejects the complete set, so a multi-file task cannot leave a partial
edit. The tool never runs the preview; granular mutation-level `runPreview`
remains backward-compatible but is deprecated for new agent workflows.

`kaplayground_verify_change` accepts an exact project, workspace, and optional
source revision. It builds and runs that snapshot, then returns a structured
`passed`, `failed`, or `incomplete` result containing run-scoped diagnostics,
console output, and bounded scene inspection. It also states that screenshots
and exercised gameplay still require the controlling browser, so a successful
page verification is not presented as proof of controls or visual quality.

`kaplayground_get_agent_guide` continues to advertise the granular core tool
surface and its capability groups. `kaplayground_get_reference` returns one of
six focused page-owned references only when it is relevant to the task. Existing
granular file mutations retain their opaque project-generation and file-content
revision guards, preserving compatibility with agents that have not adopted the
workflow layer.

KAPLAYGROUND-specific tools can persist a transient project, list bounded
project-asset metadata, search the curated Asset Brew catalog for exact loader
code, and inspect a bounded shallow snapshot of the running game. Preview runs
resolve only after the sandbox acknowledges module execution, pause changes are
explicit and acknowledged, and console reads are scoped to a preview run.
Diagnostic responses include `available`, so a missing Monaco instance is not
reported as a clean project. Console responses likewise include `available`,
plus `truncated` for per-call result limits and a bounded `droppedCount` for the
500-entry capture buffer. WebMCP capture stays active when the visible console
preference is disabled; that preference only controls the console panel.

The visible WebMCP activity trail stores bounded metadata rather than source
contents. File `content`, project source, and similar nested mutation fields are
redacted before the activity entry enters application state.

The WebMCP implementation is intentionally scoped to KAPLAYGROUND. Its Zustand,
Monaco, preview, diagnostics, console, activity, and workflow integrations live
in `src/integrations/webmcp` and `src/components/WebMCP` because they depend on
the editor's application state.

Run the WebMCP verification suite with:

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
