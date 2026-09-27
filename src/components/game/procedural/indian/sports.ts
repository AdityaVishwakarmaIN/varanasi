/**
 * Indian-style procedural art: sports buildings.
 * See ./index.ts for the drawing contract.
 *
 * Drawn as what the Varanasi build menu calls them (VARANASI_DISPLAY): tennis is a badminton
 * court, basketball_courts a kabaddi court / akhara, baseball_field_small a cricket ground, and
 * the hidden ones get an Indian reading (the "baseball" stadium is a cricket stadium, the small
 * roller coaster a mela with rides). Everything sits on dusty maidan plots with painted boundary
 * walls, neem trees, chai stalls, spectators and bunting.
 */
import { alpha, mat, seededRng, shade, type Ctx2D, type P3 } from '../isoPainter';
import type { Iso } from '../isoPainter';
import {
  C,
  charpai,
  chhatri,
  dome,
  drum,
  flag,
  govBlock,
  grime,
  lawn,
  makeIso,
  paving,
  shikhara,
  slab,
  waterSurface,
  weatherU,
  weatherV,
  windowU,
  windowV,
  type ProceduralSpriteDef,
} from '../varanasiSprites';
import {
  BUNTING,
  CROWD,
  LIME,
  SKIN,
  bench,
  bunting,
  chaiStall,
  dustPatch,
  floodlight,
  gallery,
  goalPost,
  maidan,
  meshFence,
  paintedKerb,
  paintedWall,
  person,
  pole,
  rectLines,
  shamiana,
  signBoard,
  sitter,
  tufts,
  tyre,
  type Rng,
} from './sportsKit';

const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// ============================================================================
// Play equipment
// ============================================================================

/** Iron slide: ladder at the back (−v), chute running down towards +v. */
function slide(iso: Iso, u: number, v: number, z: number, H: number, len: number, color: string): void {
  const w = 0.05;
  iso.aoRect(u, v - 0.04, u + w, v + len, z, 0.03, 0.3);
  // ladder
  iso.line([u, v - 0.05, z], [u, v, z + H], '#6a6f75', 1.4);
  iso.line([u + w, v - 0.05, z], [u + w, v, z + H], '#6a6f75', 1.4);
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    iso.line([u, v - 0.05 + 0.05 * t, z + H * t], [u + w, v - 0.05 + 0.05 * t, z + H * t], '#8a9096', 1);
  }
  // platform
  iso.box(u, v, u + w, v + 0.04, z + H - 0.01, z + H, mat(color));
  iso.line([u, v, z + H], [u, v, z + H + 0.04], '#6a6f75', 1.2);
  iso.line([u + w, v, z + H], [u + w, v, z + H + 0.04], '#6a6f75', 1.2);
  iso.line([u, v, z + H + 0.04], [u + w, v, z + H + 0.04], '#6a6f75', 1.2);
  // chute (curves out at the bottom)
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push([v + 0.04 + t * (len - 0.04), z + 0.012 + (H - 0.012) * Math.pow(1 - t, 1.35)]);
  }
  for (let i = 0; i < 8; i++) {
    const [va, za] = pts[i];
    const [vb, zb] = pts[i + 1];
    iso.poly([[u, va, za], [u + w, va, za], [u + w, vb, zb], [u, vb, zb]], shade('#c9ccd0', 0.1 - i * 0.015));
    // side rails (shaded face on +u)
    iso.poly([[u + w, va, za], [u + w, vb, zb], [u + w, vb, zb + 0.015], [u + w, va, za + 0.015]], shade(color, -0.25));
  }
  iso.polyline(pts.map(([vv, zz]) => [u, vv, zz + 0.015] as P3), color, 2);
  iso.line([u + w, v + len, z], [u + w, v + len, z + 0.014], '#555', 1);
}

/** A-frame swing set along u with `n` seats. */
function swings(iso: Iso, u0: number, u1: number, v: number, z: number, H: number, colors: readonly string[]): void {
  const d = 0.05;
  const legs = (u: number) => {
    iso.line([u, v - d, z], [u, v, z + H], '#3a3f45', 2.2);
    iso.line([u, v + d, z], [u, v, z + H], '#3a3f45', 2.2);
  };
  iso.poly(iso.topQuad(u0, v - 0.02, u1, v + 0.03, z + 0.001), 'rgba(90,60,30,0.22)');
  legs(u0);
  iso.line([u0, v, z + H], [u1, v, z + H], alpha('#1e1e22', 0.7), 3);
  iso.line([u0, v, z + H], [u1, v, z + H], '#d9493a', 1.8);
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    const u = u0 + ((i + 0.5) / n) * (u1 - u0);
    const zs = z + 0.03;
    iso.line([u - 0.012, v, z + H], [u - 0.012, v + 0.01, zs], '#777c82', 0.8);
    iso.line([u + 0.012, v, z + H], [u + 0.012, v + 0.01, zs], '#777c82', 0.8);
    iso.box(u - 0.016, v, u + 0.016, v + 0.02, zs - 0.005, zs, mat(colors[i]));
  }
  legs(u1);
}

function seeSaw(iso: Iso, u: number, v: number, z: number, color: string): void {
  iso.box(u - 0.01, v - 0.01, u + 0.01, v + 0.01, z, z + 0.028, mat('#6a6f75'));
  iso.poly([[u - 0.012, v - 0.09, z + 0.008], [u + 0.012, v - 0.09, z + 0.008], [u + 0.012, v + 0.09, z + 0.048], [u - 0.012, v + 0.09, z + 0.048]], color, alpha(shade(color, -0.5), 0.8), 0.8);
  iso.poly([[u + 0.012, v - 0.09, z + 0.008], [u + 0.012, v + 0.09, z + 0.048], [u + 0.012, v + 0.09, z + 0.04], [u + 0.012, v - 0.09, z]], shade(color, -0.3));
  iso.line([u - 0.012, v - 0.075, z + 0.012], [u - 0.012, v - 0.075, z + 0.03], '#444', 1.2);
  iso.line([u - 0.012, v + 0.075, z + 0.045], [u - 0.012, v + 0.075, z + 0.063], '#444', 1.2);
}

/** Merry-go-round (hand-pushed) with painted segments. */
function merryGoRound(iso: Iso, u: number, v: number, z: number, r: number): void {
  iso.aoEllipse(u, v, r, z, 0.03, 0.35);
  iso.cylinder(u, v, r, z + 0.01, z + 0.022, '#6a6f75', null);
  const zt = z + 0.022;
  const cols = ['#e4572e', '#f2c14e', '#3a86c8', '#3aa36b'];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    const pts: P3[] = [[u, v, zt]];
    for (let k = 0; k <= 4; k++) {
      const a = a0 + ((a1 - a0) * k) / 4;
      pts.push([u + Math.cos(a) * r, v + Math.sin(a) * r, zt]);
    }
    iso.poly(pts, cols[i % 4]);
  }
  iso.ellipse(u, v, zt, r, null, alpha('#2a2a2e', 0.5), 0.8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    iso.line([u + Math.cos(a) * r * 0.85, v + Math.sin(a) * r * 0.85, zt], [u + Math.cos(a) * r * 0.2, v + Math.sin(a) * r * 0.2, zt + 0.04], '#8a9096', 1.2);
  }
  iso.line([u, v, zt], [u, v, zt + 0.045], '#6a6f75', 2);
}

/** Jungle-gym climbing frame (box of bars). */
function climbFrame(iso: Iso, u0: number, v0: number, s: number, z: number, H: number, color: string): void {
  iso.aoRect(u0, v0, u0 + s, v0 + s, z, 0.03, 0.25);
  const n = 3;
  const bar = (a: P3, b: P3) => {
    iso.line(a, b, alpha('#1e1e22', 0.6), 2);
    iso.line(a, b, color, 1.2);
  };
  for (let lvl = 0; lvl <= n; lvl++) {
    const zz = z + (H * lvl) / n;
    if (lvl > 0) {
      bar([u0, v0, zz], [u0 + s, v0, zz]);
      bar([u0, v0, zz], [u0, v0 + s, zz]);
    }
  }
  bar([u0, v0, z], [u0, v0, z + H]);
  bar([u0 + s, v0, z], [u0 + s, v0, z + H]);
  bar([u0, v0 + s, z], [u0, v0 + s, z + H]);
  for (let lvl = 1; lvl <= n; lvl++) {
    const zz = z + (H * lvl) / n;
    bar([u0 + s, v0, zz], [u0 + s, v0 + s, zz]);
    bar([u0, v0 + s, zz], [u0 + s, v0 + s, zz]);
  }
  bar([u0 + s, v0 + s, z], [u0 + s, v0 + s, z + H]);
}

/** Ice-cream / golgappa thela (hand cart) with a parasol. */
function thela(iso: Iso, rng: Rng, u: number, v: number, z: number, body: string): void {
  iso.aoRect(u, v, u + 0.09, v + 0.05, z, 0.02, 0.3);
  iso.ellipse(u + 0.02, v + 0.05, z + 0.012, 0.012, '#2a2a2e');
  iso.ellipse(u + 0.07, v + 0.05, z + 0.012, 0.012, '#2a2a2e');
  iso.box(u, v, u + 0.09, v + 0.05, z + 0.015, z + 0.05, mat(body));
  iso.poly(iso.faceVQuad(v + 0.05, u + 0.01, u + 0.08, z + 0.025, z + 0.04), '#f1ebdd');
  iso.poly(iso.faceVQuad(v + 0.05, u + 0.015, u + 0.06, z + 0.03, z + 0.036), alpha('#c0392b', 0.9));
  pole(iso, u + 0.045, v + 0.025, z + 0.05, 0.07, '#555', 1);
  iso.lathe(u + 0.045, v + 0.025, z + 0.115, [[0, 0.06], [0.015, 0.045], [0.03, 0]], (t) => (t < 0.5 ? '#e4572e' : '#f2c14e'), { outline: true });
  person(iso, rng, u + 0.11, v + 0.02, z, '#f1ebdd', 0.85);
}

// ============================================================================
// BADMINTON COURT (tennis, 1×1)
// ============================================================================

function badmintonCourt(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, surface: string, surround: string): void {
  const m = 0.035;
  iso.aoRect(u0 - m, v0 - m, u1 + m, v1 + m, z, 0.04, 0.3);
  iso.box(u0 - m, v0 - m, u1 + m, v1 + m, z, z + 0.012, mat(surround, { right: -0.3 }), { edges: false });
  const zt = z + 0.012;
  iso.poly(iso.topQuad(u0, v0, u1, v1, zt), surface);
  iso.speckle(iso.topQuad(u0, v0, u1, v1, zt), rng, 120, [alpha(shade(surface, 0.12), 0.6), alpha(shade(surface, -0.12), 0.6)], 1.3);
  const L = 'rgba(250,248,238,0.95)';
  rectLines(iso, u0, v0, u1, v1, zt, L, 1.4);
  const du = (u1 - u0) * 0.08;
  iso.line([u0 + du, v0, zt], [u0 + du, v1, zt], L, 1.1);
  iso.line([u1 - du, v0, zt], [u1 - du, v1, zt], L, 1.1);
  const vm = (v0 + v1) / 2;
  const sv = (v1 - v0) * 0.15;
  iso.line([u0, vm - sv, zt], [u1, vm - sv, zt], L, 1.1);
  iso.line([u0, vm + sv, zt], [u1, vm + sv, zt], L, 1.1);
  const lv = (v1 - v0) * 0.06;
  iso.line([u0, v0 + lv, zt], [u1, v0 + lv, zt], L, 1.1);
  iso.line([u0, v1 - lv, zt], [u1, v1 - lv, zt], L, 1.1);
  const um = (u0 + u1) / 2;
  iso.line([um, v0, zt], [um, vm - sv, zt], L, 1.1);
  iso.line([um, vm + sv, zt], [um, v1, zt], L, 1.1);
}

function net(iso: Iso, u0: number, u1: number, v: number, z: number): void {
  const zt = z + 0.06;
  iso.line([u0 - 0.03, v, z], [u0 - 0.03, v, zt], '#2f3238', 1.8);
  const panel = iso.faceVQuad(v, u0 - 0.03, u1 + 0.03, zt - 0.025, zt);
  iso.poly(panel, alpha('#1e1e22', 0.35));
  iso.clipped(panel, () => {
    for (let u = u0 - 0.03; u < u1 + 0.03; u += 0.012) iso.line([u, v, zt - 0.025], [u, v, zt], alpha('#e8e8e0', 0.25), 0.5);
  });
  iso.line([u0 - 0.03, v, zt], [u1 + 0.03, v, zt], '#f6f2e6', 1.3);
  iso.line([u1 + 0.03, v, z], [u1 + 0.03, v, zt], '#2f3238', 1.8);
}

