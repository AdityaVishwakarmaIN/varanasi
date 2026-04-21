import type { Building, BuildingType, BridgeOrientation, BridgeTrackType, BridgeType, Tile, ZoneType } from './types';
import { BUILDING_STATS } from './types';

const HEADER_INTS = 5;
const FIELD_COUNT = 12;
const HEADER_GAME_VERSION_INDEX = 2;
const HEADER_STRUCTURE_VERSION_INDEX = 3;
const HEADER_ROAD_NETWORK_VERSION_INDEX = 4;

const ZONE_VALUES: ZoneType[] = ['none', 'residential', 'commercial', 'industrial'];
const BUILDING_VALUES = Object.keys(BUILDING_STATS) as BuildingType[];

const BUILDING_FLAG_POWERED = 1 << 0;
const BUILDING_FLAG_WATERED = 1 << 1;
const BUILDING_FLAG_ON_FIRE = 1 << 2;
const BUILDING_FLAG_ABANDONED = 1 << 3;
const BUILDING_FLAG_FLIPPED = 1 << 4;

const MISC_FLAG_HAS_SUBWAY = 1 << 0;
const MISC_FLAG_HAS_RAIL_OVERLAY = 1 << 1;

const zoneToIndex = new Map(ZONE_VALUES.map((zone, index) => [zone, index] as const));
const buildingToIndex = new Map(BUILDING_VALUES.map((buildingType, index) => [buildingType, index] as const));

export interface IsoCityGridBufferViews {
  header: Int32Array;
  zone: Uint8Array;
  buildingType: Uint8Array;
  buildingLevel: Uint8Array;
  buildingFlags: Uint8Array;
  buildingRotation: Uint8Array;
  roadMask: Uint8Array;
  railMask: Uint8Array;
  landValue: Uint8Array;
  pollution: Uint8Array;
  crime: Uint8Array;
  traffic: Uint8Array;
  misc: Uint8Array;
}

export interface IsoCityBuildingExtra {
  population: number;
  jobs: number;
  fireProgress: number;
  age: number;
  constructionProgress: number;
  cityId?: string;
  bridgeType?: BridgeType;
  bridgeOrientation?: BridgeOrientation;
  bridgeVariant?: number;
  bridgePosition?: 'start' | 'middle' | 'end';
  bridgeIndex?: number;
  bridgeSpan?: number;
  bridgeTrackType?: BridgeTrackType;
}

export interface IsoCityGridBuffer {
  width: number;
  height: number;
  buffer: ArrayBuffer | SharedArrayBuffer;
  views: IsoCityGridBufferViews;
  extras: Map<number, IsoCityBuildingExtra>;
}

function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function readExtraFromBuilding(building: Building): IsoCityBuildingExtra | undefined {
  const extra: IsoCityBuildingExtra = {
    population: building.population,
    jobs: building.jobs,
    fireProgress: building.fireProgress,
    age: building.age,
    constructionProgress: building.constructionProgress,
    cityId: building.cityId,
    bridgeType: building.bridgeType,
    bridgeOrientation: building.bridgeOrientation,
    bridgeVariant: building.bridgeVariant,
    bridgePosition: building.bridgePosition,
    bridgeIndex: building.bridgeIndex,
    bridgeSpan: building.bridgeSpan,
    bridgeTrackType: building.bridgeTrackType,
  };

  const hasExtra =
    extra.population !== 0 ||
    extra.jobs !== 0 ||
    extra.fireProgress !== 0 ||
    extra.age !== 0 ||
    extra.constructionProgress !== 100 ||
    extra.cityId !== undefined ||
    extra.bridgeType !== undefined ||
    extra.bridgeOrientation !== undefined ||
    extra.bridgeVariant !== undefined ||
    extra.bridgePosition !== undefined ||
    extra.bridgeIndex !== undefined ||
    extra.bridgeSpan !== undefined ||
    extra.bridgeTrackType !== undefined;

  return hasExtra ? extra : undefined;
}

