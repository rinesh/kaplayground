export interface ActiveProjectIdentity {
    generation: number;
    key: string | null;
    revision: number;
}

export interface ActiveProjectState<Project> extends ActiveProjectIdentity {
    project: Project;
}

interface ActiveProjectPersistenceDependencies<Project, Snapshot> {
    getActiveProject(): ActiveProjectState<Project>;
    getActiveIdentity(): ActiveProjectIdentity;
    snapshotProject(project: Project): Snapshot;
    generateId(snapshot: Snapshot): string;
    writeProject(id: string, snapshot: Snapshot): Promise<void>;
    deleteProject(id: string): Promise<void>;
    commitTransientProject(id: string): void;
}

/** Serializes explicit saves while binding each request to its call-time project. */
export function createActiveProjectPersister<Project, Snapshot>(
    dependencies: ActiveProjectPersistenceDependencies<Project, Snapshot>,
): () => Promise<string> {
    let persistenceTail: Promise<void> = Promise.resolve();

    return () => {
        const active = dependencies.getActiveProject();
        const captured = {
            generation: active.generation,
            key: active.key,
            revision: active.revision,
            snapshot: dependencies.snapshotProject(active.project),
        };
        const id = captured.key ?? dependencies.generateId(captured.snapshot);

        const operation = async () => {
            assertStillActive(dependencies.getActiveIdentity(), captured);

            await dependencies.writeProject(id, captured.snapshot);

            try {
                assertStillActive(dependencies.getActiveIdentity(), captured);
            } catch (error) {
                if (captured.key === null) {
                    await dependencies.deleteProject(id);
                }
                throw error;
            }

            if (captured.key === null) {
                dependencies.commitTransientProject(id);
            }

            return id;
        };

        const result = persistenceTail.then(operation, operation);
        persistenceTail = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    };
}

function assertStillActive(
    active: ActiveProjectIdentity,
    captured: ActiveProjectIdentity,
): void {
    if (
        active.generation !== captured.generation
        || active.key !== captured.key
        || active.revision !== captured.revision
    ) {
        throw new Error("The active project changed while it was saving");
    }
}
