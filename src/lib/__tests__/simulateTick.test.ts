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
 * Key = scenario name. Value = the state fingerprint after every tick, joined by ','.
 */
const GOLDEN: Record<string, string> = {
  "advanced 60, clear": '1f441db736f31b04,77119969833737cf,84226e1484bf0b43,4a06952df472eca0,8a83d558f9795ab8,0f483a710cc5100f,ea011910a2db1e27,6b22ffd0e90a6aa6,b8b81cbca38034dc,4241dd499d0bdfcc,e870819a2f19fef3,dcf85f3a317f1b74,adfa7449de3c5e7d,d582c359cd6cb8de,842d4da334b13b02,511a84c1118c9720,93f042a3fac36f9d,b082030e2b05bd8d,caff858a608da556,784e34963059868c',
  "advanced 60, severe storm (tree growth, more fires)": '3f7a325e92d8a64e,2ba5d7e6a53da1e7,ca3c68c9c6b909be,e23d457b02b80167,47fe364a5aaaeac8,4d652f844e5ab48c,d87d1b7d53b6d94f,cd301b15f15d5d45,1b521daafa5b976c,dfc33b3b9fbaa191,5ef5e13cd159ca75,4bdf3baea99b82c3,aed102bd631964e5,fc64715a75d27d25,a4eafe1780adb9b1,5826e12878a799fb,0b995b0fd0750d80,2b8486453cb244a8,e61e02006b7cfea5,ba5a34b462b5c73c',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": '77fe9e64bde595bb,f5de5c99d0b55851,c56d9519f1f4b9a1,0dd6ef65800449d1,5dbe631bd044b5b2,905b452b86452e86,db594995b20b78cb,de8648195c482af7,9d2eac2e6cba0f64,646e1bc27465435c,6108aa2ec306cd7e,7dc39fef21db8a43,d0eaae9ac00ccb7e,03be9d214fb3ae85,1cad7fd504fde40a,bbdc6b045389e0c1,4dee41d2b482fca3,84d225ac0bf99fe8,d39b4ba93fc68fc2,f3ade59fffc06b5e,6f220b0061535a0e,d2384a7faa306354,40c3846a55072268,aa2ce39dcc7678c0,fa1d8b612024eb8e,8a03313e064e2c09,e8903a72cc32aaff,840846cf17706664,11f49fc7a9d108b8,b9f190011954add3,550d8e1b4e730928,1a93143442c41f59,994e1dd5467e3e75,1ed7747a9aeba3e0,b5c621f0ce1c4213,0f2845b34cc673b2,912f0921db39afd6,d12a390d91832477,0e66a3339432ebf6,63d120c776e76279',
  "advanced 60, oversupply (abandonment and clearing)": '35f3700dc7c668e7,5dc36933b7447a6e,48e99c5791a15a23,0db9a4d80d59b707,0dfd8bf5aef9d7f2,e8eff2cd2e00a110,53657a72fd681a1b,8e00048bf34988ed,acad54b51c576f1a,11ad689499559bb2,52536903ba15df5c,89bfce9131e32e78,b0e6c01bb6781015,9d00a935b1f4b499,37bdbe0f18cd75fb,4b0bd1c00b8f9f4a,a3472f9b1ba827fb,3599435da6e28535,91301cee5f1af704,b8e63eead8975969,c6b276495ebc3ec0,7b1b67890a699bbb,1ca003ef85241cab,013deeacffb4d823,fa545689272e4ccd,8ee7a01ca0ca4998,66c10c0203863a7c,ab9bbabe440e9296,bc4ee25d73064eeb,8c033b3053a3cd3d,3bc7d23508be111c,e3bdcddd56e5804a,165182b1dbfa11ba,c7debdbb24115fbf,60e7b2160f942dcf,a1487ae780cc89d6,ce02d15eb903304b,a808622becbc12a9,88416965f3a808ea,94f7e12efb6da4f2,ddce2a2ff0eeeaf1,e32d87b93337a7de,0d141ed36c53408b,51d771d817ab63d7,832045711c9266a7,b2e1faaef4cd2148,da24a775a88cc26e,730b57365090e345,e045eb5525dd8192,755d061cf3647b6f,561086db0fc44df8,f0a4854683c9a994,8cb63f617a7cddcc,8a939966ae1d5770,4fe0a70da61a1690,36c7ca582b11e1e8,99eb43a229b1c56b,4df28f6d8c9f5370,c11f3678bfb50327,61fa9ddd8124efe5',
  "advanced 60, recovery (abandoned buildings with demand)": '19cd1f06807c329c,345137c1d92bbc18,f7c3673d1f6814d3,249118e4f3e2b7fa,923030de61ff9a1c,f14b78a36f307abb,41ba221dd02b5570,f064c4e7e22a88d9,135d6850c30594b9,605bc7cd5903c923,fc7a2684f7e78ca2,aa9b72c9dec06e81,4ae7f4c7a14bae73,f6d58f08f3807abc,f0885989c0fba4ff,7396b015750ad002,be75d5e4f18dc5d3,48bdc0ff968d7aed,b55b518cbab33fab,9c61a2ae032bcbe7,6918eb9013bf021e,9b601833918c37f4,491b5ab13291ea65,5bdeda6332c4858d,de85e9de3205566d,88156689087ff727,2e88739ea4fa48c2,e4e4f5c7e0ac3ed6,59b71e7d9a79ba38,b87870659ccc222d',
  "advanced 60, disasters off, storm": 'e3a5ba3cc8cdaf51,a575d7b07c8a8e84,78772f0082a342f3,60f2aba9c1cfc03a,ef95e9a2e77e12e6,6920521df8c9e5e6,4b5e745b4fb0b12e,07b29fc5da900b26,002b215504c26000,b7e55ea1d3d35fbf,9a752996613070f2,932c64daa92b4324,6bfafdca7161415e,6e5cda593158c51c,3d73351b4bd48764,afdaac11e631605e,a435393d37810cd6,9c50cdfb19a2ede9,c13b1b92988089a8,32cf9438037e3da0',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": 'dd4d175507f2ff37,6749b4403ea22a70,c74cb8457a8b8137,0d56b9e296369ebe,d89968bebb0ae25d,c0530d37603f50c3,a0e8879160d2a052,b493cca09e483271,8d3a2cb9ca513171,db9259a8df10cf33,07d4ddc1d1770a4e,9150caf75136d790,bb2b9324d68493d6,db27b5cb5e1173a7,2b1fba2726dbffbd,26dbf33688b1cc1f,250fab4afa645911,33a7cafaa49b667b,6163bc7c1a300b77,0aa6d3ae699d79f6,ffdd0c23ffb2f797,47f74628bf225471,9a932235196c6233,6ea0ad7a1d01fc50',
  "benchmark 160, clear": 'd9824f9cfb1ee2f8,a5aae51eebcc8ec6,6b9b64049c5634d2,6c75069458ed4fba',
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
