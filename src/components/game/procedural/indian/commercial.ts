/**
 * Indian-style procedural art: commercial buildings.
 * See ./index.ts for the drawing contract; building blocks live in ./commercialKit.ts.
 *
 *   shop_small / shop_medium   bazaar shop-houses: rolling-shutter shops, painted boards and
 *                              awnings on the ground floor, homes with balconies and laundry above
 *   office_building_small      coaching-centre / clinic block plastered with signboards
 *   office_low                 3-4 storey commercial complex (bank branch, ACP bands, tenant boards)
 *   office_high                10+ storey corporate tower: tinted glass, stone core, rooftop hoarding
 *   mall                       glass-atrium mall with a huge fascia sign, parking and an auto stand
 */
import { alpha, mat, seededRng, shade, type Iso, type P3 } from '../isoPainter';
import type { ProceduralSpriteDef } from '../varanasiSprites';
import { C, clothesLine, coursesU, coursesV, drum, grime, makeIso, paving, slab, weatherU, weatherV } from '../varanasiSprites';
import {
  acUnit,
  acp,
  autoRickshaw,
  awning,
  balcony,
  car,
  chhajja,
  curtainWall,
  eRickshaw,
  elecPole,
  footShadow,
  fp,
  fq,
  ft,
  goodsOut,
  grilledWindow,
  kerb,
  lettering,
  mumty,
  paanStall,
  parapet,
  pavers,
  person,
  plotShadow,
  pots,
  projBox,
  rebar,
  roofSurface,
  scooter,
  shopOpening,
  signboard,
  sintex,
  streetTree,
  tvDish,
  wallAd,
  wallPipe,
  wires,
  type AwningKind,
  type Face,
  type GoodsKind,
  type Rng,
} from './commercialKit';
import type { Ctx2D } from '../isoPainter';

const LAUNDRY = ['#e4572e', '#f2c14e', '#3a86c8', '#f1ebdd', '#b44ca0', '#3aa36b', '#d81b60'];

// ============================================================================
// Bazaar shop-house block
// ============================================================================

interface Shop {
  a0: number;
  a1: number;
  kind: GoodsKind;
  /** Board background, lettering colour. */
  sign: [string, string];
  awning?: [string, AwningKind, string?];
  open?: number;
  style?: 'deva' | 'latin';
  emblem?: string;
  shutter?: string;
}

interface Block {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  z: number;
  groundH: number;
  floors: number;
  floorH: number;
  wall: string;
  /** Ground-floor facade finish (tiles / paint), defaults to the wall colour. */
  ground?: string;
  trim?: string;
  /** Top floor left as bare brick (the family is still building). */
  brickTop?: boolean;
  /** Whole +u face is a bare brick party wall (optionally with a painted advert). */
  brickU?: boolean;
  sideAd?: [string, string];
  showU: boolean;
  shopsV: Shop[];
  shopsU?: Shop[];
  /** Floors (1-based) with a balcony on the +v face. */
  balconies?: number[];
  /** Skip the upper-floor windows on the +v face (it gets covered in boards instead). */
  bareV?: boolean;
  plot: number;
  roof?: (zt: number) => void;
}

function blockHeight(b: Block): number {
  return b.groundH + b.floors * b.floorH;
}

function bareBrick(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, z0: number, z1: number): void {
  iso.poly(fq(iso, f, plane, a0, a1, z0, z1), ft(f, C.brick, 0.9));
  if (f === 'v') coursesV(iso, rng, plane, a0, a1, z0, z1, 0.016, 0.04, alpha('#e2c7a4', 0.4), 0.5);
  else coursesU(iso, rng, plane, a0, a1, z0, z1, 0.016, 0.04, alpha('#d8bd9a', 0.3), 0.5);
  iso.speckle(fq(iso, f, plane, a0, a1, z0, z1), rng, Math.round(300 * (a1 - a0) * (z1 - z0) + 10), [alpha(C.brickDark, 0.7), alpha('#c47a55', 0.7)], 1.5);
}

function drawShop(iso: Iso, rng: Rng, f: Face, plane: number, s: Shop, z: number, gH: number): void {
  const zTop = z + gH * 0.6;
  shopOpening(iso, rng, f, plane, s.a0, s.a1, z + 0.004, zTop, s.kind, s.shutter ?? '#8f9aa0', s.open ?? 1);
  signboard(iso, rng, f, plane, s.a0 - 0.008, s.a1 + 0.008, z + gH * 0.7, z + gH * 0.96, s.sign[0], s.sign[1], { style: s.style, emblem: s.emblem, subline: s.a1 - s.a0 > 0.25, border: shade(s.sign[0], 0.35) });
  if (s.awning) awning(iso, rng, f, plane, s.a0 - 0.004, s.a1 + 0.004, z + gH * 0.68, 0.06, 0.028, s.awning[0], s.awning[1], s.awning[2]);
}

function drawBlock(iso: Iso, rng: Rng, b: Block): void {
  const { u0, v0, u1, v1, z, groundH: gH, floorH: fH } = b;
  const H = blockHeight(b);
  const trim = b.trim ?? '#e8e0cc';
  footShadow(iso, u0, v0, u1, v1, z, H, b.plot);
  iso.box(u0, v0, u1, v1, z, z + H, mat(b.wall), { noRight: !b.showU });
  // plaster texture
  iso.speckle(iso.faceVQuad(v1, u0, u1, z, z + H), rng, Math.round(180 * (u1 - u0) * H + 10), [alpha(shade(b.wall, -0.15), 0.4), alpha(shade(b.wall, 0.2), 0.5)], 1.8);
  if (b.showU) {
    if (b.brickU) {
      bareBrick(iso, rng, 'u', u1, v0, v1, z, z + H);
      if (b.sideAd) wallAd(iso, rng, 'u', u1, v0 + 0.06, v1 - 0.06, z + gH + fH * 0.4, z + H - fH * 0.4, b.sideAd[0], b.sideAd[1]);
    } else iso.speckle(iso.faceUQuad(u1, v0, v1, z, z + H), rng, Math.round(160 * (v1 - v0) * H + 10), [alpha(shade(b.wall, -0.35), 0.4), alpha(shade(b.wall, -0.1), 0.5)], 1.8);
  }
  if (b.brickTop) {
    bareBrick(iso, rng, 'v', v1, u0, u1, z + H - fH, z + H);
    if (b.showU && !b.brickU) bareBrick(iso, rng, 'u', u1, v0, v1, z + H - fH, z + H);
  }
  if (b.ground) {
    iso.poly(iso.faceVQuad(v1, u0, u1, z, z + gH), b.ground);
    if (b.showU && !b.brickU) iso.poly(iso.faceUQuad(u1, v0, v1, z, z + gH), shade(b.ground, -0.26));
  }
  // weathering first so details sit on top of it
  weatherV(iso, rng, v1, u0, u1, z + gH, z + H, Math.round((u1 - u0) * 30), 0.13);
  if (b.showU) weatherU(iso, rng, u1, v0, v1, z, z + H, Math.round((v1 - v0) * 30), 0.16);
  grime(iso, u0, v0, u1, v1, z, 0.06, 0.3);
  // ground-floor shops
  for (const s of b.shopsV) drawShop(iso, rng, 'v', v1, s, z, gH);
  if (b.showU) for (const s of b.shopsU ?? []) drawShop(iso, rng, 'u', u1, s, z, gH);
  chhajja(iso, u0, v0, u1, v1, z + gH, 0.025, trim, { v: true, u: b.showU });
  // upper floors
  for (let fl = 1; fl <= b.floors; fl++) {
    const zf = z + gH + (fl - 1) * fH;
    const brick = b.brickTop && fl === b.floors;
    const frame = brick ? '#6a4a3a' : trim;
    if (!b.bareV) {
      if (b.balconies?.includes(fl)) {
        const bw = Math.min(0.3, (u1 - u0) * 0.62);
        const ba = u0 + (u1 - u0 - bw) * (fl % 2 ? 0.25 : 0.6);
        const others = [
          [u0 + 0.03, ba - 0.03],
          [ba + bw + 0.03, u1 - 0.03],
        ];
        for (const [a, c] of others) if (c - a > 0.06) grilledWindow(iso, 'v', v1, a + (c - a - 0.07) / 2, a + (c - a + 0.07) / 2, zf + 0.035, zf + fH - 0.04, frame);
        const nl = 2 + Math.floor(rng() * 3);
        balcony(iso, rng, 'v', v1, ba, ba + bw, zf + 0.012, 0.05, trim, '#2f3b3a', LAUNDRY.slice(fl % 3, fl % 3 + nl));
      } else {
        const n = Math.max(1, Math.round((u1 - u0) / 0.17));
        for (let i = 0; i < n; i++) {
          const c = u0 + ((i + 0.5) / n) * (u1 - u0);
          grilledWindow(iso, 'v', v1, c - 0.035, c + 0.035, zf + 0.035, zf + fH - 0.04, frame, { shutters: rng() < 0.4 ? '#3f7f6f' : undefined });
        }
      }
    }
    if (b.showU && !b.brickU) {
      const n = Math.max(1, Math.round((v1 - v0) / 0.2));
      for (let i = 0; i < n; i++) {
        const c = v0 + ((i + 0.5) / n) * (v1 - v0);
        grilledWindow(iso, 'u', u1, c - 0.03, c + 0.03, zf + 0.035, zf + fH - 0.04, frame);
        if ((fl + i) % 2 === 0) acUnit(iso, 'u', u1, c + 0.045, zf + 0.03);
      }
    }
    if (fl < b.floors) chhajja(iso, u0, v0, u1, v1, zf + fH, 0.018, trim, { v: true, u: b.showU });
  }
  if (b.showU && !b.brickU) wallPipe(iso, 'u', u1, v1 - 0.02, z, z + H);
  // roof
  const zt = z + H;
  const pm = mat(b.brickTop ? C.brick : trim, { right: -0.28 });
  roofSurface(iso, rng, u0, v0, u1, v1, zt);
  parapet(iso, u0, v0, u1, v1, zt, 0.035, 0.018, pm, 'back');
  b.roof?.(zt);
  parapet(iso, u0, v0, u1, v1, zt, 0.035, 0.018, pm, 'front');
}

