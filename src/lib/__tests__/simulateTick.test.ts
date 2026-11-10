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
    // Notification timestamps are wall-clock time (fire notifications are the first to appear in these runs).
    if (key === 'id' || (key === 'timestamp' && this && 'title' in this) || FIELDS_ADDED_AFTER_GOLDENS.has(key)) return undefined;
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
 * Re-recorded again for the environment fix: tile pollution now settles at about the building stat (it used to settle
 * at 20x it) and land value now follows nearby buildings. Both re-recordings are intended changes to the values.
 * Re-recorded for Team Ember's fire model (fuel, wind, burn stages, scorched lots, funding-scaled coverage): intended change.
 * Re-recorded for the fire notice text (first letter capitalised at sentence start): description text is in the fingerprint.
 * Key = scenario name. Value = the state fingerprint after every tick, joined by ','.
 */
const GOLDEN: Record<string, string> = {
  "advanced 60, clear": 'f5b4e70fb68604dc,f0a98cd6dfbb59d1,8cd90ddc314847bf,b44fe8b3c556f384,36144a08269e121f,0dea0e5bfccad903,b76914c484be98a6,45dabcd8e6357025,3eb9576879c83a63,cd595f80177d29f8,bb7dce12bc85a4a8,02c909b3195dcc22,7bd8b3106ba31ac4,bf4399ba58110b59,17b4f93bbf3a7caf,20bf30c5c835181e,f51600596c4c927e,429504becc241317,7e3058d191466026,b4595876ff929ce5',
  "advanced 60, disasters off, storm": 'cfaa8b2f2c24a123,ea22dcf51d46b7c7,6450c1e99f061118,c6eb7c24bfd0581e,23bafcc3294b3eff,bcf291db4e16b0fe,65562d722ba810d3,a1331e83d1ee9f34,0a15156ef7ccbe26,dd996f029ac6ad5b,2f742dc6ff3afd22,beba772ced3a0356,88e1e14591d6e1b1,661368ad39794d7e,fd258a0396633d34,95e8f3062054e39f,d0a2bc07b6d3048d,cbcfd86c1184be48,2d331253423e9e7f,ab463e333a7685fb',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": '6f438d11e7172809,1b5ffedde0e29304,45fccbd38c417d54,13061f82042cf389,874a99cf2dce9313,d5d03085f89744c2,eec09b4645f3954f,c5ebc87576234ef6,e14c95abf5907af4,d0c7c5b53418ad35,7e5219311b5af755,3fee3238668a85f5,fc2d78636b7c06fe,5ecec3c9eff6b3c6,1c2a74da1852305d,e5cf06d23a241c7f,c0e7929348f44f56,b26d52aeb971b814,3ede5972b587285e,e8420899f4176426,0c26fdc8c79bbb09,e15c4edfb70a7c76,3b2e4553725a7308,d17a68027547904f,40f4569011e93a3b,473ef920034d12d6,4f4b50d0d8c94552,762e176b8f81e4c7,07ea52278b3bab52,23bec9df66d888db,4a58f89347c6d125,580ddbfbbebb95b5,25ceddd0a3cd4400,837dd2f7b32c5ea6,33ffa40475d58e5b,4186ec3da290fd79,7cf9886b1094a4c3,a0b4c92d0fb917ed,89c9530eb690fcca,abb1ccba0aac1487',
  "advanced 60, oversupply (abandonment and clearing)": '8a29ceda647f4fed,2422ba8b1a970dc5,e1a2489e8211669b,2ecbe5b3e3fe8a0b,9e066a01c46ba712,7c169df1cfd5c1b6,9292297eda32841b,d5fdf4adf7955dc6,3f5a2addab19b043,8d041c8a811a6b26,43e8b8b8d695a9ec,ca317fd96c491bca,5cf1de4e8a01f78d,275f7260f5416b78,e7f4d324b8f97a66,6c1823cab4ecfa22,93cd393275bb5c30,8700409ffffbaae2,97d7512a886e1faa,30d2d46e2bac6ee0,4deb1a6718b6ac2d,417ace7df8a2c0a9,1cae6e42c40f6fc9,932c17bf6dea1b6a,f9616ce4ba49337c,5725115102532768,c3eb1c64415a6288,9efe9127acf18bea,7e05f93741525b56,12cb93da9beca4c2,0ee6e663fcf1947a,69deb840bb7bb10f,85c9bceb15660f9f,a0ca2caf0d272820,c9df70ae848f638c,475011e56a3ea36d,2a1180023e275576,662115f7c773f290,b9846d28fbdbef1d,3b471e592f52445a,794b68a568336120,0681e3f5d04d08c0,53c400c47d63f906,30061bf81b6bab4a,3918d8148e137c64,cebe4cf2b7415f06,ea1619a1806e877f,30963d4533eb8f49,bf70589cc8c6789e,0a4e1ed6d160dfa6,8cf60176869c1f0b,d8d410617f15e4a2,f9cbf5a4bd7be980,138a65a64a6c61d6,bbd49e30348758db,c991f6431c135ff5,83f2fba372aff863,e94049bedd008937,46982ba0e46db0fa,7d5d102a368ca373',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": '6906ec54842e83cb,cd988567f2631e08,abb11558fe96f0de,6576be808d319bbf,dd76ebad46dbc4ee,d59ea9e7acb63cfd,98e4756357be15e0,8e7e7548b00689e3,71b56bbf4e9f1d9a,bcb6a6645d51fdb8,b782166bd21ce66b,cbeb95fdb7b99941,a4274983530e6d45,02526756acfe36cd,9a551c59503eaf17,043a6bc0e67d4189,f5e6590deb775798,6fc17bf0d03603d3,c2aa3721f8b57a73,8bf8d004cc32ae5a,cb44b998dfd22778,c60cd933690035f4,213c2c55b314e28b,7b0f4d1030146b64',
  "advanced 60, recovery (abandoned buildings with demand)": '83780f0052d3e89c,c52d768784c3a788,28ce0eb9af6b171b,5f70544afa96df6b,8aad348b9846a14b,538a257294e03bef,861771de222605cb,1ca01f320e860853,56eb7c0a02738795,778306f838942c88,a2b26eea94fdf922,78ba4758b119040f,8f085a3f685d0c83,040c55af3e58a354,1f38244881b2fbe4,7ef2e01cb4c0376c,3012cd4d3e0d0563,ba64dc1b2ecdea31,38cc697e8e004a14,e8fd039645ed9a64,e95dc0c6e1ec6313,218a74dda1d63f1a,392c2bb34501bf8b,d27797ac26a1e4b9,9a488ea13cd5937b,ea6112289d3f18c0,5b1c7c47631fabb1,8256085113e8e0e9,a1dd59a625c824ba,8818b71539ad67f1',
  "advanced 60, severe storm (tree growth, more fires)": 'd55d29d3469ea3d0,0fca480846c5f5d6,35664bd5675e78b4,41ed36e4bb6747de,5040524d6b4ce95d,6c7d477a6a2efb47,04434b83da940803,16051fbedf3f2161,5065ec330cd0ecf3,b043924c097e7f22,a879e005602f96a1,19a4bbf1564eb669,66ff37d4ca2a0408,5dd3838dcca4e307,e4cbe2684bbecdd0,e4add92f617e5765,29d7835bfe919e85,72fa2bda35f2572e,f641d7ed2631899f,5a6b7cf06e2e57d7',
  "benchmark 160, clear": '298c4638ff538786,df8a9936cd29cf11,f4f3e3a3855fdfb0,c08834d65cc82ee1',
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
  }, 60_000);

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
