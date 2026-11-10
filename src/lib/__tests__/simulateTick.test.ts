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
 * Golden fingerprints recorded with the original simulateTick (commit 243c14d, before S1-T5).
 * Key = scenario name. Value = the state fingerprint after every tick, joined by ','.
 */
const GOLDEN: Record<string, string> = {
"advanced 60, clear": '4f53b2006ca26455,7c2b1f11891c60a4,d8f88a2a694d349c,4790cc6b8f600066,492212bde38aa8e6,bda862355f8b3f9f,c83571530fc51c0e,a164ff1e8ce24609,2eaf24a03624a21a,fd213c6228f1eb3a,36543ba96d38a0dd,586612f4dc8adea3,b43c282688b8e2de,664ba74794889c7e,1843190a19123cbe,0e740739db3c7a93,1724aea12ea88049,5f02e1680935796d,7cc202caf6cba68a,27496b47395ceb42',
  "advanced 60, severe storm (tree growth, more fires)": 'ac1f20f18c980de0,292b238c11645996,1fcfe8c1d6e308b0,42ec4d49ffe8851d,0bc6ed433b619c01,8edae66fa950a44e,366c3c6393740113,32785df7ef3536f6,813bc6d069a67693,b065c258dfbd1642,cc4d452e14008374,572d66d94e7fb753,01791af8ec8de470,ace27fe26671d249,496f944c885d8c1a,3586afde98b8ecde,ecaaa6913168d23c,6bee116981e2006b,2c46be7da2af2c96,0d3b8d916a5a77bf',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": 'c6d46e9915f99c71,f31342916bbe8f47,dbbe155dd9607fe4,ef4d824e579aee65,b05ecd474adda252,94b8a7a87b44e3b1,5364792c67ccad75,e406893ffcd18d85,04dfd009d6509c7d,3636daa8b46b666f,42409be10a460154,20b394a8be711446,3416960d3937809e,539c94dd64b9adbb,24f8edab3b01699d,bc2c6631abea2e71,00f507bb544bb757,f4f1395cab8ac2f8,09df23551af386dd,f4405b66c80eb9b7,b74dd87a4c77c411,ed9c6e9531c56710,e207654367cc58a8,b583744e866bd4c9,face06cbfeec2bf6,f4fc0cc876b6153e,6d488c382197e3e7,9968689be81f4a38,886f08358fb44592,0ed4e1c556c6cf28,5ef58f55061dbfcb,b74215cf2b9110dc,7dd7badad29e5220,9a8e8e07f03b632c,65c2944423f09874,abf74f235c20d1c8,8ae61bf9fb72ed16,2512329d60aa37d5,ca1b69a019430ae2,6f11fa822f3f5dce',
  "advanced 60, oversupply (abandonment and clearing)": '82e7ad2e8af71fe0,c9794213448c0b0d,880650ee098c01c9,8028f3184c1a55b2,16551198c4cdee45,06ec7398aa86f440,555ab911032296ac,74bb58e203e60fe2,6bf19bf971c250e9,0f0a6514df10bbd0,b575defae1154e0b,930525be53b29a03,b12d16b31d5cb30f,25abe81a7ea6059a,b23c0d28e45f4e43,6e622fac761b3db3,aa91b7ae5ffeb89e,f63c01b84b8461f7,0662388c051566e0,77b59f601ae903c3,0c0d1e2b60ad97a6,487a4153307da7f8,696059a25b1d73a4,81060e6d6a15ff5e,4ede1c1dcab599ee,75ead34e3ae0db88,82dd1085ca82b538,3e3fdd2d0b320bd4,9cb077933d332c0e,2f28036850c2ee64,702a9ee3b929d8ec,076c2ac071ac0e06,ab12f9f18b49fdd9,773470901a630983,e64f7b3658625298,9e74c184e4b6e3d8,cb5959661979ee30,6ce019512e2e2b80,f060c3bec91fd74b,d6f48809965c040b,ab7028e6a0e93a78,99a3968d362530b3,ea820f94771057d0,6c5a05c8cfc23a3c,93cc8c4020b34395,51f443a98cf98e3c,fdcd779daf227939,3ac25c620225ca48,44d395f06892b713,1ee938398a7f76d6,b1fa126273817c23,d4bdfcd898298044,72a713d171ae946a,3d1f9c38c610e137,a0004594bc1eb288,bcf95c5f8e76be5f,3480df9af10fff20,f2a1818939efaa97,107027f56d788354,fa44fc0cd10d6ce8',
  "advanced 60, recovery (abandoned buildings with demand)": 'dc631806557485a6,b034c4a3b6c7572c,c37cd447b88d6b1d,07d705c716221031,9858af82f63c6957,7529b8232054a335,c15cbbf845e567e8,85a3726b14d81cf1,910b59973b1ac0b3,32b05e6ffed10a29,2c631af693159183,06fddd72d9d9c071,0187cd3b23542305,33e3aaca08f7c8e8,21f8c1da0d057e14,85b1d7a4fb3788f6,88559bc68a6e5972,45f09b5ce0a4f307,c5707be37cb3231a,d97f84a2ac8c7e23,f9586d5c83623159,71c78ac51907d1f3,4c37d5ca203a7655,b99ad3346705f3d0,2c6f20121aa296dc,44f9935c393da9f4,4edbd1095c614d0e,99547ef630600c57,364cdc9ce5a4d9c7,bc17edb1168c6089',
  "advanced 60, disasters off, storm": '00fd3b459a9f50e8,7cdade3b3e5a7252,71ca8147aa62b152,0cfe4ba7b97a39cf,a1f47ba9cfdb3b35,f07b7d226d314c19,bdc0a8b9e5469d66,47b4d6b1042273fb,c38004b754bf3858,3af17b434576a2ac,d9d60d320361b757,0aefed461e45f361,b0fa9b2874aa5d9c,fd181cf2849eaca4,1ec20f4ab31624c1,80da47626fc0fba3,9805fe9153bda411,4a10b09188e05940,24ad8b283bc18943,7ed4c07e61892e82',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": 'c7cb77ec77760121,f8d937df8c49da2e,4df60359f35f62c0,48f00026ed2312b9,4e4afaa3f05c04b6,7a4922830702963f,0a7138b5cfcb0b5e,55c67ddb045ece19,5039aac3bb2f3c6d,b2ecbbe52308e5ec,6fcfe06f9c98f2b0,f866b245bc8b86b4,114f4fb4e563cec3,e696bec2018757f7,9b55fdfe7f814041,d1a20c04097a1bf0,bd2ee813ef767387,813aafa5d2870717,43d31883f06cc7d3,9905673874b42c90,c6416dbc18b8c0fd,6bd642eac6b8ec2f,0a88e854fe940a48,1f98c8f887906908',
  "benchmark 160, clear": '093b858a3b35c143,956e2a939c20653a,59f58a481856e8be,3ce5ff9dc213d80d',
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
