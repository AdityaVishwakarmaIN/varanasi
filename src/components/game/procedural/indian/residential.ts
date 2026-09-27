/**
 * Indian-style procedural art: residential buildings.
 * See ./index.ts for the drawing contract.
 *
 *   house_small    1–2 storey pastel plaster home: mumty, Sintex tank, laundry, low gate wall
 *   house_medium   3-storey narrow Banarasi townhouse: jharokhas, balconies, shop shutter below
 *   mansion        haveli / kothi around a courtyard: arcades, chhatris, garden and gate
 *   apartment_low  4-storey DDA-style block: balconies, grille cages, dishes, AC boxes, parking
 *   apartment_high 12-storey group-housing tower on stilts: service shaft, crown, society gate
 *   cabin_house    village mud hut: thatch or khaprail tiles, hand pump, cow, chulha, haystack
 */
import { alpha, mat, seededRng, shade, type Ctx2D, type Iso, type P3 } from '../isoPainter';
import {
  C,
  charpai,
  chhatri,
  clothesLine,
  coursesU,
  coursesV,
  dome,
  drum,
  flag,
  grime,
  jharokha,
  lawn,
  makeIso,
  paving,
  slab,
  weatherU,
  weatherV,
  type ProceduralSpriteDef,
} from '../varanasiSprites';
import type { Rng } from '@/lib/rng';
import {
  LAUNDRY,
  PASTEL,
  acU,
  acV,
  balconyU,
  balconyV,
  car,
  dish,
  doorU,
  doorV,
  downpipeU,
  garlandV,
  mumty,
  parapet,
  plasterBox,
  pot,
  rebar,
  scooter,
  shutterV,
  sintex,
  terrace,
  winU,
  winV,
  wires,
} from './residentialKit';

const GROUND_GRAIN = ['#a8916e', '#c4ae8a', '#9c8664', alpha('#6c7a3a', 0.5)] as const;

/** Low boundary wall along the two front edges of a 1×1/2×2 plot with a gate gap on the +v side. */
function frontWall(iso: Iso, rng: Rng, lo: number, hi: number, z: number, h: number, color: string, cap: string, gate: [number, number], gateColor: string): void {
  const t = 0.022;
  const m = mat(color, { right: -0.3 });
  const capM = mat(cap);
  iso.box(hi - t, lo, hi, hi, z, z + h, m);
  iso.box(hi - t - 0.004, lo, hi + 0.004, hi + 0.004, z + h, z + h + 0.01, capM);
  for (const [a, b] of [[lo, gate[0]], [gate[1], hi - t]] as [number, number][]) {
    if (b - a < 0.01) continue;
    iso.box(a, hi - t, b, hi, z, z + h, m);
    iso.box(a, hi - t - 0.004, b, hi + 0.004, z + h, z + h + 0.01, capM);
  }
  weatherV(iso, rng, hi, lo, hi, z, z + h, 8, 0.1);
  grime(iso, lo, lo, hi, hi, z, h * 0.5, 0.2);
  // gate pillars + MS gate
  for (const gu of [gate[0] - 0.02, gate[1]]) {
    iso.box(gu, hi - t - 0.004, gu + 0.02, hi + 0.004, z, z + h + 0.035, m);
    iso.box(gu - 0.003, hi - t - 0.007, gu + 0.023, hi + 0.007, z + h + 0.035, z + h + 0.045, capM);
  }
  const zg = z + h + 0.01;
  iso.line([gate[0], hi - 0.01, zg], [gate[1], hi - 0.01, zg], gateColor, 1.1);
  iso.line([gate[0], hi - 0.01, z + 0.012], [gate[1], hi - 0.01, z + 0.012], gateColor, 0.9);
  for (let u = gate[0] + 0.008; u < gate[1]; u += 0.011) iso.line([u, hi - 0.01, z + 0.006], [u, hi - 0.01, zg], alpha(gateColor, 0.9), 0.6);
}

// ============================================================================
// HOUSE SMALL (1×1)
// ============================================================================

interface SmallScheme {
  wall: string;
  gf: string;
  trim: string;
  door: string;
  grille: string;
  wallCap: string;
}

const SMALL_SCHEMES: readonly SmallScheme[] = [
  { wall: PASTEL.pink, gf: PASTEL.pink, trim: '#f6ecda', door: '#3f8f8b', grille: '#2f6a5a', wallCap: '#8c3b2b' },
  { wall: C.brick, gf: PASTEL.turquoise, trim: '#eee6d2', door: '#7b4a2a', grille: '#253a4a', wallCap: '#e9e0cc' },
  { wall: PASTEL.lemon, gf: PASTEL.lemon, trim: '#fbf3df', door: '#3d67a8', grille: '#6b2f2a', wallCap: '#6b8e3a' },
  { wall: PASTEL.lilac, gf: PASTEL.mint, trim: '#f4efe4', door: '#a0452e', grille: '#2c2f4a', wallCap: '#c7a55a' },
];

