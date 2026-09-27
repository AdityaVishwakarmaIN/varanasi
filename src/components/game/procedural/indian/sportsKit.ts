/**
 * Shared props for the Indian sports / recreation art (./sports.ts): dusty maidan plots, painted
 * boundary walls, spectators, bunting, chai stalls, shamiana tents, galleries, floodlights, goals.
 * All coordinates are tile units (u, v, z) as in ../isoPainter.
 */
import { Iso, alpha, mat, shade, type P3 } from '../isoPainter';
import { C, grime, slab, weatherU, weatherV } from '../varanasiSprites';

export type Rng = () => number;

/** Bright but not neon shirt / sari colours for crowds. */
export const CROWD = ['#e4572e', '#f2c14e', '#3a86c8', '#f1ebdd', '#b44ca0', '#3aa36b', '#e07a9a', '#f39b1d', '#2f4f8f', '#d9d2c2'] as const;
export const SKIN = ['#8a5a3c', '#a06a45', '#7a4c32', '#b57a52'] as const;
export const BUNTING = ['#f39b1d', '#e4572e', '#f2c14e', '#3aa36b', '#f1ebdd', '#b44ca0', '#3a86c8'] as const;
export const LIME = 'rgba(250,246,232,0.92)';

/** Dusty maidan plot: packed earth slab with grit, worn grass tufts round the edge. */
export function maidan(iso: Iso, rng: Rng, z: number, earth = '#c4a67c', inset = 0.02): void {
  slab(iso, rng, inset, z, earth, C.earthDark, [shade(earth, -0.08), shade(earth, 0.1), shade(earth, -0.16), alpha('#6f8a3a', 0.55)]);
}

/** Irregular dusty/worn patch (ellipse cluster) on the ground. */
export function dustPatch(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number, color: string, count = 5): void {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * r * 0.6;
    iso.ellipse(u + Math.cos(a) * d, v + Math.sin(a) * d, z, r * (0.35 + rng() * 0.35), color);
  }
}

/** Grass tufts scattered in a rectangle (edges of a field). */
export function tufts(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, count: number): void {
  const { ctx } = iso;
  for (let i = 0; i < count; i++) {
    const [x, y] = iso.pt(u0 + rng() * (u1 - u0), v0 + rng() * (v1 - v0), z);
    const s = (2 + rng() * 2.5) * iso.px;
    ctx.fillStyle = rng() < 0.5 ? '#6f8f36' : '#86a847';
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s * 0.3, y - s * 1.3);
    ctx.lineTo(x, y - s * 0.4);
    ctx.lineTo(x + s * 0.4, y - s * 1.5);
    ctx.lineTo(x + s, y);
    ctx.closePath();
    ctx.fill();
  }
}

/** A rectangle outline of lime/paint lines on the ground. */
export function rectLines(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, color = LIME, lw = 1.6): void {
  iso.poly(iso.topQuad(u0, v0, u1, v1, z), null, color, lw);
}

/** Standing person (screen-space primitives; ~0.075 tile tall at s = 1). */
export function person(iso: Iso, rng: Rng, u: number, v: number, z: number, shirt: string, s = 1, legs = '#2f2a33'): void {
  const { ctx, px } = iso;
  const H = 0.075 * s;
  iso.ellipse(u + 0.012 * s, v - 0.004 * s, z, 0.016 * s, 'rgba(40,24,14,0.28)');
  const [x, y0] = iso.pt(u, v, z);
  const hpx = H * iso.T * 0.5657;
  const w = 0.011 * s * iso.T;
  const skin = SKIN[Math.floor(rng() * SKIN.length)];
  // legs
  ctx.fillStyle = legs;
  ctx.fillRect(x - w * 0.8, y0 - hpx * 0.45, w * 0.7, hpx * 0.45);
  ctx.fillRect(x + w * 0.1, y0 - hpx * 0.45, w * 0.7, hpx * 0.45);
  // torso: lit left half, shaded right half, dark rim
  const ty = y0 - hpx * 0.82;
  const th = hpx * 0.4;
  ctx.fillStyle = alpha(shade(shirt, -0.6), 0.7);
  ctx.fillRect(x - w - px * 0.8, ty - px * 0.8, w * 2 + px * 1.6, th + px * 1.6);
  ctx.fillStyle = shade(shirt, 0.08);
  ctx.fillRect(x - w, ty, w, th);
  ctx.fillStyle = shade(shirt, -0.22);
  ctx.fillRect(x, ty, w, th);
  // head
  const hr = w * 0.78;
  ctx.beginPath();
  ctx.arc(x, ty - hr * 0.9, hr + px * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30,20,14,0.6)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, ty - hr * 0.9, hr, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, ty - hr * 1.1, hr * 0.95, Math.PI, Math.PI * 2);
  ctx.fillStyle = '#1e1a18';
  ctx.fill();
}

