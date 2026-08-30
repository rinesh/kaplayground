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
                    Ready when you are
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-base-content/45">
                    When Codex starts changing the game, friendly progress
                    updates will appear here.
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
                        <span className="font-semibold text-xs">
                            {friendlyAction(entry.toolName)}
                        </span>
                        <time className="ml-auto text-xs text-base-content/45">
                            {formatTime(entry.startedAt)}
                            {entry.durationMs !== undefined
                                && ` · ${entry.durationMs} ms`}
                        </time>
                    </div>
                    <details className="mt-2 text-[11px] text-base-content/45">
                        <summary className="cursor-pointer">
                            Technical details
                        </summary>
                        <code className="mt-2 block break-all text-base-content/55">
                            {entry.toolName}
                        </code>
                        <pre
                            className={cn(
                                "mt-1 max-h-36 overflow-auto rounded bg-base-300 p-2",
                                "whitespace-pre-wrap break-words",
                            )}
                        >
                            {JSON.stringify(entry.input, null, 2)}
                        </pre>
                    </details>
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

const friendlyActions: Record<string, string> = {
    kaplayground_get_agent_guide: "Getting ready to help",
    kaplayground_get_project: "Looking at your game",
    kaplayground_list_files: "Finding the game pieces",
    kaplayground_read_file: "Reading the current game",
    kaplayground_replace_file: "Changing the game",
    kaplayground_create_file: "Adding something new",
    kaplayground_remove_file: "Removing an old game piece",
    kaplayground_select_file: "Opening part of the game",
    kaplayground_run_preview: "Starting your updated game",
    kaplayground_stop_preview: "Pausing the game",
    kaplayground_set_preview_paused: "Changing the pause state",
    kaplayground_inspect_preview: "Checking the new result",
    kaplayground_get_diagnostics: "Checking for mistakes",
    kaplayground_get_console: "Making sure the game works",
    kaplayground_list_assets: "Looking through the toy box",
    kaplayground_save_project: "Saving your game",
};

function friendlyAction(toolName: string): string {
    return friendlyActions[toolName] ?? "Working on your game";
}

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
