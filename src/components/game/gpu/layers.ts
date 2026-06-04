/**
 * layers.ts — the z-ordered container stack for the isometric scene.
 *
 * The Canvas2D renderer composites several offscreen layer canvases in a fixed
 * back-to-front order (ground/base, surface vehicles, wind, buildings, low air,
 * ambient FX, high air, lighting, hover/UI overlay). The GPU backend reproduces
 * that ordering with one Pixi `Container` per layer, added to a shared root in the
 * same order so later layers paint on top.
 *
 * The world camera matrix is applied to the root (or per-layer) so all layers pan
 * and zoom together; individual draw objects carry only their local transform.
 */
import { Container, Matrix } from 'pixi.js';

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

/** Owns the nine scene layers and exposes lookup + camera application. */
export class LayerStack {
  /** Root container holding every layer; add this to the Pixi stage. */
  readonly root: Container;
  private readonly layers = new Map<LayerName, Container>();

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

  /** Remove all drawn children from every layer (called at frame start). */
  clearAll(): void {
    for (const layer of this.layers.values()) layer.removeChildren();
  }
}
