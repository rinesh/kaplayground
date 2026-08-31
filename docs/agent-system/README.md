# Agent-system design

This directory defines KAPLAYGROUND as one human-and-agent co-creation system rather than a collection of editor, WebMCP, preview, and onboarding features.

## Status

The documents deliberately distinguish two kinds of statement:

- **Current** — behavior that exists on the `dev` branch today.
- **Target** — an architectural commitment or planned capability that is not yet a shipped promise.

The current baseline is the browser-native WebMCP bridge described in the root README: nineteen bounded `kaplayground_*` tools, revision-safe file mutation, acknowledged preview runs and pause changes, diagnostics, bounded console capture, shallow scene inspection, activity UI, and project persistence.

The target is a proof-carrying operation system: one coherent context, explicit authority, atomic reversible change sets, exact-run evidence, criterion-by-criterion verification, and bounded operational memory, all projected from a shared semantic kernel into both human and agent surfaces.

## Reading order

1. [Architecture](./ARCHITECTURE.md) — the constitution, north star, abstraction tower, invariants, and source-of-truth hierarchy.
2. [Contracts](./CONTRACTS.md) — the canonical identifiers, capability manifest, operation lifecycle, change-set semantics, evidence model, errors, and compatibility rules.
3. [Decisions](./DECISIONS.md) — accepted architectural choices and their consequences.
4. [Roadmap](./ROADMAP.md) — an incremental migration plan with dependencies and exit criteria.
5. [Evaluation](./EVALUATION.md) — correctness, ergonomics, safety, and resource-efficiency benchmarks.
6. [`AGENTS.md`](../../AGENTS.md) — repository-specific instructions for an agent implementing or reviewing these plans.

## How the documents fit together

```text
ARCHITECTURE  says what the system is and what must remain true.
CONTRACTS     says how the system expresses those truths precisely.
DECISIONS     says why the stable choices were made.
ROADMAP       says in what order to realize them without a rewrite.
EVALUATION    says how to know the result is actually better.
```

No document is an alternative source of runtime truth. During the transition, existing code and tests remain authoritative for **Current** behavior. The contracts and roadmap govern **Target** behavior. When implementation catches up, generated capability references and conformance tests should replace manually synchronized descriptions.

## Change discipline

A change to the agent system should be reviewed as a system change, not merely a tool addition.

At minimum, establish:

- the user outcome and acceptance criteria;
- the canonical concepts and identifiers involved;
- read/write/external effects and authority requirements;
- conflict, cancellation, rollback, persistence, and availability behavior;
- response bounds, truncation, freshness, and resource cost;
- evidence required before success can be claimed;
- human and agent projections that share the behavior;
- compatibility and migration implications;
- conformance, fault-injection, and evaluation coverage.

Stable semantic changes belong in [Decisions](./DECISIONS.md). Planned work and its exit criteria belong in [Roadmap](./ROADMAP.md). A proposed capability is not considered complete merely because a WebMCP tool can invoke it.

## Near-term implementation posture

Do not begin with an opaque autonomous “do everything” tool or a wholesale rewrite. First extract the shared contracts and services already implicit in the current bridge, preserve compatibility, and make identifiers and evidence explicit. Then add economical context queries, atomic change sets, and verification receipts. Only after the primitives are proven should the common path be composed into stronger fast-path capabilities.
