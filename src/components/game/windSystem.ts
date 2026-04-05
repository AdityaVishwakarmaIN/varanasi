import { useCallback } from 'react';
import { Building } from '@/types/game';
import { SpritePack, getActiveSpritePack } from '@/lib/renderConfig';
import { getCachedImage } from './imageLoader';
import { getSpriteRenderInfo, selectSpriteSource, SpriteCoords } from './buildingSprite';
import { CloudWeatherMode, WorldRenderState } from './types';

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
  image: HTMLImageElement;
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

export interface WindSystemRefs {
  windStateRef: React.MutableRefObject<WindVisualState>;
  visibleTreesRef: React.MutableRefObject<WindTreeRenderItem[]>;
}

export interface WindSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
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

  const spriteSheet = getCachedImage(source.source, true) || getCachedImage(source.source);
  if (!spriteSheet) {
    return null;
  }

  const spriteInfo = getSpriteRenderInfo(
    'tree',
    building,
    tileX,
    tileY,
    screenX,
    screenY,
    spriteSheet.naturalWidth || spriteSheet.width,
    spriteSheet.naturalHeight || spriteSheet.height,
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

export function useWindSystem(
  refs: WindSystemRefs,
  systemState: WindSystemState
) {
  const { windStateRef, visibleTreesRef } = refs;
  const { worldStateRef, isMobile } = systemState;

  const updateWind = useCallback((delta: number) => {
    const { speed, cloudWeatherMode, zoom, canvasSize, offset } = worldStateRef.current;
    const wind = windStateRef.current;

    if (speed === 0) {
      return;
    }

    const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 2 : 3;
    const scaledDelta = delta * speedMultiplier;
    const targetStrength = WIND_STRENGTH_BY_WEATHER[cloudWeatherMode];

    wind.strength += (targetStrength - wind.strength) * Math.min(1, scaledDelta * 1.8);
    wind.time += scaledDelta * (0.8 + wind.strength * 1.6);
    wind.gust = 0.5 + 0.5 * Math.sin(wind.time * 0.75);

    const particles = wind.particles;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const viewWidth = canvasSize.width / (dpr * zoom);
    const viewHeight = canvasSize.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom;
    const viewTop = -offset.y / zoom;
    const viewRight = viewLeft + viewWidth;
    const viewBottom = viewTop + viewHeight;

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.age += scaledDelta;
      particle.x += particle.vx * scaledDelta;
      particle.y += particle.vy * scaledDelta;

      const expired = particle.age >= particle.maxAge ||
        particle.x > viewRight + DUST_DESPAWN_MARGIN ||
        particle.x < viewLeft - DUST_DESPAWN_MARGIN ||
        particle.y > viewBottom + DUST_DESPAWN_MARGIN ||
        particle.y < viewTop - DUST_DESPAWN_MARGIN;

      if (expired) {
        particles.splice(i, 1);
      }
    }

    if (zoom < DUST_MIN_ZOOM || wind.strength < 0.28) {
      particles.length = 0;
      wind.dustSpawnTimer = 0;
      return;
    }

    const maxParticles = isMobile ? 10 : 18;
    const spawnInterval = isMobile ? 0.3 : 0.18;
    wind.dustSpawnTimer += scaledDelta * (0.5 + wind.strength * 1.2);

    while (wind.dustSpawnTimer >= spawnInterval && particles.length < maxParticles) {
      wind.dustSpawnTimer -= spawnInterval;

      const speedBase = 18 + wind.strength * 40 + Math.random() * 12;
      const startX = viewLeft + Math.random() * viewWidth;
      const startY = viewTop + viewHeight * (0.58 + Math.random() * 0.34);

      particles.push({
        x: startX,
        y: startY,
        vx: WIND_DIRECTION_X * speedBase,
        vy: WIND_DIRECTION_Y * speedBase * 0.55,
        size: (isMobile ? 1.2 : 1.8) + Math.random() * (isMobile ? 1.2 : 2.4),
        opacity: 0.08 + wind.strength * 0.14 + Math.random() * 0.05,
        age: 0,
        maxAge: DUST_MIN_LIFETIME + Math.random() * (DUST_MAX_LIFETIME - DUST_MIN_LIFETIME),
      });
    }
  }, [isMobile, windStateRef, worldStateRef]);

  const drawWindTrees = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset, zoom } = worldStateRef.current;
    const wind = windStateRef.current;

    if (visibleTreesRef.current.length === 0) {
      return;
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const swayAngle =
      (0.003 + wind.strength * 0.014)
      + ((0.004 + wind.strength * 0.026) * wind.gust)
      * (0.5 + 0.5 * Math.sin(wind.time * 1.8));

    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    ctx.imageSmoothingEnabled = false;

    for (const tree of visibleTreesRef.current) {
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
  }, [visibleTreesRef, windStateRef, worldStateRef]);

  const drawWindDust = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset, zoom } = worldStateRef.current;
    const wind = windStateRef.current;

    if (zoom < DUST_MIN_ZOOM || wind.particles.length === 0) {
      return;
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    ctx.lineCap = 'round';

    for (const particle of wind.particles) {
      const fade = 1 - particle.age / particle.maxAge;
      const alpha = particle.opacity * fade;
      const trailLength = particle.size * (2.5 + wind.strength * 1.5);

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
      ctx.ellipse(particle.x, particle.y, particle.size, particle.size * 0.55, WIND_DIRECTION_ANGLE, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [windStateRef, worldStateRef]);

  return {
    updateWind,
    drawWindTrees,
    drawWindDust,
  };
}
