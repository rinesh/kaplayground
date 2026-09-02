import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { File } from "../../Projects/models/File";

type ProjectMonaco = Pick<Monaco, "Uri" | "editor">;

export interface ProjectModelSyncResult {
    disposed: number;
    created: string[];
}

/** Create or update the one canonical file:// Monaco model for a project file. */
export function ensureProjectFileModel(
    monaco: ProjectMonaco,
    file: Pick<File, "path" | "language" | "value">,
): editor.ITextModel {
    const uri = monaco.Uri.file(file.path);
    const existing = monaco.editor.getModel(uri);
    const model = existing
        ?? monaco.editor.createModel(file.value, file.language, uri);

    if (existing) {
        if (model.getLanguageId() !== file.language) {
            monaco.editor.setModelLanguage(model, file.language);
        }
        if (model.getValue() !== file.value) model.setValue(file.value);
    }

    return model;
}

/** Replace every editor model with canonical models from one project snapshot. */
export function synchronizeProjectModels(
    monaco: ProjectMonaco,
    files: ReadonlyMap<string, File>,
): ProjectModelSyncResult {
    const models = monaco.editor.getModels();
    for (const model of models) model.dispose();

    const created = [...files.values()]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((file) => {
            ensureProjectFileModel(monaco, file);
            return file.path;
        });

    return { disposed: models.length, created };
}
