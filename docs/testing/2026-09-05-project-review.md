# Project review and fixes — 5 September 2026

The review found seven actionable source issues, including a sandbox boundary failure in console decoding. This change fixes them without expanding the eight-tool WebMCP surface. The baseline was `dev` at `a4a8a6d1e884c6862d8b8360b03bfc18c6ac863b`.

## Findings and changes

### P1 — Game console data could execute code in the editor

`installGameConsoleCapture` checked the message origin and active iframe, then passed the game's serialized message to `console-feed`'s `Decode`. That decoder reconstructs objects using global constructors selected by input data. A crafted combination of serialized types executed a harmless marker in the decoding context during the review. The origin checks did not prevent it because arbitrary game code runs inside the allowed iframe and can send its own messages. Execution in the editor context could reach that origin's saved projects and browser storage.

The editor now uses `decodeConsoleLog`, which traverses the wire format as plain display data. It resolves references with cycle detection, preserves serialized type information without constructing live objects, and bounds nesting, collection lengths, node visits, and text before console retention. It does not call the dependency's decoder. The existing origin/window checks and byte-bounded console store remain in place, and the sandbox's existing message format is compatible.

Validation includes ordinary messages encoded by the actual library, errors and circular references, a constructor payload, malformed input, and large/deep input. The browser suite also passes the payload through the real application message handler with the active iframe's identity and confirms that the marker remains unset. No exploit was executed against production.

### P2 — Verification could succeed after Stop or another Run

`kaplayground_run_game` collected scene evidence, captured editor state, and awaited Monaco diagnostics. Its final guard checked executable content but did not re-read the active preview. Stopping or replacing a run during that await could return `passed` and `complete: true` for the old run even though the active preview had changed.

The final guard now checks the current editor's stopped state and run ID as well as executable identity. Browser regressions interrupt diagnostics with both a real Stop and a real restart and require a failed, incomplete receipt. Metadata-only edits still preserve an identical verified runtime.

### P2 — Recreated files could restore deleted source

Manual deletion removed the project file but left its Monaco model alive. Selecting a newly created file at the same path reused the old model; the next edit could copy deleted source into the replacement file.

Manual deletion now disposes the obsolete model and view state after switching files. File selection also uses the existing canonical model synchronization helper, so an existing model receives the current project's source and language. A browser regression uses the real store operations, Monaco selection, and edit event to confirm that fresh replacement content survives its next edit.

### P2 — Accepted filenames could not be imported

The tool's path validation allowed spaces, Unicode, `#`, `?`, and `%`, but the virtual filesystem resolved imports through `new URL(...).pathname`. That encoded some characters and interpreted others as URL syntax, so the resulting path no longer matched the file map.

The compiler now resolves virtual path segments directly. Tests compile actual projects with ordinary names and each of those characters, plus relative directory resolution. This preserves the supported file surface instead of accepting files that cannot run.

### P2 — Startup failures left an endless loading screen

Initialization failures reached the readiness state and console, but never reached the loading component. A missing `?example=` value reproduced a permanent spinner on production. The same catch path also covers database, compiler initialization, and initial project loading failures.

Startup failures now display an accessible error with retry and starter-game recovery actions. Missing starting points fail explicitly. Browser coverage visits an invalid starting-point URL and follows the recovery link back to the workspace; saved projects are not cleared by recovery.

### P2 — Every visit downloaded the complete embedded asset catalog

The original entry chunk was **23.47 MB uncompressed / 9.97 MB gzip**. `assetsParsing.ts` eagerly imported a generated JSON file containing approximately 15.93 MB of base64 assets, including assets unused by the current game.

Preview compilation now uses a small asset manifest and the existing sandbox asset URLs. Small root metadata files that the sandbox does not serve remain inline. The full embedded catalog loads only when exporting standalone HTML, which continues to embed its built-in assets. An intermediate validated build reduced the entry chunk to approximately **6.84 MB / 2.54 MB gzip**, about a 75% reduction in compressed entry size; this is a build-size measurement, not a measured load-time claim.

