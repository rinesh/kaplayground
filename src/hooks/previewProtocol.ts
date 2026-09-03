import type { PreviewExerciseAction } from "../../shared/previewProtocol.ts";
export {
    MAX_PREVIEW_EXERCISE_ACTIONS,
    PREVIEW_PROTOCOL_VERSION,
} from "../../shared/previewProtocol.ts";
export type {
    PreviewExerciseAction,
    PreviewCheckpointExpectation,
} from "../../shared/previewProtocol.ts";

export const MAX_PREVIEW_INSPECTION_OBJECTS = 50;

export type PreviewReadinessStatus =
    | "pending"
    | "ready"
    | "timed-out"
    | "unavailable";

export interface PreviewReadiness {
    status: PreviewReadinessStatus;
    moduleExecuted: boolean;
    contextCaptured: boolean;
    assetsLoaded: boolean;
    firstFrame: boolean;
    canvasPresent: boolean;
    reason: string | null;
}

export interface PreviewRunResult {
    runId: string;
    status: "loaded";
    readiness: PreviewReadiness;
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

export interface PreviewBounds extends PreviewPoint {
    width: number;
    height: number;
}

export interface PreviewCollisionBounds {
    local: PreviewBounds | null;
    world: PreviewBounds | null;
    screen: PreviewBounds | null;
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
    anchor?: string | PreviewPoint;
    /** Local rendered bounds, before the object's world transform. */
    renderedBounds?: PreviewBounds;
    collisionBounds?: PreviewCollisionBounds;
    screenBounds?: PreviewBounds;
    textTruncated?: boolean;
}

export interface PreviewLayoutWarning {
    code: "CANVAS_EMPTY" | "OBJECT_OUTSIDE_VIEWPORT" | "OBJECT_CLIPPED";
    message: string;
    objectId?: string | number | null;
    tags?: string[];
    estimatedBounds?: PreviewBounds;
    viewport?: { width: number; height: number };
    basis?: "screen-space-bounds";
}

export interface PreviewInspection {
    runId: string | null;
    available: boolean;
    readiness: PreviewReadiness;
    canvasFocused: boolean;
    scene: string | null;
    paused: boolean | null;
    viewport: {
        width: number;
        height: number;
    } | null;
    camera: PreviewCameraSnapshot | null;
    objectsAvailable: boolean;
    objectCount: number | null;
    objects: PreviewObjectSnapshot[];
    objectsTruncated: boolean;
    layoutWarnings: PreviewLayoutWarning[];
    layoutWarningsTruncated: boolean;
    layoutAvailable: boolean;
}

export interface PreviewCheckpointCheck {
    name: string;
    passed: boolean | null;
    expected: unknown;
    actual: unknown;
}

export interface PreviewExerciseCheckpointResult {
    name: string;
    passed: boolean | null;
    checks: PreviewCheckpointCheck[];
    inspection: PreviewInspection;
}

export interface PreviewExerciseResult {
    runId: string;
    inputProvenance: "sandbox-simulated";
    actionCount: number;
    inputActionCount: number;
    checkpointCount: number;
    assertionCount: number;
    unassertedInputActionCount: number;
    incompleteReasons: string[];
    passed: boolean;
    checkpoints: PreviewExerciseCheckpointResult[];
    finalInspection: PreviewInspection;
}

export interface SandboxRunResultMessage {
    type: "RUN_RESULT";
    runId: string;
    status: "loaded" | "failed";
    paused: boolean | null;
    readiness: PreviewReadiness;
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

export interface SandboxExerciseResultMessage {
    type: "RUNTIME_EXERCISE_RESULT";
    requestId: string;
    runId: string | null;
    exercise?: PreviewExerciseResult;
    error?: string;
}

export interface PreviewExerciseRequest {
    runId: string;
    actions: PreviewExerciseAction[];
}

export class PreviewRunError extends Error {
    readonly runId: string;

    constructor(runId: string, message: string) {
        super(message);
        this.name = "PreviewRunError";
        this.runId = runId;
    }
}
