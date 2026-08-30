import { assets } from "@kaplayjs/crew";
import { REPO, VERSION } from "../../config/common";

export const AboutDialog = () => {
    return (
        <dialog id="about-dialog" className="modal">
            <section className="modal-box max-w-md">
                <header className="flex items-center justify-center mt-1 py-2">
                    <img
                        alt="KAPLAY"
                        src={assets.kaplayground_dino.outlined}
                        className="h-48 object-scale-down"
                    >
                    </img>
                </header>

                <main className="max-w-xs mx-auto py-2">
                    <p className="text-center sm:px-6 py-2">
                        Play a tiny game, ask Codex to change it, and try the
                        new version right away. You can keep remixing until the
                        game feels like yours.
                    </p>

                    <div className="mt-4 sm:px-4 text-sm">
                        <div className="flex gap-1 justify-between flex-wrap">
                            <span className="inline-flex items-center gap-2 font-mono text-xs bg-base-200 px-3 py-1.5 rounded-md">
                                <span className="hidden sm:inline font-semibold">
                                    Version:
                                </span>
                                <span className="sm:hidden font-semibold">
                                    Ver.:
                                </span>
                                {VERSION}
                            </span>

                            <a
                                className="inline-flex gap-2 items-center font-medium btn btn-sm btn-ghost bg-base-content/10 px-2"
                                href={"https://kaplayjs.com/docs/guides/"}
                                target="_blank"
                            >
                                <img
                                    alt="KAPLAYGROUND"
                                    src={assets.marks_legend.outlined}
                                    className="h-5 object-scale-down"
                                />

                                KAPLAY Docs
                            </a>
                        </div>

                        <div className="h-px bg-base-content/10 my-2.5"></div>

                        <div className="flex gap-2 flex-wrap">
                            <a
                                className="inline-flex grow gap-2 items-center font-medium btn btn-sm btn-ghost bg-base-content/10 px-2"
                                href={REPO}
                                target="_blank"
                            >
                                <img
                                    src={assets.github.outlined}
                                    className="h-5 object-scale-down"
                                    aria-hidden="true"
                                />

                                Give a star
                            </a>

                            <a
                                className="inline-flex grow gap-2 items-center font-medium btn btn-sm btn-ghost bg-base-content/10 px-2"
                                href={REPO + "/issues"}
                                target="_blank"
                            >
                                <img
                                    src={assets.burpman.outlined}
                                    className="h-5 object-scale-down"
                                    aria-hidden="true"
                                />

                                Report an issue
                            </a>
                        </div>
                    </div>
                </main>

                <footer className="modal-action mt-8">
                    <form
                        method="dialog"
                        className="flex flex-col sm:flex-row justify-between gap-2 w-full"
                    >
                        <button
                            type="button"
                            className="btn btn-ghost py-3.5 min-h-0 h-auto bg-base-content/10"
                            onClick={() => {
                                document.querySelector<HTMLDialogElement>(
                                    "#about-dialog",
                                )?.close();
                                requestAnimationFrame(() => {
                                    document.querySelector<HTMLDialogElement>(
                                        "#welcome-dialog",
                                    )?.showModal();
                                });
                            }}
                        >
                            Open welcome screen
                        </button>

                        <button className="btn py-3.5 min-h-0 h-auto">
                            Continue building
                        </button>
                    </form>
                </footer>
            </section>

            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
};
