import { assets } from "@kaplayjs/crew";
import { ToolbarButton } from "../ToolbarButton";

export const AboutButton = () => {
    const handleModalOpenClick = () => {
        document.querySelector<HTMLDialogElement>("#about-dialog")
            ?.showModal();
    };

    return (
        <ToolbarButton
            onClick={handleModalOpenClick}
            icon={assets.question_mark.outlined}
            text="Help"
            compact
            aria-label="Help and about"
            tip="Help and about"
        />
    );
};
