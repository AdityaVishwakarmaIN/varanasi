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
// lastUpgradeDay records collapse counterplay; the collapse system is disabled in these scenarios.
const FIELDS_ADDED_AFTER_GOLDENS = new Set(['mapId', 'taxIncome', 'informal', 'lastUpgradeDay']);
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
 * Re-recorded for developed-building road access: disconnection now reduces output and blocks upgrades.
 * Key = scenario name. Value = the state fingerprint after every tick, joined by ','.
 */
const GOLDEN: Record<string, string> = {
  "advanced 60, clear": '9abcb6b0054360e7,d203a04ae90c2704,b0b4d86c631518d5,e874d72a3272154b,57f38a7e74c1ae49,05fbfeb94a74567a,519da4fd46e15aa8,25d7bd96818d28df,ecd4fa959a6225de,687152985e841c7d,f97df05cf7dee811,dc5726ecd54566bd,a64e94fb0b1efded,f9fc9c05b022752b,297aa935f404ce69,fc214ac1433e83e1,63aa4f312e800886,a6e0ac53fdc5a481,f7963b4a0041d9c9,921be0c325dd1e8d',
  "advanced 60, disasters off, storm": '05a550d9dcf33ef9,1d4d722a5bf552f7,2b88685a561ffe3f,03b79e83abd16058,3641aae0ee47531a,51bd75ef631ca798,945e39219785157b,7adf4ceff878ee6f,6b81bbd5622a73a8,a97d524098dc4e44,ebb640bd1f3cd5a9,da3471bc56fecff0,a18f0d3358550372,accac1bb252a793a,48e5fcfc22f28a0c,f5493a82a9e17aeb,9580c3de11096d0c,68f77bf4e3fd5346,846ca1d40549d077,862c2ad933b11dc3',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": '979ddc9f054326a8,7d656a2c4ea4c77f,09aa2d50bf2deec0,713d50bc94fb300a,957877ca5d5f2c16,4d486a5350dc2b2e,7fb1dcf53f2ba5c0,1695efc07f668886,6170beef45996bb5,0ebf26ccb4b30f79,f200bd6dd72850af,75729292b79cc6ce,4994fb75964d1f97,e229b8d76b1a182a,aef1b87b346a3029,ed61f6c86abc770a,c7acf4ffe98b4545,883cb9a0ed7e20b2,3fd2e3213d532515,4e516c018c94c684,18931fa2995ce5db,f471ef4e914d9beb,34f05516508d9166,e709e344cbb27f0f,aa8b3691e7ca3f32,81b94725f8232081,ff47a5387dff0435,d1dcf109ba2dd365,723b516772eeabff,683e0d33fbfc27cf,19ee962cab1b5093,bd722410815f2a26,af308cf97fc47ec9,697a7314ca6290d7,7aea7a02045cfd4b,3768c5b81595a09b,72f3dd6479f7eb93,f9eeb6cb5f5580e9,d8c0d87d0699feaf,a41554511d0215a9',
  "advanced 60, oversupply (abandonment and clearing)": '93b189cb6844b0d2,b63f094629399e24,cdce55af44be3cf5,d7bef86c0bdcff2c,ecd2d98c77c81624,e069ec68c89a52a0,3145327e7f5477b9,4bb80254588738a7,74b404080404a569,2266266eb7038c4e,852f7eaa3a9643e1,89a09ff3b643f250,275f6fe15a3b3591,d921ca2e9645adf7,fd62b4a0aae7f210,be302b6cdf985bee,b966faa09d0bf32d,43c940e2a8b7bff5,52d94e001562d7d7,754c80ae74fc7e17,064d799d3f5a9516,65d34fb88af6cd9d,ae50ac2cda92ad2b,3712bcb079c02647,a4d0ec9ad18a53c7,c3445929ffd6ba6f,f61e894d0a341009,5893dfb03f05a1b2,22125401d8a4e2ca,db779a398bf4c56c,6debb1e8c5e83ec5,05736065de66cc52,f73b84d7b89095f1,e10df2138c6a7451,1bfc99c5f39fb41f,3dd66132d247ae6b,6ce8053944ba0b3f,bb64098e41d6381b,5d3f0eb1b3b99b3b,6d78f80097b54790,53ce9d66749dee0b,a0ff1963782c5861,2103281bda61856a,a165bcfa863dbd0d,f7c426569850d038,9ff6da73b78a62f7,9522bdfb6d68ad5e,9747c330b071c50b,e24c2e22a4d8b74a,e99d50bfc3c301b0,cc4ab178c2897f57,d87c82c48944a0c8,59a49b532084c65a,cb66eb09bc104597,4a02f0c63944a69f,a14bbe97a324d16a,36078aef42d2aaac,4860011ee075f7fd,e98bea1bb4b85185,d3b52895c30ee202',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": 'b723260f020f4c6e,f893881e6b4e5b68,e1541efcf4134b0b,1b4a020286d57841,aaa15ad92eb43705,273da15da994dbc0,27d5abb87d9a3047,fee89feeb2fdd819,6ea0f520f41c2541,9795df79656d0849,293add29dc0d0d55,ee9ade0a19ce0620,60a513622c8e3d3f,ee1c1f9323573858,e381398f9f9bff7a,e3630ae19ec6d56d,4c45ba77fa04ae79,3a52fde090f66ab0,c30d15e1dc058c44,43bbd241aa97af12,2dbb26bfa126d499,de46230f6544206e,1e7ca57fc993711c,ee7828d8cb4fcc05',
  "advanced 60, recovery (abandoned buildings with demand)": '36ca2f6b8835fb65,d0e9a401681068fb,599527ed587b7e08,d83e408ee4333c45,cb60fab306b000a7,d9a0527bd8882b5b,ab6c0d85392f93a8,a54a97d63c2766db,a559363d155d107c,4a15da4c69b08859,6f516a9f95760f47,5106653de64470be,2e219f05b91f5c86,69d39a6067922520,b5ffc403c0730fdb,c545ca6efc309143,841f37e388e1ad5c,79b689b4240d3e57,97ba196227f71e66,6befbd216adb3987,26a88dba804987c4,9b092a6ae1454027,1a03ce5d5134e892,d6797fb0a57edb22,8fe5f51167244998,1a1af538caf0bd3c,bb1764bd5e04b0b8,c2252657a66ee9e8,c7d43550976a1c3d,c59be088a5217be2',
  "advanced 60, severe storm (tree growth, more fires)": '294fa0fe25cf56c6,e8d7a40cdedf906d,714301459257efa4,9aef5cd479470305,586c7d77437286bf,788ad1d3cac9b944,d8e791ed24564622,4744fbc0b3a6348f,4f3d5c91ef747e0a,15bb117f60bc34fe,6da9b9237a64fea2,d486c1ce08b4d4e9,b738d660a5cc78b0,9618e12374137a1c,aa83023f0a500502,f909e061dcdf924c,a6f527b1f6c8ff8a,fbfd838560b87340,5c4f1696cfab6f45,33011305a9323d37',
  "benchmark 160, clear": '05bcc41e1596e47b,5844301d57647bed,f2a7826f790c3b3a,36e6b1fd1d2c093f',
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
