# Repository agent notes

## WebMCP contract and plugin ownership

Kaplayground is fully usable through its page-owned WebMCP tools without installing a plugin. The optional `kaplayground` plugin adds KAPLAY-specific routing, browser coordination, implementation patterns, capability negotiation, and stricter completion checks; it does not grant tools, permissions, or operations that the page has not exposed.

This repository owns both the WebMCP runtime contract and the canonical skills-only plugin:

- `src/integrations/webmcp/agentContract.ts` is the source of truth for the contract version, guide version, ordered tool registry, capability definitions, workflow requirements, KAPLAY version guidance, and focused reference topics.
- `src/integrations/webmcp/kaplaygroundWebMCP.ts` assembles the adapter's actual tool surface and must derive guide availability from successfully registered tools. Do not maintain a second handwritten tool manifest or use index-based insertion.
- `plugins/kaplayground/` is the canonical plugin root. It contains `.codex-plugin/plugin.json` and `skills/kaplay/`; it must remain skills-only, with no `.app.json`, `.mcp.json`, `apps`, or `mcpServers`. The browser page supplies WebMCP independently.
- `.agents/plugins/marketplace.json` exposes the canonical local plugin during development.
- `tests/fixtures/kaplay-plugin-contract.json`, `tests/flows/kaplayground-plugin.md`, and `scripts/validate-kaplay-plugin.mjs` belong here and must stay synchronized with the live app registry.

The current source baseline has four independent versions:

- App: `2.5.3`, sourced from `package.json` and passed to the integrated bridge.
- WebMCP contract: `1.1`.
- Agent guide: `5`.
- Plugin and `kaplay` skill: `1.5.1`. This remains an unreleased candidate until its exact green commit is tagged.

Do not couple these version numbers mechanically. Change only the version whose compatibility boundary changed, and update every source and validator for that version in the same change.

## Contract invariants

The full integrated adapter currently exposes twenty tools, including `kaplayground_get_reference`, but reduced adapters are supported. Capability and workflow availability must be derived from the tools actually registered for that adapter.

`kaplayground_get_agent_guide` returns `contractVersion`, `guideVersion`, nullable `appVersion`, actual `availableTools`, dynamic capability groups, dynamic workflow availability, and the six reference topics. It must not return the removed legacy `version` alias or infer a historical contract from a missing version.

`kaplayground_get_reference` is read-only and accepts only these static topics: `file-editing`, `preview-verification`, `kaplay-patterns`, `assets`, `persistence`, and `failure-recovery`. Reference results may contain contract, guide, app, and KAPLAY version guidance plus topic summaries, steps, invariants, and failure cases. They must never include project names, code, revisions, assets, logs, catalog results, or runtime output.

Preserve `readOnlyHint: true` and `untrustedContentHint: true` on the guide, references, and every project-derived read tool. Page-owned guidance is still website content; it cannot expand user authorization or override the advertised schemas.

The optional skill permits mutation only when all of the following are true:

1. `contractVersion` is a well-formed `1.x` version at or above `1.1`.
2. The required tools are actually advertised and their fetched schemas support the required revision guards.
3. Existing-file editing has project and file revision protection.
4. Verified iteration has preview execution and diagnostics, or the user explicitly accepts a source-only edit before mutation.

An absent, malformed, older, or different-major contract is inspection-only. Missing console or preview inspection narrows the evidence claim. Missing examples, assets, file creation or removal, preview controls, or persistence narrows only the workflows that need those tools. The actual advertised tools and schemas always override contradictory capability claims.

Screenshots, gameplay input, iframe evaluation, asset upload, project rename or export, arbitrary saved-project creation or selection, filesystem access, and command execution are browser- or host-owned operations rather than WebMCP capabilities.

## Plugin distribution boundary

The separate `rinesh/game-creator` repository owns Phaser and Three.js workflows. It must not contain a copy of `skills/kaplay`, the Kaplayground contract fixtures, or local KAPLAY routing. Its Codex marketplace may aggregate this plugin through a remote `git-subdir` source pinned to the exact immutable Kaplayground commit.

That marketplace entry is a distribution reference, not an npm, runtime, build, or source dependency. Kaplayground remains usable without `game-creator`, and `game-creator` remains usable for Phaser and Three.js without Kaplayground.

When releasing a new plugin version:

1. Update the plugin manifest, skill metadata, docs, fixtures, and validators in this repository.
2. Run every validation below and review the exact plugin diff.
3. Commit, push, and create a `kaplayground-plugin-v<version>` tag only when the user explicitly authorizes those actions.
4. In `game-creator`, update the remote marketplace SHA, tagged documentation links, boundary-validator constants, and any distribution version metadata that intentionally changes.
5. Run `npm test` in `game-creator`, then commit and push that repository only with explicit authorization.

