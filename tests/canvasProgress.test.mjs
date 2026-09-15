import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deriveCanvasProgress, QUIET_ACTIVITY_MS } from "../src/integrations/webmcp/canvasProgress.ts";
import { validateCheckpointLabel } from "../src/integrations/webmcp/checkpointLabel.ts";

const contentRevision = "1:c:0123456789abcdef";
const runtimeFingerprint = "r:0123456789abcdef";
let serial = 0;
function receipt(toolName = "kaplayground_read_files", values = {}) {
    return { id: `event-${++serial}`, toolName, startedAt: 10_000, status: "succeeded", durationMs: 100, input: {}, ...values };
}
function run(values = {}, overrides = {}) {
    return receipt("kaplayground_run_game", {
        result: { status: "passed", ok: true, mode: "restart-and-check", runId: "run-1", contentRevision, runtimeFingerprint, ...values },
        ...overrides,
    });
}
function progress(entries = [], values = {}) {
    return deriveCanvasProgress({ entries, connection: "ready", now: 11_000, stopped: false, runId: "run-1", contentRevision, runtimeFingerprint, ...values });
}

test("registered tools do not claim generation started", () => {
    const result = progress();
    assert.equal(result.title, "Agent tools ready");
    assert.equal(result.busy, false);
    assert.equal(result.waitingForActivity, false);
    assert.equal(result.canTryPreview, false);
    assert.match(result.detail, /Send your idea/);
});

test("no blank overlay is shown in an unsupported browser", () => {
    assert.equal(progress([], { connection: "unsupported" }).visible, false);
});

test("copying a prompt alone cannot produce tool activity", () => {
    assert.equal(progress([], { copiedAt: 9_000 }).events.length, 0);
    assert.equal(progress([], { copiedAt: 9_000 }).busy, false);
});

test("actual in-flight reads show reading, not invented edits", () => {
    const result = progress([receipt(undefined, { status: "running" })]);
    assert.equal(result.title, "Reading your game");
    assert.equal(result.busy, true);
    assert.equal(result.checkedPreviewCount, 0);
});

test("a quiet in-flight operation stops animating without pretending it failed", () => {
    const result = progress([receipt(undefined, { status: "running" })], { now: 10_000 + QUIET_ACTIVITY_MS });
    assert.equal(result.tone, "waiting");
    assert.equal(result.busy, false);
    assert.equal(result.secondsSinceActivity, 15);
    assert.match(result.detail, /cannot see what the agent does/);
});

test("gaps between completed tool calls are explicitly waiting", () => {
    const result = progress([receipt()]);
    assert.equal(result.tone, "waiting");
    assert.equal(result.waitingForActivity, true);
    assert.equal(result.busy, false);
});

test("timer uses the receipt completion time", () => {
    const result = progress([receipt(undefined, { durationMs: 6000 })], { now: 18_000 });
    assert.equal(result.secondsSinceActivity, 2);
});

test("clock skew never produces a negative elapsed time", () => {
    assert.equal(progress([receipt()], { now: 0 }).secondsSinceActivity, 0);
});

test("new real activity resumes the indicator after a quiet period", () => {
    const result = progress([receipt(undefined, { startedAt: 39_000, status: "running" }), receipt()], { now: 40_000 });
    assert.equal(result.busy, true);
    assert.equal(result.secondsSinceActivity, 1);
});

test("a transport-successful failed run is still an error", () => {
    const result = progress([run({ status: "failed", ok: false })]);
    assert.equal(result.title, "Preview needs a fix");
    assert.equal(result.tone, "error");
    assert.equal(result.canTryPreview, false);
    assert.equal(result.checkedPreviewCount, 0);
});

test("incomplete evidence is not a passed preview", () => {
    const result = progress([run({ status: "incomplete" })]);
    assert.equal(result.tone, "warning");
    assert.equal(result.canTryPreview, false);
});

test("missing evidence is not a passed preview", () => {
    assert.equal(progress([receipt("kaplayground_run_game")]).tone, "warning");
});

