import { useEffect, useRef, useState } from "react";
import { CODEX_PLAY_STEPS } from "../../integrations/webmcp/agentGuide";
import { cn } from "../../util/cn";
import { copyText } from "../../util/copyText";

const STORAGE_KEY = "kaplayground-codex-play-step-v1";
const STEP_EVENT = "kaplayground-codex-play-step";

type Props = {
    className?: string;
    condensed?: boolean;
};

export const WebMCPTutorial = ({ className, condensed = false }: Props) => {
    const [stepIndex, setStepIndex] = useState(readStepIndex);
    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const resetTimer = useRef<number | undefined>();
    const step = CODEX_PLAY_STEPS[stepIndex];

    useEffect(() => {
        const handleStepChange = (event: Event) => {
            const nextIndex = (event as CustomEvent<number>).detail;
            if (Number.isInteger(nextIndex)) {
                setStepIndex(clampStep(nextIndex));
                setCopied(false);
                setCopyFailed(false);
                window.clearTimeout(resetTimer.current);
            }
        };

        window.addEventListener(STEP_EVENT, handleStepChange);
        return () => {
            window.removeEventListener(STEP_EVENT, handleStepChange);
            window.clearTimeout(resetTimer.current);
        };
    }, []);

    const goToStep = (nextIndex: number) => {
        const clampedIndex = clampStep(nextIndex);
        setStepIndex(clampedIndex);
        setCopied(false);
        setCopyFailed(false);
        localStorage.setItem(STORAGE_KEY, String(clampedIndex));
        window.dispatchEvent(
            new CustomEvent<number>(STEP_EVENT, { detail: clampedIndex }),
        );
    };

    const copyPrompt = async () => {
        if (!step.prompt) return;

        try {
            await copyText(step.prompt);
            setCopyFailed(false);
            setCopied(true);
            window.clearTimeout(resetTimer.current);
            resetTimer.current = window.setTimeout(() => {
                setCopied(false);
            }, 2400);
        } catch {
            setCopyFailed(true);
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
                    condensed && "lg:grid-cols-[minmax(15rem,0.8fr)_minmax(21rem,1.2fr)]",
                )}
            >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-fuchsia-300/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-fuchsia-200">
                            {step.eyebrow}
                        </span>
                        <span className="text-[11px] font-semibold text-white/45">
                            {stepIndex + 1} of {CODEX_PLAY_STEPS.length}
                        </span>
                    </div>
                    <h2
                        className={cn(
                            "mt-2 font-bold tracking-[-0.02em] text-white",
                            condensed ? "text-base sm:text-lg" : "text-2xl",
                        )}
                    >
                        {step.title}
                    </h2>
                    <p
                        className={cn(
                            "mt-1 leading-relaxed text-slate-300",
                            condensed ? "text-xs sm:text-sm" : "text-sm",
                        )}
                    >
                        {step.description}
                    </p>
                </div>

                <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                    {step.prompt
                        ? (
                            <>
                                <p
                                    className={cn(
                                        "text-slate-100",
                                        condensed
                                            ? "line-clamp-2 text-xs leading-relaxed"
                                            : "text-sm leading-relaxed",
                                    )}
                                >
                                    “{step.prompt}”
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-xs mt-3 border-0 bg-fuchsia-500 text-white hover:bg-fuchsia-400"
                                    onClick={() => void copyPrompt()}
                                >
                                    {copied
                                        ? "Copied — paste it into Codex"
                                        : copyFailed
                                        ? "Select the idea to copy"
                                        : "Copy for Codex"}
                                </button>
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
                                        Chase the apples
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        There is no wrong way to play.
                                    </p>
                                </div>
                            </div>
                        )}
                </div>
            </div>

            <footer className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex gap-1.5" aria-label="Remix progress">
                    {CODEX_PLAY_STEPS.map((playStep, index) => (
                        <button
                            key={playStep.id}
                            type="button"
                            className={cn(
                                "h-1.5 rounded-full transition-all",
                                index === stepIndex
                                    ? "w-6 bg-fuchsia-300"
                                    : "w-2 bg-white/20 hover:bg-white/35",
                            )}
                            aria-label={`Go to idea ${index + 1}: ${playStep.title}`}
                            aria-current={index === stepIndex ? "step" : undefined}
                            onClick={() => goToStep(index)}
                        />
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
                                stepIndex === CODEX_PLAY_STEPS.length - 1
                                    ? 0
                                    : stepIndex + 1,
                            )}
                    >
                        {stepIndex === 0
                            ? "Give me an idea"
                            : stepIndex === CODEX_PLAY_STEPS.length - 1
                            ? "Start again"
                            : "Next idea"}
                    </button>
                </div>
            </footer>
        </section>
    );
};

function readStepIndex(): number {
    return clampStep(Number(localStorage.getItem(STORAGE_KEY) ?? 0));
}

function clampStep(value: number): number {
    if (!Number.isInteger(value)) return 0;
    return Math.max(0, Math.min(CODEX_PLAY_STEPS.length - 1, value));
}
