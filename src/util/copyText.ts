export async function copyText(value: string): Promise<void> {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.setAttribute("readonly", "");
    document.body.append(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, value.length);

    try {
        if (document.execCommand("copy")) return;
    } finally {
        textArea.remove();
    }

    if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
    }

    await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise<never>((_resolve, reject) => {
            window.setTimeout(
                () => reject(new Error("Clipboard access timed out.")),
                500,
            );
        }),
    ]);
}
