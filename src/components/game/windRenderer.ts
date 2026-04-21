import type { Building } from '@/types/game';
import { getActiveSpritePack, type SpritePack } from '@/lib/renderConfig';
import {
  getCachedBitmap,
  getCachedImage,
  getCanvasImageDimensions,
  type CachedCanvasImage,
} from './imageLoader';
import { getSpriteRenderInfo, selectSpriteSource, type SpriteCoords } from './buildingSprite';
import type { CloudWeatherMode, WorldRenderState } from './types';

const WIND_DIRECTION_ANGLE = -0.28;
const WIND_DIRECTION_X = Math.cos(WIND_DIRECTION_ANGLE);
const WIND_DIRECTION_Y = Math.sin(WIND_DIRECTION_ANGLE);
const DUST_MIN_ZOOM = 0.65;
const DUST_DESPAWN_MARGIN = 120;
const DUST_MIN_LIFETIME = 1.6;
const DUST_MAX_LIFETIME = 2.8;

const WIND_STRENGTH_BY_WEATHER: Record<CloudWeatherMode, number> = {
  clear: 0.18,
  light_clouds: 0.35,
  storm: 0.72,
  severe_storm: 1,
};

export interface WindDustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  age: number;
  maxAge: number;
}

export interface WindTreeRenderItem {
  image: CachedCanvasImage;
  coords: SpriteCoords;
  drawX: number;
  drawY: number;
  destWidth: number;
  destHeight: number;
  shouldFlip: boolean;
  pivotX: number;
  pivotY: number;
}

export interface WindVisualState {
  time: number;
  strength: number;
  gust: number;
  dustSpawnTimer: number;
  particles: WindDustParticle[];
}

export interface WindUpdateInput {
  windState: WindVisualState;
  worldState: Pick<WorldRenderState, 'speed' | 'cloudWeatherMode' | 'zoom' | 'canvasSize' | 'offset'>;
  delta: number;
  isMobile: boolean;
  dpr?: number;
  random?: () => number;
}

export interface WindDrawInput {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  worldState: Pick<WorldRenderState, 'offset' | 'zoom'>;
  windState: WindVisualState;
  dpr?: number;
}

function getPixelRatio(dpr?: number): number {
  return dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
}

export function createDefaultWindVisualState(): WindVisualState {
  return {
    time: 0,
    strength: WIND_STRENGTH_BY_WEATHER.clear,
    gust: 0.5,
    dustSpawnTimer: 0,
    particles: [],
  };
}

export function buildWindTreeRenderItem(
  building: Building,
  tileX: number,
  tileY: number,
  screenX: number,
  screenY: number,
  options: {
    hasAdjacentRoad?: boolean;
    shouldFlipForRoad?: boolean;
  } = {},
  activePack: SpritePack = getActiveSpritePack()
): WindTreeRenderItem | null {
  const source = selectSpriteSource('tree', building, tileX, tileY, activePack);
  const spriteSheet =
    getCachedImage(source.source, true) ||
    getCachedBitmap(source.source, true) ||
    getCachedImage(source.source) ||
    getCachedBitmap(source.source);

  if (!spriteSheet) {
    return null;
  }

  const dimensions = getCanvasImageDimensions(spriteSheet);
  const spriteInfo = getSpriteRenderInfo(
    'tree',
    building,
    tileX,
    tileY,
    screenX,
    screenY,
    dimensions.width,
    dimensions.height,
    options,
    activePack
  );

  if (!spriteInfo || !spriteInfo.coords) {
    return null;
  }

  return {
    image: spriteSheet,
    coords: spriteInfo.coords,
    drawX: spriteInfo.positioning.drawX,
    drawY: spriteInfo.positioning.drawY,
    destWidth: spriteInfo.positioning.destWidth,
    destHeight: spriteInfo.positioning.destHeight,
    shouldFlip: spriteInfo.shouldFlip,
    pivotX: spriteInfo.positioning.drawX + spriteInfo.positioning.destWidth * 0.5,
    pivotY: spriteInfo.positioning.drawY + spriteInfo.positioning.destHeight * 0.9,
  };
}

