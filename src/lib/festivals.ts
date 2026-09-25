/**
 * Festival calendar and management events (S5-T3, S5-T4). Pure: dates in, festivals out; readiness inputs in, checklist out.
 *
 * The game calendar has 30-day months and 12-month years (360 days). Festival dates are fixed for simplicity
 * (real festivals follow the lunar calendar).
 */
import { CALENDAR, DAYS_PER_YEAR } from '@/lib/seasons';

export type FestivalId = 'maha_shivratri' | 'holi' | 'diwali' | 'chhath' | 'dev_deepawali' | 'ganga_aarti';
export type FestivalType = 'visual' | 'management';

export interface FestivalDef {
  id: FestivalId;
  name: string;
  type: FestivalType;
  /** Top-bar chip, e.g. "🪔 Diwali". */
  chip: string;
  /** Fixed date (month 1–12, day 1–30). Absent for daily festivals. */
  month?: number;
  day?: number;
  durationDays?: number;
  /** Daily festivals: active for visual hours [startHour, endHour). */
  daily?: { startHour: number; endHour: number };
}

export const FESTIVALS: Record<FestivalId, FestivalDef> = {
  maha_shivratri: { id: 'maha_shivratri', name: 'Maha Shivratri', type: 'management', chip: '🔱 Maha Shivratri', month: 2, day: 26, durationDays: 2 },
  holi: { id: 'holi', name: 'Holi', type: 'visual', chip: '🎨 Holi', month: 3, day: 14, durationDays: 2 },
  diwali: { id: 'diwali', name: 'Diwali', type: 'visual', chip: '🪔 Diwali', month: 11, day: 1, durationDays: 3 },
  chhath: { id: 'chhath', name: 'Chhath Puja', type: 'visual', chip: '🌅 Chhath Puja', month: 11, day: 6, durationDays: 2 },
  dev_deepawali: { id: 'dev_deepawali', name: 'Dev Deepawali', type: 'management', chip: '🪔 Dev Deepawali', month: 11, day: 15, durationDays: 1 },
  ganga_aarti: { id: 'ganga_aarti', name: 'Ganga Aarti', type: 'visual', chip: '🪔 Ganga Aarti', daily: { startHour: 18, endHour: 20 } },
};

export const FESTIVAL_IDS: readonly FestivalId[] = Object.keys(FESTIVALS) as FestivalId[];

/** Day of year, 0-based, on the 360-day game calendar. */
export function dayOfYear(month: number, day: number): number {
  return (month - 1) * CALENDAR.daysPerMonth + (day - 1);
}

