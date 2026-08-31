# Agent-system contracts

> **Status:** Target contract for the system described in [Architecture](./ARCHITECTURE.md). The final section maps the current nineteen WebMCP tools onto this model. Names and shapes in this document are design commitments, not claims that every target capability is already implemented.

The contracts make the system legible to an agent without forcing it to reverse-engineer editor internals. They also let human UI, policy, tests, documentation, and evaluation speak the same language.

## 1. Contract principles

1. **Identity before content.** Every stateful result identifies the workspace and revision it describes.
2. **Effects before convenience.** A capability declares what it can change before advertising how easy it is to call.
3. **Atomicity before automation.** Strong multi-step tools compose safe primitives; they do not hide partial work.
4. **Evidence before success.** A mutation or run result is an effect receipt, not a verification receipt.
5. **Bounds before payload.** Potentially large data declares its limit, total, truncation, and dropped data.
6. **Unavailable before empty.** Missing collection is represented explicitly and never normalized into a clean result.
7. **Compatibility before renaming.** Existing WebMCP callers receive a migration period when identifiers or capability names become more precise.
8. **One declaration before many projections.** The capability manifest drives tools, guide metadata, UI labels, docs, conformance cases, and evaluation instrumentation.

## 2. Canonical identifiers

Identifiers are opaque strings unless a contract explicitly says otherwise. Callers compare them for equality; they do not parse them.

```ts
interface WorkspaceRef {
  projectId: string | null;
  workspaceEpoch: string;
  contentRevision: string;
}

interface ArtifactRef {
  path: string;
  artifactRevision: string;
  workspace: WorkspaceRef;
}

interface OperationRef {
  operationId: string;
}

interface ChangeSetRef {
  changeSetId: string;
  baseWorkspace: WorkspaceRef;
}

interface RunRef {
  runId: string;
  workspace: WorkspaceRef;
  changeSetId: string | null;
  previewProtocolVersion: number;
}
```

### Identifier semantics

| Identifier | Changes when | Does not change merely because |
| --- | --- | --- |
| `projectId` | a transient project is persisted under a new durable identity, or a different stored project is opened | a file is edited |
| `workspaceEpoch` | the active logical project is replaced, including opening another example | content inside the same active project changes |
| `contentRevision` | any file, asset, project metadata, or build-relevant configuration changes | the active file selection changes |
| `artifactRevision` | that exact artifact's semantic content changes | another artifact changes |
| `operationId` | a new bounded user task begins | the operation enters another phase |
| `changeSetId` | a materially different proposed mutation is prepared | the same proposal is displayed again |
| `checkpointId` | a new restorable pre-change state is captured | verification runs |
| `runId` | a new preview execution is requested | evidence is collected from that run |
| `evidenceId` | a collector emits a new immutable observation record | the same record is read again |
| `receiptId` | a verification pass is evaluated again or against different evidence | a receipt is displayed again |

### Current compatibility

The current public WebMCP field named `projectRevision` is an opaque project-replacement guard derived from `projectGeneration`; it is closest to target `workspaceEpoch`. Current file `revision` values are content-derived and are closest to `artifactRevision`.

During migration:

- continue accepting `expectedProjectRevision` as an alias for `expectedWorkspaceEpoch`;
- return both fields with identical values for at least one capability-contract version;
- introduce `contentRevision` separately rather than changing the meaning of the old value in place;
- emit a machine-readable deprecation warning;
- update the live guide before removing the alias.

## 3. Standard result envelope

All target capabilities return a common envelope internally. A transport may convert an error outcome into a thrown tool error, but logs, activity, tests, and other projections retain the structured form.

```ts
interface CapabilityResult<T> {
  contractVersion: string;
  capability: { id: string; version: string };
  invocationId: string;
  operationId: string | null;
  outcome: "ok" | "error" | "cancelled";
  workspace: WorkspaceRef | null;
  data: T | null;
  effects: EffectReceipt[];
  warnings: ContractWarning[];
  bounds: ResultBounds | null;
  error: AgentSystemError | null;
  next: SuggestedNextAction[];
}

interface ResultBounds {
  total: number | null;
  returned: number;
  maxItems: number | null;
  maxBytes: number | null;
  truncated: boolean;
  droppedCount: number;
  cursor: string | null;
}
```