/** Saris / dupattas hanging from a rod in front of a shop. */
function hangingCloth(iso: Iso, rng: Rng, f: Face, plane: number, a0: number, a1: number, zTop: number, out: number): void {
  const cols = ['#c2185b', '#f4a300', '#2e7d32', '#6a1b9a', '#d84315', '#00838f', '#ad1457'];
  iso.line(fp(f, plane, a0, zTop, out), fp(f, plane, a1, zTop, out), '#4a3a2a', 1.2);
  let i = 0;
  for (let a = a0 + 0.004; a < a1 - 0.012; a += 0.017, i++) {
    const c = cols[(i * 2 + Math.floor(rng() * 3)) % cols.length];
    const len = 0.06 + rng() * 0.04;
    iso.poly(fq(iso, f, plane, a, a + 0.014, zTop - len, zTop, out + (i % 2) * 0.004), ft(f, c), alpha(shade(c, -0.5), 0.5), 0.5);
    iso.poly(fq(iso, f, plane, a, a + 0.014, zTop - len, zTop - len + 0.008, out + (i % 2) * 0.004 + 0.0005), ft(f, C.gold, 0.6));
  }
}

/** Plot for a 1×1 bazaar lot: dusty slab with a paver footpath along both street edges. */
function bazaarPlot(iso: Iso, rng: Rng, z0: number, front = 0.8): void {
  slab(iso, rng, 0.02, z0, '#b9a98c', '#8f7f66', ['#a8987c', '#c9b99c', alpha('#6c7a3a', 0.4)]);
  pavers(iso, rng, 0.03, front, 0.97, 0.97, z0);
  pavers(iso, rng, front + 0.04, 0.03, 0.97, front, z0);
  kerb(iso, 0.03, 0.97, 0.97, z0, 'u');
  kerb(iso, 0.03, 0.97, 0.97, z0, 'v');
}

/** Blue tarp shelter on poles (rooftop kitchen / store). */
function tarpShelter(iso: Iso, u0: number, v0: number, u1: number, v1: number, z: number): void {
  for (const [pu, pv] of [
    [u0, v1],
    [u1, v1],
    [u1, v0],
  ] as [number, number][])
    iso.line([pu, pv, z], [pu, pv, z + 0.09], '#6b4a2a', 1.3);
  iso.poly(
    [
      [u0, v0, z + 0.11],
      [u1, v0, z + 0.09],
      [u1, v1, z + 0.09],
      [u0, v1, z + 0.11],
    ],
    shade(C.tarpBlue, 0.08),
    alpha('#10203a', 0.6),
    1,
  );
  iso.line([u0, (v0 + v1) / 2, z + 0.11], [u1, (v0 + v1) / 2 + 0.02, z + 0.09], alpha(C.tarpBlueDeep, 0.7), 1.2);
}

// ============================================================================
// SHOP SMALL (1×1): narrow shop-houses, 1-2 floors of homes above
// ============================================================================

function drawShopSmall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('shop_small', variant);
  const z = 0.02;
  bazaarPlot(iso, rng, z);
  if (variant === 0) {
    // pink sweet-shop house (G+2) and a turquoise sari shop (G+1)
    drawBlock(iso, rng, {
      u0: 0.07, v0: 0.08, u1: 0.47, v1: 0.76, z, groundH: 0.2, floors: 2, floorH: 0.15, wall: '#e6a5a0', ground: '#efe2cc', trim: '#f4ead6',
      showU: true, plot: 1, balconies: [1],
      shopsV: [{ a0: 0.1, a1: 0.44, kind: 'sweets', sign: ['#b71c1c', '#ffe082'], emblem: '#ffca28', awning: ['#f2c14e', 'stripe', '#c62828'] }],
      roof: (zt) => {
        sintex(iso, 0.17, 0.2, zt);
        tvDish(iso, 0.4, 0.16, zt);
        clothesLine(iso, rng, [0.14, 0.4, zt + 0.07], [0.38, 0.62, zt + 0.07], LAUNDRY, zt);
      },
    });
    drawBlock(iso, rng, {
      u0: 0.47, v0: 0.14, u1: 0.9, v1: 0.76, z, groundH: 0.2, floors: 1, floorH: 0.15, wall: '#58b3ad', trim: '#e8f0e4',
      showU: true, plot: 1,
      shopsV: [{ a0: 0.5, a1: 0.87, kind: 'saris', sign: ['#283593', '#ffffff'], style: 'latin', emblem: '#f06292', awning: ['#e0e0d8', 'tin'] }],
      shopsU: [{ a0: 0.36, a1: 0.66, kind: 'closed', sign: ['#f9a825', '#3e2723'], shutter: '#5f7f8f' }],
      roof: (zt) => {
        mumty(iso, rng, 0.52, 0.2, 0.68, 0.38, zt, 0.12, '#58b3ad');
        rebar(iso, 0.84, 0.2, zt);
        rebar(iso, 0.84, 0.7, zt);
        pots(iso, rng, 0.56, 0.66, zt, 3);
        sintex(iso, 0.8, 0.45, zt, 0.04, 0.07);
      },
    });
    hangingCloth(iso, rng, 'v', 0.76, 0.52, 0.86, 0.1, 0.075);
    goodsOut(iso, rng, 'sweets', 0.13, 0.83, z);
    person(iso, 0.3, 0.87, z, '#d81b60');
    person(iso, 0.62, 0.9, z, '#f1ebdd');
    elecPole(iso, 0.93, 0.93, z, 0.42);
    wires(iso, [0.93, 0.93, z + 0.41], [0.07, 0.8, z + 0.36], 3, 0.03);
  } else if (variant === 1) {
    // ochre G+1 corner shop-house: brassware + kirana, paan stall on the corner
    drawBlock(iso, rng, {
      u0: 0.08, v0: 0.08, u1: 0.8, v1: 0.72, z, groundH: 0.2, floors: 1, floorH: 0.15, wall: '#e2b35a', trim: '#f3e6c8',
      showU: true, plot: 1, balconies: [1],
      shopsV: [
        { a0: 0.11, a1: 0.44, kind: 'brass', sign: ['#7b1f1f', '#ffd54f'], emblem: '#ffd54f', awning: ['#9aa4aa', 'tin'] },
        { a0: 0.48, a1: 0.77, kind: 'kirana', sign: ['#1b5e20', '#ffffff'], style: 'latin', awning: [C.tarpBlue, 'tarp'] },
      ],
      shopsU: [{ a0: 0.22, a1: 0.5, kind: 'hardware', sign: ['#ef6c00', '#ffffff'], open: 0.55, shutter: '#7d8a90' }],
      roof: (zt) => {
        tarpShelter(iso, 0.14, 0.14, 0.4, 0.4, zt);
        sintex(iso, 0.62, 0.2, zt, 0.05, 0.08);
        drum(iso, 0.72, 0.32, zt, 0.03, 0.05, '#2f67b4');
        pots(iso, rng, 0.46, 0.62, zt, 4);
        tvDish(iso, 0.72, 0.58, zt);
      },
    });
    goodsOut(iso, rng, 'brass', 0.2, 0.8, z);
    goodsOut(iso, rng, 'kirana', 0.53, 0.81, z);
    paanStall(iso, rng, 0.85, 0.8, z);
    person(iso, 0.42, 0.88, z, '#3a86c8');
    person(iso, 0.8, 0.93, z, '#f1ebdd');
  } else {
    // mint kirana (G+1) and a lemon mobile-shop house whose top floor is still bare brick
    drawBlock(iso, rng, {
      u0: 0.08, v0: 0.12, u1: 0.5, v1: 0.74, z, groundH: 0.2, floors: 1, floorH: 0.15, wall: '#9fd3b5', trim: '#f1ebdd',
      showU: false, plot: 1, balconies: [1],
      shopsV: [{ a0: 0.11, a1: 0.47, kind: 'kirana', sign: ['#fdd835', '#b71c1c'], emblem: '#e53935', awning: ['#43a047', 'stripe', '#f1ebdd'] }],
      roof: (zt) => {
        sintex(iso, 0.2, 0.26, zt);
        clothesLine(iso, rng, [0.14, 0.44, zt + 0.07], [0.4, 0.66, zt + 0.07], LAUNDRY.slice(2), zt);
      },
    });
    drawBlock(iso, rng, {
      u0: 0.5, v0: 0.08, u1: 0.9, v1: 0.74, z, groundH: 0.2, floors: 2, floorH: 0.15, wall: '#ecd36a', trim: '#f6efd8', brickTop: true,
      showU: true, plot: 1,
      shopsV: [{ a0: 0.53, a1: 0.87, kind: 'mobile', sign: ['#0d47a1', '#fff176'], style: 'latin', emblem: '#e53935', open: 0.75, shutter: '#8f9aa0' }],
      shopsU: [{ a0: 0.3, a1: 0.6, kind: 'pharmacy', sign: ['#2e7d32', '#ffffff'], style: 'latin' }],
      roof: (zt) => {
        for (const [ru, rv] of [
          [0.54, 0.14],
          [0.86, 0.14],
          [0.54, 0.7],
          [0.86, 0.7],
          [0.7, 0.42],
        ] as [number, number][])
          rebar(iso, ru, rv, zt, 0.09);
        sintex(iso, 0.66, 0.26, zt, 0.045, 0.08);
        iso.box(0.74, 0.5, 0.84, 0.6, zt, zt + 0.03, mat(C.brick), { edges: true });
      },
    });
    goodsOut(iso, rng, 'kirana', 0.14, 0.82, z);
    goodsOut(iso, rng, 'default' as GoodsKind, 0.3, 0.84, z);
    scooter(iso, 0.6, 0.84, z, 'u', '#c62828');
    scooter(iso, 0.72, 0.86, z, 'u', '#1e1e1e');
    person(iso, 0.5, 0.9, z, '#6a1b9a');
  }
}

