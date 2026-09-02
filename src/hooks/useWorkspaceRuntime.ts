import { KeyCode, KeyMod } from "monaco-editor";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { SANDBOX_ORIGIN } from "../config/common";
import {
    keybindings,
    toMonacoKey,
} from "../features/Editor/application/makeKeybindingsGlobal";
import { synchronizeProjectModels } from "../features/Editor/application/projectModels";
import { useProject } from "../features/Projects/stores/useProject";
import { useBeforeUnload } from "./useBeforeUnload";
import { useConfig } from "./useConfig";
import { useEditor } from "./useEditor";
import { gameConsoleCapture } from "./useGameConsole";
import { useWorkspace } from "./useWorkspace";

/** Project startup and global actions do not depend on the selected panel. */
export function useWorkspaceRuntime() {
    const generation = useProject(state => state.projectGeneration);
    const ready = useProject(state => state.persistenceReady);
    const dirty = useProject(state => state.hasUnsavedProjectChanges());
    const startedGeneration = useRef<number | null>(null);
    useBeforeUnload(dirty);

    useEffect(() => {
        useEditor.getState().updateHasUnsavedChanges();
    }, [dirty]);

    useEffect(() => {
        if (!ready || startedGeneration.current === generation) return;
        startedGeneration.current = generation;
        const editor = useEditor.getState();
        const project = useProject.getState();
        if (editor.runtime.monaco) {
            synchronizeProjectModels(
                editor.runtime.monaco,
                project.project.files,
            );
        }
        editor.setRuntime({ viewStates: {} });
        editor.setCurrentFile(
            project.getMainFile()?.path ?? [...project.project.files.keys()][0]
                ?? "main.js",
        );
        void editor.run().catch(reportRunError);
    }, [generation, ready]);

    useEffect(() => {
        const focusCode = () => {
            useWorkspace.getState().setActiveTab("code");
            requestAnimationFrame(() =>
                useEditor.getState().runtime.editor?.focus()
            );
        };
        const run = async () => {
            if (useConfig.getState().config.autoFormat) {
                await useEditor.getState().runtime.editor?.getAction(
                    "format-kaplay",
                )?.run();
            }
            await useEditor.getState().run().catch(reportRunError);
        };
        const bindings = new Map<number, () => void>([
            [KeyMod.CtrlCmd | KeyCode.KeyS, () => void run()],
            [KeyMod.CtrlCmd | KeyCode.KeyP, () => useEditor.getState().pause()],
            [
                KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyP,
                () => useEditor.getState().stop(),
            ],
            [
                KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyS,
                () => useEditor.getState().stop(),
            ],
            [KeyMod.CtrlCmd | KeyCode.KeyE, focusCode],
        ]);
        const toggleFocus = () => {
            const editor = useEditor.getState();
            if (editor.runtime.editor?.hasTextFocus()) editor.focusGame();
            else focusCode();
        };
        bindings.set(KeyMod.CtrlCmd | KeyCode.Backquote, toggleFocus);
        bindings.set(KeyMod.CtrlCmd | KeyCode.Backslash, toggleFocus);
        bindings.forEach((action, key) => keybindings.set(key, action));

        const onKey = (event: KeyboardEvent) => {
            if (
                event.target instanceof HTMLInputElement
                || event.target instanceof HTMLTextAreaElement
                || (event.target as HTMLElement)?.isContentEditable
            ) return;
            const action = bindings.get(toMonacoKey(event));
            if (action) {
                event.preventDefault();
                action();
            }
        };
        const onMessage = (event: MessageEvent) => {
            const iframe = useEditor.getState().runtime.iframe?.contentWindow;
            if (
                !iframe || event.source !== iframe
                || event.origin !== SANDBOX_ORIGIN
            ) return;
            if (
                event.data?.type !== "KEY_BINDING"
                || typeof event.data.e?.key !== "string"
            ) return;
            bindings.get(toMonacoKey(event.data.e))?.();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("message", onMessage);
            bindings.forEach((action, key) => {
                if (keybindings.get(key) === action) keybindings.delete(key);
            });
        };
    }, []);
}

function reportRunError(error: unknown) {
    // A replacement run can cancel an in-flight startup without being a game error.
    if (error instanceof Error && error.name === "AbortError") return;
    const message = error instanceof Error ? error.message : String(error);
    toast.error(message);
    gameConsoleCapture.add({
        timestamp: Date.now(),
        runId: useEditor.getState().previewRunId,
        level: "error",
        values: [message],
    });
}
