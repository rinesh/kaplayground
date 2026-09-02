import type { StateCreator } from "zustand";
import { demos, type Example } from "../../../../data/demos";
import { db } from "../../../../db/client/db";
import { Schema } from "../../../../db/client/schema";
import { useConfig } from "../../../../hooks/useConfig";
import { useEditor } from "../../../../hooks/useEditor";
import { debug } from "../../../../util/logs";
import { uuidv7 } from "../../../../util/uuidv7";
import { createDefaultFiles } from "../../application/createDefaultFiles";
import { preferredVersion } from "../../application/preferredVersion";
import { validateProjectName } from "../../application/validateProjectName";
import type { Asset } from "../../models/Asset.ts";
import type { File } from "../../models/File";
import type { Project } from "../../models/Project";
import type { ProjectMode } from "../../models/ProjectMode";
import {
    createActiveProjectPersister,
    type ProjectSaveStatus,
} from "../activeProjectPersistence";
import { type ProjectStore } from "../useProject.ts";

export type ProjectStorageState = "transient" | "autosaved";

const pendingProjectPersistence = new Map<string, Promise<void>>();

function sameProjectValue(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (left instanceof Map && right instanceof Map) {
        const rightEntries = [...right];
        return left.size === right.size
            && [...left].every(([key, value], index) => {
                // Legacy builds use file insertion order, so reordering is an edit.
                if (rightEntries[index][0] !== key) return false;
                const other = rightEntries[index][1];
                if (Object.is(value, other)) return true;
                if (
                    !value || !other || typeof value !== "object"
                    || typeof other !== "object"
                ) return false;
                return Object.keys(value).length === Object.keys(other).length
                    && Object.keys(value).every(key =>
                        Object.is(value[key], other[key])
                    );
            });
    }
    return false;
}
function queueProjectWrite(id: string, project: Project): Promise<void> {
    const projectSnapshot = {
        ...project,
        files: new Map(project.files),
        assets: new Map(project.assets),
        id,
    };
    return queueProjectPersistenceOperation(id, async () => {
        await db.put("projects", projectSnapshot);
    });
}

function queueProjectDelete(id: string): Promise<void> {
    return queueProjectPersistenceOperation(id, async () => {
        await db.delete("projects", id);
    });
}

function queueProjectPersistenceOperation(
    id: string,
    operation: () => Promise<void>,
): Promise<void> {
    const previous = pendingProjectPersistence.get(id);
    const write = previous
        ? previous.catch(() => {}).then(operation)
        : operation();

    pendingProjectPersistence.set(id, write);
    void write.catch((error: unknown) => {
        debug(
            0,
            "[project] Persistence failed:",
            error instanceof Error ? error.message : String(error),
        );
    });
    void write.then(
        () => {
            if (pendingProjectPersistence.get(id) === write) {
                pendingProjectPersistence.delete(id);
            }
        },
        () => {
            if (pendingProjectPersistence.get(id) === write) {
                pendingProjectPersistence.delete(id);
            }
        },
    );

    return write;
}

