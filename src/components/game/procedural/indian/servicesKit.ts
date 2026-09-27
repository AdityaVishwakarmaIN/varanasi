/**
 * Drawing kit for the Indian services buildings (police thana, hospital, school, stations...).
 * Small reusable pieces: painted blocks with chhajjas, parapets, signboards, people, vehicles,
 * the tricolour, verandahs, shamianas and rail track. See ./index.ts for the drawing contract.
 */
import { Z_SCALE, alpha, mat, seededRng, shade, type Iso, type Mat, type P3 } from '../isoPainter';
import { C, weatherU, weatherV, grime, windowU, windowV } from '../varanasiSprites';

export type Rng = ReturnType<typeof seededRng>;
export type Face = 'u' | 'v';

/** Quad on a vertical face: plane u (normal +u) or plane v (normal +v), spanning a ∈ [a0, a1]. */
export function fq(iso: Iso, face: Face, plane: number, a0: number, a1: number, z0: number, z1: number): P3[] {
  return face === 'u' ? iso.faceUQuad(plane, a0, a1, z0, z1) : iso.faceVQuad(plane, a0, a1, z0, z1);
}

/** Point on a vertical face. */
export function fp(face: Face, plane: number, a: number, z: number): P3 {
  return face === 'u' ? [plane, a, z] : [a, plane, z];
}

/** Colour for a face: +v faces are lit, +u faces are in shade. */
export function faceTone(face: Face, c: string): string {
  return face === 'u' ? shade(c, -0.26) : c;
}

/** Box protruding from a face (ledge, chhajja, sign thickness). */
export function faceBox(iso: Iso, face: Face, plane: number, a0: number, a1: number, depth: number, z0: number, z1: number, m: Mat, edges = true): void {
  if (face === 'u') iso.box(plane, a0, plane + depth, a1, z0, z1, m, { edges });
  else iso.box(a0, plane, a1, plane + depth, z0, z1, m, { edges });
}

/** Painted signboard with abstract lettering (no real text), on a +u or +v face. */
export function signboard(iso: Iso, rng: Rng, face: Face, plane: number, a0: number, a1: number, z0: number, z1: number, bg: string, fg: string, rows = 1): void {
  const p = plane + 0.004;
  faceBox(iso, face, plane, a0, a1, 0.006, z0, z1, mat(shade(bg, -0.2)), false);
  iso.poly(fq(iso, face, p + 0.003, a0, a1, z0, z1), faceTone(face, bg), alpha('#1a1410', 0.6), 0.8);
  const pad = Math.min(0.012, (z1 - z0) * 0.18);
  const rh = (z1 - z0 - pad * 2) / rows;
  const ink = faceTone(face, fg);
  for (let r = 0; r < rows; r++) {
    const zt = z1 - pad - r * rh;
    const hgt = rh * (r === 0 ? 0.62 : 0.5);
    let a = a0 + pad + rng() * 0.01;
    while (a < a1 - pad - 0.015) {
      const len = Math.min(a1 - pad - a, 0.015 + rng() * 0.045);
      iso.poly(fq(iso, face, p + 0.004, a, a + len, zt - hgt, zt - rh * 0.12), ink);
      a += len + 0.01 + rng() * 0.006;
    }
  }
}

/** Tiny standing person (screen-space figure) with a soft contact shadow. */
export function person(iso: Iso, u: number, v: number, z: number, shirt: string, h = 0.075, lower = '#3a3232'): void {
  const { ctx } = iso;
  const [x, y] = iso.pt(u, v, z);
  const H = h * iso.T * Z_SCALE;
  const w = Math.max(0.8, H * 0.28);
  ctx.fillStyle = 'rgba(30,20,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y, w * 1.1, w * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lower;
  ctx.fillRect(x - w * 0.5, y - H * 0.46, w, H * 0.46);
  ctx.fillStyle = shirt;
  ctx.fillRect(x - w * 0.62, y - H * 0.84, w * 1.24, H * 0.42);
  ctx.fillStyle = 'rgba(30,20,40,0.28)';
  ctx.fillRect(x + w * 0.05, y - H * 0.84, w * 0.57, H * 0.84);
  ctx.fillStyle = '#7a4e34';
  ctx.beginPath();
  ctx.arc(x, y - H * 0.92, w * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e1a18';
  ctx.beginPath();
  ctx.arc(x, y - H * 0.95, w * 0.42, Math.PI, Math.PI * 2);
  ctx.fill();
}

export const CROWD_COLORS = ['#e4572e', '#f2c14e', '#3a86c8', '#f1ebdd', '#b44ca0', '#3aa36b', '#d8d0c0', '#c0392b', '#8e6bbf'];

/** A loose crowd in a rectangle, drawn back to front. */
export function crowd(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, n: number, colors: readonly string[] = CROWD_COLORS, h = 0.075): void {
  const pts: [number, number, string][] = [];
  for (let i = 0; i < n; i++) pts.push([u0 + rng() * (u1 - u0), v0 + rng() * (v1 - v0), colors[Math.floor(rng() * colors.length)]]);
  pts.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [u, v, c] of pts) person(iso, u, v, z, c, h * (0.85 + rng() * 0.25));
}

