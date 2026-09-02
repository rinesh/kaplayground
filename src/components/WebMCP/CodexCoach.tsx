import type { CodexPlayGuide } from "../../integrations/webmcp/codexPlayGuide";
import { WebMCPTutorial } from "./WebMCPTutorial";

type Props = {
    guide: CodexPlayGuide;
    onClose: () => void;
};

export const CodexCoach = ({ guide, onClose }: Props) => {
    return (
        <aside aria-label="Codex tips" className="@container relative h-full">
            <WebMCPTutorial
                key={guide.key}
                guide={guide}
                condensed
                className="flex min-h-full flex-col justify-between"
            />
            <button
                type="button"
                className="btn btn-circle btn-ghost btn-xs absolute right-2 top-2 text-white/55 hover:text-white"
                aria-label="Hide Codex ideas"
                onClick={onClose}
            >
                ×
            </button>
        </aside>
    );
};
