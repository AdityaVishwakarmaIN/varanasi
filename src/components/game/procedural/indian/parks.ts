/**
 * Indian-style procedural art: parks buildings.
 * See ./index.ts for the drawing contract.
 *
 * Mughal char-bagh gardens with water channels and chhatris, lush peepal / neem / banyan / ashoka
 * trees, stone benches, a chabutra shrine under a tree, a gaushala, kund (stepped tank), sandstone
 * gateway, plant nursery, boat jetty with Ganga rowing boats, and hill-station lodges.
 */
import { alpha, mat, seededRng, shade, type Ctx2D, type Iso, type P3 } from '../isoPainter';
import {
  C,
  chhatri,
  caneUmbrella,
  charpai,
  coursesU,
  coursesV,
  dome,
  drum,
  flag,
  ghatSteps,
  grime,
  lawn,
  makeIso,
  merlons,
  compoundWall,
  OUTLINE,
  hut,
  offerings,
  paving,
  slab,
  waterSurface,
  weatherV,
  windowU,
  windowV,
  type ProceduralSpriteDef,
  type Tread,
} from '../varanasiSprites';
import {
  P,
  bench,
  bollard,
  chabutra,
  cow,
  flowerBed,
  gravelPath,
  hauz,
  hedge,
  kalava,
  lampPost,
  lushTree,
  person,
  plankDeck,
  planter,
  rope,
  rowBoat,
  waterChannel,
  type Rng,
} from './parksKit';

// ============================================================================
// Shared bits
// ============================================================================

/** Lawn plot filling the footprint (thin earth slab + striped lawn). Returns the lawn height. */
function lawnPlot(iso: Iso, rng: Rng, base: string = C.lawn): number {
  const z0 = 0.02;
  const n = iso.n;
  slab(iso, rng, 0.015, z0, base, C.earthDark);
  if (n === 1) {
    lawn(iso, rng, 0.015, 0.015, n - 0.015, n - 0.015, z0, base);
    return z0;
  }
  // big plots: same striped lawn with coarser, sparser grain (keeps the paint budget flat)
  const pts = iso.topQuad(0.015, 0.015, n - 0.015, n - 0.015, z0);
  iso.poly(pts, base);
  iso.clipped(pts, () => {
    const stripe = alpha(shade(base, 0.08), 0.5);
    for (let u = 0.015; u < n; u += 0.16) iso.poly(iso.topQuad(u, 0.015, Math.min(u + 0.08, n - 0.015), n - 0.015, z0), stripe);
  });
  iso.speckle(pts, rng, Math.round(700 * n), [shade(base, 0.18), shade(base, -0.18), shade(base, -0.1), '#9cbc5a'], 1.6);
  return z0;
}

/**
 * Park boundary: cream plinth wall with green-painted iron railings. `part` 'back' draws the two
 * far sides, 'front' the two near sides (with an optional gap on the +v side, spanning u ∈ gap).
 */
function railing(iso: Iso, z: number, part: 'back' | 'front', gap?: [number, number], inset = 0.03): void {
  const n = iso.n;
  const lo = inset;
  const hi = n - inset;
  const t = 0.018;
  const ph = 0.022;
  const rh = 0.07;
  const plinth = mat(C.cream, { right: -0.3 });
  const iron = '#2f5a3a';
  const run = (a0: number, a1: number, along: 'u' | 'v', c: number) => {
    // plinth
    if (along === 'u') iso.box(a0, c - t / 2, a1, c + t / 2, z, z + ph, plinth);
    else iso.box(c - t / 2, a0, c + t / 2, a1, z, z + ph, plinth);
    // bars + rails
    const zb = z + ph;
    for (let a = a0 + 0.012; a < a1; a += 0.024) {
      const p: P3 = along === 'u' ? [a, c, zb] : [c, a, zb];
      iso.line(p, [p[0], p[1], zb + rh], iron, 1.1);
    }
    const s: P3 = along === 'u' ? [a0, c, 0] : [c, a0, 0];
    const e: P3 = along === 'u' ? [a1, c, 0] : [c, a1, 0];
    for (const hh of [0.012, rh - 0.004]) iso.line([s[0], s[1], zb + hh], [e[0], e[1], zb + hh], iron, 1.3);
    iso.line([s[0], s[1], zb + rh], [e[0], e[1], zb + rh], alpha('#9cc0a0', 0.6), 0.6);
    // piers
    for (const a of [a0, a1]) {
      const p = along === 'u' ? [a, c] : [c, a];
      iso.boxLit(p[0] - 0.014, p[1] - 0.014, p[0] + 0.014, p[1] + 0.014, z, zb + rh + 0.012, mat(C.cream, { right: -0.3 }));
      iso.box(p[0] - 0.018, p[1] - 0.018, p[0] + 0.018, p[1] + 0.018, zb + rh + 0.012, zb + rh + 0.02, mat(C.govMaroon));
    }
  };
  if (part === 'back') {
    run(lo, hi, 'u', lo);
    run(lo, hi, 'v', lo);
  } else {
    run(lo, hi, 'v', hi);
    if (gap) {
      run(lo, gap[0], 'u', hi);
      run(gap[1], hi, 'u', hi);
    } else run(lo, hi, 'u', hi);
  }
}

// ============================================================================
// PARK (1×1): three small neighbourhood gardens
// ============================================================================

function drawPark(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('park', variant);
  const z = lawnPlot(iso, rng, variant === 1 ? '#78a444' : C.lawn);
  if (variant === 0) {
    // mini char-bagh: cross paths meeting at a stone hauz with a fountain
    railing(iso, z, 'back');
    gravelPath(iso, rng, 0.05, 0.45, 0.95, 0.55, z);
    gravelPath(iso, rng, 0.45, 0.05, 0.55, 0.95, z);
    for (const [u0, v0] of [[0.1, 0.1], [0.6, 0.1], [0.1, 0.6], [0.6, 0.6]] as [number, number][]) {
      hedge(iso, rng, u0, v0, u0 + 0.3, v0 + 0.02, z, 0.02);
      hedge(iso, rng, u0, v0 + 0.02, u0 + 0.02, v0 + 0.3, z, 0.02);
    }
    lushTree(iso, rng, 0.22, 0.2, z, 0.13, 'neem');
    flowerBed(iso, rng, 0.62, 0.14, 0.88, 0.38, z, P.flowers, C.chunarDeep, 0.7);
    hauz(iso, rng, 0.38, 0.38, 0.62, 0.62, z, 0.03);
    bench(iso, 0.3, 0.57, z, 'u');
    bench(iso, 0.57, 0.3, z, 'v');
    flowerBed(iso, rng, 0.14, 0.64, 0.38, 0.88, z, ['#d9433a', '#e86fa0', '#f7f1e3'], C.chunarDeep, 0.7);
    lushTree(iso, rng, 0.78, 0.76, z, 0.07, 'cypress');
    person(iso, rng, 0.52, 0.75, z);
    lampPost(iso, 0.58, 0.9, z, 0.16);
    railing(iso, z, 'front', [0.44, 0.56]);
  } else if (variant === 1) {
    // a great peepal on a shrine chabutra, gravel ring, benches and strollers
    railing(iso, z, 'back');
    gravelPath(iso, rng, 0.08, 0.08, 0.92, 0.2, z);
    gravelPath(iso, rng, 0.08, 0.2, 0.2, 0.92, z);
    gravelPath(iso, rng, 0.2, 0.8, 0.92, 0.92, z);
    gravelPath(iso, rng, 0.8, 0.2, 0.92, 0.8, z);
    bench(iso, 0.55, 0.23, z, 'u');
    flowerBed(iso, rng, 0.62, 0.3, 0.76, 0.5, z);
    const zt = chabutra(iso, rng, 0.46, 0.5, z, 0.16);
    lushTree(iso, rng, 0.46, 0.5, zt, 0.24, 'peepal');
    kalava(iso, 0.46, 0.5, zt, 0.032);
    person(iso, rng, 0.32, 0.72, zt, true, '#f39b1d');
    bench(iso, 0.24, 0.55, z, 'v');
    person(iso, rng, 0.62, 0.86, z);
    person(iso, rng, 0.86, 0.5, z);
    lampPost(iso, 0.85, 0.86, z, 0.17);
    railing(iso, z, 'front', [0.4, 0.55]);
  } else {
    // walking-track park: gulmohar, ashoka avenue, stone chhatri
    railing(iso, z, 'back');
    const t0 = 0.12;
    const t1 = 0.88;
    const tw = 0.07;
    gravelPath(iso, rng, t0, t0, t1, t0 + tw, z, '#c89a74');
    gravelPath(iso, rng, t0, t0 + tw, t0 + tw, t1, z, '#c89a74');
    gravelPath(iso, rng, t0 + tw, t1 - tw, t1, t1, z, '#c89a74');
    gravelPath(iso, rng, t1 - tw, t0 + tw, t1, t1 - tw, z, '#c89a74');
    lushTree(iso, rng, 0.07, 0.3, z, 0.05, 'ashoka');
    lushTree(iso, rng, 0.07, 0.55, z, 0.05, 'ashoka');
    chhatri(iso, rng, 0.3, 0.3, z, 0.16, C.chunar, shade(C.chunar, 0.03));
    lushTree(iso, rng, 0.7, 0.34, z, 0.16, 'gulmohar');
    flowerBed(iso, rng, 0.3, 0.6, 0.52, 0.72, z, ['#f5a623', '#e0761a', '#f2d04e']);
    lushTree(iso, rng, 0.07, 0.8, z, 0.05, 'ashoka');
    bench(iso, 0.55, 0.64, z, 'v');
    person(iso, rng, 0.84, 0.6, z);
    person(iso, rng, 0.45, 0.84, z, false, '#e8e3d9');
    railing(iso, z, 'front');
  }
}

// ============================================================================
// KUND (pond_park, 1×1): stepped sandstone tank
// ============================================================================

/**
 * Stepped tank recessed into a paved square. Levels descend from `outer` (inset) by `step`
 * each, each nested level clipped to the opening above so the front walls hide what lies below.
 */
function kund(iso: Iso, rng: Rng, cu: number, cv: number, half: number, z0: number, levels: number, stone: string, waterLevels = 2): void {
  const { ctx } = iso;
  const dz = 0.03;
  const di = (half - 0.08) / levels;
  ctx.save();
  for (let k = 0; k < levels; k++) {
    const i0 = half - k * di;
    const i1 = i0 - di;
    const zt = z0 - k * dz;
    const zb = zt - dz;
    // clip to the opening at this level's top
    iso.path(iso.topQuad(cu - i0, cv - i0, cu + i0, cv + i0, zt));
    ctx.clip();
    if (k >= levels - waterLevels) {
      if (k === levels - waterLevels) {
        const wz = zt - dz * 0.4;
        // back walls down into the water, then the water surface
        iso.poly(iso.faceUQuad(cu - i0, cv - i0, cv + i0, wz - 0.05, zt), shade(stone, -0.34));
        iso.poly(iso.faceVQuad(cv - i0, cu - i0, cu + i0, wz - 0.05, zt), shade(stone, -0.1));
        const wpts = iso.topQuad(cu - i0, cv - i0, cu + i0, cv + i0, wz);
        waterSurface(iso, rng, wpts, P.pool, P.poolDeep);
        // submerged steps, faintly
        for (let s = 1; s < 3; s++) iso.poly(iso.topQuad(cu - i0 + s * di * 0.8, cv - i0 + s * di * 0.8, cu + i0 - s * di * 0.8, cv + i0 - s * di * 0.8, wz), null, alpha('#bfe0da', 0.25), 0.8);
        // wet band + reflections
        iso.poly(iso.faceUQuad(cu - i0, cv - i0, cv + i0, wz, wz + 0.01), alpha('#3f4a33', 0.45));
        iso.poly(iso.faceVQuad(cv - i0, cu - i0, cu + i0, wz, wz + 0.01), alpha('#3f4a33', 0.4));
        for (let l = 0; l < 5; l++) {
          const pu = cu - i0 * 0.6 + rng() * i0 * 1.2;
          const pv = cv - i0 * 0.6 + rng() * i0 * 1.2;
          iso.ellipse(pu, pv, wz + 0.001, 0.014 + rng() * 0.01, '#4f8a38', alpha('#2f5a22', 0.7), 0.6);
          if (l % 2 === 0) iso.ellipse(pu - 0.002, pv, wz + 0.004, 0.006, '#f3a6c4', alpha('#b0506e', 0.6), 0.5);
        }
      }
      break;
    }
    // riser walls on the two far sides of the NEXT level (visible, facing the viewer)
    iso.poly(iso.faceUQuad(cu - i1, cv - i1, cv + i1, zb, zt), shade(stone, -0.3));
    iso.poly(iso.faceVQuad(cv - i1, cu - i1, cu + i1, zb, zt), shade(stone, -0.06));
    // tread (ring) at zt: fill the full square, the next level overdraws the middle
    const tread = iso.topQuad(cu - i0, cv - i0, cu + i0, cv + i0, zt);
    iso.poly(tread, shade(stone, 0.02 - k * 0.04));
    iso.line([cu - i1, cv - i1, zt], [cu + i1, cv - i1, zt], alpha('#fff0cf', 0.55), 0.9);
    iso.line([cu - i1, cv - i1, zt], [cu - i1, cv + i1, zt], alpha('#fff0cf', 0.4), 0.9);
    // treads are drawn full; paint the back risers of the next level again on top
    iso.poly(iso.faceUQuad(cu - i1, cv - i1, cv + i1, zb, zt), shade(stone, -0.3 - k * 0.03));
    iso.poly(iso.faceVQuad(cv - i1, cu - i1, cu + i1, zb, zt), shade(stone, -0.06 - k * 0.03));
    coursesU(iso, rng, cu - i1, cv - i1, cv + i1, zb, zt, dz / 2, 0.06, alpha('#3a2616', 0.22), 0.6);
    coursesV(iso, rng, cv - i1, cu - i1, cu + i1, zb, zt, dz / 2, 0.06, alpha('#3a2616', 0.22), 0.6);
    // AO where tread meets the riser
    iso.poly(iso.topQuad(cu - i0, cv - i0, cu + i0, cv - i0 + 0.012, zt), alpha('#2a1a10', 0.12));
    iso.poly(iso.topQuad(cu - i0, cv - i0, cu - i0 + 0.012, cv + i0, zt), alpha('#2a1a10', 0.12));
  }
  ctx.restore();
}

