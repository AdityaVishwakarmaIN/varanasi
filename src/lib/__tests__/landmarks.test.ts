import { describe, expect, it } from 'vitest';
import { getDistanceToGanga, getRiverZone } from '@/games/isocity/maps/riverZones';
import type { Tile } from '@/games/isocity/types/game';
import { isBuildingFireEligible } from '@/lib/fireConfig';
import { getFloodDamageChance } from '@/lib/floods';
import { riverFactor } from '@/lib/tourism';
import { createRng } from '@/lib/rng';
import { bulldozeTile, createInitialGameState, placeBuilding } from '@/lib/simulation';
import {
  LANDMARKS,
  LANDMARK_IDS,
  LANDMARK_REASONS,
  canPlaceLandmark,
  collectLandmarks,
  formatNextLandmarkLine,
  getLandmarkBonuses,
  getLandmarkLandValueBonus,
  getLandmarkMenuStatus,
  getLandmarkPlacementContext,
  getLandmarkUnlockNotification,
  getNewlyUnlockedLandmarks,
  hasUnseenLandmarks,
  getNextLandmark,
  getUnlockedLandmarks,
  isLandmarkType,
  type LandmarkId,
  type LandmarkPlacementContext,
} from '@/lib/landmarks';

const SIZE = 160;
const ctx: LandmarkPlacementContext = {
  gridSize: SIZE,
  mapId: 'varanasi',
  isLandFree: (x, y) => getRiverZone(x, y, SIZE, 'varanasi') !== 'river',
  built: [],
};

/** First origin whose result has this reason (undefined = ok). */
function findOrigin(id: LandmarkId, reason: string | undefined, c: LandmarkPlacementContext = ctx): { x: number; y: number } | null {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const r = canPlaceLandmark(id, x, y, c);
      if (reason === undefined ? r.ok : r.reason === reason) return { x, y };
    }
  }
  return null;
}

function footprint(id: LandmarkId, o: { x: number; y: number }) {
  const tiles: { x: number; y: number }[] = [];
  const { width, height } = LANDMARKS[id].size;
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) tiles.push({ x: o.x + dx, y: o.y + dy });
  return tiles;
}

describe('landmark unlocks', () => {
  it('unlock from the peak displayed population', () => {
    expect(getUnlockedLandmarks(0)).toEqual([]);
    expect(getUnlockedLandmarks(49_999)).toEqual([]);
    expect(getUnlockedLandmarks(50_000)).toEqual(['landmark_dashashwamedh']);
    expect(getUnlockedLandmarks(250_000)).toEqual(['landmark_dashashwamedh', 'landmark_kashi_vishwanath', 'landmark_bhu']);
    expect(getUnlockedLandmarks(5_000_000)).toEqual([...LANDMARK_IDS]);
  });

  it('are in the design-doc order and data', () => {
    expect(LANDMARK_IDS).toEqual([
      'landmark_dashashwamedh',
      'landmark_kashi_vishwanath',
      'landmark_bhu',
      'landmark_sarnath',
      'landmark_ramnagar_fort',
    ]);
    expect(LANDMARKS.landmark_bhu.size).toEqual({ width: 4, height: 4 });
    expect(LANDMARKS.landmark_ramnagar_fort.cost).toBe(80_000);
    expect(LANDMARKS.landmark_sarnath.effects.tourismGangaAffected).toBe(false);
  });

  it('next landmark line', () => {
    expect(getNextLandmark(241_000)?.id).toBe('landmark_sarnath');
    expect(formatNextLandmarkLine(241_000)).toBe('Next landmark: Sarnath at 3,00,000 (you: 2,41,000)');
    expect(formatNextLandmarkLine(241_000, 200_500)).toBe('Next landmark: Sarnath at 3,00,000 (you: 2,00,500)');
    expect(getNextLandmark(500_000)).toBeNull();
    expect(formatNextLandmarkLine(900_000)).toBeNull();
  });

  it('recognises landmark building types', () => {
    expect(isLandmarkType('landmark_bhu')).toBe(true);
    expect(isLandmarkType('university')).toBe(false);
  });
});

describe('landmark placement: shared rules', () => {
  const site = findOrigin('landmark_bhu', undefined)!;

  it('only on the Varanasi map', () => {
    expect(canPlaceLandmark('landmark_bhu', site.x, site.y, { ...ctx, mapId: 'random' })).toEqual({
      ok: false,
      reason: LANDMARK_REASONS.notVaranasi,
    });
  });

  it('each landmark can be built once', () => {
    const r = canPlaceLandmark('landmark_bhu', site.x, site.y, { ...ctx, built: ['landmark_bhu'] });
    expect(r).toEqual({ ok: false, reason: 'Banaras Hindu University has already been built. Each landmark can be built once' });
  });

  it('locked landmarks say when they unlock', () => {
    const r = canPlaceLandmark('landmark_bhu', site.x, site.y, { ...ctx, peakDisplayedPopulation: 1000 });
    expect(r).toEqual({ ok: false, reason: 'Unlocks at 2,00,000 people' });
    expect(canPlaceLandmark('landmark_bhu', site.x, site.y, { ...ctx, peakDisplayedPopulation: 200_000 }).ok).toBe(true);
  });

  it('must fit on the map and on clear land', () => {
    expect(canPlaceLandmark('landmark_bhu', SIZE - 3, 10, ctx).reason).toBe(LANDMARK_REASONS.offMap);
    expect(canPlaceLandmark('landmark_bhu', -1, 10, ctx).reason).toBe(LANDMARK_REASONS.offMap);
    const blocked = { ...ctx, isLandFree: (x: number, y: number) => !(x === site.x + 1 && y === site.y + 1) };
    expect(canPlaceLandmark('landmark_bhu', site.x, site.y, blocked).reason).toBe(LANDMARK_REASONS.notFree);
  });
});

