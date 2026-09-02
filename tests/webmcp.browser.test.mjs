import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const auditCatalog = process.argv.includes("--catalog");
const children = new Set();
const logs = new Map();

class CdpClient {
    static async connect(url) {
        if (typeof WebSocket !== "function") {
            throw new Error(
                "Node.js 22 or newer is required for the browser test.",
            );
        }
        const socket = new WebSocket(url);
        await new Promise((resolveOpen, reject) => {
            const cleanup = () => {
                socket.removeEventListener("open", opened);
                socket.removeEventListener("error", failed);
            };
            const opened = () => {
                cleanup();
                resolveOpen();
            };
            const failed = event => {
                cleanup();
                reject(
                    event.error
                        ?? new Error("Could not connect to Chrome DevTools."),
                );
            };
            socket.addEventListener("open", opened, { once: true });
            socket.addEventListener("error", failed, { once: true });
        });
        return new CdpClient(socket);
    }

    constructor(socket) {
        this.socket = socket;
        this.nextId = 0;
        this.pending = new Map();
        this.listeners = new Map();
        this.eventError = null;

        socket.addEventListener("message", event => {
            void this.handleMessage(event.data);
        });
        socket.addEventListener("close", () => {
            for (const { reject } of this.pending.values()) {
                reject(new Error("Chrome DevTools connection closed."));
            }
            this.pending.clear();
        });
    }

    async handleMessage(data) {
        const text = typeof data === "string"
            ? data
            : data instanceof ArrayBuffer
            ? Buffer.from(data).toString("utf8")
            : Buffer.from(await data.arrayBuffer()).toString("utf8");
        const message = JSON.parse(text);
        if (typeof message.id === "number") {
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            if (message.error) {
                pending.reject(new Error(message.error.message));
            } else {
                pending.resolve(message.result);
            }
            return;
        }

        const listeners = this.listeners.get(message.method);
        if (!listeners) return;
        for (const listener of listeners) {
            void Promise.resolve(listener(message.params)).catch(error => {
                this.eventError = error instanceof Error
                    ? error
                    : new Error(String(error));
            });
        }
    }

    on(method, listener) {
        const listeners = this.listeners.get(method) ?? new Set();
        listeners.add(listener);
        this.listeners.set(method, listeners);
        return () => listeners.delete(listener);
    }

