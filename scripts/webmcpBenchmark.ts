import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface BenchmarkRun {
    id: string;
    workflow: "webmcp" | "standard-editor";
    applicationCommit: string;
    engineIdentity: string;
    starterHash: string;
    model: string;
    reasoningSetting: string;
    viewport: { width: number; height: number };
    durationMs: number;
    firstSuccessfulRunMs: number;
    firstFullyVerifiedRunMs: number | null;
    outerInteractions: number;
    sourceWrites: number;
    retries: number;
    browserInputOperations: number;
    cachedInputTokens?: number;
    uncachedInputTokens?: number;
    outputTokens?: number;
    acceptance: Record<string, "passed" | "failed" | "not-tested">;
    unsupportedClaims: string[];
}

interface BenchmarkInput {
    schemaVersion: 1;
    promptHash: string;
    runs: BenchmarkRun[];
}

const inputPath = process.argv[2] ?? process.env.WEBMCP_BENCHMARK_INPUT;
if (!inputPath) {
    throw new Error(
        "Pass a benchmark JSON file: npm run benchmark:webmcp -- path/to/runs.json",
    );
}
const outputPath = process.argv[3]
    ?? process.env.WEBMCP_BENCHMARK_OUTPUT
    ?? "webmcp-benchmark-summary.json";
const input = JSON.parse(
    await readFile(resolve(inputPath), "utf8"),
) as BenchmarkInput;
validate(input);

const grouped = Object.groupBy(input.runs, run => run.workflow);
const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    promptHash: input.promptHash,
    pinnedInputs: commonPins(input.runs),
    workflows: Object.fromEntries(
        Object.entries(grouped).map(([workflow, runs]) => [
            workflow,
            summarize(runs ?? []),
        ]),
    ),
};
await writeFile(resolve(outputPath), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

function summarize(runs: BenchmarkRun[]) {
    const acceptance = Object.keys(runs[0]?.acceptance ?? {}).map(key => ({
        requirement: key,
        passRate: runs.filter(run => run.acceptance[key] === "passed").length
            / runs.length,
        failureRate: runs.filter(run => run.acceptance[key] === "failed").length
            / runs.length,
        notTestedRate: runs.filter(run => run.acceptance[key] === "not-tested")
            .length / runs.length,
    }));
    return {
        runs: runs.length,
        fullyVerifiedRate: runs.filter(run =>
            run.firstFullyVerifiedRunMs !== null
        ).length / runs.length,
        durationMs: distribution(runs.map(run => run.durationMs)),
        firstSuccessfulRunMs: distribution(
            runs.map(run => run.firstSuccessfulRunMs),
        ),
        firstFullyVerifiedRunMs: distribution(
            runs.flatMap(run =>
                run.firstFullyVerifiedRunMs === null
                    ? []
                    : [run.firstFullyVerifiedRunMs]
            ),
        ),
        outerInteractions: distribution(
            runs.map(run => run.outerInteractions),
        ),
        sourceWrites: distribution(runs.map(run => run.sourceWrites)),
        retries: distribution(runs.map(run => run.retries)),
        browserInputOperations: distribution(
            runs.map(run => run.browserInputOperations),
        ),
        outerInteractionsPerVerifiedBehavior: distribution(
            runs.flatMap(run => {
                const passed = Object.values(run.acceptance).filter(
                    value => value === "passed",
                ).length;
                return passed === 0 ? [] : [run.outerInteractions / passed];
            }),
        ),
        cachedInputTokens: optionalDistribution(
            runs.map(run => run.cachedInputTokens),
        ),
        uncachedInputTokens: optionalDistribution(
            runs.map(run => run.uncachedInputTokens),
        ),
        outputTokens: optionalDistribution(runs.map(run => run.outputTokens)),
        acceptance,
        unsupportedClaims: runs.reduce(
            (total, run) => total + run.unsupportedClaims.length,
            0,
        ),
    };
}

function optionalDistribution(values: Array<number | undefined>) {
    return distribution(values.filter((value): value is number =>
        value !== undefined
    ));
}

function distribution(values: number[]) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = (ratio: number) => {
        const index = (sorted.length - 1) * ratio;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) return sorted[lower];
        return sorted[lower]
            + (sorted[upper] - sorted[lower]) * (index - lower);
    };
    return {
        minimum: sorted[0],
        median: percentile(0.5),
        p90: percentile(0.9),
        maximum: sorted.at(-1),
    };
}

function commonPins(runs: BenchmarkRun[]) {
    const fields = [
        "applicationCommit",
        "engineIdentity",
        "starterHash",
        "model",
        "reasoningSetting",
    ] as const;
    const pins = Object.fromEntries(fields.map(field => [
        field,
        [...new Set(runs.map(run => run[field]))],
    ]));
    const viewports = [...new Set(runs.map(run =>
        `${run.viewport.width}x${run.viewport.height}`
    ))];
    return { ...pins, viewport: viewports };
}