function drawBadminton(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('tennis', variant);
  const z0 = 0.02;
  if (variant === 0) {
    maidan(iso, rng, z0, '#c9a878');
    tufts(iso, rng, 0.05, 0.05, 0.95, 0.95, z0, 25);
    iso.tree(0.12, 0.13, z0, 0.13, rng, 'neem');
    paintedWall(iso, rng, 'u', 0.03, 0.22, 0.97, z0, 0.1, { band: '#2f7d6d', ads: 2 });
    paintedWall(iso, rng, 'v', 0.03, 0.26, 0.97, z0, 0.1, { band: '#2f7d6d', ads: 2 });
    badmintonCourt(iso, rng, 0.33, 0.2, 0.79, 0.84, z0, '#3f8a5a', '#b7ad98');
    // tubelight pole (evening games) with bunting to the wall
    pole(iso, 0.25, 0.3, z0, 0.26, '#6b4a2a', 1.8);
    iso.line([0.25, 0.3, z0 + 0.25], [0.3, 0.35, z0 + 0.25], '#f7f6ee', 2.2);
    bunting(iso, [0.25, 0.3, z0 + 0.25], [0.9, 0.07, z0 + 0.13], 9);
    person(iso, rng, 0.52, 0.34, z0 + 0.012, '#e4572e');
    person(iso, rng, 0.6, 0.72, z0 + 0.012, '#3a86c8');
    net(iso, 0.33, 0.79, 0.52, z0 + 0.012);
    // shuttle in the air
    iso.ellipse(0.55, 0.47, z0 + 0.14, 0.006, '#fdfdf7', '#999', 0.6);
    bench(iso, 0.14, 0.52, z0, 'v', 0.14, '#2f7d6d');
    sitter(iso, rng, 0.155, 0.56, z0 + 0.03);
    sitter(iso, rng, 0.155, 0.62, z0 + 0.03);
    drum(iso, 0.16, 0.86, z0, 0.03, 0.06, '#2f67b4');
    paintedKerb(iso, 'u', 0.98, 0.3, 0.96, z0);
  } else {
    slab(iso, rng, 0.02, z0, '#b9b19d', '#8f8573', ['#aaa28e', '#c7bfab', '#9d957f']);
    meshFence(iso, 'u', 0.06, 0.1, 0.94, z0, 0.2);
    meshFence(iso, 'v', 0.06, 0.1, 0.94, z0, 0.2);
    badmintonCourt(iso, rng, 0.24, 0.16, 0.74, 0.8, z0, '#b5523a', '#2f7d6d');
    floodlight(iso, 0.14, 0.14, z0, 0.36, 0.55);
    person(iso, rng, 0.42, 0.3, z0 + 0.012, '#f2c14e');
    person(iso, rng, 0.55, 0.36, z0 + 0.012, '#f1ebdd');
    net(iso, 0.24, 0.74, 0.48, z0 + 0.012);
    person(iso, rng, 0.4, 0.66, z0 + 0.012, '#3aa36b');
    person(iso, rng, 0.58, 0.62, z0 + 0.012, '#b44ca0');
    chaiStall(iso, rng, 0.8, 0.72, z0, 0.9);
    charpai(iso, 0.84, 0.36, z0);
    iso.tree(0.1, 0.9, z0, 0.09, rng, 'ashoka');
    sitter(iso, rng, 0.87, 0.42, z0 + 0.035);
    paintedKerb(iso, 'v', 0.98, 0.1, 0.7, z0, '#2a2a2e', '#f2c14e');
  }
}

// ============================================================================
// KABADDI COURT / AKHARA (basketball_courts, 1×1)
// ============================================================================

function drawKabaddi(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('basketball_courts', variant);
  const z0 = 0.02;
  if (variant === 1) return drawAkhara(iso, rng, z0);
  maidan(iso, rng, z0, variant === 0 ? '#c4a67c' : '#b8a57e');
  tufts(iso, rng, 0.04, 0.04, 0.96, 0.96, z0, 30);
  // spectators on durries along the back-right edge
  iso.poly(iso.topQuad(0.22, 0.05, 0.94, 0.14, z0 + 0.001), '#8c3b2b');
  iso.clipped(iso.topQuad(0.22, 0.05, 0.94, 0.14, z0 + 0.001), () => {
    for (let u = 0.24; u < 0.94; u += 0.05) iso.line([u, 0.05, z0 + 0.001], [u, 0.14, z0 + 0.001], alpha('#e8b04a', 0.6), 1.2);
  });
  for (let u = 0.26; u < 0.92; u += 0.035) sitter(iso, rng, u + (rng() - 0.5) * 0.01, 0.07 + rng() * 0.04, z0);
  // judges' shamiana at the back-left
  shamiana(iso, 0.04, 0.24, 0.17, 0.62, z0, 0.14, variant === 0 ? '#c0392b' : '#2f6fb3', '#f2c14e');
  iso.box(0.06, 0.34, 0.12, 0.52, z0, z0 + 0.035, mat('#f1ebdd'));
  sitter(iso, rng, 0.08, 0.38, z0 + 0.01);
  sitter(iso, rng, 0.08, 0.46, z0 + 0.01);
  // soft mud court with lime lines
  const u0 = 0.24;
  const u1 = 0.9;
  const v0 = 0.22;
  const v1 = 0.84;
  const mud = variant === 0 ? '#a8714a' : '#3f8a5a';
  iso.aoRect(u0, v0, u1, v1, z0, 0.03, 0.25);
  iso.poly(iso.topQuad(u0, v0, u1, v1, z0 + 0.004), mud);
  iso.speckle(iso.topQuad(u0, v0, u1, v1, z0 + 0.004), rng, 260, [alpha(shade(mud, 0.15), 0.7), alpha(shade(mud, -0.18), 0.7)], 1.4);
  if (variant === 0) iso.clipped(iso.topQuad(u0, v0, u1, v1, z0 + 0.004), () => {
    for (let v = v0; v < v1; v += 0.025) iso.line([u0, v, z0 + 0.004], [u1, v, z0 + 0.004], alpha('#7a4e30', 0.25), 0.8);
  });
  const zl = z0 + 0.005;
  rectLines(iso, u0, v0, u1, v1, zl, LIME, 1.6);
  const um = (u0 + u1) / 2;
  iso.line([um, v0, zl], [um, v1, zl], LIME, 2);
  for (const d of [0.1, 0.15]) {
    iso.line([um - d, v0 + 0.05, zl], [um - d, v1 - 0.05, zl], LIME, 1.1);
    iso.line([um + d, v0 + 0.05, zl], [um + d, v1 - 0.05, zl], LIME, 1.1);
  }
  iso.line([u0, v0 + 0.05, zl], [u1, v0 + 0.05, zl], LIME, 1.1);
  iso.line([u0, v1 - 0.05, zl], [u1, v1 - 0.05, zl], LIME, 1.1);
  // two teams in chain formation, raider in the middle
  const teamA = variant === 0 ? '#e4572e' : '#f2c14e';
  const teamB = variant === 0 ? '#3a86c8' : '#b44ca0';
  const ppl: [number, number, string][] = [];
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const vv = v0 + 0.08 + t * (v1 - v0 - 0.16);
    ppl.push([u0 + 0.06 + Math.sin(t * Math.PI) * 0.06, vv, teamA]);
    ppl.push([u1 - 0.06 - Math.sin(t * Math.PI) * 0.06, vv, teamB]);
  }
  ppl.push([um + 0.05, (v0 + v1) / 2 + 0.03, teamA]);
  ppl.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [pu, pv, c] of ppl) person(iso, rng, pu, pv, z0 + 0.005, c, 0.9, '#f1ebdd');
  // referee
  person(iso, rng, um, v1 + 0.05, z0, '#f1ebdd', 0.9, '#2a2a2e');
  iso.tree(0.1, 0.86, z0, 0.12, rng, 'neem');
  bunting(iso, [0.04, 0.24, z0 + 0.14], [0.2, 0.05, z0 + 0.2], 5);
  pole(iso, 0.2, 0.05, z0, 0.2);
  bunting(iso, [0.2, 0.05, z0 + 0.2], [0.95, 0.05, z0 + 0.15], 10);
  pole(iso, 0.95, 0.05, z0, 0.15);
}

/** Wrestling akhara: soft red-earth pit with a brick rim, Hanuman shrine and peepal tree. */
function drawAkhara(iso: Iso, rng: Rng, z0: number): void {
  maidan(iso, rng, z0, '#bda27a');
  tufts(iso, rng, 0.04, 0.04, 0.96, 0.96, z0, 20);
  // raised platform (chabutra) round the peepal
  iso.cylinder(0.78, 0.14, 0.1, z0, z0 + 0.03, '#d8c7a4', shade('#d8c7a4', 0.1));
  iso.tree(0.78, 0.14, z0 + 0.03, 0.2, rng, 'peepal');
  // Hanuman shrine (small orange temple with a shikhara and flag) at the back-left
  const su = 0.1;
  const sv = 0.2;
  iso.aoRect(su, sv, su + 0.14, sv + 0.14, z0, 0.04, 0.4);
  iso.box(su - 0.02, sv - 0.02, su + 0.16, sv + 0.16, z0, z0 + 0.025, mat('#e3cfa6'));
  iso.box(su, sv, su + 0.14, sv + 0.14, z0 + 0.025, z0 + 0.12, mat('#e8742a'));
  iso.archV(sv + 0.14, su + 0.035, su + 0.105, z0 + 0.025, z0 + 0.1, '#5a2a18', true);
  iso.poly(iso.faceVQuad(sv + 0.14 + 0.001, su + 0.055, su + 0.085, z0 + 0.03, z0 + 0.07), '#d9481e');
  weatherV(iso, rng, sv + 0.14, su, su + 0.14, z0 + 0.025, z0 + 0.12, 6, 0.12);
  shikhara(iso, su + 0.07, sv + 0.07, z0 + 0.12, 0.05, 0.16, '#f0a040', true, false);
  flag(iso, su + 0.13, sv + 0.02, z0 + 0.12, 0.2, C.saffron);
  // marigold garland on the door
  for (let i = 0; i < 7; i++) iso.ellipse(su + 0.03 + i * 0.013, sv + 0.141, z0 + 0.1 - Math.sin((i / 6) * Math.PI) * 0.012, 0.005, i % 2 ? C.marigold : '#e4572e');
  // pit
  const u0 = 0.3;
  const v0 = 0.32;
  const u1 = 0.86;
  const v1 = 0.88;
  const brick = mat(C.brick, { top: 0.1 });
  iso.aoRect(u0, v0, u1, v1, z0, 0.05, 0.3);
  iso.box(u0, v0, u1, v1, z0, z0 + 0.03, brick);
  const zt = z0 + 0.03;
  const e = 0.025;
  const earth = '#b2663e';
  iso.poly(iso.topQuad(u0 + e, v0 + e, u1 - e, v1 - e, zt), '#6a3a22');
  // inner walls (visible back ones) and the soft earth, a little lower
  const zi = zt - 0.012;
  iso.poly(iso.faceUQuad(u0 + e, v0 + e, v1 - e, zi, zt), shade(C.brick, -0.1));
  iso.poly(iso.faceVQuad(v0 + e, u0 + e, u1 - e, zi, zt), shade(C.brick, 0.05));
  iso.poly(iso.topQuad(u0 + e + 0.004, v0 + e + 0.004, u1 - e, v1 - e, zi), earth);
  iso.speckle(iso.topQuad(u0 + e, v0 + e, u1 - e, v1 - e, zi), rng, 260, [alpha('#8e4e2c', 0.7), alpha('#cf8a5e', 0.7), alpha('#9a5634', 0.6)], 1.6);
  // raked furrows
  iso.clipped(iso.topQuad(u0 + e, v0 + e, u1 - e, v1 - e, zi), () => {
    for (let v = v0 + 0.05; v < v1; v += 0.03) iso.line([u0, v, zi], [u1, v + 0.02, zi], alpha('#7c4024', 0.35), 0.9);
  });
  // two wrestlers grappling + ustad + pehlwans resting
  const skin = '#8a5a3c';
  person(iso, rng, 0.55, 0.6, zi, skin, 1, '#c0392b');
  person(iso, rng, 0.6, 0.62, zi, '#7a4c32', 1, '#c0392b');
  person(iso, rng, 0.9, 0.5, z0, '#f1ebdd', 0.95, '#f1ebdd');
  sitter(iso, rng, 0.2, 0.62, z0);
  sitter(iso, rng, 0.2, 0.7, z0);
  sitter(iso, rng, 0.24, 0.8, z0);
  // gada (mace) and a pair of jori clubs
  for (const [gu, gv] of [[0.16, 0.9], [0.22, 0.93]] as [number, number][]) {
    iso.line([gu, gv, z0], [gu, gv, z0 + 0.1], '#5a3a22', 1.6);
    iso.lathe(gu, gv, z0 + 0.1, [[0, 0.004], [0.015, 0.025], [0.04, 0.026], [0.06, 0.004]], () => '#6b4a2f', { outline: true });
  }
  iso.lathe(0.93, 0.8, z0, [[0, 0.012], [0.02, 0.018], [0.07, 0.008], [0.09, 0.006]], () => '#7b5434', { outline: true });
  drum(iso, 0.93, 0.7, z0, 0.025, 0.05, '#c9ccd0');
  bunting(iso, [0.24, 0.16, z0 + 0.2], [0.7, 0.14, z0 + 0.2], 8, [C.saffron, '#e4572e', C.marigold]);
}

// ============================================================================
// PLAYGROUND (small 1×1, large 2×2)
// ============================================================================

