import { type FC } from "react";
import { WEBMCP_EXAMPLE_NAME } from "../../integrations/webmcp/constants";
import { cn } from "../../util/cn";

type Props = {
    isLoading: boolean;
    isPortrait: boolean;
    isProject: boolean;
    error?: string | null;
};

export const LoadingPlayground: FC<Props> = (props) => {
    return (
        <div
            className={cn(
                "agent-grid-bg h-full flex flex-col items-center justify-center bg-[#111722]",
                {
                    "hidden": !props.isLoading && !props.error,
                },
            )}
        >
            {props.error
                ? (
                    <div
                        role="alert"
                        className="max-w-md px-6 text-center text-white"
                    >
                        <p className="text-lg font-semibold">
                            Your game couldn't open
                        </p>
                        <p className="mt-3 text-base">{props.error}</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-3">
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => window.location.reload()}
                            >
                                Try again
                            </button>
                            <a
                                className="btn btn-ghost"
                                href={`?example=${WEBMCP_EXAMPLE_NAME}`}
                            >
                                Open starter game
                            </a>
                        </div>
                    </div>
                )
                : (
                    <>
                        <span className="loading loading-dots loading-lg text-primary">
                        </span>
                        <span className="text-lg font-semibold text-white">
                            Getting your game ready…
                        </span>
                        <span className="mt-1 text-xs text-base-content/45">
                            Your tiny bean adventure is almost here
                        </span>
                    </>
                )}
        </div>
    );
};
