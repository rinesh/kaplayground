import { getVersion, parseAssets } from "../../../util/compiler";
import { useProject } from "../stores/useProject";
import { buildCode } from "./buildCode";

export async function wrapGame() {
    const activeProject = useProject.getState().project;
    const projectSnapshot = {
        ...activeProject,
        files: new Map(activeProject.files),
        assets: new Map(activeProject.assets),
    };
    const code = await buildCode(projectSnapshot);

    return `
        import kaplay from "${
        getVersion(false, projectSnapshot.kaplayVersion)
    }";
        ${parseAssets(code, projectSnapshot.assets)}
        ${registerGlobalsFromCtx(code)}
    `;
}

function registerGlobalsFromCtx(code: string) {
    const ctx = code.match(
        /\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*kaplay\(/,
    )?.[1];

    return !ctx ? "" : `
        window._k_ctx = ${ctx};
        window._k_debug = window._k_ctx.debug;
    `;
}
