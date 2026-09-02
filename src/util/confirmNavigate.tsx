import { useProject } from "../features/Projects/stores/useProject";
import { confirm, type ConfirmContent, type ConfirmOptions } from "./confirm";

export type unsavedChangesConfirm = {
    title?: string;
    content?: ConfirmContent;
    options?: ConfirmOptions;
};

/** Never replace a project until its latest edit is durable or explicitly discarded. */
export const confirmNavigate = async (
    to: () => void | Promise<unknown>,
    { title, content }: unsavedChangesConfirm = {},
): Promise<void> => {
    const before = useProject.getState();
    const generation = before.projectGeneration;
    const revision = before.projectRevision;
    if (before.hasUnsavedProjectChanges()) {
        try {
            await before.persistActiveProject();
        } catch {
            // A new edit or another navigation invalidates this request.
            const current = useProject.getState();
            if (
                current.projectGeneration !== generation
                || current.projectRevision !== revision
            ) return;
            const discard = await confirm(
                title ?? "Couldn't save your changes",
                content
                    ?? "Your edits are still here. Keep editing to retry saving, or explicitly discard them and continue.",
                {
                    type: "warning",
                    confirmText: "Discard and continue",
                    dismissText: "Keep editing",
                    cancelImmediate: true,
                },
            );
            if (!discard) return;
        }
    }
    const current = useProject.getState();
    if (
        current.projectGeneration !== generation
        || current.projectRevision !== revision
    ) return;
    await to();
};
