/**
 * Indian industrial and utility buildings, painted in code (see ./index.ts for the contract):
 * Banarasi handloom sheds and small works, brick kilns, engineering works and rice mills, big
 * industrial estates, godowns with truck-art lorries, a thermal power station and municipal
 * overhead water tanks. Drawing helpers live in ./industrialKit.ts.
 */
import { alpha, mat, seededRng, shade, type Ctx2D, type Iso, type P3 } from '../isoPainter';
import {
  C,
  type ProceduralSpriteDef,
  charpai,
  compoundWall,
  coursesU,
  coursesV,
  drum,
  flag,
  hut,
  makeIso,
  paving,
  pipe,
  slab,
  windowU,
  windowV,
} from '../varanasiSprites';
import {
  K,
  type Rng,
  block,
  brickStack,
  chimney,
  column,
  coolingTower,
  cylStreaks,
  cylText,
  extrudePoly,
  facesViewer,
  gableShed,
  gasCylinder,
  grill,
  hangingLine,
  heap,
  pylon,
  ring,
  sacks,
  sawtoothRoof,
  shutter,
  sign,
  silo,
  smoke,
  storageTank,
  transformer,
  truck,
  vaultRoof,
} from './industrialKit';

const Z0 = 0.025;
const YARN = ['#d0246b', '#f0b429', '#1aa6a6', '#f07c1a', '#2e9e5b', '#7446b0', '#c8102e'] as const;
const DYED = ['#2b3f8c', '#b01f3a', '#e89a1c', '#1f7a5a', '#d05a8a', '#f2d24a'] as const;
const DIRT = ['#a8946f', '#b9a57e', '#8f7c5c', alpha('#6e8a44', 0.5)] as const;

/** Beaten-earth / concrete plot that fills the footprint. */
function plot(iso: Iso, rng: Rng, top = '#b3a07c', side = '#8a7858', grain: readonly string[] = DIRT): void {
  slab(iso, rng, 0.02, Z0, top, side, grain);
}

/** Flat concrete apron patch on the plot. */
function apron(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, col = '#b9b2a2'): void {
  iso.poly(iso.topQuad(u0, v0, u1, v1, Z0 + 0.002), col);
  paving(iso, rng, u0, v0, u1, v1, Z0 + 0.002, 0.25, 0.25, alpha(shade(col, -0.3), 0.35));
  iso.speckle(iso.topQuad(u0, v0, u1, v1, Z0 + 0.002), rng, Math.round(300 * (u1 - u0) * (v1 - v0)), [alpha('#6b6358', 0.35), alpha('#e6e0d0', 0.4)], 1.3);
}

/** Dark oil / dye stain on the ground. */
function stain(iso: Iso, u: number, v: number, r: number, col: string, a = 0.3): void {
  iso.ellipse(u, v, Z0 + 0.002, r, alpha(col, a));
  iso.ellipse(u + r * 0.3, v - r * 0.2, Z0 + 0.002, r * 0.55, alpha(col, a * 0.8));
}

/** Parapet ring on a flat roof (back walls first, then front). */
function parapet(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, h: number, col: string): void {
  const t = 0.018;
  const m = mat(col);
  iso.box(u0, v0, u1, v0 + t, z, z + h, m);
  iso.box(u0, v0, u0 + t, v1, z, z + h, m);
  iso.box(u1 - t, v0, u1, v1, z, z + h, m);
  iso.box(u0, v1 - t, u1, v1, z, z + h, m);
}

/** Tiny welding spark / glow. */
function glow(iso: Iso, p: P3, r: number, col = '#ffe7a0'): void {
  const [x, y] = iso.pt(p[0], p[1], p[2]);
  const R = r * iso.T;
  const g = iso.ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, alpha('#ffffff', 0.95));
  g.addColorStop(0.3, alpha(col, 0.8));
  g.addColorStop(1, alpha(col, 0));
  iso.ctx.fillStyle = g;
  iso.ctx.beginPath();
  iso.ctx.arc(x, y, R, 0, Math.PI * 2);
  iso.ctx.fill();
}

/** Loose steel rods / pipes lying on the ground along u. */
function rods(iso: Iso, u0: number, u1: number, v: number, n: number, col = '#6c6660'): void {
  for (let i = 0; i < n; i++) {
    const vv = v + i * 0.012;
    iso.line([u0 + (i % 2) * 0.02, vv, Z0 + 0.006 + (i % 3) * 0.004], [u1 - (i % 3) * 0.015, vv + 0.004, Z0 + 0.006], i % 2 ? col : shade(col, -0.2), 1.6);
  }
}

// ============================================================================
// FACTORY SMALL (1×1): silk handloom shed / engineering workshop / dye works
// ============================================================================