/** A seated spectator: head and shoulders only (for galleries and mats). */
export function sitter(iso: Iso, rng: Rng, u: number, v: number, z: number, s = 1): void {
  const { ctx, px } = iso;
  const [x, y] = iso.pt(u, v, z);
  const w = 0.011 * s * iso.T;
  const h = 0.03 * s * iso.T * 0.5657;
  const shirt = CROWD[Math.floor(rng() * CROWD.length)];
  ctx.fillStyle = alpha(shade(shirt, -0.6), 0.7);
  ctx.fillRect(x - w - px * 0.7, y - h - px * 0.7, w * 2 + px * 1.4, h + px * 0.7);
  ctx.fillStyle = shade(shirt, 0.06);
  ctx.fillRect(x - w, y - h, w, h);
  ctx.fillStyle = shade(shirt, -0.2);
  ctx.fillRect(x, y - h, w, h);
  const hr = w * 0.75;
  ctx.beginPath();
  ctx.arc(x, y - h - hr * 0.8, hr, 0, Math.PI * 2);
  ctx.fillStyle = SKIN[Math.floor(rng() * SKIN.length)];
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - h - hr, hr * 0.92, Math.PI, Math.PI * 2);
  ctx.fillStyle = rng() < 0.2 ? '#d8d2c4' : '#1e1a18';
  ctx.fill();
}

/** Sagging string of triangular festival flags between two world points. */
export function bunting(iso: Iso, a: P3, b: P3, flags: number, colors: readonly string[] = BUNTING, sag = 0.03): void {
  const at = (t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag];
  const pts: P3[] = [];
  for (let i = 0; i <= 12; i++) pts.push(at(i / 12));
  iso.polyline(pts, alpha('#3a3024', 0.75), 0.7);
  for (let i = 0; i < flags; i++) {
    const t0 = (i + 0.15) / flags;
    const t1 = (i + 0.85) / flags;
    const p = at(t0);
    const q = at(t1);
    const m = at((t0 + t1) / 2);
    const col = colors[i % colors.length];
    iso.poly([p, q, [m[0], m[1], m[2] - 0.028]], col, alpha(shade(col, -0.5), 0.5), 0.5);
  }
}

/** Plain bamboo / GI pole. */
export function pole(iso: Iso, u: number, v: number, z: number, h: number, color = '#6b4a2a', lw = 1.6): void {
  iso.line([u, v, z], [u, v, z + h], color, lw);
}

/**
 * Painted boundary wall along one back edge (lime-wash with a coloured dado band and hand-painted
 * wall ads as abstract text blocks). along 'u': wall at v ∈ [fixed, fixed + t] (lit +v face shows);
 * along 'v': wall at u ∈ [fixed, fixed + t] (shaded +u face shows).
 */
