import { defineConfig } from "vitest/config";

// Loading the repository-level Vite config would run the editor's build plugins.
export default defineConfig({
    test: {
        environment: "node",
    },
});
