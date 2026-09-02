import type { Decode } from "console-feed";

type ConsoleMessage = {
    type: "CONSOLE";
    runId: string | null;
    log: Parameters<typeof Decode>[0];
};

export function isActiveGameConsoleMessage(
    event: Pick<MessageEvent<unknown>, "origin" | "source" | "data">,
    origin: string,
    iframeWindow: Window | null | undefined,
): event is MessageEvent<ConsoleMessage> {
    if (
        !iframeWindow || event.origin !== origin
        || event.source !== iframeWindow
    ) return false;
    if (typeof event.data !== "object" || event.data === null) return false;
    const candidate = event.data as Record<string, unknown>;
    return candidate.type === "CONSOLE"
        && (candidate.runId === null
            || (typeof candidate.runId === "string"
                && candidate.runId.length <= 128))
        && Array.isArray(candidate.log);
}
