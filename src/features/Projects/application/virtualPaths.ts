/** Return the virtual directory esbuild should use for imports from one file. */
export function virtualResolveDirectory(path: string): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const separator = normalized.lastIndexOf("/");
    return separator <= 0 ? "/" : normalized.slice(0, separator);
}