function drawPlaygroundSmall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('playground_small', variant);
  const z0 = 0.02;
  if (variant === 0) {
    maidan(iso, rng, z0, '#cdb088');
    tufts(iso, rng, 0.05, 0.05, 0.95, 0.95, z0, 30);
  } else {
    slab(iso, rng, 0.02, z0, C.lawn, '#6f5a3e');
    lawn(iso, rng, 0.02, 0.02, 0.98, 0.98, z0, C.lawn);
    iso.poly(iso.topQuad(0.2, 0.2, 0.84, 0.84, z0 + 0.002), '#d7bf93');
    iso.speckle(iso.topQuad(0.2, 0.2, 0.84, 0.84, z0 + 0.002), rng, 150, [alpha('#bfa278', 0.8), alpha('#e8d4ac', 0.8)], 1.3);
  }
  iso.tree(0.12, 0.12, z0, 0.14, rng, variant === 0 ? 'neem' : 'peepal');
  const band = variant === 0 ? '#3a86c8' : '#c0392b';
  paintedWall(iso, rng, 'u', 0.03, 0.24, 0.97, z0, 0.09, { band, ads: 0, wall: variant === 0 ? '#f0dfa6' : C.whitewash });
  paintedWall(iso, rng, 'v', 0.03, 0.26, 0.97, z0, 0.09, { band, ads: 0, wall: variant === 0 ? '#f0dfa6' : C.whitewash });
  // children's mural: sun, flowers, kites on the lit wall
  iso.clipped(iso.faceVQuad(0.06, 0.24, 0.97, z0 + 0.03, z0 + 0.09), () => {
    for (let i = 0; i < 6; i++) {
      const u = 0.3 + i * 0.11;
      iso.ellipse(u, 0.06, z0 + 0.055 + (i % 2) * 0.01, 0.02, ['#e4572e', '#f2c14e', '#3aa36b', '#b44ca0'][i % 4]);
    }
  });
  if (variant === 0) {
    swings(iso, 0.3, 0.62, 0.22, z0, 0.16, ['#e4572e', '#f2c14e', '#3a86c8']);
    slide(iso, 0.22, 0.44, z0, 0.14, 0.3, '#f2c14e');
    merryGoRound(iso, 0.6, 0.6, z0, 0.12);
    seeSaw(iso, 0.84, 0.44, z0, '#e4572e');
    person(iso, rng, 0.55, 0.36, z0, '#e07a9a', 0.7);
    person(iso, rng, 0.47, 0.62, z0, '#3aa36b', 0.7);
    person(iso, rng, 0.72, 0.72, z0, '#f2c14e', 0.7);
    person(iso, rng, 0.35, 0.82, z0, '#b44ca0', 0.95);
    thela(iso, rng, 0.72, 0.86, z0, '#f1ebdd');
  } else {
    climbFrame(iso, 0.28, 0.24, 0.14, z0, 0.12, '#e4572e');
    swings(iso, 0.52, 0.86, 0.22, z0, 0.16, ['#3aa36b', '#e07a9a', '#f2c14e']);
    slide(iso, 0.26, 0.5, z0, 0.13, 0.28, '#3a86c8');
    seeSaw(iso, 0.6, 0.52, z0, '#f2c14e');
    merryGoRound(iso, 0.66, 0.74, z0, 0.1);
    person(iso, rng, 0.46, 0.46, z0, '#e4572e', 0.7);
    person(iso, rng, 0.76, 0.52, z0, '#3a86c8', 0.7);
    bench(iso, 0.88, 0.62, z0, 'v', 0.14);
    sitter(iso, rng, 0.9, 0.68, z0 + 0.03);
    iso.tree(0.14, 0.88, z0, 0.1, rng, 'ashoka');
  }
}

function drawPlaygroundLarge(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('playground_large', variant);
  const z0 = 0.025;
  slab(iso, rng, 0.02, z0, C.lawn, '#6f5a3e');
  lawn(iso, rng, 0.02, 0.02, 1.98, 1.98, z0, variant === 0 ? C.lawn : '#7aa446');
  // brick walking track round the park
  const brick = '#b8745a';
  const trk = (a0: number, b0: number, a1: number, b1: number) => {
    iso.poly(iso.topQuad(a0, b0, a1, b1, z0 + 0.002), brick);
    paving(iso, rng, a0, b0, a1, b1, z0 + 0.002, 0.04, 0.04, alpha('#7a4230', 0.45));
  };
  trk(0.18, 0.18, 1.82, 0.3);
  trk(0.18, 0.3, 0.3, 1.82);
  trk(0.3, 1.7, 1.82, 1.82);
  trk(1.7, 0.3, 1.82, 1.7);
  // trees behind the walls
  iso.tree(0.1, 0.1, z0, 0.16, rng, 'neem');
  iso.tree(1.0, 0.08, z0, 0.12, rng, 'ashoka');
  iso.tree(0.08, 1.0, z0, 0.12, rng, 'ashoka');
  const band = variant === 0 ? '#8c3b2b' : '#2f7d6d';
  paintedWall(iso, rng, 'u', 0.03, 0.24, 1.97, z0, 0.1, { band, ads: 3 });
  paintedWall(iso, rng, 'v', 0.03, 0.24, 1.97, z0, 0.1, { band, ads: 3 });
  // sand play pit
  const sp: [number, number, number, number] = [0.42, 0.42, 1.58, 1.52];
  iso.box(sp[0], sp[1], sp[2], sp[3], z0, z0 + 0.018, mat('#9a9286'), { edges: false });
  iso.poly(iso.topQuad(sp[0] + 0.02, sp[1] + 0.02, sp[2] - 0.02, sp[3] - 0.02, z0 + 0.018), '#e0c794');
  iso.speckle(iso.topQuad(sp[0] + 0.02, sp[1] + 0.02, sp[2] - 0.02, sp[3] - 0.02, z0 + 0.018), rng, 500, [alpha('#c9ab78', 0.8), alpha('#f0dcb0', 0.8)], 1.3);
  const zp = z0 + 0.018;
  const cA = variant === 0 ? '#e4572e' : '#3a86c8';
  const cB = variant === 0 ? '#f2c14e' : '#e07a9a';
  swings(iso, 0.55, 1.05, 0.55, zp, 0.2, ['#e4572e', '#f2c14e', '#3a86c8', '#3aa36b']);
  climbFrame(iso, 1.2, 0.5, 0.2, zp, 0.16, cA);
  slide(iso, 0.55, 0.85, zp, 0.18, 0.4, cB);
  // double slide
  slide(iso, 0.7, 0.85, zp, 0.18, 0.4, cA);
  merryGoRound(iso, 1.2, 1.05, zp, 0.16);
  seeSaw(iso, 1.0, 1.25, zp, cB);
  seeSaw(iso, 1.45, 1.3, zp, cA);
  // children and parents
  const kids: [number, number][] = [[0.9, 0.75], [1.05, 0.9], [1.35, 0.85], [0.95, 1.4], [0.62, 1.38], [1.35, 1.2], [1.1, 0.65]];
  for (const [ku, kv] of kids) person(iso, rng, ku, kv, zp, pick(rng, CROWD), 0.7);
  // benches along the track, walkers
  bench(iso, 0.45, 1.6, z0, 'u', 0.16);
  sitter(iso, rng, 0.5, 1.62, z0 + 0.03);
  sitter(iso, rng, 0.56, 1.62, z0 + 0.03);
  bench(iso, 1.6, 0.5, z0, 'v', 0.16);
  person(iso, rng, 0.24, 0.8, z0, '#f1ebdd');
  person(iso, rng, 1.2, 1.76, z0, '#e07a9a');
  person(iso, rng, 1.76, 1.1, z0, '#3aa36b');
  person(iso, rng, 1.25, 0.24, z0, '#f2c14e');
  // hedges, front trees, vendors
  iso.tree(1.9, 0.3, z0, 0.12, rng, 'neem');
  iso.tree(0.3, 1.9, z0, 0.14, rng, 'neem');
  thela(iso, rng, 1.55, 1.86, z0, variant === 0 ? '#f1ebdd' : '#f2c14e');
  if (variant === 0) chaiStall(iso, rng, 1.84, 1.5, z0);
  else iso.tree(1.88, 1.88, z0, 0.12, rng, 'shrub');
  signBoard(iso, 0.9, 1.9, z0, 0.22, 0.06, '#2f7d6d', '#f1ebdd');
  bunting(iso, [0.18, 0.18, z0 + 0.2], [1.82, 0.18, z0 + 0.2], 16);
  pole(iso, 0.18, 0.18, z0, 0.2);
  pole(iso, 1.82, 0.18, z0, 0.2);
}

// ============================================================================
// FOOTBALL ON THE MAIDAN (soccer_field_small 1×1)
// ============================================================================

function fieldMarkings(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number): void {
  rectLines(iso, u0, v0, u1, v1, z, LIME, 1.5);
  const vm = (v0 + v1) / 2;
  const um = (u0 + u1) / 2;
  iso.line([u0, vm, z], [u1, vm, z], LIME, 1.3);
  iso.ellipse(um, vm, z, Math.min(u1 - u0, v1 - v0) * 0.14, null, LIME, 1.2);
  const bw = (u1 - u0) * 0.28;
  const bd = (v1 - v0) * 0.12;
  rectLines(iso, um - bw, v0, um + bw, v0 + bd, z, LIME, 1.2);
  rectLines(iso, um - bw, v1 - bd, um + bw, v1, z, LIME, 1.2);
}

function drawSoccerSmall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('soccer_field_small', variant);
  const z0 = 0.02;
  const u0 = 0.2;
  const u1 = 0.86;
  const v0 = 0.12;
  const v1 = 0.88;
  if (variant === 0) {
    maidan(iso, rng, z0, '#c9a878');
    // worn grass in the middle, bald goalmouths
    iso.poly(iso.topQuad(u0, v0, u1, v1, z0 + 0.001), alpha('#7f9a48', 0.55));
    dustPatch(iso, rng, (u0 + u1) / 2, v0 + 0.08, z0 + 0.002, 0.14, alpha('#c9a878', 0.8));
    dustPatch(iso, rng, (u0 + u1) / 2, v1 - 0.08, z0 + 0.002, 0.14, alpha('#c9a878', 0.8));
    dustPatch(iso, rng, (u0 + u1) / 2, 0.5, z0 + 0.002, 0.1, alpha('#c9a878', 0.6));
    tufts(iso, rng, 0.03, 0.03, 0.97, 0.97, z0, 30);
    iso.tree(0.09, 0.1, z0, 0.14, rng, 'neem');
    paintedWall(iso, rng, 'u', 0.02, 0.2, 0.98, z0, 0.08, { band: '#8c3b2b', ads: 2, wall: '#f0dfa6' });
  } else {
    slab(iso, rng, 0.02, z0, '#6e9a3e', '#6f5a3e');
    lawn(iso, rng, 0.02, 0.02, 0.98, 0.98, z0, '#6e9a3e');
    meshFence(iso, 'u', 0.04, 0.04, 0.96, z0, 0.22, '#2f5a3a');
    meshFence(iso, 'v', 0.04, 0.04, 0.96, z0, 0.22, '#2f5a3a');
  }
  fieldMarkings(iso, u0, v0, u1, v1, z0 + 0.003);
  const gm = (u0 + u1) / 2;
  goalPost(iso, [gm - 0.09, v0], [gm + 0.09, v0], z0, 0.07, [0, 1], 0.04);
  const team = variant === 0 ? ['#e4572e', '#f1ebdd'] : ['#f2c14e', '#3a86c8'];
  const ppl: [number, number, string][] = [];
  for (let i = 0; i < 8; i++) ppl.push([u0 + 0.06 + rng() * (u1 - u0 - 0.12), v0 + 0.1 + rng() * (v1 - v0 - 0.2), team[i % 2]]);
  ppl.push([gm, v0 + 0.03, '#3aa36b']);
  ppl.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [pu, pv, c] of ppl) person(iso, rng, pu, pv, z0 + 0.003, c, 0.85, '#2a2a2e');
  iso.ellipse(0.5, 0.5, z0 + 0.012, 0.009, '#fdfdf7', '#555', 0.6);
  goalPost(iso, [gm - 0.09, v1], [gm + 0.09, v1], z0, 0.07, [0, -1], 0.04);
  if (variant === 0) {
    // spectators on the left edge, bicycles, chai
    for (let v = 0.3; v < 0.75; v += 0.05) sitter(iso, rng, 0.1 + rng() * 0.03, v, z0);
    chaiStall(iso, rng, 0.04, 0.8, z0, 0.8);
    paintedKerb(iso, 'u', 0.98, 0.4, 0.96, z0, '#2a2a2e', '#f2c14e');
  } else {
    floodlight(iso, 0.06, 0.06, z0, 0.42, 0.55);
    bench(iso, 0.9, 0.35, z0, 'v', 0.2, '#3a86c8');
    for (let v = 0.38; v < 0.54; v += 0.04) sitter(iso, rng, 0.915, v, z0 + 0.03);
    iso.tree(0.08, 0.92, z0, 0.1, rng, 'ashoka');
  }
}

// ============================================================================
// SWIMMING POOL (1×1)
// ============================================================================

