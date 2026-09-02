import { WEBMCP_EXAMPLE_NAME } from "../integrations/webmcp/constants.ts";
import type { Example } from "./demos";

export type StartingPointCollection = "all" | "games" | "features";

export function isPlayableStartingPoint(example: Example): boolean {
    return example.key === WEBMCP_EXAMPLE_NAME || example.category === "games";
}

export function inStartingPointCollection(
    example: Example,
    collection: StartingPointCollection,
): boolean {
    return collection === "all"
        || isPlayableStartingPoint(example) === (collection === "games");
}

export function matchesStartingPoint(
    example: Example,
    query: string,
    topic = "",
): boolean {
    const text = [
        example.key,
        example.formattedName,
        example.description,
        example.category,
        example.group,
        ...example.tags.flatMap(tag => [tag.name, tag.displayName]),
    ].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase())
        && (!topic || example.category === topic
            || example.tags.some(tag => tag.name === topic));
}

export function compareStartingPoints(left: Example, right: Example): number {
    const rank = (example: Example) =>
        example.key === WEBMCP_EXAMPLE_NAME
            ? 0
            : isPlayableStartingPoint(example)
            ? 1
            : 2;
    return rank(left) - rank(right)
        || left.sortName.localeCompare(right.sortName);
}
