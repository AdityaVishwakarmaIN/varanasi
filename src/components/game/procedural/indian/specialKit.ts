/**
 * Drawing kit for the special (hero) buildings in ./special.ts: tilted discs (dishes, wheels,
 * fuselage slices), people, bunting, floodlights, cars, aircraft, rides, tents and stalls.
 * Pure canvas drawing, deterministic, no per-pixel work.
 */
import { ISO_RATIO, Z_SCALE, alpha, mat, shade, seededRng, type Iso, type P3 } from '../isoPainter';
import { C } from '../varanasiSprites';

export type Rng = ReturnType<typeof seededRng>;
type V3 = readonly [number, number, number];

// ============================================================================
// Painter's-order list
// ============================================================================

/** Items drawn back to front by `d` (larger d = nearer the viewer, usually u + v). */
export class DepthList {
  private items: { d: number; f: () => void }[] = [];
  add(d: number, f: () => void): void {
    this.items.push({ d, f });
  }
  draw(): void {
    this.items.sort((a, b) => a.d - b.d).forEach((it) => it.f());
    this.items = [];
  }
}

// ============================================================================
// Tilted planes
// ============================================================================

/** Screen delta of a world vector. */
function sd(iso: Iso, e: V3): [number, number] {
  return [(e[0] - e[1]) * iso.T * 0.5, (e[0] + e[1]) * iso.T * ISO_RATIO * 0.5 - e[2] * iso.T * Z_SCALE];
}

/**
 * Run `fn` with the canvas transformed so the unit circle maps to the world disc centred at `c`
 * spanned by the world vectors e1 (x) and e2 (y). Only fill inside (line widths get distorted).
 */
export function inPlane(iso: Iso, c: P3, e1: V3, e2: V3, fn: (ctx: Iso['ctx']) => void): void {
  const { ctx } = iso;
  const [cx, cy] = iso.pt(c[0], c[1], c[2]);
  const [a, b] = sd(iso, e1);
  const [cc, d] = sd(iso, e2);
  if (Math.abs(a * d - b * cc) < 1e-6) return;
  ctx.save();
  ctx.transform(a, b, cc, d, cx, cy);
  fn(ctx);
  ctx.restore();
}

/** Filled world disc (circle of radius 1 in the e1/e2 plane). */
export function disc(iso: Iso, c: P3, e1: V3, e2: V3, fill: string | CanvasGradient): void {
  inPlane(iso, c, e1, e2, (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  });
}

/** Points of a world circle (for strokes). */
export function ringPts(c: P3, e1: V3, e2: V3, n: number, a0 = 0, a1 = Math.PI * 2): P3[] {
  const out: P3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    const co = Math.cos(t);
    const si = Math.sin(t);
    out.push([c[0] + e1[0] * co + e2[0] * si, c[1] + e1[1] * co + e2[1] * si, c[2] + e1[2] * co + e2[2] * si]);
  }
  return out;
}

// ============================================================================
// Tube along u (fuselage, engines, rocket stages lying down)
// ============================================================================

/**
 * A tube along +u from u0 to u1 at (v, z(s)), radius r(s) (s ∈ [0,1] from u0 to u1), drawn as
 * circular slices from the back (u0) to the front so its +u end is the visible one.
 */
export function tubeU(
  iso: Iso,
  u0: number,
  u1: number,
  v: number,
  z: (s: number) => number,
  r: (s: number) => number,
  base: string,
  outline = true,
): void {
  const { ctx } = iso;
  const lenPx = (u1 - u0) * iso.T * 0.583;
  const n = Math.max(4, Math.min(260, Math.ceil(lenPx / Math.max(0.9, iso.px * 1.1))));
  const g = ctx.createLinearGradient(0.55, 0.85, -0.45, -0.9);
  g.addColorStop(0, shade(base, 0.35));
  g.addColorStop(0.35, shade(base, 0.08));
  g.addColorStop(0.75, shade(base, -0.22));
  g.addColorStop(1, shade(base, -0.45));
  const dark = alpha(shade(base, -0.65), 0.7);
  for (let pass = outline ? 0 : 1; pass < 2; pass++) {
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const rr = r(s);
      if (rr <= 0.0005) continue;
      const grow = pass === 0 ? 1 + (1.1 * iso.px) / (rr * iso.T * 0.5) : 1;
      const u = u0 + (u1 - u0) * s;
      inPlane(iso, [u, v, z(s)], [0, rr * grow, 0], [0, 0, rr * grow], (c) => {
        c.beginPath();
        c.arc(0, 0, 1, 0, Math.PI * 2);
        c.fillStyle = pass === 0 ? dark : g;
        c.fill();
      });
    }
  }
}

