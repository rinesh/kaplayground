import { useEditor } from "../../../hooks/useEditor";
import { debug } from "../../../util/logs";
import type { File } from "../../Projects/models/File";
import { ensureProjectFileModel } from "./projectModels";

export const loadFileInModel = async (file: File) => {
    const runtime = useEditor.getState().runtime;
    const editor = runtime.editor;
    const monaco = runtime.monaco;

    if (!editor || !monaco) {
        throw new Error("Tried to use Monaco editor before it was mounted");
    }

    const previousModel = editor.getModel();
    const model = ensureProjectFileModel(monaco, file);

    if (runtime.currentFile === file.path && previousModel !== model) {
        editor.setModel(model);
    }

    debug(0, "[editor] loaded model", file.path);
};
