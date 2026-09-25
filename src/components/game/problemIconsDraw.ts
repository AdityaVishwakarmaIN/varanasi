/**
 * Problem icons over buildings (S5-T5). One small drawn badge per building (no emoji fonts), or one per 16×16
 * district when zoomed out. The icon set is recomputed at most once per PROBLEM_ICON_CONFIG.refreshMs and only
 * when the state changed; each frame only culls and draws the cached list. Infected blocks (S4-T9) get one
 * biohazard badge per block.
 */
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';
import type { GameState } from '@/types/game';
import {
  computeProblemIconsForState,
  computeRoadAccessMask,
  isBuildingLevelZoom,
  kindIndex,
  PROBLEM_ICON_CONFIG,
  PROBLEM_KINDS,
  type ProblemIconSet,
  type ProblemKind,
} from '@/lib/problemIcons';
import { getFeederBounds } from '@/lib/feederZones';

const RING: Record<ProblemKind, string> = {
  fire: '#ef4444',
  flood: '#3b82f6',
  disease: '#a3e635',
  no_road: '#f97316',
  power_cut: '#f59e0b',
  no_power: '#facc15',
  no_water: '#38bdf8',
  abandoned: '#a8a29e',
};
const BADGE_FILL = 'rgba(15, 23, 42, 0.85)';

export interface ProblemIconView {
  offset: { x: number; y: number };
  zoom: number;
  dpr: number;
  width: number;
  height: number;
}

/** Draws one glyph centred on (0, 0) in a unit where the badge radius is 10. */
function drawGlyph(ctx: IsoRenderer, kind: ProblemKind, t: number): void {
  switch (kind) {
    case 'fire':
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.quadraticCurveTo(6, -1, 4, 5);
      ctx.quadraticCurveTo(0, 8, -4, 5);
      ctx.quadraticCurveTo(-6, -1, 0, -7);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(3, 2, 2, 5);
      ctx.quadraticCurveTo(0, 6, -2, 5);
      ctx.quadraticCurveTo(-3, 2, 0, -1);
      ctx.fill();
      return;
    case 'flood':
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const yy of [-3, 3]) {
        ctx.moveTo(-6, yy);
        ctx.quadraticCurveTo(-3, yy - 3, 0, yy);
        ctx.quadraticCurveTo(3, yy + 3, 6, yy);
      }
      ctx.stroke();
      return;
    case 'disease': {
      // Biohazard: three lobes around a ring.
      ctx.fillStyle = '#a3e635';
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = BADGE_FILL;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'no_road':
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5, 6);
      ctx.lineTo(-2, -6);
      ctx.moveTo(5, 6);
      ctx.lineTo(2, -6);
      ctx.stroke();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, 6);
      ctx.stroke();
      return;
    case 'power_cut':
    case 'no_power': {
      const flicker = kind === 'power_cut' ? (Math.sin(t * 9) > 0 ? 1 : 0.35) : 1;
      ctx.globalAlpha = flicker;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(1.5, -7);
      ctx.lineTo(-4.5, 1);
      ctx.lineTo(-0.5, 1);
      ctx.lineTo(-1.5, 7);
      ctx.lineTo(4.5, -1);
      ctx.lineTo(0.5, -1);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    case 'no_water':
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.quadraticCurveTo(6, 1, 4, 4);
      ctx.quadraticCurveTo(0, 9, -4, 4);
      ctx.quadraticCurveTo(-6, 1, 0, -7);
      ctx.fill();
      return;
    case 'abandoned':
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-5, 6);
      ctx.lineTo(-5, -1);
      ctx.lineTo(0, -6);
      ctx.lineTo(5, -1);
      ctx.lineTo(5, 6);
      ctx.closePath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 5);
      ctx.moveTo(3, 0);
      ctx.lineTo(-3, 5);
      ctx.stroke();
      return;
  }
}

/** Badge plus glyph at world point (wx, wy), `radius` in screen pixels. */
function drawBadge(ctx: IsoRenderer, wx: number, wy: number, kind: ProblemKind, radius: number, zoom: number, t: number, count?: number): void {
  const s = radius / 10 / zoom;
  ctx.save();
  ctx.translate(wx, wy);
  ctx.scale(s, s);
  ctx.fillStyle = BADGE_FILL;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = RING[kind];
  ctx.lineWidth = 2;
  ctx.stroke();
  drawGlyph(ctx, kind, t);
  if (count !== undefined && count > 1) {
    ctx.fillStyle = RING[kind];
    ctx.beginPath();
    ctx.arc(9, -8, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count > 99 ? '99+' : String(count), 9, -7.5);
  }
  ctx.restore();
}