function drawFactorySmall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('factory_small', variant);
  const z = Z0;
  if (variant === 0) {
    // ---- Banarasi silk handloom shed with a saw-tooth north-light roof
    plot(iso, rng, '#b8a582', '#8c7a5a');
    apron(iso, rng, 0.05, 0.62, 0.62, 0.96, '#c2b69c');
    // water tank on a stand at the back-right
    iso.box(0.76, 0.08, 0.92, 0.2, z, z + 0.1, mat('#8f8a80'), { noTop: false });
    drum(iso, 0.84, 0.14, z + 0.1, 0.06, 0.07, '#26272b');
    const [u0, v0, u1, v1] = [0.08, 0.08, 0.6, 0.58];
    const H = 0.15;
    const wall = '#9fd0c6';
    block(iso, rng, u0, v0, u1, v1, z, H, wall, { noTop: true });
    // dado band + plinth
    iso.poly(iso.faceVQuad(v1 + 0.001, u0, u1, z, z + 0.03), shade('#5f8f86', 0));
    iso.poly(iso.faceUQuad(u1 + 0.001, v0, v1, z, z + 0.03), shade('#5f8f86', -0.25));
    sawtoothRoof(iso, rng, u0 - 0.01, v0, u1 + 0.01, v1 + 0.01, z + H, 3, 0.07, C.tin, K.glazing, wall);
    // door with a loom visible inside (warp threads)
    const d0 = 0.22;
    const d1 = 0.34;
    iso.poly(iso.faceVQuad(v1 + 0.002, d0, d1, z, z + 0.11), '#2c2420', alpha('#1e1a14', 0.7), 1);
    for (let u = d0 + 0.008; u < d1; u += 0.008) iso.line([u, v1 + 0.003, z + 0.035], [u + 0.006, v1 + 0.003, z + 0.1], alpha(YARN[Math.floor(u * 100) % YARN.length], 0.8), 0.6);
    iso.poly(iso.faceVQuad(v1 + 0.003, d0 - 0.008, d1 + 0.008, z + 0.11, z + 0.12), '#6a4a2a');
    // grilled windows
    windowV(iso, v1, 0.42, 0.54, z + 0.05, z + 0.11, '#2e3a40', '#e7f2ee');
    grill(iso, 'v', v1, 0.42, 0.54, z + 0.05, z + 0.11);
    windowV(iso, v1, 0.1, 0.18, z + 0.05, z + 0.11, '#2e3a40', '#e7f2ee');
    grill(iso, 'v', v1, 0.1, 0.18, z + 0.05, z + 0.11);
    for (const a of [0.16, 0.36]) {
      windowU(iso, u1, a, a + 0.1, z + 0.05, z + 0.11, '#26323a', '#d5e6e0');
      grill(iso, 'u', u1, a, a + 0.1, z + 0.05, z + 0.11);
    }
    // yellow signboard over the door
    sign(iso, rng, 'v', v1, 0.12, 0.56, z + 0.125, z + 0.148, '#f2c230', '#b3202a', '#1d3f8a');
    // yarn drying lines
    hangingLine(iso, rng, 0.68, 0.95, 0.35, z, 0.16, YARN, 'yarn');
    charpai(iso, 0.1, 0.66, z);
    // bundles of raw silk on the charpai
    iso.ellipse(0.14, 0.72, z + 0.042, 0.02, '#f3ead2', alpha('#8a7a5a', 0.6), 0.6);
    iso.ellipse(0.13, 0.77, z + 0.042, 0.018, '#e6c35a', alpha('#8a7a5a', 0.6), 0.6);
    hangingLine(iso, rng, 0.42, 0.92, 0.84, z, 0.15, YARN.slice(2), 'yarn');
    iso.tree(0.9, 0.62, z, 0.075, rng, 'neem');
  } else if (variant === 1) {
    // ---- small engineering / fabrication workshop with rolling shutters
    plot(iso, rng, '#a99e8a', '#80745e', ['#968a74', '#b8ad97', alpha('#3a3430', 0.4)]);
    apron(iso, rng, 0.06, 0.6, 0.66, 0.96, '#b3ada0');
    stain(iso, 0.3, 0.72, 0.06, '#2a2622', 0.3);
    stain(iso, 0.52, 0.86, 0.04, '#2a2622', 0.25);
    const [u0, v0, u1, v1] = [0.1, 0.1, 0.62, 0.58];
    const H1 = 0.14;
    const H2 = 0.26;
    block(iso, rng, u0, v0, u1, v1, z, H1, '#d9a441', { noTop: true });
    block(iso, rng, u0, v0, u1, v1, z + H1, H2 - H1, '#b76a4a', { shadow: 0.1 });
    coursesV(iso, rng, v1, u0, u1, z + H1, z + H2, 0.018, 0.04, alpha('#e8c1a0', 0.35), 0.6);
    coursesU(iso, rng, u1, v0, v1, z + H1, z + H2, 0.018, 0.04, alpha('#d8a888', 0.3), 0.6);
    // chhajja (sunshade) over the shutters
    iso.box(u0 - 0.01, v1, u1 + 0.01, v1 + 0.04, z + H1, z + H1 + 0.012, mat('#c9c2b4'));
    iso.box(u1, v0 - 0.01, u1 + 0.04, v1 + 0.04, z + H1, z + H1 + 0.012, mat('#c9c2b4'));
    shutter(iso, 'v', v1, u0 + 0.03, u0 + 0.22, z, z + 0.11, '#5a7fa0', 0);
    shutter(iso, 'v', v1, u0 + 0.27, u0 + 0.48, z, z + 0.11, '#5a7fa0', 0.72);
    // inside the open shutter: a lathe and a welding spark
    iso.poly(iso.faceVQuad(v1 + 0.003, u0 + 0.3, u0 + 0.38, z, z + 0.035), '#4a5058');
    glow(iso, [u0 + 0.43, v1 + 0.004, z + 0.03], 0.05, '#bfe4ff');
    shutter(iso, 'u', u1, v0 + 0.08, v0 + 0.3, z, z + 0.11, '#6f7d86', 0);
    // blue sign on the chhajja
    sign(iso, rng, 'v', v1 + 0.04, u0 + 0.02, u1 - 0.02, z + H1 + 0.014, z + H1 + 0.05, '#1f4f9a', '#fff5d6', '#f2c230');
    // upper-floor windows
    for (const a of [0.16, 0.36]) {
      windowV(iso, v1, a, a + 0.1, z + H1 + 0.04, z + H2 - 0.03, '#2c3640', '#e0d6c4');
      grill(iso, 'v', v1, a, a + 0.1, z + H1 + 0.04, z + H2 - 0.03);
    }
    windowU(iso, u1, 0.3, 0.42, z + H1 + 0.04, z + H2 - 0.03, '#26303a', '#d0c6b4');
    parapet(iso, u0, v0, u1, v1, z + H2, 0.025, '#b76a4a');
    // rooftop: black Sintex tank, a dish and rebar sticking up for the next floor
    drum(iso, 0.2, 0.2, z + H2, 0.055, 0.075, '#26272b');
    for (const [pu, pv] of [
      [u0 + 0.02, v0 + 0.02],
      [u1 - 0.02, v0 + 0.02],
      [u1 - 0.02, v1 - 0.02],
    ] as [number, number][])
      for (let k = 0; k < 3; k++) iso.line([pu + k * 0.006, pv, z + H2 + 0.02], [pu + k * 0.006, pv, z + H2 + 0.07], '#6a3a2a', 0.9);
    iso.ellipse(0.48, 0.24, z + H2 + 0.05, 0.03, '#e8e8e6', alpha('#555', 0.6), 0.6);
    iso.line([0.48, 0.24, z + H2], [0.48, 0.24, z + H2 + 0.05], '#555', 1);
    // lean-to at the side with gas cylinders and scrap
    hut(iso, rng, 0.68, 0.18, 0.93, 0.5, z, 0.12, 0.09, '#bdb3a2', 'rust', false, '#3a2e26');
    gasCylinder(iso, 0.7, 0.58, z, '#1f1f22');
    gasCylinder(iso, 0.74, 0.6, z, '#c8342a');
    gasCylinder(iso, 0.78, 0.57, z, '#1f1f22');
    heap(iso, rng, 0.86, 0.78, z, 0.08, 0.05, '#6a5d52', ['#8a4a2a', '#4a4540', '#9a948a', '#b0603a']);
    rods(iso, 0.3, 0.8, 0.9, 4);
  } else {
    // ---- dye works: brick shed, open dye vats, dyed cloth drying on bamboo
    plot(iso, rng, '#ad9a78', '#857355');
    stain(iso, 0.7, 0.4, 0.09, '#2b3f8c', 0.28);
    stain(iso, 0.55, 0.62, 0.07, '#b01f3a', 0.22);
    stain(iso, 0.84, 0.55, 0.06, '#e89a1c', 0.25);
    chimney(iso, rng, 0.64, 0.14, z, 0.36, 0.028, 0.022, '#7e8488', 'steel', K.steam, 0.5);
    gableShed(iso, rng, 0.08, 0.08, 0.46, 0.54, z, 0.15, 0.07, 'v', '#b5654a', C.tin, { rust: 0.6, louvre: true });
    coursesU(iso, rng, 0.46, 0.08, 0.54, z, z + 0.15, 0.018, 0.04, alpha('#e8c1a0', 0.3), 0.6);
    iso.poly(iso.faceVQuad(0.542, 0.16, 0.28, z, z + 0.11), '#2a221e', alpha('#1e1a14', 0.7), 1);
    windowU(iso, 0.46, 0.16, 0.26, z + 0.05, z + 0.11, '#2a3038', '#d8c9b0');
    windowU(iso, 0.46, 0.34, 0.44, z + 0.05, z + 0.11, '#2a3038', '#d8c9b0');
    sign(iso, rng, 'v', 0.54, 0.3, 0.44, z + 0.06, z + 0.1, '#f4efe2', '#8a1c2a', '#1d3f8a');
    // boiler pipe from shed to chimney
    pipe(iso, [
      [0.46, 0.2, z + 0.1],
      [0.61, 0.2, z + 0.1],
    ], '#8a8f92', 2.5);
    // dye vats (brick tubs with coloured liquor)
    const vats: [number, number, string][] = [
      [0.62, 0.36, '#2b3f8c'],
      [0.84, 0.34, '#b01f3a'],
      [0.74, 0.54, '#e89a1c'],
    ];
    for (const [u, v, col] of vats) {
      iso.aoEllipse(u, v, 0.08, z, 0.03, 0.4);
      iso.lathe(u, v, z, [
        [0, 0.075],
        [0.05, 0.075],
        [0.055, 0.08],
      ], () => '#a65a42', { outline: true, lit: 0.25 });
      iso.ellipse(u, v, z + 0.052, 0.066, shade(col, -0.1));
      iso.ellipse(u - 0.015, v - 0.01, z + 0.053, 0.03, alpha(shade(col, 0.35), 0.5));
    }
    // a wooden stirring pole leaning on a vat
    iso.line([0.84, 0.34, z + 0.05], [0.9, 0.44, z + 0.13], '#7a5a32', 1.4);
    hangingLine(iso, rng, 0.08, 0.5, 0.66, z, 0.15, DYED, 'cloth');
    hangingLine(iso, rng, 0.2, 0.94, 0.88, z, 0.14, [...DYED].reverse(), 'cloth');
  }
}

// ============================================================================
// WATER TOWER (1×1): municipal overhead water tank (OHT)
// ============================================================================

/** Railing ring (posts + rail) on part of a circle. */
function railArc(iso: Iso, u: number, v: number, r: number, z: number, h: number, a0: number, a1: number, col: string): void {
  const pts: P3[] = [];
  const n = Math.max(4, Math.round((a1 - a0) / 0.2));
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    const p: P3 = [u + Math.cos(a) * r, v + Math.sin(a) * r, z + h];
    pts.push(p);
    iso.line([p[0], p[1], z], p, col, 0.8);
  }
  iso.polyline(pts, col, 1);
  iso.polyline(pts.map((p) => [p[0], p[1], z + h * 0.5] as P3), alpha(col, 0.7), 0.6);
}

