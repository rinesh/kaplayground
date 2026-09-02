const DEFAULT_POLL_INTERVAL_MS = 50;
const MAX_REASON_LENGTH = 2_000;

export function createPreviewReadinessTracker({
    timeoutMs,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    getRunId,
    findCanvas = () => globalThis.document?.querySelector?.("canvas") ?? null,
    setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimer = (timer) => globalThis.clearTimeout(timer),
    scheduleMicrotask = (callback) => globalThis.queueMicrotask(callback),
}) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new RangeError("timeoutMs must be a positive finite number.");
    }
    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
        throw new RangeError(
            "pollIntervalMs must be a positive finite number.",
        );
    }
    if (typeof getRunId !== "function") {
        throw new TypeError("getRunId must be a function.");
    }

    let activeContext = null;
    let drawTrackedContext = null;
    let stopObservingDraw = null;
    let loadTrackedContext = null;
    let readiness = createReadiness();
    let readinessPromise = Promise.resolve(snapshot());
    let readinessResolve = null;
    let readinessTimer = null;
    let loadProgressTimer = null;

    function reset(runId) {
        if (readiness.status === "pending" && readinessResolve) {
            readiness.status = "unavailable";
            readiness.reason =
                "The preview run changed before readiness was reported.";
            settle();
        } else {
            clearScheduledWork();
        }
        activeContext = null;
        drawTrackedContext = null;
        loadTrackedContext = null;
        readiness = createReadiness();
        readinessPromise = new Promise(resolve => {
            readinessResolve = resolve;
        });
        readinessTimer = setTimer(() => {
            if (runId !== getRunId() || readiness.status !== "pending") {
                return;
            }
            readiness.status = readiness.contextCaptured
                ? "timed-out"
                : "unavailable";
            readiness.reason = readiness.contextCaptured
                ? readinessTimeoutReason(readiness)
                : "KAPLAY context capture was unavailable before the loading timeout.";
            settle();
        }, timeoutMs);
    }

    function captureContext(context, runId = getRunId()) {
        if (!context || runId === null || runId !== getRunId()) return;

        if (activeContext !== context) {
            clearLoadProgressTimer();
            clearDrawObserver();
            drawTrackedContext = null;
            loadTrackedContext = null;
        }
        activeContext = context;
        readiness.contextCaptured = true;
        updateCanvasEvidence(context);
        trackDraw(context, runId);
        if (readiness.moduleExecuted) trackLoading(context, runId);
        maybeComplete();
    }

    function markModuleExecuted(runId) {
        if (runId !== getRunId() || readiness.status !== "pending") return;
        readiness.moduleExecuted = true;
        if (activeContext) trackLoading(activeContext, runId);
        maybeComplete();
    }

    function markUnavailable(reason) {
        if (readiness.status !== "ready") {
            readiness.status = "unavailable";
            readiness.reason = boundedString(String(reason), MAX_REASON_LENGTH);
        }
        settle();
    }

    function waitFor(runId) {
        if (runId !== getRunId()) {
            return Promise.resolve({
                ...snapshot(),
                status: "unavailable",
                reason: "The preview run changed before readiness was reported.",
            });
        }
        if (readiness.status !== "pending") {
            return Promise.resolve(snapshot());
        }
        return readinessPromise;
    }

    function snapshot() {
        return { ...readiness };
    }

    function destroy() {
        if (readiness.status === "pending") {
            readiness.status = "unavailable";
            readiness.reason = "The preview readiness tracker was stopped.";
        }
        settle();
        activeContext = null;
        drawTrackedContext = null;
        loadTrackedContext = null;
    }

    function trackDraw(context, runId) {
        if (drawTrackedContext === context) return;
        drawTrackedContext = context;

        const onDraw = () => {
            if (!isCurrentContext(context, runId)) return;
            readiness.firstFrame = true;
            clearDrawObserver();
            updateCanvasEvidence(context);
            maybeComplete();
        };

        // go() cancels default onDraw subscriptions before the first game frame.
        stopObservingDraw = safeInvoke(() => {
            if (typeof context.app?.onDraw === "function") {
                const subscription = context.app.onDraw(onDraw);
                return () => subscription.cancel();
            }

            // KAPLAY 3001 has no app scope; a stay object survives scene changes.
            const observer = context.add([context.stay(), { draw: onDraw }]);
            return () => observer.destroy();
        }) ?? null;
    }

    function trackLoading(context, runId) {
        if (loadTrackedContext === context) return;
        loadTrackedContext = context;

        safeInvoke(() => context.onLoad?.(() => {
            if (!isCurrentContext(context, runId)) return;
            readiness.assetsLoaded = true;
            maybeComplete();
        }));
        scheduleMicrotask(() => pollLoadProgress(context, runId));
    }

    function pollLoadProgress(context, runId) {
        if (!isCurrentContext(context, runId) || readiness.status !== "pending") {
            clearLoadProgressTimer();
            return;
        }

        const progress = finiteNumber(
            safeInvoke(() => context.loadProgress?.()),
        );
        if (progress !== null && progress >= 1) {
            readiness.assetsLoaded = true;
            maybeComplete();
        }
        if (readiness.status === "pending") {
            loadProgressTimer = setTimer(
                () => pollLoadProgress(context, runId),
                pollIntervalMs,
            );
        }
    }

    function isCurrentContext(context, runId) {
        return runId === getRunId() && context === activeContext;
    }

    function updateCanvasEvidence(context = activeContext) {
        readiness.canvasPresent = readiness.canvasPresent
            || Boolean(safeInvoke(() => context?.canvas))
            || Boolean(safeInvoke(findCanvas));
    }

    function maybeComplete() {
        updateCanvasEvidence();
        if (
            !readiness.moduleExecuted
            || !readiness.contextCaptured
            || !readiness.assetsLoaded
            || !readiness.firstFrame
            || !readiness.canvasPresent
        ) {
            return;
        }

        readiness.status = "ready";
        readiness.reason = null;
        settle();
    }

    function settle() {
        clearScheduledWork();
        const resolve = readinessResolve;
        readinessResolve = null;
        resolve?.(snapshot());
    }

    function clearScheduledWork() {
        if (readinessTimer !== null) {
            clearTimer(readinessTimer);
            readinessTimer = null;
        }
        clearLoadProgressTimer();
        clearDrawObserver();
    }

    function clearDrawObserver() {
        const stop = stopObservingDraw;
        stopObservingDraw = null;
        safeInvoke(() => stop?.());
    }

    function clearLoadProgressTimer() {
        if (loadProgressTimer === null) return;
        clearTimer(loadProgressTimer);
        loadProgressTimer = null;
    }

    return {
        reset,
        captureContext,
        markModuleExecuted,
        markUnavailable,
        waitFor,
        snapshot,
        destroy,
    };
}

function createReadiness() {
    return {
        status: "pending",
        moduleExecuted: false,
        contextCaptured: false,
        assetsLoaded: false,
        firstFrame: false,
        canvasPresent: false,
        reason: null,
    };
}

function readinessTimeoutReason(readiness) {
    const missing = [];
    if (!readiness.assetsLoaded) missing.push("asset loading");
    if (!readiness.firstFrame) missing.push("a first game frame");
    if (!readiness.canvasPresent) missing.push("a preview canvas");
    return `Timed out waiting for ${missing.join(", ") || "readiness"}.`;
}

function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeInvoke(operation) {
    try {
        return operation();
    } catch {
        return undefined;
    }
}

function boundedString(value, maxLength) {
    return value.length <= maxLength ? value : value.slice(0, maxLength);
}
