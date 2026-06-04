import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, WorldRenderState } from './types';
import {
  NON_LIT_BUILDING_TYPES,
  RESIDENTIAL_BUILDING_TYPES,
  COMMERCIAL_BUILDING_TYPES,
} from './constants';
import { getSceneLighting } from './sceneLighting';
import { gridToScreen } from './utils';
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';

export function pseudoRandom(seed: number, n: number): number {
  const s = Math.sin(seed + n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export interface LightCutout {
  x: number;
  y: number;
  type: 'road' | 'building';
  buildingType?: string;
  seed?: number;
}

export interface ColoredGlow {
  x: number;
  y: number;
  type: string;
}

export interface LightingFrameInput {
  ctx: IsoRenderer;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  worldState: Pick<WorldRenderState, 'grid' | 'gridSize' | 'cloudWeatherMode'>;
  visualHour: number;
  offset: { x: number; y: number };
  zoom: number;
  isMobile: boolean;
  dpr?: number;
  isInteractionActive?: boolean;
}

export function collectLightSources(
  grid: Tile[][],
  gridSize: number,
  visibleMinSum: number,
  visibleMaxSum: number,
  viewLeft: number,
  viewRight: number,
  viewTop: number,
  viewBottom: number,
  isMobile: boolean
): { lightCutouts: LightCutout[]; coloredGlows: ColoredGlow[] } {
  const lightCutouts: LightCutout[] = [];
  const coloredGlows: ColoredGlow[] = [];

  const roadSampleRate = isMobile ? 3 : 1;
  let roadCounter = 0;

  for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
    for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
      const y = sum - x;
      if (y < 0 || y >= gridSize) continue;

      const { screenX, screenY } = gridToScreen(x, y, 0, 0);

      if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
          screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
        continue;
      }

      const tile = grid[y][x];
      const buildingType = tile.building.type;

      if (buildingType === 'road' || buildingType === 'bridge') {
        roadCounter++;
        if (roadCounter % roadSampleRate === 0) {
          lightCutouts.push({ x, y, type: 'road' });
          if (!isMobile) {
            coloredGlows.push({ x, y, type: 'road' });
          }
        }
      } else if (!NON_LIT_BUILDING_TYPES.has(buildingType) && tile.building.powered) {
        lightCutouts.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });

        if (!isMobile && (
          buildingType === 'hospital' ||
          buildingType === 'fire_station' ||
          buildingType === 'police_station' ||
          buildingType === 'power_plant'
        )) {
          coloredGlows.push({ x, y, type: buildingType });
        }
      }
    }
  }

  return { lightCutouts, coloredGlows };
}

