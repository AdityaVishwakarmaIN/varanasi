/**
 * Code-drawn Indian trees for the `tree` tile (forests, planted trees): peepal, neem, banyan,
 * ashoka and flowering gulmohar, in the warm layered style of the building art.
 *
 * The map draws these through the procedural sprite cache (one canvas per variant × resolution
 * tier) and sways them in the wind layer (see ../../windRenderer.ts). Variant = species × shape,
 * picked per tile by `pickProceduralVariant`, so forests read as a varied mix.
 */
import { alpha, seededRng, shade, type Ctx2D, type Iso } from '../isoPainter';
import { makeIso, type ProceduralSpriteDef } from '../varanasiSprites';
import { canopy, lushTree, type Rng, type TreeKind } from './parksKit';

type TreeSpecies = 'peepal' | 'neem' | 'banyan' | 'ashoka' | 'gulmohar';

interface TreeVariant {
  kind: TreeSpecies;
  /** Canopy radius in tile units (see `lushTree`). */
  size: number;
  /** Trunk offset from the tile centre (tile units). */
  du: number;
  dv: number;
  /** Small companion shrub/sapling at the foot of the tree. */
  companion?: [number, number, number, TreeKind];
}

/** Species mix: peepal and neem most common, then banyan, ashoka and gulmohar. `size` = canopy
 *  half-width in tile widths for broad trees; `lushTree` size for the columnar ashoka. */
export const TREE_VARIANTS: readonly TreeVariant[] = [
  { kind: 'peepal', size: 0.4, du: 0, dv: 0 },
  { kind: 'peepal', size: 0.35, du: -0.05, dv: 0.03, companion: [0.8, 0.74, 0.1, 'bush'] },
  { kind: 'peepal', size: 0.38, du: 0.03, dv: -0.03 },
  { kind: 'neem', size: 0.38, du: 0.02, dv: 0.02 },
  { kind: 'neem', size: 0.33, du: -0.04, dv: -0.03, companion: [0.76, 0.8, 0.09, 'bush'] },
  { kind: 'neem', size: 0.36, du: 0, dv: 0.04 },
  { kind: 'banyan', size: 0.45, du: 0, dv: 0 },
  { kind: 'banyan', size: 0.42, du: 0.02, dv: -0.02 },
  { kind: 'ashoka', size: 0.33, du: -0.06, dv: 0.04, companion: [0.8, 0.26, 0.2, 'ashoka'] },
  { kind: 'ashoka', size: 0.36, du: -0.02, dv: 0.02 },
  { kind: 'gulmohar', size: 0.39, du: 0, dv: 0 },
  { kind: 'gulmohar', size: 0.34, du: 0.03, dv: 0.02, companion: [0.28, 0.8, 0.09, 'bush'] },
];

