# Agent operating protocol

> **Status:** Normative companion to [Architecture](./ARCHITECTURE.md) and [Contracts](./CONTRACTS.md). This document specifies how an agent should form, execute, retry, exercise, verify, and recover one operation. It adds detail to the canonical contracts without advertising unimplemented target capabilities as current behavior.

A good control surface is not only a set of safe commands. It is an operating protocol that lets an agent answer, at every point:

- What is the user's actual objective?
- Which facts are observed, which are assumptions, and which require a human decision?
- Which exact workspace and runtime state am I controlling?
- Can this invocation be retried without duplicating an effect?
- What is the least sufficient next observation or action?
- How will I exercise the requested behavior rather than merely look at source?
- What evidence would falsify my current belief that the task succeeded?
- How do I stop, resume, or restore without hidden partial work?

## 1. Operation prelude: intent without hidden ambiguity

An operation begins with a compact, inspectable intent model. This is not private reasoning and must not become a transcript. It contains only the control facts required to keep the task aligned.

```ts
interface OperationIntent {
  objective: string;
  constraints: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  assumptions: OperationAssumption[];
  decisions: OperationDecision[];
  authorityGrantIds: string[];
}

interface OperationAssumption {
  assumptionId: string;
  statement: string;
  source: "user" | "project_observation" | "system_default" | "agent_inference";
  confidence: "high" | "medium" | "low";
  impact: "low" | "medium" | "high";
  reversibility: "easy" | "checkpoint" | "difficult" | "irreversible";
  status: "active" | "confirmed" | "rejected" | "superseded";
  invalidates: Array<"plan" | "change_set" | "run" | "receipt">;
}

interface OperationDecision {
  decisionId: string;
  question: string;
  options: string[];
  selected: string | null;
  source: "user" | "policy";
  status: "pending" | "resolved" | "expired";
  decidedAt: string | null;
}
```

### Assumption policy

| Situation | Agent behavior |
| --- | --- |
| Clearly stated by the user | Record as objective, constraint, criterion, or authority—not as an inference. |
| Directly observable in a coherent snapshot | Record as observation; keep its workspace/artifact provenance. |
| Low-impact, easily reversible aesthetic choice | Choose a conservative default, record the assumption, keep the change focused and checkpointed. Do not interrupt the user merely to choose between equivalent colors or names. |
| Medium-impact interpretation affecting feature scope | Prefer a minimal implementation that preserves current behavior; surface the assumption in the proposed change summary. |
| High-impact, destructive, persistent, external, or difficult-to-reverse ambiguity | Create a pending decision and block that effect. An assumption cannot substitute for authority. |
| Evidence contradicts an active assumption | Mark it rejected or superseded and invalidate every listed downstream object before continuing. |
| User changes intent | Update the intent model, expire incompatible authority, invalidate the old proposal, and form a new change set. |

The intent model enables accurate action without forcing unnecessary clarification. It also prevents a low-confidence interpretation from quietly hardening into a destructive plan.

## 2. Operation state machine

```text
orienting
   ↓
inspecting ↔ re-grounding
   ↓
preparing
   ↓
awaiting-approval ──reject──> cancelled
   ↓ approve / no approval needed
applying ──conflict──> re-grounding
   ↓
executing ──repairable failure──> inspecting
   ↓
exercising / observing
   ↓
verifying ──failed and repairable──> inspecting
   ├─ inconclusive ──collect/decision──> observing or blocked
   └─ passed
        ↓
persisting, kept, restored, or discarded
```

Every transition emits an operation event. A phase may repeat, but repeated work must have a reason such as new state, failed evidence, or an explicit repair. The system records repeated calls that return no new information so evaluation can identify waste.

### Terminal states

- `passed` means every required criterion passed for the named workspace and run.
- `failed` means at least one required criterion failed and the operation ended without another repair attempt.
- `inconclusive` means required evidence or a required human judgment was unavailable or insufficient.
- `cancelled` means work stopped; effect receipts still disclose anything committed before cancellation.
- `restored` means a committed operation was intentionally reversed to its checkpoint state.
- `discarded` means no durable project retention was requested; it does not erase the operation record.

