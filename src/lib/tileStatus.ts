/**
 * Tile status: what is wrong with a tile (or what state it is in), why, and what the player can do.
 *
 * One source of truth for the map's problem icons (problemIcons.ts / problemIconsDraw.ts), the tile info panel,
 * the help dialog legend and the advisor one-liners about single buildings:
 *  - every map icon kind (PROBLEM_KINDS) has a definition here, and `getTileStatuses` lists the icon's kind for
 *    every tile the icon layer would draw it on (built on `listTileProblems`, which shares the icon rules);
 *  - the causes are worked out from the same conditions the simulation uses (see SIM_RULES and the notes below).
 *
 * All text is `msg()` so the UI translates it with `m(...)`; dynamic numbers are msg variables.
 * Pure: nothing here changes game state.
 */
import { msg } from 'gt-next';
import type { GameState, Stats, Tile } from '@/types/game';
import type { MapId } from '@/games/isocity/maps/varanasi';
import {
  PROBLEM_KINDS,
  hasTileRoadAccess,
  isProblemBuilding,
  listTileProblems,
  PROBLEM_ICON_CONFIG,
  type ProblemKind,
} from '@/lib/problemIcons';
import { getFeederIndex } from '@/lib/feederZones';
import { getCityFloodMask, getCityFloodRisk, isFloodRepairable, FLOOD_REPAIR_SHARE } from '@/lib/floodSim';
import { FLOOD_CONFIG, getFloodDamageChance, getMonsoonsThatFlood } from '@/lib/floods';
import { getOutbreakMask } from '@/lib/crisisSim';
import { DISEASE_CONFIG } from '@/lib/disease';
import { COLLAPSE_CONFIG, COLLAPSE_MIN_AGE, isCollapseEligible } from '@/lib/collapse';
import { FAILURE_CONFIG } from '@/lib/failure';
import { INFORMAL_CONFIG } from '@/lib/informal';
import { SCORCH_TICKS, getBurnStageName, getFireFuelFactor } from '@/lib/fireConfig';
import { isLandmarkType } from '@/lib/landmarks';
import { buildingLabel } from '@/games/isocity/maps/varanasiCatalog';

/**
 * Rules of `evolveBuilding` / the zone growth loop in simulation.ts that the explanations quote. simulation.ts
 * keeps them as literals, so they are mirrored here; tileStatus.test.ts runs `simulateTick` to check each one.
 */
export const SIM_RULES = {
  /** A finished zoned building may be abandoned while its zone's demand is below this... */
  abandonBelowDemand: -20,
  /** ...and its age (ticks) is above this. */
  abandonMinAge: 30,
  /** An abandoned zoned building may be cleared (and the lot rebuilt) while its zone's demand is above this. */
  clearAboveDemand: 10,
  /** Days without power or water after which a non-starter building may be abandoned (UNSERVED_ABANDON_DAYS). */
  unservedAbandonDays: 30,
  /** Empty zoned lots get no new building at or below this demand (spawn chance scales from here to +50). */
  noGrowthAtDemand: -30,
  fullGrowthAtDemand: 50,
  /** Starter buildings (isStarterBuilding): work without power and water, at half output per missing utility. */
  starterTypes: ['house_small', 'shop_small', 'factory_small'] as readonly string[],
  /** Output of a non-starter building without power / without water / without both (evolveBuilding efficiency). */
  efficiencyNoPower: 0.5,
  efficiencyNoWater: 0.3,
  efficiencyNoUtilities: 0.15,
} as const;

export type StatusSeverity = 'critical' | 'warning' | 'info';

/** Statuses without a map icon of their own. */
export const EXTRA_STATUS_KINDS = [
  'exodus',
  'under_construction',
  'empty_lot',
  'scorched',
  'informal',
  'collapse_risk',
  'flood_risk',
  'pollution',
] as const;
export type ExtraStatusKind = (typeof EXTRA_STATUS_KINDS)[number];
export type StatusKind = ProblemKind | ExtraStatusKind;
export const STATUS_KINDS: readonly StatusKind[] = [...PROBLEM_KINDS, ...EXTRA_STATUS_KINDS];

export interface StatusDefinition {
  /** Short name: the panel heading and the legend label (msg). */
  title: string;
  /** One line: what it means and what to do, for the legend and the advisors (msg, no variables). */
  advice: string;
  /** Usual severity (a status can be raised or lowered by its conditions). */
  severity: StatusSeverity;
  /** The map icon that shows it, or null when the map draws none. */
  icon: ProblemKind | null;
}

