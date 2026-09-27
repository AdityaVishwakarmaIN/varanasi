/**
 * Drawing kit for the Indian industrial / utility art (./industrial.ts): sheds with gabled,
 * saw-tooth and barrel roofs, chimneys and smoke, cooling towers, trucks in truck-art paint,
 * sacks, brick stacks, yarn/cloth drying lines, signboards, shutters, pylons and transformers.
 * Pure canvas drawing (see ./index.ts for the contract).
 */
import { Iso, alpha, mat, mix, seededRng, shade, type P3 } from '../isoPainter';
import { C, grime, weatherU, weatherV } from '../varanasiSprites';

export type Rng = ReturnType<typeof seededRng>;
export type Face = 'u' | 'v';

export const K = {
  tinBlue: '#5b80a6',
  tinGrey: '#a6adb0',
  asbestos: '#b4b2aa',
  steel: '#8a939a',
  steelDark: '#56606a',
  glazing: '#a3cbd3',
  coal: '#2b2a2d',
  smoke: '#5f5a57',
  steam: '#f3f3ef',
  towerConcrete: '#cdc6b6',
  rawBrick: '#9a8670',
  firedBrick: '#b0553b',
  paddy: '#d6b04c',
} as const;

// ============================================================================
// Small geometry helpers
// ============================================================================

export function faceQ(iso: Iso, face: Face, plane: number, a0: number, a1: number, z0: number, z1: number): P3[] {
  return face === 'u' ? iso.faceUQuad(plane, a0, a1, z0, z1) : iso.faceVQuad(plane, a0, a1, z0, z1);
}

export function fp(face: Face, plane: number, a: number, z: number): P3 {
  return face === 'u' ? [plane, a, z] : [a, plane, z];
}

export function ring(u: number, v: number, r: number, n = 12): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [u + Math.cos(a) * r, v + Math.sin(a) * r] as [number, number];
  });
}

/** True for angles (around a vertical axis) whose surface faces the viewer. */
export const facesViewer = (a: number, margin = 0): boolean => Math.cos(a) + Math.sin(a) > margin;

// ============================================================================
// Walls, signs, shutters
// ============================================================================

/** Plain box building with AO, cast shadow, monsoon streaks and base grime. */
export function block(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number, wall: string, opts: { noTop?: boolean; shadow?: number; streaks?: number } = {}): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.06, 0.42);
  iso.castShadow([
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ], z, H, opts.shadow ?? 0.16);
  iso.box(u0, v0, u1, v1, z, z + H, mat(wall), { noTop: opts.noTop });
  const s = opts.streaks ?? 1;
  if (s > 0) {
    weatherV(iso, rng, v1, u0, u1, z, z + H, Math.round(10 * s * (u1 - u0) + 3), 0.1);
    weatherU(iso, rng, u1, v0, v1, z, z + H, Math.round(10 * s * (v1 - v0) + 3), 0.12);
  }
  grime(iso, u0, v0, u1, v1, z, Math.min(0.06, H * 0.4), 0.24);
}

/** Painted signboard with abstract lettering blocks on a wall face. */
export function sign(iso: Iso, rng: Rng, face: Face, plane: number, a0: number, a1: number, z0: number, z1: number, bg: string, ink: string, ink2: string = ink): void {
  const dk = face === 'u' ? -0.22 : 0;
  const pl = plane + 0.003;
  iso.poly(faceQ(iso, face, pl, a0 - 0.006, a1 + 0.006, z0 - 0.006, z1 + 0.006), shade('#3a2e26', dk));
  iso.poly(faceQ(iso, face, pl, a0, a1, z0, z1), shade(bg, dk));
  const h = z1 - z0;
  const w = a1 - a0;
  let a = a0 + w * 0.07;
  while (a < a1 - w * 0.12) {
    const e = Math.min(a + w * (0.07 + rng() * 0.12), a1 - w * 0.07);
    iso.poly(faceQ(iso, face, pl, a, e, z0 + h * 0.46, z0 + h * 0.82), shade(ink, dk));
    a = e + w * 0.04;
  }
  a = a0 + w * 0.2;
  while (a < a1 - w * 0.24) {
    const e = Math.min(a + w * (0.05 + rng() * 0.08), a1 - w * 0.2);
    iso.poly(faceQ(iso, face, pl, a, e, z0 + h * 0.16, z0 + h * 0.32), shade(ink2, dk));
    a = e + w * 0.03;
  }
  iso.line(fp(face, pl, a0, z1), fp(face, pl, a1, z1), alpha('#fff4dc', face === 'u' ? 0.25 : 0.5), 0.8);
}

/** Rolling shutter; `open` (0..1) is the fraction rolled up, showing the dark interior below. */
export function shutter(iso: Iso, face: Face, plane: number, a0: number, a1: number, z0: number, z1: number, color: string, open = 0): void {
  const dk = face === 'u' ? -0.25 : 0;
  const pl = plane + 0.002;
  const zs = z0 + (z1 - z0) * open;
  if (open > 0) iso.poly(faceQ(iso, face, pl, a0, a1, z0, zs), '#241e1c');
  iso.poly(faceQ(iso, face, pl, a0, a1, zs, z1), shade(color, dk), alpha('#1e1a14', 0.5), 0.8);
  for (let z = zs + 0.011; z < z1 - 0.004; z += 0.011) iso.line(fp(face, pl, a0, z), fp(face, pl, a1, z), alpha(shade(color, -0.45), 0.45), 0.6);
  iso.line(fp(face, pl, a0, zs), fp(face, pl, a1, zs), alpha('#111', 0.7), 1.3);
  // box housing on top
  iso.poly(faceQ(iso, face, pl + 0.002, a0 - 0.004, a1 + 0.004, z1, z1 + 0.014), shade('#6d6d6d', dk));
}

/** Iron window grill lines over a window already painted on a face. */
export function grill(iso: Iso, face: Face, plane: number, a0: number, a1: number, z0: number, z1: number, col = '#2a2a2e'): void {
  const pl = plane + 0.002;
  const n = Math.max(2, Math.round((a1 - a0) / 0.014));
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    iso.line(fp(face, pl, a, z0), fp(face, pl, a, z1), alpha(col, 0.7), 0.6);
  }
  iso.line(fp(face, pl, a0, (z0 + z1) / 2), fp(face, pl, a1, (z0 + z1) / 2), alpha(col, 0.7), 0.6);
}

// ============================================================================
// Roofs and sheds
// ============================================================================

export interface ShedOpts {
  skylights?: number;
  vents?: number;
  rust?: number;
  louvre?: boolean;
  shadow?: number;
}

/**
 * Walled shed with a gabled corrugated roof. `ridge` is the axis the ridge runs along; the gable
 * end on the visible side is at u1 (ridge 'u') or v1 (ridge 'v').
 */