    send(method, params = {}) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            return Promise.reject(
                new Error("Chrome DevTools is not connected."),
            );
        }
        const id = ++this.nextId;
        return new Promise((resolveResult, reject) => {
            this.pending.set(id, { resolve: resolveResult, reject });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    close() {
        if (
            this.socket.readyState === WebSocket.OPEN
            || this.socket.readyState === WebSocket.CONNECTING
        ) {
            this.socket.close();
        }
    }
}

async function main() {
    let client;
    let profileDirectory;
    const screenshotDirectory = process.env.WEBMCP_CAPTURE_UI
        ? await mkdtemp(join(tmpdir(), "kaplayground-ui-review-"))
        : null;

    try {
        const ports = new Set();
        while (ports.size < 3) ports.add(await freePort());
        const [appPort, sandboxPort, debuggingPort] = ports;
        const sandboxUrl = `http://127.0.0.1:${sandboxPort}/`;
        const appUrl = `http://127.0.0.1:${appPort}/tests/webmcp.browser.html${
            auditCatalog ? "?catalog-audit" : ""
        }`;

        const sandbox = startProcess(
            viteExecutable(),
            [
                "--host",
                "127.0.0.1",
                "--port",
                String(sandboxPort),
                "--strictPort",
            ],
            {
                cwd: join(root, "sandbox"),
                // This budget also includes importing and starting the engine.
                env: { VITE_WEBMCP_READINESS_TIMEOUT_MS: "2500" },
            },
            "sandbox",
        );
        await waitForUrl(sandboxUrl, sandbox, 30_000);

        const app = startProcess(
            viteExecutable(),
            [
                "--host",
                "127.0.0.1",
                "--port",
                String(appPort),
                "--strictPort",
            ],
            {
                cwd: root,
                env: { VITE_SANDBOX_URL: sandboxUrl },
            },
            "app",
        );
        await waitForUrl(appUrl, app, 30_000);
        await verifyPublicAssetRoutes(sandboxUrl);
        await verifyPublicAssetRoutes(appUrl);

        const fixtures = await loadBrowserFixtures();
        profileDirectory = await mkdtemp(
            join(tmpdir(), "kaplayground-webmcp-"),
        );
        const browser = startProcess(
            chromeExecutable(),
            [
                "--headless=new",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-default-apps",
                "--disable-sync",
                "--metrics-recording-only",
                "--no-first-run",
                "--remote-allow-origins=*",
                `--remote-debugging-port=${debuggingPort}`,
                `--user-data-dir=${profileDirectory}`,
                "--window-size=1440,1000",
                "about:blank",
            ],
            { cwd: root },
            "browser",
        );

        const target = await waitForBrowserTarget(
            debuggingPort,
            browser,
            30_000,
        );
        client = await CdpClient.connect(target.webSocketDebuggerUrl);
        await client.send("Page.enable");
        await client.send("Emulation.setEmulatedMedia", {
            features: [{
                name: "prefers-reduced-motion",
                value: "no-preference",
            }],
        });
        await client.send("Runtime.enable");
        await installFixtureInterception(client, fixtures);
        const navigation = await client.send("Page.navigate", { url: appUrl });
        if (navigation.errorText) {
            throw new Error(
                `Chrome could not open the test page: ${navigation.errorText}`,
            );
        }

        const resultPromise = waitForBrowserResult(
            client,
            auditCatalog ? 600_000 : 120_000,
        );
        await client.send("Page.bringToFront");
        for (const key of ["bean_voice", "mark_voice", "burp", "kaboom2000"]) {
            const earlyResult = await Promise.race([
                waitForBrowserPhase(client, `sound-preview-${key}`, 60_000)
                    .then(() => null),
                resultPromise,
            ]);
            assert.equal(
                earlyResult,
                null,
                earlyResult?.error ?? `Test ended before playing ${key}.`,
            );
            const playButton = await client.send("Runtime.evaluate", {
                expression: `(async () => {
                    const audio = document.querySelector('.asset-browser audio');
                    audio.scrollIntoView({ block: 'nearest' });
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    const r = audio.getBoundingClientRect();
                    return { x: r.x + 24, y: r.y + r.height / 2 };
                })()`,
                awaitPromise: true,
                returnByValue: true,
            });
            await client.send("Input.dispatchMouseEvent", {
                type: "mouseMoved",
                ...playButton.result.value,
            });
            for (const type of ["mousePressed", "mouseReleased"]) {
                await client.send("Input.dispatchMouseEvent", {
                    type,
                    button: "left",
                    clickCount: 1,
                    ...playButton.result.value,
                });
            }
            await client.send("Runtime.evaluate", {
                expression: "globalThis.__webmcpSoundInputComplete?.()",
            });
        }
        const beforeTabs = await Promise.race([
            waitForBrowserPhase(client, "tabs-ready", 60_000).then(() => null),
            resultPromise,
        ]);
        assert.equal(
            beforeTabs,
            null,
            beforeTabs?.error ?? "Test ended before tab keyboard checks.",
        );
        await client.send("Page.bringToFront");
        const tabRect = await client.send("Runtime.evaluate", {
            expression:
                `(() => { const r = document.querySelector('[aria-label="Workspace panels"] [role="tab"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
            returnByValue: true,
        });
        await client.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            button: "left",
            clickCount: 1,
            ...tabRect.result.value,
        });
        await client.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            button: "left",
            clickCount: 1,
            ...tabRect.result.value,
        });
        await client.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "ArrowRight",
            code: "ArrowRight",
            windowsVirtualKeyCode: 39,
            nativeVirtualKeyCode: 39,
        });
        await client.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "ArrowRight",
            code: "ArrowRight",
            windowsVirtualKeyCode: 39,
            nativeVirtualKeyCode: 39,
        });
        await client.send("Runtime.evaluate", {
            expression: "globalThis.__webmcpTabInputComplete?.()",
        });
        const earlyResult = await Promise.race([
            waitForBrowserPhase(client, "movement-ready", 90_000).then(
                () => null,
            ),
            resultPromise.then(result => result),
        ]);
        if (earlyResult) {
            assert.equal(
                earlyResult.passed,
                true,
                earlyResult.error
                    ?? "Browser test failed before movement input.",
            );
            throw new Error(
                "Browser test finished before requesting movement input.",
            );
        }

        await client.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "ArrowRight",
            code: "ArrowRight",
            windowsVirtualKeyCode: 39,
            nativeVirtualKeyCode: 39,
        });
        await delay(350);
        await client.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "ArrowRight",
            code: "ArrowRight",
            windowsVirtualKeyCode: 39,
            nativeVirtualKeyCode: 39,
        });
        await client.send("Runtime.evaluate", {
            expression: "globalThis.__webmcpMovementInputComplete?.()",
        });

        const beforeLayout = await Promise.race([
            waitForBrowserPhase(client, "layout-ready", 90_000).then(() =>
                null
            ),
            resultPromise,
        ]);
        assert.equal(
            beforeLayout,
            null,
            beforeLayout?.error ?? "Test ended before layout checks.",
        );
        const layoutChecks = [];
        for (
            const [width, height] of [[1042, 936], [1440, 1000], [390, 844], [
                1042,
                936,
            ]]
        ) {
            await client.send("Emulation.setDeviceMetricsOverride", {
                width,
                height,
                deviceScaleFactor: 1,
                mobile: false,
            });
            await delay(250);
            const evaluated = await client.send("Runtime.evaluate", {
                expression: `(() => {
                    const rect = selector => {
                        const box = document.querySelector(selector)?.getBoundingClientRect();
                        return box && { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
                    };
                    return { preview: rect('#game-view'), coach: rect('aside[aria-label="Codex tips"]'), toolbar: rect('[role="toolbar"]'), panel: rect('[aria-label="Workspace panels"]'), output: rect('#console-wrapper'), width: innerWidth, scrollWidth: document.documentElement.scrollWidth, editors: document.querySelectorAll('.monaco-editor').length };
                })()`,
                returnByValue: true,
            });
            const layout = evaluated.result.value;
            assert(
                layout.preview?.width > 250 && layout.preview.height >= 290,
                `Preview is unusable at ${width}: ${JSON.stringify(layout)}`,
            );
            assert(
                layout.panel?.width >= 295 && layout.output?.height >= 169,
                `Right panels are unusable at ${width}: ${
                    JSON.stringify(layout)
                }`,
            );
            assert(
                layout.scrollWidth <= width + 1,
                `Page overflows horizontally at ${width}.`,
            );
            assert.equal(
                layout.editors,
                1,
                "The unified workspace must mount exactly one editor.",
            );
            assert(
                layout.coach?.y >= layout.preview.bottom - 1
                    && layout.coach.height > 100
                    && Math.abs(layout.coach.width - layout.preview.width) <= 2,
                `The tips must stay beneath the preview at ${width}.`,
            );
            if (width >= 900) {
                assert(
                    layout.preview.right <= layout.panel.x + 2,
                    "Desktop preview and tools must be side by side.",
                );
                assert(
                    Math.abs(layout.preview.y - layout.panel.y) <= 2,
                    "Desktop columns don't align.",
                );
                assert(
                    layout.output.y > layout.panel.bottom,
                    "Output must stay below the upper panel.",
                );
            } else {
                assert(
                    layout.panel.y >= layout.coach.bottom - 2,
                    "Portrait panels must stack after the preview and tips.",
                );
                assert(
                    layout.output.y > layout.panel.bottom,
                    "Portrait logs must follow the asset/code panel.",
                );
            }
            if (screenshotDirectory) {
                const screenshot = await client.send("Page.captureScreenshot", {
                    format: "png",
                });
                await writeFile(
                    join(screenshotDirectory, `workspace-${width}.png`),
                    Buffer.from(screenshot.data, "base64"),
                );
                if (width < 900) {
                    await client.send("Runtime.evaluate", {
                        expression:
                            "document.querySelector('main').parentElement.scrollTop = 450",
                    });
                    await delay(100);
                    const panels = await client.send("Page.captureScreenshot", {
                        format: "png",
                    });
                    await writeFile(
                        join(screenshotDirectory, `panels-${width}.png`),
                        Buffer.from(panels.data, "base64"),
                    );
                    await client.send("Runtime.evaluate", {
                        expression:
                            "document.querySelector('main').parentElement.scrollTop = 0",
                    });
                }
            }
            layoutChecks.push({ width, height, passed: true });
        }
        await client.send("Runtime.evaluate", {
            expression:
                "document.querySelector('[aria-label=\"Resize workspace panels\"]').focus()",
        });
        await client.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "ArrowLeft",
            code: "ArrowLeft",
            windowsVirtualKeyCode: 37,
            nativeVirtualKeyCode: 37,
        });
        await client.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "ArrowLeft",
            code: "ArrowLeft",
            windowsVirtualKeyCode: 37,
            nativeVirtualKeyCode: 37,
        });
        await delay(100);
        const resized = await client.send("Runtime.evaluate", {
            expression:
                "document.querySelector('[aria-label=\"Workspace panels\"]').getBoundingClientRect().width",
            returnByValue: true,
        });
        assert.equal(
            resized.result.value,
            360,
            "The panel separator didn't resize from the keyboard.",
        );
        await client.send("Runtime.evaluate", {
            expression:
                "document.querySelectorAll('[aria-label=\"Workspace panels\"] [role=\"tab\"]')[1].focus()",
        });
        await client.send("Runtime.evaluate", {
            expression: "globalThis.__webmcpLayoutChecksComplete?.()",
        });

        const result = await resultPromise;
        assert.equal(
            result.passed,
            true,
            result.error ?? "Browser test failed.",
        );
        assert.equal(result.registered.length, 8);
        assert.equal(new Set(result.registered).size, 8);
        assert.equal(result.runStatus, "passed");
        assert.equal(result.currentCheckStatus, "passed");
        assert.equal(result.readinessStatus, "ready");
        assert.equal(result.sceneTransitionConfirmed, true);
        assert.equal(result.canceledUnloadConfirmed, true);
        assert.equal(result.focusConfirmed, true);
        assert.equal(result.movementConfirmed, true);
        assert.equal(result.dimensionsConfirmed, true);
        assert.equal(result.saveReopenConfirmed, true);
        assert.equal(result.readOnlyAssetsConfirmed, true);
        assert.equal(result.hiddenEditorConfirmed, true);
        assert.equal(result.failedSaveRetryConfirmed, true);
        assert.equal(result.firstSaveActivityConfirmed, true);
        assert.equal(result.sharedConsoleConfirmed, true);
        assert.equal(result.legacyProjectsConfirmed, true);
        assert.equal(result.pendingNavigationConfirmed, true);
        assert.equal(result.explicitDraftSaveConfirmed, true);
        assert.equal(result.deleteQueueConfirmed, true);
        assert.equal(result.restoredBrowserConfirmed, true);
        assert.equal(result.quickSwitchConfirmed, true);
        assert.equal(result.toolbarShortcutsConfirmed, true);
        assert.equal(result.homeNavigationConfirmed, true);
        assert.equal(result.quietSaveStatusConfirmed, true);
        assert.equal(result.saveErrorRetryConfirmed, true);
        assert.equal(result.featureTipsConfirmed, true);
        assert.equal(result.assetPathsConfirmed, true);
        assert.equal(
            result.gameStartups.length,
            result.gameStarterCount + result.regressionStarterCount,
        );
        for (const startup of result.gameStartups) {
            assert.equal(startup.ready, true, startup.key);
            assert.equal(startup.errorCount, 0, startup.key);
        }
        for (
            const key of [
                "eatlove",
                "shooter",
                "ghosthunting",
                "advancedbinding",
                "loadingScreen",
            ]
        ) {
            assert(result.gameStartups.some(startup => startup.key === key));
        }
        assert.equal(result.pendingAssetsStatus, "incomplete");
        assert.equal(result.inspectionErrorStatus, "failed");
        assert.equal(result.diagnosticErrorStatus, "failed");
        assert.equal(result.unavailableInspectionStatus, "incomplete");
        assert.equal(result.declinedCommitted, false);
        assert.equal(typeof result.opened, "string");
        assert.equal(result.catalogAudit.length, result.catalogExpectedCount);
        const catalogFailures = result.catalogAudit.filter(sample =>
            sample.startupError || sample.stopped
            || sample.readiness?.status !== "ready" || sample.errors.length > 0
            || sample.copiedPrompts !== 4
        );
        assert.deepEqual(
            catalogFailures,
            [],
            "Starting-point catalog regressions",
        );

        // A fresh portrait visit uses the real application entry point and an
        // old starter link, keeping dimensions but not the active Code tab.
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await client.send("Page.navigate", {
            url: new URL("/?example=webmcpAgent", appUrl).href,
        });
        const freshDeadline = Date.now() + 30_000;
        let fresh;
        while (Date.now() < freshDeadline) {
            const response = await client.send("Runtime.evaluate", {
                expression: `(async () => {
                    if (!document.querySelector('#game-view') || !document.querySelector('.monaco-editor')) return null;
                    const { useEditor } = await import('/src/hooks/useEditor.ts');
                    if (useEditor.getState().previewReadiness?.status !== 'ready') return null;
                    const { useProject } = await import('/src/features/Projects/stores/useProject.ts');
                    const state = useProject.getState();
                    return { tab: document.querySelector('[aria-label="Workspace panels"] [aria-selected="true"]')?.textContent.trim(), saveStatus: state.saveStatus, projectId: state.projectKey, starter: state.project.sourceDemoKey };
                })()`,
                awaitPromise: true,
                returnByValue: true,
            });
            fresh = response.result?.value;
            if (fresh) break;
            await delay(100);
        }
        assert.deepEqual(
            fresh,
            {
                tab: "Assets",
                saveStatus: "draft",
                projectId: null,
                starter: "webmcpAgent",
            },
            "Fresh portrait visits must play the starter with Assets active and without autosaving.",
        );
        if (screenshotDirectory) {
            const portrait = await client.send("Page.captureScreenshot", {
                format: "png",
            });
            await writeFile(
                join(screenshotDirectory, "portrait-starter.png"),
                Buffer.from(portrait.data, "base64"),
            );
        }
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 1042,
            height: 936,
            deviceScaleFactor: 1,
            mobile: false,
        });
        // Let React apply its media-query change before measuring the desktop
        // column; a loaded game can keep the frame busy beyond a fixed delay.
        const resizeDeadline = Date.now() + 5_000;
        let restoredWidth;
        while (Date.now() < resizeDeadline) {
            const response = await client.send("Runtime.evaluate", {
                expression: `(() => {
                    const panel = document.querySelector('[aria-label="Workspace panels"]');
                    if (getComputedStyle(panel.closest('main')).display !== 'grid') return null;
                    return panel.getBoundingClientRect().width;
                })()`,
                returnByValue: true,
            });
            restoredWidth = response.result?.value;
            if (restoredWidth !== null && restoredWidth !== undefined) break;
            await delay(50);
        }
        assert.equal(
            restoredWidth,
            360,
            "A fresh visit forgot the resized panel width.",
        );

        for (const [width, height] of [[390, 844], [1042, 936]]) {
            await client.send("Emulation.setDeviceMetricsOverride", {
                width,
                height,
                deviceScaleFactor: 1,
                mobile: false,
            });
            await client.send("Runtime.evaluate", {
                expression:
                    `Array.from(document.querySelectorAll('[role="toolbar"] button')).find(button => button.textContent.trim() === 'Browse all').click()`,
            });
            await delay(150);
            const modal = await client.send("Runtime.evaluate", {
                expression: `(() => {
                    const dialog = document.querySelector('#examples-browser');
                    const box = dialog.querySelector('.modal-box').getBoundingClientRect();
                    const panel = dialog.querySelector('[role="tabpanel"][data-state="active"]').getBoundingClientRect();
                    const footer = dialog.querySelector('footer').getBoundingClientRect();
                    return { open: dialog.open, left: box.left, right: box.right, top: box.top, bottom: box.bottom, contentHeight: panel.height, footerBottom: footer.bottom, selected: dialog.querySelector('[role="tab"][aria-selected="true"]').textContent.trim() };
                })()`,
                returnByValue: true,
            });
            const box = modal.result.value;
            assert(
                box.open && box.left >= 0 && box.right <= width && box.top >= 0
                    && box.bottom <= height,
                `Game browser doesn't fit at ${width}: ${JSON.stringify(box)}`,
            );
            assert(
                box.contentHeight >= 180 && box.footerBottom <= height,
                `The browser must leave room for samples and New project at ${width}: ${
                    JSON.stringify(box)
                }`,
            );
            assert.match(box.selected, /Game starting points/);
            if (screenshotDirectory) {
                const screenshot = await client.send("Page.captureScreenshot", {
                    format: "png",
                });
                await writeFile(
                    join(screenshotDirectory, `browser-${width}.png`),
                    Buffer.from(screenshot.data, "base64"),
                );
            }
            await client.send("Runtime.evaluate", {
                expression:
                    `document.querySelector('#examples-browser [role="tab"][aria-selected="true"]').focus()`,
            });
            for (const type of ["keyDown", "keyUp"]) {
                await client.send("Input.dispatchKeyEvent", {
                    type,
                    key: "ArrowLeft",
                    code: "ArrowLeft",
                    windowsVirtualKeyCode: 37,
                    nativeVirtualKeyCode: 37,
                });
            }
            await delay(100);
            const destination = await client.send("Runtime.evaluate", {
                expression:
                    `document.querySelector('#examples-browser [role="tab"][aria-selected="true"]').textContent.trim()`,
                returnByValue: true,
            });
            assert.match(destination.result.value, /My games/);
            await client.send("Runtime.evaluate", {
                expression:
                    `document.querySelector('#examples-browser [aria-label="Close game browser"]').click()`,
            });
        }
        result.freshPageDefaultsConfirmed = true;
        result.keyboardResizeConfirmed = true;
        result.browserResponsiveConfirmed = true;

        await client.send("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
        const reducedMotion = await client.send("Runtime.evaluate", {
            expression: `(async () => {
                const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                Array.from(document.querySelectorAll('[role="toolbar"] button')).find(button => button.textContent.trim() === 'Browse all').click();
                await paint();
                const dialog = document.querySelector('#examples-browser');
                const checks = [];
                for (const label of ['My games', 'Game starting points']) {
                    const tab = Array.from(dialog.querySelectorAll('[role="tab"]')).find(tab => tab.textContent.trim().startsWith(label));
                    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await paint();
                    const header = dialog.querySelector('header');
                    const panel = dialog.querySelector('[role="tabpanel"][data-state="active"]');
                    checks.push({ label, selected: tab.getAttribute('aria-selected') === 'true', height: header.parentElement.getBoundingClientRect().height, contentHeight: header.getBoundingClientRect().height, animations: header.parentElement.getAnimations().length + panel.getAnimations().length });
                }
                const toggle = dialog.querySelector('[aria-controls="starting-points-games-items"]');
                toggle.click();
                await paint();
                const content = document.getElementById(toggle.getAttribute('aria-controls'));
                const collapsed = { height: content.getBoundingClientRect().height, inert: content.inert, animations: content.getAnimations().length };
                toggle.click();
                await paint();
                const expandedHeight = content.getBoundingClientRect().height;
                dialog.querySelector('[aria-label="Close game browser"]').click();
                return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, checks, collapsed, expandedHeight };
            })()`,
            awaitPromise: true,
            returnByValue: true,
        });
        const reduced = reducedMotion.result?.value;
        assert(
            reduced?.reduced && reduced.checks.every(check =>
                check.selected && check.animations === 0
                && Math.abs(check.height - check.contentHeight) < 1
            ) && reduced.collapsed.height === 0 && reduced.collapsed.inert
                && reduced.collapsed.animations === 0
                && reduced.expandedHeight > 0,
            `Reduced motion must settle without sliding: ${
                JSON.stringify(reduced)
            }`,
        );
        result.browserReducedMotionConfirmed = true;
        await client.send("Emulation.setEmulatedMedia", {
            features: [{
                name: "prefers-reduced-motion",
                value: "no-preference",
            }],
        });

        console.log("WebMCP browser integration passed:");
        console.log(JSON.stringify(result, null, 2));
        console.log(JSON.stringify({ layoutChecks }, null, 2));
        if (screenshotDirectory) {
            console.log(`UI screenshots: ${screenshotDirectory}`);
        }
    } catch (error) {
        console.error(error instanceof Error ? error.stack : error);
        for (const [name, output] of logs) {
            if (output.length > 0) {
                console.error(
                    `\n--- ${name} output ---\n${output.slice(-12_000)}`,
                );
            }
        }
        process.exitCode = 1;
    } finally {
        client?.close();
        await Promise.all([...children].map(stopProcess));
        if (profileDirectory) {
            await rm(profileDirectory, { recursive: true, force: true });
        }
    }
}

async function verifyPublicAssetRoutes(baseUrl) {
    // Compare bytes as well as status: Vite's HTML fallback can return 200 for
    // a missing image. Runtime-computed URLs cannot use compile-time embedding.
    for (
        const path of [
            "sprites/apple.png",
            "sprites/bean.png",
            "sprites/particle_hexagon_filled.png",
            "sprites/dungeon.json",
            "sounds/wooosh.mp3",
            "fonts/happy_28x36.png",
            "crew/bag.png",
            "crew/bag-o.png",
            "crew/bean_voice.wav",
            "crew/mark_voice.wav",
            "crew/burp.mp3",
            "crew/kaboom2000.mp3",
            "crew/happy.png",
        ]
    ) {
        const url = new URL(`/${path}`, baseUrl);
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10_000),
        });
        assert(response.ok, `Asset request failed: ${url}`);
        if (/\.(wav|mp3)$/.test(path)) {
            assert.match(
                response.headers.get("content-type") ?? "",
                /^audio\//,
                `Sound URL did not serve an audio MIME type: ${url}`,
            );
        }
        const actual = Buffer.from(await response.arrayBuffer());
        const expected = await readFile(join(
            root,
            path.startsWith("crew/") ? "public" : "kaplay/examples",
            path,
        ));
        assert(
            actual.equals(expected),
            `Asset URL did not serve its file: ${url}`,
        );
    }
}

