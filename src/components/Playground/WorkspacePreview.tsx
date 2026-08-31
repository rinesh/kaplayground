import { useCodexPlayGuide } from "../../integrations/webmcp/useCodexPlayGuide.ts";
import { CodexCoach } from "../WebMCP";
import { GameView } from "./GameView";

export const WorkspacePreview = () => {
    const guide = useCodexPlayGuide();

    return (
        <div className="flex size-full min-h-0 flex-col gap-px p-px pt-0">
            <div className="min-h-0 flex-1">
                <GameView />
            </div>
            <CodexCoach guide={guide} />
        </div>
    );
};
