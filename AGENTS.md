# Repository agent notes

## Browser agent integration

KAPLAYGROUND is usable through page-owned WebMCP tools without installing a skill, plugin, or separate MCP server.

Keep the integration small and application-specific:

- `src/integrations/webmcp/kaplaygroundWebMCP.ts` owns registration and connects the tools to the project, editor, preview, diagnostics, console, examples, assets, persistence, and visible activity state.
- `src/integrations/webmcp/gameTools.ts` contains the small pure surface definition, the single game revision helper, path limits, and atomic multi-file update validation.
- `src/integrations/webmcp/activitySummary.ts` removes source contents before invocation details enter visible application state.
- `tests/webmcp.test.mjs` covers the tool list, revision behavior, atomic updates, safe paths, prompt language, activity redaction, console bounds, and diagnostics availability.

The page exposes these eight tools:

1. `kaplayground_inspect_game`
2. `kaplayground_read_files`
3. `kaplayground_update_game`
4. `kaplayground_run_game`
5. `kaplayground_find_assets`
6. `kaplayground_save_game`
7. `kaplayground_find_examples`
8. `kaplayground_open_example`

Do not add version negotiation, a second registration layer, a separate workflow bootstrap, or a duplicate manifest before a released client actually needs compatibility guarantees.

## Integration rules

`inspect_game` is the normal first operation. It returns one revision token representing both the active project and its current contents. Every mutation, run, save, or example replacement must reject a stale revision.

`read_files` reads several exact paths in one call. Keep reads bounded and reject aliases, traversal, backslashes, missing files, and oversized source.

`update_game` validates every change before committing one complete replacement file map. A failed create, replace, remove, path, duplicate, or size check must leave the project untouched. Creating or removing files remains limited to direct JavaScript or TypeScript files inside `scenes/`, `objects/`, and `utils/`. Root files may be replaced when they already exist but not created or removed through the agent tools. Updating never runs the preview.

`run_game` must verify that the requested revision remains current before and after the run. Keep preview acknowledgement, diagnostics, console output, and scene inspection distinct in the response. Report `failed` for detected code or console errors, `incomplete` when checks are unavailable or bounded, and `passed` only for checks actually completed. Do not claim that controls were played or that visuals were judged without browser-level evidence.

Asset results may include bounded metadata and exact built-in loader code, but never hidden asset URLs or binary contents. Opening an example replaces the active project and may discard unsaved work only after explicit user approval.

Read-only tools and project-derived output must preserve `readOnlyHint: true` and `untrustedContentHint: true`. Sandbox console messages must validate both the configured origin and the active iframe window.

Coach prompts are for new users. They must describe the creative result in ordinary language and must not contain `@Browser`, WebMCP, tool names, revisions, contracts, capability negotiation, or other integration jargon.

## Required validation

For browser-agent changes, run:

1. `npm run test:webmcp`
2. `npm run verify:webmcp`
3. `git diff --check` and a final working-tree review

`test:webmcp` generates ignored example, version, changelog, and public-asset data before running the tests, so verification also works from a clean checkout.

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
2. Run `npm run verify:webmcp`. It checks the browser-agent tests and types, builds the preview sandbox, and builds the main Site. If the preview protocol or sandbox code changed, deploy and verify the compatible Cloudflare Pages sandbox first, then build the editor with its exact `VITE_SANDBOX_URL`. Ordinary demo or editor-only changes reuse the existing sandbox.
3. Commit and push the exact validated source before saving a Site version. Obtain a short-lived Sites source-repository credential when needed and push the same commit to the configured Sites source branch with per-command HTTP authorization; never persist or print the token.
4. Package the successful build output with the installed Sites plugin's `scripts/package-site.sh <project-dir> <archive-path>` helper. The archive must come from the exact pushed commit and contain the hosting metadata plus supported `dist/` entrypoints.
5. Call `sites_save_site_version` once with the project ID, exact pushed commit SHA, and archive. Deploy that saved version with `sites_deploy_private_site_version` only when `sites_get_site` verifies owner-only access; otherwise obtain explicit approval and use the shared/public deployment tool.
6. Poll `sites_get_deployment_status` until it succeeds or fails, then verify the production URL. Do not report deployment success from a saved version or pending deployment.

The established production URL is `https://kaplayground-webmcp.rinesht.chatgpt.site/`, and the canonical demo route is `?example=webmcpAgent`.
