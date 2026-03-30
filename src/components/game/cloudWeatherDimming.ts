import type { CloudWeatherMode } from './types';

export type AmbientColor = { r: number; g: number; b: number };

export type SceneLighting = {
  overlayAlpha: number;
  ambientColor: AmbientColor;
  lightIntensity: number;
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 18;

const NIGHT_OVERLAY_ALPHA = 0.6;
const NIGHT_AMBIENT: AmbientColor = { r: 20, g: 30, b: 60 };

const SCENE_BY_WEATHER: Record<CloudWeatherMode, {
  dayOverlayAlpha: number;
  dayAmbient: AmbientColor;
  lightIntensity: number;
}> = {
  clear: {
    dayOverlayAlpha: 0,
    dayAmbient: { r: 255, g: 255, b: 255 },
    lightIntensity: 1,
  },
  light_clouds: {
    dayOverlayAlpha: 0.1,
    dayAmbient: { r: 196, g: 199, b: 206 },
    lightIntensity: 0.9,
  },
  storm: {
    dayOverlayAlpha: 0.35,
    dayAmbient: { r: 138, g: 143, b: 158 },
    lightIntensity: 0.8,
  },
  severe_storm: {
    dayOverlayAlpha: 0.5,
    dayAmbient: { r: 79, g: 86, b: 109 },
    lightIntensity: 0.7,
  },
};

export function getSceneLighting(hour: number, weatherMode: CloudWeatherMode): SceneLighting {
  const weather = SCENE_BY_WEATHER[weatherMode];
  const isDay = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;

  if (isDay) {
    return {
      overlayAlpha: weather.dayOverlayAlpha,
      ambientColor: weather.dayAmbient,
      lightIntensity: weather.lightIntensity,
    };
  }

  return {
    overlayAlpha: NIGHT_OVERLAY_ALPHA,
    ambientColor: NIGHT_AMBIENT,
    lightIntensity: weather.lightIntensity,
  };
}
