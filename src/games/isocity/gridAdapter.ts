import type { BuildingType, Tile, ZoneType } from './types';
import {
  createIsoCityGridBufferFromGrid,
  getIsoCityTileIndex,
  getTileFromIsoCityGridBuffer,
  IsoCityBuildingExtra,
  IsoCityGridBuffer,
} from './gridBuffer';

export type IsoCityTileFieldPath =
  | 'zone'
  | 'landValue'
  | 'pollution'
  | 'crime'
  | 'traffic'
  | 'hasSubway'
  | 'hasRailOverlay'
  | 'building.type'
  | 'building.level'
  | 'building.powered'
  | 'building.watered'
  | 'building.onFire'
  | 'building.abandoned'
  | 'building.flipped'
  | 'building.population'
  | 'building.jobs'
  | 'building.fireProgress'
  | 'building.age'
  | 'building.constructionProgress';

const ZONE_VALUES: ZoneType[] = ['none', 'residential', 'commercial', 'industrial'];

export interface IsoCityGridAdapter {
  gridBuffer: IsoCityGridBuffer;
  getTile: (x: number, y: number) => Tile;
  setTileField: (x: number, y: number, field: IsoCityTileFieldPath, value: unknown) => void;
  setBuildingExtra: (x: number, y: number, value: Partial<IsoCityBuildingExtra>) => void;
}

export function createIsoCityGridAdapter(gridBuffer: IsoCityGridBuffer): IsoCityGridAdapter {
  const setTileField = (x: number, y: number, field: IsoCityTileFieldPath, value: unknown) => {
    const tileIndex = getIsoCityTileIndex(gridBuffer.width, x, y);
    const { views } = gridBuffer;

    switch (field) {
      case 'zone':
        views.zone[tileIndex] = Math.max(0, ZONE_VALUES.indexOf(value as ZoneType));
        return;
      case 'landValue':
        views.landValue[tileIndex] = Number(value) & 0xff;
        return;
      case 'pollution':
        views.pollution[tileIndex] = Number(value) & 0xff;
        return;
      case 'crime':
        views.crime[tileIndex] = Number(value) & 0xff;
        return;
      case 'traffic':
        views.traffic[tileIndex] = Number(value) & 0xff;
        return;
      case 'hasSubway':
        views.misc[tileIndex] = value
          ? views.misc[tileIndex] | 1
          : views.misc[tileIndex] & ~1;
        return;
      case 'hasRailOverlay':
        views.misc[tileIndex] = value
          ? views.misc[tileIndex] | (1 << 1)
          : views.misc[tileIndex] & ~(1 << 1);
        return;
      case 'building.type': {
        const currentTile = getTileFromIsoCityGridBuffer(gridBuffer, x, y);
        currentTile.building.type = value as BuildingType;
        const nextBuffer = createIsoCityGridBufferFromGrid([[currentTile]], 1, 1);
        views.buildingType[tileIndex] = nextBuffer.views.buildingType[0];
        return;
      }
      case 'building.level':
        views.buildingLevel[tileIndex] = Number(value) & 0xff;
        return;
      case 'building.powered':
        views.buildingFlags[tileIndex] = value
          ? views.buildingFlags[tileIndex] | 1
          : views.buildingFlags[tileIndex] & ~1;
        return;
      case 'building.watered':
        views.buildingFlags[tileIndex] = value
          ? views.buildingFlags[tileIndex] | (1 << 1)
          : views.buildingFlags[tileIndex] & ~(1 << 1);
        return;
      case 'building.onFire':
        views.buildingFlags[tileIndex] = value
          ? views.buildingFlags[tileIndex] | (1 << 2)
          : views.buildingFlags[tileIndex] & ~(1 << 2);
        return;
      case 'building.abandoned':
        views.buildingFlags[tileIndex] = value
          ? views.buildingFlags[tileIndex] | (1 << 3)
          : views.buildingFlags[tileIndex] & ~(1 << 3);
        return;
      case 'building.flipped':
        views.buildingFlags[tileIndex] = value
          ? views.buildingFlags[tileIndex] | (1 << 4)
          : views.buildingFlags[tileIndex] & ~(1 << 4);
        return;
      case 'building.population':
      case 'building.jobs':
      case 'building.fireProgress':
      case 'building.age':
      case 'building.constructionProgress': {
        const current = gridBuffer.extras.get(tileIndex) ?? {
          population: 0,
          jobs: 0,
          fireProgress: 0,
          age: 0,
          constructionProgress: 100,
        };
        const key = field.replace('building.', '') as keyof IsoCityBuildingExtra;
        current[key] = Number(value) as never;
        gridBuffer.extras.set(tileIndex, current);
      }
    }
  };

  return {
    gridBuffer,
    getTile: (x: number, y: number) => getTileFromIsoCityGridBuffer(gridBuffer, x, y),
    setTileField,
    setBuildingExtra: (x: number, y: number, value: Partial<IsoCityBuildingExtra>) => {
      const tileIndex = getIsoCityTileIndex(gridBuffer.width, x, y);
      const current = gridBuffer.extras.get(tileIndex) ?? {
        population: 0,
        jobs: 0,
        fireProgress: 0,
        age: 0,
        constructionProgress: 100,
      };
      gridBuffer.extras.set(tileIndex, { ...current, ...value });
    },
  };
}
