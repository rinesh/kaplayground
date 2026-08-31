# Agent-system roadmap

> **Status:** Incremental implementation plan for the target architecture. Milestones are ordered by semantic dependency, not by calendar estimate. Current WebMCP behavior remains supported while each target service is introduced behind compatibility adapters.

## 1. Delivery strategy

Do not rewrite the editor or replace the nineteen current tools in one step. The safe path is to expose the structure already latent in the system, make it measurable, and then strengthen it.

```text
M0 vocabulary and baseline
    ↓
M1 manifest and shared service boundaries
    ↓
M2 explicit state, envelopes, errors, operation IDs
    ↓
M3 economical context, search, and range reads
    ↓
M4 atomic change sets, checkpoints, and restore
    ↓
M5 exact-run evidence ledger and verification receipts
    ↓
M6 human operation control, approvals, and recovery UI
    ↓
M7 bounded accretion and continuous evaluation
    ↓
M8 composed fast paths and higher-level agent workflows
```

M1–M7 may ship in thin vertical slices, but a later semantic guarantee must not be simulated before its dependencies exist. For example, do not label a sequence of independent writes “atomic,” and do not call a checklist a verification receipt until evidence provenance is explicit.

## 2. Cross-cutting workstreams

Every milestone should advance these workstreams together:

| Workstream | Responsibility |
| --- | --- |
| **Domain contracts** | canonical types, identifiers, errors, state transitions, and compatibility |
| **Policy** | effects, risk classes, authority grants, approval boundaries, and cancellation |
| **Services** | context, query, mutation, execution, evidence, verification, and persistence logic |
| **Adapters** | Zustand, Monaco, IndexedDB, builder, sandbox protocol, and WebMCP transport |
| **Projections** | tool schemas, live guide, coach/tutorial metadata, activity UI, and generated docs |
| **Conformance** | deterministic contract, race, bounds, cancellation, fault, and compatibility tests |
| **Evaluation** | scenario outcomes, resource metrics, false-success tracking, and regressions |

A feature is not complete when only its transport adapter exists.

## 3. Milestone 0 — Establish vocabulary and baseline

### Goal

Make current behavior and target intent explicit, and establish measurements before optimizing the interface.

### Deliverables

- Adopt [Architecture](./ARCHITECTURE.md), [Contracts](./CONTRACTS.md), [Decisions](./DECISIONS.md), and [Evaluation](./EVALUATION.md) as the design set.
- Add repository guidance linking agent-system changes to these documents.
- Inventory every current WebMCP tool with:
  - input and output size limits;
  - side effects and reversibility;
  - current concurrency guard;
  - availability and truncation semantics;
  - guide/tutorial/activity projection;
  - tests and known gaps.
- Instrument the existing invocation wrapper with baseline counters that do not retain source or raw output:
  - calls, duration, serialized input/output bytes;
  - build and preview reload counts;
  - mutation bytes and affected path count;
  - failures by structured provisional category;
  - diagnostics/console/inspection availability;
  - operation completion claim where observable.
- Create a benchmark fixture set and independent task oracle described in Evaluation.
- Run the current system through the baseline scenarios and preserve results as comparison artifacts.

### Exit criteria

- Current and target statements are not conflated in docs or UI.
- Every current tool has an owner, effects classification, limit, and test mapping.
- Baseline scenario results include both task correctness and resource usage.
- No raw project source, prompts, or console payloads are added to telemetry.

### Likely code areas

`src/integrations/webmcp`, `tests/webmcp.test.mjs`, new test fixtures and evaluation scripts, root documentation.

## 4. Milestone 1 — Create the capability manifest and semantic seams

### Goal

Eliminate semantic drift and begin decomposing the current WebMCP bridge without changing public behavior.

### Deliverables

- Introduce a typed capability manifest with the fields in Contracts:
  - versioned schemas;
  - effects, risk, authority, concurrency, idempotency, reversibility;
  - cost and output bounds;
  - trust labels;
  - workflow roles;
  - human presentation metadata;
  - conformance requirements.
