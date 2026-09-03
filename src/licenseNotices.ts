import kaplayLicense from "../kaplay/LICENSE?raw";
import kaplaygroundLicense from "../LICENSE?raw";

export const sourceLicenseNotices = `KAPLAYGROUND (editor and export template)

${kaplaygroundLicense.trim()}

KAPLAY (bundled examples and declarations)

${kaplayLicense.trim()}`;

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();
const requiredNotices = [
    "Permission is hereby granted",
    "The above copyright notice",
    "THE SOFTWARE IS PROVIDED",
].map(start =>
    normalizeWhitespace(
        kaplayLicense.slice(kaplayLicense.indexOf(start)).split(/\n\s*\n/)[0],
    ).replace(/[.:]$/, "")
);

/** Fetch the notice from the same release as the engine being exported. */
export async function getKaplayLicense(version: string): Promise<string> {
    const baseUrl = version === "master"
        ? "https://raw.githubusercontent.com/kaplayjs/kaplay/master"
        : `https://unpkg.com/kaplay@${encodeURIComponent(version)}`;

    const failureMessage =
        `Cannot export: failed to fetch the KAPLAY ${version} license. Please try again.`;
    const signal = AbortSignal.timeout(15_000);
    const fetchNotice = (filename: string) =>
        fetch(`${baseUrl}/${filename}`, {
            mode: "cors",
            credentials: "omit",
            signal,
        }).catch(() => {
            throw new Error(failureMessage);
        });
    let response = await fetchNotice("LICENSE");
    // Some released engines use LICENSE.md and carry additional upstream terms.
    if (response.status === 404) response = await fetchNotice("LICENSE.md");
    if (!response.ok) {
        throw new Error(failureMessage);
    }

    const license = await response.text();
    const normalizedLicense = normalizeWhitespace(license);
    if (
        !/Copyright\s+\(c\)\s+\d{4}/i.test(license)
        || !requiredNotices.every(notice =>
            notice.length > 0 && normalizedLicense.includes(notice)
        )
    ) {
        throw new Error(
            `Cannot export: the KAPLAY ${version} license notice is incomplete.`,
        );
    }
    return license.trim();
}
