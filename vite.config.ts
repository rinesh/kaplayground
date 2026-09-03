import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "@openai/sites-vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import "./scripts/examples.ts";
import "./scripts/versions.ts";
import "./scripts/changelog.ts";

const packageJson = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version?: string };
const buildIdentity = {
    applicationCommit: gitRevision(["rev-parse", "HEAD"]),
    engineCommit: gitRevision(["-C", "kaplay", "rev-parse", "HEAD"]),
    applicationVersion: packageJson.version ?? "unknown",
    builtAt: new Date().toISOString(),
};

// https://vitejs.dev/config/
export default defineConfig({
    clearScreen: false,
    define: {
        __KAPLAYGROUND_BUILD_IDENTITY__: JSON.stringify(buildIdentity),
    },
    plugins: [
        cloudflare({
            viteEnvironment: { name: "server" },
            config: {
                name: "kaplayground-webmcp",
                main: "./worker/index.ts",
                compatibility_date: "2026-05-22",
                assets: {
                    binding: "ASSETS",
                    not_found_handling: "single-page-application",
                },
            },
        }),
        react(),
        viteStaticCopy({
            targets: [
                {
                    src: "LICENSE",
                    dest: "",
                    rename: "LICENSE.txt",
                },
                {
                    src: "kaplay/LICENSE",
                    dest: "licenses",
                    rename: { stripBase: true, name: "KAPLAY.txt" },
                },
                {
                    src: [
                        "kaplay/examples/**",
                        "!kaplay/examples/examples.json",
                    ],
                    dest: "",
                    // Match the public URLs used by starting points and previews.
                    rename: { stripBase: 2 },
                },
            ],
        }),
        sites(),
    ],
    build: {
        outDir: "dist",
    },
});

function gitRevision(args: string[]): string {
    try {
        return execFileSync("git", args, {
            cwd: new URL(".", import.meta.url),
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim() || "unknown";
    } catch {
        return "unknown";
    }
}
