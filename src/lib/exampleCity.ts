/**
 * Example city loader (pure, load-time only). The example saves in public/example-states were made on the old
 * American IsoCity: Western names, dollars, a sea on every edge, no `mapId`, and building types Varanasi has hidden.
 * `localizeExampleState` turns a copy of such a save into a Varanasi city when it is loaded, so the big JSON files
 * stay untouched.
 */
import type { Building, BuildingType } from '@/games/isocity/types/buildings';
import type { Tile, WaterBody } from '@/games/isocity/types/game';
import { getVaranasiLayout, LAYOUT_WATER } from '@/games/isocity/maps/varanasiLayout';
import { gatherGangaInputs } from '@/lib/ganga';
import { generateCityName, generateWaterName } from '@/lib/names';
import { calculateGangaTargetHealth } from '@/lib/scoring';
import { createBridgesOnPath, getBuildingSize, getWaterAdjacency } from '@/lib/simulation';
import type { GameState } from '@/types/game';

/** Name for the renamed example city. */
const EXAMPLE_CITY_NAME = 'Kashi Nagar';

/** Ganga Health the example starts at: a healthy river that the city's load (the target) then pulls down, with the causes shown. */
export const EXAMPLE_START_GANGA_HEALTH = 70;

/** Land value of river tiles, as in the Varanasi map generator. */
const RIVER_LAND_VALUE = 60;

/**
 * Types that Varanasi hides from the build menu (no mountains or cabins on the Ganga plain) and the Indian building
 * of the SAME footprint to show instead. Buildings that already have a Varanasi name and Indian art (police thana,
 * kabaddi court, cricket ground, mela ground...) keep their type, and a pier has no equivalent, so it stays.
 * Landmarks and ghats are never swapped in: they are unique or tied to the river bank.
 */
export const EXAMPLE_TYPE_MAP: Readonly<Partial<Record<BuildingType, BuildingType>>> = {
  cabin_house: 'house_small',
  mountain_lodge: 'greenhouse_garden',
  mountain_trailhead: 'park_large',
};

/**
 * Waterfront buildings (jetties, piers) that the carve leaves without water next to them become a land building of
 * the same footprint: the Varanasi map has no sea, only the Ganga and its lakes.
 */
export const EXAMPLE_DRY_WATERFRONT_MAP: Readonly<Partial<Record<BuildingType, BuildingType>>> = {
  marina_docks_small: 'greenhouse_garden',
  pier_large: 'park',
};

/** Buildings the river's course may clear that are put back on the nearest free land, since the city needs them. */
const RELOCATED_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'city_hall', 'amusement_park', 'stadium', 'museum', 'airport', 'university', 'hospital', 'school',
  'police_station', 'fire_station', 'power_plant', 'water_tower', 'rail_station',
]);

/** Extra search cost for a site with no road next to it (squared tiles), so services sit on a street if one is near. */
const NO_ROAD_PENALTY = 100;

type ExampleLike = {
  cityName?: string;
  waterBodies?: unknown;
  adjacentCities?: unknown;
  notifications?: unknown;
  grid?: unknown;
  gridSize?: unknown;
  mapId?: unknown;
  stats?: unknown;
};

function createLandTile(tile: Tile, type: BuildingType): Tile {
  return {
    ...tile,
    hasRailOverlay: undefined,
    building: { type, level: 0, population: 0, jobs: 0, powered: false, watered: false, onFire: false, fireProgress: 0, age: 0, constructionProgress: 100, abandoned: false },
  };
}

function createRiverTile(tile: Tile): Tile {
  return {
    ...createLandTile(tile, 'water'),
    zone: 'none',
    landValue: RIVER_LAND_VALUE,
    pollution: 0,
    crime: 0,
    traffic: 0,
    hasSubway: false,
  };
}

function centerOf(tiles: { x: number; y: number }[]): { centerX: number; centerY: number } {
  if (tiles.length === 0) return { centerX: 0, centerY: 0 };
  let sx = 0;
  let sy = 0;
  for (const t of tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { centerX: Math.round(sx / tiles.length), centerY: Math.round(sy / tiles.length) };
}

interface Displaced {
  x: number;
  y: number;
  size: number;
  building: Building;
}

/** The nearest spot (squared distance, with a penalty away from roads) where a size x size building fits on free grass. */
function findFreeSite(grid: Tile[][], gridSize: number, from: Displaced): { x: number; y: number } | null {
  const { size } = from;
  const isRoad = (x: number, y: number) => grid[y]?.[x]?.building.type === 'road';
  const fits = (sx: number, sy: number) => {
    if (sx < 0 || sy < 0 || sx + size > gridSize || sy + size > gridSize) return false;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const t = grid[sy + dy][sx + dx];
        if (t.building.type !== 'grass' || t.zone !== 'none') return false;
      }
    }
    return true;
  };
  const touchesRoad = (sx: number, sy: number) => {
    for (let i = 0; i < size; i++) {
      if (isRoad(sx + i, sy - 1) || isRoad(sx + i, sy + size) || isRoad(sx - 1, sy + i) || isRoad(sx + size, sy + i)) return true;
    }
    return false;
  };
  let best: { x: number; y: number } | null = null;
  let bestScore = Infinity;
  for (let r = 0; r < gridSize; r++) {
    if (r * r > bestScore) break;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const sx = from.x + dx;
        const sy = from.y + dy;
        if (!fits(sx, sy)) continue;
        const score = dx * dx + dy * dy + (touchesRoad(sx, sy) ? 0 : NO_ROAD_PENALTY);
        if (score < bestScore) {
          bestScore = score;
          best = { x: sx, y: sy };
        }
      }
    }
  }
  return best;
}

