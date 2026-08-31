import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getStarterDemoUrl } from "../src/integrations/webmcp/starterDemoUrl.ts";

describe("starter demo URL", () => {
    it("selects the WebMCP starter for the bare root URL", () => {
        assert.equal(
            getStarterDemoUrl("https://kaplayground.example/"),
            "https://kaplayground.example/?example=webmcpAgent",
        );
    });

    it("preserves URLs that already express player intent", () => {
        const urls = [
            "https://kaplayground.example/?example=basicsStart",
            "https://kaplayground.example/?code=shared-game",
            "https://kaplayground.example/#project",
            "https://kaplayground.example/about",
        ];

        for (const url of urls) assert.equal(getStarterDemoUrl(url), null);
    });
});
