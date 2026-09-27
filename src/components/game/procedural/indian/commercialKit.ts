/**
 * Drawing kit for the Indian commercial buildings (./commercial.ts): bazaar shop fronts, painted
 * signboards, awnings, balconies, glass + ACP cladding, rooftop clutter, vehicles and people.
 *
 * Most helpers work on either visible wall of a box through a `Face`:
 *   'v' – the plane v = const (lit, faces the lower-left);  `a` runs along u.
 *   'u' – the plane u = const (shaded, faces the lower-right); `a` runs along v.
 * `out` pushes a feature off the wall towards the viewer (tile units).
 */
import { Iso, alpha, mat, shade, seededRng, type Mat, type P3 } from '../isoPainter';
import { C, drum, weatherU, weatherV, windowU, windowV } from '../varanasiSprites';

export type Rng = ReturnType<typeof seededRng>;
export type Face = 'u' | 'v';

// ============================================================================
// Face-generic geometry
// ============================================================================

/** Point on a wall plane: `a` along the wall, height z, pushed `out` towards the viewer. */
export function fp(f: Face, plane: number, a: number, z: number, out = 0): P3 {
  return f === 'v' ? [a, plane + out, z] : [plane + out, a, z];
}

/** Quad on a wall plane. */
export function fq(iso: Iso, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number, out = 0): P3[] {
  return f === 'v' ? iso.faceVQuad(plane + out, a0, a1, z0, z1) : iso.faceUQuad(plane + out, a0, a1, z0, z1);
}

/** Colour as seen on a face: the +u face sits in shade. */
export function ft(f: Face, c: string, k = 1): string {
  return f === 'v' ? c : shade(c, -0.26 * k);
}

/** Box sticking out of a wall by `depth`. */
export function projBox(iso: Iso, f: Face, plane: number, a0: number, a1: number, depth: number, z0: number, z1: number, m: Mat, opts: { edges?: boolean; noTop?: boolean } = {}): void {
  if (f === 'v') iso.box(a0, plane, a1, plane + depth, z0, z1, m, opts);
  else iso.box(plane, a0, plane + depth, a1, z0, z1, m, opts);
}

/** Horizontal line along a wall. */
export function fline(iso: Iso, f: Face, plane: number, a0: number, a1: number, z: number, color: string, lw = 1, out = 0): void {
  iso.line(fp(f, plane, a0, z, out), fp(f, plane, a1, z, out), color, lw);
}