/**
 * Puts a Varanasi map under an example city that has none: the Ganga and its tributaries are cut into the terrain
 * where the map data puts them (everything the Ganga mechanics read comes from that layout, not from the tiles), the
 * seas on the edges become land, and the lakes stay as talabs. Buildings in the river's way are cleared (a building
 * of more than one tile is cleared whole); services and the city hall are re-placed on the nearest free land, roads
 * and rails that crossed the river become bridges, and jetties left dry become land buildings.
 * Returns the new grid and water bodies.
 */
function carveVaranasi(grid: Tile[][], size: number, waterBodies: WaterBody[]): { grid: Tile[][]; waterBodies: WaterBody[] } {
  const layout = getVaranasiLayout(size);
  const isRiver = (x: number, y: number) => layout.water[y * size + x] !== LAYOUT_WATER.none;

  // Footprints (origin = top corner) that the river runs through, the services among them, and the road/rail crossings.
  const cleared = new Set<number>();
  const displaced: Displaced[] = [];
  const crossings: Record<'road' | 'rail', { x: number; y: number }[]> = { road: [], rail: [] };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const type = grid[y][x].building.type;
      if (isRiver(x, y) && (type === 'road' || type === 'rail')) crossings[type].push({ x, y });
      if (type === 'empty') continue;
      const w = getBuildingSize(type).width;
      let hit = false;
      for (let dy = 0; dy < w && !hit; dy++) {
        for (let dx = 0; dx < w && !hit; dx++) {
          if (x + dx < size && y + dy < size && isRiver(x + dx, y + dy)) hit = true;
        }
      }
      if (!hit) continue;
      if (RELOCATED_TYPES.has(type)) displaced.push({ x, y, size: w, building: grid[y][x].building });
      if (w <= 1) continue;
      for (let dy = 0; dy < w; dy++) {
        for (let dx = 0; dx < w; dx++) {
          if (x + dx < size && y + dy < size) cleared.add((y + dy) * size + x + dx);
        }
      }
    }
  }

  const seaTiles = new Set<number>();
  for (const body of waterBodies) {
    if (body.type !== 'ocean') continue;
    for (const t of body.tiles) seaTiles.add(t.y * size + t.x);
  }

  let out = grid.map((row, y) =>
    row.map((tile, x) => {
      const idx = y * size + x;
      if (isRiver(x, y)) return createRiverTile(tile);
      if (cleared.has(idx) || (seaTiles.has(idx) && tile.building.type === 'water')) return createLandTile(tile, 'grass');
      return tile;
    })
  );

  // Put the displaced services back on the nearest free land (if there is room).
  for (const d of displaced) {
    const site = findFreeSite(out, size, d);
    if (!site) continue;
    for (let dy = 0; dy < d.size; dy++) {
      for (let dx = 0; dx < d.size; dx++) {
        const tile = out[site.y + dy][site.x + dx];
        out[site.y + dy][site.x + dx] =
          dx === 0 && dy === 0 ? { ...tile, building: { ...d.building, flipped: undefined } } : createLandTile(tile, 'empty');
      }
    }
  }

  // Roads and rails that crossed the river become bridges, using the game's own bridge rules.
  for (const trackType of ['road', 'rail'] as const) {
    if (crossings[trackType].length === 0) continue;
    const path = new Map<number, { x: number; y: number }>();
    for (const c of crossings[trackType]) {
      path.set(c.y * size + c.x, c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (out[ny]?.[nx]?.building.type === trackType) path.set(ny * size + nx, { x: nx, y: ny });
      }
    }
    const bridged = createBridgesOnPath({ grid: out, gridSize: size } as unknown as GameState, [...path.values()], trackType);
    out = bridged.grid;
  }

  // Jetties and piers with no water left next to them become land buildings.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = out[y][x];
      const to = EXAMPLE_DRY_WATERFRONT_MAP[tile.building.type];
      if (!to) continue;
      const w = getBuildingSize(tile.building.type).width;
      if (getWaterAdjacency(out, x, y, w, w, size).hasWater) continue;
      out[y][x] = { ...tile, building: { ...tile.building, type: to, flipped: undefined } };
    }
  }

  const rivers: WaterBody[] = [
    { id: 'river-ganga', name: 'Ganga', type: 'river', tiles: layout.gangaTiles, ...centerOf(layout.gangaTiles) },
    ...layout.tributaryTiles
      .filter((t) => t.tiles.length > 0)
      .map((t) => ({ id: `river-${t.name.toLowerCase()}`, name: t.name, type: 'river' as const, tiles: t.tiles, ...centerOf(t.tiles) })),
  ];
  const lakes: WaterBody[] = [];
  for (const body of waterBodies) {
    if (body.type !== 'lake') continue;
    const tiles = body.tiles.filter((t) => out[t.y]?.[t.x]?.building.type === 'water' && !isRiver(t.x, t.y));
    if (tiles.length === 0) continue;
    lakes.push(tiles.length === body.tiles.length ? body : { ...body, tiles, ...centerOf(tiles) });
  }
  return { grid: out, waterBodies: [...rivers, ...lakes] };
}

