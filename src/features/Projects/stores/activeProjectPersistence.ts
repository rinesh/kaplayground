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
    getDraftId(): string;
    writeProject(id: string, snapshot: Snapshot): Promise<void>;
    onSaving(identity: ActiveProjectIdentity): void;
    onSaved(id: string, identity: ActiveProjectIdentity): void;
    onError(error: unknown, identity: ActiveProjectIdentity): void;
}

export type ProjectSaveStatus = "draft" | "saving" | "saved" | "error";

/** Serializes immutable snapshots, reusing one draft id across saves and retries. */
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
        const id = captured.key ?? dependencies.getDraftId();
        dependencies.onSaving(captured);

        const operation = async () => {
            if (
                dependencies.getActiveIdentity().generation
                    !== captured.generation
            ) {
                throw new Error(
                    "The active project changed while it was saving",
                );
            }
            try {
                await dependencies.writeProject(id, captured.snapshot);
            } catch (error) {
                dependencies.onError(error, captured);
                throw error;
            }

            // An acknowledged older write must not mark newer edits saved.
            dependencies.onSaved(id, captured);
            assertStillActive(dependencies.getActiveIdentity(), captured);

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
        || active.revision !== captured.revision
    ) {
        throw new Error("The active project changed while it was saving");
    }
}
