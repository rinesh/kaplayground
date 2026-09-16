export const downloadBlob = async (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);

    try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    }

    // Safari may start reading after click() returns. Keep the Blob available
    // briefly without copying large exports into a base64 data URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
