#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
    WEBMCP_AGENT_GUIDE_VERSION,
    WEBMCP_CONTRACT_VERSION,
    WEBMCP_REFERENCE_TOPICS,
    WEBMCP_TOOL_ORDER,
} from "../src/integrations/webmcp/agentContract.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillDirectory = resolve(
    repositoryRoot,
    "plugins/kaplayground/skills/kaplay",
);
const pluginVersion = "1.5.1";
const publishedPluginVersion = "1.5.0";
const directMarketplaceCommand =
    `codex plugin marketplace add rinesh/kaplayground --ref kaplayground-plugin-v${publishedPluginVersion}`;
const failures = [];

function read(relativePath) {
    return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function check(condition, message) {
    if (!condition) failures.push(message);
}

function unquote(value) {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function parseFrontmatter(markdown) {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return null;

    const fields = new Map();
    for (const line of match[1].split(/\r?\n/)) {
        if (/^\s/.test(line)) continue;
        const separator = line.indexOf(":");
        if (separator === -1) continue;
        fields.set(
            line.slice(0, separator).trim(),
            unquote(line.slice(separator + 1)),
        );
    }
    return fields;
}

function parseFrontmatterSection(markdown, sectionName) {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return null;

    const fields = new Map();
    let inSection = false;
    for (const line of match[1].split(/\r?\n/)) {
        const sectionMatch = line.match(/^([a-zA-Z0-9_-]+):\s*$/);
        if (sectionMatch) {
            inSection = sectionMatch[1] === sectionName;
            continue;
        }
        if (!inSection) continue;
        const fieldMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*(.+)$/);
        if (fieldMatch) fields.set(fieldMatch[1], unquote(fieldMatch[2]));
        if (line && !/^\s/.test(line)) inSection = false;
    }
    return fields;
}

function markdownFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) files.push(...markdownFiles(path));
        if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
    }
    return files;
}

function parseContractVersion(value) {
    if (typeof value !== "string") return null;
    const match = value.match(/^(\d+)\.(\d+)$/);
    if (!match) return null;
    return { major: Number(match[1]), minor: Number(match[2]) };
}

function isCompatibleContract(value, minimum) {
    const candidate = parseContractVersion(value);
    const floor = parseContractVersion(minimum);
    if (!candidate || !floor || candidate.major !== floor.major) return false;
    return candidate.minor >= floor.minor;
}

function hasProfile(tools, requirements) {
    return requirements.every((tool) => tools.has(tool));
}

const skillMarkdown = read("plugins/kaplayground/skills/kaplay/SKILL.md");
const skillFrontmatter = parseFrontmatter(skillMarkdown);
const skillMetadata = parseFrontmatterSection(skillMarkdown, "metadata");

check(skillFrontmatter !== null, "SKILL.md must start with YAML frontmatter");
if (skillFrontmatter) {
    const allowedKeys = new Set([
        "allowed-tools",
        "description",
        "license",
        "metadata",
        "name",
    ]);
    const unexpectedKeys = [...skillFrontmatter.keys()].filter(
        (key) => !allowedKeys.has(key),
    );
    check(
        skillFrontmatter.get("name") === "kaplay",
        "skill frontmatter name must match the kaplay directory",
    );
    check(
        Boolean(skillFrontmatter.get("description")),
        "skill frontmatter description is required",
    );
    check(
        unexpectedKeys.length === 0,
        `unsupported skill frontmatter keys: ${unexpectedKeys.join(", ")}`,
    );
}
check(skillMetadata !== null, "SKILL.md must include flat metadata fields");
check(
    !/\b(?:TODO|TBD|REPLACE_ME)\b/.test(skillMarkdown),
    "SKILL.md contains an unfinished scaffold placeholder",
);

