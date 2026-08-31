# Agent-system architectural decisions

This ledger records stable system choices. It is intentionally separate from the roadmap: implementation sequencing may change without reopening the architecture, while a semantic change to one of these decisions requires an explicit amendment.

Each decision has status **Accepted** unless otherwise noted.

## D-001 — Success is a proof-carrying closed loop

**Context.** A tool can return successfully while the project is wrong, stale, unplayable, or unverifiable. Build success, an attractive preview, an empty console, and an agent's confidence each cover only part of the claim.

**Decision.** Model work as an operation that links intent, acceptance criteria, workspace revisions, a change set, an exact preview run, independent evidence, and a criterion-by-criterion verification receipt. A mutation receipt or run acknowledgement is not the terminal success condition.

**Consequences.**

- The system can distinguish `passed`, `failed`, and `inconclusive` instead of forcing binary optimism.
- Final reporting becomes reproducible and inspectable.
- More identifiers must be carried through adapters, activity UI, tests, and persistence.
- Simple tasks remain economical through composed fast paths, but the underlying stages stay visible.

**Revisit when.** Never remove the proof chain. Revisit only which evidence profiles are sufficient for particular classes of task.

## D-002 — Human and agent surfaces share one semantic kernel

**Context.** Hand-maintained tool schemas, guide text, UI labels, tutorials, policy rules, and tests drift. The current shared Asset Brew catalog demonstrates the opposite pattern: one semantic dataset serves both UI and agent discovery.

**Decision.** Define capabilities, workflows, catalogs, policy metadata, bounds, and presentation metadata once, then generate or mechanically project WebMCP registration, live guide entries, activity labels, reference docs, and conformance cases.

**Consequences.**

- Adding a capability becomes a system contribution instead of several loosely coordinated edits.
- CI can reject incomplete projections.
- Human copy may specialize tone, but cannot redefine effects or safety.
- The current large WebMCP module should be decomposed around manifest, services, adapters, and projections.

**Revisit when.** A projection genuinely needs different semantics rather than different presentation. Such a case should normally become a distinct versioned capability.

## D-003 — State identifiers are orthogonal

**Context.** “Revision” currently carries different ideas: project replacement, any project content change, and exact file content. An agent needs to know which question each value answers.

**Decision.** Use separate `projectId`, `workspaceEpoch`, `contentRevision`, and `artifactRevision` identifiers. Add `operationId`, `changeSetId`, `checkpointId`, `runId`, `evidenceId`, and `receiptId` for their corresponding lifecycle objects. Preserve current `projectRevision` as a compatibility alias for workspace epoch during migration.

**Consequences.**

- Concurrency checks become precise and error recovery becomes understandable.
- Runs and evidence can be tied to exact content, not merely the same open project.
- Wire payloads are slightly larger, but repeated defensive reads and ambiguous failures decrease.

**Revisit when.** A new independently mutable or asynchronously observed entity requires its own identity. Do not overload an existing identifier for convenience.

## D-004 — Logical edits are atomic, previewable, and reversible

**Context.** Whole-file writes with content hashes are safe for one artifact, but a feature spanning several files can fail halfway. The user and agent also need to see the intended diff and recover without manually reconstructing prior content.

**Decision.** Introduce prepared change sets that validate all base revisions and effects without mutation, then apply all operations through one domain transaction after capturing a checkpoint. Restore is a recorded state transition. Canonical mutation and canonical execution remain separate stages, even when a fast-path composite invokes both.

**Consequences.**

- Multi-file work cannot leave a normal half-applied state.
- Approval can target a complete diff and risk summary.
- Checkpoint storage and transaction logic add implementation complexity.
- Current single-file tools become compatibility wrappers around one-operation change sets.

**Revisit when.** Browser storage limitations require a different checkpoint representation. Atomic all-or-none semantics remain mandatory.

## D-005 — Runs and evidence are revision-exact

**Context.** A console entry or scene snapshot can be misattributed after another run or edit. A preview acknowledgement proves only that one module loaded.

**Decision.** Every execution record names the exact workspace content revision, optional change set, run ID, build artifact digest, and preview protocol version. Every runtime-derived evidence record names that run. Diagnostics and source evidence name the exact workspace revision.

**Consequences.**

- Stale output cannot silently verify the active result.
- Historical operations remain inspectable even after another run.
- Collectors and UI must preserve provenance instead of exposing only the latest unscoped array.

**Revisit when.** A collector observes multiple revisions or runs simultaneously; it must then emit explicit per-scope records rather than weaken provenance.

## D-006 — Verification is tri-state and unavailability is not cleanliness

**Context.** Empty output may mean “no problems” or “the collector was unavailable.” Treating both as success creates false-positive completion.

**Decision.** Required criteria evaluate to `passed`, `failed`, or `inconclusive`; receipts may also mark a criterion `not_applicable`. Missing, stale, wrong-run, or insufficiently complete evidence makes a required criterion inconclusive. Overall pass requires every required applicable criterion to pass.

**Consequences.**

- The system reports uncertainty honestly.
- Users may see more inconclusive results during degraded operation, which is preferable to false assurance.
- Verification profiles must state completeness requirements and cannot infer availability from empty arrays.

**Revisit when.** A collector gains a deterministic fallback with equivalent semantics. The fallback must be named and versioned as evidence, not hidden.

## D-007 — Context is budgeted and progressively disclosed

**Context.** An agent can waste context and latency by repeatedly fetching unchanged metadata or whole files. Conversely, overly tiny tools force many round trips and make snapshot coherence difficult.