`next` contains deterministic recovery or workflow hints, not open-ended instructions extracted from project content. Examples include “re-read the changed artifact,” “request approval to replace unsaved work,” or “collect diagnostics for run X.”

### Effect receipts

```ts
interface EffectReceipt {
  kind:
    | "workspace_changed"
    | "selection_changed"
    | "preview_started"
    | "preview_paused"
    | "preview_stopped"
    | "project_persisted"
    | "external_effect";
  status: "committed" | "not_committed" | "restored";
  before: WorkspaceRef | null;
  after: WorkspaceRef | null;
  artifacts: Array<{
    path: string;
    beforeRevision: string | null;
    afterRevision: string | null;
  }>;
  checkpointId: string | null;
  runId: string | null;
  summary: string;
}
```

A successful effect receipt proves that the requested state transition occurred. It does not prove that the user's goal was achieved.

## 4. Capability manifest

The capability manifest is the single declarative registry from which WebMCP tool definitions and other projections are generated.

```ts
interface CapabilityManifestEntry {
  id: string;
  version: string;
  title: string;
  summary: string;
  category:
    | "orientation"
    | "query"
    | "change"
    | "execution"
    | "evidence"
    | "verification"
    | "persistence"
    | "control";

  inputSchema: object;
  outputSchema: object;

  effects: {
    workspace: "none" | "selection" | "reversible" | "destructive";
    runtime: "none" | "control" | "reload";
    persistence: "none" | "local";
    external: "none" | "declared";
  };

  authority: {
    riskClass: RiskClass;
    defaultPolicy: ApprovalPolicy;
    grantScope: "invocation" | "change_set" | "operation";
  };

  concurrency: {
    scope: "none" | "artifact" | "workspace" | "runtime";
    requiredPreconditions: string[];
    cancellation: "safe" | "checkpoint_restore" | "not_supported";
  };

  idempotency: "idempotent" | "conditional" | "non_idempotent";
  reversibility: "not_applicable" | "checkpoint" | "manual" | "irreversible";

  cost: {
    latencyClass: "instant" | "interactive" | "build" | "external";
    readsAllArtifacts: boolean;
    reloadsPreview: boolean;
    expectedOutputClass: "tiny" | "small" | "bounded_large";
  };

  bounds: {
    maxInputBytes?: number;
    maxOutputBytes?: number;
    maxItems?: number;
    defaultItems?: number;
  };

  trust: {
    returnsUntrustedContent: boolean;
    acceptsProjectContent: boolean;
    redactionPolicy: string;
  };

  workflowRoles: Array<
    "orient" | "inspect" | "prepare" | "apply" | "execute" | "observe" |
    "verify" | "persist" | "recover"
  >;

  presentation: {
    humanLabel: string;
    runningLabel: string;
    successLabel: string;
    failureLabel: string;
    advancedDescription: string;
  };

  conformance: {
    requiredCases: string[];
    evaluationScenarios: string[];
  };
}
```

### Manifest rules

- Capability IDs and versions are stable and separately versioned from the app release.
- A registered capability without policy, bounds, presentation, and conformance metadata is a build failure.
- Human labels are semantic projections, not a second mapping maintained in a component.
- Tool descriptions may include workflow guidance from the manifest but cannot loosen policy.
- Runtime support is advertised through a capability digest so the agent can avoid calling unavailable or incompatible features.
- Composite capabilities list the primitive capabilities and stages they compose.

## 5. Authority, risk, and approval

An agent cannot mint its own authority. Authority originates in the user's current request, an explicit approval interaction, or a narrowly scoped product policy the user has already accepted.

