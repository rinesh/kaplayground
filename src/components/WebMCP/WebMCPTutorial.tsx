import { useEffect, useRef, useState } from "react";
import type { CodexPlayGuide } from "../../integrations/webmcp/codexPlayGuide";
import {
    clampCodexPlayStep,
    readCodexPlayStepIndex,
    writeCodexPlayStepIndex,
} from "../../integrations/webmcp/codexPlayProgress";
import { cn } from "../../util/cn";
import { copyText } from "../../util/copyText";

const STEP_EVENT = "kaplayground-codex-play-step";

type Props = {
    guide: CodexPlayGuide;
    className?: string;
    condensed?: boolean;
};

type StepChangeDetail = {
    guideKey: string;
    stepIndex: number;
};

export const WebMCPTutorial = ({
    guide,
    className,
    condensed = false,
}: Props) => {
    const steps = guide.steps;
    const [stepIndex, setStepIndex] = useState(() =>
        readCodexPlayStepIndex(guide.key, steps.length)
    );
    const [copied, setCopied] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const copyRequest = useRef(0);
    const manualPrompt = useRef<HTMLTextAreaElement>(null);
    const resetTimer = useRef<number | undefined>();
    const step = steps[stepIndex] ?? steps[0];

    useEffect(() => {
        setStepIndex(readCodexPlayStepIndex(guide.key, steps.length));
        copyRequest.current++;
        setCopied(false);
        setCopying(false);
        setCopyFailed(false);
        window.clearTimeout(resetTimer.current);
    }, [guide.key, steps.length]);

    useEffect(() => {
        const handleStepChange = (event: Event) => {
            const detail = (event as CustomEvent<StepChangeDetail>).detail;
            if (
                detail?.guideKey === guide.key
                && Number.isInteger(detail.stepIndex)
            ) {
                setStepIndex(
                    clampCodexPlayStep(detail.stepIndex, steps.length),
                );
                copyRequest.current++;
                setCopied(false);
                setCopying(false);
                setCopyFailed(false);
                window.clearTimeout(resetTimer.current);
            }
        };

        window.addEventListener(STEP_EVENT, handleStepChange);
        return () => {
            copyRequest.current++;
            window.removeEventListener(STEP_EVENT, handleStepChange);
            window.clearTimeout(resetTimer.current);
        };
    }, [guide.key, steps.length]);

    useEffect(() => {
        if (!copyFailed) return;
        manualPrompt.current?.focus({ preventScroll: true });
        manualPrompt.current?.select();
    }, [copyFailed]);

    const goToStep = (nextIndex: number) => {
        const clampedIndex = clampCodexPlayStep(nextIndex, steps.length);
        setStepIndex(clampedIndex);
        copyRequest.current++;
        setCopied(false);
        setCopying(false);
        setCopyFailed(false);
        writeCodexPlayStepIndex(guide.key, clampedIndex);
        window.dispatchEvent(
            new CustomEvent<StepChangeDetail>(STEP_EVENT, {
                detail: { guideKey: guide.key, stepIndex: clampedIndex },
            }),
        );
    };

    const copyPrompt = async () => {
        if (!step.prompt) return;
        const request = ++copyRequest.current;
        setCopying(true);
        setCopied(false);
        setCopyFailed(false);

        try {
            await copyText(step.prompt);
            if (request !== copyRequest.current) return;
            setCopyFailed(false);
            setCopied(true);
            window.clearTimeout(resetTimer.current);
            resetTimer.current = window.setTimeout(() => {
                setCopied(false);
            }, 2400);
        } catch {
            if (request !== copyRequest.current) return;
            setCopyFailed(true);
        } finally {
            if (request === copyRequest.current) setCopying(false);
        }
    };

    return (
        <section
            className={cn(
                "overflow-hidden rounded-2xl border border-fuchsia-200/20",
                "bg-gradient-to-br from-[#241b3c] via-[#1c1831] to-[#121827]",
                condensed ? "p-3 sm:p-4" : "p-5 sm:p-6",
                className,
            )}
        >
            <div
                className={cn(
                    "grid items-center gap-4",
                    condensed
                        && "@2xl:grid-cols-[minmax(15rem,0.8fr)_minmax(21rem,1.2fr)]",
                )}
            >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-fuchsia-300/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-fuchsia-200">
                            {step?.eyebrow}
                        </span>
                        <span className="text-[11px] font-semibold text-white/45">
                            {stepIndex + 1} of {steps.length}
                        </span>
                    </div>
                    <h2
                        className={cn(
                            "mt-2 font-bold tracking-[-0.02em] text-white",
                            condensed ? "text-base sm:text-lg" : "text-2xl",
                        )}
                    >
                        {step?.title}
                    </h2>
                    <p
                        className={cn(
                            "mt-1 leading-relaxed text-slate-300",
                            condensed ? "text-xs sm:text-sm" : "text-sm",
                        )}
                    >
                        {step?.description}
                    </p>
                </div>

                <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                    {step?.prompt
                        ? (
                            <>
                                <p
                                    className={cn(
                                        "select-text break-words text-slate-100",
                                        condensed
                                            ? "text-xs leading-relaxed"
                                            : "text-sm leading-relaxed",
                                    )}
                                >
                                    “{step.prompt}”
                                </p>
                                {copyFailed && (
                                    <textarea
                                        ref={manualPrompt}
                                        aria-label="Prompt to copy"
                                        className="textarea textarea-bordered mt-3 w-full text-xs"
                                        readOnly
                                        rows={4}
                                        value={step.prompt}
                                        onFocus={(event) =>
                                            event.currentTarget.select()}
                                    />
                                )}
                                <button
                                    type="button"
                                    className="btn btn-xs mt-3 border-0 bg-fuchsia-500 text-white hover:bg-fuchsia-400"
                                    onClick={() => void copyPrompt()}
                                    aria-busy={copying}
                                >
                                    {copying
                                        ? "Copying…"
                                        : copied
                                        ? "Copied — paste it into Codex"
                                        : copyFailed
                                        ? "Try copying again"
                                        : "Copy for Codex"}
                                </button>
                                <p
                                    role="status"
                                    className="mt-2 text-xs leading-relaxed text-slate-300"
                                >
                                    {copyFailed
                                        ? "Copy the selected text manually, then paste it into Codex and send it."
                                        : "Paste this into Codex and send it while this game stays open."}
                                </p>
                            </>
                        )
                        : (
                            <div className="flex items-center gap-3">
                                <span
                                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-300 text-xl text-[#2c1c3f]"
                                    aria-hidden="true"
                                >
                                    ✦
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-white">
                                        {step?.calloutTitle
                                            ?? `Try ${guide.subjectTitle}`}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {step?.calloutDescription
                                            ?? "Click the game and see what happens."}
                                    </p>
                                </div>
                            </div>
                        )}
                </div>
            </div>

            <footer className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex gap-1.5" aria-label="Remix progress">
                    {steps.map((playStep, index) => (
                        <button
                            key={playStep.id}
                            type="button"
                            className="grid size-6 place-items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-300"
                            aria-label={`Go to idea ${
                                index + 1
                            }: ${playStep.title}`}
                            aria-current={index === stepIndex
                                ? "step"
                                : undefined}
                            onClick={() => goToStep(index)}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "h-1.5 rounded-full transition-all",
                                    index === stepIndex
                                        ? "w-6 bg-fuchsia-300"
                                        : "w-2 bg-white/20 hover:bg-white/35",
                                )}
                            />
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1">
                    {stepIndex > 0 && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs text-white/70"
                            onClick={() => goToStep(stepIndex - 1)}
                        >
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-xs border-white/10 bg-white/10 text-white hover:bg-white/15"
                        onClick={() =>
                            goToStep(
                                stepIndex === steps.length - 1
                                    ? 0
                                    : stepIndex + 1,
                            )}
                    >
                        {stepIndex === 0
                            ? "Give me an idea"
                            : stepIndex === steps.length - 1
                            ? "Start again"
                            : "Next idea"}
                    </button>
                </div>
            </footer>
        </section>
    );
};
