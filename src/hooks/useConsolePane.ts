import { useEffect, useState } from "react";
import { useConfig } from "./useConfig";

export const useConsolePane = (
    consoleSize = 34,
    consoleExpandedSize = 180,
) => {
    const consoleVisible = useConfig((s) => s.config.console);
    const [consoleMinSize, setConsoleMinSize] = useState(
        consoleVisible ? consoleSize : 0,
    );
    useEffect(() => {
        setConsoleMinSize(consoleSize);
    }, []);

    return {
        consoleVisible,
        consoleSize,
        consoleExpandedSize,
        consoleMinSize,
    };
};

export default useConsolePane;
