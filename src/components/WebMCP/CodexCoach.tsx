import { useEffect, useState } from "react";
import type { CodexPlayGuide } from "../../integrations/webmcp/codexPlayGuide";
import { WebMCPTutorial } from "./WebMCPTutorial";

type Props = {
    guide: CodexPlayGuide;
};

export const CodexCoach = ({ guide }: Props) => {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => setCollapsed(false), [guide.key]);

    if (collapsed) {
        return (
            <aside
                aria-label="Codex tips"
                className="flex shrink-0 justify-end rounded-xl bg-base-300 px-2 py-1.5"
            >
                <button
                    type="button"
                    className="btn btn-xs border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100 hover:bg-fuchsia-300/15"
                    onClick={() => setCollapsed(false)}
                >
                    ✦ Show Codex ideas
                </button>
            </aside>
        );
    }

    return (
        <aside aria-label="Codex tips" className="@container relative shrink-0">
            <WebMCPTutorial key={guide.key} guide={guide} condensed />
            <button
                type="button"
                className="btn btn-circle btn-ghost btn-xs absolute right-2 top-2 text-white/55 hover:text-white"
                aria-label="Hide Codex ideas"
                onClick={() =>
                    setCollapsed(true)}
            >
                ×
            </button>
        </aside>
    );
};