/** Face-plane gradient running top (z1) to bottom (z0) at `a`. */
export function faceGradient(iso: Iso, f: Face, plane: number, a: number, z0: number, z1: number, stops: readonly [number, string][]): CanvasGradient {
  const [x, y0] = iso.pt(...fp(f, plane, a, z1));
  const [, y1] = iso.pt(...fp(f, plane, a, z0));
  const g = iso.ctx.createLinearGradient(x, y0, x, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

/** Soft cast shadow clipped to a rectangle of the plot (so tall buildings never paint off the lot). */
export function plotShadow(iso: Iso, base: readonly [number, number][], z: number, h: number, strength: number, clip: readonly [number, number, number, number]): void {
  iso.clipped(iso.topQuad(clip[0], clip[1], clip[2], clip[3], z), () => iso.castShadow(base, z, h, strength));
}

/** Rectangle cast shadow + ambient occlusion for a box standing on the plot. */
export function footShadow(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, h: number, plot: number, strength = 0.18): void {
  plotShadow(iso, [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ], z, h, strength, [0.03, 0.03, plot - 0.03, plot - 0.03]);
  iso.aoRect(u0, v0, u1, v1, z, 0.06, 0.42);
}

// ============================================================================
// Ground
// ============================================================================

/** Paver block footpath (grey/red interlocking tiles) on a horizontal rectangle. */
export function pavers(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, base = '#b3aa9a', accent = '#b0735a'): void {
  const pts = iso.topQuad(u0, v0, u1, v1, z);
  iso.poly(pts, base);
  iso.clipped(pts, () => {
    const s = 0.045;
    let i = 0;
    for (let u = u0; u < u1; u += s, i++) {
      let j = 0;
      for (let v = v0; v < v1; v += s, j++) {
        const k = (i + j) % 7 === 0 || (i * 3 + j) % 11 === 0;
        const tone = k ? accent : shade(base, (rng() - 0.5) * 0.1);
        iso.poly(iso.topQuad(u + 0.003, v + 0.003, u + s - 0.003, v + s - 0.003, z), tone);
      }
    }
  });
  iso.speckle(pts, rng, Math.round(260 * (u1 - u0) * (v1 - v0) + 20), [alpha('#5a4a3a', 0.25), alpha('#fff4dc', 0.3)], 1.2);
}

/** Kerb along the front edges of a footpath (a small raised lip). */
export function kerb(iso: Iso, u0: number, u1: number, v: number, z: number, along: 'u' | 'v'): void {
  const m = mat('#d6d0c4', { right: -0.25 });
  if (along === 'u') iso.box(u0, v - 0.015, u1, v, z, z + 0.012, m, { edges: false });
  else iso.box(v - 0.015, u0, v, u1, z, z + 0.012, m, { edges: false });
  // painted black/yellow kerb stones
  for (let a = u0; a < u1 - 0.02; a += 0.06) {
    const q = along === 'u' ? iso.faceVQuad(v, a, a + 0.03, z, z + 0.012) : iso.faceUQuad(v, a, a + 0.03, z, z + 0.012);
    iso.poly(q, along === 'u' ? '#e2c23e' : '#b39a2e');
  }
}

// ============================================================================
// Signboards
// ============================================================================

/**
 * Abstract painted lettering: 'deva' draws a Devanagari-like headline bar with hanging strokes,
 * 'latin' blocky capitals. Purely decorative (no real words or brands).
 */
export function lettering(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, zMid: number, hgt: number, color: string, style: 'deva' | 'latin', out: number): void {
  const lw = Math.max(0.9, hgt * 55);
  let a = a0;
  let words = 0;
  while (a < a1 - hgt * 0.9 && words < 6) {
    const wl = Math.min(a1 - a, hgt * (1.6 + rng() * 2.6));
    const top = zMid + hgt / 2;
    const bot = zMid - hgt / 2;
    if (style === 'deva') {
      iso.line(fp(f, plane, a, top, out), fp(f, plane, a + wl, top, out), color, lw * 1.15);
      for (let g = a + hgt * 0.25; g < a + wl - hgt * 0.05; g += hgt * (0.42 + rng() * 0.22)) {
        iso.line(fp(f, plane, g, top, out), fp(f, plane, g, bot, out), color, lw);
        const k = rng();
        if (k < 0.45) iso.line(fp(f, plane, g - hgt * 0.28, zMid - hgt * 0.05, out), fp(f, plane, g, zMid + hgt * 0.1, out), color, lw * 0.9);
        else if (k < 0.7) iso.line(fp(f, plane, g - hgt * 0.26, bot + hgt * 0.1, out), fp(f, plane, g - hgt * 0.26, zMid + hgt * 0.1, out), color, lw * 0.9);
      }
    } else {
      for (let g = a; g < a + wl - hgt * 0.3; g += hgt * 0.62) {
        const k = rng();
        const gw = hgt * (k < 0.2 ? 0.3 : 0.46);
        iso.poly(fq(iso, f, plane, g, g + gw, bot, top, out), color);
      }
    }
    a += wl + hgt * 0.8;
    words++;
  }
}

export interface SignOpts {
  out?: number;
  style?: 'deva' | 'latin';
  /** Second, smaller line of text (e.g. address / phone). */
  subline?: boolean;
  /** Round emblem at the start of the board. */
  emblem?: string;
  /** Border colour (painted frame). */
  border?: string;
  /** Board thickness. */
  depth?: number;
}

/** A hand-painted / flex signboard fixed to a wall. */
export function signboard(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number, bg: string, fg: string, opts: SignOpts = {}): void {
  const d = opts.depth ?? 0.01;
  const out = (opts.out ?? 0) + d;
  projBox(iso, f, plane + (opts.out ?? 0), a0, a1, d, z0, z1, mat(bg, { top: 0.1, right: -0.3 }), { edges: false });
  const face = fq(iso, f, plane, a0, a1, z0, z1, out);
  const H = z1 - z0;
  iso.poly(face, faceGradient(iso, f, plane, a0, z0, z1, [
    [0, ft(f, shade(bg, 0.12))],
    [0.6, ft(f, bg)],
    [1, ft(f, shade(bg, -0.12))],
  ]));
  if (opts.border) {
    const b = Math.min(0.006, H * 0.12);
    iso.poly(fq(iso, f, plane, a0, a1, z1 - b, z1, out), ft(f, opts.border));
    iso.poly(fq(iso, f, plane, a0, a1, z0, z0 + b, out), ft(f, opts.border));
  }
  let ta = a0 + H * 0.35;
  if (opts.emblem && a1 - a0 > H * 2.5) {
    const r = H * 0.34;
    const c = a0 + H * 0.5;
    const pts: P3[] = [];
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * Math.PI * 2;
      pts.push(fp(f, plane, c + Math.cos(t) * r, (z0 + z1) / 2 + Math.sin(t) * r, out + 0.0005));
    }
    iso.poly(pts, ft(f, opts.emblem), alpha(shade(opts.emblem, -0.5), 0.6), 0.6);
    ta = a0 + H * 1.05;
  }
  const style = opts.style ?? 'deva';
  const fgc = ft(f, fg, 0.6);
  if (opts.subline) {
    lettering(iso, rng, f, plane, ta, a1 - H * 0.3, z0 + H * 0.62, H * 0.36, fgc, style, out + 0.0005);
    lettering(iso, rng, f, plane, ta + H * 0.3, a1 - H * 0.6, z0 + H * 0.2, H * 0.14, alpha(fgc, 0.85), 'latin', out + 0.0005);
  } else {
    lettering(iso, rng, f, plane, ta, a1 - H * 0.3, (z0 + z1) / 2, H * 0.46, fgc, style, out + 0.0005);
  }
  // top highlight + hard edge
  fline(iso, f, plane, a0, a1, z1, alpha('#fff4dc', f === 'v' ? 0.55 : 0.3), 1, out);
  iso.poly(face, null, alpha(shade(bg, -0.6), 0.55), 0.8);
}

// ============================================================================
// Shop fronts
// ============================================================================

export type GoodsKind = 'sweets' | 'saris' | 'brass' | 'kirana' | 'mobile' | 'pharmacy' | 'cloth' | 'hardware' | 'closed';

/** Rolling-shutter shop opening with its stock inside. `open` ∈ [0, 1] is how far the shutter is up. */
export function shopOpening(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number, kind: GoodsKind, shutter: string, open = 1): void {
  const H = z1 - z0;
  const zo = kind === 'closed' ? z0 : z0 + H * Math.min(1, open) * 0.999;
  const w = a1 - a0;
  // interior (recess, lit by a warm tube light)
  if (zo > z0 + 0.001) {
    iso.poly(fq(iso, f, plane, a0, a1, z0, zo), faceGradient(iso, f, plane, a0, z0, zo, [
      [0, ft(f, '#6a4e3a')],
      [0.25, ft(f, '#4a3528')],
      [1, ft(f, '#2e241e')],
    ]));
    const zi = (t: number) => z0 + (zo - z0) * t;
    const shelf = (t: number) => fline(iso, f, plane, a0 + 0.004, a1 - 0.004, zi(t), alpha(ft(f, '#a88660'), 0.9), 1.1);
    const dots = (t: number, cols: readonly string[], n: number, sz: number) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + ((i + 0.5 + (rng() - 0.5) * 0.3) / n) * w;
        iso.poly(fq(iso, f, plane, a - sz / 2, a + sz / 2, zi(t), zi(t) + sz * 0.9), ft(f, cols[i % cols.length]));
      }
    };
    switch (kind) {
      case 'sweets': {
        shelf(0.55);
        dots(0.56, ['#e04f7a', '#f2c14e', '#ffffff', '#e87d2a'], Math.max(3, Math.round(w / 0.03)), 0.018);
        dots(0.78, ['#d9c07a', '#c14b3c', '#e8e0c8'], Math.max(3, Math.round(w / 0.04)), 0.016);
        break;
      }
      case 'saris': {
        const cols = ['#c2185b', '#f4a300', '#2e7d32', '#6a1b9a', '#d84315', '#00838f', '#ad1457', '#f9a825'];
        const n = Math.max(4, Math.round(w / 0.018));
        for (let i = 0; i < n; i++) {
          const a = a0 + (i / n) * w;
          const c = cols[(i * 3 + Math.floor(rng() * 2)) % cols.length];
          iso.poly(fq(iso, f, plane, a + 0.001, a + w / n - 0.001, zi(0.18 + rng() * 0.15), zi(0.95)), ft(f, c));
          iso.poly(fq(iso, f, plane, a + 0.001, a + w / n - 0.001, zi(0.3), zi(0.36)), ft(f, C.gold, 0.5));
        }
        break;
      }
      case 'brass': {
        shelf(0.35);
        shelf(0.68);
        for (const t of [0.36, 0.69]) {
          const n = Math.max(3, Math.round(w / 0.022));
          for (let i = 0; i < n; i++) {
            const a = a0 + ((i + 0.5) / n) * w;
            const r = 0.007 + rng() * 0.004;
            const pts: P3[] = [];
            for (let k = 0; k < 10; k++) {
              const th = (k / 10) * Math.PI;
              pts.push(fp(f, plane, a + Math.cos(th) * r, zi(t) + Math.sin(th) * r * 1.6, 0));
            }
            iso.poly(pts, ft(f, rng() < 0.3 ? '#b87333' : '#e0b040'));
          }
        }
        break;
      }
      case 'kirana': {
        shelf(0.4);
        shelf(0.7);
        dots(0.41, ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00'], Math.max(4, Math.round(w / 0.014)), 0.011);
        dots(0.71, ['#8e24aa', '#f4511e', '#fdd835', '#00897b'], Math.max(4, Math.round(w / 0.014)), 0.011);
        // hanging sachet strips
        for (let a = a0 + 0.012; a < a1 - 0.006; a += 0.028) iso.poly(fq(iso, f, plane, a, a + 0.007, zi(0.62), zi(0.98), 0.001), ft(f, ['#e53935', '#1e88e5', '#fdd835'][Math.floor(rng() * 3)]));
        break;
      }
      case 'mobile': {
        iso.poly(fq(iso, f, plane, a0, a1, zi(0.3), zi(0.97)), ft(f, '#2d6fb8'));
        shelf(0.62);
        dots(0.63, ['#1b1b1b', '#e0e0e0', '#1b1b1b'], Math.max(3, Math.round(w / 0.02)), 0.012);
        break;
      }
      case 'pharmacy': {
        iso.poly(fq(iso, f, plane, a0, a1, zi(0.3), zi(0.97)), ft(f, '#dfeee4'));
        shelf(0.5);
        shelf(0.75);
        dots(0.51, ['#ffffff', '#4caf50', '#e53935', '#90caf9'], Math.max(4, Math.round(w / 0.013)), 0.009);
        dots(0.76, ['#ffffff', '#fff176', '#4caf50'], Math.max(4, Math.round(w / 0.013)), 0.009);
        break;
      }
      case 'cloth': {
        const n = Math.max(3, Math.round(w / 0.02));
        for (let t = 0.3; t < 0.9; t += 0.12) dots(t, ['#e8e0cc', '#6d8fbf', '#c46a4a', '#2f3f5f', '#d8b05a'], n, 0.016);
        break;
      }
      case 'hardware': {
        shelf(0.5);
        dots(0.51, ['#9aa4aa', '#c86b2e', '#3a6fb0', '#e2c23e'], Math.max(3, Math.round(w / 0.02)), 0.014);
        // coils of pipe / rope hanging
        for (let a = a0 + 0.015; a < a1 - 0.01; a += 0.035) {
          const pts: P3[] = [];
          for (let k = 0; k < 10; k++) {
            const th = (k / 10) * Math.PI * 2;
            pts.push(fp(f, plane, a + Math.cos(th) * 0.009, zi(0.8) + Math.sin(th) * 0.012, 0.001));
          }
          iso.poly(pts, null, ft(f, rng() < 0.5 ? '#2a2a2a' : '#e07a2a'), 1.4);
        }
        break;
      }
      default:
        break;
    }
    // tube light
    fline(iso, f, plane, a0 + w * 0.3, a1 - w * 0.3, zo - Math.min(0.012, H * 0.08), alpha('#fffbe8', 0.95), 1.6);
    // counter / takht at the front
    if (kind === 'sweets' || kind === 'pharmacy' || kind === 'mobile') {
      iso.poly(fq(iso, f, plane, a0 + 0.004, a1 - 0.004, z0, z0 + H * 0.34, 0.001), ft(f, '#8a6a4a'));
      iso.poly(fq(iso, f, plane, a0 + 0.006, a1 - 0.006, z0 + H * 0.2, z0 + H * 0.32, 0.0015), ft(f, alpha('#cfe8ee', 0.85)));
      if (kind === 'sweets') {
        const n = Math.max(3, Math.round(w / 0.025));
        for (let i = 0; i < n; i++) {
          const a = a0 + ((i + 0.5) / n) * w;
          iso.poly(fq(iso, f, plane, a - 0.008, a + 0.008, z0 + H * 0.22, z0 + H * 0.28, 0.002), ft(f, ['#f28c28', '#fff3d6', '#7cb342', '#f2c14e', '#e57399'][i % 5]));
        }
      }
    } else if (kind !== 'closed') {
      iso.poly(fq(iso, f, plane, a0 + 0.004, a1 - 0.004, z0, z0 + H * 0.16, 0.001), ft(f, '#6b4a2f'));
      fline(iso, f, plane, a0 + 0.004, a1 - 0.004, z0 + H * 0.16, alpha(ft(f, '#e8cfa0'), 0.8), 1, 0.001);
    }
  }
  // shutter (rolled part or closed)
  if (zo < z1 - 0.0005) {
    const sq = fq(iso, f, plane, a0, a1, zo, z1, 0.001);
    iso.poly(sq, ft(f, shutter));
    iso.clipped(sq, () => {
      for (let z = zo + 0.006; z < z1; z += 0.007) {
        fline(iso, f, plane, a0, a1, z, alpha(ft(f, shade(shutter, -0.4)), 0.45), 0.6, 0.001);
        fline(iso, f, plane, a0, a1, z + 0.002, alpha(ft(f, shade(shutter, 0.35)), 0.35), 0.5, 0.001);
      }
      // rust / paint wear near the bottom
      for (let i = 0; i < 4; i++) {
        const a = a0 + rng() * (a1 - a0);
        iso.poly(fq(iso, f, plane, a, a + 0.01 + rng() * 0.015, zo, zo + 0.01 + rng() * 0.02, 0.0015), alpha(C.rust, 0.35));
      }
    });
    fline(iso, f, plane, a0, a1, zo, alpha('#1e1a14', 0.7), 1.3, 0.0015);
    // lock handles
    if (kind === 'closed' || open < 0.5) {
      const m = (a0 + a1) / 2;
      iso.poly(fq(iso, f, plane, m - 0.006, m + 0.006, zo + 0.004, zo + 0.012, 0.002), ft(f, '#3a3a3a'));
    }
  }
  // shutter box at the top
  projBox(iso, f, plane, a0 - 0.004, a1 + 0.004, 0.012, z1, z1 + 0.018, mat(shade(shutter, -0.1), { right: -0.3 }), { edges: false });
}