function drawWaterTower(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('water_tower', variant);
  const z = Z0;
  plot(iso, rng, '#b7ab8c', '#8c8068', ['#a89c7e', '#c4b898', alpha('#6e8a44', 0.7), alpha('#6e8a44', 0.5)]);
  const wallM = mat('#f1ede2');
  const capM = mat('#3f8a5a');
  compoundWall(iso, rng, 0.04, 0.96, z, 0.05, 0.022, wallM, capM, 'back');
  const cu = 0.46;
  const cv = 0.44;
  const conc = '#bdb8ad';
  if (variant === 0) {
    // ---- classic OHT: drum tank on a ring of six columns with bracing
    const H = 0.62;
    const rc = 0.2;
    const cols = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + Math.PI / 4);
    iso.aoEllipse(cu, cv, rc + 0.06, z, 0.05, 0.4);
    iso.castShadow(ring(cu, cv, 0.28, 12), z + H, 0.3, 0.16);
    const colPos = cols.map((a) => [cu + Math.cos(a) * rc, cv + Math.sin(a) * rc, a] as [number, number, number]);
    const order = [...colPos].sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
    const braces = (front: boolean) => {
      for (const zz of [0.2, 0.4]) {
        for (let i = 0; i < 6; i++) {
          const a = colPos[i];
          const b = colPos[(i + 1) % 6];
          const mid = (a[2] + b[2]) / 2 + (i === 5 ? Math.PI : 0);
          if (facesViewer(mid) !== front) continue;
          iso.line([a[0], a[1], z + zz], [b[0], b[1], z + zz], front ? shade(conc, -0.1) : shade(conc, -0.3), 3);
        }
      }
    };
    braces(false);
    for (const [pu, pv, a] of order) {
      column(iso, pu, pv, 0.025, z, z + H, facesViewer(a) ? conc : shade(conc, -0.12));
      iso.ellipse(pu, pv, z + 0.002, 0.034, shade(conc, -0.25));
    }
    braces(true);
    // spiral-less straight ladder on the front column
    const [lu, lv] = [colPos[0][0] + 0.03, colPos[0][1] + 0.03];
    iso.line([lu - 0.012, lv + 0.012, z], [lu - 0.012, lv + 0.012, z + H], '#3a3a3e', 0.8);
    iso.line([lu + 0.012, lv - 0.012, z], [lu + 0.012, lv - 0.012, z + H], '#3a3a3e', 0.8);
    for (let zz = 0.02; zz < H; zz += 0.025) iso.line([lu - 0.012, lv + 0.012, z + zz], [lu + 0.012, lv - 0.012, z + zz], alpha('#3a3a3e', 0.8), 0.6);
    // tank: bottom ring beam, drum, walkway, conical roof
    const R = 0.28;
    const zt = z + H;
    const TH = 0.22;
    iso.lathe(cu, cv, zt - 0.03, [
      [0, R * 0.8],
      [0.03, R * 1.02],
      [TH, R],
      [TH + 0.004, R * 1.08],
      [TH + 0.014, R * 1.08],
    ], (t) => (t > 0.42 && t < 0.7 ? '#3f86c6' : t > 0.92 ? '#d6d2c8' : '#cdc9bf'), { outline: true, lit: 0.22, dark: -0.34 });
    const zTop = zt - 0.03 + TH + 0.014;
    railArc(iso, cu, cv, R * 1.05, zTop, 0.03, Math.PI * 0.75, Math.PI * 1.75, '#3a3a3e');
    iso.lathe(cu, cv, zTop, [
      [0, R * 0.96],
      [0.07, R * 0.2],
      [0.075, 0.03],
      [0.1, 0.03],
      [0.1, 0],
    ], (t) => (t > 0.85 ? '#3f86c6' : '#d8d4ca'), { outline: true, lit: 0.25 });
    railArc(iso, cu, cv, R * 1.05, zTop, 0.03, -Math.PI * 0.25, Math.PI * 0.75, '#3a3a3e');
    const zb0 = zt - 0.03 + TH * 0.44;
    const zb1 = zt - 0.03 + TH * 0.68;
    cylText(iso, rng, cu, cv, R + 0.002, zb0 + 0.012, zb1 - 0.012, -0.2, Math.PI * 0.62, '#f4f1e6');
    cylStreaks(iso, rng, cu, cv, R + 0.002, zt - 0.02, zb0 - 0.01, 14, '#5e574e', 0.2);
    // overflow pipe
    iso.line([cu + R * 0.6, cv + R * 0.8, zt], [cu + R * 0.6, cv + R * 0.8, z], alpha('#555a5e', 0.9), 2);
  } else if (variant === 1) {
    // ---- square box tank on four columns with beams (older municipal type)
    const H = 0.54;
    const s = 0.2;
    const pts: [number, number][] = [
      [cu - s, cv - s],
      [cu + s, cv - s],
      [cu - s, cv + s],
      [cu + s, cv + s],
    ];
    iso.aoRect(cu - s - 0.04, cv - s - 0.04, cu + s + 0.04, cv + s + 0.04, z, 0.05, 0.35);
    iso.castShadow([
      [cu - 0.28, cv - 0.28],
      [cu + 0.28, cv - 0.28],
      [cu + 0.28, cv + 0.28],
      [cu - 0.28, cv + 0.28],
    ], z + H, 0.26, 0.16);
    const cm = mat(conc);
    const beams = (front: boolean) => {
      for (const zz of [0.18, 0.36]) {
        if (!front) {
          iso.box(cu - s, cv - s - 0.015, cu + s, cv - s + 0.015, z + zz, z + zz + 0.025, cm);
          iso.box(cu - s - 0.015, cv - s, cu - s + 0.015, cv + s, z + zz, z + zz + 0.025, cm);
        } else {
          iso.box(cu + s - 0.015, cv - s, cu + s + 0.015, cv + s, z + zz, z + zz + 0.025, cm);
          iso.box(cu - s, cv + s - 0.015, cu + s, cv + s + 0.015, z + zz, z + zz + 0.025, cm);
        }
      }
    };
    beams(false);
    for (const [pu, pv] of pts) iso.box(pu - 0.022, pv - 0.022, pu + 0.022, pv + 0.022, z, z + H, cm);
    beams(true);
    // ladder up the front-left column
    const lu = cu - s;
    for (const dv of [0.03, 0.055]) iso.line([lu, cv + s + dv, z], [lu, cv + s + dv, z + H + 0.02], '#3a3a3e', 0.8);
    for (let zz = 0.02; zz < H; zz += 0.025) iso.line([lu, cv + s + 0.03, z + zz], [lu, cv + s + 0.055, z + zz], alpha('#3a3a3e', 0.8), 0.6);
    // tank box with a thin cornice
    const t0 = z + H;
    const t1 = t0 + 0.2;
    const tb = 0.27;
    iso.box(cu - tb, cv - tb, cu + tb, cv + tb, t0, t0 + 0.02, mat(shade(conc, -0.08)));
    block(iso, rng, cu - tb + 0.01, cv - tb + 0.01, cu + tb - 0.01, cv + tb - 0.01, t0 + 0.02, t1 - t0 - 0.02, '#c4bfb2', { shadow: 0, streaks: 1.8 });
    // moss and leak stains
    for (let i = 0; i < 6; i++) {
      const a = cu - tb + 0.02 + rng() * (2 * tb - 0.06);
      iso.poly(iso.faceVQuad(cv + tb - 0.009, a, a + 0.02 + rng() * 0.04, t0 + 0.02, t0 + 0.05 + rng() * 0.05), alpha('#4e6a3a', 0.35));
    }
    iso.poly(iso.faceUQuad(cu + tb - 0.009, cv - 0.05, cv + 0.02, t0 + 0.02, t1 - 0.02), alpha('#3c4a44', 0.3));
    iso.poly(iso.faceVQuad(cv + tb - 0.008, cu - 0.12, cu + 0.12, t0 + 0.1, t0 + 0.14), '#3f86c6');
    iso.poly(iso.faceUQuad(cu + tb - 0.008, cv - 0.18, cv + 0.18, t0 + 0.1, t0 + 0.14), shade('#3f86c6', -0.28));
    sign(iso, rng, 'v', cv + tb - 0.008, cu - 0.1, cu + 0.1, t0 + 0.105, t0 + 0.135, '#3f86c6', '#f4f1e6');
    // railing and access hatch on the roof
    const rz = t1;
    const rl = (a: P3, b: P3) => {
      iso.line(a, b, '#3a3a3e', 1);
      iso.line([a[0], a[1], a[2] - 0.015], [b[0], b[1], b[2] - 0.015], alpha('#3a3a3e', 0.7), 0.6);
    };
    const e = tb - 0.02;
    rl([cu - e, cv - e, rz + 0.03], [cu + e, cv - e, rz + 0.03]);
    rl([cu - e, cv - e, rz + 0.03], [cu - e, cv + e, rz + 0.03]);
    iso.box(cu - 0.05, cv - 0.05, cu + 0.03, cv + 0.03, rz, rz + 0.025, mat('#8a8a86'));
    iso.line([cu + 0.05, cv + 0.05, rz], [cu + 0.05, cv + 0.05, rz + 0.08], '#555', 1);
    rl([cu + e, cv - e, rz + 0.03], [cu + e, cv + e, rz + 0.03]);
    rl([cu - e, cv + e, rz + 0.03], [cu + e, cv + e, rz + 0.03]);
    for (const [pu, pv] of [
      [cu + e, cv + e],
      [cu - e, cv + e],
      [cu + e, cv - e],
    ] as [number, number][])
      iso.line([pu, pv, rz], [pu, pv, rz + 0.03], '#3a3a3e', 0.9);
  } else {
    // ---- modern shaft-type OHT: central shaft carrying a funnel tank
    const H = 0.52;
    const rs = 0.1;
    iso.aoEllipse(cu, cv, 0.16, z, 0.06, 0.45);
    iso.castShadow(ring(cu, cv, 0.3, 14), z + H, 0.32, 0.16);
    iso.lathe(cu, cv, z, [
      [0, 0.15],
      [0.03, 0.15],
      [0.035, rs * 1.05],
      [H, rs],
    ], () => '#e8e0cc', { outline: true, lit: 0.2, dark: -0.34, step: 1.4 });
    // slit windows + door on the shaft
    for (const zz of [0.16, 0.3, 0.44]) {
      const a = Math.PI * 0.28;
      iso.line([cu + Math.cos(a) * (rs + 0.002), cv + Math.sin(a) * (rs + 0.002), z + zz], [cu + Math.cos(a) * (rs + 0.002), cv + Math.sin(a) * (rs + 0.002), z + zz + 0.05], '#3a3a3e', 2.2);
    }
    const da = Math.PI * 0.4;
    iso.poly([
      [cu + Math.cos(da - 0.25) * (rs + 0.002), cv + Math.sin(da - 0.25) * (rs + 0.002), z + 0.035],
      [cu + Math.cos(da + 0.25) * (rs + 0.002), cv + Math.sin(da + 0.25) * (rs + 0.002), z + 0.035],
      [cu + Math.cos(da + 0.25) * (rs + 0.002), cv + Math.sin(da + 0.25) * (rs + 0.002), z + 0.12],
      [cu + Math.cos(da - 0.25) * (rs + 0.002), cv + Math.sin(da - 0.25) * (rs + 0.002), z + 0.12],
    ], '#4a6fa0', alpha('#1e1a14', 0.6), 0.8);
    cylStreaks(iso, rng, cu, cv, rs + 0.001, z + 0.05, z + H, 10, '#7a7060', 0.15);
    const R = 0.3;
    const zt = z + H;
    iso.lathe(cu, cv, zt, [
      [0, rs],
      [0.1, R],
      [0.2, R],
      [0.205, R * 1.03],
      [0.215, R * 1.03],
      [0.26, R * 0.5],
      [0.27, 0.05],
      [0.3, 0.04],
      [0.3, 0],
    ], (t, up) => {
      if (up > 0.2 && t > 0.6) return '#dcd5c4';
      if (t > 0.44 && t < 0.52) return '#5aa6d6';
      if (t > 0.3 && t < 0.34) return '#5aa6d6';
      return '#efe6cf';
    }, { outline: true, lit: 0.2, dark: -0.34 });
    cylText(iso, rng, cu, cv, R + 0.002, zt + 0.125, zt + 0.16, -0.25, Math.PI * 0.65, '#2f5f8a');
    cylStreaks(iso, rng, cu, cv, R + 0.002, zt + 0.1, zt + 0.2, 10, '#6a6254', 0.18);
    railArc(iso, cu, cv, R * 1.04, zt + 0.215, 0.025, -Math.PI * 0.25, Math.PI * 0.75, '#3a3a3e');
    iso.tree(0.84, 0.18, z, 0.07, rng, 'ashoka');
  }
  // pump room (front-right) and a neem
  block(iso, rng, 0.72, 0.62, 0.9, 0.84, z, 0.1, '#e9e3d4');
  iso.box(0.7, 0.6, 0.92, 0.86, z + 0.1, z + 0.113, mat('#3f8a5a'));
  iso.poly(iso.faceVQuad(0.842, 0.76, 0.82, z, z + 0.075), '#3f6a8a', alpha('#1e1a14', 0.6), 0.8);
  windowU(iso, 0.9, 0.68, 0.76, z + 0.04, z + 0.075, '#2d3440', '#6e7a80');
  pipe(iso, [
    [0.72, 0.7, z + 0.03],
    [cu + 0.1, 0.7, z + 0.03],
    [cu + 0.1, 0.7, z + 0.2],
  ], C.pipeBlue, 3);
  if (variant !== 2) iso.tree(0.16, 0.82, z, 0.08, rng, 'neem');
  else iso.tree(0.16, 0.82, z, 0.07, rng, 'shrub');
  compoundWall(iso, rng, 0.04, 0.96, z, 0.05, 0.022, wallM, capM, 'front', { v0: 0.46, v1: 0.64 });
}

