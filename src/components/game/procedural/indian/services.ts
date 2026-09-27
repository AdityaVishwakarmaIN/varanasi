/**
 * Indian-style procedural art: services buildings (police thana, fire station, district hospital,
 * government school, college, Nagar Nigam office, metro entrance, railway station, barat ghar).
 * See ./index.ts for the drawing contract.
 */
import { alpha, mat, seededRng, shade, type Ctx2D, type Iso, type P3 } from '../isoPainter';
import { C, chhatri, compoundWall, coursesU, coursesV, dome, lawn, makeIso, paving, slab, drum, grime, type ProceduralSpriteDef } from '../varanasiSprites';
import {
  arcade,
  block,
  clockFace,
  crowd,
  faceBox,
  garland,
  gateBars,
  gatePillars,
  mast,
  parapet,
  person,
  redCross,
  shamiana,
  signboard,
  sintex,
  tricolour,
  trackV,
  vehicle,
  verandah,
  type Rng,
} from './servicesKit';

const KHAKI = '#b8975a';
const AUTO_YELLOW = '#e6c229';
const FAIRY = ['#ff5a5a', '#ffd84a', '#5ad0ff', '#7aff7a', '#ff8ae0'];
const MARIGOLD = ['#f5a623', '#e0761a', '#f5a623', '#ffd24a'];

function barricade(iso: Iso, u0: number, u1: number, v: number, z: number): void {
  iso.line([u0 + 0.01, v, z], [u0 + 0.01, v, z + 0.05], '#3a3a3a', 1.2);
  iso.line([u1 - 0.01, v, z], [u1 - 0.01, v, z + 0.05], '#3a3a3a', 1.2);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = u0 + ((u1 - u0) * i) / n;
    iso.box(a, v, a + (u1 - u0) / n, v + 0.012, z + 0.03, z + 0.05, mat(i % 2 ? '#1f1f22' : '#f2c21e'), { edges: false });
  }
}

function chair(iso: Iso, u: number, v: number, z: number, color: string): void {
  iso.box(u, v, u + 0.018, v + 0.018, z + 0.016, z + 0.021, mat(color), { edges: false });
  iso.box(u, v, u + 0.004, v + 0.018, z + 0.021, z + 0.04, mat(color), { edges: false });
  iso.line([u + 0.018, v + 0.018, z], [u + 0.018, v + 0.018, z + 0.016], shade(color, -0.4), 0.8);
}

/** Plain parapeted roof dressed with tanks, dish, mast etc. `items` draws between the parapets. */
function roofWithParapet(iso: Iso, u0: number, v0: number, u1: number, v1: number, zr: number, wall: string, items: () => void): void {
  const m = mat(shade(wall, 0.04));
  parapet(iso, u0, v0, u1, v1, zr, 0.035, m, 'back');
  items();
  parapet(iso, u0, v0, u1, v1, zr, 0.035, m, 'front');
}

// ============================================================================
// POLICE THANA (1×1)
// ============================================================================

function drawPoliceStation(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('police_station', variant);
  const z0 = 0.02;
  const S = [
    { wall: '#d4ae6c', trim: '#a8342a', plinth: '#8a2a22', cw: '#dcc79c', cap: '#a8342a' },
    { wall: '#b44a33', trim: '#efe2c4', plinth: '#6e2a1e', cw: '#b44a33', cap: '#efe2c4' },
    { wall: '#ebdfc0', trim: '#a8342a', plinth: '#a8342a', cw: '#ebdfc0', cap: '#a8342a' },
  ][variant];
  slab(iso, rng, 0.02, z0, '#bba686', '#86704f', ['#ab9676', '#cbb696', alpha('#7e9a4c', 0.5)]);
  paving(iso, rng, 0.05, 0.05, 0.95, 0.95, z0, 0.1, 0.1, alpha('#7d6a50', 0.22));
  const lo = 0.04;
  const hi = 0.96;
  compoundWall(iso, rng, lo, hi, z0, 0.06, 0.02, mat(S.cw), mat(S.cap), 'back');
  if (variant === 2) {
    // single-storey colonial-era thana with an arcade and a heap of seized vehicles
    const u0 = 0.09;
    const v0 = 0.09;
    const u1 = 0.66;
    const v1 = 0.48;
    const zr = block(iso, rng, u0, v0, u1, v1, z0, 0.2, {
      wall: S.wall, floors: 1, trim: S.trim, plinth: S.plinth, arches: true, spacing: 0.095, winW: 0.024, chhajja: false,
      skip: (f, a) => f === 'v' && Math.abs(a - 0.375) < 0.06,
    });
    iso.archV(v1, 0.335, 0.415, z0, z0 + 0.14, '#4a3226');
    signboard(iso, rng, 'v', v1, 0.24, 0.51, z0 + 0.15, z0 + 0.19, '#1f4f9e', '#f4f0e6');
    roofWithParapet(iso, u0, v0, u1, v1, zr, S.wall, () => {
      sintex(iso, 0.2, 0.19, zr, 0.04);
      mast(iso, 0.56, 0.17, zr, 0.3);
      iso.box(0.36, 0.14, 0.46, 0.24, zr, zr + 0.05, mat(S.wall));
    });
    tricolour(iso, 0.62, 0.44, zr + 0.035, 0.24);
    iso.tree(0.86, 0.16, z0, 0.11, rng, 'peepal');
    // seized vehicles rusting in the yard
    vehicle(iso, 0.74, 0.5, z0, 'v', 'car', '#8a5a3a');
    vehicle(iso, 0.84, 0.66, z0, 'v', 'auto', '#9a8a4a', '#5a6a4a');
    for (let i = 0; i < 4; i++) iso.ellipse(0.72 + i * 0.03, 0.78 + (i % 2) * 0.02, z0 + 0.02 + (i % 2) * 0.01, 0.02, '#1f1f22', '#444', 0.6);
    vehicle(iso, 0.2, 0.6, z0, 'u', 'jeep', '#eceae4', '#2a58c8');
    person(iso, 0.52, 0.66, z0, KHAKI);
    person(iso, 0.56, 0.72, z0, KHAKI);
    person(iso, 0.46, 0.8, z0, '#f1ebdd');
  } else {
    const u0 = 0.1;
    const v0 = 0.1;
    const u1 = 0.6;
    const v1 = 0.56;
    const zr = block(iso, rng, u0, v0, u1, v1, z0, 0.34, {
      wall: S.wall, floors: 2, trim: S.trim, plinth: S.plinth, spacing: 0.12, ac: 0.35,
      skip: (f, a, fl) => f === 'v' && fl === 0 && Math.abs(a - 0.35) < 0.06,
    });
    iso.poly(iso.faceVQuad(v1, 0.3, 0.4, z0, z0 + 0.125), '#3f5a78', alpha('#1e1a14', 0.6), 0.8);
    iso.line([0.35, v1 + 0.001, z0], [0.35, v1 + 0.001, z0 + 0.125], alpha('#1e1a14', 0.6), 0.8);
    faceBox(iso, 'v', v1, 0.26, 0.44, 0.06, z0 + 0.13, z0 + 0.142, mat(S.trim));
    signboard(iso, rng, 'v', v1, 0.15, 0.55, z0 + 0.148, z0 + 0.188, '#1f4f9e', '#f4f0e6');
    roofWithParapet(iso, u0, v0, u1, v1, zr, S.wall, () => {
      sintex(iso, 0.2, 0.2, zr, 0.042);
      mast(iso, 0.5, 0.18, zr, 0.34);
      iso.box(0.3, 0.3, 0.4, 0.4, zr, zr + 0.06, mat(S.wall));
    });
    tricolour(iso, 0.56, 0.52, zr + 0.035, 0.24);
    iso.tree(0.86, 0.14, z0, 0.1, rng, 'neem');
    vehicle(iso, 0.7, 0.3, z0, 'v', 'jeep', '#eceae4', '#2a58c8');
    if (variant === 1) {
      // sentry box by the gate, a motorbike, and a second jeep
      iso.box(0.78, 0.76, 0.86, 0.84, z0, z0 + 0.1, mat('#e8dcc0'));
      iso.poly(iso.faceVQuad(0.84, 0.795, 0.845, z0 + 0.03, z0 + 0.08), '#2d3440');
      iso.box(0.77, 0.75, 0.87, 0.85, z0 + 0.1, z0 + 0.112, mat(S.trim));
      vehicle(iso, 0.84, 0.46, z0, 'v', 'jeep', '#3f5a3a');
      person(iso, 0.82, 0.9, z0, KHAKI);
    } else {
      barricade(iso, 0.66, 0.92, 0.78, z0);
      person(iso, 0.84, 0.66, z0, KHAKI);
    }
    person(iso, 0.4, 0.7, z0, KHAKI);
    person(iso, 0.46, 0.76, z0, '#e4572e');
    person(iso, 0.3, 0.66, z0, '#f1ebdd');
  }
  compoundWall(iso, rng, lo, hi, z0, 0.06, 0.02, mat(S.cw), mat(S.cap), 'front', { v0: 0.26, v1: 0.46 });
  signboard(iso, rng, 'v', hi, 0.52, 0.88, z0 + 0.012, z0 + 0.05, '#f4efe2', S.trim === '#efe2c4' ? '#6e2a1e' : '#a8342a');
  gatePillars(iso, 0.26, 0.46, hi, z0, 0.1, S.cw, S.cap);
  gateBars(iso, 0.26, 0.46, hi, z0, 0.065, '#2f3a4a');
}

// ============================================================================
// FIRE STATION (1×1)
// ============================================================================

