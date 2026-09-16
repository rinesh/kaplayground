# Unmerged branch review — 2026-09-16

Baseline: `dev` and `origin/dev` at `e19b5299e3732a9b1400b617717eea91afa0bb8e`.
Remote refs were fetched and the checkout's shallow history was completed before
comparing ancestry. Different commit IDs do not necessarily mean missing work.

## Integrated

`upstream/fix-blob-download` (`086be51`) fixes premature revocation of export URLs
in Safari. The integration retains Blob URLs for 60 seconds instead of copying
potentially large exports into a base64 data URL. Failed download initiation
releases the URL immediately and propagates the error. Current package version
2.5.3 is preserved; the old branch's 2.4.4 release metadata is not restored.

## Branch decisions

| Branch | Decision and evidence |
| --- | --- |
| `origin/codex/fix-webmcp-report-followups` | Already an ancestor of dev. |
| `origin/codex/fix-webmcp-scene-lifecycle` | Already an ancestor of dev. |
| `origin/codex/webmcp-verification-contract` | Already an ancestor of dev. |
| `backup/webmcp-consolidation-reviewed-2026-08-30` | Its complete tree equals `aae9bc2`, already on dev. |
| `backup/webmcp-consolidation-pre-reconcile-2026-08-30` | Earlier snapshot, superseded by the reviewed consolidation. |
| `upstream/feat-better-console` | Already integrated at `5a7de2c`; only the historical engine pointer differs. |
| `upstream/feat-indexeddb` | Tree equals dev ancestor `5f3a080`. |
| `upstream/feat-version-filter` | Tree equals dev ancestor `d5c2c2b`. |
| `upstream/migrate-npm` | Tree equals dev ancestor `cf022d3`. |
| `upstream/v2.5.3` | Tree equals dev ancestor `f435113`. |
| `upstream/versions/2.4` | Already an ancestor of dev. |
| `upstream/example-patches` | Obsolete 2024 Astro architecture; not a current application patch. |
| `upstream/feat-new-file-managment` | Deferred: unfinished recursive-folder redesign with a deletion defect. |
| `upstream/master` | Deferred: new pinned engine has reproducible rendering and collider regressions. |

## Deferred findings

In file-management tip `303e91e`, deleting a folder removes only its own map
entry. Descendant files disappear from the tree but remain stored and execute.
See `FileFold.tsx:103`, `stores/slices/files.ts:32`, and `wrapCode.ts:18` at that
branch. The file/folder union also requires reconciliation with current
persistence and the bounded WebMCP file contract.

Engine update `d5060fc` pins KAPLAY `1d176bab`. Review of the nine engine commits
and in-memory old/new-source checks reproduced:

- Cropped `drawSprite()` dimensions use the full frame: a half-width crop of a
  100×100 sprite becomes 100×100 instead of 50×100 (`drawSprite.ts:163`).
- Direct nine-slice scale/rotation transforms each patch without transforming
  its placement; scaling a 100×100 panel by two overlaps patches and ends at
  x=170 instead of x=200 (`drawSprite.ts:150`).
- Assigning one collider's offset mutates other colliders sharing the initial
  vector, without invalidating their cached bounds (`area.ts:453,580`).

These are engine-source findings. Games load published/CDN engine modules;
updating the submodule alone does not replace those runtime bytes. The bump is
held for a separate engine integration, including matching examples and types.

## Verification

- `npm run verify:webmcp`: passed, including 114 unit tests, TypeScript, real
  Chrome integration tests, both production builds, and four artifact checks.
- `git diff --check`: passed.
- Real downloads with the candidate helper: `.kaplay` and `.html` exports larger
  than 2 MiB completed in Chromium and WebKit 26.6, with exact byte comparison.
  Native Safari itself was not exercised.
