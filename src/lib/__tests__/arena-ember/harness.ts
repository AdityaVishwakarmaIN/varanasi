/**
 * TEAM EMBER arena harness: headless, seeded scenarios F1/F2/F3/T1/T2/D1.
 *
 * - simulateTick uses Math.random internally, so every run replaces it with a mulberry32 stream.
 * - Vehicles run through the REAL createVehicleSystems closure, driven with plain `{ current }` refs.
 * - One simulation tick is 0.5 s of vehicle time (desktop speed 1: 500 ms per tick, vehicle multiplier 1).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { vi } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, simulateTick, setCrisesEnabled, setFloodsEnabled, setFestivalsEnabled, setInformalSettlementsEnabled } from '@/lib/simulation';
import { createVehicleSystems, type VehicleSystemRefs, type VehicleSystemState } from '@/components/game/vehicleSystems';
import type { Car, EmergencyVehicle, WorldRenderState } from '@/components/game/types';
import type { CloudWeatherMode } from '@/components/game/types';
import type { BuildingType, GameState, Tile } from '@/types/game';

export const TICK_SECONDS = 0.5;
export const TICKS_PER_DAY = 30;
const FRAME = 0.1;

export const ARENA_DIR = '/tmp/claude-0/-home-user-varanasi/b127f6c5-6c8c-5c21-b1cd-b97adb5d45d9/scratchpad/arena/ember';

export function seedMath(seed: number): () => void {
  const rng = createRng(seed);
  const spy = vi.spyOn(Math, 'random').mockImplementation(rng);
  return () => spy.mockRestore();
}

export function writeMetrics(name: string, data: unknown): void {
  const label = process.env.EMBER_LABEL ?? 'run';
  const file = join(ARENA_DIR, `metrics-${label}.json`);
  let all: Record<string, unknown> = {};
  try {
    if (existsSync(file)) all = JSON.parse(readFileSync(file, 'utf8'));
  } catch { /* start fresh */ }
  all[name] = data;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(all, null, 2));
  } catch { /* metrics are best effort */ }
}

export function quietSim(): void {
  setCrisesEnabled(false);
  setFloodsEnabled(false);
  setFestivalsEnabled(false);
  setInformalSettlementsEnabled(false);
}

// ---------------------------------------------------------------------------
// City construction
// ---------------------------------------------------------------------------

export const FIRE_SIZE = 48;
export const BLOCK = { x0: 6, x1: 22, y0: 6, y1: 22 };
export const FIRE_START = { x: 17, y: 15 };
export const STATION_8 = { x: 25, y: 15 };

export function setTile(tile: Tile, type: BuildingType, zone: Tile['zone']): void {
  const level = type === 'grass' || type === 'empty' ? 0 : 1;
  tile.building = {
    ...tile.building,
    type,
    level,
    population: type === 'house_small' ? 6 : type === 'house_medium' ? 14 : type === 'informal_housing' ? 12 : type === 'apartment_low' ? 60 : 0,
    jobs: type.startsWith('shop') ? 10 : 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 4000,
    constructionProgress: 100,
    abandoned: false,
  };
  tile.zone = zone;
}

