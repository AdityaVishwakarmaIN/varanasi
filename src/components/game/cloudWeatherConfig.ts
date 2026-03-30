import type { CloudType, CloudWeatherMode } from './types';

type LightningProfile = 'none' | 'rare' | 'rapid';

export type CloudWeatherConfig = {
  showClouds: boolean; // Turns cloud rendering on or off for this weather mode.
  cloudCountMultiplier: number; // Scales how many clouds this mode is allowed to show.
  spawnIntervalMultiplier: number; // Slows down or speeds up cloud spawning.
  opacityMultiplier: number; // Boosts or reduces cloud transparency.
  scaleMultiplier: number; // Scales the overall size of each cloud.
  typeWeightMultiplier: Record<CloudType, number>; // Changes which cloud shapes are more likely.
  palette: 'light' | 'storm' | 'severe'; // Picks the color palette used for cloud rendering.
  lightningProfile: LightningProfile; // Selects the lightning timing for this mode.
};

// Global cloud visibility and movement controls.
export const CLOUD_MIN_ZOOM = 0.2; // Lowest zoom where clouds should still appear.
export const CLOUD_MAX_ZOOM = 1.0; // Zoom level where clouds start fading out.
export const CLOUD_FADE_ZOOM = 1.6; // Zoom level where clouds are fully hidden.
export const CLOUD_MAX_COVERAGE = 0.35; // Coverage level where clouds start fading.
export const CLOUD_COVERAGE_FADE_END = 0.7; // Coverage level where clouds are fully faded.
export const CLOUD_WIDTH = 150; // Approximate cloud width used for spawn placement.
export const CLOUD_DESPAWN_MARGIN = 300; // Extra distance past the viewport before despawn.
export const CLOUD_WIND_ANGLE = -Math.PI / 4; // Direction clouds drift across the map.
export const CLOUD_LAYER_SPEEDS = [0.7, 1.0, 1.4]; // How fast each altitude layer moves.
export const CLOUD_LAYER_OPACITY = [0.85, 1.0, 0.9]; // Baseline opacity for each altitude layer.
export const CLOUD_NIGHT_OPACITY_MULT = 0.6; // How much clouds dim at night.

// Base cloud sizing and spawn tuning.
// These remain grouped here so the renderer's main "volume" knobs are easy to find.
export const CLOUD_MAX_COUNT = 36; // Maximum number of clouds on desktop.
export const CLOUD_MAX_COUNT_MOBILE = 20; // Maximum number of clouds on mobile.
export const CLOUD_SPAWN_INTERVAL = 1.0; // Seconds between cloud spawn attempts.
export const CLOUD_SPAWN_INTERVAL_MOBILE = 1.8; // Slower spawn pacing on mobile.
export const CLOUD_SPEED_MIN = 20; // Slowest cloud drift speed.
export const CLOUD_SPEED_MAX = 60; // Fastest cloud drift speed.
export const CLOUD_SCALE_MIN = 0.5; // Smallest base cloud scale.
export const CLOUD_SCALE_MAX = 1.8; // Largest base cloud scale.
export const CLOUD_PUFF_COUNT_MIN = 4; // Fewest puffs used to build a cloud.
export const CLOUD_PUFF_COUNT_MAX = 10; // Most puffs used to build a cloud.
export const CLOUD_PUFF_SIZE_MIN = 20; // Smallest puff radius.
export const CLOUD_PUFF_SIZE_MAX = 55; // Largest puff radius.

export const DEFAULT_CLOUD_WEATHER_MODE: CloudWeatherMode = 'clear'; // Weather used when the game starts or resets.
export const CLOUD_WEATHER_CHANGE_INTERVAL = 15; // Seconds between automatic weather rolls.

export const CLOUD_WEATHER_PROBABILITY_SPLIT: Array<{ mode: CloudWeatherMode; probability: number }> = [
  // Clear: most common state.
  { mode: 'clear', probability: 0.4 },
  // Light clouds: common, but not dominant.
  { mode: 'light_clouds', probability: 0.3 },
  // Storm: less common than calm weather.
  { mode: 'storm', probability: 0.2 },
  // Severe storm: the rarest roll.
  { mode: 'severe_storm', probability: 0.1 },
];