test("only a matching, checked current preview gets the try action", () => {
    const result = progress([run()]);
    assert.equal(result.canTryPreview, true);
    assert.equal(result.tone, "ready");
    assert.match(result.detail, /Visual quality is yours to judge/);
    assert.match(result.detail, /may still make more changes/);
});

for (const [field, value] of [
    ["runId", "newer-run"], ["runId", null], ["contentRevision", "2:c:fedcba9876543210"],
    ["runtimeFingerprint", "r:fedcba9876543210"], ["runtimeFingerprint", null], ["stopped", true],
]) {
    test(`stale preview evidence is invalidated by ${field}=${value}`, () => {
        const result = progress([run()], { [field]: value });
        assert.equal(result.canTryPreview, false);
        assert.notEqual(result.tone, "ready");
    });
}

test("a later failed check cannot reuse an older pass on the same run", () => {
    assert.equal(progress([run({ status: "failed" }, { startedAt: 10_500 }), run()]).canTryPreview, false);
});

test("checking current gameplay is not described as a restart", () => {
    const result = progress([receipt("kaplayground_run_game", { status: "running", input: { mode: "check-current" } })]);
    assert.equal(result.title, "Checking the current preview");
});

test("checks of unchanged content do not inflate checkpoint counts", () => {
    const result = progress([run(), run({}, { id: "retry" }), run({ mode: "check-current" }, { id: "inspect" })]);
    assert.equal(result.checkedPreviewCount, 1);
});

test("distinct checked executable revisions count as separate checkpoints", () => {
    assert.equal(progress([run(), run({ contentRevision: "1:c:fedcba9876543210" })]).checkedPreviewCount, 2);
});

test("committed changes wait for an explicit run", () => {
    const result = progress([receipt("kaplayground_update_game", { result: { committed: true } })]);
    assert.match(result.title, /waiting for a preview/);
    assert.equal(result.busy, false);
    assert.equal(result.canTryPreview, false);
});

test("unconfirmed changes are not shown as committed", () => {
    const result = progress([receipt("kaplayground_update_game", { result: {} })]);
    assert.equal(result.tone, "warning");
});

test("save requires acknowledged and read-back verified storage", () => {
    const saved = { saved: true, writeAcknowledged: true, readbackVerified: true };
    assert.equal(progress([receipt("kaplayground_save_game", { result: saved })]).title, "Game saved");
    for (const field of Object.keys(saved)) {
        assert.equal(progress([receipt("kaplayground_save_game", { result: { ...saved, [field]: false } })]).tone, "warning");
    }
});

test("a canceled example replacement is not reported as opened", () => {
    assert.equal(progress([receipt("kaplayground_open_example", { result: { opened: false } })]).tone, "warning");
});

test("disconnect stops the spinner and labels history as earlier activity", () => {
    const result = progress([receipt(undefined, { status: "running" })], { connection: "destroyed" });
    assert.equal(result.busy, false);
    assert.equal(result.waitingForActivity, false);
    assert.equal(result.canTryPreview, false);
    assert.match(result.detail, /from earlier/);
});

test("project replacement cleared history leaves no previous checkpoints", () => {
    assert.equal(progress([], { contentRevision: "2:c:fedcba9876543210" }).checkedPreviewCount, 0);
});

test("unknown tools and prototype keys cannot become fabricated progress", () => {
    for (const name of ["unknown", "toString", "__proto__"]) {
        assert.equal(progress([receipt(name)]).events.length, 0);
    }
});

test("the activity view never serializes source, arbitrary results, or exception text", () => {
    const secret = "SECRET_SOURCE_MUST_NOT_APPEAR";
    const result = progress([receipt("kaplayground_update_game", {
        input: { content: secret, changes: [{ content: secret }] },
        error: secret,
        result: { committed: true, summary: secret, source: secret, changes: [{ path: "main.js", content: secret }] },
    })]);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.deepEqual(result.events[0].paths, ["main.js"]);
});

test("history, path count, and path strings are bounded", () => {
    const result = progress(Array.from({ length: 300 }, (_, index) => receipt("kaplayground_update_game", {
        startedAt: 10_000 + index,
        result: { committed: true, changes: Array.from({ length: 100 }, (_, n) => ({ path: `file${n}/` + "x".repeat(500) })) },
    })));
    assert.equal(result.events.length, 6);
    assert.equal(result.events[0].paths.length, 3);
    assert.ok(result.events.every(event => event.paths.every(path => path.length <= 120)));
});

