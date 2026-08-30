import { cn } from "../../util/cn";
import { WEBMCP_EXAMPLE_NAME } from "../../data/demos";
import { useProject } from "../../features/Projects/stores/useProject";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { confirmNavigate } from "../../util/confirmNavigate";
import { Dialog } from "../UI/Dialog";
import { WebMCPInvocationList } from "./WebMCPInvocationList";

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

                <WebMCPInvocationList className="max-h-72" />
            </section>
        </Dialog>
    );
};
