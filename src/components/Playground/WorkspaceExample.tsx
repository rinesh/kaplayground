import { Allotment, type AllotmentHandle } from "allotment";
import { type FC, useRef } from "react";
import { useMediaQuery } from "react-responsive";
import { WEBMCP_EXAMPLE_NAME } from "../../data/demos.ts";
import { MonacoEditor } from "../../features/Editor/components/MonacoEditor.tsx";
import { useProject } from "../../features/Projects/stores/useProject.ts";
import useConsolePane from "../../hooks/useConsolePane";
import { allotmentStorage } from "../../util/allotmentStorage.ts";
import { cn } from "../../util/cn";
import { scrollbarSize } from "../../util/scrollbarSize.ts";
import { AssetBrew } from "../AssetBrew/AssetBrew.tsx";
import { ConsoleView } from "../ConsoleView/ConsoleView.tsx";
import { Toolbar } from "../Toolbar";
import ExampleList from "../Toolbar/ExampleList";
import ToolbarToolsMenu from "../Toolbar/ToolbarToolsMenu";
import { CodexCoach } from "../WebMCP";
import { GameView } from "./GameView";

type Props = {
    editorIsLoading: boolean;
    isPortrait: boolean;
    onMount?: () => void;
};

export const WorkspaceExample: FC<Props> = (props) => {
    const isWidescreen = useMediaQuery({ query: "(min-width: 900px)" });
    const demoKey = useProject((state) => state.demoKey);
    const isCodexStarter = demoKey === WEBMCP_EXAMPLE_NAME;
    const { getAllotmentSize, setAllotmentSize } = allotmentStorage(
        isCodexStarter ? "codex-play" : "example",
    );
    const consoleAllotmentRef = useRef<AllotmentHandle>(null);

    const { scrollbarThinHeight } = scrollbarSize();
    const assetBrewHeight = 72 + scrollbarThinHeight();

    const {
        consoleVisible,
        consoleExpandedSize,
        consoleMinSize,
        consoleSize,
    } = useConsolePane();

    const handleDragStart = () =>
        document.documentElement.classList.toggle("select-none", true);
    const handleDragEnd = () =>
        document.documentElement.classList.toggle("select-none", false);

    return (
        <div
            className={cn("h-full w-screen flex flex-col gap-px bg-base-50", {
                "hidden": props.editorIsLoading,
            })}
        >
            <header className="h-9 flex flex-col shrink-0">
                {isWidescreen ? <Toolbar /> : <ToolbarToolsMenu />}
            </header>

            <main className="h-full min-h-0 overflow-hidden">
                <Allotment
                    vertical={props.isPortrait}
                    defaultSizes={getAllotmentSize(
                        "editor",
                        isCodexStarter
                            ? props.isPortrait
                                ? [680, 260]
                                : [1100, 280]
                            : [],
                    )}
                    onChange={e => setAllotmentSize("editor", e)}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    key={`${isCodexStarter ? "codex-play" : "example"}-${props.isPortrait}`}
                >
                    {isCodexStarter
                        ? [
                            (
                                <Allotment.Pane
                                    key="codex-preview"
                                    minSize={props.isPortrait ? 360 : 480}
                                >
                                    <div className="flex size-full min-h-0 flex-col gap-px p-px pt-0">
                                        <div className="min-h-0 flex-1">
                                            <GameView />
                                        </div>
                                        <CodexCoach />
                                    </div>
                                </Allotment.Pane>
                            ),
                            (
                                <Allotment.Pane
                                    key="codex-code"
                                    minSize={260}
                                    snap
                                >
                                    <div className="size-full p-px pt-0">
                                        <MonacoEditor onMount={props.onMount} />
                                    </div>
                                </Allotment.Pane>
                            ),
                        ]
                        : [
                            (
                                <Allotment.Pane key="example-editor" snap>
                                    <Allotment
                                        vertical
                                        defaultSizes={getAllotmentSize("brew", [
                                            9999,
                                            assetBrewHeight,
                                        ])}
                                        onChange={e => setAllotmentSize("brew", e)}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                        className="p-px pt-0"
                                    >
                                        <Allotment.Pane>
                                            <MonacoEditor
                                                onMount={props.onMount}
                                            />
                                        </Allotment.Pane>
                                        <Allotment.Pane
                                            className="pt-px"
                                            snap
                                            maxSize={assetBrewHeight + 1}
                                            minSize={assetBrewHeight}
                                            preferredSize={assetBrewHeight}
                                        >
                                            <AssetBrew />
                                        </Allotment.Pane>
                                    </Allotment>
                                </Allotment.Pane>
                            ),
                            (
                                <Allotment.Pane key="example-preview" snap>
                                    <Allotment
                                        ref={consoleAllotmentRef}
                                        vertical
                                        defaultSizes={consoleVisible
                                            ? getAllotmentSize("console", [
                                                9999,
                                                consoleSize,
                                            ])
                                            : [9999, 0]}
                                        onChange={e => setAllotmentSize("console", e)}
                                        className="pr-px pb-px"
                                    >
                                        <Allotment.Pane>
                                            <GameView />
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
                                                    consoleAllotmentRef.current
                                                        ?.resize([
                                                            9999,
                                                            consoleExpandedSize,
                                                        ])}
                                            />
                                        </Allotment.Pane>
                                    </Allotment>
                                </Allotment.Pane>
                            ),
                        ]}
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