export function paintedWall(
  iso: Iso,
  rng: Rng,
  along: 'u' | 'v',
  fixed: number,
  a0: number,
  a1: number,
  z: number,
  h: number,
  opts: { wall?: string; band?: string; ads?: number; t?: number } = {},
): void {
  const t = opts.t ?? 0.03;
  const wall = opts.wall ?? C.whitewash;
  const band = opts.band ?? '#b8563a';
  const m = mat(wall);
  const cap = mat(shade(wall, -0.05));
  const adCols = ['#f2c14e', '#3a86c8', '#e4572e', '#3aa36b', '#f1ebdd'];
  if (along === 'u') {
    iso.aoRect(a0, fixed, a1, fixed + t, z, 0.04, 0.3);
    iso.box(a0, fixed, a1, fixed + t, z, z + h, m);
    iso.poly(iso.faceVQuad(fixed + t, a0, a1, z, z + h * 0.3), band);
    const n = opts.ads ?? 0;
    for (let i = 0; i < n; i++) {
      const span = (a1 - a0) / n;
      const u0 = a0 + span * i + span * 0.15;
      const u1 = a0 + span * (i + 1) - span * 0.15;
      const col = adCols[Math.floor(rng() * adCols.length)];
      iso.poly(iso.faceVQuad(fixed + t, u0, u1, z + h * 0.36, z + h * 0.92), col);
      const ink = col === '#f2c14e' || col === '#f1ebdd' ? '#b0302a' : '#fff4dc';
      iso.poly(iso.faceVQuad(fixed + t, u0 + (u1 - u0) * 0.1, u1 - (u1 - u0) * 0.2, z + h * 0.7, z + h * 0.82), alpha(ink, 0.9));
      iso.poly(iso.faceVQuad(fixed + t, u0 + (u1 - u0) * 0.1, u1 - (u1 - u0) * 0.45, z + h * 0.48, z + h * 0.58), alpha(ink, 0.7));
    }
    weatherV(iso, rng, fixed + t, a0, a1, z, z + h, Math.round((a1 - a0) * 20), 0.14);
    iso.box(a0 - 0.004, fixed - 0.004, a1 + 0.004, fixed + t + 0.004, z + h, z + h + 0.01, cap);
  } else {
    iso.aoRect(fixed, a0, fixed + t, a1, z, 0.04, 0.3);
    iso.box(fixed, a0, fixed + t, a1, z, z + h, m);
    iso.poly(iso.faceUQuad(fixed + t, a0, a1, z, z + h * 0.3), shade(band, -0.25));
    const n = opts.ads ?? 0;
    for (let i = 0; i < n; i++) {
      const span = (a1 - a0) / n;
      const v0 = a0 + span * i + span * 0.15;
      const v1 = a0 + span * (i + 1) - span * 0.15;
      const col = adCols[Math.floor(rng() * adCols.length)];
      iso.poly(iso.faceUQuad(fixed + t, v0, v1, z + h * 0.36, z + h * 0.92), shade(col, -0.22));
      const ink = col === '#f2c14e' || col === '#f1ebdd' ? '#8c2a24' : '#e8dcc2';
      iso.poly(iso.faceUQuad(fixed + t, v0 + (v1 - v0) * 0.1, v1 - (v1 - v0) * 0.2, z + h * 0.7, z + h * 0.82), alpha(ink, 0.85));
      iso.poly(iso.faceUQuad(fixed + t, v0 + (v1 - v0) * 0.1, v1 - (v1 - v0) * 0.45, z + h * 0.48, z + h * 0.58), alpha(ink, 0.65));
    }
    weatherU(iso, rng, fixed + t, a0, a1, z, z + h, Math.round((a1 - a0) * 20), 0.16);
    iso.box(fixed - 0.004, a0 - 0.004, fixed + t + 0.004, a1 + 0.004, z + h, z + h + 0.01, cap);
  }
}

/** Road-side kerb stones painted alternately (black/yellow or red/white) along a front edge. */
export function paintedKerb(iso: Iso, along: 'u' | 'v', fixed: number, a0: number, a1: number, z: number, c1 = '#f1ebdd', c2 = '#c0392b'): void {
  const step = 0.06;
  let k = 0;
  for (let a = a0; a < a1 - 0.01; a += step, k++) {
    const b = Math.min(a + step - 0.006, a1);
    const m = mat(k % 2 ? c2 : c1, { right: -0.3 });
    if (along === 'u') iso.box(a, fixed - 0.02, b, fixed, z, z + 0.022, m, { edges: false });
    else iso.box(fixed - 0.02, a, fixed, b, z, z + 0.022, m, { edges: false });
  }
}

