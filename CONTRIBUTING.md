# Contributing to KAPLAYGROUND

Thanks for your interest in contributing with the KAPLAYGROUND repo. Through this document you will see important information
for contributing in the repository.

## Pre-requisites

- [Node.js](https://nodejs.org/en)
- [npm](https://npmjs.com/) package manager

## Conventions

- For commit messages follow the KAPLAY.js repository [conventional commits guidelines.](https://github.com/kaplayjs/kaplay/blob/master/CONTRIBUTING.md#conventional-commits-guide)

## Agent-system changes

KAPLAYGROUND's Codex coach, WebMCP tools, editor state, preview sandbox, diagnostics, console capture, scene inspection, activity UI, and persistence are designed as one human-agent system. Changes in these areas must preserve shared semantics rather than adding a disconnected tool or interface path.

Read the agent-system design before changing agent-facing behavior:

1. [Architecture](./docs/agent-system/ARCHITECTURE.md)
2. [Contracts](./docs/agent-system/CONTRACTS.md)
3. [Decisions](./docs/agent-system/DECISIONS.md)
4. [Roadmap](./docs/agent-system/ROADMAP.md)
5. [Evaluation](./docs/agent-system/EVALUATION.md)

The documents label **Current** behavior separately from **Target** design. A pull request must not present a planned capability as shipped before its runtime implementation, compatibility path, conformance tests, and evaluation requirements are complete.

For an agent-facing capability or contract change, include in the pull request:

- the user outcome and observable acceptance criteria;
- input/output contract and versioning impact;
- effects, risk class, authority, approval, concurrency, cancellation, and reversibility;
- state identifiers and stale-state behavior;
- limits, truncation, availability, trust, and expected resource cost;
- independent evidence required before success is claimed;
- human and agent projections that consume the same semantic source;
- success, conflict, unavailability, bounds, cancellation, compatibility, and fault tests;
- the evaluation scenarios and metrics affected.

Until capability-manifest projections are implemented, review the WebMCP runtime schema/handler, live agent guide, activity/onboarding labels, tests, README, and design documents together. Stable changes to identifier meaning, authority, atomicity, evidence, retention, or compatibility require an entry in [Decisions](./docs/agent-system/DECISIONS.md).

Run the complete current agent-system verification for changes touching WebMCP, project revisions, editor/preview behavior, sandbox messages, evidence capture, or onboarding:

```sh
npm run verify:webmcp
```

Preview protocol changes require compatible app and sandbox releases. Do not treat an app-only build as verification of a changed protocol.

## Branches

- `dev`: The branch with non-released changes and features in development, it is **the branch you checkout to develop your features**. It is the default branch.
- `master`: The deployment branch, this branch reflects what you can see in https://play.kaplayjs.com.

So what branch should I use for developing features and then creating PR? **dev**.

## Setup environment

```sh
git clone https://github.com/kaplayjs/kaplayground.git
cd kaplayground
npm i # will install and setup stuff of submodules
npm run dev # will start the development server
npm run fmt # before commit
```

## Merge dev with master workflow

If you have access to deployments and you need to merge changes in dev to master, so deployment is updated, you must follow this special
workflow:

```sh
git checkout dev
git merge master
git checkout master
git merge --ff-only dev
```
