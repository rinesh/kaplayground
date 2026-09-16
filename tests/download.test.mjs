import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadBlob } from "../src/util/download.ts";

function captureDownload(t, click = () => {}) {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const anchor = { href: "", download: "", click };
    const timers = [];
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: { createElement: () => anchor },
    });
    t.mock.method(globalThis, "setTimeout", (callback, delay) => {
        timers.push({ callback, delay });
        return 1;
    });
    t.after(() => {
        if (anchor.href) URL.revokeObjectURL(anchor.href);
        if (previousDocument) {
            Object.defineProperty(globalThis, "document", previousDocument);
        } else {
            delete globalThis.document;
        }
    });
    return { anchor, timers };
}

test("downloads remain readable after the click and are eventually released", async t => {
    let clicks = 0;
    const { anchor, timers } = captureDownload(t, () => clicks++);
    const content = "exported game with embedded assets";
    await downloadBlob(new Blob([content]), "my-game.html");

    assert.equal(clicks, 1);
    assert.equal(anchor.download, "my-game.html");
    assert.equal(await (await fetch(anchor.href)).text(), content);
    assert.equal(timers.length, 1);
    assert.ok(timers[0].delay >= 30_000, "allow the browser time to start reading");

    timers[0].callback();
    await assert.rejects(fetch(anchor.href), TypeError);
});

test("a failed download releases its Blob URL and reports the failure", async t => {
    const failure = new Error("Download could not start");
    const { anchor, timers } = captureDownload(t, () => { throw failure; });

    await assert.rejects(downloadBlob(new Blob(["game"]), "game.kaplay"), error => error === failure);
    await assert.rejects(fetch(anchor.href), TypeError);
    assert.equal(timers.length, 0);
});
