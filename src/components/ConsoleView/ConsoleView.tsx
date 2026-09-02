import * as Tabs from "@radix-ui/react-tabs";
import { useGameConsole } from "../../hooks/useGameConsole";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { WebMCPLogPanel } from "../WebMCP";

export const ConsoleView = () => {
    const entries = useGameConsole(state => state.entries);
    const droppedCount = useGameConsole(state => state.droppedCount);
    const clearDisplayed = useGameConsole(state => state.clearDisplayed);
    const activityCount = useWebMCPActivity(state => state.entries.length);
    const errors = entries.filter(entry => entry.level === "error").length;
    const tabClass =
        "flex items-center justify-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap data-[state=active]:text-primary data-[state=active]:border-b-2 border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

    return (
        <Tabs.Root
            id="console-wrapper"
            defaultValue="webmcp"
            className="relative flex h-full w-full flex-col bg-base-300 rounded-xl overflow-hidden"
        >
            <Tabs.List
                aria-label="Output panels"
                className="flex h-10 shrink-0 border-b border-base-content/10 bg-base-200/40"
            >
                <Tabs.Trigger
                    value="webmcp"
                    id="webmcp-output-tab"
                    className={tabClass}
                >
                    Codex changes{" "}
                    <span className="rounded bg-base-content/10 px-1 text-[10px]">
                        {activityCount}
                    </span>
                </Tabs.Trigger>
                <Tabs.Trigger
                    value="console"
                    id="console-output-tab"
                    className={tabClass}
                >
                    Game messages
                    {errors > 0 && (
                        <span
                            aria-label={`${errors} game errors`}
                            className="rounded bg-error/20 px-1 text-error"
                        >
                            {errors}
                        </span>
                    )}
                </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content
                value="webmcp"
                aria-labelledby="webmcp-output-tab"
                forceMount
                className="min-h-0 flex-1 data-[state=inactive]:hidden"
            >
                <WebMCPLogPanel />
            </Tabs.Content>
            <Tabs.Content
                value="console"
                aria-labelledby="console-output-tab"
                forceMount
                className="min-h-0 flex-1 overflow-auto scrollbar-thin data-[state=inactive]:hidden"
            >
                <div className="sticky top-0 flex items-center justify-between gap-2 bg-base-300 px-3 py-2 text-xs">
                    <span>
                        {entries.length
                            ? `${entries.length} messages`
                            : "No game messages yet."}
                    </span>
                    <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={clearDisplayed}
                        disabled={!entries.length}
                    >
                        Clear messages
                    </button>
                </div>
                {droppedCount > 0 && (
                    <p className="px-3 py-2 text-xs text-warning">
                        Older messages were omitted to keep output bounded.
                    </p>
                )}
                {entries.map((entry, index) => (
                    <div
                        key={index}
                        data-log-level={entry.level}
                        className={`border-t border-base-content/10 px-3 py-2 ${
                            entry.level === "error"
                                ? "text-error bg-error/5"
                                : entry.level === "warn"
                                ? "text-warning"
                                : ""
                        }`}
                    >
                        <span className="text-[10px] uppercase opacity-60">
                            {entry.level}
                        </span>
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs">{entry.values.map(value => typeof value === "string" ? value : JSON.stringify(value, null, 2)).join(" ")}</pre>
                    </div>
                ))}
            </Tabs.Content>
        </Tabs.Root>
    );
};