/** Chai stall: wooden counter with a kettle on a stove under a slanted tin sheet, bench in front. */
export function chaiStall(iso: Iso, rng: Rng, u: number, v: number, z: number, s = 1, sheet: string = C.tin): void {
  const W = 0.13 * s;
  const D = 0.08 * s;
  iso.aoRect(u, v, u + W, v + D, z, 0.03, 0.35);
  // back poles
  pole(iso, u, v, z, 0.12 * s, '#5a3d25', 1.3);
  pole(iso, u + W, v, z, 0.12 * s, '#5a3d25', 1.3);
  // counter
  iso.box(u + 0.01 * s, v + 0.02 * s, u + W - 0.01 * s, v + D, z, z + 0.045 * s, mat('#8a5a34', { top: 0.12 }));
  iso.poly(iso.faceVQuad(v + D, u + 0.02 * s, u + W - 0.02 * s, z + 0.012 * s, z + 0.032 * s), '#f2c14e');
  iso.poly(iso.faceVQuad(v + D, u + 0.03 * s, u + W * 0.6, z + 0.018 * s, z + 0.026 * s), alpha('#b0302a', 0.9));
  // stove + kettle + glasses
  iso.cylinder(u + W * 0.3, v + D * 0.55, 0.014 * s, z + 0.045 * s, z + 0.055 * s, '#3a3a3a');
  iso.lathe(u + W * 0.3, v + D * 0.55, z + 0.055 * s, [[0, 0.012 * s], [0.012 * s, 0.014 * s], [0.02 * s, 0.006 * s], [0.024 * s, 0]], () => '#c9ccd0', { outline: true });
  for (let i = 0; i < 3; i++) iso.ellipse(u + W * (0.55 + i * 0.1), v + D * 0.6, z + 0.047 * s, 0.005 * s, alpha('#f1e4c8', 0.9), '#8a6a42', 0.6);
  // front poles + tin sheet
  pole(iso, u, v + D, z, 0.1 * s, '#5a3d25', 1.3);
  pole(iso, u + W, v + D, z, 0.1 * s, '#5a3d25', 1.3);
  const o = 0.015 * s;
  const roof: P3[] = [
    [u - o, v - o, z + 0.125 * s],
    [u + W + o, v - o, z + 0.125 * s],
    [u + W + o, v + D + o * 2, z + 0.095 * s],
    [u - o, v + D + o * 2, z + 0.095 * s],
  ];
  iso.poly([roof[3], roof[2], [roof[2][0], roof[2][1], roof[2][2] - 0.008 * s], [roof[3][0], roof[3][1], roof[3][2] - 0.008 * s]], shade(sheet, -0.4));
  iso.poly(roof, shade(sheet, 0.05), alpha('#1e1a14', 0.5), 0.8);
  iso.clipped(roof, () => {
    for (let a = u - o; a < u + W + o; a += 0.014 * s) iso.line([a, v - o, z + 0.125 * s], [a, v + D + o * 2, z + 0.095 * s], alpha(shade(sheet, -0.3), 0.5), 0.6);
    iso.ellipse(u + W * 0.7, v + D * 0.4, z + 0.113 * s, 0.02 * s, alpha(C.rust, 0.5));
  });
  // bench (patla) in front
  iso.box(u + 0.01 * s, v + D + 0.03 * s, u + W * 0.8, v + D + 0.05 * s, z, z + 0.02 * s, mat(C.wood));
  person(iso, rng, u + W * 0.25, v + D + 0.085 * s, z, CROWD[Math.floor(rng() * CROWD.length)], 0.85 * s);
}

