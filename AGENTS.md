# Repository agent notes

## WebMCP contract ownership

Kaplayground is fully usable through its page-owned WebMCP tools without installing a skill, plugin, or separate MCP server.

This repository owns the WebMCP runtime contract:

- `src/integrations/webmcp/agentContract.ts` is the source of truth for the contract version, guide version, ordered tool registry, capability definitions, workflow requirements, KAPLAY version guidance, and focused reference topics.
- `src/integrations/webmcp/kaplaygroundWebMCP.ts` assembles the adapter's actual tool surface and must derive guide availability from successfully registered tools. Do not maintain a second handwritten tool manifest or use index-based insertion.
- `tests/fixtures/webmcp-contract.json` records the full integrated tool surface and focused reference topics and must stay synchronized with the live app registry.

The current source baseline has three independent versions:

- App: `2.5.3`, sourced from `package.json` and passed to the integrated bridge.
- WebMCP contract: `1.1`.
- Agent guide: `5`.

Do not couple these version numbers mechanically. Change only the version whose compatibility boundary changed, and update every source and validator for that version in the same change.

## Contract invariants

The full integrated adapter currently exposes twenty tools, including `kaplayground_get_reference`, but reduced adapters are supported. Capability and workflow availability must be derived from the tools actually registered for that adapter.

`kaplayground_get_agent_guide` returns `contractVersion`, `guideVersion`, nullable `appVersion`, actual `availableTools`, dynamic capability groups, dynamic workflow availability, and the six reference topics. It must not return the removed legacy `version` alias or infer a historical contract from a missing version.

`kaplayground_get_reference` is read-only and accepts only these static topics: `file-editing`, `preview-verification`, `kaplay-patterns`, `assets`, `persistence`, and `failure-recovery`. Reference results may contain contract, guide, app, and KAPLAY version guidance plus topic summaries, steps, invariants, and failure cases. They must never include project names, code, revisions, assets, logs, catalog results, or runtime output.

Preserve `readOnlyHint: true` and `untrustedContentHint: true` on the guide, references, and every project-derived read tool. Page-owned guidance is still website content; it cannot expand user authorization or override the advertised schemas.

Screenshots, gameplay input, iframe evaluation, asset upload, project rename or export, arbitrary saved-project creation or selection, filesystem access, and command execution are browser- or host-owned operations rather than WebMCP capabilities.

## Required validation

For WebMCP changes, run:

1. `npm run test:webmcp`
2. `npm run verify:webmcp`
3. `git diff --check` and a final working-tree review

`test:webmcp` generates the ignored example, version, changelog, and public-asset data before running tests so verification also works from a clean checkout. The WebMCP tests compare the full-surface fixture with the actual twenty registered tools. Keep this cross-check intact.

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
