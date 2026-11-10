import { describe, expect, it } from 'vitest';
import { SPRITE_KEY_THRESHOLD, keyOutBackground } from '@/lib/spriteKeyColor';

/** The original per-pixel test (Euclidean distance with sqrt / Math.pow). */
function originalIsKeyed(r: number, g: number, b: number, threshold = SPRITE_KEY_THRESHOLD): boolean {
  return Math.sqrt(Math.pow(r - 255, 2) + Math.pow(g - 0, 2) + Math.pow(b - 0, 2)) <= threshold;
}

describe('keyOutBackground', () => {
  it('clears pure and near red, keeps everything else and the other channels', () => {
    const px = new Uint8ClampedArray([
      255, 0, 0, 255, // key colour
      200, 60, 40, 255, // near red (distance ~ 94)
      120, 40, 40, 255, // dark red (distance ~ 146)
      80, 80, 80, 255, // grey
      255, 255, 255, 255, // white
    ]);
    expect(keyOutBackground(px)).toBe(3);
    expect(Array.from(px)).toEqual([255, 0, 0, 0, 200, 60, 40, 0, 120, 40, 40, 0, 80, 80, 80, 255, 255, 255, 255, 255]);
  });

  it('matches the original sqrt-based test exactly, including the threshold boundary', () => {
    const colours: number[] = [];
    for (let r = 0; r <= 255; r += 5) for (let g = 0; g <= 255; g += 15) for (let b = 0; b <= 255; b += 15) colours.push(r, g, b, 255);
    // exact boundary: distance 155 from (255, 0, 0)
    colours.push(100, 0, 0, 255, 255, 155, 0, 255, 255, 0, 155, 255, 255, 0, 156, 255);
    const px = new Uint8ClampedArray(colours);
    keyOutBackground(px);
    for (let i = 0; i < px.length; i += 4) {
      expect(px[i + 3] === 0).toBe(originalIsKeyed(colours[i], colours[i + 1], colours[i + 2]));
    }
  });
});