// ============================================================================
// Awnings, ledges, balconies, windows
// ============================================================================

export type AwningKind = 'stripe' | 'tin' | 'tarp' | 'plain';

/** Sloping awning from the wall at height z out to `depth`, dropping by `drop`. */
export function awning(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, z: number, depth: number, drop: number, color: string, kind: AwningKind, color2 = '#f3ede0'): void {
  // shadow on the wall under the awning
  iso.poly(fq(iso, f, plane, a0, a1, z - drop * 2.2, z, 0.0008), alpha('#1e140c', 0.28));
  // brackets
  for (const a of [a0 + 0.01, a1 - 0.01]) iso.line(fp(f, plane, a, z - drop * 2.4), fp(f, plane, a, z - drop, depth * 0.95), alpha('#2a2420', 0.8), 1.1);
  const pts: P3[] = [fp(f, plane, a0, z), fp(f, plane, a1, z), fp(f, plane, a1, z - drop, depth), fp(f, plane, a0, z - drop, depth)];
  const k = f === 'v' ? 0.06 : -0.2;
  iso.poly(pts, shade(color, k), alpha(shade(color, -0.6), 0.6), 0.8);
  iso.clipped(pts, () => {
    if (kind === 'stripe') {
      for (let a = a0; a < a1; a += 0.03) {
        iso.poly([fp(f, plane, a, z + 0.01), fp(f, plane, a + 0.015, z + 0.01), fp(f, plane, a + 0.015, z - drop - 0.01, depth + 0.01), fp(f, plane, a, z - drop - 0.01, depth + 0.01)], shade(color2, k));
      }
    } else if (kind === 'tin') {
      for (let a = a0 + 0.006; a < a1; a += 0.012) iso.line(fp(f, plane, a, z), fp(f, plane, a, z - drop, depth), alpha(shade(color, -0.35), 0.45), 0.6);
      for (let i = 0; i < 4; i++) {
        const a = a0 + rng() * (a1 - a0);
        const t = rng();
        const [pu, pv, pz] = fp(f, plane, a, z - drop * t, depth * t);
        iso.ellipse(pu, pv, pz, 0.01 + rng() * 0.015, alpha(C.rust, 0.4));
      }
    } else if (kind === 'tarp') {
      for (let i = 1; i < 4; i++) {
        const a = a0 + ((a1 - a0) * i) / 4;
        iso.line(fp(f, plane, a, z), fp(f, plane, a + 0.01, z - drop, depth), alpha(shade(color, -0.3), 0.6), 1.2);
      }
    }
  });
  // front valance with scallops
  const vz = z - drop;
  const vh = Math.min(0.02, drop * 0.7 + 0.006);
  const val: P3[] = [fp(f, plane, a0, vz, depth), fp(f, plane, a1, vz, depth)];
  const n = Math.max(3, Math.round((a1 - a0) / 0.02));
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    val.push(fp(f, plane, a, vz - vh * (i % 2 ? 1 : 0.6), depth));
  }
  const vc = kind === 'tin' ? shade(color, -0.1) : kind === 'stripe' ? color2 : color;
  iso.poly(val, ft(f, vc), alpha(shade(vc, -0.6), 0.5), 0.6);
  iso.line(fp(f, plane, a0, vz, depth), fp(f, plane, a1, vz, depth), alpha('#fff4dc', 0.45), 0.8);
}