export const STATUS_DEFINITIONS: Record<StatusKind, StatusDefinition> = {
  fire: {
    title: msg('On fire'),
    advice: msg('Only a fire truck puts it out: keep a fire station close by.'),
    severity: 'critical',
    icon: 'fire',
  },
  flood: {
    title: msg('Flooded'),
    advice: msg('The Ganga is over it: no power or water, and it may be ruined. Embankments hold the river back.'),
    severity: 'critical',
    icon: 'flood',
  },
  disease: {
    title: msg('Disease outbreak'),
    advice: msg('The block loses people every week. Hospital and water coverage end the outbreak.'),
    severity: 'critical',
    icon: 'disease',
  },
  no_road: {
    title: msg('No road access'),
    advice: msg('Lots need a road within 8 tiles through their zone to be built on: draw a road beside it.'),
    severity: 'warning',
    icon: 'no_road',
  },
  power_cut: {
    title: msg('Rolling power cut'),
    advice: msg('The city uses more power than its plants make, so blocks take turns going dark: build or upgrade a power plant.'),
    severity: 'warning',
    icon: 'power_cut',
  },
  no_power: {
    title: msg('No power'),
    advice: msg('No power plant reaches it: build one close enough to cover it.'),
    severity: 'warning',
    icon: 'no_power',
  },
  no_water: {
    title: msg('No water'),
    advice: msg('No water supply reaches it, or taps run dry in turns: build a water tower nearby.'),
    severity: 'warning',
    icon: 'no_water',
  },
  abandoned: {
    title: msg('Abandoned'),
    advice: msg('Nobody lives or works here. It is cleared and rebuilt once demand for its zone is above +10.'),
    severity: 'warning',
    icon: 'abandoned',
  },
  exodus: {
    title: msg('People are leaving'),
    advice: msg('Happiness has been critical for a year, so homes are being abandoned every month.'),
    severity: 'warning',
    icon: null,
  },
  under_construction: {
    title: msg('Under construction'),
    advice: msg('Being built. Most buildings need power and water to keep building.'),
    severity: 'info',
    icon: null,
  },
  empty_lot: {
    title: msg('Empty lot'),
    advice: msg('Zoned and waiting for a building: it needs a road and demand for its zone.'),
    severity: 'info',
    icon: null,
  },
  scorched: {
    title: msg('Burnt lot'),
    advice: msg('Burnt out by a fire. Nothing is built until it cools down.'),
    severity: 'info',
    icon: null,
  },
  informal: {
    title: msg('Informal settlement'),
    advice: msg('Pays no tax. Zone it residential with road, power and water for 30 days to make proper homes.'),
    severity: 'info',
    icon: null,
  },
  collapse_risk: {
    title: msg('Old building'),
    advice: msg('Old buildings can collapse, mostly in the monsoon. Fire station cover cuts the risk.'),
    severity: 'info',
    icon: null,
  },
  flood_risk: {
    title: msg('In the flood zone'),
    advice: msg('The Ganga reaches it in some monsoons. Embankments protect it.'),
    severity: 'info',
    icon: null,
  },
  pollution: {
    title: msg('Polluted air'),
    advice: msg('Trees and parks nearby clean the air; keep industry away from homes.'),
    severity: 'info',
    icon: null,
  },
};

/** One explained status of a tile. All strings are msg() strings: show them with `m(...)`. */
export interface TileStatus {
  kind: StatusKind;
  severity: StatusSeverity;
  /** The map icon that marks it (same glyph), or null. */
  icon: ProblemKind | null;
  title: string;
  /** Why, from the actual simulation conditions. */
  cause: string;
  /** What the player can do ('' when there is nothing to do). */
  fix: string;
  /** Extra lines (other likely causes, progress). */
  notes: string[];
}

