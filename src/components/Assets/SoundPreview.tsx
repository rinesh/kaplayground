import { useEffect, useRef, useState } from "react";

export const SoundPreview = ({ src, name }: { src: string; name: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading",
    );
    const [duration, setDuration] = useState<number | null>(null);

    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            audio?.pause();
        };
    }, []);

    return (
        <div className="mt-2">
            <audio
                ref={audioRef}
                controls
                preload="metadata"
                src={src}
                aria-label={`Preview ${name}`}
                className="h-8 w-full"
                onLoadStart={() => {
                    setStatus("loading");
                    setDuration(null);
                }}
                onLoadedMetadata={event => {
                    setStatus("ready");
                    setDuration(event.currentTarget.duration);
                }}
                onError={() => setStatus("error")}
            />
            {status === "loading" && (
                <p role="status" className="mt-1 text-xs text-base-content/65">
                    Loading sound…
                </p>
            )}
            {status === "ready" && duration !== null && duration < 1 && (
                <p className="mt-1 text-xs text-base-content/65">
                    Short clip · {duration.toFixed(2)} seconds
                </p>
            )}
            {status === "error" && (
                <div role="alert" className="mt-1 text-xs text-error">
                    <p>Couldn't load this sound.</p>
                    <button
                        type="button"
                        className="btn btn-xs btn-ghost mt-1"
                        onClick={() =>
                            audioRef.current?.load()}
                    >
                        Retry sound
                    </button>
                </div>
            )}
        </div>
    );
};
