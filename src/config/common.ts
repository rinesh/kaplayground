import packageJson from "../../package.json";

export const VERSION = packageJson.version;
export const CHANGELOG =
    "https://github.com/rinesh/kaplayground/blob/dev/CHANGELOG.md";
export const REPO = "https://github.com/rinesh/kaplayground";

export const SANDBOX_URL = new URL(
    import.meta.env.VITE_SANDBOX_URL || "https://iframe-kaplay-3h0.pages.dev",
    window.location.origin,
).href;
export const SANDBOX_ORIGIN = new URL(SANDBOX_URL).origin;