function hoseTower(iso: Iso, rng: Rng, u0: number, v0: number, s: number, z: number, H: number, red: string, cream: string): void {
  const u1 = u0 + s;
  const v1 = v0 + s;
  iso.aoRect(u0, v0, u1, v1, z, 0.05, 0.4);
  iso.castShadow([
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ], z, H, 0.14);
  iso.box(u0, v0, u1, v1, z, z + H, mat(cream));
  for (let zz = z + 0.1; zz < z + H - 0.08; zz += 0.14) {
    iso.poly(iso.faceVQuad(v1, u0, u1, zz, zz + 0.04), red);
    iso.poly(iso.faceUQuad(u1, v0, v1, zz, zz + 0.04), shade(red, -0.28));
  }
  for (let zz = z + 0.06; zz < z + H - 0.1; zz += 0.14) {
    iso.poly(iso.faceVQuad(v1, u0 + s * 0.4, u0 + s * 0.6, zz, zz + 0.03), '#2d3440');
    iso.poly(iso.faceUQuad(u1, v0 + s * 0.4, v0 + s * 0.6, zz, zz + 0.03), '#262c36');
  }
  // drying hoses hanging down the shaded face
  for (let k = 0; k < 3; k++) {
    const v = v0 + s * (0.2 + k * 0.3);
    iso.line([u1 + 0.004, v, z + H - 0.05], [u1 + 0.004, v, z + H * (0.35 + rng() * 0.2)], '#e8e0cc', 1.3);
  }
  // look-out room + siren
  const zt = z + H;
  iso.box(u0 - 0.015, v0 - 0.015, u1 + 0.015, v1 + 0.015, zt, zt + 0.07, mat(red));
  for (let i = 0; i < 3; i++) {
    const a = u0 + 0.01 + i * ((s + 0.01) / 3);
    iso.poly(iso.faceVQuad(v1 + 0.015, a, a + s * 0.24, zt + 0.02, zt + 0.055), '#2d3440');
    const b = v0 + 0.01 + i * ((s + 0.01) / 3);
    iso.poly(iso.faceUQuad(u1 + 0.015, b, b + s * 0.24, zt + 0.02, zt + 0.055), '#262c36');
  }
  iso.box(u0 - 0.025, v0 - 0.025, u1 + 0.025, v1 + 0.025, zt + 0.07, zt + 0.085, mat(cream));
  iso.lathe(u0 + s / 2, v0 + s / 2, zt + 0.085, [
    [0, 0.012],
    [0.03, 0.012],
    [0.035, 0.028],
    [0.05, 0.028],
    [0.06, 0],
  ], () => '#9aa0a6', { outline: true });
}

function drawFireStation(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('fire_station', variant);
  const z0 = 0.02;
  const red = '#c4302a';
  const cream = variant === 0 ? '#efe6d4' : '#f0d6a2';
  slab(iso, rng, 0.02, z0, '#b4ada0', '#857d70', ['#a39c8f', '#c4bdb0', alpha('#6d665c', 0.6)]);
  // apron in front of the bays
  iso.poly(iso.topQuad(0.04, 0.56, 0.96, 0.96, z0 + 0.001), '#a6a095');
  paving(iso, rng, 0.04, 0.56, 0.96, 0.96, z0 + 0.001, 0.16, 0.2, alpha('#6d665c', 0.3));
  compoundWall(iso, rng, 0.04, 0.96, z0, 0.06, 0.02, mat(cream), mat(red), 'back');
  const bu0 = variant === 0 ? 0.08 : 0.28;
  const bu1 = variant === 0 ? 0.66 : 0.92;
  const bv0 = 0.08;
  const bv1 = 0.55;
  if (variant === 1) hoseTower(iso, rng, 0.08, 0.1, 0.14, z0, 0.6, red, cream);
  const zr = block(iso, rng, bu0, bv0, bu1, bv1, z0, 0.33, {
    wall: cream, floors: 2, trim: red, plinth: red, spacing: 0.12, glass: '#3a4556',
    skip: (f, _a, fl) => f === 'v' && fl === 0,
  });
  // engine bays
  const nb = variant === 0 ? 2 : 3;
  const span = (bu1 - bu0 - 0.04) / nb;
  for (let i = 0; i < nb; i++) {
    const a = bu0 + 0.02 + i * span + 0.012;
    const b = a + span - 0.024;
    iso.poly(iso.faceVQuad(bv1, a - 0.008, b + 0.008, z0, z0 + 0.148), shade(red, -0.1));
    iso.poly(iso.faceVQuad(bv1, a, b, z0, z0 + 0.14), '#221a1c');
    const occupied = variant === 0 ? i === 0 : i !== 1;
    if (occupied) {
      // parked engine's nose inside the bay
      iso.poly(iso.faceVQuad(bv1, a + 0.02, b - 0.02, z0 + 0.01, z0 + 0.1), shade(red, -0.35));
      iso.poly(iso.faceVQuad(bv1, a + 0.03, b - 0.03, z0 + 0.06, z0 + 0.09), '#3a4658');
      iso.poly(iso.faceVQuad(bv1, a + 0.025, a + 0.04, z0 + 0.03, z0 + 0.045), '#fff2c0');
      iso.poly(iso.faceVQuad(bv1, b - 0.04, b - 0.025, z0 + 0.03, z0 + 0.045), '#fff2c0');
    }
    // rolled-up shutter
    iso.poly(iso.faceVQuad(bv1 + 0.001, a, b, z0 + 0.115, z0 + 0.14), '#9ea3a8');
    for (let zz = z0 + 0.118; zz < z0 + 0.14; zz += 0.006) iso.line([a, bv1 + 0.002, zz], [b, bv1 + 0.002, zz], alpha('#5a5e64', 0.6), 0.6);
    // yellow hatch on the apron
    iso.line([a, bv1 + 0.02, z0 + 0.002], [a, 0.94, z0 + 0.002], alpha('#e8c22a', 0.8), 1);
    iso.line([b, bv1 + 0.02, z0 + 0.002], [b, 0.94, z0 + 0.002], alpha('#e8c22a', 0.8), 1);
  }
  signboard(iso, rng, 'v', bv1, bu0 + 0.03, bu1 - 0.03, z0 + 0.15, z0 + 0.19, red, '#f8f2e4');
  roofWithParapet(iso, bu0, bv0, bu1, bv1, zr, cream, () => {
    sintex(iso, bu0 + 0.1, bv0 + 0.1, zr, 0.04);
    iso.box(bu1 - 0.16, bv0 + 0.06, bu1 - 0.06, bv0 + 0.16, zr, zr + 0.05, mat(cream));
    iso.lathe(bu1 - 0.11, bv0 + 0.11, zr + 0.05, [
      [0, 0.01],
      [0.04, 0.01],
      [0.045, 0.025],
      [0.06, 0.025],
      [0.07, 0],
    ], () => '#9aa0a6', { outline: true });
  });
  if (variant === 0) {
    hoseTower(iso, rng, 0.72, 0.1, 0.14, z0, 0.66, red, cream);
    vehicle(iso, 0.44, 0.58, z0, 'v', 'engine', red);
    iso.cylinder(0.86, 0.66, 0.018, z0, z0 + 0.05, red);
    person(iso, 0.3, 0.72, z0, KHAKI);
    person(iso, 0.36, 0.8, z0, KHAKI);
  } else {
    vehicle(iso, 0.36, 0.66, z0, 'u', 'tender', red);
    person(iso, 0.72, 0.84, z0, KHAKI);
    person(iso, 0.2, 0.7, z0, KHAKI);
    person(iso, 0.26, 0.76, z0, '#2a3a5a');
  }
  // fire-bucket stand
  iso.box(0.78, 0.86, 0.92, 0.875, z0, z0 + 0.06, mat('#6a6e74'), { edges: false });
  for (let k = 0; k < 4; k++) {
    iso.lathe(0.795 + k * 0.035, 0.88, z0 + 0.02, [
      [0, 0.002],
      [0.03, 0.013],
    ], () => red, { outline: true, top: shade(red, -0.3) });
  }
}

// ============================================================================
// DISTRICT HOSPITAL (2×2)
// ============================================================================