function drawHouseSmall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('house_small', variant);
  const S = SMALL_SCHEMES[variant % SMALL_SCHEMES.length];
  const z0 = 0.02;
  slab(iso, rng, 0.02, z0, '#b7a07c', '#8a7353', GROUND_GRAIN);
  // concrete forecourt
  iso.poly(iso.topQuad(0.1, 0.62, 0.95, 0.95, z0 + 0.001), '#cbc1ad');
  iso.poly(iso.topQuad(0.68, 0.08, 0.95, 0.62, z0 + 0.001), '#c2b69c');
  paving(iso, rng, 0.1, 0.62, 0.95, 0.95, z0 + 0.001, 0.11, 0.11, alpha('#8a7b62', 0.35));
  const u0 = 0.12;
  const v0 = 0.1;
  const u1 = 0.68;
  const v1 = 0.62;
  const F = 0.17;
  const z1 = z0 + F;
  const z2 = z1 + F;
  const partial = variant === 1;
  const cantilever = variant === 2 ? 0.045 : 0;
  // tree behind, on the right
  if (variant !== 1) iso.tree(0.86, 0.2, z0, 0.11, rng, variant === 3 ? 'peepal' : 'neem');
  // ground floor
  plasterBox(iso, rng, u0, v0, u1, v1, z0, z1, S.gf, { shadow: true, noTop: !partial, bands: [z1 - 0.004], band: S.trim });
  iso.poly(iso.faceVQuad(v1, u0, u1, z0, z0 + 0.028), shade(S.gf, -0.28));
  iso.poly(iso.faceUQuad(u1, v0, v1, z0, z0 + 0.028), shade(S.gf, -0.45));
  // front step + door + window
  const dc = u0 + 0.16;
  iso.box(dc - 0.065, v1, dc + 0.065, v1 + 0.05, z0, z0 + 0.016, mat('#b9b2a4'));
  doorV(iso, v1, dc, 0.042, z0 + 0.016, z0 + 0.125, S.door, { frame: S.trim, garland: variant !== 1 });
  winV(iso, v1, u0 + 0.4, 0.05, z0 + 0.055, z0 + 0.125, { frame: S.trim, grille: S.grille, chhajja: '#c9c1b2' });
  winU(iso, u1, v0 + 0.14, 0.045, z0 + 0.055, z0 + 0.125, { frame: S.trim, grille: S.grille, chhajja: '#c9c1b2' });
  winU(iso, u1, v0 + 0.38, 0.045, z0 + 0.055, z0 + 0.125, { frame: S.trim, grille: S.grille, chhajja: '#c9c1b2' });
  if (variant === 0 || variant === 3) acU(iso, u1, v0 + 0.26, z0 + 0.11);
  // name plate + switch box + meter
  iso.poly(iso.faceVQuad(v1 + 0.001, dc + 0.055, dc + 0.09, z0 + 0.09, z0 + 0.11), '#f4efe2', alpha('#333', 0.5), 0.5);
  iso.poly(iso.faceUQuad(u1 + 0.001, v1 - 0.06, v1 - 0.03, z0 + 0.07, z0 + 0.1), '#d9d4c8', alpha('#333', 0.5), 0.5);
  if (variant === 2) {
    // tin awning over the door on thin brackets
    const a0 = dc - 0.07;
    const a1 = dc + 0.07;
    iso.poly([[a0, v1, z0 + 0.15], [a1, v1, z0 + 0.15], [a1, v1 + 0.07, z0 + 0.125], [a0, v1 + 0.07, z0 + 0.125]], shade(C.tin, 0.08), alpha('#333', 0.6), 0.8);
    iso.clipped([[a0, v1, z0 + 0.15], [a1, v1, z0 + 0.15], [a1, v1 + 0.07, z0 + 0.125], [a0, v1 + 0.07, z0 + 0.125]], () => {
      for (let u = a0 + 0.008; u < a1; u += 0.012) iso.line([u, v1, z0 + 0.15], [u, v1 + 0.07, z0 + 0.125], alpha('#5a6268', 0.5), 0.6);
    });
  }

  if (partial) {
    // terrace on the ground floor, a half-built exposed-brick room at the back
    terrace(iso, rng, u0, v0, u1, v1, z1);
    const rv1 = v0 + 0.27;
    iso.box(u0, v0, u1, rv1, z1, z1 + 0.15, mat(C.brick));
    coursesV(iso, rng, rv1, u0, u1, z1, z1 + 0.15, 0.016, 0.042, alpha('#e2c7a4', 0.42), 0.55);
    coursesU(iso, rng, u1, v0, rv1, z1, z1 + 0.15, 0.016, 0.042, alpha('#d8bd9a', 0.3), 0.55);
    iso.speckle(iso.faceVQuad(rv1, u0, u1, z1, z1 + 0.15), rng, 50, [alpha(C.brickDark, 0.8), alpha('#c47a55', 0.8)], 1.6);
    // concrete beam band + door + window openings (no frames yet)
    iso.poly(iso.faceVQuad(rv1, u0, u1, z1 + 0.135, z1 + 0.15), '#aaa294');
    iso.poly(iso.faceUQuad(u1, v0, rv1, z1 + 0.135, z1 + 0.15), '#8a8274');
    iso.poly(iso.faceVQuad(rv1, u0 + 0.08, u0 + 0.15, z1, z1 + 0.11), '#2c2622');
    winV(iso, rv1, u0 + 0.36, 0.05, z1 + 0.05, z1 + 0.11, { glass: '#2c2622', grille: '#3a3a3a' });
    winU(iso, u1, v0 + 0.13, 0.04, z1 + 0.05, z1 + 0.11, { glass: '#25201c' });
    const zr = z1 + 0.15;
    iso.poly(iso.topQuad(u0, v0, u1, rv1, zr), '#b8b0a2');
    sintex(iso, u0 + 0.12, v0 + 0.12, zr, 0.045, 0.08, 0.025);
    rebar(iso, u1 - 0.015, rv1 - 0.015, zr, 0.07);
    rebar(iso, u1 - 0.015, v0 + 0.015, zr, 0.06);
    rebar(iso, u0 + 0.3, rv1 - 0.015, zr, 0.065);
    dish(iso, u0 + 0.42, v0 + 0.08, zr, 0.03);
    // terrace life: laundry, charpai, pots, drum
    clothesLine(iso, rng, [u0 + 0.04, rv1 + 0.1, z1 + 0.09], [u1 - 0.06, rv1 + 0.06, z1 + 0.09], LAUNDRY, z1);
    charpai(iso, u0 + 0.06, rv1 + 0.1, z1);
    pot(iso, rng, u1 - 0.1, v1 - 0.06, z1, 0.035, C.marigold);
    drum(iso, u1 - 0.2, v1 - 0.05, z1, 0.03, 0.06, '#2f67b4');
    // front railing (MS) on a low parapet
    const pm = mat(S.gf);
    iso.box(u1 - 0.014, rv1, u1, v1, z1, z1 + 0.025, pm);
    iso.box(u0, v1 - 0.014, u1, v1, z1, z1 + 0.025, pm);
    const zr2 = z1 + 0.075;
    iso.line([u1 - 0.007, rv1, zr2], [u1 - 0.007, v1 - 0.007, zr2], S.grille, 1.2);
    iso.line([u0, v1 - 0.007, zr2], [u1 - 0.007, v1 - 0.007, zr2], S.grille, 1.2);
    for (let v = rv1 + 0.02; v < v1; v += 0.03) iso.line([u1 - 0.007, v, z1 + 0.025], [u1 - 0.007, v, zr2], S.grille, 0.7);
    for (let u = u0 + 0.01; u < u1; u += 0.03) iso.line([u, v1 - 0.007, z1 + 0.025], [u, v1 - 0.007, zr2], S.grille, 0.7);
    weatherV(iso, rng, v1, u0, u1, z0, z1, 6, 0.08);
  } else {
    // first floor (variant 2 cantilevers forward over the door)
    const fv1 = v1 + cantilever;
    if (cantilever) iso.poly(iso.faceVQuad(v1, u0, u1, z1 - 0.03, z1), alpha('#2a1c14', 0.25));
    plasterBox(iso, rng, u0, v0, u1, fv1, z1, z2, S.wall, { noTop: true, ao: false, grimeH: 0, bands: [z1 + 0.006], band: S.trim });
    if (cantilever) iso.box(u0 - 0.005, v1, u1 + 0.005, fv1 + 0.005, z1 - 0.012, z1, mat(S.trim));
    winU(iso, u1, v0 + 0.14, 0.045, z1 + 0.05, z1 + 0.125, { frame: S.trim, grille: S.grille, chhajja: '#c9c1b2' });
    if (variant === 2) {
      // corner balcony on the +u side
      doorU(iso, u1, v0 + 0.4, 0.04, z1, z1 + 0.13, S.door);
      balconyU(iso, rng, u1, v0 + 0.28, fv1 - 0.02, z1 + 0.012, 0.06, '#d3cab8', S.grille, { laundry: true });
      winV(iso, fv1, u0 + 0.16, 0.05, z1 + 0.05, z1 + 0.125, { frame: S.trim, grille: S.grille, chhajja: '#c9c1b2' });
      winV(iso, fv1, u0 + 0.4, 0.05, z1 + 0.05, z1 + 0.125, { frame: S.trim, grille: S.grille, chhajja: '#c9c1b2' });
    } else {
      winU(iso, u1, v0 + 0.38, 0.045, z1 + 0.05, z1 + 0.125, { frame: S.trim, grille: S.grille, chhajja: '#c9c1b2' });
      winV(iso, fv1, u0 + 0.08, 0.035, z1 + 0.05, z1 + 0.125, { frame: S.trim, grille: S.grille });
      doorV(iso, fv1, u0 + 0.3, 0.04, z1, z1 + 0.13, S.door, { frame: S.trim });
      balconyV(iso, rng, fv1, u0 + 0.18, u0 + 0.46, z1 + 0.012, 0.065, '#d3cab8', S.grille, { laundry: variant === 0, plants: variant === 3 });
    }
    downpipeU(iso, u1, v0 + 0.02, z0, z2);
    // roof
    terrace(iso, rng, u0, v0, u1, fv1, z2);
    parapet(iso, u0, v0, u1, fv1, z2, 0.045, 0.018, S.wall, 'back', S.trim);
    const mu0 = variant === 2 ? u1 - 0.22 : u0 + 0.03;
    const zm = mumty(iso, rng, mu0, v0 + 0.03, mu0 + 0.19, v0 + 0.22, z2, 0.14, S.wall, S.door);
    sintex(iso, mu0 + 0.1, v0 + 0.12, zm, 0.045, 0.08);
    if (variant === 2) {
      rebar(iso, u0 + 0.02, fv1 - 0.02, z2 + 0.045, 0.07);
      rebar(iso, u1 - 0.02, fv1 - 0.02, z2 + 0.045, 0.07);
      dish(iso, u0 + 0.1, v0 + 0.1, z2, 0.03);
      clothesLine(iso, rng, [u0 + 0.06, v0 + 0.3, z2 + 0.1], [u1 - 0.06, fv1 - 0.1, z2 + 0.1], LAUNDRY, z2);
    } else {
      dish(iso, u1 - 0.1, v0 + 0.1, z2, 0.03);
      clothesLine(iso, rng, [u0 + 0.25, v0 + 0.08, z2 + 0.1], [u1 - 0.06, fv1 - 0.12, z2 + 0.1], LAUNDRY, z2);
      pot(iso, rng, u0 + 0.08, fv1 - 0.08, z2, 0.035, variant === 3 ? '#e04a8a' : C.marigold);
    }
    parapet(iso, u0, v0, u1, fv1, z2, 0.045, 0.018, S.wall, 'front', S.trim);
    if (variant === 0) flag(iso, u1 - 0.03, v0 + 0.03, z2 + 0.045, 0.14, C.saffron);
  }
  // yard: two-wheeler, pots, tulsi, water drum
  scooter(iso, 0.44, 0.76, z0, variant === 1 ? '#c8352e' : variant === 2 ? '#2d6bb0' : '#e8e4da');
  pot(iso, rng, 0.2, 0.84, z0, 0.04, variant === 3 ? '#e04a8a' : undefined);
  if (variant === 2) iso.tree(0.84, 0.76, z0, 0.12, rng, 'neem');
  else {
    drum(iso, 0.8, 0.5, z0, 0.035, 0.08, '#2f67b4');
    // tulsi chaura
    iso.box(0.76, 0.74, 0.84, 0.82, z0, z0 + 0.05, mat('#e8dcc4'));
    iso.poly(iso.faceVQuad(0.82, 0.77, 0.83, z0 + 0.015, z0 + 0.035), '#c0392b');
    iso.tree(0.8, 0.78, z0 + 0.05, 0.035, rng, 'shrub');
  }
  frontWall(iso, rng, 0.04, 0.96, z0, 0.06, S.gf === C.brick ? PASTEL.limeWash : shade(S.gf, 0.1), S.wallCap, [dc - 0.08, dc + 0.08], S.grille);
}

// ============================================================================
// HOUSE MEDIUM (1×1): narrow 3-storey Banarasi townhouse
// ============================================================================

/** A big carved jharokha (oriel window) projecting from a +v face, with a curved bangla roof. */
function jharokhaV(iso: Iso, v: number, uc: number, z: number, wd: number, stone: string, dark: string, roof: string): void {
  const d = 0.05;
  const hg = 0.1;
  const u0 = uc - wd / 2;
  const u1 = uc + wd / 2;
  const m = mat(stone, { right: -0.3 });
  iso.poly(iso.faceVQuad(v, u0, u1, z - 0.06, z), alpha('#2a1c14', 0.22));
  // stepped corbels
  iso.box(u0 + 0.025, v, u1 - 0.025, v + d * 0.45, z - 0.05, z - 0.028, m);
  iso.box(u0 + 0.01, v, u1 - 0.01, v + d * 0.8, z - 0.028, z - 0.012, m);
  iso.box(u0 - 0.006, v, u1 + 0.006, v + d + 0.006, z - 0.012, z, m);
  iso.box(u0, v, u1, v + d, z, z + hg, m, { noTop: true });
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = u0 + 0.012 + (i * (wd - 0.024)) / n;
    const b = a + (wd - 0.024) / n - 0.01;
    iso.archV(v + d, a, b, z + 0.012, z + hg - 0.014, dark, true);
    iso.line([a, v + d + 0.001, z + 0.035], [b, v + d + 0.001, z + 0.035], alpha(shade(stone, 0.2), 0.9), 0.8);
  }
  iso.archU(u1, v + 0.012, v + d - 0.012, z + 0.012, z + hg - 0.014, shade(dark, -0.2), true);
  // chhajja + curved bangla roof
  const zc = z + hg;
  iso.box(u0 - 0.014, v, u1 + 0.014, v + d + 0.02, zc, zc + 0.01, mat(shade(stone, 0.06)));
  const ridge = zc + 0.045;
  const vm = v + (d + 0.02) * 0.45;
  const front: P3[] = [];
  const side: P3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const zz = zc + 0.01 + (ridge - zc - 0.01) * Math.sin((t * Math.PI) / 2);
    front.push([u0 - 0.014, v + d + 0.02 - (v + d + 0.02 - vm) * t, zz]);
    side.push([u1 + 0.014, v + d + 0.02 - (v + d + 0.02 - vm) * t, zz]);
  }
  iso.poly([...front, ...side.slice().reverse()], shade(roof, 0.08), alpha(shade(roof, -0.6), 0.6), 0.8);
  iso.poly([[u1 + 0.014, v, zc + 0.01], ...side.slice().reverse(), [u1 + 0.014, v + d + 0.02, zc + 0.01]], shade(roof, -0.3), alpha(shade(roof, -0.6), 0.6), 0.8);
  iso.line([u0 - 0.014, vm, ridge], [u1 + 0.014, vm, ridge], alpha(shade(roof, 0.4), 0.8), 1);
  iso.line([uc, vm, ridge], [uc, vm, ridge + 0.018], C.brass, 1.4);
}

/** Pointed kangura merlons along the front edges of a parapet. */
function kanguras(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, color: string): void {
  const s = 0.03;
  for (let u = u0 + 0.004; u < u1 - s * 0.5; u += s) {
    iso.poly([[u, v1, z], [u + s * 0.8, v1, z], [u + s * 0.4, v1, z + 0.024]], color, alpha(shade(color, -0.5), 0.5), 0.5);
  }
  for (let v = v0 + 0.004; v < v1 - s * 0.5; v += s) {
    iso.poly([[u1, v, z], [u1, v + s * 0.8, z], [u1, v + s * 0.4, z + 0.024]], shade(color, -0.25), alpha(shade(color, -0.5), 0.5), 0.5);
  }
}

interface MedScheme {
  wall: string;
  trim: string;
  door: string;
  shutter: string;
  rail: string;
  board: string;
}

const MED_SCHEMES: readonly MedScheme[] = [
  { wall: PASTEL.banarasiBlue, trim: '#f3ecdc', door: '#7a4a2a', shutter: '#2f7a5a', rail: '#2a2e3a', board: '#d9452f' },
  { wall: PASTEL.haldi, trim: '#8c3b2b', door: '#5c3620', shutter: '#3a78a8', rail: '#3a2a22', board: '#2f7ab3' },
  { wall: PASTEL.salmon, trim: '#f1e6cc', door: '#2f6a8a', shutter: '#3f8f5a', rail: '#2a3a2a', board: '#f2c14e' },
];

