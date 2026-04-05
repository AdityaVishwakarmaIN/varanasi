import type { CloudSpriteKey, CloudType, CloudWeatherMode } from './types';

type CloudSpriteDefinition = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  baseWidth: number;
};

// The runtime cloud sheet is aggressively resized to keep the transparent WebP
// under the project asset budget while preserving enough per-cell detail.
const CLOUD_SPRITE_SHEET_SIZE = 960;
const CLOUD_SPRITE_GRID_SIZE = 3;
const CLOUD_SPRITE_CELL_SIZE = CLOUD_SPRITE_SHEET_SIZE / CLOUD_SPRITE_GRID_SIZE;

type Insets = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const buildSpriteDefinition = (
  col: number,
  row: number,
  insets: Insets,
  baseWidth: number
): CloudSpriteDefinition => {
  const sx = col * CLOUD_SPRITE_CELL_SIZE + insets.left * CLOUD_SPRITE_CELL_SIZE;
  const sy = row * CLOUD_SPRITE_CELL_SIZE + insets.top * CLOUD_SPRITE_CELL_SIZE;
  const sw = CLOUD_SPRITE_CELL_SIZE * (1 - insets.left - insets.right);
  const sh = CLOUD_SPRITE_CELL_SIZE * (1 - insets.top - insets.bottom);

  return { sx, sy, sw, sh, baseWidth };
};

export const CLOUD_SPRITE_SHEET_SRC = '/assets/cloud-grid-images.png';

export const CLOUD_SPRITES: Record<CloudSpriteKey, CloudSpriteDefinition> = {
  cirrus_faint: buildSpriteDefinition(0, 0, { left: 0.08, top: 0.14, right: 0.1, bottom: 0.2 }, 150),
  cirrus_thin: buildSpriteDefinition(1, 0, { left: 0.1, top: 0.14, right: 0.1, bottom: 0.18 }, 166),
  cumulus_soft: buildSpriteDefinition(2, 0, { left: 0.08, top: 0.08, right: 0.06, bottom: 0.1 }, 172),
  altocumulus_patchy: buildSpriteDefinition(0, 1, { left: 0.05, top: 0.08, right: 0.06, bottom: 0.1 }, 182),
  stratus_layered: buildSpriteDefinition(1, 1, { left: 0.06, top: 0.1, right: 0.06, bottom: 0.12 }, 194),
  stratus_overcast: buildSpriteDefinition(2, 1, { left: 0.05, top: 0.09, right: 0.06, bottom: 0.1 }, 202),
  cumulonimbus_heavy: buildSpriteDefinition(0, 2, { left: 0.04, top: 0.05, right: 0.05, bottom: 0.06 }, 184),
  cumulonimbus_rain: buildSpriteDefinition(1, 2, { left: 0.07, top: 0.04, right: 0.08, bottom: 0.05 }, 192),
  cumulonimbus_severe: buildSpriteDefinition(2, 2, { left: 0.08, top: 0.05, right: 0.18, bottom: 0.16 }, 198),
};

type WeatherSpritePools = Record<CloudWeatherMode, readonly CloudSpriteKey[]>;

export const CLOUD_SPRITES_BY_WEATHER: WeatherSpritePools = {
  clear: [],
  light_clouds: [
    'cirrus_faint',
    'cirrus_thin',
    'cumulus_soft',
    'altocumulus_patchy',
    'stratus_layered',
  ],
  storm: [
    'stratus_layered',
    'stratus_overcast',
    'cumulonimbus_heavy',
    'cumulonimbus_rain',
  ],
  severe_storm: [
    'stratus_overcast',
    'cumulonimbus_heavy',
    'cumulonimbus_rain',
    'cumulonimbus_severe',
  ],
};

const pickRandomSprite = (sprites: readonly CloudSpriteKey[]): CloudSpriteKey => (
  sprites[Math.floor(Math.random() * sprites.length)] ?? 'cumulus_soft'
);

export const pickCloudSpriteKey = (
  cloudType: CloudType,
  weatherMode: CloudWeatherMode
): CloudSpriteKey => {
  switch (cloudType) {
    case 'cirrus':
      return weatherMode === 'light_clouds'
        ? pickRandomSprite(['cirrus_faint', 'cirrus_thin'])
        : 'cirrus_thin';
    case 'cumulus':
      if (weatherMode === 'storm') {
        return 'stratus_layered';
      }
      if (weatherMode === 'severe_storm') {
        return 'stratus_overcast';
      }
      return 'cumulus_soft';
    case 'altocumulus':
      if (weatherMode === 'storm') {
        return 'stratus_layered';
      }
      if (weatherMode === 'severe_storm') {
        return 'stratus_overcast';
      }
      return 'altocumulus_patchy';
    case 'stratus':
      if (weatherMode === 'light_clouds') {
        return 'stratus_layered';
      }
      return pickRandomSprite(
        weatherMode === 'storm'
          ? ['stratus_layered', 'stratus_overcast']
          : ['stratus_overcast', 'cumulonimbus_heavy']
      );
    case 'cumulonimbus':
      if (weatherMode === 'severe_storm') {
        return pickRandomSprite([
          'cumulonimbus_heavy',
          'cumulonimbus_rain',
          'cumulonimbus_severe',
          'cumulonimbus_severe',
        ]);
      }
      return pickRandomSprite(['cumulonimbus_heavy', 'cumulonimbus_rain']);
    default:
      return pickRandomSprite(CLOUD_SPRITES_BY_WEATHER[weatherMode]);
  }
};

export const getCloudSpriteDefinition = (spriteKey: CloudSpriteKey): CloudSpriteDefinition => CLOUD_SPRITES[spriteKey];
