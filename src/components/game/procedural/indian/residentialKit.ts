/**
 * Small drawing kit for the Indian residential art (./residential.ts): plastered walls, grilled
 * windows with chhajjas, balconies, rooftop clutter (Sintex tanks, dishes, rebar, mumty stair
 * towers), two-wheelers and cars. All coordinates are tile units, as in ../isoPainter.
 */
import { Iso, alpha, mat, shade, type P3 } from '../isoPainter';
import { C, drum, grime, weatherU, weatherV } from '../varanasiSprites';
import type { Rng } from '@/lib/rng';

export const PASTEL = {
  pink: '#e9a79c',
  rose: '#d98480',
  turquoise: '#62b8b0',
  mint: '#a5d3a8',
  lemon: '#ecd376',
  ochre: '#dca85a',
  haldi: '#e0a93e',
  sky: '#90c3de',
  banarasiBlue: '#6ea6cc',
  lilac: '#bfa3d2',
  peach: '#f1b98c',
  salmon: '#e69a82',
  limeWash: '#f0e9d6',
  terracotta: '#c56f4c',
  sandstone: '#dcc39a',
} as const;

export const LAUNDRY = ['#e4572e', '#f2c14e', '#3a86c8', '#f1ebdd', '#b44ca0', '#3aa36b', '#e98fb0'] as const;

// ============================================================================
// Walls
// ============================================================================

export interface PlasterOpts {
  noTop?: boolean;
  noLeft?: boolean;
  noRight?: boolean;
  /** Speckle density multiplier (0 = none). */
  speck?: number;
  /** Rain streak count per face. */
  weather?: number;
  /** z levels where a trim band (floor slab edge) is painted. */
  bands?: readonly number[];
  band?: string;
  /** Height of the rising-damp band at the foot (0 = none). */
  grimeH?: number;
  /** Cast a shadow on the ground. */
  shadow?: boolean;
  /** Ambient occlusion at the foot. */
  ao?: boolean;
}

/** A plastered box: three-tone faces, speckled lime texture, floor bands, streaks and grime. */
export function plasterBox(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, color: string, o: PlasterOpts = {}): void {
  if (o.ao !== false) iso.aoRect(u0, v0, u1, v1, z0, 0.05, 0.4);
  if (o.shadow) iso.castShadow([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], z0, (z1 - z0) * 0.8, 0.16);
  iso.box(u0, v0, u1, v1, z0, z1, mat(color, { right: -0.3 }), { noTop: o.noTop, noLeft: o.noLeft, noRight: o.noRight });
  const sp = o.speck ?? 1;
  if (sp > 0) {
    const a = Math.round(sp * 260 * (u1 - u0) * (z1 - z0) + 6);
    const b = Math.round(sp * 260 * (v1 - v0) * (z1 - z0) + 6);
    const cols = [alpha(shade(color, 0.22), 0.55), alpha(shade(color, -0.16), 0.45), alpha(shade(color, -0.3), 0.25)];
    if (!o.noLeft) iso.speckle(iso.faceVQuad(v1, u0, u1, z0, z1), rng, a, cols, 1.5);
    if (!o.noRight) iso.speckle(iso.faceUQuad(u1, v0, v1, z0, z1), rng, b, cols, 1.5);
  }
  if (o.bands) {
    const bc = o.band ?? shade(color, 0.3);
    for (const bz of o.bands) {
      if (!o.noLeft) iso.poly(iso.faceVQuad(v1, u0, u1, bz - 0.006, bz + 0.006), bc);
      if (!o.noRight) iso.poly(iso.faceUQuad(u1, v0, v1, bz - 0.006, bz + 0.006), shade(bc, -0.25));
    }
  }
  const wc = o.weather ?? 8;
  if (wc > 0) {
    if (!o.noLeft) weatherV(iso, rng, v1, u0, u1, z0, z1, wc, 0.1);
    if (!o.noRight) weatherU(iso, rng, u1, v0, v1, z0, z1, wc, 0.13);
  }
  const g = o.grimeH ?? 0.05;
  if (g > 0) grime(iso, u0, v0, u1, v1, z0, g, 0.24);
}