function drawSwimmingPool(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('swimming_pool', variant);
  const zd = 0.05;
  // deck
  slab(iso, rng, 0.02, zd, '#e6dcc6', '#a89c86', ['#d6cbb3', '#efe6d2']);
  paving(iso, rng, 0.02, 0.02, 0.98, 0.98, zd, 0.08, 0.08, alpha('#b3a68c', 0.45));
  // changing rooms (cream + maroon) along the back
  if (variant === 0) {
    govBlock(iso, rng, 0.08, 0.06, 0.94, 0.22, zd, 0.2, { door: 'v' });
    drum(iso, 0.25, 0.13, zd + 0.22, 0.035, 0.07, '#26272b');
    drum(iso, 0.34, 0.13, zd + 0.22, 0.035, 0.07, '#26272b');
    iso.box(0.62, 0.21, 0.86, 0.225, zd + 0.13, zd + 0.18, mat('#2f6fb3'));
    iso.poly(iso.faceVQuad(0.225, 0.64, 0.84, zd + 0.15, zd + 0.165), alpha('#f1ebdd', 0.9));
  } else {
    govBlock(iso, rng, 0.06, 0.06, 0.24, 0.5, zd, 0.2);
    drum(iso, 0.14, 0.2, zd + 0.22, 0.035, 0.07, '#26272b');
    iso.tree(0.5, 0.1, zd, 0.12, rng, 'neem');
    iso.tree(0.82, 0.1, zd, 0.1, rng, 'ashoka');
  }
  // pool
  const u0 = variant === 0 ? 0.14 : 0.32;
  const v0 = variant === 0 ? 0.32 : 0.2;
  const u1 = variant === 0 ? 0.86 : 0.9;
  const v1 = 0.88;
  const zw = zd - 0.022;
  const coping = '#f4efe2';
  iso.poly(iso.topQuad(u0 - 0.025, v0 - 0.025, u1 + 0.025, v1 + 0.025, zd + 0.001), coping, alpha('#a89c86', 0.6), 0.8);
  iso.poly(iso.topQuad(u0, v0, u1, v1, zw - 0.02), '#2a7fa0');
  // inner walls (tiled blue) visible at the back
  iso.poly(iso.faceUQuad(u0, v0, v1, zw - 0.02, zd), '#4aa3c0');
  iso.poly(iso.faceVQuad(v0, u0, u1, zw - 0.02, zd), '#68b8d0');
  iso.line([u0, v0, zd - 0.006], [u1, v0, zd - 0.006], '#2f6fb3', 1.4);
  iso.line([u0, v0, zd - 0.006], [u0, v1, zd - 0.006], '#2f6fb3', 1.4);
  const water = iso.topQuad(u0, v0, u1, v1, zw);
  waterSurface(iso, rng, water, '#4fb6cf', '#2c8aa8');
  // lane ropes (red/white floats) along v
  const lanes = variant === 0 ? 4 : 3;
  for (let i = 1; i < lanes; i++) {
    const u = u0 + ((u1 - u0) * i) / lanes;
    for (let v = v0 + 0.01; v < v1; v += 0.02) iso.ellipse(u, v, zw + 0.002, 0.005, Math.floor((v - v0) / 0.1) % 2 ? '#e4572e' : '#f6f2e6');
  }
  // lane stripes on the floor
  iso.clipped(water, () => {
    for (let i = 0; i < lanes; i++) {
      const u = u0 + ((u1 - u0) * (i + 0.5)) / lanes;
      iso.line([u, v0 + 0.05, zw], [u, v1 - 0.05, zw], alpha('#1e5f80', 0.35), 2);
    }
  });
  // swimmers (heads + splashes)
  for (let i = 0; i < 4; i++) {
    const u = u0 + ((u1 - u0) * ((i % lanes) + 0.5)) / lanes;
    const v = v0 + 0.1 + rng() * (v1 - v0 - 0.2);
    iso.ellipse(u, v + 0.02, zw + 0.001, 0.02, alpha('#e8f8fa', 0.55));
    iso.ellipse(u, v, zw + 0.006, 0.008, i % 2 ? '#f2c14e' : '#1e1a18', alpha('#1e1a18', 0.5), 0.5);
  }
  // starting blocks on the far edge and a ladder
  for (let i = 0; i < lanes; i++) {
    const u = u0 + ((u1 - u0) * (i + 0.5)) / lanes;
    iso.box(u - 0.018, v0 - 0.03, u + 0.018, v0 - 0.002, zd, zd + 0.02, mat('#f1ebdd'));
    iso.poly(iso.faceVQuad(v0 - 0.002, u - 0.018, u + 0.018, zd + 0.008, zd + 0.016), '#2f6fb3');
  }
  iso.line([u1 - 0.04, v1 + 0.005, zd], [u1 - 0.04, v1 - 0.02, zd + 0.05], '#c9ccd0', 1.4);
  iso.line([u1 - 0.08, v1 + 0.005, zd], [u1 - 0.08, v1 - 0.02, zd + 0.05], '#c9ccd0', 1.4);
  // lifeguard chair + umbrellas + loungers
  if (variant === 0) {
    iso.line([0.07, 0.6, zd], [0.07, 0.6, zd + 0.12], '#f1ebdd', 1.6);
    iso.box(0.05, 0.58, 0.1, 0.63, zd + 0.1, zd + 0.11, mat('#e4572e'));
    person(iso, rng, 0.075, 0.605, zd + 0.11, '#e4572e', 0.8);
    iso.lathe(0.075, 0.9, zd + 0.13, [[0, 0.08], [0.02, 0.06], [0.04, 0]], (t) => (t < 0.5 ? '#e4572e' : '#f1ebdd'), { outline: true });
    pole(iso, 0.075, 0.9, zd, 0.13, '#555', 1.2);
  } else {
    for (const [uu, vv, c] of [[0.13, 0.62, '#3a86c8'], [0.14, 0.84, '#f2c14e']] as [number, number, string][]) {
      iso.box(uu - 0.04, vv - 0.03, uu + 0.04, vv + 0.03, zd, zd + 0.015, mat('#f1ebdd'));
      pole(iso, uu, vv, zd, 0.13, '#555', 1.2);
      iso.lathe(uu, vv, zd + 0.13, [[0, 0.075], [0.02, 0.055], [0.04, 0]], () => c, { outline: true });
    }
    person(iso, rng, 0.2, 0.72, zd, '#f1ebdd', 0.9);
  }
  // hedge on the front edges
  for (let u = 0.1; u < 0.95; u += 0.14) iso.tree(u, 0.95, zd, 0.04, rng, 'shrub');
}

// ============================================================================
// SKATE PARK (1×1, hidden on Varanasi): painted concrete ramps with a Warli mural
// ============================================================================

function quarterPipe(iso: Iso, u0: number, u1: number, vBack: number, depth: number, z: number, H: number, color: string): void {
  const n = 8;
  iso.aoRect(u0, vBack, u1, vBack + depth, z, 0.04, 0.3);
  const prof: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    prof.push([vBack + depth * (1 - Math.cos(a)), z + H * (1 - Math.sin(a))]);
  }
  // ramp surface slices from the top (back) to the bottom (front)
  for (let i = 0; i < n; i++) {
    const [va, za] = prof[i];
    const [vb, zb] = prof[i + 1];
    const slope = (za - zb) / Math.max(1e-3, vb - va);
    iso.poly([[u0, va, za], [u1, va, za], [u1, vb, zb], [u0, vb, zb]], shade(color, 0.12 - Math.min(0.3, slope * 0.06)));
  }
  // side face (+u)
  const side: P3[] = [[u1, vBack, z], ...prof.map(([vv, zz]) => [u1, vv, zz] as P3), [u1, vBack + depth, z]];
  iso.poly(side, shade(C.concrete, -0.3), alpha('#2a2a2e', 0.5), 0.8);
  // coping + deck
  iso.box(u0, vBack - 0.05, u1, vBack, z, z + H, mat(C.concrete), { noLeft: true });
  iso.line([u0, vBack, z + H], [u1, vBack, z + H], '#d0d4d8', 2);
}

function drawSkatePark(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('skate_park', variant);
  const z0 = 0.02;
  slab(iso, rng, 0.02, z0, '#c3bdb0', '#8f887c', ['#b3ad9f', '#d0cabb']);
  iso.tree(0.08, 0.08, z0, 0.12, rng, 'neem');
  paintedWall(iso, rng, 'v', 0.03, 0.2, 0.97, z0, 0.12, { band: '#b8563a', wall: '#e8d9b5' });
  // Warli-style mural (white stick figures on terracotta) on the left wall
  iso.poly(iso.faceUQuad(0.06, 0.25, 0.92, z0 + 0.02, z0 + 0.11), '#9a4a2e');
  for (let i = 0; i < 8; i++) {
    const v = 0.3 + i * 0.08;
    const zc = z0 + 0.065;
    iso.line([0.061, v, zc - 0.02], [0.061, v, zc + 0.01], alpha('#f6ecd6', 0.9), 0.9);
    iso.poly([[0.061, v - 0.01, zc + 0.01], [0.061, v + 0.01, zc + 0.01], [0.061, v, zc - 0.003]], alpha('#f6ecd6', 0.9));
    iso.ellipse(0.061, v, zc + 0.02, 0.005, alpha('#f6ecd6', 0.9));
  }
  const c1 = variant === 0 ? '#3a86c8' : '#e4572e';
  const c2 = variant === 0 ? '#f2c14e' : '#3aa36b';
  quarterPipe(iso, 0.14, 0.94, 0.1, 0.22, z0, 0.15, c1);
  // graffiti splashes on the ramp
  for (let i = 0; i < 5; i++) iso.ellipse(0.2 + i * 0.15, 0.24, z0 + 0.03, 0.03, alpha(pick(rng, ['#f2c14e', '#e07a9a', '#f1ebdd', '#3aa36b']), 0.6));
  // funbox with a rail in the middle
  const fb: [number, number, number, number] = variant === 0 ? [0.35, 0.45, 0.65, 0.62] : [0.3, 0.5, 0.7, 0.64];
  iso.aoRect(fb[0], fb[1], fb[2], fb[3], z0, 0.04, 0.3);
  iso.poly([[fb[0] - 0.1, fb[1], z0], [fb[0], fb[1], z0 + 0.05], [fb[0], fb[3], z0 + 0.05], [fb[0] - 0.1, fb[3], z0]], shade(c2, 0.1));
  iso.box(fb[0], fb[1], fb[2], fb[3], z0, z0 + 0.05, mat(c2));
  iso.poly([[fb[2], fb[1], z0 + 0.05], [fb[2] + 0.1, fb[1], z0], [fb[2] + 0.1, fb[3], z0], [fb[2], fb[3], z0 + 0.05]], shade(c2, -0.2));
  iso.poly([[fb[2], fb[3], z0 + 0.05], [fb[2] + 0.1, fb[3], z0], [fb[2], fb[3], z0]], shade(c2, -0.05));
  iso.line([fb[0] + 0.02, (fb[1] + fb[3]) / 2, z0 + 0.075], [fb[2] - 0.02, (fb[1] + fb[3]) / 2, z0 + 0.075], '#d0d4d8', 1.6);
  pole(iso, fb[0] + 0.03, (fb[1] + fb[3]) / 2, z0 + 0.05, 0.025, '#777', 1);
  pole(iso, fb[2] - 0.03, (fb[1] + fb[3]) / 2, z0 + 0.05, 0.025, '#777', 1);
  // skaters and onlookers
  person(iso, rng, 0.5, 0.2, z0 + 0.04, '#e4572e', 0.85);
  person(iso, rng, 0.5, 0.54, z0 + 0.05, '#f1ebdd', 0.85);
  person(iso, rng, 0.8, 0.75, z0, '#b44ca0', 0.85);
  // pyramid/kicker in front
  iso.poly([[0.3, 0.8, z0], [0.45, 0.8, z0 + 0.05], [0.45, 0.92, z0 + 0.05], [0.3, 0.92, z0]], shade('#c3bdb0', 0.12), alpha('#555', 0.4), 0.8);
  iso.box(0.45, 0.8, 0.52, 0.92, z0, z0 + 0.05, mat('#b8b0a0'));
  bench(iso, 0.88, 0.45, z0, 'v', 0.14, '#e4572e');
  sitter(iso, rng, 0.9, 0.5, z0 + 0.03);
  chaiStall(iso, rng, 0.78, 0.82, z0, 0.75);
}

// ============================================================================
// BLEACHERS BY THE FIELD (1×1, hidden): concrete gallery facing a dusty ground
// ============================================================================

