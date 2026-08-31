# Flow Test 08: Build in KAPLAYGROUND through WebMCP

## Objective

Test that the KAPLAY skill validates Contract 1.1, negotiates the active page's capabilities, edits safely, and reports only the evidence the page and browser can verify.

## Prerequisites

- A WebMCP-enabled KAPLAYGROUND page is open in a controllable browser.
- The active project is a clean disposable starter with no unsaved work.
- The full deployment advertises 20 `kaplayground_*` tools; reduced-adapter variants intentionally advertise fewer.
- Browser capture is available; preview-iframe input and evaluation may be unavailable and must limit behavioral claims.

## Test Prompt

"$kaplay replace the clean starter with a suitable ready-made example, then build a top-down coin collector with WASD and arrow controls, a 30-second timer, and R to restart. Use an Asset Brew character sprite and collection sound, and leave the result disposable."

## Full Contract 1.1 Flow

### Phase 1: Discover and inspect

- [ ] Obtains the tab's `webmcp` capability, fetches its current tools, and calls only advertised names.
- [ ] Calls `kaplayground_get_agent_guide` and requires a compatible `contractVersion: "1.1"`; confirms `guideVersion: 5`, no `version` alias, and `availableTools` matching the page surface.
- [ ] Evaluates inspection, existing-file editing, verified-iteration, recommended-evidence, and task-specific profiles against actual tools and schemas rather than a fixed count.
- [ ] Calls `kaplayground_get_project` and records project identity, revisions, persistence state, KAPLAY version, mode, preview state, unsaved state, and current example metadata.
- [ ] Calls `kaplayground_list_examples`, opens one exact returned key with the current revision, discards all stale revisions after replacement, and inspects the new project again.
- [ ] Lists files and assets, reads every file it will change, retains complete content revisions, and rejects truncated reads.
- [ ] Fetches only the `file-editing`, `kaplay-patterns`, and `assets` focused references needed before implementation.

### Phase 2: Implement safely

- [ ] Keeps `main.js` as the entry and preserves the project's global or scoped KAPLAY API style.
- [ ] Uses a restartable scene, continuous movement, and version-correct overlap areas for the selected runtime.
- [ ] Exposes `window.render_game_to_text()` with visible game state.
- [ ] Searches Asset Brew with descriptive sprite and sound queries, then inserts exact untruncated returned loader code without inventing URLs or claiming an upload.
- [ ] Replaces files with complete content plus current project and file revisions; it never invents a project identifier or partial patch operation.
- [ ] Uses advertised file creation only for schema-supported paths and performs no removal unless explicitly requested and confirmed.
- [ ] Uses `runPreview: false` for mutations so preview failure cannot obscure write success.

### Phase 3: Verify and hand off

- [ ] Fetches the `preview-verification` reference, uses a landscape layout, calls `run_preview`, and retains the acknowledged `runId`.
- [ ] Requires available clean diagnostics and uses console output and runtime inspection only when advertised, scoped to the exact run and reported with truncation or availability limits.
- [ ] Captures the KAPLAYGROUND tab through browser control; it does not expect a WebMCP screenshot or base64 payload.
- [ ] When iframe input is available, focuses the preview and exercises movement, collection, timeout, and restart, then checks same-run evidence again.
- [ ] When iframe input is unavailable, says the source, diagnostics, advertised runtime evidence, and initial frame were checked while gameplay remains unexercised.
- [ ] Calls `get_project` again and leaves the explicitly disposable transient example unsaved, reporting mode, nullable project ID, storage state, revision, and unsaved state exactly.

## Capability Variants

### Reduced optional surface

- [ ] With a compatible Contract 1.1 page that has inspection, editing, verified iteration, and recommended evidence but lacks examples, assets, creation, removal, selection, pause, stop, or persistence, the skill edits the current file and omits unavailable task-specific operations.
- [ ] Missing optional tools narrow the requested workflow and final report without blocking unrelated supported work.

### Runtime verification unavailable

- [ ] With Contract 1.1 and existing-file editing but without `run_preview` or `get_diagnostics`, the skill explains that only a source edit is possible and requests explicit acceptance before mutation.
- [ ] Without that acceptance, it makes no mutation.
- [ ] With acceptance, it performs only the revision-safe source edit and makes no build, runtime, visual, or gameplay claim.

### Restrictive contract and contradictory claims

- [ ] An absent, malformed, Contract 1.0, or different-major contract permits available inspection but blocks every mutation even when mutation tools are advertised.
- [ ] A capability map that claims editing or verification cannot override a missing tool or a schema without the required revision guards.
- [ ] The bundled static reference is used only for connection and failure guidance; it never becomes a replacement mutation contract.

## Success Criteria

- [ ] The requested source is present after a revision-safe mutation permitted by the live contract and capability profile.
- [ ] Focused page references were fetched selectively and every actual call used a currently advertised tool and compatible schema.
- [ ] Asset loader code and project metadata were not fabricated.
- [ ] Verification and persistence claims match the exact tools and evidence available for the intended project and run.
- [ ] Source-only editing occurs only after explicit acceptance and is reported without runtime claims.
- [ ] No separate MCP server, fallback project, unadvertised identifier, inferred contract, or unsupported operation is introduced.

## Anti-patterns

- Treating a tool count or capability claim as stronger than the actual advertised tools and schemas.
- Mutating through an absent, older, malformed, or unknown-major contract.
- Reusing stale revisions, replacing a truncated read, or combining mutation with preview execution.
- Opening an example without the user's request or discarding unsaved work without explicit approval.
- Claiming gameplay works from diagnostics, shallow inspection, or an initial screenshot alone.
- Fabricating Asset Brew data or claiming saved-project selection, rename, export, or asset upload.