/** Flat roof terrace: slightly stained plaster, IPS patches and a darker drain corner. */
export function terrace(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, color = '#cfc2a8'): void {
  const pts = iso.topQuad(u0, v0, u1, v1, z);
  iso.poly(pts, color);
  iso.clipped(pts, () => {
    for (let i = 0; i < 5; i++) {
      const pu = u0 + rng() * (u1 - u0);
      const pv = v0 + rng() * (v1 - v0);
      iso.ellipse(pu, pv, z, 0.03 + rng() * 0.06, alpha(rng() < 0.6 ? '#6e6250' : '#fff4dc', 0.12 + rng() * 0.08));
    }
  });
  iso.speckle(pts, rng, Math.round(260 * (u1 - u0) * (v1 - v0) + 10), [alpha('#8a7c64', 0.4), alpha('#fff4dc', 0.4)], 1.3);
}

/** Parapet walls around a roof: 'back' draws the two far edges, 'front' the two near ones. */
export function parapet(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, h: number, t: number, color: string, part: 'back' | 'front', cap?: string): void {
  const m = mat(color, { right: -0.3 });
  const capM = cap ? mat(cap) : null;
  const run = (a0: number, b0: number, a1: number, b1: number) => {
    iso.box(a0, b0, a1, b1, z, z + h, m);
    if (capM) iso.box(a0 - 0.004, b0 - 0.004, a1 + 0.004, b1 + 0.004, z + h, z + h + 0.01, capM);
  };
  if (part === 'back') {
    run(u0, v0, u1, v0 + t);
    run(u0, v0 + t, u0 + t, v1);
  } else {
    run(u1 - t, v0 + t, u1, v1);
    run(u0 + t, v1 - t, u1 - t, v1);
  }
}

// ============================================================================
// Openings
// ============================================================================

export interface WinOpts {
  frame?: string;
  glass?: string;
  /** MS grille bar colour (vertical bars + a mid rail). */
  grille?: string;
  /** Colour of half-open painted shutters. */
  shutter?: string;
  /** Concrete sun-shade ledge above the window. */
  chhajja?: string;
  arch?: boolean;
}

/** Window on a +v face centred at uc (half width hw). */
export function winV(iso: Iso, v: number, uc: number, hw: number, z0: number, z1: number, o: WinOpts = {}): void {
  const glass = o.glass ?? '#35343f';
  if (o.arch) {
    if (o.frame) iso.archV(v, uc - hw - 0.008, uc + hw + 0.008, z0 - 0.008, z1 + 0.01, o.frame);
    iso.archV(v, uc - hw, uc + hw, z0, z1, glass);
  } else {
    if (o.frame) iso.poly(iso.faceVQuad(v, uc - hw - 0.008, uc + hw + 0.008, z0 - 0.009, z1 + 0.009), o.frame);
    iso.poly(iso.faceVQuad(v, uc - hw, uc + hw, z0, z1), glass);
    // a lit curtain in the upper half of some panes
    iso.poly(iso.faceVQuad(v, uc - hw * 0.8, uc - hw * 0.1, z0 + (z1 - z0) * 0.45, z1 - (z1 - z0) * 0.1), alpha('#f0d9a8', 0.18));
  }
  if (o.shutter) {
    const sw = hw * 0.55;
    iso.poly([[uc - hw, v, z0], [uc - hw - sw, v + sw * 0.9, z0], [uc - hw - sw, v + sw * 0.9, z1], [uc - hw, v, z1]], shade(o.shutter, 0.05), alpha(shade(o.shutter, -0.5), 0.6), 0.6);
    iso.poly([[uc + hw, v, z0], [uc + hw + sw * 0.3, v + sw, z0], [uc + hw + sw * 0.3, v + sw, z1], [uc + hw, v, z1]], shade(o.shutter, -0.12), alpha(shade(o.shutter, -0.5), 0.6), 0.6);
  }
  if (o.grille) {
    const n = Math.max(2, Math.round((hw * 2) / 0.014));
    for (let i = 1; i < n; i++) {
      const u = uc - hw + (i / n) * hw * 2;
      iso.line([u, v + 0.002, z0], [u, v + 0.002, z1 - (o.arch ? hw * 0.6 : 0)], o.grille, 0.7);
    }
    iso.line([uc - hw, v + 0.002, (z0 + z1) / 2], [uc + hw, v + 0.002, (z0 + z1) / 2], o.grille, 0.8);
  }
  iso.line([uc - hw, v + 0.002, z0], [uc + hw, v + 0.002, z0], alpha('#fff4dc', 0.5), 1);
  if (o.chhajja) iso.box(uc - hw - 0.016, v, uc + hw + 0.016, v + 0.03, z1 + 0.01, z1 + 0.02, mat(o.chhajja));
}