// ============================================================================
// Small props
// ============================================================================

const SKIN = ['#8a5a3a', '#6e4630', '#a06a45', '#7a5038'];

/** A tiny standing person (screen-space: head + clothes), ~0.05 tall. */
export function person(iso: Iso, u: number, v: number, z: number, cloth: string, rng: Rng, h = 0.05): void {
  const { ctx } = iso;
  const [x, y] = iso.pt(u, v, z);
  const H = h * iso.T * Z_SCALE;
  const w = Math.max(1.2, H * 0.34);
  ctx.fillStyle = 'rgba(30,20,12,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.4, y, w * 0.9, w * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(cloth, -0.1);
  ctx.fillRect(x - w / 2, y - H * 0.78, w, H * 0.78);
  ctx.fillStyle = shade(cloth, 0.2);
  ctx.fillRect(x - w / 2, y - H * 0.78, w * 0.45, H * 0.7);
  ctx.fillStyle = SKIN[Math.floor(rng() * SKIN.length)];
  ctx.beginPath();
  ctx.arc(x, y - H * 0.88, w * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e1814';
  ctx.fillRect(x - w * 0.42, y - H * 1.02, w * 0.84, H * 0.1);
}

export const CLOTHES = ['#d8452f', '#f0b429', '#2f7fbf', '#e86aa6', '#f4f0e6', '#3aa66a', '#8e44ad', '#f08a24', '#c0392b', '#1f9e9a'];

/** A scatter of people in a rectangle, drawn back to front. */
export function crowd(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, count: number, h = 0.05): void {
  const ps: [number, number, string][] = [];
  for (let i = 0; i < count; i++) ps.push([u0 + rng() * (u1 - u0), v0 + rng() * (v1 - v0), CLOTHES[Math.floor(rng() * CLOTHES.length)]]);
  ps.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const p of ps) person(iso, p[0], p[1], z, p[2], rng, h * (0.85 + rng() * 0.3));
}