/** The national flag on a white pole (flies towards screen-right). */
export function tricolour(iso: Iso, u: number, v: number, z: number, h: number, L = h * 0.34): void {
  iso.line([u, v, z], [u, v, z + h], alpha('#3a3430', 0.8), 2.6);
  iso.line([u, v, z], [u, v, z + h], '#e8e4dc', 1.4);
  const a = L * 0.7071;
  const fh = L * 0.62;
  const zt = z + h - 0.006;
  const cols = ['#f08a24', '#f7f4ec', '#1f8a3a'];
  const N = 8;
  const wave = (t: number) => Math.sin(t * Math.PI * 1.6) * fh * 0.1 * t;
  for (let s = 0; s < 3; s++) {
    const pts: P3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push([u + t * a, v - t * a, zt - (s * fh) / 3 + wave(t)]);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      pts.push([u + t * a, v - t * a, zt - ((s + 1) * fh) / 3 + wave(t)]);
    }
    iso.poly(pts, cols[s]);
  }
  const outline: P3[] = [];
  for (let i = 0; i <= N; i++) outline.push([u + (i / N) * a, v - (i / N) * a, zt + wave(i / N)]);
  for (let i = N; i >= 0; i--) outline.push([u + (i / N) * a, v - (i / N) * a, zt - fh + wave(i / N)]);
  iso.poly(outline, null, alpha('#3a2a20', 0.45), 0.7);
  const [cx, cy] = iso.pt(u + a / 2, v - a / 2, zt - fh / 2 + wave(0.5));
  iso.ctx.beginPath();
  iso.ctx.arc(cx, cy, Math.max(0.6, fh * 0.13 * iso.T * Z_SCALE), 0, Math.PI * 2);
  iso.ctx.strokeStyle = '#1d3a8a';
  iso.ctx.lineWidth = Math.max(0.5, 0.9 * iso.px);
  iso.ctx.stroke();
  iso.ellipse(u, v, z + h + 0.004, 0.006, '#c99a3a');
}

export interface BlockOpts {
  wall: string;
  floors: number;
  /** Floor band / cornice colour. */
  trim?: string;
  /** Dado band colour at the foot of the walls. */
  plinth?: string;
  glass?: string;
  frame?: string;
  /** Window spacing along a face (tile units). */
  spacing?: number;
  /** Half-width of a window. */
  winW?: number;
  arches?: boolean;
  chhajja?: boolean;
  /** Colours for painted wooden shutters on some windows. */
  shutters?: readonly string[];
  /** Return true to leave a window out (door, sign, bays...). */
  skip?: (face: Face, a: number, floor: number) => boolean;
  showV?: boolean;
  showU?: boolean;
  /** Chance of a split AC box under a window. */
  ac?: number;
  roof?: string;
}

/**
 * Painted Indian block: plastered walls, floor bands, windows with grilles and chhajja sun-shades,
 * dado band, monsoon streaks, cornice and a flat roof. Returns the roof height.
 */
