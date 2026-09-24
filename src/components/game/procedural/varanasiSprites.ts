/**
 * Procedural Varanasi sprites (S3-T3 part 1).
 *
 * Hand-authored Canvas-2D drawings of the Varanasi-specific buildings, painted in a warm, softly
 * shaded isometric style that sits next to the painted sprite sheets. They stand in until painted
 * art exists (see `ai-design/varanasi/prompts.md`), and are rendered ONCE per (type, variant,
 * flipped, resolution) into a cached canvas that the renderer can `drawImage` / upload as a texture.
 *
 * ── Canvas layout (the "anchor" contract) ────────────────────────────────────────────────────────
 *   tilePx       pixel width of ONE tile inside the cached canvas (default 256)
 *   width      = footprint × tilePx                 (the base diamond spans the full width)
 *   height     = (heightTiles + footprint × 0.6 + BOTTOM_PAD_TILES) × tilePx
 *   baseTopY   = heightTiles × tilePx               (y of the diamond's TOP corner; its x is width/2)
 *   The diamond's bottom corner is at (width/2, baseTopY + footprint × tilePx × 0.6).
 *
 * ── Placing it on the map ───────────────────────────────────────────────────────────────────────
 *   For a building whose ORIGIN tile (min x, min y: the top/north tile of the footprint) is at
 *   `gridToScreen(x, y)` = (screenX, screenY) (top-left of that tile's bounding box), use
 *   `getProceduralSpriteDrawRect(sprite, screenX, screenY, TILE_WIDTH)`:
 *     scale = tileWidth / tilePx
 *     dx    = screenX + tileWidth/2 − width·scale/2
 *     dy    = screenY − baseTopY·scale
 *   The art then covers exactly the N×N footprint (tile height = 0.6 × tile width, as in the game).
 *
 * ── Flipped ─────────────────────────────────────────────────────────────────────────────────────
 *   `flipped = false`: waterfront art faces the tile edge towards grid +x (screen lower-right edge).
 *                      On the Varanasi map the Ganga is east (+x) of the west-bank ghats.
 *   `flipped = true` : the canvas is mirrored horizontally, so the art faces grid +y (screen
 *                      lower-left edge). This matches how the renderer mirrors `building.flipped`.
 *
 * Everything in this module is side-effect free at import time (safe in node / workers).
 */
import { Iso, alpha, mat, mix, seededRng, shade, type Ctx2D, type Mat, type P3 } from './isoPainter';
import type { Rng } from '@/lib/rng';

// ============================================================================
// Palette
// ============================================================================

const C = {
  sand: '#d9b582',
  sandLight: '#e8cc9a',
  sandDeep: '#b98d5a',
  riser: '#a9804f',
  wet: '#7d6a50',
  algae: '#5f6b3f',
  chunar: '#e3cfa6',
  chunarDeep: '#c9ae80',
  pinkSand: '#c8876a',
  pinkSandDeep: '#a9664c',
  cream: '#ecdcb8',
  whitewash: '#f1ebdd',
  govMaroon: '#8c3b2b',
  brick: '#9c5a3e',
  brickDark: '#7a4230',
  mortar: '#c8ae8e',
  concrete: '#bdb6a8',
  concreteDark: '#8f887c',
  earth: '#a8865f',
  earthDark: '#8a6b4a',
  dust: '#c4a67c',
  grass: '#7da04b',
  lawn: '#74a043',
  lawnDark: '#5d8a35',
  water: '#4f8a8c',
  waterDeep: '#356e74',
  sludge: '#7a7148',
  saffron: '#f39b1d',
  marigold: '#f5a623',
  gold: '#d9a52b',
  brass: '#c99a3a',
  wood: '#7b5434',
  cane: '#caa061',
  tarpBlue: '#2f6fb3',
  tarpBlueDeep: '#245a94',
  tin: '#9aa4aa',
  rust: '#94532f',
  turquoise: '#3fa3a0',
  pinkPlaster: '#e0a7a0',
  yellowPlaster: '#e8c86a',
  pipeBlue: '#4d7fa6',
  pipeGrey: '#8d949a',
  black: '#2a2a2e',
} as const;

const OUTLINE = 'rgba(52,34,20,0.55)';

// ============================================================================
// Layout constants
// ============================================================================

/** Default cache resolution: pixels per tile width inside cached sprite canvases. */
export const PROCEDURAL_TILE_PX = 256;
/** Transparent padding under the base diamond (tile widths), for soft shadows. */
export const BOTTOM_PAD_TILES = 0.04;
/** Tile height / tile width, same as the game's HEIGHT_RATIO. */
export const PROCEDURAL_ISO_RATIO = 0.6;
/** Tiny overlap (tile units) so neighbouring tileable sprites never show an anti-aliasing seam. */
const BLEED = 0.006;

// ============================================================================
// Shared helpers
// ============================================================================

function makeIso(ctx: Ctx2D, w: number, h: number, n: number): Iso {
  return new Iso(ctx, w, h, n, BOTTOM_PAD_TILES);
}

/** A ground slab (like the painted sprites' base): top + visible edges, inset from the footprint. */
function slab(iso: Iso, rng: Rng, inset: number, h: number, top: string, side: string, grain: readonly string[] = []): void {
  const n = iso.n;
  const m = mat(side, { right: -0.28 });
  iso.box(inset, inset, n - inset, n - inset, 0, h, { ...m, top }, { edges: false });
  // darker earth strip under the slab edge
  iso.poly(iso.faceVQuad(n - inset, inset, n - inset, 0, h * 0.45), alpha('#3a2616', 0.25));
  iso.poly(iso.faceUQuad(n - inset, inset, n - inset, 0, h * 0.45), alpha('#3a2616', 0.3));
  const topPts = iso.topQuad(inset, inset, n - inset, n - inset, h);
  if (grain.length) iso.speckle(topPts, rng, Math.round(900 * n * n), grain, 1.3);
  iso.line([inset, n - inset, h], [n - inset, n - inset, h], alpha(shade(top, 0.35), 0.6), 1.2);
  iso.line([n - inset, inset, h], [n - inset, n - inset, h], alpha(shade(top, 0.2), 0.4), 1);
}

/** Lawn with mowing stripes and grain. */
function lawn(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, base: string = C.lawn): void {
  const pts = iso.topQuad(u0, v0, u1, v1, z);
  iso.poly(pts, base);
  iso.clipped(pts, () => {
    const stripe = alpha(shade(base, 0.08), 0.5);
    for (let u = u0; u < u1; u += 0.16) iso.poly(iso.topQuad(u, v0, Math.min(u + 0.08, u1), v1, z), stripe);
  });
  iso.speckle(pts, rng, Math.round(700 * (u1 - u0) * (v1 - v0)), [shade(base, 0.18), shade(base, -0.18), shade(base, -0.1), '#9cbc5a'], 1.2);
}

/** Paving joints on a horizontal rectangle. */
function paving(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, du: number, dv: number, color: string): void {
  iso.clipped(iso.topQuad(u0, v0, u1, v1, z), () => {
    for (let u = u0 + du; u < u1 - 1e-6; u += du) iso.line([u, v0, z], [u, v1, z], color, 0.9);
    let row = 0;
    for (let u = u0; u < u1 - 1e-6; u += du, row++) {
      const off = (row % 2) * dv * 0.5 + rng() * dv * 0.2;
      for (let v = v0 + off; v < v1; v += dv) iso.line([u, v, z], [Math.min(u + du, u1), v, z], color, 0.8);
    }
  });
}

/** Horizontal stone/brick courses with staggered joints on a +u face. */
function coursesU(iso: Iso, rng: Rng, u: number, v0: number, v1: number, z0: number, z1: number, dz: number, dv: number, color: string, lw = 0.8): void {
  iso.clipped(iso.faceUQuad(u, v0, v1, z0, z1), () => {
    let row = 0;
    for (let z = z0 + dz; z < z1 + 1e-6; z += dz, row++) {
      iso.line([u, v0, z], [u, v1, z], color, lw);
      const off = (row % 2) * dv * 0.5;
      for (let v = v0 + off + rng() * dv * 0.15; v < v1; v += dv) iso.line([u, v, z - dz], [u, v, z], color, lw * 0.8);
    }
  });
}

/** Horizontal stone/brick courses with staggered joints on a +v face. */
function coursesV(iso: Iso, rng: Rng, v: number, u0: number, u1: number, z0: number, z1: number, dz: number, du: number, color: string, lw = 0.8): void {
  iso.clipped(iso.faceVQuad(v, u0, u1, z0, z1), () => {
    let row = 0;
    for (let z = z0 + dz; z < z1 + 1e-6; z += dz, row++) {
      iso.line([u0, v, z], [u1, v, z], color, lw);
      const off = (row % 2) * du * 0.5;
      for (let u = u0 + off + rng() * du * 0.15; u < u1; u += du) iso.line([u, v, z - dz], [u, v, z], color, lw * 0.8);
    }
  });
}

/** Rectangular window (dark glass/shutter) on a +u face, with a light sill. */
function windowU(iso: Iso, u: number, v0: number, v1: number, z0: number, z1: number, glass = '#3b3a44', frame?: string): void {
  if (frame) iso.poly(iso.faceUQuad(u, v0 - 0.008, v1 + 0.008, z0 - 0.008, z1 + 0.01), frame);
  iso.poly(iso.faceUQuad(u, v0, v1, z0, z1), glass);
  iso.line([u, v0, z0], [u, v1, z0], alpha('#fff4dc', 0.35), 1);
}

function windowV(iso: Iso, v: number, u0: number, u1: number, z0: number, z1: number, glass = '#3b3a44', frame?: string): void {
  if (frame) iso.poly(iso.faceVQuad(v, u0 - 0.008, u1 + 0.008, z0 - 0.008, z1 + 0.01), frame);
  iso.poly(iso.faceVQuad(v, u0, u1, z0, z1), glass);
  iso.line([u0, v, z0], [u1, v, z0], alpha('#fff4dc', 0.45), 1);
}

/** Vertical rain/monsoon streaks darkening a +u face from the top. */
function weatherU(iso: Iso, rng: Rng, u: number, v0: number, v1: number, z0: number, z1: number, count: number, strength = 0.18): void {
  iso.clipped(iso.faceUQuad(u, v0, v1, z0, z1), () => {
    for (let i = 0; i < count; i++) {
      const v = v0 + rng() * (v1 - v0);
      const len = (z1 - z0) * (0.2 + rng() * 0.6);
      const wv = 0.006 + rng() * 0.012;
      iso.poly(iso.faceUQuad(u, v, v + wv, z1 - len, z1), `rgba(50,40,30,${(strength * (0.4 + rng() * 0.6)).toFixed(3)})`);
    }
  });
}

function weatherV(iso: Iso, rng: Rng, v: number, u0: number, u1: number, z0: number, z1: number, count: number, strength = 0.14): void {
  iso.clipped(iso.faceVQuad(v, u0, u1, z0, z1), () => {
    for (let i = 0; i < count; i++) {
      const u = u0 + rng() * (u1 - u0);
      const len = (z1 - z0) * (0.2 + rng() * 0.6);
      const wu = 0.006 + rng() * 0.012;
      iso.poly(iso.faceVQuad(v, u, u + wu, z1 - len, z1), `rgba(50,40,30,${(strength * (0.4 + rng() * 0.6)).toFixed(3)})`);
    }
  });
}

/** Rising-damp / ground grime band at the foot of both visible faces of a box. */
function grime(iso: Iso, u0: number, v0: number, u1: number, v1: number, z0: number, h: number, strength = 0.22): void {
  const { ctx } = iso;
  const [x0, yTop] = iso.pt(u1, v1, z0 + h);
  const [, yBot] = iso.pt(u1, v1, z0);
  const g = ctx.createLinearGradient(x0, yTop, x0, yBot);
  g.addColorStop(0, 'rgba(40,28,18,0)');
  g.addColorStop(1, `rgba(40,28,18,${strength})`);
  iso.poly(iso.faceVQuad(v1, u0, u1, z0, z0 + h), g);
  iso.poly(iso.faceUQuad(u1, v0, v1, z0, z0 + h), g);
}

/** A small dome (lathe) with finial. r = radius at base. */
function dome(iso: Iso, u: number, v: number, z: number, r: number, color: string, kind: 'onion' | 'round' | 'flat' = 'round', finial: string = C.brass): void {
  const prof: [number, number][] =
    kind === 'onion'
      ? [
          [0, r * 0.85],
          [r * 0.25, r * 1.05],
          [r * 0.6, r * 0.95],
          [r * 0.95, r * 0.6],
          [r * 1.2, r * 0.25],
          [r * 1.35, 0.0],
        ]
      : kind === 'flat'
        ? [
            [0, r],
            [r * 0.35, r * 0.85],
            [r * 0.55, r * 0.5],
            [r * 0.62, 0],
          ]
        : [
            [0, r],
            [r * 0.35, r * 0.95],
            [r * 0.65, r * 0.78],
            [r * 0.88, r * 0.45],
            [r, 0],
          ];
  iso.lathe(u, v, z, prof, (t, up) => (up > 0.6 ? shade(color, 0.08) : color), { outline: true });
  const top = prof[prof.length - 1][0];
  iso.lathe(u, v, z + top - r * 0.05, [
    [0, r * 0.12],
    [r * 0.12, r * 0.14],
    [r * 0.2, r * 0.06],
    [r * 0.42, r * 0.03],
    [r * 0.45, 0],
  ], () => finial, { outline: false });
}

/**
 * Stone chhatri (domed pavilion on four pillars). (u, v) is the back corner of its square base,
 * `s` its side length (tile units), standing on height z.
 */
function chhatri(iso: Iso, rng: Rng, u: number, v: number, z: number, s: number, stone: string, domeColor = stone, pillarH = s * 1.15): void {
  const m = mat(stone);
  const p = s * 0.14;
  // plinth
  iso.aoRect(u, v, u + s, v + s, z, 0.04, 0.35);
  iso.boxLit(u - s * 0.06, v - s * 0.06, u + s * 1.06, v + s * 1.06, z, z + s * 0.14, m);
  const zb = z + s * 0.14;
  // back pillars, then front pillars
  const pil = (pu: number, pv: number) => iso.box(pu, pv, pu + p, pv + p, zb, zb + pillarH, mat(shade(stone, -0.03)));
  // interior shadow (reads as the open pavilion)
  iso.poly(iso.topQuad(u + p, v + p, u + s - p, v + s - p, zb + 0.001), alpha('#3a2a1e', 0.35));
  pil(u, v);
  pil(u + s - p, v);
  pil(u, v + s - p);
  pil(u + s - p, v + s - p);
  // entablature with overhang (chhajja)
  const zt = zb + pillarH;
  const o = s * 0.12;
  iso.box(u - o, v - o, u + s + o, v + s + o, zt, zt + s * 0.1, m);
  iso.line([u - o, v + s + o, zt], [u + s + o, v + s + o, zt], alpha('#2a1a10', 0.5), 1.2);
  // small parapet band
  iso.box(u - o * 0.3, v - o * 0.3, u + s + o * 0.3, v + s + o * 0.3, zt + s * 0.1, zt + s * 0.17, mat(shade(stone, 0.04)));
  dome(iso, u + s / 2, v + s / 2, zt + s * 0.17, s * 0.44, domeColor, 'onion');
  void rng;
}

