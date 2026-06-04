/**
 * PixiRenderer — a GPU backend that implements the {@link IsoRenderer} contract.
 *
 * STRATEGY: immediate-mode-over-retained. The game redraws each layer by replaying
 * Canvas2D-style calls (paths, fills, strokes, gradients, sprites, text), which are
 * translated on the fly into pooled `Graphics` / `Sprite` / `Text` nodes on the active
 * layer container.
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
 * `setFromMatrix`. Canvas2D transforms post-multiply, so we compose with `Matrix.append`.
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
type PathOp = (g: Graphics) => void;

/** Snapshot of the mutable draw state for save()/restore(). */
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
  private matrix = new Matrix();
  private stack: StateFrame[] = [];
  private activeLayer: Container;
  private activeLayerName: LayerName = 'base';

  // ---- current path (replayed onto pooled Graphics at fill/stroke) ----
  private path: PathOp[] = [];
  private lineDash: number[] = [];

  // ---- per-layer display-object pools (keyed by layer name) ----
  private readonly pools = new Map<LayerName, LayerPool>();

  // sub-rect texture cache for drawImage 9-arg overload
  private readonly subTexCache = new WeakMap<object, Map<string, Texture>>();

  // Shared blur filter for per-node filter='blur(px)' draws.
  private readonly blurFilter = new BlurFilter({ strength: 0, quality: 4 });

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
    draw();
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
    this.stack.length = 0;
    this.path.length = 0;
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
    this.stack.push({
      matrix: this.matrix.clone(),
      layer: this.activeLayer,
      layerName: this.activeLayerName,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      lineDashOffset: this.lineDashOffset,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      shadowBlur: this.shadowBlur,
      shadowColor: this.shadowColor,
      filter: this.filter,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      imageSmoothingEnabled: this.imageSmoothingEnabled,
      imageSmoothingQuality: this.imageSmoothingQuality,
      lineDash: this.lineDash.slice(),
    });
  }

  restore(): void {
    const s = this.stack.pop();
    if (!s) return;
    this.matrix = s.matrix;
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

  translate(x: number, y: number): void {
    this.matrix.append(new Matrix().set(1, 0, 0, 1, x, y));
  }

  scale(x: number, y: number): void {
    this.matrix.append(new Matrix().set(x, 0, 0, y, 0, 0));
  }

  rotate(angle: number): void {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.matrix.append(new Matrix().set(c, s, -s, c, 0, 0));
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
    this.path.push((g) => g.moveTo(x, y));
  }

  lineTo(x: number, y: number): void {
    this.path.push((g) => g.lineTo(x, y));
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.path.push((g) => g.arc(x, y, radius, startAngle, endAngle, counterclockwise));
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
    this.path.push((g) => g.ellipse(x, y, radiusX, radiusY));
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.path.push((g) => g.quadraticCurveTo(cpx, cpy, x, y));
  }

  closePath(): void {
    this.path.push((g) => g.closePath());
  }

  // ============================== paint ==============================

  fill(fillRule?: CanvasFillRule): void;
  fill(path: Path2D, fillRule?: CanvasFillRule): void;
  fill(_a?: CanvasFillRule | Path2D, _b?: CanvasFillRule): void {
    const g = this.acquireGraphics();
    for (const op of this.path) op(g);
    g.fill(this.fillInput());
    this.place(g);
  }

  stroke(): void;
  stroke(path: Path2D): void;
  stroke(_path?: Path2D): void {
    const g = this.acquireGraphics();
    for (const op of this.path) op(g);
    g.stroke(this.strokeInput());
    this.place(g);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const g = this.acquireGraphics();
    g.rect(x, y, w, h).fill(this.fillInput());
    this.place(g);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
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
    const mask = new Graphics();
    for (const op of this.path) op(mask);
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
    const m = this.matrix.clone();
    m.append(new Matrix().set(1, 0, 0, 1, dx, dy));
    m.append(new Matrix().set(dw / texture.width, 0, 0, dh / texture.height, 0, 0));
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
    node.alpha = this.globalAlpha;
    const blend = COMPOSITE_TO_BLEND[this.globalCompositeOperation];
    if (blend) (node as { blendMode: string }).blendMode = blend;
    const blurPx = parseBlurPx(this.filter);
    if (blurPx > 0) {
      this.blurFilter.strength = blurPx;
      node.filters = [this.blurFilter];
    } else {
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
    const { size, family, weight, italic } = parseFont(this.font);
    const fill = this.fillStyle;
    const fillColor = fill instanceof FillGradient ? fill : typeof fill === 'string' ? fill : '#000000';
    const ax = anchorX(this.textAlign);
    const ay = anchorY(this.textBaseline);
    const m = this.matrix.clone();
    m.append(new Matrix().set(1, 0, 0, 1, x, y));

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