export function block(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number, o: BlockOpts): number {
  const showV = o.showV !== false;
  const showU = o.showU !== false;
  iso.aoRect(u0, v0, u1, v1, z, 0.07, 0.42);
  iso.castShadow([
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ], z, H, 0.15);
  iso.box(u0, v0, u1, v1, z, z + H, mat(o.wall), { noLeft: !showV, noRight: !showU });
  const fh = H / o.floors;
  const sp = o.spacing ?? 0.13;
  const ww = o.winW ?? 0.03;
  const glass = o.glass ?? '#3a4150';
  const frame = o.frame ?? '#efe6d2';
  const concrete = mat(shade(C.concrete, 0.05));
  const faces: [Face, number, number, number, boolean][] = [
    ['v', v1, u0, u1, showV],
    ['u', u1, v0, v1, showU],
  ];
  for (const [face, plane, a0, a1, show] of faces) {
    if (!show) continue;
    for (let f = 0; f < o.floors; f++) {
      const zf = z + f * fh;
      if (f > 0 && o.trim) iso.poly(fq(iso, face, plane, a0, a1, zf - 0.012, zf + 0.004), faceTone(face, o.trim));
      const n = Math.max(1, Math.floor((a1 - a0) / sp));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((i + 0.5) / n) * (a1 - a0);
        if (o.skip?.(face, a, f)) continue;
        const zw0 = zf + fh * 0.28;
        const zw1 = zf + fh * 0.78;
        if (o.arches) {
          if (face === 'v') {
            iso.archV(plane, a - ww - 0.007, a + ww + 0.007, zw0 - 0.006, zw1 + 0.008, faceTone(face, o.trim ?? frame), true);
            iso.archV(plane, a - ww, a + ww, zw0, zw1, glass, true);
          } else {
            iso.archU(plane, a - ww - 0.007, a + ww + 0.007, zw0 - 0.006, zw1 + 0.008, faceTone(face, o.trim ?? frame), true);
            iso.archU(plane, a - ww, a + ww, zw0, zw1, shade(glass, -0.1), true);
          }
        } else {
          const sh = o.shutters && rng() < 0.45 ? o.shutters[Math.floor(rng() * o.shutters.length)] : null;
          if (face === 'v') windowV(iso, plane, a - ww, a + ww, zw0, zw1 - 0.01, sh ?? glass, frame);
          else windowU(iso, plane, a - ww, a + ww, zw0, zw1 - 0.01, sh ? shade(sh, -0.25) : shade(glass, -0.08), shade(frame, -0.2));
          if (sh) iso.line(fp(face, plane, a, zw0), fp(face, plane, a, zw1 - 0.01), alpha('#1a1410', 0.5), 0.7);
          else {
            // grille bars
            for (const k of [-0.5, 0, 0.5]) iso.line(fp(face, plane + 0.001, a + k * ww, zw0), fp(face, plane + 0.001, a + k * ww, zw1 - 0.01), alpha('#d8d2c4', 0.45), 0.6);
          }
        }
        if (o.chhajja !== false) faceBox(iso, face, plane, a - ww - 0.014, a + ww + 0.014, 0.03, zw1 + 0.002, zw1 + 0.012, concrete, false);
        if (o.ac && f > 0 && rng() < o.ac) faceBox(iso, face, plane, a + ww + 0.012, a + ww + 0.05, 0.02, zf + 0.02, zf + 0.045, mat('#e4e2dc'), true);
      }
    }
  }
  if (o.plinth) {
    if (showV) iso.poly(iso.faceVQuad(v1, u0, u1, z, z + 0.03), o.plinth);
    if (showU) iso.poly(iso.faceUQuad(u1, v0, v1, z, z + 0.03), shade(o.plinth, -0.28));
  }
  if (showV) weatherV(iso, rng, v1, u0, u1, z, z + H, Math.round((u1 - u0) * 26), 0.09);
  if (showU) weatherU(iso, rng, u1, v0, v1, z, z + H, Math.round((v1 - v0) * 22), 0.11);
  grime(iso, u0, v0, u1, v1, z, 0.05, 0.22);
  const zt = z + H;
  const corn = o.trim ?? shade(o.wall, 0.12);
  iso.box(u0 - 0.012, v0 - 0.012, u1 + 0.012, v1 + 0.012, zt, zt + 0.016, mat(corn));
  const roof = iso.topQuad(u0, v0, u1, v1, zt + 0.016);
  iso.poly(roof, o.roof ?? '#c9bfae');
  iso.speckle(roof, rng, Math.round(160 * (u1 - u0) * (v1 - v0) + 20), [alpha('#8f8474', 0.35), alpha('#f4ecdc', 0.35), alpha('#5d5448', 0.25)], 1.6);
  return zt + 0.016;
}