```ts
type RiskClass =
  | "observe"
  | "reversible_workspace"
  | "destructive_workspace"
  | "persistent"
  | "external";

type ApprovalPolicy =
  | "implicit_from_task"
  | "explicit_if_unsaved"
  | "explicit_always"
  | "not_permitted";

interface AuthorityGrant {
  grantId: string;
  source: "user_request" | "user_approval" | "product_policy";
  operationId: string;
  permits: string[];
  constraints: string[];
  expiresAfter: "invocation" | "change_set" | "operation";
  issuedAt: string;
}
```

### Default policy

| Risk class | Examples | Default |
| --- | --- | --- |
| `observe` | read context, search, diagnostics, console, scene inspection | allowed within the active task |
| `reversible_workspace` | atomic file edits with checkpoint | implicit only when they directly implement the request |
| `destructive_workspace` | delete/move files, replace active example, discard unsaved changes | explicit when data loss or replacement is possible |
| `persistent` | save a transient project, publish a reusable recipe | explicit in the user request or dedicated approval |
| `external` | deploy, share, network side effect beyond declared asset retrieval | explicit always and separately scoped |

A broad request such as “make the game better” permits relevant reversible edits; it does not authorize opening a different example, discarding unsaved work, publishing, or deploying.

## 6. Operation contract

An operation is the unit of intent, authority, accounting, interruption, evidence, and final reporting.

```ts
interface Operation {
  operationId: string;
  status:
    | "active"
    | "blocked"
    | "applying"
    | "executing"
    | "verifying"
    | "passed"
    | "failed"
    | "inconclusive"
    | "cancelled"
    | "restored";

  objective: string;
  constraints: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  authorityGrants: AuthorityGrant[];

  baseWorkspace: WorkspaceRef;
  currentWorkspace: WorkspaceRef;

  budget: OperationBudget;
  usage: OperationUsage;

  activeChangeSetId: string | null;
  latestRunId: string | null;
  latestReceiptId: string | null;

  startedAt: string;
  updatedAt: string;
}

interface OperationBudget {
  maxContextBytes: number | null;
  maxToolCalls: number | null;
  maxBuilds: number | null;
  maxMutationBytes: number | null;
  maxElapsedMs: number | null;
}

interface OperationUsage {
  contextBytes: number;
  toolCalls: number;
  builds: number;
  mutationBytes: number;
  elapsedMs: number;
}
```

The product may construct an operation automatically from the current user request; the user should not have to complete a planning form. The record contains the concise objective, constraints, criteria, and effects needed for control and audit. It does not contain hidden reasoning or unrestricted conversation transcripts.

### Acceptance criteria

```ts
interface AcceptanceCriterion {
  criterionId: string;
  statement: string;
  source: "user" | "system_invariant" | "workflow_profile";
  required: boolean;
  evaluator:
    | { kind: "diagnostics"; predicate: string }
    | { kind: "console"; predicate: string }
    | { kind: "scene"; predicate: string }
    | { kind: "source"; predicate: string }
    | { kind: "build"; predicate: string }
    | { kind: "assertion"; assertionId: string }
    | { kind: "manual"; prompt: string };
}
```

Criteria must be observable. “Make it fun” can remain a user-judgment criterion, while its implementation is decomposed into automatic criteria such as preserving controls, loading successfully, and showing a requested feedback object.

## 7. Orientation and context

### `get_context`

The target orientation capability returns a coherent, budgeted digest instead of requiring several always-repeated calls.

```ts
interface GetContextInput {
  operationId?: string;
  include?: Array<
    "guide" | "capabilities" | "project" | "artifact_inventory" |
    "active_artifact" | "preview" | "evidence_summary" | "operation"
  >;
  since?: {
    workspaceEpoch?: string;
    contentRevision?: string;
    capabilityDigest?: string;
    activityCursor?: string;
  };
  budget?: {
    maxBytes?: number;
    maxArtifacts?: number;
    activeArtifactMaxBytes?: number;
  };
}
```

The result contains:

