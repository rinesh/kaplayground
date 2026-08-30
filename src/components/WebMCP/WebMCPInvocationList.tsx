import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { cn } from "../../util/cn";

type Props = {
    className?: string;
};

export const WebMCPInvocationList = ({ className }: Props) => {
    const entries = useWebMCPActivity((state) => state.entries);

    if (entries.length === 0) {
        return (
            <div
                className={cn(
                    "flex min-h-24 flex-col items-center justify-center px-4 py-8 text-center",
                    className,
                )}
            >
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/65">
                    No tool calls
                </p>
                <p className="mt-1 text-xs text-base-content/45">
                    WebMCP tool calls will appear here.
                </p>
            </div>
        );
    }

    return (
        <ol
            className={cn(
                "min-h-0 overflow-y-auto divide-y divide-base-content/10",
                className,
            )}
        >
            {entries.map((entry) => (
                <li key={entry.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                            className={cn("size-2 shrink-0 rounded-full", {
                                "bg-warning animate-pulse": entry.status === "running",
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
    );
};

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