/** Everything the explanations read about one tile. Build it with `getTileStatusContext` for a GameState. */
export interface TileStatusContext {
  tile: Tile;
  mapId?: MapId;
  /** The same per-tile inputs as the icon layer (see ProblemTileInput). */
  flooded: boolean;
  infected: boolean;
  hasRoadAccess: boolean;
  powerCut: boolean;
  /** The tile's block is in a rolling water cut right now. */
  waterCut: boolean;
  /** Lowest river level that floods the tile (0 = never, or floods off / not Varanasi). */
  floodRisk: number;
  demand: Stats['demand'];
  exodusActive: boolean;
  /** Fire station coverage on the tile (0–100). */
  fireCoverage: number;
  /** Power supply / demand (below 1 means rolling cuts). */
  powerRatio?: number;
  waterRatio?: number;
  /** Informal settlement: days of formalisation progress so far. */
  formaliseDays: number;
}

const SEVERITY_RANK: Record<StatusSeverity, number> = { critical: 0, warning: 1, info: 2 };

type Zone = 'residential' | 'commercial' | 'industrial';
const isZone = (z: string): z is Zone => z === 'residential' || z === 'commercial' || z === 'industrial';

/** "+12" / "-35" */
function signed(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : String(r);
}

function isStarter(type: string): boolean {
  return SIM_RULES.starterTypes.includes(type);
}

/** Finished (not under construction). */
function isComplete(tile: Tile): boolean {
  const p = tile.building.constructionProgress;
  return p === undefined || p >= 100;
}

/** Name of a building in the build menu on this map. */
function nameOf(type: string, mapId: MapId | undefined, generic: string): string {
  return buildingLabel(type, mapId, generic);
}

/** How the player raises demand for a zone (what the demand formula in calculateStats reads). */
function raiseDemandHint(zone: Zone): string {
  switch (zone) {
    case 'residential':
      return msg('Residential demand rises with more jobs than residents can fill: zone commercial or industrial land, or lower taxes.');
    case 'commercial':
      return msg('Commercial demand rises with more residents: zone homes, or lower taxes.');
    case 'industrial':
      return msg('Industrial demand rises with spare workers and shops that need goods: zone homes and shops, or lower taxes.');
  }
}

function demandOf(ctx: TileStatusContext, zone: Zone): number {
  return ctx.demand?.[zone] ?? 0;
}

// ---------------------------------------------------------------------------
// Explanations, one per kind
// ---------------------------------------------------------------------------

function entry(kind: StatusKind, cause: string, fix: string, notes: string[] = [], severity?: StatusSeverity): TileStatus {
  const def = STATUS_DEFINITIONS[kind];
  return { kind, severity: severity ?? def.severity, icon: def.icon, title: def.title, cause, fix, notes };
}

function describeFire(ctx: TileStatusContext): TileStatus {
  const b = ctx.tile.building;
  const fuel = getFireFuelFactor(b.type);
  const notes = fuel > 1.2
    ? [msg('Burns easily and spreads fast, especially downwind.')]
    : fuel < 0.7 ? [msg('Resists fire; slow to catch from neighbours.')] : [];
  const cause = msg('Burning ({stage}), {damage}% damage so far. Fire spreads to the buildings around it.', {
    stage: getBurnStageName(b.fireProgress),
    damage: Math.round(b.fireProgress),
  });
  const fix = ctx.fireCoverage > 0
    ? msg('Only a fire truck puts it out; one comes from the nearest {station}. More stations nearby reach fires sooner.', {
      station: nameOf('fire_station', ctx.mapId, 'fire station'),
    })
    : msg('Only a fire truck puts it out, and no {station} covers this spot: build one nearby.', {
      station: nameOf('fire_station', ctx.mapId, 'fire station'),
    });
  return entry('fire', cause, fix, notes);
}

function describeFlood(ctx: TileStatusContext): TileStatus {
  const { tile } = ctx;
  const chance = getFloodDamageChance(tile.building.type);
  const cause = chance <= 0
    ? msg('Under flood water. It is built to flood and takes no damage.')
    : isFloodRepairable(tile)
      ? msg('Under flood water: no power or water until the river goes down. It is repaired automatically afterwards for {share}% of its build cost.', {
        share: Math.round(FLOOD_REPAIR_SHARE * 100),
      })
      : msg('Under flood water: no power or water, nothing grows, and each day there is a {chance}% chance it is ruined and abandoned.', {
        chance: Math.round(chance * 100),
      });
  const fix = msg('Wait for the water to go down (September). Before the next monsoon, build {embankment} tiles between it and the Ganga.', {
    embankment: nameOf('embankment', ctx.mapId, 'embankment'),
  });
  // Not 'info' even when harmless: the map draws the flood icon on it, so the panel leads with it too
  return entry('flood', cause, fix, [], chance <= 0 ? 'warning' : undefined);
}