function drawKund(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('pond_park', variant);
  const stone = variant === 1 ? C.pinkSand : C.chunar;
  const z0 = 0.04;
  slab(iso, rng, 0.015, z0, shade(stone, 0.06), C.chunarDeep);
  paving(iso, rng, 0.015, 0.015, 0.985, 0.985, z0, 0.1, 0.1, alpha(shade(stone, -0.4), 0.3));
  iso.speckle(iso.topQuad(0.015, 0.015, 0.985, 0.985, z0), rng, 400, [alpha(shade(stone, -0.2), 0.5), alpha('#fff4dc', 0.4)], 1.2);
  // kerb around the tank
  const half = 0.34;
  const cu = 0.5;
  const cv = 0.5;
  iso.box(cu - half - 0.02, cv - half - 0.02, cu + half + 0.02, cv + half + 0.02, z0, z0 + 0.012, mat(shade(stone, 0.04)));
  kund(iso, rng, cu, cv, half, z0 + 0.012, 5, stone);
  if (variant === 0) {
    // corner chhatris, a peepal with a chabutra shrine and a saffron flag
    chhatri(iso, rng, 0.03, 0.03, z0, 0.1, C.chunar, shade(C.chunar, 0.03));
    flag(iso, 0.9, 0.1, z0, 0.42, C.saffron);
    lushTree(iso, rng, 0.12, 0.88, z0, 0.1, 'peepal');
    kalava(iso, 0.12, 0.88, z0, 0.025);
    person(iso, rng, 0.9, 0.55, z0, true, '#f39b1d');
    iso.lathe(0.9, 0.9, z0, [[0, 0.012], [0.012, 0.01], [0.02, 0]], () => '#e0501e', { outline: true });
  } else {
    // pink sandstone kund: four small corner kiosks and diyas on the steps
    chhatri(iso, rng, 0.02, 0.02, z0, 0.09, C.pinkSand, shade(C.pinkSand, 0.05));
    lushTree(iso, rng, 0.88, 0.12, z0, 0.095, 'neem');
    chhatri(iso, rng, 0.02, 0.89, z0, 0.09, C.pinkSand, shade(C.pinkSand, 0.05));
    person(iso, rng, 0.52, 0.93, z0);
    chhatri(iso, rng, 0.89, 0.89, z0, 0.09, C.pinkSand, shade(C.pinkSand, 0.05));
  }
}

// ============================================================================
// PARK GATE (1×1): carved sandstone darwaza
// ============================================================================

function drawParkGate(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('park_gate', variant);
  const stone = variant === 1 ? C.chunar : P.redSandstone;
  const trim = variant === 1 ? shade(C.chunar, 0.08) : '#e8d8b8';
  const z = lawnPlot(iso, rng);
  // path through the gate along v
  gravelPath(iso, rng, 0.38, 0.015, 0.62, 0.985, z, variant === 1 ? '#d9c39a' : '#d8b890');
  flowerBed(iso, rng, 0.1, 0.1, 0.3, 0.3, z);
  lushTree(iso, rng, 0.82, 0.18, z, 0.12, variant === 1 ? 'neem' : 'mango');
  const m = mat(stone);
  const mt = mat(trim);
  const v0 = 0.42;
  const v1 = 0.58;
  // low side walls with railings running out to the edges
  const sideWall = (a0: number, a1: number) => {
    iso.aoRect(a0, v0 + 0.03, a1, v1 - 0.03, z, 0.03, 0.3);
    iso.boxLit(a0, v0 + 0.03, a1, v1 - 0.03, z, z + 0.07, m);
    coursesV(iso, rng, v1 - 0.03, a0, a1, z, z + 0.07, 0.0175, 0.05, alpha('#3a1a10', 0.2), 0.6);
    iso.box(a0 - 0.004, v0 + 0.026, a1 + 0.004, v1 - 0.026, z + 0.07, z + 0.08, mt);
  };
  sideWall(0.03, 0.26);
  // twin pylons with chhatris
  const pyl = (u0: number) => {
    const u1 = u0 + 0.13;
    iso.aoRect(u0, v0, u1, v1, z, 0.05, 0.4);
    iso.boxLit(u0, v0, u1, v1, z, z + 0.34, m);
    // panels with inlaid white trim (Mughal pietra dura-ish frames)
    iso.poly(iso.faceVQuad(v1, u0 + 0.02, u1 - 0.02, z + 0.05, z + 0.3), null, alpha(trim, 0.9), 1.3);
    iso.archV(v1, u0 + 0.035, u1 - 0.035, z + 0.1, z + 0.26, shade(stone, -0.3), true);
    iso.poly(iso.faceUQuad(u1, v0 + 0.02, v1 - 0.02, z + 0.05, z + 0.3), null, alpha(trim, 0.7), 1.2);
    weatherV(iso, rng, v1, u0, u1, z, z + 0.34, 6, 0.12);
    grime(iso, u0, v0, u1, v1, z, 0.05, 0.25);
    iso.box(u0 - 0.012, v0 - 0.012, u1 + 0.012, v1 + 0.012, z + 0.34, z + 0.36, mt);
    chhatri(iso, rng, u0 + 0.01, v0 + 0.01, z + 0.36, 0.11, stone, trim);
  };
  pyl(0.26);
  // central arch block (between the pylons), taller, with a pointed iwan
  const au0 = 0.39;
  const au1 = 0.61;
  iso.boxLit(au0, v0 + 0.01, au1, v1 - 0.01, z + 0.0, z + 0.4, m);
  // the passage: dark opening with a glimpse of the lawn beyond
  iso.archV(v1 - 0.01, au0 + 0.04, au1 - 0.04, z, z + 0.28, trim, true);
  iso.archV(v1 - 0.01, au0 + 0.05, au1 - 0.05, z, z + 0.265, '#2e1c16', true);
  iso.archV(v1 - 0.01, au0 + 0.075, au1 - 0.075, z, z + 0.12, alpha(C.lawn, 0.55));
  // spandrel rosettes + frame
  iso.poly(iso.faceVQuad(v1 - 0.01, au0 + 0.02, au1 - 0.02, z + 0.02, z + 0.35), null, alpha(trim, 0.95), 1.4);
  for (const uu of [au0 + 0.04, au1 - 0.04]) {
    const [x, y] = iso.pt(uu, v1 - 0.01, z + 0.31);
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(x, y, 3 * iso.px, 0, Math.PI * 2);
    ctx.fill();
  }
  // jaali band and crenellated parapet with a central chhatri
  iso.poly(iso.faceVQuad(v1 - 0.01, au0, au1, z + 0.36, z + 0.4), shade(stone, -0.1));
  iso.clipped(iso.faceVQuad(v1 - 0.01, au0, au1, z + 0.36, z + 0.4), () => {
    for (let a = au0; a < au1; a += 0.012) iso.line([a, v1 - 0.01, z + 0.36], [a + 0.02, v1 - 0.01, z + 0.4], alpha(trim, 0.8), 0.7);
  });
  iso.box(au0 - 0.01, v0, au1 + 0.01, v1, z + 0.4, z + 0.415, mt);
  merlons(iso, au0, v1 - 0.02, au1, v1, z + 0.415, 'u', m);
  dome(iso, 0.5, 0.5, z + 0.415, 0.06, trim, 'onion');
  // right pylon (in front of the arch block in painter's order)
  pyl(0.61);
  sideWall(0.74, 0.97);
  // lanterns either side and a board over the arch
  lampPost(iso, 0.33, 0.66, z, 0.14);
  lampPost(iso, 0.67, 0.66, z, 0.14);
  flowerBed(iso, rng, 0.08, 0.7, 0.3, 0.92, z, ['#f5a623', '#e0761a', '#d9433a']);
  lushTree(iso, rng, 0.84, 0.82, z, 0.07, 'bush');
}

// ============================================================================
// GAUSHALA (animal_pens_farm, 1×1): cow shelter
// ============================================================================

/**
 * Open cattle shed along the back of the plot: plastered back walls (dung cakes drying on them),
 * straw bedding and a feeding trough. Cows go between this and `shedRoof`.
 */
function cattleShedBack(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.05, 0.4);
  const wall = mat(C.cream, { right: -0.3 });
  iso.box(u0, v0, u1, v0 + 0.02, z, z + H, wall);
  iso.box(u0, v0, u0 + 0.02, v1, z, z + H, wall);
  // inner faces in shadow under the roof
  iso.poly(iso.faceVQuad(v0 + 0.02, u0 + 0.02, u1, z, z + H), shade(C.cream, -0.28));
  iso.poly(iso.faceUQuad(u0 + 0.02, v0 + 0.02, v1, z, z + H), shade(C.cream, -0.4));
  for (let i = 0; i < 12; i++) {
    const uu = u0 + 0.06 + (i % 6) * ((u1 - u0 - 0.1) / 6);
    const zz = z + H * (0.35 + Math.floor(i / 6) * 0.25);
    iso.ellipse(uu, v0 + 0.021, zz, 0.013, shade('#6a4a2e', (rng() - 0.5) * 0.2), alpha('#3a2616', 0.5), 0.5);
  }
  // straw bedding + trough along the back
  iso.speckle(iso.topQuad(u0 + 0.02, v0 + 0.02, u1, v1, z), rng, 260, ['#d8b860', '#c9a24e', '#e8cf80', '#a8843e'], 1.8);
  iso.box(u0 + 0.05, v0 + 0.03, u1 - 0.04, v0 + 0.07, z, z + 0.028, mat(C.concrete));
  iso.poly(iso.topQuad(u0 + 0.06, v0 + 0.04, u1 - 0.05, v0 + 0.06, z + 0.028), '#8a7a3a');
  iso.speckle(iso.topQuad(u0 + 0.06, v0 + 0.04, u1 - 0.05, v0 + 0.06, z + 0.03), rng, 50, ['#c9b060', '#7a6a2a', '#a8c060'], 1.4);
}

/** Lean-to roof over [u0,u1]×[v0,v1] sloping down towards +v, on brick piers along the front. */
function shedRoof(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, hBack: number, hFront: number, roof: 'tin' | 'thatch' | 'tile'): void {
  const pm = mat(C.brick);
  const np = Math.max(2, Math.round((u1 - u0) / 0.22));
  for (let i = 0; i <= np; i++) {
    const pu = u0 + (i / np) * (u1 - u0 - 0.028);
    iso.box(pu, v1 - 0.028, pu + 0.028, v1, z, z + hFront, pm);
    iso.poly(iso.faceVQuad(v1, pu, pu + 0.028, z, z + 0.02), alpha('#2a1a10', 0.2));
  }
  iso.box(u1 - 0.028, v0 + 0.02, u1, v0 + 0.048, z, z + hBack - 0.01, pm);
  const o = 0.04;
  const zb = z + hBack;
  const zf = z + hFront;
  const zAt = (v: number) => zb - (zb - zf) * ((v - v0) / (v1 - v0));
  const a: P3 = [u0 - o, v0 - o, zAt(v0 - o)];
  const b: P3 = [u1 + o, v0 - o, zAt(v0 - o)];
  const c: P3 = [u1 + o, v1 + o, zAt(v1 + o)];
  const d: P3 = [u0 - o, v1 + o, zAt(v1 + o)];
  const base = roof === 'tin' ? C.tin : roof === 'tile' ? '#b0583a' : '#c9a55e';
  const th = roof === 'thatch' ? 0.03 : 0.014;
  // eave shadow on the ground in front
  iso.poly(iso.topQuad(u0 - o * 0.5, v1, u1 + o, v1 + o + 0.04, z), alpha('#2a1a10', 0.16));
  iso.poly([d, c, [c[0], c[1], c[2] - th], [d[0], d[1], d[2] - th]], shade(base, -0.28));
  iso.poly([b, c, [c[0], c[1], c[2] - th], [b[0], b[1], b[2] - th]], shade(base, -0.45));
  const pts: P3[] = [a, b, c, d];
  iso.poly(pts, shade(base, 0.08), alpha('#1e1a14', 0.55), 1);
  iso.clipped(pts, () => {
    if (roof === 'tin') {
      for (let u = u0 - o + 0.01; u < u1 + o; u += 0.02) {
        iso.line([u, v0 - o, zAt(v0 - o) + 0.001], [u, v1 + o, zAt(v1 + o) + 0.001], alpha(shade(base, -0.3), 0.55), 0.7);
        iso.line([u + 0.007, v0 - o, zAt(v0 - o) + 0.001], [u + 0.007, v1 + o, zAt(v1 + o) + 0.001], alpha(shade(base, 0.4), 0.35), 0.6);
      }
      for (let i = 0; i < 7; i++) {
        const pu = u0 + rng() * (u1 - u0);
        const pv = v0 + rng() * (v1 - v0);
        iso.ellipse(pu, pv, zAt(pv) + 0.002, 0.02 + rng() * 0.03, alpha(C.rust, 0.45));
      }
      for (let i = 0; i < 4; i++) {
        const pu = u0 + 0.05 + rng() * (u1 - u0 - 0.1);
        const pv = v0 + 0.05 + rng() * (v1 - v0 - 0.1);
        iso.box(pu, pv, pu + 0.03, pv + 0.018, zAt(pv), zAt(pv) + 0.014, mat(C.brick), { edges: false });
      }
    } else if (roof === 'tile') {
      // khaprail: half-round clay tiles in rows down the slope
      for (let u = u0 - o + 0.009; u < u1 + o; u += 0.018) iso.line([u, v0 - o, zAt(v0 - o) + 0.002], [u, v1 + o, zAt(v1 + o) + 0.002], alpha('#6e2a1a', 0.6), 1.4);
      for (let u = u0 - o + 0.004; u < u1 + o; u += 0.018) iso.line([u, v0 - o, zAt(v0 - o) + 0.003], [u, v1 + o, zAt(v1 + o) + 0.003], alpha('#f0a888', 0.45), 0.6);
      for (let v = v0 - o; v < v1 + o; v += 0.03) iso.line([u0 - o, v, zAt(v) + 0.002], [u1 + o, v, zAt(v) + 0.002], alpha('#5a2014', 0.35), 0.7);
      iso.speckle(pts, rng, 120, [alpha('#6a6a4a', 0.4), alpha('#e8b090', 0.4)], 1.6);
    } else {
      iso.speckle(pts, rng, 700, ['#a8843e', '#e0c070', '#8a6a30', '#d8b860'], 1.8);
      for (let u = u0 - o; u < u1 + o; u += 0.012) iso.line([u, v0 - o, zAt(v0 - o) + 0.001], [u + 0.006, v1 + o, zAt(v1 + o) + 0.001], alpha('#8a6a30', 0.35), 0.6);
    }
  });
  if (roof === 'thatch') {
    // ragged eave
    for (let u = u0 - o; u < u1 + o; u += 0.008) iso.line([u, v1 + o, zAt(v1 + o) - th], [u, v1 + o, zAt(v1 + o) - th - 0.006 - rng() * 0.012], alpha('#a8843e', 0.9), 0.9);
  }
  iso.line(d, c, alpha('#fff0cf', 0.5), 1);
}

