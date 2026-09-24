import { describe, expect, it } from 'vitest';
import { chooseRenderer, parseRendererOverride } from '@/lib/rendererSelection';

describe('chooseRenderer', () => {
  const base = { setting: 'auto' as const, override: null, webgl2: true, gpuFailed: false };

  it('auto follows the GPU-by-default switch when WebGL2 exists', () => {
    expect(chooseRenderer({ ...base, gpuByDefault: true })).toBe('gpu');
    expect(chooseRenderer({ ...base, gpuByDefault: false })).toBe('canvas');
  });

  it('auto uses Canvas2D without WebGL2', () => {
    expect(chooseRenderer({ ...base, webgl2: false, gpuByDefault: true })).toBe('canvas');
  });

  it('the user setting wins over the default', () => {
    expect(chooseRenderer({ ...base, setting: 'gpu', gpuByDefault: false })).toBe('gpu');
    expect(chooseRenderer({ ...base, setting: 'canvas', gpuByDefault: true })).toBe('canvas');
  });

  it('the debug override wins over the user setting', () => {
    expect(chooseRenderer({ ...base, setting: 'canvas', override: 'gpu' })).toBe('gpu');
    expect(chooseRenderer({ ...base, setting: 'gpu', override: 'canvas' })).toBe('canvas');
  });

  it('falls back to Canvas2D after a GPU failure or without WebGL2, whatever was asked for', () => {
    expect(chooseRenderer({ ...base, setting: 'gpu', gpuFailed: true })).toBe('canvas');
    expect(chooseRenderer({ ...base, override: 'gpu', gpuFailed: true })).toBe('canvas');
    expect(chooseRenderer({ ...base, setting: 'gpu', webgl2: false })).toBe('canvas');
  });
});

describe('parseRendererOverride', () => {
  it('reads env and URL values', () => {
    expect(parseRendererOverride('1')).toBe('gpu');
    expect(parseRendererOverride('gpu')).toBe('gpu');
    expect(parseRendererOverride('0')).toBe('canvas');
    expect(parseRendererOverride('canvas')).toBe('canvas');
    expect(parseRendererOverride(undefined)).toBeNull();
    expect(parseRendererOverride('')).toBeNull();
    expect(parseRendererOverride('webgpu')).toBeNull();
  });
});
