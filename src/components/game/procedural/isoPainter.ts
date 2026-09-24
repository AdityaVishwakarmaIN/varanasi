/**
 * Tiny isometric "painter" used by the procedural Varanasi sprites.
 *
 * World coordinates (all in TILE-SIDE units, so a 1×1 tile is u,v ∈ [0,1]):
 *   u → grid x  (screen: towards the lower-right)
 *   v → grid y  (screen: towards the lower-left)
 *   z → height  (screen: up). One unit of z is as tall as one tile side is long.
 *
 * Projection matches the game (`TILE_HEIGHT = TILE_WIDTH × 0.6`):
 *   screenX = ox + (u − v) · T/2
 *   screenY = oy + (u + v) · T·0.3 − z · T·Z_SCALE
 * where T is the pixel width of ONE tile and (ox, oy) is the top (north) corner of the base diamond.
 *
 * Face naming (light comes from the top-left, like the painted sprite sheets):
 *   top   – horizontal faces (brightest)
 *   left  – faces whose normal is +v (they face the lower-left; lit)
 *   right – faces whose normal is +u (they face the lower-right; in shade)
 *
 * Everything here is pure drawing on a 2D context: no DOM access, safe to import in node.
 */
import { createRng, type Rng } from '@/lib/rng';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type P3 = readonly [number, number, number];
type Fill = string | CanvasGradient | CanvasPattern;

/** Must equal HEIGHT_RATIO in `src/components/game/types.ts`. */
export const ISO_RATIO = 0.6;
/** Projected height (in tile widths) of one tile-side unit of world height (cos(elevation)/√2). */
export const Z_SCALE = 0.5657;

// ============================================================================
// Colour helpers
// ============================================================================

export type RGB = [number, number, number];

const hexCache = new Map<string, RGB>();