export function updateWindVisualState({
  windState,
  worldState,
  delta,
  isMobile,
  dpr,
  random = Math.random,
}: WindUpdateInput): void {
  const { speed, cloudWeatherMode, zoom, canvasSize, offset } = worldState;

  if (speed === 0) {
    return;
  }

  const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 2 : 3;
  const scaledDelta = delta * speedMultiplier;
  const targetStrength = WIND_STRENGTH_BY_WEATHER[cloudWeatherMode];

  windState.strength += (targetStrength - windState.strength) * Math.min(1, scaledDelta * 1.8);
  windState.time += scaledDelta * (0.8 + windState.strength * 1.6);
  windState.gust = 0.5 + 0.5 * Math.sin(windState.time * 0.75);

  const particles = windState.particles;
  const pixelRatio = getPixelRatio(dpr);
  const viewWidth = canvasSize.width / (pixelRatio * zoom);
  const viewHeight = canvasSize.height / (pixelRatio * zoom);
  const viewLeft = -offset.x / zoom;
  const viewTop = -offset.y / zoom;
  const viewRight = viewLeft + viewWidth;
  const viewBottom = viewTop + viewHeight;

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.age += scaledDelta;
    particle.x += particle.vx * scaledDelta;
    particle.y += particle.vy * scaledDelta;

    const expired =
      particle.age >= particle.maxAge ||
      particle.x > viewRight + DUST_DESPAWN_MARGIN ||
      particle.x < viewLeft - DUST_DESPAWN_MARGIN ||
      particle.y > viewBottom + DUST_DESPAWN_MARGIN ||
      particle.y < viewTop - DUST_DESPAWN_MARGIN;

    if (expired) {
      particles.splice(i, 1);
    }
  }

  if (zoom < DUST_MIN_ZOOM || windState.strength < 0.28) {
    particles.length = 0;
    windState.dustSpawnTimer = 0;
    return;
  }

  const maxParticles = isMobile ? 10 : 18;
  const spawnInterval = isMobile ? 0.3 : 0.18;
  windState.dustSpawnTimer += scaledDelta * (0.5 + windState.strength * 1.2);

  while (windState.dustSpawnTimer >= spawnInterval && particles.length < maxParticles) {
    windState.dustSpawnTimer -= spawnInterval;

    const speedBase = 18 + windState.strength * 40 + random() * 12;
    const startX = viewLeft + random() * viewWidth;
    const startY = viewTop + viewHeight * (0.58 + random() * 0.34);

    particles.push({
      x: startX,
      y: startY,
      vx: WIND_DIRECTION_X * speedBase,
      vy: WIND_DIRECTION_Y * speedBase * 0.55,
      size: (isMobile ? 1.2 : 1.8) + random() * (isMobile ? 1.2 : 2.4),
      opacity: 0.08 + windState.strength * 0.14 + random() * 0.05,
      age: 0,
      maxAge: DUST_MIN_LIFETIME + random() * (DUST_MAX_LIFETIME - DUST_MIN_LIFETIME),
    });
  }
}

export function drawWindTreesFrame(
  { ctx, worldState, windState, dpr }: WindDrawInput,
  visibleTrees: WindTreeRenderItem[]
): void {
  const { offset, zoom } = worldState;

  if (visibleTrees.length === 0) {
    return;
  }

  const pixelRatio = getPixelRatio(dpr);
  const swayAngle =
    (0.003 + windState.strength * 0.014) +
    ((0.004 + windState.strength * 0.026) * windState.gust) *
      (0.5 + 0.5 * Math.sin(windState.time * 1.8));

  ctx.save();
  ctx.scale(pixelRatio * zoom, pixelRatio * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  ctx.imageSmoothingEnabled = false;

  for (const tree of visibleTrees) {
    ctx.save();

    ctx.translate(tree.pivotX, tree.pivotY);
    ctx.rotate(swayAngle);
    ctx.translate(-tree.pivotX, -tree.pivotY);

    if (tree.shouldFlip) {
      const centerX = tree.drawX + tree.destWidth * 0.5;
      ctx.translate(centerX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-centerX, 0);
    }

    ctx.drawImage(
      tree.image,
      tree.coords.sx,
      tree.coords.sy,
      tree.coords.sw,
      tree.coords.sh,
      Math.round(tree.drawX),
      Math.round(tree.drawY),
      Math.round(tree.destWidth),
      Math.round(tree.destHeight)
    );

    ctx.restore();
  }

  ctx.restore();
}

export function drawWindDustFrame({
  ctx,
  worldState,
  windState,
  dpr,
}: WindDrawInput): void {
  const { offset, zoom } = worldState;

  if (zoom < DUST_MIN_ZOOM || windState.particles.length === 0) {
    return;
  }

  const pixelRatio = getPixelRatio(dpr);

  ctx.save();
  ctx.scale(pixelRatio * zoom, pixelRatio * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  ctx.lineCap = 'round';

  for (const particle of windState.particles) {
    const fade = 1 - particle.age / particle.maxAge;
    const alpha = particle.opacity * fade;
    const trailLength = particle.size * (2.5 + windState.strength * 1.5);

    ctx.strokeStyle = `rgba(191, 161, 112, ${alpha})`;
    ctx.lineWidth = Math.max(0.8, particle.size * 0.45);
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(
      particle.x - WIND_DIRECTION_X * trailLength,
      particle.y - WIND_DIRECTION_Y * trailLength * 0.8
    );
    ctx.stroke();

    ctx.fillStyle = `rgba(214, 191, 144, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.ellipse(
      particle.x,
      particle.y,
      particle.size,
      particle.size * 0.55,
      WIND_DIRECTION_ANGLE,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}