/** Roof parapet walls; draw 'back' before roof clutter and 'front' after it. */
export function parapet(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, h: number, m: Mat, part: 'back' | 'front', t = 0.016): void {
  if (part === 'back') {
    iso.box(u0, v0, u1, v0 + t, z, z + h, m, { edges: false });
    iso.box(u0, v0, u0 + t, v1, z, z + h, m, { edges: false });
  } else {
    iso.box(u1 - t, v0, u1, v1, z, z + h, m);
    iso.box(u0, v1 - t, u1, v1, z, z + h, m);
  }
}

/** Black Sintex-style rooftop water tank on a small stand. */
export function sintex(iso: Iso, u: number, v: number, z: number, r = 0.04): void {
  iso.aoEllipse(u, v, r, z, 0.02, 0.35);
  iso.box(u - r * 0.9, v - r * 0.9, u + r * 0.9, v + r * 0.9, z, z + r * 0.3, mat(C.concreteDark), { edges: false });
  const zz = z + r * 0.3;
  iso.lathe(u, v, zz, [
    [0, r * 0.95],
    [r * 0.15, r],
    [r * 0.55, r],
    [r * 0.75, r * 0.98],
    [r * 1.25, r * 0.98],
    [r * 1.45, r * 0.7],
    [r * 1.5, r * 0.3],
  ], (t) => (Math.abs(t - 0.45) < 0.04 ? '#1a1b1f' : '#2a2b30'), { top: '#34353a', outline: true, lit: 0.34, dark: -0.3 });
}

/** Lattice wireless / radio mast. */
export function mast(iso: Iso, u: number, v: number, z: number, h: number): void {
  const s = 0.012;
  const col = alpha('#4a4a50', 0.9);
  iso.line([u - s, v, z], [u, v, z + h], col, 1);
  iso.line([u + s, v, z], [u, v, z + h], col, 1);
  iso.line([u, v + s, z], [u, v, z + h], col, 1);
  for (let k = 1; k < 6; k++) {
    const t = k / 6;
    iso.line([u - s * (1 - t), v, z + h * t], [u + s * (1 - t), v, z + h * t], col, 0.6);
  }
  iso.line([u, v, z + h * 0.8], [u + 0.03, v - 0.03, z + h * 0.8], col, 0.8);
  iso.ellipse(u, v, z + h, 0.005, '#d63a2a');
}

export type VehicleKind = 'car' | 'jeep' | 'ambulance' | 'engine' | 'auto' | 'bus' | 'tender';

/**
 * A vehicle facing +along (towards the viewer). (u, v) is its back-left corner on the ground.
 */
