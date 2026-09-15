import { validateCheckpointLabel } from "./checkpointLabel.ts";

/** User-facing progress derived only from bounded, source-redacted tool receipts. */
export interface CanvasActivityReceipt {
    id: string;
    toolName: string;
    status: "running" | "succeeded" | "failed";
    startedAt: number;
    durationMs?: number;
    input: Record<string, unknown>;
    result?: Record<string, unknown>;
}

export type CanvasProgressTone = "idle" | "working" | "waiting" | "ready" | "warning" | "error";

export interface CanvasProgressInput {
    entries: readonly CanvasActivityReceipt[];
    connection: string;
    now: number;
    stopped: boolean;
    runId: string | null;
    contentRevision: string;
    runtimeFingerprint: string | null;
}

export interface CanvasProgressEvent {
    id: string;
    label: string;
    tone: CanvasProgressTone;
    paths: string[];
}

export interface CanvasProgress {
    visible: boolean;
    title: string;
    detail: string;
    tone: CanvasProgressTone;
    busy: boolean;
    waitingForActivity: boolean;
    secondsSinceActivity: number;
    canTryPreview: boolean;
    checkedPreviewCount: number;
    events: CanvasProgressEvent[];
}

export const QUIET_ACTIVITY_MS = 15_000;
const MAX_RECEIPTS = 100;
const MAX_EVENTS = 6;
const MAX_PATHS = 3;

const TOOL_LABELS: Record<string, [string, string]> = {
    kaplayground_inspect_game: ["Looking at your game", "Game inspected"],
    kaplayground_read_files: ["Reading your game", "Game files read"],
    kaplayground_find_assets: ["Finding game assets", "Asset search finished"],
    kaplayground_find_examples: ["Finding a starting point", "Starting points found"],
    kaplayground_open_example: ["Opening a starting point", "Starting point opened"],
    kaplayground_update_game: ["Applying game changes", "Changes received"],
    kaplayground_run_game: ["Starting and checking the preview", "Preview checked"],
    kaplayground_save_game: ["Saving your game", "Game saved"],
};

/** No inferred generation percentage, model thoughts, or overall task completion. */
export function deriveCanvasProgress(input: CanvasProgressInput): CanvasProgress {
    const entries = input.entries.slice(0, MAX_RECEIPTS)
        .filter(entry => Object.prototype.hasOwnProperty.call(TOOL_LABELS, entry.toolName))
        .sort((a, b) => b.startedAt - a.startedAt);
    const running = entries.find(entry => entry.status === "running");
    const latest = running ?? entries[0];
    const latestActivityAt = entries.reduce((latestTime, entry) =>
        Math.max(latestTime, receiptTime(entry)), 0);
    const secondsSinceActivity = Math.max(0, Math.floor(
        (input.now - latestActivityAt) / 1000,
    ));
    const events = entries.slice(0, MAX_EVENTS).map(entry => {
        const event = summarizeEvent(entry);
        const label = checkpointFor(entry, entries);
        return label ? { ...event, label: `${event.label} · ${label}` } : event;
    });
    const checkedPreviewCount = new Set(entries.filter(entry =>
        entry.toolName === "kaplayground_run_game"
        && entry.status === "succeeded"
        && entry.result?.status === "passed"
        && entry.result?.ok !== false
        && entry.result?.mode === "restart-and-check"
        && typeof entry.result?.contentRevision === "string"
    ).map(entry => entry.result!.contentRevision)).size;
    // A successful call is not necessarily a successful game. Check the receipt,
    // active run, executable content, and runtime fingerprint independently.
    const currentCheck = entries.find(entry =>
        entry.toolName === "kaplayground_run_game"
        && entry.result?.runId === input.runId);
    const canTryPreview = !running && !input.stopped && input.runId !== null
        && input.runtimeFingerprint !== null
        && currentCheck?.status === "succeeded"
        && currentCheck.result?.status === "passed"
        && currentCheck.result?.ok !== false
        && currentCheck.result?.contentRevision === input.contentRevision
        && currentCheck.result?.runtimeFingerprint === input.runtimeFingerprint;
    const base: CanvasProgress = {
        visible: entries.length > 0 || input.connection === "ready",
        title: "Agent tools ready",
        detail: "Send your idea in Codex. Live activity will appear here when the agent uses this page.",
        tone: "idle",
        busy: false,
        waitingForActivity: false,
        secondsSinceActivity: entries.length ? secondsSinceActivity : 0,
        canTryPreview,
        checkedPreviewCount,
        events,
    };
    if (input.connection !== "ready") {
        return {
            ...base,
            title: "Agent connection unavailable",
            detail: "Live updates are paused. The activity below is from earlier; no new agent activity is confirmed.",
            tone: "warning",
            canTryPreview: false,
        };
    }
    if (!latest) return base;
    if (running) {
        const quiet = input.now - latestActivityAt >= QUIET_ACTIVITY_MS;
        return {
            ...base,
            title: quiet ? "Waiting for the next update" : summarizeEvent(running).label,
            detail: quiet
                ? `Last confirmed activity: ${summarizeEvent(running).label.toLowerCase()}. The page cannot see what the agent does between updates.`
                : running.toolName === "kaplayground_run_game"
                ? "This checks one playable checkpoint, not whether the whole request is finished."
                : "Progress comes from real page activity. Your preview changes after a runnable update is received and run.",
            tone: quiet ? "waiting" : "working",
            busy: !quiet,
            waitingForActivity: true,
            canTryPreview: false,
        };
    }
    const event = summarizeEvent(latest);
    const checkpoint = checkpointFor(latest, entries);
    if (event.tone === "error" || event.tone === "warning") {
        return {
            ...base,
            title: event.label,
            detail: latest.toolName === "kaplayground_run_game"
                ? "Check the activity details or ask the agent to fix this checkpoint. A successful preview is not yet confirmed."
                : "The last operation was not confirmed. Check the activity details before continuing.",
            tone: event.tone,
            canTryPreview: false,
        };
    }
    if (latest.toolName === "kaplayground_run_game") {
        return {
            ...base,
            title: canTryPreview
                ? `${checkpoint ? `${checkpoint} · ` : ""}Preview checks passed — try it`
                : "Earlier preview checks passed",
            detail: canTryPreview
                ? "This checkpoint is ready to try. Visual quality is yours to judge; the agent may still make more changes."
                : "The running game or its source has changed since those checks. They do not verify the current preview.",
            tone: canTryPreview ? "ready" : "idle",
        };
    }
    if (latest.toolName === "kaplayground_save_game") {
        return {
            ...base,
            title: "Game saved",
            detail: "Storage acknowledged and verified the save. Saving does not mean the whole creative request is finished.",
            tone: "ready",
        };
    }
    return {
        ...base,
        title: latest.toolName === "kaplayground_update_game"
            ? `${checkpoint ? `${checkpoint} · ` : ""}Changes received — waiting for a preview`
            : "Waiting for the agent’s next update",
        detail: latest.toolName === "kaplayground_update_game"
            ? "Files were updated together. The game changes when the agent runs this checkpoint."
            : `Last confirmed activity: ${event.label.toLowerCase()}. You can keep playing an existing preview while the agent prepares changes.`,
        tone: "waiting",
        waitingForActivity: true,
    };
}

