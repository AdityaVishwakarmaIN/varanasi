/**
 * S1-T5: the optimised simulation must give exactly the same results as before.
 *
 * `simulateTick` uses Math.random internally, so every run below replaces Math.random with a seeded
 * generator. Two kinds of checks:
 *
 * 1. Cache on vs off: the same scenario run with the service-coverage cache enabled and disabled
 *    must produce identical states.
 * 2. Golden master: a fingerprint (SHA-256 of a canonical JSON dump of the whole state) of each
 *    scenario was recorded with the ORIGINAL, unoptimised `simulateTick` (commit 243c14d). The
 *    optimised code must reproduce it bit for bit. If you change simulation behaviour on purpose,
 *    re-record with `PRINT_SIM_FINGERPRINTS=1 npx vitest run src/lib/__tests__/simulateTick.test.ts`.
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '@/lib/rng';
import { setMixedUseEnabled } from '@/lib/mixedUse';
import {
  bulldozeTile,
  generateRandomAdvancedCity,
  placeBuilding,
  setInformalSettlementsEnabled,
  setSeasonalEffectsEnabled,
  setFloodsEnabled,
  setCrisesEnabled,
  setFailureStatesEnabled,
  setFestivalsEnabled,
  setLandmarkUnlocksEnabled,
  setServiceCoverageCacheEnabled,
  setUtilityCapacityEnabled,
  simulateTick,
  upgradeServiceBuilding,
} from '@/lib/simulation';
import type { CloudWeatherMode } from '@/components/game/types';
import type { GameState, Tile } from '@/types/game';

/**
 * Fields added AFTER the goldens were recorded (new features, not behaviour changes). They are left out of the
 * fingerprint so the goldens keep proving that pre-existing behaviour is unchanged.
 * - `mapId` (S2-T2), `taxIncome` (S2-T9), `informal` (S3-T9: bulldoze records)
 * - `stats.power` / `stats.water` (S3-T7/T8). Only under `stats`: `services.power` / `services.water` are old.
 */
const FIELDS_ADDED_AFTER_GOLDENS = new Set(['mapId', 'taxIncome', 'informal']);
const STATS_FIELDS_ADDED_AFTER_GOLDENS = new Set(['power', 'water']);

/** Canonical JSON: sorted keys, `undefined` dropped, random ids removed. */
function canonical(value: unknown): string {
  return JSON.stringify(value, function replacer(key, v) {
    if (key === 'id' || FIELDS_ADDED_AFTER_GOLDENS.has(key)) return undefined;
    // Water-body and neighbouring-city names are cosmetic (they come from lists in names.ts), so they stay out of the fingerprint.
    if (key === 'name' && this && ('tiles' in this || 'direction' in this)) return undefined;
    if (key === 'stats' && v && typeof v === 'object') {
      const stats = { ...(v as Record<string, unknown>) };
      for (const k of STATS_FIELDS_ADDED_AFTER_GOLDENS) delete stats[k];
      v = stats;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) sorted[k] = (v as Record<string, unknown>)[k];
      return sorted;
    }
    return v;
  });
}

function fingerprint(state: GameState): string {
  return createHash('sha256').update(canonical(state)).digest('hex').slice(0, 16);
}

type Scenario = {
  name: string;
  size: number;
  ticks: number;
  weather: CloudWeatherMode;
  /** Changes the generated city before ticking, to exercise specific code paths. */
  prepare?: (state: GameState) => void;
  /** Player actions between ticks (runs before tick number `tick`, counting from 0). */
  between?: (state: GameState, tick: number) => GameState;
};

/** First tile (row-major) whose building type is `type`, or null. */
function findTile(state: GameState, type: string): Tile | null {
  for (const row of state.grid) for (const tile of row) if (tile.building.type === type) return tile;
  return null;
}

function blankBuilding(): Tile['building'] {
  return {
    type: 'grass',
    level: 0,
    population: 0,
    jobs: 0,
    powered: false,
    watered: false,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
  };
}

