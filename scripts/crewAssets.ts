import { assets } from "@kaplayjs/crew";
import fs from "node:fs";
import path from "node:path";

// Literal loader paths are embedded by the compiler. Computed /crew paths
// also need real files, both in the editor and in the preview sandbox.
export function generateCrewAssets() {
    const directory = path.join(import.meta.dirname, "..", "public", "crew");
    fs.mkdirSync(directory, { recursive: true });

    for (const asset of Object.values(assets)) {
        const variants = [{
            loader: asset.imports.importInPG.original,
            source: asset.kind === "Sound"
                ? asset.sound
                : "spritesheet" in asset
                ? asset.spritesheet?.sprite
                : asset.sprite,
        }];
        if (asset.kind !== "Sound") {
            variants.push({
                loader: asset.imports.importInPG.outlined ?? "",
                source: "spritesheet" in asset
                    ? asset.spritesheet?.outlined
                    : asset.outlined,
            });
        }
        for (const { loader, source } of variants) {
            if (!loader) continue;
            const filename = loader.match(/"\/crew\/([\w-]+\.[\w]+)"/)?.[1];
            const data = source?.match(/^data:[^;,]+;base64,([\s\S]+)$/)?.[1];
            if (!filename || !data) {
                throw new Error(
                    `Cannot publish the built-in asset: ${asset.name}`,
                );
            }
            fs.writeFileSync(
                path.join(directory, filename),
                Buffer.from(data, "base64"),
            );
        }
    }
}