// ============================================================================
// SHOP MEDIUM (1×1): corner bazaar building, G+3
// ============================================================================

function drawShopMedium(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('shop_medium', variant);
  const z = 0.02;
  bazaarPlot(iso, rng, z, 0.82);
  const base = { u0: 0.07, v0: 0.07, u1: 0.84, v1: 0.78, z, groundH: 0.21, floorH: 0.145, showU: true, plot: 1 };
  if (variant === 0) {
    // "mithai bhandar": cream-pink with maroon trim, two balconied floors
    drawBlock(iso, rng, {
      ...base, floors: 3, wall: '#f0cfc0', ground: '#f5ecdc', trim: '#b5473f', balconies: [1, 2],
      shopsV: [
        { a0: 0.1, a1: 0.52, kind: 'sweets', sign: ['#c62828', '#ffe082'], emblem: '#ffca28', awning: ['#b5473f', 'stripe', '#f5ecdc'] },
        { a0: 0.56, a1: 0.81, kind: 'cloth', sign: ['#4a148c', '#ffffff'], style: 'latin', awning: ['#9aa4aa', 'tin'] },
      ],
      shopsU: [{ a0: 0.2, a1: 0.66, kind: 'sweets', sign: ['#c62828', '#ffe082'] }],
      roof: (zt) => {
        mumty(iso, rng, 0.12, 0.12, 0.3, 0.32, zt, 0.12, '#f0cfc0');
        sintex(iso, 0.44, 0.18, zt);
        sintex(iso, 0.58, 0.18, zt, 0.04, 0.07);
        tvDish(iso, 0.76, 0.2, zt);
        clothesLine(iso, rng, [0.36, 0.48, zt + 0.07], [0.74, 0.66, zt + 0.07], LAUNDRY, zt);
        pots(iso, rng, 0.14, 0.6, zt, 3, 'v');
      },
    });
    goodsOut(iso, rng, 'sweets', 0.14, 0.86, z);
    person(iso, 0.34, 0.9, z, '#f2c14e');
    person(iso, 0.42, 0.88, z, '#e4572e');
    person(iso, 0.9, 0.5, z, '#f1ebdd');
    scooter(iso, 0.6, 0.87, z, 'u', '#2f67b4');
  } else if (variant === 1) {
    // turquoise sari emporium with a blade sign on the corner
    drawBlock(iso, rng, {
      ...base, floors: 3, wall: '#4fb3b0', ground: '#e8f0e8', trim: '#f4efe0', balconies: [2],
      shopsV: [{ a0: 0.1, a1: 0.81, kind: 'saris', sign: ['#880e4f', '#ffd54f'], emblem: '#ffd54f', awning: ['#f4a300', 'stripe', '#880e4f'] }],
      shopsU: [{ a0: 0.14, a1: 0.7, kind: 'saris', sign: ['#880e4f', '#ffd54f'] }],
      roof: (zt) => {
        sintex(iso, 0.2, 0.2, zt);
        sintex(iso, 0.34, 0.2, zt);
        // small rooftop hoarding
        const hz = zt + 0.04;
        for (const u of [0.46, 0.76]) iso.line([u, 0.14, zt], [u, 0.14, hz + 0.02], '#3a3a3a', 1.4);
        signboard(iso, rng, 'v', 0.14, 0.42, 0.8, hz, hz + 0.1, '#f9a825', '#4a148c', { depth: 0.008, subline: true, style: 'latin' });
        pots(iso, rng, 0.14, 0.62, zt, 3);
      },
    });
    // vertical blade sign on the corner
    const bz0 = z + 0.25;
    projBox(iso, 'u', 0.84, 0.72, 0.735, 0.07, bz0, bz0 + 0.3, mat('#880e4f', { right: -0.2 }), { edges: true });
    for (let i = 0; i < 5; i++) {
      const zz = bz0 + 0.03 + i * 0.055;
      iso.poly(iso.faceVQuad(0.735, 0.85, 0.9, zz, zz + 0.035), i % 2 ? '#ffd54f' : '#fff3e0');
    }
    hangingCloth(iso, rng, 'v', 0.78, 0.12, 0.8, 0.105, 0.08);
    hangingCloth(iso, rng, 'u', 0.84, 0.16, 0.66, 0.105, 0.08);
    person(iso, 0.3, 0.92, z, '#c2185b');
    person(iso, 0.52, 0.9, z, '#f4a300');
    person(iso, 0.92, 0.3, z, '#3a86c8');
  } else {
    // ochre utensils + chemist, bare-brick side wall with a faded painted advert, top floor unfinished
    drawBlock(iso, rng, {
      ...base, floors: 3, wall: '#dca64a', ground: '#ece0c6', trim: '#f2e8d0', brickU: true, sideAd: ['#1565c0', '#fff8e1'], balconies: [1],
      shopsV: [
        { a0: 0.1, a1: 0.44, kind: 'brass', sign: ['#4e342e', '#ffcc80'], emblem: '#ffcc80', awning: ['#c62828', 'plain'] },
        { a0: 0.48, a1: 0.81, kind: 'pharmacy', sign: ['#00695c', '#ffffff'], style: 'latin', emblem: '#ffffff' },
      ],
      roof: (zt) => {
        for (const [ru, rv] of [
          [0.12, 0.72],
          [0.45, 0.72],
          [0.78, 0.72],
          [0.78, 0.4],
        ] as [number, number][])
          rebar(iso, ru, rv, zt, 0.1);
        mumty(iso, rng, 0.12, 0.12, 0.3, 0.3, zt, 0.12, '#dca64a');
        sintex(iso, 0.44, 0.2, zt, 0.05, 0.08);
        sintex(iso, 0.6, 0.2, zt, 0.04, 0.07);
        tarpShelter(iso, 0.36, 0.36, 0.6, 0.58, zt);
      },
    });
    goodsOut(iso, rng, 'brass', 0.16, 0.85, z);
    goodsOut(iso, rng, 'hardware', 0.3, 0.86, z);
    person(iso, 0.62, 0.9, z, '#f1ebdd');
    elecPole(iso, 0.93, 0.93, z, 0.46);
    wires(iso, [0.93, 0.93, z + 0.45], [0.07, 0.8, z + 0.4], 3, 0.03);
    wires(iso, [0.93, 0.93, z + 0.44], [0.86, 0.07, z + 0.42], 2, 0.03);
  }
}

// ============================================================================
// OFFICE BUILDING SMALL (1×1): coaching centre / clinic covered in boards
// ============================================================================

