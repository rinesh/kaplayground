import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { generateCrewAssets } from "../scripts/crewAssets.ts";

generateCrewAssets();

export default defineConfig({
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: "../public/crew/*",
                    dest: "crew",
                    rename: { stripBase: true },
                },
                {
                    // all except js files
                    src: "../kaplay/examples/**/!(*.js)",
                    dest: "",
                    // Keep /sprites, /sounds, and /fonts at the sandbox root.
                    rename: { stripBase: 2 },
                },
            ],
        }),
    ],
});
