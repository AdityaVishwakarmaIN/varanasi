/**
 * Placement preview check (S1-T10): can the current tool be used on a tile, what does it cost,
 * and if not, why. Used by the green/red hover footprint and the cost label.
 *
 * The rules are NOT duplicated here: the check calls the same pure validators the simulation's
 * placement functions use (`validatePlacement` for `placeBuilding`, `canBulldozeTile`,
 * `canPlaceSubway`, `canPlaceWaterTerraform`, `canPlaceLandTerraform`), without building a new
 * state. The early-outs mirror the no-op / money guards in `GameContext.placeAtTile`.
 *
 * Pure: no React, DOM or window. The hover preview uses `getHoverPlacementCheck` (memoised).
 */
import { msg } from 'gt-next';
import { BuildingType, GameState, TOOL_INFO, Tool, ZoneType } from '@/types/game';
import { getBuildingDisplayName } from '@/games/isocity/maps/varanasiCatalog';
import {
  canBulldozeTile,
  canPlaceLandTerraform,
  canPlaceSubway,
  canPlaceWaterTerraform,
  findBuildingOrigin,
  getBuildingSize,
  getDevelopmentBlockers,
  validatePlacement,
  type PlacementRefusal,
} from '@/lib/simulation';

/** One tile of a multi-tile building's footprint and whether that tile can take it. */
export interface FootprintTile {
  x: number;
  y: number;
  ok: boolean;
}

export interface PlacementCheck {
  /** True if clicking would place / change something. */
  ok: boolean;
  /** Cost of one placement (per tile for roads and zones). */
  cost: number;
  /** Why it cannot be placed (translatable `msg()` string), when `ok` is false. */
  reason?: string;
  /** Non-blocking hint shown when `ok` is true (for example zones without road access). */
  warning?: string;
  /** Multi-tile buildings only: per footprint tile validity, for tinting each tile on its own. */
  footprint?: FootprintTile[];
}

export const PLACEMENT_REASONS = {
  notEnoughMoney: msg('Not enough money'),
  outOfMoney: msg('Out of money'),
  blocked: msg('Blocked'),
  water: msg("Can't build on water"),
  bridgeHint: msg('Drag across water to build a bridge'),
  needsWater: msg('Must be next to water'),
  outOfBounds: msg('Footprint goes off the map'),
  footprintRoad: msg('Footprint overlaps a road'),
  footprintRail: msg('Footprint overlaps a railway'),
  settlementResidentialOnly: msg('Settlements can only be zoned residential'),
  alreadyWater: msg('Already water'),
  bridgeInTheWay: msg("Can't terraform under a bridge"),
  alreadyBuilt: msg('Already built here'),
  alreadyZoned: msg('Already zoned'),
  nothingToRemove: msg('Nothing to remove'),
  notWater: msg('Only works on water'),
  outsideMap: msg('Outside the map'),
  needsRoad: msg('Needs road access to grow'),
  ghatWestBank: msg("Ghats must be on the Ganga's west bank"),
  waterWorksNearGanga: msg('Jal Sansthan Water Works must be within 3 tiles of the Ganga'),
  embankmentNearGanga: msg('Embankments must be on land within 4 tiles of the Ganga'),
  embankmentOnGhat: msg("Embankments can't be built on ghats"),
} as const;

/** Tools that are not a building of the same name (mirrors `toolBuildingMap` in GameContext). */
const NON_BUILDING_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
  'select',
  'bulldoze',
  'subway',
  'expand_city',
  'shrink_city',
  'zone_residential',
  'zone_commercial',
  'zone_industrial',
  'zone_dezone',
  'zone_water',
  'zone_land',
]);

/** Zone set by a zoning tool (mirrors `toolZoneMap` in GameContext). */
const TOOL_ZONES: Partial<Record<Tool, ZoneType>> = {
  zone_residential: 'residential',
  zone_commercial: 'commercial',
  zone_industrial: 'industrial',
  zone_dezone: 'none',
};