export function gableShed(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number, rise: number, ridge: Face, wall: string, roof: string, o: ShedOpts = {}): void {
  const wm = mat(wall);
  const zt = z + H;
  const zr = zt + rise;
  const ov = 0.03;
  const half = ridge === 'u' ? (v1 - v0) / 2 : (u1 - u0) / 2;
  const e = (rise * ov) / half;
  const zte = zt - e;
  block(iso, rng, u0, v0, u1, v1, z, H, wall, { noTop: true, shadow: o.shadow });
  // castShadow above only used the wall height; extend for the roof
  iso.castShadow(
    ridge === 'u'
      ? [
          [u0, (v0 + v1) / 2],
          [u1, (v0 + v1) / 2],
        ]
      : [
          [(u0 + u1) / 2, v0],
          [(u0 + u1) / 2, v1],
        ],
    z,
    H + rise,
    0.06,
  );
  const um = (u0 + u1) / 2;
  const vm = (v0 + v1) / 2;
  // gable triangle on the visible end
  if (ridge === 'u') {
    const tri: P3[] = [
      [u1, v0, zt],
      [u1, v1, zt],
      [u1, vm, zr],
    ];
    iso.poly(tri, wm.right, wm.line, 1);
    if (o.louvre) for (let k = 0; k < 4; k++) iso.line([u1 + 0.002, vm - 0.05 + k * 0.001, zt + 0.02 + k * 0.018], [u1 + 0.002, vm + 0.05, zt + 0.02 + k * 0.018], alpha('#2a2622', 0.6), 1.2);
  } else {
    const tri: P3[] = [
      [u0, v1, zt],
      [u1, v1, zt],
      [um, v1, zr],
    ];
    iso.poly(tri, wm.left, wm.line, 1);
    if (o.louvre) for (let k = 0; k < 4; k++) iso.line([um - 0.05, v1 + 0.002, zt + 0.02 + k * 0.018], [um + 0.05, v1 + 0.002, zt + 0.02 + k * 0.018], alpha('#2a2622', 0.6), 1.2);
  }
  const aLo = ridge === 'u' ? u0 - ov : v0 - ov;
  const aHi = ridge === 'u' ? u1 + ov : v1 + ov;
  const sp = (side: 1 | -1, a: number, s: number): P3 => {
    const zz = zr + s * (zte - zr);
    if (ridge === 'u') return [a, vm + s * ((side > 0 ? v1 + ov : v0 - ov) - vm), zz];
    return [um + s * ((side > 0 ? u1 + ov : u0 - ov) - um), a, zz];
  };
  const litBack = ridge === 'u' ? -0.1 : 0.1;
  const litFront = ridge === 'u' ? 0.12 : -0.2;
  for (const side of [-1, 1] as const) {
    const col = shade(roof, side < 0 ? litBack : litFront);
    const q: P3[] = [sp(side, aLo, 0), sp(side, aHi, 0), sp(side, aHi, 1), sp(side, aLo, 1)];
    iso.poly(q, col, alpha('#1e1a14', 0.5), 1);
    iso.clipped(q, () => {
      for (let a = aLo + 0.012; a < aHi; a += 0.02) {
        iso.line(sp(side, a, 0), sp(side, a, 1), alpha(shade(col, -0.35), 0.45), 0.7);
        iso.line(sp(side, a + 0.006, 0), sp(side, a + 0.006, 1), alpha(shade(col, 0.4), 0.3), 0.6);
      }
      const nSky = o.skylights ?? 0;
      for (let k = 0; k < nSky; k++) {
        const a = aLo + ((k + 0.5) / nSky) * (aHi - aLo) - 0.025;
        iso.poly([sp(side, a, 0.12), sp(side, a + 0.05, 0.12), sp(side, a + 0.05, 0.88), sp(side, a, 0.88)], alpha(side > 0 === (ridge === 'u') ? '#e4efe8' : '#c9d6d2', 0.75));
      }
      const nr = Math.round((o.rust ?? 0) * 8);
      for (let k = 0; k < nr; k++) {
        const a = aLo + rng() * (aHi - aLo);
        const s = rng();
        const p = sp(side, a, s);
        iso.ellipse(p[0], p[1], p[2], 0.02 + rng() * 0.03, alpha(C.rust, 0.45));
      }
    });
    // rake fascia on the visible gable end
    const endA = ridge === 'u' ? u1 + ov : v1 + ov;
    const r0 = sp(side, endA, 0);
    const r1 = sp(side, endA, 1);
    iso.poly([r0, r1, [r1[0], r1[1], r1[2] - 0.012], [r0[0], r0[1], r0[2] - 0.012]], shade(roof, -0.45));
  }
  // eave fascia on the visible long side
  const eq = ridge === 'u' ? iso.faceVQuad(v1 + ov, u0 - ov, u1 + ov, zte - 0.012, zte) : iso.faceUQuad(u1 + ov, v0 - ov, v1 + ov, zte - 0.012, zte);
  iso.poly(eq, shade(roof, ridge === 'u' ? -0.25 : -0.5));
  // ridge cap
  iso.line(sp(1, aLo, 0), sp(1, aHi, 0), alpha(shade(roof, 0.45), 0.8), 1.4);
  const nv = o.vents ?? 0;
  for (let k = 0; k < nv; k++) {
    const p = sp(1, aLo + ((k + 0.5) / nv) * (aHi - aLo), 0);
    turboVent(iso, p[0], p[1], p[2]);
  }
}

/** Silver turbo ventilator on a roof ridge. */
export function turboVent(iso: Iso, u: number, v: number, z: number, s = 1): void {
  iso.lathe(u, v, z - 0.004, [
    [0, 0.012 * s],
    [0.012 * s, 0.014 * s],
    [0.014 * s, 0.024 * s],
    [0.032 * s, 0.024 * s],
    [0.042 * s, 0.012 * s],
    [0.046 * s, 0],
  ], (t) => (t > 0.3 && t < 0.75 && Math.floor(t * 30) % 2 ? '#9ea6aa' : '#d7dcde'), { outline: true, lit: 0.35 });
}

/**
 * Saw-tooth (north-light) roof: teeth repeat along v, each rising towards +v and ending in a
 * vertical glazed face that looks towards +v.
 */
