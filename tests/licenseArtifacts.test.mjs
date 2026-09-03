import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const root = new URL("../", import.meta.url);
const distribution = new URL("dist/client/", root);

describe("production distribution license artifacts", () => {
    for (
        const [source, artifact] of [
            ["LICENSE", "LICENSE.txt"],
            ["kaplay/LICENSE", "licenses/KAPLAY.txt"],
        ]
    ) {
        it(`ships the complete ${source} as ${artifact}`, async () => {
            const expected = await readFile(new URL(source, root), "utf8");
            const actual = await readFile(
                new URL(artifact, distribution),
                "utf8",
            );
            assert.equal(actual, expected);
            assert.match(actual, /Copyright \(c\) \d{4} KAPLAY Team/);
            assert.match(
                actual,
                /Permission is hereby granted, free of charge/,
            );
            assert.match(actual, /THE SOFTWARE IS PROVIDED "AS IS"/);
            assert.match(actual, /OTHER DEALINGS IN THE\s+SOFTWARE\./);
        });

        it(`links to ${artifact} from the built entrypoint`, async () => {
            const html = await readFile(
                new URL("index.html", distribution),
                "utf8",
            );
            assert(
                html.includes(`rel="license" href="/${artifact}"`),
                `The production HTML must link to /${artifact}.`,
            );
        });
    }
});