export interface ProjectSlice {
    draftProjectId: string;
    persistenceReady: boolean;
    savedRevision: number;
    saveStatus: ProjectSaveStatus;
    saveError: string | null;
    hasUnsavedProjectChanges(): boolean;
    /** Increments whenever the active project is replaced. */
    projectGeneration: number;
    /** Increments whenever the active project's contents change. */
    projectRevision: number;
    /**
     * Current project associated idb key
     */
    projectKey: string | null;
    /**
     * Set current project associated idb key
     */
    setProjectKey: (key: string | null) => void;
    /**
     * Get current demo key
     */
    demoKey: string | null;
    /**
     * Set current demo key
     */
    setDemoKey: (key: string | null) => void;
    /**
     * Current project
     */
    project: Project;
    /**
     * Set current project
     *
     * @param project - Project to set
     */
    setProject(project: Partial<Project>): void;
    /**
     * Creates a new project inside KAPLAYGROUND
     *
     * @param mode - Project mode, example or project
     * @param replace - Optional project to replace in creation
     * @param demoName - Optional demo name to load as a demo
     * @param beforeCommit - Optional final guard run immediately before replacement
     */
    createNewProject(
        mode: ProjectMode,
        replace?: Partial<Project>,
        demoName?: string,
        isShared?: boolean,
        beforeCommit?: () => void,
    ): Promise<void>;
    /**
     * Get project metadata compatible with example demos
     *
     * @param id - Project id
     * @returns Project <Example> object with metadata
     */
    getProjectMetadata(id: string): Promise<Example>;
    /**
     * Create and load new project from passed code
     *
     * @sharedCode string - example code
     * @sharedVersion string - kaplay lib version used
     */
    createFromShared(sharedCode: string, sharedVersion?: string): Promise<void>;
    /**
     * Save project in idb, current if not specified
     *
     * @param id - Optional project id
     * @param project - Optional Project object
     */
    saveProject: (id?: string | null, project?: Project) => Promise<void>;
    /**
     * Save current project as a new project in idb
     * @returns Newly created project id
     */
    saveNewProject(): Promise<string>;
    /**
     * Persist the active project and resolve only after IndexedDB confirms it.
     * Creates and activates a durable project id when the project is transient.
     *
     * @returns The persisted active project id
     */
    persistActiveProject(): Promise<string>;
    /** Whether the active project is transient or has autosave enabled. */
    getProjectStorageState(): ProjectStorageState;
    /**
     * Current project edited state
     */
    projectWasEdited: boolean;
    /**
     * Set current project edited state
     *
     * @param bool - If the project was edited
     */
    setProjectWasEdited: (bool: boolean) => void;
    /**
     * Check if a project is saved in idb
     *
     * @param id - Project id
     * @returns If the project is saved
     */
    projectIsSaved(id: string): Promise<boolean>;
    /**
     * Array of saved project ids
     */
    savedProjects: string[];
    /**
     * Get all saved projects in idb
     *
     * @param filter - Optional filter for the projects
     * @returns Array of raw projects from idb
     */
    getSavedProjects(
        filter?: ProjectMode,
    ): Promise<Schema["projects"]["value"][]>;
    /**
    /**
     * Get all ids of saved projects in idb
     *
     * @param filter - Optional filter for the projects
     * @returns Array of saved project ids
     */
    getSavedProjectIds(filter?: ProjectMode): Promise<string[]>;
    /**
     * Refresh savedProjects from idb
     */
    updateSavedProjects(): Promise<void>;
    /**
     * Get KAPLAY versions used in projects
     *
     * @returns Object of all versions and their cound used in projects
     */
    getProjectVersions(): Promise<Record<string, number>>;
    /**
     * Get KAPLAY minimal versions used in projects
     *
     * @returns Object of all minimal versions and their count used in projects
     */
    getProjectMinVersions(): Promise<Record<string, number>>;
    /**
     * Generate a new id for a project
     *
     * @param createdAt - Optional ISO string date used as the base timestamp
     * @returns Generated project uuidv7 id
     */
    generateId(createdAt?: string): string;
    /**
     * Generate a name based on project mode
     *
     * @param mode - Will be formatted and used as prefix
     * @param isShared - If not own project
     * @returns Generated project name
     */
    generateName(mode: ProjectMode, isShared?: boolean): Promise<string>;
    /**
     * Get project from idb
     *
     * @param id - Project id
     * @returns Project object
     */
    getProject(id: string): Promise<Project>;
    /**
     * Serialize project to a string, current if not specified
     *
     * @param project - Optional Project object
     * @returns Serialized project
     */
    serializeProject(project?: Project): string;
    /**
     * Unserialize a project
     *
     * @param project - Serialized project
     * @returns Project object
     */
    unserializeProject(project: string): Project;
    /**
     * Clone any stored project, current if not specified
     *
     * @param id - Optional roject id
     * @returns If cloned project successfully
     */
    cloneProject(id?: string | null): Promise<boolean>;
    /**
     * Remove project from idb
     *
     * @param id - Project id
     * @returns If removed project successfully
     */
    removeProject(id: string): Promise<boolean>;
}

export const createProjectSlice: StateCreator<
    ProjectStore,
    [],
    [],
    ProjectSlice
