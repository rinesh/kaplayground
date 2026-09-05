/** Return the virtual directory esbuild should use for imports from one file. */
export function virtualResolveDirectory(path: string): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const separator = normalized.lastIndexOf("/");
    return separator <= 0 ? "/" : normalized.slice(0, separator);
}

/** Resolve virtual file names without URL encoding or query/fragment semantics. */
export function resolveVirtualPath(path: string, directory: string): string {
    const parts = (path.startsWith("/") ? path : `${directory}/${path}`).split(
        "/",
    );
    const resolved: string[] = [];
    for (const part of parts) {
        if (!part || part === ".") continue;
        if (part === "..") resolved.pop();
        else resolved.push(part);
    }
    return `/${resolved.join("/")}`;
}
