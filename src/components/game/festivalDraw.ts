/**
 * Festival visuals (S5-T3), drawn on the air layer each frame. Cheap by design: sites are found once per building
 * layout, dots are batched into one path per colour, and Low quality draws nothing (particleFraction 0).
 *
 * - Ganga Aarti (daily 18–20): a row of flickering lamps on Dashashwamedh (or the largest ghat cluster).
 * - Holi: coloured powder puffs over homes in view.
 * - Diwali: warm lights on buildings (fireworks come from the firework system).
 * - Dev Deepawali: a diya on every west-bank riverfront tile and every ghat, one batched draw.
 * - Chhath and the management events: bigger crowds through the pilgrim system (vehicleSystems), nothing drawn here.
 */
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';
import type { Tile } from '@/types/game';
import type { FestivalDef } from '@/lib/festivals';
import { findGhatTiles, getLargestGhatCluster, FESTIVAL_SIM_CONFIG } from '@/lib/festivalSim';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { getActivePreset, getRenderDpr } from '@/lib/graphicsSettings';

export const FESTIVAL_DRAW_CONFIG = {
  diyaColor: '#FFB347',
  diyaGlow: 'rgba(255, 170, 60, 0.18)',
  /** Diyas per riverfront or ghat tile (placed along the tile, fixed so they don't jump). */
  diyasPerTile: 4,
  diwaliLightColor: '#FFD27A',
  /** Most Diwali lights drawn per frame (at particleFraction 1). */
  maxDiwaliLights: 1500,
  aartiLamps: 7,
  aartiColor: '#FFC04D',
  holiColors: ['#FF4FA3', '#3CCB5A', '#FFD93B', '#3FA2FF'] as readonly string[],
  /** Holi puffs alive at once and spawned per second (at particleFraction 1). */
  maxHoliPuffs: 90,
  holiPuffsPerSecond: 30,
  /** Lights are dimmer by day; the festival still shows. */
  dayAlpha: 0.45,
} as const;

export interface FestivalDrawInput {
  grid: Tile[][];
  gridSize: number;
  mapId: MapId | undefined;
  structureVersion: number;
  offset: { x: number; y: number };
  zoom: number;
  hour: number;
  active: readonly FestivalDef[];
}

interface Sites {
  key: string;
  /** Tile centres in world coordinates. */
  riverfront: Float32Array;
  homes: Float32Array;
  lit: Float32Array;
  aarti: { x: number; y: number } | null;
}

interface Puff {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  color: number;
}

function centre(x: number, y: number): [number, number] {
  return [(x - y) * (TILE_WIDTH / 2) + TILE_WIDTH / 2, (x + y) * (TILE_HEIGHT / 2) + TILE_HEIGHT / 2];
}

function buildSites(input: FestivalDrawInput, key: string): Sites {
  const { grid, gridSize: size, mapId } = input;
  const riverfront: number[] = [];
  const homes: number[] = [];
  const lit: number[] = [];
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) {
      const t = row[x];
      const type = t.building.type;
      const [cx, cy] = centre(x, y);
      if (type !== 'water' && (getRiverZone(x, y, size, mapId) === 'westRiverfront' || FESTIVAL_SIM_CONFIG.ghatTypes.includes(type))) {
        riverfront.push(cx, cy);
      }
      if (t.zone === 'residential' && (t.building.population ?? 0) > 0) homes.push(cx, cy);
      if ((t.building.population ?? 0) > 0 || (t.building.jobs ?? 0) > 0) lit.push(cx, cy);
    }
  }
  const aartiTile = (() => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((grid[y][x].building.type as string) === FESTIVAL_SIM_CONFIG.aartiLandmark) return { x, y };
    return getLargestGhatCluster(findGhatTiles(grid, size), size)?.center ?? null;
  })();
  const aarti = aartiTile ? { x: centre(aartiTile.x, aartiTile.y)[0], y: centre(aartiTile.x, aartiTile.y)[1] } : null;
  return { key, riverfront: Float32Array.from(riverfront), homes: Float32Array.from(homes), lit: Float32Array.from(lit), aarti };
}

