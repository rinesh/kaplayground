import { Allotment, type AllotmentHandle, LayoutPriority } from "allotment";
import { Children, type ReactNode, useEffect, useRef } from "react";

type Props = {
    id: string;
    label: string;
    children: ReactNode;
    defaultSizes: number[];
    minSizes: [number, number];
    maxSizes?: [number | undefined, number | undefined];
    visible: [boolean, boolean];
    snap?: [boolean, boolean];
    onVisibleChange: (index: number, visible: boolean) => void;
    onDragEnd: (sizes: number[]) => void;
    vertical?: boolean;
    className?: string;
    layoutKey?: string;
};

/** The original Allotment drag/snap behavior, with keyboard-accessible dividers. */
export const WorkspaceSplit = (props: Props) => {
    const root = useRef<HTMLDivElement>(null);
    const split = useRef<AllotmentHandle>(null);
    const sash = useRef<HTMLElement | null>(null);
    const currentSizes = useRef(props.defaultSizes);
    const latest = useRef(props);
    const resizeFrame = useRef<number>();
    const layoutKey = useRef(props.layoutKey);
    latest.current = props;

    const updateSize = (sizes: number[]) => {
        currentSizes.current = sizes;
        const total = sizes[0] + sizes[1];
        sash.current?.setAttribute(
            "aria-valuenow",
            String(total ? Math.round(sizes[0] / total * 100) : 0),
        );
    };

    const resize = (sizes: number[], showBoth = false) => {
        const options = latest.current;
        options.onVisibleChange(0, showBoth || sizes[0] > 0);
        options.onVisibleChange(1, showBoth || sizes[1] > 0);
        cancelAnimationFrame(resizeFrame.current ?? 0);
        resizeFrame.current = requestAnimationFrame(() => {
            split.current?.resize(sizes);
            options.onDragEnd(currentSizes.current);
        });
    };

    useEffect(() => {
        const handle = root.current?.querySelector<HTMLElement>(
            ":scope > .split-view > .sash-container > .sash",
        );
        if (!handle) return;
        sash.current = handle;
        handle.tabIndex = 0;
        handle.setAttribute("role", "separator");
        handle.setAttribute("aria-label", props.label);
        handle.setAttribute(
            "aria-orientation",
            props.vertical ? "horizontal" : "vertical",
        );
        handle.setAttribute("aria-valuemin", "0");
        handle.setAttribute("aria-valuemax", "100");
        handle.setAttribute("aria-controls", `${props.id}-first`);
        updateSize(currentSizes.current);

        const onKeyDown = (event: KeyboardEvent) => {
            const options = latest.current;
            const backward = options.vertical ? "ArrowUp" : "ArrowLeft";
            const forward = options.vertical ? "ArrowDown" : "ArrowRight";
            if (
                ![backward, forward, "Home", "End", "Enter"].includes(event.key)
            ) {
                return;
            }
            event.preventDefault();
            if (event.key === "Enter") {
                resize(options.defaultSizes, true);
                return;
            }
            const [first, second] = currentSizes.current;
            const total = first + second;
            const minFirst = Math.max(
                options.minSizes[0],
                total - (options.maxSizes?.[1] ?? Infinity),
            );
            const minSecond = Math.max(
                options.minSizes[1],
                total - (options.maxSizes?.[0] ?? Infinity),
            );
            let next = event.key === "Home"
                ? 0
                : event.key === "End"
                ? total
                : first + (event.key === backward ? -20 : 20);
            if (event.key === forward && first === 0) next = minFirst;
            if (event.key === backward && second === 0) {
                next = total - minSecond;
            }
            if (next < minFirst) {
                next = options.snap?.[0] === false
                    ? minFirst
                    : 0;
            } else if (next > total - minSecond) {
                next = options.snap?.[1] === false ? total - minSecond : total;
            }
            resize([next, total - next]);
        };
        handle.addEventListener("keydown", onKeyDown);
        return () => {
            handle.removeEventListener("keydown", onKeyDown);
            cancelAnimationFrame(resizeFrame.current ?? 0);
        };
    }, []);

    useEffect(() => {
        if (layoutKey.current === props.layoutKey) return;
        layoutKey.current = props.layoutKey;
        // Let Allotment observe the new container before restoring desktop sizes.
        cancelAnimationFrame(resizeFrame.current ?? 0);
        resizeFrame.current = requestAnimationFrame(() => {
            resizeFrame.current = requestAnimationFrame(() => {
                split.current?.resize(latest.current.defaultSizes);
            });
        });
    }, [props.layoutKey]);

    return (
        <div ref={root} className={`workspace-split ${props.className ?? ""}`}>
            <Allotment
                id={props.id}
                ref={split}
                vertical={props.vertical}
                proportionalLayout
                defaultSizes={props.defaultSizes}
                onChange={updateSize}
                onVisibleChange={(index, visible) =>
                    latest.current.onVisibleChange(index, visible)}
                onDragEnd={sizes =>
                    latest.current.onDragEnd(sizes)}
                onReset={() =>
                    resize(latest.current.defaultSizes, true)}
            >
                {Children.toArray(props.children).map((child, index) => (
                    <Allotment.Pane
                        key={index}
                        snap={props.snap?.[index] ?? true}
                        minSize={props.minSizes[index]}
                        maxSize={props.maxSizes?.[index] ?? Infinity}
                        priority={index === 0
                            ? LayoutPriority.High
                            : LayoutPriority.Low}
                        visible={props.visible[index]}
                    >
                        <div
                            id={`${props.id}-${
                                index === 0 ? "first" : "second"
                            }`}
                            className="h-full min-h-0 min-w-0"
                            aria-hidden={!props.visible[index] || undefined}
                            {...{
                                inert: props.visible[index] ? undefined : "",
                            }}
                        >
                            {child}
                        </div>
                    </Allotment.Pane>
                ))}
            </Allotment>
        </div>
    );
};
