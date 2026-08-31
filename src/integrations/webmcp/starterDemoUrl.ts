import { WEBMCP_EXAMPLE_NAME } from "./constants.ts";

export function getStarterDemoUrl(href: string): string | null {
    const url = new URL(href);

    if (url.pathname !== "/" || url.search || url.hash) return null;

    url.searchParams.set("example", WEBMCP_EXAMPLE_NAME);
    return url.toString();
}