/** Window on a +u face centred at vc. */
export function winU(iso: Iso, u: number, vc: number, hw: number, z0: number, z1: number, o: WinOpts = {}): void {
  const glass = o.glass ?? '#2d2c36';
  if (o.arch) {
    if (o.frame) iso.archU(u, vc - hw - 0.008, vc + hw + 0.008, z0 - 0.008, z1 + 0.01, shade(o.frame, -0.22));
    iso.archU(u, vc - hw, vc + hw, z0, z1, glass);
  } else {
    if (o.frame) iso.poly(iso.faceUQuad(u, vc - hw - 0.008, vc + hw + 0.008, z0 - 0.009, z1 + 0.009), shade(o.frame, -0.22));
    iso.poly(iso.faceUQuad(u, vc - hw, vc + hw, z0, z1), glass);
    iso.poly(iso.faceUQuad(u, vc - hw * 0.7, vc, z0 + (z1 - z0) * 0.45, z1 - (z1 - z0) * 0.1), alpha('#e8cf98', 0.14));
  }
  if (o.shutter) {
    const sw = hw * 0.55;
    iso.poly([[u, vc + hw, z0], [u + sw, vc + hw + sw * 0.3, z0], [u + sw, vc + hw + sw * 0.3, z1], [u, vc + hw, z1]], shade(o.shutter, -0.2), alpha(shade(o.shutter, -0.5), 0.6), 0.6);
  }
  if (o.grille) {
    const n = Math.max(2, Math.round((hw * 2) / 0.014));
    for (let i = 1; i < n; i++) {
      const v = vc - hw + (i / n) * hw * 2;
      iso.line([u + 0.002, v, z0], [u + 0.002, v, z1 - (o.arch ? hw * 0.6 : 0)], shade(o.grille, -0.2), 0.7);
    }
    iso.line([u + 0.002, vc - hw, (z0 + z1) / 2], [u + 0.002, vc + hw, (z0 + z1) / 2], shade(o.grille, -0.2), 0.8);
  }
  iso.line([u + 0.002, vc - hw, z0], [u + 0.002, vc + hw, z0], alpha('#fff4dc', 0.3), 1);
  if (o.chhajja) iso.box(u, vc - hw - 0.016, u + 0.03, vc + hw + 0.016, z1 + 0.01, z1 + 0.02, mat(o.chhajja));
}

