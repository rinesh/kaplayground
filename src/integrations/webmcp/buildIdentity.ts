export interface KaplaygroundBuildIdentity {
    applicationCommit: string;
    engineCommit: string;
    applicationVersion: string;
    builtAt: string;
}

declare const __KAPLAYGROUND_BUILD_IDENTITY__:
    | KaplaygroundBuildIdentity
    | undefined;

const fallbackIdentity: KaplaygroundBuildIdentity = {
    applicationCommit: "unknown",
    engineCommit: "unknown",
    applicationVersion: "unknown",
    builtAt: "unknown",
};

export const KAPLAYGROUND_BUILD_IDENTITY: KaplaygroundBuildIdentity =
    typeof __KAPLAYGROUND_BUILD_IDENTITY__ === "undefined"
        ? fallbackIdentity
        : Object.freeze({ ...__KAPLAYGROUND_BUILD_IDENTITY__ });

export function engineRuntimeIdentity(
    requestedVersion: string,
    moduleUrl: string,
): Record<string, unknown> {
    return {
        requestedVersion,
        moduleUrl,
        immutableReference: requestedVersion !== "master",
        checkedOutEngineCommit: KAPLAYGROUND_BUILD_IDENTITY.engineCommit,
        limitation: requestedVersion === "master"
            ? "The master module URL is mutable; the checked-out engine commit identifies the build inputs but cannot prove the remote module bytes imported later."
            : null,
    };
}