/**
 * Gives an example save with no `mapId` the Varanasi map: `mapId: 'varanasi'` (which switches on the Ganga, ghats,
 * floods, festivals and seasons), the river on the grid, Indian building types for the Varanasi-hidden ones, and a
 * starting Ganga Health. A save that already has a `mapId` is returned unchanged. The input is not modified.
 */
export function varanasiExampleState<T extends ExampleLike>(state: T): T {
  const size = state.gridSize;
  if (state.mapId || typeof size !== 'number' || !Array.isArray(state.grid) || state.grid.length !== size) return state;

  const swapped = (state.grid as Tile[][]).map((row) =>
    row.map((tile) => {
      const to = EXAMPLE_TYPE_MAP[tile.building.type];
      return to ? { ...tile, building: { ...tile.building, type: to } } : tile;
    })
  );
  const { grid, waterBodies } = carveVaranasi(swapped, size, Array.isArray(state.waterBodies) ? (state.waterBodies as WaterBody[]) : []);

  const stats = (state.stats ?? {}) as Record<string, unknown>;
  const stps: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (grid[y][x].building.type === 'sewage_treatment_plant') stps.push({ x, y });
  }
  const inputs = gatherGangaInputs(grid, size, stps);
  const load = calculateGangaTargetHealth(inputs);
  return {
    ...state,
    grid,
    waterBodies,
    mapId: 'varanasi',
    stats: {
      ...stats,
      // The river arrives healthy and then feels the city. The load is stored too, so the Ganga chip and the
      // Statistics panel list the causes (untreated sewage, industry) from the first frame, not after a tick.
      gangaHealth: stats.gangaHealth ?? EXAMPLE_START_GANGA_HEALTH,
      gangaHealthTarget: stats.gangaHealthTarget ?? load.targetHealth,
      gangaLoad: stats.gangaLoad ?? { industrial: load.industrialLoad, sewage: load.sewageLoad, untreatedPopulation: inputs.untreatedPopulation },
      tourismIncome: stats.tourismIncome ?? 0,
    },
  };
}

/**
 * The example saves were made with Western names ("StephCity", "North Sea") and dollars. Gives a copy of such a save
 * an Indian city name, Indian water-body and neighbour names and rupees, and puts it on the Varanasi map (see
 * `varanasiExampleState`), so the big JSON files stay untouched.
 */
export function localizeExampleState<T extends ExampleLike>(input: T): T {
  const state = varanasiExampleState(input);
  const out: Record<string, unknown> = { ...state, cityName: EXAMPLE_CITY_NAME };
  const used = new Set<string>();
  const pick = (type: 'lake' | 'ocean') => {
    let name = generateWaterName(type);
    for (let i = 0; i < 20 && used.has(name); i++) name = generateWaterName(type);
    used.add(name);
    return name;
  };
  if (Array.isArray(state.waterBodies)) {
    // Rivers keep their real names (Ganga, Assi, Varuna).
    out.waterBodies = state.waterBodies.map((w: { type?: string }) =>
      w.type === 'river' ? w : { ...w, name: pick(w.type === 'ocean' ? 'ocean' : 'lake') });
  }
  if (Array.isArray(state.adjacentCities)) {
    const usedCities = new Set<string>();
    out.adjacentCities = state.adjacentCities.map((c: object) => {
      let name = generateCityName();
      for (let i = 0; i < 20 && usedCities.has(name); i++) name = generateCityName();
      usedCities.add(name);
      return { ...c, name };
    });
  }
  if (Array.isArray(state.notifications)) {
    // Old saved notices quote dollars: show rupees instead.
    out.notifications = state.notifications.map((n: { description?: string }) =>
      typeof n.description === 'string' ? { ...n, description: n.description.replace(/\$(\d)/g, '₹$1') } : n);
  }
  return out as T;
}
