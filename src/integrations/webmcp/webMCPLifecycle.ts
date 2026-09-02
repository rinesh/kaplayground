type LifecycleListener = EventListenerOrEventListenerObject;

type LifecycleTarget = Pick<
    EventTarget,
    "addEventListener" | "removeEventListener"
>;

type VisibilityTarget = LifecycleTarget & { readonly hidden?: boolean };

export interface KaplaygroundWebMCPLifecycleOptions {
    getModelContext?: () => unknown;
    windowTarget?: LifecycleTarget;
    documentTarget?: VisibilityTarget;
    schedule?: (callback: () => void) => void;
}

/**
 * Keeps one page-owned WebMCP registration tied to one live document session.
 * Navigating away aborts the old registrations; BFCache restores and a replaced
 * document.modelContext create one fresh registration surface.
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

    const unregistered = Symbol("unregistered");
    let registeredContext: unknown | typeof unregistered = unregistered;
    let unregister: (() => void) | null = null;
    let disposed = false;
    let syncScheduled = false;

    const stopRegistration = () => {
        unregister?.();
        unregister = null;
        registeredContext = unregistered;
    };

    const synchronize = () => {
        if (disposed) return;
        const context = getModelContext();
        if (unregister && registeredContext === context) return;

        stopRegistration();
        registeredContext = context;
        unregister = register();
    };

    const scheduleSynchronization = () => {
        if (disposed || syncScheduled) return;
        syncScheduled = true;
        schedule(() => {
            syncScheduled = false;
            synchronize();
        });
    };

    const pageHide: EventListener = () => stopRegistration();
    const pageShow: EventListener = () => scheduleSynchronization();
    const beforeUnload: EventListener = () => stopRegistration();
    const focus: EventListener = () => synchronize();
    const visibilityChange: EventListener = () => {
        if (documentTarget.hidden !== true) synchronize();
    };

    addListener(windowTarget, "pagehide", pageHide);
    addListener(windowTarget, "pageshow", pageShow);
    addListener(windowTarget, "beforeunload", beforeUnload);
    addListener(windowTarget, "focus", focus);
    addListener(documentTarget, "visibilitychange", visibilityChange);
    synchronize();

    return () => {
        if (disposed) return;
        disposed = true;
        stopRegistration();
        removeListener(windowTarget, "pagehide", pageHide);
        removeListener(windowTarget, "pageshow", pageShow);
        removeListener(windowTarget, "beforeunload", beforeUnload);
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
