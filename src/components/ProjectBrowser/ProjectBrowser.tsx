import { assets } from "@kaplayjs/crew";
import * as Tabs from "@radix-ui/react-tabs";
import {
    type PropsWithChildren,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { toast, ToastContainer } from "react-toastify";
import { demos, type Example, type ExamplesDataRecord } from "../../data/demos";
import {
    compareStartingPoints,
    inStartingPointCollection,
    isPlayableStartingPoint,
    matchesStartingPoint,
    type StartingPointCollection,
} from "../../data/startingPoints";
import { useProject } from "../../features/Projects/stores/useProject";
import { confirmNavigate } from "../../util/confirmNavigate";
import { ProjectEntry } from "./ProjectEntry";
import "./ProjectBrowser.css";

export type ExamplesData = {
    categories?: ExamplesDataRecord;
    tags?: ExamplesDataRecord;
    difficulties?: { displayName?: string }[];
};
const OPEN_DEMO_BROWSER_EVENT = "kaplayground-open-demo-browser";
const OPEN_PROJECT_BROWSER_EVENT = "kaplayground-open-project-browser";
export const openDemoBrowser = () =>
    window.dispatchEvent(new Event(OPEN_DEMO_BROWSER_EVENT));
export const openProjectBrowser = () =>
    window.dispatchEvent(new Event(OPEN_PROJECT_BROWSER_EVENT));

const collections = [
    { value: "all", label: "All" },
    { value: "games", label: "Games" },
    { value: "features", label: "Features" },
] as const;

export const ProjectBrowser = () => {
    const savedIds = useProject(state => state.savedProjects);
    const projectName = useProject(state => state.project.name);
    const [projects, setProjects] = useState<Example[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [tab, setTab] = useState("projects");
    const [projectQuery, setProjectQuery] = useState("");
    const [starterQuery, setStarterQuery] = useState("");
    const [topic, setTopic] = useState("");
    const [topicsExpanded, setTopicsExpanded] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<
        Record<string, boolean>
    >({});
    const [collection, setCollection] = useState<StartingPointCollection>(
        "all",
    );
    const [projectSort, setProjectSort] = useState("latest");
    const [starterSort, setStarterSort] = useState("featured");
    const dialogRef = useRef<HTMLDialogElement>(null);
    const query = tab === "projects" ? projectQuery : starterQuery;
    const setQuery = tab === "projects" ? setProjectQuery : setStarterQuery;

    useEffect(() => {
        if (!isOpen || tab !== "projects") return;
        let current = true;
        setLoading(true);
        void Promise.all(
            savedIds.map(id => useProject.getState().getProjectMetadata(id)),
        )
            .then(entries => {
                if (current) {
                    setProjects(entries);
                    setLoadError("");
                }
            })
            .catch(() => {
                if (current) {
                    setLoadError(
                        "Couldn't read saved games. Close this window and try again.",
                    );
                }
            })
            .finally(() => {
                if (current) setLoading(false);
            });
        return () => {
            current = false;
        };
    }, [savedIds, projectName, isOpen, tab]);

    useEffect(() => {
        const dialog = dialogRef.current!;
        const observer = new MutationObserver(() => setIsOpen(dialog.open));
        observer.observe(dialog, {
            attributes: true,
            attributeFilter: ["open"],
        });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const show = (destination: string) => {
            setTab(destination);
            dialogRef.current?.showModal();
        };
        const starters = () => show("starters");
        const saved = () => show("projects");
        window.addEventListener(OPEN_DEMO_BROWSER_EVENT, starters);
        window.addEventListener(OPEN_PROJECT_BROWSER_EVENT, saved);
        const url = new URL(window.location.href);
        if (url.searchParams.has("browse")) {
            show(
                ["examples", "ex", "demos"].includes(
                        url.searchParams.get("browse")?.toLowerCase() ?? "",
                    )
                    ? "starters"
                    : "projects",
            );
            url.searchParams.delete("browse");
            window.history.replaceState({}, "", url);
        }
        return () => {
            window.removeEventListener(OPEN_DEMO_BROWSER_EVENT, starters);
            window.removeEventListener(OPEN_PROJECT_BROWSER_EVENT, saved);
        };
    }, []);

    const collectionEntries = useMemo(
        () =>
            demos.filter(entry => inStartingPointCollection(entry, collection)),
        [collection],
    );
    const topics = useMemo(
        () =>
            [...new Map(
                collectionEntries.flatMap(entry =>
                    entry.tags.map(tag => [tag.name, tag] as const)
                ),
            ).values()].sort((a, b) =>
                (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name)
            ),
        [collectionEntries],
    );
    const visibleTopics = topicsExpanded ? topics : [
        ...topics.filter(tag => tag.name === topic),
        ...topics.filter(tag => tag.name !== topic),
    ].slice(0, 4);
    const startingPoints = useMemo(
        () =>
            collectionEntries
                .filter(entry =>
                    matchesStartingPoint(entry, starterQuery, topic)
                )
                .sort(
                    starterSort === "title"
                        ? (a, b) =>
                            a.formattedName.localeCompare(b.formattedName)
                        : compareStartingPoints,
                ),
        [collectionEntries, starterQuery, topic, starterSort],
    );
    const savedProjects = useMemo(
        () =>
            projects.filter(entry =>
                savedIds.includes(entry.key)
                && entry.formattedName.toLowerCase().includes(
                    projectQuery.trim().toLowerCase(),
                )
            )
                .sort(
                    projectSort === "title"
                        ? (a, b) =>
                            a.formattedName.localeCompare(b.formattedName)
                        : (a, b) => b.updatedAt.localeCompare(a.updatedAt),
                ),
        [projects, savedIds, projectQuery, projectSort],
    );
    const sections = [
        {
            key: "games",
            title: "Games to play and remix",
            description: "Start with a playable game, then make it your own.",
            entries: startingPoints.filter(isPlayableStartingPoint),
        },
        {
            key: "features",
            title: "Learn a feature",
            description:
                "Focused samples with explanations and Codex prompts beneath the preview.",
            entries: startingPoints.filter(entry =>
                !isPlayableStartingPoint(entry)
            ),
        },
    ];

    const newProject = () => {
        if (creating) return;
        setCreating(true);
        void confirmNavigate(async () => {
            await useProject.getState().createNewProject("pj");
            dialogRef.current?.close();
        }).catch(error =>
            toast.error(String(error), {
                containerId: "projects-browser-toasts",
            })
        )
            .finally(() => setCreating(false));
    };
    const toggleTopic = (name: string) => setTopic(topic === name ? "" : name);

    return (
        <dialog
            ref={dialogRef}
            id="examples-browser"
            aria-labelledby="project-browser-heading"
            className="modal bg-[#00000070]"
            onClose={() =>
                toast.dismiss({ containerId: "projects-browser-toasts" })}
        >
            <Tabs.Root
                value={tab}
                onValueChange={setTab}
                className="modal-box flex h-[min(900px,92dvh)] w-[calc(100vw-1rem)] max-w-screen-md flex-col overflow-hidden rounded-2xl border border-base-content/10 p-0"
            >
                <ProjectBrowserHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h2
                                id="project-browser-heading"
                                className="text-2xl sm:text-3xl font-semibold text-white"
                            >
                                {tab === "projects"
                                    ? "Your games"
                                    : "Pick a starting point"}
                            </h2>
                            <p className="mt-1 text-sm text-base-content/70">
                                {tab === "projects"
                                    ? "Open something you saved or start a new game."
                                    : "Play a game or explore a feature, with Codex tips to make it yours."}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs">
                                Sort by
                                <select
                                    aria-label="Sort games"
                                    className="select select-xs bg-base-100 border-base-content/15 pr-6"
                                    value={tab === "projects"
                                        ? projectSort
                                        : starterSort}
                                    onChange={event =>
                                        (tab === "projects"
                                            ? setProjectSort
                                            : setStarterSort)(
                                                event.target.value,
                                            )}
                                >
                                    {tab === "projects"
                                        ? <option value="latest">Latest</option>
                                        : (
                                            <option value="featured">
                                                Featured
                                            </option>
                                        )}
                                    <option value="title">Name</option>
                                </select>
                            </label>
                            <form method="dialog">
                                <button
                                    className="btn btn-xs btn-ghost px-1.5"
                                    aria-label="Close game browser"
                                >
                                    ×
                                </button>
                            </form>
                        </div>
                    </div>
                    <div className="join flex w-full">
                        <label className="input input-bordered join-item flex min-w-0 flex-1 items-center gap-1 max-sm:h-10 max-sm:pl-3">
                            <input
                                type="search"
                                aria-label={tab === "projects"
                                    ? "Search your games"
                                    : "Search starting points"}
                                placeholder={tab === "projects"
                                    ? "Search your games"
                                    : "Search starting points"}
                                className="min-w-0 flex-1"
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                            />
                            {query && (
                                <button
                                    type="button"
                                    className="btn btn-xs btn-ghost px-1"
                                    aria-label="Clear search"
                                    onClick={() => setQuery("")}
                                >
                                    ×
                                </button>
                            )}
                        </label>
                        {tab === "starters" && (
                            <select
                                aria-label="Starting point collection"
                                className="select select-bordered join-item w-44 max-sm:h-10 max-sm:min-h-10 max-sm:w-36 bg-base-200 text-xs sm:text-sm"
                                value={collection}
                                onChange={event => {
                                    setCollection(
                                        event.target
                                            .value as StartingPointCollection,
                                    );
                                    setTopic("");
                                    setTopicsExpanded(false);
                                }}
                            >
                                {collections.map(option => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label} ({demos.filter(entry =>
                                            inStartingPointCollection(
                                                entry,
                                                option.value,
                                            )
                                        ).length})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    {tab === "starters" && topics.length > 0 && (
                        <div className="flex items-start justify-between gap-2">
                            <div
                                id="starting-point-topics"
                                className="flex max-h-24 min-w-0 flex-wrap gap-1 overflow-y-auto"
                            >
                                {visibleTopics.map(tag => (
                                    <button
                                        type="button"
                                        key={tag.name}
                                        aria-pressed={topic === tag.name}
                                        title={tag.description}
                                        className={`btn btn-xs rounded-full border-base-content/10 bg-base-content/10 font-medium ${
                                            topic === tag.name
                                                ? "bg-primary text-primary-content"
                                                : ""
                                        }`}
                                        onClick={() => toggleTopic(tag.name)}
                                    >
                                        {tag.displayName ?? tag.name}
                                    </button>
                                ))}
                            </div>
                            <div className="flex shrink-0 gap-1">
                                {topic && (
                                    <button
                                        type="button"
                                        aria-label="Clear topic"
                                        className="btn btn-xs btn-ghost rounded-full px-2"
                                        onClick={() => setTopic("")}
                                    >
                                        ×
                                    </button>
                                )}
                                {topics.length > 4 && (
                                    <button
                                        type="button"
                                        className="btn btn-xs rounded-full border-base-content/10 bg-base-content/10 font-medium"
                                        aria-controls="starting-point-topics"
                                        aria-expanded={topicsExpanded}
                                        onClick={() =>
                                            setTopicsExpanded(!topicsExpanded)}
                                    >
                                        Topics
                                        <BrowserChevron />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </ProjectBrowserHeader>
                <Tabs.List
                    aria-label="Game destinations"
                    className="tabs tabs-lifted grid shrink-0 grid-cols-2 bg-base-200"
                >
                    {[
                        {
                            value: "projects",
                            label: "My games",
                            icon: assets.api_book.outlined,
                            count: savedIds.length,
                        },
                        {
                            value: "starters",
                            label: "Game starting points",
                            icon: assets.apple.outlined,
                            count: demos.length,
                        },
                    ].map(destination => (
                        <Tabs.Trigger
                            key={destination.value}
                            value={destination.value}
                            className={`tab h-12 gap-1.5 px-2 text-xs sm:gap-2 sm:px-6 sm:text-sm ${
                                tab === destination.value ? "tab-active" : ""
                            }`}
                        >
                            <img
                                src={destination.icon}
                                alt=""
                                className="h-5 w-5 object-contain max-sm:hidden"
                                draggable={false}
                            />
                            <span className="whitespace-nowrap font-medium">
                                {destination.label}
                            </span>
                            <span className="badge badge-xs min-w-5 border-0 bg-base-content/15 px-1 py-2 text-[10px]">
                                {destination.count}
                            </span>
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>
                <Tabs.Content
                    value="projects"
                    forceMount
                    className="project-browser-panel min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin data-[state=inactive]:hidden"
                >
                    {loadError && (
                        <p role="alert" className="mb-3 text-error">
                            {loadError}
                        </p>
                    )}
                    {loading && !projects.length && (
                        <p role="status" className="py-8 text-center">
                            Loading your games…
                        </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-3">
                        {savedProjects.map(project => (
                            <ProjectEntry
                                key={project.key}
                                project={project}
                                isProject
                            />
                        ))}
                    </div>
                    {!loading && !loadError && !savedProjects.length && (
                        <div className="py-10 text-center">
                            <p>
                                {projectQuery
                                    ? "No saved games match that search."
                                    : "Your games will appear here after your first edit or save."}
                            </p>
                            <button
                                type="button"
                                className="btn btn-sm btn-ghost mt-3"
                                onClick={() => setTab("starters")}
                            >
                                Explore game starting points
                            </button>
                        </div>
                    )}
                </Tabs.Content>
                <Tabs.Content
                    value="starters"
                    forceMount
                    className="project-browser-panel min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin data-[state=inactive]:hidden"
                >
                    {sections.filter(section => section.entries.length).map(
                        section => (
                            <section
                                key={section.key}
                                aria-labelledby={`starting-points-${section.key}`}
                                className="mb-6 last:mb-0"
                            >
                                <div className="mb-3">
                                    <h3
                                        id={`starting-points-${section.key}`}
                                        className="font-medium"
                                    >
                                        <button
                                            type="button"
                                            className="project-browser-section-toggle flex w-full items-center gap-2 text-left hover:text-white focus-visible:outline-primary"
                                            aria-expanded={!collapsedSections[
                                                section.key
                                            ]}
                                            aria-controls={`starting-points-${section.key}-items`}
                                            onClick={() =>
                                                setCollapsedSections(
                                                    previous => ({
                                                        ...previous,
                                                        [section.key]:
                                                            !previous[
                                                                section.key
                                                            ],
                                                    }),
                                                )}
                                        >
                                            <span className="badge badge-xs min-w-5 border-0 bg-base-content/15 px-1 py-2 text-[10px]">
                                                {section.entries.length}
                                            </span>
                                            {section.title}
                                            <span className="ml-auto">
                                                <BrowserChevron />
                                            </span>
                                        </button>
                                    </h3>
                                    <p className="mt-1 text-xs text-base-content/65">
                                        {section.description}
                                    </p>
                                </div>
                                <div
                                    id={`starting-points-${section.key}-items`}
                                    className="project-browser-section-content"
                                    data-expanded={!collapsedSections[
                                        section.key
                                    ]}
                                    aria-hidden={collapsedSections[section.key]
                                        || undefined}
                                    {...{
                                        inert: collapsedSections[section.key]
                                            ? ""
                                            : undefined,
                                    }}
                                >
                                    <div className="min-h-0 overflow-hidden">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {section.entries.map(project => (
                                                <ProjectEntry
                                                    key={project.key}
                                                    project={project}
                                                    toggleTag={toggleTopic}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        ),
                    )}
                    {startingPoints.length === 0 && (
                        <div className="py-10 text-center">
                            <p>No starting points match these filters.</p>
                            <button
                                type="button"
                                className="btn btn-sm btn-ghost mt-3"
                                onClick={() => {
                                    setCollection("all");
                                    setTopic("");
                                    setStarterQuery("");
                                }}
                            >
                                Show all starting points
                            </button>
                        </div>
                    )}
                </Tabs.Content>
                <footer className="flex shrink-0 items-center gap-4 border-t border-base-content/10 bg-base-100 p-4">
                    <button
                        type="button"
                        disabled={creating}
                        className="flex w-48 shrink-0 flex-col items-center gap-1 rounded-lg border-[3px] border-dashed border-base-300 bg-base-200/30 px-4 py-2 text-sm font-medium text-white hover:border-base-content/20 hover:bg-base-content/10 focus-visible:outline-primary disabled:opacity-50 sm:min-h-20 sm:justify-center sm:text-base"
                        onClick={newProject}
                    >
                        <img
                            src={assets.plus.outlined}
                            alt=""
                            className="h-6 w-6 object-contain"
                            draggable={false}
                        />
                        {creating ? "Opening…" : "New project"}
                    </button>
                    <p className="text-xs text-base-content/65 max-sm:hidden">
                        Starting points open as drafts. Your first edit saves
                        your own copy here.
                    </p>
                </footer>
            </Tabs.Root>
            <form method="dialog" className="modal-backdrop">
                <button aria-label="Close game browser backdrop">Close</button>
            </form>
            <ToastContainer
                containerId="projects-browser-toasts"
                position="bottom-right"
            />
        </dialog>
    );
};

function ProjectBrowserHeader({ children }: PropsWithChildren) {
    const contentRef = useRef<HTMLElement>(null);
    const [height, setHeight] = useState<number>();

    useLayoutEffect(() => {
        const content = contentRef.current!;
        const measure = () => {
            // The dialog scales as it opens; measure layout, not that transform.
            const nextHeight = content.offsetHeight;
            // Keep the last measured size while the dialog is closed.
            if (nextHeight > 0) setHeight(nextHeight);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(content);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="project-browser-header" style={{ height }}>
            <header ref={contentRef} className="space-y-4 bg-base-200 p-4">
                {children}
            </header>
        </div>
    );
}

function BrowserChevron() {
    return (
        <svg
            aria-hidden="true"
            className="project-browser-chevron h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}
