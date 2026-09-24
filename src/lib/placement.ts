/**
 * Placement preview check (S1-T10): can the current tool be used on a tile, what does it cost,
 * and if not, why. Used by the green/red hover footprint and the cost label.
 *
 * The rules are NOT duplicated here: the check does a dry run of the same pure simulation
 * functions the game calls on click (`placeBuilding`, `bulldozeTile`, `placeSubway`,
 * `placeWaterTerraform`, `placeLandTerraform`). They return the *same* state object when the
 * placement is refused. The early-outs below mirror the no-op / money guards in
 * `GameContext.placeAtTile`. The `reason` text is only chosen after the dry run said "no".
 *
 * Pure: no React, DOM or window. Cost is one grid copy per call (~2 ms on a 160×160 map), so
 * callers should memoise on (tool, tile, grid) and not call it every frame.
 */
import { msg } from 'gt-next';
import { BuildingType, GameState, TOOL_INFO, Tool, ZoneType } from '@/types/game';
import {
  bulldozeTile,
  getBuildingSize,
  getDevelopmentBlockers,
  getWaterAdjacency,
  placeBuilding,
  placeLandTerraform,
  placeSubway,
  placeWaterTerraform,
  requiresWaterAdjacency,
} from '@/lib/simulation';

export interface PlacementCheck {
  /** True if clicking would place / change something. */
  ok: boolean;
  /** Cost of one placement (per tile for roads and zones). */
  cost: number;
  /** Why it cannot be placed (translatable `msg()` string), when `ok` is false. */
  reason?: string;
  /** Non-blocking hint shown when `ok` is true (for example zones without road access). */
  warning?: string;
}

export const PLACEMENT_REASONS = {
  notEnoughMoney: msg('Not enough money'),
  blocked: msg('Blocked'),
  water: msg("Can't build on water"),
  bridgeHint: msg('Drag across water to build a bridge'),
  needsWater: msg('Must be next to water'),
  outOfBounds: msg("Doesn't fit on the map"),
  alreadyBuilt: msg('Already built here'),
  alreadyZoned: msg('Already zoned'),
  nothingToRemove: msg('Nothing to remove'),
  notWater: msg('Only works on water'),
  outsideMap: msg('Outside the map'),
  needsRoad: msg('Needs road access to grow'),
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

export function getPlacementCheck(state: GameState, tool: Tool, x: number, y: number): PlacementCheck {
  const cost = TOOL_INFO[tool]?.cost ?? 0;
  const tile = state.grid[y]?.[x];
  if (tool === 'select' || tool === 'expand_city' || tool === 'shrink_city') return { ok: true, cost: 0 };
  if (!tile) return { ok: false, cost, reason: PLACEMENT_REASONS.outsideMap };

  const zone = getToolZone(tool);
  const building = getToolBuilding(tool);

  // No-op guards (same order as GameContext.placeAtTile).
  if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
    return { ok: false, cost, reason: PLACEMENT_REASONS.nothingToRemove };
  }
  if (zone && tile.zone === zone) {
    return { ok: false, cost, reason: zone === 'none' ? PLACEMENT_REASONS.nothingToRemove : PLACEMENT_REASONS.alreadyZoned };
  }
  if (building && tile.building.type === building) {
    return { ok: false, cost, reason: PLACEMENT_REASONS.alreadyBuilt };
  }

  // Dry run of the real placement rule.
  let next: GameState;
  if (tool === 'bulldoze') next = bulldozeTile(state, x, y);
  else if (tool === 'subway') next = tile.hasSubway ? state : placeSubway(state, x, y);
  else if (tool === 'zone_water') next = placeWaterTerraform(state, x, y);
  else if (tool === 'zone_land') next = placeLandTerraform(state, x, y);
  else if (zone) next = placeBuilding(state, x, y, null, zone);
  else if (building) next = placeBuilding(state, x, y, building, null);
  else return { ok: false, cost, reason: PLACEMENT_REASONS.blocked };

  if (next === state) {
    return { ok: false, cost, reason: explainRefusal(state, tool, building, x, y) };
  }

  // Money is checked after validity so a blocked tile says why it is blocked.
  if (cost > 0 && state.stats.money < cost) {
    return { ok: false, cost, reason: PLACEMENT_REASONS.notEnoughMoney };
  }

  const warning = zone && zone !== 'none' ? getZoneWarning(state, x, y, zone) : undefined;
  return warning ? { ok: true, cost, warning } : { ok: true, cost };
}

/** Pick a human-readable reason for a placement the simulation refused. */
function explainRefusal(state: GameState, tool: Tool, building: BuildingType | null, x: number, y: number): string {
  const tile = state.grid[y][x];
  if (tool === 'zone_land') return PLACEMENT_REASONS.notWater;
  if (tool === 'subway' && tile.hasSubway) return PLACEMENT_REASONS.alreadyBuilt;
  if (tile.building.type === 'water') {
    return building === 'road' || building === 'rail' ? PLACEMENT_REASONS.bridgeHint : PLACEMENT_REASONS.water;
  }
  if (building) {
    const size = getBuildingSize(building);
    if (x + size.width > state.gridSize || y + size.height > state.gridSize) return PLACEMENT_REASONS.outOfBounds;
    if (requiresWaterAdjacency(building)) {
      const waterCheck = getWaterAdjacency(state.grid, x, y, size.width, size.height, state.gridSize);
      if (!waterCheck.hasWater) return PLACEMENT_REASONS.needsWater;
    }
  }
  return PLACEMENT_REASONS.blocked;
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
