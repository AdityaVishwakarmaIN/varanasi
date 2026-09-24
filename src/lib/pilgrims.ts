/**
 * Pilgrim crowds at the ghats (S3-T10). Pure numbers for the pedestrian system: how many pilgrims, when, and what they wear.
 */
import type { MapId } from '@/games/isocity/maps/varanasi';
import type { Rng } from '@/lib/rng';

export const PILGRIM_CONFIG = {
  /** PILGRIM_SHARE: share of pedestrians on the Varanasi map who head for a ghat. */
  share: 0.3,
  /** Pilgrims stay at a ghat this many times longer than at other destinations. */
  lingerMultiplier: 3,
  /** Peak windows (hour of day, inclusive start and end of the full-strength plateau). */
  dawn: { start: 5, end: 8 },
  dusk: { start: 17, end: 20 },
  /** Hours over which the crowd ramps smoothly (cosine) from quiet to peak on each side of a window. */
  rampHours: 2,
  /** Crowd factor outside the peaks (midday and night). */
  quietFactor: 0.2,
  /** Share of new pilgrims who walk to the ghat nearest their home; the rest start at a ghat near the view. */
  walkingShare: 0.3,
  /** Pilgrims never take more than this share of the quality preset's pedestrian cap. */
  maxShareOfPedestrians: 0.6,
  /** Pilgrims who end their stay per frame once the crowd is above target (a gradual thinning). */
  maxLeavingPerFrame: 1,
  /** Pilgrims at the ghats per ₹1 of monthly tourism income, before the time-of-day factor (starting value). */
  pilgrimsPerTourismRupee: 0.5,
  /** Clothing colours: saffron, white, orange, marigold, cream, deep saffron. */
  clothingColors: ['#FF9933', '#F7F5EE', '#FF7F11', '#F4B400', '#EFE6D2', '#E25822'] as readonly string[],
} as const;

/** Distance in hours from `hour` to the window [start, end] on a 24-hour circle (0 inside the window). */
function hoursOutside(hour: number, start: number, end: number): number {
  if (hour >= start && hour <= end) return 0;
  const before = (start - hour + 24) % 24;
  const after = (hour - end + 24) % 24;
  return Math.min(before, after);
}

function bump(hour: number, win: { start: number; end: number }, ramp: number): number {
  const d = hoursOutside(hour, win.start, win.end);
  if (d >= ramp) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * d) / ramp));
}

/**
 * Crowd strength at the ghats for an hour of day (fractions allowed; wraps at 24).
 * 1 during dawn (5–8) and dusk (17–20), quietFactor at midday and at night, with smooth cosine ramps in between.
 */
export function getGhatCrowdFactor(hour: number): number {
  const c = PILGRIM_CONFIG;
  const h = (((Number.isFinite(hour) ? hour : 0) % 24) + 24) % 24;
  const peak = Math.max(bump(h, c.dawn, c.rampHours), bump(h, c.dusk, c.rampHours));
  return c.quietFactor + (1 - c.quietFactor) * peak;
}

/** Peak pilgrim count for the ghats: tourismIncome × pilgrimsPerTourismRupee, capped by the quality preset's pedestrian cap. */
export function getPilgrimTarget(tourismIncome: number, qualityCap: number): number {
  const raw = Math.floor(Math.max(0, tourismIncome) * PILGRIM_CONFIG.pilgrimsPerTourismRupee);
  return Math.max(0, Math.min(Math.floor(Math.max(0, qualityCap)), raw));
}

/** Pilgrims wanted at the ghats right now: the peak target scaled by the time of day. */
export function getGhatCrowdTarget(tourismIncome: number, qualityCap: number, hour: number): number {
  return Math.round(getPilgrimTarget(tourismIncome, qualityCap) * getGhatCrowdFactor(hour));
}

/** Whether a newly spawned pedestrian becomes a pilgrim heading for a ghat (Varanasi map only). */
export function shouldBecomePilgrim(mapId: MapId | undefined, rng: Rng): boolean {
  return mapId === 'varanasi' && rng() < PILGRIM_CONFIG.share;
}

/** A clothing colour from the pilgrim palette. */
export function pickPilgrimClothing(rng: Rng): string {
  const colors = PILGRIM_CONFIG.clothingColors;
  return colors[Math.min(colors.length - 1, Math.floor(rng() * colors.length))];
}
