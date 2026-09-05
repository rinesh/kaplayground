import {
    getKaplayLicense,
    sourceLicenseNotices,
} from "../../../licenseNotices";
import { getVersion, parseAssets } from "../../../util/compiler";
import { useProject } from "../stores/useProject";
import { buildCode } from "./buildCode";
import { defaultFavicon } from "./defaultFavicon";
import { fitGameToViewport } from "./gameViewport";

const toDataUrl = (data: string) => {
    const base64 = btoa(data);
    return `data:text/javascript;base64,${base64}`;
};

export async function buildProject() {
    const activeProject = useProject.getState().project;
    const project = {
        ...activeProject,
        files: new Map(activeProject.files),
        assets: new Map(activeProject.assets),
    };
    const [code, kaplayLib, engineLicense, { default: publicAssets }] =
        await Promise.all([
            buildCode(project),
            getVersion(true, project.kaplayVersion),
            getKaplayLicense(project.kaplayVersion),
            import("../../../data/publicAssets.json"),
        ]);

    if (!kaplayLib) {
        throw new Error("Failed to fetch the library");
    }

    const kaplayLibDataUrl = toDataUrl(kaplayLib);
    const licenseNotices = `${sourceLicenseNotices}

KAPLAY ${project.kaplayVersion} (embedded engine)

${engineLicense}`;
    const escapedNotices = licenseNotices.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const projectCode = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name}</title>
    <link rel="icon" href="${project.favicon || defaultFavicon}">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body,
        html {
            width: 100%;
            height: 100vh;
        }

        body {
            overflow: hidden;
            background: #171212;
        }
    </style>
</head>
<body>
    <pre id="license-notices" hidden>${escapedNotices}</pre>
    <script type="module">
        import createKaplay from "${kaplayLibDataUrl}";
        const kaplay = (options, ...args) => createKaplay(
            (${fitGameToViewport.toString()})(options, {
                width: window.innerWidth,
                height: window.innerHeight,
            }),
            ...args,
        );
        ${
        parseAssets(
            code,
            project.assets,
            new Map(
                publicAssets.assets.map(
                    asset => [asset.filename, asset.base64]
                ),
            ),
        )
    }
    </script>
</body>
</html>`;

    return projectCode;
}