/** A few grass tufts and fallen leaves/petals around the trunk (breaks up the plain tile). */
function groundLitter(iso: Iso, rng: Rng, u: number, v: number, species: TreeSpecies): void {
  const { ctx, px } = iso;
  const leaf = species === 'gulmohar' ? ['#d8402a', '#f07a34'] : species === 'peepal' ? ['#c9a64a', '#8aa63a'] : ['#b89a4a', '#7e9a36'];
  for (let b = 0; b < 2; b++) {
    ctx.fillStyle = alpha(leaf[b], species === 'gulmohar' ? 0.9 : 0.7);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2;
      const d = 0.08 + rng() * 0.24;
      const [x, y] = iso.pt(u + Math.cos(a) * d, v + Math.sin(a) * d, 0);
      const s = (1 + rng() * 0.9) * px;
      ctx.moveTo(x + s, y);
      ctx.ellipse(x, y, s, s * 0.55, rng() * Math.PI, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  // grass tufts: short blades, darker at the root
  ctx.lineWidth = 1 * px;
  ctx.lineCap = 'round';
  ctx.strokeStyle = alpha('#4c7a26', 0.85);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const [x, y] = iso.pt(0.12 + rng() * 0.76, 0.12 + rng() * 0.76, 0);
    for (let k = -1; k <= 1; k++) {
      ctx.moveTo(x + k * 1.2 * px, y);
      ctx.lineTo(x + k * 2.2 * px, y - (2.5 + rng() * 2) * px);
    }
  }
  ctx.stroke();
}

/** Peepal: glossy heart-shaped leaves with drip tips along the lit rim. */
function peepalLeaves(iso: Iso, rng: Rng, cx: number, cy: number, rx: number, ry: number): void {
  const { ctx, px } = iso;
  const s = 3.2 * px;
  const heart = (x: number, y: number, r: number, rot: number) => {
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const P = (a: number, b: number): [number, number] => [x + a * c - b * sn, y + a * sn + b * c];
    const [ax, ay] = P(0, -r * 0.55);
    const [tx, ty] = P(0, r * 1.25);
    const [l1x, l1y] = P(-r, -r * 0.95);
    const [l2x, l2y] = P(-r * 1.05, r * 0.35);
    const [r1x, r1y] = P(r, -r * 0.95);
    const [r2x, r2y] = P(r * 1.05, r * 0.35);
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(l1x, l1y, l2x, l2y, tx, ty);
    ctx.bezierCurveTo(r2x, r2y, r1x, r1y, ax, ay);
  };
  const lit: [number, number, number, number][] = [];
  const dark: [number, number, number, number][] = [];
  for (let i = 0; i < 34; i++) {
    const a = rng() * Math.PI * 2;
    const d = 0.5 + rng() * 0.45;
    const x = cx + Math.cos(a) * d * rx * 0.92;
    const y = cy + Math.sin(a) * d * ry * 0.9;
    const k = ((x - cx) / rx) * 0.6 + ((y - cy) / ry) * 0.8;
    (k < 0.05 ? lit : dark).push([x, y, s * (0.8 + rng() * 0.5), (rng() - 0.5) * 1.2]);
  }
  ctx.fillStyle = alpha('#9ccc52', 0.9);
  ctx.beginPath();
  for (const [x, y, r, rot] of lit) heart(x, y, r, rot);
  ctx.fill();
  ctx.fillStyle = alpha('#2c5220', 0.8);
  ctx.beginPath();
  for (const [x, y, r, rot] of dark) heart(x, y, r, rot);
  ctx.fill();
  // specular glints on the waxy leaves
  ctx.fillStyle = alpha('#f2fbc8', 0.75);
  ctx.beginPath();
  for (const [x, y] of lit) ctx.rect(x - 0.6 * px, y - 0.4 * px, 1.1 * px, 1.1 * px);
  ctx.fill();
}

/** Neem: feathery pinnate sprays poking out of the canopy edge. */
function neemFronds(iso: Iso, rng: Rng, cx: number, cy: number, rx: number, ry: number): void {
  const { ctx, px } = iso;
  const lit = '#a6d060';
  const dark = '#335a1e';
  for (const [col, want] of [[dark, false], [lit, true]] as const) {
    ctx.strokeStyle = alpha(col, 0.9);
    ctx.lineWidth = 0.9 * px;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const a = rng() * Math.PI * 2;
      const x0 = cx + Math.cos(a) * rx * 0.72;
      const y0 = cy + Math.sin(a) * ry * 0.7;
      const k = Math.cos(a) * 0.6 + Math.sin(a) * 0.8;
      if ((k < 0.1) !== want) continue;
      // drooping frond: midrib + paired leaflets
      const len = (5 + rng() * 4) * px;
      const dx = Math.cos(a) * len;
      const dy = Math.sin(a) * len * 0.7 + len * 0.35;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + dx, y0 + dy);
      for (let j = 1; j <= 4; j++) {
        const t = j / 5;
        const bx = x0 + dx * t;
        const by = y0 + dy * t;
        const l = 2.2 * px * (1 - t * 0.4);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - dy / len * l + dx / len * l * 0.5, by + dx / len * l + dy / len * l * 0.5);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + dy / len * l + dx / len * l * 0.5, by - dx / len * l + dy / len * l * 0.5);
      }
    }
    ctx.stroke();
  }
  // tiny cream blossom clusters (neem flowers)
  ctx.fillStyle = alpha('#f4efd0', 0.8);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const x = cx + (rng() - 0.6) * rx * 1.2;
    const y = cy + (rng() - 0.7) * ry * 1.1;
    ctx.rect(x, y, 1.2 * px, 1.2 * px);
  }
  ctx.fill();
}

/** Ashoka: long drooping wavy leaves hanging down the column. */
function ashokaDrapes(iso: Iso, rng: Rng, u: number, v: number, size: number): void {
  const { ctx, px, T } = iso;
  const [bx, by] = iso.pt(u, v, size * 0.35);
  const H = size * 3.4 * T * 0.5657;
  ctx.lineWidth = 1 * px;
  ctx.lineCap = 'round';
  for (const [col, side] of [['#1a3c18', 1], ['#7fb44e', -1]] as const) {
    ctx.strokeStyle = alpha(col, 0.85);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const t = 0.12 + rng() * 0.8;
      const w = size * T * 0.62 * 0.75 * Math.sin(Math.PI * (0.12 + t * 0.85)) * (1 - t * 0.35);
      const x = bx + side * w * (0.35 + rng() * 0.5);
      const y = by - t * H * 0.92;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + side * 1.5 * px, y + 2.5 * px, x + side * 0.6 * px, y + (4 + rng() * 3) * px);
    }
    ctx.stroke();
  }
}