/** Door on a +v face (panelled leaves), optional arch and marigold garland. */
export function doorV(iso: Iso, v: number, uc: number, hw: number, z0: number, z1: number, color: string, o: { frame?: string; arch?: boolean; garland?: boolean } = {}): void {
  if (o.arch) {
    if (o.frame) iso.archV(v, uc - hw - 0.012, uc + hw + 0.012, z0, z1 + 0.014, o.frame);
    iso.archV(v, uc - hw, uc + hw, z0, z1, color);
  } else {
    if (o.frame) iso.poly(iso.faceVQuad(v, uc - hw - 0.01, uc + hw + 0.01, z0, z1 + 0.012), o.frame);
    iso.poly(iso.faceVQuad(v, uc - hw, uc + hw, z0, z1), color);
  }
  const top = o.arch ? z1 - hw : z1;
  iso.line([uc, v + 0.002, z0], [uc, v + 0.002, top], alpha(shade(color, -0.6), 0.8), 0.8);
  for (const f of [0.3, 0.62]) {
    const zz = z0 + (top - z0) * f;
    iso.poly(iso.faceVQuad(v + 0.002, uc - hw * 0.8, uc - hw * 0.15, zz, zz + (top - z0) * 0.25), alpha(shade(color, 0.2), 0.5));
    iso.poly(iso.faceVQuad(v + 0.002, uc + hw * 0.15, uc + hw * 0.8, zz, zz + (top - z0) * 0.25), alpha(shade(color, 0.2), 0.5));
  }
  if (o.garland) garlandV(iso, v + 0.004, uc - hw - 0.01, uc + hw + 0.01, (o.arch ? z1 : z1) + 0.004);
}

/** Door on a +u face. */
export function doorU(iso: Iso, u: number, vc: number, hw: number, z0: number, z1: number, color: string): void {
  iso.poly(iso.faceUQuad(u, vc - hw, vc + hw, z0, z1), shade(color, -0.2));
  iso.line([u + 0.002, vc, z0], [u + 0.002, vc, z1], alpha(shade(color, -0.6), 0.8), 0.8);
}

/** Marigold (genda) garland with a mango-leaf toran swag, on a +v face. */
export function garlandV(iso: Iso, v: number, u0: number, u1: number, z: number): void {
  const n = 9;
  const pts: P3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([u0 + (u1 - u0) * t, v, z - Math.sin(t * Math.PI) * 0.018]);
  }
  iso.polyline(pts, '#3f6b22', 1.2);
  pts.forEach((p, i) => iso.ellipse(p[0], p[1], p[2] - 0.003, 0.007, i % 2 ? C.marigold : '#e8641c'));
  iso.line([u0, v, z], [u0, v, z - 0.05], '#e8641c', 1.4);
  iso.line([u1, v, z], [u1, v, z - 0.05], '#e8641c', 1.4);
}

/** Rolling metal shop shutter on a +v face, with a hand-painted board above. */
export function shutterV(iso: Iso, v: number, u0: number, u1: number, z0: number, z1: number, color: string, board: string, half = false): void {
  iso.poly(iso.faceVQuad(v, u0, u1, z0, z1), '#2e2a2a');
  const zs = half ? z0 + (z1 - z0) * 0.55 : z0;
  iso.poly(iso.faceVQuad(v + 0.001, u0, u1, zs, z1), color);
  iso.clipped(iso.faceVQuad(v + 0.001, u0, u1, zs, z1), () => {
    for (let z = zs + 0.008; z < z1; z += 0.009) iso.line([u0, v + 0.001, z], [u1, v + 0.001, z], alpha(shade(color, -0.35), 0.55), 0.6);
  });
  if (half) {
    // goods and a lit interior under the half-open shutter
    iso.poly(iso.faceVQuad(v + 0.001, u0, u1, z0, zs), '#5a4632');
    iso.poly(iso.faceVQuad(v + 0.001, u0 + 0.01, u1 - 0.01, zs - 0.02, zs), alpha('#ffd58a', 0.35));
  }
  // signboard
  iso.box(u0 - 0.01, v, u1 + 0.01, v + 0.012, z1 + 0.008, z1 + 0.055, mat(board));
  iso.poly(iso.faceVQuad(v + 0.0125, u0 + 0.005, u0 + (u1 - u0) * 0.62, z1 + 0.02, z1 + 0.04), alpha('#fff6de', 0.9));
  iso.poly(iso.faceVQuad(v + 0.0125, u0 + (u1 - u0) * 0.7, u1 - 0.005, z1 + 0.018, z1 + 0.042), alpha(shade(board, -0.55), 0.85));
}

