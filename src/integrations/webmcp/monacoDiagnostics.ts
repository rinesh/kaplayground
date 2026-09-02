import type {
    KaplaygroundDiagnostic,
    KaplaygroundDiagnosticsCapture,
} from "./kaplaygroundWebMCP";

interface MonacoMarker {
    resource?: { path?: string };
    severity: number;
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber?: number;
    endColumn?: number;
    source?: string;
    code?: string | number | { value?: string | number };
}

interface MonacoModel {
    getValue(): string;
}

interface MonacoDiagnosticsApi {
    MarkerSeverity: {
        Error: number;
        Warning: number;
        Info: number;
        Hint: number;
    };
    Uri?: { file(path: string): unknown };
    editor: {
        getModelMarkers(options: Record<string, never>): MonacoMarker[];
        getModel?(uri: unknown): MonacoModel | null;
    };
}

export function collectMonacoDiagnostics(
    monaco: MonacoDiagnosticsApi | undefined,
    files: ReadonlyMap<string, { value?: unknown }>,
    currentPath?: string,
): KaplaygroundDiagnosticsCapture {
    const sourcePath = currentPath ?? null;
    if (!monaco) {
        return {
            available: false,
            sourcePath,
            sourceCurrent: false,
            diagnostics: [],
        };
    }

    const diagnostics = monaco.editor.getModelMarkers({})
        .filter((marker) => {
            const path = marker.resource?.path?.replace(/^\//, "");
            return path !== undefined && files.has(path);
        })
        .map((marker): KaplaygroundDiagnostic => ({
            path: marker.resource?.path?.replace(/^\//, "") ?? "unknown",
            severity: markerSeverity(monaco, marker.severity),
            message: marker.message,
            startLine: marker.startLineNumber,
            startColumn: marker.startColumn,
            endLine: marker.endLineNumber,
            endColumn: marker.endColumn,
            source: marker.source,
            code: typeof marker.code === "object"
                ? marker.code?.value
                : marker.code,
        }));

    const currentFile = currentPath ? files.get(currentPath) : undefined;
    const currentModel = currentPath && monaco.Uri && monaco.editor.getModel
        ? monaco.editor.getModel(monaco.Uri.file(currentPath))
        : null;
    const sourceCurrent = typeof currentFile?.value === "string"
        && currentModel?.getValue() === currentFile.value;

    return { available: true, sourcePath, sourceCurrent, diagnostics };
}

function markerSeverity(
    monaco: MonacoDiagnosticsApi,
    severity: number,
): KaplaygroundDiagnostic["severity"] {
    if (severity === monaco.MarkerSeverity.Error) return "error";
    if (severity === monaco.MarkerSeverity.Warning) return "warning";
    if (severity === monaco.MarkerSeverity.Info) return "info";
    if (severity === monaco.MarkerSeverity.Hint) return "hint";
    return String(severity);
}