export function parseColor(c: string): RGB {
  const cached = hexCache.get(c);
  if (cached) return cached;
  let out: RGB = [128, 128, 128];
  if (c.startsWith('#')) {
    const h = c.length === 4 ? c.slice(1).split('').map((ch) => ch + ch).join('') : c.slice(1, 7);
    out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  } else {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(',').map((s) => parseFloat(s));
      out = [parts[0], parts[1], parts[2]];
    }
  }
  hexCache.set(c, out);
  return out;
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function toRgb(c: RGB, a = 1): string {
  return a >= 1
    ? `rgb(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])})`
    : `rgba(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])},${a.toFixed(3)})`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  return toRgb([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

const WARM_LIGHT = '#fff4dc';
const COOL_DARK = '#1e1a2a';

/** amt > 0 lightens towards a warm white, amt < 0 darkens towards a cool deep violet (painterly shadows). */
export function shade(c: string, amt: number): string {
  if (amt === 0) return mix(c, c, 0);
  return amt > 0 ? mix(c, WARM_LIGHT, amt) : mix(c, COOL_DARK, -amt);
}

export function alpha(c: string, a: number): string {
  return toRgb(parseColor(c), a);
}

/** A material: colours for the three visible faces of a box plus an edge line colour. */
export interface Mat {
  top: string;
  left: string;
  right: string;
  line: string;
}

export function mat(base: string, opts: { top?: number; left?: number; right?: number; line?: number } = {}): Mat {
  return {
    top: shade(base, opts.top ?? 0.14),
    left: shade(base, opts.left ?? 0),
    right: shade(base, opts.right ?? -0.28),
    line: alpha(shade(base, opts.line ?? -0.55), 0.55),
  };
}

export function seededRng(key: string, variant = 0): Rng {
  let h = 2166136261 ^ variant;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return createRng(h >>> 0);
}

// ============================================================================
// The painter
// ============================================================================

export interface BoxOpts {
  /** Skip the top face (e.g. when something is drawn on top anyway). */
  noTop?: boolean;
  /** Skip the +v (left) face. */
  noLeft?: boolean;
  /** Skip the +u (right) face. */
  noRight?: boolean;
  /** Draw edge lines (default true). */
  edges?: boolean;
}

export class Iso {
  readonly ctx: Ctx2D;
  /** Pixel width of one tile. */
  readonly T: number;
  /** Footprint (tiles per side). */
  readonly n: number;
  /** Screen position of the top corner of the base diamond. */
  readonly ox: number;
  readonly oy: number;
  /** One "art pixel": line widths and texture sizes scale with it (1 at 256 px per tile). */
  readonly px: number;

  constructor(ctx: Ctx2D, w: number, h: number, n: number, bottomPadTiles: number) {
    this.ctx = ctx;
    this.n = n;
    this.T = w / n;
    this.ox = w / 2;
    this.oy = h - bottomPadTiles * this.T - n * this.T * ISO_RATIO;
    this.px = this.T / 256;
  }

  sx(u: number, v: number): number {
    return this.ox + (u - v) * this.T * 0.5;
  }

  sy(u: number, v: number, z = 0): number {
    return this.oy + (u + v) * this.T * ISO_RATIO * 0.5 - z * this.T * Z_SCALE;
  }

  pt(u: number, v: number, z = 0): [number, number] {
    return [this.sx(u, v), this.sy(u, v, z)];
  }

  /** Half-axes (px) of a horizontal circle of radius r (tile units). */
  ellipseRadii(r: number): [number, number] {
    return [r * this.T * Math.SQRT1_2, r * this.T * Math.SQRT1_2 * ISO_RATIO];
  }

  path(pts: readonly P3[]): void {
    const { ctx } = this;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = this.pt(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  poly(pts: readonly P3[], fill: Fill | null, stroke?: string | null, lw = 1): void {
    const { ctx } = this;
    this.path(pts);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw * this.px;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  line(a: P3, b: P3, color: string, lw = 1): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(...this.pt(a[0], a[1], a[2]));
    ctx.lineTo(...this.pt(b[0], b[1], b[2]));
    ctx.strokeStyle = color;
    ctx.lineWidth = lw * this.px;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  polyline(pts: readonly P3[], color: string, lw = 1): void {
    const { ctx } = this;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = this.pt(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lw * this.px;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // Faces and boxes
  // --------------------------------------------------------------------------

  topQuad(u0: number, v0: number, u1: number, v1: number, z: number): P3[] {
    return [
      [u0, v0, z],
      [u1, v0, z],
      [u1, v1, z],
      [u0, v1, z],
    ];
  }

  /** Plane u = const (normal +u, the shaded lower-right face). */
  faceUQuad(u: number, v0: number, v1: number, z0: number, z1: number): P3[] {
    return [
      [u, v0, z0],
      [u, v1, z0],
      [u, v1, z1],
      [u, v0, z1],
    ];
  }

  /** Plane v = const (normal +v, the lit lower-left face). */
  faceVQuad(v: number, u0: number, u1: number, z0: number, z1: number): P3[] {
    return [
      [u0, v, z0],
      [u1, v, z0],
      [u1, v, z1],
      [u0, v, z1],
    ];
  }

  box(u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, m: Mat, opts: BoxOpts = {}): void {
    const edges = opts.edges !== false;
    const lw = 1;
    if (!opts.noLeft) this.poly(this.faceVQuad(v1, u0, u1, z0, z1), m.left, edges ? m.line : null, lw);
    if (!opts.noRight) this.poly(this.faceUQuad(u1, v0, v1, z0, z1), m.right, edges ? m.line : null, lw);
    if (!opts.noTop) this.poly(this.topQuad(u0, v0, u1, v1, z1), m.top, edges ? m.line : null, lw);
  }

  /** Box with a thin highlight on the top-left edges (reads as bevelled stone at small sizes). */
  boxLit(u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, m: Mat, opts: BoxOpts = {}): void {
    this.box(u0, v0, u1, v1, z0, z1, m, opts);
    if (!opts.noTop) {
      const hi = alpha(shade(m.top, 0.5), 0.55);
      this.line([u0, v1, z1], [u1, v1, z1], hi, 1);
      this.line([u1, v1, z1], [u1, v0, z1], alpha(shade(m.top, 0.3), 0.35), 1);
    }
  }

  // --------------------------------------------------------------------------
  // Shadows / ambient occlusion
  // --------------------------------------------------------------------------

  /** Soft ambient-occlusion pool on a horizontal plane around a rectangle footprint. */
  aoRect(u0: number, v0: number, u1: number, v1: number, z: number, spread = 0.06, strength = 0.35): void {
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
      const e = (spread * i) / steps;
      this.poly(this.topQuad(u0 - e * 0.4, v0 - e * 0.4, u1 + e, v1 + e, z), `rgba(35,22,12,${(strength / steps).toFixed(3)})`);
    }
  }

  aoEllipse(u: number, v: number, r: number, z: number, spread = 0.08, strength = 0.35): void {
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
      const e = (spread * i) / steps;
      this.ellipse(u + e * 0.3, v + e * 0.3, z, r + e, `rgba(35,22,12,${(strength / steps).toFixed(3)})`);
    }
  }

  /**
   * Cast shadow of a vertical prism (footprint polygon at z0, height h) onto the plane z0.
   * Light from the top-left means shadows fall towards +u (screen lower-right) and a little −v.
   */
  castShadow(base: readonly [number, number][], z0: number, h: number, strength = 0.22, dir: [number, number] = [0.55, -0.2]): void {
    const pts: [number, number][] = [];
    for (const [u, v] of base) {
      pts.push(this.pt(u, v, z0));
      pts.push(this.pt(u + dir[0] * h, v + dir[1] * h, z0));
    }
    const hull = convexHull(pts);
    const { ctx } = this;
    ctx.beginPath();
    hull.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = `rgba(40,24,14,${strength})`;
    ctx.fill();
  }

  // --------------------------------------------------------------------------
  // Round things
  // --------------------------------------------------------------------------

  ellipse(u: number, v: number, z: number, r: number, fill: Fill | null, stroke?: string | null, lw = 1): void {
    const [cx, cy] = this.pt(u, v, z);
    const [rx, ry] = this.ellipseRadii(r);
    const { ctx } = this;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw * this.px;
      ctx.stroke();
    }
  }

  /** Horizontal gradient used for round bodies: lit on the left, shaded on the right. */
  roundGradient(cx: number, rx: number, base: string, lit = 0.16, dark = -0.32): CanvasGradient {
    const g = this.ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, shade(base, lit * 0.4));
    g.addColorStop(0.28, shade(base, lit));
    g.addColorStop(0.62, shade(base, dark * 0.3));
    g.addColorStop(1, shade(base, dark));
    return g;
  }

  /** Vertical cylinder with an optional coloured top. */
  cylinder(u: number, v: number, r: number, z0: number, z1: number, base: string, top?: string | null, outline = true): void {
    this.lathe(u, v, z0, [
      [0, r],
      [z1 - z0, r],
    ], () => base, { top: top === undefined ? shade(base, 0.12) : top, outline });
  }

  /**
   * Surface of revolution around (u, v), drawn as a stack of horizontal slices from the bottom up
   * (the painter's order gives the correct visible front surface for convex-ish shapes).
   * `profile` is a list of [dz, r] pairs (height above z0, radius in tile units), ascending in dz.
   * `color(t, up)` gets t ∈ [0,1] along the profile and `up` ∈ [−1,1] (how much the surface faces up).
   */
  lathe(
    u: number,
    v: number,
    z0: number,
    profile: readonly [number, number][],
    color: (t: number, up: number) => string,
    opts: { top?: string | null; outline?: boolean; lit?: number; dark?: number; step?: number } = {},
  ): void {
    const { ctx } = this;
    const zs = this.T * Z_SCALE;
    const rs = this.T * Math.SQRT1_2 * ISO_RATIO;
    // Resample the profile by projected arc length so slices are ~0.7 px apart.
    const samples: { z: number; r: number; up: number; t: number }[] = [];
    let total = 0;
    const segLen: number[] = [];
    for (let i = 1; i < profile.length; i++) {
      const dz = (profile[i][0] - profile[i - 1][0]) * zs;
      const dr = (profile[i][1] - profile[i - 1][1]) * rs;
      const l = Math.hypot(dz, dr);
      segLen.push(l);
      total += l;
    }
    const step = (opts.step ?? 0.7) * Math.max(1, this.px * 0.6);
    let acc = 0;
    for (let i = 1; i < profile.length; i++) {
      const [za, ra] = profile[i - 1];
      const [zb, rb] = profile[i];
      const n = Math.max(1, Math.ceil(segLen[i - 1] / step));
      const dzw = zb - za;
      const drw = rb - ra;
      const len = Math.hypot(dzw, drw) || 1;
      // Outward normal of the profile (radial, vertical) = (dz, −dr)/len.
      const up = -drw / len;
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const f = k / n;
        samples.push({ z: za + dzw * f, r: ra + drw * f, up, t: total > 0 ? (acc + segLen[i - 1] * f) / total : 0 });
      }
      acc += segLen[i - 1];
    }
    const [cx] = this.pt(u, v, 0);
    // Silhouette outline: draw every slice slightly enlarged in a dark colour first.
    if (opts.outline !== false) {
      const o = 1.1 * this.px;
      ctx.fillStyle = alpha(shade(color(0.5, 0), -0.6), 0.6);
      for (const s of samples) {
        if (s.r <= 0) continue;
        const [, cy] = this.pt(u, v, z0 + s.z);
        const [rx, ry] = this.ellipseRadii(s.r);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx + o, ry + o, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const s of samples) {
      if (s.r <= 0) continue;
      const [, cy] = this.pt(u, v, z0 + s.z);
      const [rx, ry] = this.ellipseRadii(s.r);
      const base = color(s.t, s.up);
      const upLift = Math.max(0, s.up) * 0.18;
      ctx.fillStyle = this.roundGradient(cx, rx, shade(base, upLift), opts.lit ?? 0.16, opts.dark ?? -0.32);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (opts.top) {
      const last = samples[samples.length - 1];
      if (last && last.r > 0) this.ellipse(u, v, z0 + last.z, last.r, opts.top, alpha(shade(opts.top, -0.4), 0.5), 0.8);
    }
  }

  /**
   * Like `lathe` but with square slices (plan aligned to the grid): used for shikhara spires and
   * stepped pyramids. Left half of each slice uses the lit colour, the right half the shaded one.
   */
  squareLathe(
    u: number,
    v: number,
    z0: number,
    profile: readonly [number, number][],
    color: (t: number, up: number) => string,
    opts: { top?: string | null; outline?: boolean } = {},
  ): void {
    const { ctx } = this;
    const zs = this.T * Z_SCALE;
    const samples: { z: number; s: number; up: number; t: number }[] = [];
    const totalZ = profile[profile.length - 1][0] - profile[0][0] || 1;
    for (let i = 1; i < profile.length; i++) {
      const [za, sa] = profile[i - 1];
      const [zb, sb] = profile[i];
      const n = Math.max(1, Math.ceil(Math.max((zb - za) * zs, Math.abs(sb - sa) * this.T * 0.3) / (0.7 * Math.max(1, this.px * 0.6))));
      const len = Math.hypot(zb - za, sb - sa) || 1;
      const up = -(sb - sa) / len;
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const f = k / n;
        const z = za + (zb - za) * f;
        samples.push({ z, s: sa + (sb - sa) * f, up, t: (z - profile[0][0]) / totalZ });
      }
    }
    const diamond = (s: number, z: number, grow: number) => {
      const b = this.pt(u - s, v - s, z);
      const r = this.pt(u + s, v - s, z);
      const f = this.pt(u + s, v + s, z);
      const l = this.pt(u - s, v + s, z);
      return { b: [b[0], b[1] - grow], r: [r[0] + grow, r[1]], f: [f[0], f[1] + grow], l: [l[0] - grow, l[1]] };
    };
    if (opts.outline !== false) {
      ctx.fillStyle = alpha(shade(color(0.5, 0), -0.6), 0.6);
      for (const sm of samples) {
        if (sm.s <= 0) continue;
        const d = diamond(sm.s, z0 + sm.z, 1.1 * this.px);
        ctx.beginPath();
        ctx.moveTo(d.b[0], d.b[1]);
        ctx.lineTo(d.r[0], d.r[1]);
        ctx.lineTo(d.f[0], d.f[1]);
        ctx.lineTo(d.l[0], d.l[1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (const sm of samples) {
      if (sm.s <= 0) continue;
      const d = diamond(sm.s, z0 + sm.z, 0);
      const base = color(sm.t, sm.up);
      const lift = Math.max(0, sm.up) * 0.2;
      ctx.fillStyle = shade(base, lift * 0.6);
      ctx.beginPath();
      ctx.moveTo(d.b[0], d.b[1]);
      ctx.lineTo(d.f[0], d.f[1]);
      ctx.lineTo(d.l[0], d.l[1]);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(base, -0.26 + lift * 0.4);
      ctx.beginPath();
      ctx.moveTo(d.b[0], d.b[1]);
      ctx.lineTo(d.r[0], d.r[1]);
      ctx.lineTo(d.f[0], d.f[1]);
      ctx.closePath();
      ctx.fill();
    }
    if (opts.top) {
      const last = samples[samples.length - 1];
      if (last && last.s > 0) this.poly(this.topQuad(u - last.s, v - last.s, u + last.s, v + last.s, z0 + last.z), opts.top);
    }
  }

  // --------------------------------------------------------------------------
  // Details
  // --------------------------------------------------------------------------

  /** Arch-topped opening on a +u face (plane u), spanning v ∈ [v0, v1], z ∈ [z0, z1] (z1 = arch crown). */
  archU(u: number, v0: number, v1: number, z0: number, z1: number, fill: Fill, pointed = false): void {
    const pts: P3[] = [];
    const r = (v1 - v0) / 2;
    const zs = z1 - r * (pointed ? 1.25 : 1);
    pts.push([u, v0, z0], [u, v1, z0]);
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const lift = pointed ? Math.pow(s, 0.8) * r * 1.25 : s * r;
      pts.push([u, v0 + r + c * r, zs + lift]);
    }
    this.poly(pts, fill);
  }

  /** Arch-topped opening on a +v face (plane v), spanning u ∈ [u0, u1]. */
  archV(v: number, u0: number, u1: number, z0: number, z1: number, fill: Fill, pointed = false): void {
    const pts: P3[] = [];
    const r = (u1 - u0) / 2;
    const zs = z1 - r * (pointed ? 1.25 : 1);
    pts.push([u1, v, z0], [u0, v, z0]);
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI - (i / n) * Math.PI;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const lift = pointed ? Math.pow(s, 0.8) * r * 1.25 : s * r;
      pts.push([u0 + r + c * r, v, zs + lift]);
    }
    this.poly(pts, fill);
  }

  /** Random small specks clipped to a polygon: stone grain, grass, dirt. */
  speckle(clip: readonly P3[], rng: Rng, count: number, colors: readonly string[], size = 1.4): void {
    const { ctx } = this;
    ctx.save();
    this.path(clip);
    ctx.clip();
    const xs = clip.map((p) => this.sx(p[0], p[1]));
    const ys = clip.map((p) => this.sy(p[0], p[1], p[2]));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const s = size * this.px;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
      const w = s * (0.6 + rng() * 0.9);
      ctx.fillRect(minX + rng() * (maxX - minX), minY + rng() * (maxY - minY), w, w * (0.6 + rng() * 0.5));
    }
    ctx.restore();
  }

  /** Clip subsequent drawing to a polygon while `fn` runs. */
  clipped(clip: readonly P3[], fn: () => void): void {
    const { ctx } = this;
    ctx.save();
    this.path(clip);
    ctx.clip();
    fn();
    ctx.restore();
  }

  /** Screen-space blob (canopies, bushes): a circle shaded from the top-left. */
  blob(x: number, y: number, r: number, base: string, rimAlpha = 0.5): void {
    const { ctx } = this;
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, shade(base, 0.28));
    g.addColorStop(0.55, base);
    g.addColorStop(1, shade(base, -0.35));
    ctx.beginPath();
    ctx.arc(x, y, r + this.px, 0, Math.PI * 2);
    ctx.fillStyle = alpha(shade(base, -0.65), rimAlpha);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  /** A tree: trunk + lumpy canopy. `size` is canopy radius in tile units. */
  tree(u: number, v: number, z: number, size: number, rng: Rng, kind: 'neem' | 'peepal' | 'ashoka' | 'shrub' = 'neem'): void {
    const trunkH = kind === 'shrub' ? 0 : kind === 'ashoka' ? size * 1.4 : size * 0.9;
    const greens: Record<string, string[]> = {
      neem: ['#5f8a2e', '#6d9636', '#557c2a'],
      peepal: ['#4f7f2a', '#5d8f30', '#46742a'],
      ashoka: ['#2f5e2a', '#386b30', '#2a5426'],
      shrub: ['#5b8a34', '#679640', '#4f7a2e'],
    };
    const cols = greens[kind];
    // ground shadow
    this.aoEllipse(u + size * 0.35, v - size * 0.05, size * 0.75, z, size * 0.25, 0.35);
    if (trunkH > 0) {
      this.lathe(u, v, z, [
        [0, 0.028 * size * 6],
        [trunkH, 0.018 * size * 6],
      ], () => '#6b4a2f', { outline: true });
    }
    const [cx, cyBase] = this.pt(u, v, z + trunkH);
    const R = size * this.T * 0.62;
    if (kind === 'ashoka') {
      // tall narrow columnar tree
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const rr = R * (0.55 - Math.abs(t - 0.35) * 0.45);
        this.blob(cx + (rng() - 0.5) * R * 0.25, cyBase - t * R * 2.1 + R * 0.4, Math.max(rr, R * 0.18), cols[i % cols.length]);
      }
      return;
    }
    const lumps = kind === 'shrub' ? 6 : 11;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < lumps; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * R * 0.62;
      pts.push([cx + Math.cos(a) * d, cyBase - R * (kind === 'shrub' ? 0.35 : 0.7) + Math.sin(a) * d * 0.7, R * (0.38 + rng() * 0.22)]);
    }
    // back-to-front (higher y later), bottom lumps darker
    pts.sort((a, b) => a[1] - b[1]);
    pts.forEach((p, i) => this.blob(p[0], p[1], p[2], cols[i % cols.length]));
    // leaf sparkle
    const { ctx } = this;
    for (let i = 0; i < lumps * 3; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * R * 0.8;
      ctx.fillStyle = rng() < 0.5 ? alpha('#c9e07a', 0.45) : alpha('#28401a', 0.35);
      ctx.fillRect(cx + Math.cos(a) * d - R * 0.2, cyBase - R * 0.85 + Math.sin(a) * d * 0.6, 1.6 * this.px, 1.6 * this.px);
    }
  }
}

/** Monotone-chain convex hull (screen points). */
export function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
