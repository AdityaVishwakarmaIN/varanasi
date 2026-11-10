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
"advanced 60, clear": 'eb7627d0fce33396,ac23fc3092d608a4,f9fe371e749d8ac9,4116adc6704119c0,0875120d1545642d,b9b1b88bfa8f5bd5,a41c0de1378d5a55,75b35c12e593bcc8,5624023c32ad7d86,c0e5d350e867781c,adc2f3e59bab0b41,a49bf38112753bd9,ef6d2158c9bce2be,ffd95eb4b90c858b,aa23babfd29339a3,470a691f6600d28c,0f7c09c7701613c8,ffa7f056751bc290,01d1aa62efbce0d8,6dd0d6b0b9914e3d',
  "advanced 60, severe storm (tree growth, more fires)": '858b0a3b5f13e7ad,0af1e2e942fd37f6,66e0b02ac1568c56,168319f4ad69785b,7fc3cf18dc9fb834,908006e6a1c142bc,290758f7575a3f14,6cf10c0f6d599d64,1330de72e7b7a143,a209c62412e9451a,a76a12c7ca761b88,d3445605e77b5f00,5bd0a12565a634ad,4b8ccf825b2b2b92,9961d5b904e19194,ae2af375a0eb4b5d,de01ab8521728e57,2c3d20da3bcec00d,98aa93d0ebbadfee,029e69fadfc82461',
  "advanced 60, high demand, cleared lots, fires, construction (spawn + consolidation)": 'dfac60259b987ab1,59eac6dbf57ae413,8cb048058e64e1a7,86a1e16ebeb786bd,5f19dc1fca9bce0c,8a83102fdc1a93b3,ea50992f6cbfe070,333363490b1d4208,0f3ba13f2f462444,b763d8d30148690f,64cb2f33bb22dd9e,3b94a2c800fcde11,953465f7a7b90b80,58edc81046513135,1fd8e7afdfa11ca6,262a2d038496f3fc,8d9203c1a6df7a53,c93c91b3c1dc3cb2,88d4660ed398043c,d9fe326a54645b7b,0536c1a99b8f056d,70e646ff0a90fbbe,4fc45411cffd29e6,d24c845efe7953b2,3ebc1121811a0afd,749b0fcf5d88c409,44d017c77f72f215,897f67555f25db9d,3b5dbdbe77ba4bb4,91f3122e5fbea94c,a75438879db1fcba,22441d251077b1a0,6bb46f9f6414b125,ef39f4e718fc2ab0,fdb206289d8946b8,adee027df2ccd2d2,5cb3a2ba0f818407,4323c8848be43926,000385071fd28106,197e3af984906400',
  "advanced 60, oversupply (abandonment and clearing)": '0d9cc48b16379010,3de46daa4543dc17,3d52df11b393c58e,639d1e409eb7bca4,1090f853fbc99995,ab7af5b7f4da450b,b4c01f725e0ece68,758223295f1b09cf,387aac0268f577d7,bcd826daa3fb2f45,ea8fedfa0678e1e5,43fca6e5cbc46157,14cd7ca194da8cf6,fcca5f71355c7f9d,1816dfcf1eb6d2a7,b9f173dd49781681,aa7d876d2601919d,0f8347a6c46a2846,36ff239f6a675c28,c078c4321e570148,397431f490da5195,4cb37d2f590aa9b1,353a14fe9ca35194,5c06613123d2898e,b2bb67ce1306cd89,4802a6910c21905c,b8ac7fd417578fd8,483e72cc4e04bd63,72dc4e78acb6e5f2,f928daaddff16212,fe8eab272dbdd6ff,43fab84fe8428409,0c2775a7f8d4a813,8b79006a64c52acc,0e5a8bef83396bd1,5ce3ae05f93e152b,a15dfa498f654761,b6e96afd73656c2e,1afec8363640a1c9,514af7fa6c8d37b3,2a0473ec3adcbaf5,a31de5cd0511a5d3,58a1a69a921ecac0,f5a61561e4b9f915,b57a6ec4e768fa65,aff1c73ec2e1745b,73cdaf031b7ab0b9,9ba2f49bd815b40d,a09913d9ca0a131d,f6e637492cd81ea9,61e7f5a69963958f,fa8d2a513ebf38dc,43496cded8fe2f6e,befa84dd74076beb,aa239faf0e53d4f3,7c7cad11be87add7,36d29f67a3893cd0,51f6bd9a39f864e3,98c01b5b460b6167,c44923f34d0412c7',
  "advanced 60, recovery (abandoned buildings with demand)": '020c91c574b23334,f2a271444df65de1,12485b5c322c09cd,35cc0f56b3064047,7c0fa53369512e8c,1bde618e9e068fd0,0f35e35d524e1943,6866486200d09c4c,0964eb4aa6c572a2,5d9aa78772ba35f7,2b217e08309c6f66,43bad38db22825d0,250074fe5aacbb4d,0eeb9acf57f9b379,23869ab14a8c532c,e06ebd185a06a392,b83dd6534725accc,5a96f063e4120244,49d5504f6559bc2c,57e3b4301c26ece2,aa77ce4290d49d8b,b1db2e8b8beba5ab,39d7dfaec0f06134,a28f46f3047f154b,699a126e8ee7597f,e060ddfa574a8482,d2a88d1db6c6ca68,3c52ac2566755f3e,e2675ef654ea1f8a,e369cfdec784c9b6',
  "advanced 60, disasters off, storm": 'e49280b6dd54da2b,e43782a0e6ef6e37,96acf939e0d7bb7c,73c1a673f4730dc3,0602a41a6dc6e22c,18ad232b08ec3c62,eb80cccf9a0484d5,70a5ad02aa6affc7,d932ce202e555592,93a8ac83ab9d67d3,3fdc403637d4eed8,cdb77c1346a4c161,addb493f5d53b958,09301a42194e2689,c0c6c8dddf2cf067,b8d41fad1e3baa3c,f0148aac245c086b,08f0b1290c2731fb,0013ce6cf91ce160,2870af5087028f9e',
  "advanced 60, player changes service buildings between ticks (coverage cache invalidation)": 'e022f49e3557bc47,f6331a3163c98fa9,c8eaecbf240d7b2c,4e785230810b49b0,6e474b7f6ecd44ca,02411fe460ddf655,fa2fb19ad46c1d6b,2454bae5333c1fe7,b4b44e2005732b7b,47b5d3bac7baaeaa,d8df92bce10ff5cd,a29471f4adf5e4ab,2427d25cd547d865,0babb6f766194dde,7da2df1c1cce3f32,e3a24e914298ac86,904628edcb9cf581,aea9486705afe4de,4505983146828b9c,ddd9a74d6472501f,54073e18606161d4,c51973dff9779648,9121f5749ccfd348,aee46aaf4fc87633',
  "benchmark 160, clear": '838e5287d7c79733,59b5ec9fe51b937e,0eca81d01d09859a,8575cfd6406f9034',
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