export function vehicle(iso: Iso, u: number, v: number, z: number, along: Face, kind: VehicleKind, color: string, accent?: string): void {
  const dims: Record<VehicleKind, [number, number, number]> = {
    car: [0.15, 0.075, 0.06],
    jeep: [0.15, 0.08, 0.075],
    ambulance: [0.19, 0.085, 0.095],
    engine: [0.3, 0.1, 0.1],
    tender: [0.26, 0.1, 0.1],
    auto: [0.085, 0.06, 0.07],
    bus: [0.38, 0.1, 0.12],
  };
  const [L, W, H] = dims[kind];
  // local (l along, w across) → world
  const box = (l0: number, l1: number, w0: number, w1: number, z0: number, z1: number, m: Mat, edges = true) => {
    if (along === 'u') iso.box(u + l0, v + w0, u + l1, v + w1, z + z0, z + z1, m, { edges });
    else iso.box(u + w0, v + l0, u + w1, v + l1, z + z0, z + z1, m, { edges });
  };
  // sideQ: quad on the visible long side (w = W); frontQ: on the front end (l = L)
  const sideQ = (l0: number, l1: number, z0: number, z1: number, wAt = W) =>
    along === 'u' ? iso.faceVQuad(v + wAt + 0.001, u + l0, u + l1, z + z0, z + z1) : iso.faceUQuad(u + wAt + 0.001, v + l0, v + l1, z + z0, z + z1);
  const frontQ = (w0: number, w1: number, z0: number, z1: number, lAt = L) =>
    along === 'u' ? iso.faceUQuad(u + lAt + 0.001, v + w0, v + w1, z + z0, z + z1) : iso.faceVQuad(v + lAt + 0.001, u + w0, u + w1, z + z0, z + z1);
  const sideTone = (c: string) => (along === 'u' ? c : shade(c, -0.26));
  const frontTone = (c: string) => (along === 'u' ? shade(c, -0.26) : c);
  const glass = '#27303c';
  if (along === 'u') iso.aoRect(u, v, u + L, v + W, z, 0.025, 0.45);
  else iso.aoRect(u, v, u + W, v + L, z, 0.025, 0.45);
  const tyre = mat('#1c1c20');
  const wheels = kind === 'auto' ? [[L * 0.12, L * 0.3], [L * 0.8, L * 0.95]] : kind === 'bus' || kind === 'engine' || kind === 'tender' ? [[L * 0.1, L * 0.22], [L * 0.62, L * 0.74], [L * 0.8, L * 0.9]] : [[L * 0.12, L * 0.3], [L * 0.68, L * 0.86]];
  for (const [a, b] of wheels) box(a, b, -0.004, W + 0.004, 0, 0.026, tyre, false);
  const m = mat(color, { top: 0.18 });
  const zb = 0.012;
  if (kind === 'auto') {
    // three-wheeler: yellow-green body, black canvas hood
    box(0, L, 0, W, zb, H * 0.5, m);
    box(L * 0.05, L * 0.8, 0.004, W - 0.004, H * 0.5, H, mat('#26262a', { top: 0.1 }));
    iso.poly(sideQ(L * 0.2, L * 0.75, H * 0.52, H * 0.92), alpha('#101014', 0.8));
    box(L * 0.8, L, W * 0.15, W * 0.85, H * 0.5, H * 0.72, mat(accent ?? '#2c8a4a'));
    return;
  }
  if (kind === 'car' || kind === 'jeep') {
    const cab0 = kind === 'car' ? L * 0.25 : L * 0.02;
    const cab1 = kind === 'car' ? L * 0.72 : L * 0.66;
    box(0, L, 0, W, zb, H * 0.55, m);
    box(cab0, cab1, 0.005, W - 0.005, H * 0.55, H, m);
    iso.poly(sideQ(cab0 + 0.008, cab1 - 0.008, H * 0.6, H * 0.94, W - 0.005), sideTone(glass));
    iso.poly(frontQ(0.01, W - 0.01, H * 0.6, H * 0.94, cab1), frontTone('#3a4658'));
    iso.poly(frontQ(W * 0.12, W * 0.3, H * 0.3, H * 0.42), '#fff2c0');
    iso.poly(frontQ(W * 0.7, W * 0.88, H * 0.3, H * 0.42), '#fff2c0');
    if (accent) iso.poly(sideQ(0.004, L - 0.004, H * 0.3, H * 0.4), sideTone(accent));
    if (kind === 'jeep' && accent) {
      // red/blue light bar
      box(cab0 + L * 0.2, cab0 + L * 0.3, W * 0.2, W * 0.5, H, H + 0.012, mat('#d0302a'), false);
      box(cab0 + L * 0.2, cab0 + L * 0.3, W * 0.5, W * 0.8, H, H + 0.012, mat('#2a58c8'), false);
    }
    return;
  }
  if (kind === 'ambulance') {
    box(0, L * 0.8, 0, W, zb, H, m);
    box(L * 0.8, L, 0.004, W - 0.004, zb, H * 0.62, m);
    iso.poly(frontQ(0.01, W - 0.01, H * 0.66, H * 0.92, L * 0.8), frontTone('#3a4658'));
    iso.poly(sideQ(L * 0.82, L * 0.97, H * 0.36, H * 0.56, W - 0.004), sideTone(glass));
    iso.poly(sideQ(0.004, L * 0.8, H * 0.42, H * 0.5), sideTone('#d42a2a'));
    // red cross on the side
    const cl = L * 0.4;
    const cz = H * 0.72;
    iso.poly(sideQ(cl - 0.006, cl + 0.006, cz - 0.018, cz + 0.018), sideTone('#d42a2a'));
    iso.poly(sideQ(cl - 0.018, cl + 0.018, cz - 0.006, cz + 0.006), sideTone('#d42a2a'));
    box(L * 0.6, L * 0.7, W * 0.3, W * 0.7, H, H + 0.012, mat('#2a58c8'), false);
    return;
  }
  if (kind === 'bus') {
    box(0, L, 0, W, zb, H, m);
    for (let l = L * 0.06; l < L * 0.9; l += L * 0.1) iso.poly(sideQ(l, l + L * 0.075, H * 0.55, H * 0.85), sideTone(glass));
    iso.poly(frontQ(0.008, W - 0.008, H * 0.5, H * 0.88), frontTone('#3a4658'));
    if (accent) iso.poly(sideQ(0.004, L - 0.004, H * 0.3, H * 0.42), sideTone(accent));
    return;
  }
  // fire engine / water tender: cab at the front, body with shutters and a ladder
  const cab = L * 0.24;
  box(0, L - cab, 0, W, zb, H, m);
  box(L - cab, L, 0.004, W - 0.004, zb, H * 0.85, m);
  iso.poly(frontQ(0.01, W - 0.01, H * 0.52, H * 0.78, L), frontTone('#3a4658'));
  iso.poly(sideQ(L - cab + 0.01, L - 0.02, H * 0.5, H * 0.76, W - 0.004), sideTone(glass));
  iso.poly(sideQ(0.004, L - 0.004, H * 0.18, H * 0.26), sideTone('#f1ebdd'));
  for (let l = L * 0.08; l < L - cab - 0.02; l += L * 0.16) iso.poly(sideQ(l, l + L * 0.12, H * 0.34, H * 0.9), sideTone(shade(color, -0.12)), alpha('#3a1010', 0.5), 0.6);
  box(L - cab + 0.01, L - cab + 0.03, W * 0.3, W * 0.7, H * 0.85, H * 0.85 + 0.012, mat('#2a58c8'), false);
  if (kind === 'engine') {
    // extension ladder on the roof
    const lz = H + 0.018;
    const rail = (wf: number): [P3, P3] =>
      along === 'u' ? [[u + 0.01, v + W * wf, z + lz], [u + L - cab + 0.02, v + W * wf, z + lz]] : [[u + W * wf, v + 0.01, z + lz], [u + W * wf, v + L - cab + 0.02, z + lz]];
    const [r1a, r1b] = rail(0.3);
    const [r2a, r2b] = rail(0.7);
    iso.line(r1a, r1b, '#b8bcc0', 1.4);
    iso.line(r2a, r2b, '#d8dcdf', 1.4);
    for (let l = 0.02; l < L - cab; l += 0.02) {
      const a: P3 = along === 'u' ? [u + l, v + W * 0.3, z + lz] : [u + W * 0.3, v + l, z + lz];
      const b: P3 = along === 'u' ? [u + l, v + W * 0.7, z + lz] : [u + W * 0.7, v + l, z + lz];
      iso.line(a, b, '#c8ccd0', 0.8);
    }
  } else {
    box(L * 0.2, L * 0.5, W * 0.25, W * 0.75, H, H + 0.015, mat('#c4c8cc'), true);
  }
}

