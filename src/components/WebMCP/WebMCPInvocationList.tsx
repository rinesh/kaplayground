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
                    updates and verification evidence will appear here.
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
                                "bg-warning animate-pulse":
                                    entry.status === "running",
                                "bg-success": entry.status === "succeeded"
                                    && entry.result?.complete === true,
                                "bg-warning": entry.status === "succeeded"
                                    && entry.result?.complete === false
                                    && entry.result?.ok !== false,
                                "bg-error": entry.status === "failed"
                                    || entry.result?.ok === false,
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
                    {entry.result && (
                        <VerificationReceipt
                            toolName={entry.toolName}
                            result={entry.result}
                        />
                    )}
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
                        {entry.result && (
                            <pre
                                className={cn(
                                    "mt-1 max-h-52 overflow-auto rounded bg-base-300 p-2",
                                    "whitespace-pre-wrap break-words",
                                )}
                            >
                                {JSON.stringify(entry.result, null, 2)}
                            </pre>
                        )}
                    </details>
                    {entry.error && (
                        <p className="mt-2 text-xs text-error break-words">
                            {entry.errorCode && (
                                <code className="mr-1 rounded bg-error/10 px-1 py-0.5">
                                    {entry.errorCode}
                                </code>
                            )}
                            {entry.error}
                        </p>
                    )}
                </li>
            ))}
        </ol>
    );
};

type ReceiptProps = {
    toolName: string;
    result: Record<string, unknown>;
};

const VerificationReceipt = ({ toolName, result }: ReceiptProps) => {
    if (toolName === "kaplayground_run_game") {
        const diagnostics = record(result.diagnostics);
        const consoleResult = record(result.console);
        const gameplay = record(result.gameplay);
        const scene = record(result.scene);
        const status = typeof result.status === "string"
            ? result.status
            : "checked";
        return (
            <div className="mt-2 rounded-lg border border-base-content/10 bg-base-300/50 p-2 text-[11px] leading-relaxed">
                <p className="font-semibold">
                    Verification: {status}
                </p>
                <p className="text-base-content/55">
                    {countLabel(diagnostics?.errorCount, "code error")}
                    {" · "}
                    {countLabel(consoleResult?.errorCount, "console error")}
                    {gameplay && (
                        <>
                            {" · "}
                            {countLabel(
                                gameplay.inputActionCount,
                                "control action",
                            )}
                            {" · "}
                            {countLabel(
                                gameplay.checkpointCount,
                                "checkpoint",
                            )}
                            {" · "}
                            {countLabel(
                                gameplay.assertionCount,
                                "assertion",
                            )}
                        </>
                    )}
                    {scene && typeof scene.layoutWarningCount === "number" && (
                        <>
                            {" · "}
                            {countLabel(
                                scene.layoutWarningCount,
                                "layout warning",
                            )}
                        </>
                    )}
                </p>
                {Array.isArray(gameplay?.checkpoints) && (
                    <ul className="mt-1 space-y-0.5">
                        {gameplay.checkpoints.map((value, index) => {
                            const checkpoint = record(value);
                            return (
                                <li key={`${String(checkpoint?.name)}-${index}`}>
                                    {checkpoint?.passed === true ? "✓" : checkpoint?.passed === false ? "×" : "—"}{" "}
                                    {String(checkpoint?.name ?? "Checkpoint")}
                                    {checkpoint?.checkCount === 0 && " (snapshot)"}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {Array.isArray(result.incompleteReasons) && result.incompleteReasons.length > 0 && (
                    <p className="mt-1 text-warning">
                        {result.incompleteReasons.join(" ")}
                    </p>
                )}
                {Array.isArray(result.notChecked) && result.notChecked.length > 0 && (
                    <p className="mt-1 text-base-content/45">
                        Not automatically judged: {result.notChecked.join(", ")}
                    </p>
                )}
            </div>
        );
    }

    if (toolName === "kaplayground_save_game") {
        return (
            <div className="mt-2 rounded-lg border border-base-content/10 bg-base-300/50 p-2 text-[11px] leading-relaxed">
                <p className="font-semibold">Persistence receipt</p>
                <p className="text-base-content/55">
                    {result.writeAcknowledged === true ? "✓ write acknowledged" : "— write not confirmed"}
                    {" · "}
                    {result.readbackVerified === true ? "✓ read-back matched" : "— read-back not confirmed"}
                </p>
            </div>
        );
    }

    return null;
};

const friendlyActions: Record<string, string> = {
    kaplayground_inspect_game: "Looking at your game",
    kaplayground_read_files: "Reading the game",
    kaplayground_update_game: "Changing the game",
    kaplayground_run_game: "Starting and checking the game",
    kaplayground_find_assets: "Looking through the toy box",
    kaplayground_save_game: "Saving your game",
    kaplayground_find_examples: "Finding a starting point",
    kaplayground_open_example: "Opening a starting point",
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

function countLabel(value: unknown, singular: string): string {
    const count = typeof value === "number" ? value : 0;
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function record(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}
