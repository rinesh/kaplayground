import type { editor, languages } from "monaco-editor";
import type {
    KaplaygroundDiagnostic,
    KaplaygroundDiagnosticsCapture,
} from "./kaplaygroundWebMCP";

type MonacoDiagnosticsApi = Pick<
    typeof import("monaco-editor"),
    "Uri" | "editor" | "languages"
>;

const DIAGNOSTICS_TIMEOUT_MS = 10_000;
const MAX_DIAGNOSTIC_FILES = 100;

interface SourceModel {
    path: string;
    value: string;
    model: editor.ITextModel;
    version: number;
}

/** Ask the language workers for current diagnostics; cached markers can be stale. */
export async function collectMonacoDiagnostics(
    monaco: MonacoDiagnosticsApi | undefined,
    files: ReadonlyMap<string, { value?: unknown }>,
    currentPath?: string,
): Promise<KaplaygroundDiagnosticsCapture> {
    const unavailable: KaplaygroundDiagnosticsCapture = {
        available: false,
        sourcePath: currentPath ?? null,
        sourceCurrent: false,
        diagnostics: [],
    };
    if (!monaco?.languages?.typescript) return unavailable;

    const sources: SourceModel[] = [];
    for (const [path, file] of files) {
        if (!/\.[jt]s$/u.test(path)) continue;
        const model = monaco.editor.getModel(monaco.Uri.file(path));
        if (
            typeof file.value !== "string"
            || !model
            || model.getValue() !== file.value
            || sources.length >= MAX_DIAGNOSTIC_FILES
        ) {
            return unavailable;
        }
        sources.push({
            path,
            value: file.value,
            model,
            version: model.getVersionId(),
        });
    }
    if (sources.length === 0) return unavailable;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            checkSources(monaco, sources, unavailable.sourcePath),
            new Promise<KaplaygroundDiagnosticsCapture>((resolve) => {
                timeout = setTimeout(
                    () => resolve(unavailable),
                    DIAGNOSTICS_TIMEOUT_MS,
                );
            }),
        ]);
    } catch {
        return unavailable;
    } finally {
        clearTimeout(timeout);
    }
}

async function checkSources(
    monaco: MonacoDiagnosticsApi,
    sources: SourceModel[],
    sourcePath: string | null,
): Promise<KaplaygroundDiagnosticsCapture> {
    const api = monaco.languages.typescript;
    const uris = sources.map(({ model }) => model.uri);
    const workers = new Map<string, languages.typescript.TypeScriptWorker>();
    for (const { model } of sources) {
        const language = model.getLanguageId();
        if (workers.has(language)) continue;
        const getWorker = language === "typescript"
            ? await api.getTypeScriptWorker()
            : await api.getJavaScriptWorker();
        workers.set(language, await getWorker(...uris));
    }

    const results = await Promise.all(sources.map(async (source) => {
        const worker = workers.get(source.model.getLanguageId())!;
        const uri = source.model.uri.toString();
        const [syntax, semantic, workerSource] = await Promise.all([
            worker.getSyntacticDiagnostics(uri),
            worker.getSemanticDiagnostics(uri),
            worker.getScriptText(uri),
        ]);
        return {
            sourceCurrent: workerSource === source.value,
            diagnostics: [...syntax, ...semantic].map((diagnostic) =>
                diagnosticSnapshot(source, diagnostic)
            ),
        };
    }));
    const sourceCurrent = results.every((result) => result.sourceCurrent)
        && sources.every(({ model, value, version }) =>
            !model.isDisposed()
            && model.getVersionId() === version
            && model.getValue() === value
        );
    return {
        available: true,
        sourcePath,
        sourceCurrent,
        diagnostics: sourceCurrent
            ? results.flatMap((result) => result.diagnostics)
            : [],
    };
}

function diagnosticSnapshot(
    source: SourceModel,
    diagnostic: languages.typescript.Diagnostic,
): KaplaygroundDiagnostic {
    const start = source.model.getPositionAt(diagnostic.start ?? 0);
    const end = source.model.getPositionAt(
        (diagnostic.start ?? 0) + (diagnostic.length ?? 0),
    );
    return {
        path: source.path,
        severity: ["warning", "error", "hint", "info"][diagnostic.category],
        message: diagnosticMessage(diagnostic.messageText),
        startLine: start.lineNumber,
        startColumn: start.column,
        endLine: end.lineNumber,
        endColumn: end.column,
        source: diagnostic.source ?? "typescript",
        code: diagnostic.code,
    };
}

function diagnosticMessage(
    message: languages.typescript.Diagnostic["messageText"],
): string {
    if (typeof message === "string") return message;
    return [message.messageText, ...(message.next ?? []).map(diagnosticMessage)]
        .join("\n");
}
