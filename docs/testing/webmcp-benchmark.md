# Matched WebMCP benchmark

Use this benchmark for repeated, matched comparisons. It is intentionally not a pull-request gate because model execution time, network latency, and browser scheduling are noisy.

Each run must pin the application commit, engine identity, starter source fingerprint, prompt hash, viewport, model, and reasoning setting. Run workflows sequentially or in randomized order rather than concurrently. Record cached input, uncached input, and output tokens separately when those values are available.

For controlled comparisons, use an immutable engine artifact (an exact release or an artifact addressed by commit/content hash), and record the SHA-256 of the actual executed engine bytes in `engineIdentity`, alongside its artifact reference. Record the sandbox commit/protocol with the evidence. A mutable `kaplay.master.mjs` URL or the app's checked-out engine commit alone does not pin remotely imported bytes. Preserve `immutableReference: false` receipts and classify those runs as exploratory rather than attributing differences solely to the model. Hashing a later download from a mutable URL does not prove which bytes an earlier run executed.

Repeat at least five randomized sequential trials per model/effort configuration with identical starting source, prompt hashes, viewport, acceptance matrix, and grading rules. For Pong, cover both scoring branches, paddle/boundary collisions, pause position invariance, and reset after play and victory. For Sokoban, cover blocked pushes, crate and counter restoration on undo, undo after victory, both level solutions, next-level gating, and reset-history clearing. An independent grader should inspect the actual assertions; a startup pass or a pause label alone is not full behavioral verification.

The acceptance matrix should cover startup, WASD and arrow movement, all four boundaries, score and collection feedback, hazard loss, timeout loss, victory, reset during play, reset after loss, reset after victory, save/reload/source-hash equality, and final diagnostics/console checks.

The primary measures are acceptance coverage, unsupported claims, retries, outer interactions per verified behavior, time to first successful run, and time to first fully verified result. Total duration remains useful, but a small timing difference without repeated runs is not evidence of an advantage.

Create a schema-version 1 JSON file with a `promptHash` and a `runs` array matching `scripts/webmcpBenchmark.ts`, then run:

```sh
npm run benchmark:webmcp -- docs/testing/benchmark-runs.json docs/testing/benchmark-summary.json
```

The command validates pinned inputs and a common acceptance matrix, then emits minimum, median, p90, maximum, fully verified rates, acceptance rates, token distributions, and unsupported-claim counts for each workflow.
