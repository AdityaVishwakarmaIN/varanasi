import { describe, expect, it } from 'vitest';
import { getDistanceToGanga, getRiverZone } from '@/games/isocity/maps/riverZones';
import {
  LANDMARKS,
  LANDMARK_IDS,
  LANDMARK_REASONS,
  canPlaceLandmark,
  formatNextLandmarkLine,
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
