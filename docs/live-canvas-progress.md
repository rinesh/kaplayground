# Live canvas progress

## What this change implements

The game viewport now has a page-owned, collapsible activity overlay. It uses the
existing bounded WebMCP activity receipts rather than injecting code into a game.
It shows reading, asset discovery, atomic edits, preview checks, and verified
saves. Quiet periods explicitly say the page is waiting for the next update.
There is no invented percentage, model-thinking feed, or automatic claim that an
entire creative request has finished.

The existing eight-tool interface is preserved. `kaplayground_update_game` gains
an optional `checkpointLabel` (1–120 characters), such as `Candy theme`. This is
an intention, not verification evidence. Invalid labels are rejected before the
handler can mutate the project. Older callers do not have to send it. A checked
preview inherits a label only from the committed update with the same executable
content revision.

The agent-facing inspect, update, and run descriptions now ask for the smallest
useful visual change first, followed by a few complete playable checkpoints for
larger remixes. Each checkpoint still uses an atomic update followed by an
explicit run and relevant checks. Simple changes need only one checkpoint.
Partial JavaScript, empty progress-only updates, and per-keystroke restarts are
explicitly discouraged.

## Interaction and evidence

- Merely copying a coach prompt does not start a build indicator. The existing
  copy/paste handoff remains unchanged.
- The overlay opens once when agent work starts and respects subsequent
  minimization. It resets on project replacement.
- After 15 seconds without new observed activity, the active pulse becomes a
  quiet waiting state. This is not a timeout or a claim that the agent failed.
- A successful tool invocation with a failed or incomplete game result is not
  displayed as a passed preview.
- `Try this preview` appears only when the receipt matches the active run,
  current executable content, and runtime fingerprint. It focuses the game; it
  does not restart it. Manual source changes invalidate this action.
- The checkpoint count is recent, bounded history, not a fabricated task total.
  Rechecking or restarting identical executable content does not inflate it.
- Source, exception text, and arbitrary tool output are not copied into the
  overlay. Only controlled messages, bounded paths, and validated labels appear.
- Most of the overlay allows pointer input through to the game. Only buttons and
  the expandable activity list receive pointer events. There is a polite live
  region for status changes, but elapsed seconds are outside that live region.
  Reduced motion disables the pulse. Clock updates pause while the page is hidden.

## Scope boundaries

This is the live-feedback and checkpoint-workflow implementation, not the entire
longer-term editor roadmap. Intermediate visual game changes still require the
agent to submit and run a checkpoint; the page cannot render work it has not
received. The external agent is encouraged, not forced, to follow that workflow.

This change does not add double-buffered preview promotion, keep-playing versus
watch mode, retention of a last-known-good iframe after a failed restart,
source-snapshot undo, thumbnail comparison, object selection, or arbitrary
JavaScript hot swapping. The existing preview controller, sandbox protocol,
identity checks, and explicit run semantics are intentionally unchanged. A
proper two-preview implementation must make the singleton controller
instance-based, scope console and assets to the candidate, contain candidate
audio/focus side effects, and promote only verified current revisions.

## Validation

Run the focused tests without installing app dependencies:

```sh
npm run test:canvas-progress
```

They are also included in `npm run test:webmcp` and therefore the existing
`npm run verify:webmcp` CI workflow. They cover evidence and identity handling,
quiet periods, redaction, labels, bounded history, and source integration checks.
The source integration checks are not a substitute for a browser walkthrough.

Before merging, run the full existing verification suite and review the overlay
in desktop and portrait layouts. Check keyboard focus, pointer pass-through,
reduced motion, minimized-state persistence, failed and incomplete runs, project
replacement, and a two-checkpoint remix. Confirm that the actual preview changes
between checkpoints rather than assuming the guidance guarantees agent behavior.
