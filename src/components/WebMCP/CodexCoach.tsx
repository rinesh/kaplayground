import { useState } from "react";
import { WebMCPTutorial } from "./WebMCPTutorial";

export const CodexCoach = () => {
    const [collapsed, setCollapsed] = useState(false);

    if (collapsed) {
        return (
            <div className="flex shrink-0 justify-end rounded-xl bg-base-300 px-2 py-1.5">
                <button
                    type="button"
                    className="btn btn-xs border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100 hover:bg-fuchsia-300/15"
                    onClick={() => setCollapsed(false)}
                >
                    ✦ Show Codex ideas
                </button>
            </div>
        );
    }

    return (
        <div className="relative shrink-0">
            <WebMCPTutorial condensed />
            <button
                type="button"
                className="btn btn-circle btn-ghost btn-xs absolute right-2 top-2 text-white/55 hover:text-white"
                aria-label="Hide Codex ideas"
                onClick={() => setCollapsed(true)}
            >
                ×
            </button>
        </div>
    );
};
