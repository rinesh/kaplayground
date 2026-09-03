/**
 * @file Flappy
 * @description How to make a flappy bird clone
 * @difficulty 1
 * @tags game
 * @minver 3001.0
 * @category games
 */

// Adapted from kaplay/examples/flappy.js with responsive scene layout.
// There is also a version with pause menu implemented at:
// https://play.kaplayjs.com/?example=pauseMenu

kaplay({ background: [141, 183, 255], font: "happy" });

loadSprite("bean", "/sprites/bean.png");
loadBitmapFont("happy", "/fonts/happy_28x36.png", 28, 36);
loadBitmapFont("happy-o", "/fonts/happy-o_36x45.png", 36, 45);
loadSound("score", "/sounds/score.mp3");
loadSound("wooosh", "/sounds/wooosh.mp3");
loadSound("hit", "/sounds/hit.mp3");
loadSound("off", "/sounds/off.mp3");

// define gravity
setGravity(3200);

scene("game", () => {
    const PIPE_OPEN = 240;
    const PIPE_MIN = 60;
    const JUMP_FORCE = 800;
    const SPEED = 320;
    const CEILING = -60;

    // a game object consists of a list of components and tags
    const bean = add([
        // sprite() means it's drawn with a sprite of name "bean" (defined above in 'loadSprite')
        sprite("bean"),
        // give it a position
        pos(width() / 4, 0),
        // give it a collider
        area({ isSensor: true }),
        // body component enables it to fall and jump in a gravity enabled world
        body(),
        "player",
    ]);

    // check for fall death
    bean.onUpdate(() => {
        if (bean.pos.y >= height() || bean.pos.y <= CEILING) {
            play("off");
            // switch to "lose" scene
            go("lose", score);
        }
    });

    // jump buttons
    onKeyPress("space", () => {
        bean.jump(JUMP_FORCE);
        play("wooosh");
    });
    onGamepadButtonPress("south", () => {
        bean.jump(JUMP_FORCE);
        play("wooosh");
    });

    // jump mouse and touch
    onMousePress("left", () => {
        bean.jump(JUMP_FORCE);
        play("wooosh");
    });

    // we start pipe opening spawning around the center
    let prevPipeH1 = center().y - PIPE_OPEN / 2;
    const pipeOpening = () => Math.min(PIPE_OPEN, height() * 0.7);
    const pipeMinimum = () => Math.min(PIPE_MIN, height() * 0.15);

    function spawnPipe() {
        // calculate pipe positions
        // we limit random pipe height within the prev pipe opening range
        // to keep it close enough to be jumpable
        const opening = pipeOpening();
        const minimum = pipeMinimum();
        const h1 = prevPipeH1 = (() => {
            const PIPE_MAX = height() - minimum - opening;
            prevPipeH1 = clamp(prevPipeH1, minimum, PIPE_MAX);
            const low = Math.max(minimum, prevPipeH1 - opening * 1.2);
            const high = Math.min(PIPE_MAX, prevPipeH1 + opening * 1.2);
            return rand(low, high);
        })();
        const h2 = height() - h1 - opening;

        // we can create a pipe factory with common comps and customizable params
        const makePipe = (posY, h) => [
            pos(width(), posY),
            rect(64, h),
            color(0, 127, 255),
            outline(4),
            area({ isSensor: true }),
            move(LEFT, SPEED),
            offscreen({ destroy: true }),
            // give it a tag for easier behavior assignment later on
            "pipe",
            { openingRatio: h1 / (height() - opening), bottom: posY > 0 },
        ];

        // add a top pipe
        add(makePipe(0, h1));

        // add a bottom pipe
        add([
            // we can spread comps to a new array to also add custom comps
            ...makePipe(h1 + opening, h2),
            // raw obj just assigns every field to the game obj
            { passed: false },
        ]);
    }

    // callback when bean onCollide with objects with a tag "pipe"
    bean.onCollide("pipe", () => {
        go("lose", score);
        play("hit");
        addKaboom(bean.pos);
    });

    // per frame event for all objects with a tag "pipe"
    onUpdate("pipe", (p) => {
        // check if bean passed the pipe
        if (p.pos.x + p.width <= bean.pos.x && p.passed === false) {
            addScore();
            p.passed = true;
        }
    });

    // spawn a pipe every 1 sec
    loop(1, spawnPipe);

    let score = 0;

    // display score
    const scoreLabel = add([
        text(score.toString(), { font: "happy-o", size: 45 }),
        anchor("center"),
        pos(width() / 2, Math.min(80, height() * 0.2)),
        fixed(),
        z(1000),
        "score",
    ]);

    // Keep the current run in place while the surrounding panels change size.
    let previousSize = vec2(width(), height());
    onResize(() => {
        const ratio = vec2(width() / previousSize.x, height() / previousSize.y);
        bean.pos.x = width() / 4;
        bean.pos.y = clamp(bean.pos.y * ratio.y, 0, height() - bean.height);
        scoreLabel.pos = vec2(width() / 2, Math.min(80, height() * 0.2));
        const opening = pipeOpening();
        const minimum = pipeMinimum();
        for (const pipe of get("pipe")) {
            const topHeight = clamp(
                pipe.openingRatio * (height() - opening),
                minimum,
                height() - minimum - opening,
            );
            pipe.pos.x *= ratio.x;
            pipe.pos.y = pipe.bottom ? topHeight + opening : 0;
            pipe.height = pipe.bottom
                ? height() - topHeight - opening
                : topHeight;
        }
        prevPipeH1 *= ratio.y;
        previousSize = vec2(width(), height());
    });

    function addScore() {
        score++;
        scoreLabel.text = score.toString();
        play("score");
    }
});

scene("lose", (score) => {
    const bean = add([
        sprite("bean"),
        pos(width() / 2, height() / 2 - 108),
        scale(3),
        anchor("center"),
        "player",
    ]);

    // display score
    const scoreLabel = add([
        text(score, { font: "happy-o" }),
        pos(width() / 2, height() / 2 + 108),
        scale(3),
        anchor("center"),
        "score",
    ]);

    const layoutResult = () => {
        const offset = Math.min(108, height() * 0.2);
        const fit = Math.min(3, width() / 160, height() / 160);
        bean.pos = vec2(width() / 2, height() / 2 - offset);
        scoreLabel.pos = vec2(width() / 2, height() / 2 + offset);
        bean.scale = vec2(fit);
        scoreLabel.scale = vec2(fit);
    };
    layoutResult();
    onResize(layoutResult);

    // go back to game by pressing space or click/tap
    // wait so you won't trigger it right away accidentally after losing
    wait(0.2, () => {
        onKeyPress("space", () => go("game"));
        onMousePress(() => go("game"));
    });
});

onLoad(() => go("game"));