/**
 * Cached icon layer for one canvas. `draw` is called every frame; the grid scan happens at most once per
 * `refreshMs` and only when grid, outbreaks, river level or cuts changed.
 */
export class ProblemIconLayer {
  private set: ProblemIconSet | null = null;
  private lastCompute = -Infinity;
  private lastGrid: unknown = null;
  private lastKey = '';
  private lastOutbreaks: unknown = null;
  private roadAccess: Uint8Array | null = null;
  private roadKey = '';
  private time = 0;

  /** The current icon set (for tests and the perf HUD). */
  get current(): ProblemIconSet | null {
    return this.set;
  }

  update(state: GameState, now: number): void {
    const key = `${state.id}|${state.gridSize}|${state.riverLevel ?? 0}|${state.disastersEnabled}|${(state.stats.power?.cut ?? []).join(',')}`;
    const changed = state.grid !== this.lastGrid || key !== this.lastKey || state.outbreaks !== this.lastOutbreaks;
    if (!changed && this.set) return;
    if (this.set && now - this.lastCompute < PROBLEM_ICON_CONFIG.refreshMs) return;
    // Road access only changes when roads or zones change; the grid reference changes every tick.
    const roadKey = `${state.id}|${state.gridSize}|${state.roadNetworkVersion ?? 0}|${state.structureVersion ?? 0}|${Math.floor(now / 5000)}`;
    if (roadKey !== this.roadKey || !this.roadAccess) {
      this.roadAccess = computeRoadAccessMask(state.grid, state.gridSize);
      this.roadKey = roadKey;
    }
    this.set = computeProblemIconsForState(state, this.roadAccess);
    this.lastGrid = state.grid;
    this.lastKey = key;
    this.lastOutbreaks = state.outbreaks;
    this.lastCompute = now;
  }

  /** Number of icons that would show at building zoom. */
  count(): number {
    return this.set ? this.set.tiles.length : 0;
  }

  draw(ctx: IsoRenderer, view: ProblemIconView, delta: number): void {
    const set = this.set;
    if (!set || (set.tiles.length === 0 && set.infectedBlocks.length === 0)) return;
    this.time += delta;
    const { offset, zoom, dpr } = view;
    const size = set.size;
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    const left = -offset.x / zoom - TILE_WIDTH;
    const top = -offset.y / zoom - TILE_HEIGHT * 3;
    const right = view.width / (dpr * zoom) - offset.x / zoom + TILE_WIDTH;
    const bottom = view.height / (dpr * zoom) - offset.y / zoom + TILE_HEIGHT * 3;
    const visible = (wx: number, wy: number) => wx >= left && wx <= right && wy >= top && wy <= bottom;
    const toWorld = (x: number, y: number) => ({
      wx: (x - y) * (TILE_WIDTH / 2) + TILE_WIDTH / 2,
      wy: (x + y) * (TILE_HEIGHT / 2),
    });

    if (isBuildingLevelZoom(zoom)) {
      const fire = kindIndex('fire');
      const disease = kindIndex('disease');
      const lift = TILE_HEIGHT * 0.9;
      for (let k = 0; k < set.tiles.length; k++) {
        const kind = set.kinds[k];
        // Fire already has the pulsing incident marker; disease is one badge per block (below).
        if (kind === fire || kind === disease) continue;
        const i = set.tiles[k];
        const { wx, wy } = toWorld(i % size, (i / size) | 0);
        if (!visible(wx, wy)) continue;
        drawBadge(ctx, wx, wy - lift, PROBLEM_KINDS[kind], PROBLEM_ICON_CONFIG.screenRadius, zoom, this.time);
      }
      for (const f of set.infectedBlocks) {
        const b = getFeederBounds(f, size);
        const { wx, wy } = toWorld(b.centerX, b.centerY);
        if (!visible(wx, wy)) continue;
        drawBadge(ctx, wx, wy - TILE_HEIGHT * 2, 'disease', PROBLEM_ICON_CONFIG.districtScreenRadius, zoom, this.time);
      }
    } else {
      for (const d of set.districts) {
        const { wx, wy } = toWorld(d.x, d.y);
        if (!visible(wx, wy)) continue;
        drawBadge(ctx, wx, wy, d.kind, PROBLEM_ICON_CONFIG.districtScreenRadius, zoom, this.time, d.count);
      }
    }
    ctx.restore();
  }
}