- a `snapshotId` and one `WorkspaceRef` shared by all workspace-derived sections;
- capability digest and relevant deltas;
- project identity, storage state, example origin, build mode, active file, unsaved state, and preview state;
- bounded artifact inventory with revisions and sizes;
- active artifact content only when requested and within budget;
- latest run and evidence availability summary;
- omitted sections with explicit reasons: `not_requested`, `unchanged`, `budget_exhausted`, or `unavailable`.

If the workspace changes while the context is assembled, the capability retries within a small bound or returns `WORKSPACE_CHANGED`; it never combines metadata from one project with files from another.

### Progressive disclosure

The orientation result should be sufficient for common one-file tasks but should not dump every file body. An agent expands context through `query_workspace` and `read_artifacts` only where uncertainty remains.

## 8. Workspace query and read contracts

### `query_workspace`

```ts
interface QueryWorkspaceInput {
  workspace: WorkspaceRef;
  query: string;
  modes: Array<"path" | "text" | "symbol" | "dependency">;
  scope?: { paths?: string[]; kinds?: string[]; languages?: string[] };
  options?: {
    caseSensitive?: boolean;
    exact?: boolean;
    includeSnippets?: boolean;
    contextLines?: number;
    maxResults?: number;
    maxBytes?: number;
  };
}

interface WorkspaceQueryHit {
  path: string;
  artifactRevision: string;
  mode: "path" | "text" | "symbol" | "dependency";
  rank: number;
  reason: string;
  range: { startLine: number; endLine: number } | null;
  snippet: string | null;
  snippetTruncated: boolean;
}
```

Search results are untrusted project content. `reason` is system-generated, such as `exact_symbol`, `text_match`, `imports_candidate`, or `referenced_by_candidate`.

Dependency results may be approximate when static analysis is incomplete. Approximation and unsupported languages are explicit; the result must not imply a complete dependency graph when one was not built.

### `read_artifacts`

```ts
interface ReadArtifactsInput {
  workspace: WorkspaceRef;
  requests: Array<{
    path: string;
    expectedArtifactRevision?: string;
    ranges?: Array<{ startLine: number; endLine: number }>;
  }>;
  maxBytes: number;
  unchangedAsReference?: boolean;
}
```

The capability supports multiple exact paths and ranges in one coherent read. Each item reports:

- path, language, kind, byte size, and artifact revision;
- requested ranges and actual returned ranges;
- content or an `unchanged` marker;
- per-item truncation;
- import/dependency hints when available;
- the common workspace snapshot.

A range request never silently returns a different file revision. A whole-file mutation cannot be based on truncated content.

## 9. Change-set contract

The target mutation primitive is an atomic change set, not a sequence of unrelated file writes.

### Prepare without mutation

```ts
interface PrepareChangeSetInput {
  operationId: string;
  baseWorkspace: WorkspaceRef;
  summary: string;
  operations: ChangeOperation[];
  validationProfile?: string;
  maxDiffBytes?: number;
}

type ChangeOperation =
  | {
      kind: "replace_text";
      path: string;
      expectedArtifactRevision: string;
      before: string;
      after: string;
      occurrence: "unique";
    }
  | {
      kind: "replace_file";
      path: string;
      expectedArtifactRevision: string;
      content: string;
    }
  | {
      kind: "create_file";
      path: string;
      expectedAbsent: true;
      content: string;
      language?: string;
      fileKind?: string;
    }
  | {
      kind: "delete_file";
      path: string;
      expectedArtifactRevision: string;
    }
  | {
      kind: "move_file";
      from: string;
      to: string;
      expectedArtifactRevision: string;
      expectedDestinationAbsent: true;
    }
  | {
      kind: "update_project_metadata";
      expectedContentRevision: string;
      patch: Record<string, unknown>;
    };
```

`prepare_change_set` performs no mutation. It:

- validates authority, paths, sizes, schemas, and exact revisions;
- ensures every `replace_text.before` match is unique;
- computes the complete post-change workspace in memory;
- runs cheap syntax, structural, or project invariants selected by the validation profile;
- computes a bounded unified diff and per-artifact effect summary;
- estimates mutation bytes and build cost;
- assigns a stable `changeSetId` from the normalized proposal and base revisions;
- returns `ready`, `needs_approval`, or `invalid` with structured findings.

A caller cannot apply an unprepared or materially modified change set under the same ID.

### Apply atomically

```ts
interface ApplyChangeSetInput {
  operationId: string;
  changeSetId: string;
  expectedBaseWorkspace: WorkspaceRef;
  authorityGrantIds: string[];
  selectPath?: string;
}

interface ApplyChangeSetResult {
  changeSetId: string;
  checkpointId: string;
  before: WorkspaceRef;
  after: WorkspaceRef;
  artifacts: Array<{
    path: string;
    effect: "created" | "updated" | "deleted" | "moved";
    beforeRevision: string | null;
    afterRevision: string | null;
  }>;
}
```

Application rules:

1. Recheck workspace epoch, content revision, artifact revisions, and authority immediately before commit.
2. Capture a restorable checkpoint.
3. Construct and validate all resulting state before exposing any of it.
4. Commit the full change set through one domain transaction.
5. Update editor models and selection as projections of the committed domain state.
6. On pre-commit failure, expose no mutation.
7. On post-commit adapter failure, restore the checkpoint or return a blocking `RESTORE_REQUIRED` error with the checkpoint ID. Never report partial success as an ordinary `ok` result.
8. Return the new content and artifact revisions.

Execution is a separate primitive. A future fast-path composite may prepare, apply, execute, and verify, but it must expose each stage and cannot reinterpret a failed verification as a successful change.

### Restore

`restore_checkpoint` is itself a revision-checked, recorded state transition. It restores the exact captured state when the active workspace is still compatible, creates a new content revision, and marks the affected operation `restored`. It does not erase the change or its evidence from the bounded operation record.

## 10. Execution contract

### `execute_preview`

```ts
interface ExecutePreviewInput {
  operationId: string;
  workspace: WorkspaceRef;
  changeSetId?: string;
  mode?: "run" | "build_only";
  timeoutMs?: number;
}

interface PreviewExecution {
  runId: string;
  status: "loaded" | "build_failed" | "load_failed" | "cancelled";
  workspace: WorkspaceRef;
  changeSetId: string | null;
  buildArtifactDigest: string | null;
  previewProtocolVersion: number;
  startedAt: string;
  acknowledgedAt: string | null;
  errorEvidenceId: string | null;
}
```

The system rejects execution when the supplied workspace no longer matches the active content revision. The sandbox acknowledges the protocol and run before the result becomes `loaded`. Build or load failure still creates an execution record and evidence; it does not disappear as a generic exception.

Preview controls accept an expected `runId` when run-specific behavior matters. A pause acknowledgement for another run cannot satisfy the request. Inspection and console collection default to the operation's latest run, but responses always state the actual run ID.

App and sandbox advertise protocol ranges. Incompatible ranges fail before project code is sent.

## 11. Evidence ledger

Evidence is immutable, provenance-carrying, bounded, and linked to the exact state it observed.

```ts
interface EvidenceRecord<T = unknown> {
  evidenceId: string;
  kind:
    | "build"
    | "diagnostics"
    | "console"
    | "scene"
    | "assertion"
    | "visual"
    | "persistence";
  collector: { id: string; version: string };
  operationId: string;
  workspace: WorkspaceRef;
  runId: string | null;
  observedAt: string;
  available: boolean;
  complete: boolean;
  freshness: "current" | "superseded" | "stale";
  bounds: ResultBounds;
  payload: T | null;
  warnings: ContractWarning[];
}
```

### Collector rules