/**
 * Covered verandah (open corridor) along a face: floor, columns and a roof slab.
 * Face 'v': runs along u ∈ [a0, a1] in front of the wall at v = plane (depth towards +v).
 */
export function verandah(iso: Iso, face: Face, plane: number, a0: number, a1: number, depth: number, z: number, h: number, col: string, roof: string, n: number, floorC = '#d7cdb8'): void {
  const box = (p0: number, p1: number, q0: number, q1: number, z0: number, z1: number, m: Mat, edges = true) => {
    if (face === 'v') iso.box(q0, p0, q1, p1, z0, z1, m, { edges });
    else iso.box(p0, q0, p1, q1, z0, z1, m, { edges });
  };
  box(plane, plane + depth, a0, a1, z, z + 0.018, mat(floorC));
  // shade under the roof
  if (face === 'v') iso.poly(iso.topQuad(a0, plane, a1, plane + depth * 0.7, z + 0.019), alpha('#2a1e14', 0.22));
  else iso.poly(iso.topQuad(plane, a0, plane + depth * 0.7, a1, z + 0.019), alpha('#2a1e14', 0.22));
  const cw = 0.018;
  const cm = mat(col);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (a1 - a0 - cw);
    box(plane + depth - cw - 0.006, plane + depth - 0.006, a, a + cw, z + 0.018, z + h, cm);
  }
  box(plane, plane + depth + 0.012, a0 - 0.01, a1 + 0.01, z + h, z + h + 0.022, mat(roof));
}