/** Continuous concrete sun-shade ledge (chhajja) around the given faces. */
export function chhajja(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, depth: number, color: string, faces: { v?: boolean; u?: boolean } = { v: true, u: true }): void {
  const m = mat(color, { top: 0.16, right: -0.3 });
  const t = 0.012;
  if (faces.v) iso.box(u0 - (faces.u ? 0 : 0), v1, u1, v1 + depth, z - t, z, m, { edges: false });
  if (faces.u) iso.box(u1, v0, u1 + depth, v1 + (faces.v ? depth : 0), z - t, z, m, { edges: false });
  if (faces.v) iso.line([u0, v1 + depth, z - t], [u1 + (faces.u ? depth : 0), v1 + depth, z - t], alpha('#1e140c', 0.45), 0.9);
  if (faces.u) iso.line([u1 + depth, v0, z - t], [u1 + depth, v1 + (faces.v ? depth : 0), z - t], alpha('#1e140c', 0.5), 0.9);
  // shadow line cast on the wall below
  if (faces.v) iso.poly(iso.faceVQuad(v1 + 0.0008, u0, u1, z - t - 0.02, z - t), alpha('#1e140c', 0.18));
  if (faces.u) iso.poly(iso.faceUQuad(u1 + 0.0008, v0, v1, z - t - 0.02, z - t), alpha('#1e140c', 0.18));
}

/** Window with a painted frame, MS grill and a small sun-shade. */
export function grilledWindow(iso: Iso, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number, frame: string, opts: { glass?: string; shutters?: string; shade?: boolean; grill?: string } = {}): void {
  const glass = ft(f, opts.glass ?? '#34414c');
  if (f === 'v') windowV(iso, plane, a0, a1, z0, z1, glass, ft(f, frame));
  else windowU(iso, plane, a0, a1, z0, z1, glass, ft(f, frame));
  // reflection
  iso.poly([fp(f, plane, a0 + (a1 - a0) * 0.15, z1, 0.0005), fp(f, plane, a0 + (a1 - a0) * 0.4, z1, 0.0005), fp(f, plane, a0 + (a1 - a0) * 0.1, z0, 0.0005), fp(f, plane, a0, z0, 0.0005), fp(f, plane, a0, z0 + (z1 - z0) * 0.3, 0.0005)], alpha('#cfe3f0', f === 'v' ? 0.22 : 0.12));
  if (opts.shutters) {
    const sw = (a1 - a0) * 0.28;
    iso.poly(fq(iso, f, plane, a0, a0 + sw, z0, z1, 0.001), ft(f, opts.shutters));
    fline(iso, f, plane, a0, a0 + sw, (z0 + z1) / 2, alpha('#1e140c', 0.4), 0.6, 0.001);
  }
  const gc = alpha(ft(f, opts.grill ?? '#2d2a28'), 0.75);
  for (let a = a0 + 0.008; a < a1 - 0.003; a += 0.011) iso.line(fp(f, plane, a, z0, 0.002), fp(f, plane, a, z1, 0.002), gc, 0.7);
  fline(iso, f, plane, a0, a1, (z0 + z1) / 2, gc, 0.7, 0.002);
  if (opts.shade !== false) projBox(iso, f, plane, a0 - 0.008, a1 + 0.008, 0.022, z1 + 0.004, z1 + 0.012, mat('#cfc6b4', { right: -0.3 }), { edges: false });
}

/** Cantilevered balcony with an MS railing; laundry optionally draped over it. */
export function balcony(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, z: number, depth: number, slabColor: string, rail: string, laundry: readonly string[] = []): void {
  // door + window behind (drawn first)
  const w = a1 - a0;
  iso.poly(fq(iso, f, plane, a0 + w * 0.12, a0 + w * 0.34, z, z + 0.1), ft(f, '#3b2e28'));
  iso.poly(fq(iso, f, plane, a0 + w * 0.14, a0 + w * 0.32, z + 0.003, z + 0.097, 0.0005), ft(f, '#6b4a34'));
  grilledWindow(iso, f, plane, a0 + w * 0.48, a0 + w * 0.86, z + 0.035, z + 0.09, '#e8e0cc', { shade: false });
  // underside shadow on the wall, slab
  iso.poly(fq(iso, f, plane, a0, a1, z - 0.03, z - 0.01, 0.0008), alpha('#1e140c', 0.2));
  projBox(iso, f, plane, a0, a1, depth, z - 0.012, z, mat(slabColor, { top: 0.15, right: -0.3 }), { edges: true });
  const rh = 0.05;
  const rc = ft(f, rail, 0.5);
  // side rails
  for (const a of [a0 + 0.003, a1 - 0.003]) {
    iso.line(fp(f, plane, a, z + rh), fp(f, plane, a, z + rh, depth), rc, 1.2);
    iso.line(fp(f, plane, a, z, depth), fp(f, plane, a, z + rh, depth), rc, 1.3);
  }
  // front bars
  for (let a = a0 + 0.008; a < a1 - 0.004; a += 0.009) iso.line(fp(f, plane, a, z, depth), fp(f, plane, a, z + rh, depth), alpha(rc, 0.85), 0.65);
  fline(iso, f, plane, a0, a1, z + rh * 0.45, alpha(rc, 0.85), 0.8, depth);
  fline(iso, f, plane, a0 + 0.003, a1 - 0.003, z + rh, rc, 1.5, depth);
  // laundry draped over the rail
  let a = a0 + 0.01 + rng() * 0.02;
  for (const c of laundry) {
    const lw = 0.025 + rng() * 0.025;
    if (a + lw > a1 - 0.006) break;
    const hang = 0.025 + rng() * 0.02;
    iso.poly(fq(iso, f, plane, a, a + lw, z + rh - hang, z + rh + 0.002, depth + 0.002), ft(f, c), alpha(shade(c, -0.5), 0.6), 0.5);
    fline(iso, f, plane, a, a + lw, z + rh - hang * 0.4, alpha(shade(c, -0.25), 0.6), 0.6, depth + 0.003);
    a += lw + 0.006 + rng() * 0.015;
  }
}

/** Split AC outdoor unit on a wall bracket. */
export function acUnit(iso: Iso, f: Face, plane: number, a: number, z: number): void {
  const w = 0.05;
  projBox(iso, f, plane, a, a + w, 0.022, z, z + 0.034, mat('#e4e2dc', { right: -0.25 }), { edges: true });
  const pts: P3[] = [];
  const c = a + w * 0.4;
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    pts.push(fp(f, plane, c + Math.cos(t) * 0.012, z + 0.017 + Math.sin(t) * 0.012, 0.0225));
  }
  iso.poly(pts, ft(f, '#6d6d6d'), alpha('#2a2a2a', 0.6), 0.5);
  // drip stain
  iso.poly(fq(iso, f, plane, c - 0.002, c + 0.004, z - 0.06, z, 0.0006), alpha('#3a2a1a', 0.2));
}