function drawHospital(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('hospital', variant);
  const z0 = 0.03;
  const wall = variant === 0 ? '#ecdcb8' : '#d4e3cf';
  const trim = C.govMaroon;
  slab(iso, rng, 0.03, z0, '#bfb49c', '#8c806a', ['#afa48c', '#cfc4ac', alpha('#7e9a4c', 0.5)]);
  paving(iso, rng, 0.06, 0.06, 1.94, 1.94, z0, 0.16, 0.16, alpha('#7d6a50', 0.18));
  lawn(iso, rng, 0.08, 1.5, 0.62, 1.92, z0, C.grass);
  compoundWall(iso, rng, 0.05, 1.95, z0, 0.08, 0.03, mat(C.cream), mat(trim), 'back');
  iso.tree(0.14, 1.2, z0, 0.12, rng, 'neem');
  const mu0 = 0.2;
  const mv0 = 0.18;
  const mu1 = variant === 0 ? 1.2 : 1.1;
  const mv1 = variant === 0 ? 0.92 : 0.84;
  const floors = variant === 0 ? 3 : 4;
  const H = floors * 0.16;
  const door = (mu0 + mu1) / 2;
  const zr = block(iso, rng, mu0, mv0, mu1, mv1, z0, H, {
    wall, floors, trim, plinth: trim, spacing: 0.12, ac: 0.3, shutters: variant === 1 ? ['#3a7a6a'] : undefined,
    skip: (f, a, fl) => (f === 'v' && fl === 0 && Math.abs(a - door) < 0.2) || (f === 'v' && fl === floors - 1 && Math.abs(a - door) < 0.08),
  });
  redCross(iso, 'v', mv1, door, z0 + H - 0.075, 0.04);
  redCross(iso, 'u', mu1, (mv0 + mv1) / 2, z0 + H - 0.075, 0.035);
  roofWithParapet(iso, mu0, mv0, mu1, mv1, zr, wall, () => {
    iso.box(mu0 + 0.1, mv0 + 0.1, mu0 + 0.28, mv0 + 0.26, zr, zr + 0.08, mat(wall));
    for (let i = 0; i < 3; i++) sintex(iso, mu0 + 0.4 + i * 0.13, mv0 + 0.12, zr, 0.04);
    for (let i = 0; i < 4; i++) iso.box(mu0 + 0.12 + i * 0.1, mv1 - 0.14, mu0 + 0.18 + i * 0.1, mv1 - 0.1, zr, zr + 0.035, mat('#dedcd6'));
    // rooftop name hoarding
    const hv = mv1 - 0.05;
    iso.line([mu0 + 0.2, hv, zr], [mu0 + 0.2, hv, zr + 0.06], '#4a4a50', 1.2);
    iso.line([mu1 - 0.2, hv, zr], [mu1 - 0.2, hv, zr + 0.06], '#4a4a50', 1.2);
    signboard(iso, rng, 'v', hv, mu0 + 0.14, mu1 - 0.14, zr + 0.05, zr + 0.12, trim, '#f6efe0', 2);
  });
  // entrance porch
  const pu0 = door - 0.2;
  const pu1 = door + 0.2;
  const pv1 = mv1 + 0.26;
  iso.poly(iso.faceVQuad(mv1, door - 0.12, door + 0.12, z0, z0 + 0.12), '#2c3640', alpha('#1e1a14', 0.6), 0.8);
  iso.box(pu0 - 0.04, mv1, pu1 + 0.04, pv1 + 0.06, z0, z0 + 0.012, mat('#d8d0c0'));
  const colM = mat(C.cream);
  for (const [cu, cv] of [
    [pu0, pv1 - 0.03],
    [pu1 - 0.03, pv1 - 0.03],
  ] as [number, number][]) iso.box(cu, cv, cu + 0.03, cv + 0.03, z0 + 0.012, z0 + 0.15, colM);
  iso.box(pu0 - 0.02, mv1, pu1 + 0.02, pv1 + 0.01, z0 + 0.15, z0 + 0.18, mat(C.cream));
  iso.poly(iso.faceVQuad(pv1 + 0.01, pu0 - 0.02, pu1 + 0.02, z0 + 0.15, z0 + 0.168), trim);
  redCross(iso, 'v', pv1 + 0.011, door, z0 + 0.205, 0.022);
  // side wing
  if (variant === 0) {
    const zw = block(iso, rng, 1.28, 0.18, 1.8, 1.3, z0, 0.34, { wall, floors: 2, trim, plinth: trim, spacing: 0.12, ac: 0.25 });
    roofWithParapet(iso, 1.28, 0.18, 1.8, 1.3, zw, wall, () => {
      sintex(iso, 1.4, 0.3, zw, 0.045);
      sintex(iso, 1.4, 0.45, zw, 0.045);
      iso.box(1.55, 0.7, 1.7, 0.85, zw, zw + 0.06, mat(wall));
    });
    vehicle(iso, 0.98, 1.34, z0, 'u', 'ambulance', '#f4f2ec');
  } else {
    const zw = block(iso, rng, 1.18, 0.18, 1.8, 1.02, z0, 0.48, { wall: '#ecdcb8', floors: 3, trim, plinth: trim, spacing: 0.12, ac: 0.3 });
    roofWithParapet(iso, 1.18, 0.18, 1.8, 1.02, zw, '#ecdcb8', () => {
      sintex(iso, 1.3, 0.3, zw, 0.045);
      sintex(iso, 1.45, 0.3, zw, 0.045);
    });
    // OPD waiting shed with a tin roof and a queue
    const su0 = 1.22;
    const su1 = 1.82;
    const sv0 = 1.12;
    const sv1 = 1.42;
    crowd(iso, rng, su0 + 0.03, sv0 + 0.03, su1 - 0.03, sv1 - 0.03, z0, 12);
    for (const [pu, pv] of [
      [su0, sv1],
      [su1, sv1],
      [su1, sv0],
    ] as [number, number][]) iso.line([pu, pv, z0], [pu, pv, z0 + 0.13], '#5a5e64', 1.4);
    const roof: P3[] = [
      [su0 - 0.02, sv0 - 0.02, z0 + 0.15],
      [su1 + 0.02, sv0 - 0.02, z0 + 0.13],
      [su1 + 0.02, sv1 + 0.02, z0 + 0.13],
      [su0 - 0.02, sv1 + 0.02, z0 + 0.15],
    ];
    iso.poly(roof, C.tin, alpha('#1e1a14', 0.5), 1);
    iso.clipped(roof, () => {
      for (let v = sv0; v < sv1 + 0.02; v += 0.02) iso.line([su0 - 0.02, v, z0 + 0.15], [su1 + 0.02, v, z0 + 0.13], alpha(shade(C.tin, -0.35), 0.5), 0.7);
    });
    vehicle(iso, 0.98, 1.12, z0, 'v', 'ambulance', '#f4f2ec');
  }
  crowd(iso, rng, pu0 - 0.1, pv1 + 0.08, pu1 + 0.05, pv1 + 0.3, z0, 14);
  iso.tree(0.3, 1.72, z0, 0.14, rng, 'neem');
  // chai stall by the gate
  const tu = 1.62;
  const tv = 1.62;
  iso.box(tu, tv, tu + 0.14, tv + 0.1, z0, z0 + 0.07, mat('#3fa3a0'));
  iso.poly([
    [tu - 0.03, tv - 0.02, z0 + 0.13],
    [tu + 0.17, tv - 0.02, z0 + 0.11],
    [tu + 0.17, tv + 0.16, z0 + 0.11],
    [tu - 0.03, tv + 0.16, z0 + 0.13],
  ], C.tarpBlue, alpha('#10203a', 0.6), 1);
  iso.line([tu + 0.17, tv + 0.16, z0], [tu + 0.17, tv + 0.16, z0 + 0.11], '#6b4a2a', 1.2);
  person(iso, 1.56, 1.8, z0, '#f1ebdd');
  person(iso, 1.64, 1.84, z0, '#e4572e');
  vehicle(iso, 1.34, 1.56, z0, 'v', 'auto', AUTO_YELLOW);
  compoundWall(iso, rng, 0.05, 1.95, z0, 0.08, 0.03, mat(C.cream), mat(trim), 'front', { v0: 0.9, v1: 1.28 });
  gatePillars(iso, 0.9, 1.28, 1.95, z0, 0.2, C.cream, trim);
  signboard(iso, rng, 'v', 1.95, 0.9, 1.28, z0 + 0.15, z0 + 0.2, trim, '#f6efe0');
}

// ============================================================================
// GOVERNMENT SCHOOL (2×2)
// ============================================================================

function drawSchool(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('school', variant);
  const z0 = 0.03;
  const S = variant === 0
    ? { wall: '#f0e3c0', dado: '#3d6fb0', door: '#2f5f9e', col: '#f4ecd8', roof: '#3d6fb0', cap: '#3d6fb0' }
    : { wall: '#efd27a', dado: '#a8452f', door: '#2f7a4a', col: '#f6ecd4', roof: '#a8452f', cap: '#a8452f' };
  slab(iso, rng, 0.03, z0, '#c9ae84', '#8a6f4e', ['#b99c72', '#d6bc92', alpha('#7e9a4c', 0.5), '#a88c64']);
  compoundWall(iso, rng, 0.05, 1.95, z0, 0.08, 0.03, mat(S.wall), mat(S.cap), 'back');
  const floors = variant === 0 ? 1 : 2;
  const fh = 0.19;
  const H = floors * fh;
  const doorsAt = (a0: number, a1: number) => {
    const n = Math.floor((a1 - a0) / 0.176);
    const out: number[] = [];
    for (let i = 1; i < n; i++) out.push(a0 + (i * (a1 - a0)) / n);
    return out;
  };
  const skipDoor = (f: 'u' | 'v', a: number) => (f === 'v' ? a > 0.6 : a > 0.6);
  // wing A (back, along u) and wing B (left, along v)
  const zA = block(iso, rng, 0.12, 0.12, 1.88, 0.5, z0, H, { wall: S.wall, floors, trim: S.dado, plinth: S.dado, spacing: 0.176, winW: 0.026, showU: true, skip: (f, a) => f === 'v' && !skipDoor(f, a) });
  for (let fl = 0; fl < floors; fl++) for (const a of doorsAt(0.6, 1.88)) iso.poly(iso.faceVQuad(0.5, a - 0.026, a + 0.026, z0 + fl * fh, z0 + fl * fh + fh * 0.72), S.door, alpha('#1e1a14', 0.5), 0.7);
  parapet(iso, 0.12, 0.12, 1.88, 0.5, zA, 0.03, mat(S.wall), 'back');
  // stair mumty with a painted door, and a solar panel row
  iso.box(0.5, 0.18, 0.72, 0.4, zA, zA + 0.1, mat(S.wall));
  iso.poly(iso.faceVQuad(0.4, 0.58, 0.64, zA, zA + 0.075), S.door);
  iso.box(0.48, 0.16, 0.74, 0.42, zA + 0.1, zA + 0.112, mat(S.roof));
  for (let i = 0; i < 3; i++) iso.poly([[0.95 + i * 0.13, 0.2, zA + 0.05], [1.06 + i * 0.13, 0.2, zA + 0.05], [1.06 + i * 0.13, 0.38, zA + 0.01], [0.95 + i * 0.13, 0.38, zA + 0.01]], '#2c3e66', '#9aa8c0', 0.6);
  sintex(iso, 1.6, 0.25, zA, 0.045);
  parapet(iso, 0.12, 0.12, 1.88, 0.5, zA, 0.03, mat(S.wall), 'front');
  const zB = block(iso, rng, 0.12, 0.5, 0.5, 1.88, z0, H, { wall: S.wall, floors, trim: S.dado, plinth: S.dado, spacing: 0.176, winW: 0.026, skip: (f, a) => f === 'u' && !skipDoor(f, a) });
  for (let fl = 0; fl < floors; fl++) for (const a of doorsAt(0.6, 1.88)) iso.poly(iso.faceUQuad(0.5, a - 0.026, a + 0.026, z0 + fl * fh, z0 + fl * fh + fh * 0.72), shade(S.door, -0.25), alpha('#1e1a14', 0.5), 0.7);
  parapet(iso, 0.12, 0.5, 0.5, 1.88, zB, 0.03, mat(S.wall), 'back');
  parapet(iso, 0.12, 0.5, 0.5, 1.88, zB, 0.03, mat(S.wall), 'front');
  // verandahs facing the courtyard (one per storey)
  for (let fl = 0; fl < floors; fl++) {
    const zv = z0 + fl * fh;
    const hv = fh - 0.022 - (fl > 0 ? 0.018 : 0);
    const zb = fl > 0 ? zv + 0.004 : zv;
    iso.box(0.5, 0.5, 0.62, 0.62, zb, zb + 0.018, mat('#d7cdb8'));
    verandah(iso, 'v', 0.5, 0.62, 1.88, 0.12, zb, hv, S.col, S.roof, 7);
    verandah(iso, 'u', 0.5, 0.5, 1.88, 0.12, zb, hv, S.col, S.roof, 7);
    iso.box(0.5, 0.5, 0.62, 0.62, zb + hv, zb + hv + 0.022, mat(S.roof));
    if (fl > 0) {
      iso.line([0.62, 0.62, zb + 0.06], [1.88, 0.62, zb + 0.06], '#2a3a5a', 1);
      iso.line([0.62, 0.62, zb + 0.06], [0.62, 1.88, zb + 0.06], '#2a3a5a', 1);
    }
  }
  // courtyard: flag platform, neem tree, hand pump, children
  const fu = 1.4;
  const fv = 0.92;
  iso.aoRect(fu - 0.09, fv - 0.09, fu + 0.09, fv + 0.09, z0, 0.03, 0.3);
  iso.boxLit(fu - 0.09, fv - 0.09, fu + 0.09, fv + 0.09, z0, z0 + 0.025, mat('#e8e0cc'));
  iso.boxLit(fu - 0.05, fv - 0.05, fu + 0.05, fv + 0.05, z0 + 0.025, z0 + 0.045, mat('#e8e0cc'));
  tricolour(iso, fu, fv, z0 + 0.045, 0.5);
  iso.tree(1.78, 0.78, z0, 0.15, rng, 'neem');
  iso.box(0.7, 1.72, 0.74, 1.76, z0, z0 + 0.02, mat(C.concrete));
  iso.line([0.72, 1.74, z0 + 0.02], [0.72, 1.74, z0 + 0.08], '#2f6a3a', 2);
  iso.line([0.72, 1.74, z0 + 0.075], [0.69, 1.7, z0 + 0.1], '#2f6a3a', 1.4);
  if (variant === 0) {
    // morning assembly: rows of children in uniform facing the flag
    person(iso, fu - 0.02, fv + 0.16, z0, '#f1ebdd', 0.08, '#6a4a8a');
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 10; c++) {
        const u = 1.02 + c * 0.075 + (rng() - 0.5) * 0.01;
        const v = 1.18 + r * 0.09;
        person(iso, u, v, z0, '#f4f2ec', 0.055, r % 2 ? '#2f4a8a' : '#3a4a6a');
      }
    }
  } else {
    // recess: kids scattered, a cricket game with stumps
    crowd(iso, rng, 0.7, 1.05, 1.85, 1.85, z0, 26, ['#f4f2ec', '#f4f2ec', '#8fb6e0', '#f4f2ec'], 0.055);
    iso.line([1.2, 1.6, z0], [1.2, 1.6, z0 + 0.03], '#f1ebdd', 1);
    iso.line([1.22, 1.6, z0], [1.22, 1.6, z0 + 0.03], '#f1ebdd', 1);
  }
  compoundWall(iso, rng, 0.05, 1.95, z0, 0.08, 0.03, mat(S.wall), mat(S.cap), 'front', { v0: 0.66, v1: 0.96 });
  signboard(iso, rng, 'v', 1.95, 1.05, 1.85, z0 + 0.012, z0 + 0.07, '#f7f2e6', S.dado, 2);
  signboard(iso, rng, 'u', 1.95, 0.3, 1.2, z0 + 0.012, z0 + 0.07, '#f7f2e6', S.dado, 2);
  gatePillars(iso, 0.66, 0.96, 1.95, z0, 0.2, S.wall, S.cap);
  signboard(iso, rng, 'v', 1.95, 0.64, 0.98, z0 + 0.14, z0 + 0.2, S.dado, '#f7f2e6');
  gateBars(iso, 0.66, 0.96, 1.95, z0, 0.08, '#2f3a4a');
}