function createBuildingFromBuffer(
  buildingTypeIndex: number,
  buildingLevel: number,
  buildingFlags: number,
  extra: IsoCityBuildingExtra | undefined
): Building {
  return {
    type: BUILDING_VALUES[buildingTypeIndex] ?? 'grass',
    level: buildingLevel,
    population: extra?.population ?? 0,
    jobs: extra?.jobs ?? 0,
    powered: (buildingFlags & BUILDING_FLAG_POWERED) !== 0,
    watered: (buildingFlags & BUILDING_FLAG_WATERED) !== 0,
    onFire: (buildingFlags & BUILDING_FLAG_ON_FIRE) !== 0,
    fireProgress: extra?.fireProgress ?? 0,
    age: extra?.age ?? 0,
    constructionProgress: extra?.constructionProgress ?? 100,
    abandoned: (buildingFlags & BUILDING_FLAG_ABANDONED) !== 0,
    flipped: (buildingFlags & BUILDING_FLAG_FLIPPED) !== 0 || undefined,
    cityId: extra?.cityId,
    bridgeType: extra?.bridgeType,
    bridgeOrientation: extra?.bridgeOrientation,
    bridgeVariant: extra?.bridgeVariant,
    bridgePosition: extra?.bridgePosition,
    bridgeIndex: extra?.bridgeIndex,
    bridgeSpan: extra?.bridgeSpan,
    bridgeTrackType: extra?.bridgeTrackType,
  };
}

export function getIsoCityTileIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function getIsoCityGridBufferByteLength(width: number, height: number): number {
  const tileCount = width * height;
  return HEADER_INTS * Int32Array.BYTES_PER_ELEMENT + tileCount * FIELD_COUNT;
}

export function createIsoCityGridBuffer(
  width: number,
  height: number,
  options: {
    shared?: boolean;
    gameVersion?: number;
    structureVersion?: number;
    roadNetworkVersion?: number;
  } = {}
): IsoCityGridBuffer {
  const byteLength = getIsoCityGridBufferByteLength(width, height);
  const buffer = options.shared && typeof SharedArrayBuffer !== 'undefined'
    ? new SharedArrayBuffer(byteLength)
    : new ArrayBuffer(byteLength);

  const views = hydrateIsoCityGridBufferViews(buffer, width, height);
  views.header[0] = width;
  views.header[1] = height;
  views.header[HEADER_GAME_VERSION_INDEX] = options.gameVersion ?? 0;
  views.header[HEADER_STRUCTURE_VERSION_INDEX] = options.structureVersion ?? 0;
  views.header[HEADER_ROAD_NETWORK_VERSION_INDEX] = options.roadNetworkVersion ?? 0;

  return {
    width,
    height,
    buffer,
    views,
    extras: new Map(),
  };
}

export function hydrateIsoCityGridBufferViews(
  buffer: ArrayBuffer | SharedArrayBuffer,
  width: number,
  height: number
): IsoCityGridBufferViews {
  const tileCount = width * height;
  const headerBytes = HEADER_INTS * Int32Array.BYTES_PER_ELEMENT;
  let byteOffset = headerBytes;

  const nextField = () => {
    const view = new Uint8Array(buffer, byteOffset, tileCount);
    byteOffset += tileCount;
    return view;
  };

  return {
    header: new Int32Array(buffer, 0, HEADER_INTS),
    zone: nextField(),
    buildingType: nextField(),
    buildingLevel: nextField(),
    buildingFlags: nextField(),
    buildingRotation: nextField(),
    roadMask: nextField(),
    railMask: nextField(),
    landValue: nextField(),
    pollution: nextField(),
    crime: nextField(),
    traffic: nextField(),
    misc: nextField(),
  };
}

export function setIsoCityGridVersions(
  gridBuffer: IsoCityGridBuffer,
  versions: {
    gameVersion?: number;
    structureVersion?: number;
    roadNetworkVersion?: number;
  }
): void {
  if (versions.gameVersion !== undefined) {
    gridBuffer.views.header[HEADER_GAME_VERSION_INDEX] = versions.gameVersion;
  }
  if (versions.structureVersion !== undefined) {
    gridBuffer.views.header[HEADER_STRUCTURE_VERSION_INDEX] = versions.structureVersion;
  }
  if (versions.roadNetworkVersion !== undefined) {
    gridBuffer.views.header[HEADER_ROAD_NETWORK_VERSION_INDEX] = versions.roadNetworkVersion;
  }
}

