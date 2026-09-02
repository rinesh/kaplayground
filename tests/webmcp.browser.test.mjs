import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, rm, mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

    try {
        const ports = new Set();
        while (ports.size < 3) ports.add(await freePort());
        const [appPort, sandboxPort, debuggingPort] = ports;
        const sandboxUrl = `http://127.0.0.1:${sandboxPort}/`;
        const appUrl =
            `http://127.0.0.1:${appPort}/tests/webmcp.browser.html`;

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
        await client.send("Runtime.enable");
        await installFixtureInterception(client, fixtures);
        const navigation = await client.send("Page.navigate", { url: appUrl });
        if (navigation.errorText) {
            throw new Error(
                `Chrome could not open the test page: ${navigation.errorText}`,
            );
        }

        const resultPromise = waitForBrowserResult(client, 120_000);
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
                earlyResult.error ?? "Browser test failed before movement input.",
            );
            throw new Error("Browser test finished before requesting movement input.");
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

        const result = await resultPromise;
        assert.equal(result.passed, true, result.error ?? "Browser test failed.");
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
        assert.equal(result.pendingAssetsStatus, "incomplete");
        assert.equal(result.inspectionErrorStatus, "failed");
        assert.equal(result.diagnosticErrorStatus, "failed");
        assert.equal(result.unavailableInspectionStatus, "incomplete");
        assert.equal(result.declinedCommitted, false);
        assert.equal(typeof result.opened, "string");

        console.log("WebMCP browser integration passed:");
        console.log(JSON.stringify(result, null, 2));
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

async function loadBrowserFixtures() {
    const esbuild = await readFile(
        resolve(root, "node_modules", "esbuild-wasm", "esbuild.wasm"),
    );
    const kaplay = await readFirstExisting([
        resolve(root, "node_modules", "kaplay", "dist", "kaplay.mjs"),
        resolve(root, "node_modules", "kaplay", "dist", "kaboom.mjs"),
    ]);
    return {
        esbuild: esbuild.toString("base64"),
        kaplay: kaplay.toString("base64"),
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
                responseHeaders: fixtureHeaders("text/javascript; charset=utf-8"),
                body: fixtures.kaplay,
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