export function sawtoothRoof(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, teeth: number, h: number, tin: string, glass: string, wall: string): void {
  const w = (v1 - v0) / teeth;
  const wm = mat(wall);
  for (let i = 0; i < teeth; i++) {
    const a = v0 + i * w;
    const b = a + w;
    const slope: P3[] = [
      [u0, a, z],
      [u1, a, z],
      [u1, b, z + h],
      [u0, b, z + h],
    ];
    const col = shade(tin, 0.06 + (rng() - 0.5) * 0.05);
    iso.poly(slope, col, alpha('#1e1a14', 0.5), 1);
    iso.clipped(slope, () => {
      for (let u = u0 + 0.01; u < u1; u += 0.018) {
        iso.line([u, a, z], [u, b, z + h], alpha(shade(col, -0.35), 0.45), 0.7);
        iso.line([u + 0.005, a, z], [u + 0.005, b, z + h], alpha(shade(col, 0.4), 0.3), 0.6);
      }
      for (let k = 0; k < 3; k++) {
        const pu = u0 + rng() * (u1 - u0);
        const t = rng();
        iso.ellipse(pu, a + t * w, z + t * h, 0.015 + rng() * 0.025, alpha(C.rust, 0.4));
      }
    });
    // wall triangle under the tooth at the visible u1 end
    iso.poly([
      [u1, a, z],
      [u1, b, z],
      [u1, b, z + h],
    ], wm.right, wm.line, 1);
    // glazing
    const gq = iso.faceVQuad(b, u0, u1, z, z + h);
    iso.poly(gq, glass, alpha('#1e1a14', 0.55), 1);
    iso.clipped(gq, () => {
      iso.poly(iso.faceVQuad(b, u0, u1, z, z + h * 0.35), alpha('#2c3a40', 0.35));
      for (let u = u0 + 0.035; u < u1; u += 0.035) iso.line([u, b, z], [u, b, z + h], alpha('#3a4448', 0.7), 0.8);
      iso.line([u0, b, z + h * 0.5], [u1, b, z + h * 0.5], alpha('#3a4448', 0.6), 0.7);
      // sky glint
      iso.poly([
        [u0 + (u1 - u0) * 0.2, b, z + h * 0.95],
        [u0 + (u1 - u0) * 0.32, b, z + h * 0.95],
        [u0 + (u1 - u0) * 0.24, b, z + h * 0.5],
        [u0 + (u1 - u0) * 0.12, b, z + h * 0.5],
      ], alpha('#ffffff', 0.35));
    });
    iso.line([u0, b, z + h], [u1, b, z + h], alpha(shade(tin, 0.5), 0.8), 1);
  }
}

/** Barrel-vault (curved tin) roof along u over walls of height z, with the end wall at u1. */
export function vaultRoof(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, rise: number, tin: string, wall: string): void {
  const ov = 0.03;
  const vc = (v0 + v1) / 2;
  const half = (v1 - v0) / 2;
  const N = 16;
  const arc = (k: number, hw: number): [number, number] => {
    const th = Math.PI - (k / N) * Math.PI;
    return [vc + Math.cos(th) * hw, z + Math.sin(th) * rise * (hw / half) - (hw > half ? rise * 0.06 : 0)];
  };
  // end wall (semicircle) at u1
  const endPts: P3[] = [];
  for (let k = 0; k <= N; k++) {
    const [v, zz] = arc(k, half);
    endPts.push([u1, v, zz]);
  }
  const wm = mat(wall);
  iso.poly(endPts, wm.right, wm.line, 1);
  // louvre on the end wall
  for (let k = 0; k < 3; k++) iso.line([u1 + 0.002, vc - 0.06, z + 0.03 + k * 0.022], [u1 + 0.002, vc + 0.06, z + 0.03 + k * 0.022], alpha('#2a2622', 0.6), 1.2);
  for (let k = 0; k < N; k++) {
    const [va, za] = arc(k, half + ov);
    const [vb, zb] = arc(k + 1, half + ov);
    const th = Math.PI - ((k + 0.5) / N) * Math.PI;
    const b = 0.14 * Math.sin(th) + 0.16 * Math.cos(th) - 0.06;
    const col = shade(tin, b);
    const q: P3[] = [
      [u0 - ov, va, za],
      [u1 + ov, va, za],
      [u1 + ov, vb, zb],
      [u0 - ov, vb, zb],
    ];
    iso.poly(q, col);
  }
  // corrugations follow the arch
  for (let u = u0 - ov + 0.012; u < u1 + ov; u += 0.022) {
    const pts: P3[] = [];
    for (let k = 0; k <= N; k++) {
      const [v, zz] = arc(k, half + ov);
      pts.push([u, v, zz]);
    }
    iso.polyline(pts, alpha(shade(tin, -0.45), 0.35), 0.7);
  }
  // rust streaks
  for (let i = 0; i < 6; i++) {
    const u = u0 + rng() * (u1 - u0);
    const k = Math.floor(N * 0.5 + rng() * N * 0.45);
    const [v, zz] = arc(k, half + ov);
    iso.ellipse(u, v, zz, 0.02 + rng() * 0.03, alpha(C.rust, 0.4));
  }
  // edge band at the visible end and the eave
  const edge: P3[] = [];
  for (let k = 0; k <= N; k++) {
    const [v, zz] = arc(k, half + ov);
    edge.push([u1 + ov, v, zz]);
  }
  iso.polyline(edge, shade(tin, -0.5), 2.2);
  iso.polyline(edge, alpha(shade(tin, 0.4), 0.7), 0.7);
  iso.line([u0 - ov, v1 + ov, z - rise * 0.06], [u1 + ov, v1 + ov, z - rise * 0.06], shade(tin, -0.35), 1.4);
}

// ============================================================================
// Round things: chimneys, smoke, cooling towers, silos, tanks
// ============================================================================

