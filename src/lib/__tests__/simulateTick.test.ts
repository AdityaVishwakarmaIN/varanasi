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
  "advanced 60, clear": '167937ab97ef5243,34aa279e394c9f93,33d043c406452aa2,496e5535fc879015,57427eba0b59496a,0581d85852aa1b55,f4223c203a55b594,6d5b7a92b990048f,73206906c64e5a10,2f85103617da7dc3,7f6125e39cb09f8c,d0536a0047c82a28,06384672a0b38cb3,981eaa42c8403ef7,4dbba99d8a2b696f,8796b91b0364dc10,ad2fb6e713ea9d0d,ec1bb932ba00eb91,2c6a967327061569,cf70210b07cb35de',
  "advanced 60, severe storm (tree growth, more fires)": '5d26a4e2208db55d,617f85795e0fa176,482bcb11a4a339e7,47efbdfc63117cf2,c3865789504d23e2,09ef304616a5c4c2,7273cb35c21b5f90,480482d41cd95614,40d73a2000d700d5,c68b9c64e88eac42,811b5f443d2bc64e,544efdb22e6510ec,4d6cee0be21785f1,26cab99558b5a637,634081b8383e7fea,3024c68681c6a6d0,28153814bdbe8671,081e3152b818c2bf,114d97d79b7fdbd3,8d0023af53a7c9ff',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": '84525f7cebeb9d1f,0c48ce957575b18e,bc836de579cf4361,64f75551c03ca21e,ca2d9a060233c862,21c63979af4d6748,40ae5ea5cd1b0595,8bb1ff66e226294b,abeac8e80c004f39,f6f6082b30b6db18,fb5023b4bb8262eb,01489c4be35869ca,eb378c6d25a027aa,19d896f10f6dc15e,edd159e972190a30,a91026420db29c87,00952d15efdaad35,6f57f71d3216c0eb,a0cb4364ee7e7a40,b7430dd644f529fa,770df73e5decc7e3,7bcd96e20b93aad8,3817797f3982da64,1ee19c7f4df4e24f,7abe9dfceea0b2ca,2425984284adfba7,94a557ec03b02991,75b92eedd93ef76a,3cfd09561146c7b4,f8fcb7d257ac3fe7,c86ea31481e4373a,acaf49ce64c4930c,9fd02aab481f71dc,1899bc3991f18898,1ed73d54e661a7ec,201d2637a79d31f3,d90786890e3b2dcb,ba6360062ad6b1a7,1bf6c95e77dcfd61,ffd76685ed712a03',
  "advanced 60, oversupply (abandonment and clearing)": 'b3613774a9478b5e,d58240b37719c156,9c243af2a07f0a28,84ba051606263af1,7bbe3572be15c5bc,78a6ea1bc8b2ddf1,47312f3557571b74,1b4ee885f268fd5e,b5e28237149cb793,290856a12eb5c0d5,2765ad5efa56661b,a3312c19cab1ab2b,1d5dc9817af5e63d,a304704c91055e21,dc05c70721f16bf6,d4fd527778d50a6c,8cb6709adb7ba50a,54e7103ddb65b0f0,1857806f43d809c0,44ae9222f0892bc7,374540125d2fa63a,ea3b2dd5963b0ee6,f285646896ace169,954d3232c8a86cd8,3e5b707e1989123a,f166810d192a04b3,3f17bc022c08372d,c92307c518040000,2358d784dd35e94d,2c092c6f3562ff03,dc6d84ede5cd6953,472dfc5774978e0f,521698c1ca3e3dc1,61585259a7b4dccb,2a97332db005ff0b,d675269d70bbfd46,465e558177df6818,547f84836d312f28,801539539a2fdc82,8ef972ee67ad5e57,9a28aede740910fc,cce1611f51552a04,ee9a721ef3216b07,dfe0958a478d7ee9,97a142e72e844e79,d5dc446295422fc8,75918056ef123fb2,1f85654b96609e66,20fadf507398cfd1,872106824a0ddc9a,6b9665ad84387089,f681ae097b12c2cf,f82ae48e85a76b4d,458adda22110c589,0106ea8061fab4d8,86efba587a79a340,857c8ef2b7b2132f,fc44fabed46f6ae9,7f348e38673c326b,1f18ad98cb376003',
  "advanced 60, recovery (abandoned buildings with demand)": 'fd34d97828f9172d,c5ff68797421f6ca,fea064fc256eebcf,1dd7e7ea5e8e8d02,6fde4ebfadd41948,23bb2b226752c7b2,3cf09d25056c41a4,9c543916f2fe858b,4b6330fef1d62bda,8fed1c9582149a1a,a13f713ca8071e20,3a549894c8c62588,a0f1c7e70e878fe6,91e0d85a1d95be79,b447293948fe4a73,9562ff1d213cbfcd,8885bdcec0d6d44e,9954ee471589b4fc,d1933c6c92fdd2b2,5e750cf92e2ae23f,884ed2d02b2f3d65,260dfdc01a0b530a,421468fe289f465b,e470a1efc19a2dca,22214004110089b7,acaef2ca1e66e3c3,298b625e1c46a717,546cf99375e15d3c,1f823a8a81a99763,90dc5f97141b61cd',
  "advanced 60, disasters off, storm": '0fdb89a609895f91,3667cde67e482b36,6a1701ccb6124f38,73e363fab0cd5913,3fe522161de2b7df,f1882f4e1d066c79,ba08a911695f351f,566d9d3dce156731,b1361f617c002819,a2a6565a55e925de,351b42bb27abf18b,4494debd73cfb576,3a63be8ecba424f6,69f85e25b8f0b42e,e097fe034820f648,7c3836bb7aace8ea,778327e35a35a64b,a43e7bbd90026564,7f50a40c1835554d,26cf69599e614ca6',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": '6f867520fe405c76,7c6184b118eebe51,c6d4215c0ff6591a,688ad7e323bd2909,fa8d1922c9786a18,3dd96b577fd0e0ca,0787592822389dc2,9a019832a50da5cb,f1b489c939317bd1,5c15aeb1f6c6bfc6,2eb7ac3b22194894,26ba734f7e6c87d5,c8f72fd11732f358,aafd6cf37a629258,b06be4d9fe00259f,2aa4c2f43e7f78d0,a26c25f9d271e2b9,cc9f75a38b7d3e79,cc0fa898288ad017,92e7c870be91905e,a4360db6ea2437ba,f2e6309be38a3fc9,49192995495729a1,6dd89f7bfaaf0c0b',
  "benchmark 160, clear": '5223beaf80504e61,f1ef348df54c7883,16f4a81d48b2efb2,7d3bfe7f4b84dfba',
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