function fodderStack(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number): void {
  iso.aoEllipse(u, v, r, z, 0.03, 0.35);
  iso.lathe(u, v, z, [[0, r], [r * 0.6, r * 1.02], [r * 1.1, r * 0.75], [r * 1.5, 0.004]], (t) => (t > 0.8 ? '#d8b860' : '#c9a24e'), { outline: true, lit: 0.25 });
  const [x, y] = iso.pt(u, v, z + r * 0.8);
  for (let i = 0; i < 30; i++) {
    iso.ctx.strokeStyle = alpha(rng() < 0.5 ? '#f0d890' : '#8a6a30', 0.6);
    iso.ctx.lineWidth = 0.7 * iso.px;
    const a = rng() * Math.PI * 2;
    const d = rng() * r * iso.T * 0.6;
    iso.ctx.beginPath();
    iso.ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6);
    iso.ctx.lineTo(x + Math.cos(a) * d + 3 * iso.px, y + Math.sin(a) * d * 0.6 + 2 * iso.px);
    iso.ctx.stroke();
  }
}

/** Bamboo fence along the two near edges (gap on the +v side for the gate). */
function bambooFence(iso: Iso, z: number, gap: [number, number]): void {
  const e = 0.965;
  for (let a = 0.035; a <= e; a += 0.045) {
    iso.line([e, a, z], [e, a, z + 0.065], '#8a6a3a', 2);
    iso.line([e, a, z + 0.002], [e, a, z + 0.063], alpha('#d8b070', 0.7), 0.7);
  }
  for (let a = 0.035; a <= e; a += 0.045) {
    if (a > gap[0] && a < gap[1]) continue;
    iso.line([a, e, z], [a, e, z + 0.065], '#8a6a3a', 2);
    iso.line([a, e, z + 0.002], [a, e, z + 0.063], alpha('#d8b070', 0.7), 0.7);
  }
  for (const hh of [0.025, 0.052]) {
    iso.line([e, 0.035, z + hh], [e, e, z + hh], '#6e5030', 1.5);
    iso.line([0.035, e, z + hh], [gap[0], e, z + hh], '#6e5030', 1.5);
    iso.line([gap[1], e, z + hh], [e, e, z + hh], '#6e5030', 1.5);
  }
}

function drawGaushala(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('animal_pens_farm', variant);
  const z = 0.02;
  slab(iso, rng, 0.015, z, '#b09068', C.earthDark, ['#9a7a56', '#c4a67c', '#8a6b4a', alpha('#6c7a3a', 0.5)]);
  const roof = variant === 0 ? 'tin' : variant === 1 ? 'tile' : 'thatch';
  // the shed runs along the back (−v) edge, open towards the yard
  const su0 = 0.05;
  const su1 = variant === 2 ? 0.7 : 0.95;
  const sv1 = 0.4;
  cattleShedBack(iso, rng, su0, 0.05, su1, sv1, z, 0.22);
  cow(iso, 0.12, 0.13, z, 'v', '#ece6da');
  cow(iso, 0.3, 0.13, z, 'v', '#c9b8a0');
  if (variant !== 2) cow(iso, 0.52, 0.12, z, 'v', '#8a6a4a');
  cow(iso, 0.2, 0.3, z, 'u', '#f1ebdd', true);
  shedRoof(iso, rng, su0, 0.05, su1, sv1, z, 0.26, 0.18, roof);
  if (variant === 0) {
    fodderStack(iso, rng, 0.2, 0.72, z, 0.1);
    cow(iso, 0.52, 0.55, z, 'u', '#f1ebdd');
    drum(iso, 0.84, 0.52, z, 0.035, 0.07, '#2f67b4');
    cow(iso, 0.66, 0.74, z, 'u', '#b88a5a', false, 1.0); // calf
    person(iso, rng, 0.46, 0.84, z, false, '#f2c14e');
  } else if (variant === 1) {
    // water trough + tulsi, three cows in the yard
    iso.box(0.58, 0.5, 0.86, 0.57, z, z + 0.03, mat(C.concrete));
    iso.poly(iso.topQuad(0.59, 0.51, 0.85, 0.56, z + 0.03), P.pool);
    cow(iso, 0.3, 0.52, z, 'u', '#d8cfc0');
    cow(iso, 0.62, 0.66, z, 'u', '#6e5038', true);
    fodderStack(iso, rng, 0.2, 0.8, z, 0.08);
    iso.box(0.82, 0.8, 0.9, 0.88, z, z + 0.05, mat('#e89a6a', { right: -0.25 }));
    lushTree(iso, rng, 0.86, 0.84, z + 0.05, 0.035, 'bush');
  } else {
    lushTree(iso, rng, 0.84, 0.2, z, 0.16, 'neem');
    charpai(iso, 0.68, 0.5, z);
    cow(iso, 0.34, 0.6, z, 'u', '#ece6da');
    fodderStack(iso, rng, 0.2, 0.78, z, 0.08);
    person(iso, rng, 0.74, 0.62, z, true, '#f1ebdd');
  }
  bambooFence(iso, z, [0.4, 0.6]);
  flag(iso, 0.04, 0.9, z, 0.36, C.saffron);
}

// ============================================================================
// COMMUNITY GARDEN (1×1): sabzi bagh / kitchen garden
// ============================================================================