/** Vertical drain / water pipe down a wall. */
export function wallPipe(iso: Iso, f: Face, plane: number, a: number, z0: number, z1: number, color = '#5b5f63'): void {
  iso.line(fp(f, plane, a, z0, 0.006), fp(f, plane, a, z1, 0.006), alpha('#1e1a14', 0.4), 2.6);
  iso.line(fp(f, plane, a, z0, 0.006), fp(f, plane, a, z1, 0.006), ft(f, color), 1.8);
}

// ============================================================================
// Glass + ACP cladding
// ============================================================================

/** Tinted glass curtain wall with mullions, transoms and a sky reflection. */
export function curtainWall(iso: Iso, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number, glass: string, mullion: string, colW: number, rowH: number, out = 0): void {
  const q = fq(iso, f, plane, a0, a1, z0, z1, out);
  const g = ft(f, glass, 0.8);
  iso.poly(q, faceGradient(iso, f, plane, a0, z0, z1, [
    [0, shade(g, 0.28)],
    [0.45, g],
    [1, shade(g, -0.18)],
  ]));
  iso.clipped(q, () => {
    // diagonal sky reflections
    const span = a1 - a0;
    for (const [s, wdt, al] of [
      [0.12, 0.16, 0.16],
      [0.5, 0.07, 0.12],
      [0.72, 0.2, 0.1],
    ] as [number, number, number][]) {
      const b0 = a0 + span * s;
      const dz = z1 - z0;
      iso.poly([fp(f, plane, b0, z1, out), fp(f, plane, b0 + span * wdt, z1, out), fp(f, plane, b0 + span * wdt - dz * 0.5, z0, out), fp(f, plane, b0 - dz * 0.5, z0, out)], alpha('#eaf6ff', f === 'v' ? al : al * 0.6));
    }
    const mc = alpha(ft(f, mullion, 0.6), 0.9);
    for (let a = a0 + colW; a < a1 - 1e-4; a += colW) iso.line(fp(f, plane, a, z0, out), fp(f, plane, a, z1, out), mc, 0.9);
    for (let z = z0 + rowH; z < z1 - 1e-4; z += rowH) {
      fline(iso, f, plane, a0, a1, z, mc, 1.3, out);
      fline(iso, f, plane, a0, a1, z - 0.003, alpha('#0e1a22', 0.25), 0.7, out);
    }
  });
  iso.poly(q, null, alpha(ft(f, mullion, 0.6), 0.9), 1);
}

/** Aluminium composite panel band with panel joints. */
export function acp(iso: Iso, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number, color: string, out = 0, panelW = 0.09): void {
  const q = fq(iso, f, plane, a0, a1, z0, z1, out);
  iso.poly(q, faceGradient(iso, f, plane, a0, z0, z1, [
    [0, ft(f, shade(color, 0.12))],
    [1, ft(f, shade(color, -0.06))],
  ]));
  const jc = alpha(ft(f, shade(color, -0.45)), 0.55);
  for (let a = a0 + panelW; a < a1 - 1e-4; a += panelW) iso.line(fp(f, plane, a, z0, out), fp(f, plane, a, z1, out), jc, 0.6);
  if (z1 - z0 > 0.07) fline(iso, f, plane, a0, a1, (z0 + z1) / 2, jc, 0.6, out);
  fline(iso, f, plane, a0, a1, z1, alpha('#ffffff', f === 'v' ? 0.5 : 0.25), 0.8, out);
}

// ============================================================================
// Rooftops
// ============================================================================

/** Low parapet walls around a roof: 'back' draws the two far sides, 'front' the two near ones. */
export function parapet(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, h: number, t: number, m: Mat, part: 'back' | 'front'): void {
  if (part === 'back') {
    iso.box(u0, v0, u1, v0 + t, z, z + h, m, { edges: false });
    iso.box(u0, v0, u0 + t, v1, z, z + h, m, { edges: false });
    return;
  }
  iso.box(u1 - t, v0, u1, v1, z, z + h, m, { edges: false });
  iso.box(u0, v1 - t, u1, v1, z, z + h, m, { edges: false });
  iso.line([u0, v1, z + h], [u1, v1, z + h], alpha('#fff4dc', 0.5), 0.9);
}

/** Roof slab surface: waterproofing patches, stains and grit. */
export function roofSurface(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, base = '#b8ad9c'): void {
  const pts = iso.topQuad(u0, v0, u1, v1, z);
  iso.poly(pts, base);
  iso.clipped(pts, () => {
    for (let i = 0; i < 5; i++) {
      const u = u0 + rng() * (u1 - u0);
      const v = v0 + rng() * (v1 - v0);
      iso.ellipse(u, v, z, 0.03 + rng() * 0.07, alpha(rng() < 0.5 ? '#8a7e6c' : '#d4cab8', 0.3));
    }
  });
  iso.speckle(pts, rng, Math.round(420 * (u1 - u0) * (v1 - v0) + 20), [alpha('#6e6252', 0.35), alpha('#f0e8d8', 0.35)], 1.2);
}

/** Black ribbed Sintex water tank on a small brick stand. */
export function sintex(iso: Iso, u: number, v: number, z: number, r = 0.045, h = 0.075, color = '#26272b'): void {
  iso.aoRect(u - r, v - r, u + r, v + r, z, 0.02, 0.3);
  iso.box(u - r * 0.8, v - r * 0.8, u + r * 0.8, v + r * 0.8, z, z + 0.02, mat(C.brick), { edges: false });
  drum(iso, u, v, z + 0.02, r, h, color);
  iso.lathe(u, v, z + 0.02 + h, [
    [0, r * 0.4],
    [0.008, r * 0.4],
    [0.01, 0],
  ], () => shade(color, 0.12), { outline: false });
  // overflow pipe
  iso.line([u + r * 0.7, v + r * 0.7, z + 0.02 + h * 0.8], [u + r * 0.7, v + r * 0.7, z], alpha('#e8e0cc', 0.8), 1.1);
}

/** Satellite TV dish on a short pole. */
export function tvDish(iso: Iso, u: number, v: number, z: number, r = 0.025): void {
  const { ctx } = iso;
  iso.line([u, v, z], [u, v, z + r * 1.6], '#4a4a4a', 1.1);
  const [x, y] = iso.pt(u, v, z + r * 2);
  const R = r * iso.T * 0.72;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.55);
  ctx.beginPath();
  ctx.ellipse(0, 0, R, R * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#9a9a96';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-R * 0.08, -R * 0.04, R * 0.9, R * 0.54, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e4e2dc';
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,40,0.5)';
  ctx.lineWidth = 0.7 * iso.px;
  ctx.stroke();
  ctx.restore();
  iso.line([u, v, z + r * 2], [u + r * 0.8, v + r * 0.2, z + r * 2.6], '#555', 0.9);
}

/** Rusty rebar sticking out of column stubs: the next floor is "coming soon". */
export function rebar(iso: Iso, u: number, v: number, z: number, h = 0.07): void {
  iso.box(u - 0.012, v - 0.012, u + 0.012, v + 0.012, z, z + 0.018, mat(C.concrete), { edges: false });
  const pts: [number, number][] = [
    [-0.007, -0.007],
    [0.007, -0.007],
    [-0.007, 0.007],
    [0.007, 0.007],
  ];
  for (const [du, dv] of pts) {
    iso.line([u + du, v + dv, z + 0.018], [u + du * 1.3, v + dv * 1.3, z + h], alpha(C.rust, 0.95), 0.9);
  }
  iso.line([u - 0.008, v - 0.008, z + h * 0.7], [u + 0.008, v + 0.008, z + h * 0.7], alpha(C.rust, 0.7), 0.6);
}

