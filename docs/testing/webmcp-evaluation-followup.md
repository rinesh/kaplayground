# Follow-up to the September 5 live evaluation

Evaluated the ten findings in the “Test WebMCP game generation” task against this checkout. The exploratory report tested deployed commit `5818d40e2409f0affd5134b5339cfe32af2ee156`; its observations are evidence for targeted regressions, not proof of universal model compatibility or game correctness.

| Finding | Decision and implementation |
| --- | --- |
| F01: positive gameplay verdict without evidence | Fixed. `gameplay.status` distinguishes `passed`, `failed`, `incomplete`, and `not-requested`. `passed` is true only for asserted, completed checks, false for failed assertions, and null otherwise. Observation-only baselines do not prevent a subsequent valid assertion from passing. |
| F02: undisclosed action limits | Fixed in discovery, with structured requested/limit details for aggregate duration and checkpoint count. Also corrected reversed press/click accounting found during source review. |
| F03: unknown top-level inputs | Fixed for all eight tools using the keys from their existing published schemas, before executing any handler. No additional registry or validator framework. |
| F04: large-scene coverage | Added explicit matching/returned counts, object and layout coverage, tag scope, and bounded follow-up guidance. Whole-scene truncation still makes the overall run incomplete even if requested gameplay passed. Use existing tag selection; pagination would imply unstable cross-call snapshots and is not necessary for targeted checks. Layout remains bounded and only covers the declared selection. |
| F05: recreated-object movement | Preserved stable runtime-ID matching; inconclusive movement receipts now include both IDs and an actionable identity reason. Discovery recommends absolute-position checks after redraws. |
| F06: stale starter coaching | Fixed conservatively: example-specific guidance applies only while the source matches the example. Any source edit switches to neutral guidance; provenance remains intact. Saving keeps the same guide identity. |
| F07: intermittent startup timeout | Added startup phase, elapsed time, budget, run ID, error code, and explicit retry guidance to failed run receipts. Cancellations remain cancellations, and readiness cannot be written after cancellation. A new forced-timeout/restart regression reproduced a separate race: a stop effect cleared the mounted iframe reference and a quick restart left console capture disconnected, causing false passes. Fixed reference cleanup to follow actual unmounting and canceled obsolete hide timers. The original Runner timeout cause is still unproven. |
| F08: mutable engine bytes | Valid benchmark limitation. Keep intentional master selection and its existing warning; do not change every game's engine based on an exploratory report. The existing benchmark instructions now require an immutable artifact and SHA-256 of the executed engine bytes. No new model benchmark was requested or performed by this fix. |
| F09: registration versus model compatibility | Updated connection messaging and displayed last successful activity. The page cannot infer host/model support before a successful call, and cannot fix a host rejection. No model allowlist or unconditional compatibility promise. |
| F10: flattened errors | Retained thrown errors and structured fields; included stable code and retryability in Error.message for hosts that keep only strings. Aggregate requested/limit details also remain readable in duration errors. Full host transport preservation still requires testing in the affected host. |

## Consuming run receipts

`ok` means the operation did not explicitly fail; it is not a gameplay verdict. For a completed run check, require both `status === "passed"` and `complete === true`. For claimed gameplay, additionally require `gameplay.status === "passed"`, `gameplay.passed === true`, and inspect the actual checkpoint assertions against the user's requirements. A scene-name assertion alone does not establish movement, collision, scoring, or pause invariance.

`gameplay` is null when actions were omitted. With observation-only actions it has `status: "not-requested"` and `passed: null`. A baseline checkpoint with no expectations can support a later movement assertion. An input without a later game-state assertion produces `incomplete`, as does an assertion with insufficient evidence. Failed assertions take precedence over missing evidence.

`scene.inspectionScope` describes the final scene sample independently. A complete `tag` selection is only that subset; `wholeSceneObjects` is false. An unfiltered scene checks layout for UI-tagged objects only, not every object's visual appearance. Visual quality is always a user/browser judgment.

## Splitting input sequences

Discovery publishes 30 actions, 12 checkpoints, 5000 ms total scheduled input, and 2000 ms maximum per wait/hold. Scheduled costs are wait = duration, hold = duration + 34 ms, press = 68 ms, click = 102 ms. Frame scheduling can add wall time.

For a longer movement test, issue multiple calls to the existing run tool with `mode: "check-current"`, the same expected executable identity, and a new baseline in each call:

```json
{
  "expectedContentRevision": "<from inspect_game>",
  "expectedRuntimeFingerprint": "<from inspect_game>",
  "mode": "check-current",
  "inspectTag": "player",
  "actions": [
    { "type": "checkpoint", "name": "before", "tag": "player" },
    { "type": "hold", "key": "ArrowRight", "durationMs": 1000 },
    { "type": "checkpoint", "name": "after", "tag": "player", "expect": {
      "firstObjectMovedFrom": { "checkpoint": "before", "minDistance": 10, "axis": "x" }
    } }
  ]
}
```

Check each call's `runId`; content identity does not freeze live gameplay. Movement references are local to one call and require the same runtime object ID. Use absolute-position assertions when the game destroys/recreates its objects. Use meaningful game-state assertions after each behavior, not just focus or layout assertions.

## Timeouts and release compatibility

Where the browser harness permits it, give the outer operation a larger deadline than the page's internal phases (for example 90 seconds for a complete run with input and inspection), and forward cancellation. Startup retains its 30-second bound; input and inspection have separate bounds. Increasing an arbitrary inner deadline or adding automatic retries would obscure the reported failure without establishing its cause. A timeout receipt now identifies the failed phase. Inspect again before explicitly restarting; retain the first failure in test evidence.

These changes advance the sandbox protocol to 4 because gameplay verdict semantics changed. Deploy the compatible sandbox first and build the editor with its exact URL before a future deployment. This patch itself does not deploy either application.

## Validation

`npm run test:webmcp` passed all 112 tests. The final `npm run verify:webmcp` passed the same unit suite, TypeScript, the browser integration suite (including forced-timeout recovery and console-error detection), sandbox and editor production builds, and all four distribution artifact tests. `git diff --check` and the final working-tree review passed. Existing untracked `reports/` content was left untouched.

During validation, the forced-timeout regression first reproduced lost console evidence on immediate restart. The final browser run passed after the iframe lifecycle fix; the earlier failure is not counted as a first-pass success. No model compatibility benchmark or production deployment was performed.