function describeDisease(ctx: TileStatusContext): TileStatus {
  const hasPeople = ctx.tile.building.population > 0 || ctx.tile.building.jobs > 0;
  const cause = hasPeople
    ? msg('This block has a disease outbreak: it loses {loss}% of its people every week, and nothing in it is built or upgraded.', {
      loss: Math.round(DISEASE_CONFIG.weeklyPopulationLoss * 100),
    })
    : msg('This block has a disease outbreak: nothing in it is built or upgraded until it ends.');
  const fix = msg('It ends {days} days after the block has {hospital}% hospital and {water}% water coverage: build a {building} and water nearby.', {
    days: DISEASE_CONFIG.cureDelayDays,
    hospital: DISEASE_CONFIG.cureHospitalCoverage,
    water: DISEASE_CONFIG.cureWaterCoverage,
    building: nameOf('hospital', ctx.mapId, 'hospital'),
  });
  return entry('disease', cause, fix, [], hasPeople ? 'critical' : 'warning');
}

function describeNoRoad(ctx: TileStatusContext): TileStatus {
  const b = ctx.tile.building;
  const cause = b.type === 'grass'
    ? msg('No road within {n} tiles through this zone, so nothing will be built on this lot.', { n: PROBLEM_ICON_CONFIG.roadAccessDistance })
    : b.type === 'informal_housing'
      ? msg('No road within {n} tiles through this zone, so it cannot become proper homes.', { n: PROBLEM_ICON_CONFIG.roadAccessDistance })
      : msg('No road within {n} tiles through this zone. New lots here will not be built on.', { n: PROBLEM_ICON_CONFIG.roadAccessDistance });
  return entry('no_road', cause, msg('Draw a road next to it, or next to the zone it is part of.'));
}

/** Output effects of a missing utility, as the simulation applies them. */
function utilityEffect(ctx: TileStatusContext): string {
  const b = ctx.tile.building;
  if (isStarter(b.type)) {
    return !b.powered && !b.watered
      ? msg('Small starter buildings work without power or water at half capacity each; with neither, nobody can live or work here.')
      : msg('Small starter buildings work without it, at half capacity.');
  }
  const days = b.unservedDays ?? 0;
  return msg('It works at reduced capacity and cannot level up. After {limit} days without power or water people may abandon it ({days} so far).', {
    limit: SIM_RULES.unservedAbandonDays,
    days,
  });
}

function describePowerCut(ctx: TileStatusContext): TileStatus {
  const pct = Math.round((ctx.powerRatio ?? 1) * 100);
  const cause = msg('The plants cover {pct}% of the city\'s power demand, so blocks take turns going dark. This block is off right now; it does not count towards abandonment.', { pct });
  const fix = msg('Build another {plant} or upgrade one.', { plant: nameOf('power_plant', ctx.mapId, 'power plant') });
  return entry('power_cut', cause, fix);
}

function describeNoPower(ctx: TileStatusContext): TileStatus {
  const cause = msg('No power plant\'s coverage reaches this tile.');
  const fix = msg('Build a {plant} close enough to cover it (the Power overlay shows coverage).', {
    plant: nameOf('power_plant', ctx.mapId, 'power plant'),
  });
  return entry('no_power', cause, fix, [utilityEffect(ctx)]);
}

function describeNoWater(ctx: TileStatusContext): TileStatus {
  const tower = nameOf('water_tower', ctx.mapId, 'water tower');
  if (ctx.waterCut) {
    const pct = Math.round((ctx.waterRatio ?? 1) * 100);
    return entry(
      'no_water',
      msg('Water supply covers {pct}% of demand, so taps run dry in turns. This block is dry right now; it does not count towards abandonment.', { pct }),
      ctx.mapId === 'varanasi'
        ? msg('Build another {tower}, or the Jal Sansthan Water Works by the Ganga.', { tower })
        : msg('Build another {tower}.', { tower })
    );
  }
  return entry(
    'no_water',
    msg('No water supply\'s coverage reaches this tile.'),
    msg('Build a {tower} close enough to cover it (the Water overlay shows coverage).', { tower }),
    [utilityEffect(ctx)]
  );
}