const SCENARIOS: Scenario[] = [
  { name: 'advanced 60, clear', size: 60, ticks: 20, weather: 'clear' },
  { name: 'advanced 60, severe storm (tree growth, more fires)', size: 60, ticks: 20, weather: 'severe_storm' },
  {
    name: 'advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)',
    size: 60,
    ticks: 40,
    weather: 'light_clouds',
    prepare: (state) => {
      state.stats.demand = { residential: 100, commercial: 100, industrial: 100 };
      let n = 0;
      for (const row of state.grid) {
        for (const tile of row) {
          n++;
          if (tile.zone !== 'none' && n % 5 === 0) tile.building = blankBuilding();
          else if (tile.zone !== 'none' && n % 7 === 0 && tile.building.type !== 'empty') {
            tile.building = { ...tile.building, age: 40, constructionProgress: n % 2 ? 100 : 30 };
          } else if (n % 97 === 0 && tile.building.type !== 'grass' && tile.building.type !== 'water') {
            tile.building = { ...tile.building, onFire: true, fireProgress: 90 };
          } else if (tile.zone === 'none' && n % 53 === 0 && tile.building.type !== 'water' && tile.building.type !== 'road') {
            // Unfinished non-zoned building (service/park) so construction progresses inside the tick
            tile.building = { ...tile.building, constructionProgress: 20 };
          }
        }
      }
    },
  },
  {
    name: 'advanced 60, oversupply (abandonment and clearing)',
    size: 60,
    ticks: 60,
    weather: 'clear',
    prepare: (state) => {
      state.stats.demand = { residential: -100, commercial: -100, industrial: -100 };
      for (const row of state.grid) for (const tile of row) {
        if (tile.zone !== 'none') tile.building = { ...tile.building, age: 50 };
      }
    },
  },
  {
    name: 'advanced 60, recovery (abandoned buildings with demand)',
    size: 60,
    ticks: 30,
    weather: 'clear',
    prepare: (state) => {
      state.stats.demand = { residential: 80, commercial: 80, industrial: 80 };
      let n = 0;
      for (const row of state.grid) for (const tile of row) {
        if (tile.zone !== 'none' && tile.building.type !== 'empty' && tile.building.type !== 'grass' && n++ % 2 === 0) {
          tile.building = { ...tile.building, abandoned: true };
        }
      }
    },
  },
  {
    name: 'advanced 60, disasters off, storm',
    size: 60,
    ticks: 20,
    weather: 'storm',
    prepare: (state) => {
      state.disastersEnabled = false;
    },
  },
  {
    name: 'advanced 60, player changes service buildings between ticks (coverage cache invalidation)',
    size: 60,
    ticks: 24,
    weather: 'clear',
    between: (state, tick) => {
      if (tick === 4) {
        // Upgrade a service building: range grows, coverage must change
        for (const type of ['police_station', 'fire_station', 'hospital', 'school', 'water_tower']) {
          const tile = findTile(state, type);
          const upgraded = tile && upgradeServiceBuilding(state, tile.x, tile.y);
          if (upgraded) return upgraded;
        }
      }
      if (tick === 8) {
        // Remove a power plant: power coverage must shrink
        const plant = findTile(state, 'power_plant');
        if (plant) return bulldozeTile(state, plant.x, plant.y);
      }
      if (tick === 12) {
        // Build a new police station on the first free grass tile: under construction, then active
        for (const row of state.grid) for (const tile of row) {
          if (tile.building.type === 'grass' && tile.zone === 'none') {
            return placeBuilding(state, tile.x, tile.y, 'police_station', null);
          }
        }
      }
      return state;
    },
  },
  { name: 'benchmark 160, clear', size: 160, ticks: 4, weather: 'clear' },
];


/**
 * Golden fingerprints recorded with the original simulateTick (commit 243c14d, before S1-T5). Re-recorded once when the
 * name lists in names.ts became Indian: names are now left out of the fingerprint (cosmetic), and 7 of 8 scenarios
 * matched the old code exactly; the 'recovery' one drew a different random sequence from a name collision.
 * Re-recorded for the economy balance pass (building upkeep, ratio-based industrial demand, mansion population).
 * Key = scenario name. Value = the state fingerprint after every tick, joined by ','.
 */