/** Shamiana: flat striped canopy on bamboo poles with a scalloped valance (open on the visible sides). */
export function shamiana(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, h: number, c1 = '#c0392b', c2 = '#f2c14e'): void {
  pole(iso, u0, v0, z, h, '#6b4a2a', 1.5);
  pole(iso, u1, v0, z, h, '#6b4a2a', 1.5);
  pole(iso, u0, v1, z, h, '#6b4a2a', 1.5);
  const zt = z + h;
  const top = iso.topQuad(u0, v0, u1, v1, zt);
  // ground shade under the canopy
  iso.poly(iso.topQuad(u0 + 0.03, v0 - 0.01, u1 + 0.08, v1 - 0.02, z + 0.001), 'rgba(40,24,14,0.2)');
  iso.poly(top, c1);
  iso.clipped(top, () => {
    const n = 7;
    for (let i = 0; i < n; i += 2) iso.poly(iso.topQuad(u0 + ((u1 - u0) * i) / n, v0, u0 + ((u1 - u0) * (i + 1)) / n, v1, zt), c2);
  });
  iso.poly(top, alpha('#fff4dc', 0.08), alpha('#3a1a10', 0.5), 0.8);
  // scalloped valance on both visible sides
  const scal = (along: 'u' | 'v') => {
    const n = Math.max(3, Math.round(((along === 'u' ? u1 - u0 : v1 - v0) / 0.04)));
    for (let i = 0; i < n; i++) {
      const a = i / n;
      const b = (i + 1) / n;
      const col = i % 2 ? c1 : c2;
      if (along === 'u') {
        const ua = u0 + (u1 - u0) * a;
        const ub = u0 + (u1 - u0) * b;
        iso.poly([[ua, v1, zt], [ub, v1, zt], [ub, v1, zt - 0.02], [(ua + ub) / 2, v1, zt - 0.03], [ua, v1, zt - 0.02]], col, alpha('#3a1a10', 0.35), 0.5);
      } else {
        const va = v0 + (v1 - v0) * a;
        const vb = v0 + (v1 - v0) * b;
        iso.poly([[u1, va, zt], [u1, vb, zt], [u1, vb, zt - 0.02], [u1, (va + vb) / 2, zt - 0.03], [u1, va, zt - 0.02]], shade(col, -0.25), alpha('#3a1a10', 0.35), 0.5);
      }
    }
  };
  scal('v');
  scal('u');
  pole(iso, u1, v1, z, h - 0.02, '#6b4a2a', 1.5);
}

/**
 * Concrete gallery (sitting steps) along a back edge, rising away from the field, filled with
 * spectators. along 'u': rows run along u, rising towards −v (visible risers lit);
 * along 'v': rows run along v, rising towards −u.
 */
export function gallery(
  iso: Iso,
  rng: Rng,
  along: 'u' | 'v',
  a0: number,
  a1: number,
  back: number,
  rows: number,
  z: number,
  opts: { depth?: number; rise?: number; fill?: number; paint?: readonly string[]; s?: number } = {},
): number {
  const d = opts.depth ?? 0.06;
  const r = opts.rise ?? 0.035;
  const conc = C.concrete;
  const paint = opts.paint;
  const fill = opts.fill ?? 0.7;
  const s = opts.s ?? 1;
  const front = back + rows * d;
  if (along === 'u') iso.aoRect(a0, back, a1, front, z, 0.05, 0.35);
  else iso.aoRect(back, a0, front, a1, z, 0.05, 0.35);
  for (let i = 0; i < rows; i++) {
    const zt = z + (rows - i) * r;
    const b0 = back + i * d;
    const b1 = b0 + d;
    const col = paint ? paint[i % paint.length] : conc;
    const m = mat(col, { right: -0.3 });
    if (along === 'u') {
      iso.box(a0, b0, a1, b1, z, zt, m, { noLeft: false });
      iso.line([a0, b1, zt], [a1, b1, zt], alpha('#fff4dc', 0.45), 0.8);
      const n = Math.floor((a1 - a0) / (0.03 * s));
      for (let k = 0; k < n; k++) if (rng() < fill) sitter(iso, rng, a0 + (k + 0.5 + (rng() - 0.5) * 0.3) * ((a1 - a0) / n), b0 + d * 0.45, zt, s);
    } else {
      iso.box(b0, a0, b1, a1, z, zt, m);
      iso.line([b1, a0, zt], [b1, a1, zt], alpha('#fff4dc', 0.3), 0.8);
      const n = Math.floor((a1 - a0) / (0.03 * s));
      for (let k = 0; k < n; k++) if (rng() < fill) sitter(iso, rng, b0 + d * 0.45, a0 + (k + 0.5 + (rng() - 0.5) * 0.3) * ((a1 - a0) / n), zt, s);
    }
  }
  if (along === 'u') grime(iso, a0, back, a1, front, z, 0.03, 0.2);
  else grime(iso, back, a0, front, a1, z, 0.03, 0.2);
  return front;
}