/** Bamboo cane umbrella (the Dashashwamedh kind) over a wooden takht. */
function caneUmbrella(iso: Iso, u: number, v: number, z: number, r: number, withTakht = true): void {
  if (withTakht) {
    iso.aoRect(u - r * 0.45, v - r * 0.35, u + r * 0.45, v + r * 0.35, z, 0.03, 0.4);
    iso.box(u - r * 0.45, v - r * 0.35, u + r * 0.45, v + r * 0.35, z, z + r * 0.22, mat(C.wood, { top: 0.1 }));
    // folded cloth on the takht
    iso.box(u - r * 0.2, v - r * 0.1, u + r * 0.15, v + r * 0.25, z + r * 0.22, z + r * 0.27, mat('#e8dcc2'), { edges: false });
  }
  const poleH = r * 1.9;
  iso.line([u, v, z], [u, v, z + poleH], '#5a3d25', 2.2);
  // shadow on ground
  iso.ellipse(u + r * 0.45, v - r * 0.1, z, r * 0.9, 'rgba(40,24,14,0.22)');
  // canopy: shallow cone
  iso.lathe(u, v, z + poleH - r * 0.05, [
    [0, r],
    [r * 0.08, r * 0.92],
    [r * 0.3, r * 0.35],
    [r * 0.36, 0.02],
  ], (t) => (t < 0.15 ? shade(C.cane, -0.15) : C.cane), { outline: true, lit: 0.22, dark: -0.3 });
  // ribs
  const ztop = z + poleH + r * 0.3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const eu = u + Math.cos(a) * r;
    const ev = v + Math.sin(a) * r;
    if (Math.cos(a) + Math.sin(a) < -0.3) continue; // hidden behind
    iso.line([u, v, ztop], [eu, ev, z + poleH - r * 0.05], alpha('#6e4c26', 0.55), 0.9);
  }
}

/** Bamboo pole with a triangular pennant flying to the screen-right. */
function flag(iso: Iso, u: number, v: number, z: number, h: number, color: string): void {
  iso.line([u, v, z], [u, v, z + h], '#6b4a2a', 1.8);
  const zt = z + h;
  const L = h * 0.32;
  const pts: P3[] = [
    [u, v, zt],
    [u + L * 0.5, v - L * 0.5, zt - h * 0.04],
    [u + L, v - L, zt - h * 0.09],
    [u + L * 0.5, v - L * 0.5, zt - h * 0.12],
    [u, v, zt - h * 0.16],
  ];
  iso.poly(pts, color, alpha(shade(color, -0.5), 0.7), 0.8);
  iso.poly(
    [
      [u, v, zt - h * 0.02],
      [u + L * 0.5, v - L * 0.5, zt - h * 0.05],
      [u + L * 0.5, v - L * 0.5, zt - h * 0.08],
      [u, v, zt - h * 0.07],
    ],
    alpha(shade(color, 0.35), 0.6),
  );
}

/** Thick pipe along a world-space polyline (drawn as layered strokes). */
function pipe(iso: Iso, pts: readonly P3[], color: string, width = 4): void {
  iso.polyline(pts, alpha(shade(color, -0.55), 0.8), width + 1.6);
  iso.polyline(pts, color, width);
  iso.polyline(
    pts.map((p) => [p[0], p[1], p[2] + 0.004] as P3),
    alpha(shade(color, 0.45), 0.8),
    Math.max(0.8, width * 0.3),
  );
}

/** Water surface with gradient, ripples and sky glints, clipped to a polygon. */
function waterSurface(iso: Iso, rng: Rng, pts: readonly P3[], base: string, deep: string): void {
  const { ctx } = iso;
  const xs = pts.map((p) => iso.sx(p[0], p[1]));
  const ys = pts.map((p) => iso.sy(p[0], p[1], p[2]));
  const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  g.addColorStop(0, shade(deep, -0.05));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, 0.12));
  iso.poly(pts, g);
  iso.clipped(pts, () => {
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    for (let i = 0; i < 26; i++) {
      const x = minX + rng() * (maxX - minX);
      const y = minY + rng() * (maxY - minY);
      const w = (6 + rng() * 14) * iso.px;
      ctx.fillStyle = rng() < 0.6 ? alpha('#d9f1ee', 0.35) : alpha(shade(deep, -0.2), 0.3);
      ctx.fillRect(x, y, w, 1.2 * iso.px);
    }
  });
}

// ============================================================================
// GHAT (1×1, tileable along the river)
// ============================================================================

/** One stepped strip: horizontal tread from u0 to u1 at height z. */
interface Tread {
  u0: number;
  u1: number;
  z: number;
  kind: 'platform' | 'step' | 'landing' | 'ledge';
}

/** Step profile of a 1×1 ghat along u (u = 1 is the river edge). Shared by the Dashashwamedh landmark. */
export const GHAT_PROFILE: readonly Tread[] = (() => {
  const t: Tread[] = [{ u0: 0, u1: 0.22, z: 0.28, kind: 'platform' }];
  const f1 = [0.252, 0.224, 0.196, 0.168];
  f1.forEach((z, i) => t.push({ u0: 0.22 + i * 0.05, u1: 0.27 + i * 0.05, z, kind: 'step' }));
  t.push({ u0: 0.42, u1: 0.6, z: 0.14, kind: 'landing' });
  const f2 = [0.115, 0.09, 0.065, 0.04];
  f2.forEach((z, i) => t.push({ u0: 0.6 + i * 0.055, u1: 0.655 + i * 0.055, z, kind: 'step' }));
  t.push({ u0: 0.82, u1: 1, z: 0.015, kind: 'ledge' });
  return t;
})();

/**
 * Paint a run of ghat steps spanning v ∈ [v0, v1], with the profile shifted by `du` along u.
 * Treads run the full width (plus a hairline bleed), so neighbours join into one continuous bank.
 */
function ghatSteps(iso: Iso, rng: Rng, v0: number, v1: number, du = 0, profile: readonly Tread[] = GHAT_PROFILE, endCap = true): void {
  const vb0 = v0 - BLEED;
  const vb1 = v1 + BLEED;
  const riserMat = mat(C.riser);
  profile.forEach((tr, i) => {
    const u0 = tr.u0 + du;
    const u1 = tr.u1 + du;
    const next = profile[i + 1];
    const zNext = next ? next.z : 0;
    const top = iso.topQuad(u0, vb0, u1, vb1, tr.z);
    const base = tr.kind === 'platform' ? C.sandLight : tr.kind === 'landing' ? shade(C.sand, 0.05) : C.sand;
    // Slabs: joints repeat with a period of exactly one tile and each slab's tone depends only on
    // (row, slab index mod slabs-per-tile), so a slab that crosses a tile edge has the same tone on
    // both tiles, whatever variant each tile uses.
    const perTile = tr.kind === 'platform' ? 6 : 5;
    const dv = 1 / perTile;
    const off = ((i * 0.37) % 1) * dv;
    for (let k = -1; v0 + off + k * dv < v1; k++) {
      const a = Math.max(vb0, v0 + off + k * dv);
      const b = Math.min(vb1, v0 + off + (k + 1) * dv);
      if (b <= a) continue;
      const idx = (((k % perTile) + perTile) % perTile);
      const tone = (((i * 7919 + idx * 104729) % 97) / 97 - 0.5) * 0.09;
      if (tr.kind === 'ledge') {
        // wet gradient towards the water, drawn as strips so it stays aligned with the tile edge
        const strips = 24;
        for (let s = 0; s < strips; s++) {
          const f = s / (strips - 1);
          const c = f < 0.4 ? mix(shade(C.sand, -0.04 + tone), mix(C.sand, C.wet, 0.55), f / 0.4) : mix(mix(C.sand, C.wet, 0.55), C.wet, (f - 0.4) / 0.6);
          iso.poly(iso.topQuad(u0 + ((u1 - u0) * s) / strips, a, u0 + ((u1 - u0) * (s + 1.6)) / strips, b, tr.z), c);
        }
      } else {
        iso.poly(iso.topQuad(u0, a, u1, b, tr.z), shade(base, tone));
      }
    }
    // stone grain
    const grain =
      tr.kind === 'ledge'
        ? [shade(C.wet, -0.15), shade(C.wet, 0.12), C.algae, alpha(C.algae, 0.6)]
        : [shade(C.sand, -0.1), shade(C.sand, 0.12), shade(C.sandDeep, -0.05), alpha('#fff3d6', 0.5)];
    iso.speckle(top, rng, Math.round(900 * (u1 - u0) * (v1 - v0)), grain, 1.2);
    // lichen / oil stains, kept away from the tile edges
    if (tr.kind !== 'ledge') {
      const n = Math.floor(rng() * 3);
      for (let s = 0; s < n; s++) {
        const su = u0 + (u1 - u0) * (0.2 + rng() * 0.6);
        const sv = v0 + 0.12 + rng() * (v1 - v0 - 0.24);
        iso.ellipse(su, sv, tr.z, 0.012 + rng() * 0.018, alpha(rng() < 0.5 ? '#6d5a3a' : '#8a7a4a', 0.16));
      }
    }
    // joints
    const jointCol = alpha(shade(C.sandDeep, -0.35), tr.kind === 'ledge' ? 0.3 : 0.42);
    for (let k = 0; v0 + off + k * dv < v1 + 1e-6; k++) {
      const v = v0 + off + k * dv;
      if (v >= v0 - 1e-6) iso.line([u0, v, tr.z], [u1, v, tr.z], jointCol, 0.8);
    }
    if (tr.kind === 'platform' || tr.kind === 'landing') {
      for (let u = u0 + 0.07; u < u1 - 0.02; u += 0.07) iso.line([u, vb0, tr.z], [u, vb1, tr.z], alpha(shade(C.sandDeep, -0.3), 0.3), 0.7);
    }
    // contact shadow where this tread meets the riser above it
    if (i > 0 && profile[i - 1].z > tr.z) iso.poly(iso.topQuad(u0, vb0, u0 + 0.018, vb1, tr.z), alpha('#2a1a10', 0.14));
    // riser (the +u face down to the next tread)
    if (tr.z > zNext) {
      const face = iso.faceUQuad(u1, vb0, vb1, zNext, tr.z);
      const nearWater = tr.z < 0.07;
      iso.poly(face, nearWater ? mix(C.riser, C.wet, 0.6) : riserMat.right);
      iso.poly(iso.faceUQuad(u1, vb0, vb1, tr.z - (tr.z - zNext) * 0.35, tr.z), alpha('#2a1a10', 0.18));
      iso.line([u1, vb0, tr.z], [u1, vb1, tr.z], alpha('#fff0cf', 0.55), 1);
      if (tr.z - zNext > 0.05) coursesU(iso, rng, u1, v0, v1, zNext, tr.z, 0.035, 0.125, alpha('#3a2616', 0.3), 0.7);
    }
    // wet waterline and algae on the ledge edge
    if (tr.kind === 'ledge') {
      const edge = iso.topQuad(u1 - 0.04, vb0, u1, vb1, tr.z);
      iso.poly(edge, alpha('#3f4a33', 0.35));
      iso.speckle(edge, rng, 90, [alpha('#dff3ea', 0.45), alpha(C.algae, 0.7)], 1.3);
    }
  });
  if (endCap) ghatEndCap(iso, rng, v1, du, profile);
}

/** The side wall of the steps (plane v = v1). Covered by the next ghat when tiles are in a row. */
function ghatEndCap(iso: Iso, rng: Rng, v: number, du: number, profile: readonly Tread[]): void {
  const pts: P3[] = [];
  const vv = v + BLEED;
  const uEnd = profile[profile.length - 1].u1 + du;
  pts.push([profile[0].u0 + du, vv, 0]);
  profile.forEach((tr) => {
    pts.push([tr.u0 + du, vv, tr.z]);
    pts.push([tr.u1 + du, vv, tr.z]);
  });
  pts.push([uEnd, vv, 0]);
  const wall = shade(C.sandDeep, 0.05);
  iso.poly(pts, wall);
  const zMax = Math.max(...profile.map((t) => t.z));
  iso.clipped(pts, () => {
    // ashlar blocks with varied tones
    const dz = 0.035;
    let row = 0;
    for (let z = 0; z < zMax; z += dz, row++) {
      let a = profile[0].u0 + du - (row % 2) * 0.05;
      while (a < uEnd) {
        const len = 0.08 + rng() * 0.06;
        iso.poly(iso.faceVQuad(vv, a + 0.003, a + len - 0.003, z + 0.003, z + dz - 0.003), shade(wall, (rng() - 0.5) * 0.24));
        a += len;
      }
    }
    // damp near the water
    iso.poly(iso.faceVQuad(vv, uEnd - 0.25, uEnd, 0, 0.05), alpha('#3f4a33', 0.25));
  });
  iso.speckle(pts, rng, 120, [alpha('#3a2616', 0.25), alpha('#fff0cf', 0.25)], 1.2);
  iso.polyline(pts.slice(1, -1), alpha('#fff0cf', 0.5), 1);
  iso.poly(pts, null, OUTLINE, 1);
}

/** Small clay/brass offerings scattered on a tread. */
function offerings(iso: Iso, rng: Rng, u0: number, u1: number, v0: number, v1: number, z: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const u = u0 + rng() * (u1 - u0);
    const v = v0 + rng() * (v1 - v0);
    const k = rng();
    if (k < 0.4) {
      // brass lota
      iso.lathe(u, v, z, [
        [0, 0.008],
        [0.01, 0.014],
        [0.02, 0.01],
        [0.028, 0.007],
      ], () => C.brass, { outline: true });
    } else if (k < 0.75) {
      // marigold heap
      const [x, y] = iso.pt(u, v, z);
      for (let j = 0; j < 7; j++) {
        iso.ctx.fillStyle = j % 3 === 0 ? '#e0761a' : C.marigold;
        iso.ctx.beginPath();
        iso.ctx.arc(x + (rng() - 0.5) * 6 * iso.px, y - rng() * 3 * iso.px, 1.6 * iso.px, 0, Math.PI * 2);
        iso.ctx.fill();
      }
    } else {
      // clay diya pots
      iso.lathe(u, v, z, [
        [0, 0.01],
        [0.008, 0.012],
        [0.012, 0],
      ], () => '#a4583a', { outline: true });
    }
  }
}

function drawGhat(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('ghat', variant);
  ghatSteps(iso, rng, 0, 1);
  if (variant === 0) {
    offerings(iso, rng, 0.44, 0.58, 0.15, 0.85, 0.14, 4);
    offerings(iso, rng, 0.03, 0.19, 0.2, 0.8, 0.28, 2);
  } else if (variant === 1) {
    // stone chhatri on the top platform, cane umbrella over a takht on the landing
    chhatri(iso, rng, 0.035, 0.36, 0.28, 0.15, C.chunar, shade(C.chunar, 0.02));
    caneUmbrella(iso, 0.51, 0.66, 0.14, 0.13);
    offerings(iso, rng, 0.45, 0.58, 0.12, 0.4, 0.14, 3);
  } else {
    // small whitewashed shrine platform with a saffron flag
    const z = 0.28;
    iso.aoRect(0.03, 0.5, 0.2, 0.84, z, 0.04, 0.3);
    iso.boxLit(0.03, 0.5, 0.2, 0.84, z, z + 0.03, mat(C.whitewash, { right: -0.2 }));
    const zs = z + 0.03;
    iso.box(0.06, 0.58, 0.16, 0.7, zs, zs + 0.085, mat(C.whitewash, { right: -0.18 }));
    // ochre band + doorway on the lit face
    iso.poly(iso.faceVQuad(0.7, 0.06, 0.16, zs + 0.07, zs + 0.085), '#d98f3a');
    iso.poly(iso.faceUQuad(0.16, 0.58, 0.7, zs + 0.07, zs + 0.085), shade('#d98f3a', -0.2));
    iso.archV(0.7, 0.09, 0.13, zs, zs + 0.055, '#3a2a22');
    iso.squareLathe(0.11, 0.64, zs + 0.085, [
      [0, 0.05],
      [0.03, 0.047],
      [0.06, 0.035],
      [0.085, 0.018],
      [0.095, 0],
    ], (t) => (Math.floor(t * 5) % 2 ? C.whitewash : shade(C.whitewash, -0.06)), {});
    iso.lathe(0.11, 0.64, zs + 0.175, [
      [0, 0.004],
      [0.01, 0.008],
      [0.02, 0],
    ], () => C.brass, { outline: false });
    flag(iso, 0.05, 0.9, z, 0.62, C.saffron);
    offerings(iso, rng, 0.08, 0.2, 0.52, 0.6, zs, 2);
    caneUmbrella(iso, 0.5, 0.3, 0.14, 0.11);
  }
}