// ============================================================================
// COLLEGE CAMPUS (3×3)
// ============================================================================

function drawUniversity(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('university', variant);
  const z0 = 0.03;
  const brick = variant === 0;
  const body = brick ? '#a8583c' : '#e0b25a';
  const trim = brick ? '#ecdcb8' : '#f6ecd6';
  slab(iso, rng, 0.03, z0, C.lawn, '#7a6446', []);
  lawn(iso, rng, 0.05, 0.05, 2.95, 2.95, z0, C.lawn);
  const path = '#d8c7a4';
  iso.poly(iso.topQuad(0.2, 1.42, 2.8, 1.62, z0 + 0.002), path);
  iso.poly(iso.topQuad(1.36, 1.5, 1.64, 2.97, z0 + 0.002), path);
  iso.ellipse(1.5, 2.2, z0 + 0.002, 0.42, path);
  iso.ellipse(1.5, 2.2, z0 + 0.003, 0.3, C.lawnDark);
  compoundWall(iso, rng, 0.05, 2.95, z0, 0.07, 0.03, mat(brick ? C.brick : trim), mat(trim), 'back');
  for (const [u, v, s] of [
    [0.2, 0.2, 0.16],
    [1.1, 0.12, 0.12],
    [2.1, 0.14, 0.14],
    [2.82, 0.3, 0.14],
  ] as [number, number, number][]) iso.tree(u, v, z0, s, rng, u > 2 ? 'peepal' : 'neem');
  const H = 0.4;
  const wing = (u0: number, v0: number, u1: number, v1: number, hh: number) => {
    const zr = block(iso, rng, u0, v0, u1, v1, z0, hh, { wall: body, floors: 2, trim, plinth: shade(body, -0.2), arches: true, spacing: 0.12, winW: 0.03, chhajja: false, glass: '#3e3438', roof: shade(body, 0.2) });
    if (brick) {
      coursesV(iso, rng, v1, u0, u1, z0 + 0.03, z0 + hh, 0.025, 0.1, alpha('#e6c7a4', 0.25), 0.5);
      coursesU(iso, rng, u1, v0, v1, z0 + 0.03, z0 + hh, 0.025, 0.1, alpha('#d8b894', 0.2), 0.5);
    }
    // crenellated parapet
    iso.box(u0, v0, u1, v0 + 0.02, zr, zr + 0.03, mat(trim), { edges: false });
    iso.box(u0, v0, u0 + 0.02, v1, zr, zr + 0.03, mat(trim), { edges: false });
    return zr;
  };
  const front = (u0: number, v0: number, u1: number, v1: number, zr: number) => {
    for (let u = u0; u < u1 - 0.02; u += 0.07) iso.box(u, v1 - 0.02, u + 0.035, v1, zr, zr + 0.035, mat(trim), { edges: false });
    for (let v = v0; v < v1 - 0.02; v += 0.07) iso.box(u1 - 0.02, v, u1, v + 0.035, zr, zr + 0.035, mat(trim), { edges: false });
  };
  // main range
  const zm = wing(0.3, 0.4, 2.7, 1.08, H);
  const cu = 1.5;
  const cv = 0.74;
  if (brick) {
    // central dome on a drum with four corner minarets
    iso.lathe(cu, cv, zm, [
      [0, 0.24],
      [0.02, 0.24],
      [0.02, 0.2],
      [0.12, 0.2],
      [0.13, 0.22],
      [0.145, 0.22],
    ], (t) => (t > 0.8 ? trim : body), { outline: true, top: trim, step: 2 });
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (-0.2 + i * 0.18);
      if (Math.cos(a) + Math.sin(a) < 0.1) continue;
      iso.archU(cu + Math.cos(a) * 0.201, cv + Math.sin(a) * 0.201 - 0.02, cv + Math.sin(a) * 0.201 + 0.02, zm + 0.04, zm + 0.1, '#3e3438');
    }
    dome(iso, cu, cv, zm + 0.145, 0.22, '#f3ebdc', 'onion', C.brass);
    for (const [du, dv] of [
      [-0.3, -0.26],
      [0.3, -0.26],
      [-0.3, 0.26],
      [0.3, 0.26],
    ] as [number, number][]) {
      iso.lathe(cu + du, cv + dv, zm, [
        [0, 0.035],
        [0.22, 0.03],
        [0.23, 0.04],
        [0.25, 0.04],
      ], (t) => (t > 0.9 ? trim : body), { outline: true, step: 2 });
      dome(iso, cu + du, cv + dv, zm + 0.25, 0.04, trim, 'onion');
    }
  } else {
    // gothic-style clock tower with a steep spire
    const tw = 0.15;
    const tH = 0.5;
    iso.castShadow([
      [cu - tw, cv - tw],
      [cu + tw, cv - tw],
      [cu + tw, cv + tw],
      [cu - tw, cv + tw],
    ], zm, tH, 0.14);
    iso.box(cu - tw, cv - tw, cu + tw, cv + tw, zm, zm + tH, mat(body));
    for (const zz of [zm + 0.16, zm + 0.42]) {
      iso.poly(iso.faceVQuad(cv + tw, cu - tw, cu + tw, zz - 0.018, zz), trim);
      iso.poly(iso.faceUQuad(cu + tw, cv - tw, cv + tw, zz - 0.018, zz), shade(trim, -0.22));
    }
    iso.archV(cv + tw, cu - 0.05, cu + 0.05, zm + 0.02, zm + 0.14, '#3e3438', true);
    iso.archU(cu + tw, cv - 0.05, cv + 0.05, zm + 0.02, zm + 0.14, '#35313a', true);
    clockFace(iso, 'v', cv + tw, cu, zm + 0.3, 0.075);
    clockFace(iso, 'u', cu + tw, cv, zm + 0.3, 0.075);
    iso.box(cu - tw - 0.02, cv - tw - 0.02, cu + tw + 0.02, cv + tw + 0.02, zm + tH, zm + tH + 0.02, mat(trim));
    iso.squareLathe(cu, cv, zm + tH + 0.02, [
      [0, tw * 0.95],
      [0.05, tw * 0.8],
      [0.3, tw * 0.25],
      [0.36, 0],
    ], (t) => (t < 0.1 ? trim : '#6a6e78'), {});
    for (const [du, dv] of [
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as [number, number][]) iso.lathe(cu + du * tw, cv + dv * tw, zm + tH + 0.02, [
      [0, 0.018],
      [0.08, 0.004],
      [0.09, 0],
    ], () => trim, { outline: true });
  }
  front(0.3, 0.4, 2.7, 1.08, zm);
  // end pavilions and the central porch, projecting forward
  const zl = wing(0.3, 1.08, 0.72, 1.36, H + 0.04);
  front(0.3, 1.08, 0.72, 1.36, zl);
  chhatri(iso, rng, 0.44, 1.15, zl, 0.13, trim, trim);
  const zc = wing(1.22, 1.08, 1.78, 1.42, H + 0.08);
  front(1.22, 1.08, 1.78, 1.42, zc);
  signboard(iso, rng, 'v', 1.42, 1.3, 1.7, zc - 0.07, zc - 0.03, trim, '#4a2a20');
  const zrr = wing(2.28, 1.08, 2.7, 1.36, H + 0.04);
  front(2.28, 1.08, 2.7, 1.36, zrr);
  chhatri(iso, rng, 2.42, 1.15, zrr, 0.13, trim, trim);
  // steps at the porch
  iso.box(1.3, 1.42, 1.7, 1.5, z0, z0 + 0.02, mat('#e3d4b4'));
  // statue on a pedestal in the circle, students, trees along the drive
  iso.box(1.46, 2.16, 1.54, 2.24, z0, z0 + 0.1, mat('#e8e0cc'));
  person(iso, 1.5, 2.2, z0 + 0.1, '#6a6e5a', 0.12, '#5a5e4a');
  crowd(iso, rng, 1.1, 1.52, 1.95, 1.75, z0, 16, ['#f1ebdd', '#3a86c8', '#e4572e', '#f2c14e', '#b44ca0', '#2a2a2e']);
  crowd(iso, rng, 0.4, 1.5, 0.9, 1.62, z0, 5);
  crowd(iso, rng, 2.1, 1.5, 2.6, 1.62, z0, 5);
  for (const v of [1.9, 2.3, 2.7]) {
    iso.tree(1.22, v, z0, 0.07, rng, 'ashoka');
    iso.tree(1.78, v, z0, 0.07, rng, 'ashoka');
  }
  iso.tree(0.45, 2.3, z0, 0.2, rng, 'neem');
  iso.tree(2.55, 2.4, z0, 0.2, rng, 'peepal');
  // cycle stand
  for (let i = 0; i < 6; i++) {
    const u = 2.1 + i * 0.05;
    iso.line([u, 1.72, z0 + 0.02], [u + 0.03, 1.76, z0 + 0.02], i % 2 ? '#2a2a2e' : '#8a2a22', 1.4);
  }
  compoundWall(iso, rng, 0.05, 2.95, z0, 0.07, 0.03, mat(brick ? C.brick : trim), mat(trim), 'front', { v0: 1.3, v1: 1.7 });
  gatePillars(iso, 1.3, 1.7, 2.95, z0, 0.22, brick ? C.brick : body, trim);
  iso.box(1.26, 2.915, 1.74, 2.955, z0 + 0.22, z0 + 0.26, mat(trim));
  signboard(iso, rng, 'v', 2.955, 1.32, 1.68, z0 + 0.222, z0 + 0.258, trim, '#4a2a20');
}