/** Floodlight mast: GI pole with a lamp frame facing the field (towards +u+v). */
export function floodlight(iso: Iso, u: number, v: number, z: number, H: number, s = 1): void {
  iso.ellipse(u + 0.01, v, z, 0.03 * s, 'rgba(40,24,14,0.3)');
  iso.line([u, v, z], [u, v, z + H], alpha('#2a2a2e', 0.8), 4.2 * s);
  iso.line([u, v, z], [u, v, z + H], '#9aa4aa', 2.6 * s);
  iso.line([u - 0.003, v, z], [u - 0.003, v, z + H], alpha('#e8eef0', 0.6), 0.8 * s);
  const w = 0.07 * s;
  const zt = z + H;
  const frame: P3[] = [
    [u - w, v + w, zt],
    [u + w, v - w, zt],
    [u + w, v - w, zt + 0.07 * s],
    [u - w, v + w, zt + 0.07 * s],
  ];
  iso.poly(frame, '#3a3d42', alpha('#15161a', 0.8), 1);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++) {
      const t = (i + 0.5) / 4;
      iso.ellipse(u - w + 2 * w * t, v + w - 2 * w * t, zt + 0.018 * s + j * 0.032 * s, 0.009 * s, '#fff6d8', alpha('#c9b87a', 0.8), 0.6);
    }
}

/** Goal post whose mouth faces +dir (unit vector in u/v) between the two posts a and b. */
export function goalPost(iso: Iso, a: [number, number], b: [number, number], z: number, h: number, dir: [number, number], depth = 0.05): void {
  const back = (p: [number, number], zz: number): P3 => [p[0] - dir[0] * depth, p[1] - dir[1] * depth, zz];
  const net = alpha('#f1ebdd', 0.45);
  iso.poly([back(a, z), back(b, z), back(b, z + h * 0.7), back(a, z + h * 0.7)], alpha('#f1ebdd', 0.12), net, 0.6);
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const p: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    iso.line([p[0], p[1], z + h], back(p, z + h * 0.7), net, 0.5);
    iso.line(back(p, z), back(p, z + h * 0.7), net, 0.5);
  }
  iso.line([a[0], a[1], z + h], back(a, z + h * 0.7), net, 0.6);
  iso.line([b[0], b[1], z + h], back(b, z + h * 0.7), net, 0.6);
  iso.line([a[0], a[1], z], [a[0], a[1], z + h], alpha('#2a2a2e', 0.6), 2.6);
  iso.line([b[0], b[1], z], [b[0], b[1], z + h], alpha('#2a2a2e', 0.6), 2.6);
  iso.line([a[0], a[1], z + h], [b[0], b[1], z + h], alpha('#2a2a2e', 0.6), 2.6);
  iso.line([a[0], a[1], z], [a[0], a[1], z + h], '#f6f2e6', 1.6);
  iso.line([b[0], b[1], z], [b[0], b[1], z + h], '#f6f2e6', 1.6);
  iso.line([a[0], a[1], z + h], [b[0], b[1], z + h], '#f6f2e6', 1.6);
}