// ============================================================================
// EMBANKMENT (1×1, tileable in lines along either axis)
// ============================================================================

const EMBANK_H = 0.2;

function drawEmbankment(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('embankment', variant);
  const b = BLEED;
  const H = EMBANK_H;
  // stone-pitched faces (visible +u and +v faces)
  const stone = '#9a8f7e';
  const faceU = iso.faceUQuad(1 + b, -b, 1 + b, 0, H);
  const faceV = iso.faceVQuad(1 + b, -b, 1 + b, 0, H);
  iso.poly(faceV, shade(stone, 0.02));
  iso.poly(faceU, shade(stone, -0.22));
  const blocks = (face: 'u' | 'v') => {
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const z0 = (r / rows) * H;
      const z1 = ((r + 1) / rows) * H;
      let a = -b + rng() * 0.05;
      while (a < 1 + b) {
        const len = 0.07 + rng() * 0.08;
        const a1 = Math.min(1 + b, a + len);
        const tone = shade(stone, (rng() - 0.5) * 0.22 + (face === 'u' ? -0.22 : 0.02));
        const q = face === 'u' ? iso.faceUQuad(1 + b, a + 0.004, a1 - 0.004, z0 + 0.004, z1 - 0.004) : iso.faceVQuad(1 + b, a + 0.004, a1 - 0.004, z0 + 0.004, z1 - 0.004);
        iso.poly(q, tone);
        // light top edge of each stone
        if (face === 'v') iso.line([a + 0.004, 1 + b, z1 - 0.004], [a1 - 0.004, 1 + b, z1 - 0.004], alpha('#fff4dc', 0.25), 0.8);
        else iso.line([1 + b, a + 0.004, z1 - 0.004], [1 + b, a1 - 0.004, z1 - 0.004], alpha('#fff4dc', 0.15), 0.8);
        a = a1;
      }
    }
  };
  blocks('v');
  blocks('u');
  grime(iso, -b, -b, 1 + b, 1 + b, 0, H * 0.45, 0.3);
  // weep holes
  for (let i = 0; i < 3; i++) {
    const a = 0.18 + i * 0.32;
    iso.poly(iso.faceVQuad(1 + b, a, a + 0.03, H * 0.25, H * 0.33), '#2c2620');
    iso.poly(iso.faceUQuad(1 + b, a, a + 0.03, H * 0.25, H * 0.33), '#2c2620');
  }
  // compacted earth top
  const top = iso.topQuad(-b, -b, 1 + b, 1 + b, H);
  iso.poly(top, '#9a8467');
  // soft patches of damp earth and dry dust (kept inside the tile so lines never show a pattern seam)
  for (let i = 0; i < 14; i++) {
    const u = 0.15 + rng() * 0.7;
    const v = 0.15 + rng() * 0.7;
    iso.ellipse(u, v, H, 0.05 + rng() * 0.08, alpha(rng() < 0.5 ? '#7c6a52' : '#b3a080', 0.22));
  }
  // earth grain plus scattered gravel and pebbles
  iso.speckle(top, rng, 1100, ['#8a7459', '#ab967a', '#7d6a52', '#b8a488', alpha('#5e6e3a', 0.7)], 1.3);
  iso.speckle(iso.topQuad(-b, -b, 1 + b, 1 + b, H), rng, 160, [alpha('#e0d2b6', 0.5), alpha('#5e4e3a', 0.4)], 2.2);
  // grass tufts and stones kept away from the tile edges (so lines never show a pattern seam)
  for (let i = 0; i < 26; i++) {
    const u = 0.08 + rng() * 0.84;
    const v = 0.08 + rng() * 0.84;
    const [x, y] = iso.pt(u, v, H);
    const g = rng() < 0.7;
    ctx.fillStyle = g ? (rng() < 0.5 ? '#6f8a3a' : '#859f48') : '#c2b49c';
    if (g) {
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (k - 1.5) * 1.6 * iso.px, y);
        ctx.lineTo(x + (k - 1.5) * 2.4 * iso.px, y - (3 + rng() * 3) * iso.px);
        ctx.lineTo(x + (k - 1.5) * 1.6 * iso.px + 1.2 * iso.px, y);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4 * iso.px, 1.5 * iso.px, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // edge highlight along the lit front edge
  iso.line([-b, 1 + b, H], [1 + b, 1 + b, H], alpha('#e8dcc4', 0.45), 1.2);
}

// ============================================================================
// INFORMAL HOUSING (1×1)
// ============================================================================

/** Lean-to hut: walls up to a roof sloping down towards +u (the shaded side). */
function hut(
  iso: Iso,
  rng: Rng,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z: number,
  hBack: number,
  hFront: number,
  wall: string,
  roof: 'tin' | 'rust' | 'tarp',
  brick: boolean,
  door: string,
): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.05, 0.4);
  const zb = z + hBack;
  const zf = z + hFront;
  const m = mat(wall);
  // +v face (trapezoid)
  const faceV: P3[] = [
    [u0, v1, z],
    [u1, v1, z],
    [u1, v1, zf],
    [u0, v1, zb],
  ];
  iso.poly(faceV, m.left, m.line, 1);
  iso.poly(iso.faceUQuad(u1, v0, v1, z, zf), m.right, m.line, 1);
  if (brick) {
    iso.clipped(faceV, () => {
      for (let zz = z + 0.018; zz < zb; zz += 0.018) iso.line([u0, v1, zz], [u1, v1, zz], alpha('#e2c7a4', 0.45), 0.6);
    });
    coursesU(iso, rng, u1, v0, v1, z, zf, 0.018, 0.04, alpha('#d8bd9a', 0.35), 0.6);
    iso.speckle(faceV, rng, 60, [alpha(C.brickDark, 0.8), alpha('#c47a55', 0.8)], 1.6);
  }
  grime(iso, u0, v0, u1, v1, z, Math.min(hFront, 0.06), 0.25);
  // door on the lit face
  const dw = Math.min(0.09, (u1 - u0) * 0.35);
  const du = u0 + (u1 - u0) * 0.35;
  iso.poly(iso.faceVQuad(v1, du, du + dw, z, z + Math.min(hFront, hBack) * 0.78), door, alpha('#1e1a14', 0.6), 0.8);
  // small window on the shaded face
  if (v1 - v0 > 0.2) windowU(iso, u1, v0 + (v1 - v0) * 0.55, v0 + (v1 - v0) * 0.55 + 0.06, z + hFront * 0.45, z + hFront * 0.75, '#2d3440', '#6e7a80');
  // roof sheet with overhang
  const o = 0.03;
  const slope = (hBack - hFront) / (u1 - u0);
  const ra: P3 = [u0 - o, v0 - o, zb + slope * o + 0.01];
  const rb: P3 = [u1 + o, v0 - o, zf - slope * o + 0.01];
  const rc: P3 = [u1 + o, v1 + o, zf - slope * o + 0.01];
  const rd: P3 = [u0 - o, v1 + o, zb + slope * o + 0.01];
  const roofBase = roof === 'tin' ? C.tin : roof === 'rust' ? C.rust : C.tarpBlue;
  // roof thickness edge
  iso.poly([rd, rc, [rc[0], rc[1], rc[2] - 0.012], [rd[0], rd[1], rd[2] - 0.012]], shade(roofBase, -0.35));
  iso.poly([rb, rc, [rc[0], rc[1], rc[2] - 0.012], [rb[0], rb[1], rb[2] - 0.012]], shade(roofBase, -0.5));
  const roofPts: P3[] = [ra, rb, rc, rd];
  iso.poly(roofPts, shade(roofBase, 0.06), alpha('#1e1a14', 0.5), 1);
  iso.clipped(roofPts, () => {
    if (roof !== 'tarp') {
      // corrugations run down the slope (along u)
      for (let v = v0 - o + 0.012; v < v1 + o; v += 0.018) {
        iso.line([u0 - o, v, ra[2]], [u1 + o, v, rb[2]], alpha(shade(roofBase, -0.35), 0.5), 0.7);
        iso.line([u0 - o, v + 0.006, ra[2]], [u1 + o, v + 0.006, rb[2]], alpha(shade(roofBase, 0.4), 0.35), 0.6);
      }
      // rust patches
      for (let i = 0; i < 6; i++) {
        const pu = u0 + rng() * (u1 - u0);
        const pv = v0 + rng() * (v1 - v0);
        const pz = zb - slope * (pu - u0) + 0.012;
        iso.ellipse(pu, pv, pz, 0.02 + rng() * 0.03, alpha(roof === 'rust' ? '#6e3a1f' : C.rust, 0.5));
      }
    } else {
      // tarp folds + ropes
      for (let i = 0; i < 4; i++) {
        const pv = v0 + ((i + 0.5) / 4) * (v1 - v0);
        iso.line([u0 - o, pv, ra[2]], [u1 + o, pv + 0.02, rb[2]], alpha(C.tarpBlueDeep, 0.6), 1.4);
      }
      iso.line([u0, v0, zb + 0.012], [u1, v1, zf + 0.012], alpha('#e8dcb0', 0.8), 0.7);
      iso.line([u0, v1, zb + 0.012], [u1, v0, zf + 0.012], alpha('#e8dcb0', 0.8), 0.7);
    }
  });
  // weights on the roof: bricks and an old tyre
  for (let i = 0; i < 3; i++) {
    const pu = u0 + (0.2 + rng() * 0.6) * (u1 - u0);
    const pv = v0 + (0.15 + rng() * 0.7) * (v1 - v0);
    const pz = zb - slope * (pu - u0) + 0.012;
    if (i === 0 && roof === 'tarp') {
      iso.ellipse(pu, pv, pz + 0.006, 0.03, '#2b2b2b');
      iso.ellipse(pu, pv, pz + 0.008, 0.015, shade(roofBase, 0.05));
    } else iso.box(pu, pv, pu + 0.03, pv + 0.018, pz, pz + 0.014, mat(C.brick), { edges: false });
  }
}

/** Blue/black plastic water drum. */
function drum(iso: Iso, u: number, v: number, z: number, r: number, h: number, color: string): void {
  iso.aoEllipse(u, v, r, z, 0.02, 0.35);
  iso.lathe(u, v, z, [
    [0, r * 0.95],
    [h * 0.1, r],
    [h * 0.9, r],
    [h, r * 0.92],
  ], (t) => (Math.abs(t - 0.3) < 0.04 || Math.abs(t - 0.7) < 0.04 ? shade(color, -0.12) : color), { top: shade(color, 0.15), outline: true, lit: 0.3 });
  iso.ellipse(u, v, z + h + 0.002, r * 0.35, shade(color, -0.2));
}

/** Clothes line between two poles with drying clothes. */
function clothesLine(iso: Iso, rng: Rng, a: P3, b: P3, colors: readonly string[], baseZ = 0): void {
  iso.line([a[0], a[1], baseZ], a, '#6b4a2a', 1.4);
  iso.line([b[0], b[1], baseZ], b, '#6b4a2a', 1.4);
  const sag = 0.015;
  const n = 10;
  const pts: P3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag]);
  }
  iso.polyline(pts, alpha('#3a3024', 0.8), 0.7);
  const k = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < k; i++) {
    const t = (i + 0.6) / (k + 0.4);
    const idx = Math.min(n - 1, Math.floor(t * n));
    const p = pts[idx];
    const q = pts[idx + 1];
    const len = 0.035 + rng() * 0.02;
    const hgt = 0.04 + rng() * 0.035;
    const col = colors[i % colors.length];
    const cloth: P3[] = [
      [p[0], p[1], p[2]],
      [p[0] + (q[0] - p[0]) * (len * 10), p[1] + (q[1] - p[1]) * (len * 10), q[2]],
      [p[0] + (q[0] - p[0]) * (len * 10), p[1] + (q[1] - p[1]) * (len * 10), q[2] - hgt],
      [p[0], p[1], p[2] - hgt * (0.9 + rng() * 0.2)],
    ];
    iso.poly(cloth, col, alpha(shade(col, -0.5), 0.6), 0.6);
  }
}

function charpai(iso: Iso, u: number, v: number, z: number): void {
  const L = 0.16;
  const W = 0.08;
  const H = 0.035;
  iso.aoRect(u, v, u + W, v + L, z, 0.02, 0.3);
  // legs
  for (const [pu, pv] of [
    [u, v + L],
    [u + W, v + L],
    [u + W, v],
  ] as [number, number][])
    iso.line([pu, pv, z], [pu, pv, z + H], '#5a3a22', 1.6);
  const top = iso.topQuad(u, v, u + W, v + L, z + H);
  iso.poly(top, '#c9a877', alpha('#5a3a22', 0.9), 1.6);
  iso.clipped(top, () => {
    for (let t = 0.01; t < L; t += 0.014) iso.line([u, v + t, z + H], [u + W, v + t + 0.02, z + H], alpha('#8a6a42', 0.6), 0.6);
  });
}

