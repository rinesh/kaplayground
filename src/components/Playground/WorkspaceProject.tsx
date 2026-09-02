import * as Tabs from "@radix-ui/react-tabs";
import { type FC, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { MonacoEditor } from "../../features/Editor/components/MonacoEditor";
import { useEditor } from "../../hooks/useEditor";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useWorkspaceRuntime } from "../../hooks/useWorkspaceRuntime";
import { allotmentStorage } from "../../util/allotmentStorage";
import { AssetBrowser } from "../Assets/AssetBrowser";
import { ConsoleView } from "../ConsoleView/ConsoleView";
import { FileTree } from "../FileTree";
import { Toolbar } from "../Toolbar";
import { WorkspacePreview } from "./WorkspacePreview";
import { WorkspaceSplit } from "./WorkspaceSplit";
import "./Workspace.css";

type Props = { onMount?: () => void };
const sizes = allotmentStorage("game-first-tabs");

export const WorkspaceProject: FC<Props> = ({ onMount }) => {
    const desktop = useMediaQuery({ query: "(min-width: 900px)" });
    const activeTab = useWorkspace(state => state.activeTab);
    const setActiveTab = useWorkspace(state => state.setActiveTab);
    const visiblePanels = useWorkspace(state => state.visiblePanels);
    const setPanelVisible = useWorkspace(state => state.setPanelVisible);
    const currentFile = useEditor(state => state.runtime.currentFile);
    const [filesOpen, setFilesOpen] = useState(false);
    const filesRef = useRef<HTMLDivElement>(null);
    const [messagesVisible, setMessagesVisible] = useState(true);
    const gameExpanded = visiblePanels.game && !visiblePanels.tools
        && !visiblePanels.tips;
    useWorkspaceRuntime();

    useEffect(() => {
        if (activeTab === "code") {
            requestAnimationFrame(() =>
                useEditor.getState().runtime.editor?.layout()
            );
        }
    }, [activeTab]);

    useEffect(() => {
        if (!filesOpen) return;
        const closeOutside = (event: PointerEvent) => {
            if (!filesRef.current?.contains(event.target as Node)) {
                setFilesOpen(false);
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setFilesOpen(false);
            filesRef.current?.querySelector<HTMLButtonElement>("button")
                ?.focus();
        };
        document.addEventListener("pointerdown", closeOutside);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("pointerdown", closeOutside);
            document.removeEventListener("keydown", escape);
        };
    }, [filesOpen]);

    return (
        <div
            className="workspace-project bg-base-50"
            data-game-expanded={gameExpanded}
        >
            <header className="min-h-11 shrink-0">
                <Toolbar />
            </header>
            <main className="workspace-main">
                <WorkspaceSplit
                    id="workspace-columns"
                    label="Resize workspace panels"
                    className="workspace-columns-container"
                    layoutKey={desktop ? "desktop" : "mobile"}
                    defaultSizes={sizes.getAllotmentSize("editor", [700, 340])}
                    minSizes={[180, 260]}
                    visible={[visiblePanels.game, visiblePanels.tools]}
                    onVisibleChange={(index, visible) =>
                        setPanelVisible(
                            index === 0 ? "game" : "tools",
                            visible,
                        )}
                    onDragEnd={value => {
                        if (value.every(size => size > 0)) {
                            sizes.setAllotmentSize("editor", value);
                        }
                    }}
                >
                    <WorkspacePreview />
                    <WorkspaceSplit
                        id="workspace-tools"
                        label="Resize tools and game messages"
                        vertical
                        defaultSizes={sizes.getAllotmentSize("console", [
                            520,
                            340,
                        ])}
                        minSizes={[280, 170]}
                        snap={[false, true]}
                        visible={[true, messagesVisible]}
                        onVisibleChange={(index, visible) => {
                            if (index === 1) setMessagesVisible(visible);
                        }}
                        onDragEnd={value => {
                            if (value.every(size => size > 0)) {
                                sizes.setAllotmentSize("console", value);
                            }
                        }}
                    >
                        <Tabs.Root
                            value={activeTab}
                            onValueChange={value =>
                                setActiveTab(value as "assets" | "code")}
                            className="flex h-full min-w-0 flex-col rounded-xl bg-base-300 overflow-hidden"
                        >
                            <Tabs.List
                                aria-label="Workspace panels"
                                className="flex h-10 shrink-0 border-b border-base-content/10 bg-base-200/40"
                            >
                                <Tabs.Trigger
                                    value="assets"
                                    className="px-4 text-sm font-semibold data-[state=active]:text-primary data-[state=active]:border-b-2 border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    Assets
                                </Tabs.Trigger>
                                <Tabs.Trigger
                                    value="code"
                                    className="px-4 text-sm font-semibold data-[state=active]:text-primary data-[state=active]:border-b-2 border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    Code
                                </Tabs.Trigger>
                            </Tabs.List>
                            <Tabs.Content
                                value="assets"
                                forceMount
                                className="min-h-0 flex-1 data-[state=inactive]:hidden"
                            >
                                <AssetBrowser />
                            </Tabs.Content>
                            <Tabs.Content
                                value="code"
                                forceMount
                                className="relative flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
                            >
                                <div className="flex h-9 shrink-0 items-center gap-2 px-2 border-b border-base-content/10">
                                    <div
                                        ref={filesRef}
                                        className="shrink-0 z-30"
                                    >
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            aria-expanded={filesOpen}
                                            aria-controls="workspace-files"
                                            onClick={() =>
                                                setFilesOpen(!filesOpen)}
                                        >
                                            Files ▾
                                        </button>
                                        {filesOpen && (
                                            <div
                                                id="workspace-files"
                                                aria-label="Project files"
                                                className="absolute left-2 top-9 z-30 mt-1 w-72 max-w-[85vw] h-[calc(100%-2.75rem)] max-h-96 rounded-xl border border-base-content/20 shadow-xl"
                                            >
                                                <FileTree />
                                            </div>
                                        )}
                                    </div>
                                    <span
                                        className="truncate text-xs font-mono"
                                        title={currentFile}
                                    >
                                        {currentFile}
                                    </span>
                                </div>
                                <div className="min-h-0 flex-1">
                                    <MonacoEditor onMount={onMount} />
                                </div>
                            </Tabs.Content>
                        </Tabs.Root>
                        <div className="h-full pt-px">
                            <ConsoleView />
                        </div>
                    </WorkspaceSplit>
                </WorkspaceSplit>
            </main>
        </div>
    );
};
