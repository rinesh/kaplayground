/**
 * @file Burp
 * @description How to use burp, the engine core
 * @difficulty 0
 * @tags basics, audio
 * @minver 3001.0
 * @category basics
 */

// Adapted from kaplay/examples/burp.js with responsive instructions.
// Core KAPLAY features [💡]

/* 💡 Burp 💡
Burp is the engine core, it handles everything.
Is not needed in most cases, unless you don't want your game crashing
or freezing randomly.
*/

// Start the game in burp mode
kaplay({
    burp: true,
    background: "cc425e",
});

// "b" triggers burp() on press
const instruction = add([
    text("Press B to burp"),
    anchor("center"),
    pos(center()),
    scale(1),
    "instruction",
]);

// Keep the label centered and readable as the game panel changes size.
const layoutInstruction = () => {
    instruction.pos = center();
    instruction.scale = vec2(
        Math.min(1, Math.max(1, width() - 32) / Math.max(1, instruction.width)),
    );
};
onLoad(layoutInstruction);
onResize(layoutInstruction);

// burp() on click / tap for our friends on mobile
onMousePress(() => burp());
