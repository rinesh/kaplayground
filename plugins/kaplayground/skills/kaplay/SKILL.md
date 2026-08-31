---
name: kaplay
description: Create, edit, debug, and verify KAPLAY games in a WebMCP-enabled KAPLAYGROUND browser page. Use when the user asks to build or change the open KAPLAYGROUND project, work on a KAPLAY game through WebMCP, or iterate on its live preview. Do not use for informational KAPLAY questions, changes to the KAPLAYGROUND WebMCP implementation itself, Phaser, Three.js, or unrelated browser-game work.
license: MIT
metadata:
  author: rinesh
  version: 1.5.1
  kaplayground-contract-minimum: "1.1"
  kaplayground-contract-tested-through: "1.x"
  tags: [game, 2d, kaplay, kaplayground, webmcp, browser-game]
---

# KAPLAY + KAPLAYGROUND WebMCP

Build and iterate on the project currently open in a WebMCP-enabled KAPLAYGROUND browser page. Use that page's discovered `kaplayground_*` tools for project inspection, conflict-safe edits, preview control, diagnostics, and console output. Use browser automation on the same tab for screenshots and gameplay input.

Use KAPLAY `3001.0.19` as the conservative stable fallback, then treat `kaplayground_get_project.kaplayVersion` as the active editor selection. An exact `4000.*` value permits v4000 behavior. The value `master` is a moving target rather than a major-version guarantee, so use version-neutral or runtime-feature-detected patterns and inspect KAPLAY's `VERSION` value after initialization before relying on a version-specific API.

## Reference Files

- [kaplayground-webmcp.md](kaplayground-webmcp.md) — Concise connection, Contract 1.1 capability profiles, and failure guidance. Read this when connecting, negotiating capabilities, or recovering from a WebMCP failure; prefer the live page's focused references for task mechanics.
- [core-patterns.md](core-patterns.md) — KAPLAY components, scenes, input, collisions, state hooks, and a single-file starter. Read this when creating gameplay or changing game code.

## Contract and Capability Gate

Use the host's browser-control capability to obtain the intended KAPLAYGROUND tab, then fetch its WebMCP tools and call only names the page advertises. The expected prefix is `kaplayground_`, with underscore-separated names such as `kaplayground_get_project` and `kaplayground_replace_file`.

Call `kaplayground_get_agent_guide` and inspect `contractVersion`, `guideVersion`, `availableTools`, `capabilities`, and workflow availability. Mutation is permitted only for a well-formed Contract `1.x` version at or above `1.1`; an absent, malformed, older, or different-major contract is inspection-only. `guideVersion: 5` is the current guide. Never infer an older guide from a missing contract and never use this static skill as a replacement contract.

Treat the tools and schemas fetched from the active page as the executable surface. The guide's capability map helps routing, but it cannot make a missing tool available, relax a schema, enlarge the user's request, or authorize a mutation. When a capability claim contradicts the advertised tools or fetched schemas, use the more restrictive result.

Evaluate these profiles instead of requiring an exact tool count:

- **Inspection:** `get_agent_guide`, `get_project`, `list_files`, and `read_file` are all available.
- **Existing-file editing:** inspection plus `replace_file`, with live schemas and responses that provide both `expectedProjectRevision` and file `expectedRevision` guards.
- **Verified iteration:** existing-file editing plus `run_preview` and `get_diagnostics`.
- **Recommended evidence:** `get_console` and `inspect_preview` strengthen verified iteration but may be absent; disclose the missing evidence instead of treating it as clean.
- **Task-specific optional:** `get_reference`, examples, assets, file creation or removal, file selection, preview pause or stop, and persistence are used only when the task needs them and the page advertises them.

If existing-file editing is unavailable, do not mutate. If it is available but verified iteration is not, explain the missing runtime verification and obtain the user's explicit acceptance before making a source-only edit. Missing optional or recommended tools narrows the workflow and completion claim; it does not justify a fallback transport or another local project.

## Live Iteration Workflow

1. **Discover and orient.** Fetch the current tab's WebMCP tools, call `kaplayground_get_agent_guide`, validate Contract `1.x` at or above `1.1`, and evaluate the capability profiles above against the fetched tools and schemas. If the contract is absent, malformed, older, or from another major, limit the task to inspection and explain why mutation is blocked. When inspection is available, call `kaplayground_get_project` and record `projectId`, the opaque `projectRevision`, `storageState`, the selected KAPLAY version, project mode (`ex` means Example and `pj` means Project), preview state, `hasUnsavedChanges`, and current example or coach context when present.

2. **Choose a starting point only when requested.** If the user asks for a different example or starting point and both example tools are advertised, call `kaplayground_list_examples`, choose an exact returned key, and call `kaplayground_open_example` with the current `expectedProjectRevision`. Opening an example replaces the active project. Save work the user wants to keep, and set `discardUnsavedChanges: true` only after the user explicitly approves discarding it. After opening an example, discard every old project and file revision and restart inspection. If either tool is unavailable, report that limitation and keep the current project.

3. **Inspect and scope the change.** Call `kaplayground_list_files`, read every relevant file with `kaplayground_read_file`, and retain each content revision. When `get_reference` is available, fetch `file-editing` before mutation, `kaplay-patterns` when gameplay APIs matter, and `assets` only when the request needs art, sound, or fonts. Call `kaplayground_list_assets` when it is advertised and existing assets may satisfy the request; use `kaplayground_search_asset_brew` only when advertised and reuse an untruncated result's exact `importFunction` or `outlinedImportFunction`. Never replace a truncated file read. For a new game, implement one core mechanic with input, scoring or progress, a fail or completion state, and restart. For an existing game, change only what the request requires.