function drawBleachers(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('bleachers_field', variant);
  const z0 = 0.02;
  maidan(iso, rng, z0, '#c9a878');
  tufts(iso, rng, 0.04, 0.04, 0.96, 0.96, z0, 30);
  iso.poly(iso.topQuad(0.1, 0.55, 0.98, 0.98, z0 + 0.001), alpha('#7f9a48', 0.5));
  iso.line([0.1, 0.62, z0 + 0.002], [0.98, 0.62, z0 + 0.002], LIME, 1.4);
  const paint = variant === 0 ? ['#3a86c8', '#f1ebdd', '#f2c14e'] : [C.concrete];
  const front = gallery(iso, rng, 'u', 0.1, 0.92, 0.06, 5, z0, { depth: 0.07, rise: 0.035, fill: 0.8, paint });
  if (variant === 1) {
    // tin canopy on steel posts over the gallery
    const zt = z0 + 0.3;
    for (const u of [0.12, 0.5, 0.9]) {
      pole(iso, u, 0.08, z0 + 0.17, zt - z0 - 0.17, '#5a5f66', 2);
      pole(iso, u, front - 0.02, z0, zt - z0 - 0.02, '#5a5f66', 2);
    }
    const roof: P3[] = [[0.08, 0.04, zt + 0.02], [0.94, 0.04, zt + 0.02], [0.94, front + 0.03, zt - 0.02], [0.08, front + 0.03, zt - 0.02]];
    iso.poly([roof[3], roof[2], [roof[2][0], roof[2][1], roof[2][2] - 0.012], [roof[3][0], roof[3][1], roof[3][2] - 0.012]], shade(C.tin, -0.35));
    iso.poly(roof, shade(C.tin, 0.05), alpha('#1e1a14', 0.5), 0.8);
    iso.clipped(roof, () => {
      for (let u = 0.08; u < 0.94; u += 0.02) iso.line([u, 0.04, zt + 0.02], [u, front + 0.03, zt - 0.02], alpha(shade(C.tin, -0.3), 0.5), 0.6);
      for (let i = 0; i < 5; i++) iso.ellipse(0.15 + rng() * 0.7, 0.1 + rng() * 0.3, zt, 0.03, alpha(C.rust, 0.45));
    });
  } else {
    bunting(iso, [0.1, 0.06, z0 + 0.26], [0.92, 0.06, z0 + 0.26], 12);
    pole(iso, 0.1, 0.06, z0 + 0.175, 0.085);
    pole(iso, 0.92, 0.06, z0 + 0.175, 0.085);
    signBoard(iso, 0.36, 0.44, z0, 0.3, 0.06, '#f2c14e', '#b0302a');
  }
  // players on the ground
  person(iso, rng, 0.35, 0.78, z0, '#f1ebdd', 0.9);
  person(iso, rng, 0.62, 0.72, z0, '#f1ebdd', 0.9);
  person(iso, rng, 0.75, 0.88, z0, '#e4572e', 0.9);
  iso.tree(0.06, 0.8, z0, 0.1, rng, 'neem');
}

// ============================================================================
// Shared ground-level helpers for the big grounds
// ============================================================================

/** Circle (horizontal) as a polygon, for clipping. */
function circlePts(u: number, v: number, r: number, z: number, n = 40): P3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [u + Math.cos(a) * r, v + Math.sin(a) * r, z] as P3;
  });
}

/** Mown green (stripes along u) clipped to a polygon. */
function mownGreen(iso: Iso, rng: Rng, pts: readonly P3[], base: string, z: number, u0: number, v0: number, u1: number, v1: number): void {
  iso.poly(pts, base);
  iso.clipped(pts, () => {
    const stripe = alpha(shade(base, 0.1), 0.55);
    for (let u = u0; u < u1; u += 0.2) iso.poly(iso.topQuad(u, v0, u + 0.1, v1, z), stripe);
  });
  iso.speckle(pts, rng, Math.round(500 * (u1 - u0) * (v1 - v0)), [shade(base, 0.16), shade(base, -0.16), '#9cbc5a'], 1.2);
}

/** Cricket pitch strip along v with creases and stumps. */
function cricketPitch(iso: Iso, rng: Rng, cu: number, cv: number, z: number, len: number, wid: number): void {
  const pts = iso.topQuad(cu - wid, cv - len, cu + wid, cv + len, z);
  iso.poly(pts, '#cdb07a');
  iso.speckle(pts, rng, 80, [alpha('#b39460', 0.8), alpha('#e2c898', 0.8)], 1.2);
  for (const s of [-1, 1]) {
    const ve = cv + s * (len - 0.03);
    iso.line([cu - wid, ve, z], [cu + wid, ve, z], LIME, 1.1);
    iso.line([cu - wid, ve - s * 0.02, z], [cu + wid, ve - s * 0.02, z], LIME, 0.9);
    for (const du of [-0.008, 0, 0.008]) iso.line([cu + du, ve, z], [cu + du, ve, z + 0.03], '#f1e4c8', 1.1);
    iso.line([cu - 0.009, ve, z + 0.031], [cu + 0.009, ve, z + 0.031], '#d9a52b', 0.9);
  }
}

/** Blackboard scoreboard on two legs, facing +v. */
function scoreboard(iso: Iso, u: number, v: number, z: number, w: number, hgt: number): void {
  pole(iso, u + 0.02, v, z, 0.08, '#4a3a2a', 1.8);
  pole(iso, u + w - 0.02, v, z, 0.08, '#4a3a2a', 1.8);
  const zb = z + 0.08;
  iso.box(u, v - 0.012, u + w, v, zb, zb + hgt, mat('#2e3a34'));
  iso.poly(iso.faceVQuad(v, u, u + w, zb + hgt - 0.02, zb + hgt), '#8c3b2b');
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      const a = u + 0.03 + c * (w - 0.06) / 4;
      const zz = zb + 0.02 + r * (hgt - 0.05) / 3;
      iso.poly(iso.faceVQuad(v, a, a + (w - 0.06) / 4 - 0.02, zz, zz + (hgt - 0.05) / 3 - 0.012), alpha('#f1ebdd', r === 2 && c < 2 ? 0.95 : 0.7));
    }
}

/** Small cream-and-maroon club pavilion with a tin-roofed veranda facing +v. */
function pavilion(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number): void {
  govBlock(iso, rng, u0, v0, u1, v1, z, 0.16, { arches: true });
  // veranda (tin lean-to) on the lit side with benches
  const vv = v1 + 0.1;
  iso.poly(iso.topQuad(u0, v1, u1, vv, z + 0.002), '#bdb6a8');
  for (let i = 0; i < 3; i++) sitter(iso, rng, u0 + 0.06 + i * ((u1 - u0 - 0.12) / 2), v1 + 0.05, z + 0.02);
  for (const u of [u0 + 0.01, (u0 + u1) / 2, u1 - 0.01]) pole(iso, u, vv, z, 0.11, '#5a5f66', 1.6);
  const roof: P3[] = [[u0 - 0.02, v1, z + 0.14], [u1 + 0.02, v1, z + 0.14], [u1 + 0.02, vv + 0.02, z + 0.105], [u0 - 0.02, vv + 0.02, z + 0.105]];
  iso.poly([roof[3], roof[2], [roof[2][0], roof[2][1], roof[2][2] - 0.01], [roof[3][0], roof[3][1], roof[3][2] - 0.01]], shade('#2f7d6d', -0.35));
  iso.poly(roof, '#2f7d6d', alpha('#10201a', 0.5), 0.8);
  iso.clipped(roof, () => {
    for (let u = u0 - 0.02; u < u1 + 0.02; u += 0.02) iso.line([u, v1, z + 0.14], [u, vv + 0.02, z + 0.105], alpha('#1e4a40', 0.5), 0.6);
  });
  drum(iso, u0 + 0.08, v0 + 0.08, z + 0.21, 0.04, 0.07, '#26272b');
  flag(iso, u1 - 0.04, v0 + 0.04, z + 0.21, 0.18, C.saffron);
}

// ============================================================================
// CRICKET GROUND (baseball_field_small, 2×2)
// ============================================================================

function drawCricketGround(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('baseball_field_small', variant);
  const z0 = 0.025;
  maidan(iso, rng, z0, variant === 0 ? '#c4a67c' : '#c9ab7e');
  tufts(iso, rng, 0.05, 0.05, 1.95, 1.95, z0, 60);
  const cu = 1.02;
  const cv = 1.02;
  const R = 0.86;
  const field = circlePts(cu, cv, R, z0 + 0.002, 48);
  mownGreen(iso, rng, field, variant === 0 ? '#6e9a3e' : '#86a04c', z0 + 0.002, cu - R, cv - R, cu + R, cv + R);
  if (variant === 1) {
    for (let i = 0; i < 6; i++) dustPatch(iso, rng, cu + (rng() - 0.5) * 1.1, cv + (rng() - 0.5) * 1.1, z0 + 0.003, 0.12, alpha('#c9ab7e', 0.7), 4);
  }
  // bald square round the pitch, 30-yard circle, boundary rope
  iso.ellipse(cu, cv, z0 + 0.003, 0.2, alpha('#b9a06a', 0.45));
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    iso.ellipse(cu + Math.cos(a) * 0.48, cv + Math.sin(a) * 0.48, z0 + 0.004, 0.006, LIME);
  }
  iso.ellipse(cu, cv, z0 + 0.004, R - 0.03, null, alpha('#f6f2e6', 0.9), 1.6);
  cricketPitch(iso, rng, cu, cv, z0 + 0.004, 0.2, 0.035);
  // back corner: pavilion (v0) or a judges' shamiana (v1)
  if (variant === 0) {
    iso.tree(0.12, 0.62, z0, 0.13, rng, 'neem');
    pavilion(iso, rng, 0.14, 0.12, 0.56, 0.3, z0);
    scoreboard(iso, 1.5, 0.14, z0, 0.3, 0.12);
    iso.tree(1.88, 0.2, z0, 0.14, rng, 'neem');
  } else {
    paintedWall(iso, rng, 'u', 0.03, 0.05, 1.97, z0, 0.1, { band: '#8c3b2b', ads: 4, wall: '#f0dfa6' });
    paintedWall(iso, rng, 'v', 0.03, 0.14, 1.97, z0, 0.1, { band: '#8c3b2b', ads: 4, wall: '#f0dfa6' });
    shamiana(iso, 0.12, 0.12, 0.44, 0.4, z0, 0.16, '#c0392b', '#f2c14e');
    for (let i = 0; i < 4; i++) sitter(iso, rng, 0.2 + i * 0.06, 0.34, z0);
    // practice nets (tunnel of netting on bamboo poles) on the right edge
    const nu0 = 1.62;
    const nu1 = 1.8;
    const nv0 = 0.3;
    const nv1 = 0.95;
    iso.poly(iso.topQuad(nu0, nv0, nu1, nv1, z0 + 0.003), '#4f8a4a');
    iso.line([(nu0 + nu1) / 2, nv0 + 0.05, z0 + 0.004], [(nu0 + nu1) / 2, nv1 - 0.1, z0 + 0.004], alpha('#f1ebdd', 0.7), 1);
    meshFence(iso, 'v', nu0, nv0, nv1, z0, 0.16, '#3a3a3a');
    meshFence(iso, 'u', nv0, nu0, nu1, z0, 0.16, '#3a3a3a');
    person(iso, rng, (nu0 + nu1) / 2, nv0 + 0.12, z0, '#f1ebdd', 0.9, '#f1ebdd');
    person(iso, rng, (nu0 + nu1) / 2 + 0.02, nv1 - 0.1, z0, '#3a86c8', 0.9);
    meshFence(iso, 'v', nu1, nv0, nv1, z0, 0.16, '#3a3a3a');
    iso.line([nu0, nv0, z0 + 0.16], [nu1, nv0, z0 + 0.16], '#6b4a2a', 1);
    iso.line([nu0, nv1, z0 + 0.16], [nu1, nv1, z0 + 0.16], '#6b4a2a', 1);
    scoreboard(iso, 0.9, 0.14, z0, 0.26, 0.1);
  }
  // players: whites (v0) or mixed colours (gully cricket, v1)
  const kit = (i: number) => (variant === 0 ? '#f6f2e6' : CROWD[i % CROWD.length]);
  const legs = variant === 0 ? '#f1ebdd' : '#2f2a33';
  const ppl: [number, number, string, string, number][] = [
    [cu, cv + 0.19, variant === 0 ? '#f6f2e6' : '#3a86c8', legs, 1],
    [cu + 0.01, cv + 0.29, variant === 0 ? '#f6f2e6' : '#e4572e', legs, 1],
    [cu + 0.05, cv - 0.18, kit(2), legs, 1],
    [cu - 0.03, cv - 0.3, kit(3), legs, 1],
    [cu - 0.04, cv - 0.23, '#f1ebdd', '#2a2a2e', 1],
  ];
  const fielders: [number, number][] = [[0.45, 0.8], [0.6, 1.5], [1.5, 0.6], [1.45, 1.45], [1.0, 0.5], [0.72, 1.12], [1.28, 1.25], [1.3, 0.85], [1.15, 1.72]];
  fielders.forEach(([fu, fv], i) => ppl.push([fu, fv, kit(i + 4), legs, 1]));
  ppl.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [pu, pv, c, l, s] of ppl) person(iso, rng, pu, pv, z0 + 0.004, c, s, l);
  iso.ellipse(cu + 0.01, cv + 0.05, z0 + 0.06, 0.006, '#b0302a');
  // spectators on the edges, under trees; chai at the front corner
  for (let i = 0; i < 9; i++) sitter(iso, rng, 0.2 + i * 0.04, 1.62 + i * 0.03 + rng() * 0.02, z0);
  for (let i = 0; i < 7; i++) sitter(iso, rng, 1.66 + i * 0.03, 0.96 + i * 0.05, z0);
  iso.tree(0.16, 1.86, z0, 0.14, rng, 'neem');
  chaiStall(iso, rng, 1.68, 1.72, z0);
  bunting(iso, [0.14, 0.12, z0 + 0.25], [0.12, 1.2, z0 + 0.2], 12);
  pole(iso, 0.12, 1.2, z0, 0.2);
  if (variant === 0) paintedKerb(iso, 'u', 1.98, 0.5, 1.6, z0);
}

// ============================================================================
// FOOTBALL GROUND (football_field, 2×2, hidden on Varanasi)
// ============================================================================