/** The building a tool places, or null for zoning / bulldoze / terraform / subway tools. */
export function getToolBuilding(tool: Tool): BuildingType | null {
  return NON_BUILDING_TOOLS.has(tool) ? null : (tool as BuildingType);
}

export function getToolZone(tool: Tool): ZoneType | null {
  return TOOL_ZONES[tool] ?? null;
}

/** Tile footprint (width, height) a tool previews at the hovered tile. */
export function getToolFootprint(tool: Tool): { width: number; height: number } {
  const building = getToolBuilding(tool);
  return building ? getBuildingSize(building) : { width: 1, height: 1 };
}

/**
 * The placement check for one tile: is the tool's action valid here, what does it cost, and why not.
 * Validity first, then money, so a blocked tile says why it is blocked. The rules come from the
 * simulation's own validators (`validatePlacement`, `canBulldozeTile`, ...): no state is built.
 */
export function getPlacementCheck(state: GameState, tool: Tool, x: number, y: number): PlacementCheck {
  const cost = TOOL_INFO[tool]?.cost ?? 0;
  if (tool === 'select' || tool === 'expand_city' || tool === 'shrink_city') return { ok: true, cost: 0 };

  const refusal = getRefusal(state, tool, x, y);
  const footprint = getFootprintValidity(state, tool, x, y, refusal);
  const withFootprint = <T extends PlacementCheck>(check: T): T => (footprint ? { ...check, footprint } : check);
  if (refusal) return withFootprint({ ok: false, cost, reason: refusal.reason });

  if (cost > 0 && state.stats.money < cost) {
    const unaffordable = footprint?.map((t) => ({ ...t, ok: false }));
    return unaffordable
      ? { ok: false, cost, reason: PLACEMENT_REASONS.notEnoughMoney, footprint: unaffordable }
      : { ok: false, cost, reason: PLACEMENT_REASONS.notEnoughMoney };
  }

  const zone = getToolZone(tool);
  const warning = zone && zone !== 'none' ? getZoneWarning(state, x, y, zone) : undefined;
  return withFootprint(warning ? { ok: true, cost, warning } : { ok: true, cost });
}

let hoverMemo: { key: readonly unknown[]; check: PlacementCheck } | null = null;

/**
 * `getPlacementCheck` memoised on its last call, for the hover preview (called on every pointer move
 * and re-render). Keyed by the grid reference (placements and ticks replace it), the tool, the tile,
 * and the few non-grid inputs the rules read (money, population for landmark unlocks, built landmarks).
 */
export function getHoverPlacementCheck(state: GameState, tool: Tool, x: number, y: number): PlacementCheck {
  const key = [state.grid, tool, x, y, state.stats.money, state.stats.population, state.landmarksBuilt, state.mapId] as const;
  if (hoverMemo && hoverMemo.key.length === key.length && hoverMemo.key.every((v, i) => v === key[i])) return hoverMemo.check;
  const check = getPlacementCheck(state, tool, x, y);
  hoverMemo = { key, check };
  return check;
}

export interface AreaCheck {
  /** Tiles in the area where the tool would actually do something. */
  validTiles: number;
  /** What those tiles cost together. */
  totalCost: number;
  /** True when the city can pay `totalCost` now. */
  affordable: boolean;
}

/**
 * Dry run of a drag: the rectangle (or straight line) between two tiles, inclusive. Counts only the
 * tiles the tool would change (not water, already-zoned or blocked tiles) and prices them. Pure.
 */
export function checkPlacementArea(
  state: GameState,
  tool: Tool,
  from: { x: number; y: number },
  to: { x: number; y: number },
): AreaCheck {
  const cost = TOOL_INFO[tool]?.cost ?? 0;
  let validTiles = 0;
  for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++) {
    for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) {
      if (!getRefusal(state, tool, x, y)) validTiles++;
    }
  }
  const totalCost = validTiles * cost;
  return { validTiles, totalCost, affordable: totalCost <= state.stats.money };
}

