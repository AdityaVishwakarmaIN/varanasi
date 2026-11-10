/**
 * PixiRenderer — a GPU backend that implements the {@link IsoRenderer} contract.
 *
 * STRATEGY: immediate-mode-over-retained. The game redraws each layer by replaying
 * Canvas2D-style calls (paths, fills, strokes, gradients, sprites, text), which are
 * translated on the fly into pooled `Graphics` / `Sprite` / `Text` nodes on the active
 * layer container.
 *
 * BATCHING (PERF): consecutive solid-colour fills/strokes go into ONE pooled `Graphics`
 * (a "batch") with an identity node transform; each shape's points are transformed by the
 * current matrix through the GraphicsContext transform and its alpha is folded into the
 * fill/stroke colour. A batch ends when anything else is placed (sprite, text, clip, a
 * gradient / blurred / non-similarity-stroke shape, a blend-mode change), so paint order is
 * exactly the call order. Thousands of shapes per frame used to become thousands of scene
 * nodes (each with its own context rebuild, transform decompose and render-group
 * instruction); now a run of shapes is one node.
 *
 * FRAME TOPOLOGY (mirrors the Canvas2D loops; see layers.ts):
 *  - DYNAMIC layers (cars/wind/air/ambient/airHigh) are cleared & redrawn every frame
 *    by the continuous effects loop: call `beginFrame()` (clears dynamic layers only),
 *    then `setLayer(name)` + the IsoRenderer-typed draw fns, then `pixiApp.render()`.
 *  - RETAINED layers (base/buildings/lighting/hover) are redrawn ON DEMAND when their
 *    source state changes, via `redrawLayer(name, () => draw(this))`. They persist
 *    between effects frames (the effects loop's render() composites them).
 * Each layer owns its OWN pool, so a retained-layer redraw (a separate rAF) never
 * clobbers the in-flight dynamic frame's pool cursors.
 *
 * COORDINATE MODEL: the world (pan/zoom/dpr) transform lives on the layer stack root
 * (camera.ts / layers.ts). This renderer tracks only the LOCAL transform built by the
 * draw code's save/translate/rotate/scale calls and bakes it into each node via
 * `setFromMatrix` (or, for batched shapes, into the points). Canvas2D transforms
 * post-multiply, so we compose with `Matrix.append` semantics.
 *
 * FIDELITY GAPS (documented, to revisit at local cutover):
 *  - shadowBlur/shadowColor: core Pixi has no per-shape drop shadow (DropShadowFilter
 *    is in pixi-filters). State is tracked but not rendered here.
 *  - ellipse(): Pixi's GraphicsContext.ellipse takes only (x,y,rx,ry) — no rotation
 *    or start/end angle. Partial-arc / rotated ellipses render as full ellipses.
 *  - setLineDash: tracked but not rendered (core Pixi strokes are solid).
 *  - clearRect: per-rect clearing is a no-op; clearing happens per-layer.
 *  - createPattern (CanvasPattern) fills are unsupported -> fall back to opaque white.
 *  - per-cloud filter='blur(px)' is applied as a Pixi BlurFilter on the drawn node in
 *    place(); a whole-layer blur is available via setLayerBlur() (cheaper for clouds).
 */
