import { useEffect, useRef, useState } from "react";
import { useProject } from "../../features/Projects/stores/useProject";
import { useEditor } from "../../hooks/useEditor";
import { deriveCanvasProgress } from "../../integrations/webmcp/canvasProgress";
import { gameContentRevision } from "../../integrations/webmcp/gameIdentity";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import "./CanvasBuildOverlay.css";

/** Page-owned UI: no injected game code, preview restarts, or keyboard interception. */
export function CanvasBuildOverlay() {
    const entries = useWebMCPActivity(state => state.entries);
    const connection = useWebMCPActivity(state => state.status);
    const generation = useProject(state => state.projectGeneration);
    const contentRevision = useProject(state => gameContentRevision(state));
    const runId = useEditor(state => state.previewRunId);
    const runtimeFingerprint = useEditor(state => state.previewRuntimeFingerprint);
    const stopped = useEditor(state => state.stopped);
    const autoExpanded = useRef(false);
    const [now, setNow] = useState(() => Date.now());
    const [collapsed, setCollapsed] = useState(true);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const progress = deriveCanvasProgress({
        entries, connection, now, runId, contentRevision, runtimeFingerprint, stopped,
    });

    useEffect(() => {
        setNow(Date.now());
    }, [entries, connection]);

    useEffect(() => {
        autoExpanded.current = false;
        setCollapsed(true);
        setDetailsOpen(false);
    }, [generation]);

    const needsClock = progress.waitingForActivity
        || (!collapsed && progress.events.length > 0);
    useEffect(() => {
        if (!needsClock) return;
        const tick = () => {
            if (!document.hidden) setNow(Date.now());
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        document.addEventListener("visibilitychange", tick);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", tick);
        };
    }, [needsClock]);

    // Expand once per project, not on every tool call or timer tick.
    // Once minimized, the overlay stays out of the player's way.
    const newestId = entries[0]?.id;
    useEffect(() => {
        if (!autoExpanded.current && entries[0]?.status === "running") {
            autoExpanded.current = true;
            setCollapsed(false);
        }
    }, [newestId]);

    if (!progress.visible) return null;

    return (
        <aside
            className="canvas-build-overlay"
            aria-label="Live game update progress"
            data-tone={progress.tone}
            data-collapsed={collapsed}
            data-testid="canvas-build-overlay"
        >
            <div className="canvas-build-panel">
                <div className="canvas-build-heading">
                    <span className="canvas-build-indicator" data-busy={progress.busy} aria-hidden="true" />
                    <div className="canvas-build-status" role="status" aria-live="polite" aria-atomic="true">
                        <strong>{progress.title}</strong>
                        {!collapsed && <p>{progress.detail}</p>}
                    </div>
                    <button
                        type="button"
                        className="canvas-build-button"
                        aria-label={collapsed ? "Show live progress" : "Minimize live progress"}
                        aria-expanded={!collapsed}
                        onClick={() => setCollapsed(value => !value)}
                    >
                        {collapsed ? "Show" : "Hide"}
                    </button>
                </div>
                {!collapsed && (
                    <div className="canvas-build-body">
                        <div className="canvas-build-meta">
                            <span>{progress.events.length > 0
                                ? `Last activity ${progress.secondsSinceActivity}s ago`
                                : "No agent activity yet"}</span>
                            {progress.checkedPreviewCount > 0 && (
                                <span>{progress.checkedPreviewCount} recent {progress.checkedPreviewCount === 1 ? "checkpoint" : "checkpoints"} checked</span>
                            )}
                        </div>
                        <div className="canvas-build-actions">
                            {progress.events.length > 0 && (
                                <button
                                    type="button"
                                    className="canvas-build-button"
                                    aria-expanded={detailsOpen}
                                    aria-controls="canvas-build-recent-activity"
                                    onClick={() => setDetailsOpen(value => !value)}
                                >
                                    {detailsOpen ? "Close activity" : "View activity"}
                                </button>
                            )}
                            {progress.canTryPreview && (
                                <button
                                    type="button"
                                    className="canvas-build-button canvas-build-try"
                                    onClick={() => {
                                        setCollapsed(true);
                                        setDetailsOpen(false);
                                        useEditor.getState().focusGame();
                                    }}
                                >
                                    Try this preview
                                </button>
                            )}
                        </div>
                        {detailsOpen && (
                            <ol id="canvas-build-recent-activity" className="canvas-build-events" tabIndex={0} aria-label="Recent agent activity, newest first">
                                {progress.events.map(event => (
                                    <li key={event.id} data-tone={event.tone}>
                                        <span aria-hidden="true">{event.tone === "ready" ? "✓" : event.tone === "error" ? "!" : "·"}</span>
                                        <div>
                                            <span>{event.label}</span>
                                            {event.paths.length > 0 && <small>{event.paths.join(", ")}</small>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
