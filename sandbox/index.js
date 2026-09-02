import * as HookModule from "console-feed/lib/Hook";
import * as UnhookModule from "console-feed/lib/Unhook";
import {
    createConsoleBridge,
    resolveConsoleFeedExport,
} from "./consoleBridge.js";
import { createPreviewReadinessTracker } from "./readiness.js";
import { createRuntimeInspector } from "./runtimeInspection.js";

const Hook = resolveConsoleFeedExport(HookModule);
const Unhook = resolveConsoleFeedExport(UnhookModule);

const PARENT_ORIGIN = document.referrer
    ? new URL(document.referrer).origin
    : null;
const PREVIEW_PROTOCOL_VERSION = 2;
const RUN_LOADED_CALLBACK = "__kaplaygroundModuleLoaded";
const RUN_CONTEXT_CALLBACK = "__kaplaygroundCaptureContext";
const RUN_READINESS_TIMEOUT_MS = Math.max(
    100,
    Number(import.meta.env.VITE_WEBMCP_READINESS_TIMEOUT_MS) || 10_000,
);

let activeRunId = null;
let activeContext = null;
const readiness = createPreviewReadinessTracker({
    timeoutMs: RUN_READINESS_TIMEOUT_MS,
    getRunId: () => activeRunId,
    findCanvas: () => document.querySelector("canvas"),
});
const inspectRuntime = createRuntimeInspector({
    getRunId: () => activeRunId,
    getReadiness: () => readiness.snapshot(),
    getDebug,
    getContext: () => window._k_ctx,
    readPaused,
});

Object.defineProperty(globalThis, RUN_CONTEXT_CALLBACK, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: context => captureContext(context),
});

const consoleBridge = createConsoleBridge({
    Hook,
    Unhook,
    consoleObject: window.console,
    onLog: log =>
        postParent({
            type: "CONSOLE",
            runId: activeRunId,
            log,
        }),
});
consoleBridge.hook();

window.addEventListener("error", event => {
    const message = event?.error?.message ?? event?.message;
    if (message) console.error(message);
});
window.addEventListener("unhandledrejection", event => {
    console.error("Unhandled promise rejection:", errorText(event.reason));
});

const executeCode = (code, runId) => {
    activeRunId = runId;
    activeContext = null;
    window._k_ctx = null;
    window._k_debug = null;
    readiness.reset(runId);
    console.groupCollapsed("[sandbox] Received code update");
    console.log("[sandbox] Run:", runId);
    console.log("[sandbox] Code:", code);
    console.groupEnd();

    document.querySelectorAll("script[data-preview-run]")
        .forEach(script => script.remove());

    const script = document.createElement("script");
    script.type = "module";
    script.dataset.previewRun = runId;
    let settled = false;
    let moduleReported = false;

    const cleanup = () => {
        script.removeEventListener("error", moduleError);
        window.removeEventListener("error", runtimeError, true);
        window.removeEventListener("unhandledrejection", rejection);
        if (globalThis[RUN_LOADED_CALLBACK] === moduleLoaded) {
            delete globalThis[RUN_LOADED_CALLBACK];
        }
    };
    const finish = result => {
        if (settled) return;
        settled = true;
        cleanup();
        postParent(result);
    };
    const fail = error => {
        if (settled) return;
        const message = errorText(error);
        readiness.markUnavailable(message);
        console.error("Error executing code:", message);
        finish({
            type: "RUN_RESULT",
            runId,
            status: "failed",
            paused: readPaused(),
            readiness: readiness.snapshot(),
            error: message,
        });
    };
    const moduleLoaded = completedRunId => {
        if (completedRunId !== runId || moduleReported) return;
        moduleReported = true;
        readiness.markModuleExecuted(runId);
        void readiness.waitFor(runId).then(runReadiness => {
            finish({
                type: "RUN_RESULT",
                runId,
                status: "loaded",
                paused: readPaused(),
                readiness: runReadiness,
            });
        });
    };
    const moduleError = () => {
        fail("The preview module failed to load.");
    };
    const runtimeError = event => {
        fail(event?.error ?? event?.message ?? "Preview execution failed.");
    };
    const rejection = event => {
        fail(event.reason ?? "Preview execution rejected.");
    };

    globalThis[RUN_LOADED_CALLBACK] = moduleLoaded;
    script.addEventListener("error", moduleError, { once: true });
    window.addEventListener("error", runtimeError, {
        capture: true,
        once: true,
    });
    window.addEventListener("unhandledrejection", rejection, {
        once: true,
    });
    const callbackName = JSON.stringify(RUN_LOADED_CALLBACK);
    const callbackRunId = JSON.stringify(runId);
    script.textContent =
        `${code}\n;globalThis[${callbackName}]?.(${callbackRunId});\n`;
    document.body.appendChild(script);
};

