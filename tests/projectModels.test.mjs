import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    ensureProjectFileModel,
    synchronizeProjectModels,
} from "../src/features/Editor/application/projectModels.ts";

function fakeMonaco() {
    const models = new Map();
    const uri = path => ({
        scheme: "file",
        path: `/${path.replace(/^\/+/, "")}`,
        toString() {
            return `file:///${path.replace(/^\/+/, "")}`;
        },
    });
    const key = value => value.toString();

    return {
        models,
        monaco: {
            Uri: { file: uri },
            editor: {
                getModel(value) {
                    return models.get(key(value)) ?? null;
                },
                getModels() {
                    return [...models.values()];
                },
                createModel(value, language, modelUri) {
                    const model = {
                        uri: modelUri,
                        value,
                        language,
                        disposed: false,
                        getValue() {
                            return this.value;
                        },
                        setValue(next) {
                            this.value = next;
                        },
                        getLanguageId() {
                            return this.language;
                        },
                        dispose() {
                            this.disposed = true;
                            models.delete(key(this.uri));
                        },
                    };
                    models.set(key(modelUri), model);
                    return model;
                },
                setModelLanguage(model, language) {
                    model.language = language;
                },
            },
        },
    };
}

const file = (path, value, language = "javascript") => ({
    path,
    value,
    language,
    kind: path === "main.js" ? "main" : "util",
});

describe("project Monaco models", () => {
    it("uses canonical file URIs and updates existing source and language", () => {
        const { monaco } = fakeMonaco();
        const model = ensureProjectFileModel(
            monaco,
            file("utils/board.ts", "export const board = 1;", "typescript"),
        );
        assert.equal(model.uri.toString(), "file:///utils/board.ts");

        const sameModel = ensureProjectFileModel(
            monaco,
            file("utils/board.ts", "export const board = 2;", "javascript"),
        );
        assert.equal(sameModel, model);
        assert.equal(model.getValue(), "export const board = 2;");
        assert.equal(model.getLanguageId(), "javascript");
    });

    it("hydrates every file after disposing the previous project models", () => {
        const { monaco, models } = fakeMonaco();
        const old = monaco.editor.createModel(
            "old",
            "javascript",
            monaco.Uri.file("old.js"),
        );
        const files = new Map([
            ["main.js", file("main.js", "kaplay();")],
            ["utils/board.js", file("utils/board.js", "export const board = 1;")],
        ]);

        const result = synchronizeProjectModels(monaco, files);
        assert.equal(old.disposed, true);
        assert.deepEqual(result, {
            disposed: 1,
            created: ["main.js", "utils/board.js"],
        });
        assert.deepEqual([...models.keys()].sort(), [
            "file:///main.js",
            "file:///utils/board.js",
        ]);
    });
});