/**
 * Railway track along v, with rails at u = uc ± gauge/2, from v0 to v1.
 */
export function trackV(iso: Iso, rng: Rng, uc: number, v0: number, v1: number, z: number): void {
  const g = 0.075;
  iso.poly(iso.topQuad(uc - 0.075, v0, uc + 0.075, v1, z + 0.004), '#7d7266');
  iso.speckle(iso.topQuad(uc - 0.075, v0, uc + 0.075, v1, z + 0.004), rng, Math.round(260 * (v1 - v0)), ['#5f564c', '#9a8f80', '#6d6458', '#a79c8c'], 1.5);
  for (let v = v0 + 0.012; v < v1 - 0.01; v += 0.03) iso.box(uc - 0.06, v, uc + 0.06, v + 0.012, z + 0.004, z + 0.01, mat('#6b5a48'), { edges: false });
  for (const d of [-g / 2, g / 2]) {
    iso.line([uc + d, v0, z + 0.012], [uc + d, v1, z + 0.012], '#4a4440', 2);
    iso.line([uc + d, v0, z + 0.014], [uc + d, v1, z + 0.014], '#c9c4bc', 0.9);
  }
}

/** Striped shamiana (festive tent canopy) on bamboo poles with a scalloped valance. */
export function shamiana(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, h: number, stripes: readonly string[]): void {
  const poles: [number, number][] = [
    [u0, v0],
    [u1, v0],
    [u0, v1],
    [u1, v1],
  ];
  iso.poly(iso.topQuad(u0, v0, u1, v1, z + 0.001), alpha('#2a1e14', 0.18));
  for (const [pu, pv] of poles.slice(0, 2)) iso.line([pu, pv, z], [pu, pv, z + h], '#8a6a42', 1.4);
  const zt = z + h;
  const peak = 0.05;
  const um = (u0 + u1) / 2;
  // two slopes along u with a ridge along v
  const n = stripes.length * 2;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < n; i++) {
      const a = v0 + (i / n) * (v1 - v0);
      const b = v0 + ((i + 1) / n) * (v1 - v0);
      const c = stripes[i % stripes.length];
      const pts: P3[] = side === 0 ? [
        [u0, a, zt],
        [um, a, zt + peak],
        [um, b, zt + peak],
        [u0, b, zt],
      ] : [
        [um, a, zt + peak],
        [u1, a, zt],
        [u1, b, zt],
        [um, b, zt + peak],
      ];
      iso.poly(pts, side === 0 ? shade(c, 0.08) : shade(c, -0.18));
    }
  }
  iso.line([um, v0, zt + peak], [um, v1, zt + peak], alpha('#fff4dc', 0.6), 1);
  // scalloped valance on the two visible edges
  const val = 0.025;
  const sc = 10;
  for (let i = 0; i < sc; i++) {
    const a = u0 + (i / sc) * (u1 - u0);
    const b = u0 + ((i + 1) / sc) * (u1 - u0);
    const c = stripes[i % stripes.length];
    iso.poly([
      [a, v1, zt],
      [b, v1, zt],
      [b, v1, zt - val * 0.6],
      [(a + b) / 2, v1, zt - val],
      [a, v1, zt - val * 0.6],
    ], c);
  }
  for (let i = 0; i < sc; i++) {
    const a = v0 + (i / sc) * (v1 - v0);
    const b = v0 + ((i + 1) / sc) * (v1 - v0);
    const c = stripes[(i + 1) % stripes.length];
    iso.poly([
      [u1, a, zt],
      [u1, b, zt],
      [u1, b, zt - val * 0.6],
      [u1, (a + b) / 2, zt - val],
      [u1, a, zt - val * 0.6],
    ], shade(c, -0.22));
  }
  for (const [pu, pv] of poles.slice(2)) iso.line([pu, pv, z], [pu, pv, z + h], '#8a6a42', 1.4);
  iso.line([u1, v0, z], [u1, v0, zt], '#8a6a42', 1.4);
}