- **Build evidence** reports compilation/bundling outcome for a content revision.
- **Diagnostics evidence** reports Monaco availability separately from diagnostic count.
- **Console evidence** reports capture availability, run scope, response truncation, and buffer eviction.
- **Scene evidence** reports inspection availability, run, scene, viewport, object counts, object truncation, and filter semantics.
- **Assertion evidence** evaluates deterministic, versioned predicates against source or runtime state.
- **Visual evidence** is optional future evidence; when unsupported, it is unavailable rather than fabricated from scene metadata.
- **Persistence evidence** confirms IndexedDB acknowledgement for the expected revision.

Evidence payloads are treated as untrusted data. Project strings in console or scene objects cannot alter capability policy, workflow, or acceptance criteria.

### Freshness

- `current` means the evidence matches the workspace revision and run currently selected for verification.
- `superseded` means it remains valid historical evidence for its recorded run but a newer run or revision exists.
- `stale` means the claimed provenance cannot be established or an adapter returned data outside the requested scope.

Verification may deliberately evaluate historical evidence for a historical operation, but a receipt claiming the active result must use current evidence.

## 12. Verification receipt

Verification turns acceptance criteria and evidence into deterministic, inspectable verdicts.

```ts
type CriterionVerdict = "passed" | "failed" | "inconclusive" | "not_applicable";

interface CriterionResult {
  criterionId: string;
  statement: string;
  verdict: CriterionVerdict;
  evidenceIds: string[];
  explanation: string;
  expected: unknown | null;
  observed: unknown | null;
}

interface VerificationReceipt {
  receiptId: string;
  operationId: string;
  workspace: WorkspaceRef;
  runId: string | null;
  changeSetId: string | null;
  verifier: { id: string; version: string };
  profile: string;
  verdict: "passed" | "failed" | "inconclusive";
  criteria: CriterionResult[];
  evidenceIds: string[];
  issuedAt: string;
  remainingUncertainty: string[];
}
```

### Verdict rules

- The receipt is `failed` when any required criterion fails.
- Otherwise it is `inconclusive` when any required criterion is inconclusive or required evidence is unavailable, incomplete beyond the profile's allowance, stale, or from the wrong run/revision.
- It is `passed` only when every required applicable criterion passes.
- Optional criteria cannot convert a required failure into a pass.
- An agent's narrative judgment is not evidence. It may explain a receipt or clearly label an inference, but it cannot manufacture a criterion verdict.
- A clean diagnostics result proves only the diagnostics criterion. A loaded preview proves only the execution criterion. Independent criteria remain independent.

### Verification profiles

Profiles provide reusable system invariants while operations add task-specific criteria.

| Profile | Required baseline evidence |
| --- | --- |
| `source_change` | exact applied revisions, selected source assertions, diagnostics availability |
| `playable_change` | applied revisions, loaded exact run, diagnostics, console for that run, task-specific scene/assertion evidence |
| `runtime_only` | exact run, console, requested scene/assertion evidence |
| `persistence` | prior verification receipt plus persistence acknowledgement for the same content revision |

A profile is versioned. Changing what `playable_change` means changes its version and evaluation cases.

## 13. Structured errors

```ts
interface AgentSystemError {
  code: ErrorCode;
  stage:
    | "orient" | "query" | "prepare" | "approve" | "apply" |
      "execute" | "collect" | "verify" | "persist" | "restore";
  message: string;
  retryable: boolean;
  expected: unknown | null;
  actual: unknown | null;
  affectedPaths: string[];
  checkpointId: string | null;
  recovery: SuggestedNextAction[];
  causeId: string | null;
}

type ErrorCode =
  | "WORKSPACE_CHANGED"
  | "CONTENT_CHANGED"
  | "ARTIFACT_CHANGED"
  | "ARTIFACT_NOT_FOUND"
  | "ARTIFACT_ALREADY_EXISTS"
  | "AMBIGUOUS_EDIT"
  | "VALIDATION_FAILED"
  | "APPROVAL_REQUIRED"
  | "AUTHORITY_EXPIRED"
  | "CAPABILITY_UNAVAILABLE"
  | "LIMIT_EXCEEDED"
  | "BUDGET_EXHAUSTED"
  | "PREVIEW_PROTOCOL_MISMATCH"
  | "PREVIEW_BUILD_FAILED"
  | "PREVIEW_LOAD_FAILED"
  | "EVIDENCE_UNAVAILABLE"
  | "EVIDENCE_STALE"
  | "PERSISTENCE_FAILED"
  | "RESTORE_REQUIRED"
  | "RESTORE_CONFLICT"
  | "CANCELLED"
  | "INTERNAL_ADAPTER_ERROR";
```