type Refusal = { reason: string; refusal?: PlacementRefusal };

/** Why the tool cannot act on (x, y), ignoring money; null when it can. */
function getRefusal(state: GameState, tool: Tool, x: number, y: number): Refusal | null {
  const tile = state.grid[y]?.[x];
  if (!tile) return { reason: PLACEMENT_REASONS.outsideMap };
  const zone = getToolZone(tool);
  const building = getToolBuilding(tool);

  // No-op guards (same as GameContext.placeAtTile): nothing would change, so nothing is charged
  if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
    return { reason: PLACEMENT_REASONS.nothingToRemove };
  }
  if (zone && tile.zone === zone) {
    return { reason: zone === 'none' ? PLACEMENT_REASONS.nothingToRemove : PLACEMENT_REASONS.alreadyZoned };
  }
  if (building && tile.building.type === building) return { reason: PLACEMENT_REASONS.alreadyBuilt };

  switch (tool) {
    case 'bulldoze':
      return canBulldozeTile(state, x, y) ? null : { reason: PLACEMENT_REASONS.nothingToRemove };
    case 'subway':
      if (tile.hasSubway) return { reason: PLACEMENT_REASONS.alreadyBuilt };
      return canPlaceSubway(state, x, y) ? null : { reason: PLACEMENT_REASONS.water };
    case 'zone_water':
      if (canPlaceWaterTerraform(state, x, y)) return null;
      return { reason: tile.building.type === 'bridge' ? PLACEMENT_REASONS.bridgeInTheWay : PLACEMENT_REASONS.alreadyWater };
    case 'zone_land':
      return canPlaceLandTerraform(state, x, y) ? null : { reason: PLACEMENT_REASONS.notWater };
  }
  if (!zone && !building) return { reason: PLACEMENT_REASONS.blocked };

  const result = validatePlacement(state, x, y, building, zone);
  if (result.ok) return null;
  return { reason: explainRefusal(state, building, x, y, result.refusal, result.landmarkReason), refusal: result.refusal };
}

/** Player-facing text for a refusal from `validatePlacement`. */
function explainRefusal(
  state: GameState,
  building: BuildingType | null,
  x: number,
  y: number,
  refusal: PlacementRefusal,
  landmarkReason?: string,
): string {
  const tile = state.grid[y][x];
  const size = building ? getBuildingSize(building) : { width: 1, height: 1 };
  const multiTile = size.width > 1 || size.height > 1;
  switch (refusal) {
    case 'outsideMap':
      return PLACEMENT_REASONS.outsideMap;
    case 'water':
      return building === 'road' || building === 'rail' ? PLACEMENT_REASONS.bridgeHint : PLACEMENT_REASONS.water;
    case 'road':
      return multiTile ? PLACEMENT_REASONS.footprintRoad : occupiedBy(state, x, y);
    case 'rail':
      return multiTile ? PLACEMENT_REASONS.footprintRail : occupiedBy(state, x, y);
    case 'occupied':
      if (building === 'embankment' && tile.building.type === 'ghat') return PLACEMENT_REASONS.embankmentOnGhat;
      return occupiedBy(state, x, y);
    case 'notZonable':
      return PLACEMENT_REASONS.settlementResidentialOnly;
    case 'nothingToDezone':
      return PLACEMENT_REASONS.nothingToRemove;
    case 'ghat':
      return PLACEMENT_REASONS.ghatWestBank;
    case 'waterWorks':
      return footprintTiles(state, x, y, size.width, size.height).some((t) => t?.building.type === 'water')
        ? PLACEMENT_REASONS.water
        : PLACEMENT_REASONS.waterWorksNearGanga;
    case 'embankment':
      return PLACEMENT_REASONS.embankmentNearGanga;
    case 'landmark':
      return landmarkReason ?? PLACEMENT_REASONS.blocked;
    case 'needsWater':
      return PLACEMENT_REASONS.needsWater;
    case 'offMap':
      return PLACEMENT_REASONS.outOfBounds;
    case 'footprint': {
      // Name the first footprint tile that is in the way
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          const t = state.grid[y + dy]?.[x + dx];
          if (!t) return PLACEMENT_REASONS.outOfBounds;
          if (isFreeFootprintTile(t.building.type)) continue;
          if (t.building.type === 'water') return PLACEMENT_REASONS.water;
          if (t.building.type === 'road' || t.building.type === 'bridge') return PLACEMENT_REASONS.footprintRoad;
          if (t.building.type === 'rail') return PLACEMENT_REASONS.footprintRail;
          return occupiedBy(state, x + dx, y + dy);
        }
      }
      return PLACEMENT_REASONS.blocked;
    }
  }
}