- Move the current nineteen tool declarations into manifest entries while preserving their names and wire behavior.
- Generate or mechanically project:
  - WebMCP registration definitions;
  - tool-name lists;
  - live agent-guide workflow metadata;
  - friendly activity labels;
  - a generated capability reference used by docs/tests.
- Split the current large bridge into initial boundaries:
  - contract and normalization utilities;
  - capability declarations;
  - invocation lifecycle wrapper;
  - project/editor adapter;
  - preview/evidence adapters.
- Move shared domain data out of integration-specific modules when both UI and agents consume it. Continue the Asset Brew registry pattern for examples, workflow steps, and other shared catalogs.
- Add a manifest conformance test that fails when a capability lacks required metadata or a projection.

### Exit criteria

- Existing nineteen tools pass their current tests without semantic change.
- No component maintains a separate hard-coded tool-to-friendly-label map.
- The live guide references capability IDs/workflow roles from the manifest rather than duplicating them.
- `kaplaygroundWebMCP.ts` is no longer the only place where schemas, policy hints, transport, and execution are intertwined.
- Generated output is deterministic and checked in only when repository policy requires it.

### Migration rule

This milestone changes source organization, not public capability meaning. Any behavior change discovered during extraction is handled as a separate fix with its own tests.

## 5. Milestone 2 — Make state and failures explicit

### Goal

Give agents precise state identifiers and deterministic recovery before adding stronger mutation capabilities.

### Deliverables

- Add canonical `WorkspaceRef` with:
  - `projectId`;
  - `workspaceEpoch` derived from active project replacement;
  - `contentRevision` derived from all build-relevant active project mutations.
- Continue returning current `projectRevision` as a compatibility alias for `workspaceEpoch`.
- Normalize file hashes as `artifactRevision` while retaining current `revision` aliases.
- Add `invocationId` and `operationId` to the invocation lifecycle.
- Introduce the standard result envelope internally and a structured error taxonomy.
- Convert common failures to stable error codes and recovery metadata:
  - workspace or artifact changed;
  - approval required;
  - capability unavailable;
  - bounds exceeded;
  - preview protocol mismatch/build/load failure;
  - evidence unavailable;
  - persistence failure;
  - cancellation.
- Add capability discovery/digest and compatibility/deprecation metadata.
- Make project replacement, same-project content change, active-file selection, preview run, and persistence transitions explicit in tests.
- Add app/sandbox protocol-range negotiation rather than one implicit exact version constant.

### Exit criteria

- A caller can distinguish project replacement from same-project content change without parsing strings.
- Every mutation checks the canonical identifiers relevant to its effect.
- Every recoverable failure offers a deterministic next action.
- Existing callers still work through aliases and receive deprecation warnings rather than changed semantics.
- An incompatible sandbox is rejected before project code is posted.

### Important restraint

Do not yet claim atomic multi-file mutation. This milestone provides the state model on which atomicity depends.

## 6. Milestone 3 — Build the economical context plane

### Goal

Reduce redundant calls and context transfer while improving grounding fidelity.

### Deliverables

#### Coherent orientation

- Add `get_context` as a composite read capability.
- Return one snapshot ID and workspace reference across guide, project, inventory, active artifact, preview, capability, and evidence summaries.
- Support include lists, byte/item budgets, `since` identifiers, unchanged markers, and explicit omission reasons.
- Make the default payload sufficient for common one-file tasks without including all file bodies.

#### Workspace query

- Add bounded path and text search first.
- Add symbol search using Monaco/TypeScript services where reliable.
- Add an approximate dependency/import index with explicit completeness and language support.
- Return ranked hits with exact paths, artifact revisions, bounded line ranges, snippets, and system-generated match reasons.

#### Multi-artifact reads

- Add batch and range reads against one workspace snapshot.
- Support `unchangedAsReference`, per-item bounds, and explicit truncation.
- Reject mutation planning from truncated whole-file content.

#### Delta reads

- Add cursors or `sinceRevision` support for:
  - artifact inventory;
  - diagnostics summaries;
  - console and activity events;
  - capability-manifest changes.

### Exit criteria