/**
 * Why a building is abandoned. The save does not record the cause, so this lists the simulation's abandonment
 * rules that fit the tile now, most likely first:
 *  - oversupply: zone demand below SIM_RULES.abandonBelowDemand (evolveBuilding);
 *  - more than SIM_RULES.unservedAbandonDays days without power or water (non-starter buildings);
 *  - an exodus (failure.ts: happiness critical for 12 months) abandons a share of homes every month;
 *  - flood ruin (floodSim.runFloodDay) and old-building collapse (crisisSim.runCollapseDay).
 * Recovery: a zoned abandoned building is cleared back to a zoned lot by chance while demand is above
 * SIM_RULES.clearAboveDemand (not homes during an exodus); then the lot is built on again.
 */
function describeAbandoned(ctx: TileStatusContext): TileStatus {
  const { tile } = ctx;
  const b = tile.building;
  const zone = tile.zone;
  const reasons: string[] = [];
  if (zone === 'residential' && ctx.exodusActive) {
    reasons.push(msg('People are leaving the city: happiness has been below {limit} for a year, and a share of homes is abandoned every month.', {
      limit: FAILURE_CONFIG.criticalHappiness,
    }));
  }
  if (isZone(zone) && demandOf(ctx, zone) < SIM_RULES.abandonBelowDemand) {
    const d = signed(demandOf(ctx, zone));
    reasons.push(
      zone === 'residential'
        ? msg('Residential demand is {d}: there are more homes than people want (too few jobs, or taxes too high). Below {limit}, homes are abandoned.', { d, limit: SIM_RULES.abandonBelowDemand })
        : zone === 'commercial'
          ? msg('Commercial demand is {d}: more shops and offices than the population can support. Below {limit}, businesses close.', { d, limit: SIM_RULES.abandonBelowDemand })
          : msg('Industrial demand is {d}: more factories than the city needs. Below {limit}, factories close.', { d, limit: SIM_RULES.abandonBelowDemand })
    );
  }
  if (!isStarter(b.type) && (b.unservedDays ?? 0) > SIM_RULES.unservedAbandonDays) {
    reasons.push(msg('It has had no power or water for {days} days; after {limit} days people give up.', {
      days: b.unservedDays ?? 0,
      limit: SIM_RULES.unservedAbandonDays,
    }));
  }
  if (ctx.floodRisk > 0 && getFloodDamageChance(b.type) > 0 && !isFloodRepairable(tile)) {
    reasons.push(msg('It stands in the flood zone; flood water ruins buildings.'));
  }
  if (COLLAPSE_CONFIG.zones.includes(zone) && (b.age ?? 0) > COLLAPSE_MIN_AGE) {
    reasons.push(msg('It is over {years} years old; old buildings can collapse.', { years: COLLAPSE_CONFIG.minAgeYears }));
  }
  const cause = reasons[0] ?? msg('Its people left earlier (low demand for its zone, a long power or water outage, a flood or a collapse). None of that is happening here now.');

  let fix: string;
  if (b.type === 'informal_housing' || !isZone(zone)) {
    fix = msg('It does not clear by itself. Formalise it (residential zone, road, power and water for {days} days) or bulldoze it.', {
      days: INFORMAL_CONFIG.formaliseDays,
    });
  } else if (zone === 'residential' && ctx.exodusActive) {
    fix = msg('Empty homes are not rebuilt while people are leaving. Raise happiness above {limit} (lower taxes, more services, cleaner air and Ganga) to end it.', {
      limit: FAILURE_CONFIG.criticalHappiness,
    });
  } else if (demandOf(ctx, zone) > SIM_RULES.clearAboveDemand) {
    fix = msg('Demand for its zone is {d}, so it will be cleared and rebuilt by itself soon. Bulldozing clears it now but also removes the zone.', {
      d: signed(demandOf(ctx, zone)),
    });
  } else {
    fix = msg('It is cleared and rebuilt by itself once demand for its zone is above {limit} (now {d}).', {
      limit: signed(SIM_RULES.clearAboveDemand),
      d: signed(demandOf(ctx, zone)),
    });
  }
  const notes = reasons.slice(1);
  if (isZone(zone) && !(zone === 'residential' && ctx.exodusActive) && demandOf(ctx, zone) <= SIM_RULES.clearAboveDemand && b.type !== 'informal_housing') {
    notes.push(raiseDemandHint(zone));
  }
  return entry('abandoned', cause, fix, notes);
}