import {
  BitmapFont,
  BitmapText,
  BlurFilter,
  Color,
  Container,
  FillGradient,
  Graphics,
  Matrix,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import type { IsoImageSource, IsoRenderer } from './IsoRenderer';
import { LayerStack, DYNAMIC_LAYERS, type LayerName } from './layers';
import { worldMatrix, type CameraState } from './camera';
import { TextureCache } from './textures';

type Paint = string | CanvasGradient | CanvasPattern;

// Path ops are recorded as a flat number list (op code followed by its arguments), in the
// local coordinates of the calls (the matrix in force at fill/stroke time is applied, as before).
const OP_MOVE = 0; // x y
const OP_LINE = 1; // x y
const OP_ARC = 2; // x y r start end ccw(0|1)
const OP_ELLIPSE = 3; // x y rx ry
const OP_QUAD = 4; // cpx cpy x y
const OP_CLOSE = 5;

/** Snapshot of the mutable draw state for save()/restore() (pooled; see save()). */
interface StateFrame {
  matrix: Matrix;
  layer: Container;
  layerName: LayerName;
  fillStyle: Paint;
  strokeStyle: Paint;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineDashOffset: number;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  shadowBlur: number;
  shadowColor: string;
  filter: string;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  lineDash: number[];
}

/** Per-layer pool of reusable display objects (reset when its layer is (re)drawn). */
interface LayerPool {
  gfx: Graphics[];
  gfxCursor: number;
  sprite: Sprite[];
  spriteCursor: number;
  text: Text[];
  textCursor: number;
  bmtext: BitmapText[];
  bmCursor: number;
}

/** A CSS colour string parsed once for the batch path. */
interface ParsedColor {
  rgb: number;
  alpha: number;
}

const COMPOSITE_TO_BLEND: Partial<Record<GlobalCompositeOperation, string>> = {
  'source-over': 'normal',
  lighter: 'add',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'destination-out': 'erase',
};

/** Name of the installed BitmapFont used by the opt-in BitmapText label path (Step 7). */
const BITMAP_FONT = 'iso-label';

const IDENTITY = new Matrix();
const TWO_PI = Math.PI * 2;

/** Parsed colour strings (bounded: draw code builds some rgba() strings per frame). */
const colorCache = new Map<string, ParsedColor | null>();
const COLOR_CACHE_LIMIT = 4096;
const scratchColor = new Color();

function parseColor(css: string): ParsedColor | null {
  let parsed = colorCache.get(css);
  if (parsed !== undefined) return parsed;
  try {
    scratchColor.setValue(normalizePixiColor(css));
    parsed = { rgb: scratchColor.toNumber(), alpha: scratchColor.alpha };
  } catch {
    parsed = null; // let the unbatched path handle (and report) it as before
  }
  if (colorCache.size >= COLOR_CACHE_LIMIT) colorCache.clear();
  colorCache.set(css, parsed);
  return parsed;
}

export class PixiRenderer implements IsoRenderer {
  // ---- IsoRenderer paint/line/text state (public, mirror Canvas2D) ----
  fillStyle: Paint = '#000000';
  strokeStyle: Paint = '#000000';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  lineDashOffset = 0;
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  shadowBlur = 0;
  shadowColor = 'rgba(0, 0, 0, 0)';
  filter = 'none';
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  imageSmoothingEnabled = false;
  imageSmoothingQuality: ImageSmoothingQuality = 'low';

  readonly canvas: HTMLCanvasElement | OffscreenCanvas;

  readonly layers: LayerStack;
  private readonly textures = new TextureCache();

  // ---- transform + state stack ----
  private readonly matrix = new Matrix();
  /** Pooled save() frames; `stackDepth` of them are live. */
  private readonly stack: StateFrame[] = [];
  private stackDepth = 0;
  private activeLayer: Container;
  private activeLayerName: LayerName = 'base';

  // ---- current path (replayed onto pooled Graphics at fill/stroke) ----
  private readonly path: number[] = [];
  private lineDash: number[] = [];

  // ---- current shape batch (see BATCHING above) ----
  private batch: Graphics | null = null;
  private batchParent: Container | null = null;
  private batchBlend = '';

  // ---- per-layer display-object pools (keyed by layer name) ----
  private readonly pools = new Map<LayerName, LayerPool>();

  // sub-rect texture cache for drawImage 9-arg overload
  private readonly subTexCache = new WeakMap<object, Map<string, Texture>>();

  // Shared blur filter for per-node filter='blur(px)' draws.
  private readonly blurFilter = new BlurFilter({ strength: 0, quality: 4 });

  // Sprites of a retained layer that sway every frame (trees): drawn once in depth order with the
  // buildings, then only their matrix changes (no per-frame redraw, no separate layer).
  private swayNodes: { sprite: Sprite; base: Matrix; px: number; py: number }[] = [];
  private readonly swayScratch = new Matrix();
  /** Matrix of the last drawImage() sprite (copied by markSway). */
  private readonly lastImageMatrix = new Matrix();
  private readonly textMatrix = new Matrix();

  // Opt-in: render fillText/strokeText via BitmapText (Step 7). Default off — keeps the
  // dynamic Text path until bitmap-font legibility is verified locally.
  private useBitmapText = false;
  private bitmapFontReady = false;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, layers?: LayerStack) {
    this.canvas = canvas;
    this.layers = layers ?? new LayerStack();
    this.activeLayer = this.layers.get('base');
  }

  // ================= frame lifecycle (backend-only API) =================

  /** Apply the world transform to the layer stack for this frame. */
  applyCamera(state: CameraState): void {
    this.layers.applyCamera(worldMatrix(state));
  }

  /**
   * Begin a per-frame pass for the DYNAMIC layers: clear them, reset their pools and
   * the draw state. Retained layers (base/buildings/lighting/hover) are untouched —
   * redraw those via {@link redrawLayer}.
   */
  beginFrame(): void {
    this.layers.clearDynamic();
    for (const name of DYNAMIC_LAYERS) this.resetPool(name);
    this.resetState();
  }

  /** Select the layer that subsequent draw calls target. */
  setLayer(name: LayerName): void {
    this.activeLayerName = name;
    this.activeLayer = this.layers.get(name);
  }

  /**
   * Redraw a single RETAINED layer (base/buildings/lighting/hover) on demand. Clears
   * just that layer + its pool, resets draw state, runs `draw` (which issues the usual
   * IsoRenderer calls against this renderer), and leaves the result in place until the
   * next redraw. Does NOT call render() — the effects loop composites the scene.
   */
  redrawLayer(name: LayerName, draw: () => void): void {
    this.layers.clear(name);
    this.resetPool(name);
    this.resetState();
    this.setLayer(name);
    if (name === 'buildings') this.swayNodes.length = 0;
    draw();
    this.endBatch();
  }

  /** How many sprites the active layer holds so far (pair with {@link markSway}). */
  spriteCount(): number {
    return this.getPool(this.activeLayerName).spriteCursor;
  }

  /**
   * Make the sprite drawImage() placed since `before` (a {@link spriteCount}) sway about the pivot
   * (current local coordinates) whenever {@link applySway} runs. Does nothing if no sprite was placed.
   */
  markSway(before: number, pivotX: number, pivotY: number): void {
    const pool = this.getPool(this.activeLayerName);
    if (pool.spriteCursor <= before) return;
    const sprite = pool.sprite[pool.spriteCursor - 1];
    const p = this.matrix.apply({ x: pivotX, y: pivotY });
    this.swayNodes.push({ sprite, base: this.lastImageMatrix.clone(), px: p.x, py: p.y });
  }

  /** Rotates every marked sprite by `angle` about its pivot (cheap: one matrix per tree per frame). */
  applySway(angle: number): void {
    const m = this.swayScratch;
    for (let i = 0; i < this.swayNodes.length; i++) {
      const n = this.swayNodes[i];
      m.copyFrom(n.base).translate(-n.px, -n.py).rotate(angle).translate(n.px, n.py);
      n.sprite.setFromMatrix(m);
    }
  }

  /** Apply (or clear, with 0) a single GPU blur over a whole layer (e.g. clouds). */
  setLayerBlur(name: LayerName, strengthPx: number): void {
    this.layers.setLayerBlur(name, strengthPx);
  }

  /** Enable the BitmapText label path (Step 7); installs the bitmap font on first use. */
  enableBitmapText(enabled = true): void {
    this.useBitmapText = enabled;
    if (enabled) this.ensureBitmapFont();
  }

  private resetState(): void {
    this.matrix.identity();
    this.stackDepth = 0;
    this.path.length = 0;
    this.endBatch();
  }

  private resetPool(name: LayerName): void {
    const p = this.pools.get(name);
    if (p) {
      p.gfxCursor = 0;
      p.spriteCursor = 0;
      p.textCursor = 0;
      p.bmCursor = 0;
    }
  }

  private getPool(name: LayerName): LayerPool {
    let p = this.pools.get(name);
    if (!p) {
      p = { gfx: [], gfxCursor: 0, sprite: [], spriteCursor: 0, text: [], textCursor: 0, bmtext: [], bmCursor: 0 };
      this.pools.set(name, p);
    }
    return p;
  }

  // ============================ transform ============================

  save(): void {
    let s = this.stack[this.stackDepth];
    if (!s) {
      s = {
        matrix: new Matrix(),
        layer: this.activeLayer,
        layerName: this.activeLayerName,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        lineDashOffset: 0,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        shadowBlur: 0,
        shadowColor: '',
        filter: 'none',
        font: '',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        lineDash: this.lineDash,
      };
      this.stack[this.stackDepth] = s;
    }
    this.stackDepth++;
    s.matrix.copyFrom(this.matrix);
    s.layer = this.activeLayer;
    s.layerName = this.activeLayerName;
    s.fillStyle = this.fillStyle;
    s.strokeStyle = this.strokeStyle;
    s.lineWidth = this.lineWidth;
    s.lineCap = this.lineCap;
    s.lineJoin = this.lineJoin;
    s.lineDashOffset = this.lineDashOffset;
    s.globalAlpha = this.globalAlpha;
    s.globalCompositeOperation = this.globalCompositeOperation;
    s.shadowBlur = this.shadowBlur;
    s.shadowColor = this.shadowColor;
    s.filter = this.filter;
    s.font = this.font;
    s.textAlign = this.textAlign;
    s.textBaseline = this.textBaseline;
    s.imageSmoothingEnabled = this.imageSmoothingEnabled;
    s.imageSmoothingQuality = this.imageSmoothingQuality;
    // setLineDash() replaces the array (never mutates it), so sharing the reference is safe.
    s.lineDash = this.lineDash;
  }

  restore(): void {
    if (this.stackDepth === 0) return;
    const s = this.stack[--this.stackDepth];
    this.matrix.copyFrom(s.matrix);
    this.activeLayer = s.layer;
    this.activeLayerName = s.layerName;
    this.fillStyle = s.fillStyle;
    this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth;
    this.lineCap = s.lineCap;
    this.lineJoin = s.lineJoin;
    this.lineDashOffset = s.lineDashOffset;
    this.globalAlpha = s.globalAlpha;
    this.globalCompositeOperation = s.globalCompositeOperation;
    this.shadowBlur = s.shadowBlur;
    this.shadowColor = s.shadowColor;
    this.filter = s.filter;
    this.font = s.font;
    this.textAlign = s.textAlign;
    this.textBaseline = s.textBaseline;
    this.imageSmoothingEnabled = s.imageSmoothingEnabled;
    this.imageSmoothingQuality = s.imageSmoothingQuality;
    this.lineDash = s.lineDash;
  }

  // In-place equivalents of matrix.append(T) / append(S) / append(R) (no allocation).
  translate(x: number, y: number): void {
    const m = this.matrix;
    m.tx += m.a * x + m.c * y;
    m.ty += m.b * x + m.d * y;
  }

  scale(x: number, y: number): void {
    const m = this.matrix;
    m.a *= x;
    m.b *= x;
    m.c *= y;
    m.d *= y;
  }

  rotate(angle: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const m = this.matrix;
    const a = m.a, b = m.b, c = m.c, d = m.d;
    m.a = a * cos + c * sin;
    m.b = b * cos + d * sin;
    m.c = c * cos - a * sin;
    m.d = d * cos - b * sin;
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  setTransform(transform?: DOMMatrix2DInit): void;
  setTransform(
    a?: number | DOMMatrix2DInit,
    b?: number,
    c?: number,
    d?: number,
    e?: number,
    f?: number,
  ): void {
    if (typeof a === 'object' && a !== null) {
      this.matrix.set(a.a ?? 1, a.b ?? 0, a.c ?? 0, a.d ?? 1, a.e ?? 0, a.f ?? 0);
    } else {
      this.matrix.set(a ?? 1, b ?? 0, c ?? 0, d ?? 1, e ?? 0, f ?? 0);
    }
  }

  // ============================ path build ============================

  beginPath(): void {
    this.path.length = 0;
  }

  moveTo(x: number, y: number): void {
    this.path.push(OP_MOVE, x, y);
  }

  lineTo(x: number, y: number): void {
    this.path.push(OP_LINE, x, y);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.path.push(OP_ARC, x, y, radius, startAngle, endAngle, counterclockwise ? 1 : 0);
  }

  // NOTE: Pixi ellipse is (x,y,rx,ry) only — rotation/start/end/ccw dropped (fidelity gap).
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    _rotation: number,
    _startAngle: number,
    _endAngle: number,
    _counterclockwise?: boolean,
  ): void {
    this.path.push(OP_ELLIPSE, x, y, radiusX, radiusY);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.path.push(OP_QUAD, cpx, cpy, x, y);
  }

  closePath(): void {
    this.path.push(OP_CLOSE);
  }

  // ============================== paint ==============================

  fill(fillRule?: CanvasFillRule): void;
  fill(path: Path2D, fillRule?: CanvasFillRule): void;
  fill(_a?: CanvasFillRule | Path2D, _b?: CanvasFillRule): void {
    if (this.path.length === 0) return; // empty path paints nothing
    const color = this.batchColor(this.fillStyle);
    if (color) {
      const alpha = color.alpha * this.globalAlpha;
      if (alpha <= 0) return;
      const g = this.batchGraphics();
      if (!g) return this.fillNode(); // composite mode without a Pixi blend: keep the old path
      g.context.setTransform(this.matrix);
      g.beginPath();
      this.replayPath(g, true);
      g.fill({ color: color.rgb, alpha });
      return;
    }
    this.fillNode();
  }

  stroke(): void;
  stroke(path: Path2D): void;
  stroke(_path?: Path2D): void {
    if (this.path.length === 0) return;
    const color = this.batchColor(this.strokeStyle);
    const scale = color ? similarityScale(this.matrix) : 0;
    if (color && scale > 0) {
      const alpha = color.alpha * this.globalAlpha;
      if (alpha <= 0) return;
      const g = this.batchGraphics();
      if (!g) return this.strokeNode();
      g.context.setTransform(this.matrix);
      g.beginPath();
      this.replayPath(g, true);
      g.stroke({ width: this.lineWidth * scale, color: color.rgb, alpha, cap: this.lineCap, join: this.lineJoin });
      return;
    }
    this.strokeNode();
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const color = this.batchColor(this.fillStyle);
    if (color) {
      const alpha = color.alpha * this.globalAlpha;
      if (alpha <= 0) return;
      const g = this.batchGraphics();
      if (g) {
        g.context.setTransform(this.matrix);
        g.beginPath();
        g.rect(x, y, w, h).fill({ color: color.rgb, alpha });
        return;
      }
    }
    this.endBatch();
    const g = this.acquireGraphics();
    g.rect(x, y, w, h).fill(this.fillInput());
    this.place(g);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    const color = this.batchColor(this.strokeStyle);
    const scale = color ? similarityScale(this.matrix) : 0;
    if (color && scale > 0) {
      const alpha = color.alpha * this.globalAlpha;
      if (alpha <= 0) return;
      const g = this.batchGraphics();
      if (g) {
        g.context.setTransform(this.matrix);
        g.beginPath();
        g.rect(x, y, w, h).stroke({ width: this.lineWidth * scale, color: color.rgb, alpha, cap: this.lineCap, join: this.lineJoin });
        return;
      }
    }
    this.endBatch();
    const g = this.acquireGraphics();
    g.rect(x, y, w, h).stroke(this.strokeInput());
    this.place(g);
  }

  // No-op: clearing is per-layer (documented gap).
  clearRect(_x: number, _y: number, _w: number, _h: number): void {}

  // ============================== clip ==============================
  // Best-effort: turn the current path into a mask on a fresh sub-container that
  // becomes the active layer until the matching restore() (which restores layer).
  clip(fillRule?: CanvasFillRule): void;
  clip(path: Path2D, fillRule?: CanvasFillRule): void;
  clip(_a?: CanvasFillRule | Path2D, _b?: CanvasFillRule): void {
    this.endBatch();
    const mask = new Graphics();
    this.replayPath(mask, false);
    mask.fill(0xffffff);
    mask.setFromMatrix(this.matrix);
    const scope = new Container();
    this.activeLayer.addChild(mask);
    this.activeLayer.addChild(scope);
    scope.mask = mask;
    // Keep activeLayerName (pool namespace) — only the container changes. Pooled nodes
    // drawn into the scope are reclaimed when the layer is cleared/redrawn.
    this.activeLayer = scope;
  }

  // ============================= images =============================

  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  drawImage(
    image: CanvasImageSource,
    a: number,
    b: number,
    c?: number,
    d?: number,
    e?: number,
    f?: number,
    g?: number,
    h?: number,
  ): void {
    const base = this.textures.get(image as IsoImageSource);
    if (!base) return; // Source not ready for GPU upload
    let dx: number, dy: number, dw: number, dh: number;
    let texture: Texture = base;
    if (c === undefined) {
      dx = a; dy = b; dw = base.width; dh = base.height;
    } else if (e === undefined) {
      dx = a; dy = b; dw = c; dh = d as number;
    } else {
      const sx = a, sy = b, sw = c, sh = d as number;
      dx = e; dy = f as number; dw = g as number; dh = h as number;
      texture = this.subTexture(image as IsoImageSource, base, sx, sy, sw, sh);
    }
    const sp = this.acquireSprite();
    sp.texture = texture;
    // matrix · translate(dx, dy) · scale(dw / tw, dh / th), composed in place
    const src = this.matrix;
    const m = this.lastImageMatrix;
    const kx = dw / texture.width;
    const ky = dh / texture.height;
    m.a = src.a * kx;
    m.b = src.b * kx;
    m.c = src.c * ky;
    m.d = src.d * ky;
    m.tx = src.tx + src.a * dx + src.c * dy;
    m.ty = src.ty + src.b * dx + src.d * dy;
    sp.setFromMatrix(m);
    this.place(sp);
  }

  // ============================== text ==============================

  fillText(text: string, x: number, y: number, _maxWidth?: number): void {
    this.drawText(text, x, y);
  }

  strokeText(text: string, x: number, y: number, _maxWidth?: number): void {
    this.drawText(text, x, y);
  }

  // ============================ line dash ============================
  // Tracked for state fidelity; core Pixi strokes are solid (documented gap).
  setLineDash(segments: number[]): void {
    this.lineDash = segments.slice();
  }

  // ============================ gradients ============================

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    return new FillGradient({
      type: 'linear',
      start: { x: x0, y: y0 },
      end: { x: x1, y: y1 },
      textureSpace: 'global',
      colorStops: [],
    });
  }

  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradient {
    return new FillGradient({
      type: 'radial',
      center: { x: x0, y: y0 },
      innerRadius: r0,
      outerCenter: { x: x1, y: y1 },
      outerRadius: r1,
      textureSpace: 'global',
      colorStops: [],
    });
  }

  // ============================== internals ==========================

  /** Parsed solid colour if `paint` can go into a batch under the current state, else null. */
  private batchColor(paint: Paint): ParsedColor | null {
    if (typeof paint !== 'string') return null; // gradients/patterns keep their own node
    if (this.filter !== 'none' && parseBlurPx(this.filter) > 0) return null; // per-node blur
    return parseColor(paint);
  }

  /**
   * The open batch for the active container + blend mode, or a new one appended to it.
   * Returns null when the composite operation has no Pixi blend mode (unbatched path).
   */
  private batchGraphics(): Graphics | null {
    const blend = COMPOSITE_TO_BLEND[this.globalCompositeOperation];
    if (!blend) return null;
    if (this.batch && this.batchParent === this.activeLayer && this.batchBlend === blend) return this.batch;
    const g = this.acquireGraphics();
    g.alpha = 1;
    (g as { blendMode: string }).blendMode = blend;
    if (g.filters && g.filters.length > 0) g.filters = [];
    g.setFromMatrix(IDENTITY);
    this.activeLayer.addChild(g);
    this.batch = g;
    this.batchParent = this.activeLayer;
    this.batchBlend = blend;
    return g;
  }

  /** Close the open batch: the next batched shape starts a new node (keeps paint order). */
  private endBatch(): void {
    this.batch = null;
    this.batchParent = null;
  }

  /** Unbatched fill: one node with the current matrix (gradients, blur, unmapped blends). */
  private fillNode(): void {
    this.endBatch();
    const g = this.acquireGraphics();
    this.replayPath(g, false);
    g.fill(this.fillInput());
    this.place(g);
  }

  private strokeNode(): void {
    this.endBatch();
    const g = this.acquireGraphics();
    this.replayPath(g, false);
    g.stroke(this.strokeInput());
    this.place(g);
  }

  /**
   * Replay the recorded path onto `g`. With `transformed`, the GraphicsContext transform (set
   * by the caller) maps the points, so arcs are expanded here into the same polyline Pixi's
   * buildArc would produce in local space (the context transform only moves an arc's centre).
   */
  private replayPath(g: Graphics, transformed: boolean): void {
    const p = this.path;
    let hasPoint = false;
    for (let i = 0; i < p.length;) {
      switch (p[i]) {
        case OP_MOVE:
          g.moveTo(p[i + 1], p[i + 2]);
          hasPoint = true;
          i += 3;
          break;
        case OP_LINE:
          g.lineTo(p[i + 1], p[i + 2]);
          hasPoint = true;
          i += 3;
          break;
        case OP_ARC:
          if (transformed) {
            arcPolyline(g, p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5], p[i + 6] === 1, hasPoint);
          } else {
            g.arc(p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5], p[i + 6] === 1);
          }
          hasPoint = true;
          i += 7;
          break;
        case OP_ELLIPSE:
          g.ellipse(p[i + 1], p[i + 2], p[i + 3], p[i + 4]);
          hasPoint = false;
          i += 5;
          break;
        case OP_QUAD:
          g.quadraticCurveTo(p[i + 1], p[i + 2], p[i + 3], p[i + 4]);
          hasPoint = true;
          i += 5;
          break;
        default: // OP_CLOSE
          g.closePath();
          hasPoint = false;
          i += 1;
          break;
      }
    }
  }

  private acquireGraphics(): Graphics {
    const pool = this.getPool(this.activeLayerName);
    let g = pool.gfx[pool.gfxCursor];
    if (!g) {
      g = new Graphics();
      pool.gfx[pool.gfxCursor] = g;
    }
    pool.gfxCursor++;
    g.clear();
    g.visible = true;
    return g;
  }

  private acquireSprite(): Sprite {
    const pool = this.getPool(this.activeLayerName);
    let sp = pool.sprite[pool.spriteCursor];
    if (!sp) {
      sp = new Sprite();
      sp.anchor.set(0, 0);
      pool.sprite[pool.spriteCursor] = sp;
    }
    pool.spriteCursor++;
    sp.visible = true;
    return sp;
  }

  private acquireText(): Text {
    const pool = this.getPool(this.activeLayerName);
    let t = pool.text[pool.textCursor];
    if (!t) {
      t = new Text();
      pool.text[pool.textCursor] = t;
    }
    pool.textCursor++;
    t.visible = true;
    return t;
  }

  private acquireBitmapText(): BitmapText {
    const pool = this.getPool(this.activeLayerName);
    let t = pool.bmtext[pool.bmCursor];
    if (!t) {
      t = new BitmapText({ text: '', style: { fontFamily: BITMAP_FONT } });
      pool.bmtext[pool.bmCursor] = t;
    }
    pool.bmCursor++;
    t.visible = true;
    return t;
  }

  /** Apply alpha + blend mode + optional per-node blur, and attach to the active layer. */
  private place(node: Container): void {
    this.endBatch();
    node.alpha = this.globalAlpha;
    const blend = COMPOSITE_TO_BLEND[this.globalCompositeOperation];
    if (blend) (node as { blendMode: string }).blendMode = blend;
    const blurPx = parseBlurPx(this.filter);
    if (blurPx > 0) {
      this.blurFilter.strength = blurPx;
      node.filters = [this.blurFilter];
    } else if (node.filters && node.filters.length > 0) {
      // Only touch `filters` when a pooled node had one: the setter allocates a FilterEffect.
      node.filters = [];
    }
    if (!(node instanceof Sprite)) node.setFromMatrix(this.matrix);
    this.activeLayer.addChild(node);
  }

  private fillInput(): string | FillGradient {
    const s = this.fillStyle;
    if (s instanceof FillGradient) return s;
    if (typeof s === 'string') return normalizePixiColor(s);
    return '#ffffff'; // CanvasPattern unsupported (documented gap)
  }

  private strokeInput(): { width: number; color?: string; fill?: FillGradient; cap: CanvasLineCap; join: CanvasLineJoin } {
    const s = this.strokeStyle;
    const base = { width: this.lineWidth, cap: this.lineCap, join: this.lineJoin };
    if (s instanceof FillGradient) return { ...base, fill: s };
    if (typeof s === 'string') return { ...base, color: normalizePixiColor(s) };
    return { ...base, color: '#ffffff' };
  }

  private drawText(text: string, x: number, y: number): void {
    this.endBatch();
    const { size, family, weight, italic } = parseFont(this.font);
    const fill = this.fillStyle;
    const fillColor = fill instanceof FillGradient ? fill : typeof fill === 'string' ? fill : '#000000';
    const ax = anchorX(this.textAlign);
    const ay = anchorY(this.textBaseline);
    const m = this.textMatrix.copyFrom(this.matrix);
    m.tx += m.a * x + m.c * y;
    m.ty += m.b * x + m.d * y;

    if (this.useBitmapText && this.bitmapFontReady) {
      const t = this.acquireBitmapText();
      t.text = text;
      t.style.fontFamily = BITMAP_FONT;
      t.style.fontSize = size;
      t.anchor.set(ax, ay);
      t.tint = typeof fillColor === 'string' ? fillColor : 0xffffff;
      t.setFromMatrix(m);
      t.alpha = this.globalAlpha;
      this.activeLayer.addChild(t);
      return;
    }

    const t = this.acquireText();
    t.text = text;
    t.style.fontFamily = family;
    t.style.fontSize = size;
    t.style.fontWeight = weight;
    t.style.fontStyle = italic ? 'italic' : 'normal';
    t.style.fill = fillColor;
    t.anchor.set(ax, ay);
    t.setFromMatrix(m);
    t.alpha = this.globalAlpha;
    this.activeLayer.addChild(t);
  }

  private ensureBitmapFont(): void {
    if (this.bitmapFontReady) return;
    try {
      BitmapFont.install({
        name: BITMAP_FONT,
        style: { fontFamily: 'sans-serif', fontSize: 24, fill: '#ffffff' },
      });
      this.bitmapFontReady = true;
    } catch {
      // BitmapFont.install needs a GPU/DOM context; if unavailable, keep the Text path.
      this.bitmapFontReady = false;
    }
  }

  private subTexture(source: IsoImageSource, base: Texture, sx: number, sy: number, sw: number, sh: number): Texture {
    const key = source as unknown as object;
    let byFrame = this.subTexCache.get(key);
    if (!byFrame) {
      byFrame = new Map();
      this.subTexCache.set(key, byFrame);
    }
    const id = `${sx},${sy},${sw},${sh}`;
    let tex = byFrame.get(id);
    if (!tex) {
      tex = new Texture({ source: base.source, frame: new Rectangle(sx, sy, sw, sh) });
      byFrame.set(id, tex);
    }
    return tex;
  }
}