// ============================================================================
// WAREHOUSE (2×2): godowns
// ============================================================================

/** Stack of cardboard cartons. */
function cartons(iso: Iso, u0: number, v0: number, cols: number, rows: number, layers: number, s: number, z: number): void {
  iso.aoRect(u0, v0, u0 + cols * s, v0 + rows * s, z, 0.03, 0.4);
  for (let l = 0; l < layers; l++)
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        if (l > 0 && (i + j + l) % 3 === 0) continue;
        const u = u0 + i * s;
        const v = v0 + j * s;
        const zb = z + l * s * 0.8;
        iso.box(u, v, u + s * 0.96, v + s * 0.96, zb, zb + s * 0.8, mat(shade('#b88c58', ((i * 7 + j * 3 + l) % 5) * 0.03 - 0.06)));
        iso.line([u + s * 0.48, v, zb + s * 0.8], [u + s * 0.48, v + s * 0.96, zb + s * 0.8], alpha('#6a4a2a', 0.5), 0.6);
      }
}

/** Wooden handcart (thela). */
function thela(iso: Iso, u: number, v: number, z: number, load: string | null): void {
  iso.aoRect(u, v, u + 0.2, v + 0.1, z, 0.02, 0.35);
  iso.box(u, v, u + 0.2, v + 0.1, z + 0.035, z + 0.045, mat('#8a6238'));
  iso.line([u + 0.2, v + 0.03, z + 0.04], [u + 0.28, v + 0.03, z + 0.05], '#6a4a2a', 1.2);
  iso.line([u + 0.2, v + 0.07, z + 0.04], [u + 0.28, v + 0.07, z + 0.05], '#6a4a2a', 1.2);
  const wheel = (pu: number) => {
    const pts: P3[] = [];
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * Math.PI * 2;
      pts.push([pu + Math.cos(t) * 0.028, v + 0.102, z + 0.028 + Math.sin(t) * 0.028]);
    }
    iso.poly(pts, null, '#2a2420', 1.4);
  };
  wheel(u + 0.05);
  wheel(u + 0.15);
  if (load) sacks(iso, u + 0.01, v + 0.005, 3, 2, 2, 0.045, z + 0.045, load);
}

function drawWarehouse(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('warehouse', variant);
  const z = Z0;
  plot(iso, rng, '#b1a68e', '#877b62', ['#a0957c', '#c0b59c', alpha('#3a3430', 0.3), alpha('#6e8a44', 0.5)]);
  if (variant === 0) {
    // ---- government (FCI-style) godown on a high plinth with a loading platform
    apron(iso, rng, 0.08, 1.35, 1.92, 1.92, '#a9a397');
    const zp = z + 0.07;
    block(iso, rng, 0.16, 0.14, 1.78, 1.36, z, 0.07, '#c9bfa8', { shadow: 0.1, streaks: 0.5 });
    coursesV(iso, rng, 1.36, 0.16, 1.78, z, zp, 0.02, 0.06, alpha('#7a6e58', 0.35), 0.6);
    // steps at the platform end
    for (let k = 0; k < 3; k++) iso.box(1.78, 1.12 + k * 0.0, 1.78 + 0.03 * (3 - k), 1.3, z, z + 0.023 * (k + 1), mat('#bdb39c'));
    iso.tree(1.84, 0.22, z, 0.13, rng, 'neem');
    gableShed(iso, rng, 0.22, 0.18, 1.72, 1.08, zp, 0.2, 0.13, 'u', '#ece2c8', K.asbestos, { vents: 3, louvre: true, shadow: 0.14 });
    iso.poly(iso.faceVQuad(1.081, 0.22, 1.72, zp, zp + 0.04), shade(C.govMaroon, 0));
    iso.poly(iso.faceUQuad(1.721, 0.18, 1.08, zp, zp + 0.04), shade(C.govMaroon, -0.28));
    for (const a of [0.34, 0.8, 1.26]) shutter(iso, 'v', 1.08, a, a + 0.22, zp, zp + 0.15, '#8b949a', a === 0.8 ? 0.8 : 0);
    // stencilled name boards between the shutters
    for (const a of [0.58, 1.04]) sign(iso, rng, 'v', 1.08, a + 0.02, a + 0.18, zp + 0.08, zp + 0.13, '#f4ecd6', C.govMaroon);
    windowU(iso, 1.72, 0.4, 0.52, zp + 0.1, zp + 0.15, '#2d3440', '#d8ccb0');
    grill(iso, 'u', 1.72, 0.4, 0.52, zp + 0.1, zp + 0.15);
    windowU(iso, 1.72, 0.74, 0.86, zp + 0.1, zp + 0.15, '#2d3440', '#d8ccb0');
    grill(iso, 'u', 1.72, 0.74, 0.86, zp + 0.1, zp + 0.15);
    // sacks on the platform
    sacks(iso, 0.3, 1.13, 4, 2, 3, 0.05, zp, '#e2d6b4');
    sacks(iso, 1.28, 1.14, 3, 2, 2, 0.05, zp, '#d9c9a0');
    // truck backed up to the open shutter
    truck(iso, rng, 0.84, 1.4, z, 'v', 1.05, { body: '#e0a526', cab: '#e0a526', trim: '#c8342a', cargo: 'sacks' });
    thela(iso, 0.22, 1.55, z, '#e2d6b4');
    sacks(iso, 1.42, 1.5, 3, 3, 2, 0.05, z, '#d6c69c');
    iso.tree(1.84, 1.84, z, 0.1, rng, 'shrub');
  } else {
    // ---- private godown with a barrel-vault tin roof and a busy yard
    apron(iso, rng, 0.08, 1.1, 1.92, 1.92, '#aca596');
    stain(iso, 1.0, 1.5, 0.08, '#2a2622', 0.25);
    const [u0, v0, u1, v1] = [0.16, 0.2, 1.46, 1.02];
    const H = 0.17;
    const wall = '#e3c04a';
    block(iso, rng, u0, v0, u1, v1, z, H, wall, { noTop: true, streaks: 1.4 });
    iso.poly(iso.faceVQuad(v1 + 0.001, u0, u1, z, z + 0.025), '#7a6a50');
    iso.poly(iso.faceUQuad(u1 + 0.001, v0, v1, z, z + 0.025), shade('#7a6a50', -0.28));
    vaultRoof(iso, rng, u0, v0, u1, v1, z + H, 0.15, '#9aa4a8', wall);
    for (const a of [0.26, 0.62, 0.98]) shutter(iso, 'v', v1, a, a + 0.24, z, z + 0.13, '#2f5f9a', a === 0.62 ? 0.85 : 0);
    // goods visible inside the open shutter
    sacks(iso, 0.66, v1 - 0.06, 4, 1, 2, 0.05, z, '#e2d6b4');
    sign(iso, rng, 'u', u1, v0 + 0.12, v1 - 0.12, z + 0.04, z + 0.12, '#c8242e', '#fff4d6', '#f2c230');
    // yard: cartons, sacks, two trucks and a handcart
    cartons(iso, 1.58, 0.22, 3, 4, 3, 0.07, z);
    truck(iso, rng, 1.52, 0.66, z, 'v', 1.0, { body: '#1f7a9a', cab: '#e84a2a', trim: '#f2c230', cargo: 'tarp', tarp: '#e4b22a' });
    sacks(iso, 0.22, 1.12, 4, 2, 2, 0.05, z, '#cfe0f0');
    truck(iso, rng, 0.26, 1.34, z, 'u', 1.05, { body: '#c8342a', cab: '#f2c230', trim: '#1e88e5', cargo: 'open' });
    cartons(iso, 0.98, 1.18, 2, 2, 2, 0.07, z);
    thela(iso, 1.28, 1.5, z, '#d9c9a0');
    iso.tree(0.24, 1.82, z, 0.11, rng, 'neem');
    iso.tree(1.84, 1.8, z, 0.09, rng, 'ashoka');
  }
}