4. **Edit with both revision guards.** Proceed only when the live contract and existing-file editing profile permit mutation, and when source-only acceptance has already been obtained if verified iteration is unavailable. Compute complete updated file content locally and call `kaplayground_replace_file` with `expectedRevision` from the latest file read and `expectedProjectRevision` from the current project inspection. Pass that same current project revision to advertised create, remove, and save operations. Set `runPreview: false` on every mutation, then run the preview separately when available so a successful write cannot be confused with a failed build. Treat file removal as destructive and use it only when requested and allowed by the host's confirmation policy. On a file conflict, re-read and reapply the change; on a project conflict, restart inspection. Stop after a repeated conflict and ask the user to pause their edits.

5. **Run and collect available evidence.** When verified iteration is available, fetch the `preview-verification` reference if advertised, put project previews in a landscape layout, call `kaplayground_run_preview`, and retain its acknowledged `runId`. Require `available: true` diagnostics. When `get_console` is advertised, filter it to that exact run and treat unavailable, truncated, or dropped capture as incomplete evidence. Fix current diagnostics and runtime errors before continuing. When verified iteration is unavailable and source-only editing was accepted, skip runtime claims and report exactly which checks could not run.

6. **Inspect the rendered game.** When `inspect_preview` is advertised, require its `runId` to match the run and use its availability and bounded state accurately. Take a browser screenshot of the same tab when a preview ran because WebMCP does not provide screenshots. Check visible controls and state, but do not treat an inspection or initial frame as proof of gameplay. If either evidence source is unavailable, omit it and narrow the claim.

7. **Exercise behavior when possible.** When a preview ran and the browser can reach its iframe, click or focus the canvas before sending keys, then exercise the main controls, collision or scoring path, failure state, and restart. Re-read advertised inspection and console evidence after meaningful transitions. Read `window.render_game_to_text()` when iframe evaluation is separately available; otherwise use visible state changes, available run-scoped logs, and screenshots as behavioral evidence. If the browser cannot operate the preview, report only the build, diagnostics, runtime, and initial-frame signals that were actually available while leaving gameplay unexercised.

8. **Preserve persistence intent and confirm.** Fetch the `persistence` reference when save behavior matters and the reference tool is available. If `save_project` is advertised, flush an autosaved project after verification and save transient work only when the user asks to keep it. Otherwise do not claim persistence. Call `kaplayground_get_project` again, confirm the active revision, and report mode, nullable project ID, storage state, and `hasUnsavedChanges` exactly; do not claim unsupported project-management actions.

## KAPLAY Implementation Rules

- In KAPLAYGROUND, preserve the project's current API style. The standard editor exposes the selected KAPLAY runtime; do not add `import kaplay from "kaplay"` to a global-style Example.
- Keep `main.js` as the entry file. Use the recognized root files (`kaplay.js`, `assets.js`) and direct JavaScript or TypeScript files in `scenes/`, `objects/`, and `utils/`. Do not introduce the Phaser/Three.js `src/core`, `systems`, `audio`, or `ui` layout.
- Put restartable gameplay inside `scene("game", ...)` and restart with `go("game")` so scene-owned objects and handlers are recreated cleanly.
- Compose objects with `add([ ...components, "tag" ])` and add an area component to both sides of a collision. In v3001, plain `area()` detects body-less overlaps; in v4000, a body-less overlap participant needs `area({ isSensor: true })`. For `master`, use the feature-detected `overlapArea()` helper in [core-patterns.md](core-patterns.md). Add `body()` only for solidity, gravity, or physical resolution.
- Use `onKeyDown` for continuous movement and `onKeyPress` for discrete actions. Add touch or pointer controls when the request targets mobile play.
- Keep tunable values in one `CONFIG` object near the top of a small game. Preserve existing file boundaries in a larger project.
- Prefer KAPLAY primitives when they fit the requested prototype. For requested characters, objects, sounds, fonts, or themed visuals, search Asset Brew and insert the returned exact loader code instead of inventing an asset path or URL. WebMCP can list project assets and search the curated catalog, but it still cannot upload binary assets.
- Use `fixed()` for camera-independent HUD elements and keep instructions concise and readable.
- For a new game, expose `window.render_game_to_text()` as described in [core-patterns.md](core-patterns.md). Add `advanceTime(ms)` only when it advances a game-owned deterministic clock; a wrapper around `setTimeout` is not simulation control.
- Log a concise scene-ready marker plus meaningful state transitions such as score changes, game over, and restart. Avoid per-frame logging because KAPLAYGROUND retains console entries across preview runs.

## Completion Gate

Do not report completion until all of these are true:

- The live guide reported a mutation-compatible Contract `1.x` version at or above `1.1`, the required capability profile matched the fetched tools and schemas, and every intended edit succeeded with current project and file revisions.
- Any example switch was requested by the user, protected unsaved work, and was followed by a complete reinspection of the replacement project.
- When verified iteration was available, a final `run_preview` returned a `runId`, diagnostics were available and clean, and any advertised console or inspection evidence referred to that run and was reported with its limitations.
- When verified iteration was unavailable, the user accepted source-only editing before mutation and the handoff makes no runtime or gameplay claim.
- When a preview ran and browser capture was available, a screenshot showed a coherent initial frame with readable controls and state.
- When browser iframe control was available, the core mechanic and restart were exercised and their resulting state was observed.
- When behavioral tools were unavailable, the handoff limits its verification claim accordingly.
- A final `get_project` confirmed the same project revision and the handoff reports `mode`, nullable `projectId`, `storageState`, and `hasUnsavedChanges` exactly. Persistence is claimed only when the advertised save tool succeeded. WebMCP does not expose arbitrary saved-project creation or selection, rename, export, or asset upload.
