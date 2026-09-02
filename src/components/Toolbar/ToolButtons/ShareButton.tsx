import { assets } from "@kaplayjs/crew";
import { toast } from "react-toastify";
import { useProject } from "../../../features/Projects/stores/useProject";
import { compressCode } from "../../../util/compressCode";
import { ToolbarButton } from "../ToolbarButton";

export async function shareProjectLink() {
    const state = useProject.getState();
    if (state.project.files.size !== 1 || state.project.assets.size !== 0) {
        throw new Error(
            "Export this project to include all its files and assets.",
        );
    }
    const url = new URL("/", window.location.origin);
    if (state.demoKey && !state.hasUnsavedProjectChanges()) {
        url.searchParams.set("example", state.demoKey);
    } else {
        url.searchParams.set(
            "code",
            compressCode(state.getMainFile()?.value ?? ""),
        );
        url.searchParams.set("version", state.project.kaplayVersion);
    }
    if (url.href.length > 2048) {
        throw new Error(
            "This game is too large for a link. Use Export project.",
        );
    }
    await navigator.clipboard.writeText(url.href);
    toast("Game link copied.");
}

export const ShareButton = () => (
    <ToolbarButton
        icon={assets.share.outlined}
        text="Share"
        compact
        aria-label="Copy game link"
        onClick={() =>
            void shareProjectLink().catch(error => toast.error(String(error)))}
        tip="Share project"
    />
);