/** Drifting smoke / steam plume: puffs growing and fading towards the screen-right. */
export function smoke(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number, col: string, puffs: number, rise: number, drift: number, opacity = 0.55): void {
  const { ctx, T } = iso;
  const [x0, y0] = iso.pt(u, v, z);
  const pts: [number, number, number, number][] = [];
  for (let i = 0; i < puffs; i++) {
    const t = puffs > 1 ? i / (puffs - 1) : 0;
    const x = x0 + T * drift * t * (0.6 + t * 0.4) + (rng() - 0.5) * r * T * 0.5;
    const y = y0 - T * rise * (1 - (1 - t) * (1 - t)) + (rng() - 0.5) * r * T * 0.3;
    const rad = T * r * (0.8 + t * 1.7) * (0.85 + rng() * 0.3);
    pts.push([x, y, rad, opacity * (1 - t * 0.7)]);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, y, rad, a] = pts[i];
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    g.addColorStop(0, alpha(shade(col, 0.35), a));
    g.addColorStop(0.6, alpha(col, a * 0.85));
    g.addColorStop(1, alpha(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Tapering chimney. style: brick (sooty courses), banded (red/white aviation bands), steel (flanges). */
export function chimney(iso: Iso, rng: Rng, u: number, v: number, z: number, H: number, r0: number, r1: number, body: string, style: 'brick' | 'banded' | 'steel', smokeCol: string | null, smokeSize = 1): void {
  iso.aoEllipse(u, v, r0 * 1.25, z, 0.05, 0.42);
  iso.castShadow(ring(u, v, r0, 10), z, Math.min(H, 0.9) * 0.6, 0.12);
  const top = H + 0.035;
  const prof: [number, number][] = [
    [0, r0 * 1.28],
    [0.05, r0 * 1.28],
    [0.056, r0],
    [H, r1],
    [H + 0.004, r1 * 1.2],
    [top, r1 * 1.2],
  ];
  iso.lathe(u, v, z, prof, (t) => {
    const zz = t * top;
    if (zz < 0.055) return shade(body, -0.12);
    if (zz > H) return style === 'steel' ? shade(body, -0.15) : '#3a3432';
    if (style === 'banded' && zz > H * 0.7) return Math.floor((zz - H * 0.7) / (H * 0.075)) % 2 === 0 ? '#c8362a' : '#eee8dc';
    if (style === 'brick' && zz > H * 0.82) return mix(body, '#2a2422', (zz - H * 0.82) / (H * 0.18) * 0.75);
    return body;
  }, { outline: true, dark: -0.4, step: 1.4 });
  iso.ellipse(u, v, z + top + 0.001, r1 * 0.95, '#1b1716');
  // courses / flanges
  const { ctx } = iso;
  const [cx] = iso.pt(u, v, 0);
  const step = style === 'steel' ? H / 6 : 0.045;
  for (let zz = 0.1; zz < H - 0.01; zz += step) {
    const r = r0 + (r1 - r0) * (zz / H);
    const [, cy] = iso.pt(u, v, z + zz);
    const [rx, ry] = iso.ellipseRadii(r);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = style === 'steel' ? 'rgba(40,40,44,0.45)' : 'rgba(60,30,20,0.22)';
    ctx.lineWidth = (style === 'steel' ? 1.2 : 0.7) * iso.px;
    ctx.stroke();
  }
  // ladder up the lit side
  const a = Math.PI * 0.62;
  const lad = (zz: number, off: number): P3 => {
    const r = r0 + (r1 - r0) * (zz / H) + 0.006;
    return [u + Math.cos(a + off) * r, v + Math.sin(a + off) * r, z + zz];
  };
  iso.line(lad(0.06, -0.08), lad(H * 0.97, -0.08), alpha('#2a2622', 0.55), 0.8);
  iso.line(lad(0.06, 0.08), lad(H * 0.97, 0.08), alpha('#2a2622', 0.55), 0.8);
  if (smokeCol) smoke(iso, rng, u, v, z + top + 0.02, r1 * 1.3 * smokeSize, smokeCol, 7, 0.22 * smokeSize, 0.3 * smokeSize, 0.55);
}

/** Vertical streaks on the visible half of a cylinder. */
export function cylStreaks(iso: Iso, rng: Rng, u: number, v: number, r: number, z0: number, z1: number, count: number, col: string, strength: number): void {
  for (let i = 0; i < count; i++) {
    const a = -Math.PI * 0.2 + rng() * Math.PI * 1.4;
    if (!facesViewer(a, 0.15)) continue;
    const len = (z1 - z0) * (0.25 + rng() * 0.6);
    iso.line([u + Math.cos(a) * r, v + Math.sin(a) * r, z1], [u + Math.cos(a) * r, v + Math.sin(a) * r, z1 - len], alpha(col, strength * (0.5 + rng() * 0.5)), 1.5 + rng() * 2.5);
  }
}

/** Blocks of lettering wrapped on a cylinder band (angles a0..a1 on the visible side). */
export function cylText(iso: Iso, rng: Rng, u: number, v: number, r: number, z0: number, z1: number, a0: number, a1: number, col: string): void {
  let a = a0;
  while (a < a1) {
    const b = Math.min(a1, a + 0.08 + rng() * 0.14);
    const pts: P3[] = [];
    for (let k = 0; k <= 4; k++) {
      const t = a + ((b - a) * k) / 4;
      pts.push([u + Math.cos(t) * r, v + Math.sin(t) * r, z0]);
    }
    for (let k = 4; k >= 0; k--) {
      const t = a + ((b - a) * k) / 4;
      pts.push([u + Math.cos(t) * r, v + Math.sin(t) * r, z1]);
    }
    // darker towards the shaded (+u) side
    const mid = (a + b) / 2;
    iso.poly(pts, shade(col, -0.3 * Math.max(0, Math.cos(mid) - Math.sin(mid))));
    a = b + 0.05;
  }
}

/** Hyperbolic natural-draught cooling tower with leg ring, stains and a steam plume. */
export function coolingTower(iso: Iso, rng: Rng, u: number, v: number, z: number, H: number, Rb: number, Rw: number, Rt: number, steamSize = 1): void {
  iso.aoEllipse(u, v, Rb * 1.05, z, 0.1, 0.45);
  iso.castShadow(ring(u, v, Rb, 16), z, H * 0.55, 0.14);
  const legH = H * 0.06;
  // dark air inlet under the shell, with diagonal legs
  iso.lathe(u, v, z, [
    [0, Rb * 0.97],
    [legH, Rb * 0.97],
  ], () => '#3b3632', { outline: false });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    if (!facesViewer(a, -0.3)) continue;
    const a2 = a + Math.PI / 28;
    iso.line([u + Math.cos(a) * Rb, v + Math.sin(a) * Rb, z], [u + Math.cos(a2) * Rb, v + Math.sin(a2) * Rb, z + legH], '#9e978a', 1.6);
    iso.line([u + Math.cos(a2 + Math.PI / 28) * Rb, v + Math.sin(a2 + Math.PI / 28) * Rb, z], [u + Math.cos(a2) * Rb, v + Math.sin(a2) * Rb, z + legH], '#8a8377', 1.6);
  }
  const zw = H * 0.74;
  const prof: [number, number][] = [];
  for (let k = 0; k <= 14; k++) {
    const zz = legH + ((H - legH) * k) / 14;
    const r = zz < zw ? Rw + (Rb - Rw) * Math.pow((zw - zz) / (zw - legH), 1.7) : Rw + (Rt - Rw) * Math.pow((zz - zw) / (H - zw), 2);
    prof.push([zz, r]);
  }
  const conc = K.towerConcrete;
  iso.lathe(u, v, z, prof, (t) => mix(shade(conc, 0.04), '#a39c8f', (1 - t) * 0.35 + (t > 0.95 ? 0.3 : 0)), { outline: true, lit: 0.2, dark: -0.34, step: 2.2 });
  // stains streaking down from the rim
  for (let i = 0; i < 22; i++) {
    const a = -Math.PI * 0.2 + rng() * Math.PI * 1.4;
    if (!facesViewer(a, 0.1)) continue;
    const len = 0.2 + rng() * 0.5;
    const pts: P3[] = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      const zz = H - len * (H - legH) * f;
      const r = zz < zw ? Rw + (Rb - Rw) * Math.pow((zw - zz) / (zw - legH), 1.7) : Rw + (Rt - Rw) * Math.pow((zz - zw) / (H - zw), 2);
      pts.push([u + Math.cos(a) * r, v + Math.sin(a) * r, z + zz]);
    }
    iso.polyline(pts, alpha('#5e574e', 0.08 + rng() * 0.12), 2 + rng() * 4);
  }
  // rim and dark throat
  iso.ellipse(u, v, z + H, Rt, '#d9d3c5', alpha('#5e574e', 0.6), 1);
  const { ctx } = iso;
  const [cx, cy] = iso.pt(u, v, z + H);
  const [rx, ry] = iso.ellipseRadii(Rt * 0.94);
  const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  g.addColorStop(0, '#6d675e');
  g.addColorStop(0.5, '#3e3934');
  g.addColorStop(1, '#2a2622');
  iso.ellipse(u, v, z + H + 0.001, Rt * 0.94, g);
  if (steamSize > 0) smoke(iso, rng, u, v, z + H + 0.03, Rt * 0.75 * steamSize, K.steam, 6, 0.24 * steamSize, 0.12 * steamSize, 0.7);
}

/** Corrugated steel grain silo with conical roof and ladder. */
export function silo(iso: Iso, u: number, v: number, z: number, r: number, H: number, col = '#c3cacd'): void {
  iso.aoEllipse(u, v, r * 1.05, z, 0.06, 0.4);
  iso.castShadow(ring(u, v, r, 12), z, H * 0.8, 0.14);
  iso.cylinder(u, v, r * 1.06, z, z + 0.03, C.concrete, shade(C.concrete, 0.12));
  iso.lathe(u, v, z + 0.03, [
    [0, r],
    [H, r],
    [H + 0.004, r * 1.04],
    [H + r * 0.42, r * 0.14],
    [H + r * 0.46, r * 0.1],
    [H + r * 0.5, 0],
  ], (t, up) => (up > 0.3 ? shade(col, 0.1) : Math.floor(t * 60) % 2 ? shade(col, -0.06) : col), { outline: true, lit: 0.3, dark: -0.34 });
  const { ctx } = iso;
  const [cx] = iso.pt(u, v, 0);
  for (let zz = 0.1; zz < H; zz += 0.1) {
    const [, cy] = iso.pt(u, v, z + 0.03 + zz);
    const [rx, ry] = iso.ellipseRadii(r);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0.05, Math.PI - 0.05);
    ctx.strokeStyle = 'rgba(50,56,60,0.4)';
    ctx.lineWidth = 1 * iso.px;
    ctx.stroke();
  }
  const a = Math.PI * 0.55;
  const p = (zz: number, off: number): P3 => [u + Math.cos(a + off) * (r + 0.008), v + Math.sin(a + off) * (r + 0.008), z + zz];
  iso.line(p(0.03, -0.06), p(H + 0.03, -0.06), alpha('#3a3e42', 0.7), 0.9);
  iso.line(p(0.03, 0.06), p(H + 0.03, 0.06), alpha('#3a3e42', 0.7), 0.9);
}

