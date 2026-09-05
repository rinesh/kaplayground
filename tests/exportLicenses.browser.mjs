import kaplayLicense from "../kaplay/LICENSE?raw";
import kaplaygroundLicense from "../LICENSE?raw";
import legacyKaplayLicense from "../node_modules/kaplay/LICENSE?raw";
import { buildProject } from "../src/features/Projects/application/buildProject";
import { useProject } from "../src/features/Projects/stores/useProject";
import markdownKaplayLicense from "./fixtures/kaplay-3001.0.19-LICENSE.md?raw";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

export function assertExportNotices(html, engineLicense) {
    const document = new DOMParser().parseFromString(html, "text/html");
    const notices = document.getElementById("license-notices");
    assert(notices?.hidden, "The export must embed its own license notices.");
    for (
        const license of [kaplaygroundLicense, kaplayLicense, engineLicense]
    ) {
        assert(
            notices.textContent.includes(license.trim()),
            "The generated HTML is missing a complete copyright, permission, or warranty notice.",
        );
    }
    assert(
        notices.textContent.trim().endsWith(engineLicense.trim()),
        "The engine section must carry the selected version's full notice.",
    );
    assert(
        !notices.querySelector("script"),
        "License text must not be interpreted as executable HTML.",
    );
    const engine = html.match(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/);
    assert(
        engine && atob(engine[1]).length > 100_000,
        "The licensed HTML must contain the real embedded engine.",
    );
}

export async function verifyExportLicenses() {
    const originalProject = useProject.getState().project;
    const originalFetch = globalThis.fetch;
    const completed = [];
    const isLicenseRequest = input => /\/LICENSE(?:\.md)?$/.test(String(input));
    try {
        for (const buildMode of ["legacy", "esbuild"]) {
            for (const version of ["3001.0.0", "3001.0.19", "master"]) {
                useProject.setState({
                    project: {
                        ...originalProject,
                        name: `License artifact ${buildMode} ${version}`,
                        mode: "ex",
                        buildMode,
                        kaplayVersion: version,
                        assets: new Map(),
                        files: new Map([["main.js", {
                            path: "main.js",
                            kind: "main",
                            language: "javascript",
                            value:
                                "kaplay(); loadSprite(\"apple\", \"/sprites/apple.png\"); add([rect(20, 20)]);",
                        }]]),
                    },
                });
                // Inspect the HTML bytes that the download receives, not the template source.
                const artifact = new Blob([await buildProject()], {
                    type: "text/html",
                });
                const html = await artifact.text();
                assert(
                    html.includes("data:image/png;base64,"),
                    "Exported games must keep built-in art embedded for offline use.",
                );
                assertExportNotices(
                    html,
                    version === "master"
                        ? kaplayLicense
                        : version === "3001.0.19"
                        ? markdownKaplayLicense
                        : legacyKaplayLicense,
                );
                assert(
                    html.includes(`KAPLAY ${version} (embedded engine)`),
                    "The notice must identify the exported engine version.",
                );
                completed.push(`${buildMode}/${version}`);
            }
        }

        for (
            const [label, response] of [
                ["missing", () => new Response("Not found", { status: 404 })],
                ["network failure", () => {
                    throw new TypeError("Offline");
                }],
                ["empty", () => new Response("")],
                [
                    "HTML fallback",
                    () => new Response("<!doctype html><html></html>"),
                ],
                [
                    "copyright only",
                    () => new Response("Copyright (c) 2025 KAPLAY Team"),
                ],
                [
                    "missing permission",
                    () =>
                        new Response(
                            kaplayLicense.replace(
                                "Permission is hereby granted",
                                "Permission omitted",
                            ),
                        ),
                ],
                [
                    "missing inclusion clause",
                    () =>
                        new Response(
                            kaplayLicense.replace(
                                "The above copyright notice",
                                "Omitted notice",
                            ),
                        ),
                ],
                [
                    "missing warranty",
                    () =>
                        new Response(
                            kaplayLicense.split("THE SOFTWARE IS PROVIDED")[0],
                        ),
                ],
            ]
        ) {
            globalThis.fetch = (input, options) =>
                isLicenseRequest(input)
                    ? Promise.resolve().then(response)
                    : originalFetch(input, options);
            let rejected = false;
            try {
                await buildProject();
            } catch (error) {
                assert(
                    error instanceof Error
                        && /Cannot export:.*license/.test(error.message),
                    `The ${label} case failed for an unrelated reason: ${error}`,
                );
                rejected = true;
            }
            assert(rejected, `Export must fail when its license has ${label}.`);
            completed.push(`rejects ${label}`);
        }

        // A version switch during the fetch must not relabel an older engine.
        const captured = useProject.getState().project;
        const escapedLicense = kaplayLicense.replace(
            "KAPLAY Team",
            "KAPLAY Team & contributors <script>licenseTextOnly()</script>",
        );
        globalThis.fetch = (input, options) => {
            if (isLicenseRequest(input)) {
                useProject.setState({
                    project: {
                        ...captured,
                        name: "Replacement",
                        kaplayVersion: "3001.0.0",
                    },
                });
                return Promise.resolve(new Response(escapedLicense));
            }
            return originalFetch(input, options);
        };
        const snapshot = await buildProject();
        assertExportNotices(snapshot, escapedLicense);
        assert(
            snapshot.includes(`<title>${captured.name}</title>`)
                && snapshot.includes("KAPLAY master (embedded engine)"),
            "Export must retain the project and engine captured before the fetch.",
        );
        completed.push("snapshot and escaped notice text");
        return completed;
    } finally {
        globalThis.fetch = originalFetch;
        useProject.setState({ project: originalProject });
    }
}
