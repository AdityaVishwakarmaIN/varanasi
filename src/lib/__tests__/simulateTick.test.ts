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
 * Key = scenario name. Value = the state fingerprint after every tick, joined by ','.
 */
const GOLDEN: Record<string, string> = {
  "advanced 60, clear": '96e56191700758f4,db1aa3f478b79ee4,46d467dd28c548f1,b6f2c152aca9a4fc,70ecf9d5a56649f6,a935048be9758827,f6e5e4296ecde5cb,385f52c9b0b8f7f3,c9fcd29f6eb3d97c,132cf1588348e215,216c35e29d0107a2,0abb73c800d389dd,d2797bd340586b93,f5986d7186f7752a,4a047a267b845f44,ce33e8d3b162fccf,e479e031b3e85f56,cc0e96f829b239d3,bbc29a0fd94e458d,6d096e47bcc16b40',
  "advanced 60, severe storm (tree growth, more fires)": 'f603405fad485540,7d2c8de0972d2d0d,6bba05bf550879fe,013d7792e310c8cc,6a38a5d0f06bc3cb,c6f4c5b70e70f227,e87de1ba92ce1839,b793a81196cff228,d5f0ae43274e715a,37e3ba23534c0c35,fa3e27ca1c9919a8,aacddc8f42c91d9e,f2f1e39c1e15f507,d67034d8ef0b8dff,216a78e729511138,1dc2c8550444aa2e,9e1de73905874009,5ba6dff081a6d645,096d76dcc5312907,2e653a42b9156f9c',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": 'f8196a6c480355f1,470f40eebbdb853c,22761ff10d1ef6da,d5c366ce9013118d,72674085435e730e,e741a2623bf5c602,1537e5d14326cb6e,19a5e7975f882284,8314c12c0f33af05,dab9f2b2791c021e,e16f407d7ce112c3,33dd79f054819b14,bd72573792ecd4a2,f213187c59d64de9,e570c0c02f8a6810,a75770697c33c1ce,13c85e4152a29552,f9fe0987fd637ffe,2cb19eb514b91a18,bae4c3fe31c3fe2b,e6330b6852137cb0,0790f302dc6047e5,ac75eeb73b0e67a2,1bba1bbf50147cb2,0d2eb15366ffd41d,5c67c4dbe030b099,d7570be193d7be36,562a5bc644ba71c9,3be79ece3d28a469,b2252ef5fa28ab37,9419d8b3c8f4bdbe,7386613c475e9bda,e069042785ab0ffd,f1d43e5ec57e9876,1c3e020e72087085,18478696067d8197,1c06c910731910fd,743a7a537bdea4b9,23571fc7b433b477,e7442603f13653ca',
  "advanced 60, oversupply (abandonment and clearing)": '7ce35dd8c58a9a00,bab7176b5c9649b6,8e568b0d7e1c2d94,3363cadcea83fc37,9ed3a8a1d02eb6a9,c8d344f3034f077e,eed7ed13a0efd16b,4a14efe905f58625,9392d77bcdd282d9,d6eb604f4ced56f9,cb3e4aa2701ed35d,d9b9e6ff9b6216fc,07a98f82888a8aa9,70b126dd516ae46a,88738b46b632eaf0,cee6fafd16a494ca,66763a9cadc1a1cb,97d14031721e3312,d06ae0e145b8937e,d88e258c3b4a552c,2ee1a6700899fee8,694a7e3ed9665441,e66f8a2796756758,a34fdcd77ce8fc8a,08ab4e42ca252750,4c56ccdf7861ad41,659bb08d5593bf09,6fe404ac625c82e9,66191f02de17961f,4a7bc7e21a47712f,64053bd80b7c31dd,e10cdfb8f0577a3e,9d91ed5ef6f3b44c,5b6ac38385e9522d,d1ee055ed40dc4e0,54841e3e8f90b746,2a32dbd13456e434,4cda37d86fe5dbfa,876927b2d0ef97a9,f11e41074649cbf2,fe42203163369ad1,da253981148fb960,aa51387b1dfb9902,13a8d8b742b32597,8bab4f9a752c21e5,322b2a3c7de3d5d7,36e1a9c04e2e5b84,ef92949344e391d8,38547a5dc21a49df,40e9fefbd5cb2fd9,8d89f8d4ab92e3e8,b040de26f33942c1,0a37caa79b6ff945,fc7094ac39f0b4f6,de6949151e73cd2a,bc20c05c815fc3ec,79ec84ad2bced5ff,a071613a2cd5f525,534a266862f19078,1224dd8d568630d5',
  "advanced 60, recovery (abandoned buildings with demand)": 'aeebe3257b71d8a8,5d363268194f27b8,671a59f2a2e71eea,4e597ec533543ec3,c8d99a3ac40fab19,528dfc723e016589,8c39fd9b50d1a147,3a84cdd00f650e5a,90d2f01a6fa8b266,7d5cb7e0cbf41e35,f1d8a2c9b6f655ce,d9f351ba862fba8a,eec98f64aeca5c25,07fbdb4a1d41bbe7,55f72e34fbebff26,9b0f4775d9ce4e22,b30f403f7adc0660,20d980bac2678301,a1008bb519d73782,66505bda7cb2d3b4,23d8b1f4dec1a515,8d4263d159bb8687,053cce5c611237f3,cc66a427958d4abd,a2fa9a4dc9c23971,5d8785a6b2fff7cb,9456a64f82066ca7,78c28c4e4897aea3,41936be8449c8bfb,8916bd510c5c70d9',
  "advanced 60, disasters off, storm": '14a0ba058d84f3d1,910d9fe0ccb89352,3cc2327fcc433390,3429c3cb03d40654,a3865765620aa5da,9e8b966d1542cfbc,ddae466b18ff233b,a945e84fdceeed5a,42cdb91645b07ff4,7ec70f452f872e34,a81fcde6e83a78a9,02f3ccdd243bad14,91d52a5c64c9f79f,da0200aca0407730,f91c00c72e20088d,8d42d17719433a95,9f7539a93a512f13,0172f48c1d08658a,7fa67406b5a86600,8fb449b7dccb4910',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": '1d1dfb23c85d3e2e,db60d15aeed01750,8de8ea3c1cfb4007,d16651e0ac10022a,7ea0465b563b27cd,0745a254230cbfab,b20eed36bf189877,d80cdae3796d27f6,4b68b2b099e03966,505f90028177a21b,d1c6e621e161457f,6b6ffd64a64397b4,6d1799da53db6cba,f0c60ce161f23576,802c487131e46a81,f2e65207bfe8ea8c,cee62a781b622ab7,03580ea4e1debb2e,b82476fba56f0999,f2fa606fd1748186,303ebf0989e7d4e0,35661adde03e8094,1b5ac39e00556282,a267599ead687ef5',
  "benchmark 160, clear": 'fcefa1119f718675,9ddfd8aa2e76042f,a963dee6ed7bc76b,a145ac3b9ff44c26',
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
