import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { WebMCPInvocationList } from "./WebMCPInvocationList";

const statusLabels = {
    ready: "Linked",
    registering: "Connecting",
    unsupported: "Unavailable",
    error: "Connection error",
    destroyed: "Disconnected",
};

export const WebMCPLogPanel = () => {
    const status = useWebMCPActivity((state) => state.status);
    const toolCount = useWebMCPActivity((state) => state.toolNames.length);
    const entryCount = useWebMCPActivity((state) => state.entries.length);
    const clearInvocations = useWebMCPActivity((state) => state.clearInvocations);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-base-content/10 px-3 py-2">
                <div className="min-w-0">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide">
                        Tool invocations
                    </h2>
                    <p className="truncate text-[10px] text-base-content/45">
                        {statusLabels[status]} · {toolCount} tools · newest first
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-ghost btn-xs shrink-0"
                    disabled={entryCount === 0}
                    onClick={clearInvocations}
                >
                    Clear
                </button>
            </header>

            <WebMCPInvocationList className="flex-1" />
        </div>
    );
};