/** A 48x48 grass map: roads every 6 tiles, and a dense old-city block of mixed 1x1 buildings. */
export function makeFireCity(seed: number, opts: { station?: { x: number; y: number } | null; funding?: number } = {}): GameState {
  const restore = seedMath(seed);
  try {
    const state = createInitialGameState(FIRE_SIZE, 'Ember', createRng(seed), 'random');
    const rng = createRng(seed ^ 0x9e3779b9);
    for (let y = 0; y < FIRE_SIZE; y++) {
      for (let x = 0; x < FIRE_SIZE; x++) {
        const tile = state.grid[y][x];
        setTile(tile, 'grass', 'none');
        tile.building.constructionProgress = 100;
        if (x % 6 === 0 || y % 6 === 0) setTile(tile, 'road', 'none');
      }
    }
    const mix: [BuildingType, Tile['zone']][] = [
      ['house_small', 'residential'], ['house_small', 'residential'], ['house_small', 'residential'],
      ['house_medium', 'residential'], ['house_medium', 'residential'],
      ['informal_housing', 'residential'],
      ['shop_small', 'commercial'], ['shop_small', 'commercial'],
      ['apartment_low', 'residential'],
      ['shop_medium', 'commercial'],
    ];
    for (let y = BLOCK.y0; y <= BLOCK.y1; y++) {
      for (let x = BLOCK.x0; x <= BLOCK.x1; x++) {
        if (x % 6 === 0 || y % 6 === 0) continue;
        const [type, zone] = mix[Math.floor(rng() * mix.length)];
        setTile(state.grid[y][x], type, zone);
      }
    }
    if (opts.station) setTile(state.grid[opts.station.y][opts.station.x], 'fire_station', 'none');
    state.budget.fire.funding = opts.funding ?? 100;
    return state;
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------------------
// Vehicle rig (real vehicleSystems closure with plain refs)
// ---------------------------------------------------------------------------

export interface VehicleRig {
  world: { current: WorldRenderState };
  cars: { current: Car[] };
  emergency: { current: EmergencyVehicle[] };
  activeFires: { current: Set<string> };
  systems: ReturnType<typeof createVehicleSystems>;
  lightTimer: { current: number };
  setGrid(grid: Tile[][]): void;
  /** Advance `seconds` of vehicle time in FRAME steps. */
  step(seconds: number, opts?: { cars?: boolean; emergency?: boolean }): void;
}

export function makeVehicleRig(
  grid: Tile[][],
  size: number,
  extra: { fireFunding?: number; weather?: GameState['weather']; mapId?: GameState['mapId'] } = {}
): VehicleRig {
  const world = {
    current: {
      grid,
      gridSize: size,
      offset: { x: 20000, y: 0 },
      zoom: 1,
      speed: 1,
      canvasSize: { width: 40000, height: 40000 },
      cloudWeatherMode: 'clear',
    } as WorldRenderState,
  };
  const cars = { current: [] as Car[] };
  const emergency = { current: [] as EmergencyVehicle[] };
  const activeFires = { current: new Set<string>() };
  const lightTimer = { current: 0 };
  const noop = { current: 0 };
  const refs = {
    carsRef: cars,
    carIdRef: { current: 0 },
    carSpawnTimerRef: { current: 0 },
    busesRef: { current: [] },
    busIdRef: { current: 0 },
    busSpawnTimerRef: { current: 99999 },
    emergencyVehiclesRef: emergency,
    emergencyVehicleIdRef: { current: 0 },
    emergencyDispatchTimerRef: { current: 0 },
    activeFiresRef: activeFires,
    activeCrimesRef: { current: new Set<string>() },
    activeCrimeIncidentsRef: { current: new Map() },
    crimeSpawnTimerRef: noop,
    pedestriansRef: { current: [] },
    pedestrianIdRef: { current: 0 },
    pedestrianSpawnTimerRef: { current: 99999 },
    trafficLightTimerRef: lightTimer,
    trainsRef: { current: [] },
    cowsRef: { current: [] },
    cowIdRef: { current: 0 },
  } as unknown as VehicleSystemRefs;
  const structure = { current: 1 };
  const systemState = {
    worldStateRef: world,
    gridVersionRef: structure,
    roadNetworkVersionRef: structure,
    cachedRoadTileCountRef: { current: { count: 0, roadVersion: -1 } },
    cachedIntersectionMapRef: { current: { map: new Map<number, boolean>(), roadVersion: -1 } },
    state: {
      services: { police: [] },
      stats: { population: 1000 },
      mapId: extra.mapId ?? 'random',
      month: 3,
      weather: extra.weather ?? 'clear',
      fireFunding: extra.fireFunding,
    },
    visualHour: 12,
    isMobile: false,
  } as unknown as VehicleSystemState;
  const systems = createVehicleSystems(refs, systemState);
  return {
    world,
    cars,
    emergency,
    activeFires,
    systems,
    lightTimer,
    setGrid(g: Tile[][]) {
      world.current.grid = g;
    },
    step(seconds, opts = {}) {
      const doCars = opts.cars ?? true;
      const doEmergency = opts.emergency ?? true;
      for (let t = 0; t < seconds - 1e-9; t += FRAME) {
        lightTimer.current += FRAME;
        if (doCars) systems.updateCars(FRAME);
        if (doEmergency) systems.updateEmergencyVehicles(FRAME);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Fire scenario
// ---------------------------------------------------------------------------

export interface FireRunResult {
  seed: number;
  burnedDay1: number;
  burnedDay3: number;
  burnedDay7: number;
  lostDay7: number;
  maxSimultaneous: number;
  selfExtinguished: boolean;
  lastFireTick: number;
  firstTruckOnSceneTicks: number | null;
  firstDispatchTicks: number | null;
  fireNotifications: number;
  trucksDispatched: number;
}

export interface FireRunOptions {
  seed: number;
  station: boolean;
  funding: number;
  weather: CloudWeatherMode;
  days?: number;
  withTraffic?: boolean;
}

export function runFireScenario(o: FireRunOptions): FireRunResult {
  quietSim();
  const days = o.days ?? 7;
  let state = makeFireCity(o.seed, { station: o.station ? STATION_8 : null, funding: o.funding });
  const restore = seedMath(o.seed * 7919 + 13);
  try {
    const t0 = state.grid[FIRE_START.y][FIRE_START.x];
    t0.building = { ...t0.building, onFire: true, fireProgress: 0 };
    const rig = makeVehicleRig(state.grid, FIRE_SIZE, { fireFunding: o.funding, weather: o.weather as GameState['weather'] });
    rig.world.current.cloudWeatherMode = o.weather;
    if (o.withTraffic) rig.step(30, { emergency: false });
    const seen = new Set<number>();
    let max = 0;
    const burned: Record<number, number> = {};
    let lastFireTick = -1;
    let firstOnScene: number | null = null;
    let firstDispatch: number | null = null;
    let trucksDispatched = 0;
    const seenTrucks = new Set<number>();
    const totalTicks = days * TICKS_PER_DAY;
    const notifBefore = state.notifications.length;
    for (let tick = 1; tick <= totalTicks; tick++) {
      state = simulateTick(state, o.weather);
      rig.setGrid(state.grid);
      rig.world.current.cloudWeatherMode = o.weather;
      rig.step(TICK_SECONDS, { cars: !!o.withTraffic });
      let fires = 0;
      for (let y = 0; y < FIRE_SIZE; y++) {
        const row = state.grid[y];
        for (let x = 0; x < FIRE_SIZE; x++) {
          if (row[x].building.onFire) {
            fires++;
            seen.add(y * FIRE_SIZE + x);
          }
        }
      }
      for (const v of rig.emergency.current) {
        if (v.type !== 'fire_truck') continue;
        if (!seenTrucks.has(v.id)) {
          seenTrucks.add(v.id);
          trucksDispatched++;
          if (firstDispatch === null) firstDispatch = tick;
        }
        if (v.state === 'responding' && firstOnScene === null) firstOnScene = tick;
      }
      if (fires > max) max = fires;
      if (fires > 0) lastFireTick = tick;
      if (tick === TICKS_PER_DAY || tick === 3 * TICKS_PER_DAY || tick === 7 * TICKS_PER_DAY) burned[tick / TICKS_PER_DAY] = seen.size;
    }
    let lost = 0;
    for (let y = BLOCK.y0; y <= BLOCK.y1; y++) {
      for (let x = BLOCK.x0; x <= BLOCK.x1; x++) {
        if (x % 6 === 0 || y % 6 === 0) continue;
        if (seen.has(y * FIRE_SIZE + x) && state.grid[y][x].building.type === 'grass') lost++;
      }
    }
    const fireNotes = state.notifications
      .slice(0, Math.max(0, state.notifications.length - notifBefore))
      .filter((n) => /fire|burn|blaze/i.test(`${n.title} ${n.description}`)).length;
    return {
      seed: o.seed,
      burnedDay1: burned[1] ?? seen.size,
      burnedDay3: burned[3] ?? seen.size,
      burnedDay7: burned[7] ?? seen.size,
      lostDay7: lost,
      maxSimultaneous: max,
      selfExtinguished: lastFireTick < totalTicks,
      lastFireTick,
      firstTruckOnSceneTicks: firstOnScene,
      firstDispatchTicks: firstDispatch,
      fireNotifications: fireNotes,
      trucksDispatched,
    };
  } finally {
    restore();
  }
}

export function summarize(runs: number[]): { mean: number; median: number; min: number; max: number } {
  const s = [...runs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return {
    mean: Math.round(mean * 100) / 100,
    median: s.length ? s[Math.floor(s.length / 2)] : 0,
    min: s[0] ?? 0,
    max: s[s.length - 1] ?? 0,
  };
}