function isDatedFestivalActive(f: FestivalDef, today: number): boolean {
  if (f.month === undefined || f.day === undefined) return false;
  const since = (today - dayOfYear(f.month, f.day) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  return since < (f.durationDays ?? 1);
}

/** Festivals running on this date and visual hour (0–23). Includes the daily Ganga Aarti during its hours. */
export function getActiveFestivals(month: number, day: number, hour: number): FestivalDef[] {
  const today = dayOfYear(month, day);
  return FESTIVAL_IDS.map((id) => FESTIVALS[id]).filter((f) =>
    f.daily ? hour >= f.daily.startHour && hour < f.daily.endHour : isDatedFestivalActive(f, today)
  );
}

export interface UpcomingFestival {
  festival: FestivalDef;
  /** 0 = starts today. */
  daysUntil: number;
}

/**
 * Dated festivals starting within the next `withinDays` days (0 = today), soonest first, wrapping into next year.
 * The daily Ganga Aarti is not listed.
 */
export function getUpcomingFestivals(month: number, day: number, withinDays: number = EVENT_CONFIG.announceDaysAhead): UpcomingFestival[] {
  const today = dayOfYear(month, day);
  const out: UpcomingFestival[] = [];
  for (const id of FESTIVAL_IDS) {
    const f = FESTIVALS[id];
    if (f.month === undefined || f.day === undefined) continue;
    const daysUntil = (dayOfYear(f.month, f.day) - today + DAYS_PER_YEAR) % DAYS_PER_YEAR;
    if (daysUntil <= withinDays) out.push({ festival: f, daysUntil });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export type ReadinessRequirementId = 'crowd_safety' | 'fire_medical' | 'access' | 'sanitation' | 'lights';

export const EVENT_CONFIG = {
  /** Management events are announced (calendar strip + notification) this many days ahead. */
  announceDaysAhead: 30,
  /** Crowd safety: average police coverage (%) in the event area. */
  minPoliceCoverage: 70,
  /** Fire and medical: average fire coverage (%) plus a hospital in range. */
  minFireCoverage: 50,
  /** Access: at least one road tile per this many area tiles. */
  areaTilesPerRoad: 6,
  /** EVENT_TRAFFIC_LIMIT: average traffic on the area's roads must be below this (0–100 scale, starting value). */
  EVENT_TRAFFIC_LIMIT: 60,
  /**
   * Road traffic estimate (tiles carry no live traffic value): residents + jobs in the area per road tile, where this
   * many people per road tile means traffic 100. A rail station in the area counts as `railStationRoadTiles` road tiles.
   */
  trafficPeoplePerRoad: 60,
  railStationRoadTiles: 6,
  /** Sanitation: water coverage (%) and Ganga Health. */
  minWaterCoverage: 80,
  minGangaHealth: 50,
  /** Lights on: the city power supply ratio must be at least this (no rolling cuts). */
  minPowerRatio: 1,
  /** Event area sizes. */
  devDeepawaliGhatRadius: 5,
  shivratriRadius: 10,
  /** Maha Shivratri without Kashi Vishwanath: visitors × this. */
  shivratriWithoutTempleVisitors: 0.5,
  /** During the event: pedestrians in the area × this (within the quality cap), traffic spawns on roads leading in × this. */
  pedestrianMultiplier: 3,
  trafficSpawnMultiplier: 1.5,
  /** Passed-requirement bands. */
  triumphMinPassed: 5,
  successMinPassed: 3,
} as const;

/** Numbers the caller measures inside the event area. Coverages are 0–100. */
export interface ReadinessInputs {
  avgPoliceCoverage: number;
  avgFireCoverage: number;
  hospitalInRange: boolean;
  areaTiles: number;
  roadTiles: number;
  /** Average traffic on the area's road tiles, 0–100. */
  avgRoadTraffic: number;
  avgWaterCoverage: number;
  gangaHealth: number;
  /** City-wide power supply ratio from utilities.supplyRatio (0–1). */
  powerSupplyRatio: number;
}

export interface ReadinessResult {
  requirement: ReadinessRequirementId;
  /** Checklist label. */
  label: string;
  passed: boolean;
  /** Hint shown when failing. */
  hint: string;
  /** Overlay to turn on for "Show me" (OverlayMode value, or a traffic view). */
  overlay: 'police' | 'fire' | 'traffic' | 'water' | 'power';
  /** Short phrase used in the "overwhelmed" notification. */
  failurePhrase: string;
}

export const READINESS_TEXT: Record<ReadinessRequirementId, Pick<ReadinessResult, 'label' | 'hint' | 'overlay' | 'failurePhrase'>> = {
  crowd_safety: { label: 'Crowd safety', hint: 'Build police thanas near the ghats', overlay: 'police', failurePhrase: 'not enough police' },
  fire_medical: {
    label: 'Fire and medical',
    hint: 'Add a fire station and hospital nearby',
    overlay: 'fire',
    failurePhrase: 'not enough fire and medical cover',
  },
  access: {
    label: 'Access',
    hint: 'Add roads or a rail station so visitors can get in',
    overlay: 'traffic',
    failurePhrase: 'traffic jams',
  },
  sanitation: { label: 'Sanitation', hint: 'Improve water supply and clean the Ganga', overlay: 'water', failurePhrase: 'poor sanitation' },
  lights: {
    label: 'Lights on',
    hint: 'Add power capacity. Cuts during the festival would be a disaster',
    overlay: 'power',
    failurePhrase: 'power cuts',
  },
};

/** The five-point readiness checklist, in table order. */
export function evaluateReadiness(inputs: ReadinessInputs): ReadinessResult[] {
  const c = EVENT_CONFIG;
  const enoughRoads = inputs.areaTiles > 0 && inputs.roadTiles * c.areaTilesPerRoad >= inputs.areaTiles;
  const checks: Record<ReadinessRequirementId, boolean> = {
    crowd_safety: inputs.avgPoliceCoverage >= c.minPoliceCoverage,
    fire_medical: inputs.avgFireCoverage >= c.minFireCoverage && inputs.hospitalInRange,
    access: enoughRoads && inputs.avgRoadTraffic < c.EVENT_TRAFFIC_LIMIT,
    sanitation: inputs.avgWaterCoverage >= c.minWaterCoverage && inputs.gangaHealth >= c.minGangaHealth,
    lights: inputs.powerSupplyRatio >= c.minPowerRatio,
  };
  return (Object.keys(READINESS_TEXT) as ReadinessRequirementId[]).map((requirement) => ({
    requirement,
    passed: checks[requirement],
    ...READINESS_TEXT[requirement],
  }));
}

export type EventOutcomeKind = 'triumph' | 'success' | 'overwhelmed';

export interface EventOutcome {
  kind: EventOutcomeKind;
  /** Tourism × this during the event. */
  tourismMultiplier: number;
  /** City-wide happiness change and how long it lasts (in-game days). */
  happinessDelta: number;
  happinessDays: number;
  /** Crisis notification (overwhelmed) or celebratory one. */
  isCrisis: boolean;
  message: string;
}

export const EVENT_OUTCOMES: Record<EventOutcomeKind, Omit<EventOutcome, 'kind' | 'message' | 'isCrisis'>> = {
  triumph: { tourismMultiplier: 3, happinessDelta: 5, happinessDays: 60 },
  /** The doc gives no duration for success; 30 days is a starting value. */
  success: { tourismMultiplier: 2, happinessDelta: 2, happinessDays: 30 },
  overwhelmed: { tourismMultiplier: 1, happinessDelta: -5, happinessDays: 30 },
};

/**
 * Outcome for a management event from the number of requirements passed: 5 triumph, 3–4 success, 0–2 overwhelmed.
 * Messages are serious, never dark: no injuries or deaths.
 * @param options festival name (default "The festival") and the failed requirements (named in the overwhelmed message)
 */
export function getEventOutcome(
  passedCount: number,
  options: { festivalName?: string; festivalId?: FestivalId; failed?: readonly ReadinessRequirementId[] } = {}
): EventOutcome {
  const name = options.festivalName ?? (options.festivalId ? FESTIVALS[options.festivalId].name : 'The festival');
  const place = options.festivalId === 'maha_shivratri' ? 'the temple lanes' : 'the ghats';
  if (passedCount >= EVENT_CONFIG.triumphMinPassed) {
    return { kind: 'triumph', ...EVENT_OUTCOMES.triumph, isCrisis: false, message: `${name} was magnificent! Visitors are raving.` };
  }
  if (passedCount >= EVENT_CONFIG.successMinPassed) {
    return {
      kind: 'success',
      ...EVENT_OUTCOMES.success,
      isCrisis: false,
      message: `${name} went well. Visitors enjoyed the celebrations.`,
    };
  }
  const phrases = (options.failed ?? []).map((id) => READINESS_TEXT[id].failurePhrase);
  const detail = phrases.length > 0 ? `: ${phrases.join(', ')}` : '.';
  return { kind: 'overwhelmed', ...EVENT_OUTCOMES.overwhelmed, isCrisis: true, message: `Crowds overwhelmed ${place}${detail}` };
}

/** Convenience: evaluate the checklist and pick the outcome in one go. */
export function resolveEvent(festivalId: FestivalId, inputs: ReadinessInputs): { checklist: ReadinessResult[]; outcome: EventOutcome } {
  const checklist = evaluateReadiness(inputs);
  const failed = checklist.filter((r) => !r.passed).map((r) => r.requirement);
  return { checklist, outcome: getEventOutcome(checklist.length - failed.length, { festivalId, failed }) };
}

/** Estimated average traffic (0–100) on an area's roads: people in the area per road-tile equivalent. */
export function estimateAreaTraffic(people: number, roadEquivalents: number): number {
  if (!(roadEquivalents > 0)) return 100;
  return Math.min(100, (100 * Math.max(0, people)) / (roadEquivalents * EVENT_CONFIG.trafficPeoplePerRoad));
}

// ---------------------------------------------------------------------------
// Saved state and per-tick effects (S5-T4)
// ---------------------------------------------------------------------------

/** Saved on GameState as `festival`. All fields optional so old saves load. */
export interface FestivalState {
  /** Festival id → absolute day of the occurrence already put on the calendar strip. */
  announced?: Partial<Record<FestivalId, number>>;
  /** The management event running now (absolute days, inclusive). */
  event?: { id: FestivalId; startDay: number; endDay: number; outcome: EventOutcomeKind; tourismMultiplier: number };
  /** City-wide happiness change left by the last management event, until this absolute day (inclusive). */
  mood?: { delta: number; untilDay: number };
}

/** Tourism × this today (1 when no management event is running). */
export function getFestivalTourismMultiplier(festival: FestivalState | undefined, today: number): number {
  const e = festival?.event;
  return e && today >= e.startDay && today <= e.endDay ? e.tourismMultiplier : 1;
}

/** Happiness points added today by the last management event's outcome (0 when none). */
export function getFestivalHappinessModifier(festival: FestivalState | undefined, today: number): number {
  const mood = festival?.mood;
  return mood && today <= mood.untilDay ? mood.delta : 0;
}

/** Scales an effect above ×1 for a reduced-scale event, e.g. Maha Shivratri without the temple (scale 0.5). */
export function scaleEventMultiplier(multiplier: number, scale: number): number {
  return 1 + (multiplier - 1) * scale;
}

export const FESTIVAL_CROWD_CONFIG = {
  /** Pilgrim crowd × this while each festival runs; the largest applies. Always within the quality preset's cap. */
  pedestrians: {
    maha_shivratri: EVENT_CONFIG.pedestrianMultiplier,
    dev_deepawali: EVENT_CONFIG.pedestrianMultiplier,
    chhath: 2,
    ganga_aarti: 1.5,
    holi: 1.5,
    diwali: 1.5,
  } as Readonly<Record<FestivalId, number>>,
  /** Share of the pedestrian cap pilgrims may take during a festival (normally PILGRIM_CONFIG.maxShareOfPedestrians). */
  maxPilgrimShare: 0.9,
} as const;

/**
 * Crowd multipliers for the renderer: pedestrians (pilgrims at the ghats) and car spawns (roads leading in).
 * `eventScale` scales a reduced management event (Maha Shivratri without Kashi Vishwanath: 0.5).
 */
export function getFestivalCrowdMultipliers(active: readonly FestivalDef[], eventScale = 1): { pedestrians: number; cars: number } {
  let pedestrians = 1;
  let cars = 1;
  for (const f of active) {
    const scale = f.type === 'management' ? eventScale : 1;
    pedestrians = Math.max(pedestrians, scaleEventMultiplier(FESTIVAL_CROWD_CONFIG.pedestrians[f.id], scale));
    if (f.type === 'management') cars = Math.max(cars, scaleEventMultiplier(EVENT_CONFIG.trafficSpawnMultiplier, scale));
  }
  return { pedestrians, cars };
}