- The benchmark's common single-file tasks normally orient with one context call, one targeted query/read expansion at most, and no whole-project body transfer.
- Repeated reads of unchanged state return references/deltas rather than duplicate bodies.
- Search results remain snapshot-safe under concurrent editor changes.
- All approximation, unavailable indexing, truncation, and budget exhaustion are explicit.
- Median context bytes and non-redundant read calls improve against M0 without reducing independent task success.

### Compatibility

Keep `get_project`, `list_files`, `read_file`, example search, and asset search as focused aliases. Their implementations call the same context/query services.

## 7. Milestone 4 — Introduce atomic change sets and recovery

### Goal

Make one logical edit reviewable, all-or-none, and restorable across multiple artifacts.

### Deliverables

#### Domain transaction

- Create a project transaction service that operates on a cloned immutable snapshot and commits through one Zustand state transition.
- Ensure Monaco models and selection update from committed domain state rather than acting as an independent source of truth.
- Define how assets and project metadata participate in future transaction types.

#### Prepare

- Implement `prepare_change_set` with exact base workspace/artifact checks.
- Support initial operations:
  - unique exact-text replacement;
  - full-file replacement;
  - create, delete, and move file;
  - project metadata update where safe.
- Compute normalized proposal ID, diff, effect summary, risk, required approval, mutation bytes, and cheap validation findings without mutation.
- Bound diff output while retaining a complete internal proposal.

#### Apply

- Implement `apply_change_set` with immediate precondition recheck.
- Capture a checkpoint before commit.
- Apply all operations or none.
- Emit effect receipt and operation events with before/after revisions.
- Treat adapter failure after commit as a restore-required condition, not ordinary success.

#### Restore

- Implement `restore_checkpoint` with revision checks and operation disposition.
- Add a visible restore affordance for the latest applicable operation.
- Bound checkpoint count and bytes; define eviction behavior that never removes a checkpoint still required by an active operation.

#### Compatibility wrappers

- Route `replace_file`, `create_file`, and `remove_file` through one-operation prepare/apply flows.
- Preserve current expected revisions and return fields during deprecation.
- Canonical primitives do not run the preview as a hidden mutation option; compatibility wrappers may temporarily compose execution but must expose stages.

### Exit criteria

- Fault injection before every commit boundary produces no partial workspace.
- Fault injection after commit either restores automatically or returns a blocking restore receipt with the exact checkpoint.
- Concurrent human edits or project replacement reject the change set before mutation.
- Multi-file benchmark tasks never leave mixed old/new content.
- A user or agent can inspect the complete effect summary before destructive application.
- Restore returns the project to the checkpoint's semantic state and records a new content revision.

## 8. Milestone 5 — Normalize execution, evidence, and verification

### Goal

Close the loop with exact-run evidence and deterministic task receipts.

### Deliverables

#### Execution records

- Replace bare run results internally with `PreviewExecution` records tied to operation, workspace content revision, change set, build digest, and protocol version.
- Preserve acknowledged module load and explicit build/load failure.
- Bind pause/resume/stop requests to expected run IDs.

#### Evidence ledger

- Normalize current collectors into immutable records:
  - build;
  - Monaco diagnostics;
  - bounded console capture;
  - shallow scene inspection;
  - IndexedDB persistence acknowledgement.
- Add deterministic source and scene assertion collectors.
- Preserve availability, completeness, bounds, cursor, dropped count, collector version, workspace, and run.
- Add retention bounds and cleanup by operation without deleting active evidence.

#### Verification engine

- Implement versioned verification profiles and task-specific acceptance criteria.
- Evaluate each required criterion as passed, failed, or inconclusive.
- Issue receipts with exact evidence references and remaining uncertainty.
- Ensure unavailable, stale, wrong-run, or incomplete required evidence cannot pass.
- Expose `collect_evidence` and `verify_operation` as compact capabilities while retaining focused current collector aliases.

#### Report generation

- Generate a compact operation summary from effect and verification receipts:
  - what changed;
  - exact run verified;
  - criteria passed/failed/inconclusive;
  - remaining uncertainty;
  - whether the project was persisted or restored.

### Exit criteria