/** Multi-tile buildings need grass or trees under every footprint tile (as in canPlaceMultiTileBuilding). */
function isFreeFootprintTile(type: BuildingType): boolean {
  return type === 'grass' || type === 'tree';
}

/** Refusals that come from individual footprint tiles, so each tile can be tinted on its own. */
const TILE_LEVEL_REFUSALS: ReadonlySet<PlacementRefusal> = new Set<PlacementRefusal>(['water', 'occupied', 'road', 'rail', 'footprint']);

/**
 * Per-tile validity of a multi-tile building's footprint (row by row from the hovered tile), so the
 * preview can mark the tiles that are in the way. Undefined for single-tile tools.
 */
function getFootprintValidity(
  state: GameState,
  tool: Tool,
  x: number,
  y: number,
  refusal: Refusal | null,
): FootprintTile[] | undefined {
  const building = getToolBuilding(tool);
  if (!building) return undefined;
  const { width, height } = getBuildingSize(building);
  if (width === 1 && height === 1) return undefined;
  const perTile = !!refusal?.refusal && TILE_LEVEL_REFUSALS.has(refusal.refusal);
  const tiles: FootprintTile[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const t = state.grid[y + dy]?.[x + dx];
      tiles.push({ x: x + dx, y: y + dy, ok: perTile ? !!t && isFreeFootprintTile(t.building.type) : !refusal });
    }
  }
  return tiles;
}

function footprintTiles(state: GameState, x: number, y: number, w: number, h: number) {
  const tiles = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) tiles.push(state.grid[y + dy]?.[x + dx]);
  return tiles;
}

/** "Occupied by {name} — bulldoze first", naming the building on the tile (or the one whose footprint covers it). */
function occupiedBy(state: GameState, x: number, y: number): string {
  let type = state.grid[y][x].building.type;
  if (type === 'empty') type = findBuildingOrigin(state.grid, x, y, state.gridSize)?.buildingType ?? type;
  return msg('Occupied by {name} — bulldoze first', { name: getBuildingName(type, state) });
}

/** Display name of a building type (the map's own name when it renames it). */
export function getBuildingName(type: BuildingType, state: Pick<GameState, 'mapId'>): string {
  const named = getBuildingDisplayName(type, state.mapId) ?? TOOL_INFO[type as Tool]?.name;
  if (named) return named;
  const words = type.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Zones can be painted anywhere, but only grow with road access: warn (not block) when missing. */
function getZoneWarning(state: GameState, x: number, y: number, zone: ZoneType): string | undefined {
  // Evaluate the existing development rules on a copy where only this tile is zoned.
  const row = state.grid[y].slice();
  row[x] = { ...row[x], zone };
  const grid = state.grid.slice();
  grid[y] = row;
  const blockers = getDevelopmentBlockers({ ...state, grid }, x, y);
  return blockers.some((b) => b.reason === 'No road access') ? PLACEMENT_REASONS.needsRoad : undefined;
}