for (const markdownPath of markdownFiles(skillDirectory)) {
    const markdown = readFileSync(markdownPath, "utf8");
    for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
        const rawTarget = match[1].trim().replace(/^<|>$/g, "");
        const target = rawTarget.split(/\s+["']/)[0].split("#")[0];
        if (
            !target ||
            target.startsWith("#") ||
            /^[a-z][a-z0-9+.-]*:/i.test(target)
        ) continue;

        let decodedTarget;
        try {
            decodedTarget = decodeURIComponent(target);
        } catch {
            failures.push(
                `${relative(repositoryRoot, markdownPath)} has an invalid link: ${target}`,
            );
            continue;
        }

        const resolvedTarget = resolve(dirname(markdownPath), decodedTarget);
        const staysInSkill = resolvedTarget === skillDirectory ||
            resolvedTarget.startsWith(`${skillDirectory}${sep}`);
        check(
            staysInSkill,
            `${relative(repositoryRoot, markdownPath)} links outside the skill: ${target}`,
        );
        check(
            existsSync(resolvedTarget),
            `${relative(repositoryRoot, markdownPath)} has a missing link: ${target}`,
        );
    }
}

const packageMetadata = JSON.parse(read("package.json"));
const pluginMetadata = JSON.parse(
    read("plugins/kaplayground/.codex-plugin/plugin.json"),
);
const marketplaceMetadata = JSON.parse(read(".agents/plugins/marketplace.json"));
const fixture = JSON.parse(read("tests/fixtures/kaplay-plugin-contract.json"));
const flowTest = read("tests/flows/kaplayground-plugin.md");
const readme = read("README.md");
const webmcpReference = read(
    "plugins/kaplayground/skills/kaplay/kaplayground-webmcp.md",
);

check(packageMetadata.version === "2.5.3", "app version must remain 2.5.3");
check(pluginMetadata.name === "kaplayground", "plugin name must be kaplayground");
check(
    pluginMetadata.version === pluginVersion,
    `plugin version must be ${pluginVersion}`,
);
check(pluginMetadata.skills === "./skills/", "plugin must expose ./skills/");
check(!("apps" in pluginMetadata), "skills-only plugin must not declare apps");
check(
    !("mcpServers" in pluginMetadata),
    "skills-only plugin must not declare MCP servers",
);
check(
    Array.isArray(pluginMetadata.interface?.capabilities) &&
        pluginMetadata.interface.capabilities.length === 0,
    "plugin must not claim tool capabilities",
);
check(
    pluginMetadata.interface?.category === "Development",
    "plugin category must be Development",
);
check(
    Array.isArray(pluginMetadata.interface?.defaultPrompt) &&
        pluginMetadata.interface.defaultPrompt.length === 3,
    "plugin must provide build, improve, and debug starter prompts",
);
check(
    skillMetadata?.get("version") === pluginMetadata.version,
    "skill and plugin versions must match",
);

const marketplaceEntry = marketplaceMetadata.plugins?.find(
    (entry) => entry.name === "kaplayground",
);
check(Boolean(marketplaceEntry), "marketplace must contain kaplayground");
check(
    marketplaceEntry?.source?.source === "local" &&
        marketplaceEntry.source.path === "./plugins/kaplayground",
    "marketplace must use the local Kaplayground plugin directory",
);
check(
    marketplaceEntry?.policy?.installation === "AVAILABLE" &&
        marketplaceEntry.policy.authentication === "ON_INSTALL",
    "marketplace must use AVAILABLE and ON_INSTALL policies",
);
check(
    marketplaceEntry?.category === "Development",
    "marketplace category must be Development",
);
check(
    readme.includes("without installing the optional plugin"),
    "README must describe the zero-install WebMCP entry point",
);
check(
    readme.includes("plugins/kaplayground"),
    "README must identify the canonical plugin directory",
);
check(
    readme.includes(directMarketplaceCommand),
    "README must document the immutable direct marketplace command",
);
check(
    readme.includes("tag is frozen") &&
        readme.includes("not installable by tag") &&
        readme.includes("canonical Kaplayground marketplace") &&
        /repository policy\s+fields do not override workspace policy/.test(
            readme,
        ),
    "README must distinguish the canonical marketplace, frozen tag, and ChatGPT workspace policy",
);
check(
    flowTest.includes('"$kaplay '),
    "flow fixture must explicitly invoke the kaplay skill",
);

check(
    WEBMCP_CONTRACT_VERSION === "1.1",
    "app contract version must be 1.1",
);
check(
    WEBMCP_AGENT_GUIDE_VERSION === 5,
    "app guide version must be 5",
);
check(
    fixture.contract.minimum === WEBMCP_CONTRACT_VERSION,
    "fixture minimum must import the app contract value",
);
check(
    fixture.contract.guideVersion === WEBMCP_AGENT_GUIDE_VERSION,
    "fixture guide must match the app guide value",
);
check(
    skillMetadata?.get("kaplayground-contract-minimum") ===
        WEBMCP_CONTRACT_VERSION,
    "skill must declare the app contract minimum",
);
check(
    skillMetadata?.get("kaplayground-contract-tested-through") === "1.x",
    "skill must declare the tested 1.x contract family",
);

const expectedFullSurface = WEBMCP_TOOL_ORDER.map(
    (name) => `kaplayground_${name}`,
);
check(
    expectedFullSurface.length === 20,
    "the central app registry must contain the 20-tool full surface",
);
check(
    JSON.stringify(fixture.fullSurface) === JSON.stringify(expectedFullSurface),
    "full-surface fixture must exactly match the central app tool registry",
);
const expectedReferenceTopics = WEBMCP_REFERENCE_TOPICS.map(({ topic }) => topic);
check(
    JSON.stringify(fixture.referenceTopics) ===
        JSON.stringify(expectedReferenceTopics),
    "fixture reference topics must exactly match the app contract registry",
);

const contractDocumentation = `${skillMarkdown}\n${webmcpReference}\n${flowTest}`;
check(
    !/\b(?:nineteen|19-tool|canonical tool surface)\b/i.test(
        contractDocumentation,
    ),
    "skill guidance must not retain an exact-count contract gate",
);
check(
    !/legacy guide|guide\s+v?4|guideVersion:\s*4/i.test(contractDocumentation),
    "skill guidance must not implement a legacy guide contract",
);
check(
    /absent[^.]*older[^.]*unknown|absent[^.]*older[^.]*different-major/i.test(
        contractDocumentation,
    ),
    "skill guidance must keep absent, older, and unknown contracts inspection-only",
);
check(
    webmcpReference.includes("kaplayground_get_reference") &&
        webmcpReference.includes("source-only mutation"),
    "static reference must cover focused references and source-only confirmation",
);

for (const [profileName, requirements] of Object.entries(fixture.profiles)) {
    check(Array.isArray(requirements), `${profileName} profile must be an array`);
    check(
        new Set(requirements).size === requirements.length,
        `${profileName} profile contains duplicate tools`,
    );
    for (const tool of requirements) {
        check(
            expectedFullSurface.includes(tool),
            `${profileName} profile references an unregistered tool: ${tool}`,
        );
    }
}

for (const testCase of fixture.cases) {
    const advertised = new Set(
        testCase.tools === "fullSurface" ? fixture.fullSurface : testCase.tools,
    );
    const schemaCompatible = new Set(
        testCase.schemaCompatibleTools ?? advertised,
    );
    const usableTools = new Set(
        [...advertised].filter((tool) => schemaCompatible.has(tool)),
    );
    const contractCompatible = isCompatibleContract(
        testCase.contractVersion,
        fixture.contract.minimum,
    );
    const inspection = hasProfile(usableTools, fixture.profiles.inspection);
    const existingFileEditing = hasProfile(
        usableTools,
        fixture.profiles.existingFileEditing,
    );
    const verifiedIteration = hasProfile(
        usableTools,
        fixture.profiles.verifiedIteration,
    );
    const recommendedEvidence = hasProfile(
        usableTools,
        fixture.profiles.recommendedEvidence,
    );
    const sourceOnlyConfirmationRequired =
        contractCompatible &&
        existingFileEditing &&
        !verifiedIteration &&
        !testCase.sourceOnlyAccepted;
    const mutationAllowed =
        contractCompatible &&
        existingFileEditing &&
        (verifiedIteration || testCase.sourceOnlyAccepted === true);
    const actual = {
        contractCompatible,
        inspection,
        existingFileEditing,
        verifiedIteration,
        recommendedEvidence,
        sourceOnlyConfirmationRequired,
        mutationAllowed,
    };

    check(
        JSON.stringify(actual) === JSON.stringify(testCase.expected),
        `${testCase.name} produced ${JSON.stringify(actual)} instead of ${JSON.stringify(testCase.expected)}`,
    );
}

check(fixture.cases.length === 9, "contract fixture must contain nine cases");
check(
    fixture.positiveTriggers.length > 0 && fixture.negativeTriggers.length > 0,
    "trigger fixture must contain positive and negative cases",
);
const positiveTriggers = new Set(
    fixture.positiveTriggers.map((value) => value.toLocaleLowerCase("en-US")),
);
for (const negativeTrigger of fixture.negativeTriggers) {
    check(
        !positiveTriggers.has(negativeTrigger.toLocaleLowerCase("en-US")),
        `trigger appears in both sets: ${negativeTrigger}`,
    );
}

if (failures.length > 0) {
    console.error("Kaplayground plugin validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log(
    `Kaplayground plugin validation passed (${fixture.cases.length} contract cases, ${expectedFullSurface.length} tools).`,
);