## 3. Pin state before acting

At the start of each phase, the agent carries the least state needed to make that phase safe:

| Phase | Required state |
| --- | --- |
| orient | capability digest and coherent `WorkspaceRef` |
| inspect | workspace snapshot plus exact query/read artifact revisions |
| prepare | operation intent, base workspace, every affected artifact revision |
| apply | prepared change-set ID, current base revisions, authority grants, idempotency key |
| execute | exact post-change workspace and change-set ID |
| exercise | exact run ID, runtime control mode, expected runtime sequence when supported |
| collect | exact workspace, run, exercise, collector versions, bounds |
| verify | operation criteria and immutable evidence IDs |
| persist | exact verified content revision and applicable authority |
| restore | checkpoint ID and compatible current workspace |

A high-level composite capability may carry this state internally, but it must preserve it in sub-results and activity events.

## 4. Invocation identity and safe replay

Browser agents, transports, and tabs can time out after an effect committed but before the response arrived. Blindly retrying a create, delete, apply, run, or save can duplicate work and waste resources. Effectful capabilities therefore use an idempotency protocol.

```ts
interface InvocationRequestContext {
  operationId: string;
  requestId: string;
  idempotencyKey: string | null;
  parentInvocationId: string | null;
  budget: {
    maxElapsedMs?: number;
    maxOutputBytes?: number;
  };
}
```

### Replay rules

1. Read-only capabilities are naturally idempotent for the same pinned snapshot; a new snapshot produces a new result.
2. Every effectful target capability requires an idempotency key scoped to its operation and capability version.
3. The first invocation stores a bounded journal entry containing the normalized input digest, phase, terminal result, and effect references—not full source or output payloads.
4. Repeating the same key with the same normalized input:
   - returns the original terminal effect/result when complete;
   - returns `INVOCATION_IN_PROGRESS` with a status reference when still running;
   - never performs the effect again.
5. Repeating the same key with different normalized input fails with `IDEMPOTENCY_MISMATCH`.
6. `apply_change_set` additionally deduplicates on operation ID plus change-set ID. A lost apply response can be recovered from the effect journal even if the active workspace has advanced to the committed revision.
7. `execute_preview` returns the original run for a replayed execution request. A caller that intentionally wants another run uses a new key.
8. Evidence collection may reuse an existing complete record for the same collector version and exact scope; it recollects only when requested, incomplete, expired by policy, or scoped to changed state.
9. Persistence returns the original acknowledgement for a replay of the same project/content revision.
10. Journal retention lasts through the terminal operation state plus a bounded recovery window. Eviction is explicit and never occurs while an effect is in progress.

### Required structured errors

Add to the contract error taxonomy:

- `IDEMPOTENCY_MISMATCH` — one key was reused with different input;
- `INVOCATION_IN_PROGRESS` — the original effect is still unresolved;
- `INVOCATION_RESULT_EXPIRED` — the bounded journal can prove prior use but no longer retains the complete replay result;
- `UNKNOWN_EFFECT_OUTCOME` — an adapter lost confirmation across a commit boundary and requires reconciliation before retry.

`UNKNOWN_EFFECT_OUTCOME` blocks further mutation until the system reconciles domain state, checkpoint, and journal. Guessing is not recovery.

## 5. The operation journal

The operation journal is the small, authoritative control record needed for retries and recovery. It is not the user-facing activity log, although activity is projected from it.

```ts
interface OperationJournalEntry {
  invocationId: string;
  operationId: string;
  capability: { id: string; version: string };
  requestId: string;
  idempotencyKey: string | null;
  inputDigest: string;
  phase: string;
  status: "running" | "blocked" | "succeeded" | "failed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  workspaceBefore: WorkspaceRef | null;
  workspaceAfter: WorkspaceRef | null;
  changeSetId: string | null;
  checkpointId: string | null;
  runId: string | null;
  exerciseId: string | null;
  evidenceIds: string[];
  receiptId: string | null;
  effectDigest: string | null;
  errorCode: string | null;
}
```

Journal writes follow the same commit-boundary discipline as the effect they describe. An apply is not considered safely acknowledged until the domain transaction and its effect journal entry can be reconciled.

