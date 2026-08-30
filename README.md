# 🧰 KAPLAYGROUND — Web Editor for KAPLAY Games

<div align="center">
  <img src="./kaplayground.png">
</div>

---

**KAPLAYGROUND** is a powerful, web-based editor designed specifically for creating, editing, and sharing KAPLAY game projects — all from your browser.

## 🚀 Features

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

This fork registers fifteen `kaplayground_*` tools through the browser's WebMCP
API after IndexedDB, esbuild, and the active project are ready. File mutations
require the opaque project revision and, where applicable, the content revision
returned by the read tools, so an agent cannot write through a project switch or
silently overwrite a newer editor change.

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