/** Balcony on a +v face: slab, solid or grilled rail, optional laundry. */
export function balconyV(iso: Iso, rng: Rng, v: number, u0: number, u1: number, z: number, d: number, slab: string, rail: string, o: { solid?: string; laundry?: boolean; plants?: boolean; cage?: boolean } = {}): void {
  iso.poly(iso.faceVQuad(v, u0, u1, z - 0.045, z - 0.012), alpha('#2a1c14', 0.25));
  iso.box(u0, v, u1, v + d, z - 0.014, z, mat(slab));
  if (o.plants) {
    for (let u = u0 + 0.02; u < u1 - 0.015; u += 0.045) {
      iso.box(u, v + d - 0.02, u + 0.014, v + d - 0.006, z, z + 0.014, mat('#b86b45'), { edges: false });
      iso.blob(iso.sx(u + 0.007, v + d - 0.013), iso.sy(u + 0.007, v + d - 0.013, z + 0.03), iso.T * 0.011, '#4f8a2e', 0.3);
    }
  }
  const H = o.cage ? 0.11 : 0.05;
  if (o.solid) {
    iso.box(u1 - 0.008, v, u1, v + d, z, z + 0.045, mat(o.solid), { edges: false });
    iso.box(u0, v + d - 0.008, u1, v + d, z, z + 0.045, mat(o.solid));
  } else {
    iso.line([u1, v, z + H], [u1, v + d, z + H], shade(rail, -0.25), 1);
    for (let t = 0.012; t < d; t += 0.012) iso.line([u1, v + t, z], [u1, v + t, z + H], shade(rail, -0.25), 0.6);
  }
  if (o.laundry) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = u0 + 0.01 + rng() * (u1 - u0 - 0.05);
      const col = LAUNDRY[Math.floor(rng() * LAUNDRY.length)];
      const hh = 0.03 + rng() * 0.03;
      iso.poly(iso.faceVQuad(v + d + 0.003, a, a + 0.02 + rng() * 0.02, z + 0.05 - hh, z + 0.05), col, alpha(shade(col, -0.5), 0.5), 0.5);
    }
  }
  if (!o.solid) {
    iso.line([u0, v + d, z + H], [u1, v + d, z + H], rail, 1.2);
    iso.line([u0, v + d, z + H * 0.35], [u1, v + d, z + H * 0.35], alpha(rail, 0.7), 0.6);
    const step = o.cage ? 0.01 : 0.013;
    for (let u = u0 + step * 0.5; u < u1; u += step) iso.line([u, v + d, z], [u, v + d, z + H], alpha(rail, 0.85), 0.55);
    if (o.cage) iso.line([u0, v + d, z + H * 0.7], [u1, v + d, z + H * 0.7], rail, 0.7);
    iso.line([u0, v, z + H], [u0, v + d, z + H], rail, 1);
  }
}