- No safety-suite scenario produces a false pass.
- Console or scene data from an older run cannot verify a newer change.
- Empty unavailable diagnostics are inconclusive, not clean.
- Every playable-change receipt links an exact applied revision, run, and required evidence records.
- Existing diagnostics/console/inspection tools are backed by the ledger and preserve current bounded responses.

## 9. Milestone 6 — Make operations legible and steerable to people

### Goal

Give the person the same coherent model the agent receives, without exposing implementation noise by default.

### Deliverables

- Group activity by operation rather than a flat list of tool invocations.
- Show a progressive operation timeline:
  - understanding;
  - inspecting;
  - proposed change;
  - approval if required;
  - applied artifacts;
  - run status;
  - verification verdict;
  - saved/restored disposition.
- Add approval surfaces for destructive, persistent, and external effects with complete scope and diff summary.
- Add cancel and restore controls with accurate stage semantics.
- Surface `inconclusive` distinctly from success and failure.
- Retain friendly coach language as a projection of the operation/workflow model.
- Keep advanced details available for paths, revisions, duration, bounds, errors, evidence IDs, and receipt details.
- Ensure the UI never displays raw unbounded file content or console payloads in activity history.

### Exit criteria

- A non-technical participant can tell what the agent is doing, what changed, whether it was verified, and how to undo it.
- An expert can inspect identifiers, effects, evidence, and structured errors without leaving the editor.
- Approval rejection or modification cleanly blocks/invalidates the pending change set.
- Cancellation and restore behavior matches the contracts under race tests.
- User research shows no regression in the play-first experience.

## 10. Milestone 7 — Add bounded accretion and continuous evaluation

### Goal

Let successful work improve the system without covert memory, semantic forks, or unreviewed behavior.

### Deliverables

#### Operation records

- Persist bounded, user-clearable operation records with objectives, criteria, IDs, effect summaries, receipts, metrics, failures, and disposition.
- Exclude source bodies, raw prompts, raw evidence, and hidden reasoning by default.
- Add explicit trace export for debugging with user control and redaction.

#### Promotion workflow

- Detect repeated structured patterns only as candidate suggestions.
- Provide a developer workflow to promote candidates into:
  - versioned recipes;
  - verification profiles/assertions;
  - example metadata;
  - Asset Brew/catalog annotations;
  - recovery guidance.
- Require de-identification, deterministic tests, review, and shared-registry publication.

#### Continuous evaluation

- Run scenario and fault suites in CI for contract-changing pull requests.
- Track benchmark history by capability/system version.
- Add drift checks between manifest, generated projections, docs, and tests.
- Add release gates for false success, atomicity, stale-state rejection, bounds, and protocol compatibility.

### Exit criteria

- Operational history is bounded, inspectable, clearable, and contains no unrestricted project content.
- No runtime behavior changes solely because a private session succeeded once.
- A promoted recipe is versioned, tested, and visible to both human and agent surfaces.
- CI reports correctness and resource regressions together.

## 11. Milestone 8 — Compose the proven fast path

### Goal

Use the established primitives to minimize round trips for common tasks without sacrificing legibility or control.

### Deliverables

- Add a manifest-declared composite workflow for a focused reversible change:
  1. orient from coherent context;
  2. targeted query/read;
  3. prepare and apply one change set;
  4. execute exact revision;
  5. collect profile evidence;
  6. issue receipt.
- Allow the agent to provide acceptance criteria and a budget in one operation request.
- Stream or emit stage events so the user can interrupt before apply, during execution, or before persistence.
- Preserve every component ID, effect, evidence record, failure stage, and receipt.
- Add planner hints from capability cost and risk metadata; do not embed an opaque autonomous planner into the domain service.
- Compare composite results against invoking primitives separately for semantic equivalence.

### Exit criteria

- Common benchmark tasks normally use one orientation, one targeted context expansion, one atomic application, one execution, and one verification capability.
- Median calls, context bytes, and latency improve by the targets in Evaluation with no decline in task success or safety gates.
- Composite cancellation, approval, conflict, failure, and restore behavior is indistinguishable from the underlying primitives.
- The system can always expand the composite into its visible stages for debugging and review.