function drawFootballField(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('football_field', variant);
  const z0 = 0.025;
  const u0 = 0.45;
  const u1 = 1.82;
  const v0 = 0.45;
  const v1 = 1.82;
  if (variant === 0) {
    slab(iso, rng, 0.02, z0, '#b9b19d', '#8f8573', ['#aaa28e', '#c7bfab']);
    mownGreen(iso, rng, iso.topQuad(u0 - 0.08, v0 - 0.08, u1 + 0.1, v1 + 0.1, z0 + 0.002), '#6e9a3e', z0 + 0.002, u0 - 0.08, v0 - 0.08, u1 + 0.1, v1 + 0.1);
    // galleries on both back edges
    gallery(iso, rng, 'u', 0.36, 1.9, 0.06, 4, z0, { depth: 0.07, rise: 0.04, fill: 0.75, paint: ['#3a86c8', '#f1ebdd', '#e4572e'] });
    gallery(iso, rng, 'v', 0.36, 1.9, 0.06, 4, z0, { depth: 0.07, rise: 0.04, fill: 0.75, paint: ['#3a86c8', '#f1ebdd', '#e4572e'] });
    // corner block (club house) at the very back
    govBlock(iso, rng, 0.04, 0.04, 0.34, 0.34, z0, 0.22);
    flag(iso, 0.3, 0.08, z0 + 0.27, 0.2, C.saffron);
  } else {
    maidan(iso, rng, z0, '#c9a878');
    tufts(iso, rng, 0.05, 0.05, 1.95, 1.95, z0, 60);
    iso.poly(iso.topQuad(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, z0 + 0.002), alpha('#7f9a48', 0.55));
    for (let i = 0; i < 7; i++) dustPatch(iso, rng, u0 + rng() * (u1 - u0), v0 + rng() * (v1 - v0), z0 + 0.003, 0.14, alpha('#c9a878', 0.75), 4);
    iso.tree(0.14, 0.14, z0, 0.18, rng, 'neem');
    iso.tree(1.2, 0.12, z0, 0.14, rng, 'peepal');
    paintedWall(iso, rng, 'u', 0.03, 0.3, 1.97, z0, 0.1, { band: '#2f7d6d', ads: 4 });
    paintedWall(iso, rng, 'v', 0.03, 0.3, 1.97, z0, 0.1, { band: '#2f7d6d', ads: 4 });
    for (let u = 0.5; u < 1.8; u += 0.04) sitter(iso, rng, u, 0.2 + rng() * 0.06, z0);
    shamiana(iso, 0.12, 0.6, 0.36, 1.1, z0, 0.16, '#2f6fb3', '#f1ebdd');
    for (let i = 0; i < 5; i++) sitter(iso, rng, 0.22, 0.7 + i * 0.07, z0);
  }
  fieldMarkings(iso, u0, v0, u1, v1, z0 + 0.003);
  const gm = (u0 + u1) / 2;
  goalPost(iso, [gm - 0.14, v0], [gm + 0.14, v0], z0, 0.09, [0, 1], 0.06);
  const team = variant === 0 ? ['#e4572e', '#f2c14e'] : ['#3aa36b', '#f1ebdd'];
  const ppl: [number, number, string][] = [];
  for (let i = 0; i < 16; i++) ppl.push([u0 + 0.1 + rng() * (u1 - u0 - 0.2), v0 + 0.15 + rng() * (v1 - v0 - 0.3), team[i % 2]]);
  ppl.push([gm, v0 + 0.05, '#2a2a2e'], [gm, v1 - 0.05, '#b44ca0']);
  ppl.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [pu, pv, c] of ppl) person(iso, rng, pu, pv, z0 + 0.003, c, 1, '#2a2a2e');
  iso.ellipse(1.1, 1.2, z0 + 0.015, 0.012, '#fdfdf7', '#555', 0.6);
  goalPost(iso, [gm - 0.14, v1], [gm + 0.14, v1], z0, 0.09, [0, -1], 0.06);
  if (variant === 0) {
    floodlight(iso, 1.95, 0.08, z0, 0.7, 0.9);
    floodlight(iso, 0.08, 1.95, z0, 0.7, 0.9);
    floodlight(iso, 1.94, 1.94, z0, 0.7, 0.9);
  } else {
    chaiStall(iso, rng, 1.7, 1.78, z0);
    iso.tree(0.2, 1.85, z0, 0.13, rng, 'neem');
    paintedKerb(iso, 'u', 1.98, 0.3, 1.5, z0, '#2a2a2e', '#f2c14e');
  }
}

// ============================================================================
// CRICKET STADIUM (baseball_stadium, 3×3, hidden on Varanasi)
// ============================================================================

function drawCricketStadium(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('baseball_stadium', variant);
  const z0 = 0.03;
  slab(iso, rng, 0.02, z0, '#c8bfa9', '#8f8573', ['#b8af99', '#d6cdb7']);
  paving(iso, rng, 0.02, 0.02, 2.98, 2.98, z0, 0.2, 0.2, alpha('#9f9680', 0.35));
  const cu = 1.5;
  const cv = 1.5;
  const Ro = 1.42;
  const Hs = 0.3;
  // corner trees and parking
  for (const [tu, tv] of [[0.2, 0.2], [2.8, 0.25], [0.25, 2.8]] as [number, number][]) iso.tree(tu, tv, z0, 0.16, rng, 'neem');
  iso.aoEllipse(cu, cv, Ro, z0, 0.12, 0.45);
  // outer wall with arches and a maroon band
  iso.lathe(cu, cv, z0, [[0, Ro], [Hs, Ro]], (t) => (t > 0.86 ? C.govMaroon : t < 0.1 ? shade(C.cream, -0.12) : C.cream), { outline: true, lit: 0.18, dark: -0.3 });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    if (Math.cos(a) + Math.sin(a) < 0.15) continue;
    const pu = cu + Math.cos(a) * (Ro + 0.003);
    const pv = cv + Math.sin(a) * (Ro + 0.003);
    const [x, yb] = iso.pt(pu, pv, z0 + 0.03);
    const [, yt] = iso.pt(pu, pv, z0 + 0.18);
    const facing = (Math.cos(a) + Math.sin(a)) / Math.SQRT2;
    const aw = 0.035 * iso.T * Math.abs(Math.cos(a - Math.PI / 4 + Math.PI / 2)) * 0.9 + iso.px;
    ctx.fillStyle = shade('#3a3440', -0.1 + facing * 0.1);
    ctx.beginPath();
    ctx.moveTo(x - aw, yb);
    ctx.lineTo(x - aw, yt + aw);
    ctx.quadraticCurveTo(x, yt - aw * 0.6, x + aw, yt + aw);
    ctx.lineTo(x + aw, yb);
    ctx.closePath();
    ctx.fill();
  }
  // tiered bowl: rings stepping down to the field
  const tiers = 9;
  const Rf = 1.02;
  const seat = variant === 0 ? ['#2f6fb3', '#f1ebdd', '#f39b1d'] : ['#c0392b', '#f1ebdd', '#3aa36b'];
  for (let i = 0; i <= tiers; i++) {
    const t = i / tiers;
    const r = Ro - (Ro - Rf) * t;
    const z = z0 + Hs - (Hs - 0.06) * t;
    const col = i === 0 ? '#e0d6c0' : seat[Math.floor((i - 1) / 3) % seat.length];
    iso.ellipse(cu, cv, z, r, shade(col, i % 2 ? -0.06 : 0.04), alpha('#3a2a20', 0.35), 0.7);
  }
  // crowd specks over the stands
  const { ctx: c2 } = iso;
  for (let i = 0; i < 700; i++) {
    const a = rng() * Math.PI * 2;
    const t = 0.1 + rng() * 0.85;
    const r = Ro - (Ro - Rf) * t;
    const z = z0 + Hs - (Hs - 0.06) * t;
    const [x, y] = iso.pt(cu + Math.cos(a) * r, cv + Math.sin(a) * r, z);
    c2.fillStyle = CROWD[i % CROWD.length];
    c2.fillRect(x - iso.px * 1.4, y - iso.px * 2.8, iso.px * 2.8, iso.px * 2.8);
  }
  // field: boundary ring of ad hoardings, green, pitch
  iso.ellipse(cu, cv, z0 + 0.06, Rf, '#2c2a2e');
  const field = circlePts(cu, cv, Rf - 0.035, z0 + 0.03, 48);
  iso.poly(circlePts(cu, cv, Rf - 0.035, z0 + 0.06, 48), '#e0d6c0');
  mownGreen(iso, rng, field.map((p) => [p[0], p[1], z0 + 0.061] as P3), '#5f9a3a', z0 + 0.061, cu - Rf, cv - Rf, cu + Rf, cv + Rf);
  iso.ellipse(cu, cv, z0 + 0.062, Rf - 0.08, null, alpha('#f6f2e6', 0.9), 1.8);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    iso.ellipse(cu + Math.cos(a) * 0.5, cv + Math.sin(a) * 0.5, z0 + 0.062, 0.006, LIME);
  }
  cricketPitch(iso, rng, cu, cv, z0 + 0.062, 0.2, 0.04);
  // hoardings: coloured boards around the boundary (front half is enough to read)
  for (let i = 0; i < 36; i++) {
    const a0 = (i / 36) * Math.PI * 2;
    const a1 = ((i + 0.9) / 36) * Math.PI * 2;
    const r = Rf - 0.04;
    const p0: P3 = [cu + Math.cos(a0) * r, cv + Math.sin(a0) * r, z0 + 0.06];
    const p1: P3 = [cu + Math.cos(a1) * r, cv + Math.sin(a1) * r, z0 + 0.06];
    const col = ['#f2c14e', '#e4572e', '#3a86c8', '#3aa36b', '#f1ebdd'][i % 5];
    iso.poly([p0, p1, [p1[0], p1[1], p1[2] + 0.025], [p0[0], p0[1], p0[2] + 0.025]], shade(col, Math.cos(a0) + Math.sin(a0) > 0 ? 0 : -0.25));
  }
  const kit = variant === 0 ? '#2f6fb3' : '#f6f2e6';
  const opp = variant === 0 ? '#f2c14e' : '#3aa36b';
  const ppl: [number, number, string][] = [
    [cu, cv + 0.2, opp], [cu + 0.02, cv + 0.3, kit], [cu + 0.03, cv - 0.18, opp], [cu - 0.03, cv - 0.32, kit],
    [1.0, 1.1, kit], [2.0, 1.2, kit], [1.2, 2.05, kit], [1.95, 1.9, kit], [1.5, 0.75, kit], [0.9, 1.7, kit], [2.2, 1.55, kit], [1.7, 2.25, kit],
  ];
  ppl.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [pu, pv, col] of ppl) person(iso, rng, pu, pv, z0 + 0.062, col, 1.1, col === '#f6f2e6' ? '#f1ebdd' : '#1e2a44');
  // roof canopy over the back stands (pavilion side)
  const zr = z0 + Hs + 0.2;
  const arc: P3[] = [];
  const inner: P3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * 0.95 + (i / 16) * Math.PI * 1.1;
    arc.push([cu + Math.cos(a) * (Ro + 0.02), cv + Math.sin(a) * (Ro + 0.02), zr]);
    inner.push([cu + Math.cos(a) * (Ro - 0.24), cv + Math.sin(a) * (Ro - 0.24), zr - 0.03]);
  }
  for (let i = 0; i <= 16; i += 4) {
    const p = arc[i];
    iso.line([p[0], p[1], z0 + Hs], p, '#e0d6c0', 2.4);
  }
  iso.poly([...arc, ...inner.slice().reverse()], '#f1ebdd', alpha('#3a2a20', 0.5), 1);
  iso.polyline(inner, shade(C.govMaroon, 0), 2.6);
  // floodlights on the three back sides (a front one would stand over the pitch)
  const fl = (a: number) => floodlight(iso, cu + Math.cos(a) * (Ro + 0.12), cv + Math.sin(a) * (Ro + 0.12), z0, 1.1, 1.3);
  fl(Math.PI * 1.25);
  fl(Math.PI * 1.75);
  fl(Math.PI * 0.75);
  // gate plaza, flags and crowds in front
  for (let i = 0; i < 14; i++) person(iso, rng, 2.3 + rng() * 0.6, 2.3 + rng() * 0.6, z0, pick(rng, CROWD), 1);
  for (const [fu, fv] of [[2.9, 1.6], [1.6, 2.9]] as [number, number][]) flag(iso, fu, fv, z0, 0.35, C.saffron);
  chaiStall(iso, rng, 2.62, 2.0, z0, 1.3);
}

// ============================================================================
// MINI GOLF (2×2, hidden): garden course with a chhatri, a lotus pond and a gateway
// ============================================================================

function golfHole(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, cup: [number, number], flagCol: string): void {
  const m = mat(C.brick, { top: 0.12 });
  iso.aoRect(u0, v0, u1, v1, z, 0.03, 0.3);
  iso.box(u0, v0, u1, v1, z, z + 0.018, m, { noTop: true });
  const felt = iso.topQuad(u0 + 0.018, v0 + 0.018, u1 - 0.018, v1 - 0.018, z + 0.012);
  iso.poly(iso.topQuad(u0, v0, u1, v1, z + 0.018), shade(C.brick, 0.1));
  iso.poly(felt, '#3fa656');
  iso.speckle(felt, rng, 60, [alpha('#56bf6a', 0.7), alpha('#2f8a44', 0.7)], 1.2);
  iso.ellipse(cup[0], cup[1], z + 0.013, 0.014, '#1e2a1e');
  iso.line([cup[0], cup[1], z + 0.013], [cup[0], cup[1], z + 0.1], '#e8e8e0', 1.2);
  iso.poly([[cup[0], cup[1], z + 0.1], [cup[0] + 0.035, cup[1] - 0.035, z + 0.088], [cup[0], cup[1], z + 0.075]], flagCol);
  iso.ellipse(u0 + 0.05, v0 + 0.05, z + 0.016, 0.006, '#fdfdf7');
}

