# Matched WebMCP benchmark

Use this benchmark for repeated, matched comparisons. It is intentionally not a pull-request gate because model execution time, network latency, and browser scheduling are noisy.

Each run must pin the application commit, engine identity, starter source fingerprint, prompt hash, viewport, model, and reasoning setting. Run workflows sequentially or in randomized order rather than concurrently. Record cached input, uncached input, and output tokens separately when those values are available.

The acceptance matrix should cover startup, WASD and arrow movement, all four boundaries, score and collection feedback, hazard loss, timeout loss, victory, reset during play, reset after loss, reset after victory, save/reload/source-hash equality, and final diagnostics/console checks.

The primary measures are acceptance coverage, unsupported claims, retries, outer interactions per verified behavior, time to first successful run, and time to first fully verified result. Total duration remains useful, but a small timing difference without repeated runs is not evidence of an advantage.

Create a schema-version 1 JSON file with a `promptHash` and a `runs` array matching `scripts/webmcpBenchmark.ts`, then run:

```sh
npm run benchmark:webmcp -- docs/testing/benchmark-runs.json docs/testing/benchmark-summary.json
```

The command validates pinned inputs and a common acceptance matrix, then emits minimum, median, p90, maximum, fully verified rates, acceptance rates, token distributions, and unsupported-claim counts for each workflow.