> = (set, get) => ({
    draftProjectId: "",
    persistenceReady: false,
    savedRevision: 0,
    saveStatus: "draft",
    saveError: null,
    hasUnsavedProjectChanges() {
        return get().persistenceReady && (
            get().projectRevision !== get().savedRevision
            || get().saveStatus === "saving"
            || get().saveStatus === "error"
        );
    },
    projectGeneration: 0,
    projectRevision: 0,
    project: {
        name: "Untitled",
        version: "2.0.0",
        files: new Map(),
        assets: new Map(),
        mode: "pj",
        buildMode: "esbuild",
        kaplayVersion: "",
        createdAt: "",
        updatedAt: "",
        favicon: "",
    },
    projectKey: null,
    setProjectKey(key) {
        set(() => ({
            projectKey: key,
        }));
    },
    demoKey: null,
    setDemoKey(key) {
        set(() => ({
            demoKey: key,
        }));
    },
    setProject: (project) => {
        if (
            Object.entries(project).every(([key, value]) =>
                sameProjectValue(get().project[key as keyof Project], value)
            )
        ) return;
        set((state) => ({
            projectRevision: state.projectRevision + 1,
            project: {
                ...get().project,
                ...project,
                updatedAt: new Date().toISOString(),
            },
        }));

        if (get().persistenceReady) {
            set({ projectWasEdited: true });
            void get().saveProject().catch(() => {});
        }
    },
    projectWasEdited: false,
    setProjectWasEdited(bool) {
        set(() => ({
            projectWasEdited: bool,
        }));
    },
    async projectIsSaved(id: string) {
        return (await get().getSavedProjectIds()).includes(id);
    },
    savedProjects: [],
    async getSavedProjects(filter) {
        return (await db.transaction("projects").store.index("mode").getAll(
            filter,
        ));
    },
    async getSavedProjectIds(filter) {
        return (await get().getSavedProjects(filter)).map(p => p.id);
    },
    async updateSavedProjects() {
        const savedProjects = await get().getSavedProjectIds();

        set(() => ({
            savedProjects,
        }));
    },
    async getProjectMetadata(key) {
        const project = key == get().projectKey
            ? get().project
            : await get().getProject(key);
        const metadata = {
            key: key,
            name: project.name,
            formattedName: project.name,
            type: "Project",
            category: "KAPLAY",
            code: "",
            group: "Projects",
            minVersion: project.kaplayVersion.split(".").slice(0, 2).join("."),
            sortName: project.name,
            locked: true,
            tags: [],
            description: "",
            version: project.kaplayVersion,
            createdAt: project?.createdAt ?? "",
            updatedAt: project?.updatedAt ?? "",
            buildMode: project.buildMode,
        };

        return metadata satisfies Example;
    },
    async getProjectVersions() {
        const projectVersions = (await get().getSavedProjects()).map(project =>
            project.kaplayVersion
        );

        return Object.fromEntries(
            [...new Set(projectVersions)]
                .sort((a, b) => b.localeCompare(a))
                .map(
                    version => [
                        version,
                        projectVersions.filter(v => v == version).length,
                    ],
                ),
        );
    },
    async getProjectMinVersions() {
        const projectMinVersions = (await get().getSavedProjects()).map(
            project => project.kaplayVersion.split(".").slice(0, 2).join("."),
        );

        return Object.fromEntries(
            [...new Set(projectMinVersions)]
                .sort((a, b) => b.localeCompare(a))
                .map(
                    version => [
                        version,
                        projectMinVersions.filter(v => v == version).length,
                    ],
                ),
        );
    },

    // #region Project Creation

    async createNewProject(
        mode,
        replace,
        demoName,
        isShared,
        beforeCommit,
    ) {
        const initialGeneration = get().projectGeneration;
        const initialRevision = get().projectRevision;
        const files = new Map<string, File>();
        const assets = new Map<string, Asset>();
        let loadDefaultFiles = false;
        let demoProjectName: string | undefined;

        let version = preferredVersion();

        if (mode === "ex") {
            if (demoName) {
                const foundDemo = demos.find((demo) => {
                    return demo.name == demoName;
                });

                if (foundDemo === undefined) {
                    debug(2, `[project] Demo with id ${demoName} not found`);
                    return;
                }

                files.set("main.js", {
                    kind: "main",
                    language: "javascript",
                    path: "main.js",
                    value: foundDemo.code,
                });

                version = foundDemo.version;
                demoProjectName = foundDemo.formattedName;

                debug(0, "[project] Demo loaded", foundDemo.name);
            } else {
                debug(0, "[project] Created a new example project");
                loadDefaultFiles = !replace?.files;
            }
        } else {
            debug(0, "[project] Created a new project");
            loadDefaultFiles = !replace?.files;
        }

        const name = demoProjectName
            ?? await get().generateName(mode, isShared);

        if (
            get().projectGeneration !== initialGeneration
            || get().projectRevision !== initialRevision
        ) {
            throw new Error(
                "The active project changed while the starting point was loading. Try again.",
            );
        }
        beforeCommit?.();
        set((state) => ({
            projectGeneration: state.projectGeneration + 1,
            projectRevision: state.projectRevision + 1,
            persistenceReady: false,
            uploadingAssets: new Map(),
            draftProjectId: get().generateId(),
            saveStatus: "draft",
            saveError: null,
            projectWasEdited: false,
            project: {
                name: name,
                version: "2.0.0", // fixed project version
                files: files,
                assets: assets,
                mode: mode,
                buildMode: "esbuild",
                kaplayVersion: version,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                favicon: "",
                ...replace,
                sourceDemoKey: demoName ?? replace?.sourceDemoKey,
            },
            projectKey: null,
            demoKey: demoName ?? null,
        }));

        const url = new URL(window.location.href);
        if (demoName) {
            url.searchParams.set("example", demoName);
        } else {
            url.searchParams.delete("example");
        }
        window.history.replaceState({}, "", url);

        if (loadDefaultFiles) {
            createDefaultFiles();
        }

        set({ persistenceReady: true, savedRevision: get().projectRevision });
    },

    async createFromShared(sharedCode, sharedVersion) {
        await get().createNewProject(
            "ex",
            {
                assets: new Map(),
                files: new Map([
                    [
                        "main.js",
                        {
                            kind: "main",
                            language: "javascript",
                            name: "main.js",
                            path: "main.js",
                            value: sharedCode,
                        },
                    ],
                ]),
                kaplayVersion: sharedVersion ?? preferredVersion(),
            },
            undefined,
            true,
        );
    },

    // #endregion

    // #region Project saving

    async saveProject(id = get().projectKey, project) {
        if (id && id !== get().projectKey && project) {
            await queueProjectWrite(id, {
                ...project,
                updatedAt: new Date().toISOString(),
            });
            set({ savedProjects: [...get().savedProjects] });
        } else {
            await get().persistActiveProject();
        }
    },

    saveNewProject() {
        return get().persistActiveProject();
    },

    persistActiveProject: createActiveProjectPersister({
        getActiveProject: () => ({
            generation: get().projectGeneration,
            key: get().projectKey,
            revision: get().projectRevision,
            project: get().project,
        }),
        getActiveIdentity: () => ({
            generation: get().projectGeneration,
            key: get().projectKey,
            revision: get().projectRevision,
        }),
        snapshotProject: (project) => ({
            ...project,
            files: new Map(
                [...project.files].map(([path, file]) => [
                    path,
                    { ...file },
                ]),
            ),
            assets: new Map(
                [...project.assets].map(([path, asset]) => [
                    path,
                    { ...asset },
                ]),
            ),
        }),
        getDraftId: () => get().draftProjectId,
        writeProject: queueProjectWrite,
        onSaving: () => set({ saveStatus: "saving", saveError: null }),
        onError: (error, identity) => {
            if (
                get().projectGeneration !== identity.generation
                || get().projectRevision !== identity.revision
            ) return;
            set({
                saveStatus: "error",
                saveError: error instanceof Error
                    ? error.message
                    : String(error),
            });
        },
        onSaved: (id, identity) => {
            if (get().projectGeneration !== identity.generation) return;
            const promoted = get().projectKey === null;
            set({
                projectKey: id,
                demoKey: null,
                savedRevision: identity.revision,
                saveStatus: get().projectRevision === identity.revision
                    ? "saved"
                    : "saving",
                saveError: null,
                savedProjects: get().savedProjects.includes(id)
                    ? get().savedProjects
                    : [...get().savedProjects, id],
            });
            if (promoted) {
                const url = new URL(window.location.href);
                url.searchParams.delete("example");
                url.searchParams.delete("code");
                url.searchParams.delete("version");
                window.history.replaceState({}, "", url);
                useConfig.getState().setConfig({ lastOpenedProject: id });
            }
            useEditor.getState().updateHasUnsavedChanges();
        },
    }),

    getProjectStorageState() {
        return get().projectKey === null ? "transient" : "autosaved";
    },

    generateId(createdAt) {
        return uuidv7(
            createdAt
                ? {
                    msecs: Date.parse(createdAt),
                }
                : {},
        );
    },

    async generateName(_mode, isShared = false) {
        const modePrefix = "Project";
        const isSharedSufix = isShared ? " (Shared)" : "";
        const projects = await db.getAll("projects");

        const name = (num: number) => `${modePrefix} #${num}`;
        const nameIsTaken = (num: number) =>
            projects.some(project =>
                [name(num), name(num) + isSharedSufix].includes(
                    project.name.trim(),
                )
            );

        let num = projects.length + 1;
        while (nameIsTaken(num)) num++;

        return name(num) + isSharedSufix;
    },

    async getProject(id: string) {
        const project = await db.get("projects", id);

        if (!project) {
            throw new Error(
                `Tried to load a project that doesn't exist: ${id}`,
            );
        }

        return project;
    },

    serializeProject(project = get().project) {
        return JSON.stringify({
            ...project,
            files: Array.from(project.files.entries()),
            assets: Array.from(project.assets.entries()),
        });
    },

    unserializeProject(project) {
        const unserialized = JSON.parse(project);

        const parsedProject =
            (unserialized?.state ? unserialized.state.project : unserialized) as
                & Omit<Project, "files" | "assets">
                & {
                    assets: [string, Asset][];
                    files: [string, File][];
                };

        return {
            ...parsedProject,
            kaplayVersion: parsedProject.kaplayVersion == "none"
                ? "master"
                : parsedProject.kaplayVersion,
            buildMode: parsedProject.buildMode || "legacy",
            files: new Map<string, File>(parsedProject.files),
            assets: new Map<string, Asset>(parsedProject.assets),
        };
    },

    async cloneProject(id = get().projectKey) {
        if (!id) return false;

        const project = id == get().projectKey
            ? get().project
            : await get().getProject(id);

        const newId = get().generateId();

        const suffixedName = (name: string): string => {
            const suffix = name.match(/\s*\(copy(?:\s+(\d+))?\)$/);
            if (suffix) {
                const version = parseInt(suffix[1] || "1", 10);
                return name.replace(
                    /\s*\(copy(?:\s+\d+)?\)$/,
                    ` (copy ${version + 1})`,
                );
            }
            return `${name} (copy)`;
        };

        let newName = suffixedName(project.name);

        while (!(await validateProjectName(newName, id))[0]) {
            newName = suffixedName(newName);
        }

        await db.put("projects", {
            ...project,
            name: newName,
            createdAt: new Date().toISOString(),
            id: newId,
        });

        set(() => ({
            savedProjects: [...get().savedProjects, newId],
        }));

        return true;
    },
    // #endregion

    async removeProject(id) {
        if (!get().savedProjects.includes(id)) return false;

        if (get().projectKey === id) {
            const generation = get().projectGeneration;
            await get().persistActiveProject();
            if (
                get().projectGeneration !== generation
                || get().projectKey !== id
            ) {
                throw new Error(
                    "The active project changed before it could be deleted.",
                );
            }
            // Keep an editable draft, but invalidate old queued writes before
            // deleting the saved record so autosave cannot resurrect its id.
            set(state => ({
                projectGeneration: state.projectGeneration + 1,
                projectRevision: state.projectRevision + 1,
                savedRevision: state.projectRevision + 1,
                projectKey: null,
                demoKey: null,
                draftProjectId: get().generateId(),
                saveStatus: "draft",
                saveError: null,
                projectWasEdited: false,
            }));
        }

        await queueProjectDelete(id);

        set(() => ({
            savedProjects: get().savedProjects.filter(pid => pid != id),
        }));

        if (useConfig.getState().config?.lastOpenedProject === id) {
            useConfig.getState().setConfig({ lastOpenedProject: null });
        }

        return true;
    },
});
