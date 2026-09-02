import { KeyCode, KeyMod } from "monaco-editor";

export const keybindings = new Map<number, () => void>();

export const toMonacoKey = (e: KeyboardEvent): number => {
    const eKey = e.key.toLowerCase();
    let key = 0;

    if (e.ctrlKey || e.metaKey) key |= KeyMod.CtrlCmd;
    if (e.shiftKey) key |= KeyMod.Shift;
    if (e.altKey) key |= KeyMod.Alt;

    if (eKey == "e") key |= KeyCode.KeyE;
    if (eKey == "p") key |= KeyCode.KeyP;
    if (eKey == "s") key |= KeyCode.KeyS;
    if (eKey == "\\") key |= KeyCode.Backslash;
    if (eKey == "`") key |= KeyCode.Backquote;

    return key;
};