## 6. Resource-aware control policy

The agent chooses the least sufficient next action, not the smallest-looking tool.

### Read policy

1. Start from the coherent context digest.
2. Search by path, text, symbol, or dependency before reading bodies.
3. Read exact ranges and direct dependencies.
4. Expand to whole files only when the mutation or semantic analysis requires them.
5. Reuse unchanged references and deltas.
6. Stop expanding when the affected set and acceptance criteria are sufficiently grounded.

### Mutation policy

1. Prefer one focused logical change set.
2. Minimize unrelated churn, not line count at all costs.
3. Prepare once against exact revisions; do not repeatedly regenerate equivalent diffs.
4. Apply once under an idempotency key.
5. Build/run once after the complete logical edit unless evidence identifies a repair.

### Evidence policy

1. Select collectors from acceptance criteria and the verification profile.
2. Reuse complete current evidence.
3. Collect higher-cost visual or controlled-runtime evidence only when the criterion needs it.
4. Ask the user for subjective judgment only when machine evidence cannot establish the criterion.
5. Do not collect every available signal “just in case.”

### Budget pressure

When an operation approaches a budget:

- summarize what is known using references rather than retransmitting content;
- identify the single uncertainty that blocks safe progress;
- choose a cheaper equivalent collector or query when one exists;
- avoid applying a speculative broad change merely to stay under budget;
- finish as `inconclusive` with a precise next action when required proof cannot be obtained safely.

## 7. Controlled runtime exercise

Source inspection, build success, and a passive scene snapshot cannot reliably verify interactive gameplay. The target system needs a sandbox-owned, bounded way to exercise the exact running game.

### Runtime identifiers

```ts
interface RuntimeRef {
  runId: string;
  workspace: WorkspaceRef;
  runtimeSequence: string;
}

interface ExerciseRef {
  exerciseId: string;
  runId: string;
  startSequence: string;
  endSequence: string;
  mode: "natural" | "controlled";
}
```

`runId` identifies one loaded module instance. `runtimeSequence` is an opaque monotonic point in that instance's acknowledged event/frame timeline. It prevents an observation made before an input sequence from being mistaken for the state after it.

### `exercise_preview`

```ts
interface ExercisePreviewInput {
  operationId: string;
  runId: string;
  expectedWorkspace: WorkspaceRef;
  expectedRuntimeSequence?: string;
  idempotencyKey: string;
  mode: "natural" | "controlled";
  prepare?: {
    pause?: boolean;
    resetToRunStart?: boolean;
    randomSeed?: number;
  };
  steps: RuntimeStep[];
  maxFrames: number;
  maxElapsedMs: number;
}

type RuntimeStep =
  | { kind: "wait_frames"; frames: number }
  | { kind: "key"; key: string; action: "down" | "up" | "tap"; frames?: number }
  | {
      kind: "pointer";
      action: "move" | "down" | "up" | "click";
      x: number;
      y: number;
      coordinateSpace: "viewport_pixels" | "viewport_normalized";
    }
  | { kind: "step_frames"; frames: number }
  | { kind: "checkpoint"; label: string };
```

### Exercise constraints

- Dispatch input only inside the KAPLAY sandbox; never synthesize browser chrome, clipboard, navigation, shell, or arbitrary page actions.
- Do not accept arbitrary JavaScript or `eval` as a runtime step.
- Bound step count, key length/allowlist, pointer coordinates, frames, elapsed time, output, and captured events.
- Require the exact active run and workspace. A wrong-run acknowledgement is rejected.
- `step_frames` is available only in controlled mode with a paused or sandbox-controlled clock.
- `randomSeed` is used only when the sandbox can explicitly instrument supported randomness; evidence records that instrumentation.
- `resetToRunStart` re-establishes a documented initial state. If reset requires a fresh module instance, return the new run ID rather than pretending continuity.
- Natural and controlled runs are distinct evidence modes. Controlled exercise can prove deterministic logic under instrumentation; it does not by itself prove the uninstrumented game feels correct to a person.
- Replayed exercise requests return the original exercise record and do not dispatch input twice.

