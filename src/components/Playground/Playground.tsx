import { assets } from "@kaplayjs/crew";
import * as esbuild from "esbuild-wasm";
import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Slide, ToastContainer } from "react-toastify";
import { Tooltip } from "react-tooltip";
import { connectDB } from "../../db/client/db";
import { loadProject } from "../../features/Projects/application/loadProject";
import {
    beginPlaygroundInitialization,
    failPlaygroundInitialization,
    markPlaygroundDatabaseReady,
    markPlaygroundEditorReady,
    markPlaygroundEsbuildReady,
    markPlaygroundProjectReady,
} from "../../features/Projects/application/playgroundReadiness";
import { preferredVersion } from "../../features/Projects/application/preferredVersion";
import { useProject } from "../../features/Projects/stores/useProject";
import { useConfig } from "../../hooks/useConfig";
import { decompressCode } from "../../util/compressCode";
import { debug } from "../../util/logs";
import { AboutDialog } from "../About";
import ConfigDialog from "../Config/ConfigDialog";
import ProjectPreferences from "../Project/ProjectPreferences";
import { ProjectBrowser } from "../ProjectBrowser";
import ExampleList from "../Toolbar/ExampleList";
import { ConfirmDialog } from "../UI/ConfirmDialog";
import { WebMCPButton, WebMCPDialog } from "../WebMCP";
import { LoadingPlayground } from "./LoadingPlayground";
import { WelcomeDialog } from "./WelcomeDialog";
import { WorkspaceExample } from "./WorkspaceExample";
import { WorkspaceProject } from "./WorkspaceProject";

const defaultTheme = localStorage.getItem("theme") as string;
const browserPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
).matches;

document.documentElement.setAttribute(
    "data-theme",
    defaultTheme || (browserPrefersDark ? "Spiker" : "Spiker"),
);

localStorage.setItem(
    "theme",
    defaultTheme || (browserPrefersDark ? "Spiker" : "Spiker"),
);

let esbuildInitialization: Promise<void> | null = null;

const initializeEsbuild = () => {
    esbuildInitialization ??= esbuild.initialize({
        wasmURL: "https://unpkg.com/esbuild-wasm@0.25.8/esbuild.wasm",
        worker: true,
    });
    return esbuildInitialization;
};

const Playground = () => {
    const loadConfig = useConfig((state) => state.loadConfig);
    const projectMode = useProject((state) => state.project.mode);
    const createNewProject = useProject((state) => state.createNewProject);
    const loadSharedDemo = useProject((state) => state.createFromShared);
    const setProject = useProject((state) => state.setProject);
    const isPortrait = useMediaQuery({ query: "(orientation: portrait)" });
    const [loadingProject, setLoadingProject] = useState<boolean>(true);
    const [loadingEditor, setLoadingEditor] = useState<boolean>(true);

    const handleMount = () => {
        markPlaygroundEditorReady();
        setLoadingEditor(false);
    };

    const loadShare = async (sharedCode: string, sharedVersion?: string) => {
        debug(0, "[init] Importing shared code...", decompressCode(sharedCode));
        await loadSharedDemo(decompressCode(sharedCode), sharedVersion);
    };

    const loadDemo = async (demo: string) => {
        debug(0, "[init] Loading demo...", demo);
        await createNewProject("ex", undefined, demo);
    };

    const loadNewProject = async () => {
        debug(0, "[init] No project found, creating a new one...");
        await createNewProject("pj");
    };

    const loadLastOpenedProject = async (lastOpenedProjectId: string) => {
        debug(0, "[init] Loading last opened project...");
        await loadProject(lastOpenedProjectId);
    };

    // First paint
    useEffect(() => {
        let cancelled = false;
        beginPlaygroundInitialization();

        const initializePlayground = async () => {
            const connection = await connectDB();
            if (cancelled) return;
            if (!connection.db) {
                throw connection.error
                    ?? new Error("IndexedDB initialization failed");
            }
            markPlaygroundDatabaseReady();

            // Load global config
            loadConfig();

            // Set initial project KAPLAY version
            setProject({
                kaplayVersion: preferredVersion(),
            });

            // Init saved projects array
            await useProject.getState().updateSavedProjects();

            // Initialize ESBuild
            await initializeEsbuild();
            if (cancelled) return;
            markPlaygroundEsbuildReady();

            // Load the project, default project, shared project, etc.
            const urlParams = new URLSearchParams(window.location.search);
            const lastOpenedPj = useConfig.getState().getConfig()
                .lastOpenedProject;
            const sharedCode = urlParams.get("code");
            const sharedVersion = urlParams.get("version");
            const exampleName = urlParams.get("example");

            if (sharedCode) {
                await loadShare(sharedCode, sharedVersion ?? undefined);
            } else if (exampleName) {
                await loadDemo(exampleName);
            } else if (lastOpenedPj) {
                await loadLastOpenedProject(lastOpenedPj);
            } else {
                await loadNewProject();
            }

            if (!useProject.getState().project.createdAt) {
                throw new Error("The initial project did not finish loading");
            }
            if (cancelled) return;

            setLoadingProject(false);
            markPlaygroundProjectReady();
        };

        void initializePlayground().catch((error: unknown) => {
            if (cancelled) return;
            debug(
                0,
                "[init] Playground initialization failed:",
                error instanceof Error ? error.message : String(error),
            );
            failPlaygroundInitialization(error);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <>
            {loadingProject
                ? (
                    <LoadingPlayground
                        isLoading={loadingEditor}
                        isPortrait={isPortrait}
                        isProject={projectMode === "pj"}
                    />
                )
                : (projectMode === "pj" && isPortrait)
                ? (
                    <>
                        <div className="h-full flex flex-col items-center justify-center bg-base-300 p-4 gap-4">
                            <img src={assets.burpman.outlined} />

                            <p className="max-w-md text-center">
                                Projects are currently not supported in mobile!
                                Please use a desktop device, anyway you can
                                still view demos.
                            </p>

                            <div
                                className={"flex flex-col items-center gap-2 rounded-xl "
                                    + "border border-base-content/10 bg-base-200 px-4 py-3"}
                            >
                                <p className="max-w-sm text-center text-sm text-base-content/65">
                                    WebMCP remains available in this layout.
                                    Open its activity panel to inspect the
                                    registered tools and agent calls.
                                </p>
                                <div className="h-9">
                                    <WebMCPButton />
                                </div>
                            </div>

                            <ExampleList />
                            <ProjectBrowser />
                        </div>
                    </>
                )
                : (
                    <>
                        {projectMode === "pj"
                            ? (
                                <WorkspaceProject
                                    editorIsLoading={loadingEditor}
                                    isPortrait={isPortrait}
                                    onMount={handleMount}
                                />
                            )
                            : (
                                <WorkspaceExample
                                    editorIsLoading={loadingEditor}
                                    isPortrait={isPortrait}
                                    onMount={handleMount}
                                />
                            )}

                        <ToastContainer
                            position="bottom-right"
                            transition={Slide}
                        />
                        <AboutDialog />
                        <ConfigDialog />
                        <Tooltip id="global" />
                        <Tooltip id="global-open" isOpen={true} />
                        <ProjectBrowser />
                        <ProjectPreferences />
                        <WelcomeDialog isLoading={loadingEditor} />
                    </>
                )}

            <WebMCPDialog />
            <ConfirmDialog />
        </>
    );
};

export default Playground;
