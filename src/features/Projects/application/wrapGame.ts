import {
    PREVIEW_ASSET_LIMITS,
    trackPreviewAssets,
} from "../../../hooks/previewAssets";
import { getVersion, parseAssets } from "../../../util/compiler";
import { useProject } from "../stores/useProject";
import { buildCode } from "./buildCode";
import { fitGameToViewport } from "./gameViewport";

const CONTEXT_CAPTURE_CALLBACK = "__kaplaygroundCaptureContext";

export async function wrapGame(runId: string) {
    const activeProject = useProject.getState().project;
    const projectSnapshot = {
        ...activeProject,
        files: new Map(activeProject.files),
        assets: new Map(activeProject.assets),
    };
    const code = await buildCode(projectSnapshot);

    return `
        import createKaplay from "${
        getVersion(false, projectSnapshot.kaplayVersion)
    }";
        const kaplay = (options, ...args) => {
            const context = createKaplay(
                (${fitGameToViewport.toString()})(options, {
                    width: window.innerWidth,
                    height: window.innerHeight,
                }),
                ...args,
            );
            window._k_ctx = context;
            window._k_debug = context?.debug ?? null;
            (${trackPreviewAssets.toString()})(context, (event) => {
                if (window._k_ctx !== context) return;
                window.parent.postMessage({
                    ...event,
                    type: "PREVIEW_ASSETS",
                    runId: ${JSON.stringify(runId)},
                }, ${JSON.stringify(window.location.origin)});
            }, ${JSON.stringify(PREVIEW_ASSET_LIMITS)});
            globalThis[${JSON.stringify(CONTEXT_CAPTURE_CALLBACK)}]?.(context);
            return context;
        };
        ${parseAssets(code, projectSnapshot.assets)}
    `;
}
