import type { EXAMPLE_COACH_PROMPTS } from "./exampleCoachPrompts.ts";

// A short explanation beside the live sample, paired with its existing remix prompts.
export const EXAMPLE_LESSONS = {
    advancedbinding:
        "One key can do different things when a modifier is held. Pairing Tab with Shift+Tab lets a character picker move forward and backward without extra keys.",
    ai: "An enemy can switch between simple states such as waiting, attacking, and chasing. Each state has its own actions and timing, so a few rules create a readable personality.",
    analogtriggers:
        "A gamepad trigger measures how far you squeeze, not just whether it is pressed. That pressure can control shot speed, color, and firing rate.",
    animation:
        "Keyframes describe values at chosen moments. Playing between them changes position, rotation, color, or opacity over time; looping turns those changes into a repeating performance.",
    audio:
        "Sound playback has adjustable volume, speed, and position. Connecting those controls to keys and visual feedback turns a sound file into an interactive instrument.",
    automaticCollider:
        "A collision outline can follow a sprite's visible silhouette instead of a plain rectangle. That makes contact better match the shape the player sees.",
    basicEventsObject:
        "Events attached to an object end when that object is removed. Game-wide events can keep responding, which is useful for scores, restart controls, and other lasting behavior.",
    basicsCompRender:
        "A sprite, rectangle, circle, text label, or polygon supplies an object's appearance. Color, outlines, and opacity can change that appearance without changing its position.",
    basicsComponents:
        "A game object combines small ingredients such as position, a sprite, and movement. Adding or changing one ingredient lets you tune a character without rebuilding everything.",
    basicsEvents:
        "Events choose when behavior runs: once after loading, every frame, or after an input. Picking the right moment prevents a one-time action from repeating constantly.",
    basicsGlobals:
        "The game context keeps drawing, input, sound, and object functions together in a variable called k. This sample turns off global names and briefly shows a greeting inside the preview using that context.",
    basicsObject:
        "A game object combines what to draw with where to draw it. An anchor chooses which point of the image sits at that position, making centering much easier.",
    basicsStart:
        "The background is the first visible part of a game. A greeting briefly appears inside this preview; adding a lasting title or character gives the green canvas a purpose.",
    bbcode:
        "Tags inside a text string can assign styles to individual words. The text stays in one place while names, warnings, or important clues get their own colors.",
    binding:
        "Named actions connect several physical inputs to the same behavior. A move or transform action can work with a keyboard, mouse, and gamepad without duplicating the game rules.",
    blend:
        "Blending decides how overlapping colors mix. Different modes can brighten, darken, or increase contrast, so the same artwork can look like light, shadow, or tinted glass.",
    burp:
        "A key press or click can trigger a sound immediately. Pairing that sound with a visual reaction makes even a tiny one-action toy feel responsive.",
    button:
        "A button combines a shape, label, pointer area, and click action. Hover and pressed feedback help a player see what is interactive before choosing it.",
    camera:
        "The camera moves the view across the game world. Keeping a score fixed to the screen lets the world pan or zoom while the interface stays readable.",
    children:
        "Child objects inherit their parent's movement and transforms. Moving one parent can carry an entire group while each child still keeps its own offset or animation.",
    clicktopmost:
        "When clickable objects overlap, the topmost one can receive the click instead of everything underneath. This makes stacks of cards or windows behave as players expect.",
    clip:
        "Clipping keeps only the part of a shape that lies inside a boundary. The original line can extend farther while only its intersecting section is displayed.",
    closestpoint:
        "The nearest point on an outline changes as the pointer moves. Curves slide smoothly while corners create sharper changes, making this useful for snapping or tracing.",
    collision:
        "Contact checks can report when objects touch, stay overlapping, or separate. Those different moments let a game trigger a single hit, ongoing damage, or an exit reaction.",
    collisionshapes:
        "Collision shapes describe the boundaries used for contact checks. Choosing a circle, rectangle, polygon, or line lets the invisible boundary match how an object should behave.",
    component:
        "A custom component bundles an object's data and behavior into a reusable ingredient. Adding or removing it can grant a temporary power without replacing the whole character.",
    concert:
        "Characters, notes, movement, and sound can be coordinated into a playable performance. A shared rhythm gives separate stage elements the feeling of acting together.",
    confetti:
        "A confetti burst creates many short-lived pieces with different speeds, angles, and spins. Gravity pulls them down, so small changes to the burst create very different celebrations.",
    constraint:
        "A constraint keeps a relationship between objects, such as distance, rotation, or scale. Moving the driving object makes linked parts follow the chosen rule.",
    constraintsflip:
        "Linked rotation makes one object turn with another. A negative horizontal scale mirrors its sprite, so crossing zero produces a flip without loading different artwork.",
    convexhull:
        "A convex hull wraps the outermost points like a stretched rubber band. It skips inward dents, giving a complex shape a simpler outside boundary.",
    curves:
        "Even steps along a curve's parameter do not always cover equal distances. Distance-based sampling makes a character travel along the path at a more even speed.",
    customCompDebug:
        "A custom behavior can expose useful values during inspection. Showing its important settings makes tuning easier than guessing from the final animation alone.",
    decisiontree:
        "A decision tree follows a series of questions to choose a result. Each answer selects the next branch, turning a collection of examples into rules you can follow.",
    doublejump:
        "A double jump tracks whether the player is grounded and how many jumps remain. Resetting that allowance on landing permits one extra jump without unlimited flight.",
    drag:
        "Dragging remembers both the selected object and where you grabbed it. Keeping that offset prevents the object from snapping its center to the pointer on pickup.",
    draw:
        "Immediate drawing redraws shapes each frame without creating lasting game objects. Transforms let several drawing commands share a position, rotation, or scale.",
    drawon:
        "An off-screen buffer collects drawing into an image that can be displayed later. This separates how a group is rendered from where its finished picture appears.",
    drawoncanvas:
        "A cached canvas can keep earlier drawings and add new ones. Applying an effect to the finished image changes the whole collection together.",
    eatlove:
        "A collection game combines movement, pickup detection, and a remaining-item count. When the last item is collected, the same rules can trigger a clear celebration.",
    egg: "A small interactive story can be built from a few states. Each action advances the egg's state and changes its appearance, turning repeated input into a sequence.",
    fadeIn:
        "Fading changes opacity over time instead of showing an object instantly. Different durations can make an entrance feel quick, gentle, or dramatic.",
    fakeMouse:
        "A virtual cursor can translate keyboard input into pointer movement and clicks. This lets an interface work even when the player is not using a physical mouse.",
    fixed_click:
        "A screen-fixed label uses screen coordinates while the world can be zoomed or moved. Its click area must follow the same space as the visible label.",
    fixedclick:
        "World objects move with the camera, while fixed interface objects stay on screen. Pointer checks need to account for that difference so both remain clickable.",
    flamebar:
        "Several hazards can rotate around a shared pivot at different distances. Keeping their angles aligned turns separate objects into one moving obstacle.",
    flappy:
        "Each flap gives an upward impulse while gravity keeps pulling down. Repeating obstacles and a score for cleared gaps turn that simple motion into a timing game.",
    floodfill:
        "Flood fill starts at one cell and visits connected neighbors that match a rule. It can discover reachable spaces, enclosed regions, or areas that need the same color.",
    fps: "A frame-rate cap limits how often the game updates and draws. A visible frame counter helps compare smoothness and timing instead of judging performance by feel alone.",
    frames:
        "A sprite sheet stores several poses in one image. Frame rectangles pick those poses out, and a named sequence turns selected frames into an animation.",
    friction:
        "Friction reduces sliding velocity after contact. Changing it makes a surface feel slippery or grippy, which changes how far a moving object travels before stopping.",
    gacha:
        "A weighted reward table gives some items a higher chance than others. Clear rarity feedback helps the player understand why occasional rewards feel special.",
    gamepad:
        "A gamepad supplies buttons and stick directions once it is connected. Checking for a controller lets the game show useful instructions when no input device is available.",
    gamepadMulti:
        "Each connected controller has its own input identity. Keeping that identity tied to one character allows several players to move independently.",
    ghosthunting:
        "Spawning enemies, aiming, hits, and survival time form a repeating game loop. Changing spawn timing or pursuit speed can make the same arena feel calm or intense.",
    gravity:
        "Gravity accelerates an object downward, while a jump gives it upward speed. Grounded checks decide when jumping is allowed and when to play a landing reaction.",
    health:
        "Health tracks how much damage an object can take. Comparing current health with zero connects individual hits to defeat, while maximum health sets the scale of a health bar.",
    hover:
        "Pointer entry, continued hovering, and pointer exit are separate moments. Use entry for a one-time highlight and continuous hovering only for effects that should keep updating.",
    kaboom:
        "An impact effect combines a short burst, motion, and visual feedback. Triggering it at the pointer makes it easy to compare how particles and shake change its feel.",
    kaplayLogoAnim:
        "Several animations can share timing while using different motion curves. Coordinating their starts and finishes turns separate letters into a single performance.",
    layer:
        "Depth changes which object draws in front without changing its position. This lets a character pass behind scenery or bring a highlight above nearby artwork.",
    layers:
        "Named layers establish a shared drawing order for backgrounds, gameplay, and interface elements. Objects can join a layer without each needing its own ordering rule.",
    lerp:
        "Interpolation moves a value partway toward a target. Repeating it each frame creates smooth following instead of an instant jump to the destination.",
    lerpAngle:
        "Angle interpolation smooths turning and handles the wrap between a full rotation and zero. This keeps a character from spinning the long way when its target crosses that boundary.",
    level:
        "A text map can use symbols as recipes for tiles, items, and characters. Editing the map changes the layout without rewriting how each kind of object behaves.",
    levelRaycast:
        "A ray follows a line through the level until it hits a boundary. The first hit can tell a game where a shot stops or which wall blocks a view.",
    levelcomp:
        "A level can be a parent object containing its tiles and characters. Treating the collection as one object makes it easier to position or manage the scene together.",
    lifespan:
        "A lifespan gives a temporary object an automatic end. Combining it with a fade makes effects disappear smoothly and avoids keeping finished objects around.",
    linecap:
        "Line caps define how a stroke ends: flat, rounded, or extended square. The middle stays the same, but the endpoint style changes how paths and borders feel.",
    linejoin:
        "Line joins define the corner where two thick segments meet. Miter, round, and bevel styles handle sharp turns differently, especially at narrow angles.",
    livequery:
        "A live query keeps track of objects matching a tag as the scene changes. Adding or removing a tag updates the group without rebuilding your own list.",
    loadingScreen:
        "A loading screen can draw progress before the game's assets are ready. It gives the player feedback during a wait instead of leaving the canvas unexplained.",
    maze:
        "A maze generator turns a grid into connected passages and walls at startup. Clicking an open cell gives the bean a destination, and pathfinding chooses a route around the walls.",
    mazeRaycastedLight:
        "Rays cast toward nearby walls determine which space a light can reach. Joining their hit points creates a lit region that changes as the light moves.",
    movement:
        "Directional movement follows held keys, while target movement heads toward a chosen point. Supporting both lets a player steer continuously or choose a destination with a click.",
    multitexture:
        "A second image can act as a mask that controls which pixels are revealed. Changing that mask creates a wipe or transition without rearranging the game world.",
    onLoadError:
        "The missing-image line starts disabled. Enabling it makes this handler report the error and stop the game; a recovery path needs substitute artwork or another way to continue.",
    out: "Leaving the visible area is different from being removed from the game. Detecting the boundary lets you choose whether an object wraps, respawns, scores, or disappears.",
    overlap:
        "An overlap check detects shared space without necessarily blocking movement. It is useful for pickups, trigger zones, and color-mixing effects where objects should pass through each other.",
    particle:
        "A particle effect combines many short-lived objects with shared rules and varied starting values. Speed, spread, lifetime, color, and gravity shape the overall burst.",
    particleTrail:
        "A trail emits short-lived particles along a moving pointer. Emission rate and lifetime control its length, while size and color change its visual weight.",
    patrol:
        "A patrol follows a list of waypoints. This bean stops at the last point and reports completion; choosing a looping or reversing end behavior would make it keep moving.",
    pauseMenu:
        "Pausing gameplay does not have to pause the interface. Keeping menu input separate lets a player choose Resume while the world remains still.",
    picture:
        "A picture stores an unchanged set of drawing commands for reuse. This lets static artwork be shown again without rebuilding its full drawing description every frame.",
    piecewise:
        "Long paths can be assembled from shorter curve segments. Their control points and joining rules determine whether the route bends smoothly or changes direction sharply.",
    platformEffector:
        "A one-way platform allows movement through it from below but supports a character falling onto it. A drop-through action temporarily changes that rule for the player.",
    platformer:
        "A platform game combines jumping, landing, hazards, and a destination. Tuning those rules together changes how demanding a level feels without needing new artwork.",
    polygon:
        "A polygon is defined by its corner points. Splitting it into triangles lets it be drawn, while moving a corner can change whether the outline has inward dents.",
    polygonbug:
        "Irregular polygons need careful triangle splitting to render correctly. Moving their points exposes arrangements where narrow corners and inward dents make that job harder.",
    polygongeneration:
        "A few values such as radius and point count can generate many outlines. Repeating those rules creates stars or gears whose related rotations can make them mesh.",
    pong:
        "A paddle game repeatedly moves a ball, reflects it on contact, and awards a point when it escapes. Paddle position and bounce angle make a small rule set feel skillful.",
    postEffect:
        "A post-effect changes the finished picture after the scene is drawn. The game rules stay the same while the whole view gains a different color or distortion.",
    quadtree:
        "A quadtree repeatedly divides space into smaller regions. Checking the relevant regions first reduces how many distant objects need detailed contact tests.",
    query:
        "Tags let a game find a group of related objects, such as every enemy or pickup. Acting on the group avoids keeping a separate reference to each member.",
    raycastObject:
        "A ray checks a line against objects' collision areas. Its first hit and surface direction can guide shots, line-of-sight checks, or reflections.",
    raycastShape:
        "Ray tests can work directly on geometric shapes without creating game objects. They report where a line first meets a boundary, which is useful for geometric tools and aiming.",
    raycaster3d:
        "A 2D map can look three-dimensional by casting rays and drawing wall slices at different heights. Nearby walls look taller, creating the impression of depth.",
    rebinding:
        "A named action can keep its behavior while the player changes its key or button. This separates what the game does from which physical control triggers it.",
    restitution:
        "Restitution controls how much motion is returned after a bounce. A higher value feels springier, while a lower one makes an object settle sooner.",
    retrieve:
        "A broad spatial search finds nearby candidates before detailed contact checks. It narrows the work without claiming that every nearby object is actually touching.",
    rodbuilder:
        "Rods, pins, and distance rules link separate objects into a structure. Moving a joint reveals which parts can rotate freely and which relationships must stay fixed.",
    rpg: "A small adventure connects a tile map with interactions, inventory, and scene changes. An item such as a key can change which paths are available to the player.",
    runner:
        "An endless runner brings obstacles toward the player instead of requiring a large level. Spawn timing, speed, and jump height determine the rhythm of each attempt.",
    scaletest:
        "A fixed design size can be scaled to fit different viewports. Letterboxing preserves its proportions by leaving unused space instead of stretching the artwork.",
    scenes:
        "Scenes separate different parts of a game and manage their own objects. Passing a score or other data into the next scene connects gameplay to an ending screen.",
    scopes:
        "An event's scope decides how long it stays active. App-wide events can outlive a scene, while object-bound events end with their object, avoiding unwanted callbacks later.",
    shader:
        "A shader changes the color of pixels while drawing an image. It can tint or distort the appearance without requiring a separate sprite for every effect.",
    shapeRect:
        "A rectangle's size, corner radius, fill, and outline shape its appearance. Its anchor controls placement, so the same basic shape can become a card, platform, or button.",
    shooter:
        "An arcade shooter connects movement, projectiles, enemy waves, health, and score. Clear hit and defeat feedback helps the player understand that fast repeating loop.",
    size:
        "A game can keep a fixed design ratio while fitting the available screen. Letterboxing protects proportions, while safe-area planning keeps important controls and targets visible.",
    slice9:
        "Nine-slice scaling divides artwork into corners, edges, and a center. The corners keep their shape while the other parts resize, making clean buttons and dialogue boxes.",
    slice9Tiled:
        "Nine-slice artwork can repeat its edges or center instead of stretching them. Tiling keeps a texture's pattern size consistent as a panel grows.",
    sokoban:
        "A push-only puzzle limits how boxes can move and checks whether all targets are filled. Because boxes cannot be pulled back, the order of your pushes matters.",
    spriteAnim:
        "A sprite sheet contains several character poses. Playing named frame sequences makes a walk cycle, and flipping the sprite changes direction without needing a second set of artwork.",
    spriteatlas:
        "A sprite atlas packs several tiles and props into one image. Named regions let a game reuse each piece independently while keeping the artwork together.",
    text:
        "Text objects can wrap, align, and style individual spans. Updating their contents from input turns a label into dialogue, a live message, or a typing game.",
    textInput:
        "Editable text needs to keep its contents, caret, selection, and focus in sync. Separating those pieces lets the game show where typing will go and validate the result.",
    tightspritearea:
        "Tracing a sprite's visible outline gives a tighter collision boundary than a box. A convex hull simplifies that outline while keeping its outermost points.",
    tiled:
        "Tiling repeats an image across an area instead of stretching one copy. Scale and offset change the pattern, making it useful for backgrounds, surfaces, and repeating decorations.",
    timer:
        "Timers schedule actions after a delay or repeat them at intervals. Keeping their lifetime under control stops old actions from firing after a challenge has ended.",
    truck:
        "Parent-child relationships carry the truck's parts together, while constraints limit their relative movement. Wheel rotation and snapping make the assembly feel like one articulated vehicle.",
    tween:
        "A tween changes a value from a start to an end over a chosen duration. The same idea can animate position, size, color, or opacity in response to an input.",
    tweenEasings:
        "Easing controls the pace of a transition between the same endpoints. Accelerating, bouncing, or overshooting changes the feeling of movement without changing its destination.",
    tweenEasingsCustom:
        "A custom easing curve defines how progress changes over time. Adjusting the curve gives a motion its own pauses, acceleration, or springiness.",
    video:
        "Video playback can become a texture in the game. Connecting play, pause, and loop controls lets the player interact with a clip as part of the scene.",
    vn: "A dialogue sequence pairs each line with a speaker and portrait. Advancing the sequence and revealing text gradually creates a story without needing complex movement controls.",
} as const satisfies Readonly<
    Record<keyof typeof EXAMPLE_COACH_PROMPTS, string>
>;

export function getExampleLesson(
    key: string | null | undefined,
): string | undefined {
    return key
        ? (EXAMPLE_LESSONS as Readonly<Record<string, string>>)[key]
        : undefined;
}