/** Vertical storage tank (diesel / chemicals) with a painted band. */
export function storageTank(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number, H: number, col: string, band: string): void {
  iso.aoEllipse(u, v, r * 1.05, z, 0.05, 0.4);
  iso.castShadow(ring(u, v, r, 12), z, H, 0.14);
  iso.lathe(u, v, z, [
    [0, r],
    [H, r],
    [H + r * 0.2, r * 0.7],
    [H + r * 0.26, 0],
  ], (t) => (t > 0.55 && t < 0.68 ? band : col), { outline: true, lit: 0.3 });
  cylStreaks(iso, rng, u, v, r + 0.001, z, z + H, 6, '#6b5a48', 0.18);
  const a = Math.PI * 0.35;
  iso.line([u + Math.cos(a) * (r + 0.006), v + Math.sin(a) * (r + 0.006), z], [u + Math.cos(a) * (r + 0.006), v + Math.sin(a) * (r + 0.006), z + H + 0.02], alpha('#3a3e42', 0.6), 1);
}

/** Gas cylinder (LPG red / oxygen black). */
export function gasCylinder(iso: Iso, u: number, v: number, z: number, col: string): void {
  iso.aoEllipse(u, v, 0.016, z, 0.01, 0.35);
  iso.lathe(u, v, z, [
    [0, 0.015],
    [0.055, 0.016],
    [0.066, 0.011],
    [0.07, 0.005],
    [0.08, 0.005],
  ], () => col, { outline: true, lit: 0.35 });
}

/** Low mound/cone (coal, clay, husk, paddy). */
export function heap(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number, h: number, col: string, grain: readonly string[]): void {
  iso.aoEllipse(u, v, r, z, 0.05, 0.35);
  iso.lathe(u, v, z, [
    [0, r],
    [h * 0.35, r * 0.78],
    [h * 0.75, r * 0.42],
    [h, r * 0.08],
    [h * 1.02, 0],
  ], (t, up) => shade(col, up * 0.08), { outline: true, lit: 0.22, dark: -0.34 });
  const pts: P3[] = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return [u + Math.cos(a) * r * 0.8, v + Math.sin(a) * r * 0.8, z + h * 0.3] as P3;
  });
  const [x, y] = iso.pt(u, v, z + h * 0.45);
  const [rx] = iso.ellipseRadii(r);
  iso.ctx.save();
  iso.ctx.beginPath();
  iso.ctx.ellipse(x, y, rx * 0.95, (iso.pt(u, v, z)[1] - iso.pt(u, v, z + h)[1]) * 0.75 + 1, 0, 0, Math.PI * 2);
  iso.ctx.clip();
  iso.speckle(pts, rng, Math.round(200 + r * 900), grain, 1.4);
  iso.ctx.restore();
}

// ============================================================================
// Stacks and goods
// ============================================================================

/** Stepped pile of jute / plastic sacks. */
export function sacks(iso: Iso, u0: number, v0: number, cols: number, rows: number, layers: number, s: number, z: number, color: string): void {
  iso.aoRect(u0, v0, u0 + cols * s, v0 + rows * s, z, 0.03, 0.4);
  for (let l = 0; l < layers; l++) {
    const items: [number, number][] = [];
    for (let i = 0; i < cols - l; i++) for (let j = 0; j < rows - l; j++) items.push([u0 + (i + l * 0.5) * s, v0 + (j + l * 0.5) * s]);
    items.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [u, v] of items) {
      const zb = z + l * s * 0.42;
      const c = shade(color, (((u * 97 + v * 57) % 1) - 0.5) * 0.12);
      iso.box(u, v, u + s * 0.94, v + s * 0.94, zb, zb + s * 0.42, mat(c, { top: 0.2, right: -0.3 }));
      iso.line([u + s * 0.1, v + s * 0.47, zb + s * 0.42], [u + s * 0.84, v + s * 0.47, zb + s * 0.42], alpha(shade(color, -0.4), 0.5), 0.6);
    }
  }
}