function drawHouseMedium(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('house_medium', variant);
  const S = MED_SCHEMES[variant % MED_SCHEMES.length];
  const z0 = 0.02;
  slab(iso, rng, 0.02, z0, '#b3a288', '#86735a', GROUND_GRAIN);
  // stone-paved gali in front and on the side
  iso.poly(iso.topQuad(0.06, 0.78, 0.96, 0.96, z0 + 0.001), '#c4b496');
  iso.poly(iso.topQuad(0.84, 0.06, 0.96, 0.78, z0 + 0.001), '#bba98a');
  paving(iso, rng, 0.06, 0.78, 0.96, 0.96, z0 + 0.001, 0.09, 0.09, alpha('#7d6b52', 0.4));
  paving(iso, rng, 0.84, 0.06, 0.96, 0.78, z0 + 0.001, 0.06, 0.09, alpha('#7d6b52', 0.35));
  const u0 = 0.14;
  const v0 = 0.1;
  const u1 = 0.8;
  const v1 = 0.7;
  const F = 0.15;
  const zb = z0 + 0.03; // raised plinth
  const zt = zb + 3 * F;
  const shop = variant === 2;
  // plinth / otla platform with steps
  iso.aoRect(u0, v0, u1, v1 + 0.06, z0, 0.05, 0.4);
  iso.castShadow([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], z0, zt * 0.75, 0.16);
  iso.box(u0, v0, u1, v1 + 0.06, z0, zb, mat(PASTEL.sandstone, { right: -0.32 }));
  coursesV(iso, rng, v1 + 0.06, u0, u1, z0, zb, 0.015, 0.06, alpha('#7d6b52', 0.35), 0.6);
  plasterBox(iso, rng, u0, v0, u1, v1, zb, zt, S.wall, { noTop: true, ao: false, weather: 14, bands: [zb + F, zb + 2 * F], band: S.trim, grimeH: 0.04 });
  // thick cornices at each floor
  for (const zz of [zb + F, zb + 2 * F]) {
    iso.box(u1 - 0.01, v0, u1 + 0.01, v1 - 0.01, zz - 0.008, zz + 0.004, mat(S.trim));
    iso.box(u0, v1 - 0.01, u1 + 0.01, v1 + 0.01, zz - 0.008, zz + 0.004, mat(S.trim));
  }
  // --- ground floor ---
  if (shop) {
    shutterV(iso, v1, u0 + 0.05, u0 + 0.3, zb, zb + 0.105, '#8a9aa2', S.board, true);
    shutterV(iso, v1, u0 + 0.36, u0 + 0.56, zb, zb + 0.105, '#6f8a9a', S.board, false);
    // goods spilling out on the otla
    for (let i = 0; i < 3; i++) iso.box(u0 + 0.07 + i * 0.07, v1 + 0.01, u0 + 0.12 + i * 0.07, v1 + 0.05, zb, zb + 0.03, mat(['#e8b04a', '#c9502f', '#e6dcc0'][i]));
    // tarp awning
    const a: P3[] = [[u0 + 0.02, v1, zb + 0.145], [u0 + 0.32, v1, zb + 0.145], [u0 + 0.32, v1 + 0.07, zb + 0.125], [u0 + 0.02, v1 + 0.07, zb + 0.125]];
    iso.poly(a, shade(C.tarpBlue, 0.1), alpha('#10203a', 0.6), 0.8);
    iso.line([u0 + 0.02, v1 + 0.07, zb + 0.125], [u0 + 0.32, v1 + 0.07, zb + 0.125], alpha('#fff', 0.35), 0.8);
  } else {
    doorV(iso, v1, u0 + 0.2, 0.05, zb, zb + 0.12, S.door, { frame: S.trim, arch: true, garland: true });
    winV(iso, v1, u0 + 0.45, 0.04, zb + 0.04, zb + 0.11, { frame: S.trim, grille: S.rail, arch: true });
    // painted auspicious blocks either side of the door
    iso.poly(iso.faceVQuad(v1 + 0.001, u0 + 0.1, u0 + 0.125, zb + 0.07, zb + 0.095), alpha('#c0392b', 0.8));
    iso.poly(iso.faceVQuad(v1 + 0.001, u0 + 0.275, u0 + 0.3, zb + 0.07, zb + 0.095), alpha('#c0392b', 0.8));
  }
  // steps up to the otla
  iso.box(u0 + 0.12, v1 + 0.06, u0 + 0.28, v1 + 0.1, z0, z0 + 0.015, mat(PASTEL.sandstone));
  winU(iso, u1, v0 + 0.18, 0.04, zb + 0.04, zb + 0.11, { frame: S.trim, grille: S.rail, chhajja: '#c9c1b2' });
  winU(iso, u1, v0 + 0.42, 0.04, zb + 0.04, zb + 0.11, { frame: S.trim, grille: S.rail, chhajja: '#c9c1b2' });
  // --- first floor: jharokha centre, shuttered windows ---
  const z1 = zb + F;
  winV(iso, v1, u0 + 0.08, 0.035, z1 + 0.035, z1 + 0.115, { frame: S.trim, shutter: S.shutter, arch: true });
  winV(iso, v1, u1 - 0.08, 0.035, z1 + 0.035, z1 + 0.115, { frame: S.trim, shutter: S.shutter, arch: true });
  winU(iso, u1, v0 + 0.14, 0.04, z1 + 0.035, z1 + 0.115, { frame: S.trim, shutter: S.shutter, chhajja: '#c9c1b2' });
  winU(iso, u1, v0 + 0.44, 0.04, z1 + 0.035, z1 + 0.115, { frame: S.trim, shutter: S.shutter, chhajja: '#c9c1b2' });
  acU(iso, u1, v0 + 0.29, z1 + 0.05);
  jharokhaV(iso, v1, (u0 + u1) / 2, z1 + 0.02, 0.2, variant === 1 ? PASTEL.sandstone : S.trim, '#3a2a2a', variant === 1 ? '#8c3b2b' : S.wall);
  // --- second floor: full-width balcony ---
  const z2 = zb + 2 * F;
  winU(iso, u1, v0 + 0.14, 0.04, z2 + 0.035, z2 + 0.115, { frame: S.trim, grille: S.rail, chhajja: '#c9c1b2' });
  winU(iso, u1, v0 + 0.44, 0.04, z2 + 0.035, z2 + 0.115, { frame: S.trim, grille: S.rail, chhajja: '#c9c1b2' });
  doorV(iso, v1, u0 + 0.22, 0.04, z2 + 0.004, z2 + 0.12, S.door, { frame: S.trim });
  winV(iso, v1, u0 + 0.44, 0.05, z2 + 0.04, z2 + 0.115, { frame: S.trim, glass: '#3a3a46' });
  balconyV(iso, rng, v1, u0 + 0.06, u1 - 0.06, z2 + 0.01, 0.06, S.trim, S.rail, { laundry: true, plants: variant !== 2 });
  if (variant !== 1) acV(iso, v1, u1 - 0.1, z2 + 0.09);
  downpipeU(iso, u1, v1 - 0.02, zb, zt);
  // --- roof ---
  terrace(iso, rng, u0, v0, u1, v1, zt);
  parapet(iso, u0, v0, u1, v1, zt, 0.05, 0.02, S.wall, 'back', S.trim);
  const zm = mumty(iso, rng, u0 + 0.04, v0 + 0.04, u0 + 0.24, v0 + 0.26, zt, 0.13, S.wall, S.door);
  sintex(iso, u0 + 0.14, v0 + 0.15, zm, 0.05, 0.085);
  if (variant === 0) flag(iso, u1 - 0.05, v0 + 0.05, zt, 0.22, C.saffron);
  else dish(iso, u1 - 0.1, v0 + 0.1, zt, 0.032);
  if (variant === 1) sintex(iso, u1 - 0.12, v0 + 0.28, zt, 0.04, 0.07, 0.02);
  clothesLine(iso, rng, [u0 + 0.3, v0 + 0.1, zt + 0.1], [u0 + 0.3, v1 - 0.08, zt + 0.1], LAUNDRY, zt);
  pot(iso, rng, u1 - 0.08, v1 - 0.08, zt, 0.035, C.marigold);
  pot(iso, rng, u0 + 0.1, v1 - 0.08, zt, 0.03, '#e04a8a');
  parapet(iso, u0, v0, u1, v1, zt, 0.05, 0.02, S.wall, 'front', S.trim);
  kanguras(iso, u0, v0, u1, v1, zt + 0.06, S.trim);
  // street pole on the corner with a cable bundle
  iso.line([0.9, 0.9, z0], [0.9, 0.9, z0 + 0.5], '#6a6a6a', 1.8);
  iso.line([0.88, 0.9, z0 + 0.48], [0.92, 0.9, z0 + 0.48], '#6a6a6a', 1.4);
  wires(iso, [0.9, 0.9, z0 + 0.47], [u1, v0 + 0.3, zb + 2 * F - 0.02], 3);
}

// ============================================================================
// MANSION (2×2): haveli (sandstone, jharokhas, chhatris) or kothi (lime-washed, portico)
// ============================================================================

/** Pillared arcade on a +v face (courtyard or verandah). */
function arcadeV(iso: Iso, v: number, u0: number, u1: number, z: number, hgt: number, trim: string, dark: string): void {
  const n = Math.max(2, Math.round((u1 - u0) / 0.1));
  for (let i = 0; i < n; i++) {
    const a = u0 + ((i + 0.14) / n) * (u1 - u0);
    const b = u0 + ((i + 0.86) / n) * (u1 - u0);
    iso.archV(v, a - 0.005, b + 0.005, z, z + hgt + 0.006, trim, true);
    iso.archV(v, a, b, z, z + hgt, dark, true);
  }
}

function arcadeU(iso: Iso, u: number, v0: number, v1: number, z: number, hgt: number, trim: string, dark: string): void {
  const n = Math.max(2, Math.round((v1 - v0) / 0.1));
  for (let i = 0; i < n; i++) {
    const a = v0 + ((i + 0.14) / n) * (v1 - v0);
    const b = v0 + ((i + 0.86) / n) * (v1 - v0);
    iso.archU(u, a - 0.005, b + 0.005, z, z + hgt + 0.006, shade(trim, -0.22), true);
    iso.archU(u, a, b, z, z + hgt, dark, true);
  }
}

/** White Ambassador-style car parked along v. */
function ambassador(iso: Iso, u: number, v: number, z: number): void {
  const W = 0.09;
  const L = 0.2;
  iso.aoRect(u, v, u + W, v + L, z, 0.025, 0.45);
  const body = mat('#eeeae0', { top: 0.12, right: -0.3 });
  iso.box(u, v, u + W, v + L, z + 0.01, z + 0.04, body);
  iso.box(u + 0.008, v + 0.05, u + W - 0.008, v + 0.145, z + 0.04, z + 0.072, { top: '#f2eee4', left: '#3a4552', right: '#2a323c', line: alpha('#1a1a1a', 0.5) });
  iso.poly(iso.faceVQuad(v + L + 0.001, u + 0.012, u + 0.026, z + 0.024, z + 0.034), '#f6ebb6');
  iso.poly(iso.faceVQuad(v + L + 0.001, u + W - 0.026, u + W - 0.012, z + 0.024, z + 0.034), '#f6ebb6');
  iso.poly(iso.faceVQuad(v + L + 0.001, u + 0.03, u + W - 0.03, z + 0.02, z + 0.034), '#9aa0a4');
  iso.poly(iso.faceUQuad(u + W, v + 0.004, v + L - 0.004, z + 0.01, z + 0.016), alpha('#111', 0.6));
}

