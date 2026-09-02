export type ExampleCoachPrompts = {
    explain: string;
    remix: string;
    build: string;
    invent: string;
};

export const EXAMPLE_COACH_PROMPTS = {
    advancedbinding: {
        explain:
            "Press Tab to move forward through the character picker, then press Shift+Tab to move backward. Explain why the same key can trigger two directions and show me where those controls are paired.",
        remix:
            "Turn the character picker into a neon arcade roster. Give each character a name card, a quick entrance pose, and a distinct color flash while keeping Tab and Shift+Tab navigation working.",
        build:
            "Make this a ten-second team-picking game. Cycle through the characters, lock in three favorites, prevent duplicates, and celebrate the finished team with a group pose.",
        invent:
            "Keep the forward and backward character controls, but make the picker feel like [a spaceship crew, talent show, or monster parade] and add [one reveal animation or selection rule].",
    },
    ai: {
        explain:
            "Move the bean with the arrow keys and watch the ghost alternate between waiting, firing, and chasing. Explain those three moods in plain language and show me the timing that controls each one.",
        remix:
            "Turn the ghost into a suspicious museum guard. Add a visible alert meter and a flashlight cone, but keep its wait, attack, and chase states easy to recognize.",
        build:
            "Make a tiny hide-and-seek game where the bean survives for twenty seconds while the ghost changes tactics. Add safe corners, a countdown, and a clear caught-or-escaped ending.",
        invent:
            "Give the ghost a new [personality or creature type], add a [fourth state such as confused, sleepy, or friendly], and make its behavior readable through color and movement.",
    },
    analogtriggers: {
        explain:
            "Connect a gamepad, move with the left stick, aim with the right stick, and squeeze the right trigger gently and fully. Explain how trigger pressure changes bullet speed, color, and firing rhythm.",
        remix:
            "Turn the pressure-sensitive blaster into a bubble wand. A light squeeze should puff tiny bubbles and a full squeeze should launch a huge wobbling bubble that pushes ghosts farther.",
        build:
            "Make a target-range challenge for a gamepad. Give weak and strong shots different targets, award precision bonuses, and show the trigger pressure on an on-screen gauge.",
        invent:
            "Keep movement, twin-stick aiming, and pressure-sensitive firing, but replace the blaster with [a magic wand, water hose, or musical instrument] and give pressure a playful effect.",
    },
    animation: {
        explain:
            "Watch the beans rotate, slide, fade, change color, follow a square, and travel along a curve; click to pause or restart some of them. Explain how keyframes, timing, and looping create the differences.",
        remix:
            "Arrange the animated beans as a tiny synchronized dance troupe. Give the color, fade, orbit, and curved-motion beans coordinated eight-count moves and a simple stage backdrop.",
        build:
            "Turn the animation showcase into a copy-the-dance memory game. Highlight a short sequence, let me click the matching beans in order, and celebrate a correct routine.",
        invent:
            "Keep the collection of animation styles, but stage them as [a clockwork toy shop, aquarium, or space ballet] and add one [loop, easing, or motion path] I can tune on screen.",
    },
    audio: {
        explain:
            "Press Space to start the music, use the arrow keys to change volume and speed, press Enter for the bell, and play the A-to-K piano keys. Explain how each sound control affects what I hear and see.",
        remix:
            "Turn this into a moonlit pocket synthesizer. Give every piano key a colored pulse, make the spinning bag react to the beat, and keep the volume, speed, seek, and pause controls visible.",
        build:
            "Make a short rhythm challenge that plays a three-note pattern on the bell keyboard and asks me to repeat it. Add a streak counter, gentle timing windows, and a celebratory chord.",
        invent:
            "Keep the playable keyboard and music controls, but use a [music style or atmosphere] and make [pitch, speed, or volume] drive a matching visual effect.",
    },
    automaticCollider: {
        explain:
            "Look at the blue outline hugging the apple instead of using a simple box. Explain how the sprite silhouette becomes its collision shape and why that would make contact feel more accurate.",
        remix:
            "Make the collider outline an animated scan effect that travels around the apple, switches color at sharp corners, and can be toggled without changing the apple's collision shape.",
        build:
            "Create a precision fruit-sorting game where oddly shaped fruit must fit through matching openings. Use silhouette-based collision shapes and show a satisfying snap when a fruit fits.",
        invent:
            "Replace the apple with [an irregular object], keep the tight silhouette collider, and add [a fitting, tracing, or near-miss challenge] that makes the accurate shape matter.",
    },
    basicEventsObject: {
        explain:
            "Press Space to explode and remove the bean, then press Enter before and after it disappears. Explain why the bean's own events stop with it while the game-wide Enter check still responds.",
        remix:
            "Turn the disappearing bean into a stage magician. Add a puff of smoke, a farewell message, and an Enter-key spotlight that reports whether the magician is currently on stage.",
        build:
            "Make a tiny whack-a-bean game where each bean manages its own timer and disappearance, while a game-wide score and restart control keep working after individual beans are gone.",
        invent:
            "Keep the contrast between object events and game-wide events, but demonstrate it with [a vanishing creature or breakable prop] and [one control that survives its removal].",
    },
    basicsCompRender: {
        explain:
            "Compare the bean, outlined rectangle, translucent circle, text, and uneven polygon across the top of the game. Explain which visual ingredient draws each one and how color, outline, and opacity modify it.",
        remix:
            "Turn the row of basic shapes into a cheerful badge collection. Give every badge a coordinated palette, a label, and one distinct outline or transparency treatment.",
        build:
            "Make a shape-matching game from these five render types. Show a target badge, let me click its matching object, and add a short color-and-outline celebration for correct choices.",
        invent:
            "Keep one sprite, rectangle, circle, text label, and polygon, but arrange them as [a robot, tiny town, or abstract poster] using [my palette and outline style].",
    },
    basicsComponents: {
        explain:
            "Move the spinning bean with the arrow keys and notice that movement, rotation, position, and custom speed all live on one object. Explain how those small ingredients combine to create its behavior.",
        remix:
            "Turn the spinning bean into a wind-up compass creature. Make it face its travel direction, leave a fading trail, and speed up smoothly while an arrow key is held.",
        build:
            "Make a collect-the-stars game around this movable object. Add five stars, a score, screen boundaries, and a win animation while keeping movement assembled from small reusable behaviors.",
        invent:
            "Keep the same movement and rotation ingredients, but make the object into [a creature or vehicle] with [a speed rule, trail, or reaction] controlled by its own custom data.",
    },
    basicsEvents: {
        explain:
            "Watch the message being drawn, move the mouse, and press Space to stop the repeating update message. Explain the difference between something that happens once, every frame, or only after input.",
        remix:
            "Turn the event lesson into a little control-room display. Give load, draw, update, mouse, and key events their own colored indicator that flashes only when that event occurs.",
        build:
            "Make a reaction game where a signal appears after loading, moves every frame, and must be stopped with Space at the right moment. Show the response time and allow a quick replay.",
        invent:
            "Keep examples of load, draw, update, mouse, and key events, but present them as [a weather station, spaceship dashboard, or music sequencer] with one new input event.",
    },
    basicsGlobals: {
        explain:
            "The preview only logs a greeting, so show me where the game is initialized and explain in plain language how that one call makes drawing, input, sound, and object functions available.",
        remix:
            "Replace the blank greeting with a welcoming start screen that introduces the game context through four animated icons for drawing, input, sound, and objects.",
        build:
            "Create a tiny interactive sampler from this empty starting point: click once to add a shape, press a key to move it, and play a sound when it reaches a target.",
        invent:
            "Use this bare game context to make [a one-screen toy], with [one thing to draw], [one input], and [one sound or reaction] so every added piece is easy to understand.",
    },
    basicsObject: {
        explain:
            "Look at the bean added near the corner and explain how its sprite and position are combined into one game object. Then move it to the center and add an anchor so the change is obvious.",
        remix:
            "Turn the single bean into a tiny character card with a soft shadow, name label, colored frame, and a gentle idle bob while keeping it one composed game object.",
        build:
            "Make a simple find-the-bean game. Place several decoys, let me click the real bean, and rebuild the board in a new arrangement after each correct choice.",
        invent:
            "Start from one game object and compose [a character, prop, or creature] from [a sprite or shape], position, color, and one behavior I choose.",
    },
    basicsStart: {
        explain:
            "The preview is a green canvas with a greeting in the game messages. Explain how the background color and greeting are created, then add a centered title so the first visible result feels intentional.",
        remix:
            "Turn the empty green canvas into a cozy nighttime welcome screen with a moon, a short title, and a pulsing prompt to click, while keeping the setup easy for a beginner to read.",
        build:
            "Build a first one-button game on this canvas. Add a bean that hops when I click or press Space, count successful hops, and celebrate after five without introducing extra files.",
        invent:
            "Use this blank starting canvas for [a tiny scene I want], add [one character or object], and make [one click or key] create a clear playful reaction.",
    },
    bbcode: {
        explain:
            "Look at the sentence where every tagged word has a different color. Explain how the color tags are read and turned into text styles, then point out one tag I can edit safely.",
        remix:
            "Turn the colored sentence into a fantasy item description with tags for rarity colors, a glowing item name, and a warning word that gently pulses.",
        build:
            "Make a dialogue-choice screen where tagged words show character names, emotions, and important clues in distinct styles, then let me click one of three replies.",
        invent:
            "Keep tag-driven text styling, but format [a poem, quest log, or comic speech] with custom tags for [color, shake, wave, or emphasis].",
    },
    binding: {
        explain:
            "Move the bean with WASD, arrows, or a gamepad, then transform it with Space, Enter, a click, or the south button. Explain how several physical inputs share the same move and mutate actions.",
        remix:
            "Turn the bean-to-zombean transformation into a magical day-and-night form change. Add a brief swirl, a color shift, and a label showing the current form while keeping every input option.",
        build:
            "Make a two-form maze where the normal bean crosses bright gates and the zombean crosses shadow gates. Keep the shared movement controls and let any mutate input switch forms.",
        invent:
            "Keep the named move and transform actions, but swap in [two forms or vehicles] with [one ability each] and preserve keyboard, mouse, and gamepad choices.",
    },
    blend: {
        explain:
            "Compare how the overlapping beans and gray circles look under normal, add, multiply, screen, and overlay blending. Explain why the same art becomes brighter, darker, or more contrasted.",
        remix:
            "Arrange the blend modes as a stained-glass night scene where overlapping moons, clouds, and lanterns visibly demonstrate how each mode mixes color.",
        build:
            "Make a color-mixing puzzle where I drag translucent lights together to match a target color. Use different blend modes as selectable rules and show when the match is close.",
        invent:
            "Keep the five blend modes, but demonstrate them with [two overlapping shapes or sprites] in [a palette I choose] and label the visual result of each mix.",
    },
    burp: {
        explain:
            "Press B or click the pink screen to trigger the built-in burp. Explain what this deliberately silly mode changes and show me where the sound is triggered.",
        remix:
            "Make every burp launch a comic green speech bubble with a random polite excuse, a tiny screen wobble, and a counter called Burps Apologized For.",
        build:
            "Create a timing game where a meter sweeps left and right and I must burp inside the green zone. Add three rounds, funny ratings, and a replay prompt.",
        invent:
            "Keep B and click as the trigger, but replace the burp with [a silly sound or reaction] and add [a visual gag, counter, or timing rule].",
    },
    button: {
        explain:
            "Hover over Start and Quit to see them grow and cycle color, then click each one. Explain how the same button recipe combines its shape, label, hover feedback, cursor, and click action.",
        remix:
            "Restyle the two buttons as chunky arcade controls with pressed depth, a quick shine on hover, and distinct Start and Quit color personalities.",
        build:
            "Make a tiny title menu with Start, How to Play, and Sound buttons. Each button should give clear hover and pressed feedback, and Start should reveal a one-screen game.",
        invent:
            "Keep the reusable button recipe, but design a [theme] menu with [two or three button labels] and give one button [a playful hover or click surprise].",
    },
    camera: {
        explain:
            "Move left and right, jump with Space, collect the coin to zoom in, and click to place an explosion in the world. Explain how the camera follows the bean while the score stays fixed on screen.",
        remix:
            "Turn the camera starting point into a dramatic treasure pickup. Ease into the zoom, briefly slow time, add a golden flash around the coin, and smoothly return to normal framing.",
        build:
            "Make a tiny camera-tour platformer with three coins at different heights. Pan ahead while moving, add a soft landing bump, and frame the final treasure with a celebratory zoom.",
        invent:
            "Keep the following camera and fixed score, but add [a camera effect such as look-ahead, shake, or zoom] when [a jump, pickup, or secret] happens.",
    },
    children: {
        explain:
            "Move the mouse and watch the ghost follow while its ring of bean children rotates with it. Explain how the parent carries the children and how each child keeps its own speed and offset.",
        remix:
            "Turn the orbiting beans into a miniature solar system around the mouse-following ghost. Give inner and outer orbits different colors, sizes, and speeds.",
        build:
            "Make an orbit-defense game where the mouse moves a core and its child satellites block incoming dots. Lose a satellite on impact and win by surviving twenty seconds.",
        invent:
            "Keep a mouse-following parent with orbiting children, but theme it as [a planet, creature, or machine] and give the children [a shared reaction or formation change].",
    },
    clicktopmost: {
        explain:
            "Click the overlapping blue, green, and cyan squares and watch which name appears in the game messages. Explain why only the visually topmost clickable square responds in the overlap.",
        remix:
            "Turn the overlapping squares into a messy stack of colorful postcards. Clicking should lift the top postcard, stamp it, and slide it aside so the next one becomes available.",
        build:
            "Make a shell-game challenge with three overlapping cards. Shuffle them visibly, let me choose only the top card at each position, and reveal whether it hides the star.",
        invent:
            "Keep topmost-only clicking, but replace the squares with [stacked objects] and make each click [peel, flip, stamp, or discard] the front object.",
    },
    clip: {
        explain:
            "Watch the crossing line segments highlight only where they intersect, then try C and R. Explain how the clipped portion is found and what those keys change in the drawing.",
        remix:
            "Turn the intersecting lines into laser beams that glow only inside a crystal window. Add a subtle pulse and label the clipped segment versus the full beam.",
        build:
            "Make a laser-routing puzzle where I rotate two lines until their highlighted overlap reaches a target zone. Add a success flash and a new randomized arrangement.",
        invent:
            "Keep the visible clipped intersection, but draw [ropes, lasers, roads, or light rays] and let [a key or pointer movement] change where the overlap appears.",
    },
    closestpoint: {
        explain:
            "Move the pointer around the outlined nine-sided shape, circle, and square. Explain why each red dot hugs the nearest point on its shape and how corners differ from curved edges.",
        remix:
            "Make the nearest-point dots into tiny magnetic fireflies that glow brighter as the pointer approaches and leave a short trail around each outline.",
        build:
            "Create a steady-hand tracing game where the pointer must follow a shape's edge using its nearest point. Score accuracy, show the traced path, and advance through all three shapes.",
        invent:
            "Keep a marker snapped to the nearest edge, but use [a custom shape] and turn the marker into [a magnet, spark, or creature] with one distance-based reaction.",
    },
    collision: {
        explain:
            "Move the bean with the arrow keys, rotate with Q and E, click obstacles, and watch the messages when shapes touch or separate. Explain the difference between collision, overlap, and leaving an object.",
        remix:
            "Turn the collision playground into a bumper-car lab. Give each material a distinct hit color, impact burst, and message while keeping rotation and movement controls.",
        build:
            "Make a warehouse game where the bean pushes one crate onto a marked patch without touching the steel hazard. Use collision events for bumps, success, and reset feedback.",
        invent:
            "Keep movement, rotation, and collision messages, but replace the obstacles with [objects or creatures] and give each contact type [a sound, score, or reaction].",
    },
    collisionshapes: {
        explain:
            "Inspect the different rectangles, circles, polygons, lines, and points used for contact checks. Explain how each collision shape matches a different kind of object and where their boundaries are drawn.",
        remix:
            "Present the collision shapes as a colorful science exhibit with labels, animated boundary outlines, and a probe I can move across them to reveal contact.",
        build:
            "Make a shape-sorting challenge where I drag objects into matching collision zones. Reject mismatches with a gentle bounce and lock correct matches into place.",
        invent:
            "Keep several collision shape types, but arrange them as [a lock-and-key puzzle, obstacle course, or museum] and add one clear contact reaction.",
    },
    component: {
        explain:
            "Press Space to make the bean funky, R to remove that behavior, and Escape to add it again. Explain how the custom behavior adds its own state and actions to the bean while it is attached.",
        remix:
            "Make the funky behavior visually obvious with rainbow sunglasses, a wobbling dance, and an on-screen Funky or Calm badge that updates as the behavior is added or removed.",
        build:
            "Create a power-up game where collecting three badges adds temporary custom behaviors such as bounce, sparkle, and speed. Show active badges and let each expire cleanly.",
        invent:
            "Create a custom [mood, power, or status] behavior for the bean with [one piece of state] and [one visible action], then let me add and remove it while playing.",
    },
    concert: {
        explain:
            "Move left and right and press Space while the pixel band performs. Explain how the characters, notes, stage movement, and old-school presentation work together in this concert scene.",
        remix:
            "Restage the concert as a midnight rooftop show with colored spotlights, drifting note particles, and a crowd reaction that grows when I press Space on the beat.",
        build:
            "Turn the concert into a simple rhythm game. Send notes toward a timing line, use Space to hit them, and let left and right switch performers with different sound colors.",
        invent:
            "Keep the playable concert, but choose [a music style and venue], feature [a favorite character], and add [a crowd, lighting, or rhythm surprise].",
    },
    confetti: {
        explain:
            "Click anywhere or press Space to launch confetti and watch the pieces fall, spin, and spread. Explain which values control the burst size, direction, colors, and gravity.",
        remix:
            "Turn the confetti burst into a seasonal celebration with leaf, snow, flower, and star palettes that rotate after every click and briefly tint the background.",
        build:
            "Make a confetti target game where a moving gift must be clicked before time runs out. Accurate clicks create bigger bursts and missing the gift creates only a tiny puff.",
        invent:
            "Keep click-and-Space bursts, but replace confetti with [petals, sparks, candy, or tiny icons] and make burst strength depend on [timing, position, or a charge meter].",
    },
    constraint: {
        explain:
            "Drag the beans and watch some maintain distance, copy rotation or scale, or bend as a linked chain. Explain each visible relationship in plain language and identify the bean that drives it.",
        remix:
            "Turn the constraint showcase into a puppet workshop. Draw soft strings between linked beans, highlight the active driver, and give each constraint type its own color.",
        build:
            "Make a dangling-key puzzle where I drag a handle and a constrained chain swings the key into a lock. Add a reset button and a satisfying unlock animation.",
        invent:
            "Keep one [distance, rotation, scale, or chain] relationship, but use it to animate [a puppet, machine, or creature] that I can drag and disturb.",
    },
    constraintsflip: {
        explain:
            "Watch the first bean spin while the second copies its rotation and repeatedly flips as its horizontal scale crosses zero. Explain how rotation is linked and why negative scale mirrors the sprite.",
        remix:
            "Turn the flipping pair into two enchanted mirrors. Add a frame, a shimmer at each flip, and a color change whenever the reflected bean switches sides.",
        build:
            "Make a mirror-timing game where I press Space exactly when both beans face the same way. Speed up over five rounds and show a clear perfect or early result.",
        invent:
            "Keep one object driving another object's rotation and flip, but present them as [gears, dancers, or mirror creatures] with [a timing or matching challenge].",
    },
    convexhull: {
        explain:
            "Compare each translucent jagged shape with the blue outline wrapped around its outermost points. Explain how the outline ignores inward dents to form the smallest convex boundary.",
        remix:
            "Make the hull construction visible step by step: reveal the points, animate an outline wrapping around them, and briefly mark the inward points it skips.",
        build:
            "Create a shield-building game where scattered points define a protective convex hull around a creature. Let me move one point at a time and survive falling sparks.",
        invent:
            "Generate [a star, cog, or random point cloud], draw its convex hull in [a chosen style], and add [an animation or gameplay rule] that uses the boundary.",
    },
    curves: {
        explain:
            "Watch the colored markers travel along the curves and compare uneven versus normalized spacing and speed. Explain why the same curve parameter can create lumpy motion and how normalization smooths it.",
        remix:
            "Turn the curve comparison into a miniature racetrack with two glowing racers, distance markers, and a finish-time readout that makes the speed difference obvious.",
        build:
            "Make a curve-racing game where I drag control points before the start, then two racers follow the raw and normalized paths. Reward the smoothest route.",
        invent:
            "Keep the curve and its moving marker, but shape it like [a roller coaster, river, or flight path] and let me adjust [control points, speed, or spacing].",
    },
    customCompDebug: {
        explain:
            "Click the bean and inspect the custom values shown for it. Explain how a handmade behavior chooses which of its properties appear during inspection and why that is useful while tuning a game.",
        remix:
            "Turn the bean into a tiny virtual pet with visible custom values for mood, energy, and favorite snack. Change those values when I click it and reflect them in its face and color.",
        build:
            "Make a creature-training toy where clicks raise one stat and lower another. Show the custom values on screen, unlock a new animation at a threshold, and add a reset control.",
        invent:
            "Give a custom [character or object] behavior the properties [two values I care about], make them visible during inspection, and let one input change them in a clear way.",
    },
    decisiontree: {
        explain:
            "The starting point learns a yes-or-no decision tree from weather, temperature, humidity, and wind samples, then prints the result. Explain one path through that tree in plain language.",
        remix:
            "Bring the weather decision tree onto the game screen as a branching forecast map. Color each question, animate the chosen path, and reveal the final play-outside answer.",
        build:
            "Make a mystery-creature guessing game driven by a small decision tree. Ask four visible questions, follow the answers, and reveal the guessed creature with a playful entrance.",
        invent:
            "Train a small decision tree to decide [a fun yes-or-no outcome] from [three or four traits], then visualize the questions and selected path on screen.",
    },
    doublejump: {
        explain:
            "Move with left and right, press Space once in the air for a second jump, collect the coin, and avoid the spike. Explain how the game tracks grounded and midair jumps.",
        remix:
            "Make the second jump feel like a cloud burst: add a ring below the bean, a brief squash and stretch, and a different sound from the first jump.",
        build:
            "Create a short vertical challenge built around double-jumping between three moving platforms. Add checkpoint sparkles, a fall reset, and a prize at the top.",
        invent:
            "Keep the two-stage jump, but make the second jump [a wing flap, rocket puff, or magic blink] and build [one obstacle or collectible] that requires it.",
    },
    drag: {
        explain:
            "Grab a bean, drag it around, and release it. Explain how the starting point remembers which object is being held, preserves the pointer offset, and stops movement on release.",
        remix:
            "Turn the draggable beans into fridge magnets with soft shadows, a slight tilt while held, and a satisfying snap when released near matching outlines.",
        build:
            "Make a lunchbox packing puzzle where I drag differently sized snacks into matching spaces. Prevent overlap, count placements, and celebrate when everything fits.",
        invent:
            "Keep precise pointer dragging, but let me arrange [stickers, puzzle pieces, or tiny creatures] and add [snapping, stacking, or a drop-zone rule].",
    },
    draw: {
        explain:
            "Scan the preview for the lines, curves, shapes, text, sprite, and transformed drawings. Explain how immediate drawing differs from adding a lasting game object and point out one transform stack.",
        remix:
            "Recompose the drawing sampler as a polished space postcard using the same lines, curves, shapes, text, and sprite, with a limited night-sky palette.",
        build:
            "Make a one-screen drawing scavenger hunt. Ask me to click a circle, polygon, curved line, and sprite in order, highlighting each found item.",
        invent:
            "Use the drawing calls to create [a poster, landscape, or diagram] from [three shapes], [one line or curve], and [one label or sprite].",
    },
    drawon: {
        explain:
            "Press Space and compare the directly drawn bean with the group rendered through an off-screen frame buffer. Explain what gets captured, when it refreshes, and how the final image is shown.",
        remix:
            "Turn the off-screen drawing into a magic portrait that accumulates beans, adds a painted frame, and briefly ripples whenever Space refreshes the image.",
        build:
            "Make a stamp-card game where each Space press adds one random icon to an off-screen card. Complete a row of five to reveal a prize animation.",
        invent:
            "Use off-screen drawing to build [a photo booth, minimap, or paint layer], refresh it when [an event I choose] happens, and add one final-screen effect.",
    },
    drawoncanvas: {
        explain:
            "Press Space to add beans into the cached canvas and watch the whole image pass through a pulsing color-inversion shader. Explain why old beans remain and how the canvas is redrawn.",
        remix:
            "Make the cached canvas into a haunted instant photo. Each Space press should add a ghostly bean, fade the border, and sweep a slow negative-color wave across the picture.",
        build:
            "Create a constellation maker where each press stamps a star into the cached canvas and nearby stars connect. Finish after eight stars and animate the completed constellation.",
        invent:
            "Keep a canvas that remembers each stamp, but add [an icon or brush] on [a chosen input] and process the finished canvas with [a color or distortion effect].",
    },
    eatlove: {
        explain:
            "Guide the bean to eat every heart, using Space or a click when prompted, and watch how the game reacts to each pickup. Explain the goal, movement, and completion flow.",
        remix:
            "Restyle the heart hunt as a warm bakery dash with tiny pastries, crumb bursts, and a happiness meter that fills after every pickup.",
        build:
            "Add a twenty-second challenge to collect all the hearts while one shy heart wanders away. Include a combo for quick pickups and a gentle retry screen.",
        invent:
            "Keep the collect-everything goal, but choose [a character], [a collectible], and [one moving obstacle or bonus] for a tiny themed version.",
    },
    egg: {
        explain:
            "Use Space and Enter to interact with the egg and watch it change between whole and cracked states. Explain the short sequence of reactions and what advances it.",
        remix:
            "Turn the egg interaction into a dramatic mystery hatch with wobble, tiny cracks, colored light leaking out, and one surprising creature reveal.",
        build:
            "Make a careful-hatching game where alternating Space and Enter keeps a balance meter centered. Too much of either cracks the egg, while a balanced sequence hatches it.",
        invent:
            "Keep the staged egg interaction, but hatch [a creature or object], use [two inputs or choices], and add [one suspenseful visual or sound cue].",
    },
    fadeIn: {
        explain:
            "Watch the beans appear gradually instead of popping in at full opacity. Explain how their fade timing differs and which value controls how quickly each becomes visible.",
        remix:
            "Turn the fade-in row into fireflies arriving at dusk. Stagger their timing, add soft glows, and let each firefly drift once it becomes fully visible.",
        build:
            "Make a memory game where four symbols fade in one by one, disappear, and ask me to click their positions in order. Increase the sequence each round.",
        invent:
            "Fade in [a set of characters, clues, or scenery] with [staggered or random timing] and add one reaction when each item becomes fully visible.",
    },
    fakeMouse: {
        explain:
            "Move the on-screen cursor with the arrow keys, press Space to click, and use it on the door and bean. Explain how keyboard input is translated into hover and click behavior.",
        remix:
            "Turn the keyboard cursor into a tiny robot hand with grab and release animations, a soft hover glow, and a click pulse around the selected object.",
        build:
            "Make a keyboard-only desk puzzle where the fake cursor opens drawers and moves three items into their correct places. Add focus hints and a completion message.",
        invent:
            "Keep arrow-key cursor movement and Space clicking, but theme the cursor as [a wand, hand, or drone] and let it interact with [two objects and one secret].",
    },
    fixed_click: {
        explain:
            "Hover and click the fixed Foobar label while the camera is zoomed. Explain why this screen-space label stays clickable even though the world view uses a different position and scale.",
        remix:
            "Turn the fixed label into a polished floating HUD button with hover color, pressed depth, and a small world-space marker showing what it controls.",
        build:
            "Make a zoomed-world treasure scene with a fixed inventory button. Clicking a world item adds it to the HUD, and clicking the HUD item highlights its world location.",
        invent:
            "Keep a camera-independent clickable HUD element, but make it [a map, inventory, or ability button] that affects [one object in the zoomed world].",
    },
    fixedclick: {
        explain:
            "Hover and click both the world-space bean and the camera-fixed ghost. Explain why they react the same to the pointer even though one belongs to the world and the other stays attached to the screen.",
        remix:
            "Style the bean as an explorer and the fixed ghost as a mischievous HUD mascot. Give each a distinct hover face and a different camera shake when clicked.",
        build:
            "Make a spot-the-ghost game where the world camera drifts but one ghost remains fixed as a decoy. Score clicks on moving world targets and subtract for the decoy.",
        invent:
            "Keep one world object and one screen-fixed object clickable, but turn them into [a game character and HUD companion] with different click reactions.",
    },
    flamebar: {
        explain:
            "Move the bean with the arrow keys and avoid the rotating chain of pineapples. Explain how the repeated hazards orbit one pivot and how their positions form the flame-bar shape.",
        remix:
            "Turn the pineapple chain into an enchanted clock hand with glowing fruit, a warning shadow on the floor, and a spark trail that makes its sweep easy to read.",
        build:
            "Make a survival room with three flame bars rotating at different speeds. Give the bean three hearts, brief invulnerability after a hit, and a fifteen-second win timer.",
        invent:
            "Keep the rotating chain hazard, but use [a themed object], choose [its length and speed], and add [a safe-zone or timing challenge].",
    },
    flappy: {
        explain:
            "Click or press Space to flap the bean through the gaps and watch the score increase after each pipe. Explain the upward impulse, gravity, obstacle spawning, and restart flow.",
        remix:
            "Restyle the flappy game as a paper airplane crossing a windy desk. Replace pipes with book stacks, add paper scraps on each flap, and keep the one-button rhythm.",
        build:
            "Add a gentle three-stage difficulty curve: wider gaps at first, moving gaps after five points, and a golden bonus gap after ten. Show the next milestone.",
        invent:
            "Keep the one-button flying rhythm, but choose [a flyer], [a kind of obstacle], and [one bonus or weather surprise] for a new version.",
    },
    floodfill: {
        explain:
            "The starting point computes reachable cells in small grids and prints the results. Explain how flood fill starts from one cell, visits connected neighbors, and stops at cells that fail the rule.",
        remix:
            "Visualize the flood fill on screen as water spreading through a tiny tiled garden. Animate each visited cell in order and color blocked cells like stone walls.",
        build:
            "Make a paint-flood puzzle where I click a colored region and try to cover the board in a limited number of moves. Show each spreading wave and count moves.",
        invent:
            "Use flood fill to spread [water, light, paint, or vines] across [a small grid], with [one type of blocked or special cell] and a clear completion goal.",
    },
    fps: {
        explain:
            "The canvas is intentionally sparse while the frame rate is capped and the inspector is enabled. Explain what the frame cap changes and add an on-screen live FPS readout so I can see it.",
        remix:
            "Turn the FPS check into a tiny performance dashboard with a scrolling frame-time graph, green-to-red thresholds, and a button that switches between two frame caps.",
        build:
            "Make a stress-test toy where clicks add bouncing shapes and the display tracks object count and FPS. Add a clear-all button and highlight when performance drops.",
        invent:
            "Keep the adjustable frame cap, but visualize it with [a graph, moving object, or animation] and let me compare [two target frame rates].",
    },
    frames: {
        explain:
            "Watch the wizard sprite use selected frames from its sheet. Explain how frame rectangles identify individual poses and how those frames become a named animation.",
        remix:
            "Turn the wizard frames into a spell-casting showcase with idle, wind-up, cast, and recovery labels plus a colored flash exactly on the cast frame.",
        build:
            "Make a timing game where the wizard cycles poses and I press Space on the cast frame to launch a spell. Speed up after each successful cast.",
        invent:
            "Use selected sprite-sheet frames to create [an idle, walk, or action] animation for [a character], then add [one input-triggered pose or effect].",
    },
    friction: {
        explain:
            "Watch the beans slide across the grass and slow at different rates. Explain how friction changes their remaining velocity and point out which surface or object owns the value.",
        remix:
            "Turn the friction comparison into an ice, grass, and mud test track. Give each lane a distinct texture, slide trail, and stopping-distance marker.",
        build:
            "Make a curling-style game where I launch a bean toward a target across mixed-friction strips. Score the final distance and allow three attempts.",
        invent:
            "Keep objects sliding with different friction, but use [three surfaces] and make the goal [stop near a target, race, or avoid a hazard].",
    },
    gacha: {
        explain:
            "Click the gacha machine and watch common and rare rewards appear at different rates. Explain how the probability table chooses an item and how rarity is communicated.",
        remix:
            "Restyle the machine as a cozy capsule café with a crank animation, rarity-colored steam, and a collection shelf that fills with every new prize.",
        build:
            "Make a fair collection challenge with ten free pulls, visible odds, duplicate counters, and a guaranteed missing prize on the final pull.",
        invent:
            "Keep weighted random rewards, but fill the machine with [a themed collection], define [three rarity tiers], and add [a reveal animation or collection goal].",
    },
    gamepad: {
        explain:
            "Connect a gamepad, press its buttons, move its sticks, and watch the bean respond. Explain how the starting point detects connection, reads input, and shows a fallback message when no gamepad exists.",
        remix:
            "Turn the gamepad tester into a friendly controller diagram that lights each matching button and stick direction, with a bean mirroring the latest input.",
        build:
            "Make a gamepad warm-up challenge that asks for five random buttons or directions in sequence, measures response time, and celebrates a perfect run.",
        invent:
            "Keep gamepad detection and input feedback, but use it to control [a character or vehicle] and add [one stick action plus one button action].",
    },
    gamepadMulti: {
        explain:
            "Connect more than one gamepad and see each controller operate its own bean. Explain how input stays associated with the correct player instead of moving every character at once.",
        remix:
            "Give each connected player a bold color, numbered name tag, spawn burst, and tiny trail so it is always obvious which gamepad controls which bean.",
        build:
            "Make a local two-player coin scramble. Spawn a bean per gamepad, award coins to the correct player, and end when someone reaches five.",
        invent:
            "Keep one character per connected gamepad, but make a [co-op or competitive] game where players [share a goal or race for points].",
    },
    ghosthunting: {
        explain:
            "Aim with the pointer, click to fire, and survive the incoming ghosts. Explain how ghosts spawn, pursue the bean, take hits, and create the survival-game rhythm.",
        remix:
            "Restyle the hunt as a cheerful haunted library. Replace shots with beams from a reading lamp, make ghosts drop glowing bookmarks, and add page-flutter hit effects.",
        build:
            "Add three escalating waves with a short breather, a visible health meter, and one temporary star-shaped shield dropped by defeated ghosts.",
        invent:
            "Keep pointer aiming and approaching enemies, but choose [a defender], [a harmless projectile], and [one enemy behavior or power-up] for a new survival theme.",
    },
    gravity: {
        explain:
            "Press Space to jump and Down to drop faster, then notice the landing reaction. Explain how global gravity, upward jump speed, falling, and grounded checks work together.",
        remix:
            "Turn the gravity demo into a moon-to-Earth switcher. Press G to change gravity, tint the sky, and alter the bean's jump arc with a clear on-screen label.",
        build:
            "Make a landing challenge where the bean jumps through a floating ring and must touch down on a small pad. Score height and landing accuracy across three attempts.",
        invent:
            "Keep jumping and falling, but set the scene on [a planet or strange place], choose [light or heavy gravity], and add [one airborne collectible or landing target].",
    },
    health: {
        explain:
            "Press Space to shoot and watch the bean and zombean health labels change as hits land. Explain how damage, current health, maximum health, and defeat are connected.",
        remix:
            "Make the health display feel lively with segmented heart bars, a brief red flash on damage, a green pulse on healing, and a low-health wobble.",
        build:
            "Create a short duel where both sides have health, the opponent fires back slowly, and occasional fruit restores one point. Add a clear win and retry screen.",
        invent:
            "Keep visible health and damage, but make the fighters [two characters I choose] and add [armor, healing, or a low-health ability].",
    },
    hover: {
        explain:
            "Move the pointer over each bean and compare the enter, continuous-hover, and leave reactions. Explain when each hover event fires and why their messages differ.",
        remix:
            "Turn the beans into expressive menu mascots that wake on hover, follow the pointer with their eyes, and settle back down when the pointer leaves.",
        build:
            "Make a hover maze where I guide the pointer across safe beans without leaving them or touching red zones. Track progress and reset gently after a mistake.",
        invent:
            "Keep hover-enter, hover-update, and hover-leave behavior, but apply them to [buttons, creatures, or cards] with [three related reactions].",
    },
    kaboom: {
        explain:
            "Move the pointer around and watch the comic explosions appear. Explain which part follows the pointer, which part creates each burst, and how shake and particles sell the impact.",
        remix:
            "Replace the explosions with harmless flower poofs that bloom under the pointer, scatter petals, and gently tint nearby blossoms instead of shaking the screen.",
        build:
            "Make a quick target game where moving bubbles must be popped with a burst under the pointer. Count ten hits, penalize empty clicks, and celebrate the final pop.",
        invent:
            "Keep pointer-triggered bursts, but make them [magic, comic, watery, or musical] and add [a target, chain reaction, or score rule].",
    },
    kaplayLogoAnim: {
        explain:
            "Watch the KAPLAY logo characters slide, bounce, and settle through several coordinated animations. Explain how interpolation, repeating time, and easing shape the motion.",
        remix:
            "Turn the logo entrance into a playful morning routine where each character arrives differently, bumps the next one, and ends with a shared sparkle.",
        build:
            "Make an intro-sequence editor with three selectable easing styles. Replay the logo entrance after each choice and label how the motion feels.",
        invent:
            "Keep the multi-part animated entrance, but stage [a word or group of characters] with [three motions] and finish with [a synchronized pose or effect].",
    },
    layer: {
        explain:
            "Compare the overlapping beans and notice which one appears in front when their depth values differ. Explain how changing depth controls draw order without moving their positions.",
        remix:
            "Turn the overlapping beans into a layered paper collage with foreground leaves, middle characters, and background clouds, each casting a small depth-appropriate shadow.",
        build:
            "Make a hide-and-seek scene where a character moves behind some props and in front of others. Add three hiding spots and a click-to-find goal.",
        invent:
            "Keep explicit front-to-back ordering, but arrange [background, character, and foreground elements] into [a scene I choose] with one object that changes layers.",
    },
    layers: {
        explain:
            "Look at the BG, GAME, and UI labels and compare how their named layers stack. Explain why named layers make scene and interface ordering easier to manage.",
        remix:
            "Turn the three labels into a tiny theater: painted scenery in BG, actors in GAME, and curtains plus score in UI, with a button to reveal each layer.",
        build:
            "Make a simple photo-mode puzzle where I toggle background, game, and UI layers to recreate a target composition. Show a success message when all three match.",
        invent:
            "Use named background, game, and interface layers to build [a scene], then let [one event] temporarily hide or reorder a layer.",
    },
    lerp: {
        explain:
            "Press 1 and 2 to switch movement modes and compare how the bean eases toward its target. Explain how repeated interpolation creates smooth following and why the two formulas feel different.",
        remix:
            "Turn the moving bean into a curious firefly that trails the pointer with a glowing tail. Give the two interpolation modes visibly different trail colors.",
        build:
            "Make a calm catch game where a follower eases toward falling stars. Let me switch interpolation modes and score how many stars it reaches in twenty seconds.",
        invent:
            "Keep smooth interpolation toward a target, but use [a creature, camera, or indicator] and compare [two follow strengths or formulas] on screen.",
    },
    lerpAngle: {
        explain:
            "Move the pointer around the beans and watch them turn toward it at different rates. Explain how angle interpolation avoids snapping and handles the shortest path across a full rotation.",
        remix:
            "Make the turning beans into sunflowers that follow a moving sun. Give each flower a different response speed and a soft sway after the pointer stops.",
        build:
            "Create an aim-training game where a turret smoothly follows the pointer and can fire only when aligned with a target. Show an alignment glow and count five hits.",
        invent:
            "Keep smooth rotation toward the pointer, but use [eyes, a compass, or a turret] and make turn speed affect [a visual style or gameplay rule].",
    },
    level: {
        explain:
            "Move with left and right, jump with Space, and inspect how symbols in the text map become grass, spikes, coins, a player, and an enemy. Explain how the level layout is assembled.",
        remix:
            "Redesign the text map as a compact candy cave with a readable route, one risky shortcut, colored tiles, and a visible coin counter.",
        build:
            "Create a three-room platform level from text symbols. Add a key, a locked exit, one moving enemy, and a checkpoint before the hardest jump.",
        invent:
            "Keep a symbol-built level, but choose [a location], define [three tile or object symbols], and add [one route choice or secret].",
    },
    levelRaycast: {
        explain:
            "Watch the ray test against the tile level and its hit readout. Explain how a ray travels through level space, what the first hit contains, and why walls block it.",
        remix:
            "Turn the ray into a sweeping submarine sonar beam. Highlight the first wall it touches, draw the travel distance, and leave a fading echo ring.",
        build:
            "Make a hidden-treasure scanner where I aim a ray through a tile maze. Show distance clues, block the scan at walls, and reveal the treasure after three accurate pings.",
        invent:
            "Keep raycasting through a tile level, but style it as [sonar, a flashlight, or a laser] and make the first hit trigger [a clue or reaction].",
    },
    levelcomp: {
        explain:
            "Move and jump through the tile-built scene, then explain how the level behaves as one object whose children are the player, ground, coins, spikes, and enemies.",
        remix:
            "Turn the compact tile scene into a toy-block diorama with a visible grid, rounded tiles, and a quick ripple across the whole level when a coin is collected.",
        build:
            "Make two small tile rooms and slide the entire level object between them after the first coin is found. Preserve collisions and show which room is active.",
        invent:
            "Keep the level as a movable parent object, build [a short tile layout], and make the whole level [shift, shake, rotate, or reveal] after [an event].",
    },
    lifespan: {
        explain:
            "Watch the temporary shapes appear, fade, and remove themselves. Explain how lifetime, fade time, and end behavior work together without a separate cleanup step.",
        remix:
            "Turn the temporary objects into glowing wishes that rise, shrink, and fade at slightly different speeds before leaving one final sparkle.",
        build:
            "Make a quick tap game where targets live for only a moment. Score clicks before they fade, shorten the lifetime gradually, and run for fifteen seconds.",
        invent:
            "Give [a particle, message, or temporary creature] a lifespan with [a fade, scale, or color change] and trigger one action just before it disappears.",
    },
    linecap: {
        explain:
            "Compare the same thick line with butt, round, and square ends. Explain how the cap style changes only the endpoints and why that matters for paths and strokes.",
        remix:
            "Present the line caps as three neon sign tubes with labels, glowing ends, and an animated light traveling from start to finish.",
        build:
            "Make a connect-the-dots drawing where I switch cap styles before drawing each segment. Score the result against a target silhouette.",
        invent:
            "Draw [a road, rope, or light trail] with selectable [butt, round, and square] caps, and make the endpoint style affect [one visual or gameplay detail].",
    },
    linejoin: {
        explain:
            "Compare the bent lines with miter, round, and bevel joins. Explain how each style treats a sharp corner and why very acute angles can look different.",
        remix:
            "Turn the join comparison into three mountain ridgelines at sunset, each labeled and outlined so the corner treatment is unmistakable.",
        build:
            "Make a path-building puzzle where I place corner points and choose the join style that best matches a target road. Reveal the difference after each choice.",
        invent:
            "Draw a multi-segment [path, bolt, or border] and let me compare [miter, round, and bevel] joins using [a palette or thickness I choose].",
    },
    livequery: {
        explain:
            "Click ghosts to change whether they belong to the touchable group and watch the live count update automatically. Explain how the saved query stays current as object tags change.",
        remix:
            "Turn the ghost count into a party guest list. Clicking a ghost should toggle invited status, add a wristband color, and update an animated attendance badge.",
        build:
            "Make a sorting challenge where ghosts switch between sleepy and awake groups. Ask for an exact awake count, track it live, and celebrate when the target is reached.",
        invent:
            "Keep a live-updating group query, but sort [characters or objects] by [a toggleable trait] and use the current count for [a goal or scene reaction].",
    },
    loadingScreen: {
        explain:
            "Reload and watch the custom loading screen before the beans and ghosts appear, then press Space if the starting point offers another transition. Explain what can be drawn while assets load.",
        remix:
            "Turn the loader into a tiny campsite where a fire grows with progress, stars appear one by one, and the finished scene opens with a sunrise.",
        build:
            "Make a playful loading mini-scene where I can move a small character while the progress bar fills, then smoothly reuse that character in the main scene.",
        invent:
            "Design a loading screen for [a theme] where progress changes [an object or short animation] and completion transitions naturally into the game.",
    },
    maze: {
        explain:
            "Click to generate or interact with the maze and inspect how mathematical rules become walls and passages. Explain how the grid is carved and how the bean is placed in open cells.",
        remix:
            "Restyle the maze as an overgrown garden with hedge walls, stepping-stone floors, a visible entrance, and a glowing flower at the exit.",
        build:
            "Make the generated maze playable with arrow-key movement, a breadcrumb trail, a timer, and a new maze button after reaching the exit.",
        invent:
            "Keep procedural maze generation, but choose [a visual theme], [a player], and [one collectible, hazard, or visibility rule].",
    },
    mazeRaycastedLight: {
        explain:
            "Move the pointer and watch light and shadow reshape around the maze walls. Explain how rays find wall edges and turn those hits into the visible lit region.",
        remix:
            "Turn the light into a warm lantern carried through a rainy hedge maze. Add a soft amber falloff, drifting motes, and brief glints on nearby corners.",
        build:
            "Make a dark maze escape where the pointer aims a limited lantern beam. Add three hidden fireflies that extend the light and reveal the exit after all are found.",
        invent:
            "Keep wall-aware raycast lighting, but use [a flashlight, candle, or magical glow] in [a maze theme] with [one hidden-object or stealth rule].",
    },
    movement: {
        explain:
            "Move the bean with the arrow keys, click a destination, and try any pointer-based movement shown. Explain how direct key movement differs from moving toward a target point.",
        remix:
            "Make the bean feel responsive with acceleration, a tiny lean in the travel direction, dust puffs on sharp turns, and a marker where I click.",
        build:
            "Create a collect-five-dots game that supports both arrow keys and click-to-move. Keep the bean on screen and show which control method was used last.",
        invent:
            "Keep both directional and click-to-target movement, but control [a character or vehicle] in [a small themed arena] with [one movement-based challenge].",
    },
    multitexture: {
        explain:
            "Move and jump through the small platform scene and watch the textured wipe shader affect the visuals. Explain how a second image acts as a mask for the transition.",
        remix:
            "Turn the texture mask into a magical ink reveal that sweeps across the level after collecting a coin, uncovering a bright alternate world underneath.",
        build:
            "Make a two-world platform challenge where Space toggles a masked reveal and only the visible world has safe platforms. Add one coin in each world.",
        invent:
            "Keep a second texture controlling a visual reveal, but use [a cloud, paint, or patterned mask] to transition between [two scene styles].",
    },
    onLoadError: {
        explain:
            "The starting point deliberately tries to load a missing asset and handles the failure. Explain what error is caught, how the game stays alive, and what feedback the player receives.",
        remix:
            "Replace the plain load failure with a friendly missing-character card that shows a fallback silhouette, a short message, and a retry animation.",
        build:
            "Make an asset-loading gallery where one item fails on purpose. Show successful thumbnails, a clear fallback for the failure, and a Retry Failed Item button.",
        invent:
            "Keep graceful handling for a missing [sprite, sound, or other asset], but show [a themed fallback] and let the player [retry or continue].",
    },
    out: {
        explain:
            "Launch the bean with Space or a click and watch what happens when it crosses the screen boundary. Explain the difference between becoming invisible, leaving the view, and being removed.",
        remix:
            "Turn the boundary test into a postcard journey: the bean flies off one edge, leaves a travel stamp, and re-enters from the opposite edge with a new color.",
        build:
            "Make a keep-it-on-screen game where wind pushes the bean toward an edge and clicks nudge it back. Survive fifteen seconds and warn when it nears a boundary.",
        invent:
            "Keep out-of-screen detection, but send [an object] beyond the edge and make that event [wrap, score, respawn, or trigger a scene change].",
    },
    overlap: {
        explain:
            "Move or drag the shapes through one another and watch the overlap region or messages change. Explain how overlap differs from a solid collision that blocks movement.",
        remix:
            "Turn the overlapping shapes into colored spotlights that create a brighter mixed color where they cross, with a label for the current overlap area.",
        build:
            "Make a Venn-diagram sorting game where draggable icons must sit in one circle, the other, or their overlap. Confirm each correct placement with a pulse.",
        invent:
            "Keep non-blocking overlap detection, but use [two zones or objects] and make their shared area trigger [a color mix, score, or special effect].",
    },
    particle: {
        explain:
            "Click or press Space to emit particles and watch how their speed, angle, lifetime, color, and gravity vary. Explain which settings shape the overall burst.",
        remix:
            "Turn the particle emitter into a tiny weather switcher that cycles through rain, snow, leaves, and fireflies, each with distinct motion and lifetime.",
        build:
            "Make a particle-powered target game where holding Space charges a burst and releasing launches it toward a ring. Score based on how many particles pass through.",
        invent:
            "Create a particle effect made of [a sprite or shape] for [an event], with [a motion pattern], [a color transition], and [a short lifetime].",
    },
    particleTrail: {
        explain:
            "Move the pointer and watch hexagon particles form a fading trail behind it. Explain how emission rate, lifetime, size, and the pointer's velocity shape the trail.",
        remix:
            "Turn the pointer trail into a comet ribbon with a bright head, a cool-to-warm color fade, and wider sparks after fast turns.",
        build:
            "Make a trail-drawing challenge where I trace a glowing symbol before the particles fade. Show coverage, time, and a success burst when the shape is complete.",
        invent:
            "Keep a pointer-following particle trail, but style it as [smoke, stars, ink, or petals] and make speed change [its color, width, or density].",
    },
    patrol: {
        explain:
            "Watch the bean travel back and forth along its patrol route and report when it reaches an end. Explain how direction, speed, and boundary checks keep it looping.",
        remix:
            "Turn the patrolling bean into a sleepy night guard with a lantern cone, a turnaround pause, and footsteps that quicken near each endpoint.",
        build:
            "Make a stealth crossing game where I click to move a tiny character while the guard patrols. Add safe bushes, a spotted reaction, and a goal door.",
        invent:
            "Keep an automatic patrol between boundaries, but use [a guard, animal, or vehicle] and add [a pause, detection zone, or route surprise].",
    },
    pauseMenu: {
        explain:
            "Play the flappy game, open the pause menu, and hover its choices. Explain how gameplay freezes while the fixed menu remains interactive and how resuming restores the action.",
        remix:
            "Restyle the pause screen as a soft snapshot overlay that blurs and dims the game, shows the current score, and gives Resume and Restart satisfying button feedback.",
        build:
            "Add a settings panel inside the pause menu with sound and reduced-motion toggles. Keep the game frozen and preserve the chosen settings after resuming.",
        invent:
            "Keep a pause overlay that stops gameplay, but theme it for [my game style] and include [two actions or settings] with clear hover and click states.",
    },
    picture: {
        explain:
            "Compare the static picture drawing with ordinary repeated drawing. Explain how storing a finished set of draw commands avoids rebuilding unchanged art every frame.",
        remix:
            "Use the stored picture as a decorative storybook panel with a layered border, title, and one small animated character drawn separately above it.",
        build:
            "Make a postcard collection where each completed scene is stored as a reusable picture and displayed in a three-card gallery with selectable captions.",
        invent:
            "Store [a static scene, icon, or decorative panel] as a reusable picture, then combine it with [one moving or interactive element].",
    },
    piecewise: {
        explain:
            "Compare the two connected curves made from the same control points. Explain how piecewise Bezier and Catmull-Rom paths join segments and why their bends differ.",
        remix:
            "Turn the paired curves into two scenic train routes with stations at control points, moving engines, and distinct colors for the two interpolation styles.",
        build:
            "Make a route-design game where I choose control points, preview both curve types, and send a vehicle along the smoother route to collect stations.",
        invent:
            "Build a connected path through [a set of points] using [Bezier or Catmull-Rom segments], then move [an object] along it with visible joins.",
    },
    platformEffector: {
        explain:
            "Move, jump with Space, and press Down to pass through the one-way platforms. Explain why the bean can rise through them but lands when falling from above.",
        remix:
            "Turn the one-way platforms into soft clouds that brighten on landing, scatter mist when crossed from below, and become transparent while dropping through.",
        build:
            "Make a vertical coin climb where one-way platforms move slowly and Down enables quick descents to lower coins. Add a fall reset and a goal at the top.",
        invent:
            "Keep jump-through, land-on-top platforms, but style them as [clouds, trapdoors, or branches] and add [a timing, moving, or drop-through challenge].",
    },
    platformer: {
        explain:
            "Move, jump, drop through platforms, and try the extra action keys while collecting the prize and avoiding hazards. Explain the level goal, player abilities, enemies, and win-or-lose flow.",
        remix:
            "Restyle the platformer as a tiny clock tower with gear platforms, wind-up enemies, brass sparks, and a glowing key at the top.",
        build:
            "Add one compact second room that teaches a new moving-platform challenge, carries the score forward, and ends with a satisfying escape sequence.",
        invent:
            "Keep the platformer structure, but choose [a hero], [a setting], [one enemy], and [one movement power] for a short themed level.",
    },
    polygon: {
        explain:
            "Drag the polygon's corners and watch its triangles and convexity change. Explain how the custom points define the shape, how it is triangulated, and when it becomes concave.",
        remix:
            "Turn the editable polygon into a stained-glass creature. Give each triangle a related color and redraw the eye and outline as I move the corners.",
        build:
            "Make a silhouette puzzle where I drag polygon corners to fit a target outline. Show fit accuracy, snap close points, and celebrate a close match.",
        invent:
            "Keep draggable polygon corners, but let me sculpt [a creature, badge, or island] and use [triangulation, color, or convexity] as part of the challenge.",
    },
    polygonbug: {
        explain:
            "Drag the oddly shaped polygon's corners and watch its triangle divisions and shading update. Explain which point arrangements make the shape difficult and how triangulation handles them.",
        remix:
            "Turn this edge-case polygon into an interactive kaleidoscope where each triangle gets a mirrored color and dragging a corner leaves a faint previous outline.",
        build:
            "Make a repair puzzle where I drag the malformed corner until every triangle is valid and the polygon becomes brightly colored. Add a reset and success indicator.",
        invent:
            "Start with an awkward concave polygon, let me drag its points, and turn [valid triangulation or convexity] into [a visual signal or puzzle goal].",
    },
    polygongeneration: {
        explain:
            "Compare the generated hexagon, star, and meshed cogs, then drag a cog to rotate the pair. Explain how a few radius and point counts create each polygon and gear relationship.",
        remix:
            "Turn the generated polygons into a jewel-box mechanism with faceted colors, engraved outlines, and two gears that sparkle where their teeth meet.",
        build:
            "Make a gear-alignment puzzle where I drag one cog until the star pointer reaches a target angle. Randomize the gear sizes and show when the teeth ratio is correct.",
        invent:
            "Generate [a regular polygon, star, or cog] with values I choose, connect it to [another rotating shape], and add [a matching or timing goal].",
    },
    pong: {
        explain:
            "Play the paddle game and watch the ball bounce, score, and reset after crossing an edge. Explain the paddle controls, reflection angle, and point flow.",
        remix:
            "Restyle Pong as a deep-sea jelly rally with glowing paddles, bubble trails, and a watery ripple every time the ball changes direction.",
        build:
            "Add a first-to-five match with a serve countdown, slightly faster rallies after each hit, and one wide-paddle bonus that appears briefly.",
        invent:
            "Keep the two-paddle rally, but choose [a sport or setting], replace the ball with [an object], and add [one temporary power or arena rule].",
    },
    postEffect: {
        explain:
            "Move through the platform scene and use Up and Down to cycle the screen effects. Explain how each post-effect changes the final image without changing the game objects themselves.",
        remix:
            "Turn the effects into mood filters named Dream, Danger, Underwater, and Moonlight, with a small label and a smooth transition between them.",
        build:
            "Make a filter-switching puzzle where hidden platforms appear only under the correct post-effect. Add three short sections and show the active lens.",
        invent:
            "Keep selectable full-screen effects, but create [two or three visual moods] and make one filter reveal [a clue, path, or hidden object].",
    },
    quadtree: {
        explain:
            "Click beans to select them, right-click to add more, move selected beans, and press C if available. Explain how the red spatial grid narrows which objects need precise checking.",
        remix:
            "Turn the quadtree display into a living city map where districts subdivide as residents gather, selected residents glow, and new residents arrive on right-click.",
        build:
            "Make a crowd-finding challenge where I must click a highlighted bean among sixty-four. Use the spatial grid, count search checks, and reshuffle after each find.",
        invent:
            "Keep visible spatial subdivision for many objects, but use [a swarm, city, or star field] and let me [add, select, or move] members while the regions update.",
    },
    query: {
        explain:
            "Click the beans and ghosts and watch which tagged groups are found or changed. Explain how object tags let the game address many matching objects without storing each one separately.",
        remix:
            "Turn the query example into a cast director: click a character type to spotlight every matching actor, dim the others, and show the selected group count.",
        build:
            "Make a sorting game where a command asks for all beans or all ghosts to move into a zone. Use group queries, a timer, and three increasingly mixed rounds.",
        invent:
            "Tag objects by [type, team, or state], then use one group query to make all matching objects [move, change color, or react] together.",
    },
    raycastObject: {
        explain:
            "Aim or drag the ray across the interactive objects and watch the first hit point and normal change. Explain how object collision areas are tested and what information comes back.",
        remix:
            "Turn the ray into a museum security laser that paints the first object red, draws a bright impact spark, and shows the reflected direction.",
        build:
            "Make a ricochet puzzle where I rotate mirrors so a ray reaches a target. Show each object hit in order and reset the beam when a mirror moves.",
        invent:
            "Cast a ray through [interactive objects], highlight the first hit, and make contact trigger [a reflection, scan result, or object reaction].",
    },
    raycastShape: {
        explain:
            "Aim or drag the ray across the standalone shapes and compare hit points on circles, rectangles, and polygons. Explain how raycasting works without full game objects.",
        remix:
            "Style the shapes as planets and the ray as a survey beam. Label the nearest surface hit, draw its normal, and add a tiny scan pulse around the contact point.",
        build:
            "Make a geometry scanner challenge where a mystery shape is partly hidden and three rays help identify it. Let me choose the shape and reveal the answer.",
        invent:
            "Raycast against [a circle, rectangle, or custom polygon], show [the hit point, distance, or normal], and turn the result into [a clue or effect].",
    },
    raycaster3d: {
        explain:
            "Use the arrow keys to explore the faux-3D maze and try F, G, and R for its extra controls. Explain how 2D rays become wall slices that create the depth illusion.",
        remix:
            "Restyle the raycast maze as a glowing space station with colored wall panels, distance fog, a small overhead map, and smoother turning.",
        build:
            "Make a short first-person key hunt with one locked exit, three collectible beacons, and a pursuing marker shown on the minimap.",
        invent:
            "Keep the raycasted 3D view, but choose [a maze theme], [one collectible], and [one lighting, map, or enemy rule].",
    },
    rebinding: {
        explain:
            "Click the control and assign a new input to the Say Hi action, then use it. Explain how the named action stays the same while its physical key or button changes.",
        remix:
            "Turn the rebinding screen into a polished controls card that listens for the next input, shows the old and new binding, and confirms with a cheerful flash.",
        build:
            "Make a tiny two-action game with Move and Wave, plus a pause-screen controls panel where both actions can be rebound and tested immediately.",
        invent:
            "Create named actions for [two game abilities], let me rebind each one on screen, and show [a clear confirmation plus conflict warning].",
    },
    restitution: {
        explain:
            "Watch the beans bounce off the ground at different heights. Explain how restitution controls how much impact speed returns after contact and why some bounces die out sooner.",
        remix:
            "Turn the bounce comparison into a jelly laboratory with squash-and-stretch, height markers, and floor colors that match each restitution value.",
        build:
            "Make a bounce-shot game where I drop a bean onto adjustable pads to reach a target basket. Give me three pad strengths and a trajectory preview.",
        invent:
            "Keep different bounce strengths, but use [balls, creatures, or materials] and make the goal [reach a height, land in a target, or survive obstacles].",
    },
    retrieve: {
        explain:
            "Move the pointer through the bean field and watch the nearby-object count or highlights change. Explain how a broad retrieval step finds candidates before precise collision checks.",
        remix:
            "Turn the retrieval area into a friendly radar around the pointer, with nearby beans glowing by distance and a small count at the center.",
        build:
            "Make a rescue scanner game where I sweep a circular detector over hidden beans. Reveal nearby signals, count rescues, and finish after finding all of them.",
        invent:
            "Retrieve nearby [objects or creatures] around [the pointer or player], visualize the search area, and use the results for [selection, attraction, or a count goal].",
    },
    rodbuilder: {
        explain:
            "Drag the connected balls, use the mouse buttons to connect or detach them, and try G and S for gravity and simulation. Explain how rods, pins, and distance rules shape the structure.",
        remix:
            "Turn the physics builder into a colorful mobile workshop with clear connection lines, sticky red anchors, soft shadows, and a pause badge when simulation stops.",
        build:
            "Make a bridge-building challenge where I connect rods between anchors, start the simulation, and try to hold three falling beans for five seconds.",
        invent:
            "Keep draggable points and distance rods, but ask me to build [a bridge, creature, or hanging mobile] under [gravity or no gravity] with one stability goal.",
    },
    rpg: {
        explain:
            "Explore the map, collect the key, pass through doors, avoid or meet characters, and reach the win condition. Explain the tile map, interactions, inventory, and scene flow.",
        remix:
            "Restyle the RPG as a rainy little village with warm windows, a lost library key, character speech bubbles, and puddle ripples around the bean.",
        build:
            "Add one short quest: talk to the ghost, find its missing bag behind a locked door, return it, and receive a visible thank-you reward.",
        invent:
            "Keep the compact RPG map, but choose [a setting], [one quest giver], [one item], and [one locked place or choice] for a tiny adventure.",
    },
    runner: {
        explain:
            "Click or press Space to jump over incoming obstacles and watch the endless course speed and score change. Explain spawning, ground movement, jump timing, and game over.",
        remix:
            "Restyle the runner as a rainy rooftop dash with umbrella jumps, chimney obstacles, splash particles, and a skyline that scrolls at layered speeds.",
        build:
            "Add a three-part run with a warm-up, faster middle, and short finale. Include one airborne collectible, a best score, and an immediate replay prompt.",
        invent:
            "Keep the one-button endless run, but choose [a runner], [an obstacle], [a collectible], and [one changing weather or speed rule].",
    },
    scaletest: {
        explain:
            "Compare the bean drawn directly with the bean added as an object inside the fixed 640-by-360 letterboxed game. Explain how scaling and letterboxing preserve the intended view.",
        remix:
            "Turn the scale check into a responsive postcard with corner guides, a centered subject, and labels showing the game area versus the surrounding letterbox.",
        build:
            "Make a framing test where four targets sit near the design edges and I resize the window to keep them visible. Highlight any target outside the safe area.",
        invent:
            "Keep a fixed-aspect game view, but compose [a small scene] with [edge and center markers] so I can see how it scales across window shapes.",
    },
    scenes: {
        explain:
            "Play through the platform scene, collect coins, enter the portal, and reach the lose or score scene. Explain how each scene owns its objects and how data moves between scenes.",
        remix:
            "Give each scene a distinct transition: a quick iris into play, a coin-count sweep into the portal, and a soft rewind when restarting after a loss.",
        build:
            "Add a title scene and a compact second level while carrying the coin score between them. Include one checkpoint and a final results scene.",
        invent:
            "Build a flow of [title, play, and result scenes] for [a tiny game idea], pass [one score or choice] forward, and add [a transition style].",
    },
    scopes: {
        explain:
            "Press A, S, D, and F across the scenes and compare which handlers keep responding. Explain how app, scene, object, and default lifetimes decide when an event remains active.",
        remix:
            "Turn the scope lesson into a backstage diagram where four colored lights represent app, scene, object, and transition handlers and switch off when their lifetime ends.",
        build:
            "Make a two-room soundboard where global music controls survive every room, room sounds reset on travel, and an object's sound disappears when that object is removed.",
        invent:
            "Demonstrate [global, scene, and object] lifetimes with [three visible reactions], then change scenes so I can see exactly which ones remain.",
    },
    shader: {
        explain:
            "Look at the shader-altered bean and compare it with the ordinary sprite. Explain in plain language how the pixel color is changed after the sprite is drawn.",
        remix:
            "Create three friendly shader looks for the bean: underwater wobble, hologram scanlines, and warm sunset tint, with a key to cycle them.",
        build:
            "Make a shader-vision puzzle where one filter reveals a hidden symbol on screen. Show the active filter and give me three possible symbols to find.",
        invent:
            "Apply a [color, distortion, or dissolve] shader to [a sprite or scene], let one input control [its strength or time], and label the effect.",
    },
    shapeRect: {
        explain:
            "Compare the rectangles with different sizes, rounding, fill, and outline settings. Explain which option changes each visible property and how the anchor affects placement.",
        remix:
            "Turn the rectangle sampler into a polished set of game cards with rounded corners, layered borders, rarity colors, and one selected-card glow.",
        build:
            "Make a memory-match game using rounded rectangle cards. Flip two at a time, match simple symbols, and track moves until all pairs are found.",
        invent:
            "Use rectangles to design [cards, panels, platforms, or buttons] with [a corner radius, outline, and palette] plus one interactive state.",
    },
    shooter: {
        explain:
            "Move left and right, shoot with Space, use Up for the intense mode, and watch enemies, bullets, score, and lives interact. Explain the main arcade loop.",
        remix:
            "Restyle the shooter as a garden defense game where the bean launches seeds at descending pests, flowers bloom on hits, and intense mode becomes a rain shower.",
        build:
            "Add a short boss encounter after the first wave with a visible health bar, two readable attack patterns, and a victory sequence that preserves the arcade pace.",
        invent:
            "Keep the horizontal shooter controls, but choose [a defender], [a projectile], [an enemy formation], and [one temporary special mode].",
    },
    size: {
        explain:
            "Resize the game area or click as shown and watch the bean remain correctly framed inside the letterboxed view. Explain how the design size and outer viewport preserve aspect ratio.",
        remix:
            "Turn the sizing demo into a responsive film frame with safe-area guides, corner decorations, and a background that extends naturally into the letterbox.",
        build:
            "Make a resize challenge where targets appear at the four design corners and center. Track whether all remain visible as the viewport changes shape.",
        invent:
            "Keep aspect-ratio-safe sizing, but frame [a game scene or interface] for [a chosen design resolution] and show [safe-area or viewport guides].",
    },
    slice9: {
        explain:
            "Move the pointer and watch the nine-slice panel resize without stretching its corners. Explain which parts stay fixed, which edges stretch, and how the center fills.",
        remix:
            "Turn the resizable panel into a fantasy dialogue box with ornate corners, a parchment center, a speaker name tab, and smooth growth toward the pointer.",
        build:
            "Make a draggable window-layout puzzle with three nine-slice panels. Snap them into a tidy dashboard and preserve every border while resizing.",
        invent:
            "Use nine-slice scaling for [a dialogue box, button, or window] with [a themed border], then let [the pointer or text length] resize it.",
    },
    slice9Tiled: {
        explain:
            "Compare the nine-slice panels whose edges or centers tile instead of stretching. Explain how tiling preserves texture scale as the panel grows.",
        remix:
            "Build three large tiled panels from brick, vine, and star patterns, with labels showing which edges and centers repeat.",
        build:
            "Make a room decorator where I resize a tiled wall panel and switch among three textures without distorting the border pieces.",
        invent:
            "Create a tiled nine-slice [wall, banner, or panel] from [a repeating pattern] and let me adjust [its width, height, or tile mode].",
    },
    sokoban: {
        explain:
            "Push the boxes onto their targets, watch the move counter, and finish the warehouse puzzle. Explain why boxes can be pushed but not pulled and how the game detects completion.",
        remix:
            "Restyle the warehouse as a sleepy bakery where the bean pushes pastry crates onto cooling mats, leaving flour puffs and a perfect-score ribbon.",
        build:
            "Add a compact second Sokoban level with one sturdy immovable box, a reset button, and a best-move target shown before the first push.",
        invent:
            "Keep push-only box movement, but choose [a setting], [a pushable object], [a target], and [one special tile or scoring rule].",
    },
    spriteAnim: {
        explain:
            "Move left and right and watch the dinosaur switch and flip its sprite animation. Explain how named frame sequences, playback, and direction create the walk cycle.",
        remix:
            "Make the dinosaur animation feel alive with idle breathing, a quick turnaround pose, dust on fast steps, and a tiny hello emote when it stops.",
        build:
            "Create a short walk-and-deliver game where the dinosaur carries a parcel across the screen, climbs one step, and plays a celebration animation at the mailbox.",
        invent:
            "Keep named sprite animations and directional flipping, but use [a character] with [idle, move, and action] clips for [a simple task].",
    },
    spriteatlas: {
        explain:
            "Move around the atlas-built room, open the chest with Space, and inspect how many named sprites come from one packed image. Explain how atlas regions become reusable tiles and props.",
        remix:
            "Turn the atlas room into a tiny treasure chamber with coordinated wall tiles, a glowing chest, and dust motes that rise when it opens.",
        build:
            "Make a one-room key-and-chest puzzle using only atlas regions. Hide the key behind one movable object and celebrate with a short chest animation.",
        invent:
            "Use a sprite atlas to build [a room or scene] from [tiles and props], then make [one atlas object] react to [a key or collision].",
    },
    text: {
        explain:
            "Type characters, use the arrow keys, and compare the plain and styled text on screen. Explain wrapping, alignment, inline styles, and how live input changes a text object.",
        remix:
            "Turn the text sampler into a kinetic poem where typed words drift into place, color tags highlight moods, and arrow keys change alignment like stage directions.",
        build:
            "Make a typing challenge that shows a short phrase, tracks correct characters, colors mistakes, and celebrates the finished line with a wave animation.",
        invent:
            "Create interactive text for [a poem, dialogue, or typing game] using [wrapping, alignment, and styled spans] plus [one keyboard-driven effect].",
    },
    textInput: {
        explain:
            "Click the text field, type and edit a phrase, move the caret, and try selection if available. Explain how input, caret position, focus, and displayed text stay synchronized.",
        remix:
            "Style the text input as a wizard's naming card with a blinking rune caret, a character limit, and a live preview on a glowing badge.",
        build:
            "Make a tiny character-name screen that validates the input, enables Continue only for a valid name, and introduces the named character afterward.",
        invent:
            "Keep editable text and caret behavior, but use it for [a character name, chat bubble, or search box] with [one validation or live-preview rule].",
    },
    tightspritearea: {
        explain:
            "Inspect the large irregular sprite and its collision outline. Explain how tracing the visible silhouette and wrapping it in a convex hull gives a tighter area than a plain rectangle.",
        remix:
            "Make the tight collision outline visible as a pulsing scanner around the creature, with contact points sparkling when the pointer approaches the silhouette.",
        build:
            "Create a silhouette-fitting game where the irregular sprite must pass through a matching opening. Show near misses and snap into place on a correct fit.",
        invent:
            "Build a tight collision area for [an irregular sprite], visualize its outline, and use it in [a fitting, dodging, or precise-click challenge].",
    },
    tiled: {
        explain:
            "Look at the bean sprite repeated across a larger area and compare its tile settings. Explain how the image repeats instead of stretching and how offsets or scale affect the pattern.",
        remix:
            "Turn the repeated sprite into playful wrapping paper with alternating rows, a limited palette, and a slow diagonal pattern drift.",
        build:
            "Make a pattern-matching puzzle where I adjust tile scale and offset to align a moving pattern with a faint target grid.",
        invent:
            "Tile [a sprite or motif] across [a background or object], then let me change [scale, spacing, offset, or movement] to create a pattern.",
    },
    timer: {
        explain:
            "Watch the timed and repeating actions fire around the bean. Explain the difference between waiting once, looping, pausing, and counting elapsed time.",
        remix:
            "Turn the timer examples into a tiny kitchen clock scene with a sweeping hand, three labeled alarms, and a bean reacting differently to each one.",
        build:
            "Make a ten-second collect game where dots appear on a repeating timer, the countdown is visible, and a final score screen stops every active timer cleanly.",
        invent:
            "Use timers to schedule [one delayed event], repeat [one action], and end [a short challenge] after [a duration I choose].",
    },
    truck: {
        explain:
            "Drag the truck and its free handle to move the bucket while the wheels rotate with distance. Explain how parent-child transforms, constraints, and snapping create the articulated vehicle.",
        remix:
            "Turn the plain truck into a bright construction crane with striped wheels, a joint-angle gauge, dust while rolling, and a magnet hanging from the bucket.",
        build:
            "Make a loading challenge where I drive the truck and position its constrained bucket under three falling blocks. Snap collected blocks into the bed and count deliveries.",
        invent:
            "Keep the draggable truck with rotating wheels and a constrained arm, but make it [a crane, digger, or rescue vehicle] with [one pickup or positioning task].",
    },
    tween: {
        explain:
            "Use left and right clicks as instructed and watch the bean appear, move, or grow smoothly. Explain how a tween changes a value from its start to end over time.",
        remix:
            "Make each pointer action feel like stage magic: fade the bean in with sparkles, grow it with squash-and-stretch, and leave a soft landing ring.",
        build:
            "Create a click-to-guide game where the bean tweens between stepping stones before they fade. Queue clicks, show the next target, and win after five safe moves.",
        invent:
            "Tween [position, size, color, or opacity] for [a character or object] when [an input happens], using [an easing mood such as snappy or gentle].",
    },
    tweenEasings: {
        explain:
            "Click and use the arrow keys to compare the many easing motions. Explain why every move has the same endpoints but feels bouncy, sharp, slow, or elastic in between.",
        remix:
            "Turn the easing list into a character audition where each bean has a motion personality label and performs the same entrance on click.",
        build:
            "Make an easing-guess game: play one unlabeled motion, offer three names, and reveal the curve plus score after I choose.",
        invent:
            "Compare [three easing styles] on the same [movement or scale change], label how each feels, and let [a click or arrow key] replay them together.",
    },
    tweenEasingsCustom: {
        explain:
            "Click the controls and compare the handmade easing curves. Explain how each mathematical curve changes acceleration between the same start and end values.",
        remix:
            "Visualize every custom easing as both a moving object and a live graph, with a trail showing where it sped up, paused, or overshot.",
        build:
            "Make a small curve editor where I adjust two control values, replay the tween, and save the result as Calm, Punchy, or Wobbly.",
        invent:
            "Create a custom easing that feels [heavy, springy, hesitant, or playful], apply it to [a motion], and show its curve beside the animation.",
    },
    video: {
        explain:
            "Click to play the video and press Space to toggle looping. Explain how playback, pause, loop state, and the on-screen video texture are connected.",
        remix:
            "Present the video inside a retro portable television with scanlines, a glowing play button, a loop indicator, and a brief static burst when it restarts.",
        build:
            "Make a three-clip viewing kiosk with play, pause, loop, and next controls plus a title card that updates for the selected clip.",
        invent:
            "Display [a video clip] inside [a themed frame], control it with [click and one key], and make [looping or completion] trigger a visible reaction.",
    },
    vn: {
        explain:
            "Advance through the visual-novel conversation and watch portraits, names, and typewriter text change. Explain how each dialogue entry drives the speaker and line progression.",
        remix:
            "Restyle the conversation as a cozy train ride at dusk with portrait expressions, a softly animated window, and distinct text sounds for each speaker.",
        build:
            "Add one meaningful dialogue choice that branches to two short responses and rejoins the story. Show the selected choice in the conversation history.",
        invent:
            "Keep portraits and typewriter dialogue, but write [a short scene premise] with [two characters], [one choice], and [one background mood change].",
    },
} as const satisfies Readonly<Record<string, ExampleCoachPrompts>>;

export function getExampleCoachPrompts(
    key: string | null | undefined,
): ExampleCoachPrompts | undefined {
    if (!key) return undefined;
    return (EXAMPLE_COACH_PROMPTS as Readonly<
        Record<string, ExampleCoachPrompts>
    >)[key];
}
