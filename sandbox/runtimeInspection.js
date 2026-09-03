const MAX_INSPECTION_OBJECTS = 50;
const MAX_INSPECTION_TAG_LENGTH = 128;
const MAX_TAGS_PER_OBJECT = 20;
const MAX_OBJECT_STRING_LENGTH = 256;
const MAX_LAYOUT_WARNINGS = 20;
const UI_TAG_PATTERN = /^(?:ui|hud|screen|title|score|instruction|message|button)$/i;

export function createRuntimeInspector({
    getRunId,
    getReadiness,
    getDebug,
    getContext,
    readPaused,
    findCanvas = () => document.querySelector("canvas"),
    getActiveElement = () => document.activeElement,
}) {
    return function inspectRuntime({ tag, limit }) {
        const normalizedTag = normalizeInspectionTag(tag);
        const normalizedLimit = normalizeInspectionLimit(limit);
        const canvas = findCanvas();
        const debug = getDebug();
        const scene = safeCall(getContext, "getSceneName");
        const viewportWidth = finiteNumber(safeCall(getContext, "width"))
            ?? finiteNumber(canvas?.width);
        const viewportHeight = finiteNumber(safeCall(getContext, "height"))
            ?? finiteNumber(canvas?.height);
        const cameraPosition = pointSnapshot(
            safeCall(getContext, "getCamPos") ?? safeCall(getContext, "camPos"),
        );
        const cameraScale = pointSnapshot(
            safeCall(getContext, "getCamScale")
                ?? safeCall(getContext, "camScale"),
        );
        const cameraRotation = finiteNumber(
            safeCall(getContext, "getCamRot") ?? safeCall(getContext, "camRot"),
        );
        const matchedObjects = queryObjects(getContext, normalizedTag);
        const objectsAvailable = matchedObjects !== null;
        const objectCount = matchedObjects
            ? matchedObjects.length
            : normalizedTag === undefined
                    && typeof debug?.numObjects === "function"
            ? finiteNumber(safeInvoke(() => debug.numObjects()))
            : null;
        const objects = matchedObjects
            ? matchedObjects.slice(0, normalizedLimit).map(snapshotObject)
            : [];
        const viewport = viewportWidth !== null && viewportHeight !== null
            ? { width: viewportWidth, height: viewportHeight }
            : null;
        const layout = viewport
            ? collectLayoutWarnings(objects, viewport, normalizedTag !== undefined)
            : { warnings: [], available: false };
        const layoutWarnings = layout.warnings;
        if (canvas && (finiteNumber(canvas.width) ?? 0) <= 0) {
            layoutWarnings.unshift({
                code: "CANVAS_EMPTY",
                message: "The preview canvas has no drawing width.",
            });
        }
        if (canvas && (finiteNumber(canvas.height) ?? 0) <= 0) {
            layoutWarnings.unshift({
                code: "CANVAS_EMPTY",
                message: "The preview canvas has no drawing height.",
            });
        }
        const hasCamera = cameraPosition !== null
            || cameraScale !== null
            || cameraRotation !== null;
        const canvasFocused = Boolean(
            canvas
                && (
                    getActiveElement() === canvas
                    || safeCall(getContext, "isFocused") === true
                ),
        );

        return {
            runId: getRunId(),
            available: Boolean(
                debug
                    || canvas
                    || scene !== undefined
                    || matchedObjects,
            ),
            readiness: getReadiness(),
            canvasFocused,
            scene: typeof scene === "string" ? boundedString(scene, 256) : null,
            paused: readPaused(),
            viewport,
            camera: hasCamera
                ? {
                    position: cameraPosition,
                    scale: cameraScale,
                    rotation: cameraRotation,
                }
                : null,
            objectsAvailable,
            objectCount,
            objects,
            objectsTruncated: objectCount !== null
                && objects.length < objectCount,
            layoutWarnings: layoutWarnings.slice(0, MAX_LAYOUT_WARNINGS),
            layoutWarningsTruncated: layoutWarnings.length > MAX_LAYOUT_WARNINGS,
            layoutAvailable: layout.available && objectsAvailable
                && objects.length === objectCount,
        };
    };
}

function queryObjects(getContext, tag) {
    const queryTag = tag ?? "*";
    const result = safeCall(
        getContext,
        "get",
        queryTag,
        { recursive: true },
    );
    if (Array.isArray(result)) return result;

    const root = safeCall(getContext, "getTreeRoot");
    const rootResult = safeInvoke(() =>
        typeof root?.get === "function"
            ? root.get(queryTag, { recursive: true })
            : undefined
    );
    return Array.isArray(rootResult) ? rootResult : null;
}