/** Stack of fired / raw bricks with visible courses. */
export function brickStack(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, h: number, col: string): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.03, 0.38);
  iso.box(u0, v0, u1, v1, z, z + h, mat(col, { top: 0.12, right: -0.32 }));
  const dz = Math.min(0.016, h / 2);
  iso.clipped(iso.faceVQuad(v1, u0, u1, z, z + h), () => {
    for (let zz = z + dz; zz < z + h; zz += dz) iso.line([u0, v1, zz], [u1, v1, zz], alpha('#3a1c12', 0.35), 0.6);
    let row = 0;
    for (let zz = z; zz < z + h; zz += dz, row++) for (let u = u0 + (row % 2) * 0.02; u < u1; u += 0.04) iso.line([u, v1, zz], [u, v1, zz + dz], alpha('#3a1c12', 0.3), 0.5);
  });
  iso.clipped(iso.faceUQuad(u1, v0, v1, z, z + h), () => {
    for (let zz = z + dz; zz < z + h; zz += dz) iso.line([u1, v0, zz], [u1, v1, zz], alpha('#2a140c', 0.35), 0.6);
  });
  iso.speckle(iso.faceVQuad(v1, u0, u1, z, z + h), rng, Math.round(60 * (u1 - u0) / 0.2), [alpha('#e39a78', 0.5), alpha('#5a2a1a', 0.4)], 1.2);
  iso.clipped(iso.topQuad(u0, v0, u1, v1, z + h), () => {
    for (let u = u0 + 0.04; u < u1; u += 0.04) iso.line([u, v0, z + h], [u, v1, z + h], alpha('#3a1c12', 0.25), 0.5);
  });
}

/**
 * Things hanging from a bamboo pole along u at plane v: yarn skeins (narrow, tapered) or
 * lengths of dyed cloth (wide).
 */
export function hangingLine(iso: Iso, rng: Rng, u0: number, u1: number, v: number, z: number, h: number, colors: readonly string[], kind: 'yarn' | 'cloth'): void {
  const zt = z + h;
  iso.line([u0, v, z], [u0, v, zt + 0.01], '#7a5a32', 1.8);
  iso.line([u1, v, z], [u1, v, zt + 0.01], '#7a5a32', 1.8);
  // shadow strip on the ground
  iso.poly(iso.topQuad(u0, v - 0.01, u1, v + 0.035, z), alpha('#2a1a10', 0.14));
  const pw = kind === 'yarn' ? 0.022 : 0.075;
  const gap = kind === 'yarn' ? 0.008 : 0.012;
  let a = u0 + 0.012;
  let i = Math.floor(rng() * colors.length);
  while (a + pw < u1 - 0.006) {
    const col = colors[i++ % colors.length];
    const drop = kind === 'yarn' ? h * (0.45 + rng() * 0.15) : h * (0.55 + rng() * 0.3);
    if (kind === 'yarn') {
      const q: P3[] = [
        [a, v, zt],
        [a + pw, v, zt],
        [a + pw * 0.78, v, zt - drop],
        [a + pw * 0.22, v, zt - drop],
      ];
      iso.poly(q, col, alpha(shade(col, -0.5), 0.6), 0.6);
      iso.line([a + pw * 0.5, v + 0.001, zt], [a + pw * 0.5, v + 0.001, zt - drop], alpha(shade(col, -0.3), 0.5), 0.6);
      iso.line([a + pw * 0.25, v + 0.001, zt - 0.004], [a + pw * 0.3, v + 0.001, zt - drop * 0.8], alpha(shade(col, 0.45), 0.6), 0.6);
      iso.poly(iso.faceVQuad(v + 0.001, a + pw * 0.2, a + pw * 0.8, zt - drop, zt - drop + 0.008), shade(col, -0.25));
    } else {
      const q: P3[] = [
        [a, v, zt],
        [a + pw, v, zt],
        [a + pw, v, zt - drop],
        [a, v, zt - drop * (0.92 + rng() * 0.08)],
      ];
      iso.poly(q, col, alpha(shade(col, -0.5), 0.55), 0.6);
      iso.line([a + pw * 0.35, v + 0.001, zt], [a + pw * 0.4, v + 0.001, zt - drop * 0.9], alpha(shade(col, -0.25), 0.45), 0.8);
      iso.poly(iso.faceVQuad(v + 0.001, a, a + pw, zt - drop * 0.18, zt - drop * 0.12), alpha(shade(col, 0.4), 0.55));
    }
    a += pw + gap;
  }
  iso.line([u0 - 0.01, v, zt], [u1 + 0.01, v, zt], '#9a7a44', 1.8);
}

// ============================================================================
// Vehicles and electrical gear
// ============================================================================

export interface TruckStyle {
  body: string;
  cab: string;
  trim: string;
  cargo: 'tarp' | 'sacks' | 'open' | 'bricks';
  tarp?: string;
}

const ART = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#ff7a1a', '#8e24aa'];

