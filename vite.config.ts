import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "@openai/sites-vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import "./scripts/examples.ts";
import "./scripts/versions.ts";
import "./scripts/changelog.ts";

// https://vitejs.dev/config/
export default defineConfig({
    clearScreen: false,
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
                    src: "kaplay/examples/**",
                    dest: "",
                },
            ],
        }),
        sites(),
    ],
    build: {
        outDir: "dist",
    },
});
