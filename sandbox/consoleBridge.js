export function resolveConsoleFeedExport(module) {
    const exported = module?.default?.default ?? module?.default ?? module;
    if (typeof exported !== "function") {
        throw new TypeError("console-feed export is not callable");
    }
    return exported;
}

export function createConsoleBridge({
    Hook,
    Unhook,
    consoleObject,
    onLog,
}) {
    let hooked = null;

    const hook = () => {
        hooked ??= Hook(consoleObject, onLog);
    };

    const unhook = () => {
        if (!hooked) return;
        Unhook(hooked);
        hooked = null;
    };

    return { hook, unhook };
}
