import type { KaplaygroundToolName } from "./gameTools.ts";
import { PreviewExerciseLimitError } from "../../../shared/previewProtocol.ts";

export const KAPLAYGROUND_WEBMCP_CONTRACT_VERSION = 1;

export class KaplaygroundToolError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly details?: Record<string, unknown>;
    readonly cause?: unknown;

    constructor(
        code: string,
        message: string,
        options: {
            retryable?: boolean;
            details?: Record<string, unknown>;
            cause?: unknown;
        } = {},
    ) {
        // Some browser hosts serialize only Error.message. Preserve the recovery
        // code and hint there while retaining structured fields for richer hosts.
        super(`[${code}; retryable=${options.retryable ?? false}] ${message}`);
        this.name = "KaplaygroundToolError";
        this.cause = options.cause;
        this.code = code;
        this.retryable = options.retryable ?? false;
        this.details = options.details;
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            retryable: this.retryable,
            ...(this.details ? { details: this.details } : {}),
        };
    }
}

export function withToolResultEnvelope(
    tool: KaplaygroundToolName,
    value: unknown,
): Record<string, unknown> {
    const result = isRecord(value) ? value : { value };
    const status = typeof result.status === "string" ? result.status : null;
    const ok = status !== "failed";
    const complete = ok
        && status !== "incomplete"
        && result.committed !== false;
    return {
        ...result,
        contractVersion: KAPLAYGROUND_WEBMCP_CONTRACT_VERSION,
        tool,
        ok,
        complete,
    };
}

export function normalizeToolError(
    error: unknown,
    tool: KaplaygroundToolName,
): Error {
    if (
        error instanceof DOMException
        && (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
        return error;
    }
    if (error instanceof KaplaygroundToolError) return error;
    if (error instanceof TypeError || error instanceof RangeError) {
        return new KaplaygroundToolError(
            "INVALID_TOOL_INPUT",
            error.message,
            {
                retryable: true,
                details: {
                    tool,
                    ...(error instanceof PreviewExerciseLimitError ? error.details : {}),
                },
                cause: error,
            },
        );
    }
    return new KaplaygroundToolError(
        "TOOL_EXECUTION_FAILED",
        error instanceof Error ? error.message : String(error),
        {
            retryable: false,
            details: { tool },
            cause: error,
        },
    );
}

export function toolErrorCode(error: unknown): string | undefined {
    if (error instanceof KaplaygroundToolError) return error.code;
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