function describeProblem(kind: ProblemKind, ctx: TileStatusContext): TileStatus {
  switch (kind) {
    case 'fire': return describeFire(ctx);
    case 'flood': return describeFlood(ctx);
    case 'disease': return describeDisease(ctx);
    case 'no_road': return describeNoRoad(ctx);
    case 'power_cut': return describePowerCut(ctx);
    case 'no_power': return describeNoPower(ctx);
    case 'no_water': return describeNoWater(ctx);
    case 'abandoned': return describeAbandoned(ctx);
  }
}

/** Construction: zoned buildings stop without power and water (starters excepted), and while flooded or infected. */
function describeConstruction(ctx: TileStatusContext): TileStatus | null {
  const { tile } = ctx;
  const b = tile.building;
  if (isComplete(tile) || !isProblemBuilding(tile)) return null;
  const pct = Math.round(b.constructionProgress);
  let stalled: string | null = null;
  if (tile.zone !== 'none') {
    if (ctx.flooded) stalled = msg('Building has stopped: the lot is under flood water.');
    else if (ctx.infected) stalled = msg('Building has stopped: the block has a disease outbreak.');
    else if (!isStarter(b.type)) {
      // The simulation checks supply before rolling cuts here (a cut block keeps building)
      const noPower = !b.powered && !ctx.powerCut;
      const noWater = !b.watered && !ctx.waterCut;
      if (noPower && noWater) stalled = msg('Building has stopped: it needs power and water.');
      else if (noPower) stalled = msg('Building has stopped: it needs power.');
      else if (noWater) stalled = msg('Building has stopped: it needs water.');
    }
  } else if (b.type === 'jal_sansthan_water_works') {
    if (!b.powered) stalled = msg('Building has stopped: it needs power.');
  } else if (b.type !== 'power_plant' && b.type !== 'water_tower') {
    if (!b.powered && !b.watered) stalled = msg('Building has stopped: it needs power and water.');
    else if (!b.powered) stalled = msg('Building has stopped: it needs power.');
    else if (!b.watered) stalled = msg('Building has stopped: it needs water.');
  }
  if (stalled) {
    return entry('under_construction', stalled, msg('{pct}% built. Bring the missing supply here and building carries on.', { pct }), [], 'warning');
  }
  return entry('under_construction', msg('{pct}% built. Nobody lives or works here until it is finished.', { pct }), '');
}

/** A zoned lot with nothing on it yet: what the growth loop in simulateTick is waiting for. */
function describeEmptyLot(ctx: TileStatusContext): TileStatus | null {
  const { tile } = ctx;
  const b = tile.building;
  if (tile.zone === 'none' || b.type !== 'grass' || b.fireProgress > 0 || !ctx.hasRoadAccess) return null;
  if (ctx.flooded) return entry('empty_lot', msg('Flood water covers this lot: nothing is built until it drains.'), '');
  if (ctx.infected) return entry('empty_lot', msg('This block has a disease outbreak: nothing is built until it ends.'), '');
  if (!isZone(tile.zone)) return null;
  const d = demandOf(ctx, tile.zone);
  if (d <= SIM_RULES.noGrowthAtDemand) {
    return entry(
      'empty_lot',
      msg('Demand for this zone is {d}: at {limit} or below nothing new is built.', { d: signed(d), limit: SIM_RULES.noGrowthAtDemand }),
      raiseDemandHint(tile.zone),
      [],
      'warning'
    );
  }
  const share = (d - SIM_RULES.noGrowthAtDemand) / (SIM_RULES.fullGrowthAtDemand - SIM_RULES.noGrowthAtDemand);
  const notes = !b.powered || !b.watered
    ? [msg('The first small building needs no power or water, but it will not grow bigger without both.')]
    : [];
  if (share < 0.5) {
    return entry('empty_lot', msg('Demand for this zone is low ({d}), so building here is slow.', { d: signed(d) }), raiseDemandHint(tile.zone), notes);
  }
  return entry('empty_lot', msg('Road and demand are in place: a building will go up here soon.'), '', notes);
}

function describeScorched(ctx: TileStatusContext): TileStatus | null {
  const b = ctx.tile.building;
  if (b.type !== 'grass' || b.onFire || !(b.fireProgress > 0)) return null;
  const days = Math.max(1, Math.ceil(b.fireProgress / (SCORCH_TICKS / 2)));
  return entry('scorched', msg('Burnt out by a fire. Nothing is built here for about {days} more days.', { days }), '');
}