// ============================================================================
// NAGAR NIGAM OFFICE (city_hall, 2×2)
// ============================================================================

function drawCityHall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('city_hall', variant);
  const z0 = 0.03;
  const wall = variant === 0 ? '#ecdcb8' : '#e8cd86';
  const trim = variant === 0 ? C.govMaroon : '#f6ecd6';
  const dark = variant === 0 ? '#3e3438' : '#3a3440';
  slab(iso, rng, 0.03, z0, '#cfc2a4', '#8f8068', ['#bfb294', '#dfd2b4', alpha('#9c8a6a', 0.6)]);
  paving(iso, rng, 0.06, 0.06, 1.94, 1.94, z0, 0.12, 0.12, alpha('#8f8068', 0.3));
  lawn(iso, rng, 0.1, 1.35, 0.66, 1.9, z0, C.lawn);
  lawn(iso, rng, 1.35, 1.35, 1.9, 1.9, z0, C.lawn);
  compoundWall(iso, rng, 0.05, 1.95, z0, 0.08, 0.03, mat(C.cream), mat(C.govMaroon), 'back');
  iso.tree(0.16, 0.2, z0, 0.13, rng, 'peepal');
  iso.tree(1.84, 0.2, z0, 0.12, rng, 'neem');
  const u0 = 0.22;
  const v0 = 0.28;
  const u1 = 1.78;
  const v1 = 0.96;
  const H = 0.38;
  const zr = block(iso, rng, u0, v0, u1, v1, z0, H, { wall, floors: 2, trim, plinth: C.govMaroon, arches: true, spacing: 0.12, winW: 0.03, glass: dark });
  const cu = 1.0;
  const cv = 0.62;
  parapet(iso, u0, v0, u1, v1, zr, 0.035, mat(wall), 'back');
  if (variant === 0) {
    // central clock tower crowned with a chhatri
    const tw = 0.13;
    const tH = 0.42;
    iso.castShadow([
      [cu - tw, cv - tw],
      [cu + tw, cv - tw],
      [cu + tw, cv + tw],
      [cu - tw, cv + tw],
    ], zr, tH, 0.14);
    iso.box(cu - tw, cv - tw, cu + tw, cv + tw, zr, zr + tH, mat(wall));
    iso.poly(iso.faceVQuad(cv + tw, cu - tw, cu + tw, zr + 0.18, zr + 0.2), trim);
    iso.poly(iso.faceUQuad(cu + tw, cv - tw, cv + tw, zr + 0.18, zr + 0.2), shade(trim, -0.28));
    iso.archV(cv + tw, cu - 0.04, cu + 0.04, zr + 0.03, zr + 0.15, dark, true);
    iso.archU(cu + tw, cv - 0.04, cv + 0.04, zr + 0.03, zr + 0.15, dark, true);
    clockFace(iso, 'v', cv + tw, cu, zr + 0.3, 0.07);
    clockFace(iso, 'u', cu + tw, cv, zr + 0.3, 0.07);
    iso.box(cu - tw - 0.02, cv - tw - 0.02, cu + tw + 0.02, cv + tw + 0.02, zr + tH, zr + tH + 0.02, mat(trim));
    chhatri(iso, rng, cu - 0.1, cv - 0.1, zr + tH + 0.02, 0.2, C.cream, C.cream);
    tricolour(iso, cu, cv, zr + tH + 0.4, 0.2);
  } else {
    // central dome on a drum
    iso.lathe(cu, cv, zr, [
      [0, 0.22],
      [0.1, 0.2],
      [0.11, 0.22],
      [0.125, 0.22],
    ], (t) => (t > 0.8 ? trim : wall), { outline: true, top: trim, step: 2 });
    dome(iso, cu, cv, zr + 0.125, 0.2, '#f4ecdc', 'round', C.brass);
    tricolour(iso, cu, cv, zr + 0.34, 0.2);
    for (const cuu of [0.4, 1.6]) chhatri(iso, rng, cuu - 0.06, 0.4, zr, 0.12, trim, trim);
  }
  sintex(iso, 1.6, 0.8, zr, 0.04);
  parapet(iso, u0, v0, u1, v1, zr, 0.035, mat(wall), 'front');
  // central projecting porch with an arcade and name board
  const pu0 = 0.72;
  const pu1 = 1.28;
  const pv1 = 1.2;
  const zp = block(iso, rng, pu0, v1, pu1, pv1, z0, H + 0.08, { wall, floors: 2, trim, plinth: C.govMaroon, arches: true, spacing: 0.14, glass: dark, skip: (f, _a, fl) => fl === 0 });
  arcade(iso, 'v', pv1, pu0 + 0.02, pu1 - 0.02, z0 + 0.02, z0 + 0.19, 3, trim, '#2e2628');
  arcade(iso, 'u', pu1, v1 + 0.02, pv1 - 0.02, z0 + 0.02, z0 + 0.19, 1, trim, '#2e2628');
  signboard(iso, rng, 'v', pv1, pu0 + 0.05, pu1 - 0.05, zp - 0.075, zp - 0.02, C.govMaroon, '#f6efe0', 2);
  // pediment
  iso.poly([
    [pu0, pv1, zp],
    [pu1, pv1, zp],
    [(pu0 + pu1) / 2, pv1, zp + 0.09],
  ], wall, alpha('#3a2a20', 0.6), 1);
  iso.poly([
    [pu0 + 0.05, pv1 + 0.001, zp + 0.01],
    [pu1 - 0.05, pv1 + 0.001, zp + 0.01],
    [(pu0 + pu1) / 2, pv1 + 0.001, zp + 0.075],
  ], trim);
  iso.box(pu0 - 0.04, pv1, pu1 + 0.04, pv1 + 0.1, z0, z0 + 0.025, mat('#e3d4b4'));
  // cars, petitioners, trees
  vehicle(iso, 0.3, 1.18, z0, 'u', 'car', '#f2f0ea');
  vehicle(iso, 0.3, 1.28, z0, 'u', 'car', '#2a2a2e');
  vehicle(iso, 1.46, 1.16, z0, 'u', 'car', '#f2f0ea');
  crowd(iso, rng, 0.7, 1.32, 1.35, 1.6, z0, 16);
  iso.tree(0.3, 1.7, z0, 0.14, rng, 'neem');
  iso.tree(1.72, 1.66, z0, 0.13, rng, 'ashoka');
  compoundWall(iso, rng, 0.05, 1.95, z0, 0.08, 0.03, mat(C.cream), mat(C.govMaroon), 'front', { v0: 0.78, v1: 1.22 });
  signboard(iso, rng, 'v', 1.95, 0.12, 0.7, z0 + 0.012, z0 + 0.07, '#f6efe0', C.govMaroon, 2);
  gatePillars(iso, 0.78, 1.22, 1.95, z0, 0.18, C.cream, C.govMaroon);
  gateBars(iso, 0.78, 1.22, 1.95, z0, 0.09, '#2f3a4a');
}

// ============================================================================
// METRO ENTRANCE (subway_station, 1×1)
// ============================================================================

