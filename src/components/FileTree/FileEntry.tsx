import { assets, SpriteCrewAsset } from "@kaplayjs/crew";
import type { FC, MouseEventHandler } from "react";
import { cn } from "../../util/cn";
import { removeExtension } from "../../util/removeExtensions";
import "./FileEntry.css";
import { basename } from "../../features/Projects/application/path";
import type { File } from "../../features/Projects/models/File";
import type { FileKind } from "../../features/Projects/models/FileKind";
import { useProject } from "../../features/Projects/stores/useProject";
import { useEditor } from "../../hooks/useEditor";
import { confirm } from "../../util/confirm";

export const logoByKind: Record<FileKind, string> = {
    kaplay: assets.dino.outlined,
    scene: assets.art.outlined,
    main: assets.play.outlined,
    assets: assets.assetbrew.outlined,
    obj: assets.grass.outlined,
    util: assets.toolbox.outlined,
};

const FileButton: FC<{
    onClick: MouseEventHandler;
    icon: SpriteCrewAsset;
    label: string;
    rotate?: 0 | 90 | 180 | 270;
    hidden?: boolean;
}> = (props) => {
    return (
        <button
            type="button"
            aria-label={props.label}
            className="btn btn-ghost btn-xs rounded-md px-1 [.btn-primary_&:hover]:bg-white/30"
            onClick={props.onClick}
            hidden={props.hidden}
        >
            <img
                src={assets[props.icon].outlined}
                alt=""
                className="h-4 data-[rotation=90]:rotate-90 data-[rotation=180]:rotate-180 data-[rotation=270]:-rotate-90"
                data-rotation={props.rotate}
            />
        </button>
    );
};

interface FileEntryProps {
    file: File;
}

export const FileEntry: FC<FileEntryProps> = ({ file }) => {
    const removeFile = useProject((s) => s.removeFile);
    const projectFiles = useProject((s) => s.project.files);
    const setProject = useProject((s) => s.setProject);
    const setCurrentFile = useEditor((s) => s.setCurrentFile);
    const currentFile = useEditor((s) => s.runtime.currentFile);

    const isRoot = () => !file.path.includes("/");

    const handleClick: MouseEventHandler = () => {
        setCurrentFile(file.path);
    };

    const handleDelete: MouseEventHandler = async (e) => {
        e.stopPropagation();

        if (file.kind === "kaplay" || file.kind === "main") {
            await confirm("You cannot remove this file", null, {
                type: "neutral",
            });
            return;
        }

        if (
            await confirm(
                `Remove the '${removeExtension(basename(file.path))}' ${
                    file.kind == "obj" ? "object" : file.kind
                }?`,
                null,
                {
                    confirmText: "Yes, remove",
                    dismissText: "No, keep",
                    type: "danger",
                },
            )
        ) {
            removeFile(file.path);
            setCurrentFile("main.js");
            const { monaco, viewStates } = useEditor.getState().runtime;
            monaco?.editor.getModel(monaco.Uri.file(file.path))?.dispose();
            delete viewStates[file.path];
        }
    };

    const handleMoveUp: MouseEventHandler = (e) => {
        e.stopPropagation();

        // order the map with the file one step up
        const files = projectFiles;
        const order = Array.from(files.keys());
        const index = order.indexOf(file.path);

        if (index === 0) return;

        const newOrder = [...order];
        newOrder.splice(index, 1);

        newOrder.splice(index - 1, 0, file.path);

        const newFiles = new Map(
            newOrder.map((path) => [path, files.get(path)!]),
        );

        setProject({
            ...projectFiles,
            files: newFiles,
        });
    };

    const handleMoveDown: MouseEventHandler = (e) => {
        e.stopPropagation();

        // order the map with the file one step down
        const files = projectFiles;
        const order = Array.from(files.keys());
        const index = order.indexOf(file.path);

        if (index === order.length - 1) return;

        const newOrder = [...order];
        newOrder.splice(index, 1);

        newOrder.splice(index + 1, 0, file.path);

        const newFiles = new Map(
            newOrder.map((path) => [path, files.get(path)!]),
        );

        setProject({
            ...projectFiles,
            files: newFiles,
        });
    };

    return (
        <div
            className={cn(
                "file btn btn-sm w-full justify-start pl-2 pr-0.5 h-[1.875rem] min-h-0",
                {
                    "font-normal pl-3": !isRoot(),
                    "bg-base-100 hover:bg-base-100": currentFile === file.path,
                    "btn-ghost": currentFile !== file.path,
                },
            )}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            aria-label={`Open ${file.path}`}
            aria-current={currentFile === file.path ? "page" : undefined}
            onKeyDown={event => {
                if (
                    event.target === event.currentTarget
                    && (event.key === "Enter" || event.key === " ")
                ) {
                    event.preventDefault();
                    setCurrentFile(file.path);
                }
            }}
            data-file-kind={file.kind}
        >
            {isRoot() && (
                <img
                    src={logoByKind[file.kind]}
                    alt={file.kind}
                    className="w-4 h-4 ml-auto object-scale-down"
                />
            )}
            <span className="text-left truncate w-[50%] flex-1 py-0.5">
                {removeExtension(basename(file.path))}
            </span>
            <div role="toolbar" className="file-actions hidden">
                <FileButton
                    onClick={handleDelete}
                    icon="trash"
                    label={`Delete ${file.path}`}
                />
                <FileButton
                    onClick={handleMoveUp}
                    icon="arrow"
                    label={`Move ${file.path} up`}
                    rotate={270}
                />
                <FileButton
                    onClick={handleMoveDown}
                    icon="arrow"
                    label={`Move ${file.path} down`}
                    rotate={90}
                />
            </div>
        </div>
    );
};
