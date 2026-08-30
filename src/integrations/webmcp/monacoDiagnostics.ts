import type {
    KaplaygroundDiagnostic,
    KaplaygroundDiagnosticsCapture,
} from "./kaplaygroundWebMCP";

interface MonacoMarker {
    resource: { path: string };
    severity: number;
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    source?: string;
    code?: string | { value: string };
}

interface MonacoDiagnosticsApi {
    MarkerSeverity: {
        Error: number;
        Warning: number;
        Info: number;
        Hint: number;
    };
    editor: {
        getModelMarkers(filter: Record<string, never>): MonacoMarker[];
    };
}

export function collectMonacoDiagnostics(
    monaco: MonacoDiagnosticsApi | undefined,
    files: ReadonlyMap<string, unknown>,
): KaplaygroundDiagnosticsCapture {
    if (!monaco) return { available: false, diagnostics: [] };

    const diagnostics = monaco.editor.getModelMarkers({}).flatMap((marker) => {
        const path = decodeURIComponent(marker.resource.path).replace(
            /^\/+/,
            "",
        );
        if (!files.has(path)) return [];

        const diagnostic: KaplaygroundDiagnostic = {
            path,
            severity: markerSeverity(
                monaco.MarkerSeverity,
                marker.severity,
            ),
            message: marker.message,
            startLine: marker.startLineNumber,
            startColumn: marker.startColumn,
            endLine: marker.endLineNumber,
            endColumn: marker.endColumn,
        };
        if (marker.source) diagnostic.source = marker.source;
        if (marker.code !== undefined) {
            diagnostic.code = typeof marker.code === "string"
                ? marker.code
                : marker.code.value;
        }
        return [diagnostic];
    });

    return { available: true, diagnostics };
}

function markerSeverity(
    markerSeverity: MonacoDiagnosticsApi["MarkerSeverity"],
    value: number,
): KaplaygroundDiagnostic["severity"] {
    if (value === markerSeverity.Error) return "error";
    if (value === markerSeverity.Warning) return "warning";
    if (value === markerSeverity.Info) return "info";
    if (value === markerSeverity.Hint) return "hint";
    return String(value);
}