/** Balcony on a +u face. */
export function balconyU(iso: Iso, rng: Rng, u: number, v0: number, v1: number, z: number, d: number, slab: string, rail: string, o: { solid?: string; laundry?: boolean; cage?: boolean } = {}): void {
  iso.poly(iso.faceUQuad(u, v0, v1, z - 0.045, z - 0.012), alpha('#2a1c14', 0.28));
  iso.box(u, v0, u + d, v1, z - 0.014, z, mat(slab));
  const H = o.cage ? 0.11 : 0.05;
  if (o.solid) {
    iso.box(u, v1 - 0.008, u + d, v1, z, z + 0.045, mat(o.solid), { edges: false });
    iso.box(u + d - 0.008, v0, u + d, v1, z, z + 0.045, mat(o.solid));
  } else {
    iso.line([u, v1, z + H], [u + d, v1, z + H], rail, 1);
    for (let t = 0.012; t < d; t += 0.012) iso.line([u + t, v1, z], [u + t, v1, z + H], alpha(rail, 0.85), 0.6);
  }
  if (o.laundry) {
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const a = v0 + 0.01 + rng() * (v1 - v0 - 0.05);
      const col = LAUNDRY[Math.floor(rng() * LAUNDRY.length)];
      const hh = 0.03 + rng() * 0.03;
      iso.poly(iso.faceUQuad(u + d + 0.003, a, a + 0.02 + rng() * 0.02, z + 0.05 - hh, z + 0.05), shade(col, -0.18), alpha(shade(col, -0.5), 0.5), 0.5);
    }
  }
  if (!o.solid) {
    const r2 = shade(rail, -0.2);
    iso.line([u + d, v0, z + H], [u + d, v1, z + H], r2, 1.2);
    iso.line([u + d, v0, z + H * 0.35], [u + d, v1, z + H * 0.35], alpha(r2, 0.7), 0.6);
    const step = o.cage ? 0.01 : 0.013;
    for (let v = v0 + step * 0.5; v < v1; v += step) iso.line([u + d, v, z], [u + d, v, z + H], alpha(r2, 0.85), 0.55);
    if (o.cage) iso.line([u + d, v0, z + H * 0.7], [u + d, v1, z + H * 0.7], r2, 0.7);
  }
}

// ============================================================================
// Rooftop and wall clutter
// ============================================================================

/** Black Sintex-style ribbed water tank (optionally on a small brick stand). */
export function sintex(iso: Iso, u: number, v: number, z: number, r = 0.04, h = 0.075, stand = 0): void {
  if (stand > 0) {
    iso.aoRect(u - r, v - r, u + r, v + r, z, 0.02, 0.3);
    iso.box(u - r * 0.9, v - r * 0.9, u + r * 0.9, v + r * 0.9, z, z + stand, mat(C.brick));
  }
  const zb = z + stand;
  drum(iso, u, v, zb, r, h, '#2a2b30');
  iso.ellipse(u, v, zb + h + 0.003, r * 0.35, '#3a3b42', alpha('#111', 0.6), 0.6);
  // a pipe dropping from the tank
  iso.line([u + r * 0.7, v + r * 0.5, zb + h * 0.2], [u + r * 0.7, v + r * 0.5, z], alpha('#e6e2d6', 0.9), 1.1);
}

/** DTH satellite dish on a short pole. */
export function dish(iso: Iso, u: number, v: number, z: number, r = 0.028, color = '#e6e3dc'): void {
  const zc = z + 0.05;
  iso.line([u, v, z], [u, v, zc], '#555', 1.2);
  const [x, y] = iso.pt(u, v, zc);
  const { ctx } = iso;
  const rx = r * iso.T * 0.72;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.62, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = alpha('#4a4a4a', 0.8);
  ctx.lineWidth = iso.px;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.15, y + rx * 0.08, rx * 0.7, rx * 0.4, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = alpha(shade(color, -0.25), 0.6);
  ctx.fill();
  iso.line([u, v, zc], [u - r * 0.9, v + r * 0.9, zc + r * 0.7], '#666', 0.9);
}

/** Rebar left sticking up from a column for the next storey (hope for the future). */
export function rebar(iso: Iso, u: number, v: number, z: number, h = 0.07): void {
  iso.box(u - 0.012, v - 0.012, u + 0.012, v + 0.012, z, z + 0.012, mat(C.concrete), { edges: false });
  for (const [du, dv] of [[-0.006, -0.006], [0.006, -0.006], [-0.006, 0.006], [0.006, 0.006]] as [number, number][]) {
    iso.line([u + du, v + dv, z + 0.01], [u + du * 1.8, v + dv * 1.8, z + h], alpha('#7a4a2a', 0.95), 0.9);
  }
}