function drawInformalHousing(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('informal_housing', variant);
  const z0 = 0.02;
  slab(iso, rng, 0.03, z0, '#a88b66', C.earthDark, ['#96795a', '#b89c76', '#8d7152', alpha('#6c7a3a', 0.6)]);
  // a few pavers / brick path
  paving(iso, rng, 0.46, 0.06, 0.58, 0.95, z0, 0.04, 0.06, alpha('#6e4a32', 0.3));
  if (variant === 0) {
    hut(iso, rng, 0.07, 0.08, 0.44, 0.45, z0, 0.2, 0.16, C.brick, 'tin', true, C.turquoise);
    hut(iso, rng, 0.6, 0.08, 0.93, 0.42, z0, 0.18, 0.15, '#8fc3bc', 'tarp', false, '#d0605a');
    drum(iso, 0.52, 0.5, z0, 0.035, 0.08, '#2f67b4');
    clothesLine(iso, rng, [0.55, 0.9, 0.16], [0.95, 0.52, 0.16], ['#e4572e', '#f2c14e', '#3a86c8', '#e8e3d9', '#b44ca0']);
    hut(iso, rng, 0.08, 0.56, 0.45, 0.93, z0, 0.22, 0.17, C.brick, 'rust', true, '#e07a9a');
    // black rooftop water tank on the front hut
    drum(iso, 0.17, 0.72, z0 + 0.205, 0.04, 0.07, '#26272b');
    charpai(iso, 0.66, 0.6, z0);
    // tulsi pot
    iso.box(0.5, 0.86, 0.54, 0.9, z0, z0 + 0.03, mat('#b86b45'));
    iso.tree(0.52, 0.88, z0 + 0.03, 0.035, rng, 'shrub');
  } else {
    // a small two-storey brick home, part-plastered, with a tarp shelter on the roof
    const u0 = 0.1;
    const v0 = 0.12;
    const u1 = 0.5;
    const v1 = 0.62;
    const H = 0.36;
    iso.aoRect(u0, v0, u1, v1, z0, 0.06, 0.4);
    const bm = mat(C.brick);
    iso.box(u0, v0, u1, v1, z0, z0 + H, bm);
    coursesV(iso, rng, v1, u0, u1, z0, z0 + H, 0.018, 0.045, alpha('#e2c7a4', 0.4), 0.55);
    coursesU(iso, rng, u1, v0, v1, z0, z0 + H, 0.018, 0.045, alpha('#d8bd9a', 0.3), 0.55);
    // plastered, painted ground floor front
    iso.poly(iso.faceVQuad(v1, u0, u1, z0, z0 + 0.16), C.pinkPlaster, alpha('#5a3a30', 0.5), 0.8);
    iso.speckle(iso.faceVQuad(v1, u0, u1, z0, z0 + 0.16), rng, 50, [alpha('#b98079', 0.6), alpha('#f5d2cc', 0.6)], 1.6);
    grime(iso, u0, v0, u1, v1, z0, 0.06, 0.28);
    iso.poly(iso.faceVQuad(v1, 0.26, 0.35, z0, z0 + 0.13), '#3f8f8b', alpha('#1e1a14', 0.6), 0.8);
    windowV(iso, v1, 0.14, 0.21, z0 + 0.2, z0 + 0.28, '#2d3440', '#d9d2c2');
    windowV(iso, v1, 0.36, 0.44, z0 + 0.2, z0 + 0.28, '#2d3440', '#d9d2c2');
    windowU(iso, u1, 0.3, 0.38, z0 + 0.2, z0 + 0.28, '#2d3440', '#b9b2a2');
    // small chhajja over the door
    iso.box(0.24, v1, 0.37, v1 + 0.035, z0 + 0.14, z0 + 0.15, mat(C.concrete));
    // roof parapet
    const zt = z0 + H;
    iso.box(u0, v0, u1, v0 + 0.02, zt, zt + 0.04, mat(C.brick), { edges: true });
    iso.box(u0, v0, u0 + 0.02, v1, zt, zt + 0.04, mat(C.brick));
    // rooftop tarp shelter (poles + tarp)
    const tu0 = 0.14;
    const tu1 = 0.34;
    const tv0 = 0.16;
    const tv1 = 0.4;
    for (const [pu, pv] of [
      [tu0, tv1],
      [tu1, tv1],
      [tu1, tv0],
    ] as [number, number][])
      iso.line([pu, pv, zt], [pu, pv, zt + 0.1], '#6b4a2a', 1.3);
    iso.poly(
      [
        [tu0, tv0, zt + 0.12],
        [tu1, tv0, zt + 0.1],
        [tu1, tv1, zt + 0.1],
        [tu0, tv1, zt + 0.12],
      ],
      shade(C.tarpBlue, 0.08),
      alpha('#10203a', 0.6),
      1,
    );
    iso.line([tu0, (tv0 + tv1) / 2, zt + 0.12], [tu1, (tv0 + tv1) / 2 + 0.02, zt + 0.1], alpha(C.tarpBlueDeep, 0.7), 1.2);
    drum(iso, 0.42, 0.5, zt, 0.045, 0.08, '#26272b');
    // satellite dish
    iso.line([0.44, 0.2, zt], [0.44, 0.2, zt + 0.05], '#555', 1.2);
    iso.ellipse(0.44, 0.2, zt + 0.06, 0.025, '#d8d8d4', '#777', 0.8);
    clothesLine(iso, rng, [0.13, 0.42, zt + 0.08], [0.3, 0.57, zt + 0.08], ['#f2c14e', '#e4572e', '#3a86c8', '#f1ebdd'], zt);
    // lean-to tin shack beside
    hut(iso, rng, 0.6, 0.18, 0.92, 0.55, z0, 0.17, 0.13, C.brick, 'tin', true, '#3a6fb0');
    // yard: drum, bicycle-ish shape replaced with a stack of bricks, potted plants, line
    drum(iso, 0.66, 0.72, z0, 0.038, 0.085, '#2f67b4');
    iso.box(0.78, 0.68, 0.88, 0.76, z0, z0 + 0.04, mat(C.brick), { edges: true });
    iso.box(0.28, 0.76, 0.32, 0.8, z0, z0 + 0.03, mat('#b86b45'));
    iso.tree(0.3, 0.78, z0 + 0.03, 0.04, rng, 'shrub');
    iso.box(0.4, 0.8, 0.44, 0.84, z0, z0 + 0.03, mat('#b86b45'));
    iso.tree(0.42, 0.82, z0 + 0.03, 0.035, rng, 'shrub');
    clothesLine(iso, rng, [0.6, 0.92, 0.15], [0.94, 0.66, 0.15], ['#b44ca0', '#e8e3d9', '#3aa36b', '#e4572e']);
  }
}

// ============================================================================
// SEWAGE TREATMENT PLANT (2×2)
// ============================================================================

function compoundWall(iso: Iso, rng: Rng, lo: number, hi: number, z: number, h: number, t: number, wall: Mat, cap: Mat | null, part: 'back' | 'front', gate?: { v0: number; v1: number }): void {
  if (part === 'back') {
    iso.box(lo, lo, hi, lo + t, z, z + h, wall); // along u at the back-right
    iso.box(lo, lo, lo + t, hi, z, z + h, wall); // along v at the back-left
    if (cap) {
      iso.box(lo - 0.005, lo - 0.005, hi, lo + t + 0.005, z + h, z + h + 0.012, cap);
      iso.box(lo - 0.005, lo - 0.005, lo + t + 0.005, hi, z + h, z + h + 0.012, cap);
    }
    return;
  }
  // front-right wall (u = hi − t, along v)
  iso.box(hi - t, lo, hi, hi, z, z + h, wall);
  if (cap) iso.box(hi - t - 0.005, lo, hi + 0.005, hi + 0.005, z + h, z + h + 0.012, cap);
  // front-left wall (v = hi − t, along u) with an optional gate gap
  const segs: [number, number][] = gate ? [
    [lo, gate.v0],
    [gate.v1, hi - t],
  ] : [[lo, hi - t]];
  for (const [a, b] of segs) {
    iso.box(a, hi - t, b, hi, z, z + h, wall);
    if (cap) iso.box(a, hi - t - 0.005, b, hi + 0.005, z + h, z + h + 0.012, cap);
  }
  weatherV(iso, rng, hi, lo, hi, z, z + h, 18, 0.12);
}

function clarifier(iso: Iso, rng: Rng, u: number, v: number, r: number, z: number, water: string, deep: string): void {
  iso.aoEllipse(u, v, r, z, 0.06, 0.4);
  iso.cylinder(u, v, r, z, z + 0.08, C.concrete, shade(C.concrete, 0.15));
  // water surface inside the rim
  const { ctx } = iso;
  const [cx, cy] = iso.pt(u, v, z + 0.075);
  const [rx, ry] = iso.ellipseRadii(r - 0.035);
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, rx * 0.1, cx, cy, rx);
  g.addColorStop(0, shade(water, 0.2));
  g.addColorStop(0.6, water);
  g.addColorStop(1, deep);
  iso.ellipse(u, v, z + 0.075, r - 0.035, g, alpha('#2a2a2a', 0.4), 1);
  // concentric ripple rings + weir channel
  for (let k = 1; k <= 3; k++) iso.ellipse(u, v, z + 0.075, (r - 0.035) * (k / 4), null, alpha('#e8f4ee', 0.18), 0.8);
  iso.ellipse(u, v, z + 0.077, r - 0.06, null, alpha('#3a3a36', 0.35), 1.2);
  // centre hub and radial bridge towards the viewer's left
  iso.cylinder(u, v, 0.05, z + 0.075, z + 0.11, C.concreteDark);
  const a = Math.PI * 0.62;
  const eu = u + Math.cos(a) * (r - 0.01);
  const ev = v + Math.sin(a) * (r - 0.01);
  const zb = z + 0.1;
  iso.polyline([
    [u, v, zb],
    [eu, ev, zb],
  ], alpha('#2a2a2a', 0.6), 5);
  iso.polyline([
    [u, v, zb],
    [eu, ev, zb],
  ], '#d9d4c8', 3.2);
  iso.polyline([
    [u, v, zb + 0.02],
    [eu, ev, zb + 0.02],
  ], '#e0b030', 1);
  // scum/skimmer specks on the primary tank
  iso.speckle(
    Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2;
      return [u + Math.cos(t) * (r - 0.05), v + Math.sin(t) * (r - 0.05), z + 0.075] as P3;
    }),
    rng,
    70,
    [alpha('#e8f0e0', 0.35), alpha(shade(water, -0.3), 0.4)],
    1.4,
  );
}

function drawSTP(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('stp', variant);
  const z0 = 0.03;
  slab(iso, rng, 0.03, z0, '#b9b19d', '#8f8573', ['#aaa28e', '#c7bfab', alpha('#7e9a4c', 0.7), '#9d957f']);
  // grass verges
  lawn(iso, rng, 0.1, 1.55, 0.6, 1.9, z0, C.grass);
  lawn(iso, rng, 1.6, 1.55, 1.9, 1.9, z0, C.grass);
  const wallM = mat('#d9ceb4');
  const capM = mat('#9a9486');
  compoundWall(iso, rng, 0.06, 1.94, z0, 0.07, 0.03, wallM, capM, 'back');
  // control building (back-left)
  const bu0 = 0.2;
  const bv0 = 0.2;
  const bu1 = 0.72;
  const bv1 = 0.62;
  const bh = 0.24;
  iso.aoRect(bu0, bv0, bu1, bv1, z0, 0.08, 0.45);
  iso.castShadow([
    [bu0, bv0],
    [bu1, bv0],
    [bu1, bv1],
    [bu0, bv1],
  ], z0, bh, 0.18);
  iso.box(bu0, bv0, bu1, bv1, z0, z0 + bh, mat(C.cream));
  for (let i = 0; i < 3; i++) windowV(iso, bv1, bu0 + 0.06 + i * 0.16, bu0 + 0.13 + i * 0.16, z0 + 0.11, z0 + 0.19, '#3f5b66', '#f4efe2');
  for (let i = 0; i < 2; i++) windowU(iso, bu1, bv0 + 0.08 + i * 0.18, bv0 + 0.16 + i * 0.18, z0 + 0.11, z0 + 0.19, '#35505a', '#d8d0bf');
  iso.poly(iso.faceVQuad(bv1, bu0 + 0.2, bu0 + 0.3, z0, z0 + 0.1), '#4a6f86', alpha('#1e1a14', 0.6), 0.8);
  // blue band (utility paint) and parapet
  iso.poly(iso.faceVQuad(bv1, bu0, bu1, z0 + bh - 0.03, z0 + bh), '#5b86a8');
  iso.poly(iso.faceUQuad(bu1, bv0, bv1, z0 + bh - 0.03, z0 + bh), shade('#5b86a8', -0.25));
  grime(iso, bu0, bv0, bu1, bv1, z0, 0.06, 0.2);
  const rt = z0 + bh;
  iso.box(bu0, bv0, bu1, bv0 + 0.02, rt, rt + 0.03, mat(C.cream));
  iso.box(bu0, bv0, bu0 + 0.02, bv1, rt, rt + 0.03, mat(C.cream));
  drum(iso, 0.33, 0.35, rt, 0.05, 0.08, '#26272b');
  // rooftop vents
  iso.box(0.52, 0.3, 0.6, 0.38, rt, rt + 0.03, mat(C.concreteDark));
  // clarifiers
  clarifier(iso, rng, 1.35, 0.62, 0.44, z0, '#6f6d45', '#4f4d30');
  // pipes between
  pipe(iso, [
    [0.75, 0.9, z0 + 0.03],
    [1.0, 0.9, z0 + 0.03],
    [1.0, 1.02, z0 + 0.03],
  ], C.pipeBlue, 4);
  // aeration / secondary tank (rectangular) at front-left
  const au0 = 0.22;
  const av0 = 0.9;
  const au1 = 0.86;
  const av1 = 1.5;
  iso.aoRect(au0, av0, au1, av1, z0, 0.05, 0.4);
  iso.box(au0, av0, au1, av1, z0, z0 + 0.08, mat(C.concrete), { noTop: true });
  iso.poly(iso.topQuad(au0, av0, au1, av1, z0 + 0.08), shade(C.concrete, 0.12));
  const wpts = iso.topQuad(au0 + 0.03, av0 + 0.03, au1 - 0.03, av1 - 0.03, z0 + 0.07);
  waterSurface(iso, rng, wpts, '#5f8d78', '#40695a');
  // aeration bubbles in rows + dividing wall
  iso.box(au0 + 0.03, (av0 + av1) / 2 - 0.012, au1 - 0.03, (av0 + av1) / 2 + 0.012, z0 + 0.07, z0 + 0.08, mat(C.concrete), { edges: false });
  for (let row = 0; row < 4; row++) {
    const u = au0 + 0.08 + row * 0.15;
    for (let k = 0; k < 16; k++) {
      const v = av0 + 0.05 + rng() * (av1 - av0 - 0.1);
      if (Math.abs(v - (av0 + av1) / 2) < 0.03) continue;
      iso.ellipse(u + (rng() - 0.5) * 0.04, v, z0 + 0.072, 0.008 + rng() * 0.01, alpha('#eef6ee', 0.75));
    }
  }
  clarifier(iso, rng, 1.35, 1.38, 0.4, z0, '#4f8a86', '#356a6a');
  pipe(iso, [
    [0.86, 1.2, z0 + 0.04],
    [0.95, 1.2, z0 + 0.04],
  ], C.pipeGrey, 4);
  pipe(iso, [
    [1.35, 1.06, z0 + 0.1],
    [1.35, 0.98, z0 + 0.1],
  ], C.pipeGrey, 4);
  // valve wheels / small pump box
  iso.box(1.78, 1.02, 1.88, 1.12, z0, z0 + 0.07, mat(C.pipeBlue));
  iso.tree(1.82, 0.22, z0, 0.1, rng, 'neem');
  iso.tree(0.24, 1.78, z0, 0.08, rng, 'shrub');
  compoundWall(iso, rng, 0.06, 1.94, z0, 0.07, 0.03, wallM, capM, 'front', { v0: 1.0, v1: 1.22 });
  // gate posts
  iso.box(0.98, 1.9, 1.02, 1.94, z0, z0 + 0.11, mat('#d9ceb4'));
  iso.box(1.2, 1.9, 1.24, 1.94, z0, z0 + 0.11, mat('#d9ceb4'));
  iso.poly(iso.faceVQuad(1.93, 1.02, 1.2, z0, z0 + 0.07), alpha('#4a6f86', 0.85), alpha('#1e1a14', 0.6), 0.8);
  iso.clipped(iso.faceVQuad(1.93, 1.02, 1.2, z0, z0 + 0.07), () => {
    for (let u = 1.03; u < 1.2; u += 0.02) iso.line([u, 1.93, z0], [u, 1.93, z0 + 0.07], alpha('#1d2b36', 0.7), 0.8);
  });
}

// ============================================================================
// JAL SANSTHAN WATER WORKS (3×3)
// ============================================================================

/** The classic Indian Intze overhead tank: a ring of columns, bracing, conical bottom + drum. */
function overheadTank(iso: Iso, u: number, v: number, z: number, H: number, R: number): void {
  const cols = 8;
  const rc = R * 0.72;
  iso.aoEllipse(u, v, rc + 0.05, z, 0.1, 0.4);
  iso.castShadow(
    Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return [u + Math.cos(a) * R, v + Math.sin(a) * R] as [number, number];
    }),
    z,
    H * 0.9,
    0.12,
  );
  const colPos = Array.from({ length: cols }, (_, i) => {
    const a = (i / cols) * Math.PI * 2 + Math.PI / cols;
    return { a, u: u + Math.cos(a) * rc, v: v + Math.sin(a) * rc, depth: Math.cos(a) + Math.sin(a) };
  });
  const colM = C.cream;
  const drawCols = (front: boolean) => {
    for (const c of colPos) {
      if (c.depth >= 0 !== front) continue;
      iso.lathe(c.u, c.v, z, [
        [0, 0.028],
        [H, 0.024],
      ], () => colM, { outline: true });
    }
  };
  const braces = (front: boolean) => {
    for (const lvl of [0.33, 0.66]) {
      const zz = z + H * lvl;
      for (let i = 0; i < cols; i++) {
        const a = colPos[i];
        const b = colPos[(i + 1) % cols];
        const mid = (a.depth + b.depth) / 2;
        if (mid >= 0 !== front) continue;
        iso.polyline([
          [a.u, a.v, zz],
          [b.u, b.v, zz],
        ], alpha('#5a4a3a', 0.7), 4);
        iso.polyline([
          [a.u, a.v, zz],
          [b.u, b.v, zz],
        ], shade(C.cream, -0.05), 2.6);
      }
    }
  };
  drawCols(false);
  braces(false);
  // central shaft (staircase + pipe)
  iso.lathe(u, v, z, [
    [0, 0.07],
    [H, 0.07],
  ], () => shade(C.cream, -0.08), { outline: true });
  for (let zz = z + 0.08; zz < z + H; zz += 0.12) iso.ellipse(u, v, zz, 0.071, null, alpha('#5a4a3a', 0.35), 0.8);
  pipe(iso, [
    [u + 0.09, v + 0.02, z],
    [u + 0.09, v + 0.02, z + H],
  ], C.pipeGrey, 3);
  drawCols(true);
  braces(true);
  // tank: ring beam, conical bottom, drum, domed roof
  const zt = z + H;
  iso.lathe(u, v, zt - 0.05, [
    [0, R * 0.5],
    [0.035, R * 0.78],
    [0.05, R * 0.8],
    [0.14, R * 1.0],
    [0.44, R * 1.0],
    [0.46, R * 1.03],
    [0.5, R * 1.03],
    [0.52, R * 0.92],
    [0.6, R * 0.55],
    [0.64, R * 0.12],
    [0.66, 0],
  ], (t) => (t > 0.64 && t < 0.72 ? C.govMaroon : t < 0.14 ? shade(C.cream, -0.05) : C.cream), { outline: true, dark: -0.36 });
  // railing on top + access hatch
  iso.lathe(u, v, zt + 0.6, [
    [0, 0.05],
    [0.03, 0.05],
    [0.035, 0],
  ], () => '#8a847a', { outline: true });
  // maroon lettering band stand-in: a plain band (no text)
  weatherTankStreaks(iso, u, v, zt + 0.09, R);
}