// --------------------------- helpers ---------------------------

/**
 * Uniform scale of a rotation/reflection + uniform-scale matrix (stroke widths scale by it when the
 * points are pre-transformed), or 0 when the matrix shears or scales unevenly (strokes then keep a
 * node transform so their width transforms exactly as before).
 */
function similarityScale(m: Matrix): number {
  const eps = 1e-6 * (Math.abs(m.a) + Math.abs(m.b) + Math.abs(m.c) + Math.abs(m.d));
  const rotation = Math.abs(m.a - m.d) <= eps && Math.abs(m.b + m.c) <= eps;
  const reflection = Math.abs(m.a + m.d) <= eps && Math.abs(m.b - m.c) <= eps;
  if (!rotation && !reflection) return 0;
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
}

/** Pixi's buildArc tessellation (same step count), emitted through the context transform. */
function arcPolyline(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  start: number,
  end: number,
  ccw: boolean,
  hasPoint: boolean,
): void {
  let dist = Math.abs(start - end);
  if (!ccw && start > end) dist = TWO_PI - dist;
  else if (ccw && end > start) dist = TWO_PI - dist;
  let steps = Math.max(6, Math.floor(6 * Math.pow(radius, 1 / 3) * (dist / Math.PI)));
  steps = Math.max(steps, 3);
  const f = (dist / steps) * (ccw ? -1 : 1);
  let t = start;
  for (let i = 0; i < steps + 1; i++) {
    const px = x + Math.cos(t) * radius;
    const py = y + Math.sin(t) * radius;
    if (i === 0 && !hasPoint) g.moveTo(px, py);
    else g.lineTo(px, py);
    t += f;
  }
}