async function loadBrowserFixtures() {
    const esbuild = await readFile(
        resolve(root, "node_modules", "esbuild-wasm", "esbuild.wasm"),
    );
    const kaplay = await readFirstExisting([
        resolve(root, "node_modules", "kaplay", "dist", "kaplay.mjs"),
        resolve(root, "node_modules", "kaplay", "dist", "kaboom.mjs"),
    ]);
    // Match the current engine to the same checkout that supplies editor types.
    // The legacy fixture predates loadHappy(), which the existing scaffold uses.
    const currentKaplay = await readFile(
        resolve(root, "kaplay", "dist", "kaplay.mjs"),
    );
    return {
        esbuild: esbuild.toString("base64"),
        kaplay: kaplay.toString("base64"),
        currentKaplay: currentKaplay.toString("base64"),
    };
}

async function readFirstExisting(paths) {
    let lastError;
    for (const path of paths) {
        try {
            return await readFile(path);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

async function installFixtureInterception(cdp, fixtures) {
    cdp.on("Fetch.requestPaused", async event => {
        const url = event.request.url;
        if (url.includes("webmcp-pending-asset.invalid")) {
            // Intentionally leave this request pending so onLoad cannot fire.
            return;
        }
        if (url.includes("esbuild.wasm")) {
            await cdp.send("Fetch.fulfillRequest", {
                requestId: event.requestId,
                responseCode: 200,
                responseHeaders: fixtureHeaders("application/wasm"),
                body: fixtures.esbuild,
            });
            return;
        }
        if (
            url.includes("/kaplay@")
            || url.includes("kaplay.master.mjs")
        ) {
            await cdp.send("Fetch.fulfillRequest", {
                requestId: event.requestId,
                responseCode: 200,
                responseHeaders: fixtureHeaders(
                    "text/javascript; charset=utf-8",
                ),
                body: url.includes("kaplay.master.mjs")
                        || url.includes("/kaplay@4000.")
                    ? fixtures.currentKaplay
                    : fixtures.kaplay,
            });
            return;
        }
        await cdp.send("Fetch.continueRequest", {
            requestId: event.requestId,
        });
    });
    await cdp.send("Fetch.enable", {
        patterns: [
            {
                urlPattern: "*webmcp-pending-asset.invalid*",
                requestStage: "Request",
            },
            { urlPattern: "*esbuild.wasm*", requestStage: "Request" },
            { urlPattern: "*kaplay*.mjs*", requestStage: "Request" },
        ],
    });
}

function fixtureHeaders(contentType) {
    return [
        { name: "Content-Type", value: contentType },
        { name: "Access-Control-Allow-Origin", value: "*" },
        { name: "Cache-Control", value: "no-store" },
    ];
}

function viteExecutable() {
    return resolve(
        root,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "vite.cmd" : "vite",
    );
}

function chromeExecutable() {
    const candidates = [
        process.env.CHROME_PATH,
        process.env.CHROME_BIN,
        ...(process.platform === "darwin"
            ? [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Chromium.app/Contents/MacOS/Chromium",
            ]
            : []),
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (candidate.includes("/") || candidate.includes("\\")) {
            const check = spawnSync(candidate, ["--version"], {
                encoding: "utf8",
            });
            if (check.status === 0) return candidate;
            continue;
        }
        const lookup = spawnSync(
            process.platform === "win32" ? "where" : "which",
            [candidate],
            { encoding: "utf8" },
        );
        if (lookup.status === 0) {
            return lookup.stdout.trim().split(/\r?\n/)[0];
        }
    }
    throw new Error(
        "A Chrome or Chromium executable is required for the WebMCP browser test.",
    );
}

function startProcess(command, args, options, name) {
    const child = spawn(command, args, {
        ...options,
        env: { ...process.env, ...options.env },
        stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(child);
    let output = "";
    const collect = chunk => {
        output = (output + chunk.toString()).slice(-24_000);
        logs.set(name, output);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", error => {
        child.spawnError = error;
        collect(error.stack ?? String(error));
    });
    child.once("exit", () => children.delete(child));
    return child;
}

async function stopProcess(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolveExit => {
        const force = setTimeout(() => child.kill("SIGKILL"), 2_000);
        child.once("exit", () => {
            clearTimeout(force);
            resolveExit();
        });
        child.kill("SIGTERM");
    });
}

async function freePort() {
    return await new Promise((resolvePort, reject) => {
        const server = createServer();
        server.unref();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address
                ? address.port
                : null;
            server.close(error => {
                if (error) reject(error);
                else if (port === null) {
                    reject(new Error("Could not allocate a port."));
                } else resolvePort(port);
            });
        });
    });
}

async function waitForUrl(url, child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        if (child.spawnError) throw child.spawnError;
        if (child.exitCode !== null) {
            throw new Error(
                `Process exited before serving ${url}: ${child.exitCode}`,
            );
        }
        try {
            const response = await fetch(url);
            if (response.ok) return;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await delay(100);
    }
    throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function waitForBrowserTarget(port, child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        if (child.spawnError) throw child.spawnError;
        if (child.exitCode !== null) {
            throw new Error(
                `Browser exited before DevTools was ready: ${child.exitCode}`,
            );
        }
        try {
            const response = await fetch(
                `http://127.0.0.1:${port}/json/list`,
            );
            if (response.ok) {
                const targets = await response.json();
                const target = targets.find(item =>
                    item.type === "page" && item.webSocketDebuggerUrl
                );
                if (target) return target;
            }
        } catch (error) {
            lastError = error;
        }
        await delay(100);
    }
    throw new Error(
        `Timed out waiting for Chrome DevTools: ${String(lastError)}`,
    );
}

async function waitForBrowserPhase(cdp, phase, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        if (cdp.eventError) throw cdp.eventError;
        try {
            const evaluation = await cdp.send("Runtime.evaluate", {
                expression:
                    "document.documentElement.dataset.webmcpPhase ?? null",
                returnByValue: true,
            });
            if (evaluation.result?.value === phase) return;
        } catch (error) {
            lastError = error;
        }
        await delay(100);
    }
    throw new Error(
        `Timed out waiting for browser phase ${phase}: ${String(lastError)}`,
    );
}

async function waitForBrowserResult(cdp, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        if (cdp.eventError) throw cdp.eventError;
        try {
            const evaluation = await cdp.send("Runtime.evaluate", {
                expression: "globalThis.__webmcpBrowserTestResult ?? null",
                returnByValue: true,
            });
            if (evaluation.exceptionDetails) {
                lastError = new Error(
                    evaluation.exceptionDetails.exception?.description
                        ?? evaluation.exceptionDetails.text,
                );
            } else if (evaluation.result?.value) {
                return evaluation.result.value;
            }
        } catch (error) {
            lastError = error;
        }
        await delay(100);
    }
    throw new Error(
        `Timed out waiting for browser result: ${String(lastError)}`,
    );
}

function delay(milliseconds) {
    return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

await main();
