import { FileFold } from "./FileFold";

export const FileTree = () => (
    <div className="h-full overflow-y-auto rounded-xl bg-[#20252e] p-2 scrollbar-thin">
        <FileFold folder="root" level={0} />
        <FileFold
            level={1}
            title="scenes"
            folder="scenes"
            kind="scene"
            toolbar
        />
        <FileFold
            level={1}
            title="objects"
            folder="objects"
            kind="obj"
            toolbar
        />
        <FileFold level={1} title="utils" folder="utils" kind="util" toolbar />
    </div>
);