export function drawLightCutouts(
  ctx: IsoRenderer,
  lightCutouts: LightCutout[],
  lightIntensity: number,
  isMobile: boolean
): void {
  for (const light of lightCutouts) {
    const { screenX, screenY } = gridToScreen(light.x, light.y, 0, 0);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;

    if (light.type === 'road') {
      const lightRadius = 28;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.75 * lightIntensity})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.4 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'building' && light.buildingType && light.seed !== undefined) {
      const buildingType = light.buildingType;
      const isResidential = RESIDENTIAL_BUILDING_TYPES.has(buildingType);
      const isCommercial = COMMERCIAL_BUILDING_TYPES.has(buildingType);
      const glowStrength = isCommercial ? 0.9 : isResidential ? 0.65 : 0.75;

      if (!isMobile) {
        let numWindows = 2;
        if (buildingType.includes('medium') || buildingType.includes('low')) numWindows = 3;
        if (buildingType.includes('high') || buildingType === 'mall') numWindows = 5;
        if (buildingType === 'mansion' || buildingType === 'office_high') numWindows = 4;

        const windowSize = 5;
        const buildingHeight = -18;

        for (let i = 0; i < numWindows; i++) {
          const isLit = pseudoRandom(light.seed, i) < (isResidential ? 0.55 : 0.75);
          if (!isLit) continue;

          const wx = tileCenterX + (pseudoRandom(light.seed, i + 10) - 0.5) * 22;
          const wy = tileCenterY + buildingHeight + (pseudoRandom(light.seed, i + 20) - 0.5) * 16;

          const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, windowSize * 2.5);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${glowStrength * lightIntensity})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowStrength * 0.4 * lightIntensity})`);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(wx, wy, windowSize * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const groundGlowRadius = isMobile ? TILE_WIDTH * 0.5 : TILE_WIDTH * 0.6;
      const groundGlowAlpha = isMobile ? 0.4 : 0.28;
      const groundGlow = ctx.createRadialGradient(
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, 0,
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, groundGlowRadius
      );
      groundGlow.addColorStop(0, `rgba(255, 255, 255, ${groundGlowAlpha * lightIntensity})`);
      groundGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = groundGlow;
      ctx.beginPath();
      ctx.ellipse(tileCenterX, tileCenterY + TILE_HEIGHT / 4, groundGlowRadius, TILE_HEIGHT / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawColoredGlows(
  ctx: IsoRenderer,
  coloredGlows: ColoredGlow[],
  lightIntensity: number
): void {
  for (const glow of coloredGlows) {
    const { screenX, screenY } = gridToScreen(glow.x, glow.y, 0, 0);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;

    if (glow.type === 'road') {
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, 20);
      gradient.addColorStop(0, `rgba(255, 210, 130, ${0.3 * lightIntensity})`);
      gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.15 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, 20, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    let glowColor: { r: number; g: number; b: number } | null = null;
    let glowRadius = 20;

    if (glow.type === 'hospital') {
      glowColor = { r: 255, g: 80, b: 80 };
      glowRadius = 25;
    } else if (glow.type === 'fire_station') {
      glowColor = { r: 255, g: 100, b: 50 };
      glowRadius = 22;
    } else if (glow.type === 'police_station') {
      glowColor = { r: 60, g: 140, b: 255 };
      glowRadius = 22;
    } else if (glow.type === 'power_plant') {
      glowColor = { r: 255, g: 200, b: 50 };
      glowRadius = 30;
    }

    if (!glowColor) continue;

    const gradient = ctx.createRadialGradient(
      tileCenterX, tileCenterY - 15, 0,
      tileCenterX, tileCenterY - 15, glowRadius
    );
    gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.55 * lightIntensity})`);
    gradient.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.25 * lightIntensity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tileCenterX, tileCenterY - 15, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderLightingFrame({
  ctx,
  canvas,
  worldState,
  visualHour,
  offset,
  zoom,
  isMobile,
  dpr,
  isInteractionActive = false,
}: LightingFrameInput): void {
  if (isInteractionActive) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const pixelRatio = dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const { overlayAlpha, ambientColor, lightIntensity } = getSceneLighting(visualHour, worldState.cloudWeatherMode);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (overlayAlpha <= 0.01) {
    return;
  }

  ctx.fillStyle = `rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, ${overlayAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const viewWidth = canvas.width / (pixelRatio * zoom);
  const viewHeight = canvas.height / (pixelRatio * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;

  const visibleMinSum = Math.max(0, Math.floor((viewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
  const visibleMaxSum = Math.min(worldState.gridSize * 2 - 2, Math.ceil((viewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));

  const { lightCutouts, coloredGlows } = collectLightSources(
    worldState.grid,
    worldState.gridSize,
    visibleMinSum,
    visibleMaxSum,
    viewLeft,
    viewRight,
    viewTop,
    viewBottom,
    isMobile
  );

  ctx.globalCompositeOperation = 'destination-out';
  ctx.save();
  ctx.scale(pixelRatio * zoom, pixelRatio * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  drawLightCutouts(ctx, lightCutouts, lightIntensity, isMobile);
  ctx.restore();

  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.scale(pixelRatio * zoom, pixelRatio * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  drawColoredGlows(ctx, coloredGlows, lightIntensity);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
