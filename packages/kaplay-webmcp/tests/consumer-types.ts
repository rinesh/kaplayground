import type { KaplayWebMCPOptions, KaplayWebMCPTool } from "../dist/index.js";

type IsAny<T> = 0 extends 1 & T ? true : false;
type ExpectFalse<T extends false> = T;
type AnnotationsAreTyped = ExpectFalse<
    IsAny<NonNullable<KaplayWebMCPTool["annotations"]>>
>;

const customTool: KaplayWebMCPTool = {
    name: "read_score",
    description: "Read the current score.",
    annotations: { readOnlyHint: true },
    execute: () => ({ score: 0 }),
};

export const consumerOptions: KaplayWebMCPOptions = {
    tools: [customTool],
};

export type { AnnotationsAreTyped };