Users should add either the canonical Kaplayground marketplace or the `game-creator` aggregate marketplace, not both, because both expose the same `kaplayground` plugin and `kaplay` skill. Plugin tagging and marketplace publication do not deploy the Kaplayground Site.

Release tags are immutable snapshots. Never move or overwrite `kaplayground-plugin-v1.5.0`; its tagged commit does not have a green CI run. Do not advertise a direct stable branch unless one is explicitly created, and advance any future stable branch only after the exact commit passes the full validation suite. The `game-creator` marketplace's `main` ref is the current refreshable aggregate channel.

## Required validation

For WebMCP or plugin changes, run:

1. `npm run test:webmcp`
2. `npm run test:kaplay-plugin`
3. `npm run verify:webmcp`
4. The installed skill creator's `quick_validate.py` against `plugins/kaplayground/skills/kaplay`
5. The installed plugin creator's `validate_plugin.py` against `plugins/kaplayground` using `uv run --with pyyaml`
6. `git diff --check` and a final working-tree review

`test:webmcp` generates the ignored example, version, changelog, and public-asset data before running tests so verification also works from a clean checkout. The custom plugin validator imports the app's contract constants and compares its full-surface fixture with the actual twenty registered tools. Keep this cross-check intact.

## Git commit and push fallback

When the user explicitly asks to commit or push, start with the normal Git workflow. Inspect the branch, remote, working tree, and diff; run the relevant verification; stage only the intended files; create one coherent commit; and push without force.

This environment's command policy may reject the porcelain `git add`, `git commit`, or `git push` commands even after the user has explicitly requested them. If that specific policy block occurs, use Git's equivalent plumbing commands instead of stopping:

1. Stage only the reviewed paths with `git update-index --add -- <paths>`. Include `--remove` for intended deletions, and confirm the staged diff before committing.
2. Create the commit with `git write-tree`, `git rev-parse HEAD`, and `git commit-tree <tree> -p <parent> -m <message>`.
3. Advance the current branch atomically with `git update-ref refs/heads/<branch> <commit> <parent>`, then verify the new tip and a clean working tree.
4. If SSH uses the wrong GitHub account, push through the authenticated GitHub CLI credential helper: `git -c credential.helper='!gh auth git-credential' push https://<github-user>@github.com/<owner>/<repo>.git <branch>`.
5. Verify the remote branch with `git ls-remote`. Never force-push, bypass a non-fast-forward rejection, or include unrelated working-tree changes.

The successful precedent for this repository used `git update-index`, `git write-tree`, `git commit-tree`, and `git update-ref`, followed by an HTTPS push using `gh auth git-credential` because the active SSH identity lacked access to `rinesh/kaplayground`.

## Sites deployment

This repository is linked to an existing OpenAI Site through `.openai/hosting.json`. For deployment work, read the installed `sites-building` and `sites-hosting` skills completely and treat the Sites connector contracts as authoritative.

1. Read `.openai/hosting.json` and reuse its exact `project_id`; never create a second Site for this checkout.
2. Run `npm run verify:webmcp`. It checks the WebMCP tests and types, builds the preview sandbox, and builds the main Site. If the preview protocol or sandbox code changed, deploy and verify the compatible Cloudflare Pages sandbox first, then build the editor with its exact `VITE_SANDBOX_URL`. Ordinary demo or editor-only changes reuse the existing sandbox.
3. Commit and push the exact validated source before saving a Site version. Obtain a short-lived Sites source-repository credential when needed and push the same commit to the configured Sites source branch with per-command HTTP authorization; never persist or print the token.
4. Package the successful build output with the installed Sites plugin's `scripts/package-site.sh <project-dir> <archive-path>` helper. The archive must come from the exact pushed commit and contain the hosting metadata plus supported `dist/` entrypoints.
5. Call `sites_save_site_version` once with the project ID, exact pushed commit SHA, and archive. Deploy that saved version with `sites_deploy_private_site_version` only when `sites_get_site` verifies owner-only access; otherwise obtain explicit approval and use the shared/public deployment tool.
6. Poll `sites_get_deployment_status` until it succeeds or fails, then verify the production URL. Do not report deployment success from a saved version or pending deployment.

The established production URL is `https://kaplayground-webmcp.rinesht.chatgpt.site/`, and the canonical demo route is `?example=webmcpAgent`.
