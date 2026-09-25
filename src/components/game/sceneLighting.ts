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
  // Fog: the white wash is set per hour in getSceneLighting (FOG_LIGHTING); this is the midday leftover
  fog: {
    dayOverlayAlpha: 0.06,
    dayAmbient: { r: 236, g: 238, b: 240 },
    lightIntensity: 0.85,
  },
  // Heat haze: a faint warm, washed-out tint. Keep it subtle.
  heat_haze: {
    dayOverlayAlpha: 0.1,
    dayAmbient: { r: 255, g: 222, b: 170 },
    lightIntensity: 1,
  },
};

/** Winter fog (S4-T2): thick white until `thickUntilHour`, thinning to the day value by `clearByHour`. */
const FOG_LIGHTING = {
  thickUntilHour: 9,
  clearByHour: 11,
  morningAlpha: 0.42,
  /** Night fog lightens the night overlay a little. */
  nightAmbient: { r: 70, g: 78, b: 96 } as AmbientColor,
  nightOverlayAlpha: 0.55,
};

function getFogDayAlpha(hour: number): number {
  const day = SCENE_BY_WEATHER.fog.dayOverlayAlpha;
  if (hour < FOG_LIGHTING.thickUntilHour) return FOG_LIGHTING.morningAlpha;
  if (hour >= FOG_LIGHTING.clearByHour) return day;
  const t = (hour - FOG_LIGHTING.thickUntilHour) / (FOG_LIGHTING.clearByHour - FOG_LIGHTING.thickUntilHour);
  return FOG_LIGHTING.morningAlpha + (day - FOG_LIGHTING.morningAlpha) * t;
}

export function getSceneLighting(hour: number, weatherMode: CloudWeatherMode): SceneLighting {
  const weather = SCENE_BY_WEATHER[weatherMode];
  const isDay = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;

  if (isDay) {
    return {
      overlayAlpha: weatherMode === 'fog' ? getFogDayAlpha(hour) : weather.dayOverlayAlpha,
      ambientColor: weather.dayAmbient,
      lightIntensity: weather.lightIntensity,
    };
  }

  if (weatherMode === 'fog') {
    return {
      overlayAlpha: FOG_LIGHTING.nightOverlayAlpha,
      ambientColor: FOG_LIGHTING.nightAmbient,
      lightIntensity: weather.lightIntensity,
    };
  }

  return {
    overlayAlpha: NIGHT_OVERLAY_ALPHA,
    ambientColor: NIGHT_AMBIENT,
    lightIntensity: weather.lightIntensity,
  };
}