function drawOfficeSmall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('office_building_small', variant);
  const z = 0.02;
  bazaarPlot(iso, rng, z, 0.82);
  const u0 = 0.1;
  const v0 = 0.1;
  const u1 = 0.84;
  const v1 = 0.78;
  const gH = 0.2;
  const fH = 0.145;
  const floors = 3;
  const coaching = variant === 1;
  drawBlock(iso, rng, {
    u0, v0, u1, v1, z, groundH: gH, floors, floorH: fH, wall: coaching ? '#f0e6c8' : '#dfe8e4', ground: '#d8d2c4', trim: '#f7f3ea', bareV: true,
    showU: true, plot: 1,
    shopsV: coaching
      ? [{ a0: 0.4, a1: 0.81, kind: 'kirana', sign: ['#f57f17', '#ffffff'], style: 'latin', awning: ['#9aa4aa', 'tin'] }]
      : [{ a0: 0.4, a1: 0.81, kind: 'pharmacy', sign: ['#2e7d32', '#ffffff'], style: 'latin', emblem: '#ffffff' }],
    shopsU: [{ a0: 0.16, a1: 0.5, kind: coaching ? 'mobile' : 'closed', sign: ['#1565c0', '#ffffff'], style: 'latin', shutter: '#6f8a96' }],
    roof: (zt) => {
      mumty(iso, rng, 0.14, 0.14, 0.32, 0.34, zt, 0.12, coaching ? '#f0e6c8' : '#dfe8e4');
      sintex(iso, 0.5, 0.2, zt);
      sintex(iso, 0.64, 0.2, zt, 0.04, 0.07);
      // rooftop board on scaffold legs
      const hz = zt + 0.05;
      for (const u of [0.4, 0.78]) iso.line([u, 0.6, zt], [u, 0.6, hz + 0.02], '#3a3a3a', 1.3);
      signboard(iso, rng, 'v', 0.6, 0.36, 0.82, hz, hz + 0.09, coaching ? '#c62828' : '#0d47a1', '#ffffff', { depth: 0.006, subline: true, style: 'latin', emblem: '#ffeb3b' });
    },
  });
  // stair entrance with tenant boards stacked beside it
  const zg = z;
  iso.poly(iso.faceVQuad(v1, 0.2, 0.3, zg, zg + 0.14), '#2b2420');
  iso.poly(iso.faceVQuad(v1 + 0.001, 0.21, 0.29, zg, zg + 0.1), alpha('#5a4a3a', 0.8));
  for (let i = 0; i < 4; i++) iso.line([0.2, v1 + 0.002, zg + 0.02 + i * 0.03], [0.3, v1 + 0.002, zg + 0.02 + i * 0.03], alpha('#1a1a1a', 0.8), 0.9);
  const tenant = ['#1565c0', '#c62828', '#2e7d32', '#6a1b9a', '#ef6c00'];
  for (let i = 0; i < 5; i++) signboard(iso, rng, 'v', v1, 0.12, 0.19, zg + 0.02 + i * 0.03, zg + 0.045 + i * 0.03, tenant[i], '#ffffff', { depth: 0.004, style: 'latin' });
  signboard(iso, rng, 'v', v1, 0.12, 0.34, zg + 0.16, zg + 0.195, '#37474f', '#ffffff', { style: 'latin' });
  // upper floors: windows peeking out between boards and banners
  for (let fl = 1; fl <= floors; fl++) {
    const zf = z + gH + (fl - 1) * fH;
    grilledWindow(iso, 'v', v1, 0.14, 0.24, zf + 0.03, zf + 0.09, '#f7f3ea', { glass: '#3d5566', shade: false });
    grilledWindow(iso, 'v', v1, 0.72, 0.8, zf + 0.03, zf + 0.09, '#f7f3ea', { glass: '#3d5566', shade: false });
  }
  const zf1 = z + gH;
  if (coaching) {
    // institute banner with a grid of "topper" photos across floors 2-3
    const bz0 = zf1 + fH + 0.012;
    const bz1 = zf1 + 3 * fH - 0.012;
    signboard(iso, rng, 'v', v1, 0.26, 0.7, bz0, bz1, '#fff8e1', '#b71c1c', { depth: 0.008, style: 'latin', border: '#1565c0' });
    const out = 0.0085;
    iso.poly(iso.faceVQuad(v1 + out, 0.26, 0.7, bz1 - 0.07, bz1 - 0.004), '#1565c0');
    lettering(iso, rng, 'v', v1, 0.28, 0.68, bz1 - 0.036, 0.034, '#ffffff', 'latin', out + 0.0005);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 6; c++) {
        const a = 0.29 + c * 0.068;
        const zc = bz0 + 0.03 + r * 0.075;
        const pts: P3[] = [];
        for (let k = 0; k < 12; k++) {
          const t = (k / 12) * Math.PI * 2;
          pts.push(fp('v', v1, a + Math.cos(t) * 0.017, zc + 0.02 + Math.sin(t) * 0.017, out + 0.0006));
        }
        iso.poly(pts, ['#f0c8a0', '#d9a57a', '#c98e62'][(r + c) % 3], '#1565c0', 1);
        iso.poly(fq(iso, 'v', v1, a - 0.016, a + 0.016, zc + 0.024, zc + 0.037, out + 0.0007), '#2a1e18');
        iso.poly(fq(iso, 'v', v1, a - 0.02, a + 0.02, zc - 0.012, zc - 0.002, out + 0.0006), '#e53935');
      }
    signboard(iso, rng, 'v', v1, 0.26, 0.7, zf1 + 0.03, zf1 + 0.1, '#1a237e', '#ffeb3b', { style: 'latin', subline: true, emblem: '#ffeb3b' });
    // side wall flex banners
    signboard(iso, rng, 'u', u1, 0.14, 0.72, zf1 + fH + 0.03, zf1 + 2 * fH - 0.01, '#ffeb3b', '#b71c1c', { style: 'latin', subline: true });
    signboard(iso, rng, 'u', u1, 0.2, 0.66, zf1 + 2 * fH + 0.03, zf1 + 3 * fH - 0.02, '#1565c0', '#ffffff', { style: 'deva' });
  } else {
    // clinic: big board with a red cross, diagnostic lab and a dentist
    signboard(iso, rng, 'v', v1, 0.26, 0.7, zf1 + 0.025, zf1 + 0.11, '#ffffff', '#c62828', { style: 'latin', subline: true, border: '#c62828' });
    const cr = 0.035;
    const ca = 0.3;
    const cz = zf1 + 0.068;
    const out = 0.0106;
    iso.poly(fq(iso, 'v', v1, ca - cr * 0.3, ca + cr * 0.3, cz - cr, cz + cr, out), '#d32f2f');
    iso.poly(fq(iso, 'v', v1, ca - cr, ca + cr, cz - cr * 0.3, cz + cr * 0.3, out), '#d32f2f');
    signboard(iso, rng, 'v', v1, 0.26, 0.7, zf1 + fH + 0.025, zf1 + fH + 0.1, '#0277bd', '#ffffff', { style: 'latin', subline: true, emblem: '#ffffff' });
    signboard(iso, rng, 'v', v1, 0.26, 0.7, zf1 + 2 * fH + 0.025, zf1 + 2 * fH + 0.1, '#ffb300', '#3e2723', { style: 'deva', subline: true });
    signboard(iso, rng, 'u', u1, 0.16, 0.7, zf1 + fH + 0.03, zf1 + 2 * fH - 0.01, '#ffffff', '#0277bd', { style: 'latin', subline: true, border: '#0277bd' });
  }
  // vertical blade board on the front corner
  const bz = z + 0.24;
  projBox(iso, 'u', u1, v1 - 0.075, v1 - 0.065, 0.06, bz, bz + 0.34, mat(coaching ? '#b71c1c' : '#0277bd', { right: -0.2 }), { edges: true });
  for (let i = 0; i < 6; i++) {
    const zz = bz + 0.02 + i * 0.053;
    iso.poly(iso.faceVQuad(v1 - 0.065, u1 + 0.008, u1 + 0.052, zz, zz + 0.034), '#ffffff');
  }
  // parked scooters and students
  for (let i = 0; i < 4; i++) scooter(iso, 0.1 + i * 0.075, 0.86, z, 'v', ['#c62828', '#1e1e1e', '#e0e0e0', '#1565c0'][i]);
  person(iso, 0.44, 0.9, z, coaching ? '#f1ebdd' : '#3a86c8');
  person(iso, 0.5, 0.88, z, coaching ? '#3a86c8' : '#d81b60');
  person(iso, 0.9, 0.62, z, '#f2c14e');
  if (coaching) person(iso, 0.57, 0.92, z, '#6a1b9a');
}

// ============================================================================
// OFFICE LOW (2×2): 3-4 storey commercial complex
// ============================================================================

/** Paved forecourt for 2×2/3×3 commercial plots. */
function commercialPlot(iso: Iso, rng: Rng, n: number, z: number): void {
  slab(iso, rng, 0.02, z, '#b7b0a2', '#8a8274', ['#a9a294', '#c6bfb1', alpha('#6c7a3a', 0.3)]);
  paving(iso, rng, 0.03, 0.03, n - 0.03, n - 0.03, z, 0.12, 0.12, alpha('#6e6658', 0.18));
  pavers(iso, rng, 0.03, n - 0.16, n - 0.03, n - 0.03, z);
  pavers(iso, rng, n - 0.16, 0.03, n - 0.03, n - 0.16, z);
  kerb(iso, 0.03, n - 0.03, n - 0.03, z, 'u');
  kerb(iso, 0.03, n - 0.03, n - 0.03, z, 'v');
}

/** Painted parking bay lines on the forecourt. */
function parkingBays(iso: Iso, u0: number, u1: number, v0: number, v1: number, z: number, step: number): void {
  for (let u = u0; u <= u1 + 1e-6; u += step) iso.line([u, v0, z + 0.001], [u, v1, z + 0.001], alpha('#f4f0e4', 0.75), 1.2);
  iso.line([u0, v0, z + 0.001], [u1, v0, z + 0.001], alpha('#f4f0e4', 0.75), 1.2);
}