/** A sagging string between two points with little pennants or bulbs. */
export function bunting(iso: Iso, a: P3, b: P3, colors: readonly string[], kind: 'flags' | 'bulbs' = 'flags', sag = 0.04): void {
  const n = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 22));
  const pts: P3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag]);
  }
  iso.polyline(pts, alpha('#2a2018', 0.7), 0.7);
  const { ctx } = iso;
  for (let i = 1; i < n; i++) {
    const [x, y] = iso.pt(pts[i][0], pts[i][1], pts[i][2]);
    const col = colors[i % colors.length];
    if (kind === 'bulbs') {
      ctx.fillStyle = alpha(col, 0.35);
      ctx.beginPath();
      ctx.arc(x, y, 2.6 * iso.px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(col, 0.4);
      ctx.beginPath();
      ctx.arc(x, y, 1.2 * iso.px, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const s = 4.2 * iso.px;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.55, y);
      ctx.lineTo(x + s * 0.55, y);
      ctx.lineTo(x, y + s * 1.1);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** A thin pole. */
export function pole(iso: Iso, u: number, v: number, z: number, h: number, color = '#5a5048', lw = 1.6): void {
  iso.line([u, v, z], [u, v, z + h], alpha(shade(color, -0.5), 0.6), lw + 1);
  iso.line([u, v, z], [u, v, z + h], color, lw);
}

/**
 * Stadium floodlight tower: tapering lattice mast with a lamp head tilted towards (fu, fv).
 */
export function floodlight(iso: Iso, u: number, v: number, z: number, H: number, fu: number, fv: number): void {
  const { ctx } = iso;
  iso.aoEllipse(u, v, 0.05, z, 0.05, 0.35);
  iso.castShadow([
    [u - 0.03, v - 0.03],
    [u + 0.03, v - 0.03],
    [u + 0.03, v + 0.03],
    [u - 0.03, v + 0.03],
  ], z, H * 0.9, 0.1);
  const b = 0.045;
  const t = 0.014;
  const legs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const steel = '#9aa0a6';
  // back legs, bracing, then front legs
  const leg = (i: number, col: string, lw: number) => {
    const [a, c] = legs[i];
    iso.line([u + a * b, v + c * b, z], [u + a * t, v + c * t, z + H], col, lw);
  };
  leg(0, shade(steel, -0.3), 1.4);
  const nb = Math.max(4, Math.round(H / 0.08));
  for (let k = 0; k < nb; k++) {
    const z0 = z + (H * k) / nb;
    const z1 = z + (H * (k + 1)) / nb;
    const w0 = b + (t - b) * (k / nb);
    const w1 = b + (t - b) * ((k + 1) / nb);
    iso.line([u - w0, v + w0, z0], [u + w1, v + w1, z1], alpha('#5a6068', 0.8), 0.7);
    iso.line([u + w0, v - w0, z0], [u + w1, v + w1, z1], alpha('#4a5058', 0.8), 0.7);
  }
  leg(1, shade(steel, -0.25), 1.4);
  leg(3, steel, 1.4);
  leg(2, shade(steel, 0.1), 1.6);
  // lamp head: a frame facing the field
  const dx = fu - u;
  const dv = fv - v;
  const L = Math.hypot(dx, dv) || 1;
  // head plane spans perpendicular to the facing direction (horizontal) and tilted vertical
  const pu = -dv / L;
  const pv = dx / L;
  const hw = 0.11;
  const zh = z + H;
  const hh = 0.1;
  const lean = 0.03;
  const corner = (s: number, k: number): P3 => [u + pu * hw * s + (dx / L) * lean * k, v + pv * hw * s + (dv / L) * lean * k, zh + hh * k];
  const frame: P3[] = [corner(-1, 0), corner(1, 0), corner(1, 1), corner(-1, 1)];
  iso.poly(frame, '#3e434a', alpha('#1e2024', 0.8), 1.2);
  // lamp grid
  const rows = 3;
  const cols = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = -1 + (2 * (c + 0.5)) / cols;
      const k = (r + 0.5) / rows;
      const p = corner(s, k);
      const [x, y] = iso.pt(p[0], p[1], p[2]);
      ctx.fillStyle = 'rgba(255,244,200,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * iso.px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.fillRect(x - 1.6 * iso.px, y - 1.3 * iso.px, 3.2 * iso.px, 2.6 * iso.px);
    }
  }
}

/** A small car (box body + cabin), long along u or v. */
export function car(iso: Iso, u: number, v: number, z: number, color: string, along: 'u' | 'v' = 'u'): void {
  const L = 0.12;
  const W = 0.06;
  const [du, dv] = along === 'u' ? [L, W] : [W, L];
  iso.aoRect(u, v, u + du, v + dv, z, 0.02, 0.35);
  iso.box(u, v, u + du, v + dv, z + 0.008, z + 0.03, mat(color));
  const ci = along === 'u' ? [0.025, 0.006, -0.035, -0.006] : [0.006, 0.025, -0.006, -0.035];
  iso.box(u + ci[0], v + ci[1], u + du + ci[2], v + dv + ci[3], z + 0.03, z + 0.05, { top: shade(color, 0.1), left: '#2e3a46', right: '#252f3a', line: alpha('#1a1a1a', 0.5) });
}

// ============================================================================
// Tents, stalls, rides
// ============================================================================

/** Striped cone roof (carousel / tent) made of fan triangles drawn back to front. */
export function stripedCone(iso: Iso, u: number, v: number, z: number, r: number, h: number, colors: readonly string[], segs = 16): void {
  const tris: { d: number; pts: P3[]; col: string; face: number }[] = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    tris.push({
      d: Math.cos(am) + Math.sin(am),
      pts: [
        [u + Math.cos(a0) * r, v + Math.sin(a0) * r, z],
        [u + Math.cos(a1) * r, v + Math.sin(a1) * r, z],
        [u, v, z + h],
      ],
      col: colors[i % colors.length],
      // light from the top-left: +v faces lit, +u faces shaded
      face: Math.sin(am) * 0.12 - Math.cos(am) * 0.18,
    });
  }
  tris.sort((a, b) => a.d - b.d);
  for (const t of tris) iso.poly(t.pts, shade(t.col, t.face + 0.05), alpha(shade(t.col, -0.4), 0.35), 0.5);
  // scalloped valance
  const n = segs * 2;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    if (Math.cos(am) + Math.sin(am) < -0.2) continue;
    const col = colors[Math.floor(i / 2) % colors.length];
    iso.poly([
      [u + Math.cos(a0) * r, v + Math.sin(a0) * r, z],
      [u + Math.cos(a1) * r, v + Math.sin(a1) * r, z],
      [u + Math.cos(am) * r, v + Math.sin(am) * r, z - h * 0.18],
    ], shade(col, -0.1));
  }
}