function drawMansion(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('mansion', variant);
  const kothi = variant === 1;
  const z0 = 0.025;
  const wall = kothi ? '#ecd27e' : PASTEL.sandstone;
  const trim = kothi ? '#f7f1e2' : '#efdfc0';
  const dark = kothi ? '#3a3a40' : '#3e2e28';
  const accent = kothi ? '#2f6a5a' : '#8c3b2b';
  slab(iso, rng, 0.02, z0, C.lawn, '#7a6446', []);
  lawn(iso, rng, 0.04, 0.04, 1.96, 1.96, z0, kothi ? C.lawn : '#7a9e46');
  // gravel drive and forecourt
  const drive = kothi ? '#d9ccb0' : '#cdb994';
  iso.poly(iso.topQuad(0.26, 1.34, 1.56, 1.6, z0 + 0.002), drive);
  iso.poly(iso.topQuad(0.78, 1.34, 1.06, 1.97, z0 + 0.002), drive);
  iso.speckle(iso.topQuad(0.78, 1.34, 1.06, 1.97, z0 + 0.002), rng, 160, [alpha('#8a7a5a', 0.5), alpha('#fff4dc', 0.5)], 1.3);
  paving(iso, rng, 0.26, 1.34, 1.56, 1.6, z0 + 0.002, 0.1, 0.1, alpha('#8a7a5a', 0.35));
  // back boundary wall + trees behind
  const wallM = mat(kothi ? '#f0ead8' : '#e3cfa6', { right: -0.3 });
  const capM = mat(accent);
  iso.box(0.06, 0.06, 1.94, 0.09, z0, z0 + 0.09, wallM);
  iso.box(0.06, 0.09, 0.09, 1.94, z0, z0 + 0.09, wallM);
  iso.box(0.055, 0.055, 1.945, 0.095, z0 + 0.09, z0 + 0.1, capM);
  iso.box(0.055, 0.095, 0.095, 1.945, z0 + 0.09, z0 + 0.1, capM);
  iso.tree(0.2, 0.24, z0, 0.2, rng, 'peepal');
  iso.tree(1.75, 0.2, z0, 0.17, rng, 'neem');
  // ---- the haveli block around a courtyard ----
  const U0 = 0.26;
  const V0 = 0.26;
  const U1 = 1.56;
  const V1 = 1.3;
  const d = 0.34;
  const F = 0.21;
  const H = 2 * F;
  const zt = z0 + H;
  iso.castShadow([[U0, V0], [U1, V0], [U1, V1], [U0, V1]], z0, H * 0.85, 0.16);
  // courtyard floor (seen through the roof opening)
  iso.poly(iso.topQuad(U0 + d, V0 + d, U1 - d, V1 - d, z0 + 0.003), kothi ? '#d8cdb8' : '#e2d2b0');
  paving(iso, rng, U0 + d, V0 + d, U1 - d, V1 - d, z0 + 0.003, 0.07, 0.07, alpha('#8a7458', 0.4));
  const range = (u0: number, v0: number, u1: number, v1: number) =>
    plasterBox(iso, rng, u0, v0, u1, v1, z0, zt, wall, { weather: 10, bands: [z0 + F], band: trim, grimeH: 0.05, speck: kothi ? 1 : 1.3 });
  // back range: its +v face is the courtyard's rear arcade
  range(U0, V0, U1, V0 + d);
  arcadeV(iso, V0 + d, U0 + d + 0.02, U1 - d - 0.02, z0, F - 0.04, trim, dark);
  arcadeV(iso, V0 + d, U0 + d + 0.02, U1 - d - 0.02, z0 + F + 0.02, F - 0.07, trim, shade(dark, 0.08));
  // left range: its +u face is the courtyard's side arcade
  range(U0, V0 + d, U0 + d, V1);
  arcadeU(iso, U0 + d, V0 + d + 0.02, V1 - d - 0.02, z0, F - 0.04, trim, dark);
  arcadeU(iso, U0 + d, V0 + d + 0.02, V1 - d - 0.02, z0 + F + 0.02, F - 0.07, trim, shade(dark, 0.08));
  // courtyard life: tulsi chaura, charpai, a small well
  const cu = (U0 + U1) / 2;
  const cv = (V0 + V1) / 2;
  iso.box(cu - 0.04, cv - 0.04, cu + 0.04, cv + 0.04, z0, z0 + 0.05, mat('#f0e6d0'));
  iso.poly(iso.faceVQuad(cv + 0.04, cu - 0.03, cu + 0.03, z0 + 0.015, z0 + 0.035), '#c0392b');
  iso.tree(cu, cv, z0 + 0.05, 0.04, rng, 'shrub');
  charpai(iso, U0 + d + 0.04, V0 + d + 0.06, z0);
  // right range and front range
  range(U1 - d, V0 + d, U1, V1);
  range(U0 + d, V1 - d, U1 - d, V1);
  const zr = z0 + H;
  const roofC = kothi ? '#d9ceb6' : '#d8c4a0';
  iso.poly(iso.topQuad(U0, V0, U1, V0 + d, zr), roofC);
  iso.poly(iso.topQuad(U0, V0 + d, U0 + d, V1, zr), roofC);
  iso.poly(iso.topQuad(U1 - d, V0 + d, U1, V1, zr), roofC);
  iso.poly(iso.topQuad(U0 + d, V1 - d, U1 - d, V1, zr), roofC);
  iso.speckle(iso.topQuad(U0, V0, U1, V1, zr), rng, 500, [alpha('#8a7a5a', 0.35), alpha('#fff4dc', 0.35)], 1.3);
  // outer facade: +u side (right range)
  for (let s = 0; s < 2; s++) {
    const zs = z0 + s * F;
    const nU = 6;
    for (let i = 0; i < nU; i++) {
      const vc = V0 + 0.1 + (i * (V1 - V0 - 0.2)) / (nU - 1);
      if (s === 1 && kothi && (i === 1 || i === 4)) continue;
      if (s === 1 && !kothi && i % 2 === 1) jharokha(iso, 'u', U1, vc - 0.035, zs + 0.06, wall);
      else winU(iso, U1, vc, 0.03, zs + 0.05, zs + F - 0.05, { frame: trim, arch: true, grille: s === 0 ? '#2a2420' : undefined, shutter: kothi ? '#3f7a5f' : undefined });
    }
  }
  if (kothi) {
    balconyU(iso, rng, U1, V0 + 0.3, V0 + 0.55, z0 + F + 0.01, 0.07, trim, trim, { solid: trim });
    balconyU(iso, rng, U1, V0 + 0.76, V0 + 1.0, z0 + F + 0.01, 0.07, trim, trim, { solid: trim });
  }
  // outer facade: +v side (front + left ranges)
  for (let s = 0; s < 2; s++) {
    const zs = z0 + s * F;
    const nV = 8;
    for (let i = 0; i < nV; i++) {
      const uc = U0 + 0.09 + (i * (U1 - U0 - 0.18)) / (nV - 1);
      if (Math.abs(uc - (U0 + U1) / 2) < 0.14) continue; // gate bay
      if (s === 1 && !kothi && (i === 1 || i === 6)) jharokha(iso, 'v', V1, uc - 0.035, zs + 0.06, wall);
      else winV(iso, V1, uc, 0.03, zs + 0.05, zs + F - 0.05, { frame: trim, arch: true, grille: s === 0 ? '#2a2420' : undefined, shutter: kothi ? '#3f7a5f' : undefined });
    }
  }
  // gate bay: a tall projecting pol (haveli) or a portico (kothi)
  const gu = (U0 + U1) / 2;
  if (!kothi) {
    iso.box(gu - 0.15, V1, gu + 0.15, V1 + 0.05, z0, zr + 0.08, mat(wall, { right: -0.3 }));
    iso.archV(V1 + 0.05, gu - 0.085, gu + 0.085, z0, z0 + 0.25, trim, true);
    iso.archV(V1 + 0.051, gu - 0.07, gu + 0.07, z0, z0 + 0.23, '#6a4226', true);
    iso.clipped(iso.faceVQuad(V1 + 0.052, gu - 0.07, gu + 0.07, z0, z0 + 0.23), () => {
      for (let z = z0 + 0.03; z < z0 + 0.2; z += 0.04) for (let u = gu - 0.06; u < gu + 0.07; u += 0.035) iso.ellipse(u, V1 + 0.053, z, 0.004, '#c9a24a');
    });
    iso.line([gu, V1 + 0.052, z0], [gu, V1 + 0.052, z0 + 0.2], alpha('#2a1a10', 0.7), 1);
    garlandV(iso, V1 + 0.053, gu - 0.08, gu + 0.08, z0 + 0.235);
    jharokhaV(iso, V1 + 0.05, gu, z0 + F + 0.1, 0.2, trim, dark, accent);
    iso.box(gu - 0.165, V1 - 0.005, gu + 0.165, V1 + 0.065, zr + 0.08, zr + 0.095, mat(trim));
    // painted elephants either side of the gate (folk murals as simple shapes)
    for (const side of [-1, 1]) {
      const eu = gu + side * 0.12;
      iso.poly(iso.faceVQuad(V1 + 0.051, eu - 0.018, eu + 0.018, z0 + 0.1, z0 + 0.13), alpha('#7a7a86', 0.8));
      iso.poly(iso.faceVQuad(V1 + 0.052, eu - 0.012, eu + 0.012, z0 + 0.128, z0 + 0.135), alpha('#c0392b', 0.8));
    }
  } else {
    // portico on four columns with a balustraded terrace, the Ambassador under it
    const pv1 = V1 + 0.2;
    ambassador(iso, gu - 0.045, V1 + 0.02, z0);
    for (const cu2 of [gu - 0.16, gu + 0.13]) for (const cv2 of [V1 + 0.02, pv1 - 0.03]) iso.box(cu2, cv2, cu2 + 0.03, cv2 + 0.03, z0, z0 + F, mat(trim));
    iso.box(gu - 0.18, V1, gu + 0.18, pv1, z0 + F, z0 + F + 0.03, mat(trim));
    for (let u = gu - 0.17; u < gu + 0.17; u += 0.025) iso.box(u, pv1 - 0.012, u + 0.008, pv1, z0 + F + 0.03, z0 + F + 0.07, mat(trim), { edges: false });
    for (let v = V1 + 0.01; v < pv1; v += 0.025) iso.box(gu + 0.168, v, gu + 0.18, v + 0.008, z0 + F + 0.03, z0 + F + 0.07, mat(trim), { edges: false });
    iso.box(gu - 0.18, pv1 - 0.014, gu + 0.18, pv1, z0 + F + 0.07, z0 + F + 0.08, mat(trim));
    iso.box(gu + 0.166, V1, gu + 0.18, pv1, z0 + F + 0.07, z0 + F + 0.08, mat(trim));
    // pediment on the facade behind
    iso.poly([[gu - 0.16, V1 + 0.002, zr], [gu + 0.16, V1 + 0.002, zr], [gu, V1 + 0.002, zr + 0.08]], trim, alpha('#6a5a40', 0.6), 1);
    iso.poly(iso.faceVQuad(V1 + 0.003, gu - 0.04, gu + 0.04, zr + 0.01, zr + 0.035), alpha(accent, 0.8));
  }
  // inner courtyard parapet (low, dark lip)
  iso.line([U0 + d, V1 - d, zr], [U1 - d, V1 - d, zr], alpha('#3a2a1e', 0.5), 1.4);
  iso.line([U1 - d, V0 + d, zr], [U1 - d, V1 - d, zr], alpha('#3a2a1e', 0.5), 1.4);
  parapet(iso, U0, V0, U1, V1, zr, 0.05, 0.022, wall, 'back', trim);
  if (!kothi) {
    chhatri(iso, rng, U0 + 0.05, V0 + 0.05, zr, 0.12, trim, trim);
    chhatri(iso, rng, U1 - 0.17, V0 + 0.05, zr, 0.12, trim, trim);
    clothesLine(iso, rng, [U0 + 0.3, V0 + 0.1, zr + 0.1], [U1 - 0.4, V0 + 0.14, zr + 0.1], LAUNDRY, zr);
  } else {
    const zm = mumty(iso, rng, U0 + 0.06, V0 + 0.06, U0 + 0.28, V0 + 0.26, zr, 0.13, wall, '#2f6a5a');
    sintex(iso, U0 + 0.13, V0 + 0.15, zm, 0.05, 0.085);
    sintex(iso, U0 + 0.22, V0 + 0.15, zm, 0.04, 0.07);
    dish(iso, U1 - 0.15, V0 + 0.14, zr, 0.035);
    clothesLine(iso, rng, [U0 + 0.35, V0 + 0.1, zr + 0.1], [U1 - 0.4, V0 + 0.14, zr + 0.1], LAUNDRY, zr);
  }
  parapet(iso, U0, V0, U1, V1, zr, 0.05, 0.022, wall, 'front', trim);
  if (!kothi) {
    for (let u = U0 + 0.01; u < U1 - 0.02; u += 0.055) iso.box(u, V1 - 0.02, u + 0.028, V1, zr + 0.06, zr + 0.085, mat(trim), { edges: false });
    for (let v = V0 + 0.01; v < V1 - 0.02; v += 0.055) iso.box(U1 - 0.02, v, U1, v + 0.028, zr + 0.06, zr + 0.085, mat(trim), { edges: false });
    chhatri(iso, rng, U0 + 0.05, V1 - 0.17, zr, 0.12, trim, trim);
    chhatri(iso, rng, U1 - 0.17, V1 - 0.17, zr, 0.12, trim, trim);
    chhatri(iso, rng, gu - 0.07, V1 - 0.06, zr + 0.095, 0.14, trim, accent);
    flag(iso, U1 - 0.1, V0 + 0.1, zr + 0.05, 0.3, C.saffron);
  } else {
    for (const [pu, pv] of [[U0 + 0.02, V1 - 0.02], [U1 - 0.02, V1 - 0.02], [U1 - 0.02, V0 + 0.02]] as [number, number][]) {
      iso.lathe(pu, pv, zr + 0.06, [[0, 0.02], [0.02, 0.028], [0.04, 0.018], [0.05, 0.01], [0.06, 0]], () => trim, { outline: true });
    }
  }
  // ---- garden in front ----
  const flowers = (u0: number, v0: number, u1: number, v1: number) => {
    iso.poly(iso.topQuad(u0, v0, u1, v1, z0 + 0.004), '#6b4a30');
    iso.clipped(iso.topQuad(u0, v0, u1, v1, z0 + 0.004), () => {
      for (let i = 0; i < 26; i++) {
        const pu = u0 + rng() * (u1 - u0);
        const pv = v0 + rng() * (v1 - v0);
        iso.ellipse(pu, pv, z0 + 0.012, 0.012, i % 3 === 0 ? '#e8641c' : i % 3 === 1 ? C.marigold : '#4f8a2e');
      }
    });
  };
  flowers(0.2, 1.66, 0.7, 1.74);
  flowers(1.14, 1.66, 1.8, 1.74);
  if (kothi) {
    iso.cylinder(1.45, 1.82, 0.09, z0, z0 + 0.03, '#e8dcc2', null);
    iso.ellipse(1.45, 1.82, z0 + 0.03, 0.07, '#5f9fb0', alpha('#2a4a55', 0.5), 1);
    iso.cylinder(1.45, 1.82, 0.015, z0 + 0.03, z0 + 0.07, '#e8dcc2');
    caneChairs(iso, 0.36, 1.82, z0);
  } else {
    iso.tree(0.36, 1.84, z0, 0.14, rng, 'neem');
    iso.tree(1.72, 1.4, z0, 0.1, rng, 'ashoka');
  }
  iso.tree(1.78, 0.62, z0, 0.12, rng, 'ashoka');
  iso.tree(1.78, 0.98, z0, 0.11, rng, 'ashoka');
  // front boundary walls with gate
  iso.box(1.91, 0.09, 1.94, 1.94, z0, z0 + 0.09, wallM);
  iso.box(1.905, 0.09, 1.945, 1.945, z0 + 0.09, z0 + 0.1, capM);
  for (const [a, b] of [[0.09, 0.74], [1.1, 1.91]] as [number, number][]) {
    iso.box(a, 1.91, b, 1.94, z0, z0 + 0.09, wallM);
    iso.box(a, 1.905, b, 1.945, z0 + 0.09, z0 + 0.1, capM);
  }
  weatherV(iso, rng, 1.94, 0.06, 1.94, z0, z0 + 0.09, 20, 0.1);
  weatherU(iso, rng, 1.94, 0.06, 1.94, z0, z0 + 0.09, 20, 0.12);
  for (const pu of [0.7, 1.1]) {
    iso.box(pu - 0.01, 1.9, pu + 0.05, 1.955, z0, z0 + 0.17, wallM);
    iso.box(pu - 0.016, 1.894, pu + 0.056, 1.961, z0 + 0.17, z0 + 0.185, capM);
    if (!kothi) dome(iso, pu + 0.02, 1.9275, z0 + 0.185, 0.03, trim, 'onion');
    else iso.ellipse(pu + 0.02, 1.9275, z0 + 0.2, 0.014, '#fff3c8', alpha('#6a5a3a', 0.6), 0.8);
  }
  // open iron gate leaves
  iso.poly([[0.76, 1.925, z0 + 0.005], [0.84, 1.99, z0 + 0.005], [0.84, 1.99, z0 + 0.12], [0.76, 1.925, z0 + 0.12]], alpha('#2a2a2e', 0.35), '#2a2a2e', 0.9);
  iso.poly([[1.08, 1.925, z0 + 0.005], [1.0, 1.99, z0 + 0.005], [1.0, 1.99, z0 + 0.12], [1.08, 1.925, z0 + 0.12]], alpha('#2a2a2e', 0.35), '#2a2a2e', 0.9);
}