function isNight(hour: number): boolean {
  return hour >= 18 || hour < 6;
}

/** Creates the per-canvas festival visuals (sites cache and Holi particles). */
export function createFestivalVisuals() {
  let sites: Sites | null = null;
  let puffs: Puff[] = [];
  let spawnCarry = 0;
  let time = 0;
  let lastView: { left: number; top: number; right: number; bottom: number } | null = null;

  const getSites = (input: FestivalDrawInput): Sites => {
    const key = `${input.gridSize}|${input.structureVersion}|${input.mapId}`;
    if (!sites || sites.key !== key) sites = buildSites(input, key);
    return sites;
  };

  const has = (input: FestivalDrawInput, id: FestivalDef['id']) => input.active.some((f) => f.id === id);

  /** Advances flicker and Holi puffs. Call once per frame with the frame's seconds. */
  const update = (delta: number, input: FestivalDrawInput): void => {
    time += delta;
    const fraction = getActivePreset().particleFraction;
    if (!has(input, 'holi') || fraction <= 0 || input.active.length === 0) {
      if (puffs.length > 0) puffs = [];
      return;
    }
    const s = getSites(input);
    puffs = puffs.filter((p) => (p.age += delta) < p.life);
    for (const p of puffs) {
      p.y -= delta * 6;
      p.r += delta * 5;
    }
    const homes = s.homes.length / 2;
    if (homes === 0) return;
    spawnCarry += delta * FESTIVAL_DRAW_CONFIG.holiPuffsPerSecond * fraction;
    const max = Math.floor(FESTIVAL_DRAW_CONFIG.maxHoliPuffs * fraction);
    while (spawnCarry >= 1) {
      spawnCarry -= 1;
      if (puffs.length >= max) continue;
      // Prefer homes in the last drawn view: a few tries, else any home
      let pick = Math.floor(Math.random() * homes);
      for (let tries = 0; tries < 6 && lastView; tries++) {
        const x = s.homes[pick * 2];
        const y = s.homes[pick * 2 + 1];
        if (x >= lastView.left && x <= lastView.right && y >= lastView.top && y <= lastView.bottom) break;
        pick = Math.floor(Math.random() * homes);
      }
      puffs.push({
        x: s.homes[pick * 2] + (Math.random() - 0.5) * TILE_WIDTH * 0.5,
        y: s.homes[pick * 2 + 1] - 10 - Math.random() * 10,
        r: 3 + Math.random() * 3,
        age: 0,
        life: 1.2 + Math.random() * 1.2,
        color: Math.floor(Math.random() * FESTIVAL_DRAW_CONFIG.holiColors.length),
      });
    }
  };

  /** Draws the running festivals. Nothing on Low quality or without a festival. */
  const draw = (r: IsoRenderer, input: FestivalDrawInput): void => {
    if (input.active.length === 0 || input.mapId !== 'varanasi') return;
    const fraction = getActivePreset().particleFraction;
    if (fraction <= 0) return;
    const deepawali = has(input, 'dev_deepawali');
    const diwali = has(input, 'diwali');
    const aarti = has(input, 'ganga_aarti');
    if (!deepawali && !diwali && !aarti && puffs.length === 0) return;
    const s = getSites(input);
    const dpr = getRenderDpr();
    const { zoom, offset } = input;
    const canvas = r.canvas;
    const left = -offset.x / zoom - TILE_WIDTH;
    const top = -offset.y / zoom - TILE_HEIGHT * 2;
    const right = canvas.width / (dpr * zoom) - offset.x / zoom + TILE_WIDTH;
    const bottom = canvas.height / (dpr * zoom) - offset.y / zoom + TILE_HEIGHT;
    lastView = { left, top, right, bottom };
    const inView = (x: number, y: number) => x >= left && x <= right && y >= top && y <= bottom;
    const lightAlpha = isNight(input.hour) ? 1 : FESTIVAL_DRAW_CONFIG.dayAlpha;

    r.save();
    r.scale(dpr * zoom, dpr * zoom);
    r.translate(offset.x / zoom, offset.y / zoom);

    // Dev Deepawali: every diya in one path, one fill (plus one glow pass above Low)
    if (deepawali) {
      const n = FESTIVAL_DRAW_CONFIG.diyasPerTile;
      const pts = s.riverfront;
      r.globalAlpha = lightAlpha * (0.85 + 0.15 * Math.sin(time * 7));
      r.fillStyle = FESTIVAL_DRAW_CONFIG.diyaColor;
      r.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        const cx = pts[i];
        const cy = pts[i + 1];
        if (!inView(cx, cy)) continue;
        for (let k = 0; k < n; k++) {
          // Along the tile's river-side edge
          const t = (k + 0.5) / n - 0.5;
          const dx = cx + t * TILE_WIDTH * 0.8;
          const dy = cy + t * TILE_HEIGHT * 0.8;
          r.moveTo(dx - 1.2, dy);
          r.lineTo(dx, dy - 1.2);
          r.lineTo(dx + 1.2, dy);
          r.lineTo(dx, dy + 1.2);
          r.closePath();
        }
      }
      r.fill();
      if (isNight(input.hour) && zoom >= 0.5) {
        r.globalAlpha = 1;
        r.fillStyle = FESTIVAL_DRAW_CONFIG.diyaGlow;
        r.beginPath();
        for (let i = 0; i < pts.length; i += 2) {
          if (!inView(pts[i], pts[i + 1])) continue;
          r.moveTo(pts[i] + 10, pts[i + 1]);
          r.ellipse(pts[i], pts[i + 1], 10, 5, 0, 0, Math.PI * 2);
        }
        r.fill();
      }
    }

    // Diwali: warm lights on lived-in buildings, batched
    if (diwali) {
      const pts = s.lit;
      const max = Math.floor(FESTIVAL_DRAW_CONFIG.maxDiwaliLights * fraction);
      let drawn = 0;
      r.globalAlpha = lightAlpha;
      r.fillStyle = FESTIVAL_DRAW_CONFIG.diwaliLightColor;
      r.beginPath();
      for (let i = 0; i < pts.length && drawn < max; i += 2) {
        const cx = pts[i];
        const cy = pts[i + 1] - TILE_HEIGHT * 0.6;
        if (!inView(cx, cy)) continue;
        drawn++;
        for (let k = -1; k <= 1; k++) {
          const dx = cx + k * 6;
          const dy = cy + k * 3;
          r.moveTo(dx - 1, dy - 1);
          r.lineTo(dx + 1, dy - 1);
          r.lineTo(dx + 1, dy + 1);
          r.lineTo(dx - 1, dy + 1);
          r.closePath();
        }
      }
      r.fill();
    }

    // Ganga Aarti: a row of flickering lamps
    if (aarti && s.aarti && inView(s.aarti.x, s.aarti.y)) {
      const n = FESTIVAL_DRAW_CONFIG.aartiLamps;
      r.fillStyle = FESTIVAL_DRAW_CONFIG.aartiColor;
      for (let k = 0; k < n; k++) {
        const t = (k - (n - 1) / 2) / n;
        const x = s.aarti.x + t * TILE_WIDTH * 0.9;
        const y = s.aarti.y + t * TILE_HEIGHT * 0.9 - 6;
        r.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(time * 9 + k * 1.7));
        r.beginPath();
        r.arc(x, y, 1.8 + 0.6 * Math.sin(time * 13 + k), 0, Math.PI * 2);
        r.fill();
      }
    }

    // Holi: powder puffs, batched by colour
    if (puffs.length > 0) {
      const colors = FESTIVAL_DRAW_CONFIG.holiColors;
      r.globalAlpha = 0.55;
      for (let c = 0; c < colors.length; c++) {
        r.fillStyle = colors[c];
        r.beginPath();
        for (const p of puffs) {
          if (p.color !== c || !inView(p.x, p.y)) continue;
          r.moveTo(p.x + p.r, p.y);
          r.arc(p.x, p.y, p.r * (1 - (p.age / p.life) * 0.3), 0, Math.PI * 2);
        }
        r.fill();
      }
    }

    r.globalAlpha = 1;
    r.restore();
  };

  return { update, draw };
}