function metroSign(iso: Iso, u: number, v: number, z: number, h: number): void {
  iso.line([u, v, z], [u, v, z + h], alpha('#2a2a2e', 0.8), 2.4);
  iso.line([u, v, z], [u, v, z + h], '#9aa0a6', 1.3);
  const s = 0.035;
  iso.box(u - s, v - s, u + s, v + s, z + h, z + h + 0.07, mat('#1f5fb8', { top: 0.2 }));
  // stylised "M" chevrons on both faces
  const zz = z + h + 0.015;
  iso.polyline([
    [u - s * 0.6, v + s + 0.001, zz],
    [u - s * 0.6, v + s + 0.001, zz + 0.04],
    [u, v + s + 0.001, zz + 0.015],
    [u + s * 0.6, v + s + 0.001, zz + 0.04],
    [u + s * 0.6, v + s + 0.001, zz],
  ], '#f4f4f0', 1.4);
  iso.polyline([
    [u + s + 0.001, v - s * 0.6, zz],
    [u + s + 0.001, v - s * 0.6, zz + 0.04],
    [u + s + 0.001, v, zz + 0.015],
    [u + s + 0.001, v + s * 0.6, zz + 0.04],
    [u + s + 0.001, v + s * 0.6, zz],
  ], '#d8d8d4', 1.4);
}

/** Vaulted polycarbonate roof along `along` spanning the rectangle, springing at z. */
function vault(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, rise: number, along: 'u' | 'v', color: string): void {
  const N = 10;
  for (let i = 0; i < N; i++) {
    const t0 = i / N;
    const t1 = (i + 1) / N;
    const z0 = z + Math.sin(t0 * Math.PI) * rise;
    const z1 = z + Math.sin(t1 * Math.PI) * rise;
    const lit = Math.cos(((t0 + t1) / 2) * Math.PI);
    const c = shade(color, along === 'v' ? lit * -0.2 + 0.05 : lit * 0.15);
    const pts: P3[] = along === 'v' ? [
      [u0 + (u1 - u0) * t0, v0, z0],
      [u0 + (u1 - u0) * t1, v0, z1],
      [u0 + (u1 - u0) * t1, v1, z1],
      [u0 + (u1 - u0) * t0, v1, z0],
    ] : [
      [u0, v0 + (v1 - v0) * t0, z0],
      [u1, v0 + (v1 - v0) * t0, z0],
      [u1, v0 + (v1 - v0) * t1, z1],
      [u0, v0 + (v1 - v0) * t1, z1],
    ];
    iso.poly(pts, c);
  }
  // end arch rib and ridge
  const rib: P3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    rib.push(along === 'v' ? [u0 + (u1 - u0) * t, v1, z + Math.sin(t * Math.PI) * rise] : [u1, v0 + (v1 - v0) * t, z + Math.sin(t * Math.PI) * rise]);
  }
  iso.polyline(rib, '#5a6068', 1.6);
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    if (along === 'v') iso.line([u0 + (u1 - u0) * 0.5, v0 + (v1 - v0) * t, z + rise], [u0 + (u1 - u0) * 0.5, v0 + (v1 - v0) * t, z + rise], '#5a6068', 1);
  }
  if (along === 'v') iso.line([(u0 + u1) / 2, v0, z + rise], [(u0 + u1) / 2, v1, z + rise], alpha('#f4f8fc', 0.6), 1);
  else iso.line([u0, (v0 + v1) / 2, z + rise], [u1, (v0 + v1) / 2, z + rise], alpha('#f4f8fc', 0.6), 1);
}

function drawSubwayStation(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('subway_station', variant);
  const z0 = 0.02;
  slab(iso, rng, 0.02, z0, '#c3bab2', '#8a827a', ['#b3aaa2', '#d3cac2', alpha('#9a7a7a', 0.5)]);
  // pink-and-grey granite plaza
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i + j) % 3 === 0) iso.poly(iso.topQuad(0.05 + i * 0.1, 0.05 + j * 0.1, 0.15 + i * 0.1, 0.15 + j * 0.1, z0 + 0.001), alpha('#b88f8a', 0.35));
  paving(iso, rng, 0.05, 0.05, 0.95, 0.95, z0 + 0.001, 0.1, 0.1, alpha('#6a625a', 0.3));
  // planters
  const planter = (u: number, v: number) => {
    iso.box(u, v, u + 0.1, v + 0.1, z0, z0 + 0.04, mat('#8a8680'));
    iso.poly(iso.topQuad(u + 0.01, v + 0.01, u + 0.09, v + 0.09, z0 + 0.041), '#5a4a38');
    iso.tree(u + 0.05, v + 0.05, z0 + 0.04, 0.05, rng, 'shrub');
  };
  if (variant === 0) {
    planter(0.08, 0.08);
    // glass lift kiosk (back-right)
    const lu0 = 0.72;
    const lv0 = 0.1;
    iso.aoRect(lu0, lv0, lu0 + 0.16, lv0 + 0.16, z0, 0.04, 0.4);
    iso.box(lu0, lv0, lu0 + 0.16, lv0 + 0.16, z0, z0 + 0.26, { top: '#8a9aa6', left: alpha('#8fc0dc', 0.55), right: alpha('#5f8aa6', 0.6), line: '#4a5058' });
    iso.box(lu0 - 0.01, lv0 - 0.01, lu0 + 0.17, lv0 + 0.17, z0 + 0.26, z0 + 0.285, mat('#d8dcdf'));
    iso.box(lu0 + 0.04, lv0 + 0.04, lu0 + 0.12, lv0 + 0.12, z0, z0 + 0.12, mat('#5a6068'));
    // stair pit going down (towards the back)
    const su0 = 0.3;
    const su1 = 0.62;
    const sv0 = 0.2;
    const sv1 = 0.74;
    const pit = iso.topQuad(su0, sv0, su1, sv1, z0);
    iso.clipped(pit, () => {
      iso.poly(pit, '#2a2a30');
      iso.poly(iso.faceUQuad(su0, sv0, sv1, z0 - 0.4, z0), '#8e8a86');
      iso.poly(iso.faceVQuad(sv0, su0, su1, z0 - 0.4, z0), '#b8b2aa');
      const n = 12;
      for (let k = 0; k < n; k++) {
        const va = sv0 + ((sv1 - sv0) * k) / n;
        const zt = z0 - 0.3 * (1 - (k + 1) / n);
        iso.box(su0, va, su1, va + (sv1 - sv0) / n, zt - 0.03, zt, { top: k % 2 ? '#c8c2ba' : '#bdb7af', left: '#8a857e', right: '#7a756e', line: alpha('#3a3632', 0.4) });
        iso.line([su0, va + (sv1 - sv0) / n, zt], [su1, va + (sv1 - sv0) / n, zt], alpha('#e8c22a', 0.7), 0.8);
      }
      iso.line([su0 + 0.02, sv0, z0 - 0.3], [su0 + 0.02, sv1, z0 + 0.04], '#c8ccd0', 1.2);
      iso.line([su1 - 0.02, sv0, z0 - 0.3], [su1 - 0.02, sv1, z0 + 0.04], '#c8ccd0', 1.2);
    });
    // glass balustrades
    const glassM = { top: '#c8d4dc', left: alpha('#a8d0e8', 0.45), right: alpha('#7aa8c8', 0.5), line: '#6a7078' };
    iso.box(su0 - 0.02, sv0 - 0.02, su1 + 0.02, sv0, z0, z0 + 0.06, glassM);
    iso.box(su0 - 0.02, sv0, su0, sv1, z0, z0 + 0.06, glassM);
    // canopy: steel posts + vault
    const zc = z0 + 0.2;
    for (const [pu, pv] of [
      [su0 - 0.01, sv0 - 0.01],
      [su1 + 0.01, sv0 - 0.01],
    ] as [number, number][]) iso.line([pu, pv, z0], [pu, pv, zc], '#6a7078', 1.8);
    iso.box(su1, sv0, su1 + 0.02, sv1, z0, z0 + 0.06, glassM);
    for (const [pu, pv] of [
      [su0 - 0.01, sv1 + 0.01],
      [su1 + 0.01, sv1 + 0.01],
    ] as [number, number][]) iso.line([pu, pv, z0], [pu, pv, zc], '#6a7078', 1.8);
    vault(iso, su0 - 0.04, sv0 - 0.04, su1 + 0.04, sv1 + 0.06, zc, 0.07, 'v', alpha('#9fc4d8', 0.85));
    metroSign(iso, 0.82, 0.8, z0, 0.26);
    vehicle(iso, 0.66, 0.36, z0, 'v', 'auto', '#2f9a5a', '#1f6a3a');
    crowd(iso, rng, 0.08, 0.72, 0.6, 0.94, z0, 7);
    planter(0.08, 0.3);
  } else {
    // enclosed entry building with a vaulted metal roof and a big glass front
    const bu0 = 0.14;
    const bv0 = 0.12;
    const bu1 = 0.76;
    const bv1 = 0.56;
    const H = 0.2;
    iso.aoRect(bu0, bv0, bu1, bv1, z0, 0.06, 0.42);
    iso.castShadow([
      [bu0, bv0],
      [bu1, bv0],
      [bu1, bv1],
      [bu0, bv1],
    ], z0, H + 0.08, 0.15);
    iso.box(bu0, bv0, bu1, bv1, z0, z0 + H, mat('#d8d4ce'));
    // curtain wall on the lit face
    iso.poly(iso.faceVQuad(bv1 + 0.001, bu0 + 0.03, bu1 - 0.03, z0 + 0.01, z0 + H - 0.03), '#4a7a9a');
    iso.clipped(iso.faceVQuad(bv1 + 0.001, bu0 + 0.03, bu1 - 0.03, z0 + 0.01, z0 + H - 0.03), () => {
      const g = iso.ctx.createLinearGradient(...iso.pt(bu0, bv1, z0 + H), ...iso.pt(bu1, bv1, z0));
      g.addColorStop(0, alpha('#d8f0ff', 0.55));
      g.addColorStop(0.5, alpha('#d8f0ff', 0));
      g.addColorStop(1, alpha('#d8f0ff', 0.25));
      iso.poly(iso.faceVQuad(bv1 + 0.002, bu0, bu1, z0, z0 + H), g);
      for (let u = bu0 + 0.03; u < bu1; u += 0.06) iso.line([u, bv1 + 0.003, z0], [u, bv1 + 0.003, z0 + H], '#c8ccd0', 1);
      iso.line([bu0, bv1 + 0.003, z0 + 0.1], [bu1, bv1 + 0.003, z0 + 0.1], '#c8ccd0', 1);
    });
    iso.poly(iso.faceVQuad(bv1 + 0.003, 0.36, 0.52, z0, z0 + 0.09), '#1e2a36');
    // ACP band with the sign
    iso.poly(iso.faceUQuad(bu1, bv0, bv1, z0 + H - 0.05, z0 + H), '#8a2a6a');
    signboard(iso, rng, 'v', bv1, bu0 + 0.02, bu1 - 0.02, z0 + H - 0.045, z0 + H - 0.005, '#b0327e', '#f8f4f0');
    for (let v = bv0 + 0.05; v < bv1 - 0.03; v += 0.09) iso.poly(iso.faceUQuad(bu1 + 0.001, v, v + 0.05, z0 + 0.06, z0 + 0.13), '#3a5a72');
    grime(iso, bu0, bv0, bu1, bv1, z0, 0.04, 0.18);
    vault(iso, bu0 - 0.03, bv0 - 0.02, bu1 + 0.03, bv1 + 0.03, z0 + H, 0.08, 'u', '#b8c0c8');
    metroSign(iso, 0.86, 0.66, z0, 0.26);
    planter(0.08, 0.8);
    vehicle(iso, 0.62, 0.72, z0, 'u', 'auto', '#2f9a5a', '#1f6a3a');
    vehicle(iso, 0.44, 0.84, z0, 'u', 'auto', AUTO_YELLOW);
    crowd(iso, rng, 0.2, 0.6, 0.6, 0.78, z0, 8);
  }
}