/** Two cane chairs and a small table on the lawn. */
function caneChairs(iso: Iso, u: number, v: number, z: number): void {
  iso.cylinder(u + 0.06, v, 0.025, z, z + 0.035, '#8a5a34', '#9b6a40');
  for (const [cu, cv] of [[u, v - 0.02], [u + 0.1, v + 0.03]] as [number, number][]) {
    iso.lathe(cu, cv, z, [[0, 0.018], [0.03, 0.024], [0.032, 0]], () => C.cane, { outline: true });
    iso.box(cu - 0.02, cv - 0.02, cu + 0.02, cv - 0.012, z + 0.03, z + 0.06, mat(C.cane), { edges: false });
  }
}

// ============================================================================
// APARTMENT LOW (2×2): 4-storey DDA-style housing block
// ============================================================================

interface LowScheme {
  wall: string;
  band: string;
  balc: string;
  grille: string;
  door: string;
}

const LOW_SCHEMES: readonly LowScheme[] = [
  { wall: '#b0603f', band: '#eadcbc', balc: '#eadcbc', grille: '#2c2f33', door: '#6a4a2e' },
  { wall: '#e8dcc0', band: '#d9826a', balc: '#e8dcc0', grille: '#3a3a44', door: '#355f8a' },
  { wall: '#e7cf88', band: '#f4ecd6', balc: '#f4ecd6', grille: '#2f6a4a', door: '#7a3a2a' },
];

/** Breeze-block jali: a grid of small dark openings on a +v face. */
function jaliV(iso: Iso, v: number, u0: number, u1: number, z0: number, z1: number, dark: string): void {
  const s = 0.018;
  for (let z = z0 + 0.006; z + s * 0.6 < z1; z += s) {
    for (let u = u0 + 0.006; u + s * 0.6 < u1; u += s) iso.poly(iso.faceVQuad(v + 0.001, u, u + s * 0.55, z, z + s * 0.55), dark);
  }
}

