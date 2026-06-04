/**
 * gpu/ — GPU rendering backend (PixiJS v8: WebGPU with WebGL2 fallback).
 *
 * Public surface for wiring the GPU path into the game. The default renderer stays
 * Canvas2D; this backend is opt-in behind a flag (NEXT_PUBLIC_GPU_RENDERER).
 */
export type { IsoRenderer, IsoImageSource } from './IsoRenderer';
export { TextureCache } from './textures';
export { PixiRenderer } from './PixiRenderer';
export { LayerStack, LAYER_ORDER, DYNAMIC_LAYERS, isDynamicLayer } from './layers';
export type { LayerName } from './layers';
export { worldMatrix } from './camera';
export type { CameraState } from './camera';
export { createPixiApp } from './PixiApp';
export type { PixiAppOptions } from './PixiApp';
export { FixedTimestepClock, lerp, lerpPoint } from './interpolate';
export type { Lerpable } from './interpolate';
