import * as Tabs from "@radix-ui/react-tabs";
import { Allotment } from "allotment";
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

type Props = { onMount?: () => void };
const sizes = allotmentStorage("game-first-tabs");

export const WorkspaceProject: FC<Props> = ({ onMount }) => {
    const desktop = useMediaQuery({ query: "(min-width: 900px)" });
    const activeTab = useWorkspace(state => state.activeTab);
    const setActiveTab = useWorkspace(state => state.setActiveTab);
    const currentFile = useEditor(state => state.runtime.currentFile);
    const [filesOpen, setFilesOpen] = useState(false);
    const filesRef = useRef<HTMLDivElement>(null);
    const columnsRef = useRef<HTMLElement>(null);
    const [rightWidth, setRightWidth] = useState(() =>
        sizes.getAllotmentSize("editor", [700, 340])[1]
    );
    const [resizing, setResizing] = useState(false);
    const widthRef = useRef(rightWidth);
    useWorkspaceRuntime();

    const resizeColumn = (width: number) => {
        const available = columnsRef.current?.clientWidth ?? window.innerWidth;
        widthRef.current = Math.round(
            Math.max(300, Math.min(width, available - 405)),
        );
        setRightWidth(widthRef.current);
    };
    const rememberColumns = () => {
        const available = columnsRef.current?.clientWidth ?? window.innerWidth;
        sizes.setAllotmentSize("editor", [
            available - widthRef.current - 5,
            widthRef.current,
        ]);
    };

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
        <div className="h-full w-full flex flex-col gap-px bg-base-50 overflow-auto">
            <header className="min-h-11 shrink-0">
                <Toolbar />
            </header>
            <main
                ref={columnsRef}
                className="min-h-0 shrink-0"
                style={{
                    display: desktop ? "grid" : "flex",
                    flexDirection: "column",
                    flex: desktop ? "1 1 0" : undefined,
                    gridTemplateColumns: desktop
                        ? `minmax(400px, 1fr) 5px clamp(300px, ${rightWidth}px, calc(100% - 405px))`
                        : undefined,
                }}
            >
                <div
                    className={`min-w-0 min-h-0 shrink-0 ${
                        resizing ? "pointer-events-none" : ""
                    }`}
                >
                    <WorkspacePreview />
                </div>
                <div
                    hidden={!desktop}
                    role="separator"
                    aria-label="Resize workspace panels"
                    aria-orientation="vertical"
                    aria-valuemin={300}
                    aria-valuenow={rightWidth}
                    tabIndex={0}
                    className="cursor-col-resize touch-none hover:bg-primary/50 focus-visible:bg-primary/50 focus-visible:outline-none"
                    onPointerDown={event => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setResizing(true);
                    }}
                    onPointerMove={event => {
                        if (
                            !event.currentTarget.hasPointerCapture(
                                event.pointerId,
                            )
                        ) return;
                        resizeColumn(
                            (columnsRef.current?.getBoundingClientRect().right
                                ?? window.innerWidth) - event.clientX,
                        );
                    }}
                    onPointerUp={event =>
                        event.currentTarget.releasePointerCapture(
                            event.pointerId,
                        )}
                    onLostPointerCapture={() => {
                        setResizing(false);
                        rememberColumns();
                    }}
                    onDoubleClick={() => {
                        resizeColumn(340);
                        rememberColumns();
                    }}
                    onKeyDown={event => {
                        if (
                            !["ArrowLeft", "ArrowRight", "Home", "End"]
                                .includes(event.key)
                        ) return;
                        event.preventDefault();
                        resizeColumn(
                            event.key === "Home"
                                ? 300
                                : event.key === "End"
                                ? Infinity
                                : widthRef.current
                                    + (event.key === "ArrowLeft" ? 20 : -20),
                        );
                        rememberColumns();
                    }}
                />
                <div
                    className="min-w-0 min-h-0 shrink-0 relative"
                    style={{ height: desktop ? undefined : 800 }}
                >
                    <Allotment
                        vertical
                        defaultSizes={sizes.getAllotmentSize("console", [
                            520,
                            340,
                        ])}
                        onDragEnd={value =>
                            sizes.setAllotmentSize("console", value)}
                    >
                        <Allotment.Pane minSize={280}>
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
                        </Allotment.Pane>
                        <Allotment.Pane minSize={170} className="pt-px">
                            <ConsoleView />
                        </Allotment.Pane>
                    </Allotment>
                </div>
            </main>
        </div>
    );
};
