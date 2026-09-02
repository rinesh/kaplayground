import { useCodexPlayGuide } from "../../integrations/webmcp/useCodexPlayGuide";
import { CodexCoach } from "../WebMCP";
import { GameView } from "./GameView";

export const WorkspacePreview = () => {
    const guide = useCodexPlayGuide();

    return (
        <div className="flex w-full min-h-0 flex-col gap-px p-px pt-0 min-[900px]:h-full">
            <div className="h-[450px] shrink-0 min-[900px]:h-auto min-[900px]:min-h-60 min-[900px]:flex-1">
                <GameView />
            </div>
            <CodexCoach guide={guide} />
        </div>
    );
};
