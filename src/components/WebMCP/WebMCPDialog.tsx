import { cn } from "../../util/cn";
import { WEBMCP_EXAMPLE_NAME } from "../../data/demos";
import { useProject } from "../../features/Projects/stores/useProject";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { confirmNavigate } from "../../util/confirmNavigate";
import { Dialog } from "../UI/Dialog";

const statusDetails = {
    ready: {
        label: "WEBMCP LINKED",
        badge: "badge-success",
        description: "An agent can discover and invoke this editor's tools.",
    },
    registering: {
        label: "CONNECTING",
        badge: "badge-warning",
        description: "KAPLAYGROUND is registering its browser tools.",
    },
    unsupported: {
        label: "UNAVAILABLE",
        badge: "badge-ghost",
        description: "This browser session does not expose the WebMCP API.",
    },
    error: {
        label: "CONNECTION ERROR",
        badge: "badge-error",
        description: "The browser rejected one or more WebMCP tools.",
    },
    destroyed: {
        label: "DISCONNECTED",
        badge: "badge-ghost",
        description: "The WebMCP bridge has been disconnected.",
    },
};

const examplePrompt =
    "Inspect this KAPLAYGROUND example, change the bean color and speed, "
    + "run the preview, then check diagnostics and console output.";

export const WebMCPDialog = () => {
    const status = useWebMCPActivity((state) => state.status);
    const toolNames = useWebMCPActivity((state) => state.toolNames);
    const entries = useWebMCPActivity((state) => state.entries);
    const clearInvocations = useWebMCPActivity((state) => state.clearInvocations);
    const details = statusDetails[status];

    const openExample = () => {
        void confirmNavigate(() => {
            document.querySelector<HTMLDialogElement>("#webmcp-panel")?.close();
            void useProject.getState().createNewProject(
                "ex",
                {},
                WEBMCP_EXAMPLE_NAME,
            );
        });
    };

    return (
        <Dialog
            id="webmcp-panel"
            mainClass="max-w-3xl w-[min(52rem,calc(100vw-2rem))]"
            contentClass="p-0 overflow-hidden"
        >
            <header
                className={cn(
                    "flex flex-wrap items-start justify-between gap-3 px-6 py-5",
                    "border-b border-base-content/10",
                )}
            >
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">WebMCP</h2>
                        <span className={cn("badge badge-sm font-semibold", details.badge)}>
                            {details.label}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-base-content/65">
                        {details.description}
                    </p>
                </div>
                <form method="dialog">
                    <button className="btn btn-sm btn-ghost" aria-label="Close WebMCP panel">
                        Close
                    </button>
                </form>
            </header>

            <section className="px-6 py-5 border-b border-base-content/10 bg-base-200/45">
                <div className="flex flex-wrap justify-between gap-4">
                    <div className="max-w-xl">
                        <h3 className="font-semibold">Try the agent-ready example</h3>
                        <p className="mt-1 text-sm text-base-content/65">
                            It has clear settings to edit and emits console
                            output, so an agent can demonstrate the full inspect,
                            edit, run, and verify loop.
                        </p>
                    </div>
                    <button className="btn btn-sm btn-primary" type="button" onClick={openExample}>
                        Open WebMCP example
                    </button>
                </div>
                <code
                    className={cn(
                        "block mt-4 p-3 rounded-lg bg-base-300 text-xs",
                        "whitespace-pre-wrap break-words",
                    )}
                >
                    {examplePrompt}
                </code>
            </section>

            <section className="px-6 py-4 border-b border-base-content/10">
                <details>
                    <summary className="cursor-pointer font-semibold">
                        Available tools{" "}
                        <span className="text-base-content/50">
                            ({toolNames.length})
                        </span>
                    </summary>
                    <div className="grid sm:grid-cols-2 gap-1.5 mt-3">
                        {toolNames.map((name) => (
                            <code
                                key={name}
                                className="px-2.5 py-1.5 rounded bg-base-200 text-xs break-all"
                            >
                                {name}
                            </code>
                        ))}
                    </div>
                </details>
            </section>

            <section className="min-h-0">
                <div
                    className={cn(
                        "flex items-center justify-between gap-3 px-6 py-3",
                        "border-b border-base-content/10",
                    )}
                >
                    <div>
                        <h3 className="font-semibold">Tool invocations</h3>
                        <p className="text-xs text-base-content/50">
                            Newest first · inputs are truncated for display
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        disabled={entries.length === 0}
                        onClick={clearInvocations}
                    >
                        Clear
                    </button>
                </div>

                {entries.length === 0
                    ? (
                        <p className="px-6 py-10 text-center text-sm text-base-content/50">
                            No WebMCP tools have been invoked in this session.
                        </p>
                    )
                    : (
                        <ol className="max-h-72 overflow-y-auto divide-y divide-base-content/10">
                            {entries.map((entry) => (
                                <li key={entry.id} className="px-6 py-3">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span
                                            className={cn("size-2 rounded-full", {
                                                "bg-warning animate-pulse":
                                                    entry.status === "running",
                                                "bg-success": entry.status === "succeeded",
                                                "bg-error": entry.status === "failed",
                                            })}
                                            aria-hidden="true"
                                        />
                                        <code className="font-semibold text-xs break-all">
                                            {entry.toolName}
                                        </code>
                                        <time className="ml-auto text-xs text-base-content/45">
                                            {formatTime(entry.startedAt)}
                                            {entry.durationMs !== undefined
                                                && ` · ${entry.durationMs} ms`}
                                        </time>
                                    </div>
                                    <pre
                                        className={cn(
                                            "mt-2 max-h-36 overflow-auto rounded bg-base-300 p-2",
                                            "text-[11px] whitespace-pre-wrap break-words",
                                        )}
                                    >
                                        {JSON.stringify(entry.input, null, 2)}
                                    </pre>
                                    {entry.error && (
                                        <p className="mt-2 text-xs text-error break-words">
                                            {entry.error}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
            </section>
        </Dialog>
    );
};

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
