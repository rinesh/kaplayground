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

This fork registers twelve `kaplayground_*` tools through the browser's WebMCP API. File replacement and removal use the revision returned by `kaplayground_read_file`, so an agent cannot silently overwrite or delete a newer editor change.

The repository is also the canonical home of the reusable `kaplay-webmcp`
workspace package under [`packages/kaplay-webmcp`](packages/kaplay-webmcp).
That package exposes a running KAPLAY context to browser agents. The editor's
Zustand, Monaco, preview, diagnostics, console, and activity integrations stay
in `src/integrations/webmcp` because they depend on KAPLAYGROUND internals.

Run the complete WebMCP verification suite with:

```sh
npm run verify:webmcp
```

The former private `rinesh/kaplay-connect` repository contained an earlier
stdio bridge and the original standalone package prototype. Browser-native
work now belongs here; the legacy server is retained only as migration history.

## 📚 Resources

- [Roadmap](https://github.com/orgs/kaplayjs/projects/14/views/1) -
  See what features are planned for the future.
- [KAPLAYGROUND Wiki](https://github.com/kaplayjs/kaplayground/wiki) -
  Explore the wiki for in-depth guides, tutorials, and documentation.