function snapshotObject(object) {
    const tags = safeRead(object, "tags");
    const snapshot = {
        id: primitiveId(safeRead(object, "id")),
        tags: Array.isArray(tags)
            ? tags
                .filter(tag => typeof tag === "string")
                .slice(0, MAX_TAGS_PER_OBJECT)
                .map(tag => boundedString(tag, 64))
            : [],
    };
    const position = pointSnapshot(safeRead(object, "pos"));
    const scale = pointSnapshot(safeRead(object, "scale"));
    const angle = finiteNumber(safeRead(object, "angle"));
    const opacity = finiteNumber(safeRead(object, "opacity"));
    const hidden = safeRead(object, "hidden");
    const paused = safeRead(object, "paused");
    const text = safeRead(object, "text");
    const sprite = safeRead(object, "sprite");
    const anchor = anchorSnapshot(safeRead(object, "anchor"));
    const renderArea = safeMethod(object, "renderArea");
    const renderedBounds = renderedBoundsSnapshot(object, renderArea);
    const screenBounds = screenBoundsSnapshot(object, renderArea, renderedBounds);
    const collisionBounds = collisionBoundsSnapshot(object);

    if (position) snapshot.position = position;
    if (scale) snapshot.scale = scale;
    if (angle !== null) snapshot.angle = angle;
    if (opacity !== null) snapshot.opacity = opacity;
    if (typeof hidden === "boolean") snapshot.hidden = hidden;
    if (typeof paused === "boolean") snapshot.paused = paused;
    if (typeof text === "string") {
        snapshot.text = boundedString(text, MAX_OBJECT_STRING_LENGTH);
        snapshot.textTruncated = text.length > MAX_OBJECT_STRING_LENGTH;
    }
    if (typeof sprite === "string") {
        snapshot.sprite = boundedString(sprite, MAX_OBJECT_STRING_LENGTH);
    }
    if (anchor) snapshot.anchor = anchor;
    if (renderedBounds) snapshot.renderedBounds = renderedBounds;
    if (screenBounds) snapshot.screenBounds = screenBounds;
    if (collisionBounds) snapshot.collisionBounds = collisionBounds;
    return snapshot;
}

function renderedBoundsSnapshot(object, renderArea) {
    const reported = boundsSnapshot(renderArea);
    if (reported) return reported;

    const width = finiteNumber(safeRead(object, "width"));
    const height = finiteNumber(safeRead(object, "height"));
    if (width === null || height === null) return null;
    const anchor = anchorSnapshot(safeRead(object, "anchor"));
    const offset = anchorOffset(anchor, width, height);
    return { x: offset.x, y: offset.y, width, height };
}

function screenBoundsSnapshot(object, renderArea, bounds) {
    if (!bounds) return null;
    // Rect render areas are unanchored; dimension-only fallbacks already
    // include the anchor. Transform through the engine so parent transforms,
    // rotation, fixed objects, and the camera use the same screen coordinates.
    const isRect = pointSnapshot(safeRead(renderArea, "pos"))
        && finiteNumber(safeRead(renderArea, "width")) !== null
        && finiteNumber(safeRead(renderArea, "height")) !== null;
    const offset = isRect
        ? anchorOffset(anchorSnapshot(safeRead(object, "anchor")), bounds.width, bounds.height)
        : { x: 0, y: 0 };
    const left = bounds.x + offset.x;
    const top = bounds.y + offset.y;
    const points = [
        { x: left, y: top },
        { x: left + bounds.width, y: top },
        { x: left, y: top + bounds.height },
        { x: left + bounds.width, y: top + bounds.height },
    ].map(point => pointSnapshot(safeMethod(object, "toScreen", point)));
    return points.every(Boolean) ? boundsFromPoints(points) : null;
}

function collisionBoundsSnapshot(object) {
    const local = boundsSnapshot(safeMethod(object, "localArea"));
    const world = boundsSnapshot(safeMethod(object, "worldArea"));
    const screen = boundsSnapshot(safeMethod(object, "screenArea"));
    return local || world || screen ? { local, world, screen } : null;
}

function boundsSnapshot(value, allowBoundingBox = true) {
    if (!value || typeof value !== "object") return null;
    if (allowBoundingBox) {
        const boundingBox = safeMethod(value, "bbox");
        if (boundingBox && boundingBox !== value) {
            const bounds = boundsSnapshot(boundingBox, false);
            if (bounds) return bounds;
        }
    }

    const position = pointSnapshot(safeRead(value, "pos"))
        ?? pointSnapshot(value);
    const width = finiteNumber(safeRead(value, "width"));
    const height = finiteNumber(safeRead(value, "height"));
    if (position && width !== null && height !== null) {
        return { x: position.x, y: position.y, width, height };
    }

    const center = pointSnapshot(safeRead(value, "center")) ?? position;
    const radius = finiteNumber(safeRead(value, "radius"));
    if (center && radius !== null) {
        return {
            x: center.x - radius,
            y: center.y - radius,
            width: radius * 2,
            height: radius * 2,
        };
    }

    const points = safeRead(value, "pts") ?? safeRead(value, "points");
    if (Array.isArray(points)) return boundsFromPoints(points);
    const p1 = pointSnapshot(safeRead(value, "p1"));
    const p2 = pointSnapshot(safeRead(value, "p2"));
    return p1 && p2 ? boundsFromPoints([p1, p2]) : null;
}