function drawMiniGolf(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('mini_golf_course', variant);
  const z0 = 0.025;
  slab(iso, rng, 0.02, z0, C.lawn, '#6f5a3e');
  lawn(iso, rng, 0.02, 0.02, 1.98, 1.98, z0, C.lawn);
  // red-brick paths
  for (const q of [[0.9, 0.05, 1.08, 1.95], [0.05, 0.9, 1.95, 1.08]] as [number, number, number, number][]) {
    iso.poly(iso.topQuad(q[0], q[1], q[2], q[3], z0 + 0.002), '#b8745a');
    paving(iso, rng, q[0], q[1], q[2], q[3], z0 + 0.002, 0.06, 0.06, alpha('#7a4230', 0.4));
  }
  iso.tree(0.1, 0.1, z0, 0.16, rng, 'neem');
  paintedWall(iso, rng, 'u', 0.03, 0.26, 1.97, z0, 0.09, { band: '#2f7d6d', ads: 3 });
  paintedWall(iso, rng, 'v', 0.03, 0.26, 1.97, z0, 0.09, { band: '#2f7d6d', ads: 3 });
  // hole 1 (back quadrant) with a sandstone chhatri over the fairway
  golfHole(iso, rng, 0.25, 0.2, 0.8, 0.75, z0, [0.7, 0.65], '#e4572e');
  chhatri(iso, rng, 0.42, 0.36, z0 + 0.018, 0.16, C.chunar, shade(C.chunar, 0.06));
  // hole 2 (right) with a mini gateway arch
  golfHole(iso, rng, 1.2, 0.2, 1.8, 0.78, z0, [1.7, 0.68], '#f2c14e');
  const gu = 1.44;
  const gv = 0.42;
  iso.box(gu, gv, gu + 0.2, gv + 0.06, z0 + 0.018, z0 + 0.16, mat(C.pinkSand));
  iso.archV(gv + 0.06, gu + 0.06, gu + 0.14, z0 + 0.018, z0 + 0.11, '#3a2c22', true);
  iso.box(gu - 0.01, gv - 0.01, gu + 0.21, gv + 0.07, z0 + 0.16, z0 + 0.175, mat('#efdcb8'));
  dome(iso, gu + 0.1, gv + 0.03, z0 + 0.175, 0.04, '#efdcb8', 'onion');
  // hole 3 (left) around a lotus pond
  golfHole(iso, rng, 0.2, 1.2, 0.8, 1.8, z0, [0.7, 1.7], '#3a86c8');
  const pond = circlePts(0.45, 1.42, 0.12, z0 + 0.02, 24);
  iso.cylinder(0.45, 1.42, 0.14, z0 + 0.012, z0 + 0.026, C.chunar, shade(C.chunar, 0.1));
  waterSurface(iso, rng, pond.map((p) => [p[0], p[1], z0 + 0.027] as P3), '#4f8a8c', '#356e74');
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * 0.08;
    iso.ellipse(0.45 + Math.cos(a) * d, 1.42 + Math.sin(a) * d, z0 + 0.028, 0.018, '#4f8a3a');
    if (i % 2 === 0) iso.ellipse(0.45 + Math.cos(a) * d, 1.42 + Math.sin(a) * d, z0 + 0.033, 0.009, '#f08fb0');
  }
  // hole 4 (front) with a zig-zag of brick bumpers
  golfHole(iso, rng, 1.2, 1.2, 1.8, 1.8, z0, [1.7, 1.7], '#b44ca0');
  for (let i = 0; i < 3; i++) iso.box(1.3 + i * 0.14, 1.35 + (i % 2) * 0.2, 1.34 + i * 0.14, 1.55 + (i % 2) * 0.2, z0 + 0.018, z0 + 0.04, mat(C.brick));
  // ticket kiosk shamiana + players
  shamiana(iso, 0.96, 0.96, 1.14, 1.14, z0, 0.14, '#c0392b', '#f2c14e');
  person(iso, rng, 0.55, 0.55, z0 + 0.018, '#f2c14e');
  person(iso, rng, 1.5, 0.6, z0 + 0.018, '#e07a9a', 0.9);
  person(iso, rng, 0.35, 1.65, z0 + 0.018, '#3a86c8');
  person(iso, rng, 1.35, 1.72, z0 + 0.018, '#f1ebdd');
  person(iso, rng, 1.0, 1.5, z0, '#3aa36b');
  iso.tree(1.9, 1.1, z0, 0.1, rng, 'ashoka');
  iso.tree(1.1, 1.9, z0, 0.1, rng, 'ashoka');
  if (variant === 1) chaiStall(iso, rng, 1.78, 1.84, z0);
  bunting(iso, [0.96, 0.96, z0 + 0.14], [1.9, 0.12, z0 + 0.18], 12);
}

// ============================================================================
// GO-KART TRACK (2×2, hidden)
// ============================================================================

/** Rounded-rectangle outline (u, v points) centred on (cu, cv). */
function roundRect(cu: number, cv: number, hu: number, hv: number, r: number, per = 6): [number, number][] {
  const out: [number, number][] = [];
  const corners: [number, number, number][] = [
    [cu + hu - r, cv + hv - r, 0],
    [cu - hu + r, cv + hv - r, Math.PI / 2],
    [cu - hu + r, cv - hv + r, Math.PI],
    [cu + hu - r, cv - hv + r, Math.PI * 1.5],
  ];
  for (const [ccu, ccv, a0] of corners)
    for (let i = 0; i <= per; i++) {
      const a = a0 + (i / per) * (Math.PI / 2);
      out.push([ccu + Math.cos(a) * r, ccv + Math.sin(a) * r]);
    }
  return out;
}

/** Tiny kart pointing along (tu, tv). */
function kart(iso: Iso, rng: Rng, u: number, v: number, z: number, tu: number, tv: number, color: string): void {
  const nu = -tv;
  const nv = tu;
  const L = 0.045;
  const W = 0.025;
  const c = (a: number, b: number, zz: number): P3 => [u + tu * a + nu * b, v + tv * a + nv * b, zz];
  iso.ellipse(u + 0.01, v, z, 0.03, 'rgba(30,20,14,0.3)');
  iso.poly([c(-L, -W, z + 0.012), c(L, -W * 0.7, z + 0.012), c(L, W * 0.7, z + 0.012), c(-L, W, z + 0.012)], color, alpha(shade(color, -0.6), 0.8), 0.8);
  for (const [a, b] of [[-L * 0.7, -W], [-L * 0.7, W], [L * 0.7, -W], [L * 0.7, W]] as [number, number][]) iso.ellipse(...c(a, b, z + 0.006), 0.007, '#1a1a1c');
  const [hx, hy] = iso.pt(...c(-L * 0.2, 0, z + 0.03));
  iso.ctx.beginPath();
  iso.ctx.arc(hx, hy, 0.009 * iso.T, 0, Math.PI * 2);
  iso.ctx.fillStyle = pick(rng, ['#f1ebdd', '#e4572e', '#f2c14e', '#2a2a2e']);
  iso.ctx.fill();
}

function drawGoKart(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('go_kart_track', variant);
  const z0 = 0.025;
  maidan(iso, rng, z0, '#c4a67c');
  tufts(iso, rng, 0.05, 0.05, 1.95, 1.95, z0, 50);
  const cu = 1.05;
  const cv = 1.08;
  const outer = roundRect(cu, cv, 0.82, 0.78, 0.3, 7);
  const inner = roundRect(cu, cv, 0.56, 0.52, 0.12, 5);
  const zt = z0 + 0.003;
  const P = (pts: [number, number][], z: number) => pts.map(([a, b]) => [a, b, z] as P3);
  iso.poly(P(outer, zt), '#4a4a4f');
  iso.speckle(P(outer, zt), rng, 500, [alpha('#5c5c62', 0.8), alpha('#3a3a3e', 0.8)], 1.2);
  // kerbs (red / white) on both edges
  const kerbs = (pts: [number, number][]) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        iso.line([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, zt + 0.002], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, zt + 0.002], (i + k) % 2 ? '#d9362b' : '#f6f2e6', 3.2);
      }
    }
  };
  kerbs(outer);
  // infield: grass with a pit building and grandstand
  iso.poly(P(inner, zt + 0.001), '#74a043');
  iso.speckle(P(inner, zt + 0.001), rng, 400, ['#86b050', '#5d8a35'], 1.2);
  kerbs(inner);
  // start line (chequered) on the front straight
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 2; j++)
      iso.poly(iso.topQuad(cu + 0.57 + i * 0.04, cv - 0.1 + j * 0.03, cu + 0.61 + i * 0.04, cv - 0.07 + j * 0.03, zt + 0.002), (i + j) % 2 ? '#f6f2e6' : '#1e1e22');
  // infield props
  const pitCol = variant === 0 ? '#e4572e' : '#2f6fb3';
  iso.tree(0.75, 0.75, zt, 0.14, rng, 'neem');
  shamiana(iso, 0.9, 1.05, 1.3, 1.3, zt, 0.14, pitCol, '#f1ebdd');
  for (let i = 0; i < 4; i++) tyre(iso, 0.98 + i * 0.05, 0.68, zt, 0.022, i % 2 ? '#f6f2e6' : '#d9362b');
  gallery(iso, rng, 'v', 0.8, 1.38, 1.26, 3, zt, { depth: 0.06, rise: 0.035, fill: 0.8, paint: [pitCol, '#f1ebdd'] });
  // tyre walls on the outside corners
  const walls: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    walls.push([cu + Math.cos(a) * 0.95, cv + Math.sin(a) * 0.9]);
  }
  const backWalls = walls.filter(([a, b]) => a + b < cu + cv);
  const frontWalls = walls.filter(([a, b]) => a + b >= cu + cv);
  for (const [a, b] of backWalls) for (let k = 0; k < 3; k++) tyre(iso, a + k * 0.03, b - k * 0.03, z0, 0.02, k % 2 ? '#2b2b2e' : '#f2c14e');
  // karts on the track
  const onTrack = (idx: number, off: number, col: string) => {
    const i0 = idx % outer.length;
    const a = outer[i0];
    const b = outer[(i0 + 1) % outer.length];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tu = (b[0] - a[0]) / tl;
    const tv = (b[1] - a[1]) / tl;
    const pu = a[0] - tv * off;
    const pv = a[1] + tu * off;
    kart(iso, rng, pu, pv, zt, -tu, -tv, col);
  };
  const cols = ['#e4572e', '#f2c14e', '#3a86c8', '#3aa36b', '#b44ca0'];
  const picks = variant === 0 ? [2, 5, 9, 17, 25] : [1, 3, 12, 20, 22];
  picks.forEach((p, i) => onTrack(p, 0.12 + (i % 2) * 0.06, cols[i]));
  for (const [a, b] of frontWalls) for (let k = 0; k < 2; k++) tyre(iso, a + k * 0.03, b - k * 0.03, z0, 0.02, k % 2 ? '#2b2b2e' : '#f6f2e6');
  // spectators on the front edge + flag marshal
  for (let i = 0; i < 8; i++) person(iso, rng, 1.9, 0.5 + i * 0.1, z0, pick(rng, CROWD), 0.9);
  bunting(iso, [0.1, 0.1, z0 + 0.2], [1.95, 0.12, z0 + 0.16], 16);
  pole(iso, 0.1, 0.1, z0, 0.2);
  pole(iso, 1.95, 0.12, z0, 0.16);
}

// ============================================================================
// MELA RIDES (roller_coaster_small, 2×2, hidden): a dragon coaster or a giant wheel
// ============================================================================

function melaStall(iso: Iso, rng: Rng, u: number, v: number, z: number, c1: string, c2: string): void {
  shamiana(iso, u, v, u + 0.18, v + 0.14, z, 0.12, c1, c2);
  iso.box(u + 0.02, v + 0.1, u + 0.16, v + 0.14, z, z + 0.04, mat('#8a5a34'));
  for (let i = 0; i < 5; i++) iso.ellipse(u + 0.035 + i * 0.028, v + 0.12, z + 0.045, 0.01, pick(rng, ['#f2c14e', '#e4572e', '#f08fb0', '#3aa36b', '#f1ebdd']));
}

function balloons(iso: Iso, rng: Rng, u: number, v: number, z: number): void {
  person(iso, rng, u, v, z, '#f1ebdd', 0.9);
  const [x, y] = iso.pt(u, v, z + 0.07);
  for (let i = 0; i < 7; i++) {
    const bx = x + (rng() - 0.5) * 0.08 * iso.T;
    const by = y - (0.07 + rng() * 0.06) * iso.T;
    iso.ctx.strokeStyle = alpha('#555', 0.6);
    iso.ctx.lineWidth = 0.6 * iso.px;
    iso.ctx.beginPath();
    iso.ctx.moveTo(x, y);
    iso.ctx.lineTo(bx, by);
    iso.ctx.stroke();
    iso.blob(bx, by, 0.014 * iso.T, pick(rng, ['#e4572e', '#f2c14e', '#3a86c8', '#b44ca0', '#3aa36b', '#f08fb0']), 0.4);
  }
}

