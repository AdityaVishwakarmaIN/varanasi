import { describe, expect, it } from 'vitest';
import {
  GHAT_PROFILE,
  VARANASI_PROCEDURAL_SPRITES,
  VARANASI_PROCEDURAL_SPRITE_TYPES,
  getProceduralSprite,
  getProceduralSpriteDrawRect,
  getProceduralSpriteSize,
  isVaranasiProceduralSprite,
  normalizeVariant,
  paintProceduralSprite,
  pickProceduralVariant,
  proceduralFrameKey,
} from '../varanasiSprites';
import type { Ctx2D } from '../isoPainter';

const REQUIRED: Record<string, { footprint: number; minVariants: number }> = {
  ghat: { footprint: 1, minVariants: 3 },
  sewage_treatment_plant: { footprint: 2, minVariants: 1 },
  informal_housing: { footprint: 1, minVariants: 2 },
  jal_sansthan_water_works: { footprint: 3, minVariants: 1 },
  embankment: { footprint: 1, minVariants: 1 },
  landmark_dashashwamedh: { footprint: 2, minVariants: 1 },
  landmark_kashi_vishwanath: { footprint: 2, minVariants: 1 },
  landmark_bhu: { footprint: 4, minVariants: 1 },
  landmark_sarnath: { footprint: 3, minVariants: 1 },
  landmark_ramnagar_fort: { footprint: 3, minVariants: 1 },
};

/** A do-nothing 2D context that records how many calls were made (enough to run every draw path in node). */
function mockContext(): { ctx: Ctx2D; calls: () => number } {
  let n = 0;
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop as string];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => gradient;
      return (...args: unknown[]) => {
        n++;
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`non-finite argument to ${String(prop)}`);
      };
    },
    set(t, prop, value) {
      t[prop as string] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as Ctx2D, calls: () => n };
}

describe('VARANASI_PROCEDURAL_SPRITES registry', () => {
  it('has every required sprite with the right footprint and enough variants', () => {
    for (const [key, req] of Object.entries(REQUIRED)) {
      const def = VARANASI_PROCEDURAL_SPRITES[key as keyof typeof VARANASI_PROCEDURAL_SPRITES];
      expect(def, key).toBeDefined();
      expect(def.footprint, key).toBe(req.footprint);
      expect(def.variants, key).toBeGreaterThanOrEqual(req.minVariants);
      expect(Number.isInteger(def.variants), key).toBe(true);
      expect(def.heightTiles, key).toBeGreaterThan(0);
      expect(typeof def.draw, key).toBe('function');
    }
  });

  it('lists exactly the registry keys in VARANASI_PROCEDURAL_SPRITE_TYPES', () => {
    expect([...VARANASI_PROCEDURAL_SPRITE_TYPES].sort()).toEqual(Object.keys(VARANASI_PROCEDURAL_SPRITES).sort());
    expect(isVaranasiProceduralSprite('ghat')).toBe(true);
    expect(isVaranasiProceduralSprite('house_small')).toBe(false);
  });

  it('marks the tileable and waterfront sprites', () => {
    expect(VARANASI_PROCEDURAL_SPRITES.ghat.tileable).toBe(true);
    expect(VARANASI_PROCEDURAL_SPRITES.ghat.waterfront).toBe(true);
    expect(VARANASI_PROCEDURAL_SPRITES.embankment.tileable).toBe(true);
  });
});

describe('sizes and placement', () => {
  it('puts the base diamond across the full canvas width', () => {
    for (const type of VARANASI_PROCEDURAL_SPRITE_TYPES) {
      const def = VARANASI_PROCEDURAL_SPRITES[type];
      const s = getProceduralSpriteSize(type, 256);
      expect(s.width).toBe(def.footprint * 256);
      expect(s.baseHeight).toBeCloseTo(def.footprint * 256 * 0.6);
      expect(s.baseTopY).toBe(Math.round(def.heightTiles * 256));
      expect(s.height).toBeGreaterThan(s.baseTopY + s.baseHeight);
    }
  });

  it('maps the diamond onto the footprint of the origin tile', () => {
    const size = getProceduralSpriteSize('landmark_bhu', 256);
    const r = getProceduralSpriteDrawRect({ ...size, tilePx: 256 }, 100, 200, 64);
    expect(r.dw).toBe(4 * 64);
    // top corner of the diamond lands on the origin tile's top corner
    expect(r.dx + r.dw / 2).toBe(100 + 32);
    expect(r.dy + size.baseTopY * (64 / 256)).toBe(200);
    // bottom corner lands on the front tile's bottom corner: origin y + N × tile height
    expect(r.dy + (size.baseTopY + size.baseHeight) * (64 / 256)).toBeCloseTo(200 + 4 * 64 * 0.6);
  });
});

describe('variants', () => {
  it('normalises any integer into range', () => {
    expect(normalizeVariant('ghat', 4)).toBe(1);
    expect(normalizeVariant('ghat', -1)).toBe(2);
    expect(normalizeVariant('embankment', 7)).toBe(0);
    expect(normalizeVariant('ghat', Number.NaN)).toBe(0);
  });

  it('picks deterministic, in-range variants with a mix of ghat styles along a row', () => {
    const seen = new Map<number, number>();
    for (let y = 0; y < 200; y++) {
      const v = pickProceduralVariant('ghat', 40, y);
      expect(v).toBe(pickProceduralVariant('ghat', 40, y));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
      seen.set(v, (seen.get(v) ?? 0) + 1);
    }
    expect(seen.size).toBe(3);
    expect(seen.get(0)!).toBeGreaterThan(seen.get(2)!);
    expect(pickProceduralVariant('landmark_bhu', 3, 9)).toBe(0);
  });

  it('builds stable frame keys', () => {
    expect(proceduralFrameKey('ghat', 2, true)).toBe('ghat:2:flipped');
    expect(proceduralFrameKey('embankment', 0, false)).toBe('embankment:0');
  });
});

describe('drawing', () => {
  it('runs every draw path (all variants, both orientations) without errors', () => {
    for (const type of VARANASI_PROCEDURAL_SPRITE_TYPES) {
      const def = VARANASI_PROCEDURAL_SPRITES[type];
      for (let v = 0; v < def.variants; v++) {
        for (const flipped of [false, true]) {
          const { ctx, calls } = mockContext();
          paintProceduralSprite(ctx, type, v, flipped, 64);
          expect(calls(), `${type} v${v}`).toBeGreaterThan(50);
        }
      }
    }
  });

  it('returns null from the cache when no canvas implementation exists (node)', () => {
    expect(getProceduralSprite('ghat', 0, false)).toBeNull();
    expect(getProceduralSprite('not_a_sprite')).toBeNull();
  });

  it('has a ghat step profile that spans the tile and descends to the river edge', () => {
    expect(GHAT_PROFILE[0].u0).toBe(0);
    expect(GHAT_PROFILE[GHAT_PROFILE.length - 1].u1).toBe(1);
    for (let i = 1; i < GHAT_PROFILE.length; i++) {
      expect(GHAT_PROFILE[i].u0).toBeCloseTo(GHAT_PROFILE[i - 1].u1);
      expect(GHAT_PROFILE[i].z).toBeLessThan(GHAT_PROFILE[i - 1].z);
    }
  });
});