interface BroadSpec {
  /** Canopy vertical radius as a fraction of its half-width. */
  ryK: number;
  /** Trunk height (z, tile units) and base radius (tile units). */
  trunkH: number;
  trunkR: number;
  bark: string;
  lumps: number;
  dabs: number;
  pal: { dark: string; mid: string; light: string; hi: string };
}

const BROAD: Record<Exclude<TreeSpecies, 'ashoka'>, BroadSpec> = {
  peepal: { ryK: 0.8, trunkH: 0.46, trunkR: 0.034, bark: '#7a5f48', lumps: 13, dabs: 1, pal: { dark: '#2f5a22', mid: '#4a7f2c', light: '#72a83e', hi: '#b4d86a' } },
  neem: { ryK: 0.74, trunkH: 0.44, trunkR: 0.028, bark: '#5d4430', lumps: 15, dabs: 1.5, pal: { dark: '#3e6424', mid: '#5c8a30', light: '#86b448', hi: '#c6e27e' } },
  banyan: { ryK: 0.56, trunkH: 0.42, trunkR: 0.05, bark: '#86694e', lumps: 18, dabs: 1, pal: { dark: '#28501f', mid: '#3f7229', light: '#63993a', hi: '#a2cc62' } },
  gulmohar: { ryK: 0.62, trunkH: 0.46, trunkR: 0.028, bark: '#6b4a2f', lumps: 13, dabs: 0.8, pal: { dark: '#3a5e22', mid: '#56822c', light: '#7cab40', hi: '#bcd878' } },
};

/** Soft contact + cast shadow that stays inside the tile. */
function groundShadow(iso: Iso, u: number, v: number, r: number): void {
  iso.ellipse(u + r * 0.3, v - r * 0.08, 0, r * 0.95, 'rgba(38,26,14,0.13)');
  iso.ellipse(u + r * 0.18, v - r * 0.02, 0, r * 0.62, 'rgba(38,26,14,0.13)');
  iso.aoEllipse(u, v, 0.03, 0, 0.03, 0.3);
}

/** Broad-leaved tree (peepal, neem, banyan, gulmohar) with a canopy of half-width `size` tiles. */
function broadTree(iso: Iso, rng: Rng, u: number, v: number, size: number, kind: Exclude<TreeSpecies, 'ashoka'>): void {
  const sp = BROAD[kind];
  const { ctx, px, T } = iso;
  groundShadow(iso, u, v, Math.min(0.36, size * 0.8));
  const rx = size * T;
  const ry = rx * sp.ryK;
  const [tx, ty] = iso.pt(u, v, sp.trunkH);
  const cx = tx;
  const cy = ty - ry * (kind === 'banyan' ? 0.5 : 0.7);
  if (kind === 'banyan') {
    // curtain of aerial prop roots, some thickened into secondary trunks
    for (let i = 0; i < 16; i++) {
      const du = (rng() - 0.5) * size * 1.3;
      const dv = (rng() - 0.5) * size * 1.3;
      const [gx, gy] = iso.pt(u + du, v + dv, 0);
      const top = cy + ry * (0.1 + rng() * 0.3);
      const thick = i < 3;
      ctx.strokeStyle = thick ? shade(sp.bark, -0.12) : alpha(shade(sp.bark, rng() * 0.2 - 0.1), 0.85);
      ctx.lineWidth = (thick ? 2.6 : 0.8 + rng() * 0.8) * px;
      ctx.beginPath();
      ctx.moveTo(gx + (rng() - 0.5) * 2 * px, top);
      ctx.lineTo(gx, rng() < 0.6 || thick ? gy : gy - (gy - top) * (0.3 + rng() * 0.3));
      ctx.stroke();
    }
  }
  // tapered trunk + forking limbs into the crown
  iso.lathe(u, v, 0, [[0, sp.trunkR * 1.4], [sp.trunkH * 0.12, sp.trunkR], [sp.trunkH, sp.trunkR * 0.6]],
    (t) => (t < 0.1 ? shade(sp.bark, -0.12) : sp.bark), { outline: true, lit: 0.22 });
  const limbW = sp.trunkR * 150;
  iso.line([u, v, sp.trunkH * 0.75], [u - size * 0.35, v + size * 0.2, sp.trunkH * 1.2], shade(sp.bark, -0.08), limbW);
  iso.line([u, v, sp.trunkH * 0.7], [u + size * 0.3, v - size * 0.25, sp.trunkH * 1.18], shade(sp.bark, -0.25), limbW * 0.9);
  canopy(iso, rng, cx, cy, rx, ry, sp.pal, sp.lumps, sp.dabs);
  if (kind === 'peepal') peepalLeaves(iso, rng, cx, cy, rx, ry);
  else if (kind === 'neem') neemFronds(iso, rng, cx, cy, rx, ry);
  else if (kind === 'banyan') {
    // pale-orange figs dotted through the crown
    ctx.fillStyle = alpha('#d86a3a', 0.85);
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const x = cx + (rng() - 0.5) * rx * 1.4;
      const y = cy + (rng() - 0.55) * ry * 1.2;
      ctx.moveTo(x + 0.9 * px, y);
      ctx.arc(x, y, 0.9 * px, 0, Math.PI * 2);
    }
    ctx.fill();
  } else gulmoharBlossom(iso, rng, cx, cy, rx, ry);
}