/** Square shamiana tent: four striped pyramid faces over thin poles. */
export function shamiana(iso: Iso, u0: number, v0: number, s: number, z: number, postH: number, roofH: number, c1: string, c2: string): void {
  const u1 = u0 + s;
  const v1 = v0 + s;
  const zr = z + postH;
  const apex: P3 = [u0 + s / 2, v0 + s / 2, zr + roofH];
  iso.aoRect(u0, v0, u1, v1, z, 0.04, 0.3);
  iso.poly(iso.topQuad(u0 + 0.01, v0 + 0.01, u1 - 0.01, v1 - 0.01, z + 0.001), alpha('#3a2616', 0.18));
  for (const [pu, pv] of [
    [u0, v0],
    [u1, v0],
    [u0, v1],
  ] as [number, number][])
    iso.line([pu, pv, z], [pu, pv, zr], '#6b4a2a', 1.3);
  const stripes = 6;
  const face = (a: P3, b: P3, amt: number) => {
    for (let i = 0; i < stripes; i++) {
      const t0 = i / stripes;
      const t1 = (i + 1) / stripes;
      const p0: P3 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[2]];
      const p1: P3 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, a[2]];
      iso.poly([p0, p1, apex], shade(i % 2 ? c1 : c2, amt));
    }
    iso.poly([a, b, apex], null, alpha('#3a2616', 0.4), 0.7);
  };
  face([u0, v0, zr], [u1, v0, zr], -0.1); // −v
  face([u0, v1, zr], [u0, v0, zr], -0.05); // −u
  face([u1, v0, zr], [u1, v1, zr], -0.22); // +u
  face([u1, v1, zr], [u0, v1, zr], 0.08); // +v
  // valance frill on the visible sides
  for (let i = 0; i < 8; i++) {
    const a = u0 + (s * i) / 8;
    iso.poly([
      [a, v1, zr],
      [a + s / 8, v1, zr],
      [a + s / 16, v1, zr - 0.025],
    ], i % 2 ? c1 : c2);
    const b = v0 + (s * i) / 8;
    iso.poly([
      [u1, b, zr],
      [u1, b + s / 8, zr],
      [u1, b + s / 16, zr - 0.025],
    ], shade(i % 2 ? c1 : c2, -0.25));
  }
  iso.line([u1, v1, z], [u1, v1, zr], '#6b4a2a', 1.3);
  iso.line(apex, [apex[0], apex[1], apex[2] + 0.05], '#6b4a2a', 1);
  iso.poly([
    [apex[0], apex[1], apex[2] + 0.05],
    [apex[0] + 0.03, apex[1] - 0.03, apex[2] + 0.04],
    [apex[0], apex[1], apex[2] + 0.03],
  ], C.saffron);
}