The review checked the existing sandbox's asset routes. The 126 non-root asset paths were available; the two root metadata files returned the site's HTML fallback, which is why the manifest retains them inline. Browser tests check served previews, embedded exports, and catalog startup. Monaco and the remaining application code still account for a substantial initial bundle; splitting those further is separate work.

### P2 — Connection wording overstated what the page knew

The page displayed “Codex is ready” immediately after registering the eight tools, before any agent had contacted it. The earlier **Check Chrome WebMCP status** task had already identified this distinction. This label could encourage users to treat a client discovery problem as a working connection.

The status now says “Game tools are ready” and explains that activity appears when the agent starts. The change does not add a handshake, registration layer, or extra tool.

## Production state found during review

The live page at `https://promptmygame.com` reported application commit `2a01572d544ec68b2a06aa3092e54d31cdfc4f51`, matching Site version 40. Versions 41 and 42 were saved, but the live build did not yet contain the late WebMCP detection changes already merged on `dev`. The **Fix WebMCP detection** task ended with version 42 prepared and publication awaiting approval. The user's request in this review subsequently authorized fixing, pushing, and deploying to the existing Site.

Deployment must publish the final validated commit, not merely save another version. Its successful terminal status and the live page's build identity are the release checks; the Site and its existing public audience are reused.

## Context from related tasks

The review read recent and relevant older turns from ten related tasks. These decisions shaped the fixes:

- **Review merge and deploy changes** established content/runtime identities, save readback, bounded gameplay evidence, and source-free visible receipts. Those contracts remain intact.
- **Diagnose WebMCP bypass** traced one missed integration to task routing rather than broken page tools. Its deliberately short prompt prefix, `Use the open editor at https://promptmygame.com.`, remains unchanged.
- **Test WebMCP prompts end to end** documented earlier sample, sound, autosave, viewport, and panel fixes. The existing catalog and browser checks were rerun rather than assuming historical results still held.
- **Check Chrome WebMCP status**, **Fix WebMCP detection**, and **Add Bobo to Game** distinguish page registration, delayed capability availability, and whether a particular client actually calls the tools. The page cannot infer all three from registration alone.
- **Compare WebMCP game creation** found richer structured evidence but no demonstrated speed advantage in its matched comparison. This review makes no stronger performance claim about agent workflows.
- **Add MIT notices to builds** required complete application and engine notices in distributions and exported HTML. Those artifact checks remain part of release validation.
- **Plan GTM branding and hackathon** and **Change game fish character** supplied product and demonstration context; their publication/media work did not require changes to the editor's tool contract.

## Validation and scope

The baseline passed all 104 unit tests, the browser integration suite, types, both builds, four license artifact tests, and the 127-example catalog. `npm audit --json` reported zero known dependency vulnerabilities. That audit did not detect the console decoding problem; a clean dependency audit is not a security assessment.

The fixes passed an initial full `npm run verify:webmcp`: **107 unit tests**, TypeScript, real Chromium integration checks, the sandbox build, the editor build, and **four artifact tests**. The browser results include the new console safety, interrupted-run, file recreation/import, and startup recovery checks alongside existing save/reopen, failure/retry, gameplay, focus, layout, and input coverage. The final catalog sweep and release build are recorded with the deployment outcome in the task.

Source review covered the editor and project stores, IndexedDB and persistence queues, project replacement, build/export and assets, preview protocol and sandbox, all eight WebMCP handlers, diagnostics, console and activity data, startup/coach/browser UI, and build/release configuration. The upstream KAPLAY engine was treated as a dependency, not independently audited in full.

The browser harness uses local fixtures for KAPLAY releases and a test registration context. The catalog sweep checks 127 sample startups and 508 prompt-copy mappings; it does not execute every creative prompt, validate every CDN engine version, prove agent discovery in every client, or judge every game's visual quality. Production was separately inspected through its real page-owned tools during the review.

The final catalog sweep passed **127/127 examples**, **508 prompt-copy mappings**,
**592 viewport checks**, and **32 pointer hits**, including all newly added
regressions. The final TypeScript check and `git diff --check` also passed.