const GOLDEN: Record<string, string> = {
  "advanced 60, clear": '7f60598a3af4921b,7ccf80008443b909,3057e4aa23d2d5df,317605d9742a8424,134fb5b56b6181e2,556aa0089752d17a,16110987c80a1abb,b239a2c86c1ede5f,3099ea1f557dbf39,a73faa403efa11cf,bdde89945b6782b4,f1f0f24eb3b20fc4,a9612339066f991a,7c3826025a560398,4d81861965425018,436b508a2cab9c84,d409c316e1ab39fe,03778ab6a51f039f,1880619c1f37368e,1f94df9091b2edc9',
  "advanced 60, severe storm (tree growth, more fires)": '33dc2a69166ff189,e0c989bbc4b8bc34,adba229862af3109,bdb74f8c2307f0a0,7ea53f8fb2de2029,99c085dcd3ae9c35,73c6940d457b0a57,7de9173de6b3c577,3b799f6a0be956a1,8099d765d5472794,8713c0539c7065cd,314922bd9d006422,f64b360f75b329d3,f14a69192e0e2553,a299422e6d0f75af,e93fc27df6a9b9c3,4fca61d3770e6f58,0496cf44f328926c,3be0aa41d48afae5,492ba1515b8e61e2',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": '3e7e762b7070f748,410c32048723022e,52f9a9cbeab629ea,6d425678f4b9390a,29f733cd3f77a0ef,67b2c8079f529bca,954d5a2188edea9f,35bf1e4079437deb,cde25ffbeeb29a79,6c525b38a79bf30f,a40eeb09fee34616,cd62a8f72eb5851f,19e4bcb989e59fd7,74f6b49a7f8535ba,79caf4d7ff886ee9,efe80133f66e6057,e02c339979468a36,5bbec5d6eb7d32d9,3b37632dfc3d44e2,8caecb33053ba6e9,0d21923125cad000,2d1bdfc9da3c2d3b,663d0062ef834efb,138544bb58f468cc,42f6245bb65b2310,e21fb10d36394467,a236e46a2bbe7610,e3067f523f7d00a0,fa7bc9991f4d505b,ea21d38a9605bea1,0fa40bfa806b78c2,34a675f98c04b017,301c4e43aad9c4de,3ab8b4e0a17ad423,14aad2209401ad11,1d937f8ed768a872,a9d147093416643c,6dc92ff266709c14,080f799139af93e5,db07593939b2284b',
  "advanced 60, oversupply (abandonment and clearing)": '64bfd4734f6a7f3b,0a03eb3ced857da9,3bca737699e396a2,1dec73e33b0508be,b6aef87baaa8e6c7,3e281293cb63d09b,70c3ea0314c76444,4953d173ff613df2,c4130569378e3d78,98fef67da70be72f,61ab2a2be0f274e4,def628675e020c16,457fe633752fa63f,4324de4caca2d1e8,39a37a0b2e001b97,4247d83887573f34,93c704b0a3a3becc,0a82f1ba44a4d019,8fddba09d5dd4c79,512cea9f4722109d,feb27c54031ae029,92b12b88bf113509,5263d304b848f6c5,615af6c24398f143,171d703510fdc42f,36659bd4f6b23a60,0cbecea40bbf93e1,c4575244f62ef3ea,dccbb388a2bfeaff,28f08090ebcb5b23,1fcc1add8d665c7b,dd9d2bc7a5a1e795,58415757962b7a40,ddedb42c0f5aa2b4,bf74729146f1e2f4,a8f89c8cf980d8c9,5b41f2deef97c327,84bdb6d72ac3f80d,2c8e512758934e10,feed500917892c85,0fa20dbba1f2f5b8,06feff21f94ddfb4,5562ff84bd315fad,8a19938eaaf4fa6f,08e62caffd97af0a,e0d7fcebf05887c1,9e930a9f1865aaa9,ec85dbf0ca74dfca,63a87ab016c8b0d1,d3db16622a4c30ef,6487714517d36f13,2eb163bc16a78ac1,38e2e17e093147d8,f7e8ca97e0e1f10c,51e47174f2f970f4,b0ebcb643d750955,910de039b4ae78e7,a1941a08afc84f60,9512a5bb05a692f8,3d030046ce6ee369',
  "advanced 60, recovery (abandoned buildings with demand)": '26db31792eed030c,cc2dd355be63dd1c,7c5977801a51d6f2,d0a670ba022ddfee,d6dbbafd41434d5c,59c04baf72f87768,04f0b68fb6cba6f8,1a31c02a877d5aba,6711bcde6b066bb0,41b2b3efe21269f7,f6053c37971e215f,a41c359c6ac55ed5,327f72108d6c4caf,2c69b7a5e5b0d98e,bfd3df74afcccd9c,7524f80b5a51e368,ecdb782993fb06d0,955d201d5cd453d8,b25150780e2142ab,7faefb70aca147a2,0997f126f88b0c15,cd0ea3f0a0099455,bf1946493c9e1170,84c4689520edc1b5,d60363f300115997,9ad5300d02eb9eda,7fe74117ac054e39,6ee2ceeb991a8188,6b3ca4e8efc35241,e4352d930046c99c',
  "advanced 60, disasters off, storm": 'e7cda8af8dacab16,d7dfd627d89f08d5,502cca1d98c1112a,96cfbb3d7e1f6613,3917415d0770d2e6,198fb0b1736ebed1,cca76b70ceba2ebc,bbac81e18fc4d939,ccf353352ae68ecf,47399a57fd6fe9c8,00502bca3d17cd34,4961dec191a018d8,36f54ccf546aa137,d3866fc1d213b85b,6b62047842ddffba,bedc3a370bd084d7,7f8966145442bddf,1e2aa3b440332b12,c2165dd311ed4e98,3724678e24b691d6',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": '147deace3202c161,83b4954756780190,7a8b4febc44b0a9d,fb3c6e8481131732,469f065c7821e551,c838fb83c0ee1935,968d8bd6d122fa61,1d977bd82c501310,a16d71453cad3d3c,c3576c053cc302d6,3ca4a21079d2223f,31cd8def2ee10909,fe4bc1e4d646068f,8e039877c4dd9d4e,e4d7f17ba5cafb64,e7284cc4809a0ac9,79472d7754862a0a,d3959fd9856a6a87,4bb532a764a9662c,75f1e17d046d1a99,d115c5ff4bfde46b,9f4efb302863b7b4,0e326b0b0e88616d,772b0fe7ff9870ca',
  "benchmark 160, clear": 'd05060c5309ef422,e7cbd12690c32284,fde458b2fc0aef27,9ae63dde23202d6e',
};