/** A garland of marigolds (or party lights) hanging between two points. */
export function garland(iso: Iso, a: P3, b: P3, colors: readonly string[], sag = 0.02, beads = 14): void {
  const { ctx } = iso;
  const r = Math.max(0.6, 1.3 * iso.px);
  for (let i = 0; i <= beads; i++) {
    const t = i / beads;
    const [x, y] = iso.pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Red cross on a white square, on a face. */
export function redCross(iso: Iso, face: Face, plane: number, a: number, z: number, s: number): void {
  const p = plane + 0.002;
  iso.poly(fq(iso, face, p, a - s, a + s, z - s, z + s), faceTone(face, '#f8f4ec'), alpha('#5a1a14', 0.5), 0.8);
  const k = s * 0.3;
  const r = s * 0.78;
  iso.poly(fq(iso, face, p + 0.001, a - k, a + k, z - r, z + r), faceTone(face, '#d8262a'));
  iso.poly(fq(iso, face, p + 0.001, a - r, a + r, z - k, z + k), faceTone(face, '#d8262a'));
}

/** Clock dial on a face. */
export function clockFace(iso: Iso, face: Face, plane: number, a: number, z: number, r: number): void {
  const pts: P3[] = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    pts.push(fp(face, plane + 0.002, a + Math.cos(t) * r, z + Math.sin(t) * r));
  }
  iso.poly(pts, faceTone(face, '#f6efdc'), '#5a3a22', 1.4);
  iso.line(fp(face, plane + 0.003, a, z), fp(face, plane + 0.003, a, z + r * 0.72), '#2a2622', 1.3);
  iso.line(fp(face, plane + 0.003, a, z), fp(face, plane + 0.003, a + r * 0.5, z - r * 0.15), '#2a2622', 1.5);
}

/** Row of open arches (verandah arcade) cut into a face. */
export function arcade(iso: Iso, face: Face, plane: number, a0: number, a1: number, z0: number, z1: number, n: number, trim: string, dark: string, pointed = true): void {
  const span = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * span + span * 0.14;
    const b = a0 + (i + 1) * span - span * 0.14;
    if (face === 'v') {
      iso.archV(plane, a - 0.006, b + 0.006, z0, z1 + 0.008, faceTone(face, trim), pointed);
      iso.archV(plane, a, b, z0, z1, dark, pointed);
    } else {
      iso.archU(plane, a - 0.006, b + 0.006, z0, z1 + 0.008, faceTone(face, trim), pointed);
      iso.archU(plane, a, b, z0, z1, shade(dark, -0.1), pointed);
    }
  }
}

/** Gate pillars with caps on the front-left (+v) compound wall. */
export function gatePillars(iso: Iso, a0: number, a1: number, plane: number, z: number, h: number, body: string, cap: string): void {
  for (const a of [a0 - 0.035, a1]) {
    iso.box(a, plane - 0.035, a + 0.035, plane + 0.005, z, z + h, mat(body));
    iso.box(a - 0.006, plane - 0.041, a + 0.041, plane + 0.011, z + h, z + h + 0.016, mat(cap));
  }
}

/** Iron gate leaf (bars) across a gap in the front-left wall, drawn half open. */
export function gateBars(iso: Iso, a0: number, a1: number, plane: number, z: number, h: number, color: string): void {
  const q = iso.faceVQuad(plane - 0.01, a0, a0 + (a1 - a0) * 0.45, z, z + h);
  iso.poly(q, alpha(color, 0.25));
  for (let a = a0 + 0.008; a < a0 + (a1 - a0) * 0.45; a += 0.014) iso.line([a, plane - 0.01, z], [a, plane - 0.01, z + h], color, 0.9);
  iso.line([a0, plane - 0.01, z + h], [a0 + (a1 - a0) * 0.45, plane - 0.01, z + h], color, 1.2);
  iso.line([a0, plane - 0.01, z + h * 0.5], [a0 + (a1 - a0) * 0.45, plane - 0.01, z + h * 0.5], color, 1);
}