function validate(input: BenchmarkInput): void {
    if (
        input.schemaVersion !== 1
        || !input.promptHash
        || !Array.isArray(input.runs)
    ) {
        throw new Error(
            "Benchmark input must use schemaVersion 1 and contain a promptHash and runs.",
        );
    }
    if (input.runs.length < 2) {
        throw new Error("Benchmark input must contain at least two runs.");
    }
    const workflows = new Set(input.runs.map(run => run.workflow));
    if (!workflows.has("webmcp") || !workflows.has("standard-editor")) {
        throw new Error(
            "Benchmark input must contain both webmcp and standard-editor runs.",
        );
    }
    const pinSelectors = {
        applicationCommit: (run: BenchmarkRun) => run.applicationCommit,
        engineIdentity: (run: BenchmarkRun) => run.engineIdentity,
        starterHash: (run: BenchmarkRun) => run.starterHash,
        model: (run: BenchmarkRun) => run.model,
        reasoningSetting: (run: BenchmarkRun) => run.reasoningSetting,
        viewport: (run: BenchmarkRun) =>
            `${run.viewport?.width}x${run.viewport?.height}`,
    };
    for (const [name, select] of Object.entries(pinSelectors)) {
        const values = new Set(input.runs.map(select));
        if (values.size !== 1) {
            throw new Error(
                `Matched benchmark runs must use one ${name}; found ${
                    [...values].join(", ")
                }.`,
            );
        }
    }

    const ids = new Set<string>();
    const acceptanceKeys = Object.keys(input.runs[0]?.acceptance ?? {}).sort();
    for (const run of input.runs) {
        if (
            typeof run.id !== "string"
            || run.id.length === 0
            || run.id.length > 200
            || ids.has(run.id)
        ) {
            throw new Error(`Invalid run id: ${run.id}`);
        }
        ids.add(run.id);
        if (run.workflow !== "webmcp" && run.workflow !== "standard-editor") {
            throw new Error(`${run.id}: workflow must be webmcp or standard-editor.`);
        }
        for (
            const [name, value] of Object.entries({
                durationMs: run.durationMs,
                firstSuccessfulRunMs: run.firstSuccessfulRunMs,
                outerInteractions: run.outerInteractions,
                sourceWrites: run.sourceWrites,
                retries: run.retries,
                browserInputOperations: run.browserInputOperations,
            })
        ) {
            if (!Number.isFinite(value) || value < 0) {
                throw new Error(`${run.id}: ${name} must be non-negative.`);
            }
        }
        if (run.durationMs <= 0 || run.firstSuccessfulRunMs <= 0) {
            throw new Error(
                `${run.id}: duration and first successful run time must be positive.`,
            );
        }
        if (run.firstSuccessfulRunMs > run.durationMs) {
            throw new Error(
                `${run.id}: firstSuccessfulRunMs cannot exceed durationMs.`,
            );
        }
        if (
            run.firstFullyVerifiedRunMs !== null
            && (
                !Number.isFinite(run.firstFullyVerifiedRunMs)
                || run.firstFullyVerifiedRunMs <= 0
                || run.firstFullyVerifiedRunMs < run.firstSuccessfulRunMs
                || run.firstFullyVerifiedRunMs > run.durationMs
            )
        ) {
            throw new Error(
                `${run.id}: firstFullyVerifiedRunMs must be null or a time between the first successful run and completion.`,
            );
        }
        for (
            const [name, value] of Object.entries({
                outerInteractions: run.outerInteractions,
                sourceWrites: run.sourceWrites,
                retries: run.retries,
                browserInputOperations: run.browserInputOperations,
            })
        ) {
            if (!Number.isSafeInteger(value)) {
                throw new Error(`${run.id}: ${name} must be an integer.`);
            }
        }
        if (
            !run.applicationCommit
            || !run.engineIdentity
            || !run.starterHash
            || !run.model
            || !run.reasoningSetting
        ) {
            throw new Error(`${run.id}: build and model inputs must be pinned.`);
        }
        if (
            !Number.isFinite(run.viewport?.width)
            || !Number.isFinite(run.viewport?.height)
            || run.viewport.width <= 0
            || run.viewport.height <= 0
        ) {
            throw new Error(`${run.id}: viewport must be positive.`);
        }
        const currentAcceptanceKeys = Object.keys(run.acceptance ?? {}).sort();
        if (
            acceptanceKeys.length === 0
            || JSON.stringify(currentAcceptanceKeys)
                !== JSON.stringify(acceptanceKeys)
        ) {
            throw new Error(
                `${run.id}: every run must use the same non-empty acceptance matrix.`,
            );
        }
        for (const [requirement, status] of Object.entries(run.acceptance)) {
            if (
                status !== "passed"
                && status !== "failed"
                && status !== "not-tested"
            ) {
                throw new Error(
                    `${run.id}: acceptance ${requirement} has invalid status ${status}.`,
                );
            }
        }
        for (
            const [name, value] of Object.entries({
                cachedInputTokens: run.cachedInputTokens,
                uncachedInputTokens: run.uncachedInputTokens,
                outputTokens: run.outputTokens,
            })
        ) {
            if (
                value !== undefined
                && (!Number.isSafeInteger(value) || value < 0)
            ) {
                throw new Error(
                    `${run.id}: ${name} must be a non-negative integer when supplied.`,
                );
            }
        }
        if (
            !Array.isArray(run.unsupportedClaims)
            || run.unsupportedClaims.some(claim =>
                typeof claim !== "string" || claim.length > 500
            )
        ) {
            throw new Error(
                `${run.id}: unsupportedClaims must contain bounded strings.`,
            );
        }
    }
}