function drawApartmentLow(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('apartment_low', variant);
  const S = LOW_SCHEMES[variant % LOW_SCHEMES.length];
  const z0 = 0.025;
  slab(iso, rng, 0.02, z0, '#b9ae98', '#8a7e68', ['#aca08a', '#c7bca6', '#9c917b']);
  // parking apron in front, lawn strips
  iso.poly(iso.topQuad(0.1, 1.28, 1.9, 1.9, z0 + 0.002), '#a9a397');
  paving(iso, rng, 0.1, 1.28, 1.9, 1.9, z0 + 0.002, 0.2, 0.3, alpha('#7d786c', 0.35));
  lawn(iso, rng, 1.78, 0.1, 1.92, 1.25, z0 + 0.002, C.grass);
  lawn(iso, rng, 0.1, 0.1, 0.22, 1.25, z0 + 0.002, C.grass);
  // back boundary wall
  const bw = mat('#e3d8c0', { right: -0.3 });
  iso.box(0.06, 0.06, 1.94, 0.09, z0, z0 + 0.07, bw);
  iso.box(0.06, 0.09, 0.09, 1.94, z0, z0 + 0.07, bw);
  iso.tree(1.84, 0.2, z0, 0.13, rng, 'neem');
  const U0 = 0.28;
  const V0 = 0.28;
  const U1 = 1.72;
  const V1 = 1.18;
  const F = 0.13;
  const zb = z0 + 0.03;
  const zt = zb + 4 * F;
  const bands = [zb + F, zb + 2 * F, zb + 3 * F];
  iso.aoRect(U0, V0, U1, V1, z0, 0.08, 0.45);
  iso.castShadow([[U0, V0], [U1, V0], [U1, V1], [U0, V1]], z0, (zt - z0) * 0.8, 0.16);
  iso.box(U0 - 0.01, V0 - 0.01, U1 + 0.01, V1 + 0.01, z0, zb, mat('#9d9585'));
  plasterBox(iso, rng, U0, V0, U1, V1, zb, zt, S.wall, { noTop: true, ao: false, weather: 30, bands, band: S.band, grimeH: 0.06, speck: variant === 0 ? 0.6 : 1 });
  if (variant === 0) {
    // DDA exposed-brick look: brick courses on the red panels
    coursesV(iso, rng, V1, U0, U1, zb, zt, 0.014, 0.04, alpha('#e2c7a4', 0.25), 0.5);
    coursesU(iso, rng, U1, V0, V1, zb, zt, 0.014, 0.04, alpha('#d8bd9a', 0.18), 0.5);
  }
  const core0 = 0.9;
  const core1 = 1.1;
  // --- +u face: windows, AC boxes, one balcony stack, downpipes ---
  for (let f = 0; f < 4; f++) {
    const z = zb + f * F;
    winU(iso, U1, V0 + 0.14, 0.04, z + 0.035, z + 0.1, { frame: S.band, grille: f === 0 ? S.grille : undefined, chhajja: '#c9c1b2' });
    winU(iso, U1, V1 - 0.14, 0.04, z + 0.035, z + 0.1, { frame: S.band, grille: S.grille, chhajja: '#c9c1b2' });
    if (f > 0) {
      doorU(iso, U1, V0 + 0.45, 0.035, z + 0.004, z + 0.105, S.door);
      balconyU(iso, rng, U1, V0 + 0.33, V0 + 0.6, z + 0.01, 0.065, S.balc, S.grille, { solid: rng() < 0.5 ? S.balc : undefined, laundry: true, cage: f === 1 && variant !== 1 });
    } else winU(iso, U1, V0 + 0.45, 0.04, z + 0.035, z + 0.1, { frame: S.band, grille: S.grille });
    if (rng() < 0.7) acU(iso, U1, V1 - 0.28, z + 0.05);
  }
  downpipeU(iso, U1, V0 + 0.25, zb, zt);
  downpipeU(iso, U1, V1 - 0.02, zb, zt);
  // --- +v face: two wings of flats either side of the stair core ---
  for (let f = 0; f < 4; f++) {
    const z = zb + f * F;
    for (const w0 of [U0, core1]) {
      const w1 = w0 === U0 ? core0 : U1;
      const bw0 = w0 + 0.05;
      const bw1 = w0 + 0.33;
      if (f === 0) {
        winV(iso, V1, w0 + 0.12, 0.045, z + 0.035, z + 0.1, { frame: S.band, grille: S.grille, chhajja: '#c9c1b2' });
        winV(iso, V1, w0 + 0.3, 0.045, z + 0.035, z + 0.1, { frame: S.band, grille: S.grille, chhajja: '#c9c1b2' });
      } else {
        doorV(iso, V1, w0 + 0.12, 0.035, z + 0.004, z + 0.105, S.door);
        winV(iso, V1, w0 + 0.25, 0.04, z + 0.035, z + 0.1, { frame: S.band, grille: S.grille });
        const r = rng();
        const kind = r < 0.3 ? 'cage' : r < 0.6 ? 'solid' : 'open';
        balconyV(iso, rng, V1, bw0, bw1, z + 0.01, 0.07, S.balc, S.grille, {
          solid: kind === 'solid' ? S.balc : undefined,
          cage: kind === 'cage',
          laundry: kind !== 'solid' || rng() < 0.5,
          plants: kind === 'solid',
        });
        if (kind === 'solid' && rng() < 0.6) dish(iso, bw1 - 0.03, V1 + 0.05, z + 0.045, 0.022);
      }
      winV(iso, V1, w1 - 0.1, 0.04, z + 0.035, z + 0.1, { frame: S.band, grille: S.grille, chhajja: '#c9c1b2' });
      if (f > 0 && rng() < 0.6) acV(iso, V1, w1 - 0.1, z + 0.004);
    }
  }
  // --- stair core with jali, rising above the roof as the mumty ---
  const cz1 = zt + 0.12;
  plasterBox(iso, rng, core0, V1 - 0.02, core1, V1 + 0.07, zb, cz1, S.band, { ao: false, weather: 6, grimeH: 0.04, speck: 0.7 });
  jaliV(iso, V1 + 0.07, core0 + 0.03, core1 - 0.03, zb + F * 0.6, zt - 0.02, '#3a342e');
  iso.poly(iso.faceVQuad(V1 + 0.071, core0 + 0.05, core1 - 0.05, zb, zb + 0.1), '#2a2622');
  iso.poly(iso.faceVQuad(V1 + 0.072, core0 + 0.03, core1 - 0.03, zb + 0.13, zb + 0.15), '#2f6aa8');
  iso.poly(iso.faceVQuad(V1 + 0.073, core0 + 0.04, core0 + 0.12, zb + 0.135, zb + 0.145), alpha('#fff', 0.85));
  // --- roof ---
  terrace(iso, rng, U0, V0, U1, V1, zt);
  iso.poly(iso.topQuad(core0, V1 - 0.02, core1, V1 + 0.07, cz1), shade(S.band, 0.1));
  parapet(iso, U0, V0, U1, V1, zt, 0.045, 0.022, S.wall, 'back', S.band);
  // tank platform with a row of Sintex tanks
  iso.box(U0 + 0.15, V0 + 0.06, U1 - 0.3, V0 + 0.2, zt, zt + 0.035, mat('#b8b0a2'));
  const nT = 5 + (variant % 2);
  for (let i = 0; i < nT; i++) {
    const tu = U0 + 0.22 + (i * (U1 - U0 - 0.6)) / (nT - 1);
    sintex(iso, tu, V0 + 0.13, zt + 0.035, 0.042, 0.075);
  }
  if (variant === 2) {
    // blue tarp shelter over part of the roof
    const t0 = U1 - 0.45;
    const t1 = U1 - 0.12;
    for (const [pu, pv] of [[t0, V1 - 0.12], [t1, V1 - 0.12], [t1, V0 + 0.35]] as [number, number][]) iso.line([pu, pv, zt], [pu, pv, zt + 0.1], '#6b4a2a', 1.3);
    iso.poly([[t0, V0 + 0.35, zt + 0.12], [t1, V0 + 0.35, zt + 0.1], [t1, V1 - 0.12, zt + 0.1], [t0, V1 - 0.12, zt + 0.12]], shade(C.tarpBlue, 0.08), alpha('#10203a', 0.6), 1);
  } else {
    clothesLine(iso, rng, [U1 - 0.5, V0 + 0.4, zt + 0.1], [U1 - 0.12, V0 + 0.6, zt + 0.1], LAUNDRY, zt);
  }
  clothesLine(iso, rng, [U0 + 0.12, V0 + 0.35, zt + 0.1], [U0 + 0.5, V0 + 0.55, zt + 0.1], LAUNDRY, zt);
  for (const [du, dv] of [[0.2, 0.7], [0.55, 0.75], [1.2, 0.3]] as [number, number][]) dish(iso, U0 + du, V0 + dv, zt, 0.03);
  pot(iso, rng, U0 + 0.7, V1 - 0.08, zt, 0.035, C.marigold);
  parapet(iso, U0, V0, U1, V1, zt, 0.045, 0.022, S.wall, 'front', S.band);
  // --- parking: cars, two-wheelers, trees, front wall with gate ---
  car(iso, 0.3, 1.36, z0, variant === 1 ? '#c7c9cc' : '#e9e6de');
  car(iso, 0.56, 1.36, z0, variant === 2 ? '#b23a2e' : '#3d5a8a');
  scooter(iso, 1.2, 1.32, z0, '#1e1e22');
  scooter(iso, 1.2, 1.37, z0, '#c8352e');
  scooter(iso, 1.2, 1.42, z0, '#e8e4da');
  car(iso, 1.42, 1.5, z0, '#8a8f94', true);
  iso.tree(1.84, 0.8, z0, 0.12, rng, 'ashoka');
  iso.tree(0.16, 0.7, z0, 0.12, rng, 'ashoka');
  iso.tree(0.2, 1.78, z0, 0.16, rng, 'neem');
  frontWall(iso, rng, 0.06, 1.94, z0, 0.08, '#e3d8c0', S.wall === '#e8dcc0' ? '#d9826a' : S.wall, [0.84, 1.16], '#2c2f33');
}

// ============================================================================
// APARTMENT HIGH (2×2): 12-storey group-housing tower on stilts
// ============================================================================

interface HighScheme {
  body: string;
  accent: string;
  rail: string;
  glass: string;
  board: string;
}

const HIGH_SCHEMES: readonly HighScheme[] = [
  { body: '#efe2c6', accent: '#c56f4c', rail: '#2e3238', glass: '#3a4a58', board: '#8c3b2b' },
  { body: '#e2cfa8', accent: '#8c3b2b', rail: '#3a6a6a', glass: '#2f4a52', board: '#2f6a5a' },
];