describe('landmark placement: each landmark', () => {
  it('Dashashwamedh needs 2 west-bank riverfront tiles', () => {
    const ok = findOrigin('landmark_dashashwamedh', undefined)!;
    expect(ok).not.toBeNull();
    const riverfront = footprint('landmark_dashashwamedh', ok).filter(
      (t) => getRiverZone(t.x, t.y, SIZE, 'varanasi') === 'westRiverfront'
    );
    expect(riverfront.length).toBeGreaterThanOrEqual(2);
    expect(canPlaceLandmark('landmark_dashashwamedh', 5, 80, ctx).reason).toBe(LANDMARK_REASONS.dashashwamedh);
  });

  it('Kashi Vishwanath: west bank, within 8 tiles of the Ganga', () => {
    const ok = findOrigin('landmark_kashi_vishwanath', undefined)!;
    expect(ok).not.toBeNull();
    const d = Math.min(...footprint('landmark_kashi_vishwanath', ok).map((t) => getDistanceToGanga(t.x, t.y, SIZE, 'varanasi')));
    expect(d).toBeLessThanOrEqual(8);
    expect(canPlaceLandmark('landmark_kashi_vishwanath', 5, 80, ctx).reason).toBe(LANDMARK_REASONS.kashiDistance);
    expect(canPlaceLandmark('landmark_kashi_vishwanath', 150, 80, ctx).reason).toBe(LANDMARK_REASONS.kashiWestBank);
  });

  it('BHU: anywhere on land except a flood zone', () => {
    expect(canPlaceLandmark('landmark_bhu', 5, 80, ctx).ok).toBe(true);
    expect(canPlaceLandmark('landmark_bhu', 5, 80, { ...ctx, isFloodZone: () => true }).reason).toBe(LANDMARK_REASONS.bhuFlood);
    // Without a flood mask, the floodplain counts as a flood zone.
    expect(findOrigin('landmark_bhu', LANDMARK_REASONS.bhuFlood)).not.toBeNull();
    const floodplain = findOrigin('landmark_bhu', LANDMARK_REASONS.bhuFlood)!;
    expect(canPlaceLandmark('landmark_bhu', floodplain.x, floodplain.y, { ...ctx, isFloodZone: () => false }).ok).toBe(true);
  });

  it('Sarnath: northern quarter, west of the Ganga', () => {
    const ok = findOrigin('landmark_sarnath', undefined)!;
    expect(ok).not.toBeNull();
    for (const t of footprint('landmark_sarnath', ok)) {
      expect(t.y / (SIZE - 1)).toBeLessThan(0.25);
      expect(['westBank', 'westRiverfront']).toContain(getRiverZone(t.x, t.y, SIZE, 'varanasi'));
    }
    expect(canPlaceLandmark('landmark_sarnath', 5, 80, ctx).reason).toBe(LANDMARK_REASONS.sarnathNorth);
    expect(canPlaceLandmark('landmark_sarnath', 5, 38, ctx).reason).toBe(LANDMARK_REASONS.sarnathNorth); // 40/159 ≥ 0.25
    expect(canPlaceLandmark('landmark_sarnath', 150, 30, ctx).reason).toBe(LANDMARK_REASONS.sarnathWest);
  });

  it('Ramnagar Fort: east bank, not on the floodplain', () => {
    const ok = findOrigin('landmark_ramnagar_fort', undefined)!;
    expect(ok).not.toBeNull();
    for (const t of footprint('landmark_ramnagar_fort', ok)) {
      expect(getRiverZone(t.x, t.y, SIZE, 'varanasi')).toBe('eastBank');
    }
    expect(canPlaceLandmark('landmark_ramnagar_fort', 5, 80, ctx).reason).toBe(LANDMARK_REASONS.ramnagarEast);
    expect(findOrigin('landmark_ramnagar_fort', LANDMARK_REASONS.ramnagarFloodplain)).not.toBeNull();
  });
});