function describeInformal(ctx: TileStatusContext): TileStatus | null {
  const { tile } = ctx;
  const b = tile.building;
  if (b.type !== 'informal_housing' || b.abandoned) return null;
  const cause = msg('Families built these homes themselves: they pay no tax, have more crime and catch fire more easily.');
  const zoned = tile.zone === 'residential';
  const missing = !zoned || !ctx.hasRoadAccess || !b.powered || !b.watered;
  const fix = msg('Zone it residential and give it road access, power and water for {days} days in a row to turn it into proper homes.', {
    days: INFORMAL_CONFIG.formaliseDays,
  });
  const notes: string[] = [];
  if (ctx.formaliseDays > 0 && !missing) {
    notes.push(msg('Proper homes in {left} days ({done}/{total}).', {
      left: INFORMAL_CONFIG.formaliseDays - ctx.formaliseDays,
      done: ctx.formaliseDays,
      total: INFORMAL_CONFIG.formaliseDays,
    }));
  } else {
    if (!zoned) notes.push(msg('Still needs: residential zoning.'));
    else if (!ctx.hasRoadAccess) notes.push(msg('Still needs: road access.'));
    if (!b.powered) notes.push(msg('Still needs: power.'));
    if (!b.watered) notes.push(msg('Still needs: water.'));
  }
  return entry('informal', cause, fix, notes);
}

function describeExodus(ctx: TileStatusContext): TileStatus | null {
  const { tile } = ctx;
  const b = tile.building;
  if (!ctx.exodusActive || tile.zone !== 'residential' || b.abandoned || b.type === 'grass' || b.type === 'empty') return null;
  return entry(
    'exodus',
    msg('Happiness has been below {limit} for a year: every month a share of the city\'s homes is abandoned, and empty homes are not rebuilt.', {
      limit: FAILURE_CONFIG.criticalHappiness,
    }),
    msg('Raise happiness above {limit}: lower taxes, more services, cleaner air and Ganga.', { limit: FAILURE_CONFIG.criticalHappiness })
  );
}

function describeCollapseRisk(ctx: TileStatusContext): TileStatus | null {
  const { tile } = ctx;
  const b = tile.building;
  if (isLandmarkType(b.type)) return null;
  if (!isCollapseEligible({ zone: tile.zone, age: b.age ?? 0, abandoned: !!b.abandoned, constructionComplete: isComplete(tile) })) return null;
  const cause = msg('Over {years} years old: it can collapse, most often in the monsoon and after a flood.', { years: COLLAPSE_CONFIG.minAgeYears });
  const station = nameOf('fire_station', ctx.mapId, 'fire station');
  const fix = ctx.fireCoverage > 0
    ? msg('A {station} covers it, which cuts the risk by {cut}%.', { station, cut: Math.round((1 - COLLAPSE_CONFIG.protectionMultiplier) * 100) })
    : msg('Put it in reach of a {station}: inspections cut the risk by {cut}%.', { station, cut: Math.round((1 - COLLAPSE_CONFIG.protectionMultiplier) * 100) });
  return entry('collapse_risk', cause, fix);
}

function describeFloodRisk(ctx: TileStatusContext): TileStatus | null {
  const { tile } = ctx;
  if (ctx.flooded || ctx.floodRisk <= 0 || !isProblemBuilding(tile)) return null;
  const type = tile.building.type;
  if (FLOOD_CONFIG.damageImmuneTypes.includes(type) || type.startsWith('landmark_')) return null;
  const monsoons = getMonsoonsThatFlood(ctx.floodRisk).join(' / ');
  const cause = isFloodRepairable(tile)
    ? msg('The Ganga reaches it in {monsoons} monsoons (July to September): it goes offline while flooded and is repaired afterwards for {share}% of its cost.', {
      monsoons,
      share: Math.round(FLOOD_REPAIR_SHARE * 100),
    })
    : msg('The Ganga reaches it in {monsoons} monsoons (July to September): flooded buildings lose power and water and can be ruined.', { monsoons });
  return entry('flood_risk', cause, msg('Build {embankment} tiles between it and the river.', {
    embankment: nameOf('embankment', ctx.mapId, 'embankment'),
  }));
}