function boundsFromPoints(values) {
    const points = values.map(pointSnapshot).filter(Boolean);
    if (points.length === 0) return null;
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return {
        x: left,
        y: top,
        width: Math.max(...xs) - left,
        height: Math.max(...ys) - top,
    };
}

function collectLayoutWarnings(objects, viewport, includeAll) {
    const warnings = [];
    let available = true;
    for (const object of objects) {
        if (object.hidden === true) {
            continue;
        }
        if (!includeAll && !object.tags.some(tag => UI_TAG_PATTERN.test(tag))) {
            continue;
        }
        const bounds = object.screenBounds;
        if (!bounds) {
            available = false;
            continue;
        }
        const left = bounds.x;
        const right = left + bounds.width;
        const top = bounds.y;
        const bottom = top + bounds.height;
        const outside = right < 0 || bottom < 0
            || left > viewport.width || top > viewport.height;
        const clipped = !outside && (
            left < -1 || top < -1
            || right > viewport.width + 1 || bottom > viewport.height + 1
        );
        if (!outside && !clipped) continue;
        warnings.push({
            code: outside ? "OBJECT_OUTSIDE_VIEWPORT" : "OBJECT_CLIPPED",
            message: outside
                ? "A checked object is entirely outside the logical viewport."
                : "A checked object is partially outside the logical viewport.",
            objectId: object.id,
            tags: object.tags,
            estimatedBounds: {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
            },
            viewport,
            basis: "screen-space-bounds",
        });
    }
    return { warnings, available };
}

function anchorSnapshot(value) {
    if (typeof value === "string") return boundedString(value, 64);
    return pointSnapshot(value);
}

function anchorOffset(anchor, width, height) {
    const named = {
        center: { x: -width / 2, y: -height / 2 },
        top: { x: -width / 2, y: 0 },
        topleft: { x: 0, y: 0 },
        topright: { x: -width, y: 0 },
        left: { x: 0, y: -height / 2 },
        right: { x: -width, y: -height / 2 },
        bot: { x: -width / 2, y: -height },
        botleft: { x: 0, y: -height },
        botright: { x: -width, y: -height },
    };
    if (typeof anchor === "string") return named[anchor] ?? named.topleft;
    if (anchor) {
        return {
            x: -width * (anchor.x + 1) / 2,
            y: -height * (anchor.y + 1) / 2,
        };
    }
    return named.topleft;
}

function safeCall(getContext, name, ...args) {
    const context = getContext();
    const contextMethod = context?.[name];
    if (typeof contextMethod === "function") {
        return safeInvoke(() => contextMethod.apply(context, args));
    }

    const globalMethod = globalThis[name];
    return typeof globalMethod === "function"
        ? safeInvoke(() => globalMethod(...args))
        : undefined;
}

function safeMethod(object, name, ...args) {
    return safeInvoke(() => {
        const method = object?.[name];
        return typeof method === "function"
            ? method.apply(object, args)
            : undefined;
    });
}

function safeInvoke(operation) {
    try {
        return operation();
    } catch {
        return undefined;
    }
}

function safeRead(object, property) {
    return safeInvoke(() => object?.[property]);
}

function pointSnapshot(value) {
    const x = finiteNumber(safeRead(value, "x"));
    const y = finiteNumber(safeRead(value, "y"));
    return x !== null && y !== null ? { x, y } : null;
}

function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function primitiveId(value) {
    return typeof value === "string" || typeof value === "number"
        ? value
        : null;
}

function normalizeInspectionTag(tag) {
    if (tag === undefined) return undefined;
    if (
        typeof tag !== "string"
        || tag.length === 0
        || tag.length > MAX_INSPECTION_TAG_LENGTH
        || /\p{Cc}/u.test(tag)
    ) {
        throw new Error("Invalid KAPLAY object tag.");
    }
    return tag;
}

function normalizeInspectionLimit(limit) {
    if (limit === undefined) return 0;
    if (!Number.isInteger(limit) || limit < 0) {
        throw new Error("Inspection limit must be a non-negative integer.");
    }
    return Math.min(limit, MAX_INSPECTION_OBJECTS);
}

function boundedString(value, maxLength) {
    return value.length <= maxLength ? value : value.slice(0, maxLength);
}