/** Stair-head room (mumty) on a roof with its door on the +v side. */
export function mumty(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, h: number, wall: string): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.03, 0.35);
  iso.box(u0, v0, u1, v1, z, z + h, mat(wall));
  const m = (u0 + u1) / 2;
  iso.poly(iso.faceVQuad(v1, m - 0.025, m + 0.025, z, z + h * 0.78), '#4a6a7a', alpha('#1e1a14', 0.6), 0.7);
  iso.box(u0 - 0.012, v0 - 0.012, u1 + 0.012, v1 + 0.02, z + h, z + h + 0.012, mat('#c9bfae'));
  weatherV(iso, rng, v1, u0, u1, z, z + h, 5, 0.12);
  weatherU(iso, rng, u1, v0, v1, z, z + h, 5, 0.14);
}

/** Tulsi / flower pots on a roof or balcony ledge. */
export function pots(iso: Iso, rng: Rng, u: number, v: number, z: number, n: number, along: 'u' | 'v' = 'u'): void {
  for (let i = 0; i < n; i++) {
    const pu = u + (along === 'u' ? i * 0.035 : 0);
    const pv = v + (along === 'v' ? i * 0.035 : 0);
    iso.box(pu, pv, pu + 0.022, pv + 0.022, z, z + 0.02, mat('#b0603c'), { edges: false });
    iso.tree(pu + 0.011, pv + 0.011, z + 0.02, 0.022 + rng() * 0.01, rng, 'shrub');
  }
}

/** Sagging overhead wires between two points. */
export function wires(iso: Iso, a: P3, b: P3, n = 3, sag = 0.03): void {
  for (let k = 0; k < n; k++) {
    const pts: P3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] - k * 0.008 + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * (sag + k * 0.006)]);
    }
    iso.polyline(pts, alpha('#1c1c1c', 0.7), 0.7);
  }
}

/** Concrete electric pole with a transformer-ish box and a tangle of wires. */
export function elecPole(iso: Iso, u: number, v: number, z: number, h: number): void {
  iso.aoEllipse(u, v, 0.012, z, 0.01, 0.4);
  iso.box(u - 0.006, v - 0.006, u + 0.006, v + 0.006, z, z + h, mat('#b9b3a6'), { edges: false });
  iso.box(u - 0.025, v - 0.004, u + 0.025, v + 0.004, z + h - 0.02, z + h - 0.012, mat('#6a6a6a'), { edges: false });
  iso.box(u + 0.006, v - 0.015, u + 0.03, v + 0.015, z + h * 0.55, z + h * 0.7, mat('#7f8a7a'));
  for (let i = 0; i < 4; i++) {
    const ang = i * 1.3;
    const pts: P3[] = [];
    for (let k = 0; k < 6; k++) pts.push([u + Math.cos(ang + k) * 0.01, v + Math.sin(ang + k) * 0.01, z + h * (0.62 + k * 0.035)]);
    iso.polyline(pts, alpha('#1c1c1c', 0.7), 0.7);
  }
}

// ============================================================================
// Street life
// ============================================================================

/** Tiny standing person (kurta/sari colour `c`). */
export function person(iso: Iso, u: number, v: number, z: number, c: string, h = 0.07, head = '#3a2a22'): void {
  iso.ellipse(u + 0.008, v - 0.002, z, 0.012, 'rgba(30,20,12,0.3)');
  iso.line([u - 0.004, v, z], [u - 0.003, v, z + h * 0.42], '#3a3a44', 1.4);
  iso.line([u + 0.004, v, z], [u + 0.003, v, z + h * 0.42], '#3a3a44', 1.4);
  iso.lathe(u, v, z + h * 0.35, [
    [0, 0.009],
    [h * 0.25, 0.01],
    [h * 0.45, 0.007],
  ], () => c, { outline: true, step: 1.2 });
  iso.lathe(u, v, z + h * 0.82, [
    [0, 0.005],
    [h * 0.08, 0.0065],
    [h * 0.16, 0.004],
    [h * 0.18, 0],
  ], (t) => (t > 0.5 ? head : '#a8704c'), { outline: true, step: 1.2 });
}

type Orient = 'u' | 'v';

