import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    plugins: [
        viteStaticCopy({
            targets: [
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