function vegBed(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, crop: 'leafy' | 'tomato' | 'marigold' | 'okra'): void {
  const h = 0.02;
  iso.aoRect(u0, v0, u1, v1, z, 0.02, 0.3);
  iso.box(u0, v0, u1, v1, z, z + h, mat(C.brick, { top: 0.1 }), { noTop: true });
  iso.poly(iso.topQuad(u0, v0, u1, v1, z + h), P.soil);
  // furrows along u
  const rows = Math.max(2, Math.round((v1 - v0) / 0.045));
  for (let r = 0; r < rows; r++) {
    const v = v0 + ((r + 0.5) / rows) * (v1 - v0);
    iso.line([u0 + 0.01, v, z + h], [u1 - 0.01, v, z + h], alpha(P.soilDark, 0.7), 2.2);
    for (let u = u0 + 0.02; u < u1 - 0.01; u += 0.028) {
      const [x, y] = iso.pt(u + (rng() - 0.5) * 0.006, v, z + h);
      const s = iso.px;
      const ctx = iso.ctx;
      if (crop === 'leafy') {
        ctx.fillStyle = '#3f7a2a';
        ctx.beginPath();
        ctx.ellipse(x, y - 2 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8ac25a';
        ctx.beginPath();
        ctx.ellipse(x - 1 * s, y - 3 * s, 2.2 * s, 1.6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const hgt = crop === 'okra' ? 11 : crop === 'tomato' ? 9 : 6;
        ctx.strokeStyle = '#3f6e26';
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - hgt * s);
        ctx.stroke();
        ctx.fillStyle = '#4a8a30';
        ctx.beginPath();
        ctx.ellipse(x, y - hgt * s * 0.7, 3.4 * s, 2.6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6aa840';
        ctx.beginPath();
        ctx.ellipse(x - s, y - hgt * s * 0.85, 2 * s, 1.6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        const fcol = crop === 'tomato' ? '#d9332a' : crop === 'marigold' ? (rng() < 0.5 ? '#f5a623' : '#e0761a') : '#9ac05a';
        ctx.fillStyle = fcol;
        ctx.beginPath();
        ctx.arc(x + 1.5 * s, y - hgt * s * 0.6, (crop === 'marigold' ? 2.4 : 1.6) * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** Bamboo trellis (machan) with a climbing gourd vine and hanging lauki. */
function gourdTrellis(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number): void {
  for (const [pu, pv] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as [number, number][]) iso.line([pu, pv, z], [pu, pv, z + H], '#a8844a', 1.6);
  const top = iso.topQuad(u0, v0, u1, v1, z + H);
  iso.poly(top, null, alpha('#8a6a3a', 0.9), 1);
  iso.clipped(top, () => {
    for (let a = u0; a < u1; a += 0.03) iso.line([a, v0, z + H], [a, v1, z + H], alpha('#a8844a', 0.8), 0.8);
  });
  // vine canopy blobs
  const ctx = iso.ctx;
  for (let i = 0; i < 40; i++) {
    const [x, y] = iso.pt(u0 + rng() * (u1 - u0), v0 + rng() * (v1 - v0), z + H + 0.005);
    ctx.fillStyle = i % 3 === 0 ? '#86b848' : i % 3 === 1 ? '#4f8a2e' : '#3a6a22';
    ctx.beginPath();
    ctx.ellipse(x, y, 4 * iso.px, 2.8 * iso.px, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    const pu = u0 + 0.02 + rng() * (u1 - u0 - 0.04);
    const pv = v1 - rng() * 0.03;
    iso.lathe(pu, pv, z + H - 0.06, [[0, 0.004], [0.02, 0.009], [0.045, 0.006], [0.06, 0]], () => '#9cc060', { outline: true, lit: 0.3 });
  }
  // yellow flowers
  for (let i = 0; i < 10; i++) {
    const [x, y] = iso.pt(u0 + rng() * (u1 - u0), v0 + rng() * (v1 - v0), z + H + 0.008);
    ctx.fillStyle = '#f2d04e';
    ctx.fillRect(x, y, 1.8 * iso.px, 1.8 * iso.px);
  }
}

function scarecrow(iso: Iso, u: number, v: number, z: number): void {
  iso.line([u, v, z], [u, v, z + 0.13], '#6b4a2a', 1.6);
  iso.line([u - 0.035, v + 0.035, z + 0.1], [u + 0.035, v - 0.035, z + 0.1], '#6b4a2a', 1.4);
  iso.poly([[u - 0.03, v + 0.03, z + 0.105], [u + 0.03, v - 0.03, z + 0.105], [u + 0.02, v - 0.02, z + 0.05], [u - 0.02, v + 0.02, z + 0.05]], '#d9433a', alpha('#5a1a10', 0.7), 0.8);
  iso.lathe(u, v, z + 0.11, [[0, 0.012], [0.012, 0.014], [0.026, 0]], () => '#1e1a18', { outline: true });
  iso.ellipse(u, v, z + 0.13, 0.02, '#c9a061', alpha('#6e4c26', 0.8), 0.7);
}

function drawCommunityGarden(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('community_garden', variant);
  const z = 0.02;
  slab(iso, rng, 0.015, z, '#9a7a52', C.earthDark, ['#8a6a46', '#b0906a', '#7a5a38']);
  gravelPath(iso, rng, 0.46, 0.03, 0.54, 0.97, z, '#c8a878');
  if (variant === 0) {
    vegBed(iso, rng, 0.06, 0.06, 0.42, 0.28, z, 'leafy');
    gourdTrellis(iso, rng, 0.58, 0.06, 0.94, 0.3, z, 0.15);
    vegBed(iso, rng, 0.06, 0.36, 0.42, 0.58, z, 'tomato');
    vegBed(iso, rng, 0.58, 0.38, 0.94, 0.6, z, 'okra');
    vegBed(iso, rng, 0.06, 0.66, 0.42, 0.92, z, 'marigold');
    drum(iso, 0.66, 0.72, z, 0.04, 0.08, '#2f67b4');
    scarecrow(iso, 0.8, 0.78, z);
    person(iso, rng, 0.52, 0.62, z, false, '#e07a9a');
  } else if (variant === 1) {
    // shade-net tool hut + mango tree
    lushTree(iso, rng, 0.2, 0.18, z, 0.15, 'mango');
    vegBed(iso, rng, 0.58, 0.06, 0.94, 0.26, z, 'marigold');
    vegBed(iso, rng, 0.58, 0.32, 0.94, 0.54, z, 'leafy');
    vegBed(iso, rng, 0.06, 0.4, 0.42, 0.62, z, 'okra');
    gourdTrellis(iso, rng, 0.06, 0.68, 0.42, 0.94, z, 0.14);
    vegBed(iso, rng, 0.58, 0.6, 0.94, 0.8, z, 'tomato');
    person(iso, rng, 0.5, 0.45, z, true, '#f2c14e');
    planter(iso, rng, 0.66, 0.9, z, 0.025, '#b86b45', 'flowers');
    planter(iso, rng, 0.78, 0.9, z, 0.025, '#b86b45', 'flowers');
  } else {
    // terraced beds around a hand-pump and a tulsi chaura
    vegBed(iso, rng, 0.06, 0.06, 0.42, 0.42, z, 'tomato');
    vegBed(iso, rng, 0.58, 0.06, 0.94, 0.42, z, 'leafy');
    // hand pump on a small platform
    iso.box(0.6, 0.5, 0.74, 0.62, z, z + 0.015, mat(C.concrete));
    iso.lathe(0.66, 0.56, z + 0.015, [[0, 0.012], [0.08, 0.01], [0.1, 0.016], [0.11, 0]], () => '#3a5a8a', { outline: true });
    iso.line([0.66, 0.56, z + 0.1], [0.72, 0.5, z + 0.12], '#2a3a5a', 1.6);
    iso.line([0.66, 0.56, z + 0.07], [0.66, 0.6, z + 0.06], '#2a3a5a', 1.8);
    // tulsi chaura
    iso.box(0.14, 0.5, 0.26, 0.62, z, z + 0.07, mat('#e89a6a', { right: -0.25 }));
    iso.poly(iso.faceVQuad(0.62, 0.16, 0.24, z + 0.02, z + 0.05), '#f2c14e');
    iso.poly(iso.topQuad(0.15, 0.51, 0.25, 0.61, z + 0.07), P.soil);
    lushTree(iso, rng, 0.2, 0.56, z + 0.07, 0.05, 'bush');
    vegBed(iso, rng, 0.06, 0.7, 0.42, 0.94, z, 'okra');
    vegBed(iso, rng, 0.58, 0.7, 0.94, 0.94, z, 'marigold');
    person(iso, rng, 0.5, 0.66, z, false, '#3aa36b');
  }
}

// ============================================================================
// BOAT JETTY (marina_docks_small, 2×2, waterfront): land at u ∈ [0, 1], river at u ∈ [1, 2]
// ============================================================================
// The renderer paints water tiles under the whole footprint of waterfront marinas and piers, so the
// river half stays transparent and only the jetty, boats and their shadows are drawn on it.

const BOAT_BANDS = ['#2f6fb3', '#3a8f5c', '#b8413a', '#e0a33a', '#7a4fb0', '#e46a3a'] as const;

/** Boatman: a person standing or sitting in a boat (boat top ≈ z + 0.05). */
function boatman(iso: Iso, rng: Rng, u: number, v: number, sitting = true): void {
  person(iso, rng, u, v, 0.03, sitting, rng() < 0.5 ? '#f1ebdd' : '#e8c86a');
}

function drawBoatJetty(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('marina_docks_small', variant);
  const deckZ = 0.05;
  if (variant === 0) {
    // pakka ghat: stone steps down to the river, chhatri and cane umbrellas, a long wooden jetty
    ghatSteps(iso, rng, 0, 2, 0);
    chhatri(iso, rng, 0.03, 0.14, 0.28, 0.15, C.chunar, shade(C.chunar, 0.02));
    offerings(iso, rng, 0.44, 0.58, 0.2, 0.8, 0.14, 3);
    caneUmbrella(iso, 0.5, 0.52, 0.14, 0.12);
    flag(iso, 0.08, 1.1, 0.28, 0.4, C.saffron);
    // boats behind the jetty
    rowBoat(iso, rng, 1.42, 0.3, 0, 0.5, 'u', BOAT_BANDS[0], { oars: true });
    rowBoat(iso, rng, 1.5, 0.68, 0, 0.58, 'u', BOAT_BANDS[2], { canopy: true });
    boatman(iso, rng, 1.34, 0.7);
    plankDeck(iso, rng, 0.86, 0.9, 1.94, 1.12, deckZ, 'u');
    for (const u of [1.1, 1.5, 1.9]) {
      bollard(iso, u, 0.92, deckZ);
      bollard(iso, u, 1.1, deckZ);
    }
    rope(iso, [1.5, 0.92, deckZ + 0.02], [1.62, 0.76, 0.06]);
    rope(iso, [1.1, 0.92, deckZ + 0.02], [1.3, 0.38, 0.05]);
    person(iso, rng, 1.25, 1.0, deckZ);
    person(iso, rng, 1.72, 1.04, deckZ, false, '#e4572e');
    // boats in front of the jetty
    rowBoat(iso, rng, 1.52, 1.32, 0, 0.6, 'u', BOAT_BANDS[1], { oars: true });
    rope(iso, [1.5, 1.1, deckZ + 0.02], [1.3, 1.25, 0.06]);
    boatman(iso, rng, 1.66, 1.34);
    rowBoat(iso, rng, 1.5, 1.72, 0, 0.52, 'u', BOAT_BANDS[3], { canopy: true });
    caneUmbrella(iso, 0.52, 1.6, 0.14, 0.12);
    offerings(iso, rng, 0.03, 0.18, 1.3, 1.9, 0.28, 3);
  } else {
    // kachcha ghat: a sandy bank sloping into the river, boatmen's shack and a bamboo jetty
    const zt = 0.08;
    const uTop = 0.55;
    const uEdge = 0.98;
    iso.poly(iso.topQuad(0, 0, uTop, 2, zt), C.sandLight);
    const slope: P3[] = [
      [uTop, 0, zt],
      [uEdge, 0, 0],
      [uEdge, 2, 0],
      [uTop, 2, zt],
    ];
    iso.poly(slope, C.sand);
    // wet sand band at the waterline
    iso.poly([[uEdge - 0.14, 0, zt * 0.32], [uEdge, 0, 0], [uEdge, 2, 0], [uEdge - 0.14, 2, zt * 0.32]], alpha(C.wet, 0.55));
    iso.speckle(iso.topQuad(0, 0, uEdge, 2, zt * 0.5), rng, 500, [alpha('#8a6b4a', 0.35), alpha('#fff0cf', 0.35)], 1.2);
    iso.poly([[0, 2, 0], [uEdge, 2, 0], [uTop, 2, zt], [0, 2, zt]], shade(C.sandDeep, 0.05), OUTLINE, 1);
    iso.line([0, 2, zt], [uTop, 2, zt], alpha('#fff0cf', 0.6), 1);
    // shack with a tin roof, oars leaning on it, a charpai and a neem for shade
    hut(iso, rng, 0.06, 0.12, 0.34, 0.5, zt, 0.16, 0.12, '#d9b98a', 'rust', true, '#4a3a2e');
    for (let i = 0; i < 4; i++) iso.line([0.36, 0.2 + i * 0.05, zt], [0.35, 0.16 + i * 0.05, zt + 0.16], '#c9a26a', 1.6);
    lushTree(iso, rng, 0.2, 0.86, zt, 0.14, 'neem');
    charpai(iso, 0.34, 0.74, zt);
    person(iso, rng, 0.38, 0.8, zt + 0.035, true, '#f1ebdd');
    // a boat pulled up on the bank for caulking
    rowBoat(iso, rng, 0.62, 1.46, 0.035, 0.46, 'u', BOAT_BANDS[4]);
    drum(iso, 0.44, 1.28, zt, 0.03, 0.05, '#2a2a2e');
    rowBoat(iso, rng, 1.4, 0.4, 0, 0.56, 'u', BOAT_BANDS[5], { oars: true });
    boatman(iso, rng, 1.52, 0.42);
    // bamboo-and-plank jetty with a railing on the near side
    plankDeck(iso, rng, 0.78, 0.94, 1.9, 1.14, deckZ - 0.01, 'u', '#a88458');
    for (let u = 0.82; u < 1.9; u += 0.18) iso.line([u, 1.13, deckZ - 0.01], [u, 1.13, deckZ + 0.06], '#b89458', 1.4);
    iso.line([0.82, 1.13, deckZ + 0.06], [1.88, 1.13, deckZ + 0.06], '#c9a468', 1.4);
    person(iso, rng, 1.5, 1.02, deckZ - 0.01, false, '#3a86c8');
    rowBoat(iso, rng, 1.46, 1.36, 0, 0.6, 'u', BOAT_BANDS[0], { canopy: true });
    rope(iso, [1.3, 1.13, deckZ + 0.03], [1.22, 1.28, 0.06]);
    rowBoat(iso, rng, 1.42, 1.74, 0, 0.5, 'u', BOAT_BANDS[3], { oars: true });
    flag(iso, 0.1, 1.84, zt, 0.34, C.saffron);
  }
}

// ============================================================================
// PIER (pier_large, 1×1, waterfront): stone landing at the back, wooden pier out to the +u edge
// ============================================================================

const PIER_STEPS: readonly Tread[] = [
  { u0: 0, u1: 0.2, z: 0.12, kind: 'platform' },
  { u0: 0.2, u1: 0.25, z: 0.09, kind: 'step' },
  { u0: 0.25, u1: 0.3, z: 0.06, kind: 'step' },
  { u0: 0.3, u1: 0.36, z: 0.03, kind: 'ledge' },
];

function drawPier(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('pier_large', variant);
  const dz = 0.05;
  ghatSteps(iso, rng, 0, 1, 0, PIER_STEPS);
  if (variant === 0) {
    // straight pier with lantern posts and a shamiyana at its head
    lampPost(iso, 0.1, 0.3, 0.12, 0.16);
    rowBoat(iso, rng, 0.66, 0.18, 0, 0.42, 'u', BOAT_BANDS[1], { oars: true });
    plankDeck(iso, rng, 0.3, 0.38, 0.98, 0.62, dz, 'u');
    for (const u of [0.5, 0.9]) bollard(iso, u, 0.4, dz);
    rope(iso, [0.5, 0.4, dz + 0.02], [0.56, 0.26, 0.05]);
    // canopy on four poles
    const [c0, c1, c2, c3] = [0.7, 0.4, 0.95, 0.6];
    for (const [pu, pv] of [[c0, c1], [c2, c1], [c0, c3], [c2, c3]] as [number, number][]) iso.line([pu, pv, dz], [pu, pv, dz + 0.14], '#6b4a2a', 1.4);
    iso.poly(iso.topQuad(c0 - 0.01, c1 - 0.01, c2 + 0.01, c3 + 0.01, dz + 0.14), '#e46a3a', alpha('#6a2a14', 0.7), 1);
    iso.poly(iso.faceVQuad(c3 + 0.01, c0 - 0.01, c2 + 0.01, dz + 0.125, dz + 0.14), '#f2c14e');
    iso.poly(iso.faceUQuad(c2 + 0.01, c1 - 0.01, c3 + 0.01, dz + 0.125, dz + 0.14), shade('#f2c14e', -0.25));
    person(iso, rng, 0.8, 0.5, dz, true);
    person(iso, rng, 0.46, 0.52, dz);
    for (const u of [0.5, 0.9]) bollard(iso, u, 0.6, dz);
    rowBoat(iso, rng, 0.64, 0.82, 0, 0.44, 'u', BOAT_BANDS[3], { canopy: true });
    rope(iso, [0.5, 0.6, dz + 0.02], [0.5, 0.74, 0.05]);
    lampPost(iso, 0.1, 0.72, 0.12, 0.16);
  } else {
    // T-headed pier with a ticket kiosk on the landing
    iso.aoRect(0.03, 0.08, 0.16, 0.3, 0.12, 0.03, 0.4);
    iso.boxLit(0.03, 0.08, 0.16, 0.3, 0.12, 0.24, mat('#e8dcc2', { right: -0.25 }));
    iso.poly(iso.faceUQuad(0.16, 0.12, 0.26, 0.15, 0.2), '#3b3a44');
    iso.box(0.01, 0.06, 0.18, 0.32, 0.24, 0.255, mat(C.tarpBlue));
    iso.poly(iso.faceUQuad(0.18, 0.08, 0.3, 0.26, 0.3), '#2f6fb3', alpha('#ffffff', 0.6), 1);
    plankDeck(iso, rng, 0.3, 0.42, 0.74, 0.58, dz, 'u', '#8e6440');
    rowBoat(iso, rng, 0.58, 0.24, 0, 0.36, 'u', BOAT_BANDS[0], { oars: true });
    plankDeck(iso, rng, 0.74, 0.08, 0.96, 0.92, dz, 'v', '#8e6440');
    for (const v of [0.12, 0.5, 0.88]) bollard(iso, 0.94, v, dz);
    lampPost(iso, 0.78, 0.12, dz, 0.16);
    lampPost(iso, 0.78, 0.88, dz, 0.16);
    person(iso, rng, 0.86, 0.3, dz);
    person(iso, rng, 0.84, 0.66, dz, false, '#f2c14e');
    person(iso, rng, 0.5, 0.5, dz, false, '#e4572e');
    rowBoat(iso, rng, 0.58, 0.78, 0, 0.36, 'u', BOAT_BANDS[2], { canopy: true });
    rope(iso, [0.72, 0.58, dz + 0.02], [0.66, 0.7, 0.05]);
  }
}

// ============================================================================
// AMPHITHEATRE (2×2): stepped stone seating in a quarter-bowl around a stage at the front corner
// ============================================================================

/** Points on a circle arc around (cu, cv) in the u-v plane at height z, from angle a0 to a1. */
function arc(cu: number, cv: number, r: number, a0: number, a1: number, z: number, seg: number): P3[] {
  const out: P3[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    out.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r, z]);
  }
  return out;
}

function drawAmphitheater(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('amphitheater', variant);
  const stone = variant === 1 ? P.redSandstone : C.chunar;
  const z = lawnPlot(iso, rng);
  const cu = 1.62;
  const cv = 1.62;
  const rows = 6;
  const r0 = 0.56;
  const dr = 0.14;
  const dh = 0.036;
  const A0 = Math.PI;
  const A1 = Math.PI * 1.5;
  const seg = 18;
  // trees behind the top row
  lushTree(iso, rng, 0.3, 0.3, z, 0.17, variant === 1 ? 'banyan' : 'neem');
  for (const a of [A0 + 0.3, A0 + 0.785, A1 - 0.3]) {
    const r = r0 + rows * dr + 0.13;
    lushTree(iso, rng, cu + Math.cos(a) * r, cv + Math.sin(a) * r, z, 0.07, 'ashoka');
  }
  // seating rows, outermost (highest, furthest back) first
  for (let k = rows - 1; k >= 0; k--) {
    const rin = r0 + k * dr;
    const rout = rin + dr;
    const zk = z + (k + 1) * dh;
    // riser (faces the stage, towards the viewer): per-segment shading by facing
    const lo = arc(cu, cv, rin, A0, A1, z, seg);
    const hi = arc(cu, cv, rin, A0, A1, zk, seg);
    for (let i = 0; i < seg; i++) {
      const a = A0 + ((A1 - A0) * (i + 0.5)) / seg;
      const nu = -Math.cos(a);
      const nv = -Math.sin(a);
      const t = nu / (nu + nv);
      iso.poly([lo[i], lo[i + 1], hi[i + 1], hi[i]], shade(stone, -0.06 - 0.24 * t));
    }
    // tread
    const top = [...arc(cu, cv, rout, A0, A1, zk, seg), ...arc(cu, cv, rin, A1, A0, zk, seg)];
    iso.poly(top, shade(stone, 0.08 - k * 0.01), alpha(shade(stone, -0.5), 0.4), 0.8);
    iso.polyline(hi, alpha('#fff4dc', 0.65), 1.1);
    // stepped ends (the +v end is lit, the +u end in shade)
    iso.poly(iso.faceVQuad(cv, cu - rout, cu - rin, z, zk), shade(stone, -0.04), alpha(shade(stone, -0.5), 0.4), 0.8);
    iso.poly(iso.faceUQuad(cu, cv - rout, cv - rin, z, zk), shade(stone, -0.3), alpha(shade(stone, -0.5), 0.4), 0.8);
    // a few spectators
    const count = 1 + Math.floor(rng() * 3);
    for (let j = 0; j < count; j++) {
      const a = A0 + 0.12 + rng() * (A1 - A0 - 0.24);
      const r = rin + dr * 0.55;
      person(iso, rng, cu + Math.cos(a) * r, cv + Math.sin(a) * r, zk, true);
    }
  }
  // orchestra: paved ring in front of the lowest row
  const orch = [...arc(cu, cv, r0, A0, A1, z + 0.004, seg), [cu, cv, z + 0.004] as P3];
  iso.poly(orch, shade(stone, -0.08));
  iso.clipped(orch, () => {
    for (let r = 0.1; r < r0; r += 0.07) iso.polyline(arc(cu, cv, r, A0, A1, z + 0.004, seg), alpha(shade(stone, -0.45), 0.35), 0.7);
  });
  // stage platform at the front corner
  const s0 = 1.36;
  const s1 = 1.96;
  const sz = z + 0.06;
  iso.aoRect(s0, s0, s1, s1, z, 0.04, 0.35);
  iso.boxLit(s0, s0, s1, s1, z, sz, mat(shade(stone, -0.04)));
  coursesV(iso, rng, s1, s0, s1, z, sz, 0.02, 0.08, alpha('#3a2616', 0.2), 0.6);
  coursesU(iso, rng, s1, s0, s1, z, sz, 0.02, 0.08, alpha('#3a2616', 0.2), 0.6);
  iso.poly(iso.topQuad(s0 + 0.03, s0 + 0.03, s1 - 0.03, s1 - 0.03, sz), variant === 1 ? '#9a3b2e' : '#b0513a');
  iso.poly(iso.topQuad(s0 + 0.05, s0 + 0.05, s1 - 0.05, s1 - 0.05, sz), null, alpha(C.marigold, 0.8), 1.2);
  if (variant === 0) {
    // chhatris on the stage wings, dancers and a musician
    chhatri(iso, rng, s1 - 0.17, s0 + 0.02, sz, 0.14, stone, shade(stone, 0.03));
    person(iso, rng, 1.58, 1.6, sz, false, '#e4572e');
    person(iso, rng, 1.66, 1.52, sz, false, '#f2c14e');
    person(iso, rng, 1.76, 1.72, sz, true, '#f1ebdd');
    chhatri(iso, rng, s0 + 0.02, s1 - 0.17, sz, 0.14, stone, shade(stone, 0.03));
  } else {
    // shamiyana over the stage: striped cloth canopy on bamboo poles
    const ch = 0.26;
    const poles: [number, number][] = [[s0 + 0.04, s0 + 0.04], [s1 - 0.04, s0 + 0.04], [s0 + 0.04, s1 - 0.04], [s1 - 0.04, s1 - 0.04]];
    for (const [pu, pv] of poles.slice(0, 3)) iso.line([pu, pv, sz], [pu, pv, sz + ch], '#6b4a2a', 1.8);
    person(iso, rng, 1.6, 1.6, sz, false, '#b44ca0');
    person(iso, rng, 1.7, 1.66, sz, true, '#f1ebdd');
    const roof = iso.topQuad(s0, s0, s1, s1, sz + ch);
    iso.poly(roof, '#e46a3a', alpha('#6a2a14', 0.8), 1);
    iso.clipped(roof, () => {
      for (let a = s0; a < s1; a += 0.1) iso.poly(iso.topQuad(a, s0, a + 0.05, s1, sz + ch), '#f2c14e');
    });
    iso.poly(iso.faceVQuad(s1, s0, s1, sz + ch - 0.03, sz + ch), '#d9433a');
    iso.poly(iso.faceUQuad(s1, s0, s1, sz + ch - 0.03, sz + ch), shade('#d9433a', -0.25));
    for (let a = s0 + 0.03; a < s1; a += 0.06) {
      iso.line([a, s1, sz + ch - 0.03], [a + 0.03, s1, sz + ch - 0.045], C.marigold, 1.4);
      iso.line([s1, a, sz + ch - 0.03], [s1, a + 0.03, sz + ch - 0.045], shade(C.marigold, -0.2), 1.4);
    }
    const [pu, pv] = poles[3];
    iso.line([pu, pv, sz], [pu, pv, sz + ch], '#6b4a2a', 1.8);
  }
  // side gardens
  lushTree(iso, rng, 1.86, 0.3, z, 0.12, 'gulmohar');
  bench(iso, 1.8, 0.9, z, 'v', stone);
  bench(iso, 0.9, 1.8, z, 'u', stone);
  lushTree(iso, rng, 0.3, 1.86, z, 0.12, variant === 1 ? 'mango' : 'peepal');
  lampPost(iso, 1.3, 1.96, z, 0.18);
  lampPost(iso, 1.96, 1.3, z, 0.18);
}

// ============================================================================
// PLANT NURSERY (greenhouse_garden, 2×2): shade-net sheds, rows of pots, a small office
// ============================================================================

/** Row of potted saplings / flowering pots along u at v. */
function potRow(iso: Iso, rng: Rng, u0: number, u1: number, v: number, z: number, kind: 'bag' | 'clay' | 'flower'): void {
  const pot = kind === 'bag' ? '#2a2a2e' : '#b0603c';
  for (let u = u0; u < u1; u += 0.055) {
    const pu = u + (rng() - 0.5) * 0.008;
    const pv = v + (rng() - 0.5) * 0.008;
    iso.box(pu - 0.014, pv - 0.014, pu + 0.014, pv + 0.014, z, z + 0.022, mat(pot, { top: -0.3 }), { edges: false });
    const g = rng() < 0.5 ? '#4f8a38' : '#3f7a2e';
    const r = 0.018 + rng() * 0.01;
    iso.ellipse(pu, pv, z + 0.035, r, g, alpha('#1f3a14', 0.5), 0.6);
    iso.ellipse(pu - 0.004, pv - 0.004, z + 0.042, r * 0.55, alpha('#a6d468', 0.7));
    if (kind === 'flower') iso.ellipse(pu + 0.002, pv + 0.002, z + 0.048, r * 0.4, P.flowers[Math.floor(rng() * P.flowers.length)]);
  }
}

/** Green shade-net house on bamboo posts; draw what is under it first. */
function shadeNet(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number, H: number, net = '#2f6a3a'): void {
  const zt = z + H;
  const step = 0.25;
  const pole = '#b89458';
  // back posts
  for (let u = u0; u <= u1 + 1e-6; u += (u1 - u0) / Math.max(1, Math.round((u1 - u0) / step))) iso.line([u, v0, z], [u, v0, zt], pole, 1.4);
  for (let v = v0; v <= v1 + 1e-6; v += (v1 - v0) / Math.max(1, Math.round((v1 - v0) / step))) iso.line([u0, v, z], [u0, v, zt], pole, 1.4);
  // translucent side nets on the near faces
  const fv = iso.faceVQuad(v1, u0, u1, z + H * 0.35, zt);
  const fu = iso.faceUQuad(u1, v0, v1, z + H * 0.35, zt);
  iso.poly(fv, alpha(net, 0.45));
  iso.poly(fu, alpha(shade(net, -0.3), 0.55));
  // front posts
  for (let u = u0; u <= u1 + 1e-6; u += (u1 - u0) / Math.max(1, Math.round((u1 - u0) / step))) iso.line([u, v1, z], [u, v1, zt], pole, 1.6);
  for (let v = v0; v < v1 - 1e-6; v += (v1 - v0) / Math.max(1, Math.round((v1 - v0) / step))) iso.line([u1, v, z], [u1, v, zt], pole, 1.6);
  // roof net with a woven sheen
  const roof = iso.topQuad(u0 - 0.01, v0 - 0.01, u1 + 0.01, v1 + 0.01, zt);
  iso.poly(roof, alpha(net, 0.82), alpha('#16301a', 0.7), 1);
  iso.clipped(roof, () => {
    for (let u = u0; u < u1; u += 0.03) iso.line([u, v0, zt], [u, v1, zt], alpha('#8fc07a', 0.25), 0.6);
    iso.poly(iso.topQuad(u0, v0, u0 + (u1 - u0) * 0.4, v1, zt), alpha('#ffffff', 0.08));
  });
  iso.line([u0, v1 + 0.01, zt], [u1 + 0.01, v1 + 0.01, zt], alpha('#a8d890', 0.6), 1);
}

/** Plastic-film hoop tunnel (polyhouse) along u. */
function polyTunnel(iso: Iso, u0: number, u1: number, v0: number, v1: number, z: number, H: number): void {
  const vc = (v0 + v1) / 2;
  const hw = (v1 - v0) / 2;
  const seg = 10;
  const pt = (u: number, t: number): P3 => [u, vc - hw * Math.cos(Math.PI * t), z + H * Math.sin(Math.PI * t)];
  iso.aoRect(u0, v0, u1, v1, z, 0.05, 0.35);
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg;
    const t1 = (i + 1) / seg;
    const slope = Math.cos(Math.PI * (t0 + t1) / 2); // +1 back, −1 front
    const col = shade('#e6ecef', 0.04 - (slope < 0 ? 0.02 : 0.14) * Math.abs(slope));
    iso.poly([pt(u0, t0), pt(u1, t0), pt(u1, t1), pt(u0, t1)], alpha(col, 0.92));
  }
  // hoops
  for (let u = u0 + 0.1; u < u1; u += 0.16) {
    const ring: P3[] = [];
    for (let i = 5; i <= seg; i++) ring.push(pt(u, i / seg));
    iso.polyline(ring, alpha('#8a959c', 0.6), 1);
  }
  const ridge: P3[] = [pt(u0, 0.5), pt(u1, 0.5)];
  iso.polyline(ridge, alpha('#ffffff', 0.7), 1.2);
  // gable end (faces +u) with a door
  const end: P3[] = [];
  for (let i = 0; i <= seg; i++) end.push(pt(u1, i / seg));
  iso.poly(end, alpha('#c8d0d4', 0.95), alpha('#5a646a', 0.7), 1);
  iso.poly(iso.faceUQuad(u1, vc - hw * 0.25, vc + hw * 0.25, z, z + H * 0.65), '#5a6a50');
  iso.polyline([pt(u0, 0), pt(u1, 0)], alpha('#5a646a', 0.6), 1);
  iso.polyline([pt(u0, 1), pt(u1, 1)], alpha('#5a646a', 0.7), 1);
}

/** Small whitewashed office with a signboard on the +v face. */
function nurseryOffice(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, sign: string): void {
  const H = 0.14;
  iso.aoRect(u0, v0, u1, v1, z, 0.04, 0.4);
  iso.boxLit(u0, v0, u1, v1, z, z + H, mat(C.whitewash, { right: -0.25 }));
  grime(iso, u0, v0, u1, v1, z, 0.04, 0.25);
  iso.archV(v1, u0 + 0.04, u0 + 0.1, z, z + 0.1, '#4a3a2e');
  windowU(iso, u1, v0 + 0.05, v1 - 0.05, z + 0.05, z + 0.1, '#3b3a44', '#6a8a5a');
  iso.box(u0 - 0.015, v0 - 0.015, u1 + 0.015, v1 + 0.03, z + H, z + H + 0.012, mat('#6a8a5a'));
  // signboard on two posts on the roof edge
  const s0 = u0 + 0.02;
  const s1 = u1 - 0.02;
  iso.line([s0 + 0.02, v1, z + H], [s0 + 0.02, v1, z + H + 0.06], '#3a3a3e', 1.2);
  iso.line([s1 - 0.02, v1, z + H], [s1 - 0.02, v1, z + H + 0.06], '#3a3a3e', 1.2);
  const board = iso.faceVQuad(v1 + 0.004, s0, s1, z + H + 0.03, z + H + 0.09);
  iso.poly(board, sign, alpha('#1a2a14', 0.8), 1);
  for (let i = 0; i < 2; i++) {
    const a = s0 + 0.03 + rng() * 0.02;
    iso.line([a, v1 + 0.004, z + H + 0.07 - i * 0.022], [s1 - 0.03 - rng() * 0.03, v1 + 0.004, z + H + 0.07 - i * 0.022], alpha('#f7f1e3', 0.9), i === 0 ? 1.8 : 1);
  }
}

function drawNursery(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('greenhouse_garden', variant);
  const z = 0.02;
  slab(iso, rng, 0.015, z, C.earth, C.earthDark);
  iso.speckle(iso.topQuad(0.02, 0.02, 1.98, 1.98, z), rng, 700, [alpha('#6a4a30', 0.4), alpha('#e8d0a0', 0.3)], 1.2);
  if (variant === 0) {
    // two shade-net houses at the back, pot rows in front, office by the gate
    for (let v = 0.14; v < 0.74; v += 0.1) potRow(iso, rng, 0.14, 0.86, v, z, 'bag');
    shadeNet(iso, 0.1, 0.1, 0.9, 0.8, z, 0.2);
    for (let v = 0.14; v < 0.74; v += 0.1) potRow(iso, rng, 1.1, 1.86, v, z, v < 0.4 ? 'clay' : 'bag');
    shadeNet(iso, 1.06, 0.1, 1.9, 0.8, z, 0.2, '#3a5a8a');
    gravelPath(iso, rng, 0.05, 0.9, 1.95, 1.06, z, '#cdb48a');
    for (let v = 1.18; v < 1.9; v += 0.1) potRow(iso, rng, 0.9, 1.9, v, z, v < 1.5 ? 'flower' : 'clay');
    // big terracotta pots and a mango tree near the office
    lushTree(iso, rng, 0.2, 1.24, z, 0.14, 'mango');
    nurseryOffice(iso, rng, 0.14, 1.5, 0.52, 1.84, z, '#2f6a3a');
    planter(iso, rng, 0.66, 1.36, z, 0.05, '#b0603c', 'flowers');
    planter(iso, rng, 0.7, 1.8, z, 0.05, '#b0603c', 'shrub');
    drum(iso, 0.62, 1.58, z, 0.035, 0.07, C.tarpBlue);
    person(iso, rng, 1.02, 1.3, z, false, '#3aa36b');
  } else {
    // polyhouse tunnel + open beds of flowering pots and saplings under a bamboo fence
    polyTunnel(iso, 0.1, 1.46, 0.12, 0.66, z, 0.22);
    lushTree(iso, rng, 1.76, 0.26, z, 0.14, 'neem');
    gravelPath(iso, rng, 0.05, 0.78, 1.95, 0.92, z, '#cdb48a');
    for (let v = 1.02; v < 1.9; v += 0.1) potRow(iso, rng, 0.1, 1.0, v, z, v < 1.4 ? 'flower' : 'bag');
    shadeNet(iso, 1.14, 1.0, 1.9, 1.52, z, 0.16);
    nurseryOffice(iso, rng, 1.2, 1.6, 1.62, 1.92, z, '#8c3b2b');
    person(iso, rng, 1.02, 0.84, z, false, '#e8c86a');
    for (const [pu, pv] of [[1.76, 1.66], [1.8, 1.84]] as [number, number][]) planter(iso, rng, pu, pv, z, 0.04, '#b0603c', 'flowers');
  }
}

// ============================================================================
// CAMPGROUND (1×1): tents round a campfire (hidden on the Varanasi map)
// ============================================================================

/** A-frame ridge tent along u. */
function tent(iso: Iso, u0: number, u1: number, vc: number, hw: number, z: number, H: number, color: string): void {
  iso.aoRect(u0, vc - hw, u1, vc + hw, z, 0.04, 0.4);
  iso.poly([[u0, vc - hw, z], [u1, vc - hw, z], [u1, vc, z + H], [u0, vc, z + H]], shade(color, -0.3), alpha(shade(color, -0.6), 0.7), 1);
  iso.poly([[u0, vc, z + H], [u1, vc, z + H], [u1, vc + hw, z], [u0, vc + hw, z]], color, alpha(shade(color, -0.6), 0.7), 1);
  iso.poly([[u1, vc - hw, z], [u1, vc + hw, z], [u1, vc, z + H]], shade(color, -0.18), alpha(shade(color, -0.6), 0.7), 1);
  iso.poly([[u1, vc - hw * 0.35, z], [u1, vc + hw * 0.35, z], [u1, vc, z + H * 0.7]], '#2e241c');
  iso.line([u0 - 0.02, vc, z + H + 0.004], [u1 + 0.02, vc, z + H + 0.004], alpha(shade(color, 0.4), 0.8), 1.1);
  // guy ropes
  iso.line([u1 + 0.02, vc, z + H], [u1 + 0.07, vc, z], alpha('#e8dcc2', 0.8), 0.7);
  iso.line([u1, vc + hw * 0.5, z + H * 0.5], [u1 - 0.04, vc + hw + 0.05, z], alpha('#e8dcc2', 0.7), 0.6);
}

function campfire(iso: Iso, rng: Rng, u: number, v: number, z: number): void {
  const { ctx } = iso;
  iso.ellipse(u, v, z, 0.07, alpha('#f5a623', 0.18));
  iso.ellipse(u, v, z, 0.04, '#4a3a2e');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    iso.ellipse(u + Math.cos(a) * 0.04, v + Math.sin(a) * 0.04, z + 0.004, 0.009, '#8a857c', alpha('#3a3530', 0.7), 0.6);
  }
  iso.line([u - 0.025, v - 0.01, z + 0.006], [u + 0.02, v + 0.015, z + 0.01], '#5a3a22', 2);
  iso.line([u - 0.01, v + 0.025, z + 0.006], [u + 0.015, v - 0.02, z + 0.01], '#6b4a2a', 2);
  const [x, y] = iso.pt(u, v, z + 0.01);
  const p = iso.px;
  for (const [s, c] of [[1, '#e0501e'], [0.65, '#f5a623'], [0.35, '#fff0a8']] as [number, string][]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - 6 * p * s, y);
    ctx.quadraticCurveTo(x - 5 * p * s, y - 10 * p * s, x + (rng() - 0.5) * 2 * p, y - 20 * p * s);
    ctx.quadraticCurveTo(x + 5 * p * s, y - 9 * p * s, x + 6 * p * s, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCampground(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('campground', variant);
  const z = lawnPlot(iso, rng, C.grass);
  iso.ellipse(0.52, 0.56, z, 0.3, alpha(C.dust, 0.75));
  iso.speckle(iso.topQuad(0.25, 0.3, 0.8, 0.82, z), rng, 90, [alpha('#8a6b4a', 0.35)], 1.2);
  if (variant === 0) {
    lushTree(iso, rng, 0.18, 0.2, z, 0.12, 'neem');
    tent(iso, 0.5, 0.82, 0.2, 0.09, z, 0.1, C.saffron);
    tent(iso, 0.08, 0.36, 0.62, 0.09, z, 0.1, '#3a8f5c');
    campfire(iso, rng, 0.56, 0.58, z);
    person(iso, rng, 0.66, 0.5, z, true, '#3a86c8');
    person(iso, rng, 0.48, 0.68, z, true);
    charpai(iso, 0.78, 0.66, z);
    drum(iso, 0.3, 0.88, z, 0.025, 0.05, '#c99a3a');
  } else {
    // swiss tent with a fly roof, a shamiyana over durries, a chulha with a kettle
    const u0 = 0.1;
    const u1 = 0.44;
    const v0 = 0.1;
    const v1 = 0.4;
    iso.aoRect(u0, v0, u1, v1, z, 0.04, 0.4);
    iso.boxLit(u0 + 0.03, v0 + 0.03, u1 - 0.03, v1 - 0.03, z, z + 0.08, mat('#d8c8a0', { right: -0.25 }));
    iso.poly(iso.faceUQuad(u1 - 0.03, v0 + 0.1, v1 - 0.1, z, z + 0.07), '#4a3a2e');
    const zr = z + 0.08;
    iso.poly([[u0, v0, zr], [u1, v0, zr], [u1, (v0 + v1) / 2, zr + 0.07], [u0, (v0 + v1) / 2, zr + 0.07]], shade('#8a8a5a', -0.2), alpha('#2a2a1a', 0.7), 1);
    iso.poly([[u0, (v0 + v1) / 2, zr + 0.07], [u1, (v0 + v1) / 2, zr + 0.07], [u1, v1, zr], [u0, v1, zr]], '#8a8a5a', alpha('#2a2a1a', 0.7), 1);
    iso.poly([[u1, v0, zr], [u1, v1, zr], [u1, (v0 + v1) / 2, zr + 0.07]], shade('#8a8a5a', -0.35));
    lushTree(iso, rng, 0.8, 0.18, z, 0.12, 'mango');
    // shamiyana
    const s0: [number, number] = [0.44, 0.5];
    const s1: [number, number] = [0.86, 0.86];
    iso.poly(iso.topQuad(s0[0], s0[1], s1[0], s1[1], z + 0.002), '#b8413a');
    iso.clipped(iso.topQuad(s0[0], s0[1], s1[0], s1[1], z + 0.002), () => {
      for (let a = s0[1]; a < s1[1]; a += 0.06) iso.poly(iso.topQuad(s0[0], a, s1[0], a + 0.02, z + 0.002), alpha('#f2c14e', 0.8));
    });
    person(iso, rng, 0.56, 0.62, z, true, '#f1ebdd');
    person(iso, rng, 0.7, 0.72, z, true, '#e4572e');
    const H = 0.17;
    for (const [pu, pv] of [[s0[0], s0[1]], [s1[0], s0[1]], [s0[0], s1[1]]]) iso.line([pu, pv, z], [pu, pv, z + H], '#6b4a2a', 1.6);
    const roof = iso.topQuad(s0[0] - 0.02, s0[1] - 0.02, s1[0] + 0.02, s1[1] + 0.02, z + H);
    iso.poly(roof, '#f2e6c8', alpha('#6a4a2a', 0.7), 1);
    iso.clipped(roof, () => {
      for (let a = s0[0]; a < s1[0]; a += 0.08) iso.poly(iso.topQuad(a, s0[1] - 0.02, a + 0.04, s1[1] + 0.02, z + H), '#e46a3a');
    });
    iso.poly(iso.faceVQuad(s1[1] + 0.02, s0[0] - 0.02, s1[0] + 0.02, z + H - 0.03, z + H), '#2f6fb3');
    iso.poly(iso.faceUQuad(s1[0] + 0.02, s0[1] - 0.02, s1[1] + 0.02, z + H - 0.03, z + H), shade('#2f6fb3', -0.25));
    iso.line([s1[0], s1[1], z], [s1[0], s1[1], z + H], '#6b4a2a', 1.6);
    campfire(iso, rng, 0.22, 0.72, z);
    charpai(iso, 0.08, 0.78, z);
  }
}

// ============================================================================
// LARGE GARDEN (park_large, 3×3): Mughal char-bagh, or a banyan "company bagh"
// ============================================================================

/** Painter's queue: items drawn in order of increasing depth (u + v). */
class DepthQueue {
  private items: { d: number; f: () => void }[] = [];
  add(u: number, v: number, f: () => void): void {
    this.items.push({ d: u + v, f });
  }
  flush(): void {
    this.items.sort((a, b) => a.d - b.d).forEach((it) => it.f());
    this.items = [];
  }
}

/** Baradari: arcaded garden pavilion on a plinth, with corner chhatris and a central dome. */
function baradari(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, stone: string, trim: string): void {
  const m = mat(stone);
  const pz = z + 0.05;
  iso.aoRect(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, z, 0.05, 0.35);
  iso.boxLit(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, z, pz, mat(shade(stone, 0.05)));
  coursesV(iso, rng, v1 + 0.03, u0 - 0.03, u1 + 0.03, z, pz, 0.017, 0.07, alpha('#3a1a10', 0.2), 0.6);
  const H = 0.2;
  iso.boxLit(u0, v0, u1, v1, pz, pz + H, m);
  // arcades: dark arches on the two visible faces
  const nv = 3;
  const du = (u1 - u0) / nv;
  for (let i = 0; i < nv; i++) {
    iso.archV(v1, u0 + i * du + du * 0.18, u0 + (i + 1) * du - du * 0.18, pz, pz + H * 0.72, trim, true);
    iso.archV(v1, u0 + i * du + du * 0.24, u0 + (i + 1) * du - du * 0.24, pz, pz + H * 0.66, '#2e1c16', true);
  }
  const nu = 3;
  const dv = (v1 - v0) / nu;
  for (let i = 0; i < nu; i++) {
    iso.archU(u1, v0 + i * dv + dv * 0.18, v0 + (i + 1) * dv - dv * 0.18, pz, pz + H * 0.72, shade(trim, -0.2), true);
    iso.archU(u1, v0 + i * dv + dv * 0.24, v0 + (i + 1) * dv - dv * 0.24, pz, pz + H * 0.66, '#231510', true);
  }
  weatherV(iso, rng, v1, u0, u1, pz, pz + H, 8, 0.1);
  // chhajja + parapet
  const zc = pz + H;
  iso.box(u0 - 0.03, v0 - 0.03, u1 + 0.03, v1 + 0.03, zc, zc + 0.014, mat(trim));
  iso.box(u0, v0, u1, v1, zc + 0.014, zc + 0.04, m);
  merlons(iso, u0, v1 - 0.012, u1, v1, zc + 0.04, 'u', m);
  merlons(iso, u1 - 0.012, v0, u1, v1, zc + 0.04, 'v', m);
  const s = 0.09;
  chhatri(iso, rng, u0 + 0.005, v0 + 0.005, zc + 0.04, s, stone, trim);
  chhatri(iso, rng, u1 - s - 0.005, v0 + 0.005, zc + 0.04, s, stone, trim);
  chhatri(iso, rng, u0 + 0.005, v1 - s - 0.005, zc + 0.04, s, stone, trim);
  dome(iso, (u0 + u1) / 2, (v0 + v1) / 2, zc + 0.04, Math.min(u1 - u0, v1 - v0) * 0.26, trim, 'onion');
  chhatri(iso, rng, u1 - s - 0.005, v1 - s - 0.005, zc + 0.04, s, stone, trim);
}

/** Children's swing: A-frame posts with two seats. */
function swing(iso: Iso, u: number, v0: number, v1: number, z: number): void {
  const H = 0.16;
  const col = '#c0392b';
  for (const v of [v0, v1]) {
    iso.line([u - 0.05, v, z], [u, v, z + H], col, 1.6);
    iso.line([u + 0.05, v, z], [u, v, z + H], col, 1.6);
  }
  iso.line([u, v0, z + H], [u, v1, z + H], '#8a2a1e', 2);
  for (const t of [0.3, 0.7]) {
    const v = v0 + (v1 - v0) * t;
    iso.line([u, v - 0.02, z + H], [u, v - 0.02, z + 0.04], alpha('#3a3a3e', 0.8), 0.8);
    iso.line([u, v + 0.02, z + H], [u, v + 0.02, z + 0.04], alpha('#3a3a3e', 0.8), 0.8);
    iso.box(u - 0.012, v - 0.024, u + 0.012, v + 0.024, z + 0.035, z + 0.042, mat('#f2c14e'), { edges: false });
  }
}

function drawLargeGarden(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('park_large', variant);
  const z = lawnPlot(iso, rng);
  const q = new DepthQueue();
  if (variant === 0) {
    const stone = P.redSandstone;
    const trim = '#ecdcb8';
    const lo = 0.05;
    const hi = 2.95;
    const c = 1.5;
    // raised khiyaban walkways with a central water channel along both axes
    gravelPath(iso, rng, c - 0.17, 0.12, c + 0.17, hi - 0.02, z, '#d8b890', true, 0.4);
    gravelPath(iso, rng, 0.12, c - 0.17, hi - 0.1, c + 0.17, z, '#d8b890', true, 0.4);
    paving(iso, rng, c - 0.17, 0.12, c + 0.17, hi - 0.02, z + 0.001, 0.34, 0.12, alpha('#8a5a3a', 0.25));
    waterChannel(iso, rng, c - 0.05, 0.62, c + 0.05, c - 0.3, z, 0.016, stone);
    waterChannel(iso, rng, c - 0.05, c + 0.3, c + 0.05, hi - 0.2, z, 0.016, stone);
    waterChannel(iso, rng, 0.2, c - 0.05, c - 0.3, c + 0.05, z, 0.016, stone);
    waterChannel(iso, rng, c + 0.3, c - 0.05, hi - 0.2, c + 0.05, z, 0.016, stone);
    // flower borders round each quadrant
    for (const [a0, a1] of [[0.2, c - 0.24], [c + 0.24, hi - 0.15]] as [number, number][]) {
      for (const [b0, b1] of [[0.2, c - 0.24], [c + 0.24, hi - 0.15]] as [number, number][]) {
        flowerBed(iso, rng, a0, b0, a1, b0 + 0.08, z, P.flowers, stone, 0.45);
        flowerBed(iso, rng, a0, b1 - 0.08, a1, b1, z, P.flowers, stone, 0.45);
        // quadrant fruit trees
        q.add(a0 + 0.35, b0 + 0.35, () => lushTree(iso, rng, a0 + 0.35, b0 + 0.35, z, 0.17, rng() < 0.5 ? 'mango' : 'neem'));
        q.add(a1 - 0.3, b1 - 0.35, () => lushTree(iso, rng, a1 - 0.3, b1 - 0.35, z, 0.13, 'ashoka'));
      }
    }
    // central platform with the hauz and fountain
    iso.aoRect(c - 0.3, c - 0.3, c + 0.3, c + 0.3, z, 0.05, 0.3);
    iso.boxLit(c - 0.3, c - 0.3, c + 0.3, c + 0.3, z, z + 0.03, mat(shade(stone, 0.06)));
    paving(iso, rng, c - 0.3, c - 0.3, c + 0.3, c + 0.3, z + 0.03, 0.1, 0.1, alpha('#5a2a1a', 0.3));
    q.add(c, c, () => hauz(iso, rng, c - 0.2, c - 0.2, c + 0.2, c + 0.2, z + 0.03, 0.03, trim));
    // cypress avenues along the axes
    for (let a = 0.72; a < hi - 0.2; a += 0.3) {
      if (Math.abs(a - c) < 0.35) continue;
      for (const s of [-0.21, 0.21]) {
        q.add(c + s, a, () => lushTree(iso, rng, c + s, a, z, 0.05, 'cypress'));
        q.add(a, c + s, () => lushTree(iso, rng, a, c + s, z, 0.05, 'cypress'));
      }
    }
    // baradari at the head of the main axis, benches and visitors
    q.add(c + 0.25, 0.4, () => baradari(iso, rng, c - 0.25, 0.14, c + 0.25, 0.54, z, stone, trim));
    for (const [bu, bv, al] of [[c - 0.3, 2.2, 'v'], [c + 0.26, 0.9, 'v'], [2.2, c + 0.26, 'u'], [0.8, c - 0.3, 'u']] as [number, number, 'u' | 'v'][]) q.add(bu, bv, () => bench(iso, bu, bv, z, al, trim));
    for (let i = 0; i < 7; i++) {
      const along = rng() < 0.5;
      const a = 0.4 + rng() * 2.2;
      const pu = along ? c + (rng() - 0.5) * 0.24 : a;
      const pv = along ? a : c + (rng() - 0.5) * 0.24;
      if (Math.abs(pu - c) < 0.32 && Math.abs(pv - c) < 0.32) continue;
      q.add(pu, pv, () => person(iso, rng, pu, pv, z));
    }
    // corner chhatris on octagonal-ish bastions (drawn with the walls)
    compoundWall(iso, rng, lo, hi, z, 0.07, 0.04, mat(stone), mat(trim), 'back');
    q.add(0.02, 0.02, () => chhatri(iso, rng, 0.0, 0.0, z + 0.0, 0.16, stone, trim));
    q.add(hi, 0.1, () => chhatri(iso, rng, hi - 0.16, 0.0, z, 0.16, stone, trim));
    q.add(0.1, hi, () => chhatri(iso, rng, 0.0, hi - 0.16, z, 0.16, stone, trim));
    q.flush();
    compoundWall(iso, rng, lo, hi, z, 0.07, 0.04, mat(stone), mat(trim), 'front', { v0: c - 0.2, v1: c + 0.2 });
    chhatri(iso, rng, hi - 0.16, hi - 0.16, z, 0.16, stone, trim);
    lampPost(iso, c - 0.24, hi - 0.02, z, 0.18);
    lampPost(iso, c + 0.24, hi - 0.02, z, 0.18);
  } else {
    // company bagh: a great banyan with a shrine, walking track, lotus pond, swings and benches
    const c = 1.5;
    iso.ellipse(c, c, z + 0.002, 1.28, '#d8c49a');
    iso.ellipse(c, c, z + 0.003, 1.12, C.lawn);
    iso.speckle(iso.topQuad(0.5, 0.5, 2.5, 2.5, z + 0.003), rng, 250, [alpha(C.lawnDark, 0.35), alpha('#a6d468', 0.3)], 1.4);
    gravelPath(iso, rng, c - 0.12, 2.64, c + 0.12, 2.98, z, '#d8c49a');
    railing(iso, z, 'back');
    hauz(iso, rng, 1.9, 0.35, 2.6, 0.9, z, 0.025, C.chunar, false);
    q.add(0.4, 0.4, () => lushTree(iso, rng, 0.4, 0.4, z, 0.26, 'peepal'));
    q.add(2.6, 1.5, () => lushTree(iso, rng, 2.62, 1.45, z, 0.18, 'gulmohar'));
    q.add(0.5, 2.5, () => lushTree(iso, rng, 0.42, 2.5, z, 0.2, 'neem'));
    q.add(2.5, 2.5, () => lushTree(iso, rng, 2.58, 2.58, z, 0.14, 'mango'));
    q.add(0.35, 1.5, () => lushTree(iso, rng, 0.3, 1.4, z, 0.14, 'mango'));
    q.add(1.5, 0.3, () => lushTree(iso, rng, 1.35, 0.28, z, 0.15, 'neem'));
    // the banyan on its chabutra
    q.add(c, c, () => {
      const zt = chabutra(iso, rng, c, c, z, 0.2);
      lushTree(iso, rng, c, c, zt, 0.52, 'banyan');
      kalava(iso, c, c, zt, 0.05);
    });
    q.add(2.4, 1.9, () => swing(iso, 2.25, 1.8, 2.1, z));
    for (const [bu, bv, al] of [[0.62, 1.5, 'v'], [1.5, 0.62, 'u'], [2.2, 2.25, 'u'], [1.0, 2.35, 'u']] as [number, number, 'u' | 'v'][]) q.add(bu, bv, () => bench(iso, bu, bv, z, al));
    // walkers on the track
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2;
      const pu = c + Math.cos(a) * 1.2;
      const pv = c + Math.sin(a) * 1.2;
      q.add(pu, pv, () => person(iso, rng, pu, pv, z));
    }
    q.add(2.1, 1.1, () => cow(iso, 2.1, 1.1, z, 'u', '#ece6da', true));
    q.flush();
    railing(iso, z, 'front', [c - 0.14, c + 0.14]);
  }
}

// ============================================================================
// MOUNTAIN LODGE (2×2): hill-station dak bungalow (hidden on the Varanasi map)
// ============================================================================

/** Corrugated gable roof with the ridge along u; eaves at v0 / v1. Returns nothing. */
function gableRoof(iso: Iso, u0: number, u1: number, v0: number, v1: number, zE: number, zR: number, color: string, part: 'back' | 'front'): void {
  const vm = (v0 + v1) / 2;
  const slope: P3[] = part === 'back'
    ? [[u0, v0, zE], [u1, v0, zE], [u1, vm, zR], [u0, vm, zR]]
    : [[u0, vm, zR], [u1, vm, zR], [u1, v1, zE], [u0, v1, zE]];
  iso.poly(slope, part === 'back' ? shade(color, -0.18) : color, alpha(shade(color, -0.6), 0.8), 1.1);
  iso.clipped(slope, () => {
    for (let u = u0 + 0.02; u < u1; u += 0.03) {
      iso.line([u, part === 'back' ? v0 : vm, part === 'back' ? zE : zR], [u, part === 'back' ? vm : v1, part === 'back' ? zR : zE], alpha(shade(color, -0.45), 0.35), 0.7);
    }
  });
  if (part === 'front') {
    iso.line([u0, vm, zR + 0.002], [u1, vm, zR + 0.002], alpha(shade(color, 0.45), 0.9), 1.6);
    iso.line([u0, v1, zE], [u1, v1, zE], alpha(shade(color, -0.6), 0.8), 1.6);
    // end facing +u: barge board
    iso.polyline([[u1, v0, zE], [u1, vm, zR], [u1, v1, zE]], '#f1ebdd', 2);
  }
}

function drawMountainLodge(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('mountain_lodge', variant);
  const z = lawnPlot(iso, rng, C.grass);
  const stoneC = '#9a948a';
  const roofC = variant === 1 ? '#3f6a4a' : '#a8402e';
  const u0 = 0.3;
  const u1 = 1.55;
  const v0 = 0.32;
  const v1 = 1.28;
  const vr = 1.58; // verandah edge
  // deodars behind
  lushTree(iso, rng, 0.2, 0.22, z, 0.13, 'deodar');
  lushTree(iso, rng, 1.2, 0.12, z, 0.1, 'deodar');
  lushTree(iso, rng, 0.14, 1.0, z, 0.11, 'deodar');
  lushTree(iso, rng, 1.82, 0.4, z, 0.12, 'deodar');
  // stone plinth
  const zb = z + 0.06;
  iso.aoRect(u0 - 0.02, v0 - 0.02, u1 + 0.02, vr + 0.02, z, 0.06, 0.4);
  iso.boxLit(u0 - 0.02, v0 - 0.02, u1 + 0.02, vr + 0.02, z, zb, mat(stoneC));
  coursesV(iso, rng, vr + 0.02, u0 - 0.02, u1 + 0.02, z, zb, 0.02, 0.05, alpha('#3a3a3e', 0.35), 0.7);
  coursesU(iso, rng, u1 + 0.02, v0 - 0.02, vr + 0.02, z, zb, 0.02, 0.05, alpha('#3a3a3e', 0.35), 0.7);
  // walls: timber-framed whitewash (v0) or dressed stone (v1)
  const H = 0.22;
  const zw = zb + H;
  const wall = variant === 1 ? '#b8b0a2' : C.whitewash;
  iso.boxLit(u0, v0, u1, v1, zb, zw, mat(wall, { right: -0.28 }));
  if (variant === 1) {
    coursesV(iso, rng, v1, u0, u1, zb, zw, 0.025, 0.06, alpha('#4a4540', 0.35), 0.7);
    coursesU(iso, rng, u1, v0, v1, zb, zw, 0.025, 0.06, alpha('#4a4540', 0.35), 0.7);
  } else {
    for (let u = u0; u <= u1 + 1e-6; u += (u1 - u0) / 6) iso.line([u, v1, zb], [u, v1, zw], '#5a3a22', 1.6);
    for (let v = v0; v <= v1 + 1e-6; v += (v1 - v0) / 4) iso.line([u1, v, zb], [u1, v, zw], '#4a2e1a', 1.6);
    iso.line([u0, v1, zb + H * 0.5], [u1, v1, zb + H * 0.5], '#5a3a22', 1.2);
    iso.line([u1, v0, zb + H * 0.5], [u1, v1, zb + H * 0.5], '#4a2e1a', 1.2);
  }
  const frame = '#2f5a3a';
  for (let i = 0; i < 3; i++) {
    const a = u0 + 0.12 + i * 0.4;
    if (i === 1) iso.poly(iso.faceVQuad(v1, a + 0.04, a + 0.16, zb, zb + 0.15), '#5a3a22', alpha('#2a1a10', 0.8), 1);
    else windowV(iso, v1, a + 0.02, a + 0.18, zb + 0.06, zb + 0.16, '#3b3a44', frame);
  }
  windowU(iso, u1, v0 + 0.15, v0 + 0.33, zb + 0.06, zb + 0.16, '#3b3a44', frame);
  windowU(iso, u1, v1 - 0.33, v1 - 0.15, zb + 0.06, zb + 0.16, '#3b3a44', frame);
  // gable end wall above the eaves on the +u face
  const zR = zw + 0.2;
  const vm = (v0 + v1) / 2;
  iso.poly([[u1, v0, zw], [u1, v1, zw], [u1, vm, zR]], variant === 1 ? shade(wall, -0.3) : '#c9b89a', alpha('#2a1a10', 0.6), 1);
  iso.poly(iso.faceUQuad(u1, vm - 0.06, vm + 0.06, zw + 0.03, zw + 0.09), '#3b3a44', frame, 1.2);
  const o = 0.06;
  gableRoof(iso, u0 - o, u1 + o, v0 - o, v1 + o, zw - 0.01, zR, roofC, 'back');
  // chimney through the back slope, with a wisp of smoke
  const cu = u0 + 0.25;
  const cv = v0 + 0.2;
  iso.boxLit(cu, cv, cu + 0.08, cv + 0.08, zw, zR + 0.1, mat(stoneC));
  iso.box(cu - 0.008, cv - 0.008, cu + 0.088, cv + 0.088, zR + 0.1, zR + 0.115, mat(shade(stoneC, -0.2)));
  for (let i = 0; i < 4; i++) iso.ellipse(cu + 0.04 + i * 0.03, cv + 0.02 - i * 0.03, zR + 0.16 + i * 0.05, 0.025 + i * 0.012, alpha('#e8ecef', 0.45 - i * 0.08));
  gableRoof(iso, u0 - o, u1 + o, v0 - o, v1 + o, zw - 0.01, zR, roofC, 'front');
  // verandah: timber deck, people, posts, railing and a lean-to roof
  iso.poly(iso.topQuad(u0, v1, u1, vr, zb), '#9a7048');
  iso.clipped(iso.topQuad(u0, v1, u1, vr, zb), () => {
    for (let u = u0; u < u1; u += 0.03) iso.line([u, v1, zb], [u, vr, zb], alpha('#3a2616', 0.35), 0.7);
  });
  person(iso, rng, u0 + 0.5, v1 + 0.12, zb, true, '#8c3b2b');
  iso.box(u0 + 0.55, v1 + 0.06, u0 + 0.65, v1 + 0.16, zb, zb + 0.03, mat('#7b5434'), { edges: false });
  const zp = zw - 0.03;
  for (let u = u0 + 0.02; u <= u1; u += (u1 - u0 - 0.04) / 5) {
    iso.boxLit(u - 0.012, vr - 0.03, u + 0.012, vr - 0.006, zb, zp, mat('#f1ebdd', { right: -0.3 }));
  }
  for (const hh of [0.03, 0.06]) iso.line([u0, vr - 0.018, zb + hh], [u1 - 0.24, vr - 0.018, zb + hh], '#f1ebdd', 1.3);
  const vroof: P3[] = [[u0 - o, v1, zw - 0.01], [u1 + o, v1, zw - 0.01], [u1 + o, vr + 0.04, zp - 0.01], [u0 - o, vr + 0.04, zp - 0.01]];
  iso.poly(vroof, shade(roofC, 0.06), alpha(shade(roofC, -0.6), 0.8), 1.1);
  iso.clipped(vroof, () => {
    for (let u = u0 - o + 0.02; u < u1 + o; u += 0.03) iso.line([u, v1, zw - 0.01], [u, vr + 0.04, zp - 0.01], alpha(shade(roofC, -0.45), 0.35), 0.7);
  });
  iso.poly(iso.faceVQuad(vr + 0.04, u0 - o, u1 + o, zp - 0.025, zp - 0.01), '#f1ebdd');
  // steps down to a path, flower pots, a signboard
  iso.boxLit(u1 - 0.22, vr + 0.02, u1 - 0.06, vr + 0.1, z, zb - 0.03, mat(stoneC));
  gravelPath(iso, rng, u1 - 0.22, vr + 0.1, u1 - 0.06, 1.98, z, '#bca57a');
  planter(iso, rng, u0 + 0.1, vr + 0.12, z, 0.04, '#b0603c', 'flowers');
  planter(iso, rng, u1 - 0.34, vr + 0.14, z, 0.04, '#b0603c', 'flowers');
  if (variant === 1) {
    // woodpile against the plinth and an apple orchard corner
    for (let i = 0; i < 3; i++) iso.box(1.64, 0.5 + i * 0.001, 1.74, 0.9, z + i * 0.025, z + (i + 1) * 0.025, mat('#8a5a34', { top: 0.2 }));
    lushTree(iso, rng, 1.8, 1.25, z, 0.11, 'mango');
    lushTree(iso, rng, 0.3, 1.82, z, 0.1, 'mango');
  } else {
    lushTree(iso, rng, 1.84, 1.2, z, 0.12, 'deodar');
    lushTree(iso, rng, 0.26, 1.8, z, 0.11, 'deodar');
    iso.line([1.72, 1.86, z], [1.72, 1.86, z + 0.1], '#5a3a22', 1.6);
    iso.poly(iso.faceVQuad(1.87, 1.62, 1.82, z + 0.07, z + 0.12), '#f1ebdd', alpha('#2a1a10', 0.8), 1);
    iso.line([1.65, 1.87, z + 0.1], [1.79, 1.87, z + 0.1], alpha(C.govMaroon, 0.9), 1.4);
  }
}

// ============================================================================
// MOUNTAIN TRAILHEAD (3×3): deodar forest, boulders, a chai dhaba and prayer flags
// ============================================================================

/** Grey boulder: irregular lit polygon standing on the ground. */
function boulder(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number): void {
  const { ctx } = iso;
  iso.aoEllipse(u, v, r * 1.1, z, r * 0.4, 0.35);
  const [x, y] = iso.pt(u, v, z);
  const R = r * iso.T;
  const k = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < k; i++) {
    const a = Math.PI + (i / (k - 1)) * Math.PI;
    const rr = R * (0.75 + rng() * 0.35);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]);
  }
  ctx.beginPath();
  ctx.moveTo(x - R, y + R * 0.12);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.lineTo(x + R * 0.9, y + R * 0.2);
  ctx.quadraticCurveTo(x, y + R * 0.42, x - R, y + R * 0.12);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R * 0.4);
  g.addColorStop(0, '#c9c4ba');
  g.addColorStop(0.5, '#9a958c');
  g.addColorStop(1, '#6a665f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = alpha('#3a3632', 0.7);
  ctx.lineWidth = 1.1 * iso.px;
  ctx.stroke();
  ctx.fillStyle = alpha('#6f8a3a', 0.45);
  ctx.beginPath();
  ctx.ellipse(x - R * 0.2, y - R * 0.55, R * 0.35, R * 0.12, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

/** String of Tibetan-style prayer flags between two pole tops. */
function prayerFlags(iso: Iso, a: P3, b: P3, count: number): void {
  const cols = ['#2f6fb3', '#f1ebdd', '#c0392b', '#3a8f5c', '#f2c14e'];
  const sag = 0.05;
  const at = (t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - Math.sin(Math.PI * t) * sag];
  const line: P3[] = [];
  for (let i = 0; i <= 12; i++) line.push(at(i / 12));
  iso.polyline(line, alpha('#3a2a1a', 0.7), 0.7);
  for (let i = 1; i < count; i++) {
    const p = at(i / count);
    iso.poly([p, [p[0], p[1], p[2] - 0.035], [p[0] + (b[0] - a[0]) / count * 0.7, p[1] + (b[1] - a[1]) / count * 0.7, p[2] - 0.035], [p[0] + (b[0] - a[0]) / count * 0.7, p[1] + (b[1] - a[1]) / count * 0.7, p[2]]], cols[i % cols.length], alpha('#2a1a10', 0.35), 0.5);
  }
}

function drawTrailhead(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('mountain_trailhead', variant);
  const z = lawnPlot(iso, rng, '#6f8f45');
  iso.speckle(iso.topQuad(0.05, 0.05, 2.95, 2.95, z), rng, 600, [alpha('#8a7a5a', 0.35), alpha('#b9d27a', 0.3)], 1.6);
  // winding dirt trail from the front-left edge up to the back corner
  const trail: P3[] = [[1.7, 2.98, z], [1.62, 2.4, z], [1.25, 1.95, z], [1.4, 1.35, z], [0.95, 0.85, z], [0.7, 0.4, z], [0.45, 0.04, z]];
  iso.polyline(trail, alpha('#7a5f3e', 0.6), 26);
  iso.polyline(trail, '#b89a6a', 20);
  iso.polyline(trail, alpha('#d8c49a', 0.6), 7);
  const q = new DepthQueue();
  // deodar forest round the edges, clear of the trail and the dhaba
  const spots: [number, number, number][] = [
    [0.18, 0.3, 0.15], [0.2, 0.95, 0.13], [1.25, 0.25, 0.16], [1.9, 0.22, 0.14], [2.6, 0.3, 0.15], [0.3, 1.6, 0.14],
    [0.25, 2.3, 0.13], [2.7, 0.95, 0.13], [0.8, 2.7, 0.12], [2.75, 2.7, 0.12], [1.8, 0.7, 0.12], [0.62, 1.25, 0.1],
  ];
  for (const [u, v, s] of spots) q.add(u, v, () => lushTree(iso, rng, u, v, z, s * 1.25, 'deodar'));
  for (const [u, v, r] of [[1.0, 0.45, 0.07], [0.5, 2.0, 0.09], [2.1, 1.2, 0.06], [1.95, 2.55, 0.08], [0.95, 1.55, 0.05], [2.45, 1.4, 0.05], [1.15, 2.5, 0.06]] as [number, number, number][]) {
    q.add(u, v, () => boulder(iso, rng, u, v, z, r));
  }
  // chai dhaba with a tin roof, bench and a kettle on the chulha
  q.add(2.35, 2.05, () => {
    hut(iso, rng, 2.05, 1.7, 2.6, 2.2, z, 0.2, 0.15, '#c9b89a', 'tin', false, '#4a3a2e');
    iso.box(2.1, 2.26, 2.5, 2.32, z + 0.03, z + 0.04, mat('#7b5434'), { edges: false });
    for (const u of [2.13, 2.47]) iso.line([u, 2.29, z], [u, 2.29, z + 0.03], '#5a3a22', 1.4);
    iso.box(2.64, 1.8, 2.74, 1.9, z, z + 0.04, mat('#a4583a'));
    iso.lathe(2.69, 1.85, z + 0.04, [[0, 0.02], [0.02, 0.022], [0.035, 0.012], [0.04, 0]], () => '#8a8a8e', { outline: true });
    for (let i = 0; i < 3; i++) iso.ellipse(2.7 + i * 0.02, 1.84 - i * 0.02, z + 0.1 + i * 0.05, 0.02 + i * 0.01, alpha('#e8ecef', 0.4 - i * 0.1));
    person(iso, rng, 2.22, 2.3, z + 0.02, true);
    person(iso, rng, 2.38, 2.3, z + 0.02, true, '#b44ca0');
  });
  // prayer flags strung across the trail
  q.add(1.6, 1.7, () => {
    iso.line([1.0, 1.9, z], [1.0, 1.9, z + 0.32], '#6b4a2a', 1.6);
    iso.line([1.8, 1.55, z], [1.8, 1.55, z + 0.3], '#6b4a2a', 1.6);
    prayerFlags(iso, [1.0, 1.9, z + 0.32], [1.8, 1.55, z + 0.3], 14);
    prayerFlags(iso, [1.0, 1.9, z + 0.26], [1.8, 1.55, z + 0.24], 14);
  });
  // trail sign and hikers
  q.add(1.95, 2.75, () => {
    iso.line([1.95, 2.75, z], [1.95, 2.75, z + 0.14], '#5a3a22', 1.8);
    iso.poly(iso.faceVQuad(2.76, 1.85, 2.05, z + 0.09, z + 0.14), '#2f6a3a', alpha('#12301a', 0.8), 1);
    iso.line([1.88, 2.76, z + 0.12], [2.02, 2.76, z + 0.12], alpha('#f7f1e3', 0.9), 1.2);
  });
  for (const [u, v, c] of [[1.58, 2.25, '#e4572e'], [1.34, 1.72, '#3a86c8'], [1.3, 1.2, '#f2c14e'], [0.8, 0.62, '#3aa36b']] as [number, number, string][]) {
    q.add(u, v, () => {
      person(iso, rng, u, v, z, false, c);
      iso.box(u - 0.012, v - 0.018, u + 0.006, v - 0.004, z + 0.028, z + 0.05, mat('#8c3b2b'), { edges: false });
    });
  }
  q.flush();
  void variant;
}

// ============================================================================
// Registry
// ============================================================================

export const PARKS_SPRITES: Record<string, ProceduralSpriteDef> = {
  park: { footprint: 1, variants: 3, heightTiles: 0.44, draw: drawPark },
  pond_park: { footprint: 1, variants: 2, heightTiles: 0.36, draw: drawKund },
  park_gate: { footprint: 1, variants: 2, heightTiles: 0.62, draw: drawParkGate },
  animal_pens_farm: { footprint: 1, variants: 3, heightTiles: 0.3, draw: drawGaushala },
  community_garden: { footprint: 1, variants: 3, heightTiles: 0.3, draw: drawCommunityGarden },
  marina_docks_small: { footprint: 2, variants: 2, heightTiles: 0.42, draw: drawBoatJetty, waterfront: true },
  pier_large: { footprint: 1, variants: 2, heightTiles: 0.3, draw: drawPier, waterfront: true },
  amphitheater: { footprint: 2, variants: 2, heightTiles: 0.3, draw: drawAmphitheater },
  greenhouse_garden: { footprint: 2, variants: 2, heightTiles: 0.3, draw: drawNursery },
  campground: { footprint: 1, variants: 2, heightTiles: 0.3, draw: drawCampground },
  park_large: { footprint: 3, variants: 2, heightTiles: 0.4, draw: drawLargeGarden },
  mountain_lodge: { footprint: 2, variants: 2, heightTiles: 0.4, draw: drawMountainLodge },
  mountain_trailhead: { footprint: 3, variants: 1, heightTiles: 0.4, draw: drawTrailhead },
};