/** Food / toy stall: wooden counter, back wall, sloping tarp awning and a colourful board. */
export function stall(iso: Iso, rng: Rng, u0: number, v0: number, w: number, d: number, z: number, tarp: string, board: string, goods: readonly string[]): void {
  const u1 = u0 + w;
  const v1 = v0 + d;
  iso.aoRect(u0, v0, u1, v1, z, 0.03, 0.35);
  // back wall + counter
  iso.box(u0, v0, u1, v0 + 0.02, z, z + 0.1, mat('#b08a5a'));
  iso.box(u0 + 0.01, v1 - 0.035, u1 - 0.01, v1, z, z + 0.04, mat(C.wood, { top: 0.2 }));
  // goods on the counter
  const { ctx } = iso;
  for (let i = 0; i < 6; i++) {
    const [x, y] = iso.pt(u0 + 0.02 + ((w - 0.04) * (i + 0.5)) / 6, v1 - 0.017, z + 0.04);
    ctx.fillStyle = goods[i % goods.length];
    ctx.beginPath();
    ctx.arc(x, y - 1.2 * iso.px, 2 * iso.px, 0, Math.PI * 2);
    ctx.fill();
  }
  // posts
  iso.line([u0 + 0.01, v1, z], [u0 + 0.01, v1 + 0.02, z + 0.1], '#5a3d25', 1.2);
  iso.line([u1 - 0.01, v1, z], [u1 - 0.01, v1 + 0.02, z + 0.1], '#5a3d25', 1.2);
  // sloping tarp: from the back wall top down towards +v
  const awn: P3[] = [
    [u0 - 0.01, v0, z + 0.13],
    [u1 + 0.01, v0, z + 0.13],
    [u1 + 0.01, v1 + 0.03, z + 0.095],
    [u0 - 0.01, v1 + 0.03, z + 0.095],
  ];
  iso.poly(awn, shade(tarp, 0.1), alpha(shade(tarp, -0.5), 0.6), 0.8);
  iso.clipped(awn, () => {
    for (let a = u0; a < u1; a += 0.04) iso.poly(iso.topQuad(a, v0 - 0.1, a + 0.02, v1 + 0.1, z + 0.12), alpha('#ffffff', 0.18));
  });
  iso.poly(iso.faceUQuad(u1 + 0.01, v0, v1 + 0.03, z + 0.08, z + 0.095), shade(tarp, -0.3));
  // board above the awning's back edge
  iso.poly(iso.faceVQuad(v0 + 0.005, u0 + 0.01, u1 - 0.01, z + 0.13, z + 0.19), board, alpha('#2a1a10', 0.6), 0.8);
  const nb = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nb; i++) {
    const a = u0 + 0.025 + i * ((w - 0.05) / nb);
    iso.poly(iso.faceVQuad(v0 + 0.006, a, a + ((w - 0.05) / nb) * 0.7, z + 0.148, z + 0.172), alpha('#fff6e0', 0.85));
  }
}

/** A palm (coconut) tree: curved trunk and drooping fronds. */
export function palm(iso: Iso, u: number, v: number, z: number, h: number, rng: Rng): void {
  const { ctx } = iso;
  iso.aoEllipse(u + 0.05, v, 0.06, z, 0.05, 0.3);
  const lean = (rng() - 0.3) * 0.12;
  const pts: P3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push([u + lean * t * t, v - lean * 0.5 * t * t, z + h * t]);
  }
  iso.polyline(pts, '#4a3624', 3.6);
  iso.polyline(pts, '#8a6a48', 2.4);
  const top = pts[pts.length - 1];
  const [x, y] = iso.pt(top[0], top[1], top[2]);
  const R = h * iso.T * 0.45;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.3;
    const ex = x + Math.cos(a) * R;
    const ey = y + Math.sin(a) * R * 0.45 + R * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.3 - R * 0.25, ex, ey);
    ctx.strokeStyle = i % 2 ? '#3f6e2a' : '#588c34';
    ctx.lineWidth = 2.6 * iso.px;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = '#6a4a2a';
  ctx.beginPath();
  ctx.arc(x, y + 1.5 * iso.px, 2.4 * iso.px, 0, Math.PI * 2);
  ctx.fill();
}
