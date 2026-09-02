import { assets } from "@kaplayjs/crew";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { cn } from "../../util/cn";

const statusClasses = {
    ready: "bg-success",
    registering: "bg-warning animate-pulse",
    unsupported: "bg-base-content/30",
    error: "bg-error",
    destroyed: "bg-base-content/30",
};

export const WebMCPButton = () => {
    const status = useWebMCPActivity((state) => state.status);

    return (
        <button
            type="button"
            className={cn(
                "btn btn-sm h-full min-h-0 rounded-sm gap-1.5 px-2.5",
                "border-x border-y-0 border-primary/20 bg-primary/[0.09]",
                "text-base-content hover:border-primary/30 hover:bg-primary/[0.15]",
                "focus-visible:-outline-offset-2",
            )}
            aria-label="Remix this game with Codex"
            onClick={() =>
                document.querySelector<HTMLDialogElement>("#webmcp-panel")
                    ?.showModal()}
            data-tooltip-id="global"
            data-tooltip-content="Copy an idea and remix this game with Codex"
            data-tooltip-place="bottom-end"
        >
            <span className="relative grid size-5 place-items-center">
                <img
                    src={assets.sparkles.outlined}
                    className="size-4 object-contain"
                    aria-hidden="true"
                />
                <span
                    className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-base-300",
                        statusClasses[status],
                    )}
                />
            </span>
            <span className="font-semibold tracking-wide">
                <span className="hidden sm:inline">Remix with Codex</span>
                <span className="sm:hidden">Remix</span>
            </span>
        </button>
    );
};