function drawOfficeLow(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('office_low', variant);
  const z = 0.02;
  commercialPlot(iso, rng, 2, z);
  const u0 = 0.2;
  const v0 = 0.16;
  const u1 = 1.72;
  const v1 = 1.34;
  const gH = 0.22;
  const fH = 0.17;
  const floors = variant === 0 ? 3 : 4;
  const H = gH + floors * fH;
  const body = variant === 0 ? '#efe6d2' : '#d9a58a';
  const accent = variant === 0 ? '#1f5fa8' : '#9e9e9e';
  const glass = variant === 0 ? '#3f7c8c' : '#6b5a3e';
  // trees behind + parking
  iso.tree(1.86, 0.2, z, 0.12, rng, 'neem');
  parkingBays(iso, 0.3, 1.5, 1.5, 1.8, z, 0.2);
  footShadow(iso, u0, v0, u1, v1, z, H, 2, 0.2);
  iso.box(u0, v0, u1, v1, z, z + H, mat(body));
  if (variant === 1) {
    // Jaisalmer-stone cladding courses
    coursesV(iso, rng, v1, u0, u1, z, z + H, 0.04, 0.12, alpha('#8a5a40', 0.25), 0.6);
    coursesU(iso, rng, u1, v0, v1, z, z + H, 0.04, 0.12, alpha('#6a4030', 0.25), 0.6);
  }
  weatherU(iso, rng, u1, v0, v1, z, z + H, 26, 0.12);
  // ---- ground floor (+v): bank branch, lobby, pharmacy; (+u): showroom
  const zg = z;
  acp(iso, 'v', v1, u0, u1, zg + gH * 0.72, zg + gH, accent);
  curtainWall(iso, 'v', v1, u0 + 0.06, 0.78, zg + 0.005, zg + gH * 0.68, '#6f9aa8', '#c9ccd0', 0.09, 0.2);
  iso.poly(iso.faceVQuad(v1 + 0.001, 0.46, 0.56, zg, zg + gH * 0.6), alpha('#1c2a30', 0.6));
  signboard(iso, rng, 'v', v1, u0 + 0.04, 0.8, zg + gH * 0.74, zg + gH * 0.98, variant === 0 ? '#0d47a1' : '#004d40', '#ffffff', { style: 'latin', subline: true, emblem: variant === 0 ? '#ffb300' : '#ffffff', depth: 0.012 });
  // lobby with stacked tenant boards
  iso.poly(iso.faceVQuad(v1, 0.86, 1.02, zg, zg + gH * 0.68), '#2e2a28');
  iso.poly(iso.faceVQuad(v1 + 0.001, 0.88, 1.0, zg, zg + gH * 0.6), alpha('#8fb0bc', 0.6));
  const tcol = ['#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#ef6c00', '#00838f'];
  for (let i = 0; i < 6; i++) signboard(iso, rng, 'v', v1, 1.04, 1.14, zg + 0.012 + i * 0.024, zg + 0.032 + i * 0.024, tcol[i], '#ffffff', { depth: 0.004, style: 'latin' });
  shopOpening(iso, rng, 'v', v1, 1.18, 1.66, zg + 0.004, zg + gH * 0.66, 'pharmacy', '#8f9aa0', 1);
  signboard(iso, rng, 'v', v1, 1.16, 1.68, zg + gH * 0.74, zg + gH * 0.98, '#1b5e20', '#ffffff', { style: 'latin', emblem: '#ffffff' });
  // bank ATM kiosk box sticking out
  iso.box(0.24, v1, 0.4, v1 + 0.1, zg, zg + 0.15, mat('#f4f4f2'));
  curtainWall(iso, 'v', v1 + 0.1, 0.26, 0.38, zg + 0.005, zg + 0.11, '#8fb4c0', '#d0d4d8', 0.06, 0.2);
  acp(iso, 'v', v1 + 0.1, 0.24, 0.4, zg + 0.115, zg + 0.15, variant === 0 ? '#0d47a1' : '#004d40');
  acp(iso, 'u', 0.4, v1, v1 + 0.1, zg + 0.115, zg + 0.15, variant === 0 ? '#0d47a1' : '#004d40');
  lettering(iso, rng, 'v', v1 + 0.1, 0.27, 0.37, zg + 0.132, 0.018, '#ffffff', 'latin', 0.0006);
  // +u face: showroom glass + fascia
  curtainWall(iso, 'u', u1, v0 + 0.1, v1 - 0.1, zg + 0.005, zg + gH * 0.68, '#6f9aa8', '#c9ccd0', 0.12, 0.2);
  acp(iso, 'u', u1, v0, v1, zg + gH * 0.72, zg + gH, accent);
  signboard(iso, rng, 'u', u1, v0 + 0.2, v1 - 0.2, zg + gH * 0.74, zg + gH * 0.98, '#e65100', '#ffffff', { style: 'latin', emblem: '#ffffff' });
  chhajja(iso, u0, v0, u1, v1, zg + gH, 0.035, '#d9d4c8');
  // ---- upper floors: strip windows between ACP bands; vertical fins
  for (let fl = 1; fl <= floors; fl++) {
    const zf = z + gH + (fl - 1) * fH;
    curtainWall(iso, 'v', v1, u0 + 0.04, u1 - 0.04, zf + 0.04, zf + fH - 0.035, glass, '#b8bcc0', 0.1, 1);
    curtainWall(iso, 'u', u1, v0 + 0.04, v1 - 0.04, zf + 0.04, zf + fH - 0.035, glass, '#b8bcc0', 0.1, 1);
    acp(iso, 'v', v1, u0, u1, zf + fH - 0.035, zf + fH, variant === 0 ? '#c9ccd0' : '#e8dcc8', 0.004);
    acp(iso, 'u', u1, v0, v1, zf + fH - 0.035, zf + fH, variant === 0 ? '#c9ccd0' : '#e8dcc8', 0.004);
    iso.poly(iso.faceVQuad(v1 + 0.001, u0, u1, zf + 0.012, zf + 0.018), alpha(accent, 0.95));
    iso.poly(iso.faceUQuad(u1 + 0.001, v0, v1, zf + 0.012, zf + 0.018), alpha(shade(accent, -0.3), 0.95));
    for (let i = 0; i < 3; i++) acUnit(iso, 'u', u1, v0 + 0.15 + i * 0.35, zf + 0.004);
  }
  for (let a = u0 + 0.36; a < u1 - 0.1; a += 0.38) projBox(iso, 'v', v1, a, a + 0.03, 0.04, z + gH, z + H, mat(variant === 0 ? '#e8e8e6' : '#c9895e', { right: -0.3 }), { edges: true });
  // big horizontal tenant boards on the facade
  signboard(iso, rng, 'v', v1, u0 + 0.06, 0.92, z + gH + fH + 0.04, z + gH + fH + 0.12, '#ffeb3b', '#b71c1c', { style: 'latin', subline: true, depth: 0.05, emblem: '#b71c1c' });
  signboard(iso, rng, 'v', v1, 0.98, u1 - 0.06, z + gH + 0.04, z + gH + 0.12, '#ffffff', '#1a237e', { style: 'latin', subline: true, depth: 0.05, border: '#e53935' });
  if (floors > 3) signboard(iso, rng, 'v', v1, 0.98, u1 - 0.06, z + gH + 2 * fH + 0.04, z + gH + 2 * fH + 0.12, '#6a1b9a', '#ffffff', { style: 'deva', depth: 0.05 });
  wallPipe(iso, 'u', u1, v1 - 0.03, z, z + H);
  // ---- roof
  const zt = z + H;
  roofSurface(iso, rng, u0, v0, u1, v1, zt, '#b0a898');
  const pm = mat(variant === 0 ? '#e8e8e6' : '#e8dcc8');
  parapet(iso, u0, v0, u1, v1, zt, 0.05, 0.025, pm, 'back');
  iso.box(0.34, 0.3, 0.7, 0.62, zt, zt + 0.14, mat(body));
  iso.poly(iso.faceVQuad(0.62, 0.46, 0.56, zt, zt + 0.1), '#4a5a66');
  iso.box(0.32, 0.28, 0.72, 0.64, zt + 0.14, zt + 0.155, mat('#cfc6b4'));
  sintex(iso, 0.44, 0.44, zt + 0.155, 0.05, 0.08);
  sintex(iso, 0.6, 0.44, zt + 0.155, 0.05, 0.08);
  // solar panel rows
  for (let r = 0; r < 3; r++) {
    const pu = 0.95 + r * 0.2;
    iso.poly(
      [
        [pu, 0.35, zt + 0.06],
        [pu + 0.12, 0.35, zt + 0.02],
        [pu + 0.12, 0.95, zt + 0.02],
        [pu, 0.95, zt + 0.06],
      ],
      '#233a5e',
      alpha('#c9ccd0', 0.8),
      0.8,
    );
    iso.clipped(
      [
        [pu, 0.35, zt + 0.06],
        [pu + 0.12, 0.35, zt + 0.02],
        [pu + 0.12, 0.95, zt + 0.02],
        [pu, 0.95, zt + 0.06],
      ],
      () => {
        for (let v = 0.4; v < 0.95; v += 0.06) iso.line([pu, v, zt + 0.06], [pu + 0.12, v, zt + 0.02], alpha('#8fa8c8', 0.5), 0.6);
      },
    );
  }
  if (variant === 1) {
    // mobile tower
    const tu = 0.5;
    const tv = 1.0;
    const th = 0.5;
    for (const [du, dv] of [
      [-0.04, -0.04],
      [0.04, -0.04],
      [-0.04, 0.04],
      [0.04, 0.04],
    ] as [number, number][])
      iso.line([tu + du, tv + dv, zt], [tu + du * 0.3, tv + dv * 0.3, zt + th], '#8a8a8a', 1.2);
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const s = 0.04 * (1 - t * 0.7);
      iso.poly(iso.topQuad(tu - s, tv - s, tu + s, tv + s, zt + th * t), null, alpha('#6a6a6a', 0.8), 0.7);
    }
    for (const [du, dv] of [
      [0.02, 0.02],
      [-0.02, 0.02],
      [0.02, -0.02],
    ] as [number, number][])
      iso.box(tu + du - 0.006, tv + dv - 0.006, tu + du + 0.006, tv + dv + 0.006, zt + th * 0.82, zt + th * 0.98, mat('#f0f0f0'), { edges: false });
    iso.line([tu, tv, zt + th], [tu, tv, zt + th + 0.06], '#c62828', 1.2);
  } else {
    sintex(iso, 0.5, 1.05, zt, 0.05, 0.08);
    sintex(iso, 0.66, 1.05, zt, 0.05, 0.08);
  }
  parapet(iso, u0, v0, u1, v1, zt, 0.05, 0.025, pm, 'front');
  acp(iso, 'v', v1, u0, u1, zt, zt + 0.05, accent, 0, 0.15);
  acp(iso, 'u', u1, v0, v1, zt, zt + 0.05, accent, 0, 0.15);
  // ---- forecourt life
  car(iso, 0.34, 1.52, z, 'v', '#e8e8e8');
  car(iso, 0.74, 1.52, z, 'v', '#b71c1c');
  for (let i = 0; i < 4; i++) scooter(iso, 1.1 + i * 0.07, 1.5, z, 'v', ['#1e1e1e', '#c62828', '#e0e0e0', '#1565c0'][i]);
  streetTree(iso, rng, 1.85, 1.2, z, 0.12, 'ashoka');
  streetTree(iso, rng, 1.85, 1.62, z, 0.11, 'neem');
  person(iso, 0.94, 1.45, z, '#f1ebdd');
  person(iso, 0.36, 1.49, z, '#3a86c8');
  person(iso, 1.5, 1.44, z, '#6a1b9a');
  person(iso, 1.46, 1.8, z, '#e4572e');
  autoRickshaw(iso, 1.56, 1.66, z, 'v');
}

