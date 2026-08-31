import { useState } from "react";
import { useCodexPlayGuide } from "../../integrations/webmcp/useCodexPlayGuide";
import { useWebMCPActivity } from "../../integrations/webmcp/webMCPActivity";
import { cn } from "../../util/cn";
import { Dialog } from "../UI/Dialog";
import { WebMCPInvocationList } from "./WebMCPInvocationList";
import { WebMCPTutorial } from "./WebMCPTutorial";

const statusDetails = {
    ready: {
        label: "Codex is ready",
        dot: "bg-success",
        description: "Keep this page open while Codex changes your game.",
    },
    registering: {
        label: "Getting ready",
        dot: "bg-warning animate-pulse",
        description: "Your game will be ready to remix in a moment.",
    },
    unsupported: {
        label: "Open in Codex",
        dot: "bg-base-content/30",
        description: "Open this page in Codex's Browser to try these ideas.",
    },
    error: {
        label: "Try reopening the page",
        dot: "bg-error",
        description: "Codex could not connect to this game yet.",
    },
    destroyed: {
        label: "Connection paused",
        dot: "bg-base-content/30",
        description: "Reopen this page when you want to keep remixing.",
    },
};

export const WebMCPDialog = () => {
    const [copyStatus, setCopyStatus] = useState<
        "idle" | "copied" | "failed"
    >("idle");
    const status = useWebMCPActivity((state) => state.status);
    const entries = useWebMCPActivity((state) => state.entries);
    const clearInvocations = useWebMCPActivity((state) =>
        state.clearInvocations
    );
    const details = statusDetails[status];
    const guide = useCodexPlayGuide();

    const copyPageLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopyStatus("copied");
        } catch {
            setCopyStatus("failed");
        }
    };

    return (
        <Dialog
            id="webmcp-panel"
            mainClass="w-[min(48rem,calc(100vw-2rem))] max-w-3xl border border-white/10 bg-[#151626]"
            contentClass="overflow-hidden p-0"
        >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-[#1d1831] px-5 py-5 sm:px-7">
                <div className="flex min-w-0 items-start gap-3">
                    <span
                        className="grid size-10 shrink-0 place-items-center rounded-2xl bg-fuchsia-400 text-xl text-white shadow-lg shadow-fuchsia-500/20"
                        aria-hidden="true"
                    >
                        ✦
                    </span>
                    <div>
                        <h2 className="break-words text-xl font-bold text-white sm:text-2xl">
                            Remix {guide.subjectTitle} with Codex
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">
                            {status === "unsupported"
                                ? "Open this game in Codex's Browser to remix it with Codex."
                                : (
                                    <>
                                        Pick one idea, copy it into Codex, then
                                        play the updated game. Repeat until it
                                        feels like yours.
                                    </>
                                )}
                        </p>
                    </div>
                </div>

                <form method="dialog">
                    <button className="btn btn-sm btn-ghost">Close</button>
                </form>
            </header>

            <div className="p-4 sm:p-6">
                {status === "unsupported"
                    ? (
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                            <h3 className="text-lg font-bold text-white">
                                Remixing with Codex isn't available in this
                                browser
                            </h3>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                                Copy this page's link, open Codex's Browser, and
                                visit the link there so Codex can change the
                                game. You can keep playing and editing in this
                                browser.
                            </p>
                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={copyPageLink}
                                    aria-live="polite"
                                >
                                    {copyStatus === "copied"
                                        ? "Link copied"
                                        : "Copy link"}
                                </button>
                                <form method="dialog">
                                    <button className="btn btn-sm btn-ghost">
                                        Keep playing
                                    </button>
                                </form>
                                {copyStatus === "failed" && (
                                    <p
                                        className="text-xs text-error"
                                        role="status"
                                    >
                                        Couldn't copy the link. Copy it from
                                        your browser's address bar instead.
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                    : (
                        <>
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                    <span
                                        className={cn(
                                            "size-2 rounded-full",
                                            details.dot,
                                        )}
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <p className="text-xs font-bold text-white">
                                            {details.label}
                                        </p>
                                        <p className="text-xs text-white/50">
                                            {details.description}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <WebMCPTutorial key={guide.key} guide={guide} />
                        </>
                    )}
            </div>

            {status !== "unsupported" && (
                <details className="border-t border-white/10 bg-black/15">
                    <summary className="cursor-pointer px-5 py-3 text-xs font-semibold text-white/45 sm:px-7">
                        Advanced details{" "}
                        {entries.length > 0 && `(${entries.length})`}
                    </summary>
                    <div className="border-t border-white/10">
                        <div className="flex items-center justify-between gap-3 px-5 py-2 sm:px-7">
                            <p className="text-xs text-white/45">
                                A behind-the-scenes history of Codex's actions.
                            </p>
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                disabled={entries.length === 0}
                                onClick={clearInvocations}
                            >
                                Clear
                            </button>
                        </div>
                        <WebMCPInvocationList className="max-h-56" />
                    </div>
                </details>
            )}
        </Dialog>
    );
};
