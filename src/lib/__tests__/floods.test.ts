import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  computeFloodMask,
  countFlooded,
  FLOOD_CONFIG,
  FLOOD_SEASON_DAYS,
  getEmbankmentProtection,
  getFloodDamageChance,
  getFloodRiskLevel,
  getMonsoonForecastText,
  getMonsoonsThatFlood,
  getRiverLevel,
  getTributaryDistance,
  isEmbankmentSiteInRange,
  isMonsoonRollDay,
  rollMonsoonStrength,
  type MonsoonStrength,
  type TilePos,
} from '@/lib/floods';
import { getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
import { getVaranasiLayout, LAYOUT_WATER } from '@/games/isocity/maps/varanasiLayout';

const SIZE = 60;
const ZONE = { river: 1, westRiverfront: 2, westBank: 3, eastFloodplain: 4, eastBank: 5 };

function tilesInZone(zoneCode: number): number[] {
  const { zone } = getRiverZoneArrays(SIZE);
  const out: number[] = [];
  for (let i = 0; i < zone.length; i++) if (zone[i] === zoneCode) out.push(i);
  return out;
}

describe('rollMonsoonStrength', () => {
  it('rolls weak 25% / normal 50% / heavy 25%', () => {
    const rng = createRng(42);
    const counts: Record<MonsoonStrength, number> = { weak: 0, normal: 0, heavy: 0 };
    const N = 10000;
    for (let i = 0; i < N; i++) counts[rollMonsoonStrength(rng)]++;
    expect(counts.weak / N).toBeCloseTo(0.25, 1);
    expect(counts.normal / N).toBeCloseTo(0.5, 1);
    expect(counts.heavy / N).toBeCloseTo(0.25, 1);
  });

  it('maps the draw boundaries', () => {
    expect(rollMonsoonStrength(() => 0)).toBe('weak');
    expect(rollMonsoonStrength(() => 0.2499)).toBe('weak');
    expect(rollMonsoonStrength(() => 0.25)).toBe('normal');
    expect(rollMonsoonStrength(() => 0.7499)).toBe('normal');
    expect(rollMonsoonStrength(() => 0.75)).toBe('heavy');
  });

  it('rolls on 1 June, with a forecast', () => {
    expect(isMonsoonRollDay(6, 1)).toBe(true);
    expect(isMonsoonRollDay(6, 2)).toBe(false);
    expect(getMonsoonForecastText('heavy').title).toBe('Monsoon forecast: HEAVY');
  });
});

describe('getRiverLevel', () => {
  const series = (s: MonsoonStrength) => {
    const out: number[] = [];
    for (let m = 7; m <= 9; m++) for (let d = 1; d <= 30; d++) out.push(getRiverLevel(m, d, s));
    return out;
  };

  it('flood season is 90 game days', () => expect(FLOOD_SEASON_DAYS).toBe(90));

  it('is 0 outside July-September and without a strength', () => {
    for (const m of [1, 2, 3, 4, 5, 6, 10, 11, 12]) expect(getRiverLevel(m, 15, 'heavy')).toBe(0);
    expect(getRiverLevel(8, 15, undefined)).toBe(0);
  });

  it('rises from 0 on 1 July, peaks mid-August at the strength peak, and is 0 on 30 September', () => {
    for (const s of ['weak', 'normal', 'heavy'] as MonsoonStrength[]) {
      const levels = series(s);
      const peak = FLOOD_CONFIG.peakLevel[s];
      expect(levels[0]).toBe(0);
      expect(levels[89]).toBe(0);
      expect(Math.max(...levels)).toBe(peak);
      expect(getRiverLevel(8, 15, s)).toBe(peak);
      expect(getRiverLevel(8, 16, s)).toBe(peak);
      // Monotonic rise to the middle, monotonic fall afterwards, integers only.
      for (let i = 1; i < 45; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
      for (let i = 45; i < 90; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
      for (const l of levels) expect(Number.isInteger(l)).toBe(true);
      // Symmetric around mid-August.
      for (let i = 0; i < 45; i++) expect(levels[i]).toBe(levels[89 - i]);
    }
  });

  it('heavy monsoons are higher than weak ones on every day', () => {
    const weak = series('weak');
    const heavy = series('heavy');
    for (let i = 0; i < 90; i++) expect(heavy[i]).toBeGreaterThanOrEqual(weak[i]);
  });
});

describe('computeFloodMask', () => {
  it('floods nothing at level 0 and more tiles at each higher level', () => {
    const counts = [0, 1, 2, 3].map((l) => countFlooded(computeFloodMask(SIZE, l)));
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[3]).toBeGreaterThan(counts[2]);
  });

  it('higher levels flood a superset of lower levels', () => {
    for (let l = 1; l < 3; l++) {
      const lo = computeFloodMask(SIZE, l);
      const hi = computeFloodMask(SIZE, l + 1);
      for (let i = 0; i < lo.length; i++) if (lo[i]) expect(hi[i]).toBe(1);
    }
  });

  it('never floods river tiles', () => {
    const { water } = getVaranasiLayout(SIZE);
    const mask = computeFloodMask(SIZE, 3);
    for (let i = 0; i < mask.length; i++) if (water[i] !== LAYOUT_WATER.none) expect(mask[i]).toBe(0);
  });

  it('level 1 floods only east-floodplain tiles within 3 of the Ganga', () => {
    const { zone, distance } = getRiverZoneArrays(SIZE);
    const mask = computeFloodMask(SIZE, 1);
    for (let i = 0; i < mask.length; i++) {
      const expected = zone[i] === ZONE.eastFloodplain && distance[i] <= 3 ? 1 : 0;
      expect(mask[i]).toBe(expected);
    }
  });

  it('ghat tiles (westRiverfront) flood at level 2 but not at level 1', () => {
    const ghats = tilesInZone(ZONE.westRiverfront);
    expect(ghats.length).toBeGreaterThan(0);
    const l1 = computeFloodMask(SIZE, 1);
    const l2 = computeFloodMask(SIZE, 2);
    for (const i of ghats) {
      expect(l1[i]).toBe(0);
      expect(l2[i]).toBe(1);
    }
    for (const i of tilesInZone(ZONE.eastFloodplain)) expect(l2[i]).toBe(1);
  });

  it('level 3 adds west-bank tiles near the Ganga and tiles near the Assi/Varuna, but not the far east bank', () => {
    const { zone, distance } = getRiverZoneArrays(SIZE);
    const trib = getTributaryDistance(SIZE);
    const { water } = getVaranasiLayout(SIZE);
    const l2 = computeFloodMask(SIZE, 2);
    const l3 = computeFloodMask(SIZE, 3);
    let tributaryOnly = 0;
    for (let i = 0; i < l3.length; i++) {
      if (water[i] !== LAYOUT_WATER.none) continue;
      const westNear = zone[i] === ZONE.westBank && distance[i] <= 3;
      const nearTrib = trib[i] <= 2;
      const expected = l2[i] === 1 || westNear || nearTrib ? 1 : 0;
      expect(l3[i]).toBe(expected);
      if (nearTrib && !westNear && !l2[i]) tributaryOnly++;
    }
    expect(tributaryOnly).toBeGreaterThan(0);
  });

  it('is memoized per (size, level, embankments)', () => {
    expect(computeFloodMask(SIZE, 2)).toBe(computeFloodMask(SIZE, 2));
    const e = [{ x: 1, y: 1 }];
    expect(computeFloodMask(SIZE, 2, e)).toBe(computeFloodMask(SIZE, 2, [{ x: 1, y: 1 }]));
  });

  it('the flood-risk overlay predicts exactly which tiles flood', () => {
    const risk = getFloodRiskLevel(SIZE);
    for (let l = 1; l <= 3; l++) {
      const mask = computeFloodMask(SIZE, l);
      for (let i = 0; i < mask.length; i++) expect(mask[i]).toBe(risk[i] !== 0 && risk[i] <= l ? 1 : 0);
    }
    expect(getMonsoonsThatFlood(1)).toEqual(['weak', 'normal', 'heavy']);
    expect(getMonsoonsThatFlood(2)).toEqual(['normal', 'heavy']);
    expect(getMonsoonsThatFlood(3)).toEqual(['heavy']);
    expect(getMonsoonsThatFlood(0)).toEqual([]);
  });
});

describe('embankments', () => {
  const { zone, distance } = getRiverZoneArrays(SIZE);
  const { side } = getVaranasiLayout(SIZE);
  /** East-floodplain tiles right next to the river, around the middle of the map. */
  const eastLine: TilePos[] = [];
  for (let y = 25; y <= 35; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      if (zone[i] === ZONE.eastFloodplain && distance[i] === 1) {
        eastLine.push({ x, y });
        break;
      }
    }
  }

  it('a line of embankments shrinks the flood mask behind it', () => {
    expect(eastLine.length).toBeGreaterThan(5);
    for (let l = 1; l <= 3; l++) {
      const without = countFlooded(computeFloodMask(SIZE, l));
      const withEmb = countFlooded(computeFloodMask(SIZE, l, eastLine));
      expect(withEmb).toBeLessThanOrEqual(without);
    }
    expect(countFlooded(computeFloodMask(SIZE, 1, eastLine))).toBeLessThan(countFlooded(computeFloodMask(SIZE, 1)));
  });

  it('protected tiles flood one level later; level-3 tiles become safe', () => {
    const base = getFloodRiskLevel(SIZE);
    const risk = getFloodRiskLevel(SIZE, eastLine);
    const prot = getEmbankmentProtection(SIZE, eastLine);
    let shifted = 0;
    for (let i = 0; i < base.length; i++) {
      if (base[i] === 0) expect(risk[i]).toBe(0);
      else if (prot[i]) {
        expect(risk[i]).toBe(base[i] === 3 ? 0 : base[i] + 1);
        shifted++;
      } else expect(risk[i]).toBe(base[i]);
    }
    expect(shifted).toBeGreaterThan(0);
  });

  it('protects only same-bank tiles within radius 4 that are not between it and the river', () => {
    const e = eastLine[Math.floor(eastLine.length / 2)];
    const prot = getEmbankmentProtection(SIZE, [e]);
    const ei = e.y * SIZE + e.x;
    for (let i = 0; i < prot.length; i++) {
      if (!prot[i]) continue;
      const x = i % SIZE;
      const y = (i / SIZE) | 0;
      expect((x - e.x) ** 2 + (y - e.y) ** 2).toBeLessThanOrEqual(FLOOD_CONFIG.embankmentRadius ** 2);
      expect(side[i]).toBe(side[ei]);
      expect(distance[i]).toBeGreaterThanOrEqual(distance[ei]);
    }
    expect(prot[ei]).toBe(1);
  });

  it('does not stack: two overlapping embankments still shift a tile by one level only', () => {
    const a = eastLine[3];
    const b = eastLine[4];
    const one = getFloodRiskLevel(SIZE, [a]);
    const two = getFloodRiskLevel(SIZE, [a, b]);
    const base = getFloodRiskLevel(SIZE);
    for (let i = 0; i < base.length; i++) {
      if (base[i] === 0) continue;
      if (one[i] !== base[i]) expect(two[i]).toBe(one[i]);
      expect(two[i] === 0 || two[i] - base[i] <= 1).toBe(true);
    }
  });

  it('a west-bank embankment does not protect the east bank', () => {
    const westTile = tilesInZone(ZONE.westBank).find((i) => distance[i] === 2)!;
    const prot = getEmbankmentProtection(SIZE, [{ x: westTile % SIZE, y: (westTile / SIZE) | 0 }]);
    for (let i = 0; i < prot.length; i++) if (prot[i]) expect(side[i]).toBe(side[westTile]);
  });

  it('may only be built on land within 4 tiles of the Ganga', () => {
    const e = eastLine[0];
    expect(isEmbankmentSiteInRange(e.x, e.y, SIZE)).toBe(true);
    const far = tilesInZone(ZONE.westBank).find((i) => distance[i] > 4)!;
    expect(isEmbankmentSiteInRange(far % SIZE, (far / SIZE) | 0, SIZE)).toBe(false);
    const river = tilesInZone(ZONE.river)[0];
    expect(isEmbankmentSiteInRange(river % SIZE, (river / SIZE) | 0, SIZE)).toBe(false);
  });
});

describe('flood damage', () => {
  it('ghats take no damage, informal housing more than normal buildings', () => {
    expect(getFloodDamageChance('ghat')).toBe(0);
    expect(getFloodDamageChance('road')).toBe(0);
    expect(getFloodDamageChance('house_small')).toBe(0.01);
    expect(getFloodDamageChance('informal_housing')).toBe(0.05);
  });
});
