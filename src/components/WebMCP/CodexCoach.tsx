import { useEffect, useRef } from "react";
import type { CodexPlayGuide } from "../../integrations/webmcp/codexPlayGuide";
import { WebMCPTutorial } from "./WebMCPTutorial";

type Props = {
    guide: CodexPlayGuide;
    minimized: boolean;
    onMinimizedChange: (minimized: boolean) => void;
};

export const CodexCoach = ({ guide, minimized, onMinimizedChange }: Props) => {
    const minimizeButton = useRef<HTMLButtonElement>(null);
    const showButton = useRef<HTMLButtonElement>(null);
    const restoreFocus = useRef(false);

    useEffect(() => {
        if (!restoreFocus.current) return;
        restoreFocus.current = false;
        (minimized ? showButton : minimizeButton).current?.focus({
            preventScroll: true,
        });
    }, [minimized]);

    const toggle = () => {
        restoreFocus.current = true;
        onMinimizedChange(!minimized);
    };

    return (
        <aside
            aria-label="Codex tips"
            className="@container relative h-full min-h-0"
        >
            <div
                id="codex-coach-content"
                hidden={minimized}
                className="h-full min-h-0"
            >
                <WebMCPTutorial
                    key={guide.key}
                    guide={guide}
                    condensed
                    contained
                />
                <button
                    ref={minimizeButton}
                    type="button"
                    className="btn btn-circle btn-ghost btn-xs absolute right-2 top-2 text-white/55 hover:text-white"
                    aria-label="Minimize Codex ideas"
                    title="Minimize Codex ideas"
                    aria-controls="codex-coach-content"
                    aria-expanded="true"
                    onClick={toggle}
                >
                    ×
                </button>
            </div>
            {minimized && (
                <div className="flex h-full items-center justify-end rounded-xl bg-base-300 px-2 py-1.5">
                    <button
                        ref={showButton}
                        type="button"
                        aria-label="Show Codex ideas"
                        aria-controls="codex-coach-content"
                        aria-expanded="false"
                        className="btn btn-xs border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100 hover:bg-fuchsia-300/15"
                        onClick={toggle}
                    >
                        ✦ Show Codex ideas
                    </button>
                </div>
            )}
        </aside>
    );
};
