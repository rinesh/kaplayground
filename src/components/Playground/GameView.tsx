import { assets } from "@kaplayjs/crew";
import {
    type FC,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useEditor } from "../../hooks/useEditor";
import { FocusFrame, useFocusFrameRef } from "../UI/FocusFrame";

export const GameView: FC = () => {
    const stopped = useEditor((s) => s.stopped);
    const setRuntime = useEditor((state) => state.setRuntime);
    const run = useEditor((s) => s.run);
    const [iframeHidden, setIframeHidden] = useState(stopped);
    const focusFrameRef = useFocusFrameRef();
    const containerRef = useRef<HTMLDivElement>(null);
    const frameElement = useRef<HTMLIFrameElement | null>(null);
    const iframeSrc = useMemo(() => useEditor.getState().getIframeSrc(), []);

    const updateFrameSize = useCallback(() => {
        const iframe = frameElement.current;
        const container = iframe?.parentElement;
        if (!iframe || !container?.clientWidth || !container.clientHeight) {
            return;
        }
        iframe.style.width = `${container.clientWidth}px`;
        iframe.style.height = `${container.clientHeight}px`;
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        let frame = 0;
        // Allotment lays out panes inside ResizeObserver. Resize the iframe in
        // the next frame so its canvas doesn't receive an intermediate layout.
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(updateFrameSize);
        });
        observer.observe(containerRef.current);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [updateFrameSize]);

    const iframeRef = useCallback((iframe: HTMLIFrameElement | null) => {
        frameElement.current = iframe;
        if (!iframe) {
            const editor = useEditor.getState();
            if (!editor.stopped) editor.stop();
            editor.setRuntime({ iframe: null, console: null });
            (window as any).iframeWindow = null;
            return;
        }

        updateFrameSize();
        const iframeWindow = iframe.contentWindow?.window;
        (window as any).iframeWindow = iframeWindow;

        setRuntime({ iframe: iframe, console: iframeWindow?.console });

        iframe.addEventListener("focusiframe", () => {
            focusFrameRef.current?.blink();
        });
    }, [updateFrameSize]);

    useEffect(() => {
        setTimeout(() => setIframeHidden(stopped));
        if (stopped) setRuntime({ iframe: null });
    }, [stopped, setIframeHidden]);

    return (
        <div
            ref={containerRef}
            className="relative size-full overflow-hidden bg-black/50 rounded-xl z-0"
        >
            {!iframeHidden
                ? (
                    <iframe
                        ref={iframeRef}
                        id="game-view"
                        tabIndex={0}
                        src={iframeSrc}
                        className="block bg-black/30 rounded-xl"
                        style={{
                            border: "none",
                            outline: "none",
                            width: "100%",
                            height: "100%",
                            opacity: stopped ? 0 : 1,
                        }}
                        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads allow-popups allow-popups-to-escape-sandbox"
                        allowFullScreen={true}
                    />
                )
                : (
                    <div className="relative flex flex-col gap-4 size-full items-center justify-center select-none">
                        <img
                            className="absolute pixelated -z-[1] opacity-[.03] grayscale-[0.8] pointer-events-none"
                            src={assets.ghosty.outlined}
                            width={300}
                            height={300}
                            aria-hidden="true"
                        />
                        <h2 className="font-semibold text-3xl text-white">
                            Game is stopped!
                        </h2>
                        <button
                            onClick={run}
                            className="btn btn-ghost btn-sm bg-base-100/70 pl-2.5 py-1.5 h-auto min-h-0"
                        >
                            <img
                                src={assets.play.outlined}
                                className="h-5 w-5 object-contain"
                                aria-hidden="true"
                            />
                            Restart Game
                        </button>
                    </div>
                )}

            <FocusFrame ref={focusFrameRef} className="border-primary" />
        </div>
    );
};