/** A Tata-style goods truck with hand-painted truck-art body. The front faces +dir. */
export function truck(iso: Iso, rng: Rng, u0: number, v0: number, z: number, dir: Face, s: number, st: TruckStyle): void {
  const L = 0.44 * s;
  const W = 0.16 * s;
  const M = (a: number, b: number): [number, number] => (dir === 'u' ? [u0 + a, v0 + b] : [u0 + b, v0 + a]);
  const lbox = (a0: number, b0: number, a1: number, b1: number, z0: number, z1: number, m = mat('#888')) => {
    const [pu0, pv0] = M(a0, b0);
    const [pu1, pv1] = M(a1, b1);
    iso.box(Math.min(pu0, pu1), Math.min(pv0, pv1), Math.max(pu0, pu1), Math.max(pv0, pv1), z0, z1, m);
  };
  const side = (a0: number, a1: number, z0: number, z1: number): P3[] => (dir === 'u' ? iso.faceVQuad(v0 + W + 0.001, u0 + a0, u0 + a1, z0, z1) : iso.faceUQuad(u0 + W + 0.001, v0 + a0, v0 + a1, z0, z1));
  const sidePt = (a: number, zz: number): P3 => (dir === 'u' ? [u0 + a, v0 + W + 0.002, zz] : [u0 + W + 0.002, v0 + a, zz]);
  const front = (b0: number, b1: number, z0: number, z1: number): P3[] => (dir === 'u' ? iso.faceUQuad(u0 + L + 0.001, v0 + b0, v0 + b1, z0, z1) : iso.faceVQuad(v0 + L + 0.001, u0 + b0, u0 + b1, z0, z1));
  const sd = dir === 'u' ? 0 : -0.22;
  const fd = dir === 'u' ? -0.22 : 0;
  const [a0u, a0v] = M(0, 0);
  const [a1u, a1v] = M(L, W);
  iso.aoRect(Math.min(a0u, a1u), Math.min(a0v, a1v), Math.max(a0u, a1u), Math.max(a0v, a1v), z, 0.035, 0.5);
  const zc = z + 0.03 * s;
  const zb = z + 0.042 * s;
  const zt = z + 0.15 * s;
  const zcab = z + 0.128 * s;
  lbox(0.02 * L, 0.08 * W, 0.99 * L, 0.92 * W, zc - 0.006 * s, zb, mat('#2b2a2e'));
  // cargo body
  lbox(0, 0, 0.7 * L, W, zb, zt, mat(st.body, { top: 0.1 }));
  iso.poly(side(0, 0.7 * L, zb, zb + 0.016 * s), shade(st.trim, sd));
  iso.poly(side(0, 0.7 * L, zt - 0.014 * s, zt), shade('#1f8a4c', sd));
  const zm = (zb + zt) / 2 + 0.006 * s;
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = 0.03 * L + (k * 0.64 * L) / n;
    const w = (0.64 * L) / n;
    const hh = 0.022 * s;
    const col = shade(ART[(k + (st.body.length % 3)) % ART.length], sd);
    iso.poly([sidePt(a + w * 0.1, zm - hh), sidePt(a + w * 0.9, zm - hh), sidePt(a + w * 0.5, zm + hh)], col);
    iso.poly([sidePt(a + w * 0.5 - w * 0.12, zm + hh * 1.3), sidePt(a + w * 0.5 + w * 0.12, zm + hh * 1.3), sidePt(a + w * 0.5, zm + hh * 1.7)], shade(ART[(k + 3) % ART.length], sd));
  }
  // side planks
  for (let k = 1; k < 3; k++) iso.line(sidePt(0, zb + ((zt - zb) * k) / 3 - 0.004 * s), sidePt(0.7 * L, zb + ((zt - zb) * k) / 3 - 0.004 * s), alpha('#2a1a10', 0.18), 0.5);
  // cargo top
  const [c0u, c0v] = M(0.01 * L, 0.01 * W);
  const [c1u, c1v] = M(0.69 * L, 0.99 * W);
  const tu0 = Math.min(c0u, c1u);
  const tv0 = Math.min(c0v, c1v);
  const tu1 = Math.max(c0u, c1u);
  const tv1 = Math.max(c0v, c1v);
  if (st.cargo === 'tarp') {
    const tq = iso.topQuad(tu0, tv0, tu1, tv1, zt + 0.012 * s);
    const tc = st.tarp ?? C.tarpBlue;
    iso.box(tu0, tv0, tu1, tv1, zt, zt + 0.012 * s, mat(tc, { top: 0.1 }), { edges: false });
    iso.poly(tq, shade(tc, 0.1), alpha('#10203a', 0.5), 0.8);
    iso.clipped(tq, () => {
      for (let k = 1; k < 5; k++) {
        const f = k / 5;
        if (dir === 'u') iso.line([tu0 + (tu1 - tu0) * f, tv0, zt + 0.012 * s], [tu0 + (tu1 - tu0) * f, tv1, zt + 0.012 * s], alpha('#e8dcb0', 0.8), 0.7);
        else iso.line([tu0, tv0 + (tv1 - tv0) * f, zt + 0.012 * s], [tu1, tv0 + (tv1 - tv0) * f, zt + 0.012 * s], alpha('#e8dcb0', 0.8), 0.7);
      }
    });
  } else if (st.cargo === 'open') {
    iso.poly(iso.topQuad(tu0 + 0.008, tv0 + 0.008, tu1 - 0.008, tv1 - 0.008, zt), '#3a2e26');
  } else if (st.cargo === 'bricks') {
    iso.box(tu0 + 0.008, tv0 + 0.008, tu1 - 0.008, tv1 - 0.008, zt - 0.02 * s, zt + 0.008 * s, mat(K.firedBrick), { edges: false });
    iso.clipped(iso.topQuad(tu0, tv0, tu1, tv1, zt + 0.008 * s), () => {
      for (let u = tu0 + 0.015; u < tu1; u += 0.02) iso.line([u, tv0, zt + 0.008 * s], [u, tv1, zt + 0.008 * s], alpha('#4a2014', 0.4), 0.5);
    });
  } else {
    iso.poly(iso.topQuad(tu0 + 0.006, tv0 + 0.006, tu1 - 0.006, tv1 - 0.006, zt), '#3a2e26');
    const ss = 0.045 * s;
    const cols = Math.max(1, Math.floor((tu1 - tu0) / ss));
    const rows = Math.max(1, Math.floor((tv1 - tv0) / ss));
    sacks(iso, tu0 + 0.004, tv0 + 0.004, cols, rows, 2, Math.min((tu1 - tu0) / cols, (tv1 - tv0) / rows) * 0.98, zt - 0.01 * s, '#d9c9a0');
  }
  // crown over the cab
  lbox(0.66 * L, 0, 0.7 * L, W, zt, zt + 0.03 * s, mat(st.trim));
  // cab
  lbox(0.72 * L, 0.04 * W, L, 0.96 * W, zb, zcab, mat(st.cab, { top: 0.12 }));
  iso.poly(side(0.72 * L, L, zb + 0.018 * s, zb + 0.028 * s), shade(st.trim, sd));
  iso.poly(side(0.78 * L, 0.94 * L, zcab - 0.045 * s, zcab - 0.01 * s), shade('#2e3b44', sd));
  iso.poly(front(0.1 * W, 0.9 * W, zcab - 0.048 * s, zcab - 0.008 * s), shade('#34444e', fd));
  iso.line(front(0.1 * W, 0.9 * W, zcab - 0.012 * s, zcab - 0.012 * s)[0], front(0.1 * W, 0.9 * W, zcab - 0.012 * s, zcab - 0.012 * s)[1], alpha('#dff2ff', 0.45), 0.8);
  // bumper + headlights
  iso.poly(front(0, W, zc - 0.004 * s, zb + 0.012 * s), shade('#2a2a2a', fd));
  iso.poly(front(0.08 * W, 0.22 * W, zb + 0.014 * s, zb + 0.026 * s), '#fff3c4');
  iso.poly(front(0.78 * W, 0.92 * W, zb + 0.014 * s, zb + 0.026 * s), '#fff3c4');
  // wheels
  const r = 0.03 * s;
  for (const a of [0.14 * L, 0.26 * L, 0.86 * L]) {
    const pts: P3[] = [];
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * Math.PI * 2;
      pts.push(sidePt(a + Math.cos(t) * r, zc + Math.sin(t) * r));
    }
    iso.poly(pts, '#1c1c1f');
    const hub: P3[] = [];
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      hub.push(sidePt(a + Math.cos(t) * r * 0.4, zc + Math.sin(t) * r * 0.4));
    }
    iso.poly(hub, '#a7a7a2');
  }
  void rng;
}

