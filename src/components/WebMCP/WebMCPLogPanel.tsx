import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { WebMCPInvocationList } from "./WebMCPInvocationList";

const statusLabels = {
    ready: "Ready for your next idea",
    registering: "Getting ready",
    unsupported: "Open this page in Codex to start",
    error: "Reopen this page to reconnect",
    destroyed: "Connection paused",
};

export const WebMCPLogPanel = () => {
    const status = useWebMCPActivity((state) => state.status);
    const entryCount = useWebMCPActivity((state) => state.entries.length);
    const clearInvocations = useWebMCPActivity((state) => state.clearInvocations);

    const openWorkspace = () => {
        document.querySelector<HTMLDialogElement>("#webmcp-panel")
            ?.showModal();
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-base-content/10 px-3 py-2">
                <div className="min-w-0">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-white">
                        What Codex is doing
                    </h2>
                    <p className="truncate text-[10px] text-base-content/45">
                        {statusLabels[status]}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        className="btn btn-ghost btn-xs text-primary"
                        onClick={openWorkspace}
                    >
                        More ideas
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={entryCount === 0}
                        onClick={clearInvocations}
                    >
                        Clear
                    </button>
                </div>
            </header>

            <WebMCPInvocationList className="flex-1" />
        </div>
    );
};