// Weather profiles are grouped here so density, opacity, scale, and lightning stay in sync.
export const CLOUD_WEATHER_CONFIG: Record<CloudWeatherMode, CloudWeatherConfig> = {
  // Clear: no clouds and no lightning.
  clear: {
    showClouds: false, // Hide the cloud layer entirely.
    cloudCountMultiplier: 0, // No clouds should appear in clear weather.
    spawnIntervalMultiplier: 1, // Keep the baseline spawn timing unchanged.
    opacityMultiplier: 0, // Clear weather does not render clouds.
    scaleMultiplier: 1, // Keep the base size unchanged even though clouds are hidden.
    typeWeightMultiplier: {
      cumulus: 0,
      stratus: 0,
      cirrus: 0,
      cumulonimbus: 0,
      altocumulus: 0,
    },
    palette: 'light', // Bright palette is kept as the default fallback.
    lightningProfile: 'none', // Clear weather has no lightning.
  },
  // Light clouds: sparse, bright, and calm.
  light_clouds: {
    showClouds: true, // Show a light sky layer.
    cloudCountMultiplier: 0.45, // Keep the sky mostly open.
    spawnIntervalMultiplier: 1.6, // Spawn clouds more slowly than the baseline.
    opacityMultiplier: 0.35, // Keep clouds soft and airy.
    scaleMultiplier: 0.95, // Slightly reduce cloud size.
    typeWeightMultiplier: {
      cumulus: 1.0,
      stratus: 0.35,
      cirrus: 1.25,
      cumulonimbus: 0,
      altocumulus: 1.0,
    },
    palette: 'light', // Use the bright fair-weather palette.
    lightningProfile: 'none', // Calm skies do not flash.
  },
  // Storm: denser clouds, darker tones, rare lightning.
  storm: {
    showClouds: true, // Keep clouds visible through the storm.
    cloudCountMultiplier: 0.72, // Fill more of the sky.
    spawnIntervalMultiplier: 1.15, // Spawn clouds a little less often.
    opacityMultiplier: 1.3, // Make storm clouds feel heavier.
    scaleMultiplier: 1.1, // Slightly enlarge storm clouds.
    typeWeightMultiplier: {
      cumulus: 0,
      stratus: 1.5,
      cirrus: 0,
      cumulonimbus: 1.9,
      altocumulus: 0.6,
    },
    palette: 'storm', // Use darker storm tones.
    lightningProfile: 'rare', // Storms flash occasionally.
  },
  // Severe storm: strongest coverage, darkest palette, and rapid lightning.
  severe_storm: {
    showClouds: true, // Keep the sky fully active.
    cloudCountMultiplier: 2.46, // Push cloud coverage close to the cap.
    spawnIntervalMultiplier: 1.0, // Use the base spawn pacing.
    opacityMultiplier: 1.75, // Make the storm clouds much darker.
    scaleMultiplier: 1.2, // Make the storm clouds feel larger and heavier.
    typeWeightMultiplier: {
      cumulus: 0,
      stratus: 1.2,
      cirrus: 0,
      cumulonimbus: 2.3,
      altocumulus: 0.25,
    },
    palette: 'severe', // Use the darkest palette.
    lightningProfile: 'rapid', // Severe storms flash quickly.
  },
};

export const CLOUD_LIGHTNING_CONFIG: Record<LightningProfile, {
  minInterval: number; // Shortest wait between lightning strikes.
  maxInterval: number; // Longest wait between lightning strikes.
  durationMin: number; // Minimum time a bolt stays visible.
  durationMax: number; // Maximum time a bolt stays visible.
  flashOpacityMin: number; // Smallest screen flash brightness.
  flashOpacityMax: number; // Brightest screen flash.
}> = {
  // No lightning at all.
  none: {
    minInterval: 0,
    maxInterval: 0,
    durationMin: 0,
    durationMax: 0,
    flashOpacityMin: 0,
    flashOpacityMax: 0,
  },
  // Slow, occasional lightning.
  rare: {
    minInterval: 11,
    maxInterval: 19,
    durationMin: 0.16,
    durationMax: 0.28,
    flashOpacityMin: 0.22,
    flashOpacityMax: 0.38,
  },
  // Fast, frequent lightning.
  rapid: {
    minInterval: 0.32,
    maxInterval: 0.64,
    durationMin: 0.12,
    durationMax: 0.22,
    flashOpacityMin: 0.35,
    flashOpacityMax: 0.58,
  },
};