function weatherTankStreaks(iso: Iso, u: number, v: number, z: number, R: number): void {
  const { ctx } = iso;
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * (0.05 + i * 0.1);
    const pu = u + Math.cos(a) * R;
    const pv = v + Math.sin(a) * R;
    const [x, y] = iso.pt(pu, pv, z + 0.3);
    const [, y2] = iso.pt(pu, pv, z);
    ctx.fillStyle = 'rgba(70,55,40,0.12)';
    ctx.fillRect(x - 1.5 * iso.px, y, 3 * iso.px, (y2 - y) * (0.5 + (i % 3) * 0.2));
  }
}

/** Government building block: cream walls, maroon plinth band and cornice. */
function govBlock(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number, opts: { arches?: boolean; door?: 'v' | 'u' } = {}): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.08, 0.45);
  iso.castShadow([
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ], z, H, 0.16);
  const wall = mat(C.cream);
  iso.box(u0, v0, u1, v1, z, z + H, wall);
  // maroon dado band (plinth)
  iso.poly(iso.faceVQuad(v1, u0, u1, z, z + 0.035), C.govMaroon);
  iso.poly(iso.faceUQuad(u1, v0, v1, z, z + 0.035), shade(C.govMaroon, -0.3));
  // windows
  const nV = Math.max(1, Math.floor((u1 - u0) / 0.14));
  for (let i = 0; i < nV; i++) {
    const a = u0 + ((i + 0.5) / nV) * (u1 - u0);
    if (opts.arches) iso.archV(v1, a - 0.032, a + 0.032, z + 0.07, z + H - 0.07, '#3d4a55', true);
    else windowV(iso, v1, a - 0.03, a + 0.03, z + 0.08, z + H - 0.07, '#3d4a55', '#f7f0de');
  }
  const nU = Math.max(1, Math.floor((v1 - v0) / 0.14));
  for (let i = 0; i < nU; i++) {
    const a = v0 + ((i + 0.5) / nU) * (v1 - v0);
    if (opts.arches) iso.archU(u1, a - 0.032, a + 0.032, z + 0.07, z + H - 0.07, '#303b44', true);
    else windowU(iso, u1, a - 0.03, a + 0.03, z + 0.08, z + H - 0.07, '#303b44', '#dcd4c0');
  }
  if (opts.door === 'v') {
    const m = (u0 + u1) / 2;
    iso.archV(v1, m - 0.045, m + 0.045, z, z + H * 0.72, '#5b3a2a');
  }
  weatherV(iso, rng, v1, u0, u1, z, z + H, 14, 0.1);
  weatherU(iso, rng, u1, v0, v1, z, z + H, 12, 0.12);
  // maroon cornice + parapet
  const zt = z + H;
  iso.box(u0 - 0.015, v0 - 0.015, u1 + 0.015, v1 + 0.015, zt, zt + 0.02, mat(C.govMaroon));
  iso.box(u0, v0, u1, v0 + 0.02, zt + 0.02, zt + 0.05, mat(C.cream));
  iso.box(u0, v0, u0 + 0.02, v1, zt + 0.02, zt + 0.05, mat(C.cream));
  iso.poly(iso.topQuad(u0 + 0.02, v0 + 0.02, u1, v1, zt + 0.02), shade('#cfc4ad', 0.05));
  grime(iso, u0, v0, u1, v1, z, 0.05, 0.2);
}

function filterBeds(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, n: number): void {
  const H = 0.08;
  iso.aoRect(u0, v0, u1, v1, z, 0.05, 0.4);
  iso.box(u0, v0, u1, v1, z, z + H, mat(C.concrete), { noTop: true });
  iso.poly(iso.topQuad(u0, v0, u1, v1, z + H), shade(C.concrete, 0.15));
  const span = (v1 - v0 - 0.03) / n;
  for (let i = 0; i < n; i++) {
    const a = v0 + 0.03 + i * span;
    const pts = iso.topQuad(u0 + 0.03, a, u1 - 0.03, a + span - 0.03, z + H - 0.01);
    // inner wall shadow
    iso.poly(pts, '#5a5e58');
    const water = iso.topQuad(u0 + 0.03, a, u1 - 0.03, a + span - 0.03, z + H - 0.015);
    waterSurface(iso, rng, water, i % 2 ? '#5f9aa2' : '#6aa3a4', '#3f7480');
    // central gullet
    iso.poly(iso.topQuad((u0 + u1) / 2 - 0.012, a, (u0 + u1) / 2 + 0.012, a + span - 0.03, z + H - 0.005), shade(C.concrete, -0.1));
  }
  // walkway railing on the front edge
  iso.line([u0, v1, z + H + 0.03], [u1, v1, z + H + 0.03], '#c8b56a', 1);
  for (let u = u0; u <= u1 + 1e-6; u += 0.08) iso.line([u, v1, z + H], [u, v1, z + H + 0.03], '#8a7a4a', 0.8);
}

function drawJalSansthan(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('jal_sansthan', variant);
  const z0 = 0.03;
  slab(iso, rng, 0.03, z0, '#b8a888', '#8f8068', ['#aa9a7a', '#c6b696', alpha('#7e9a4c', 0.6)]);
  lawn(iso, rng, 0.12, 1.45, 1.4, 2.88, z0, C.lawn);
  lawn(iso, rng, 1.55, 2.25, 2.88, 2.88, z0, C.lawn);
  // internal road from the gate
  iso.poly(iso.topQuad(1.4, 0.4, 1.55, 2.95, z0 + 0.002), '#a39a8a');
  iso.poly(iso.topQuad(0.3, 1.3, 2.9, 1.45, z0 + 0.002), '#a39a8a');
  const wallM = mat(C.cream);
  const capM = mat(C.govMaroon);
  compoundWall(iso, rng, 0.06, 2.94, z0, 0.08, 0.035, wallM, capM, 'back');
  // overhead tank (back-left), filter beds (back-right)
  overheadTank(iso, 0.72, 0.7, z0, 1.05, 0.34);
  filterBeds(iso, rng, 1.7, 0.2, 2.75, 1.15, z0, 3);
  // pump house (front-left)
  govBlock(iso, rng, 0.3, 1.65, 1.2, 2.45, z0, 0.27, { arches: true, door: 'v' });
  // pump house roof lantern + chimney vent
  iso.box(0.6, 1.9, 0.9, 2.2, z0 + 0.32, z0 + 0.38, mat(C.cream));
  iso.box(0.58, 1.88, 0.92, 2.22, z0 + 0.38, z0 + 0.395, mat(C.govMaroon));
  // mains: pump house → clarifier, intake → clarifier, clarifier → filter beds (drawn first, they tuck under)
  pipe(iso, [
    [1.2, 2.0, z0 + 0.04],
    [1.86, 2.0, z0 + 0.04],
  ], C.pipeGrey, 4);
  pipe(iso, [
    [2.42, 2.4, z0 + 0.04],
    [2.3, 2.1, z0 + 0.04],
  ], C.pipeBlue, 5);
  pipe(iso, [
    [2.15, 1.32, z0 + 0.04],
    [2.15, 1.16, z0 + 0.04],
  ], C.pipeBlue, 5);
  // round clearwater / clarifier (front-right)
  clarifier(iso, rng, 2.15, 1.72, 0.42, z0, '#5f9aa2', '#3f7480');
  // intake well tower (right edge, draws raw water)
  const iu = 2.55;
  const ivv = 2.5;
  iso.aoEllipse(iu, ivv, 0.2, z0, 0.08, 0.4);
  iso.lathe(iu, ivv, z0, [
    [0, 0.2],
    [0.3, 0.2],
    [0.31, 0.22],
    [0.34, 0.22],
  ], (t) => (t > 0.88 ? C.govMaroon : C.cream), { top: shade(C.cream, 0.12), outline: true });
  for (let zz = z0 + 0.07; zz < z0 + 0.3; zz += 0.07) iso.ellipse(iu, ivv, zz, 0.201, null, alpha('#6a5a48', 0.25), 0.8);
  iso.box(iu - 0.08, ivv - 0.08, iu + 0.08, ivv + 0.08, z0 + 0.34, z0 + 0.46, mat(C.cream));
  iso.box(iu - 0.1, ivv - 0.1, iu + 0.1, ivv + 0.1, z0 + 0.46, z0 + 0.48, mat(C.govMaroon));
  windowV(iso, ivv + 0.08, iu - 0.03, iu + 0.03, z0 + 0.37, z0 + 0.43, '#3d4a55');
  windowU(iso, iu + 0.08, ivv - 0.03, ivv + 0.03, z0 + 0.37, z0 + 0.43, '#303b44');
  // chlorine room
  govBlock(iso, rng, 1.72, 2.38, 2.08, 2.72, z0, 0.16);
  // trees along the wall
  iso.tree(0.35, 2.75, z0, 0.1, rng, 'ashoka');
  iso.tree(1.3, 2.75, z0, 0.09, rng, 'ashoka');
  iso.tree(2.8, 0.25, z0, 0.12, rng, 'neem');
  iso.tree(0.2, 1.35, z0, 0.1, rng, 'neem');
  compoundWall(iso, rng, 0.06, 2.94, z0, 0.08, 0.035, wallM, capM, 'front', { v0: 1.36, v1: 1.6 });
  // gate pillars with maroon caps
  for (const gu of [1.32, 1.6]) {
    iso.box(gu, 2.88, gu + 0.05, 2.94, z0, z0 + 0.14, mat(C.cream));
    iso.box(gu - 0.008, 2.872, gu + 0.058, 2.948, z0 + 0.14, z0 + 0.16, mat(C.govMaroon));
  }
}

// ============================================================================
// LANDMARK: DASHASHWAMEDH GHAT (2×2)
// ============================================================================

function drawDashashwamedh(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('landmark_dashashwamedh', variant);
  // Back half (u ∈ [0, 1]): high terrace + a grand flight down to the standard ghat platform height.
  const back: Tread[] = [{ u0: 0, u1: 0.42, z: 0.44, kind: 'platform' }];
  const n = 6;
  for (let i = 0; i < n; i++) back.push({ u0: 0.42 + i * (0.58 / n), u1: 0.42 + (i + 1) * (0.58 / n), z: 0.44 - ((i + 1) * (0.44 - 0.28)) / (n + 0.2), kind: 'step' });
  const profile: Tread[] = [...back, ...GHAT_PROFILE.map((t) => ({ ...t, u0: t.u0 + 1, u1: t.u1 + 1 }))];
  // Row of old riverfront buildings at the very back
  const bldgs = [
    { v0: 0.0, v1: 0.5, h: 0.52, c: '#d9a86a' },
    { v0: 0.5, v1: 0.95, h: 0.62, c: '#e6cf9f' },
    { v0: 0.95, v1: 1.45, h: 0.5, c: '#cf8f6c' },
    { v0: 1.45, v1: 2.0, h: 0.58, c: '#e0bd7a' },
  ];
  const zt = 0.44;
  ghatSteps(iso, rng, 0, 2, 0, profile, true);
  for (const b of bldgs) {
    const u0 = 0.0;
    const u1 = 0.16;
    iso.box(u0, b.v0, u1, b.v1, zt, zt + b.h, mat(b.c));
    // windows / jharokhas on the river-facing (+u) side
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 3; k++) {
        const vv = b.v0 + 0.07 + k * ((b.v1 - b.v0 - 0.1) / 3);
        const z = zt + 0.12 + row * 0.2;
        iso.archU(u1, vv, vv + 0.06, z, z + 0.11, '#3a2a28', true);
        if (row === 1 && k === 1) {
          // small projecting jharokha balcony
          iso.box(u1, vv - 0.01, u1 + 0.035, vv + 0.07, z - 0.02, z, mat(shade(b.c, 0.05)));
          iso.box(u1 - 0.005, vv - 0.015, u1 + 0.045, vv + 0.075, z + 0.12, z + 0.135, mat(shade(b.c, -0.05)));
        }
      }
    }
    weatherU(iso, rng, u1, b.v0, b.v1, zt, zt + b.h, 10, 0.16);
    iso.box(u0, b.v0, u1 + 0.012, b.v1, zt + b.h, zt + b.h + 0.02, mat(shade(b.c, -0.08)));
    weatherV(iso, rng, b.v1, u0, u1, zt, zt + b.h, 4, 0.1);
  }
  // chhatris along the high terrace
  for (const v of [0.18, 0.86, 1.56]) chhatri(iso, rng, 0.2, v, zt, 0.17, C.chunar, shade(C.chunar, 0.02));
  // aarti platforms (chowkis) on the lower landing, each with a brass lamp stand
  const lz = 0.14;
  for (let i = 0; i < 5; i++) {
    const v = 0.14 + i * 0.37;
    const u = 1.45;
    iso.aoRect(u, v, u + 0.12, v + 0.12, lz, 0.03, 0.35);
    iso.boxLit(u, v, u + 0.12, v + 0.12, lz, lz + 0.045, mat('#e8d9b8', { right: -0.2 }));
    // lamp
    iso.line([u + 0.06, v + 0.06, lz + 0.045], [u + 0.06, v + 0.06, lz + 0.1], C.brass, 1.6);
    iso.lathe(u + 0.06, v + 0.06, lz + 0.1, [
      [0, 0.004],
      [0.008, 0.018],
      [0.012, 0.016],
    ], () => C.brass, { outline: true });
    // saffron cloth runner on the platform
    iso.poly(iso.topQuad(u + 0.018, v + 0.018, u + 0.102, v + 0.102, lz + 0.046), alpha(C.saffron, 0.92), alpha('#fff2cc', 0.7), 0.8);
  }
  // cane umbrellas on the upper step landing and the ledge
  caneUmbrella(iso, 1.13, 0.5, 0.28, 0.12);
  caneUmbrella(iso, 1.13, 1.45, 0.28, 0.12);
  caneUmbrella(iso, 1.9, 0.3, 0.015, 0.11, false);
  caneUmbrella(iso, 1.9, 1.1, 0.015, 0.11, false);
  caneUmbrella(iso, 1.9, 1.8, 0.015, 0.11, false);
  flag(iso, 1.43, 0.08, lz, 0.55, C.saffron);
  flag(iso, 1.43, 1.93, lz, 0.55, C.saffron);
  offerings(iso, rng, 1.02, 1.2, 0.1, 1.9, 0.28, 6);
}

// ============================================================================
// LANDMARK: KASHI VISHWANATH (2×2)
// ============================================================================

