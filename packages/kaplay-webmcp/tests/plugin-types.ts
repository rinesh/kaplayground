import kaplay from "kaplay";
import webmcp from "../src/index";

// Compile-only coverage for KAPLAY's plugin type inference.
export function createTypedPluginGame() {
    const k = kaplay({
        global: false,
        plugins: [webmcp({ builtins: false })],
    });

    return k.webmcp;
}