/** Outdoor AC unit on a +u face (white box with a fan grille). */
export function acU(iso: Iso, u: number, vc: number, z: number): void {
  iso.box(u, vc - 0.028, u + 0.024, vc + 0.028, z, z + 0.04, mat('#e2dfd8', { right: -0.18 }));
  const pts: P3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push([u + 0.0245, vc + 0.004 + Math.cos(a) * 0.014, z + 0.02 + Math.sin(a) * 0.014]);
  }
  iso.poly(pts, '#5d5f64', alpha('#2a2a2e', 0.7), 0.5);
}

/** Outdoor AC unit on a +v face. */
export function acV(iso: Iso, v: number, uc: number, z: number): void {
  iso.box(uc - 0.028, v, uc + 0.028, v + 0.024, z, z + 0.04, mat('#e8e5de', { right: -0.18 }));
  const pts: P3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push([uc - 0.004 + Math.cos(a) * 0.014, v + 0.0245, z + 0.02 + Math.sin(a) * 0.014]);
  }
  iso.poly(pts, '#62646a', alpha('#2a2a2e', 0.7), 0.5);
}

/** Mumty: the stair-head room on a flat roof, with a door on its +v face and a thin roof slab. Returns its roof z. */
export function mumty(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, h: number, color: string, door: string): number {
  plasterBox(iso, rng, u0, v0, u1, v1, z, z + h, color, { weather: 5, grimeH: 0.03, speck: 0.7 });
  const dw = Math.min(0.035, (u1 - u0) * 0.28);
  const uc = u0 + (u1 - u0) * 0.42;
  iso.poly(iso.faceVQuad(v1, uc - dw, uc + dw, z, z + h * 0.72), door, alpha('#1e1a14', 0.6), 0.7);
  iso.box(u0 - 0.012, v0 - 0.012, u1 + 0.018, v1 + 0.018, z + h, z + h + 0.012, mat(shade(color, 0.05)));
  return z + h + 0.012;
}

/** Terracotta pot with a shrub or a tulsi plant. */
export function pot(iso: Iso, rng: Rng, u: number, v: number, z: number, s = 0.035, flowers?: string): void {
  iso.box(u - s * 0.5, v - s * 0.5, u + s * 0.5, v + s * 0.5, z, z + s * 0.8, mat('#b86b45'));
  iso.tree(u, v, z + s * 0.8, s * 1.05, rng, 'shrub');
  if (flowers) {
    const [cx, cy] = iso.pt(u, v, z + s * 1.6);
    for (let i = 0; i < 5; i++) {
      iso.ctx.fillStyle = i % 2 ? flowers : shade(flowers, 0.2);
      iso.ctx.beginPath();
      iso.ctx.arc(cx + (rng() - 0.5) * s * iso.T * 0.9, cy + (rng() - 0.5) * s * iso.T * 0.5, iso.px * 2.2, 0, Math.PI * 2);
      iso.ctx.fill();
    }
  }
}

/** Two-wheeler (scooter / motorcycle) parked along u. */
export function scooter(iso: Iso, u: number, v: number, z: number, color: string): void {
  iso.aoRect(u, v, u + 0.075, v + 0.02, z, 0.015, 0.35);
  iso.box(u + 0.004, v + 0.006, u + 0.016, v + 0.014, z, z + 0.018, mat('#1e1e22'), { edges: false });
  iso.box(u + 0.06, v + 0.006, u + 0.072, v + 0.014, z, z + 0.018, mat('#1e1e22'), { edges: false });
  iso.box(u + 0.012, v + 0.002, u + 0.066, v + 0.018, z + 0.01, z + 0.03, mat(color, { top: 0.25 }));
  iso.box(u + 0.022, v + 0.004, u + 0.05, v + 0.016, z + 0.03, z + 0.037, mat('#26262a'));
  iso.line([u + 0.064, v + 0.01, z + 0.03], [u + 0.07, v + 0.01, z + 0.05], '#333', 1);
  iso.line([u + 0.07, v - 0.004, z + 0.05], [u + 0.07, v + 0.024, z + 0.05], '#333', 1.1);
}

