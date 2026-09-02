export async function copyText(value: string): Promise<void> {
    const previousFocus = document.activeElement;
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.setAttribute("readonly", "");
    // An element outside an open modal is inert and cannot receive selection.
    const container = previousFocus?.closest("dialog[open]") ?? document.body;
    container.append(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, value.length);

    try {
        if (document.execCommand("copy")) return;
    } catch {
        // Some browsers throw rather than returning false when copy is blocked.
    } finally {
        textArea.remove();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
            previousFocus.focus({ preventScroll: true });
        }
    }

    if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
    }

    let timeout: number | undefined;
    try {
        await Promise.race([
            navigator.clipboard.writeText(value),
            new Promise<never>((_resolve, reject) => {
                timeout = window.setTimeout(
                    () => reject(new Error("Clipboard access timed out.")),
                    500,
                );
            }),
        ]);
    } finally {
        window.clearTimeout(timeout);
    }
}
