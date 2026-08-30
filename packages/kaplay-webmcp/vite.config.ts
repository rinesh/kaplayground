import { defineConfig } from "vite";

// Keep the package example isolated from KAPLAYGROUND's application plugins
// and repository-level PostCSS configuration.
export default defineConfig({
    css: {
        postcss: { plugins: [] },
    },
});