Errors should tell the agent exactly what can be retried and what must be re-read or approved. They must not leak unrestricted source, secrets, or raw exception objects.

### Cancellation semantics

- Queries stop and return `cancelled` with no effects.
- Preparing a change set stops with no effects.
- Applying a change set is all-or-none; cancellation before commit aborts, and cancellation after commit returns the committed effect rather than pretending nothing happened.
- Preview execution cancels the run session and records cancellation evidence.
- Verification may be retried from already collected immutable evidence.

## 14. Operation events and human activity

The activity UI consumes structured operation events rather than reconstructing meaning from tool names.

```ts
interface OperationEvent {
  eventId: string;
  operationId: string;
  invocationId: string | null;
  phase:
    | "oriented" | "inspected" | "prepared" | "approval_requested" |
      "applied" | "executed" | "evidence_collected" | "verified" |
      "persisted" | "cancelled" | "restored";
  status: "started" | "succeeded" | "failed" | "blocked";
  timestamp: string;
  durationMs: number | null;
  summary: string;
  workspace: WorkspaceRef | null;
  changeSetId: string | null;
  runId: string | null;
  evidenceIds: string[];
  receiptId: string | null;
  errorCode: ErrorCode | null;
  metrics: Record<string, number>;
}
```

The human projection shows friendly action, affected artifacts, status, duration, approval requests, verification verdict, and restore affordance. Advanced details expose normalized inputs and identifiers under bounds. Full source replacements, raw console payloads, and private reasoning are not copied into the activity log.

## 15. Bounded operation records and accretion

A completed operation may be retained locally as:

```ts
interface OperationRecord {
  recordVersion: string;
  operationId: string;
  objective: string;
  constraints: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  baseWorkspace: WorkspaceRef;
  finalWorkspace: WorkspaceRef;
  capabilityVersions: Array<{ id: string; version: string }>;
  changeSummary: string;
  affectedArtifacts: string[];
  checkpointId: string | null;
  runIds: string[];
  receiptId: string | null;
  finalVerdict: "passed" | "failed" | "inconclusive" | "cancelled" | "restored";
  metrics: OperationUsage;
  structuredFailures: ErrorCode[];
  disposition: "discarded" | "kept" | "restored" | "promoted";
  startedAt: string;
  completedAt: string;
}
```

Retention is bounded by count and bytes and is user-clearable. Records omit source bodies, raw prompts, and raw evidence payloads. Exporting a full diagnostic trace is an explicit user action.

A reusable recipe can be proposed from repeated successful records, but it becomes active only after de-identification, versioning, deterministic tests, review, and publication through the shared registry.

## 16. Versioning and compatibility

There are four independent compatibility surfaces:

1. **Capability contract version** — input, output, effects, and error semantics for one capability.
2. **System contract version** — shared envelopes, identifiers, evidence, and operation records.
3. **Preview protocol version range** — app/sandbox message compatibility.
4. **Persistence schema version** — local durable project and operation-record format.

Rules:

- Additive optional fields are backward-compatible within a major version.
- Changing field meaning, required authority, atomicity, verification semantics, or error meaning requires a major capability version.
- Capability discovery reports supported versions and deprecations.
- The app rejects an incompatible sandbox before sending user code.
- Persisted records carry their schema version and migrate without weakening provenance.
- Compatibility adapters live at transport or persistence boundaries; the domain model uses canonical names.

## 17. Minimal target capability surface

