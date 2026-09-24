/**
 * Dev-only preview scenes for the procedural Varanasi sprites (used by /dev/sprites).
 * Pure DOM + canvas code so it can also be bundled into a standalone screenshot harness.
 */
import type { Building, BuildingType } from '@/types/game';
import { getSpriteRenderInfo, selectSpriteSource } from '@/components/game/buildingSprite';
import { getActiveSpritePack } from '@/lib/renderConfig';
import { loadSpriteImage } from '@/components/game/imageLoader';
import {
  VARANASI_PROCEDURAL_SPRITES,
  VARANASI_PROCEDURAL_SPRITE_TYPES,
  getProceduralSprite,
  getProceduralSpriteDrawRect,
  pickProceduralVariant,
  type VaranasiProceduralSpriteType,
} from '@/components/game/procedural/varanasiSprites';

const TILE_W = 64;

type Ctx = CanvasRenderingContext2D;

function gridToScreen(x: number, y: number, tw: number, ox: number, oy: number): [number, number] {
  return [(x - y) * (tw / 2) + ox, (x + y) * (tw * 0.6) / 2 + oy];
}

function diamond(ctx: Ctx, sx: number, sy: number, tw: number, fill: string, stroke?: string): void {
  const th = tw * 0.6;
  ctx.beginPath();
  ctx.moveTo(sx + tw / 2, sy);
  ctx.lineTo(sx + tw, sy + th / 2);
  ctx.lineTo(sx + tw / 2, sy + th);
  ctx.lineTo(sx, sy + th / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function makeCanvas(w: number, h: number, scale = 1): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  canvas.style.width = `${Math.ceil(w)}px`;
  canvas.style.height = `${Math.ceil(h)}px`;
  canvas.style.imageRendering = 'auto';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

// ----------------------------------------------------------------------------
// Gallery: every sprite × variant on a background
// ----------------------------------------------------------------------------

export function drawGallery(bg: string, fg: string, displayTile = 128): HTMLCanvasElement {
  const cells: { type: VaranasiProceduralSpriteType; variant: number; flipped: boolean }[] = [];
  for (const type of VARANASI_PROCEDURAL_SPRITE_TYPES) {
    const def = VARANASI_PROCEDURAL_SPRITES[type];
    for (let v = 0; v < def.variants; v++) cells.push({ type, variant: v, flipped: false });
    if (def.waterfront) cells.push({ type, variant: 0, flipped: true });
  }
  // lay out in rows with a max width
  const maxW = 1500;
  const gap = 24;
  const labelH = 18;
  let x = gap;
  let y = gap;
  let rowH = 0;
  const placed: { c: (typeof cells)[number]; x: number; y: number; w: number; h: number }[] = [];
  for (const c of cells) {
    const def = VARANASI_PROCEDURAL_SPRITES[c.type];
    const tw = displayTile * (def.footprint >= 3 ? 0.75 : 1);
    const s = getProceduralSprite(c.type, c.variant, c.flipped, 256)!;
    const k = tw / s.tilePx;
    const w = s.width * k;
    const h = s.height * k + labelH;
    if (x + w > maxW) {
      x = gap;
      y += rowH + gap;
      rowH = 0;
    }
    placed.push({ c, x, y, w, h });
    x += w + gap;
    rowH = Math.max(rowH, h);
  }
  const H = y + rowH + gap;
  const { canvas, ctx } = makeCanvas(maxW, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, maxW, H);
  ctx.font = '12px ui-monospace, monospace';
  for (const p of placed) {
    const s = getProceduralSprite(p.c.type, p.c.variant, p.c.flipped, 256)!;
    const k = (p.w / s.width);
    // faint base diamond to show the footprint
    const tw = s.tilePx * k;
    const n = s.footprint;
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const sx = p.x + p.w / 2 - tw / 2 + (i - j) * tw / 2;
      const sy = p.y + s.baseTopY * k + (i + j) * tw * 0.3;
      diamond(ctx, sx, sy, tw, 'transparent', fg);
    }
    ctx.restore();
    ctx.drawImage(s.canvas as CanvasImageSource, p.x, p.y, p.w, s.height * k);
    ctx.fillStyle = fg;
    ctx.fillText(`${p.c.type}${VARANASI_PROCEDURAL_SPRITES[p.c.type].variants > 1 ? ` v${p.c.variant}` : ''}${p.c.flipped ? ' (flipped)' : ''}`, p.x, p.y + p.h - 4);
  }
  return canvas;
}

// ----------------------------------------------------------------------------
// Map mock-up: river, row of ghats, landmark, embankment, neighbourhood + existing sprite
// ----------------------------------------------------------------------------

type Placement =
  | { kind: 'proc'; type: VaranasiProceduralSpriteType; x: number; y: number; variant?: number; flipped?: boolean }
  | { kind: 'sheet'; type: BuildingType; x: number; y: number };

interface SceneSpec {
  size: number;
  isWater: (x: number, y: number) => boolean;
  items: Placement[];
}

function riverScene(): SceneSpec {
  const size = 16;
  const items: Placement[] = [];
  // 10 ghats in a row along the river bank (water at +x → unflipped)
  for (let y = 0; y < 10; y++) items.push({ kind: 'proc', type: 'ghat', x: 11, y });
  // Dashashwamedh continues the row (its river column is x = 11)
  items.push({ kind: 'proc', type: 'landmark_dashashwamedh', x: 10, y: 10 });
  items.push({ kind: 'proc', type: 'ghat', x: 11, y: 12 });
  items.push({ kind: 'proc', type: 'ghat', x: 11, y: 13, variant: 1 });
  // embankment lines (along y and along x)
  for (let y = 0; y < 6; y++) items.push({ kind: 'proc', type: 'embankment', x: 9, y });
  for (let x = 5; x < 9; x++) items.push({ kind: 'proc', type: 'embankment', x, y: 6 });
  // 3×3 neighbourhood: informal housing next to existing painted sprites
  const hood: [number, number, Placement['kind'], string, number?][] = [
    [1, 9, 'proc', 'informal_housing', 0],
    [2, 9, 'sheet', 'house_small'],
    [3, 9, 'proc', 'informal_housing', 1],
    [1, 10, 'proc', 'informal_housing', 1],
    [2, 10, 'proc', 'informal_housing', 0],
    [3, 10, 'sheet', 'house_medium'],
    [1, 11, 'sheet', 'shop_small'],
    [2, 11, 'proc', 'informal_housing', 0],
    [3, 11, 'proc', 'informal_housing', 1],
  ];
  for (const [x, y, kind, type, variant] of hood) {
    if (kind === 'proc') items.push({ kind, type: type as VaranasiProceduralSpriteType, x, y, variant });
    else items.push({ kind, type: type as BuildingType, x, y });
  }
  items.push({ kind: 'proc', type: 'sewage_treatment_plant', x: 5, y: 1 });
  items.push({ kind: 'sheet', type: 'water_tower', x: 7, y: 9 });
  items.push({ kind: 'proc', type: 'landmark_kashi_vishwanath', x: 5, y: 10 });
  items.push({ kind: 'proc', type: 'jal_sansthan_water_works', x: 1, y: 1 });
  items.push({ kind: 'sheet', type: 'police_station', x: 1, y: 5 });
  items.push({ kind: 'proc', type: 'informal_housing', x: 3, y: 5, variant: 0 });
  items.push({ kind: 'sheet', type: 'house_small', x: 4, y: 5 });
  return { size, isWater: (x) => x >= 12, items };
}

function flippedScene(): SceneSpec {
  const size = 12;
  const items: Placement[] = [];
  // river along +y (water at y ≥ 9) → ghats flipped
  for (let x = 0; x < 10; x++) items.push({ kind: 'proc', type: 'ghat', x, y: 8, flipped: true });
  for (let x = 1; x < 7; x++) items.push({ kind: 'proc', type: 'embankment', x, y: 6 });
  items.push({ kind: 'proc', type: 'landmark_ramnagar_fort', x: 1, y: 1 });
  items.push({ kind: 'proc', type: 'landmark_sarnath', x: 5, y: 1 });
  return { size, isWater: (_x, y) => y >= 9, items };
}

function landmarksScene(): SceneSpec {
  const size = 10;
  const items: Placement[] = [
    { kind: 'proc', type: 'landmark_bhu', x: 1, y: 1 },
    { kind: 'sheet', type: 'university', x: 6, y: 1 },
    { kind: 'sheet', type: 'city_hall', x: 6, y: 5 },
    { kind: 'proc', type: 'landmark_kashi_vishwanath', x: 1, y: 6 },
    { kind: 'sheet', type: 'hospital', x: 3, y: 6 },
    { kind: 'sheet', type: 'apartment_low', x: 1, y: 8 },
    { kind: 'sheet', type: 'shop_medium', x: 2, y: 8 },
  ];
  return { size, isWater: () => false, items };
}

function footprintOf(p: Placement): number {
  if (p.kind === 'proc') return VARANASI_PROCEDURAL_SPRITES[p.type].footprint;
  const multi: Partial<Record<string, number>> = { university: 3, city_hall: 2, hospital: 2, water_tower: 1, police_station: 1 };
  return multi[p.type] ?? 1;
}

function fakeBuilding(type: BuildingType): Building {
  return {
    type,
    level: 1,
    population: 0,
    jobs: 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
  };
}

/** A loaded, chroma-keyed sprite sheet. */
export interface LoadedSheet {
  image: CanvasImageSource;
  width: number;
  height: number;
}
export type SheetMap = ReadonlyMap<string, LoadedSheet>;

/** Every sprite-sheet URL the preview scenes need (the painted comparison buildings). */
export function requiredSheetSources(): string[] {
  const pack = getActiveSpritePack();
  const out = new Set<string>();
  for (const make of Object.values(PREVIEW_SCENES)) {
    for (const it of make().items) {
      if (it.kind === 'sheet') out.add(selectSpriteSource(it.type, fakeBuilding(it.type), it.x, it.y, pack).source);
    }
  }
  return [...out];
}

export function drawScene(spec: SceneSpec, tileW: number, sheets: SheetMap, bg = '#20262b'): HTMLCanvasElement {
  const zoom = tileW / TILE_W;
  const W = spec.size * tileW + tileW;
  const H = spec.size * tileW * 0.6 + tileW * 2.2;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const ox = W / 2 - tileW / 2;
  const oy = tileW * 1.6;
  // ground
  for (let y = 0; y < spec.size; y++) {
    for (let x = 0; x < spec.size; x++) {
      const [sx, sy] = gridToScreen(x, y, tileW, ox, oy);
      if (spec.isWater(x, y)) {
        const t = ((x * 7 + y * 13) % 5) / 40;
        diamond(ctx, sx, sy, tileW, `rgb(${Math.round(64 + t * 60)},${Math.round(128 + t * 50)},${Math.round(160 + t * 40)})`);
      } else {
        const t = ((x * 31 + y * 17) % 7) / 60;
        diamond(ctx, sx, sy, tileW, `rgb(${Math.round(112 + t * 50)},${Math.round(150 + t * 40)},${Math.round(76 + t * 20)})`, 'rgba(0,0,0,0.06)');
      }
    }
  }
  // depth-sort by the front corner of the footprint
  const items = [...spec.items].sort((a, b) => {
    const fa = footprintOf(a);
    const fb = footprintOf(b);
    return a.x + a.y + 2 * (fa - 1) - (b.x + b.y + 2 * (fb - 1)) || a.x - b.x;
  });
  for (const it of items) {
    const [sx, sy] = gridToScreen(it.x, it.y, tileW, ox, oy);
    if (it.kind === 'proc') {
      const variant = it.variant ?? pickProceduralVariant(it.type, it.x, it.y);
      const s = getProceduralSprite(it.type, variant, it.flipped ?? false, 256);
      if (!s) continue;
      const r = getProceduralSpriteDrawRect(s, sx, sy, tileW);
      ctx.drawImage(s.canvas as CanvasImageSource, r.dx, r.dy, r.dw, r.dh);
    } else {
      // Draw exactly like the game does (positions computed at TILE_WIDTH, then scaled by zoom)
      const pack = getActiveSpritePack();
      const src = selectSpriteSource(it.type, fakeBuilding(it.type), it.x, it.y, pack).source;
      const loaded = sheets.get(src);
      if (!loaded) continue;
      const sheet = loaded.image;
      const info = getSpriteRenderInfo(it.type, fakeBuilding(it.type), it.x, it.y, sx / zoom, sy / zoom, loaded.width, loaded.height, {}, pack);
      if (!info || !info.coords) continue;
      const { coords, positioning, shouldFlip } = info;
      ctx.save();
      ctx.scale(zoom, zoom);
      if (shouldFlip) {
        ctx.translate(positioning.drawX + positioning.destWidth / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sheet, coords.sx, coords.sy, coords.sw, coords.sh, -positioning.destWidth / 2, positioning.drawY, positioning.destWidth, positioning.destHeight);
      } else {
        ctx.drawImage(sheet, coords.sx, coords.sy, coords.sw, coords.sh, positioning.drawX, positioning.drawY, positioning.destWidth, positioning.destHeight);
      }
      ctx.restore();
    }
  }
  return canvas;
}

export const PREVIEW_SCENES = { river: riverScene, flipped: flippedScene, landmarks: landmarksScene };

function section(root: HTMLElement, title: string, el: HTMLElement): void {
  const wrap = document.createElement('section');
  wrap.style.margin = '16px 0 28px';
  const h = document.createElement('h2');
  h.textContent = title;
  h.style.font = '600 15px system-ui, sans-serif';
  h.style.margin = '0 0 8px';
  wrap.appendChild(h);
  wrap.appendChild(el);
  root.appendChild(wrap);
}

/**
 * Build the whole preview into `root`. `sheets` holds the chroma-keyed painted sheets (may be empty).
 * `only` limits the output to one section (used by the screenshot harness).
 */
export function renderPreview(root: HTMLElement, sheets: SheetMap, only?: string): void {
  root.innerHTML = '';
  const want = (k: string) => !only || only === k;
  if (want('light')) section(root, 'All sprites (light background, 128 px tiles; 3×3+ at 96 px)', drawGallery('#f3efe6', '#333'));
  if (want('dark')) section(root, 'All sprites (dark background)', drawGallery('#1d2226', '#ddd'));
  if (want('river1')) section(root, 'River bank at game zoom 1× (64 px tiles): 10 ghats + Dashashwamedh, embankments, 3×3 neighbourhood with painted sprites', drawScene(PREVIEW_SCENES.river(), 64, sheets));
  if (want('river2')) section(root, 'River bank at zoom 2× (128 px tiles)', drawScene(PREVIEW_SCENES.river(), 128, sheets));
  if (want('flipped')) section(root, 'Flipped ghats (river on the +y side), Ramnagar Fort and Sarnath at 2×', drawScene(PREVIEW_SCENES.flipped(), 128, sheets));
  if (want('landmarks')) section(root, 'BHU and Kashi Vishwanath next to painted service buildings at 2×', drawScene(PREVIEW_SCENES.landmarks(), 128, sheets));
}

/** Load (and chroma-key) every painted sheet the scenes need. Failures are skipped. */
export async function loadPreviewSheets(): Promise<Map<string, LoadedSheet>> {
  const map = new Map<string, LoadedSheet>();
  await Promise.all(
    requiredSheetSources().map(async (src) => {
      try {
        const img = await loadSpriteImage(src, true);
        map.set(src, { image: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      } catch (e) {
        console.warn('[dev/sprites] could not load', src, e);
      }
    }),
  );
  return map;
}