### Exercise result

```ts
interface PreviewExercise {
  exerciseId: string;
  runId: string;
  status: "completed" | "failed" | "cancelled";
  mode: "natural" | "controlled";
  workspace: WorkspaceRef;
  startSequence: string;
  endSequence: string;
  acknowledgedSteps: number;
  totalSteps: number;
  checkpointSequences: Array<{ label: string; runtimeSequence: string }>;
  warnings: string[];
  errorEvidenceId: string | null;
}
```

The activity UI can describe this as “trying the controls” or “checking the new mechanic,” while advanced details expose the bounded action sequence and exact runtime references.

## 8. Runtime evidence and deltas

Runtime-derived evidence adds `exerciseId` and runtime sequence scope:

```ts
interface RuntimeEvidenceScope {
  runId: string;
  exerciseId: string | null;
  sequence: string;
  interval: { from: string; to: string } | null;
}
```

Examples:

- console evidence can cover the interval of one exercise;
- scene evidence can capture before/after checkpoints and a bounded object delta;
- assertion evidence can evaluate at a named exercise checkpoint;
- visual evidence can capture the exact run, sequence, viewport, and crop.

### Negative claims

A negative claim such as “no enemy exists,” “no error occurred,” or “the score never changed” is valid only when evidence is complete for the relevant scope.

- A truncated object list cannot prove absence outside the returned set.
- Dropped console entries cannot prove no prior runtime error in the interval.
- One final snapshot cannot prove an event never occurred during an exercise.
- A filtered query cannot prove project-wide absence unless the index reports complete coverage.

The verifier must encode these completeness requirements explicitly.

## 9. Visual evidence

A visual collector is a valuable target for layout, text, sprite, and feedback changes that scene metadata cannot establish.

A visual evidence record includes:

- exact workspace, run, exercise, and runtime sequence;
- viewport and device-pixel ratio;
- full-frame or bounded crop metadata;
- capture dimensions, byte limit, truncation/downscaling, and image digest;
- collector and rendering-environment versions;
- whether the capture is natural or instrumented.

Automated visual criteria may use deterministic, versioned comparators for specifically defined properties. A model's impression that an image “looks good” is an inference, not a deterministic pass. Subjective aesthetics remain a manual criterion or an explicitly labeled advisory observation.

Visual capture is sandbox evidence, not permission to transmit an image externally. Retention follows the evidence bound and privacy policy.

## 10. Interactive verification profiles

A `playable_change` profile should be decomposed rather than treated as one vague check.

| Criterion class | Typical evidence |
| --- | --- |
| Applied intended source | change-set effect receipt and source assertions |
| Project compiles | build evidence for exact content revision |
| Game loads naturally | natural preview execution acknowledgement |
| No current editor errors | diagnostics availability and current diagnostics evidence |
| No runtime errors during exercise | console interval evidence with acceptable completeness |
| Requested objects/state appear | scene/assertion evidence at exact sequence/checkpoint |
| Controls or mechanic work | bounded exercise plus before/after assertions |
| Visual feedback appears | scene and, when needed, visual evidence |
| Existing behavior remains | preserve-constraint assertions or a focused regression exercise |
| Subjective quality | explicit user judgment, not inferred machine pass |

The minimal sufficient set depends on the task. A color-only change may not need input exercise; a collision or scoring change normally does.

## 11. Recovery matrix

| Failure | Required response |
| --- | --- |
| Workspace/artifact changed before prepare/apply | invalidate proposal, re-ground, and form a new change set |
| Authority missing/expired | block only the protected effect and present the exact decision |
| Response lost after apply | replay the same idempotency key and recover the original effect receipt |
| Effect outcome unknown | reconcile journal, domain state, and checkpoint before any further mutation |
| Build/load failure | retain exact failure evidence; repair from the post-change workspace or restore |
| Exercise wrong run/sequence | reject, inspect current runtime, and restart from a known state |
| Evidence unavailable | use an equivalent named collector if one exists; otherwise issue an inconclusive receipt |
| Evidence incomplete for a negative claim | narrow the claim, increase an approved bound, or remain inconclusive |
| User cancels before commit | no effect |
| User cancels after commit | disclose committed effect and preserve restore affordance |
| Persistence fails | do not report saved; keep the verified transient result and persistence error separate |
| Restore conflicts with newer work | block overwrite and offer diff/manual recovery rather than force restore |