function runScenario(scenario: Scenario, seed: number): { final: GameState; perTick: string[] } {
  const random = createRng(seed);
  const spy = vi.spyOn(Math, 'random').mockImplementation(random);
  try {
    let state = generateRandomAdvancedCity(scenario.size, 'Test', createRng(seed));
    scenario.prepare?.(state);
    const perTick: string[] = [];
    for (let i = 0; i < scenario.ticks; i++) {
      if (scenario.between) state = scenario.between(state, i);
      state = simulateTick(state, scenario.weather);
      perTick.push(fingerprint(state));
    }
    return { final: state, perTick };
  } finally {
    spy.mockRestore();
  }
}

// The goldens predate power/water capacity (S3-T7/T8), informal settlements (S3-T9) and seasonal effects (S4-T3);
// those are tested in utilityCuts.test.ts and informalSim.test.ts.
beforeEach(() => {
  setUtilityCapacityEnabled(false);
  setInformalSettlementsEnabled(false);
  setSeasonalEffectsEnabled(false);
  setFloodsEnabled(false);
  setCrisesEnabled(false);
  setFailureStatesEnabled(false);
  setFestivalsEnabled(false);
  setLandmarkUnlocksEnabled(false);
  setMixedUseEnabled(false);
});

afterEach(() => {
  setServiceCoverageCacheEnabled(true);
  setUtilityCapacityEnabled(true);
  setInformalSettlementsEnabled(true);
  setSeasonalEffectsEnabled(true);
  setFloodsEnabled(true);
  setCrisesEnabled(true);
  setFailureStatesEnabled(true);
  setFestivalsEnabled(true);
  setLandmarkUnlocksEnabled(true);
  setMixedUseEnabled(true);
});

describe('simulateTick equivalence', () => {
  it('seeded 60x60 city: 20 ticks give identical results with and without the coverage cache', () => {
    setServiceCoverageCacheEnabled(false);
    const without = runScenario(SCENARIOS[0], 1234);
    setServiceCoverageCacheEnabled(true);
    const withCache = runScenario(SCENARIOS[0], 1234);

    expect(withCache.final.stats).toEqual(without.final.stats);
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        const a = withCache.final.grid[y][x].building;
        const b = without.final.grid[y][x].building;
        expect(a.type).toBe(b.type);
        expect(a.powered).toBe(b.powered);
        expect(a.watered).toBe(b.watered);
      }
    }
    expect(withCache.perTick).toEqual(without.perTick);
  });

  it.each(SCENARIOS.map((s, i) => [s.name, i] as const))(
    'matches the pre-optimisation golden fingerprints: %s',
    (_name, index) => {
      const scenario = SCENARIOS[index];
      const run = runScenario(scenario, 1000 + index);
      if (process.env.PRINT_SIM_FINGERPRINTS) {
        console.log(`GOLDEN ${JSON.stringify(scenario.name)}: '${run.perTick.join(',')}',`);
        return;
      }
      expect(run.perTick.join(',')).toBe(GOLDEN[scenario.name]);
    },
    60_000
  );

  it('does not mutate the state it is given', () => {
    for (const scenario of SCENARIOS.slice(0, 5)) {
      const random = createRng(77);
      const spy = vi.spyOn(Math, 'random').mockImplementation(random);
      try {
        let state = generateRandomAdvancedCity(scenario.size, 'Test', createRng(77));
        scenario.prepare?.(state);
        for (let i = 0; i < 10; i++) {
          const before = canonical(state);
          const next = simulateTick(state, scenario.weather);
          expect(canonical(state)).toBe(before);
          state = next;
        }
      } finally {
        spy.mockRestore();
      }
    }
  }, 60_000);
});
