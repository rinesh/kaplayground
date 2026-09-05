import { buildCode } from "../src/features/Projects/application/buildCode.ts";
import { useProject } from "../src/features/Projects/stores/useProject.ts";
import { useEditor } from "../src/hooks/useEditor.ts";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

export async function verifyFileRegressions() {
    const original = useProject.getState();
    const file = (path, value) => ({
        path,
        value,
        language: "javascript",
        kind: "util",
    });
    for (
        const path of [
            "scenes/Level1.js",
            "scenes/Level 1.js",
            "utils/café.js",
            "utils/helper#v2.js",
            "utils/a?b.js",
            "utils/a%20b.js",
        ]
    ) {
        const result = await buildCode({
            ...original.project,
            buildMode: "esbuild",
            files: new Map([
                [
                    "main.js",
                    file(
                        "main.js",
                        `import { value } from ${
                            JSON.stringify(`./${path}`)
                        }; console.log(value);`,
                    ),
                ],
                [path, file(path, "export const value = 42;")],
            ]),
        });
        assert(
            result.includes("42"),
            `The accepted filename ${path} cannot be imported.`,
        );
    }

    // Exercise real store operations, Monaco selection and edit events without
    // autosaving this isolated fixture or changing the surrounding test project.
    const runtime = useEditor.getState().runtime;
    const path = "utils/recreatedReviewFile.js";
    try {
        useProject.setState({
            project: {
                ...original.project,
                files: new Map(original.project.files),
            },
            setProject: patch =>
                useProject.setState({
                    project: { ...useProject.getState().project, ...patch },
                }),
        });
        useProject.getState().addFile(file(path, "// deleted content"));
        useEditor.getState().setCurrentFile(path);
        useProject.getState().removeFile(path);
        useEditor.getState().setCurrentFile("main.js");
        useProject.getState().addFile(file(path, "// fresh content"));
        useEditor.getState().setCurrentFile(path);
        assert(
            runtime.editor.getValue() === "// fresh content",
            "Recreated files displayed deleted source.",
        );
        const model = runtime.editor.getModel();
        const end = model.getPositionAt(model.getValueLength());
        runtime.editor.executeEdits("review", [{
            range: {
                startLineNumber: end.lineNumber,
                endLineNumber: end.lineNumber,
                startColumn: end.column,
                endColumn: end.column,
            },
            text: "\n// next edit",
        }]);
        assert(
            useProject.getState().getFile(path).value
                === "// fresh content\n// next edit",
            "Editing a recreated file restored deleted source.",
        );
    } finally {
        useProject.setState(original, true);
        useEditor.getState().setCurrentFile(runtime.currentFile);
        runtime.monaco.editor.getModel(runtime.monaco.Uri.file(path))
            ?.dispose();
    }
    return true;
}
