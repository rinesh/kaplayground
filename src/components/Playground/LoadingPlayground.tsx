import { type FC } from "react";
import { cn } from "../../util/cn";

type Props = {
    isLoading: boolean;
    isPortrait: boolean;
    isProject: boolean;
};

export const LoadingPlayground: FC<Props> = (props) => {
    return (
        <div
            className={cn(
                "agent-grid-bg h-full flex flex-col items-center justify-center bg-[#111722]",
                {
                    "hidden": !props.isLoading,
                },
            )}
        >
            <span className="loading loading-dots loading-lg text-primary">
            </span>
            <span className="text-lg font-semibold text-white">
                Getting your game ready…
            </span>
            <span className="mt-1 text-xs text-base-content/45">
                Your tiny bean adventure is almost here
            </span>
        </div>
    );
};
