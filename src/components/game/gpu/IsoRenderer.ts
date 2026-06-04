/**
 * IsoRenderer — the rendering abstraction boundary for the isometric city renderer.
 *
 * WHY THIS EXISTS
 * The game's draw code (~110 functions across ~40 modules) historically depended
 * directly on `CanvasRenderingContext2D`. To migrate the backend to a GPU pipeline
 * (PixiJS / WebGPU+WebGL) without rewriting every call site at once, all draw
 * functions depend on this interface instead of the concrete DOM context.
 *
 * DESIGN
 * `IsoRenderer` is the EXACT subset of the Canvas2D API the game actually uses
 * (verified by static analysis of the codebase — see CHANGES.md / gpu port notes).
 * It is expressed as a `Pick<CanvasRenderingContext2D, ...>` so that:
 *   1. A native `CanvasRenderingContext2D` is assignable to `IsoRenderer` with ZERO
 *      overhead — the Canvas2D backend is the context itself (no wrapper, no behavior
 *      change). This makes the first migration step a provable no-op.
 *   2. The `canvas` member is widened to `HTMLCanvasElement | OffscreenCanvas` so the
 *      off-thread worker path (`OffscreenCanvasRenderingContext2D`) also satisfies it.
 *   3. Any GPU backend (see PixiRenderer) implements this same interface, so swapping
 *      backends is a single wiring change at the render-loop level.
 *
 * The codebase is overwhelmingly *vector* drawing (paths, fills, strokes, gradients,
 * shadows) rather than sprite blitting — only a handful of `drawImage` sites exist.
 * The GPU backend therefore maps these onto Pixi `Graphics` (whose v8 API mirrors
 * Canvas2D) plus a small sprite/text path, rather than a sprite batcher.
 *
 * SCOPE NOTE
 * Standalone 2D surfaces that are NOT part of the world render loop intentionally keep
 * their own `CanvasRenderingContext2D` (image preprocessing in `imageLoader.ts`,
 * `MiniMap.tsx`, the landing canvas in `app/page.tsx`, and the debug panels). They are
 * not hot paths and use pixel ops (getImageData/putImageData) outside this contract.
 */
export type IsoRenderer = Omit<
  Pick<
    CanvasRenderingContext2D,
    // ---- transform / state stack ----
    | 'save'
    | 'restore'
    | 'translate'
    | 'rotate'
    | 'scale'
    | 'setTransform'
    // ---- path construction ----
    | 'beginPath'
    | 'moveTo'
    | 'lineTo'
    | 'arc'
    | 'ellipse'
    | 'quadraticCurveTo'
    | 'closePath'
    // ---- paint ----
    | 'fill'
    | 'stroke'
    | 'fillRect'
    | 'strokeRect'
    | 'clearRect'
    | 'clip'
    | 'drawImage'
    | 'fillText'
    | 'strokeText'
    // ---- line style ----
    | 'setLineDash'
    | 'lineWidth'
    | 'lineCap'
    | 'lineJoin'
    | 'lineDashOffset'
    // ---- paint style ----
    | 'fillStyle'
    | 'strokeStyle'
    | 'globalAlpha'
    | 'globalCompositeOperation'
    | 'shadowBlur'
    | 'shadowColor'
    | 'filter'
    // ---- text style ----
    | 'font'
    | 'textAlign'
    | 'textBaseline'
    // ---- image sampling ----
    | 'imageSmoothingEnabled'
    | 'imageSmoothingQuality'
    // ---- gradients (paint factories) ----
    | 'createLinearGradient'
    | 'createRadialGradient'
    // ---- backing surface ----
    | 'canvas'
  >,
  'canvas'
> & {
  /** Backing surface. Widened to support both the main-thread and worker (OffscreenCanvas) paths. */
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
};

/**
 * Image sources accepted by {@link IsoRenderer.drawImage}. Matches the DOM
 * `CanvasImageSource` set the game uses (sprite sheets decoded as ImageBitmap /
 * HTMLImageElement, and offscreen layer canvases).
 */
export type IsoImageSource = CanvasImageSource;