The system does not need one direct tool per internal service. A compact target projection can expose:

| Capability | Purpose | Composes |
| --- | --- | --- |
| `get_context` | coherent orientation and delta digest | guide, project, manifest, inventory, preview/evidence summary |
| `query_workspace` | economical path/text/symbol/dependency discovery | indexes and bounded snippets |
| `read_artifacts` | coherent multi-file/range reads | exact artifact revisions |
| `prepare_change_set` | validate and preview a logical mutation | policy, revisions, in-memory transaction, diff |
| `apply_change_set` | atomically commit a prepared mutation | authority, checkpoint, domain transaction |
| `restore_checkpoint` | reverse a committed change | checkpoint and revision checks |
| `execute_preview` | build/run one exact revision | builder and versioned sandbox protocol |
| `control_preview` | pause/resume/stop an exact run | acknowledged runtime control |
| `collect_evidence` | collect selected independent observations | build, diagnostics, console, scene, assertions |
| `verify_operation` | issue a criterion-by-criterion receipt | operation, evidence ledger, verifier profiles |
| `persist_project` | durably keep an approved verified revision | IndexedDB acknowledgement |

Example and Asset Brew discovery remain domain-query capabilities and may appear as focused shortcuts when their semantic catalogs are useful. The manifest determines whether a shortcut or the generic query surface is the more economical projection.

## 18. Current-to-target mapping

| Current WebMCP tool | Target role | Migration note |
| --- | --- | --- |
| `kaplayground_get_agent_guide` | `get_context.guide` | keep focused alias while clients migrate |
| `kaplayground_get_project` | `get_context.project` | add explicit workspace/content identifiers |
| `kaplayground_list_examples` | domain catalog query | retain as economical focused discovery |
| `kaplayground_open_example` | destructive workspace change | require operation authority and return new workspace epoch |
| `kaplayground_list_files` | context inventory / workspace query | add artifact revisions and deltas |
| `kaplayground_read_file` | `read_artifacts` | preserve exact-path alias; add ranges and batches |
| `kaplayground_list_assets` | domain inventory query | derive from shared asset registry |
| `kaplayground_search_asset_brew` | domain catalog query | existing shared human/agent registry is the model to retain |
| `kaplayground_replace_file` | prepare/apply one-operation change set | retain compatibility wrapper; stop coupling mutation and run in the canonical primitive |
| `kaplayground_create_file` | prepare/apply one-operation change set | compatibility wrapper |
| `kaplayground_remove_file` | destructive change set | add checkpoint and explicit risk metadata |
| `kaplayground_select_file` | selection effect | lightweight control capability |
| `kaplayground_run_preview` | `execute_preview` | bind to exact content revision and execution record |
| `kaplayground_set_preview_paused` | `control_preview` | bind acknowledgement to expected run |
| `kaplayground_stop_preview` | `control_preview` | record run transition |
| `kaplayground_inspect_preview` | scene evidence collector | normalize into evidence ledger |
| `kaplayground_get_diagnostics` | diagnostics evidence collector | normalize availability/freshness/bounds |
| `kaplayground_get_console` | console evidence collector | normalize run scope, cursor, truncation, and eviction |
| `kaplayground_save_project` | `persist_project` | require exact content revision and persistence evidence |

Compatibility wrappers may continue to register nineteen familiar tool names. Internally they should call the same domain services as the target capabilities so behavior does not fork.

## 19. Conformance obligations

Every capability must have contract tests for applicable cases:

- valid success and exact result envelope;
- stale workspace, content, and artifact revisions;
- unsupported capability or protocol;
- authority missing or expired;
- input and output bounds;
- truncation and dropped-data reporting;
- cancellation at each meaningful stage;
- adapter failure before and after a commit boundary;
- untrusted-content isolation;
- deterministic structured errors;
- human presentation metadata presence;
- operation events and metrics;
- compatibility alias behavior;
- evidence and receipt provenance.

The system-level scenario suite is defined in [Evaluation](./EVALUATION.md).