/**
 * layers.ts — the z-ordered container stack for the isometric scene.
 *
 * The Canvas2D renderer composites several offscreen layer canvases in a fixed
 * back-to-front order (ground/base, surface vehicles, wind, buildings, low air,
 * ambient FX, high air, lighting, hover/UI overlay). The GPU backend reproduces
 * that ordering with one Pixi `Container` per layer, added to a shared root in the
 * same order so later layers paint on top.
 *
 * DYNAMIC vs RETAINED (mirrors the Canvas2D loop topology):
 *  - DYNAMIC layers (cars, wind, air, ambient, airHigh) are redrawn every frame by
 *    the continuous effects loop, so `beginFrame()` clears only these.
 *  - RETAINED layers (base, buildings, lighting, hover) are redrawn on demand when
 *    their source state changes (grid/view edit, lighting update, hover move) — the
 *    same event-driven cadence the Canvas2D path uses — via `PixiRenderer.redrawLayer`.
 *    They persist between effects frames instead of being cleared each frame.
 *
 * The world camera matrix is applied to the root so all layers pan and zoom together;
 * individual draw objects carry only their local transform.
 */
import { BlurFilter, Container, Matrix } from 'pixi.js';

/** Layer names in back-to-front paint order. */
export const LAYER_ORDER = [
  'base',
  'cars',
  'wind',
  'buildings',
  'air',
  'ambient',
  'airHigh',
  'lighting',
  'hover',
] as const;

export type LayerName = (typeof LAYER_ORDER)[number];

/** Layers cleared & redrawn every frame by the continuous effects loop. */
export const DYNAMIC_LAYERS: ReadonlySet<LayerName> = new Set<LayerName>([
  'cars',
  'wind',
  'air',
  'ambient',
  'airHigh',
]);

/** True for layers redrawn every frame (vs retained/redraw-on-change). */
export function isDynamicLayer(name: LayerName): boolean {
  return DYNAMIC_LAYERS.has(name);
}

/** Owns the nine scene layers and exposes lookup + camera application. */
export class LayerStack {
  /** Root container holding every layer; add this to the Pixi stage. */
  readonly root: Container;
  private readonly layers = new Map<LayerName, Container>();
  /** One reusable BlurFilter per blurred layer (e.g. the cloud/ambient layer). */
  private readonly blurFilters = new Map<LayerName, BlurFilter>();

  constructor(root?: Container) {
    this.root = root ?? new Container();
    for (const name of LAYER_ORDER) {
      const layer = new Container();
      layer.label = name;
      this.layers.set(name, layer);
      this.root.addChild(layer);
    }
  }

  /** Get a layer container by name. */
  get(name: LayerName): Container {
    const layer = this.layers.get(name);
    if (!layer) throw new Error(`Unknown layer: ${name}`);
    return layer;
  }

  /** Apply the world camera matrix to the whole stack. */
  applyCamera(world: Matrix): void {
    this.root.setFromMatrix(world);
  }

  /** Remove drawn children from a single layer. */
  clear(name: LayerName): void {
    this.get(name).removeChildren();
  }

  /** Clear only the per-frame (dynamic) layers; retained layers persist. */
  clearDynamic(): void {
    for (const name of DYNAMIC_LAYERS) this.get(name).removeChildren();
  }

  /** Remove all drawn children from every layer (full reset / teardown). */
  clearAll(): void {
    for (const layer of this.layers.values()) layer.removeChildren();
  }

  /**
   * Apply a single GPU blur over an entire layer (e.g. soften all cloud sprites with
   * ONE filter instead of a screen-sized OffscreenCanvas composite re-uploaded each
   * frame — see temp_suggestions!B31). Pass 0 to remove the blur.
   */
  setLayerBlur(name: LayerName, strengthPx: number): void {
    const layer = this.get(name);
    if (strengthPx <= 0) {
      if (this.blurFilters.has(name)) layer.filters = [];
      return;
    }
    let filter = this.blurFilters.get(name);
    if (!filter) {
      filter = new BlurFilter({ strength: strengthPx, quality: 4 });
      this.blurFilters.set(name, filter);
    } else {
      filter.strength = strengthPx;
    }
    layer.filters = [filter];
  }
}
