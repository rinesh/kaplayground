import type { Project } from "../models/Project";
import { useProject } from "../stores/useProject";

export function buildCodeLegacy(
    project: Project = useProject.getState().project,
) {
    let mainFile = getFile(project, "main.js")?.value ?? "";
    let parsedFiles = "";

    if (project.mode === "ex") {
        parsedFiles = mainFile;
    } else {
        let sceneFiles = "";
        let objectFiles = "";
        let utilFiles = "";
        let KAPLAYFile = getFile(project, "kaplay.js")?.value ?? "";
        let assetsFile = getFile(project, "assets.js")?.value ?? "";

        project.files.forEach((file) => {
            if (file.kind == "scene") {
                sceneFiles += `\n${file.value}\n`;
            } else if (file.kind == "obj") {
                objectFiles += `\n${file.value}\n`;
            } else if (file.kind == "util") {
                utilFiles += `\n${file.value}\n`;
            }
        });

        parsedFiles = `${KAPLAYFile}\n\n 
                ${assetsFile}\n\n 
                ${utilFiles}\n\n
                ${objectFiles}\n\n
                ${sceneFiles}\n\n 
                ${mainFile}`;
    }

    return parsedFiles;
}

function getFile(project: Project, path: string) {
    return project.files.get(path);
}