// ============================================================================
// FACTORY MEDIUM (2×2): brick kiln / engineering works / rice mill
// ============================================================================

function stadium(u0: number, u1: number, vc: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI;
    pts.push([u1 + Math.cos(a) * r, vc + Math.sin(a) * r]);
  }
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI / 2 + (k / 10) * Math.PI;
    pts.push([u0 + Math.cos(a) * r, vc + Math.sin(a) * r]);
  }
  return pts;
}

/** Rows of green (unfired) bricks drying in the sun. */
function dryingBricks(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, rows: number, dv: number, z: number): void {
  for (let r = 0; r < rows; r++) {
    const v = v0 + r * dv;
    iso.aoRect(u0, v, u1, v + 0.035, z, 0.015, 0.3);
    iso.box(u0, v, u1, v + 0.035, z, z + 0.018, mat(shade('#b98a64', (rng() - 0.5) * 0.08), { top: 0.1 }), { edges: false });
    iso.clipped(iso.topQuad(u0, v, u1, v + 0.035, z + 0.018), () => {
      for (let u = u0 + 0.022; u < u1; u += 0.022) iso.line([u, v, z + 0.018], [u, v + 0.035, z + 0.018], alpha('#6a4632', 0.5), 0.6);
    });
  }
}

function drawFactoryMedium(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('factory_medium', variant);
  const z = Z0;
  if (variant === 0) {
    // ---- Bull's-trench brick kiln (bhatta) with its tall tapering chimney
    plot(iso, rng, '#b08a64', '#86664a', ['#a07a56', '#c29a70', alpha('#6a4a34', 0.5), alpha('#d8b890', 0.5)]);
    hut(iso, rng, 0.08, 0.08, 0.34, 0.26, z, 0.1, 0.08, '#b5856a', 'tarp', true, '#3a2e26');
    heap(iso, rng, 1.72, 0.3, z, 0.2, 0.1, '#8a6a4e', ['#7a5a40', '#9a7a5a', '#6a4a34']);
    // kiln: raised stadium-shaped trench with an ash-covered top
    const kiln = stadium(0.66, 1.26, 0.62, 0.3);
    iso.aoRect(0.34, 0.3, 1.58, 0.94, z, 0.08, 0.4);
    const kz = z + 0.09;
    extrudePoly(iso, kiln, z, kz, '#8e5440', '#6f6660');
    iso.clipped(kiln.map(([u, v]) => [u, v, kz] as P3), () => {
      iso.speckle(kiln.map(([u, v]) => [u, v, kz] as P3), rng, 900, ['#5a524c', '#8a827a', '#4a4440', alpha('#b0553b', 0.6)], 1.4);
    });
    // inner channel ring of stoking holes, some glowing
    const inner = stadium(0.66, 1.26, 0.62, 0.18);
    for (let i = 0; i < inner.length; i++) {
      const [u, v] = inner[i];
      iso.ellipse(u, v, kz + 0.001, 0.018, '#2a2220');
      if (i % 4 === 1) glow(iso, [u, v, kz + 0.005], 0.035, '#ff8a2a');
    }
    // the fire front: smoke seeping out of the top
    for (const [u, v] of [inner[3], inner[14]]) smoke(iso, rng, u, v, kz + 0.02, 0.05, '#7a706a', 4, 0.08, 0.1, 0.35);
    // walkway edge line
    iso.polyline([...kiln, kiln[0]].map(([u, v]) => [u, v, kz] as P3), alpha('#a09890', 0.6), 1);
    chimney(iso, rng, 0.96, 0.62, kz, 1.2, 0.1, 0.055, '#9a5642', 'brick', '#3a3432', 1.25);
    heap(iso, rng, 1.8, 0.98, z, 0.13, 0.07, K.coal, ['#1a1a1c', '#3a3a3e', '#555']);
    // green bricks drying and fired brick hacks
    dryingBricks(iso, rng, 0.14, 1.06, 0.9, 7, 0.1, z);
    for (const [u, v] of [
      [1.1, 1.14],
      [1.42, 1.14],
      [1.1, 1.46],
      [1.42, 1.46],
    ] as [number, number][])
      brickStack(iso, rng, u, v, u + 0.24, v + 0.2, z, 0.1 + ((u * 10 + v * 7) % 3) * 0.02, K.firedBrick);
    // a donkey-cart / tractor path of trampled earth
    iso.poly(iso.topQuad(0.96, 1.05, 1.06, 1.96, z + 0.001), alpha('#8a6a4a', 0.35));
    iso.tree(0.12, 1.86, z, 0.1, rng, 'neem');
    thela(iso, 1.72, 1.8, z, null);
  } else if (variant === 1) {
    // ---- small engineering works: blue-roofed shed, office, steel yard, walled compound
    plot(iso, rng, '#aaa290', '#807866', ['#9a927e', '#bab29e', alpha('#3a3430', 0.3)]);
    apron(iso, rng, 0.08, 0.08, 1.92, 1.92, '#b6afa0');
    const wallM = mat('#ddd6c6');
    const capM = mat('#8a3a2a');
    compoundWall(iso, rng, 0.04, 1.96, z, 0.07, 0.025, wallM, capM, 'back');
    chimney(iso, rng, 1.5, 0.22, z, 0.62, 0.035, 0.028, '#7e8488', 'steel', '#8a8480', 0.7);
    gableShed(iso, rng, 0.14, 0.16, 1.26, 0.9, z, 0.2, 0.11, 'u', '#c9c4b8', K.tinBlue, { skylights: 3, vents: 3, louvre: true, rust: 0.3 });
    shutter(iso, 'v', 0.9, 0.3, 0.56, z, z + 0.17, '#8a949a', 0.9);
    glow(iso, [0.45, 0.905, z + 0.04], 0.07, '#bfe4ff');
    shutter(iso, 'v', 0.9, 0.78, 1.04, z, z + 0.17, '#8a949a', 0);
    sign(iso, rng, 'v', 0.9, 0.56, 0.76, z + 0.12, z + 0.18, '#f2c230', '#1d3f8a', '#c8242e');
    storageTank(iso, rng, 1.66, 0.52, z, 0.1, 0.22, '#e6e2d6', '#c8342a');
    // office block with a rooftop hoarding
    block(iso, rng, 1.3, 1.02, 1.86, 1.58, z, 0.24, '#e8e070');
    for (const a of [1.36, 1.56]) {
      windowV(iso, 1.58, a, a + 0.12, z + 0.06, z + 0.13, '#2e3a44', '#f4f0e0');
      windowV(iso, 1.58, a + 0.06, a + 0.12 + 0.06, z + 0.16, z + 0.21, '#2e3a44', '#f4f0e0');
    }
    iso.poly(iso.faceVQuad(1.582, 1.76, 1.83, z, z + 0.11), '#6a4a2a', alpha('#1e1a14', 0.6), 0.8);
    windowU(iso, 1.86, 1.1, 1.24, z + 0.1, z + 0.17, '#28323c', '#e4dcc4');
    windowU(iso, 1.86, 1.34, 1.48, z + 0.1, z + 0.17, '#28323c', '#e4dcc4');
    parapet(iso, 1.3, 1.02, 1.86, 1.58, z + 0.24, 0.02, '#d8d060');
    // hoarding on stilts
    for (const a of [1.4, 1.74]) iso.line([a, 1.12, z + 0.24], [a, 1.12, z + 0.33], '#4a4a4e', 1.2);
    sign(iso, rng, 'v', 1.12, 1.36, 1.78, z + 0.3, z + 0.38, '#1f4f9a', '#fff5d6', '#f2c230');
    // steel stock rack and plates
    for (let k = 0; k < 4; k++) iso.line([0.2 + k * 0.1, 1.1, z], [0.2 + k * 0.1, 1.1, z + 0.08], '#4a4a4e', 1.4);
    for (let k = 0; k < 5; k++) iso.line([0.18, 1.1 + k * 0.012, z + 0.03 + k * 0.01], [0.54, 1.1 + k * 0.012, z + 0.03 + k * 0.01], k % 2 ? '#6c6660' : '#8a847a', 1.6);
    iso.box(0.2, 1.3, 0.5, 1.46, z, z + 0.04, mat('#7a8288'));
    rods(iso, 0.6, 1.1, 1.3, 5, '#7a4a32');
    truck(iso, rng, 0.62, 1.42, z, 'u', 1.05, { body: '#2a8a4a', cab: '#e8e0d0', trim: '#f2c230', cargo: 'open' });
    gasCylinder(iso, 1.1, 1.02, z, '#1f1f22');
    gasCylinder(iso, 1.14, 1.04, z, '#1f1f22');
    iso.tree(0.24, 1.78, z, 0.1, rng, 'neem');
    compoundWall(iso, rng, 0.04, 1.96, z, 0.07, 0.025, wallM, capM, 'front', { v0: 1.0, v1: 1.28 });
    for (const gu of [0.96, 1.28]) {
      iso.box(gu, 1.9, gu + 0.05, 1.96, z, z + 0.12, wallM);
      iso.box(gu - 0.006, 1.894, gu + 0.056, 1.966, z + 0.12, z + 0.135, capM);
    }
  } else {
    // ---- rice mill: steel silos, bucket-elevator tower, godown, paddy drying yard
    plot(iso, rng, '#b0a384', '#86795e');
    // paddy drying yard (front-right)
    const yard: [number, number, number, number] = [1.06, 0.98, 1.92, 1.92];
    iso.poly(iso.topQuad(...yard, z + 0.004), K.paddy);
    iso.clipped(iso.topQuad(...yard, z + 0.004), () => {
      for (let u = yard[0] + 0.03; u < yard[2]; u += 0.05) iso.line([u, yard[1], z + 0.004], [u + 0.02, yard[3], z + 0.004], alpha('#a8862a', 0.45), 1);
    });
    iso.speckle(iso.topQuad(...yard, z + 0.004), rng, 700, ['#e8c860', '#b8923a', '#f0d880'], 1.2);
    // husk chimney and mill block at the back right
    block(iso, rng, 1.26, 0.14, 1.86, 0.66, z, 0.24, '#d8cfb8', { streaks: 1.3 });
    iso.box(1.26, 0.14, 1.86, 0.66, z + 0.24, z + 0.27, mat(shade('#d8cfb8', -0.1)), { noTop: false });
    for (const a of [1.34, 1.54]) windowV(iso, 0.66, a, a + 0.1, z + 0.12, z + 0.19, '#2a3038', '#eee4cc');
    shutter(iso, 'u', 1.86, 0.3, 0.5, z, z + 0.14, '#6f7d86', 0.6);
    sign(iso, rng, 'v', 0.66, 1.66, 1.84, z + 0.12, z + 0.2, '#2e7d4a', '#fff4d6');
    // silos + elevator tower + chutes
    silo(iso, 0.42, 0.44, z, 0.17, 0.46, '#c3cacd');
    silo(iso, 0.86, 0.3, z, 0.15, 0.42);
    const tu0 = 1.02;
    const tv0 = 0.66;
    block(iso, rng, tu0, tv0, tu0 + 0.12, tv0 + 0.12, z, 0.78, '#9aa2a6', { streaks: 0.5 });
    iso.box(tu0 - 0.02, tv0 - 0.02, tu0 + 0.14, tv0 + 0.14, z + 0.78, z + 0.84, mat('#7a8288'));
    pipe(iso, [
      [tu0, tv0 + 0.06, z + 0.8],
      [0.42, 0.44, z + 0.64],
    ], '#8a9296', 2.2);
    pipe(iso, [
      [tu0 + 0.02, tv0, z + 0.8],
      [0.86, 0.3, z + 0.58],
    ], '#8a9296', 2.2);
    chimney(iso, rng, 1.8, 0.86, z, 0.52, 0.045, 0.035, '#a4583e', 'brick', '#8a8078', 0.7);
    // godown in front of the silos
    gableShed(iso, rng, 0.14, 0.9, 0.94, 1.76, z, 0.17, 0.1, 'v', '#e6dcc2', C.tin, { rust: 0.5, vents: 2 });
    iso.poly(iso.faceUQuad(0.941, 0.9, 1.76, z, z + 0.03), shade('#2e7d4a', -0.28));
    iso.poly(iso.faceVQuad(1.761, 0.14, 0.94, z, z + 0.03), '#2e7d4a');
    shutter(iso, 'u', 0.94, 1.08, 1.3, z, z + 0.13, '#2e7d4a', 0.8);
    shutter(iso, 'u', 0.94, 1.42, 1.64, z, z + 0.13, '#2e7d4a', 0);
    shutter(iso, 'v', 1.76, 0.4, 0.66, z, z + 0.13, '#2e7d4a', 0);
    sacks(iso, 0.98, 1.1, 2, 4, 3, 0.05, z, '#e8dcb8');
    // workers' rakes and a heap of husk
    heap(iso, rng, 1.66, 1.62, z, 0.14, 0.07, '#c8a24a', ['#a8862a', '#e0c060', '#8a6a2a']);
    heap(iso, rng, 1.3, 1.3, z, 0.1, 0.05, '#d8b85a', ['#b8923a', '#f0d880']);
    iso.line([1.5, 1.2, z + 0.004], [1.62, 1.32, z + 0.06], '#7a5a32', 1.2);
    iso.tree(0.14, 1.88, z, 0.09, rng, 'shrub');
  }
}

