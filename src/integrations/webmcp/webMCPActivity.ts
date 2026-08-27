import { create } from "zustand";
import type {
    KaplaygroundWebMCPInvocation,
    KaplaygroundWebMCPStatus,
} from "./kaplaygroundWebMCP";

const MAX_ACTIVITY_ENTRIES = 100;
const MAX_VISIBLE_STRING = 800;
const MAX_VISIBLE_ITEMS = 20;

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

export const useWebMCPActivity = create<WebMCPActivityStore>((set) => ({
    status: "registering",
    toolNames: [],
    entries: [],

    setConnection(status, toolNames) {
        set({ status, toolNames: [...toolNames] });
    },

    recordInvocation(invocation) {
        set((state) => {
            const index = state.entries.findIndex((entry) => entry.id === invocation.id);
            if (index === -1) {
                if (invocation.status !== "running") return state;
                return {
                    entries: [
                        {
                            ...invocation,
                            input: summarizeInput(invocation.input),
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

function summarizeInput(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(input).slice(0, MAX_VISIBLE_ITEMS).map(([key, value]) => [
            key,
            summarizeValue(value, 0),
        ]),
    );
}

function summarizeValue(value: unknown, depth: number): unknown {
    if (typeof value === "string") {
        if (value.length <= MAX_VISIBLE_STRING) return value;
        return `${value.slice(0, MAX_VISIBLE_STRING)}\n… [${value.length} characters]`;
    }
    if (value === null || typeof value !== "object") return value;
    if (depth >= 4) return "[Max depth]";
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_VISIBLE_ITEMS).map((item) =>
            summarizeValue(item, depth + 1)
        );
        if (value.length > MAX_VISIBLE_ITEMS) {
            items.push(`… [${value.length - MAX_VISIBLE_ITEMS} more items]`);
        }
        return items;
    }
    return Object.fromEntries(
        Object.entries(value).slice(0, MAX_VISIBLE_ITEMS).map(([key, item]) => [
            key,
            summarizeValue(item, depth + 1),
        ]),
    );
}