/** Wooden bench (park bench) along u or v. */
export function bench(iso: Iso, u: number, v: number, z: number, along: 'u' | 'v', len = 0.1, color = '#2f7d6d'): void {
  const t = 0.022;
  if (along === 'u') {
    iso.box(u, v, u + len, v + t, z + 0.02, z + 0.027, mat(color));
    iso.box(u, v - 0.004, u + len, v, z + 0.027, z + 0.05, mat(color));
    iso.line([u + 0.005, v + t, z], [u + 0.005, v + t, z + 0.02], '#3a3a3a', 1);
    iso.line([u + len - 0.005, v + t, z], [u + len - 0.005, v + t, z + 0.02], '#3a3a3a', 1);
  } else {
    iso.box(u, v, u + t, v + len, z + 0.02, z + 0.027, mat(color));
    iso.box(u - 0.004, v, u, v + len, z + 0.027, z + 0.05, mat(color));
    iso.line([u + t, v + 0.005, z], [u + t, v + 0.005, z + 0.02], '#3a3a3a', 1);
    iso.line([u + t, v + len - 0.005, z], [u + t, v + len - 0.005, z + 0.02], '#3a3a3a', 1);
  }
}

/** Hand-painted signboard on two legs, facing the lit (+v) side. */
export function signBoard(iso: Iso, u: number, v: number, z: number, w: number, h: number, bg: string, ink: string): void {
  pole(iso, u + 0.01, v, z, h + 0.04, '#4a3a2a', 1.3);
  pole(iso, u + w - 0.01, v, z, h + 0.04, '#4a3a2a', 1.3);
  const zb = z + 0.04;
  iso.box(u, v - 0.006, u + w, v, zb, zb + h, mat(bg));
  iso.poly(iso.faceVQuad(v, u + w * 0.1, u + w * 0.9, zb + h * 0.55, zb + h * 0.8), alpha(ink, 0.9));
  iso.poly(iso.faceVQuad(v, u + w * 0.2, u + w * 0.7, zb + h * 0.2, zb + h * 0.38), alpha(ink, 0.7));
}

/** Sagging chain-link / net fence panel between posts along an edge (see-through). */
export function meshFence(iso: Iso, along: 'u' | 'v', fixed: number, a0: number, a1: number, z: number, h: number, color = '#4d5a52'): void {
  const panel: P3[] = along === 'u' ? iso.faceVQuad(fixed, a0, a1, z, z + h) : iso.faceUQuad(fixed, a0, a1, z, z + h);
  iso.poly(panel, alpha(color, 0.18));
  iso.clipped(panel, () => {
    const L = a1 - a0;
    for (let s = -h; s < L + h; s += 0.018) {
      const p = (x: number, zz: number): P3 => (along === 'u' ? [x, fixed, zz] : [fixed, x, zz]);
      iso.line(p(a0 + s, z), p(a0 + s + h, z + h), alpha(color, 0.35), 0.5);
      iso.line(p(a0 + s + h, z), p(a0 + s, z + h), alpha(color, 0.35), 0.5);
    }
  });
  const nPosts = Math.max(2, Math.round((a1 - a0) / 0.2) + 1);
  for (let i = 0; i < nPosts; i++) {
    const a = a0 + ((a1 - a0) * i) / (nPosts - 1);
    const p: P3 = along === 'u' ? [a, fixed, z] : [fixed, a, z];
    iso.line(p, [p[0], p[1], z + h], alpha('#2a2a2e', 0.6), 2.2);
    iso.line(p, [p[0], p[1], z + h], '#8d949a', 1.2);
  }
  const top0: P3 = along === 'u' ? [a0, fixed, z + h] : [fixed, a0, z + h];
  const top1: P3 = along === 'u' ? [a1, fixed, z + h] : [fixed, a1, z + h];
  iso.line(top0, top1, '#8d949a', 1.1);
}

/** Pile of old tyres painted in alternating colours (go-kart barriers, playground edging). */
export function tyre(iso: Iso, u: number, v: number, z: number, r: number, paint?: string): void {
  iso.cylinder(u, v, r, z, z + r * 0.8, paint ?? '#2b2b2e', paint ? shade(paint, 0.1) : '#3a3a3e');
  iso.ellipse(u, v, z + r * 0.8 + 0.001, r * 0.5, '#1a1a1c');
}