// ============================================================================
// OFFICE HIGH (2×2): 10+ storey Indian corporate tower
// ============================================================================

function drawOfficeHigh(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 2);
  const rng = seededRng('office_high', variant);
  const z = 0.02;
  commercialPlot(iso, rng, 2, z);
  const bronze = variant === 0;
  const glass = bronze ? '#5d6f7a' : '#2f7f86';
  const stone = bronze ? '#dcc19a' : '#e6e3dc';
  const accent = bronze ? '#8d3b2b' : '#c62828';
  // podium
  const pu0 = 0.16;
  const pv0 = 0.14;
  const pu1 = 1.8;
  const pv1 = 1.4;
  const pH = 0.34;
  iso.tree(1.88, 0.2, z, 0.1, rng, 'neem');
  // tower
  const tu0 = 0.3;
  const tv0 = 0.26;
  const tu1 = 1.52;
  const tv1 = 1.18;
  const floors = 11;
  const fH = 0.12;
  const tH = floors * fH;
  plotShadow(iso, [
    [tu0, tv0],
    [tu1, tv0],
    [tu1, tv1],
    [tu0, tv1],
  ], z, pH + tH * 0.35, 0.16, [0.03, 0.03, 1.97, 1.97]);
  footShadow(iso, pu0, pv0, pu1, pv1, z, pH, 2, 0.18);
  iso.box(pu0, pv0, pu1, pv1, z, z + pH, mat(stone));
  // podium: showroom glass + fascia signs
  curtainWall(iso, 'v', pv1, pu0 + 0.05, pu1 - 0.05, z + 0.005, z + 0.17, '#7aa6b2', '#d0d4d8', 0.12, 0.3);
  curtainWall(iso, 'u', pu1, pv0 + 0.05, pv1 - 0.05, z + 0.005, z + 0.17, '#7aa6b2', '#d0d4d8', 0.12, 0.3);
  acp(iso, 'v', pv1, pu0, pu1, z + 0.17, z + 0.2, accent, 0.002, 0.2);
  acp(iso, 'u', pu1, pv0, pv1, z + 0.17, z + 0.2, accent, 0.002, 0.2);
  curtainWall(iso, 'v', pv1, pu0 + 0.05, pu1 - 0.05, z + 0.22, z + pH - 0.03, glass, '#c0c4c8', 0.12, 0.3);
  curtainWall(iso, 'u', pu1, pv0 + 0.05, pv1 - 0.05, z + 0.22, z + pH - 0.03, glass, '#c0c4c8', 0.12, 0.3);
  signboard(iso, rng, 'v', pv1, 0.26, 0.86, z + 0.225, z + 0.305, '#ffffff', '#0d47a1', { style: 'latin', subline: true, depth: 0.012, emblem: '#e53935' });
  signboard(iso, rng, 'v', pv1, 1.1, 1.7, z + 0.225, z + 0.305, '#b71c1c', '#ffffff', { style: 'latin', subline: true, depth: 0.012 });
  signboard(iso, rng, 'u', pu1, 0.3, 1.24, z + 0.225, z + 0.305, '#ffb300', '#3e2723', { style: 'latin', depth: 0.012, emblem: '#3e2723' });
  // entrance canopy on the +v face
  for (const a of [0.9, 1.06]) iso.box(a, pv1 + 0.2, a + 0.025, pv1 + 0.225, z, z + 0.15, mat('#d0d4d8'));
  iso.box(0.84, pv1, 1.14, pv1 + 0.24, z + 0.15, z + 0.17, mat('#e8e8e6'));
  acp(iso, 'v', pv1 + 0.24, 0.84, 1.14, z + 0.15, z + 0.17, accent, 0, 0.1);
  lettering(iso, rng, 'v', pv1 + 0.24, 0.87, 1.1, z + 0.16, 0.012, '#ffffff', 'latin', 0.0006);
  // podium roof terrace
  const zp = z + pH;
  roofSurface(iso, rng, pu0, pv0, pu1, pv1, zp, '#bdb5a6');
  parapet(iso, pu0, pv0, pu1, pv1, zp, 0.04, 0.02, mat(stone), 'back');
  // tower body
  footShadow(iso, tu0, tv0, tu1, tv1, zp, 0.1, 2, 0.12);
  iso.box(tu0, tv0, tu1, tv1, zp, zp + tH, mat(stone));
  // +v face: stone corners with slot windows, central glazing
  const cv0 = tu0 + 0.22;
  const cv1 = tu1 - 0.22;
  curtainWall(iso, 'v', tv1, cv0, cv1, zp + 0.01, zp + tH - 0.02, glass, '#b0b6ba', 0.1, fH);
  // +u face: glazing with a solid core strip
  const cu0 = tv0 + 0.16;
  const cu1 = tv1 - 0.16;
  curtainWall(iso, 'u', tu1, cu0, cu1, zp + 0.01, zp + tH - 0.02, glass, '#b0b6ba', 0.1, fH);
  for (let fl = 0; fl < floors; fl++) {
    const zf = zp + fl * fH;
    for (const [a0, a1] of [
      [tu0 + 0.05, cv0 - 0.05],
      [cv1 + 0.05, tu1 - 0.05],
    ])
      iso.poly(iso.faceVQuad(tv1, a0, a1, zf + 0.035, zf + fH - 0.03), shade(glass, -0.1));
    for (const [a0, a1] of [
      [tv0 + 0.04, cu0 - 0.04],
      [cu1 + 0.04, tv1 - 0.04],
    ])
      iso.poly(iso.faceUQuad(tu1, a0, a1, zf + 0.035, zf + fH - 0.03), shade(glass, -0.35));
    // spandrel ACP bands
    acp(iso, 'v', tv1, cv0, cv1, zf + fH - 0.02, zf + fH, bronze ? '#8a7a66' : '#d6d8da', 0.003, 0.2);
    acp(iso, 'u', tu1, cu0, cu1, zf + fH - 0.02, zf + fH, bronze ? '#8a7a66' : '#d6d8da', 0.003, 0.2);
  }
  // vertical fins framing the glass + accent stripe
  for (const a of [cv0 - 0.02, cv1]) projBox(iso, 'v', tv1, a, a + 0.02, 0.03, zp, zp + tH + 0.06, mat(stone, { right: -0.3 }), { edges: true });
  for (const a of [cu0 - 0.02, cu1]) projBox(iso, 'u', tu1, a, a + 0.02, 0.03, zp, zp + tH + 0.06, mat(stone, { right: -0.3 }), { edges: true });
  iso.poly(iso.faceVQuad(tv1 + 0.001, tu0, tu1, zp + tH - 0.05, zp + tH - 0.035), accent);
  iso.poly(iso.faceUQuad(tu1 + 0.001, tv0, tv1, zp + tH - 0.05, zp + tH - 0.035), shade(accent, -0.3));
  weatherV(iso, rng, tv1, tu0, tu1, zp, zp + tH, 16, 0.07);
  weatherU(iso, rng, tu1, tv0, tv1, zp, zp + tH, 16, 0.09);
  parapet(iso, pu0, pv0, pu1, pv1, zp, 0.04, 0.02, mat(stone), 'front');
  // podium terrace details (in front of the tower)
  pots(iso, rng, 1.58, 0.3, zp, 6, 'v');
  // tower crown: terrace, lift room, tanks, hoarding
  const zt = zp + tH;
  roofSurface(iso, rng, tu0, tv0, tu1, tv1, zt, '#b8b0a2');
  parapet(iso, tu0, tv0, tu1, tv1, zt, 0.06, 0.025, mat(stone), 'back');
  iso.box(0.44, 0.36, 0.8, 0.66, zt, zt + 0.16, mat(stone));
  iso.box(0.42, 0.34, 0.82, 0.68, zt + 0.16, zt + 0.175, mat('#cfc6b4'));
  sintex(iso, 0.94, 0.42, zt, 0.05, 0.08);
  sintex(iso, 1.08, 0.42, zt, 0.05, 0.08);
  sintex(iso, 1.22, 0.42, zt, 0.05, 0.08);
  for (let i = 0; i < 3; i++) iso.box(0.9 + i * 0.18, 0.78, 1.02 + i * 0.18, 0.92, zt, zt + 0.05, mat('#c9ccd0'));
  // hoarding on a steel lattice, facing +v
  const hv = 0.98;
  const hz = zt + 0.1;
  const ha0 = 0.4;
  const ha1 = 1.44;
  for (let a = ha0 + 0.06; a < ha1; a += 0.2) {
    iso.line([a, hv - 0.06, zt], [a, hv, hz + 0.3], '#4a4a4a', 1.4);
    iso.line([a, hv, zt], [a, hv, hz], '#4a4a4a', 1.4);
    iso.line([a, hv - 0.06, zt], [a, hv, hz], alpha('#4a4a4a', 0.7), 0.8);
  }
  signboard(iso, rng, 'v', hv, ha0, ha1, hz, hz + 0.3, bronze ? '#ffc107' : '#0d47a1', bronze ? '#b71c1c' : '#ffffff', { style: 'latin', subline: true, depth: 0.012, emblem: bronze ? '#b71c1c' : '#ff5252', border: '#f4f4f4' });
  // hoarding flood lights
  for (let a = ha0 + 0.1; a < ha1; a += 0.25) {
    iso.line([a, hv + 0.012, hz + 0.3], [a, hv + 0.06, hz + 0.33], '#3a3a3a', 1);
    iso.box(a - 0.01, hv + 0.05, a + 0.01, hv + 0.07, hz + 0.32, hz + 0.34, mat('#d0d0d0'), { edges: false });
  }
  parapet(iso, tu0, tv0, tu1, tv1, zt, 0.06, 0.025, mat(stone), 'front');
  acp(iso, 'v', tv1, tu0, tu1, zt, zt + 0.06, bronze ? '#8a7a66' : '#d6d8da', 0, 0.2);
  acp(iso, 'u', tu1, tv0, tv1, zt, zt + 0.06, bronze ? '#8a7a66' : '#d6d8da', 0, 0.2);
  // forecourt: drop-off, guard cabin + boom barrier, cars, palms
  iso.box(1.64, 1.58, 1.78, 1.72, z, z + 0.09, mat('#f0ece2'));
  iso.poly(iso.faceVQuad(1.72, 1.67, 1.76, z + 0.03, z + 0.07), '#4a6a7a');
  iso.box(1.62, 1.56, 1.8, 1.74, z + 0.09, z + 0.1, mat(accent));
  iso.line([1.6, 1.76, z + 0.05], [1.2, 1.76, z + 0.05], '#e53935', 2);
  iso.line([1.5, 1.76, z + 0.05], [1.4, 1.76, z + 0.05], '#ffffff', 2);
  car(iso, 0.92, 1.6, z, 'v', '#f4f4f4');
  car(iso, 0.3, 1.64, z, 'u', '#263238');
  car(iso, 1.3, 1.5, z, 'u', '#90a4ae');
  streetTree(iso, rng, 0.2, 1.55, z, 0.1, 'ashoka');
  streetTree(iso, rng, 1.86, 1.1, z, 0.12, 'ashoka');
  person(iso, 1.0, 1.5, z, '#263238');
  person(iso, 0.75, 1.55, z, '#f1ebdd');
  person(iso, 1.7, 1.8, z, '#5d4037');
}

