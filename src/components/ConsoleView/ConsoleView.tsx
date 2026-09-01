import { assets } from "@kaplayjs/crew";
import { Console, Decode } from "console-feed";
import { Message } from "console-feed/lib/definitions/Console";
import { type MouseEventHandler, useEffect, useRef, useState } from "react";
import { SANDBOX_ORIGIN } from "../../config/common";
import { useProject } from "../../features/Projects/stores/useProject";
import { useConfig } from "../../hooks/useConfig";
import { useEditor } from "../../hooks/useEditor";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { cn } from "../../util/cn";
import { WebMCPLogPanel } from "../WebMCP";

type LogMessageEvent = MessageEvent<{
    type: string;
    log: Message[];
}>;

export const ConsoleView = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"console" | "webmcp">("webmcp");
    const projectKey = useProject((s) => s.projectKey || s.demoKey);
    const scrollDivRef = useRef<HTMLDivElement>(null);
    const ignoredFilter = ["[sandbox]", "[vite]"];
    const isConsoleEnabled = useConfig((s) => s.config.console);
    const webMCPStatus = useWebMCPActivity((state) => state.status);
    const webMCPEntryCount = useWebMCPActivity((state) => state.entries.length);

    const handleClear = () => {
        setLogs([]);
    };

    const handleEnable = () => {
        useConfig.getState().setConfig({ console: true });
    };

    const handleSelectWebMCP = () => {
        setActiveTab("webmcp");
    };

    const handleExpandLogs: MouseEventHandler = (e) => {
        const el = e.target as Element;
        if (!el) return;

        let toggle = el.closest("[aria-expanded]");
        if (!toggle) return;

        requestAnimationFrame(() => {
            const elRect = el.getBoundingClientRect();
            const scrollDivRect = scrollDivRef.current!.getBoundingClientRect();
            if (elRect.top > scrollDivRect.top - 5) return;

            const isNested = el.matches(
                `${"[aria-expanded] ".repeat(2)} ${el.tagName.toLowerCase()}`,
            );
            const expandedEl =
                (isNested ? toggle : toggle?.closest("[data-method]"))
                    ?? toggle;

            expandedEl.scrollIntoView({ block: "start", behavior: "instant" });
        });
    };

    const normalizeData: any = (value: Message["data"], c = new Set()) => {
        if (value && typeof value === "object") {
            if (c.has(value)) return value;
            c.add(value);

            if (Array.isArray(value)) {
                return value.map(v => normalizeData(v, c));
            }

            const obj: Record<string, Message["data"]> = {};
            for (const [k, v] of Object.entries(value)) {
                // Minified object constructor names are useless noise
                if (
                    k === "constructor" && ((v as any)?.name?.length ?? 0) < 3
                ) continue;

                obj[k] = normalizeData(v, c);
            }

            return obj;
        }

        return value;
    };

    useEffect(() => {
        const messageHandler = ({ origin, data }: LogMessageEvent) => {
            if (origin !== SANDBOX_ORIGIN) return;

            if (
                !data?.type?.startsWith("CONSOLE")
                || !data?.log
                || ignoredFilter.some(
                    s => (String(data.log?.[0]?.data?.[0] ?? "").startsWith(s)),
                )
            ) return;

            const log = Decode(data.log);

            setLogs(currLogs => [
                ...currLogs,
                { ...log, data: log.data?.map(v => normalizeData(v)) },
            ]);
        };

        if (isConsoleEnabled) {
            window.addEventListener("message", messageHandler);
        }

        const unsubscribeConsole = useConfig.subscribe(
            (s) => s.config.console,
            (enabled) => {
                useEditor.getState().getRuntime().iframe?.contentWindow
                    ?.postMessage({
                        type: "TOGGLE_CONSOLE",
                        enabled,
                    }, SANDBOX_ORIGIN);

                if (enabled) {
                    window.addEventListener("message", messageHandler);
                } else {
                    window.removeEventListener("message", messageHandler);
                    handleClear();
                }
            },
        );

        return () => {
            window.removeEventListener("message", messageHandler);
            unsubscribeConsole();
        };
    }, []);

    useEffect(handleClear, [projectKey]);

    return (
        <div
            id="console-wrapper"
            className="relative flex h-full w-full flex-col bg-base-300 rounded-xl overflow-hidden z-0"
        >
            <div
                role="tablist"
                aria-label="Output panels"
                className="flex h-8 shrink-0 items-stretch border-b border-base-content/10 bg-base-200/40"
            >
                <button
                    id="webmcp-output-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "webmcp"}
                    aria-controls="webmcp-output-panel"
                    aria-label={`Codex changes, ${webMCPEntryCount} recent actions`}
                    className={outputTabClass(activeTab === "webmcp")}
                    onClick={handleSelectWebMCP}
                >
                    <span
                        className={cn("size-1.5 rounded-full", {
                            "bg-success": webMCPStatus === "ready",
                            "bg-warning animate-pulse": webMCPStatus === "registering",
                            "bg-error": webMCPStatus === "error",
                            "bg-base-content/30": webMCPStatus === "unsupported"
                                || webMCPStatus === "destroyed",
                        })}
                        aria-hidden="true"
                    />
                    Codex changes
                    <span className="min-w-4 rounded bg-base-content/10 px-1 text-center text-[10px]">
                        {webMCPEntryCount}
                    </span>
                </button>
                <button
                    id="console-output-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "console"}
                    aria-controls="console-output-panel"
                    className={outputTabClass(activeTab === "console")}
                    onClick={() => setActiveTab("console")}
                >
                    Game messages
                </button>
            </div>

            <div
                id="console-output-panel"
                role="tabpanel"
                aria-labelledby="console-output-tab"
                ref={scrollDivRef}
                className={cn(
                    "relative min-h-0 flex-1 flex-col-reverse w-full overflow-auto scrollbar-thin",
                    activeTab === "console" ? "flex" : "hidden",
                )}
                onClick={handleExpandLogs}
            >
                {logs.length > 0 && (
                    <div className="sticky flex items-end self-end bottom-0.5 right-0.5 h-0 overflow-visible z-20">
                        <button
                            className="btn btn-ghost btn-xs p-1 h-auto rounded-[0.625rem]"
                            onClick={handleClear}
                            data-tooltip-id="global"
                            data-tooltip-html={"Clear console"}
                            data-tooltip-place="top-end"
                        >
                            <img
                                src={assets.trash.outlined}
                                alt={"Clear console"}
                                className="h-5 p-px"
                            />
                        </button>
                    </div>
                )}

                <Console
                    logs={logs}
                    variant="dark"
                    styles={{
                        BASE_FONT_FAMILY: "'DM Mono', monospace",
                        BASE_BACKGROUND_COLOR: "rgb(0 0 0 / 0)",

                        PADDING: "0.425rem 0",

                        LOG_ICON: "var(--i-log)",
                        LOG_BORDER: "oklch(var(--b1))",

                        LOG_ERROR_ICON: "var(--i-error)",
                        LOG_ERROR_COLOR: "oklch(var(--er))",
                        LOG_ERROR_BACKGROUND: "oklch(var(--er) / 0.1)",
                        LOG_ERROR_BORDER: "oklch(var(--er) / 0.1)",

                        LOG_WARN_ICON: "var(--i-warn)",
                        LOG_WARN_COLOR: "oklch(var(--wa))",
                        LOG_WARN_BACKGROUND: "oklch(var(--wa) / 0.1)",
                        LOG_WARN_BORDER: "oklch(var(--wa) / 0.05)",

                        LOG_INFO_ICON: "var(--i-info)",
                        LOG_INFO_BACKGROUND: "oklch(var(--in) / 0.03)",
                        LOG_INFO_BORDER: "oklch(var(--in) / 0.03)",

                        LOG_DEBUG_ICON: "var(--i-debug)",
                        LOG_DEBUG_COLOR: "rgb(141 183 255)",
                        LOG_DEBUG_BACKGROUND: "oklch(var(--inc) / 0.1)",

                        OBJECT_VALUE_STRING_COLOR: "rgb(233 150 122)",

                        ARROW_COLOR: "oklch(var(--bc))",
                        ARROW_FONT_SIZE: "inherit",
                    }}
                />

                {isConsoleEnabled
                    ? logs.length == 0 && (
                        <div className="px-4 py-2 text-xs font-mono opacity-70">
                            <span className="mr-3">&gt;</span>
                            Console is empty
                        </div>
                    )
                    : (
                        <div className="flex items-center justify-between gap-2 pl-4 pr-1 min-h-8 text-xs">
                            <div className="font-mono">
                                <span className="mr-3 opacity-70">&gt;</span>
                                <span className="opacity-70">Console is</span>
                                {" "}
                                <span className="text-error">disabled</span>!
                            </div>

                            <button
                                className="btn btn-xs btn-ghost bg-primary/10 text-primary hover:bg-primary/20 mb-px"
                                onClick={handleEnable}
                            >
                                Enable
                            </button>
                        </div>
                    )}
            </div>

            <div
                id="webmcp-output-panel"
                role="tabpanel"
                aria-labelledby="webmcp-output-tab"
                className={cn(
                    "min-h-0 flex-1",
                    activeTab === "webmcp" ? "block" : "hidden",
                )}
            >
                <WebMCPLogPanel />
            </div>
        </div>
    );
};

function outputTabClass(active: boolean): string {
    return cn(
        "relative flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide",
        "focus-visible:-outline-offset-2 after:absolute after:inset-x-2 after:bottom-0 after:h-px",
        active
            ? "text-primary after:bg-primary"
            : "text-base-content/50 hover:text-base-content after:bg-transparent",
    );
}
