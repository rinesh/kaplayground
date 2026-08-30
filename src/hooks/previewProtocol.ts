export const MAX_PREVIEW_INSPECTION_OBJECTS = 50;

export interface PreviewRunResult {
    runId: string;
    status: "loaded";
}

export interface PreviewPauseResult {
    runId: string | null;
    paused: boolean;
}

export interface PreviewInspectionOptions {
    /** Restrict object snapshots and the reported object count to one KAPLAY tag. */
    tag?: string;
    /** Number of shallow object snapshots to return. Capped at 50. */
    limit?: number;
}

export interface PreviewPoint {
    x: number;
    y: number;
}

export interface PreviewCameraSnapshot {
    position: PreviewPoint | null;
    scale: PreviewPoint | null;
    rotation: number | null;
}

export interface PreviewObjectSnapshot {
    id: string | number | null;
    tags: string[];
    position?: PreviewPoint;
    scale?: PreviewPoint;
    angle?: number;
    opacity?: number;
    hidden?: boolean;
    paused?: boolean;
    text?: string;
    sprite?: string;
}

export interface PreviewInspection {
    runId: string | null;
    available: boolean;
    scene: string | null;
    paused: boolean | null;
    viewport: {
        width: number;
        height: number;
    } | null;
    camera: PreviewCameraSnapshot | null;
    objectCount: number | null;
    objects: PreviewObjectSnapshot[];
    objectsTruncated: boolean;
}

export interface SandboxRunResultMessage {
    type: "RUN_RESULT";
    runId: string;
    status: "loaded" | "failed";
    paused: boolean | null;
    error?: string;
}

export interface SandboxPauseResultMessage {
    type: "PAUSE_RESULT";
    requestId: string;
    runId: string | null;
    paused: boolean | null;
    error?: string;
}

export interface SandboxInspectionResultMessage {
    type: "RUNTIME_INSPECTION_RESULT";
    requestId: string;
    runId: string | null;
    inspection?: PreviewInspection;
    error?: string;
}

export class PreviewRunError extends Error {
    readonly runId: string;

    constructor(runId: string, message: string) {
        super(message);
        this.name = "PreviewRunError";
        this.runId = runId;
    }
}