function drawMelaRides(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('roller_coaster_small', variant);
  const z0 = 0.025;
  maidan(iso, rng, z0, '#c9ab7e');
  tufts(iso, rng, 0.05, 0.05, 1.95, 1.95, z0, 40);
  for (let i = 0; i < 6; i++) dustPatch(iso, rng, 0.3 + rng() * 1.4, 0.3 + rng() * 1.4, z0 + 0.001, 0.14, alpha('#d9bf92', 0.6), 4);
  if (variant === 0) iso.tree(0.12, 0.12, z0, 0.16, rng, 'neem');
  else iso.tree(0.14, 0.95, z0, 0.15, rng, 'neem');
  if (variant === 0) drawCoaster(iso, rng, z0);
  else drawGiantWheel(iso, rng, z0);
}

function drawCoaster(iso: Iso, rng: Rng, z0: number): void {
  const N = 72;
  const cu = 1.02;
  const cv = 1.0;
  const pts: P3[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const lift = Math.exp(-Math.pow(((a - Math.PI * 1.25 + Math.PI * 3) % (Math.PI * 2)) - Math.PI, 2) / 0.35);
    const z = z0 + 0.1 + 0.08 * (0.5 + 0.5 * Math.cos(a * 3)) + 0.34 * lift;
    pts.push([cu + Math.cos(a) * 0.72, cv + Math.sin(a) * 0.62, z]);
  }
  // station, stalls and people behind the ride first
  melaStall(iso, rng, 0.35, 0.12, z0, '#c0392b', '#f2c14e');
  melaStall(iso, rng, 0.75, 0.1, z0, '#2f6fb3', '#f1ebdd');
  // segments in depth order (back to front) with supports
  const segs = pts.map((p, i) => ({ p, q: pts[(i + 1) % N], i, d: p[0] + p[1] }));
  segs.sort((a, b) => a.d - b.d);
  const track = '#d9362b';
  for (const { p, q, i } of segs) {
    if (i % 3 === 0) {
      iso.line([p[0], p[1], z0], p, alpha('#2a2a2e', 0.6), 2.6);
      iso.line([p[0], p[1], z0], p, '#e8d24a', 1.4);
      if (p[2] - z0 > 0.2) iso.line([p[0] - 0.03, p[1] - 0.03, z0], [p[0], p[1], p[2] * 0.6], alpha('#c9b43a', 0.8), 1);
    }
    const tu = q[0] - p[0];
    const tv = q[1] - p[1];
    const tl = Math.hypot(tu, tv) || 1;
    const nu = (-tv / tl) * 0.022;
    const nv = (tu / tl) * 0.022;
    iso.poly([[p[0] - nu, p[1] - nv, p[2]], [q[0] - nu, q[1] - nv, q[2]], [q[0] + nu, q[1] + nv, q[2]], [p[0] + nu, p[1] + nv, p[2]]], alpha('#3a2a20', 0.35));
    iso.line([p[0] - nu, p[1] - nv, p[2]], [q[0] - nu, q[1] - nv, q[2]], track, 1.8);
    iso.line([p[0] + nu, p[1] + nv, p[2]], [q[0] + nu, q[1] + nv, q[2]], track, 1.8);
    iso.line([p[0] - nu, p[1] - nv, p[2] - 0.012], [p[0] + nu, p[1] + nv, p[2] - 0.012], alpha('#5a5f66', 0.8), 1);
    // dragon train on the front stretch
    if (i >= 6 && i <= 12 && i % 2 === 0) {
      const col = i === 12 ? '#3aa36b' : ['#f2c14e', '#e4572e', '#3a86c8'][(i / 2) % 3];
      const zc = p[2] + 0.008;
      iso.poly([[p[0] - nu * 1.4, p[1] - nv * 1.4, zc], [q[0] - nu * 1.4, q[1] - nv * 1.4, q[2] + 0.008], [q[0] + nu * 1.4, q[1] + nv * 1.4, q[2] + 0.008], [p[0] + nu * 1.4, p[1] + nv * 1.4, zc]], shade(col, 0.1), alpha(shade(col, -0.6), 0.8), 0.8);
      iso.poly([[q[0] + nu * 1.4, q[1] + nv * 1.4, q[2] + 0.008], [p[0] + nu * 1.4, p[1] + nv * 1.4, zc], [p[0] + nu * 1.4, p[1] + nv * 1.4, zc + 0.03], [q[0] + nu * 1.4, q[1] + nv * 1.4, q[2] + 0.038]], shade(col, -0.15));
      sitter(iso, rng, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, zc + 0.005, 0.8);
      if (i === 12) iso.ellipse(q[0], q[1], q[2] + 0.04, 0.02, '#3aa36b', alpha('#1e3a1e', 0.8), 0.8);
    }
  }
  // stalls and crowd in front
  melaStall(iso, rng, 1.2, 1.68, z0, '#b44ca0', '#f2c14e');
  melaStall(iso, rng, 1.66, 1.3, z0, '#3aa36b', '#f1ebdd');
  for (let i = 0; i < 12; i++) person(iso, rng, 0.3 + rng() * 1.2, 1.6 + rng() * 0.3, z0, pick(rng, CROWD), 0.95);
  balloons(iso, rng, 0.62, 1.75, z0);
  bunting(iso, [0.2, 1.9, z0 + 0.2], [1.9, 1.9, z0 + 0.2], 14);
  pole(iso, 0.2, 1.9, z0, 0.2);
  pole(iso, 1.9, 1.9, z0, 0.2);
  signBoard(iso, 0.25, 1.35, z0, 0.26, 0.07, '#f2c14e', '#b0302a');
}

function drawGiantWheel(iso: Iso, rng: Rng, z0: number): void {
  const cu = 0.95;
  const cv = 0.72;
  const R = 0.5;
  const zc = z0 + R + 0.12;
  const legs = 0.14;
  melaStall(iso, rng, 1.35, 0.12, z0, '#c0392b', '#f2c14e');
  melaStall(iso, rng, 1.62, 0.3, z0, '#2f6fb3', '#f1ebdd');
  const leg = (dv: number) => {
    for (const du of [-0.3, 0.3]) {
      iso.line([cu + du, cv + dv, z0], [cu, cv + dv * 0.25, zc], alpha('#2a2a2e', 0.6), 3.6);
      iso.line([cu + du, cv + dv, z0], [cu, cv + dv * 0.25, zc], '#d9d4c8', 2.2);
    }
    iso.line([cu - 0.15, cv + dv * 0.6, z0 + (zc - z0) * 0.5], [cu + 0.15, cv + dv * 0.6, z0 + (zc - z0) * 0.5], '#d9d4c8', 1.2);
  };
  leg(-legs);
  // rim, spokes and bulbs in the plane v = cv
  const N = 10;
  const ring: P3[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ring.push([cu + Math.cos(a) * R, cv, zc + Math.sin(a) * R]);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    iso.line([cu, cv, zc], [cu + Math.cos(a) * R, cv, zc + Math.sin(a) * R], alpha('#e8d24a', 0.8), 0.9);
  }
  iso.polyline(ring, alpha('#2a2a2e', 0.6), 4.4);
  iso.polyline(ring, '#e8433a', 2.6);
  const ring2 = ring.map((p) => [cu + (p[0] - cu) * 0.82, cv, zc + (p[2] - zc) * 0.82] as P3);
  iso.polyline(ring2, '#f2c14e', 1.3);
  for (let i = 0; i < 48; i += 2) iso.ellipse(ring[i][0], cv + 0.001, ring[i][2], 0.006, '#fff6c8');
  iso.cylinder(cu, cv, 0.035, zc - 0.018, zc + 0.018, '#8d949a');
  // gondolas hanging below the rim
  const cabCols = ['#e4572e', '#f2c14e', '#3a86c8', '#3aa36b', '#b44ca0'];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2;
    const pu = cu + Math.cos(a) * R;
    const pz = zc + Math.sin(a) * R;
    const col = cabCols[i % cabCols.length];
    iso.line([pu, cv, pz], [pu, cv, pz - 0.04], '#555', 1);
    iso.box(pu - 0.035, cv - 0.03, pu + 0.035, cv + 0.03, pz - 0.085, pz - 0.04, mat(col));
    iso.poly(iso.faceVQuad(cv + 0.03, pu - 0.028, pu + 0.028, pz - 0.07, pz - 0.05), alpha('#2a2a2e', 0.5));
    iso.poly([[pu - 0.045, cv - 0.04, pz - 0.04], [pu + 0.045, cv - 0.04, pz - 0.04], [pu + 0.045, cv + 0.04, pz - 0.04], [pu - 0.045, cv + 0.04, pz - 0.04]], shade(col, 0.2), alpha(shade(col, -0.6), 0.6), 0.6);
  }
  leg(legs);
  // loading platform + ticket counter
  iso.box(cu - 0.18, cv + 0.12, cu + 0.18, cv + 0.3, z0, z0 + 0.03, mat('#bdb6a8'));
  for (let i = 0; i < 4; i++) person(iso, rng, cu - 0.12 + i * 0.07, cv + 0.25, z0 + 0.03, pick(rng, CROWD), 0.9);
  // columbus boat / swing ride on the right
  const bu = 1.55;
  const bv = 1.0;
  iso.line([bu - 0.15, bv - 0.1, z0], [bu, bv, z0 + 0.35], '#d9d4c8', 2.4);
  iso.line([bu + 0.15, bv - 0.1, z0], [bu, bv, z0 + 0.35], '#d9d4c8', 2.4);
  const bz = z0 + 0.12;
  iso.line([bu, bv, z0 + 0.35], [bu - 0.12, bv + 0.06, bz + 0.06], '#8d949a', 1.6);
  iso.line([bu, bv, z0 + 0.35], [bu + 0.02, bv + 0.06, bz + 0.03], '#8d949a', 1.6);
  const boat: P3[] = [[bu - 0.24, bv + 0.02, bz + 0.1], [bu + 0.1, bv + 0.02, bz], [bu + 0.14, bv + 0.12, bz + 0.03], [bu - 0.2, bv + 0.12, bz + 0.13]];
  iso.poly(boat, '#e8433a', alpha('#3a1a10', 0.7), 1);
  iso.poly([[bu - 0.2, bv + 0.12, bz + 0.13], [bu + 0.14, bv + 0.12, bz + 0.03], [bu + 0.12, bv + 0.12, bz - 0.03], [bu - 0.18, bv + 0.12, bz + 0.06]], '#f2c14e', alpha('#3a1a10', 0.6), 0.8);
  for (let i = 0; i < 5; i++) sitter(iso, rng, bu - 0.17 + i * 0.06, bv + 0.07, bz + 0.1 - i * 0.02, 0.8);
  iso.line([bu - 0.15, bv + 0.1, z0], [bu, bv, z0 + 0.35], '#d9d4c8', 2.4);
  iso.line([bu + 0.15, bv + 0.1, z0], [bu, bv, z0 + 0.35], '#d9d4c8', 2.4);
  // stalls, crowd, balloons in front
  melaStall(iso, rng, 0.3, 1.45, z0, '#b44ca0', '#f2c14e');
  melaStall(iso, rng, 1.2, 1.62, z0, '#3aa36b', '#f1ebdd');
  for (let i = 0; i < 14; i++) person(iso, rng, 0.3 + rng() * 1.4, 1.2 + rng() * 0.3 + (i % 3) * 0.1, z0, pick(rng, CROWD), 0.95);
  balloons(iso, rng, 0.85, 1.85, z0);
  chaiStall(iso, rng, 1.7, 1.75, z0);
  bunting(iso, [0.15, 1.3, z0 + 0.22], [0.9, 1.95, z0 + 0.2], 10);
  pole(iso, 0.15, 1.3, z0, 0.22);
}

// ============================================================================
// Registry
// ============================================================================

export const SPORTS_SPRITES: Record<string, ProceduralSpriteDef> = {
  tennis: { footprint: 1, variants: 2, heightTiles: 0.26, draw: drawBadminton },
  basketball_courts: { footprint: 1, variants: 3, heightTiles: 0.26, draw: drawKabaddi },
  playground_small: { footprint: 1, variants: 2, heightTiles: 0.2, draw: drawPlaygroundSmall },
  playground_large: { footprint: 2, variants: 2, heightTiles: 0.2, draw: drawPlaygroundLarge },
  soccer_field_small: { footprint: 1, variants: 2, heightTiles: 0.28, draw: drawSoccerSmall },
  swimming_pool: { footprint: 1, variants: 2, heightTiles: 0.2, draw: drawSwimmingPool },
  skate_park: { footprint: 1, variants: 2, heightTiles: 0.2, draw: drawSkatePark },
  bleachers_field: { footprint: 1, variants: 2, heightTiles: 0.26, draw: drawBleachers },
  baseball_field_small: { footprint: 2, variants: 2, heightTiles: 0.15, draw: drawCricketGround },
  football_field: { footprint: 2, variants: 2, heightTiles: 0.4, draw: drawFootballField },
  baseball_stadium: { footprint: 3, variants: 1, heightTiles: 0.5, draw: drawCricketStadium },
  mini_golf_course: { footprint: 2, variants: 2, heightTiles: 0.22, draw: drawMiniGolf },
  go_kart_track: { footprint: 2, variants: 2, heightTiles: 0.15, draw: drawGoKart },
  roller_coaster_small: { footprint: 2, variants: 2, heightTiles: 0.3, draw: drawMelaRides },
};