/** Pole-type distribution transformer on a plinth with radiator fins and bushings. */
export function transformer(iso: Iso, u: number, v: number, z: number, s = 1): void {
  const a = 0.11 * s;
  const b = 0.08 * s;
  iso.aoRect(u, v, u + a, v + b, z, 0.03, 0.4);
  iso.box(u - 0.01, v - 0.01, u + a + 0.01, v + b + 0.01, z, z + 0.02, mat(C.concrete));
  const zb = z + 0.02;
  const H = 0.08 * s;
  iso.box(u, v, u + a, v + b, zb, zb + H, mat('#7b8c80'));
  iso.clipped(iso.faceVQuad(v + b, u, u + a, zb, zb + H), () => {
    for (let x = u + 0.008; x < u + a; x += 0.012) iso.line([x, v + b, zb + 0.008], [x, v + b, zb + H - 0.01], alpha('#34403a', 0.6), 1);
  });
  // conservator tank
  iso.box(u + 0.01, v + 0.01, u + a * 0.5, v + 0.03, zb + H + 0.01, zb + H + 0.035, mat('#8a9a8e'));
  for (let k = 0; k < 3; k++) {
    const pu = u + a * (0.35 + k * 0.22);
    const pv = v + b * 0.6;
    iso.lathe(pu, pv, zb + H, [
      [0, 0.008],
      [0.012, 0.01],
      [0.014, 0.006],
      [0.024, 0.009],
      [0.026, 0.005],
      [0.036, 0.007],
      [0.04, 0],
    ], () => '#8a4a2a', { outline: true, lit: 0.3 });
  }
}

/** Lattice transmission pylon with cross-arms and insulators. */
export function pylon(iso: Iso, u: number, v: number, z: number, H: number, w: number, col = '#6c747a'): void {
  const at = (sx: number, sy: number, t: number): P3 => [u + sx * w * (1 - t * 0.78), v + sy * w * (1 - t * 0.78), z + t * H];
  iso.aoRect(u - w, v - w, u + w, v + w, z, 0.03, 0.25);
  const legs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [sx, sy] of legs) iso.line(at(sx, sy, 0), at(sx, sy, 1), col, 1.3);
  const lv = 7;
  for (let k = 0; k < lv; k++) {
    const t0 = k / lv;
    const t1 = (k + 1) / lv;
    iso.line(at(-1, 1, t0), at(1, 1, t1), alpha(col, 0.85), 0.7);
    iso.line(at(1, 1, t0), at(-1, 1, t1), alpha(col, 0.85), 0.7);
    iso.line(at(1, -1, t0), at(1, 1, t1), alpha(shade(col, -0.2), 0.85), 0.7);
    iso.line(at(1, 1, t0), at(1, -1, t1), alpha(shade(col, -0.2), 0.85), 0.7);
    iso.line(at(-1, 1, t1), at(1, 1, t1), alpha(col, 0.7), 0.6);
  }
  for (const [t, span] of [
    [0.7, 2.6],
    [0.88, 2.0],
  ] as [number, number][]) {
    const zz = z + t * H;
    iso.line([u, v - w * span, zz], [u, v + w * span, zz], col, 1.3);
    iso.line([u, v - w * span, zz], at(0, -1, t - 0.08), alpha(col, 0.8), 0.7);
    iso.line([u, v + w * span, zz], at(0, 1, t - 0.08), alpha(col, 0.8), 0.7);
    for (const sv of [-1, 1]) {
      const pv = v + sv * w * span * 0.92;
      iso.line([u, pv, zz], [u, pv, zz - H * 0.07], '#d9d2c2', 1.4);
    }
  }
  iso.line(at(0, 0, 1), [u, v, z + H * 1.06], col, 1);
}

/** Cheap straight column: one shaded quad between the silhouette lines plus end ellipses. */
export function column(iso: Iso, u: number, v: number, r: number, z0: number, z1: number, col: string): void {
  const k = r * Math.SQRT1_2;
  const [cx] = iso.pt(u, v, 0);
  const [rx] = iso.ellipseRadii(r);
  const q: P3[] = [
    [u - k, v + k, z0],
    [u + k, v - k, z0],
    [u + k, v - k, z1],
    [u - k, v + k, z1],
  ];
  const ol = alpha(shade(col, -0.6), 0.6);
  const g = iso.roundGradient(cx, rx, col, 0.16, -0.32);
  iso.ellipse(u, v, z0, r, g, ol, 1);
  iso.poly(q, g);
  iso.line(q[0], q[3], ol, 1);
  iso.line(q[1], q[2], ol, 1);
  iso.ellipse(u, v, z1, r, shade(col, 0.12), ol, 0.8);
}

/**
 * Vertical prism over a plan polygon (u, v points, any winding): only the sides facing the
 * viewer are painted, shaded by how much they turn towards +v (lit) or +u (shaded), then the top.
 */
export function extrudePoly(iso: Iso, pts: readonly [number, number][], z0: number, z1: number, wall: string, top: string | null): void {
  const m = mat(wall);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = pts[i];
    const [c, d] = pts[(i + 1) % pts.length];
    area += a * d - c * b;
  }
  const sgn = area > 0 ? 1 : -1;
  const faces: { q: P3[]; key: number; col: string }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ua, va] = pts[i];
    const [ub, vb] = pts[(i + 1) % pts.length];
    const du = ub - ua;
    const dv = vb - va;
    const len = Math.hypot(du, dv) || 1;
    const nu = (sgn * dv) / len;
    const nv = (-sgn * du) / len;
    if (nu + nv <= 0.02) continue;
    const f = Math.min(1, Math.max(0, (nu - nv + 1) / 2));
    faces.push({
      q: [
        [ua, va, z0],
        [ub, vb, z0],
        [ub, vb, z1],
        [ua, va, z1],
      ],
      key: ua + va + ub + vb,
      col: mix(m.left, m.right, f),
    });
  }
  faces.sort((a, b) => a.key - b.key);
  for (const fc of faces) iso.poly(fc.q, fc.col, m.line, 0.8);
  if (top) iso.poly(pts.map(([u, v]) => [u, v, z1] as P3), top, m.line, 1);
}
