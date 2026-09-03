type GameViewportOptions = Record<string, unknown> & {
    width?: number;
    height?: number;
    scale?: number;
    letterbox?: boolean;
};

/**
 * Keep game coordinates stable while KAPLAY scales the canvas to its container.
 * This function is embedded in previews and HTML exports, so keep it standalone.
 */
export function fitGameToViewport(
    options: GameViewportOptions | null = {},
    viewport: { width: number; height: number },
) {
    // An explicit sizing mode or custom canvas belongs to the game's author.
    if (
        !options || typeof options !== "object" || Array.isArray(options)
        || options.letterbox === false || options.stretch === true
        || options.canvas || options.root
    ) return options;

    const scale = typeof options.scale === "number"
            && Number.isFinite(options.scale) && options.scale > 0
        ? options.scale
        : 1;
    const width = viewport.width > 0 ? viewport.width : 960;
    const height = viewport.height > 0 ? viewport.height : 540;

    return {
        ...options,
        width: options.width ?? Math.max(1, width / scale),
        height: options.height ?? Math.max(1, height / scale),
        letterbox: true,
    };
}