function describePollution(ctx: TileStatusContext): TileStatus | null {
  const { tile } = ctx;
  if (tile.zone !== 'residential' || tile.pollution <= 50 || tile.building.type === 'grass' || tile.building.abandoned) return null;
  return entry(
    'pollution',
    msg('The air here is {pct}% polluted by factories, power plants or roads nearby. Pollution lowers the city\'s environment rating.', {
      pct: Math.min(100, Math.round(tile.pollution)),
    }),
    STATUS_DEFINITIONS.pollution.advice
  );
}

/**
 * Every status of the tile, most severe first. Contains the kind of the icon the map draws on this tile
 * (and it comes first unless the tile is in an infected block), plus states without icons.
 */
export function getTileStatuses(ctx: TileStatusContext): TileStatus[] {
  const problems = listTileProblems(ctx);
  const out: TileStatus[] = [];
  for (const kind of problems) {
    // Flood water cuts power and water itself: the flood entry says so, separate utility entries would mislead
    if (ctx.flooded && problems[0] !== kind && (kind === 'no_power' || kind === 'power_cut' || kind === 'no_water')) continue;
    out.push(describeProblem(kind, ctx));
  }
  // Infected blocks get one badge per block (drawn even over empty lots): explain it on every tile of the block,
  // so clicking the block badge (which can land on any tile) explains it
  if (ctx.infected && !problems.includes('disease')) {
    out.push(describeDisease(ctx));
  }
  for (const extra of [
    describeExodus(ctx),
    describeConstruction(ctx),
    describeEmptyLot(ctx),
    describeScorched(ctx),
    describeInformal(ctx),
    describeCollapseRisk(ctx),
    describeFloodRisk(ctx),
    describePollution(ctx),
  ]) {
    if (extra) out.push(extra);
  }
  // Stable: same severity keeps the icon priority order
  return out
    .map((s, i) => ({ s, i }))
    .sort((a, b) => SEVERITY_RANK[a.s.severity] - SEVERITY_RANK[b.s.severity] || a.i - b.i)
    .map(({ s }) => s);
}

/** Fields of GameState the statuses read. */
export type TileStatusState = Pick<
  GameState,
  | 'grid' | 'gridSize' | 'mapId' | 'riverLevel' | 'structureVersion' | 'id' | 'outbreaks' | 'stats' | 'disastersEnabled'
  | 'services' | 'failure' | 'informal'
>;

/** The context for tile (x, y) of a state, read the same way the icon layer reads it (computeProblemIconsForState). */
export function getTileStatusContext(
  state: TileStatusState,
  x: number,
  y: number,
  /** Precomputed road access mask (computeRoadAccessMask); otherwise the one tile is checked. */
  roadAccess?: Uint8Array | null
): TileStatusContext {
  const size = state.gridSize;
  const i = y * size + x;
  const tile = state.grid[y][x];
  const crisesOn = state.disastersEnabled !== false;
  const floodMask = crisesOn ? getCityFloodMask(state) : null;
  const outbreakMask = crisesOn ? getOutbreakMask(state.outbreaks, size) : null;
  const floodRisk = crisesOn ? getCityFloodRisk(state)?.[i] ?? 0 : 0;
  const feeder = getFeederIndex(x, y, size);
  return {
    tile,
    mapId: state.mapId,
    flooded: floodMask ? floodMask[i] === 1 : false,
    infected: outbreakMask ? outbreakMask[i] === 1 : false,
    hasRoadAccess: roadAccess ? roadAccess[i] === 1 : hasTileRoadAccess(state.grid, size, x, y),
    powerCut: (state.stats.power?.cut ?? []).includes(feeder),
    waterCut: (state.stats.water?.cut ?? []).includes(feeder),
    floodRisk,
    demand: state.stats.demand,
    exodusActive: !!state.failure?.exodusActive,
    fireCoverage: state.services?.fire?.[y]?.[x] ?? 0,
    powerRatio: state.stats.power?.ratio,
    waterRatio: state.stats.water?.ratio,
    formaliseDays: state.informal?.formaliseDays[String(i)] ?? 0,
  };
}

/** Statuses of tile (x, y) in a state. */
export function getTileStatusesForState(state: TileStatusState, x: number, y: number, roadAccess?: Uint8Array | null): TileStatus[] {
  return getTileStatuses(getTileStatusContext(state, x, y, roadAccess));
}
