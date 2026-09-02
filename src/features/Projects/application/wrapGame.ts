import { getVersion, parseAssets } from "../../../util/compiler";
import { useProject } from "../stores/useProject";
import { buildCode } from "./buildCode";

const CONTEXT_CAPTURE_CALLBACK = "__kaplaygroundCaptureContext";

export async function wrapGame() {
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
        const kaplay = (...args) => {
            const context = createKaplay(...args);
            window._k_ctx = context;
            window._k_debug = context?.debug ?? null;
            globalThis[${JSON.stringify(CONTEXT_CAPTURE_CALLBACK)}]?.(context);
            return context;
        };
        ${parseAssets(code, projectSnapshot.assets)}
    `;
}