// ============================================================================
// POWER PLANT (2×2): thermal power station
// ============================================================================

/** Metal-clad industrial block with vertical cladding ribs and a coloured band. */
function cladBlock(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number, col: string, band: string | null): void {
  block(iso, rng, u0, v0, u1, v1, z, H, col, { streaks: 0.6 });
  iso.clipped(iso.faceVQuad(v1, u0, u1, z, z + H), () => {
    for (let u = u0 + 0.02; u < u1; u += 0.025) iso.line([u, v1 + 0.001, z], [u, v1 + 0.001, z + H], alpha(shade(col, -0.35), 0.35), 0.6);
  });
  iso.clipped(iso.faceUQuad(u1, v0, v1, z, z + H), () => {
    for (let v = v0 + 0.02; v < v1; v += 0.025) iso.line([u1 + 0.001, v, z], [u1 + 0.001, v, z + H], alpha(shade(col, -0.55), 0.35), 0.6);
  });
  if (band) {
    iso.poly(iso.faceVQuad(v1 + 0.002, u0, u1, z + H - 0.05, z + H - 0.025), band);
    iso.poly(iso.faceUQuad(u1 + 0.002, v0, v1, z + H - 0.05, z + H - 0.025), shade(band, -0.28));
  }
  // strip glazing
  iso.poly(iso.faceVQuad(v1 + 0.002, u0 + 0.03, u1 - 0.03, z + H * 0.55, z + H * 0.62), alpha('#2c3a44', 0.75));
  iso.poly(iso.faceUQuad(u1 + 0.002, v0 + 0.03, v1 - 0.03, z + H * 0.55, z + H * 0.62), alpha('#1f2a32', 0.75));
}

/** Inclined conveyor gallery between two points (box-section truss). */
function conveyor(iso: Iso, a: P3, b: P3, col = '#8a8f80'): void {
  const n = 8;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const p: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    if (k > 0 && k < n && k % 2 === 0) iso.line([p[0], p[1], Z0], [p[0], p[1], p[2] - 0.03], alpha('#4a4e52', 0.9), 1.2);
  }
  pipe(iso, [a, b], col, 6);
  iso.polyline([a, b].map((p) => [p[0], p[1], p[2] + 0.012] as P3), alpha('#3a3e40', 0.6), 1);
}