// ============================================================================
// RAILWAY STATION (2×2)
// ============================================================================

function drawRailStation(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('rail_station', variant);
  const z0 = 0.03;
  const red = '#b0472f';
  const cream = '#efe0bf';
  const wall = variant === 0 ? red : cream;
  const trim = variant === 0 ? cream : red;
  slab(iso, rng, 0.03, z0, '#b8aa90', '#857660', ['#a89a80', '#c8baa0', alpha('#7e9a4c', 0.4)]);
  // forecourt paving
  iso.poly(iso.topQuad(0.05, 1.3, 1.1, 1.95, z0 + 0.001), '#b4ab9c');
  paving(iso, rng, 0.05, 1.3, 1.1, 1.95, z0 + 0.001, 0.12, 0.12, alpha('#6d665c', 0.3));
  // station building (back-left)
  const bu0 = 0.1;
  const bv0 = 0.18;
  const bu1 = 1.05;
  const bv1 = 1.26;
  const H = variant === 0 ? 0.36 : 0.44;
  iso.tree(0.14, 0.08, z0, 0.1, rng, 'neem');
  const zr = block(iso, rng, bu0, bv0, bu1, bv1, z0, H, {
    wall, floors: 2, trim, plinth: shade(wall, -0.25), arches: true, spacing: 0.12, winW: 0.03, glass: '#3a3034', chhajja: false,
    skip: (f, a, fl) => f === 'v' && fl === 0 && a > 0.35 && a < 0.8,
  });
  roofWithParapet(iso, bu0, bv0, bu1, bv1, zr, trim, () => {
    sintex(iso, 0.3, 0.35, zr, 0.045);
    sintex(iso, 0.45, 0.35, zr, 0.045);
    iso.box(0.7, 0.3, 0.9, 0.5, zr, zr + 0.06, mat(wall));
  });
  // entrance porch with arches and the station clock
  const pu0 = 0.34;
  const pu1 = 0.82;
  const pv1 = 1.46;
  const zp = block(iso, rng, pu0, bv1, pu1, pv1, z0, 0.26, { wall: trim, floors: 1, trim: wall, plinth: shade(wall, -0.25), spacing: 0.3, skip: () => true });
  arcade(iso, 'v', pv1, pu0 + 0.02, pu1 - 0.02, z0 + 0.02, z0 + 0.2, 3, wall, '#2e2628');
  arcade(iso, 'u', pu1, bv1 + 0.02, pv1 - 0.02, z0 + 0.02, z0 + 0.2, 1, wall, '#2e2628');
  parapet(iso, pu0, bv1, pu1, pv1, zp, 0.03, mat(trim), 'front');
  // gable with a clock, rooftop name board (yellow Indian Railways board)
  const gc = (pu0 + pu1) / 2;
  iso.poly([
    [pu0 + 0.04, pv1, zp],
    [pu1 - 0.04, pv1, zp],
    [pu1 - 0.04, pv1, zp + 0.06],
    [gc, pv1, zp + 0.13],
    [pu0 + 0.04, pv1, zp + 0.06],
  ], trim, alpha('#3a2a20', 0.6), 1);
  clockFace(iso, 'v', pv1, gc, zp + 0.065, 0.035);
  iso.line([0.2, bv1 - 0.04, zr], [0.2, bv1 - 0.04, zr + 0.07], '#3a3a3e', 1.2);
  iso.line([0.3, bv1 - 0.04, zr], [0.3, bv1 - 0.04, zr + 0.07], '#3a3a3e', 1.2);
  signboard(iso, rng, 'v', bv1 - 0.04, 0.14, 0.34, zr + 0.05, zr + 0.11, '#f2c81e', '#1a1a1a');
  // platform with canopy
  const plu0 = 1.1;
  const plu1 = 1.48;
  iso.box(plu0, 0.06, plu1, 1.94, z0, z0 + 0.05, mat('#bdb6a8'));
  iso.poly(iso.topQuad(plu1 - 0.03, 0.06, plu1, 1.94, z0 + 0.05), '#e8c22a');
  iso.speckle(iso.topQuad(plu0, 0.06, plu1, 1.94, z0 + 0.05), rng, 400, [alpha('#8f887c', 0.5), alpha('#e0dace', 0.5)], 1.4);
  const zpl = z0 + 0.05;
  crowd(iso, rng, plu0 + 0.05, 0.2, plu1 - 0.06, 1.5, zpl, 22, ['#e4572e', '#f2c14e', '#3a86c8', '#f1ebdd', '#b44ca0', '#c0392b', '#2a2a2e']);
  const cu = (plu0 + plu1) / 2;
  const zc = zpl + 0.2;
  for (let v = 0.2; v <= 1.45; v += 0.25) {
    iso.box(cu - 0.012, v, cu + 0.012, v + 0.024, zpl, zc, mat(red));
    iso.box(cu - 0.013, v - 0.001, cu + 0.013, v + 0.025, zpl, zpl + 0.03, mat(cream), { edges: false });
  }
  const roof: P3[] = [
    [plu0 - 0.02, 0.12, zc + 0.03],
    [plu1 + 0.03, 0.12, zc - 0.01],
    [plu1 + 0.03, 1.55, zc - 0.01],
    [plu0 - 0.02, 1.55, zc + 0.03],
  ];
  iso.poly([
    [plu0 - 0.02, 1.55, zc + 0.03],
    [plu1 + 0.03, 1.55, zc - 0.01],
    [plu1 + 0.03, 1.55, zc - 0.025],
    [plu0 - 0.02, 1.55, zc + 0.015],
  ], shade('#6d7f76', -0.2));
  iso.poly([
    [plu1 + 0.03, 0.12, zc - 0.01],
    [plu1 + 0.03, 1.55, zc - 0.01],
    [plu1 + 0.03, 1.55, zc - 0.025],
    [plu1 + 0.03, 0.12, zc - 0.025],
  ], cream);
  iso.poly(roof, '#7a8d82', alpha('#2a3430', 0.6), 1);
  iso.clipped(roof, () => {
    for (let v = 0.13; v < 1.55; v += 0.025) iso.line([plu0 - 0.02, v, zc + 0.03], [plu1 + 0.03, v, zc - 0.01], alpha('#4a5a52', 0.5), 0.7);
    iso.speckle(roof, rng, 120, [alpha('#94532f', 0.4), alpha('#c8d4cc', 0.4)], 1.6);
  });
  // yellow station name board at the open end of the platform
  const bvb = 1.66;
  iso.line([cu, bvb, zpl], [cu, bvb, zpl + 0.13], '#2a2a2e', 1.4);
  iso.line([cu, bvb + 0.2, zpl], [cu, bvb + 0.2, zpl + 0.13], '#2a2a2e', 1.4);
  signboard(iso, rng, 'u', cu, bvb - 0.02, bvb + 0.22, zpl + 0.08, zpl + 0.15, '#ffd21e', '#141414', 2);
  person(iso, cu - 0.08, 1.8, zpl, '#c0392b');
  // tracks, overhead electrification and a train
  const t1 = 1.63;
  const t2 = 1.85;
  trackV(iso, rng, t1, 0.03, 1.97, z0);
  if (variant === 1) trackV(iso, rng, t2, 0.03, 1.97, z0);
  const coach = (uc: number, va: number, vb: number, color: string, band: string) => {
    const W = 0.065;
    iso.aoRect(uc - W, va, uc + W, vb, z0 + 0.012, 0.03, 0.4);
    iso.box(uc - W, va, uc + W, vb, z0 + 0.03, z0 + 0.15, mat(color, { top: 0.1 }));
    iso.poly(iso.faceUQuad(uc + W + 0.001, va, vb, z0 + 0.09, z0 + 0.125), shade(band, -0.26));
    for (let v = va + 0.02; v < vb - 0.03; v += 0.045) iso.poly(iso.faceUQuad(uc + W + 0.002, v, v + 0.028, z0 + 0.095, z0 + 0.12), '#23262e');
    iso.poly(iso.faceVQuad(vb, uc - W, uc + W, z0 + 0.03, z0 + 0.15), shade(color, 0.02));
    iso.poly(iso.faceVQuad(vb + 0.001, uc - 0.02, uc + 0.02, z0 + 0.04, z0 + 0.13), '#23262e');
    iso.poly(iso.topQuad(uc - W + 0.01, va + 0.01, uc + W - 0.01, vb - 0.01, z0 + 0.158), '#8a8e94', alpha('#2a2a2e', 0.4), 0.8);
    for (let v = va + 0.1; v < vb - 0.05; v += 0.16) iso.box(uc - 0.02, v, uc + 0.02, v + 0.04, z0 + 0.158, z0 + 0.172, mat('#a8acb0'), { edges: false });
  };
  if (variant === 0) {
    coach(t1, 0.05, 0.82, '#2c4d8e', '#e8dcb8');
    coach(t1, 0.86, 1.62, '#2c4d8e', '#e8dcb8');
  } else {
    // electric loco on the far track
    const lu = t2;
    iso.aoRect(lu - 0.065, 0.5, lu + 0.065, 1.0, z0 + 0.012, 0.03, 0.4);
    iso.box(lu - 0.065, 0.5, lu + 0.065, 1.0, z0 + 0.03, z0 + 0.16, mat('#b8322a', { top: 0.1 }));
    iso.poly(iso.faceUQuad(lu + 0.066, 0.5, 1.0, z0 + 0.06, z0 + 0.075), '#e8e4dc');
    iso.poly(iso.faceVQuad(1.001, lu - 0.05, lu + 0.05, z0 + 0.1, z0 + 0.14), '#23262e');
    iso.poly(iso.faceVQuad(1.001, lu - 0.065, lu + 0.065, z0 + 0.06, z0 + 0.075), '#f2c81e');
    iso.polyline([
      [lu, 0.62, z0 + 0.16],
      [lu - 0.03, 0.66, z0 + 0.22],
      [lu, 0.7, z0 + 0.26],
    ], '#3a3a3e', 1.2);
  }
  // catenary masts with the contact wire
  const cz = z0 + 0.32;
  for (const v of [0.15, 0.95, 1.75]) {
    iso.line([1.96, v, z0], [1.96, v, cz + 0.02], '#5a6068', 2);
    iso.line([1.96, v, cz], [t1 - 0.03, v, cz], '#5a6068', 1.2);
  }
  iso.line([t1, 0.03, cz - 0.03], [t1, 1.97, cz - 0.03], alpha('#2a2a2e', 0.7), 0.8);
  if (variant === 1) iso.line([t2, 0.03, cz - 0.03], [t2, 1.97, cz - 0.03], alpha('#2a2a2e', 0.7), 0.8);
  // forecourt: autos, rickshaw queue, travellers with luggage
  vehicle(iso, 0.12, 1.55, z0, 'u', 'auto', AUTO_YELLOW);
  vehicle(iso, 0.12, 1.66, z0, 'u', 'auto', '#2f9a5a', '#1f6a3a');
  vehicle(iso, 0.12, 1.77, z0, 'u', 'auto', AUTO_YELLOW);
  crowd(iso, rng, 0.35, 1.5, 0.95, 1.9, z0, 16);
  for (let i = 0; i < 3; i++) iso.box(0.5 + i * 0.12, 1.62 + (i % 2) * 0.1, 0.53 + i * 0.12, 1.645 + (i % 2) * 0.1, z0, z0 + 0.03, mat(['#6a2a2a', '#2a3a6a', '#3a3a3a'][i]), { edges: false });
  iso.tree(0.98, 1.86, z0, 0.1, rng, 'neem');
}