**Decision.** Provide one coherent, budgeted orientation context; project-wide path/text/symbol/dependency queries; multi-artifact range reads; hashes, cursors, and `sinceRevision` deltas. Return summaries before bodies and unchanged references before duplicate content.

**Consequences.**

- Common tasks can use a short fast path without sacrificing grounding.
- Search and indexing become first-class services.
- Responses must expose omissions, approximation, truncation, and budgets.
- Whole-file reads remain available when truly necessary.

**Revisit when.** Measurements show a different grouping minimizes cost without sacrificing coherence. Optimize from evaluation data, not tool-count aesthetics.

## D-008 — Authority is explicit, scoped, and cannot be self-granted

**Context.** A user request can imply permission for relevant reversible edits but not for discarding unsaved work, replacing the project, persisting, publishing, or deployment. Tool availability alone is not authorization.

**Decision.** Classify capabilities by observable, reversible-workspace, destructive-workspace, persistent, and external risk. Record authority grants from the user request, explicit approval, or narrow product policy. Grants are operation-scoped or shorter and are checked immediately before effects.

**Consequences.**

- High-impact actions can be blocked before mutation and explained clearly.
- The human UI needs a first-class approval interaction and complete effect summary.
- The agent can proceed autonomously on directly requested reversible work without asking for every edit.

**Revisit when.** Product policy changes the default for a risk class. The change requires explicit review and evaluation because it alters user authority.

## D-009 — Composite capabilities may reduce round trips but cannot hide stages

**Context.** A very granular API burdens the common path, while a monolithic “fix game” capability obscures effects, failure stage, evidence, and cost.

**Decision.** First build and prove safe primitives. Then allow composite capabilities such as context assembly or apply→execute→verify, provided they declare their component stages, preserve identifiers and sub-results, obey the same authority and cancellation rules, and never collapse an inconclusive verification into success.

**Consequences.**

- The system can be both legible and efficient.
- Composite behavior is testable against primitive equivalence.
- The roadmap postpones strong autonomous composition until contracts and telemetry exist.

**Revisit when.** A composition is so common that a dedicated semantic capability offers better policy or evaluation—not merely fewer calls.

## D-010 — Accretion uses bounded operational records and reviewed promotion

**Context.** Useful workflows should compound, but storing raw conversations, source, console output, or hidden reasoning creates privacy, prompt-injection, and maintenance risks. Silent behavioral learning is difficult to inspect or reproduce.

**Decision.** Retain bounded, user-clearable operation records containing objective, criteria, identifiers, effect summaries, receipts, metrics, structured failures, and disposition. Promote repeated successful patterns only through de-identification, versioned recipes or catalog entries, deterministic tests, review, and shared-registry publication.

**Consequences.**

- The system can learn at the product level without covert session memory.
- Evaluation can use structured histories without retaining unrestricted content.
- Recipe creation is deliberate engineering work, not an automatic side effect.

**Revisit when.** The user explicitly opts into richer trace export. Export remains separate from default operational memory.

## D-011 — Project content is data, never authority

**Context.** Source files, comments, example descriptions, console strings, scene text, and imported metadata can contain instructions that attempt to redirect an agent.

**Decision.** Mark all project-derived payloads untrusted. They may answer content questions and contribute evidence, but they cannot alter policy, authority, acceptance criteria, capability routing, or system instructions. System-generated recovery hints are structurally separate from payload text.

**Consequences.**

- Serializers, logs, and UI preserve trust labels.
- Evaluation includes malicious source and runtime-output scenarios.
- Agents still inspect and modify arbitrary project text, but treat instruction-like content as part of the artifact.

**Revisit when.** A trusted, signed project manifest is introduced. Its authority must be explicit and narrower than the user's current request.

## D-012 — Compatibility is versioned at each semantic boundary

**Context.** The app, WebMCP callers, sandbox protocol, and persisted data evolve at different rates. The current app and sandbox already require coordinated protocol behavior.

**Decision.** Version capability contracts, shared system envelopes, preview protocol ranges, and persistence schemas independently. Reject incompatible app/sandbox combinations before sending project code. Use explicit aliases and deprecation windows for public capability migrations.

**Consequences.**

- Deployments fail clearly instead of producing ambiguous runtime behavior.
- Capability evolution does not require one global version bump.
- Conformance tests must cover supported compatibility ranges and removal criteria.

**Revisit when.** A boundary becomes internal and can be migrated atomically. Public and persisted boundaries remain versioned.

## D-013 — Evaluation optimizes validated value, not raw autonomy

**Context.** Tool-call count, latency, or apparent completion can improve while false success, mutation risk, or human repair cost worsens.

**Decision.** Gate changes on correctness and safety first, then compare context bytes, calls, builds, latency, mutation size, recoveries, and human interventions. Track false-success rate and exact-run provenance as primary metrics. The common-path target is fewer non-redundant calls and less context at equal or better independent task success.

**Consequences.**

- Performance work cannot claim victory by skipping checks.
- The benchmark suite needs independent oracles and fault injection.
- Telemetry events are designed into the contracts rather than added after implementation.

**Revisit when.** Product goals add another constrained resource. Add it to the objective; do not replace correctness gates.

## Amendment process

Amending a decision requires:

1. naming the affected decision and invariant;
2. describing measured or observed pressure that the current choice cannot satisfy;
3. proposing the new choice and migration path;
4. updating contracts, roadmap, and evaluation gates;
5. documenting compatibility and user-authority effects;
6. obtaining the same level of review as a public capability-contract change.
