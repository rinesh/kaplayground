import { create } from "zustand";
import { summarizeWebMCPActivityInput } from "./activitySummary.ts";
import type {
    KaplaygroundWebMCPInvocation,
    KaplaygroundWebMCPStatus,
} from "./kaplaygroundWebMCP";

const MAX_ACTIVITY_ENTRIES = 100;

export interface WebMCPActivityEntry extends KaplaygroundWebMCPInvocation {
    input: Record<string, unknown>;
}

interface WebMCPActivityStore {
    status: KaplaygroundWebMCPStatus;
    toolNames: string[];
    entries: WebMCPActivityEntry[];
    setConnection(
        status: KaplaygroundWebMCPStatus,
        toolNames: readonly string[],
    ): void;
    recordInvocation(invocation: KaplaygroundWebMCPInvocation): void;
    clearInvocations(): void;
}

interface ProjectGenerationState {
    projectGeneration: number;
}

export const useWebMCPActivity = create<WebMCPActivityStore>((set) => ({
    status: "registering",
    toolNames: [],
    entries: [],

    setConnection(status, toolNames) {
        set({ status, toolNames: [...toolNames] });
    },

    recordInvocation(invocation) {
        set((state) => {
            const index = state.entries.findIndex((entry) =>
                entry.id === invocation.id
            );
            if (index === -1) {
                if (invocation.status !== "running") return state;
                return {
                    entries: [
                        {
                            ...invocation,
                            input: summarizeWebMCPActivityInput(invocation.input),
                        },
                        ...state.entries,
                    ].slice(0, MAX_ACTIVITY_ENTRIES),
                };
            }

            const entries = [...state.entries];
            entries[index] = {
                ...entries[index],
                status: invocation.status,
                durationMs: invocation.durationMs,
                error: invocation.error,
            };
            return { entries };
        });
    },

    clearInvocations() {
        set({ entries: [] });
    },
}));

export function resetWebMCPActivityOnProjectReplacement(
    state: ProjectGenerationState,
    previous: ProjectGenerationState,
    clearConsoleEntries: () => void,
): void {
    if (state.projectGeneration === previous.projectGeneration) return;
    clearConsoleEntries();
    useWebMCPActivity.getState().clearInvocations();
}
