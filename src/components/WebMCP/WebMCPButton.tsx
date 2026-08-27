import { cn } from "../../util/cn";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";

const statusClasses = {
    ready: "bg-success",
    registering: "bg-warning animate-pulse",
    unsupported: "bg-base-content/30",
    error: "bg-error",
    destroyed: "bg-base-content/30",
};

export const WebMCPButton = () => {
    const status = useWebMCPActivity((state) => state.status);
    const entryCount = useWebMCPActivity((state) => state.entries.length);
    const toolCount = useWebMCPActivity((state) => state.toolNames.length);

    return (
        <button
            type="button"
            className={cn(
                "btn btn-xs btn-ghost h-full rounded-sm gap-1.5 px-2",
                "focus-visible:-outline-offset-2",
            )}
            aria-label={`Open WebMCP activity. ${toolCount} tools, ${entryCount} invocations.`}
            onClick={() =>
                document.querySelector<HTMLDialogElement>("#webmcp-panel")
                    ?.showModal()}
            data-tooltip-id="global"
            data-tooltip-content={`${toolCount} WebMCP tools · ${entryCount} invocations`}
            data-tooltip-place="bottom-end"
        >
            <span
                className={cn("size-2 rounded-full", statusClasses[status])}
                aria-hidden="true"
            />
            <span className="font-semibold tracking-wide">WebMCP</span>
            {entryCount > 0 && (
                <span className="badge badge-xs border-0 bg-base-content/15 min-w-5">
                    {entryCount}
                </span>
            )}
        </button>
    );
};