const messageEventHandlers = {
    UPDATE_CODE({ code, runId }) {
        if (typeof code !== "string" || typeof runId !== "string") return;
        void executeCode(code, runId);
    },

    REFRESH() {
        console.log("[sandbox] Refreshing the page");
        window.location.reload();
    },

    SET_PAUSED({ requestId, runId, paused }) {
        if (
            typeof requestId !== "string"
            || typeof runId !== "string"
            || typeof paused !== "boolean"
        ) {
            return;
        }

        if (runId !== activeRunId) {
            postParent({
                type: "PAUSE_RESULT",
                requestId,
                runId: activeRunId,
                paused: readPaused(),
                error: "The requested preview run is no longer active.",
            });
            return;
        }

        try {
            const actualPaused = setPaused(paused);
            postParent({
                type: "PAUSE_RESULT",
                requestId,
                runId: activeRunId,
                paused: actualPaused,
            });
        } catch (error) {
            postParent({
                type: "PAUSE_RESULT",
                requestId,
                runId: activeRunId,
                paused: readPaused(),
                error: errorText(error),
            });
        }
    },

    PAUSE() {
        const paused = readPaused();
        if (paused === null) return;
        setPaused(!paused);
    },

    INSPECT_RUNTIME({ requestId, runId, tag, limit }) {
        if (typeof requestId !== "string" || typeof runId !== "string") return;

        if (runId !== activeRunId) {
            postParent({
                type: "RUNTIME_INSPECTION_RESULT",
                requestId,
                runId: activeRunId,
                error: "The requested preview run is no longer active.",
            });
            return;
        }

        try {
            postParent({
                type: "RUNTIME_INSPECTION_RESULT",
                requestId,
                runId: activeRunId,
                inspection: inspectRuntime({ tag, limit }),
            });
        } catch (error) {
            postParent({
                type: "RUNTIME_INSPECTION_RESULT",
                requestId,
                runId: activeRunId,
                error: errorText(error),
            });
        }
    },

    FOCUS() {
        console.log("[sandbox] Focusing the game");
        const canvas = document.querySelector("canvas");
        if (!canvas) return;
        if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
        canvas.focus({ preventScroll: true });
    },

    TOGGLE_CONSOLE() {
        // The preference controls parent-side presentation only.
        // WebMCP capture remains active for agent verification.
    },
};

window.addEventListener("message", event => {
    if (event.origin !== PARENT_ORIGIN || event.source !== window.parent) return;
    messageEventHandlers[event.data?.type]?.(event.data);
});

window.addEventListener("load", () => {
    postParent({
        type: "READY",
        protocolVersion: PREVIEW_PROTOCOL_VERSION,
    });
});

function captureContext(context) {
    if (!context || activeRunId === null) return;
    activeContext = context;
    window._k_ctx = context;
    window._k_debug = context?.debug ?? null;
    readiness.captureContext(context, activeRunId);
}

function setPaused(paused) {
    const debug = getDebug();
    if (!debug || typeof debug.paused !== "boolean") {
        throw new Error(
            "The running game does not expose KAPLAY debug state.",
        );
    }

    console.log(`[sandbox] ${paused ? "Pausing" : "Resuming"} the game`);
    debug.paused = paused;
    const actualPaused = readPaused();
    if (actualPaused === null) {
        throw new Error("KAPLAY did not report its pause state.");
    }
    return actualPaused;
}

function readPaused() {
    const debug = getDebug();
    return typeof debug?.paused === "boolean" ? debug.paused : null;
}

function getDebug() {
    return window._k_ctx?.debug ?? window.debug ?? window._k_debug ?? null;
}

function errorText(error) {
    const value = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    return value.length <= 2_000 ? value : value.slice(0, 2_000);
}

function postParent(message) {
    if (!PARENT_ORIGIN) return;
    window.parent.postMessage(message, PARENT_ORIGIN);
}

const keysToPreventDefault = ["e", "p", "s"];
window.addEventListener("keydown", event => {
    if (
        (event.key.length > 1 && event.key != "Escape")
        || !(event.ctrlKey || event.metaKey || event.altKey)
    ) {
        return;
    }

    if (
        event.target instanceof HTMLInputElement
        || event.target instanceof HTMLTextAreaElement
        || event.target?.isContentEditable
    ) {
        return;
    }

    if (keysToPreventDefault.includes(event.key.toLowerCase())) {
        event.preventDefault();
    }

    postParent({
        type: "KEY_BINDING",
        e: {
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            key: event.key,
        },
    });
});