/** A curvilinear gilded shikhara with amalaka and kalasha. (u, v) centre, s half-width at base. */
function shikhara(iso: Iso, u: number, v: number, z: number, s: number, H: number, base: string, banded = true, finialFlag = false): void {
  const prof: [number, number][] = [
    [0, s],
    [H * 0.25, s * 0.97],
    [H * 0.5, s * 0.86],
    [H * 0.7, s * 0.68],
    [H * 0.85, s * 0.47],
    [H * 0.95, s * 0.3],
    [H, s * 0.26],
  ];
  const color = (t: number) => {
    const band = banded && Math.floor(t * 11) % 2 === 1 && t < 0.92;
    return band ? shade(base, -0.14) : base;
  };
  // side turrets (urushringa) at the back first
  const ss = s * 0.6;
  const hs = H * 0.42;
  const turret = (tu: number, tv: number) =>
    iso.squareLathe(tu, tv, z, [
      [0, ss],
      [hs * 0.5, ss * 0.9],
      [hs * 0.8, ss * 0.6],
      [hs, ss * 0.3],
    ], color, {});
  turret(u - s * 0.75, v);
  turret(u, v - s * 0.75);
  iso.squareLathe(u, v, z, prof, color, {});
  turret(u + s * 0.75, v);
  turret(u, v + s * 0.75);
  // amalaka (ribbed disc) and kalasha finial
  const za = z + H;
  iso.lathe(u, v, za, [
    [0, s * 0.3],
    [s * 0.06, s * 0.42],
    [s * 0.14, s * 0.42],
    [s * 0.2, s * 0.2],
  ], () => shade(base, 0.05), { outline: true });
  iso.lathe(u, v, za + s * 0.2, [
    [0, s * 0.12],
    [s * 0.1, s * 0.2],
    [s * 0.22, s * 0.16],
    [s * 0.3, s * 0.05],
    [s * 0.5, s * 0.03],
    [s * 0.55, 0],
  ], () => shade(base, 0.1), { outline: true });
  if (finialFlag) flag(iso, u, v, za + s * 0.5, H * 0.35, C.saffron);
}

function drawKashiVishwanath(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('landmark_kashi_vishwanath', variant);
  const pz = 0.06;
  const stone = '#e6d3b0';
  slab(iso, rng, 0.03, pz, '#eee4d0', '#c6ab80', ['#e2d6bd', '#f6eedc', alpha('#c9b48f', 0.8)]);
  paving(iso, rng, 0.06, 0.06, 1.94, 1.94, pz, 0.14, 0.14, alpha('#b39c78', 0.45));
  // colonnaded ranges along the two back edges (Chunar sandstone arcades)
  const cz = pz;
  const ch = 0.26;
  const d = 0.2;
  iso.box(0.06, 0.06, 1.94, 0.06 + d, cz, cz + ch, mat(stone), { noLeft: false });
  for (let i = 0; i < 9; i++) {
    const a = 0.3 + i * 0.18;
    iso.archV(0.06 + d, a, a + 0.1, cz, cz + ch - 0.06, '#5b4636', true);
  }
  iso.box(0.06, 0.06, 0.06 + d, 1.94, cz, cz + ch, mat(stone));
  for (let i = 0; i < 9; i++) {
    const a = 0.3 + i * 0.18;
    iso.archU(0.06 + d, a, a + 0.1, cz, cz + ch - 0.06, '#4e3c2e', true);
  }
  // cornices and small corner domes
  iso.box(0.04, 0.04, 1.96, 0.08 + d, cz + ch, cz + ch + 0.025, mat(shade(stone, -0.06)));
  iso.box(0.04, 0.04, 0.08 + d, 1.96, cz + ch, cz + ch + 0.025, mat(shade(stone, -0.06)));
  for (const [du, dv] of [
    [0.16, 0.16],
    [1.84, 0.16],
    [0.16, 1.84],
  ] as [number, number][])
    dome(iso, du, dv, cz + ch + 0.025, 0.07, stone, 'round');
  // peepal tree in the courtyard corner
  iso.tree(0.5, 1.5, pz, 0.15, rng, 'peepal');
  // temple plinth (jagati)
  const tu = 1.02;
  const tv = 1.0;
  iso.aoRect(tu - 0.38, tv - 0.38, tu + 0.38, tv + 0.38, pz, 0.08, 0.45);
  iso.boxLit(tu - 0.38, tv - 0.38, tu + 0.38, tv + 0.38, pz, pz + 0.07, mat('#efe6d4'));
  const jz = pz + 0.07;
  // sanctum (garbhagriha) with gilded main shikhara
  const sw = 0.2;
  const sanctumH = 0.24;
  iso.castShadow([
    [tu - sw, tv - sw],
    [tu + sw, tv - sw],
    [tu + sw, tv + sw],
    [tu - sw, tv + sw],
  ], jz, 0.9, 0.18);
  iso.box(tu - sw, tv - sw, tu + sw, tv + sw, jz, jz + sanctumH, mat('#f2ead8'));
  for (let k = 1; k <= 3; k++) {
    const zz = jz + (k * sanctumH) / 4;
    iso.line([tu - sw, tv + sw, zz], [tu + sw, tv + sw, zz], alpha('#b8a27c', 0.7), 1);
    iso.line([tu + sw, tv - sw, zz], [tu + sw, tv + sw, zz], alpha('#8f7a58', 0.7), 1);
  }
  shikhara(iso, tu, tv, jz + sanctumH, sw * 1.02, 0.78, C.gold, true, true);
  // gilded dome over the front-left porch (mandapa)
  const mu = tu - 0.02;
  const mv = tv + 0.36;
  iso.box(mu - 0.14, mv - 0.14, mu + 0.14, mv + 0.14, jz, jz + 0.18, mat('#f2ead8'));
  iso.archV(mv + 0.14, mu - 0.06, mu + 0.06, jz, jz + 0.15, '#5b3e2c');
  iso.archU(mu + 0.14, mv - 0.06, mv + 0.06, jz, jz + 0.15, '#4d3424');
  iso.box(mu - 0.16, mv - 0.16, mu + 0.16, mv + 0.16, jz + 0.18, jz + 0.2, mat('#e3d4b4'));
  dome(iso, mu, mv, jz + 0.2, 0.14, C.gold, 'onion', '#e7c35a');
  // third, smaller stone spire on the right
  const ru = tu + 0.4;
  const rv = tv - 0.05;
  iso.box(ru - 0.1, rv - 0.1, ru + 0.1, rv + 0.1, jz, jz + 0.16, mat('#f2ead8'));
  shikhara(iso, ru, rv, jz + 0.16, 0.1, 0.36, '#efe3c8', true, false);
  // low front railings with gateways
  const rail = mat('#e8dcc2');
  iso.box(1.9, 0.26, 1.96, 1.96, pz, pz + 0.07, rail);
  iso.box(0.26, 1.9, 0.86, 1.96, pz, pz + 0.07, rail);
  iso.box(1.16, 1.9, 1.96, 1.96, pz, pz + 0.07, rail);
  for (const gu of [0.86, 1.16]) {
    iso.box(gu - 0.03, 1.88, gu + 0.03, 1.96, pz, pz + 0.18, mat(stone));
    dome(iso, gu, 1.92, pz + 0.18, 0.035, stone, 'round');
  }
  // entry steps
  iso.box(0.9, 1.97, 1.12, 2.0, 0, pz, mat('#e3d4b4'), { edges: false });
}

// ============================================================================
// LANDMARK: BANARAS HINDU UNIVERSITY (4×4)
// ============================================================================

/** An arcaded Indo-Saracenic wing: two storeys of pointed arches, cream bands, parapet + chhatris. */
function saracenicWing(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number, showV: boolean, showU: boolean): void {
  const body = C.pinkSand;
  const trim = '#efdcb8';
  iso.aoRect(u0, v0, u1, v1, z, 0.12, 0.45);
  iso.castShadow([
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ], z, H, 0.15);
  iso.box(u0, v0, u1, v1, z, z + H, mat(body), { noLeft: !showV, noRight: !showU });
  const storeys = 2;
  const sh = H / storeys;
  for (let s = 0; s < storeys; s++) {
    const zs = z + s * sh;
    if (showV) {
      iso.poly(iso.faceVQuad(v1, u0, u1, zs + sh - 0.025, zs + sh), trim);
      const n = Math.max(2, Math.round((u1 - u0) / 0.13));
      for (let i = 0; i < n; i++) {
        const a = u0 + ((i + 0.2) / n) * (u1 - u0);
        const b = u0 + ((i + 0.8) / n) * (u1 - u0);
        iso.archV(v1, a - 0.006, b + 0.006, zs + 0.02, zs + sh - 0.035, trim, true);
        iso.archV(v1, a, b, zs + 0.025, zs + sh - 0.045, s === 0 ? '#4a3430' : '#3e3a44', true);
      }
    }
    if (showU) {
      iso.poly(iso.faceUQuad(u1, v0, v1, zs + sh - 0.025, zs + sh), shade(trim, -0.2));
      const n = Math.max(2, Math.round((v1 - v0) / 0.13));
      for (let i = 0; i < n; i++) {
        const a = v0 + ((i + 0.2) / n) * (v1 - v0);
        const b = v0 + ((i + 0.8) / n) * (v1 - v0);
        iso.archU(u1, a - 0.006, b + 0.006, zs + 0.02, zs + sh - 0.035, shade(trim, -0.2), true);
        iso.archU(u1, a, b, zs + 0.025, zs + sh - 0.045, s === 0 ? '#3e2c28' : '#35313a', true);
      }
    }
  }
  if (showV) weatherV(iso, rng, v1, u0, u1, z, z + H, 20, 0.08);
  if (showU) weatherU(iso, rng, u1, v0, v1, z, z + H, 16, 0.1);
  // plinth band
  if (showV) iso.poly(iso.faceVQuad(v1, u0, u1, z, z + 0.03), shade(C.pinkSandDeep, -0.1));
  if (showU) iso.poly(iso.faceUQuad(u1, v0, v1, z, z + 0.03), shade(C.pinkSandDeep, -0.35));
  // cornice + crenellated parapet
  const zt = z + H;
  iso.box(u0 - 0.02, v0 - 0.02, u1 + 0.02, v1 + 0.02, zt, zt + 0.022, mat(trim));
  iso.poly(iso.topQuad(u0, v0, u1, v1, zt + 0.022), shade(body, 0.1));
  const merlon = mat(trim);
  if (showV) for (let u = u0; u < u1 - 0.02; u += 0.05) iso.box(u, v1 - 0.02, u + 0.025, v1, zt + 0.022, zt + 0.045, merlon, { edges: false });
  if (showU) for (let v = v0; v < v1 - 0.02; v += 0.05) iso.box(u1 - 0.02, v, u1, v + 0.025, zt + 0.022, zt + 0.045, merlon, { edges: false });
}

function drawBHU(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 4);
  const rng = seededRng('landmark_bhu', variant);
  const z0 = 0.03;
  slab(iso, rng, 0.04, z0, C.lawn, '#7a6446', []);
  lawn(iso, rng, 0.06, 0.06, 3.94, 3.94, z0, C.lawn);
  // paths: forecourt, central avenue and cross path
  const path = '#d8c7a4';
  iso.poly(iso.topQuad(0.35, 1.9, 3.65, 2.25, z0 + 0.002), path);
  iso.poly(iso.topQuad(1.78, 1.9, 2.22, 3.96, z0 + 0.002), path);
  iso.poly(iso.topQuad(0.35, 3.1, 3.65, 3.3, z0 + 0.002), path);
  paving(iso, rng, 1.78, 1.9, 2.22, 3.96, z0 + 0.002, 0.11, 0.11, alpha('#a8966f', 0.4));
  // main wing (back), long along u
  const H = 0.46;
  // trees behind the building
  iso.tree(0.3, 0.3, z0, 0.16, rng, 'neem');
  iso.tree(3.7, 0.35, z0, 0.18, rng, 'peepal');
  saracenicWing(iso, rng, 0.45, 0.75, 3.55, 1.45, z0, H, true, true);
  // central projecting porch + clock tower
  const cu = 2.0;
  saracenicWing(iso, rng, cu - 0.34, 1.45, cu + 0.34, 1.78, z0, H * 0.78, true, true);
  // tower
  const tw = 0.2;
  const tz = z0 + H + 0.022;
  const tH = 0.62;
  const tv = 1.1;
  iso.box(cu - tw, tv - tw, cu + tw, tv + tw, tz, tz + tH, mat(C.pinkSand));
  for (const zz of [tz + 0.2, tz + 0.42]) {
    iso.poly(iso.faceVQuad(tv + tw, cu - tw, cu + tw, zz - 0.02, zz), '#efdcb8');
    iso.poly(iso.faceUQuad(cu + tw, tv - tw, tv + tw, zz - 0.02, zz), shade('#efdcb8', -0.2));
  }
  iso.archV(tv + tw, cu - 0.07, cu + 0.07, tz + 0.03, tz + 0.18, '#3e3a44', true);
  iso.archU(cu + tw, tv - 0.07, tv + 0.07, tz + 0.03, tz + 0.18, '#35313a', true);
  // clock faces (plain dial, no numerals)
  const clock = (face: 'u' | 'v') => {
    const zc = tz + 0.31;
    const r = 0.09;
    const pts: P3[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push(face === 'v' ? [cu + Math.cos(a) * r, tv + tw + 0.001, zc + Math.sin(a) * r] : [cu + tw + 0.001, tv + Math.cos(a) * r, zc + Math.sin(a) * r]);
    }
    iso.poly(pts, face === 'v' ? '#f6efdc' : '#ddd3bd', '#6a4a2a', 1.6);
    const c: P3 = face === 'v' ? [cu, tv + tw + 0.002, zc] : [cu + tw + 0.002, tv, zc];
    const hand1: P3 = face === 'v' ? [cu + 0.0, tv + tw + 0.002, zc + 0.065] : [cu + tw + 0.002, tv, zc + 0.065];
    const hand2: P3 = face === 'v' ? [cu + 0.045, tv + tw + 0.002, zc - 0.015] : [cu + tw + 0.002, tv + 0.045, zc - 0.015];
    iso.line(c, hand1, '#2a2622', 1.6);
    iso.line(c, hand2, '#2a2622', 1.8);
  };
  clock('v');
  clock('u');
  const ttop = tz + tH;
  iso.box(cu - tw - 0.03, tv - tw - 0.03, cu + tw + 0.03, tv + tw + 0.03, ttop, ttop + 0.03, mat('#efdcb8'));
  // corner chhatris on the tower and a central dome
  for (const [du, dv] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as [number, number][]) {
    if (du === -1 && dv === -1) continue;
    chhatri(iso, rng, cu + du * (tw - 0.02) - 0.035, tv + dv * (tw - 0.02) - 0.035, ttop + 0.03, 0.07, '#efdcb8', '#efdcb8', 0.08);
  }
  iso.lathe(cu, tv, ttop + 0.03, [
    [0, 0.13],
    [0.07, 0.13],
  ], () => C.pinkSand, { outline: true });
  dome(iso, cu, tv, ttop + 0.1, 0.14, '#f0e2c4', 'round', C.brass);
  // wing-end chhatris on the main roof
  for (const u of [0.62, 3.38]) chhatri(iso, rng, u - 0.06, 1.2, z0 + H + 0.022, 0.12, '#efdcb8', '#efdcb8');
  // side wings coming forward (left and right)
  iso.tree(0.25, 2.3, z0, 0.13, rng, 'neem');
  saracenicWing(iso, rng, 0.45, 1.45, 1.05, 2.9, z0, H * 0.92, true, true);
  chhatri(iso, rng, 0.69, 2.55, z0 + H * 0.92 + 0.022, 0.12, '#efdcb8', '#efdcb8');
  saracenicWing(iso, rng, 2.95, 1.45, 3.55, 2.9, z0, H * 0.92, true, true);
  chhatri(iso, rng, 3.19, 2.55, z0 + H * 0.92 + 0.022, 0.12, '#efdcb8', '#efdcb8');
  // fountain in the forecourt
  iso.cylinder(2.0, 2.65, 0.2, z0, z0 + 0.04, '#e8dcc2', null);
  iso.ellipse(2.0, 2.65, z0 + 0.04, 0.17, '#5f9fb0', alpha('#2a4a55', 0.5), 1);
  iso.cylinder(2.0, 2.65, 0.035, z0 + 0.04, z0 + 0.1, '#e8dcc2');
  // trees lining the avenue and the lawn edges
  for (const v of [2.5, 3.0, 3.55]) {
    iso.tree(1.62, v, z0, 0.07, rng, 'ashoka');
    iso.tree(2.38, v, z0, 0.07, rng, 'ashoka');
  }
  iso.tree(0.5, 3.6, z0, 0.2, rng, 'neem');
  iso.tree(3.5, 3.55, z0, 0.2, rng, 'peepal');
  iso.tree(3.75, 2.2, z0, 0.14, rng, 'neem');
}

