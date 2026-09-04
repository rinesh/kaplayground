type LifecycleListener = EventListenerOrEventListenerObject;

type LifecycleTarget = Pick<
    EventTarget,
    "addEventListener" | "removeEventListener"
>;

type VisibilityTarget = LifecycleTarget & { readonly hidden?: boolean };
type ContextCheckScheduler = (callback: () => void) => () => void;

const MODEL_CONTEXT_CHECK_INTERVAL_MS = 250;

export interface KaplaygroundWebMCPLifecycleOptions {
    getModelContext?: () => unknown;
    windowTarget?: LifecycleTarget;
    documentTarget?: VisibilityTarget;
    schedule?: (callback: () => void) => void;
    scheduleContextCheck?: ContextCheckScheduler;
}

/**
 * Keeps one page-owned WebMCP registration tied to one live document session.
 * Navigating away aborts the old registrations; BFCache restores and a replaced
 * document.modelContext create one fresh registration surface. A short recurring
 * identity check also handles browser hosts that change the context without a
 * page lifecycle event.
 */
export function installKaplaygroundWebMCPLifecycle(
    register: () => () => void,
    options: KaplaygroundWebMCPLifecycleOptions = {},
): () => void {
    const getModelContext = options.getModelContext
        ?? (() => (document as Document & { modelContext?: unknown }).modelContext);
    const windowTarget = options.windowTarget ?? window;
    const documentTarget = options.documentTarget ?? document;
    const schedule = options.schedule ?? queueMicrotask;
    const scheduleContextCheck = options.scheduleContextCheck
        ?? ((callback) => {
            const timer = globalThis.setTimeout(
                callback,
                MODEL_CONTEXT_CHECK_INTERVAL_MS,
            );
            return () => globalThis.clearTimeout(timer);
        });

    const unregistered = Symbol("unregistered");
    let registeredContext: unknown | typeof unregistered = unregistered;
    let unregister: (() => void) | null = null;
    let cancelContextCheck: (() => void) | null = null;
    let disposed = false;
    let pageActive = true;
    let syncScheduled = false;

    const stopContextCheck = () => {
        cancelContextCheck?.();
        cancelContextCheck = null;
    };

    const stopRegistration = () => {
        unregister?.();
        unregister = null;
        registeredContext = unregistered;
    };

    const synchronize = () => {
        if (disposed || !pageActive) return;
        const context = getModelContext();
        if (unregister && registeredContext === context) return;

        stopRegistration();
        registeredContext = context;
        unregister = register();
    };

    const scheduleNextContextCheck = () => {
        if (disposed || !pageActive || cancelContextCheck) return;
        cancelContextCheck = scheduleContextCheck(() => {
            cancelContextCheck = null;
            synchronize();
            scheduleNextContextCheck();
        });
    };

    const scheduleSynchronization = () => {
        if (disposed || syncScheduled) return;
        syncScheduled = true;
        schedule(() => {
            syncScheduled = false;
            synchronize();
        });
    };

    // beforeunload can be canceled; keep tools until the document actually leaves.
    const pageHide: EventListener = () => {
        pageActive = false;
        stopContextCheck();
        stopRegistration();
    };
    const pageShow: EventListener = () => {
        pageActive = true;
        scheduleSynchronization();
        scheduleNextContextCheck();
    };
    const focus: EventListener = () => synchronize();
    const visibilityChange: EventListener = () => {
        if (documentTarget.hidden !== true) synchronize();
    };

    addListener(windowTarget, "pagehide", pageHide);
    addListener(windowTarget, "pageshow", pageShow);
    addListener(windowTarget, "focus", focus);
    addListener(documentTarget, "visibilitychange", visibilityChange);
    synchronize();
    scheduleNextContextCheck();

    return () => {
        if (disposed) return;
        disposed = true;
        stopContextCheck();
        stopRegistration();
        removeListener(windowTarget, "pagehide", pageHide);
        removeListener(windowTarget, "pageshow", pageShow);
        removeListener(windowTarget, "focus", focus);
        removeListener(documentTarget, "visibilitychange", visibilityChange);
    };
}

function addListener(
    target: LifecycleTarget,
    type: string,
    listener: LifecycleListener,
): void {
    target.addEventListener(type, listener);
}

function removeListener(
    target: LifecycleTarget,
    type: string,
    listener: LifecycleListener,
): void {
    target.removeEventListener(type, listener);
}