describe('landmark unlock events and menu status', () => {
  it('reports each landmark once as the displayed peak crosses its threshold', () => {
    expect(getNewlyUnlockedLandmarks(0, 49_999)).toEqual([]);
    expect(getNewlyUnlockedLandmarks(49_999, 50_000)).toEqual(['landmark_dashashwamedh']);
    expect(getNewlyUnlockedLandmarks(50_000, 60_000)).toEqual([]);
    expect(getNewlyUnlockedLandmarks(0, 1_000_000)).toEqual([...LANDMARK_IDS]);
  });

  it('unlock notification is celebratory, not a crisis', () => {
    const n = getLandmarkUnlockNotification('landmark_sarnath');
    expect(n.icon).toBe('landmark');
    expect(n.severity).toBe('info');
    expect(n.title).toContain('Sarnath');
  });

  it('menu status: locked below the peak threshold, built once standing, a dip never re-locks', () => {
    const base = { stats: { population: 5_000 } as never, landmarksBuilt: [] as LandmarkId[] };
    expect(getLandmarkMenuStatus('landmark_dashashwamedh', { ...base, peakPopulation: 0 }).locked).toBe(false);
    expect(getLandmarkMenuStatus('landmark_kashi_vishwanath', { ...base, peakPopulation: 0 }).locked).toBe(true);
    expect(getLandmarkMenuStatus('landmark_kashi_vishwanath', { ...base, peakPopulation: 10_000 }).locked).toBe(false);
    const built = getLandmarkMenuStatus('landmark_dashashwamedh', { ...base, peakPopulation: 5_000, landmarksBuilt: ['landmark_dashashwamedh'] });
    expect(built).toMatchObject({ locked: false, built: true });
  });

  it('the menu glows only on Varanasi while an unlocked landmark is unseen', () => {
    const s = { stats: { population: 12_000 } as never, peakPopulation: 12_000 };
    expect(hasUnseenLandmarks({ ...s, mapId: 'varanasi', landmarksSeen: 0 })).toBe(true);
    expect(hasUnseenLandmarks({ ...s, mapId: 'varanasi', landmarksSeen: 2 })).toBe(false);
    expect(hasUnseenLandmarks({ ...s, mapId: undefined, landmarksSeen: 0 })).toBe(false);
  });
});

describe('landmark effects', () => {
  it('sums bonuses; Ganga-affected tourism scales with river health', () => {
    const b = getLandmarkBonuses(
      [
        { id: 'landmark_dashashwamedh', x: 10, y: 10 },
        { id: 'landmark_kashi_vishwanath', x: 20, y: 20 },
        { id: 'landmark_sarnath', x: 30, y: 30 },
      ],
      64
    );
    expect(b.happiness).toBe(5);
    expect(b.commercialDemand).toBe(10);
    expect(b.extraGhats).toHaveLength(4);
    expect(new Set(b.extraGhats).size).toBe(4);
    expect(b.tourismIncome).toBeCloseTo(150 * riverFactor(64) + 200);
  });

  it('Ramnagar Fort raises land value within 6 tiles of its footprint', () => {
    const size = 30;
    const grid: Tile[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ building: { type: 'grass', constructionProgress: 100, abandoned: false } }) as unknown as Tile)
    );
    grid[10][10] = { building: { type: 'landmark_ramnagar_fort', constructionProgress: 100, abandoned: false } } as unknown as Tile;
    expect(collectLandmarks(grid, size)).toEqual([{ id: 'landmark_ramnagar_fort', x: 10, y: 10 }]);
    expect(getLandmarkLandValueBonus(grid, size, 11, 11)).toBe(20);
    expect(getLandmarkLandValueBonus(grid, size, 18, 12)).toBe(20);
    expect(getLandmarkLandValueBonus(grid, size, 19, 12)).toBe(0);
    expect(getLandmarkLandValueBonus(grid, size, 0, 0)).toBe(0);
  });

  it('landmarks never burn or take flood damage', () => {
    for (const id of LANDMARK_IDS) {
      expect(isBuildingFireEligible(id)).toBe(false);
      expect(getFloodDamageChance(id)).toBe(0);
    }
  });
});

describe('landmark placement in the simulation', () => {
  function firstOk(state: ReturnType<typeof createInitialGameState>, id: LandmarkId): { x: number; y: number } {
    const c = getLandmarkPlacementContext(state);
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) if (canPlaceLandmark(id, x, y, c).ok) return { x, y };
    }
    throw new Error(`no site for ${id}`);
  }

  it('refuses a locked landmark, places an unlocked one once, and bulldozing frees it again', () => {
    let state = createInitialGameState(SIZE, 'Landmarks', createRng(3), 'varanasi');
    state.stats.money = 1_000_000;
    const id: LandmarkId = 'landmark_dashashwamedh';

    state.peakPopulation = 5_000;
    const site = firstOk(state, id);
    state.peakPopulation = 0;
    expect(placeBuilding(state, site.x, site.y, id, null)).toBe(state);

    state.peakPopulation = 5_000;
    state = placeBuilding(state, site.x, site.y, id, null);
    expect(state.grid[site.y][site.x].building.type).toBe(id);
    expect(state.landmarksBuilt).toEqual([id]);
    expect(canPlaceLandmark(id, site.x, site.y, getLandmarkPlacementContext(state)).reason).toBe(LANDMARK_REASONS.alreadyBuilt(LANDMARKS[id].name));

    state = bulldozeTile(state, site.x + 1, site.y + 1);
    expect(state.grid[site.y][site.x].building.type).not.toBe(id);
    expect(state.landmarksBuilt).toEqual([]);
  });
});