function parseBlurPx(filter: string): number {
  if (!filter || filter === 'none') return 0;
  const m = filter.match(/blur\(\s*([\d.]+)px\s*\)/i);
  return m ? parseFloat(m[1]) : 0;
}

function normalizePixiColor(color: string): string {
  const rgba = color.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*\)$/i);
  if (!rgba) return color;
  const r = Math.round(clampNumber(parseFloat(rgba[1]), 0, 255));
  const g = Math.round(clampNumber(parseFloat(rgba[2]), 0, 255));
  const b = Math.round(clampNumber(parseFloat(rgba[3]), 0, 255));
  const alpha = clampNumber(parseFloat(rgba[4]), 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(4))})`;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseFont(font: string): { size: number; family: string; weight: 'bold' | 'normal'; italic: boolean } {
  const italic = /italic/i.test(font);
  const weightMatch = font.match(/\b(bold|[1-9]00)\b/i);
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const size = sizeMatch ? parseFloat(sizeMatch[1]) : 10;
  let family = 'sans-serif';
  if (sizeMatch) {
    const after = font.slice(font.indexOf(sizeMatch[0]) + sizeMatch[0].length).trim();
    if (after) family = after;
  }
  return { size, family, weight: weightMatch ? 'bold' : 'normal', italic };
}

function anchorX(align: CanvasTextAlign): number {
  if (align === 'center') return 0.5;
  if (align === 'right' || align === 'end') return 1;
  return 0;
}

function anchorY(baseline: CanvasTextBaseline): number {
  if (baseline === 'middle') return 0.5;
  if (baseline === 'top' || baseline === 'hanging') return 0;
  return 1;
}
