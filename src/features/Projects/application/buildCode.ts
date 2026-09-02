import * as esbuild from "esbuild-wasm";
import type { File } from "../models/File";
import type { Project } from "../models/Project";
import { useProject } from "../stores/useProject";
import { buildCodeLegacy } from "./buildCodeLegacy";
import { virtualResolveDirectory } from "./virtualPaths";

/**
 * Build code using esbuild.
 *
 * @returns - The built code as a string.
 */
export async function buildCode(
    activeProject: Project = useProject.getState().project,
) {
    const projectSnapshot = {
        ...activeProject,
        files: new Map(activeProject.files),
        assets: new Map(activeProject.assets),
    };

    if (projectSnapshot.buildMode == "legacy") {
        return buildCodeLegacy(projectSnapshot);
    }

    const result = await esbuild.build({
        entryPoints: ["/main.js"],
        bundle: true,
        write: false,
        plugins: [createVirtualPlugin(projectSnapshot.files)],
        format: "esm",
        target: "esnext",
    });

    const buildResult = result.outputFiles;
    const decoder = new TextDecoder("utf-8");
    const fileContentsAsString = decoder.decode(buildResult[0].contents);

    return fileContentsAsString;
}

function createVirtualPlugin(files: ReadonlyMap<string, File>): esbuild.Plugin {
    return {
        name: "virtual-fs",
        setup(build) {
            build.onResolve({ filter: /.*/ }, args => {
                const resolvedPath = new URL(
                    args.path,
                    "file://" + args.resolveDir + "/",
                ).pathname;

                return { path: resolvedPath, namespace: "virtual" };
            });

            build.onLoad({ filter: /.*/ }, async args => {
                const path = args.path.startsWith("/")
                    ? args.path.slice(1)
                    : args.path;
                const file = getSnapshotFile(files, path);

                if (!file) throw new Error(`File not found: ${path}`);

                const loader = path.endsWith(".ts") ? "ts" : "js";
                return {
                    contents: file.value,
                    loader,
                    resolveDir: virtualResolveDirectory(args.path),
                };
            });
        },
    };
}

function getSnapshotFile(
    files: ReadonlyMap<string, File>,
    path: string,
): File | undefined {
    if (path.includes(".")) return files.get(path);
    return files.get(`${path}.ts`) ?? files.get(`${path}.js`);
}