function drawApartmentHigh(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('apartment_high', variant);
  const S = HIGH_SCHEMES[variant % HIGH_SCHEMES.length];
  const z0 = 0.025;
  slab(iso, rng, 0.02, z0, '#c9bea8', '#8f8470', ['#bdb29c', '#d4c9b3']);
  // podium: paver drive around, lawns at the sides
  paving(iso, rng, 0.04, 0.04, 1.96, 1.96, z0, 0.12, 0.12, alpha('#8e8470', 0.3));
  lawn(iso, rng, 0.08, 0.08, 0.4, 1.5, z0 + 0.002, C.lawn);
  lawn(iso, rng, 1.6, 0.08, 1.92, 0.32, z0 + 0.002, C.lawn);
  lawn(iso, rng, 1.6, 1.5, 1.92, 1.92, z0 + 0.002, C.lawn);
  iso.poly(iso.topQuad(0.44, 1.5, 1.56, 1.96, z0 + 0.002), '#8e8a82');
  iso.tree(0.22, 0.22, z0, 0.13, rng, 'neem');
  iso.tree(0.2, 0.7, z0, 0.1, rng, 'ashoka');
  iso.tree(0.2, 1.1, z0, 0.1, rng, 'ashoka');
  iso.tree(1.78, 0.2, z0, 0.12, rng, 'peepal');
  const U0 = 0.52;
  const V0 = 0.42;
  const U1 = 1.48;
  const V1 = 1.36;
  const zs = z0 + 0.13; // stilt height
  const F = 0.1;
  const N = variant === 1 ? 11 : 12;
  const zt = zs + N * F;
  iso.aoRect(U0, V0, U1, V1, z0, 0.1, 0.5);
  iso.castShadow([[U0, V0], [U1, V0], [U1, V1], [U0, V1]], z0, 0.9, 0.14);
  // --- stilt parking: dark interior, parked cars, columns ---
  iso.poly(iso.topQuad(U0, V0, U1, V1, z0 + 0.003), '#6e6a62');
  iso.box(U0 + 0.3, V0 + 0.3, U0 + 0.5, V0 + 0.55, z0, zs, mat('#bdb3a0'));
  iso.poly(iso.faceVQuad(V0 + 0.55, U0 + 0.34, U0 + 0.46, z0, z0 + 0.1), '#8a9aa6');
  car(iso, U0 + 0.06, V0 + 0.62, z0, '#e9e6de', true);
  car(iso, U0 + 0.2, V0 + 0.62, z0, '#b23a2e', true);
  car(iso, U1 - 0.3, V0 + 0.6, z0, '#3d5a8a', true);
  scooter(iso, U1 - 0.16, V1 - 0.12, z0, '#1e1e22');
  iso.poly(iso.topQuad(U0, V0, U1, V1, zs - 0.001), alpha('#1a1614', 0.0));
  // soffit shadow
  iso.poly(iso.faceVQuad(V1, U0, U1, zs - 0.03, zs), alpha('#1a1410', 0.35));
  const colM = mat('#d8ccb4', { right: -0.32 });
  for (const cu of [U0, U0 + 0.46, U1 - 0.04]) iso.box(cu, V1 - 0.04, cu + 0.04, V1, z0, zs, colM);
  for (const cv of [V0, V0 + 0.45]) iso.box(U1 - 0.04, cv, U1, cv + 0.04, z0, zs, colM);
  // --- tower body ---
  iso.box(U0 - 0.01, V0 - 0.01, U1 + 0.01, V1 + 0.01, zs, zs + 0.02, mat('#9d9585'));
  plasterBox(iso, rng, U0, V0, U1, V1, zs + 0.02, zt, S.body, { noTop: true, ao: false, weather: 40, grimeH: 0, speck: 0.5 });
  // accent bands (painted full-height on the balcony stacks)
  const accV: [number, number][] = [[U0, U0 + 0.3], [U1 - 0.3, U1]];
  for (const [a, b] of accV) iso.poly(iso.faceVQuad(V1, a, b, zs + 0.02, zt), S.accent);
  iso.poly(iso.faceUQuad(U1, V0, V0 + 0.32, zs + 0.02, zt), shade(S.accent, -0.3));
  weatherV(iso, rng, V1, U0, U1, zs, zt, 26, 0.08);
  weatherU(iso, rng, U1, V0, V1, zs, zt, 26, 0.1);
  // service shaft (recessed duct with pipes and AC units): the Indian tower signature
  const sh0 = 0.94;
  const sh1 = 1.06;
  iso.poly(iso.faceVQuad(V1 + 0.001, sh0, sh1, zs + 0.02, zt), '#4a4540');
  for (const pu of [sh0 + 0.02, sh0 + 0.05, sh1 - 0.02]) iso.line([pu, V1 + 0.003, zs + 0.02], [pu, V1 + 0.003, zt], alpha('#b8bcbe', 0.9), 1.1);
  for (let f = 0; f < N; f++) {
    const z = zs + 0.02 + f * F;
    // floor slab lines
    iso.poly(iso.faceVQuad(V1 + 0.001, U0, U1, z + F - 0.008, z + F), alpha(shade(S.body, -0.35), 0.5));
    iso.poly(iso.faceUQuad(U1 + 0.001, V0, V1, z + F - 0.008, z + F), alpha('#2a2018', 0.35));
    // +u face: balcony stack at the back, windows front
    doorU(iso, U1, V0 + 0.16, 0.035, z + 0.005, z + 0.08, '#6a5040');
    winU(iso, U1, V0 + 0.5, 0.05, z + 0.03, z + 0.08, { glass: S.glass, frame: '#d8d0c0' });
    winU(iso, U1, V0 + 0.76, 0.05, z + 0.03, z + 0.08, { glass: S.glass, frame: '#d8d0c0' });
    if ((f + variant) % 3 !== 0) acU(iso, U1, V0 + 0.63, z + 0.02);
    // +v face windows between the stacks
    winV(iso, V1, 0.88, 0.035, z + 0.03, z + 0.08, { glass: S.glass, frame: '#e8e0d0' });
    winV(iso, V1, 1.12, 0.035, z + 0.03, z + 0.08, { glass: S.glass, frame: '#e8e0d0' });
    if (f % 2 === 0) acV(iso, V1, (sh0 + sh1) / 2, z + 0.02);
    // balconies on the stacks (drawn bottom-up)
    for (const [a, b] of accV) {
      doorV(iso, V1, a + 0.1, 0.035, z + 0.005, z + 0.08, '#3a4450');
      winV(iso, V1, a + 0.22, 0.03, z + 0.03, z + 0.08, { glass: S.glass });
      const r = rng();
      balconyV(iso, rng, V1, a + 0.02, b - 0.02, z + 0.012, 0.055, '#e6ddcc', S.rail, { laundry: r < 0.45, plants: r > 0.8, cage: r > 0.45 && r < 0.55 });
    }
    balconyU(iso, rng, U1, V0 + 0.03, V0 + 0.29, z + 0.012, 0.055, '#e6ddcc', S.rail, { laundry: rng() < 0.4 });
  }
  // --- crown: parapet, lift machine room, tank room, pergola fins, society board ---
  iso.poly(iso.topQuad(U0, V0, U1, V1, zt), '#bfb6a4');
  parapet(iso, U0, V0, U1, V1, zt, 0.05, 0.025, S.body, 'back', S.accent);
  plasterBox(iso, rng, U0 + 0.3, V0 + 0.2, U0 + 0.66, V0 + 0.55, zt, zt + 0.16, S.body, { weather: 6, grimeH: 0, speck: 0.4 });
  iso.box(U0 + 0.34, V0 + 0.24, U0 + 0.62, V0 + 0.5, zt + 0.16, zt + 0.22, mat('#c9c2b4'));
  sintex(iso, U0 + 0.4, V0 + 0.33, zt + 0.22, 0.05, 0.08);
  sintex(iso, U0 + 0.54, V0 + 0.4, zt + 0.22, 0.05, 0.08);
  dish(iso, U1 - 0.15, V0 + 0.15, zt, 0.035);
  // mobile tower mast
  iso.line([U1 - 0.12, V0 + 0.5, zt], [U1 - 0.12, V0 + 0.5, zt + 0.3], '#8a8f94', 1.6);
  for (const dz of [0.22, 0.27]) iso.box(U1 - 0.135, V0 + 0.485, U1 - 0.105, V0 + 0.515, zt + dz, zt + dz + 0.03, mat('#e6e3dc'), { edges: false });
  parapet(iso, U0, V0, U1, V1, zt, 0.05, 0.025, S.body, 'front', S.accent);
  // pergola fins + top beam on the front corner
  for (let u = U1 - 0.3; u <= U1 - 0.02; u += 0.07) iso.box(u, V1 - 0.02, u + 0.02, V1, zt + 0.05, zt + 0.14, mat(S.accent));
  iso.box(U1 - 0.31, V1 - 0.03, U1, V1, zt + 0.14, zt + 0.16, mat(S.accent));
  // society name board on the crown
  iso.box(U0 + 0.05, V1, U0 + 0.4, V1 + 0.012, zt - 0.06, zt + 0.04, mat(S.board));
  iso.poly(iso.faceVQuad(V1 + 0.013, U0 + 0.08, U0 + 0.37, zt - 0.02, zt + 0.015), alpha('#f7ecd0', 0.9));
  // --- society gate, guard cabin, front wall ---
  iso.box(1.62, 1.62, 1.8, 1.78, z0, z0 + 0.11, mat('#e8dcc2'));
  winV(iso, 1.78, 1.66, 0.025, z0 + 0.05, z0 + 0.09, { glass: '#3a4a58', frame: '#f7f0de' });
  iso.box(1.6, 1.6, 1.82, 1.8, z0 + 0.11, z0 + 0.125, mat(S.accent));
  car(iso, 0.7, 1.62, z0, '#e9e6de');
  car(iso, 0.92, 1.66, z0, '#c7c9cc');
  frontWall(iso, rng, 0.04, 1.96, z0, 0.08, '#e8dcc2', S.accent, [1.1, 1.52], '#2c2f33');
  // gate arch with the society board
  for (const gu of [1.06, 1.52]) iso.box(gu, 1.92, gu + 0.04, 1.96, z0, z0 + 0.22, mat(S.body));
  iso.box(1.06, 1.925, 1.56, 1.96, z0 + 0.22, z0 + 0.27, mat(S.board));
  iso.poly(iso.faceVQuad(1.961, 1.1, 1.52, z0 + 0.23, z0 + 0.26), alpha('#f7ecd0', 0.85));
  iso.tree(0.24, 1.76, z0, 0.14, rng, 'neem');
  iso.tree(1.78, 1.2, z0, 0.1, rng, 'ashoka');
}

// ============================================================================
// CABIN HOUSE (1×1): village mud hut
// ============================================================================

/** India Mark II hand pump on a small concrete apron. */
function handPump(iso: Iso, u: number, v: number, z: number): void {
  iso.box(u - 0.06, v - 0.06, u + 0.06, v + 0.06, z, z + 0.012, mat('#b8b2a4'));
  iso.poly(iso.topQuad(u - 0.045, v - 0.045, u + 0.045, v + 0.045, z + 0.0125), alpha('#5f7f8a', 0.45));
  iso.cylinder(u, v, 0.014, z + 0.012, z + 0.1, '#3f6f96');
  iso.cylinder(u, v, 0.02, z + 0.1, z + 0.12, '#3f6f96');
  iso.line([u, v, z + 0.115], [u - 0.07, v, z + 0.095], '#2a3a4a', 1.6);
  iso.line([u, v + 0.012, z + 0.08], [u, v + 0.04, z + 0.075], '#2a3a4a', 1.8);
}

/** A white zebu cow standing along u, tethered to a peg. */
function cow(iso: Iso, u: number, v: number, z: number): void {
  iso.aoRect(u, v, u + 0.12, v + 0.045, z, 0.02, 0.35);
  for (const [lu, lv] of [[0.015, 0.008], [0.1, 0.008], [0.015, 0.037], [0.1, 0.037]] as [number, number][]) iso.line([u + lu, v + lv, z], [u + lu, v + lv, z + 0.035], '#8a8478', 1.6);
  const m = mat('#eeeae2', { right: -0.25 });
  iso.box(u + 0.005, v, u + 0.11, v + 0.045, z + 0.032, z + 0.07, m);
  iso.box(u + 0.03, v + 0.012, u + 0.05, v + 0.033, z + 0.07, z + 0.082, m, { edges: false }); // hump
  iso.box(u + 0.11, v + 0.01, u + 0.14, v + 0.035, z + 0.045, z + 0.075, m);
  iso.line([u + 0.125, v + 0.012, z + 0.075], [u + 0.13, v + 0.004, z + 0.095], '#6a5a44', 1.2);
  iso.line([u + 0.125, v + 0.033, z + 0.075], [u + 0.13, v + 0.041, z + 0.095], '#6a5a44', 1.2);
  iso.line([u, v + 0.022, z + 0.065], [u - 0.01, v + 0.022, z + 0.03], '#8a8478', 1);
  iso.line([u + 0.14, v + 0.022, z + 0.05], [u + 0.18, v + 0.03, z], alpha('#5a4a30', 0.8), 0.7);
  iso.line([u + 0.18, v + 0.03, z], [u + 0.18, v + 0.03, z + 0.03], '#5a3a22', 1.6);
}