// Cloud type weights stay centralized with the weather controls.
export const CLOUD_TYPE_WEIGHTS_BY_HOUR: Record<number, [number, number, number, number, number]> = {
  0: [2, 4, 5, 0, 3],  1: [2, 4, 5, 0, 3],  2: [2, 4, 5, 0, 3],  3: [2, 4, 5, 0, 3],
  4: [2, 4, 5, 0, 3],  5: [3, 5, 4, 0, 4],
  6: [4, 6, 3, 0, 5],  7: [5, 5, 3, 0, 5],  8: [6, 4, 3, 0, 5],  9: [7, 3, 3, 0, 4],
  10: [8, 2, 4, 1, 4], 11: [9, 2, 4, 1, 3], 12: [9, 2, 4, 2, 3], 13: [8, 2, 4, 3, 3],
  14: [8, 2, 4, 3, 3], 15: [7, 2, 4, 3, 4], 16: [6, 3, 4, 2, 4],
  17: [5, 4, 4, 2, 5], 18: [4, 5, 4, 1, 6], 19: [3, 5, 5, 1, 5],
  20: [2, 5, 5, 0, 4], 21: [2, 4, 5, 0, 3], 22: [2, 4, 5, 0, 3], 23: [2, 4, 5, 0, 3],
};

export const CLOUD_TYPE_WEIGHTS_DEFAULT: [number, number, number, number, number] = [6, 3, 4, 1, 4]; // Fallback cloud mix when no hour-specific weights are defined.
export const CLOUD_TYPES_ORDERED = ['cumulus', 'stratus', 'cirrus', 'cumulonimbus', 'altocumulus'] as const; // Shared ordering for all cloud-type weight arrays.

// Per-type visual configuration: opacity range, layer restrictions, speed modifier, and scale range.
// These are the cloud-shape knobs that the weather modes combine with.
export const CLOUD_TYPE_CONFIG: Record<string, {
  opacityMin: number; // Minimum opacity for this cloud type.
  opacityMax: number; // Maximum opacity for this cloud type.
  layerRestriction: number; // Which altitude layer this type can use, or -1 for any layer.
  speedMult: number; // How fast this type moves relative to the base cloud speed.
  scaleMin: number; // Smallest allowed size for this type.
  scaleMax: number; // Largest allowed size for this type.
  puffCountMin: number; // Fewest puffs used to build the shape.
  puffCountMax: number; // Most puffs used to build the shape.
  puffStretchX: [number, number]; // Horizontal stretch range for each puff.
  puffStretchY: [number, number]; // Vertical stretch range for each puff.
}> = {
  cumulus: { opacityMin: 0.2, opacityMax: 0.4, layerRestriction: -1, speedMult: 1.0, scaleMin: 0.7, scaleMax: 1.5, puffCountMin: 5, puffCountMax: 9, puffStretchX: [1, 1], puffStretchY: [1, 1] }, // Soft fair-weather clouds.
  stratus: { opacityMin: 0.25, opacityMax: 0.45, layerRestriction: 0, speedMult: 0.85, scaleMin: 1.0, scaleMax: 1.6, puffCountMin: 8, puffCountMax: 14, puffStretchX: [2, 3], puffStretchY: [0.4, 0.6] }, // Flat, wide overcast clouds.
  cirrus: { opacityMin: 0.06, opacityMax: 0.18, layerRestriction: 2, speedMult: 1.5, scaleMin: 0.8, scaleMax: 1.4, puffCountMin: 2, puffCountMax: 5, puffStretchX: [2, 4], puffStretchY: [0.3, 0.5] }, // Thin wispy high clouds.
  cumulonimbus: { opacityMin: 0.3, opacityMax: 0.5, layerRestriction: 0, speedMult: 0.7, scaleMin: 1.2, scaleMax: 1.9, puffCountMin: 6, puffCountMax: 10, puffStretchX: [1, 1.2], puffStretchY: [1, 1.3] }, // Tall storm clouds.
  altocumulus: { opacityMin: 0.15, opacityMax: 0.35, layerRestriction: 1, speedMult: 1.1, scaleMin: 0.6, scaleMax: 1.2, puffCountMin: 4, puffCountMax: 8, puffStretchX: [1, 1.5], puffStretchY: [0.7, 1] }, // Patchy mid-level clouds.
};