/** Outdoor switchyard: transformers, gantries and a line of pylons. */
function switchyard(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number): void {
  iso.poly(iso.topQuad(u0, v0, u1, v1, z + 0.003), '#9c978c');
  iso.clipped(iso.topQuad(u0, v0, u1, v1, z + 0.003), () => {
    for (let u = u0 + 0.03; u < u1; u += 0.03) iso.line([u, v0, z + 0.003], [u, v1, z + 0.003], alpha('#6f6a60', 0.25), 0.6);
  });
  const n = Math.max(2, Math.floor((u1 - u0) / 0.22));
  for (let i = 0; i < n; i++) transformer(iso, u0 + 0.04 + i * ((u1 - u0 - 0.08) / n), v0 + 0.04, z, 0.9);
  // gantry
  for (const u of [u0 + 0.04, u1 - 0.04]) iso.line([u, v1 - 0.04, z], [u, v1 - 0.04, z + 0.16], '#6c747a', 1.3);
  iso.line([u0 + 0.04, v1 - 0.04, z + 0.16], [u1 - 0.04, v1 - 0.04, z + 0.16], '#6c747a', 1.3);
  for (let k = 0; k < 3; k++) {
    const u = u0 + 0.1 + (k * (u1 - u0 - 0.2)) / 2;
    iso.line([u, v1 - 0.04, z + 0.16], [u, v1 - 0.04, z + 0.13], '#d9d2c2', 1.4);
    iso.line([u, v1 - 0.04, z + 0.13], [u, v0 + 0.08, z + 0.1], alpha('#2a2a2e', 0.55), 0.6);
  }
  // chain-link fence
  iso.poly(iso.faceVQuad(v1, u0, u1, z, z + 0.05), alpha('#9aa0a4', 0.25), alpha('#5a6064', 0.7), 0.6);
  iso.poly(iso.faceUQuad(u1, v0, v1, z, z + 0.05), alpha('#9aa0a4', 0.2), alpha('#5a6064', 0.7), 0.6);
}

function drawPowerPlant(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('power_plant', variant);
  const z = Z0;
  plot(iso, rng, '#a79d88', '#7e7562', ['#968c78', '#b6ac98', alpha('#2b2a2d', 0.35)]);
  if (variant === 0) {
    // ---- one big cooling tower, banded chimney, boiler house, turbine hall, coal yard
    apron(iso, rng, 1.0, 0.08, 1.92, 1.7, '#aea89c');
    coolingTower(iso, rng, 0.6, 0.6, z, 1.02, 0.5, 0.33, 0.37, 0.8);
    chimney(iso, rng, 1.58, 0.36, z, 1.5, 0.1, 0.06, '#d9d2c4', 'banded', '#8a8480', 0.8);
    // coal yard with stacker
    heap(iso, rng, 0.46, 1.44, z, 0.3, 0.12, K.coal, ['#1a1a1c', '#3a3a3e', '#4a4a4e']);
    heap(iso, rng, 0.8, 1.72, z, 0.18, 0.08, K.coal, ['#1a1a1c', '#3a3a3e']);
    conveyor(iso, [0.62, 1.34, z + 0.1], [1.18, 1.0, z + 0.44]);
    // boiler house (tall) and ESP, turbine hall in front
    cladBlock(iso, rng, 1.16, 0.74, 1.78, 1.24, z, 0.6, '#7f93a3', '#2f5f9a');
    iso.box(1.2, 0.78, 1.5, 1.0, z + 0.6, z + 0.66, mat('#6f8090'));
    pipe(iso, [
      [1.5, 0.74, z + 0.4],
      [1.58, 0.48, z + 0.4],
    ], '#7a8288', 5);
    cladBlock(iso, rng, 1.0, 1.28, 1.86, 1.64, z, 0.3, '#e6e0d0', '#2f5f9a');
    sign(iso, rng, 'v', 1.64, 1.1, 1.5, z + 0.19, z + 0.24, '#f4efe2', '#1d3f8a', '#c8242e');
    switchyard(iso, 1.0, 1.7, 1.9, 1.94, z);
    pylon(iso, 0.2, 1.88, z, 0.34, 0.03);
  } else {
    // ---- twin cooling towers, chimney at the back, compact unit block, switchyard
    chimney(iso, rng, 0.34, 0.34, z, 1.22, 0.09, 0.055, '#d9d2c4', 'banded', '#8a8480', 0.7);
    coolingTower(iso, rng, 1.08, 0.5, z, 0.82, 0.36, 0.24, 0.27, 0.9);
    coolingTower(iso, rng, 0.5, 1.08, z, 0.82, 0.36, 0.24, 0.27, 0.9);
    heap(iso, rng, 1.72, 0.34, z, 0.2, 0.1, K.coal, ['#1a1a1c', '#3a3a3e', '#4a4a4e']);
    apron(iso, rng, 1.14, 1.0, 1.92, 1.92, '#aea89c');
    conveyor(iso, [1.7, 0.5, z + 0.08], [1.5, 1.1, z + 0.4]);
    cladBlock(iso, rng, 1.2, 1.1, 1.62, 1.44, z, 0.5, '#8a9aa6', '#c8342a');
    cladBlock(iso, rng, 1.2, 1.48, 1.86, 1.84, z, 0.26, '#e6e0d0', '#2f5f9a');
    sign(iso, rng, 'v', 1.84, 1.3, 1.7, z + 0.16, z + 0.21, '#f4efe2', '#1d3f8a', '#c8242e');
    switchyard(iso, 0.16, 1.56, 1.1, 1.9, z);
    pylon(iso, 1.86, 1.0, z, 0.36, 0.03);
  }
}

// ============================================================================
// FACTORY LARGE (3×3): heavy engineering works / textile mill
// ============================================================================

