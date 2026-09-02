import { Decode } from "console-feed";
import { create } from "zustand";
import { SANDBOX_ORIGIN } from "../config/common";
import { useProject } from "../features/Projects/stores/useProject";
import { createBoundedConsoleCapture } from "../integrations/webmcp/boundedConsoleCapture";
import type { KaplaygroundConsoleEntry } from "../integrations/webmcp/kaplaygroundWebMCP";
import { resetWebMCPActivityOnProjectReplacement } from "../integrations/webmcp/webMCPActivity";
import { isActiveGameConsoleMessage } from "./consoleMessages";
import { useEditor } from "./useEditor";
import { useWorkspace } from "./useWorkspace";

const capture = createBoundedConsoleCapture(500);
let hiddenEntries = new WeakSet<object>();

interface GameConsoleState {
    entries: readonly KaplaygroundConsoleEntry[];
    droppedCount: number;
    clearDisplayed(): void;
}

export const useGameConsole = create<GameConsoleState>(set => ({
    entries: [],
    droppedCount: 0,
    clearDisplayed() {
        // Hiding messages is a view action, not deletion of run evidence.
        hiddenEntries = new WeakSet(capture.snapshot().entries);
        set({ entries: [] });
    },
}));

function publish() {
    const snapshot = capture.snapshot();
    useGameConsole.setState({
        entries: snapshot.entries.filter(entry => !hiddenEntries.has(entry)),
        droppedCount: snapshot.droppedCount,
    });
}

/** The same bounded evidence backs visible messages and run validation. */
export const gameConsoleCapture = {
    add(entry: KaplaygroundConsoleEntry) {
        capture.add(entry);
        publish();
    },
    clear() {
        capture.clear();
        hiddenEntries = new WeakSet();
        publish();
    },
    snapshot: () => capture.snapshot(),
};

/** Installed once with the application, including browsers without WebMCP. */
export function installGameConsoleCapture(): () => void {
    const handleMessage = (event: MessageEvent<unknown>) => {
        const iframe = useEditor.getState().runtime.iframe?.contentWindow;
        if (!isActiveGameConsoleMessage(event, SANDBOX_ORIGIN, iframe)) return;

        let decoded: { method?: string; data?: unknown[] };
        try {
            decoded = Decode(event.data.log) as typeof decoded;
        } catch {
            return;
        }
        if (!decoded || !Array.isArray(decoded.data)) return;
        const values = decoded.data;
        if (
            values.some(value =>
                typeof value === "string"
                && (value.startsWith("[sandbox]") || value.startsWith("[vite]"))
            )
        ) {
            return;
        }
        const method = typeof decoded.method === "string"
            ? decoded.method.toLowerCase()
            : "log";
        gameConsoleCapture.add({
            timestamp: Date.now(),
            runId: event.data.runId,
            level: method && ["debug", "info", "warn", "error"].includes(method)
                ? method
                : "log",
            values,
        });
    };

    window.addEventListener("message", handleMessage);
    const unsubscribe = useProject.subscribe((state, previous) => {
        if (state.projectGeneration === previous.projectGeneration) {
            const selected = useWorkspace.getState().selectedAsset;
            if (
                selected?.source === "game"
                && !state.project.assets.has(selected.path)
            ) {
                useWorkspace.getState().selectAsset(null);
            }
            return;
        }
        useWorkspace.getState().selectAsset(null);
        resetWebMCPActivityOnProjectReplacement(
            state,
            previous,
            gameConsoleCapture.clear,
        );
    });
    const unsubscribeRun = useEditor.subscribe((state, previous) => {
        if (state.previewRunId !== previous.previewRunId) {
            gameConsoleCapture.clear();
        }
    });
    return () => {
        window.removeEventListener("message", handleMessage);
        unsubscribe();
        unsubscribeRun();
    };
}