// ============================================================================
// MALL (3×3)
// ============================================================================

function drawMall(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('mall', variant);
  const z = 0.02;
  commercialPlot(iso, rng, 3, z);
  const warm = variant === 0;
  const clad = warm ? '#c9754a' : '#5c6bc0';
  const clad2 = warm ? '#efe4d0' : '#eceff1';
  const signBg = warm ? '#c62828' : '#ffb300';
  const signFg = warm ? '#fff8e1' : '#1a237e';
  const u0 = 0.18;
  const v0 = 0.16;
  const u1 = 2.72;
  const v1 = 1.72;
  const fH = 0.2;
  const H = 3 * fH;
  iso.tree(2.86, 0.2, z, 0.14, rng, 'neem');
  iso.tree(0.12, 0.3, z, 0.12, rng, 'neem');
  // forecourt drive + parking
  iso.poly(iso.topQuad(0.1, 2.2, 2.9, 2.42, z + 0.001), '#8a8478');
  parkingBays(iso, 0.2, 1.2, 2.5, 2.8, z, 0.2);
  parkingBays(iso, 1.8, 2.8, 2.5, 2.8, z, 0.2);
  footShadow(iso, u0, v0, u1, v1, z, H, 3, 0.2);
  iso.box(u0, v0, u1, v1, z, z + H, mat(clad2));
  // +v facade: store fronts at ground, cladding above with posters
  for (let a = u0 + 0.06; a < u1 - 0.1; a += 0.3) {
    if (a > 1.0 && a < 1.9) continue;
    curtainWall(iso, 'v', v1, a, a + 0.24, z + 0.005, z + 0.15, '#86b0bc', '#d0d4d8', 0.08, 0.3);
    signboard(iso, rng, 'v', v1, a, a + 0.24, z + 0.155, z + 0.19, ['#1565c0', '#2e7d32', '#6a1b9a', '#e65100', '#00838f'][Math.floor(rng() * 5)], '#ffffff', { style: 'latin', depth: 0.006 });
  }
  acp(iso, 'v', v1, u0, u1, z + fH, z + H, clad, 0, 0.16);
  acp(iso, 'v', v1, u0, u1, z + fH - 0.01, z + fH + 0.02, clad2, 0.002, 0.3);
  // brand posters
  const posters = warm ? ['#ad1457', '#00897b', '#f9a825', '#3949ab'] : ['#d81b60', '#fb8c00', '#43a047', '#8e24aa'];
  const posterAt = [0.32, 0.66, 2.06, 2.4];
  posterAt.forEach((a, i) => {
    const q = iso.faceVQuad(v1 + 0.004, a, a + 0.26, z + fH + 0.05, z + H - 0.05);
    iso.box(a, v1, a + 0.26, v1 + 0.004, z + fH + 0.05, z + H - 0.05, mat(posters[i]), { edges: false });
    iso.poly(q, (() => {
      const [x0, y0] = iso.pt(a, v1, z + H);
      const [x1, y1] = iso.pt(a + 0.26, v1, z + fH);
      const g = iso.ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, shade(posters[i], 0.35));
      g.addColorStop(1, shade(posters[i], -0.15));
      return g;
    })());
    // abstract model silhouette + price burst
    iso.ellipse(a + 0.1, v1 + 0.005, z + fH + 0.3, 0.035, alpha('#f0c8a0', 0.9));
    iso.poly(iso.faceVQuad(v1 + 0.005, a + 0.06, a + 0.14, z + fH + 0.08, z + fH + 0.26), alpha('#ffffff', 0.85));
    iso.poly(iso.faceVQuad(v1 + 0.006, a + 0.07, a + 0.13, z + fH + 0.1, z + fH + 0.24), alpha(shade(posters[i], -0.3), 0.9));
    lettering(iso, rng, 'v', v1, a + 0.16, a + 0.25, z + fH + 0.12, 0.03, '#ffffff', 'latin', 0.006);
    iso.poly(q, null, alpha('#1e1e1e', 0.5), 0.8);
  });
  // +u facade: service side, cladding stripes, big poster, loading bay
  curtainWall(iso, 'u', u1, v0 + 0.1, v1 - 0.1, z + fH + 0.04, z + fH + 0.14, '#4f7f8c', '#c0c4c8', 0.14, 0.3);
  acp(iso, 'u', u1, v0, v1, z + fH + 0.16, z + H, clad, 0, 0.16);
  acp(iso, 'u', u1, v0, v1, z, z + fH, clad2, 0, 0.2);
  for (const a of [0.4, 0.7]) iso.poly(iso.faceUQuad(u1 + 0.001, a, a + 0.22, z, z + 0.15), shade('#8f9aa0', -0.25));
  signboard(iso, rng, 'u', u1, 1.0, 1.6, z + fH + 0.2, z + H - 0.04, posters[1], '#ffffff', { style: 'latin', subline: true, depth: 0.006 });
  weatherU(iso, rng, u1, v0, v1, z, z + H, 30, 0.1);
  // ---- roof
  const zt = z + H;
  roofSurface(iso, rng, u0, v0, u1, v1, zt, '#b4ada0');
  parapet(iso, u0, v0, u1, v1, zt, 0.05, 0.03, mat(clad2), 'back');
  // HVAC chillers
  for (let i = 0; i < 4; i++) {
    const cu = 0.4 + i * 0.22;
    iso.box(cu, 0.35, cu + 0.18, 0.6, zt, zt + 0.08, mat('#c9ccd0'));
    for (const cv of [0.42, 0.53]) iso.ellipse(cu + 0.09, cv, zt + 0.081, 0.04, '#5a5e62', '#2a2a2a', 0.8);
  }
  sintex(iso, 2.3, 0.4, zt, 0.06, 0.1);
  sintex(iso, 2.46, 0.4, zt, 0.06, 0.1);
  sintex(iso, 2.3, 0.6, zt, 0.06, 0.1);
  // food-court skylight barrel
  const su0 = 1.2;
  const su1 = 1.8;
  const sv0 = 0.7;
  const sv1 = 1.3;
  iso.box(su0, sv0, su1, sv1, zt, zt + 0.04, mat(clad2));
  for (let i = 0; i <= 8; i++) {
    const t0 = (i / 8) * Math.PI;
    const t1 = ((i + 1) / 8) * Math.PI;
    if (i === 8) break;
    const r = (sv1 - sv0) / 2;
    const vc = (sv0 + sv1) / 2;
    const pts: P3[] = [
      [su0, vc - Math.cos(t0) * r, zt + 0.04 + Math.sin(t0) * r * 0.4],
      [su1, vc - Math.cos(t0) * r, zt + 0.04 + Math.sin(t0) * r * 0.4],
      [su1, vc - Math.cos(t1) * r, zt + 0.04 + Math.sin(t1) * r * 0.4],
      [su0, vc - Math.cos(t1) * r, zt + 0.04 + Math.sin(t1) * r * 0.4],
    ];
    iso.poly(pts, shade('#7fb3c4', 0.25 - i * 0.05), alpha('#d0d4d8', 0.9), 0.8);
  }
  for (let u = su0 + 0.1; u < su1; u += 0.1) {
    const pts: P3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = (k / 8) * Math.PI;
      pts.push([u, (sv0 + sv1) / 2 - Math.cos(t) * 0.3, zt + 0.04 + Math.sin(t) * 0.12]);
    }
    iso.polyline(pts, alpha('#e0e4e8', 0.8), 0.8);
  }
  if (!warm) {
    // rooftop mobile tower
    for (const [du, dv] of [
      [-0.04, -0.04],
      [0.04, -0.04],
      [-0.04, 0.04],
      [0.04, 0.04],
    ] as [number, number][])
      iso.line([2.3 + du, 1.2 + dv, zt], [2.3 + du * 0.3, 1.2 + dv * 0.3, zt + 0.5], '#8a8a8a', 1.2);
    for (let k = 1; k < 6; k++) {
      const s = 0.04 * (1 - (k / 6) * 0.7);
      iso.poly(iso.topQuad(2.3 - s, 1.2 - s, 2.3 + s, 1.2 + s, zt + 0.5 * (k / 6)), null, alpha('#6a6a6a', 0.8), 0.7);
    }
  } else {
    pots(iso, rng, 2.2, 1.3, zt, 5, 'u');
  }
  parapet(iso, u0, v0, u1, v1, zt, 0.05, 0.03, mat(clad2), 'front');
  acp(iso, 'v', v1, u0, u1, zt, zt + 0.05, clad2, 0, 0.3);
  acp(iso, 'u', u1, v0, v1, zt, zt + 0.05, clad2, 0, 0.3);
  // ---- glass atrium (projects forward, taller than the block)
  const au0 = 1.02;
  const au1 = 1.9;
  const av1 = 2.0;
  const aH = H + 0.16;
  footShadow(iso, au0, v1, au1, av1, z, 0.15, 3, 0.12);
  iso.box(au0, v1 - 0.2, au1, av1, z, z + aH, mat('#7fb3c4'), { noTop: true });
  curtainWall(iso, 'v', av1, au0, au1, z, z + aH, '#6fa8bc', '#e0e4e8', 0.11, 0.13);
  curtainWall(iso, 'u', au1, v1 - 0.2, av1, z, z + aH, '#6fa8bc', '#e0e4e8', 0.08, 0.13);
  // interior hints: escalator + floor slabs seen through the glass
  for (let k = 1; k < 3; k++) iso.poly(iso.faceVQuad(av1 + 0.001, au0 + 0.02, au1 - 0.02, z + k * fH - 0.008, z + k * fH), alpha('#f4f4f2', 0.55));
  iso.line([1.25, av1 + 0.001, z + 0.02], [1.55, av1 + 0.001, z + fH], alpha('#2a2a2a', 0.5), 2.4);
  iso.box(au0 - 0.02, v1 - 0.22, au1 + 0.02, av1 + 0.02, z + aH, z + aH + 0.03, mat(clad2));
  // huge fascia sign above the entrance
  signboard(iso, rng, 'v', av1 + 0.02, au0 + 0.02, au1 - 0.02, z + aH + 0.03, z + aH + 0.16, signBg, signFg, { style: 'latin', subline: false, depth: 0.02, emblem: signFg, border: shade(signBg, -0.25) });
  // entrance canopy + doors
  iso.poly(iso.faceVQuad(av1 + 0.002, 1.32, 1.6, z, z + 0.12), alpha('#243038', 0.7));
  for (const a of [1.28, 1.62]) iso.box(a, av1 + 0.12, a + 0.02, av1 + 0.14, z, z + 0.14, mat('#e0e4e8'));
  iso.box(1.24, av1, 1.68, av1 + 0.16, z + 0.14, z + 0.16, mat(clad));
  // forecourt: auto stand + e-rickshaws, cars, trees, people
  autoRickshaw(iso, 0.3, 2.06, z, 'u');
  autoRickshaw(iso, 0.48, 2.06, z, 'u', '#1e1e1e', '#f2c230');
  autoRickshaw(iso, 0.66, 2.06, z, 'u');
  eRickshaw(iso, 2.0, 2.06, z, 'u');
  eRickshaw(iso, 2.2, 2.06, z, 'u', '#e0e0e0', '#2f6fb3');
  eRickshaw(iso, 2.42, 2.06, z, 'u', '#43a047');
  car(iso, 0.22, 2.52, z, 'v', '#f4f4f4');
  car(iso, 0.62, 2.52, z, 'v', '#1565c0');
  car(iso, 1.02, 2.52, z, 'v', '#9e9e9e');
  car(iso, 1.82, 2.52, z, 'v', '#b71c1c');
  car(iso, 2.42, 2.52, z, 'v', '#263238');
  for (let i = 0; i < 12; i++) {
    const pu = 1.0 + rng() * 1.0;
    const pv = 2.04 + rng() * 0.14;
    person(iso, pu, pv, z, LAUNDRY[i % LAUNDRY.length]);
  }
  for (const u of [0.16, 1.4, 2.84]) streetTree(iso, rng, u, 2.9, z, 0.12, u === 1.4 ? 'ashoka' : 'neem');
  streetTree(iso, rng, 2.88, 1.3, z, 0.13, 'peepal');
  streetTree(iso, rng, 2.88, 0.8, z, 0.12, 'ashoka');
  // pylon sign at the entrance of the drive
  iso.box(2.78, 2.28, 2.84, 2.34, z, z + 0.34, mat(clad));
  signboard(iso, rng, 'v', 2.34, 2.74, 2.88, z + 0.2, z + 0.33, signBg, signFg, { style: 'latin', depth: 0.006 });
}

export const COMMERCIAL_SPRITES: Record<string, ProceduralSpriteDef> = {
  shop_small: { footprint: 1, variants: 3, heightTiles: 0.36, draw: drawShopSmall },
  shop_medium: { footprint: 1, variants: 3, heightTiles: 0.44, draw: drawShopMedium },
  office_building_small: { footprint: 1, variants: 2, heightTiles: 0.44, draw: drawOfficeSmall },
  office_low: { footprint: 2, variants: 2, heightTiles: 0.46, draw: drawOfficeLow },
  office_high: { footprint: 2, variants: 2, heightTiles: 0.96, draw: drawOfficeHigh },
  mall: { footprint: 3, variants: 2, heightTiles: 0.42, draw: drawMall },
};