## 12. Migration matrix

| Current concept | Transitional step | Target |
| --- | --- | --- |
| hand-built tool declarations | manifest wraps current handlers | generated WebMCP projection |
| `projectRevision` as project-generation guard | return alias plus canonical field | `workspaceEpoch` |
| current internal numeric project revision | expose opaque content identifier | `contentRevision` |
| file `revision` | return alias plus canonical field | `artifactRevision` |
| individual replace/create/remove | compatibility wrapper prepares/applies one operation | atomic multi-operation change set |
| optional run inside write tool | expose explicit sub-stage during compatibility | separate canonical execution |
| preview result | enrich with workspace/change-set/protocol | execution record |
| diagnostics/console/scene responses | emit evidence in parallel | evidence-ledger aliases |
| flat tool activity | attach operation IDs/events | operation timeline and receipts |
| hand-authored guide workflow | derive tool roles from manifest | generated workflow projection plus curated human copy |
| no retained operation model | transient in-memory operation | bounded user-clearable operation record |

## 13. Pull-request slicing

Prefer end-to-end slices that leave the repository releasable. Examples:

- one PR introduces the manifest and migrates three read-only tools plus generated labels;
- one PR exposes canonical workspace identifiers behind compatibility aliases and updates all mutation tests;
- one PR adds path/text query with context budgets and benchmark instrumentation;
- one PR adds prepare/apply for replace-file only, then later expands operation types;
- one PR normalizes diagnostics into evidence and proves unavailable semantics before moving console and scene collectors.

Avoid PRs that introduce unused abstract frameworks with no current capability exercising them. Also avoid mixing a contract migration, UI redesign, and unrelated game feature in one change.

## 14. Required checks by change type

| Change | Minimum checks |
| --- | --- |
| manifest metadata or projection | generated-output determinism, manifest conformance, current tool contract tests |
| identifier or result-envelope semantics | compatibility tests, stale-state races, docs and decision review |
| context/query | snapshot races, bounds/truncation, relevance fixtures, byte/call benchmarks |
| mutation transaction | fault injection, concurrent edit, cancellation, checkpoint/restore, Monaco projection |
| preview protocol | app and sandbox builds, compatibility matrix, old/new mismatch tests, coordinated deployment |
| evidence collector | availability, wrong-run/stale data, bounds/dropped data, untrusted payload isolation |
| verification profile | false-pass suite, criterion oracle, profile versioning |
| approval/policy | authority matrix, rejection/expiry races, human UI accessibility |
| operation retention | privacy/redaction review, quota/eviction, clear/export behavior |

Continue running `npm run verify:webmcp` for changes touching the existing bridge or preview path. Extend it or add a successor verification command as generated contracts and evaluation suites mature; do not quietly drop the current checks.

## 15. Non-goals

The roadmap does not propose:

- replacing human judgment with an autonomous quality score;
- exposing arbitrary browser, network, filesystem, deployment, or shell powers through KAPLAYGROUND;
- storing raw conversations or private reasoning as product memory;
- treating project text as instructions;
- removing focused example or Asset Brew discovery merely to force everything through one generic query;
- requiring the user to understand revisions, receipts, or manifests before playing;
- guaranteeing pixel-perfect visual correctness from shallow scene metadata;
- optimizing for minimum tool count at the expense of evidence;
- a big-bang state-management rewrite unrelated to the required transactional seams.

## 16. End-state acceptance

The roadmap is complete when an agent can, for a typical request:

1. receive a coherent minimal picture of the active game and supported capabilities;
2. find the relevant source and dependencies without reading the whole project;
3. form one bounded, reviewable, authority-valid change set;
4. apply it atomically with a restorable checkpoint;
5. run the exact resulting revision in a compatible sandbox;
6. collect fresh independent evidence under explicit bounds;
7. receive a deterministic verification receipt;
8. communicate the outcome and uncertainty clearly to the person;
9. persist only with appropriate authority;
10. leave behind a compact record that can improve evaluation and, after review, the shared system.

That is the coherent system promised by the architecture: understand just enough, act exactly, prove the result, and compound the knowledge safely.