// ============================================================================
// LANDMARK: SARNATH, DHAMEK STUPA (3×3)
// ============================================================================

function brickRuin(iso: Iso, rng: Rng, u0: number, v0: number, cols: number, rows: number, cell: number, z: number): void {
  const t = 0.028;
  const bm = mat('#a0624a', { top: 0.1 });
  const hgt = () => 0.02 + rng() * 0.05;
  const u1 = u0 + cols * cell;
  const v1 = v0 + rows * cell;
  iso.aoRect(u0, v0, u1, v1, z, 0.03, 0.2);
  // floor of the cells (packed earth)
  iso.poly(iso.topQuad(u0, v0, u1, v1, z + 0.001), '#b39266');
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.15) continue;
      const a = u0 + c * cell;
      iso.box(a, v0 + r * cell - t / 2, a + cell, v0 + r * cell + t / 2, z, z + hgt(), bm);
    }
  }
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rng() < 0.15) continue;
      const a = v0 + r * cell;
      iso.box(u0 + c * cell - t / 2, a, u0 + c * cell + t / 2, a + cell, z, z + hgt(), bm);
    }
  }
}

function votiveStupa(iso: Iso, u: number, v: number, z: number, r: number): void {
  iso.aoEllipse(u, v, r * 1.2, z, 0.03, 0.3);
  iso.box(u - r * 1.1, v - r * 1.1, u + r * 1.1, v + r * 1.1, z, z + r * 0.5, mat('#a0624a'));
  iso.lathe(u, v, z + r * 0.5, [
    [0, r],
    [r * 0.4, r * 0.95],
    [r * 0.8, r * 0.6],
    [r, 0.0],
  ], () => '#b07a5a', { outline: true });
}

function drawSarnath(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('landmark_sarnath', variant);
  const z0 = 0.03;
  slab(iso, rng, 0.03, z0, C.lawn, '#7a6446', []);
  lawn(iso, rng, 0.05, 0.05, 2.95, 2.95, z0, '#78a246');
  // brick paths
  const path = '#c9a47a';
  iso.poly(iso.topQuad(1.38, 1.9, 1.62, 2.97, z0 + 0.002), path);
  paving(iso, rng, 1.38, 1.9, 1.62, 2.97, z0 + 0.002, 0.05, 0.08, alpha('#8a5a3a', 0.35));
  // monastery ruins (back-left and back-right)
  brickRuin(iso, rng, 0.2, 0.2, 4, 3, 0.16, z0);
  brickRuin(iso, rng, 2.05, 0.25, 3, 4, 0.16, z0);
  brickRuin(iso, rng, 0.22, 2.1, 3, 3, 0.15, z0);
  votiveStupa(iso, 2.35, 2.25, z0, 0.07);
  votiveStupa(iso, 2.6, 2.05, z0, 0.05);
  votiveStupa(iso, 0.95, 0.95, z0, 0.05);
  iso.tree(0.25, 1.5, z0, 0.18, rng, 'peepal');
  iso.tree(2.8, 1.4, z0, 0.15, rng, 'neem');
  // the Dhamek Stupa
  const su = 1.5;
  const sv = 1.45;
  // circular stone platform
  iso.aoEllipse(su, sv, 0.72, z0, 0.1, 0.4);
  iso.cylinder(su, sv, 0.72, z0, z0 + 0.04, '#c9b28d', '#d8c6a4');
  iso.ellipse(su, sv, z0 + 0.04, 0.66, null, alpha('#8f7a58', 0.5), 1);
  const zb = z0 + 0.04;
  iso.castShadow(
    Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return [su + Math.cos(a) * 0.5, sv + Math.sin(a) * 0.5] as [number, number];
    }),
    zb,
    1.2,
    0.2,
  );
  // lower stone drum with a carved band, then the brick upper drum and worn rounded top
  const R = 0.5;
  const stoneTop = 0.62;
  const prof: [number, number][] = [
    [0, R + 0.02],
    [0.04, R + 0.02],
    [0.05, R],
    [stoneTop, R],
    [stoneTop + 0.02, R - 0.02],
    [1.18, R - 0.03],
    [1.26, R - 0.07],
    [1.33, R - 0.17],
    [1.38, R - 0.3],
    [1.4, 0],
  ];
  const stoneC = '#c3ad89';
  const brickC = '#a86a4c';
  iso.lathe(su, sv, zb, prof, (t, up) => {
    const z = t * 1.42;
    if (z < stoneTop) {
      if (z > 0.4 && z < 0.52) return shade('#b89d78', Math.floor(z * 90) % 2 ? -0.06 : 0.04);
      return stoneC;
    }
    return up > 0.5 ? shade(brickC, 0.06) : brickC;
  }, { outline: true, lit: 0.18, dark: -0.36 });
  // brick courses and texture on the upper drum (front half arcs), stone courses below
  const [cx] = iso.pt(su, sv, 0);
  for (let z = 0.05; z < 1.26; z += 0.035) {
    const [, cy] = iso.pt(su, sv, zb + z);
    const r = z < stoneTop ? R : R - 0.03;
    const [rx, ry] = iso.ellipseRadii(r);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0.05, Math.PI - 0.05);
    ctx.strokeStyle = z < stoneTop ? 'rgba(90,70,45,0.28)' : 'rgba(70,35,22,0.3)';
    ctx.lineWidth = 0.9 * iso.px;
    ctx.stroke();
  }
  // weathering patches on the brick
  for (let i = 0; i < 40; i++) {
    const a = Math.PI * (0.05 + rng() * 0.9) - Math.PI * 0.25;
    const z = stoneTop + 0.03 + rng() * 0.55;
    const [x, y] = iso.pt(su + Math.cos(a) * (R - 0.03), sv + Math.sin(a) * (R - 0.03), zb + z);
    ctx.fillStyle = rng() < 0.5 ? 'rgba(60,40,28,0.25)' : 'rgba(210,160,120,0.25)';
    ctx.fillRect(x - 3 * iso.px, y, (4 + rng() * 8) * iso.px, (2 + rng() * 4) * iso.px);
  }
  // the eight projecting faces with niches: show the ones facing the viewer
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.cos(a) + Math.sin(a) < 0.2) continue;
    const zn0 = zb + 0.52;
    const zn1 = zb + 0.72;
    const da = 0.12;
    const pts: P3[] = [];
    const r = R + 0.035;
    for (let k = 0; k <= 6; k++) {
      const aa = a - da + (k / 6) * 2 * da;
      pts.push([su + Math.cos(aa) * r, sv + Math.sin(aa) * r, zn0]);
    }
    for (let k = 6; k >= 0; k--) {
      const aa = a - da + (k / 6) * 2 * da;
      const lift = Math.sin((k / 6) * Math.PI) * 0.05;
      pts.push([su + Math.cos(aa) * r, sv + Math.sin(aa) * r, zn1 + lift]);
    }
    iso.poly(pts, stoneC, alpha('#5a4630', 0.6), 1);
    const inner: P3[] = [];
    const ri = r + 0.001;
    const di = da * 0.55;
    for (let k = 0; k <= 6; k++) {
      const aa = a - di + (k / 6) * 2 * di;
      inner.push([su + Math.cos(aa) * ri, sv + Math.sin(aa) * ri, zn0 + 0.03]);
    }
    for (let k = 6; k >= 0; k--) {
      const aa = a - di + (k / 6) * 2 * di;
      const lift = Math.sin((k / 6) * Math.PI) * 0.035;
      inner.push([su + Math.cos(aa) * ri, sv + Math.sin(aa) * ri, zn1 - 0.02 + lift]);
    }
    iso.poly(inner, '#4a3a2c');
  }
  // a few trees on the front lawn
  iso.tree(0.6, 2.75, z0, 0.14, rng, 'neem');
  iso.tree(2.6, 2.7, z0, 0.12, rng, 'ashoka');
}

// ============================================================================
// LANDMARK: RAMNAGAR FORT (3×3)
// ============================================================================

function merlons(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, along: 'u' | 'v', m: Mat): void {
  const step = 0.055;
  if (along === 'u') for (let u = u0; u < u1 - 0.02; u += step) iso.box(u, v0, u + 0.03, v1, z, z + 0.035, m, { edges: false });
  else for (let v = v0; v < v1 - 0.02; v += step) iso.box(u0, v, u1, v + 0.03, z, z + 0.035, m, { edges: false });
}

function bastion(iso: Iso, u: number, v: number, r: number, z: number, H: number, stone: string): void {
  iso.aoEllipse(u, v, r, z, 0.08, 0.4);
  iso.lathe(u, v, z, [
    [0, r * 1.12],
    [H * 0.3, r * 1.02],
    [H, r],
    [H + 0.01, r + 0.02],
    [H + 0.03, r + 0.02],
  ], (t) => (t > 0.94 ? shade(stone, 0.05) : stone), { top: shade(stone, 0.1), outline: true });
  // merlons around the rim (front half)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.cos(a) + Math.sin(a) < -0.6) continue;
    const pu = u + Math.cos(a) * (r - 0.005);
    const pv = v + Math.sin(a) * (r - 0.005);
    iso.box(pu - 0.015, pv - 0.015, pu + 0.015, pv + 0.015, z + H + 0.03, z + H + 0.065, mat(shade(stone, 0.02)), { edges: false });
  }
  // arrow slits
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * (0.05 + i * 0.2);
    const pu = u + Math.cos(a) * (r + 0.001);
    const pv = v + Math.sin(a) * (r + 0.001);
    iso.line([pu, pv, z + H * 0.55], [pu, pv, z + H * 0.72], '#3a2a20', 1.6);
  }
  // small chhatri kiosk on top
  dome(iso, u, v, z + H + 0.03, r * 0.35, shade(stone, 0.05), 'round');
}

function jharokha(iso: Iso, face: 'u' | 'v', plane: number, a: number, z: number, stone: string): void {
  const wdt = 0.07;
  const dep = 0.035;
  const m = mat(shade(stone, 0.04));
  if (face === 'u') {
    iso.box(plane, a, plane + dep, a + wdt, z - 0.015, z, m); // sill
    iso.box(plane, a + 0.004, plane + dep - 0.004, a + wdt - 0.004, z, z + 0.07, m, { noTop: true });
    iso.poly(iso.faceUQuad(plane + dep - 0.004, a + 0.014, a + wdt - 0.014, z + 0.01, z + 0.06), '#3a2a24');
    iso.box(plane - 0.004, a - 0.008, plane + dep + 0.008, a + wdt + 0.008, z + 0.07, z + 0.08, m);
    dome(iso, plane + dep / 2, a + wdt / 2, z + 0.08, 0.028, shade(stone, 0.04), 'flat');
  } else {
    iso.box(a, plane, a + wdt, plane + dep, z - 0.015, z, m);
    iso.box(a + 0.004, plane, a + wdt - 0.004, plane + dep - 0.004, z, z + 0.07, m, { noTop: true });
    iso.poly(iso.faceVQuad(plane + dep - 0.004, a + 0.014, a + wdt - 0.014, z + 0.01, z + 0.06), '#3a2a24');
    iso.box(a - 0.008, plane - 0.004, a + wdt + 0.008, plane + dep + 0.008, z + 0.07, z + 0.08, m);
    dome(iso, a + wdt / 2, plane + dep / 2, z + 0.08, 0.028, shade(stone, 0.04), 'flat');
  }
}

