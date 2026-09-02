import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const mainSource = readFileSync(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
);

describe("root startup", () => {
    it("does not rewrite the root URL before project config loads", () => {
        assert.doesNotMatch(mainSource, /getStarterDemoUrl/);
        assert.doesNotMatch(mainSource, /history\.replaceState/);
    });
});
