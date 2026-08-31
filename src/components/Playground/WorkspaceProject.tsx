import { Allotment, type AllotmentHandle, LayoutPriority } from "allotment";
import { type CSSProperties, type FC, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { useDebouncedCallback } from "use-debounce";
import { MonacoEditor } from "../../features/Editor/components/MonacoEditor.tsx";
import useConsolePane from "../../hooks/useConsolePane";
import { allotmentStorage } from "../../util/allotmentStorage";
import { cn } from "../../util/cn";
import { Assets } from "../Assets";
import { ConsoleView } from "../ConsoleView/ConsoleView.tsx";
import { FileTree } from "../FileTree";
import { Toolbar } from "../Toolbar";
import ExampleList from "../Toolbar/ExampleList";
import ToolbarToolsMenu from "../Toolbar/ToolbarToolsMenu";
import { WorkspacePreview } from "./WorkspacePreview";

type Props = {
    editorIsLoading: boolean;
    isPortrait: boolean;
    onMount?: () => void;
};

// The nested pane topology cannot reuse sizes from the legacy project layout.
const projectWorkspaceStorage = allotmentStorage("project-agent");

export const WorkspaceProject: FC<Props> = (props) => {
    const isWidescreen = useMediaQuery({ query: "(min-width: 900px)" });
    const consoleAllotmentRef = useRef<AllotmentHandle>(null);

    const {
        consoleVisible,
        consoleExpandedSize,
        consoleMinSize,
        consoleSize,
    } = useConsolePane();

    const [workspaceSizes, setWorkspaceSizes] = useState<number[]>([]);
    const [fileTreeSizes, setFileTreeSizes] = useState<number[]>([]);

    const persistWorkspaceSizes = useDebouncedCallback((e: number[]) => {
        projectWorkspaceStorage.setAllotmentSize("editor", e);
    }, 1000);
    const persistFileTreeSizes = useDebouncedCallback((e: number[]) => {
        projectWorkspaceStorage.setAllotmentSize("files", e);
    }, 1000);

    const handleWorkspaceChange = (e: number[]) => {
        setWorkspaceSizes(e);
        persistWorkspaceSizes(e);
    };
    const handleFileTreeChange = (e: number[]) => {
        setFileTreeSizes(e);
        persistFileTreeSizes(e);
    };

    const handleDragStart = () =>
        document.documentElement.classList.toggle("select-none", true);
    const handleDragEnd = () =>
        document.documentElement.classList.toggle("select-none", false);
    const editorOffset = (props.isPortrait ? 0 : workspaceSizes[0] ?? 0)
        + (fileTreeSizes[0] ?? 0);

    return (
        <div
            className={cn("h-full w-screen flex flex-col gap-px bg-base-50", {
                "hidden": props.editorIsLoading,
            })}
            style={{
                "--monaco-editor-offset": `${editorOffset}px`,
            } as CSSProperties}
        >
            <header className="h-9 flex flex-col shrink-0">
                {isWidescreen ? <Toolbar /> : <ToolbarToolsMenu />}
            </header>

            <main className="h-full min-h-0 overflow-hidden">
                <Allotment
                    vertical={props.isPortrait}
                    defaultSizes={projectWorkspaceStorage.getAllotmentSize(
                        "editor",
                        props.isPortrait ? [680, 430] : [660, 440],
                    )}
                    onChange={handleWorkspaceChange}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    key={`codex-play-${props.isPortrait}`}
                >
                    <Allotment.Pane
                        key="codex-preview"
                        minSize={props.isPortrait ? 360 : 480}
                    >
                        <WorkspacePreview />
                    </Allotment.Pane>
                    <Allotment.Pane
                        key="codex-code"
                        minSize={430}
                        snap
                    >
                        <Allotment
                            ref={consoleAllotmentRef}
                            vertical
                            defaultSizes={consoleVisible
                                ? projectWorkspaceStorage.getAllotmentSize(
                                    "console",
                                    [
                                        9999,
                                        consoleSize,
                                    ],
                                )
                                : [9999, 0]}
                            onChange={e =>
                                projectWorkspaceStorage.setAllotmentSize(
                                    "console",
                                    e,
                                )}
                            className="p-px pt-0"
                        >
                            <Allotment.Pane>
                                <Allotment
                                    defaultSizes={projectWorkspaceStorage
                                        .getAllotmentSize(
                                            "files",
                                            [190, 9999],
                                        )}
                                    onChange={handleFileTreeChange}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                >
                                    <Allotment.Pane
                                        snap
                                        minSize={170}
                                        preferredSize={190}
                                        priority={LayoutPriority.Low}
                                        className="pr-px"
                                    >
                                        <FileTree />
                                    </Allotment.Pane>
                                    <Allotment.Pane minSize={260} snap>
                                        <Allotment
                                            vertical
                                            defaultSizes={projectWorkspaceStorage
                                                .getAllotmentSize("brew", [
                                                    9999,
                                                    210,
                                                ])}
                                            onChange={e =>
                                                projectWorkspaceStorage
                                                    .setAllotmentSize(
                                                        "brew",
                                                        e,
                                                    )}
                                            onDragStart={handleDragStart}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <Allotment.Pane minSize={120}>
                                                <MonacoEditor
                                                    onMount={props.onMount}
                                                />
                                            </Allotment.Pane>
                                            <Allotment.Pane
                                                snap
                                                minSize={120}
                                                preferredSize={210}
                                                className="pt-px"
                                            >
                                                <Assets />
                                            </Allotment.Pane>
                                        </Allotment>
                                    </Allotment.Pane>
                                </Allotment>
                            </Allotment.Pane>
                            <Allotment.Pane
                                className="pt-px"
                                snap
                                minSize={consoleMinSize}
                                preferredSize={consoleSize}
                                visible={consoleVisible}
                            >
                                <ConsoleView
                                    onSelectWebMCP={() =>
                                        consoleAllotmentRef.current?.resize([
                                            9999,
                                            consoleExpandedSize,
                                        ])}
                                />
                            </Allotment.Pane>
                        </Allotment>
                    </Allotment.Pane>
                </Allotment>
            </main>

            {!isWidescreen && (
                <footer className="h-9 flex justify-center items-center -mt-px px-1 bg-base-300 rounded-t-xl">
                    <ExampleList />
                </footer>
            )}
        </div>
    );
};