function drawRamnagarFort(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('landmark_ramnagar_fort', variant);
  const z0 = 0.02;
  const stone = C.chunar;
  const sm = mat(stone, { right: -0.26 });
  slab(iso, rng, 0.02, z0, '#cdb58c', '#9c8462', ['#c2a97f', '#d9c39b', '#b39a72']);
  const lo = 0.16;
  const hi = 2.84;
  const t = 0.12;
  const WH = 0.42;
  // back ramparts
  iso.box(lo, lo, hi, lo + t, z0, z0 + WH, sm);
  iso.box(lo, lo, lo + t, hi, z0, z0 + WH, sm);
  merlons(iso, lo, lo, hi, lo + 0.03, z0 + WH, 'u', mat(shade(stone, 0.03)));
  merlons(iso, lo, lo, lo + 0.03, hi, z0 + WH, 'v', mat(shade(stone, 0.03)));
  bastion(iso, lo + 0.04, lo + 0.04, 0.2, z0, WH + 0.1, stone);
  // courtyard floor
  iso.poly(iso.topQuad(lo + t, lo + t, hi - t, hi - t, z0 + 0.002), '#d6c29a');
  // palace block (multi-storey) with rooftop chhatris
  const pu0 = 0.55;
  const pv0 = 0.45;
  const pu1 = 2.05;
  const pv1 = 1.75;
  const PH = 0.78;
  iso.castShadow([
    [pu0, pv0],
    [pu1, pv0],
    [pu1, pv1],
    [pu0, pv1],
  ], z0, PH, 0.15);
  iso.box(pu0, pv0, pu1, pv1, z0, z0 + PH, sm);
  for (let s = 0; s < 3; s++) {
    const zs = z0 + 0.12 + s * 0.22;
    iso.poly(iso.faceVQuad(pv1, pu0, pu1, zs - 0.02, zs - 0.005), shade(stone, -0.08));
    iso.poly(iso.faceUQuad(pu1, pv0, pv1, zs - 0.02, zs - 0.005), shade(stone, -0.32));
    for (let k = 0; k < 8; k++) {
      const a = pu0 + 0.08 + k * 0.18;
      if (s > 0 && k % 3 === 1) jharokha(iso, 'v', pv1, a - 0.01, zs + 0.04, stone);
      else iso.archV(pv1, a, a + 0.06, zs + 0.03, zs + 0.15, '#3f3028', true);
    }
    for (let k = 0; k < 7; k++) {
      const a = pv0 + 0.08 + k * 0.18;
      if (s > 0 && k % 3 === 1) jharokha(iso, 'u', pu1, a - 0.01, zs + 0.04, stone);
      else iso.archU(pu1, a, a + 0.06, zs + 0.03, zs + 0.15, '#35281f', true);
    }
  }
  weatherV(iso, rng, pv1, pu0, pu1, z0, z0 + PH, 24, 0.12);
  weatherU(iso, rng, pu1, pv0, pv1, z0, z0 + PH, 22, 0.16);
  const zr = z0 + PH;
  iso.box(pu0 - 0.02, pv0 - 0.02, pu1 + 0.02, pv1 + 0.02, zr, zr + 0.025, mat(shade(stone, 0.05)));
  // flat roof terrace: lime-plaster patches and paving
  const roof = iso.topQuad(pu0 - 0.02, pv0 - 0.02, pu1 + 0.02, pv1 + 0.02, zr + 0.025);
  iso.poly(roof, shade(stone, 0.02));
  paving(iso, rng, pu0, pv0, pu1, pv1, zr + 0.025, 0.12, 0.12, alpha('#9c8460', 0.25));
  iso.speckle(roof, rng, 900, [alpha('#b39d78', 0.5), alpha('#fff4dc', 0.5), alpha('#8a7454', 0.35)], 1.4);
  merlons(iso, pu0, pv1 - 0.03, pu1, pv1, zr + 0.025, 'u', mat(shade(stone, 0.05)));
  merlons(iso, pu1 - 0.03, pv0, pu1, pv1, zr + 0.025, 'v', mat(shade(stone, 0.05)));
  chhatri(iso, rng, pu0 + 0.1, pv0 + 0.1, zr + 0.025, 0.16, stone, shade(stone, 0.06));
  chhatri(iso, rng, pu1 - 0.3, pv0 + 0.1, zr + 0.025, 0.16, stone, shade(stone, 0.06));
  chhatri(iso, rng, pu0 + 0.1, pv1 - 0.3, zr + 0.025, 0.16, stone, shade(stone, 0.06));
  chhatri(iso, rng, (pu0 + pu1) / 2 - 0.13, (pv0 + pv1) / 2 - 0.13, zr + 0.025, 0.26, stone, shade(stone, 0.08), 0.26);
  // inner garden + tree
  lawn(iso, rng, 2.2, 0.5, 2.7, 1.6, z0 + 0.003, C.lawnDark);
  iso.tree(2.45, 0.8, z0, 0.14, rng, 'peepal');
  iso.tree(0.5, 2.35, z0, 0.13, rng, 'neem');
  // front ramparts (river-facing +u and the gate side +v)
  iso.box(hi - t, lo, hi, hi, z0, z0 + WH, sm);
  iso.box(lo, hi - t, hi, hi, z0, z0 + WH, sm);
  coursesU(iso, rng, hi, lo, hi, z0, z0 + WH, 0.05, 0.12, alpha('#6a5236', 0.22), 0.8);
  coursesV(iso, rng, hi, lo, hi, z0, z0 + WH, 0.05, 0.12, alpha('#6a5236', 0.2), 0.8);
  weatherU(iso, rng, hi, lo, hi, z0, z0 + WH, 40, 0.2);
  weatherV(iso, rng, hi, lo, hi, z0, z0 + WH, 36, 0.14);
  grime(iso, lo, lo, hi, hi, z0, 0.12, 0.3);
  // river-facing windows and jharokhas on the +u rampart
  for (let k = 0; k < 6; k++) {
    const a = lo + 0.3 + k * 0.42;
    jharokha(iso, 'u', hi, a, z0 + 0.24, stone);
    iso.archU(hi, a + 0.2, a + 0.25, z0 + 0.12, z0 + 0.2, '#3a2c22', true);
  }
  // gateway on the +v rampart: tall arch flanked by two small towers
  const gu = 1.5;
  const turret = (tu: number) => {
    const th = WH + 0.2;
    iso.box(tu - 0.065, hi - 0.05, tu + 0.065, hi + 0.075, z0, z0 + th, sm);
    iso.archV(hi + 0.075, tu - 0.022, tu + 0.022, z0 + 0.27, z0 + 0.37, '#3a2c22', true);
    iso.archU(tu + 0.065, hi - 0.01, hi + 0.035, z0 + 0.27, z0 + 0.37, '#30241c', true);
    iso.poly(iso.faceVQuad(hi + 0.075, tu - 0.065, tu + 0.065, z0 + 0.2, z0 + 0.215), shade(stone, -0.1));
    iso.box(tu - 0.08, hi - 0.065, tu + 0.08, hi + 0.09, z0 + th, z0 + th + 0.02, mat(shade(stone, 0.05)));
    dome(iso, tu, hi + 0.012, z0 + th + 0.02, 0.06, shade(stone, 0.06), 'onion');
  };
  turret(gu - 0.27);
  iso.box(gu - 0.2, hi - 0.02, gu + 0.2, hi + 0.04, z0, z0 + WH + 0.12, sm);
  iso.archV(hi + 0.04, gu - 0.1, gu + 0.1, z0, z0 + 0.35, shade(stone, -0.12), true);
  iso.archV(hi + 0.041, gu - 0.08, gu + 0.08, z0, z0 + 0.31, '#4a3526', true);
  iso.archV(hi + 0.042, gu - 0.065, gu + 0.065, z0, z0 + 0.26, '#7a5230', false);
  iso.line([gu, hi + 0.043, z0], [gu, hi + 0.043, z0 + 0.26], alpha('#2a1a10', 0.7), 1);
  jharokha(iso, 'v', hi + 0.04, gu - 0.035, z0 + 0.4, stone);
  merlons(iso, gu - 0.2, hi + 0.01, gu + 0.2, hi + 0.04, z0 + WH + 0.12, 'u', mat(shade(stone, 0.04)));
  turret(gu + 0.27);
  merlons(iso, lo, hi - 0.03, hi, hi, z0 + WH, 'u', mat(shade(stone, 0.03)));
  merlons(iso, hi - 0.03, lo, hi, hi, z0 + WH, 'v', mat(shade(stone, 0.03)));
  // corner bastions in front
  bastion(iso, hi - 0.04, lo + 0.04, 0.2, z0, WH + 0.1, stone);
  bastion(iso, lo + 0.04, hi - 0.04, 0.2, z0, WH + 0.1, stone);
  bastion(iso, hi - 0.04, hi - 0.04, 0.22, z0, WH + 0.14, stone);
}

// ============================================================================
// Registry
// ============================================================================

export type ProceduralSpriteDraw = (ctx: Ctx2D, w: number, h: number, variant: number) => void;

export interface ProceduralSpriteDef {
  /** Footprint in tiles per side (N for N×N). */
  footprint: number;
  /** Number of art variants (valid variant indices are 0 … variants − 1). */
  variants: number;
  /** Space reserved ABOVE the base diamond's top corner, in tile widths. */
  heightTiles: number;
  /** Paint the sprite into a transparent canvas of the size given by `getProceduralSpriteSize`. */
  draw: ProceduralSpriteDraw;
  /** True for art that is designed to join seamlessly with copies of itself on neighbouring tiles. */
  tileable?: boolean;
  /** True for waterfront art whose front (river) side is the +x edge (flip for +y). */
  waterfront?: boolean;
}

export const VARANASI_PROCEDURAL_SPRITE_TYPES = [
  'ghat',
  'sewage_treatment_plant',
  'informal_housing',
  'jal_sansthan_water_works',
  'embankment',
  'landmark_dashashwamedh',
  'landmark_kashi_vishwanath',
  'landmark_bhu',
  'landmark_sarnath',
  'landmark_ramnagar_fort',
] as const;

export type VaranasiProceduralSpriteType = (typeof VARANASI_PROCEDURAL_SPRITE_TYPES)[number];

export const VARANASI_PROCEDURAL_SPRITES: Record<VaranasiProceduralSpriteType, ProceduralSpriteDef> = {
  ghat: { footprint: 1, variants: 3, heightTiles: 0.28, draw: drawGhat, tileable: true, waterfront: true },
  sewage_treatment_plant: { footprint: 2, variants: 1, heightTiles: 0.1, draw: drawSTP },
  informal_housing: { footprint: 1, variants: 2, heightTiles: 0.24, draw: drawInformalHousing },
  jal_sansthan_water_works: { footprint: 3, variants: 1, heightTiles: 0.64, draw: drawJalSansthan },
  embankment: { footprint: 1, variants: 1, heightTiles: 0.14, draw: drawEmbankment, tileable: true },
  landmark_dashashwamedh: { footprint: 2, variants: 1, heightTiles: 0.6, draw: drawDashashwamedh, waterfront: true },
  landmark_kashi_vishwanath: { footprint: 2, variants: 1, heightTiles: 0.32, draw: drawKashiVishwanath },
  landmark_bhu: { footprint: 4, variants: 1, heightTiles: 0.13, draw: drawBHU },
  landmark_sarnath: { footprint: 3, variants: 1, heightTiles: 0.1, draw: drawSarnath },
  landmark_ramnagar_fort: { footprint: 3, variants: 1, heightTiles: 0.36, draw: drawRamnagarFort },
};

export function isVaranasiProceduralSprite(type: string): type is VaranasiProceduralSpriteType {
  return Object.prototype.hasOwnProperty.call(VARANASI_PROCEDURAL_SPRITES, type);
}

/** Wrap any integer into [0, variants). */
export function normalizeVariant(type: VaranasiProceduralSpriteType, variant: number): number {
  const n = VARANASI_PROCEDURAL_SPRITES[type].variants;
  const v = Math.floor(Number.isFinite(variant) ? variant : 0);
  return ((v % n) + n) % n;
}

/**
 * Deterministic variant for a tile, so rows of ghats do not repeat. Weighted for ghats:
 * ~60% plain steps, ~25% chhatri/umbrella, ~15% shrine and flag.
 */
export function pickProceduralVariant(type: VaranasiProceduralSpriteType, tileX: number, tileY: number): number {
  const def = VARANASI_PROCEDURAL_SPRITES[type];
  if (def.variants <= 1) return 0;
  let hsh = (Math.imul(tileX | 0, 374761393) + Math.imul(tileY | 0, 668265263)) | 0;
  hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
  hsh = Math.imul(hsh ^ (hsh >>> 16), 0x85ebca6b);
  const r = ((hsh ^ (hsh >>> 15)) >>> 0) / 4294967296;
  if (type === 'ghat') return r < 0.6 ? 0 : r < 0.85 ? 1 : 2;
  return Math.min(def.variants - 1, Math.floor(r * def.variants));
}

// ============================================================================
// Sizes, caching and placement
// ============================================================================

export interface ProceduralSpriteSize {
  width: number;
  height: number;
  /** y of the base diamond's top corner (its x is width / 2). */
  baseTopY: number;
  /** Height of the base diamond in px (footprint × tilePx × 0.6). */
  baseHeight: number;
}

export function getProceduralSpriteSize(type: VaranasiProceduralSpriteType, tilePx: number = PROCEDURAL_TILE_PX): ProceduralSpriteSize {
  const def = VARANASI_PROCEDURAL_SPRITES[type];
  const width = Math.round(def.footprint * tilePx);
  const baseTopY = Math.round(def.heightTiles * tilePx);
  const baseHeight = def.footprint * tilePx * PROCEDURAL_ISO_RATIO;
  const height = Math.ceil(baseTopY + baseHeight + BOTTOM_PAD_TILES * tilePx);
  return { width, height, baseTopY, baseHeight };
}

export type SpriteCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface ProceduralSprite extends ProceduralSpriteSize {
  type: VaranasiProceduralSpriteType;
  variant: number;
  flipped: boolean;
  footprint: number;
  tilePx: number;
  canvas: SpriteCanvas;
}

/** Create a canvas that works on the main thread (DOM canvas) or in a worker (OffscreenCanvas). */
export function createSpriteCanvas(width: number, height: number): SpriteCanvas | null {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  return null;
}

/**
 * Paint a sprite into an existing context (for custom atlases). The context's current transform
 * is respected; the sprite occupies (0, 0) … (size.width, size.height).
 */
export function paintProceduralSprite(ctx: Ctx2D, type: VaranasiProceduralSpriteType, variant = 0, flipped = false, tilePx: number = PROCEDURAL_TILE_PX): ProceduralSpriteSize {
  const def = VARANASI_PROCEDURAL_SPRITES[type];
  const size = getProceduralSpriteSize(type, tilePx);
  ctx.save();
  if (flipped) {
    ctx.translate(size.width, 0);
    ctx.scale(-1, 1);
  }
  def.draw(ctx, size.width, size.height, normalizeVariant(type, variant));
  ctx.restore();
  return size;
}

const spriteCache = new Map<string, ProceduralSprite>();

/**
 * Get (rendering on first use) the cached canvas for a sprite. Returns null when no canvas
 * implementation exists (e.g. plain node) or the type is unknown.
 */
export function getProceduralSprite(type: string, variant = 0, flipped = false, tilePx: number = PROCEDURAL_TILE_PX): ProceduralSprite | null {
  if (!isVaranasiProceduralSprite(type)) return null;
  const v = normalizeVariant(type, variant);
  const key = `${type}|${v}|${flipped ? 1 : 0}|${tilePx}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const size = getProceduralSpriteSize(type, tilePx);
  const canvas = createSpriteCanvas(size.width, size.height);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  if (!ctx) return null;
  paintProceduralSprite(ctx, type, v, flipped, tilePx);
  const sprite: ProceduralSprite = { ...size, type, variant: v, flipped, footprint: VARANASI_PROCEDURAL_SPRITES[type].footprint, tilePx, canvas };
  spriteCache.set(key, sprite);
  return sprite;
}

export function clearProceduralSpriteCache(): void {
  spriteCache.clear();
}

export interface SpriteDrawRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Destination rectangle for drawing a cached sprite on the map.
 * @param screenX, screenY  `gridToScreen(originX, originY)`: the top-left of the ORIGIN tile's bounding
 *                          box, where the origin tile is the footprint's min-x/min-y (top/north) tile.
 * @param tileWidth         on-screen tile width (TILE_WIDTH, before any camera zoom transform).
 */
export function getProceduralSpriteDrawRect(
  sprite: Pick<ProceduralSprite, 'width' | 'height' | 'baseTopY' | 'tilePx'>,
  screenX: number,
  screenY: number,
  tileWidth: number,
): SpriteDrawRect {
  const s = tileWidth / sprite.tilePx;
  const dw = sprite.width * s;
  const dh = sprite.height * s;
  return { dx: screenX + tileWidth / 2 - dw / 2, dy: screenY - sprite.baseTopY * s, dw, dh };
}

export interface ProceduralSheetFrame extends ProceduralSpriteSize {
  key: string;
  type: VaranasiProceduralSpriteType;
  variant: number;
  flipped: boolean;
  x: number;
  y: number;
}

export interface ProceduralSheet {
  canvas: SpriteCanvas;
  tilePx: number;
  frames: Record<string, ProceduralSheetFrame>;
}

/** Frame key used by `renderProceduralSpriteSheet`. */
export function proceduralFrameKey(type: VaranasiProceduralSpriteType, variant: number, flipped: boolean): string {
  return `${type}:${variant}${flipped ? ':flipped' : ''}`;
}

/**
 * Render every sprite × variant (optionally also flipped) into ONE atlas canvas (simple shelf packing),
 * e.g. to upload as a single GPU texture. Returns null when no canvas implementation exists.
 */
export function renderProceduralSpriteSheet(
  opts: { tilePx?: number; includeFlipped?: boolean; maxWidth?: number; padding?: number; types?: readonly VaranasiProceduralSpriteType[] } = {},
): ProceduralSheet | null {
  const tilePx = opts.tilePx ?? 128;
  const pad = opts.padding ?? 2;
  const maxWidth = opts.maxWidth ?? 4096;
  const types = opts.types ?? VARANASI_PROCEDURAL_SPRITE_TYPES;
  const items: Omit<ProceduralSheetFrame, 'x' | 'y'>[] = [];
  for (const type of types) {
    const def = VARANASI_PROCEDURAL_SPRITES[type];
    for (let v = 0; v < def.variants; v++) {
      for (const flipped of opts.includeFlipped ? [false, true] : [false]) {
        items.push({ key: proceduralFrameKey(type, v, flipped), type, variant: v, flipped, ...getProceduralSpriteSize(type, tilePx) });
      }
    }
  }
  // shelf packing, tallest first
  const sorted = [...items].sort((a, b) => b.height - a.height);
  const frames: Record<string, ProceduralSheetFrame> = {};
  let x = pad;
  let y = pad;
  let shelfH = 0;
  let sheetW = 0;
  for (const it of sorted) {
    if (x + it.width + pad > maxWidth && x > pad) {
      x = pad;
      y += shelfH + pad;
      shelfH = 0;
    }
    frames[it.key] = { ...it, x, y };
    x += it.width + pad;
    sheetW = Math.max(sheetW, x);
    shelfH = Math.max(shelfH, it.height);
  }
  const sheetH = y + shelfH + pad;
  const canvas = createSpriteCanvas(Math.ceil(sheetW), Math.ceil(sheetH));
  if (!canvas) return null;
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  if (!ctx) return null;
  for (const f of Object.values(frames)) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.beginPath();
    ctx.rect(0, 0, f.width, f.height);
    ctx.clip();
    paintProceduralSprite(ctx, f.type, f.variant, f.flipped, tilePx);
    ctx.restore();
  }
  return { canvas, tilePx, frames };
}