/** Gulmohar: flame-red flower clusters over the crown, lit orange on top. */
function gulmoharBlossom(iso: Iso, rng: Rng, cx: number, cy: number, rx: number, ry: number): void {
  const { ctx, px } = iso;
  const cl: [number, number, number][] = [];
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng());
    const x = cx + Math.cos(a) * d * rx * 0.8;
    const y = cy + Math.sin(a) * d * ry * 0.74 - ry * 0.1;
    cl.push([x, y, rx * (0.055 + rng() * 0.06)]);
  }
  cl.sort((a, b) => a[1] - b[1]);
  const pass = (col: string, k: number, ox: number, oy: number, onlyLit: boolean) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const [x, y, r] of cl) {
      if (onlyLit && ((x - cx) / rx) * 0.6 + ((y - cy) / ry) * 0.8 > 0.15) continue;
      ctx.moveTo(x + ox * r + r * k, y + oy * r);
      ctx.arc(x + ox * r, y + oy * r, r * k, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  pass(alpha('#6e1a14', 0.7), 1.12, 0.1, 0.15, false);
  pass('#b8281e', 1, 0, 0, false);
  pass('#e2482c', 0.72, -0.18, -0.2, false);
  pass(alpha('#ff9a48', 0.9), 0.4, -0.3, -0.38, true);
  // leaf gaps breaking up the clusters, then scattered single petals
  ctx.fillStyle = alpha('#3a5e22', 0.55);
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const [x, y, r] = cl[Math.floor(rng() * cl.length)];
    ctx.rect(x + (rng() - 0.3) * r * 1.6, y + (rng() - 0.3) * r * 1.4, 1.2 * px, 1.2 * px);
  }
  ctx.fill();
  ctx.fillStyle = alpha('#ffb454', 0.9);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const x = cx + (rng() - 0.5) * rx * 1.6;
    const y = cy + (rng() - 0.6) * ry * 1.4;
    ctx.rect(x, y, 1.1 * px, 1.1 * px);
  }
  ctx.fill();
}

function drawTree(ctx: Ctx2D, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 1);
  const rng = seededRng('tree', variant);
  const tv = TREE_VARIANTS[variant % TREE_VARIANTS.length];
  const u = 0.5 + tv.du;
  const v = 0.5 + tv.dv;
  groundLitter(iso, rng, u, v, tv.kind);
  const comp = tv.companion;
  // companions behind the main tree (smaller u + v) paint first
  if (comp && comp[0] + comp[1] < u + v) lushTree(iso, rng, comp[0], comp[1], 0, comp[2], comp[3]);
  if (tv.kind === 'ashoka') {
    lushTree(iso, rng, u, v, 0, tv.size, 'ashoka');
    ashokaDrapes(iso, rng, u, v, tv.size);
  } else broadTree(iso, rng, u, v, tv.size, tv.kind);
  if (comp && comp[0] + comp[1] >= u + v) lushTree(iso, rng, comp[0], comp[1], 0, comp[2], comp[3]);
}

export const TREE_SPRITES: Record<string, ProceduralSpriteDef> = {
  tree: { footprint: 1, variants: TREE_VARIANTS.length, heightTiles: 0.72, draw: drawTree },
};