test("path text strips control and direction-override characters", () => {
    const result = progress([receipt("kaplayground_read_files", { result: { paths: ["main\n\u202e.js"] } })]);
    assert.deepEqual(result.events[0].paths, ["main.js"]);
});

test("pending concurrent work prevents an outdated try action", () => {
    assert.equal(progress([run(), receipt(undefined, { startedAt: 9000, status: "running" })]).canTryPreview, false);
});

test("derivation leaves the input receipt history unchanged", () => {
    const entries = Object.freeze([Object.freeze(run()), Object.freeze(receipt())]);
    assert.doesNotThrow(() => progress(entries));
});

test("checkpoint labels are optional, trimmed, and bounded", () => {
    assert.equal(validateCheckpointLabel(undefined), undefined);
    assert.equal(validateCheckpointLabel("  Candy theme  "), "Candy theme");
    assert.equal(validateCheckpointLabel("x".repeat(120)).length, 120);
    for (const value of [null, 1, {}, "", "  ", "x".repeat(121), "a\nb", "a\u202eb"]) {
        assert.throws(() => validateCheckpointLabel(value));
    }
});

test("a committed label is an intention awaiting a runnable preview", () => {
    const result = progress([receipt("kaplayground_update_game", {
        input: { checkpointLabel: "Candy theme" }, result: { committed: true, contentRevision },
    })]);
    assert.match(result.title, /Candy theme/);
    assert.match(result.title, /waiting for a preview/);
    assert.equal(result.canTryPreview, false);
});

test("run labels follow content identity, not just the last update", () => {
    const update = receipt("kaplayground_update_game", {
        startedAt: 9000, input: { checkpointLabel: "Candy theme" }, result: { committed: true, contentRevision },
    });
    assert.match(progress([run(), update]).title, /Candy theme/);
    assert.doesNotMatch(progress([run({ contentRevision: "different" }), update]).title, /Candy theme/);
});

test("failed or future updates cannot name a previously checked preview", () => {
    for (const overrides of [{ status: "failed" }, { startedAt: 12_000 }]) {
        const update = receipt("kaplayground_update_game", {
            startedAt: 9000, input: { checkpointLabel: "Not checked" },
            result: { committed: true, contentRevision }, ...overrides,
        });
        const checkedEvent = progress([run(), update]).events.find(event => event.id !== update.id);
        assert.doesNotMatch(checkedEvent.label, /Not checked/);
    }
});

test("malformed legacy labels cannot crash canvas rendering", () => {
    assert.doesNotThrow(() => progress([receipt("kaplayground_update_game", { input: { checkpointLabel: {} } })]));
});

test("component integration is page-owned and respects accessibility", () => {
    const component = readFileSync(new URL("../src/components/Playground/CanvasBuildOverlay.tsx", import.meta.url), "utf8");
    const gameView = readFileSync(new URL("../src/components/Playground/GameView.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/components/Playground/CanvasBuildOverlay.css", import.meta.url), "utf8");
    assert.match(gameView, /<CanvasBuildOverlay\s*\/>/);
    assert.match(component, /aria-live="polite"/);
    assert.match(component, /visibilitychange/);
    assert.match(component, /clearInterval/);
    assert.match(component, /focusGame\(\)/);
    assert.doesNotMatch(component, /\.run\(|updateAndRun|postMessage|dangerouslySetInnerHTML/);
    assert.match(css, /pointer-events: none/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});

test("checkpoint guidance preserves the eight-tool contract and atomic updates", () => {
    const source = readFileSync(new URL("../src/integrations/webmcp/gameTools.ts", import.meta.url), "utf8");
    assert.equal([...source.matchAll(/name: "kaplayground_/g)].length, 8);
    assert.match(source, /smallest useful visible change first/);
    assert.match(source, /Never submit partial JavaScript/);
    assert.match(source, /checkpointLabel: \{/);
    assert.match(source, /validateCheckpointLabel\(\(input/);
    assert.match(source, /It does not run the game/);
});