/** A small hatchback/sedan parked along u (length 0.19) or along v. */
export function car(iso: Iso, u: number, v: number, z: number, color: string, alongV = false): void {
  const L = 0.19;
  const W = 0.09;
  const [du, dv] = alongV ? [W, L] : [L, W];
  iso.aoRect(u, v, u + du, v + dv, z, 0.025, 0.45);
  const bm = mat(color, { top: 0.22, right: -0.32 });
  iso.box(u, v, u + du, v + dv, z + 0.008, z + 0.038, bm);
  // cabin
  const [cu0, cv0, cu1, cv1] = alongV ? [u + 0.008, v + 0.045, u + du - 0.008, v + 0.14] : [u + 0.045, v + 0.008, u + 0.14, v + dv - 0.008];
  iso.box(cu0, cv0, cu1, cv1, z + 0.038, z + 0.066, { top: shade(color, 0.18), left: '#3a4552', right: '#2a323c', line: alpha('#1a1a1a', 0.5) });
  iso.line([cu0, cv1, z + 0.064], [cu1, cv1, z + 0.064], alpha('#cfe3ee', 0.5), 0.7);
  iso.poly(iso.faceVQuad(v + dv, u + 0.004, u + du - 0.004, z + 0.008, z + 0.014), alpha('#111', 0.5));
  iso.poly(iso.faceUQuad(u + du, v + 0.004, v + dv - 0.004, z + 0.008, z + 0.014), alpha('#111', 0.6));
  // lights
  if (!alongV) {
    iso.poly(iso.faceUQuad(u + du + 0.001, v + 0.01, v + 0.022, z + 0.026, z + 0.033), '#f3e7b0');
    iso.poly(iso.faceUQuad(u + du + 0.001, v + dv - 0.022, v + dv - 0.01, z + 0.026, z + 0.033), '#f3e7b0');
  } else {
    iso.poly(iso.faceVQuad(v + dv + 0.001, u + 0.01, u + 0.022, z + 0.026, z + 0.033), '#f6ebb6');
    iso.poly(iso.faceVQuad(v + dv + 0.001, u + du - 0.022, u + du - 0.01, z + 0.026, z + 0.033), '#f6ebb6');
  }
}

/** Downpipe running along a +u face (grey PVC). */
export function downpipeU(iso: Iso, u: number, v: number, z0: number, z1: number): void {
  iso.line([u + 0.006, v, z0], [u + 0.006, v, z1], alpha('#3a3a3a', 0.6), 2.4);
  iso.line([u + 0.006, v, z0], [u + 0.006, v, z1], '#9da3a6', 1.5);
}

/** Downpipe running along a +v face. */
export function downpipeV(iso: Iso, v: number, u: number, z0: number, z1: number): void {
  iso.line([u, v + 0.006, z0], [u, v + 0.006, z1], alpha('#3a3a3a', 0.6), 2.4);
  iso.line([u, v + 0.006, z0], [u, v + 0.006, z1], '#a8aeb1', 1.5);
}

/** Sagging bundle of electric / cable wires between two points. */
export function wires(iso: Iso, a: P3, b: P3, n = 3): void {
  for (let k = 0; k < n; k++) {
    const pts: P3[] = [];
    const sag = 0.03 + k * 0.012;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag - k * 0.004]);
    }
    iso.polyline(pts, alpha('#1f1b1a', 0.65), 0.6);
  }
}