// ============================================================================
// COMMUNITY HALL / BARAT GHAR (1×1)
// ============================================================================

function drawCommunityCenter(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('community_center', variant);
  const z0 = 0.02;
  const wall = variant === 0 ? '#e9a597' : '#ead46e';
  const trim = variant === 0 ? '#f6ecd8' : '#2f8a6a';
  slab(iso, rng, 0.02, z0, '#c6ae8c', '#8a7050', ['#b69e7c', '#d6be9c', alpha('#7e9a4c', 0.5)]);
  compoundWall(iso, rng, 0.04, 0.96, z0, 0.05, 0.018, mat(wall), mat(trim), 'back');
  const u0 = 0.08;
  const v0 = 0.08;
  const u1 = variant === 0 ? 0.62 : 0.7;
  const v1 = variant === 0 ? 0.48 : 0.52;
  const H = variant === 0 ? 0.26 : 0.3;
  const door = (u0 + u1) / 2;
  const zr = block(iso, rng, u0, v0, u1, v1, z0, H, {
    wall, floors: 1, trim, plinth: shade(wall, -0.3), arches: true, spacing: 0.1, winW: 0.028, chhajja: false, glass: '#3a2e34',
    skip: (f, a) => f === 'v' && Math.abs(a - door) < 0.07,
  });
  iso.archV(v1, door - 0.05, door + 0.05, z0, z0 + 0.19, trim, true);
  iso.archV(v1, door - 0.042, door + 0.042, z0, z0 + 0.18, '#5a2e22', true);
  signboard(iso, rng, 'v', v1, u0 + 0.05, u1 - 0.05, z0 + H - 0.055, z0 + H - 0.012, variant === 0 ? '#2f7a4a' : '#b8322a', '#fff4d8');
  garland(iso, [door - 0.06, v1 + 0.004, z0 + 0.19], [door + 0.06, v1 + 0.004, z0 + 0.19], MARIGOLD, 0.03, 12);
  for (const a of [u0 + 0.06, u1 - 0.06]) iso.line([a, v1 + 0.003, z0 + H - 0.06], [a, v1 + 0.003, z0 + 0.02], '#f5a623', 1.6);
  roofWithParapet(iso, u0, v0, u1, v1, zr, wall, () => {
    sintex(iso, 0.2, 0.2, zr, 0.04);
    if (variant === 1) shamiana(iso, u0 + 0.25, v0 + 0.08, u1 - 0.06, v1 - 0.08, zr, 0.08, ['#f4efe2', '#2f8a6a']);
  });
  // decorative corner domes and fairy lights
  for (const [du, dv] of [
    [u1 - 0.03, v1 - 0.03],
    [u0 + 0.03, v1 - 0.03],
    [u1 - 0.03, v0 + 0.03],
  ] as [number, number][]) {
    iso.box(du - 0.022, dv - 0.022, du + 0.022, dv + 0.022, zr + 0.035, zr + 0.05, mat(trim));
    dome(iso, du, dv, zr + 0.05, 0.022, trim, 'onion');
  }
  garland(iso, [u0, v1 + 0.002, zr + 0.03], [u1, v1 + 0.002, zr + 0.03], FAIRY, 0.015, 22);
  garland(iso, [u1 + 0.002, v0, zr + 0.03], [u1 + 0.002, v1, zr + 0.03], FAIRY, 0.015, 16);
  if (variant === 0) {
    // wedding shamiana with rows of plastic chairs
    const su0 = 0.1;
    const sv0 = 0.56;
    const su1 = 0.86;
    const sv1 = 0.9;
    iso.poly(iso.topQuad(su0, sv0, su1, sv1, z0 + 0.001), '#b8322a');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) chair(iso, su0 + 0.08 + c * 0.09, sv0 + 0.06 + r * 0.09, z0, c % 3 === 0 ? '#c8282a' : '#e8e4dc');
    crowd(iso, rng, su0 + 0.05, sv0 + 0.05, su1 - 0.05, sv1 - 0.05, z0, 6);
    shamiana(iso, su0, sv0, su1, sv1, z0, 0.16, ['#d42a2a', '#f5c23a', '#f4efe2', '#d42a2a', '#2a8a4a']);
    iso.tree(0.86, 0.16, z0, 0.1, rng, 'ashoka');
  } else {
    // festive entry arch of marigolds, cooking area with big degchi pots
    for (let i = 0; i < 3; i++) {
      const pu = 0.78 + (i % 2) * 0.08;
      const pv = 0.2 + i * 0.1;
      iso.box(pu, pv, pu + 0.05, pv + 0.05, z0, z0 + 0.025, mat(C.brick), { edges: false });
      iso.ellipse(pu + 0.025, pv + 0.025, z0 + 0.01, 0.02, alpha('#ff7a1a', 0.8));
      drum(iso, pu + 0.025, pv + 0.025, z0 + 0.025, 0.03, 0.04, C.brass);
    }
    person(iso, 0.8, 0.52, z0, '#f1ebdd');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) chair(iso, 0.14 + c * 0.1, 0.6 + r * 0.08, z0, '#e8e4dc');
    crowd(iso, rng, 0.12, 0.66, 0.7, 0.84, z0, 8);
    const au = 0.62;
    const av = 0.88;
    for (const a of [au - 0.14, au + 0.1]) {
      iso.box(a, av, a + 0.04, av + 0.04, z0, z0 + 0.2, mat('#f5a623'));
      iso.speckle(iso.faceVQuad(av + 0.04, a, a + 0.04, z0, z0 + 0.2), rng, 30, ['#e0761a', '#ffd24a', '#c8282a'], 1.6);
    }
    const arch: P3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      arch.push([au - 0.12 + t * 0.24, av + 0.02, z0 + 0.2 + Math.sin(t * Math.PI) * 0.06]);
    }
    iso.polyline(arch, '#e0761a', 5);
    iso.polyline(arch, '#f5c23a', 2.4);
    garland(iso, [au - 0.12, av + 0.022, z0 + 0.19], [au + 0.12, av + 0.022, z0 + 0.19], FAIRY, 0.02, 14);
  }
  compoundWall(iso, rng, 0.04, 0.96, z0, 0.05, 0.018, mat(wall), mat(trim), 'front', { v0: 0.44, v1: 0.72 });
  gatePillars(iso, 0.44, 0.72, 0.96, z0, 0.09, wall, trim);
  garland(iso, [0.41, 0.95, z0 + 0.1], [0.75, 0.95, z0 + 0.1], MARIGOLD, 0.04, 16);
}

export const SERVICES_SPRITES: Record<string, ProceduralSpriteDef> = {
  police_station: { footprint: 1, variants: 3, heightTiles: 0.3, draw: drawPoliceStation },
  fire_station: { footprint: 1, variants: 2, heightTiles: 0.4, draw: drawFireStation },
  hospital: { footprint: 2, variants: 2, heightTiles: 0.4, draw: drawHospital },
  school: { footprint: 2, variants: 2, heightTiles: 0.2, draw: drawSchool },
  university: { footprint: 3, variants: 2, heightTiles: 0.36, draw: drawUniversity },
  city_hall: { footprint: 2, variants: 2, heightTiles: 0.5, draw: drawCityHall },
  subway_station: { footprint: 1, variants: 2, heightTiles: 0.25, draw: drawSubwayStation },
  rail_station: { footprint: 2, variants: 2, heightTiles: 0.3, draw: drawRailStation },
  community_center: { footprint: 1, variants: 2, heightTiles: 0.2, draw: drawCommunityCenter },
};