function drawFactoryLarge(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('factory_large', variant);
  const z = Z0;
  plot(iso, rng, '#a9a18e', '#807866', ['#9a927e', '#bab29e', alpha('#3a3430', 0.3)]);
  apron(iso, rng, 0.08, 0.08, 2.92, 2.92, '#b3ac9e');
  const wallM = mat('#ddd6c6');
  const capM = mat(variant === 0 ? '#2f5f9a' : '#8a3a2a');
  compoundWall(iso, rng, 0.04, 2.96, z, 0.08, 0.03, wallM, capM, 'back');
  if (variant === 0) {
    // ---- heavy engineering works: big blue shed, grey shed, EOT-crane stockyard
    chimney(iso, rng, 2.62, 0.3, z, 1.6, 0.1, 0.06, '#d9d2c4', 'banded', '#8a8480', 0.75);
    gableShed(iso, rng, 0.18, 0.18, 2.3, 0.96, z, 0.26, 0.14, 'u', '#c9c4b8', K.tinBlue, { skylights: 5, vents: 5, louvre: true, rust: 0.4 });
    shutter(iso, 'v', 0.96, 0.4, 0.7, z, z + 0.22, '#8a949a', 0.85);
    glow(iso, [0.55, 0.962, z + 0.05], 0.08, '#bfe4ff');
    shutter(iso, 'v', 0.96, 1.5, 1.8, z, z + 0.22, '#8a949a', 0);
    sign(iso, rng, 'v', 0.96, 0.84, 1.36, z + 0.15, z + 0.22, '#1f4f9a', '#fff5d6', '#f2c230');
    storageTank(iso, rng, 2.58, 0.78, z, 0.14, 0.3, '#e6e2d6', '#2f5f9a');
    storageTank(iso, rng, 2.62, 1.12, z, 0.1, 0.22, '#e6e2d6', '#c8342a');
    gableShed(iso, rng, 0.18, 1.1, 1.62, 1.78, z, 0.2, 0.11, 'v', '#b8b2a4', K.tinGrey, { vents: 2, rust: 0.8 });
    shutter(iso, 'v', 1.78, 0.5, 0.8, z, z + 0.17, '#c8342a', 0);
    shutter(iso, 'u', 1.62, 1.3, 1.56, z, z + 0.17, '#8a949a', 0.7);
    // stockyard: steel coils and plates under an EOT crane
    const g0 = 1.84;
    const g1 = 2.8;
    const r0 = 1.26;
    const r1 = 1.9;
    const gz = z + 0.34;
    const steel = '#5f6a74';
    const colAt = (u: number, v: number) => iso.box(u - 0.02, v - 0.02, u + 0.02, v + 0.02, z, gz, mat(steel));
    for (const u of [g0, (g0 + g1) / 2, g1]) colAt(u, r0);
    iso.box(g0 - 0.02, r0 - 0.02, g1 + 0.02, r0 + 0.02, gz, gz + 0.03, mat(steel));
    for (const [u, v] of [
      [2.0, 1.44],
      [2.3, 1.4],
      [2.56, 1.46],
      [2.12, 1.66],
      [2.44, 1.7],
    ] as [number, number][]) {
      iso.aoEllipse(u, v, 0.08, z, 0.03, 0.4);
      iso.lathe(u, v, z, [
        [0, 0.075],
        [0.09, 0.075],
      ], (t) => (t > 0.5 ? '#8a939a' : '#6e7880'), { outline: true, lit: 0.35 });
      iso.ellipse(u, v, z + 0.09, 0.075, '#9aa2a8', alpha('#3a4046', 0.6), 0.8);
      iso.ellipse(u, v, z + 0.091, 0.03, '#3a3e42');
    }
    iso.box(1.9, 1.76, 2.3, 1.86, z, z + 0.04, mat('#7a8288'));
    // crane bridge + hoist (yellow)
    const cu = 2.34;
    iso.box(cu - 0.035, r0, cu + 0.035, r1, gz + 0.03, gz + 0.07, mat('#f2c230'));
    iso.box(cu - 0.05, 1.5, cu + 0.05, 1.62, gz - 0.02, gz + 0.03, mat('#e0a526'));
    iso.line([cu, 1.56, gz - 0.02], [cu, 1.56, z + 0.16], '#2a2a2e', 1.2);
    iso.box(cu - 0.03, 1.53, cu + 0.03, 1.59, z + 0.13, z + 0.16, mat('#3a3a3e'));
    for (const u of [g0, (g0 + g1) / 2, g1]) colAt(u, r1);
    iso.box(g0 - 0.02, r1 - 0.02, g1 + 0.02, r1 + 0.02, gz, gz + 0.03, mat(steel));
    // office block, security cabin, trucks
    block(iso, rng, 0.2, 2.02, 0.9, 2.52, z, 0.26, '#e8e2d2');
    iso.poly(iso.faceVQuad(2.522, 0.2, 0.9, z + 0.11, z + 0.13), '#2f5f9a');
    for (const a of [0.26, 0.46, 0.66]) {
      windowV(iso, 2.52, a, a + 0.14, z + 0.04, z + 0.1, '#2e3a44', '#f4f0e0');
      windowV(iso, 2.52, a, a + 0.14, z + 0.16, z + 0.22, '#2e3a44', '#f4f0e0');
    }
    windowU(iso, 0.9, 2.1, 2.26, z + 0.16, z + 0.22, '#28323c', '#e4dcc4');
    parapet(iso, 0.2, 2.02, 0.9, 2.52, z + 0.26, 0.02, '#d8d2c2');
    sign(iso, rng, 'v', 2.52, 0.3, 0.8, z + 0.27, z + 0.33, '#1f4f9a', '#fff5d6', '#f2c230');
    truck(iso, rng, 1.2, 2.06, z, 'u', 1.1, { body: '#1f7a9a', cab: '#e84a2a', trim: '#f2c230', cargo: 'tarp', tarp: '#e4b22a' });
    truck(iso, rng, 1.9, 2.1, z, 'v', 1.1, { body: '#e0a526', cab: '#c8342a', trim: '#1e88e5', cargo: 'open' });
    block(iso, rng, 2.42, 2.5, 2.62, 2.7, z, 0.12, '#e8e2d2');
    iso.box(2.4, 2.48, 2.64, 2.72, z + 0.12, z + 0.135, capM);
    for (const [u, v] of [
      [0.2, 2.8],
      [1.1, 2.8],
    ] as [number, number][])
      iso.tree(u, v, z, 0.11, rng, 'ashoka');
    iso.tree(2.8, 2.2, z, 0.14, rng, 'neem');
    compoundWall(iso, rng, 0.04, 2.96, z, 0.08, 0.03, wallM, capM, 'front', { v0: 1.9, v1: 2.34 });
  } else {
    // ---- textile mill: brick saw-tooth weaving shed, brick chimney, boiler house, cotton bales
    chimney(iso, rng, 2.5, 0.34, z, 1.5, 0.11, 0.06, '#9a5642', 'brick', '#5f5a57', 1.0);
    block(iso, rng, 2.2, 0.72, 2.8, 1.24, z, 0.3, '#b5654a');
    coursesV(iso, rng, 1.24, 2.2, 2.8, z, z + 0.3, 0.02, 0.05, alpha('#e8c1a0', 0.3), 0.6);
    coursesU(iso, rng, 2.8, 0.72, 1.24, z, z + 0.3, 0.02, 0.05, alpha('#d8a888', 0.3), 0.6);
    windowV(iso, 1.24, 2.3, 2.44, z + 0.14, z + 0.24, '#2a3038', '#d8c9b0');
    windowV(iso, 1.24, 2.56, 2.7, z + 0.14, z + 0.24, '#2a3038', '#d8c9b0');
    pipe(iso, [
      [2.5, 0.72, z + 0.22],
      [2.5, 0.46, z + 0.22],
    ], '#6a6660', 4);
    const [u0, v0, u1, v1] = [0.18, 0.18, 2.04, 1.86];
    const H = 0.18;
    block(iso, rng, u0, v0, u1, v1, z, H, '#b5654a', { noTop: true, streaks: 1.4 });
    coursesV(iso, rng, v1, u0, u1, z, z + H, 0.02, 0.05, alpha('#e8c1a0', 0.3), 0.6);
    coursesU(iso, rng, u1, v0, v1, z, z + H, 0.02, 0.05, alpha('#d8a888', 0.3), 0.6);
    for (let a = u0 + 0.08; a < u1 - 0.1; a += 0.2) windowV(iso, v1, a, a + 0.1, z + 0.06, z + 0.14, '#2a3038', '#d8c9b0');
    for (let a = v0 + 0.08; a < v1 - 0.1; a += 0.2) windowU(iso, u1, a, a + 0.1, z + 0.06, z + 0.14, '#222830', '#c8b9a0');
    sawtoothRoof(iso, rng, u0 - 0.01, v0, u1 + 0.01, v1 + 0.01, z + H, 6, 0.1, K.tinGrey, K.glazing, '#b5654a');
    iso.poly(iso.faceVQuad(v1 + 0.003, 0.9, 1.14, z, z + 0.15), '#2a221e', alpha('#1e1a14', 0.7), 1);
    sign(iso, rng, 'v', v1, 0.4, 0.84, z + 0.145, z + 0.175, '#f4efe2', '#8a1c2a', '#1d3f8a');
    // office (two floors) at the front right
    block(iso, rng, 2.22, 1.48, 2.82, 2.1, z, 0.28, '#efe6cf');
    iso.poly(iso.faceVQuad(2.102, 2.22, 2.82, z + 0.13, z + 0.15), '#8a3a2a');
    iso.poly(iso.faceUQuad(2.822, 1.48, 2.1, z + 0.13, z + 0.15), shade('#8a3a2a', -0.28));
    for (const a of [2.28, 2.5]) {
      windowV(iso, 2.1, a, a + 0.14, z + 0.04, z + 0.11, '#2e3a44', '#f4f0e0');
      windowV(iso, 2.1, a, a + 0.14, z + 0.18, z + 0.25, '#2e3a44', '#f4f0e0');
    }
    for (const a of [1.56, 1.8]) windowU(iso, 2.82, a, a + 0.14, z + 0.18, z + 0.25, '#28323c', '#e4dcc4');
    parapet(iso, 2.22, 1.48, 2.82, 2.1, z + 0.28, 0.02, '#e2d8c0');
    flag(iso, 2.7, 1.6, z + 0.28, 0.16, C.saffron);
    // cotton bales and yarn cones
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 2; j++) {
        const u = 0.3 + i * 0.13;
        const v = 2.06 + j * 0.13;
        iso.box(u, v, u + 0.11, v + 0.11, z, z + 0.08, mat('#f2efe6', { right: -0.2 }));
        iso.line([u, v + 0.055, z + 0.08], [u + 0.11, v + 0.055, z + 0.08], alpha('#8a7a5a', 0.6), 0.7);
        iso.line([u + 0.055, v + 0.11, z], [u + 0.055, v + 0.11, z + 0.08], alpha('#8a7a5a', 0.6), 0.7);
      }
    sacks(iso, 0.9, 2.1, 3, 3, 2, 0.06, z, '#e8dcc0');
    truck(iso, rng, 1.34, 2.1, z, 'u', 1.1, { body: '#c8342a', cab: '#f2c230', trim: '#1e88e5', cargo: 'sacks' });
    truck(iso, rng, 2.2, 0.2, z, 'u', 1.0, { body: '#2a8a4a', cab: '#e8e0d0', trim: '#f2c230', cargo: 'bricks' });
    for (const u of [0.24, 0.9]) iso.tree(u, 2.8, z, 0.11, rng, 'ashoka');
    iso.tree(2.84, 0.3, z, 0.12, rng, 'neem');
    compoundWall(iso, rng, 0.04, 2.96, z, 0.08, 0.03, wallM, capM, 'front', { v0: 1.4, v1: 1.8 });
    for (const gu of [1.36, 1.8]) {
      iso.box(gu, 2.9, gu + 0.06, 2.96, z, z + 0.15, wallM);
      iso.box(gu - 0.006, 2.894, gu + 0.066, 2.966, z + 0.15, z + 0.165, capM);
    }
  }
}

// ============================================================================
// Registry
// ============================================================================

export const INDUSTRIAL_SPRITES: Record<string, ProceduralSpriteDef> = {
  factory_small: { footprint: 1, variants: 3, heightTiles: 0.36, draw: drawFactorySmall },
  water_tower: { footprint: 1, variants: 3, heightTiles: 0.5, draw: drawWaterTower },
  warehouse: { footprint: 2, variants: 2, heightTiles: 0.2, draw: drawWarehouse },
  factory_medium: { footprint: 2, variants: 3, heightTiles: 0.72, draw: drawFactoryMedium },
  power_plant: { footprint: 2, variants: 2, heightTiles: 0.86, draw: drawPowerPlant },
  factory_large: { footprint: 3, variants: 2, heightTiles: 0.52, draw: drawFactoryLarge },
};