export function copyLegacyGridToBuffer(gridBuffer: IsoCityGridBuffer, grid: Tile[][]): void {
  const { width, height, views, extras } = gridBuffer;
  extras.clear();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      const tileIndex = getIsoCityTileIndex(width, x, y);

      views.zone[tileIndex] = zoneToIndex.get(tile.zone) ?? 0;
      views.buildingType[tileIndex] = buildingToIndex.get(tile.building.type) ?? 0;
      views.buildingLevel[tileIndex] = clampToByte(tile.building.level);
      views.buildingFlags[tileIndex] =
        (tile.building.powered ? BUILDING_FLAG_POWERED : 0) |
        (tile.building.watered ? BUILDING_FLAG_WATERED : 0) |
        (tile.building.onFire ? BUILDING_FLAG_ON_FIRE : 0) |
        (tile.building.abandoned ? BUILDING_FLAG_ABANDONED : 0) |
        (tile.building.flipped ? BUILDING_FLAG_FLIPPED : 0);
      views.buildingRotation[tileIndex] = 0;
      views.roadMask[tileIndex] = 0;
      views.railMask[tileIndex] = 0;
      views.landValue[tileIndex] = clampToByte(tile.landValue);
      views.pollution[tileIndex] = clampToByte(tile.pollution);
      views.crime[tileIndex] = clampToByte(tile.crime);
      views.traffic[tileIndex] = clampToByte(tile.traffic);
      views.misc[tileIndex] =
        (tile.hasSubway ? MISC_FLAG_HAS_SUBWAY : 0) |
        (tile.hasRailOverlay ? MISC_FLAG_HAS_RAIL_OVERLAY : 0);

      const extra = readExtraFromBuilding(tile.building);
      if (extra) {
        extras.set(tileIndex, extra);
      }
    }
  }
}

export function createIsoCityGridBufferFromGrid(
  grid: Tile[][],
  width: number,
  height: number,
  versions: {
    gameVersion?: number;
    structureVersion?: number;
    roadNetworkVersion?: number;
  } = {}
): IsoCityGridBuffer {
  const gridBuffer = createIsoCityGridBuffer(width, height, versions);
  copyLegacyGridToBuffer(gridBuffer, grid);
  return gridBuffer;
}

export function getTileFromIsoCityGridBuffer(gridBuffer: IsoCityGridBuffer, x: number, y: number): Tile {
  const { width, views, extras } = gridBuffer;
  const tileIndex = getIsoCityTileIndex(width, x, y);
  const buildingFlags = views.buildingFlags[tileIndex];

  return {
    x,
    y,
    zone: ZONE_VALUES[views.zone[tileIndex]] ?? 'none',
    building: createBuildingFromBuffer(
      views.buildingType[tileIndex],
      views.buildingLevel[tileIndex],
      buildingFlags,
      extras.get(tileIndex)
    ),
    landValue: views.landValue[tileIndex],
    pollution: views.pollution[tileIndex],
    crime: views.crime[tileIndex],
    traffic: views.traffic[tileIndex],
    hasSubway: (views.misc[tileIndex] & MISC_FLAG_HAS_SUBWAY) !== 0,
    hasRailOverlay: (views.misc[tileIndex] & MISC_FLAG_HAS_RAIL_OVERLAY) !== 0 || undefined,
  };
}

export function serializeIsoCityGridBuffer(gridBuffer: IsoCityGridBuffer): Tile[][] {
  const grid: Tile[][] = [];

  for (let y = 0; y < gridBuffer.height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < gridBuffer.width; x++) {
      row.push(getTileFromIsoCityGridBuffer(gridBuffer, x, y));
    }
    grid.push(row);
  }

  return grid;
}

export function cloneIsoCityGridBuffer(gridBuffer: IsoCityGridBuffer): IsoCityGridBuffer {
  const next = createIsoCityGridBuffer(gridBuffer.width, gridBuffer.height, {
    gameVersion: gridBuffer.views.header[HEADER_GAME_VERSION_INDEX],
    structureVersion: gridBuffer.views.header[HEADER_STRUCTURE_VERSION_INDEX],
    roadNetworkVersion: gridBuffer.views.header[HEADER_ROAD_NETWORK_VERSION_INDEX],
  });

  new Uint8Array(next.buffer).set(new Uint8Array(gridBuffer.buffer));
  next.extras = new Map(gridBuffer.extras);
  return next;
}