## 12. Accretive operation output

At completion, the system has four distinct outputs:

1. **User result** — changed or observed game state.
2. **Proof** — effect, execution, exercise, evidence, and verification receipts.
3. **Compact operation record** — objective, assumptions/decisions, IDs, summaries, metrics, failures, and disposition.
4. **Promotion candidates** — de-identified suggestions for a recipe, assertion, catalog annotation, recovery rule, or benchmark scenario.

Promotion candidates never become live behavior automatically. A useful failed operation can also accrete value by producing a deterministic error case or evaluation fixture.

## 13. Implementation insertion points

This protocol refines the roadmap as follows:

- **Milestone 1:** manifest entries declare idempotency and whether runtime exercise/visual evidence is supported.
- **Milestone 2:** add operation intent assumptions/decisions, request IDs, idempotency keys, structured replay errors, and the bounded operation journal.
- **Milestone 4:** make `apply_change_set` safely replayable and reconciled with checkpoint/effect journal state.
- **Milestone 5:** add exact runtime sequences, bounded `exercise_preview`, assertion checkpoints, runtime interval evidence, and optional visual capture after the base evidence ledger works.
- **Milestone 6:** project assumptions, pending decisions, replay/recovery status, exercise activity, and visual/manual criteria into human controls.
- **Milestone 7:** include replay efficiency, exercise coverage, and assumption invalidation in bounded operation metrics and promotion candidates.
- **Milestone 8:** composites preserve idempotency keys and expose the inspect→apply→run→exercise→verify stage chain.

The initial implementation may support only keyboard taps, frame waits, and scene assertions. Expand the runtime action DSL only when a real benchmark scenario requires it and the sandbox can enforce bounds.

## 14. Additional conformance and evaluation obligations

Add deterministic cases for:

1. response lost after apply; retry returns the same effect and no duplicate mutation;
2. response lost after run; retry returns the same run and no extra build/reload;
3. response lost after persistence; retry returns the same acknowledgement;
4. one idempotency key reused with different input; no effect and `IDEMPOTENCY_MISMATCH`;
5. unresolved invocation replay; `INVOCATION_IN_PROGRESS` rather than duplicate work;
6. unknown post-commit outcome; all later mutations blocked until reconciliation;
7. low-impact reversible ambiguity; bounded default recorded as an assumption without unnecessary user interruption;
8. high-impact ambiguous interpretation; pending decision blocks the effect;
9. evidence invalidates an assumption; dependent change set/run/receipt cannot remain current;
10. keyboard exercise causes the expected tagged object or score transition;
11. exercise replay does not send input twice;
12. exercise against the wrong run or runtime sequence is rejected;
13. controlled frame stepping is unavailable in natural mode;
14. arbitrary script/runtime escape input is rejected;
15. scene and console evidence cover the exact exercise interval;
16. truncated interval evidence cannot prove a negative claim;
17. optional visual evidence is linked to exact runtime sequence and bounded;
18. controlled exercise passes while natural play fails; overall profile does not falsely pass;
19. a user cancels during exercise; input stops and cancellation evidence is recorded;
20. operation-journal quotas preserve active and unresolved effects.

Track deduplicated retries, duplicate effects prevented, builds/runs avoided by replay, assumptions confirmed/rejected, decisions requested, exercise step/frame counts, controlled versus natural evidence, and visual capture bytes.

## 15. Fast-path operating shape

For a focused interactive change with no conflict or repair, the ideal logical sequence is:

```text
context
  → targeted source query/read
  → prepared atomic change set
  → idempotent apply
  → exact natural run
  → bounded controlled exercise when behavior requires it
  → selected evidence collection
  → verification receipt
  → optional approved persistence
```

Transport composition may reduce calls, but no stage loses its identity. This is what makes the system simultaneously intuitive, economical, controllable, and trustworthy.