function drawCabinHouse(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('cabin_house', variant);
  const tiles = variant === 1;
  const z0 = 0.015;
  slab(iso, rng, 0.02, z0, '#b49668', '#86694a', ['#a88a5e', '#c2a476', alpha('#6c7a3a', 0.6), '#9a7c52']);
  // cow-dung plastered aangan in front of the hut
  iso.poly(iso.topQuad(0.1, 0.56, 0.9, 0.92, z0 + 0.001), '#a9875a');
  iso.speckle(iso.topQuad(0.1, 0.56, 0.9, 0.92, z0 + 0.001), rng, 120, [alpha('#8a6a42', 0.5), alpha('#c7a778', 0.5)], 1.4);
  iso.tree(0.84, 0.14, z0, 0.14, rng, 'neem');
  // bamboo fence along the back edges
  const fence = (a: P3, b: P3) => {
    iso.line([a[0], a[1], z0 + 0.05], [b[0], b[1], z0 + 0.05], '#8a6a3a', 1);
    iso.line([a[0], a[1], z0 + 0.025], [b[0], b[1], z0 + 0.025], '#8a6a3a', 1);
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z0];
      iso.line(p, [p[0], p[1], z0 + 0.065], '#9a7a44', 1.1);
    }
  };
  fence([0.05, 0.05, 0], [0.95, 0.05, 0]);
  fence([0.05, 0.05, 0], [0.05, 0.95, 0]);
  const u0 = 0.16;
  const v0 = 0.14;
  const u1 = 0.62;
  const v1 = 0.52;
  const zw = z0 + 0.14;
  const mud = tiles ? '#b77f55' : '#bf9460';
  iso.castShadow([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], z0, 0.26, 0.15);
  iso.aoRect(u0, v0, u1, v1, z0, 0.05, 0.45);
  // raised mud plinth
  iso.box(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, z0, z0 + 0.018, mat('#a47e52'));
  plasterBox(iso, rng, u0, v0, u1, v1, z0 + 0.018, zw, mud, { weather: 6, grimeH: 0.03, speck: 1.6, ao: false });
  // geru (red ochre) dado with white lime mandana dots
  iso.poly(iso.faceVQuad(v1, u0, u1, z0 + 0.018, z0 + 0.05), '#a8452e');
  iso.poly(iso.faceUQuad(u1, v0, v1, z0 + 0.018, z0 + 0.05), shade('#a8452e', -0.3));
  for (let u = u0 + 0.015; u < u1; u += 0.025) {
    iso.ellipse(u, v1 + 0.001, z0 + 0.034, 0.004, '#f4eee0');
    iso.line([u, v1 + 0.001, z0 + 0.052], [u + 0.012, v1 + 0.001, z0 + 0.062], alpha('#f4eee0', 0.9), 0.8);
    iso.line([u + 0.012, v1 + 0.001, z0 + 0.062], [u + 0.025, v1 + 0.001, z0 + 0.052], alpha('#f4eee0', 0.9), 0.8);
  }
  doorV(iso, v1, u0 + 0.18, 0.04, z0 + 0.018, z0 + 0.12, '#6a4424', { frame: '#8a6a44' });
  winU(iso, u1, v0 + 0.14, 0.03, z0 + 0.06, z0 + 0.1, { glass: '#2a2018', grille: '#6a4a2a' });
  // dung cakes drying on the +u wall
  for (let i = 0; i < 7; i++) {
    const cv = v0 + 0.22 + (i % 4) * 0.035;
    const cz = z0 + 0.065 + Math.floor(i / 4) * 0.035;
    const pts: P3[] = [];
    for (let k = 0; k < 8; k++) pts.push([u1 + 0.002, cv + Math.cos((k / 8) * Math.PI * 2) * 0.012, cz + Math.sin((k / 8) * Math.PI * 2) * 0.012]);
    iso.poly(pts, '#6a5236', alpha('#3a2a1a', 0.6), 0.5);
  }
  // ---- roof ----
  const o = 0.05;
  const ra = u0 - o;
  const rb = u1 + o;
  const va = v0 - o;
  const vb = v1 + o;
  const vc = (v0 + v1) / 2;
  if (!tiles) {
    // thatched hip roof, ridge along u
    const zr = zw + 0.17;
    const ua = u0 + 0.12;
    const ub = u1 - 0.12;
    const ze = zw - 0.02;
    const thatch = '#c9a45c';
    const back: P3[] = [[ra, va, ze], [rb, va, ze], [ub, vc, zr], [ua, vc, zr]];
    const left: P3[] = [[ra, va, ze], [ra, vb, ze], [ua, vc, zr]];
    const right: P3[] = [[rb, va, ze], [rb, vb, ze], [ub, vc, zr]];
    const front: P3[] = [[ra, vb, ze], [rb, vb, ze], [ub, vc, zr], [ua, vc, zr]];
    iso.poly(back, shade(thatch, -0.1));
    iso.poly(left, shade(thatch, -0.05));
    iso.poly(right, shade(thatch, -0.3), alpha('#4a3418', 0.6), 1);
    iso.poly(front, thatch, alpha('#4a3418', 0.6), 1);
    // straw strokes running down the slopes
    iso.clipped(front, () => {
      for (let i = 0; i < 60; i++) {
        const t = rng();
        const pu = ra + (rb - ra) * t;
        const topU = ua + (ub - ua) * t;
        const s = 0.3 + rng() * 0.6;
        iso.line([pu, vb, ze], [pu + (topU - pu) * s, vb + (vc - vb) * s, ze + (zr - ze) * s], alpha(rng() < 0.5 ? '#8e6f3a' : '#e8cf8a', 0.6), 0.8);
      }
    });
    iso.clipped(right, () => {
      for (let i = 0; i < 30; i++) {
        const t = rng();
        const pv = va + (vb - va) * t;
        const s = 0.3 + rng() * 0.6;
        iso.line([rb, pv, ze], [rb + (ub - rb) * s, pv + (vc - pv) * s, ze + (zr - ze) * s], alpha(rng() < 0.5 ? '#6e5228' : '#c9a860', 0.6), 0.8);
      }
    });
    // shaggy eave fringe
    for (let u = ra; u < rb; u += 0.012) iso.line([u, vb, ze], [u, vb, ze - 0.012 - rng() * 0.01], alpha('#8e6f3a', 0.8), 0.8);
    for (let v = va; v < vb; v += 0.012) iso.line([rb, v, ze], [rb, v, ze - 0.012 - rng() * 0.01], alpha('#6e5228', 0.8), 0.8);
    // ridge roll + bamboo ties
    iso.line([ua, vc, zr + 0.004], [ub, vc, zr + 0.004], '#7a5a2a', 3);
    iso.line([ua, vc, zr + 0.007], [ub, vc, zr + 0.007], '#b8934e', 1.2);
    for (let u = ua; u <= ub + 1e-6; u += (ub - ua) / 3) iso.line([u, vc - 0.015, zr], [u, vc + 0.015, zr], '#5a3a1a', 1.2);
    // a gourd vine climbing onto the roof
    iso.blob(iso.sx(ra + 0.1, vb - 0.02), iso.sy(ra + 0.1, vb - 0.02, ze + 0.03), iso.T * 0.03, '#5d8f30', 0.4);
    iso.ellipse(ra + 0.12, vb - 0.03, ze + 0.05, 0.012, '#e8e0b0');
  } else {
    // khaprail (clay tile) gable roof, ridge along u, gable end on +u
    const zr = zw + 0.13;
    const tile = '#b5583a';
    // gable triangle
    iso.poly([[u1, v0, zw], [u1, v1, zw], [u1, vc, zr - 0.01]], shade(mud, -0.3), alpha('#3a2616', 0.5), 1);
    iso.poly([[ra, va, zw - 0.02], [rb, va, zw - 0.02], [rb, vc, zr], [ra, vc, zr]], shade(tile, -0.2));
    const front: P3[] = [[ra, vb, zw - 0.02], [rb, vb, zw - 0.02], [rb, vc, zr], [ra, vc, zr]];
    iso.poly(front, tile, alpha('#3a1a10', 0.6), 1);
    iso.clipped(front, () => {
      // tile courses (rows) and channels (ridges down the slope)
      for (let t = 0.08; t < 1; t += 0.1) {
        const vv = vb + (vc - vb) * t;
        const zz = zw - 0.02 + (zr - zw + 0.02) * t;
        iso.line([ra, vv, zz], [rb, vv, zz], alpha('#6a2a18', 0.55), 0.9);
      }
      for (let u = ra + 0.01; u < rb; u += 0.02) {
        iso.line([u, vb, zw - 0.02], [u, vc, zr], alpha('#e08a62', 0.5), 1.1);
        iso.line([u + 0.006, vb, zw - 0.02], [u + 0.006, vc, zr], alpha('#6a2a18', 0.4), 0.7);
      }
      for (let i = 0; i < 8; i++) {
        const t = rng();
        iso.ellipse(ra + rng() * (rb - ra), vb + (vc - vb) * t, zw - 0.02 + (zr - zw + 0.02) * t, 0.02 + rng() * 0.02, alpha(rng() < 0.5 ? '#5a4a3a' : '#6a7a3a', 0.25));
      }
    });
    // barge board on the gable end
    iso.line([rb, vb, zw - 0.02], [rb, vc, zr], '#6a4424', 2);
    iso.line([rb, va, zw - 0.02], [rb, vc, zr], alpha('#6a4424', 0.7), 1.6);
    iso.line([ra, vc, zr + 0.006], [rb, vc, zr + 0.006], '#8a3a22', 3);
    // pumpkins drying on the roof
    iso.ellipse(ra + 0.14, vc + 0.08, zr - 0.04, 0.02, '#e0902a', alpha('#6a3a10', 0.6), 0.8);
    iso.ellipse(ra + 0.2, vc + 0.1, zr - 0.05, 0.016, '#d8a030', alpha('#6a3a10', 0.6), 0.8);
  }
  // ---- aangan props ----
  // clay pots (matka) by the door
  for (const [mu, mv] of [[0.24, 0.6], [0.28, 0.62]] as [number, number][]) {
    iso.lathe(mu, mv, z0, [[0, 0.01], [0.012, 0.022], [0.028, 0.02], [0.036, 0.01], [0.04, 0.011]], () => '#b0603a', { outline: true });
  }
  // chulha with a whisp of smoke
  iso.box(0.12, 0.66, 0.2, 0.72, z0, z0 + 0.03, mat('#9a6a42'));
  iso.poly(iso.topQuad(0.135, 0.675, 0.185, 0.705, z0 + 0.031), '#2a1a12');
  iso.ellipse(0.16, 0.69, z0 + 0.032, 0.01, alpha('#ff8a2a', 0.8));
  for (let i = 0; i < 4; i++) iso.ellipse(0.16 + i * 0.02, 0.69 - i * 0.02, z0 + 0.06 + i * 0.05, 0.02 + i * 0.01, alpha('#e8e4dc', 0.28 - i * 0.05));
  charpai(iso, 0.44, 0.62, z0);
  handPump(iso, 0.8, 0.44, z0);
  if (!tiles) {
    // haystack
    iso.lathe(0.78, 0.78, z0, [[0, 0.1], [0.05, 0.1], [0.12, 0.07], [0.18, 0.03], [0.21, 0]], (t) => (t > 0.85 ? '#a8843e' : '#d4b060'), { outline: true, lit: 0.22 });
    iso.line([0.78, 0.78, z0 + 0.21], [0.78, 0.78, z0 + 0.26], '#6a4a2a', 1.4);
    cow(iso, 0.3, 0.8, z0);
  } else {
    cow(iso, 0.56, 0.78, z0);
    // tulsi chaura + a line of washing
    iso.box(0.16, 0.8, 0.24, 0.88, z0, z0 + 0.05, mat('#e8dcc4'));
    iso.poly(iso.faceVQuad(0.88, 0.17, 0.23, z0 + 0.015, z0 + 0.035), '#c0392b');
    iso.tree(0.2, 0.84, z0 + 0.05, 0.035, rng, 'shrub');
    clothesLine(iso, rng, [0.66, 0.6, 0.14], [0.94, 0.62, 0.14], ['#e4572e', '#f2c14e', '#3a86c8', '#b44ca0']);
  }
  iso.tree(0.08, 0.88, z0, 0.07, rng, 'shrub');
}

// ============================================================================
// Registry
// ============================================================================

export const RESIDENTIAL_SPRITES: Record<string, ProceduralSpriteDef> = {
  house_small: { footprint: 1, variants: 4, heightTiles: 0.27, draw: drawHouseSmall },
  house_medium: { footprint: 1, variants: 3, heightTiles: 0.4, draw: drawHouseMedium },
  mansion: { footprint: 2, variants: 2, heightTiles: 0.27, draw: drawMansion },
  apartment_low: { footprint: 2, variants: 3, heightTiles: 0.24, draw: drawApartmentLow },
  apartment_high: { footprint: 2, variants: 2, heightTiles: 0.64, draw: drawApartmentHigh },
  cabin_house: { footprint: 1, variants: 2, heightTiles: 0.12, draw: drawCabinHouse },
};