/** Box in a vehicle's local frame (a = along its length, b = across). */
function vbox(iso: Iso, o: Orient, u: number, v: number, a0: number, b0: number, a1: number, b1: number, z0: number, z1: number, m: Mat, opts: { edges?: boolean; noTop?: boolean } = {}): void {
  if (o === 'u') iso.box(u + a0, v + b0, u + a1, v + b1, z0, z1, m, opts);
  else iso.box(u + b0, v + a0, u + b1, v + a1, z0, z1, m, opts);
}
function vpt(o: Orient, u: number, v: number, a: number, b: number, z: number): P3 {
  return o === 'u' ? [u + a, v + b, z] : [u + b, v + a, z];
}
/** Quad on the vehicle's nose plane (a = const) spanning b. */
function vnose(iso: Iso, o: Orient, u: number, v: number, a: number, b0: number, b1: number, z0: number, z1: number): P3[] {
  return o === 'u' ? iso.faceUQuad(u + a, v + b0, v + b1, z0, z1) : iso.faceVQuad(v + a, u + b0, u + b1, z0, z1);
}
/** Quad on the vehicle's visible side (b = const) spanning a. */
function vside(iso: Iso, o: Orient, u: number, v: number, b: number, a0: number, a1: number, z0: number, z1: number): P3[] {
  return o === 'u' ? iso.faceVQuad(v + b, u + a0, u + a1, z0, z1) : iso.faceUQuad(u + b, v + a0, v + a1, z0, z1);
}
function wheel(iso: Iso, p: P3, r: number): void {
  const [x, y] = iso.pt(...p);
  const { ctx } = iso;
  ctx.beginPath();
  ctx.ellipse(x, y, r * iso.T * 0.5, r * iso.T * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1c1e';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, r * iso.T * 0.22, r * iso.T * 0.27, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8a8a8a';
  ctx.fill();
}

/** CNG auto-rickshaw: green body, yellow canopy. Nose towards +a. */
export function autoRickshaw(iso: Iso, u: number, v: number, z: number, o: Orient, body = '#2e8b3a', top = '#f2c230'): void {
  const L = 0.12;
  const W = 0.065;
  iso.aoRect(o === 'u' ? u : u, o === 'u' ? v : v, o === 'u' ? u + L : u + W, o === 'u' ? v + W : v + L, z, 0.02, 0.4);
  vbox(iso, o, u, v, 0.0, 0.0, 0.1, W, z + 0.012, z + 0.042, mat(body));
  vbox(iso, o, u, v, 0.095, W * 0.25, L, W * 0.75, z + 0.012, z + 0.038, mat(body));
  // open side (dark cabin + seat)
  iso.poly(vside(iso, o, u, v, W, 0.01, 0.07, z + 0.042, z + 0.078), '#262220');
  iso.poly(vside(iso, o, u, v, W + 0.0005, 0.015, 0.05, z + 0.042, z + 0.052), '#6a3a2a');
  // windscreen
  iso.poly(vnose(iso, o, u, v, 0.094, 0.006, W - 0.006, z + 0.042, z + 0.078), alpha('#9ec3d0', 0.9), alpha('#1e1e1e', 0.6), 0.6);
  // canopy posts + canopy
  for (const [a, b] of [
    [0.004, W],
    [0.092, W],
    [0.092, 0],
  ] as [number, number][])
    iso.line(vpt(o, u, v, a, b, z + 0.042), vpt(o, u, v, a, b, z + 0.08), '#1e1e1e', 1.1);
  vbox(iso, o, u, v, -0.004, -0.003, 0.1, W + 0.003, z + 0.078, z + 0.092, mat(top, { top: 0.12 }));
  iso.poly(vside(iso, o, u, v, W + 0.0035, -0.004, 0.1, z + 0.078, z + 0.084), '#1e1e1e');
  wheel(iso, vpt(o, u, v, 0.02, W, z + 0.012), 0.022);
  wheel(iso, vpt(o, u, v, 0.108, W * 0.75, z + 0.012), 0.02);
  // headlamp
  const [hx, hy] = iso.pt(...vpt(o, u, v, L, W * 0.5, z + 0.03));
  iso.ctx.fillStyle = '#fff6c8';
  iso.ctx.fillRect(hx - 1 * iso.px, hy - 1 * iso.px, 2.2 * iso.px, 2.2 * iso.px);
}

/** Battery e-rickshaw: long flat canopy, open sides, blue/grey body. */
export function eRickshaw(iso: Iso, u: number, v: number, z: number, o: Orient, body = '#3f7fbf', top = '#e8e4da'): void {
  const L = 0.14;
  const W = 0.07;
  iso.aoRect(o === 'u' ? u : u, o === 'u' ? v : v, o === 'u' ? u + L : u + W, o === 'u' ? v + W : v + L, z, 0.02, 0.4);
  vbox(iso, o, u, v, 0.0, 0.0, 0.11, W, z + 0.014, z + 0.036, mat(body));
  vbox(iso, o, u, v, 0.11, W * 0.2, L, W * 0.8, z + 0.014, z + 0.034, mat(body));
  iso.poly(vside(iso, o, u, v, W + 0.0005, 0.01, 0.1, z + 0.036, z + 0.05), '#5a3a2e');
  iso.poly(vnose(iso, o, u, v, 0.11, 0.006, W - 0.006, z + 0.036, z + 0.08), alpha('#a8c8d4', 0.85), alpha('#1e1e1e', 0.6), 0.6);
  for (const [a, b] of [
    [0.004, W],
    [0.108, W],
    [0.108, 0],
    [0.05, W],
  ] as [number, number][])
    iso.line(vpt(o, u, v, a, b, z + 0.036), vpt(o, u, v, a, b, z + 0.085), '#2a2a2a', 1);
  vbox(iso, o, u, v, -0.006, -0.004, 0.118, W + 0.004, z + 0.084, z + 0.094, mat(top, { top: 0.1 }));
  iso.poly(vside(iso, o, u, v, W + 0.0045, -0.006, 0.118, z + 0.084, z + 0.089), shade(body, -0.1));
  wheel(iso, vpt(o, u, v, 0.022, W, z + 0.014), 0.02);
  wheel(iso, vpt(o, u, v, 0.125, W * 0.8, z + 0.014), 0.018);
}

/** Small hatchback car. */
export function car(iso: Iso, u: number, v: number, z: number, o: Orient, body: string): void {
  const L = 0.17;
  const W = 0.085;
  iso.aoRect(o === 'u' ? u : u, o === 'u' ? v : v, o === 'u' ? u + L : u + W, o === 'u' ? v + W : v + L, z, 0.025, 0.45);
  vbox(iso, o, u, v, 0, 0, L, W, z + 0.012, z + 0.042, mat(body, { top: 0.2 }));
  vbox(iso, o, u, v, 0.03, 0.006, 0.13, W - 0.006, z + 0.042, z + 0.075, mat(shade(body, 0.05), { top: 0.2 }), { noTop: true });
  // glass
  iso.poly(vside(iso, o, u, v, W - 0.006 + 0.0005, 0.036, 0.124, z + 0.046, z + 0.071), alpha('#2c3e4c', 0.92));
  iso.poly(vnose(iso, o, u, v, 0.13 + 0.0005, 0.012, W - 0.012, z + 0.046, z + 0.071), alpha('#3c5666', 0.92));
  const roof = o === 'u' ? iso.topQuad(u + 0.03, v + 0.006, u + 0.13, v + W - 0.006, z + 0.075) : iso.topQuad(u + 0.006, v + 0.03, u + W - 0.006, v + 0.13, z + 0.075);
  iso.poly(roof, shade(body, 0.22), alpha(shade(body, -0.5), 0.5), 0.6);
  wheel(iso, vpt(o, u, v, 0.035, W, z + 0.014), 0.024);
  wheel(iso, vpt(o, u, v, 0.135, W, z + 0.014), 0.024);
  const [hx, hy] = iso.pt(...vpt(o, u, v, L, W * 0.2, z + 0.032));
  iso.ctx.fillStyle = '#fff6c8';
  iso.ctx.fillRect(hx - 1 * iso.px, hy - 1 * iso.px, 2.5 * iso.px, 2 * iso.px);
}

/** Parked scooter / motorbike. */
export function scooter(iso: Iso, u: number, v: number, z: number, o: Orient, body: string): void {
  const L = 0.07;
  iso.aoRect(u, v, o === 'u' ? u + L : u + 0.02, o === 'u' ? v + 0.02 : v + L, z, 0.012, 0.35);
  vbox(iso, o, u, v, 0.008, 0.004, 0.058, 0.016, z + 0.012, z + 0.03, mat(body), { edges: false });
  vbox(iso, o, u, v, 0.012, 0.003, 0.036, 0.017, z + 0.03, z + 0.036, mat('#262626'), { edges: false });
  iso.line(vpt(o, u, v, 0.058, 0.01, z + 0.015), vpt(o, u, v, 0.062, 0.01, z + 0.05), '#2a2a2a', 1.1);
  iso.line(vpt(o, u, v, 0.062, 0.0, z + 0.05), vpt(o, u, v, 0.062, 0.02, z + 0.05), '#2a2a2a', 1.1);
  wheel(iso, vpt(o, u, v, 0.012, 0.02, z + 0.01), 0.014);
  wheel(iso, vpt(o, u, v, 0.06, 0.02, z + 0.01), 0.014);
}

/** Stack / heap of goods on the ground in front of a shop. */
export function goodsOut(iso: Iso, rng: Rng, kind: GoodsKind, u: number, v: number, z: number): void {
  switch (kind) {
    case 'kirana': {
      // open jute sacks of grain and dal
      const fills = ['#e8d7a8', '#e2a53a', '#c8742e', '#f0ead8', '#9a6a3a'];
      for (let i = 0; i < 3; i++) {
        const su = u + i * 0.038;
        iso.lathe(su, v, z, [
          [0, 0.016],
          [0.022, 0.019],
          [0.034, 0.016],
        ], () => '#c8a86e', { outline: true, step: 1.2 });
        iso.ellipse(su, v, z + 0.034, 0.013, fills[(i + Math.floor(rng() * 5)) % fills.length]);
      }
      break;
    }
    case 'brass': {
      for (let i = 0; i < 4; i++) {
        const su = u + (i % 2) * 0.03;
        const sv = v + Math.floor(i / 2) * 0.03;
        iso.lathe(su, sv, z, [
          [0, 0.008],
          [0.008, 0.015],
          [0.018, 0.013],
          [0.024, 0.007],
          [0.03, 0.009],
        ], () => (i % 3 === 2 ? '#c07038' : '#dcae3e'), { outline: true, lit: 0.45, dark: -0.35, step: 1.2 });
      }
      break;
    }
    case 'hardware': {
      for (let i = 0; i < 3; i++) {
        const c = ['#e53935', '#1e88e5', '#43a047'][i];
        iso.lathe(u + i * 0.03, v, z, [
          [0, 0.01],
          [0.028, 0.014],
        ], () => c, { top: shade(c, -0.2), outline: true, step: 1.2 });
      }
      break;
    }
    case 'sweets': {
      // halwai's brick stove with a big iron kadhai
      iso.box(u, v, u + 0.06, v + 0.05, z, z + 0.03, mat(C.brick), { edges: true });
      iso.poly(iso.faceVQuad(v + 0.05, u + 0.02, u + 0.04, z + 0.004, z + 0.02), '#e8761a');
      iso.lathe(u + 0.03, v + 0.025, z + 0.03, [
        [0, 0.012],
        [0.008, 0.024],
        [0.012, 0.028],
      ], () => '#2c2a28', { outline: true, step: 1.2 });
      iso.ellipse(u + 0.03, v + 0.025, z + 0.041, 0.024, '#c8801e');
      iso.ellipse(u + 0.024, v + 0.02, z + 0.042, 0.008, alpha('#fff0c0', 0.5));
      break;
    }
    case 'cloth':
    case 'saris': {
      // bolts of cloth on a low table
      iso.box(u, v, u + 0.07, v + 0.04, z, z + 0.028, mat(C.wood), { edges: true });
      const cols = ['#c2185b', '#f4a300', '#00838f', '#6a1b9a', '#e8e0cc'];
      for (let i = 0; i < 4; i++) iso.box(u + 0.004 + i * 0.016, v + 0.006, u + 0.018 + i * 0.016, v + 0.034, z + 0.028, z + 0.04, mat(cols[(i + Math.floor(rng() * 3)) % cols.length]), { edges: false });
      break;
    }
    default: {
      // crates of fruit / vegetables
      for (let i = 0; i < 2; i++) {
        const cu = u + i * 0.045;
        iso.box(cu, v, cu + 0.04, v + 0.035, z, z + 0.022, mat('#b88a52'), { edges: true });
        const [x, y] = iso.pt(cu + 0.02, v + 0.018, z + 0.022);
        for (let k = 0; k < 7; k++) {
          iso.ctx.fillStyle = ['#e94f2e', '#f7b733', '#7cb342'][(k + i) % 3];
          iso.ctx.beginPath();
          iso.ctx.arc(x + (rng() - 0.5) * 7 * iso.px, y - rng() * 2.5 * iso.px, 1.6 * iso.px, 0, Math.PI * 2);
          iso.ctx.fill();
        }
      }
    }
  }
}

/** Paan / tea kiosk: little wooden cabin with a tin roof, jars and hanging strips. */
export function paanStall(iso: Iso, rng: Rng, u: number, v: number, z: number): void {
  const u1 = u + 0.1;
  const v1 = v + 0.08;
  iso.aoRect(u, v, u1, v1, z, 0.025, 0.4);
  iso.box(u, v, u1, v1, z, z + 0.06, mat('#2f7d6d'));
  iso.poly(iso.faceVQuad(v1, u + 0.004, u1 - 0.004, z + 0.008, z + 0.05), shade('#2f7d6d', 0.1));
  // counter opening on the +v face
  iso.poly(iso.faceVQuad(v1, u, u1, z + 0.06, z + 0.11), '#3a2a20');
  // strips of pan-masala sachets
  for (let a = u + 0.008; a < u1 - 0.006; a += 0.01) iso.poly(iso.faceVQuad(v1 + 0.001, a, a + 0.006, z + 0.075, z + 0.108), ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00'][Math.floor(rng() * 5)]);
  // leaves + brass bowls on the counter
  iso.box(u + 0.005, v1 - 0.03, u1 - 0.005, v1 + 0.012, z + 0.06, z + 0.064, mat('#e8dcc2'), { edges: false });
  iso.ellipse(u + 0.03, v1 - 0.006, z + 0.066, 0.012, '#3f8a2e');
  iso.ellipse(u + 0.062, v1 - 0.004, z + 0.066, 0.008, C.brass);
  iso.box(u1 - 0.02, v1 - 0.022, u1 - 0.006, v1 - 0.008, z + 0.064, z + 0.084, mat('#d8ecf0'), { edges: false });
  // roof
  iso.box(u, v, u1, v + 0.004, z + 0.06, z + 0.11, mat('#2f7d6d'), { edges: false });
  iso.box(u1 - 0.004, v, u1, v1, z + 0.06, z + 0.11, mat('#2f7d6d'), { edges: false });
  iso.poly(
    [
      [u - 0.012, v - 0.012, z + 0.122],
      [u1 + 0.018, v - 0.012, z + 0.112],
      [u1 + 0.018, v1 + 0.025, z + 0.105],
      [u - 0.012, v1 + 0.025, z + 0.115],
    ],
    shade(C.tin, 0.05),
    alpha('#1e1a14', 0.55),
    0.9,
  );
  iso.line([u - 0.012, v1 + 0.025, z + 0.115], [u1 + 0.018, v1 + 0.025, z + 0.105], alpha('#fff4dc', 0.5), 0.8);
  signboard(iso, rng, 'v', v1 + 0.025, u - 0.005, u1 + 0.01, z + 0.118, z + 0.145, '#c62828', '#fff3c4', { depth: 0.004, style: 'deva' });
}

/** Tree in a painted (white/red banded) masonry guard. */
export function streetTree(iso: Iso, rng: Rng, u: number, v: number, z: number, size: number, kind: 'neem' | 'peepal' | 'ashoka' = 'neem'): void {
  iso.box(u - 0.03, v - 0.03, u + 0.03, v + 0.03, z, z + 0.025, mat('#e8e0d0'), { edges: false });
  iso.poly(iso.faceVQuad(v + 0.03, u - 0.03, u + 0.03, z, z + 0.01), '#b83a2a');
  iso.poly(iso.faceUQuad(u + 0.03, v - 0.03, v + 0.03, z, z + 0.01), shade('#b83a2a', -0.3));
  iso.tree(u, v, z + 0.02, size, rng, kind);
}

/** Painted wall advert on bare brick (fading), as on exposed party walls. */
export function wallAd(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number, bg: string, fg: string): void {
  const q = fq(iso, f, plane, a0, a1, z0, z1, 0.0006);
  iso.poly(q, alpha(ft(f, bg), 0.82));
  const H = z1 - z0;
  lettering(iso, rng, f, plane, a0 + H * 0.12, a1 - H * 0.1, z0 + H * 0.7, H * 0.26, alpha(ft(f, fg), 0.9), 'latin', 0.0008);
  lettering(iso, rng, f, plane, a0 + H * 0.12, a1 - H * 0.2, z0 + H * 0.3, H * 0.2, alpha(ft(f, fg), 0.85), 'deva', 0.0008);
  iso.clipped(q, () => iso.speckle(q, rng, 60, [alpha('#8a5a40', 0.5), alpha('#d9b89a', 0.4)], 2));
}

