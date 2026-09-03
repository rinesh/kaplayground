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
                // Decode and play media without depending on the host's audio device.
                "--disable-audio-output",
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
            auditCatalog ? 600_000 : 180_000,
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
        const pageValue = async expression => {
            const response = await client.send("Runtime.evaluate", {
                expression,
                returnByValue: true,
                awaitPromise: true,
            });
            assert(
                !response.exceptionDetails,
                JSON.stringify(response.exceptionDetails),
            );
            return response.result.value;
        };
        const clickControl = async selector => {
            const point = await pageValue(`(() => {
                const r = document.querySelector(${
                JSON.stringify(selector)
            }).getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            })()`);
            for (const type of ["mousePressed", "mouseReleased"]) {
                await client.send("Input.dispatchMouseEvent", {
                    type,
                    ...point,
                    button: "left",
                    clickCount: 1,
                });
            }
            await delay(100);
        };
        const readCanvasDisplay = async (selector = "#game-view") => {
            const { frameTree } = await client.send("Page.getFrameTree");
            const findSandbox = tree =>
                (selector === "#viewport-export"
                        ? tree.frame.name === "viewport-export"
                        : tree.frame.url.startsWith(sandboxUrl))
                    ? tree.frame
                    : (tree.childFrames ?? []).map(findSandbox).find(Boolean);
            const frame = findSandbox(frameTree);
            assert(frame, "The running sandbox frame is missing.");
            const { executionContextId } = await client.send(
                "Page.createIsolatedWorld",
                {
                    frameId: frame.id,
                    worldName: "webmcp-canvas-size-check",
                },
            );
            const response = await client.send("Runtime.evaluate", {
                contextId: executionContextId,
                expression: `(() => {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) return null;
                    const r = canvas.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height, bufferWidth: canvas.width, bufferHeight: canvas.height,
                        inputFrame: Number(canvas.dataset.webmcpInputFrame ?? -1), eventFrame: Number(canvas.dataset.webmcpEventFrame ?? -1) };
                })()`,
                returnByValue: true,
            });
            return response.result.value;
        };
        const canvasResizeChecks = [];
        let burpLogicalSize;
        const assertCanvasFollowsGame = async label => {
            const deadline = Date.now() + 5_000;
            let state;
            while (Date.now() < deadline) {
                state = await pageValue(`(async () => {
                    const inspection = await globalThis.__webmcpInspectLayoutPreview({ tag: 'instruction', limit: 1 });
                    const game = document.querySelector('#game-view').getBoundingClientRect();
                    const columns = document.querySelector('#workspace-columns');
                    const panes = [...columns.querySelector(':scope > .split-view-container').children];
                    const columnsSettled = innerWidth < 900 || Math.abs(panes.reduce((sum, pane) => sum + pane.getBoundingClientRect().width, 0) - columns.getBoundingClientRect().width) <= 2;
                    return {
                        viewport: inspection.viewport,
                        instruction: inspection.objects[0],
                        game: { width: game.width, height: game.height },
                        columnsSettled,
                    };
                })()`);
                state.canvas = await readCanvasDisplay();
                burpLogicalSize ??= state.viewport;
                if (
                    state.viewport && state.canvas && state.columnsSettled
                    && Math.abs(state.canvas.width - state.game.width) <= 2
                    && Math.abs(state.canvas.height - state.game.height) <= 2
                    && state.viewport.width === burpLogicalSize.width
                    && state.viewport.height === burpLogicalSize.height
                    && state.instruction
                    && Math.abs(
                            state.instruction.position.x
                                - state.viewport.width / 2,
                        ) <= 1
                    && Math.abs(
                            state.instruction.position.y
                                - state.viewport.height / 2,
                        ) <= 1
                    && state.instruction.renderedBounds.width
                                * state.instruction.scale.x
                        <= state.viewport.width - 30
                ) {
                    canvasResizeChecks.push({ label, ...state });
                    return;
                }
                await delay(50);
            }
            assert.fail(
                `Burp's rendered viewport didn't follow ${label}: ${
                    JSON.stringify(state)
                }`,
            );
        };
        const panelProportions = () =>
            pageValue(`(() => {
            const rect = selector => document.querySelector(selector).getBoundingClientRect();
            const columns = rect('#workspace-columns');
            return {
                game: rect('#workspace-columns-first').width / columns.width,
                tipsHeight: rect('#workspace-preview-second').height,
            };
        })()`);
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 1042,
            height: 936,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await delay(250);
        await assertCanvasFollowsGame("the initial desktop layout");
        const originalProportions = await panelProportions();
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 1440,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await delay(250);
        await assertCanvasFollowsGame("a wider, taller window");
        const widerProportions = await panelProportions();
        assert(
            Math.abs(originalProportions.game - widerProportions.game) < 0.01,
            "The game column didn't resize proportionally with the window.",
        );
        assert.equal(originalProportions.tipsHeight, 240);
        assert.equal(widerProportions.tipsHeight, 240);
        assert.equal(
            await pageValue(
                "document.querySelector('#workspace-preview [role=separator]')",
            ),
            null,
            "Ideas should only open and close; they must not expose a resize divider.",
        );
        const assertExpandedGame = async () => {
            const deadline = Date.now() + 5_000;
            let state;
            while (Date.now() < deadline) {
                state = await pageValue(`(() => {
                const r = document.querySelector('#game-view').getBoundingClientRect();
                const area = document.querySelector('main.workspace-main').getBoundingClientRect();
                return {
                    game: { width: r.width, height: r.height, top: r.top, bottom: r.bottom },
                    area: { width: area.width, height: area.height, top: area.top, bottom: area.bottom },
                    viewportHeight: innerHeight,
                    toolsInert: document.querySelector('#workspace-columns-second').inert,
                    tipsInert: document.querySelector('#workspace-preview-second').inert,
                    restore: !!document.querySelector('button[aria-label="Restore panels"]'),
                };
                })()`);
                if (
                    Math.abs(state.game.width - state.area.width) <= 2
                    && Math.abs(state.game.height - state.area.height) <= 2
                    && Math.abs(state.game.top - state.area.top) <= 1
                    && Math.abs(state.game.bottom - state.viewportHeight) <= 2
                    && state.toolsInert && state.tipsInert && state.restore
                ) {
                    await assertCanvasFollowsGame("the expanded game");
                    return;
                }
                await delay(50);
            }
            assert.fail(
                `The expanded game doesn't fill the workspace: ${
                    JSON.stringify(state)
                }`,
            );
        };
        const layoutChecks = [];
        const tipsContentChecks = [];
        for (
            const [width, height] of [[1042, 936], [1440, 1000], [390, 844], [
                390,
                700,
            ], [
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
            await assertCanvasFollowsGame(
                `the ${width} by ${height} workspace`,
            );
            const evaluated = await client.send("Runtime.evaluate", {
                expression: `(() => {
                    const rect = selector => {
                        const box = document.querySelector(selector)?.getBoundingClientRect();
                        return box && { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
                    };
                    return { preview: rect('#game-view'), coach: rect('aside[aria-label="Codex tips"]'), coachPane: rect('#workspace-preview-second'), toolbar: rect('[role="toolbar"]'), panel: rect('[aria-label="Workspace panels"]'), output: rect('#console-wrapper'), width: innerWidth, scrollWidth: document.documentElement.scrollWidth, editors: document.querySelectorAll('.monaco-editor').length };
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
                    && Math.abs(layout.coachPane.width - layout.preview.width)
                        <= 2,
                `The tips must stay beneath the preview at ${width}: ${
                    JSON.stringify(layout)
                }`,
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
                    Math.abs(layout.coachPane.bottom - height) <= 2,
                    `The game and tips didn't follow the ${height}px viewport height: ${
                        JSON.stringify(layout)
                    }`,
                );
                assert(
                    layout.panel.y >= layout.coachPane.bottom - 2,
                    "Portrait panels must stack after the preview and tips.",
                );
                assert(
                    layout.output.y > layout.panel.bottom,
                    "Portrait logs must follow the asset/code panel.",
                );
            }
            const stepHeights = [];
            const summaryOffsets = [];
            for (let step = 1; step <= 5; step++) {
                await clickControl(
                    `aside[aria-label="Codex tips"] button[aria-label^="Go to idea ${step}:"]`,
                );
                const tip = await pageValue(`(() => {
                    const coach = document.querySelector('aside[aria-label="Codex tips"]');
                    const pane = document.querySelector('#workspace-preview-second').getBoundingClientRect();
                    const card = coach.querySelector('section').getBoundingClientRect();
                    const footer = coach.querySelector('footer').getBoundingClientRect();
                    const game = document.querySelector('#game-view').getBoundingClientRect();
                    const body = coach.querySelector('.codex-idea-content');
                    const summary = body.firstElementChild.getBoundingClientRect();
                    return { paneHeight: pane.height, cardHeight: card.height, gameHeight: game.height,
                        summaryOffset: summary.top - body.getBoundingClientRect().top,
                        scrollTop: body.scrollTop,
                        footerInside: footer.top >= pane.top && footer.bottom <= pane.bottom,
                        scrollsInside: getComputedStyle(coach.querySelector('section > div')).overflowY === 'auto' };
                })()`);
                assert(
                    Math.abs(tip.paneHeight - layout.coachPane.height) <= 1
                        && Math.abs(tip.cardHeight - tip.paneHeight) <= 2
                        && Math.abs(tip.gameHeight - layout.preview.height) <= 1
                        && Math.abs(tip.summaryOffset) <= 1
                        && tip.scrollTop === 0
                        && tip.footerInside && tip.scrollsInside,
                    `Idea ${step} changed the game or card height at ${width}px: ${
                        JSON.stringify(tip)
                    }`,
                );
                stepHeights.push(tip.cardHeight);
                summaryOffsets.push(tip.summaryOffset);
                await pageValue(
                    "document.querySelector('aside[aria-label=\"Codex tips\"] .codex-idea-content').scrollTop = 10000",
                );
            }
            tipsContentChecks.push({
                width,
                height,
                stepHeights,
                summaryOffsets,
            });
            await clickControl("button[aria-label=\"Minimize Codex ideas\"]");
            await assertCanvasFollowsGame("minimizing the ideas to their dock");
            const minimized = await pageValue(`(() => {
                const pane = document.querySelector('#workspace-preview-second');
                const show = pane.querySelector('[aria-label="Show Codex ideas"]');
                return { height: pane.getBoundingClientRect().height, inert: pane.inert,
                    contentHidden: document.querySelector('#codex-coach-content').hidden,
                    showFocused: document.activeElement === show, showVisible: show?.getClientRects().length > 0 };
            })()`);
            assert(
                minimized.height === 40 && !minimized.inert
                    && minimized.contentHidden
                    && minimized.showFocused && minimized.showVisible,
                `Minimize didn't leave an accessible ideas dock: ${
                    JSON.stringify(minimized)
                }`,
            );
            await clickControl("button[aria-label=\"Show Codex ideas\"]");
            await assertCanvasFollowsGame(
                "restoring the ideas from their dock",
            );
            const restoredTips = await pageValue(`(() => {
                const pane = document.querySelector('#workspace-preview-second');
                return { height: pane.getBoundingClientRect().height,
                    focused: document.activeElement === pane.querySelector('[aria-label="Minimize Codex ideas"]'),
                    step: pane.querySelector('[aria-current="step"]')?.getAttribute('aria-label') };
            })()`);
            assert(
                Math.abs(restoredTips.height - layout.coachPane.height) <= 2
                    && restoredTips.focused
                    && restoredTips.step?.startsWith("Go to idea 5:"),
                `Restoring ideas lost the height, focus, or selected step: ${
                    JSON.stringify(restoredTips)
                }`,
            );
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
                            "document.querySelector('main.workspace-main').scrollTop = 450",
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
                            "document.querySelector('main.workspace-main').scrollTop = 0",
                    });
                }
            }
            await clickControl("button[aria-label=\"Expand game\"]");
            await assertExpandedGame();
            await clickControl("button[aria-label=\"Restore panels\"]");
            layoutChecks.push({ width, height, passed: true });
        }
        const ideaMotion = await pageValue(`(async () => {
            const coach = document.querySelector('aside[aria-label="Codex tips"]');
            const control = coach.querySelector('button[aria-label^="Go to idea 2:"]');
            control.focus();
            control.click();
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const body = coach.querySelector('.codex-idea-content');
            const animation = body.getAnimations().find(item => item.animationName === 'codex-idea-enter');
            if (!animation) return { available: false };
            animation.pause();
            const duration = animation.effect.getTiming().duration;
            const frames = [0, duration / 2, duration].map(time => {
                animation.currentTime = time;
                return { opacity: Number(getComputedStyle(body).opacity), top: body.firstElementChild.getBoundingClientRect().top };
            });
            animation.finish();
            return { available: true, duration, frames, focusRetained: document.activeElement === control };
        })()`);
        assert(
            ideaMotion.available && ideaMotion.duration === 180
                && ideaMotion.focusRetained,
        );
        assert(
            ideaMotion.frames[0].opacity === 0
                && ideaMotion.frames[1].opacity > 0
                && ideaMotion.frames[1].opacity < 1
                && ideaMotion.frames[2].opacity === 1,
        );
        assert(
            ideaMotion.frames.every(frame =>
                frame.top === ideaMotion.frames[0].top
            ),
            "Idea transitions moved the text vertically.",
        );
        await client.send("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
        await clickControl(
            "aside[aria-label=\"Codex tips\"] button[aria-label^=\"Go to idea 3:\"]",
        );
        assert.equal(
            await pageValue(
                "document.querySelector('aside[aria-label=\"Codex tips\"] .codex-idea-content').getAnimations().length",
            ),
            0,
            "Reduced motion must disable idea animation.",
        );
        await client.send("Emulation.setEmulatedMedia", {
            features: [{
                name: "prefers-reduced-motion",
                value: "no-preference",
            }],
        });
        await pageValue(`(async () => {
            const coach = document.querySelector('aside[aria-label="Codex tips"]');
            for (const step of [4, 2, 5]) coach.querySelector('button[aria-label^="Go to idea ' + step + ':"]').click();
            await new Promise(resolve => requestAnimationFrame(resolve));
        })()`);
        assert.equal(
            await pageValue(
                "document.querySelector('aside[aria-label=\"Codex tips\"] [aria-current=step]').getAttribute('aria-label')",
            ),
            "Go to idea 5: Describe the version you want",
            "Rapid navigation settled on the wrong idea.",
        );
        const beforeKeyboardWidth = await pageValue(
            "document.querySelector('[aria-label=\"Workspace panels\"]').getBoundingClientRect().width",
        );
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
        const savedToolsWidth = resized.result.value;
        assert(
            Math.abs(savedToolsWidth - beforeKeyboardWidth - 20) <= 1,
            "The panel separator didn't resize by 20px from the keyboard.",
        );
        const dragDivider = async (selector, edge) => {
            const points = await pageValue(`(() => {
                const handle = document.querySelector(${
                JSON.stringify(selector)
            }).getBoundingClientRect();
                const area = document.querySelector('main.workspace-main').getBoundingClientRect();
                const start = { x: Math.min(innerWidth - 2, Math.max(2, handle.x + handle.width / 2)), y: Math.min(innerHeight - 2, Math.max(area.top + 2, handle.y + handle.height / 2)) };
                const target = ${JSON.stringify(edge)};
                const end = typeof target === 'object'
                    ? { x: start.x + target.x, y: start.y + target.y }
                    : target === 'bottom' ? { x: start.x, y: innerHeight - 2 }
                    : { x: target === 'right' ? innerWidth - 2 : 2, y: start.y };
                return { start, end };
            })()`);
            await client.send("Input.dispatchMouseEvent", {
                type: "mousePressed",
                ...points.start,
                button: "left",
                buttons: 1,
                clickCount: 1,
            });
            for (let step = 1; step <= 10; step++) {
                await client.send("Input.dispatchMouseEvent", {
                    type: "mouseMoved",
                    x: points.start.x
                        + (points.end.x - points.start.x) * step / 10,
                    y: points.start.y
                        + (points.end.y - points.start.y) * step / 10,
                    buttons: 1,
                });
            }
            await client.send("Input.dispatchMouseEvent", {
                type: "mouseReleased",
                ...points.end,
                button: "left",
                clickCount: 1,
            });
            await delay(100);
        };
        const gameRect = () =>
            pageValue(
                "document.querySelector('#game-view').getBoundingClientRect().toJSON()",
            );
        const beforeDrag = await gameRect();
        await dragDivider("[aria-label=\"Resize workspace panels\"]", {
            x: 60,
            y: 0,
        });
        await assertCanvasFollowsGame("a horizontal divider drag");
        const afterHorizontalDrag = await gameRect();
        assert(
            Math.abs(afterHorizontalDrag.width - beforeDrag.width - 60) <= 2
                && Math.abs(afterHorizontalDrag.height - beforeDrag.height)
                    <= 2,
            "A horizontal drag must change the game width without changing its height.",
        );
        await dragDivider("[aria-label=\"Resize workspace panels\"]", {
            x: -60,
            y: 0,
        });
        await dragDivider("[aria-label=\"Resize workspace panels\"]", "right");
        assert.equal(
            await pageValue(
                "document.querySelector('#workspace-columns-second').inert",
            ),
            true,
            "Dragging to the right didn't snap the tools closed.",
        );
        assert.equal(
            await pageValue(
                "document.querySelector('#workspace-preview-second').getBoundingClientRect().height",
            ),
            240,
            "Changing the sidebar must not change the ideas height.",
        );
        await clickControl("button[aria-label=\"Restore panels\"]");
        assert.equal(
            await pageValue(
                "document.querySelector('[aria-label=\"Workspace panels\"]').getBoundingClientRect().width",
            ),
            savedToolsWidth,
            "Restoring panels lost the previous width.",
        );
        await dragDivider("[aria-label=\"Resize workspace panels\"]", "left");
        assert.equal(
            await pageValue(
                "document.querySelector('#workspace-columns-first').inert",
            ),
            false,
            "The tools sidebar must never snap the game closed.",
        );
        const cappedToolsWidth = await pageValue(
            "document.querySelector('[aria-label=\"Workspace panels\"]').getBoundingClientRect().width",
        );
        assert(
            cappedToolsWidth <= 1042 * 0.45 + 1 && cappedToolsWidth <= 560,
            "The tools sidebar exceeded its width limit.",
        );
        await assertCanvasFollowsGame("the widest allowed tools sidebar");
        await dragDivider("[aria-label=\"Resize workspace panels\"]", {
            x: cappedToolsWidth - savedToolsWidth,
            y: 0,
        });

        // Keyboard resizing follows the same sidebar limits as dragging.
        for (
            const [label, key, code, hiddenId, expectedHidden] of [
                [
                    "Resize workspace panels",
                    "Home",
                    36,
                    "workspace-columns-first",
                    false,
                ],
                [
                    "Resize workspace panels",
                    "End",
                    35,
                    "workspace-columns-second",
                    true,
                ],
            ]
        ) {
            await pageValue(
                `document.querySelector('[aria-label="${label}"]').focus()`,
            );
            for (const type of ["keyDown", "keyUp"]) {
                await client.send("Input.dispatchKeyEvent", {
                    type,
                    key,
                    code: key,
                    windowsVirtualKeyCode: code,
                    nativeVirtualKeyCode: code,
                });
            }
            await delay(100);
            assert.equal(
                await pageValue(`document.querySelector('#${hiddenId}').inert`),
                expectedHidden,
                `${label} did not honor its keyboard visibility limit.`,
            );
            if (key === "Home") {
                assert(
                    await pageValue(
                        "document.querySelector('[aria-label=\"Workspace panels\"]').getBoundingClientRect().width <= 1042 * 0.45 + 1",
                    ),
                    "Keyboard resizing exceeded the tools sidebar width limit.",
                );
            }
        }
        await clickControl("button[aria-label=\"Restore panels\"]");
        const keyboardToolsWidth = await pageValue(
            "document.querySelector('[aria-label=\"Workspace panels\"]').getBoundingClientRect().width",
        );
        await dragDivider("[aria-label=\"Resize workspace panels\"]", {
            x: keyboardToolsWidth - savedToolsWidth,
            y: 0,
        });
        await clickControl("button[aria-label=\"Expand game\"]");
        await assertExpandedGame();
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await delay(250);
        await assertExpandedGame();
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 1042,
            height: 936,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await delay(250);
        await assertExpandedGame();
        await clickControl("button[aria-label=\"Restore panels\"]");
        const flappyResizeChecks = [];
        await pageValue("globalThis.__webmcpOpenLayoutSample('flappy')");
        const flappyInitial = await pageValue(
            "globalThis.__webmcpInspectLayoutPreview()",
        );
        const flappyRun = flappyInitial.runId;
        const assertFlappyAligned = async label => {
            let state;
            const deadline = Date.now() + 5_000;
            while (Date.now() < deadline) {
                state = await pageValue(`(async () => {
                    const player = await globalThis.__webmcpInspectLayoutPreview({ tag: 'player', limit: 1 });
                    const score = await globalThis.__webmcpInspectLayoutPreview({ tag: 'score', limit: 1 });
                    const game = document.querySelector('#game-view').getBoundingClientRect();
                    return { runId: player.runId, scene: player.scene, viewport: player.viewport, player: player.objects[0], score: score.objects[0], game: { width: game.width, height: game.height } };
                })()`);
                state.canvas = await readCanvasDisplay();
                const { viewport, player, score, game } = state;
                const offset = viewport && Math.min(108, viewport.height * 0.2);
                if (
                    state.scene === "lose" && viewport && player && score
                    && state.canvas
                    && Math.abs(state.canvas.width - game.width) <= 2
                    && Math.abs(state.canvas.height - game.height) <= 2
                    && viewport.width === flappyInitial.viewport.width
                    && viewport.height === flappyInitial.viewport.height
                    && Math.abs(player.position.x - viewport.width / 2) <= 1
                    && Math.abs(score.position.x - viewport.width / 2) <= 1
                    && Math.abs(
                            player.position.y - (viewport.height / 2 - offset),
                        ) <= 1
                    && Math.abs(
                            score.position.y - (viewport.height / 2 + offset),
                        ) <= 1
                ) {
                    assert.equal(
                        state.runId,
                        flappyRun,
                        "Resizing restarted Flappy.",
                    );
                    flappyResizeChecks.push({ label, ...state });
                    return;
                }
                await delay(50);
            }
            assert.fail(
                `Flappy didn't align after ${label}: ${JSON.stringify(state)}`,
            );
        };
        await assertFlappyAligned("opening the result screen");
        await dragDivider("[aria-label=\"Resize workspace panels\"]", {
            x: 60,
            y: 0,
        });
        await assertFlappyAligned("widening the game panel");
        await dragDivider("[aria-label=\"Resize workspace panels\"]", {
            x: -60,
            y: 0,
        });
        await clickControl("button[aria-label=\"Minimize Codex ideas\"]");
        await assertFlappyAligned("closing the ideas");
        await clickControl("button[aria-label=\"Show Codex ideas\"]");
        await assertFlappyAligned("reopening the ideas");
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 390,
            height: 700,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await delay(250);
        await assertFlappyAligned("a narrow window");
        await clickControl("button[aria-label=\"Expand game\"]");
        await assertFlappyAligned("expanding the game");
        await clickControl("button[aria-label=\"Restore panels\"]");
        await client.send("Emulation.setDeviceMetricsOverride", {
            width: 1042,
            height: 936,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await delay(250);
        await assertFlappyAligned("returning to desktop");

        // Play until a pipe pair exists, then use KAPLAY's pause shortcut so
        // geometry checks don't depend on how long a resize takes to render.
        const readFlappyPlay = () =>
            pageValue(`(async () => {
            const [player, score, pipes] = await Promise.all([
                globalThis.__webmcpInspectLayoutPreview({ tag: 'player', limit: 1 }),
                globalThis.__webmcpInspectLayoutPreview({ tag: 'score', limit: 1 }),
                globalThis.__webmcpInspectLayoutPreview({ tag: 'pipe', limit: 10 }),
            ]);
            return { runId: player.runId, scene: player.scene, paused: player.paused, viewport: player.viewport, player: player.objects[0], score: score.objects[0], pipes: pipes.objects };
        })()`);
        const pressGameKey = async (key, code, keyCode) => {
            for (const type of ["keyDown", "keyUp"]) {
                await client.send("Input.dispatchKeyEvent", {
                    type,
                    key,
                    code,
                    windowsVirtualKeyCode: keyCode,
                    nativeVirtualKeyCode: keyCode,
                });
            }
        };
        await clickControl("#game-view");
        let playing;
        let previousY = 0;
        const playDeadline = Date.now() + 5_000;
        while (Date.now() < playDeadline) {
            playing = await readFlappyPlay();
            assert.equal(
                playing.scene,
                "game",
                "Flappy didn't stay playable before resizing.",
            );
            if (playing.pipes.length >= 2) {
                await pressGameKey("F8", "F8", 119);
                await delay(100);
                playing = await readFlappyPlay();
                break;
            }
            const y = playing.player.position.y;
            if (y > playing.viewport.height * 0.28 && y >= previousY) {
                await pressGameKey(" ", "Space", 32);
            }
            previousY = y;
            await delay(40);
        }
        assert(
            playing?.paused && playing.pipes.length === 2,
            `Couldn't pause a live Flappy pipe pair: ${
                JSON.stringify(playing)
            }`,
        );
        const flappyGameplayChecks = [];
        for (const [width, height] of [[1042, 600], [390, 700], [1042, 936]]) {
            await client.send("Emulation.setDeviceMetricsOverride", {
                width,
                height,
                deviceScaleFactor: 1,
                mobile: false,
            });
            await delay(250);
            const state = await readFlappyPlay();
            assert.equal(state.scene, "game");
            assert.equal(state.runId, flappyRun);
            assert(state.paused, "Resizing resumed the paused game.");
            assert.equal(state.player.id, playing.player.id);
            assert.equal(state.score.text, playing.score.text);
            assert.deepEqual(
                state.pipes.map(pipe => pipe.id),
                playing.pipes.map(pipe => pipe.id),
            );
            assert(
                Math.abs(state.player.position.x - state.viewport.width / 4)
                    <= 1,
            );
            assert(
                state.player.position.y >= 0
                    && state.player.position.y < state.viewport.height,
            );
            assert(
                Math.abs(state.score.position.x - state.viewport.width / 2)
                    <= 1,
            );
            assert(
                state.score.position.y > 0
                    && state.score.position.y < state.viewport.height,
            );
            const [top, bottom] = [...state.pipes].sort((a, b) =>
                a.position.y - b.position.y
            );
            assert.equal(top.position.y, 0);
            assert(
                top.renderedBounds.height > 0
                    && bottom.renderedBounds.height > 0,
            );
            const gap = bottom.position.y - top.renderedBounds.height;
            assert(
                gap > state.player.renderedBounds.height,
                "Resizing left no passable opening between Flappy's pipes.",
            );
            assert(
                Math.abs(
                    bottom.position.y + bottom.renderedBounds.height
                        - state.viewport.height,
                ) <= 1,
                "The bottom pipe no longer meets the game edge.",
            );
            assert(
                Math.abs(top.position.x - bottom.position.x) <= 1,
                "Resizing separated Flappy's pipe pair.",
            );
            flappyGameplayChecks.push({ window: { width, height }, ...state });
        }
        await pressGameKey("F8", "F8", 119);
        await pressGameKey(" ", "Space", 32);
        await delay(100);
        const resumedPlay = await readFlappyPlay();
        assert(
            !resumedPlay.paused && resumedPlay.scene === "game"
                && resumedPlay.player.id === playing.player.id,
            "Flappy didn't resume the same playable scene after resizing.",
        );
        await pageValue("globalThis.__webmcpOpenLayoutSample('burp')");
        const workspacePanelChecks = {
            windowResize: { originalProportions, widerProportions },
            canvasResizeChecks,
            tipsContentChecks,
            ideaMotion,
            reducedIdeaMotion: true,
            fixedIdeasHeight: true,
            flappyResizeChecks,
            flappyGameplayChecks,
            expandAndRestore: true,
            horizontalSnapping: true,
            toolsWidthLimit: true,
            tipsMinimizeAndRestore: true,
            keyboardPanelLimits: true,
            expandedViewportChanges: true,
        };
        await client.send("Runtime.evaluate", {
            expression:
                "document.querySelectorAll('[aria-label=\"Workspace panels\"] [role=\"tab\"]')[1].focus()",
        });
        await client.send("Runtime.evaluate", {
            expression: "globalThis.__webmcpLayoutChecksComplete?.()",
        });

        const viewportWindows = [[1042, 600], [390, 700], [1440, 900], [
            1042,
            936,
        ]];
        let lastViewportAudit = -1;
        while (true) {
            const progress = await pageValue(`({
                done: !!globalThis.__webmcpBrowserTestResult,
                request: globalThis.__webmcpViewportAuditRequest ?? null,
            })`);
            if (progress.done) break;
            const request = progress.request;
            if (!request || request.id === lastViewportAudit) {
                await delay(50);
                continue;
            }
            lastViewportAudit = request.id;
            const checks = [];
            const positions = state =>
                state.objects.filter(object => object.position)
                    .map(object => ({
                        id: object.id,
                        position: object.position,
                    }));
            let expectedClicks = request.pointer
                ? await pageValue("globalThis.__webmcpReadPointerCount()")
                : 0;
            for (const [width, height] of viewportWindows) {
                await client.send("Emulation.setDeviceMetricsOverride", {
                    width,
                    height,
                    deviceScaleFactor: 1,
                    mobile: false,
                });
                let state, frame, canvas, bufferMatches;
                const deadline = Date.now() + 5_000;
                while (Date.now() < deadline) {
                    await delay(100);
                    state = await pageValue(
                        "globalThis.__webmcpReadViewportAudit()",
                    );
                    frame = await pageValue(`(() => {
                        const r = document.querySelector(${
                        JSON.stringify(request.frameSelector)
                    }).getBoundingClientRect();
                        return { x:r.x, y:r.y, width:r.width, height:r.height };
                    })()`);
                    canvas = await readCanvasDisplay(request.frameSelector);
                    // A resized CSS box can precede the engine's drawing frame.
                    // Wait for the fixture's high-density buffer before clicking.
                    bufferMatches = canvas && (!request.pixelDensity || (
                        Math.abs(
                                canvas.bufferWidth
                                    - canvas.width * request.pixelDensity,
                            ) <= request.pixelDensity
                        && Math.abs(
                                canvas.bufferHeight
                                    - canvas.height * request.pixelDensity,
                            ) <= request.pixelDensity
                    ));
                    if (
                        canvas && Math.abs(canvas.width - frame.width) <= 2
                        && Math.abs(canvas.height - frame.height) <= 2
                        && bufferMatches
                        && (!request.responsive || (
                            Math.abs(state.viewport.width - canvas.width) <= 2
                            && Math.abs(state.viewport.height - canvas.height)
                                <= 2
                        ))
                    ) break;
                }
                assert(
                    canvas && Math.abs(canvas.width - frame.width) <= 2
                        && Math.abs(canvas.height - frame.height) <= 2,
                    `${request.label}: canvas did not fill the resized frame: ${
                        JSON.stringify({ frame, canvas })
                    }`,
                );
                assert(
                    canvas.bufferWidth > 0 && canvas.bufferHeight > 0,
                    `${request.label}: the resized canvas has no drawing buffer.`,
                );
                assert(
                    bufferMatches,
                    `${request.label}: the drawing buffer did not follow the resized canvas: ${
                        JSON.stringify(canvas)
                    }`,
                );
                assert.deepEqual(
                    state.errors,
                    [],
                    `${request.label}: resizing produced runtime errors.`,
                );
                assert.equal(
                    state.runId,
                    request.before.runId,
                    `${request.label}: resizing restarted the game.`,
                );
                if (request.responsive) {
                    assert(
                        Math.abs(state.viewport.width - canvas.width) <= 2
                            && Math.abs(state.viewport.height - canvas.height)
                                <= 2,
                        `Explicit responsive sizing no longer follows the canvas: ${
                            JSON.stringify({ viewport: state.viewport, canvas })
                        }`,
                    );
                } else {
                    assert.deepEqual(
                        state.viewport,
                        request.before.viewport,
                        `${request.label}: resizing changed the game's coordinate system.`,
                    );
                    if (request.checkObjects) {
                        assert.deepEqual(
                            positions(state),
                            positions(request.before),
                            `${request.label}: resizing moved existing game objects.`,
                        );
                    }
                }
                if (request.pointer) {
                    const waitForProcessedPointerEvent = async () => {
                        const frameDeadline = Date.now() + 2_000;
                        let input;
                        do {
                            await delay(16);
                            input = await readCanvasDisplay(request.frameSelector);
                        } while (
                            input.inputFrame <= input.eventFrame
                            && Date.now() < frameDeadline
                        );
                        assert(input.eventFrame >= 0 && input.inputFrame > input.eventFrame,
                            `${request.label}: the game did not process native pointer input.`);
                    };
                    const scale = Math.min(
                        frame.width / state.viewport.width,
                        frame.height / state.viewport.height,
                    );
                    const offsetX = (frame.width - state.viewport.width * scale)
                        / 2;
                    const offsetY =
                        (frame.height - state.viewport.height * scale) / 2;
                    for (
                        const [x, y] of [[0.15, 0.15], [0.85, 0.15], [
                            0.15,
                            0.85,
                        ], [0.85, 0.85]]
                    ) {
                        const point = {
                            x: frame.x + offsetX
                                + state.viewport.width * x * scale,
                            y: frame.y + offsetY
                                + state.viewport.height * y * scale,
                        };
                        await client.send("Input.dispatchMouseEvent", {
                            type: "mouseMoved",
                            ...point,
                        });
                        await waitForProcessedPointerEvent();
                        expectedClicks++;
                        let count;
                        try {
                            await client.send("Input.dispatchMouseEvent", {
                                type: "mousePressed",
                                button: "left",
                                clickCount: 1,
                                ...point,
                            });
                            // KAPLAY samples pressed state during its update.
                            // Releasing before that frame can erase the click.
                            const clickDeadline = Date.now() + 2_000;
                            do {
                                await delay(30);
                                count = await pageValue(
                                    "globalThis.__webmcpReadPointerCount()",
                                );
                            } while (
                                count !== expectedClicks
                                && Date.now() < clickDeadline
                            );
                        } finally {
                            await client.send("Input.dispatchMouseEvent", {
                                type: "mouseReleased",
                                button: "left",
                                clickCount: 1,
                                ...point,
                            });
                            await waitForProcessedPointerEvent();
                        }
                        assert.equal(
                            count,
                            expectedClicks,
                            `${request.label}: a visible corner target missed the pointer after resizing: ${
                                JSON.stringify({
                                    point,
                                    frame,
                                    canvas,
                                    viewport: state.viewport,
                                })
                            }`,
                        );
                    }
                }
                checks.push({
                    window: { width, height },
                    frame,
                    canvas,
                    logicalSize: state.viewport,
                    objectsChecked: request.checkObjects
                        ? positions(state).length
                        : 0,
                    pointerHits: request.pointer ? 4 : 0,
                });
            }
            const audit = {
                label: request.label,
                mode: request.responsive ? "responsive" : "fit",
                passed: true,
                checks,
            };
            await pageValue(
                `globalThis.__webmcpCompleteViewportAudit(${
                    JSON.stringify(audit)
                })`,
            );
        }
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
        assert.equal(
            result.viewportAudits.filter(audit =>
                audit.label.startsWith("catalog:")
            ).length,
            result.catalogExpectedCount,
            "Not every catalog entry was checked after resizing.",
        );
        for (
            const label of [
                "new-project-template",
                "new-example-template",
                "implicit-size-game-pointer-controls",
                "standalone-html-pointer-controls",
                "explicit-responsive-game",
            ]
        ) {
            assert(
                result.viewportAudits.some(audit =>
                    audit.label === label && audit.passed
                ),
                `${label} was not checked.`,
            );
        }
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
                    const rect = panel.getBoundingClientRect();
                    if (rect.x === 0) return null;
                    return rect.width;
                })()`,
                returnByValue: true,
            });
            restoredWidth = response.result?.value;
            if (Math.abs(restoredWidth - savedToolsWidth) <= 2) break;
            await delay(50);
        }
        assert(
            Math.abs(restoredWidth - savedToolsWidth) <= 2,
            `A fresh visit forgot the resized panel width: ${restoredWidth} instead of ${savedToolsWidth}.`,
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
        console.log(
            JSON.stringify({ layoutChecks, workspacePanelChecks }, null, 2),
        );
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
    const kaplayLicense = await readFile(
        resolve(root, "node_modules", "kaplay", "LICENSE"),
    );
    const currentKaplayLicense = await readFile(
        resolve(root, "kaplay", "LICENSE"),
    );
    // Verbatim notice from https://unpkg.com/kaplay@3001.0.19/LICENSE.md.
    const markdownKaplayLicense = await readFile(
        resolve(root, "tests", "fixtures", "kaplay-3001.0.19-LICENSE.md"),
    );
    return {
        esbuild: esbuild.toString("base64"),
        kaplay: kaplay.toString("base64"),
        currentKaplay: currentKaplay.toString("base64"),
        kaplayLicense: kaplayLicense.toString("base64"),
        currentKaplayLicense: currentKaplayLicense.toString("base64"),
        markdownKaplayLicense: markdownKaplayLicense.toString("base64"),
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
            /\/LICENSE(?:\.md)?$/.test(url)
            && (url.startsWith("https://unpkg.com/kaplay@")
                || url.startsWith(
                    "https://raw.githubusercontent.com/kaplayjs/kaplay/master/",
                ))
        ) {
            const markdownRelease = url.includes("/kaplay@3001.0.19/");
            await cdp.send("Fetch.fulfillRequest", {
                requestId: event.requestId,
                responseCode: markdownRelease && url.endsWith("/LICENSE")
                    ? 404
                    : 200,
                responseHeaders: fixtureHeaders("text/plain; charset=utf-8"),
                body: markdownRelease
                    ? fixtures.markdownKaplayLicense
                    : url.includes("/master/") || url.includes("/kaplay@4000.")
                    ? fixtures.currentKaplayLicense
                    : fixtures.kaplayLicense,
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
            {
                urlPattern: "https://unpkg.com/kaplay@*/LICENSE*",
                requestStage: "Request",
            },
            {
                urlPattern:
                    "https://raw.githubusercontent.com/kaplayjs/kaplay/master/LICENSE*",
                requestStage: "Request",
            },
        ],
    });
}

function fixtureHeaders(contentType) {
    return [
        { name: "Content-Type", value: contentType },
        { name: "Access-Control-Allow-Origin", value: "*" },
        { name: "Access-Control-Allow-Headers", value: "Content-Type" },
        { name: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
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
        if (cdp.socket.readyState !== WebSocket.OPEN) {
            throw new Error("Browser closed before producing a test result.");
        }
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