function summarizeEvent(entry: CanvasActivityReceipt): CanvasProgressEvent {
    const labels = TOOL_LABELS[entry.toolName];
    const result = entry.result;
    const paths = receiptPaths(entry);
    const event: CanvasProgressEvent = {
        id: entry.id,
        label: labels[entry.status === "running" ? 0 : 1],
        tone: entry.status === "running" ? "working" : "ready",
        paths,
    };
    if (entry.status === "running") {
        if (entry.toolName === "kaplayground_run_game" && entry.input.mode === "check-current") {
            event.label = "Checking the current preview";
        }
        return event;
    }
    if (entry.status === "failed" || result?.status === "failed" || result?.ok === false) {
        return { ...event, label: entry.toolName === "kaplayground_run_game"
            ? "Preview needs a fix" : `${labels[0]} did not finish`, tone: "error" };
    }
    if (entry.toolName === "kaplayground_run_game") {
        return result?.status === "passed"
            ? { ...event, label: "Preview checks passed" }
            : { ...event, label: "Preview checks incomplete", tone: "warning" };
    }
    if (entry.toolName === "kaplayground_update_game" && result?.committed !== true) {
        return { ...event, label: "Game changes not confirmed", tone: "warning" };
    }
    if (entry.toolName === "kaplayground_save_game" && (
        result?.saved !== true || result?.writeAcknowledged !== true
        || result?.readbackVerified !== true
    )) {
        return { ...event, label: "Save not confirmed", tone: "warning" };
    }
    if (entry.toolName === "kaplayground_open_example" && result?.opened !== true) {
        return { ...event, label: "Starting point was not replaced", tone: "warning" };
    }
    return event;
}

function receiptPaths(entry: CanvasActivityReceipt): string[] {
    // Never traverse arbitrary input/result objects or display source/exception text.
    const paths: unknown[] = [];
    const result = entry.result;
    if (entry.toolName === "kaplayground_update_game" && result?.committed === true
        && Array.isArray(result.changes)) {
        for (const value of result.changes.slice(0, 20)) {
            if (value && typeof value === "object" && "path" in value) paths.push(value.path);
        }
    }
    if (entry.toolName === "kaplayground_read_files" && Array.isArray(result?.paths)) {
        paths.push(...result.paths.slice(0, 20));
    }
    return [...new Set(paths.filter((path): path is string => typeof path === "string")
        .map(path => path.replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, "").slice(0, 120))
        .filter(Boolean))].slice(0, MAX_PATHS);
}

function receiptTime(entry: CanvasActivityReceipt): number {
    const start = Number.isFinite(entry.startedAt) ? entry.startedAt : 0;
    const duration = entry.status !== "running" && Number.isFinite(entry.durationMs)
        ? Math.max(0, entry.durationMs ?? 0) : 0;
    return start + duration;
}

/** A run can inherit an intention only from its matching committed revision. */
function checkpointFor(
    entry: CanvasActivityReceipt,
    entries: readonly CanvasActivityReceipt[],
): string | undefined {
    const update = entry.toolName === "kaplayground_update_game" ? entry
        : entry.toolName === "kaplayground_run_game"
        && typeof entry.result?.contentRevision === "string"
        ? entries.find(candidate =>
            candidate.toolName === "kaplayground_update_game"
            && candidate.status === "succeeded"
            && candidate.result?.committed === true
            && candidate.result?.contentRevision === entry.result?.contentRevision
            && candidate.startedAt <= entry.startedAt)
        : undefined;
    try {
        return validateCheckpointLabel(update?.input.checkpointLabel);
    } catch {
        // Old or malformed activity must never break the canvas.
        return undefined;
    }
}
