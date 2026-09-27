/**
 * Drawing kit for the Indian park art (./parks.ts): lush layered trees, garden furniture,
 * char-bagh water channels, fountains, flower beds, cows, rowing boats and jetties.
 * All positions are in tile space (u, v, z) on an `Iso` painter; see ../isoPainter.ts.
 */
import { alpha, mat, seededRng, shade, type Iso, type P3 } from '../isoPainter';
import { C, waterSurface } from '../varanasiSprites';

export type Rng = ReturnType<typeof seededRng>;

// ============================================================================
// Palette additions
// ============================================================================

export const P = {
  redSandstone: '#b8634a',
  redSandstoneDeep: '#9a4d38',
  gravel: '#d8c49a',
  gravelDark: '#bca57a',
  soil: '#7a5638',
  soilDark: '#5e4029',
  hedge: '#4f7d2e',
  pool: '#4f9a9c',
  poolDeep: '#2f6f78',
  kurta: ['#f1ebdd', '#e4572e', '#3a86c8', '#f2c14e', '#b44ca0', '#3aa36b', '#e07a9a'] as const,
  flowers: ['#f5a623', '#e0761a', '#f2d04e', '#d9433a', '#e86fa0', '#f7f1e3'] as const,
  boatHull: ['#2f6fb3', '#3a8f5c', '#b8413a', '#e0a33a'] as const,
} as const;

// ============================================================================
// Trees: layered canopies
// ============================================================================

export type TreeKind = 'peepal' | 'neem' | 'banyan' | 'mango' | 'ashoka' | 'gulmohar' | 'cypress' | 'deodar' | 'bush';

interface Pal {
  dark: string;
  mid: string;
  light: string;
  hi: string;
}

const TREE_PAL: Record<TreeKind, Pal> = {
  peepal: { dark: '#2f5a22', mid: '#4a7f2c', light: '#72a83e', hi: '#b4d86a' },
  neem: { dark: '#3e6424', mid: '#5c8a30', light: '#86b448', hi: '#c6e27e' },
  banyan: { dark: '#28501f', mid: '#3f7229', light: '#63993a', hi: '#a2cc62' },
  mango: { dark: '#22461c', mid: '#355f24', light: '#548a34', hi: '#90bc5c' },
  ashoka: { dark: '#1f4a1e', mid: '#2f6228', light: '#4a8a36', hi: '#86b85a' },
  gulmohar: { dark: '#3a5e22', mid: '#56822c', light: '#7cab40', hi: '#bcd878' },
  cypress: { dark: '#1e4220', mid: '#2c5a2a', light: '#467e3a', hi: '#7aa85a' },
  deodar: { dark: '#1d3d26', mid: '#2b5534', light: '#447a48', hi: '#78a874' },
  bush: { dark: '#35601f', mid: '#4f822c', light: '#74aa40', hi: '#b2d66e' },
};

/**
 * Layered canopy in screen space: dark silhouette + outline, mid volume, lit crown towards the
 * top-left, then leaf dabs. (cx, cy) = canopy centre, rx/ry = screen radii (px).
 */
export function canopy(iso: Iso, rng: Rng, cx: number, cy: number, rx: number, ry: number, pal: Pal, lumps = 12, dabs = 1): void {
  const { ctx, px } = iso;
  const L: [number, number, number][] = [];
  const rr = (rx + ry) * 0.5;
  for (let i = 0; i < lumps; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng());
    L.push([cx + Math.cos(a) * d * rx * 0.66, cy + Math.sin(a) * d * ry * 0.62, rr * (0.3 + rng() * 0.16)]);
  }
  // fringe lumps around the rim break up the silhouette
  const fr = Math.max(6, Math.round(lumps * 0.8));
  for (let i = 0; i < fr; i++) {
    const a = (i / fr) * Math.PI * 2 + rng() * 0.4;
    L.push([cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.78, rr * (0.2 + rng() * 0.1)]);
  }
  // 1. outline
  ctx.fillStyle = alpha(shade(pal.dark, -0.55), 0.75);
  ctx.beginPath();
  for (const [x, y, r] of L) {
    ctx.moveTo(x + r + 1.3 * px, y);
    ctx.arc(x, y, r + 1.3 * px, 0, Math.PI * 2);
  }
  ctx.fill();
  // 2. dark base volume
  ctx.fillStyle = pal.dark;
  ctx.beginPath();
  for (const [x, y, r] of L) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  // 3. mid clusters, shifted up-left (lit from the top-left)
  //    two batched tone passes (mid, then light further up-left) instead of a gradient per lump
  L.sort((a, b) => a[1] - b[1]);
  const tones: [number, number, number, number, string][] = [
    [0.75, 0.1, 0.8, 0.12, pal.mid],
    [0.2, 0.3, 0.52, 0.34, alpha(pal.light, 0.85)],
  ];
  for (const [kMax, off, rs, offY, col] of tones) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const [x, y, r] of L) {
      const k = ((x - cx) / rx) * 0.6 + ((y - cy) / ry) * 0.8; // > 0 = lower-right (shade)
      if (k > kMax) continue;
      const X = x - r * off;
      const Y = y - r * offY;
      ctx.moveTo(X + r * rs, Y);
      ctx.arc(X, Y, r * rs, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  // 4. lit crown clusters
  for (const [x, y, r] of L) {
    const k = ((x - cx) / rx) * 0.6 + ((y - cy) / ry) * 0.8;
    if (k > -0.05) continue;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x - r * 0.25, y - r * 0.3, r * 0.55);
    g.addColorStop(0, alpha(pal.hi, 0.85));
    g.addColorStop(1, alpha(pal.light, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // 5. leaf dabs: light ones up-left, dark gaps down-right
  // (batched into one path per colour: far fewer fills than one per dab)
  const n = Math.round(lumps * 7 * dabs);
  const buckets: number[][] = [[], [], []]; // hi, light, dark: flat [x, y, s, a] runs
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng());
    const x = cx + Math.cos(a) * d * rx * 0.85;
    const y = cy + Math.sin(a) * d * ry * 0.82;
    const k = ((x - cx) / rx) * 0.6 + ((y - cy) / ry) * 0.8;
    const s = (1.6 + rng() * 1.8) * px;
    const b = k < -0.1 + rng() * 0.4 ? (rng() < 0.4 ? 0 : 1) : 2;
    buckets[b].push(x, y, s, a);
  }
  const cols = [alpha(pal.hi, 0.75), alpha(pal.light, 0.75), alpha(shade(pal.dark, -0.3), 0.55)];
  for (let b = 0; b < 3; b++) {
    const d = buckets[b];
    if (!d.length) continue;
    ctx.fillStyle = cols[b];
    ctx.beginPath();
    for (let i = 0; i < d.length; i += 4) {
      ctx.moveTo(d[i] + d[i + 2] * Math.cos(d[i + 3]), d[i + 1] + d[i + 2] * Math.sin(d[i + 3]));
      ctx.ellipse(d[i], d[i + 1], d[i + 2], d[i + 2] * 0.7, d[i + 3], 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/** Soft ground shadow for a tree canopy of tile radius r. */
function treeShadow(iso: Iso, u: number, v: number, z: number, r: number): void {
  iso.ellipse(u + r * 0.55, v - r * 0.05, z, r * 0.95, 'rgba(38,26,14,0.16)');
  iso.ellipse(u + r * 0.4, v, z, r * 0.7, 'rgba(38,26,14,0.14)');
  // small trees get a single contact shadow instead of the stacked AO rings
  if (r < 0.1) iso.ellipse(u + 0.004, v + 0.004, z, r * 0.2 + 0.012, 'rgba(35,22,12,0.18)');
  else iso.aoEllipse(u, v, r * 0.2, z, 0.03, 0.3);
}

/** Tapered trunk with a couple of forking limbs. */
function trunk(iso: Iso, u: number, v: number, z: number, r: number, H: number, color = '#6b4a2f'): void {
  iso.lathe(u, v, z, [
    [0, r * 1.35],
    [H * 0.12, r],
    [H, r * 0.6],
  ], (t) => (t < 0.1 ? shade(color, -0.1) : color), { outline: true, lit: 0.22 });
  iso.line([u, v, z + H * 0.75], [u - r * 3, v + r * 2, z + H * 1.15], shade(color, -0.1), r * 256 * 0.9);
  iso.line([u, v, z + H * 0.7], [u + r * 3.2, v - r * 1.5, z + H * 1.12], shade(color, -0.25), r * 256 * 0.8);
}

/**
 * A lush tree standing at (u, v, z). `size` ≈ canopy radius in tile units.
 */
export function lushTree(iso: Iso, rng: Rng, u: number, v: number, z: number, size: number, kind: TreeKind): void {
  const pal = TREE_PAL[kind];
  const T = iso.T;
  const tr = size * 0.09;
  if (kind === 'bush') {
    iso.aoEllipse(u, v, size * 0.8, z, size * 0.3, 0.3);
    const [cx, cy] = iso.pt(u, v, z + size * 0.55);
    canopy(iso, rng, cx, cy, size * T * 0.62, size * T * 0.5, pal, 6, 0.8);
    return;
  }
  if (kind === 'cypress' || kind === 'ashoka') {
    // tall, narrow flame-shaped trees (Mughal garden avenues)
    treeShadow(iso, u, v, z, size * 0.7);
    iso.lathe(u, v, z, [[0, tr * 0.9], [size * 0.5, tr * 0.7]], () => '#5e4028', { outline: true });
    const H = size * (kind === 'cypress' ? 4.2 : 3.4);
    const [bx, by] = iso.pt(u, v, z + size * 0.35);
    const topY = by - H * T * 0.5657;
    const ctx = iso.ctx;
    const steps = 9;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const w = size * T * 0.62 * (kind === 'cypress' ? Math.sin(Math.PI * (0.15 + t * 0.8)) * (1 - t * 0.55) : 0.75 * Math.sin(Math.PI * (0.12 + t * 0.85)) * (1 - t * 0.35));
      pts.push([bx + (rng() - 0.5) * w * 0.2, by - t * (by - topY) * 0.92, Math.max(w * 0.62, size * T * 0.1)]);
    }
    // outline + base
    // one path for the outline and one gradient-filled path for the body
    const o = 1.2 * iso.px;
    ctx.fillStyle = alpha(shade(pal.dark, -0.55), 0.75);
    ctx.beginPath();
    for (const [x, y, r] of pts) {
      ctx.moveTo(x + r + o, y);
      ctx.ellipse(x, y, r + o, r * 0.95 + o, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    let rMax = 0;
    for (const p of pts) rMax = Math.max(rMax, p[2]);
    const g = ctx.createLinearGradient(bx - rMax * 0.9, by, bx + rMax * 0.9, by);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.45, pal.mid);
    g.addColorStop(1, pal.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (const [x, y, r] of pts) {
      ctx.moveTo(x + r, y);
      ctx.ellipse(x, y, r, r * 0.95, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    // drooping leaf strokes / dabs
    const n = 50;
    const lit: number[] = [];
    const dim: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = rng();
      const idx = Math.min(steps - 1, Math.floor(t * steps));
      const [x, y, r] = pts[idx];
      const dx = (rng() - 0.5) * 2 * r * 0.85;
      (dx < -r * 0.1 ? lit : dim).push(x + dx, y + (rng() - 0.5) * r * 1.4);
    }
    const dw = 1.4 * iso.px;
    const dh = 3.2 * iso.px;
    ([[lit, alpha(pal.hi, 0.7)], [dim, alpha(shade(pal.dark, -0.3), 0.5)]] as const).forEach(([d, col]) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < d.length; i += 2) ctx.rect(d[i], d[i + 1], dw, dh);
      ctx.fill();
    });
    return;
  }
  if (kind === 'deodar') {
    treeShadow(iso, u, v, z, size * 0.8);
    iso.lathe(u, v, z, [[0, tr], [size * 0.6, tr * 0.7]], () => '#5a3c26', { outline: true });
    const ctx = iso.ctx;
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const [x, y] = iso.pt(u, v, z + size * (0.35 + t * 2.4));
      const w = size * T * 0.7 * (1 - t * 0.78);
      const hgt = size * T * 0.75;
      // drooping tier: triangle with a curved skirt
      const tier = () => {
        ctx.beginPath();
        ctx.moveTo(x, y - hgt);
        ctx.quadraticCurveTo(x - w * 0.5, y - hgt * 0.35, x - w, y + hgt * 0.12);
        ctx.quadraticCurveTo(x, y + hgt * 0.32, x + w, y + hgt * 0.12);
        ctx.quadraticCurveTo(x + w * 0.5, y - hgt * 0.35, x, y - hgt);
        ctx.closePath();
      };
      tier();
      ctx.lineWidth = 2.4 * iso.px;
      ctx.strokeStyle = alpha(shade(pal.dark, -0.55), 0.75);
      ctx.stroke();
      const g = ctx.createLinearGradient(x - w, y, x + w, y);
      g.addColorStop(0, pal.light);
      g.addColorStop(0.45, pal.mid);
      g.addColorStop(1, shade(pal.dark, -0.15));
      ctx.fillStyle = g;
      ctx.fill();
      for (let k = 0; k < 10; k++) {
        const fx = (rng() - 0.5) * 2 * w * 0.8;
        ctx.fillStyle = fx < 0 ? alpha(pal.hi, 0.6) : alpha(shade(pal.dark, -0.3), 0.5);
        ctx.fillRect(x + fx, y + hgt * (0.02 + rng() * 0.12), 2.4 * iso.px, 1.2 * iso.px);
      }
    }
    return;
  }
  // broad-leaved round trees
  const wide = kind === 'banyan' ? 1.45 : kind === 'peepal' ? 1.12 : kind === 'mango' ? 1.0 : 1.05;
  const trunkH = size * (kind === 'banyan' ? 1.05 : kind === 'mango' ? 0.8 : 1.0);
  treeShadow(iso, u, v, z, size * wide);
  const trR = tr * (kind === 'banyan' ? 1.7 : kind === 'peepal' ? 1.3 : 1);
  trunk(iso, u, v, z, trR, trunkH, kind === 'neem' ? '#5d4430' : kind === 'banyan' ? '#7a6048' : '#6b4a2f');
  const [cx, cy0] = iso.pt(u, v, z + trunkH);
  const rx = size * T * 0.62 * wide;
  const ry = size * T * (kind === 'banyan' ? 0.5 : 0.56);
  const cy = cy0 - ry * 0.55;
  if (kind === 'banyan') {
    // aerial prop roots hanging from the canopy
    for (let i = 0; i < 9; i++) {
      const du = (rng() - 0.5) * size * 2.2;
      const dv = (rng() - 0.5) * size * 1.2;
      const [x0, y0] = iso.pt(u + du, v + dv, z + trunkH * 1.05);
      const [x1, y1] = iso.pt(u + du, v + dv, z + (rng() < 0.45 ? 0 : trunkH * (0.3 + rng() * 0.4)));
      iso.ctx.strokeStyle = alpha('#7a6048', 0.85);
      iso.ctx.lineWidth = (1 + rng() * 1.6) * iso.px;
      iso.ctx.beginPath();
      iso.ctx.moveTo(x0, y0);
      iso.ctx.lineTo(x1 + (rng() - 0.5) * 2 * iso.px, y1);
      iso.ctx.stroke();
    }
  }
  canopy(iso, rng, cx, cy, rx, ry, pal, kind === 'banyan' ? 16 : kind === 'neem' ? 13 : 12, kind === 'neem' ? 1.4 : 1);
  if (kind === 'gulmohar') {
    // flame-red blossom
    const ctx = iso.ctx;
    const cols = ['#a82a22', '#e0402a', '#f58a3a'];
    const paths: number[][] = cols.map(() => []);
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng());
      const x = cx + Math.cos(a) * d * rx * 0.85;
      const y = cy + Math.sin(a) * d * ry * 0.8 - ry * 0.05;
      const up = y < cy + ry * 0.1;
      const p = paths[up ? (rng() < 0.3 ? 2 : 1) : 0];
      p.push(x, y, (1.4 + rng() * 1.6) * iso.px);
    }
    for (let b = 0; b < 3; b++) {
      const d = paths[b];
      ctx.fillStyle = cols[b];
      ctx.beginPath();
      for (let i = 0; i < d.length; i += 3) {
        ctx.moveTo(d[i] + d[i + 2], d[i + 1]);
        ctx.arc(d[i], d[i + 1], d[i + 2], 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  if (kind === 'peepal') {
    // glossy heart leaves: a few bright glints
    const ctx = iso.ctx;
    for (let i = 0; i < 26; i++) {
      const x = cx - rx * 0.7 + rng() * rx * 1.1;
      const y = cy - ry * 0.75 + rng() * ry * 0.8;
      ctx.fillStyle = alpha('#eaf6b0', 0.55);
      ctx.fillRect(x, y, 1.4 * iso.px, 1.4 * iso.px);
    }
  }
}

// ============================================================================
// Ground and garden pieces
// ============================================================================

/** Gravel / murrum path rectangle with grain and crisp edging. */
export function gravelPath(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, base: string = P.gravel, edge = true, density = 1): void {
  const pts = iso.topQuad(u0, v0, u1, v1, z);
  iso.poly(pts, base);
  iso.speckle(pts, rng, Math.round(1400 * density * (u1 - u0) * (v1 - v0)) + 10, [shade(base, -0.12), shade(base, 0.12), shade(base, -0.22), alpha('#fff6de', 0.6)], 1.1);
  if (edge) {
    const e = alpha(shade(base, -0.45), 0.55);
    iso.line([u0, v1, z], [u1, v1, z], e, 0.9);
    iso.line([u1, v0, z], [u1, v1, z], e, 0.9);
    iso.line([u0, v0, z], [u1, v0, z], alpha('#fff6de', 0.5), 0.9);
    iso.line([u0, v0, z], [u0, v1, z], alpha('#fff6de', 0.5), 0.9);
  }
}

/** Low trimmed hedge (box with leafy texture). */
export function hedge(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, h: number, base: string = P.hedge): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.025, 0.35);
  const m = mat(base, { top: 0.2, right: -0.32 });
  iso.box(u0, v0, u1, v1, z, z + h, m);
  iso.speckle(iso.topQuad(u0, v0, u1, v1, z + h), rng, Math.round(3000 * (u1 - u0) * (v1 - v0)) + 8, [shade(base, 0.38), shade(base, -0.2), '#a8cc62'], 1.3);
  iso.speckle(iso.faceVQuad(v1, u0, u1, z, z + h), rng, Math.round(1200 * (u1 - u0) * h) + 6, [shade(base, 0.2), shade(base, -0.3)], 1.2);
  iso.speckle(iso.faceUQuad(u1, v0, v1, z, z + h), rng, Math.round(1200 * (v1 - v0) * h) + 6, [shade(base, -0.1), shade(base, -0.45)], 1.2);
}

/** Raised flower bed with a brick or stone kerb and a mass of blooms. */
export function flowerBed(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, colors: readonly string[] = P.flowers, kerb: string = C.chunarDeep, density = 1): void {
  const h = 0.018;
  iso.aoRect(u0, v0, u1, v1, z, 0.02, 0.3);
  iso.box(u0, v0, u1, v1, z, z + h, mat(kerb), { noTop: true });
  const top = iso.topQuad(u0, v0, u1, v1, z + h);
  iso.poly(top, P.soil);
  iso.poly(iso.topQuad(u0 + 0.008, v0 + 0.008, u1 - 0.008, v1 - 0.008, z + h), shade(P.soil, -0.08));
  // foliage then blooms
  iso.speckle(iso.topQuad(u0 + 0.008, v0 + 0.008, u1 - 0.008, v1 - 0.008, z + h + 0.006), rng, Math.round(5200 * density * (u1 - u0) * (v1 - v0)) + 10, ['#3f6e26', '#55892f', '#2f5a1e'], 2.2 / Math.sqrt(density));
  const { ctx } = iso;
  const n = Math.round(3600 * density * (u1 - u0) * (v1 - v0)) + 6;
  // blooms bucketed by colour: one shadow path and one bloom path per colour
  const buckets: number[][] = colors.map(() => []);
  const rs = 1 / Math.sqrt(Math.min(1, density));
  for (let i = 0; i < n; i++) {
    const [x, y] = iso.pt(u0 + 0.01 + rng() * (u1 - u0 - 0.02), v0 + 0.01 + rng() * (v1 - v0 - 0.02), z + h + 0.01);
    const ci = Math.floor(rng() * colors.length);
    buckets[ci].push(x, y, (1.3 + rng() * 1.1) * iso.px * rs);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let c = 0; c < colors.length; c++) {
      const d = buckets[c];
      if (!d.length) continue;
      const o = pass === 0 ? 0.35 : 0;
      ctx.fillStyle = pass === 0 ? shade(colors[c], -0.35) : colors[c];
      ctx.beginPath();
      for (let i = 0; i < d.length; i += 3) {
        const r = d[i + 2];
        ctx.moveTo(d[i] + r * o + r, d[i + 1] + r * o);
        ctx.arc(d[i] + r * o, d[i + 1] + r * o, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  iso.line([u0, v1, z + h], [u1, v1, z + h], alpha(shade(kerb, 0.4), 0.8), 1.1);
}

/** Terracotta or cement planter with a small shrub or tulsi. */
export function planter(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number, color = '#b86b45', plant: 'shrub' | 'flowers' = 'shrub'): void {
  iso.aoEllipse(u, v, r, z, 0.015, 0.35);
  iso.lathe(u, v, z, [[0, r * 0.7], [r * 1.3, r], [r * 1.45, r * 1.1]], () => color, { top: shade(P.soil, -0.1), outline: true });
  const [x, y] = iso.pt(u, v, z + r * 1.5);
  if (plant === 'shrub') canopy(iso, rng, x, y - r * iso.T * 0.35, r * iso.T * 0.9, r * iso.T * 0.75, TREE_PAL.bush, 5, 0.5);
  else {
    canopy(iso, rng, x, y - r * iso.T * 0.2, r * iso.T * 0.85, r * iso.T * 0.6, TREE_PAL.bush, 4, 0.3);
    for (let i = 0; i < 8; i++) {
      iso.ctx.fillStyle = P.flowers[i % 4];
      iso.ctx.beginPath();
      iso.ctx.arc(x + (rng() - 0.5) * r * iso.T * 1.2, y - r * iso.T * (0.2 + rng() * 0.5), 1.5 * iso.px, 0, Math.PI * 2);
      iso.ctx.fill();
    }
  }
}

/** Sandstone garden bench running along u or v. */
export function bench(iso: Iso, u: number, v: number, z: number, along: 'u' | 'v', stone: string = C.chunar): void {
  const L = 0.1;
  const W = 0.032;
  const [u1, v1] = along === 'u' ? [u + L, v + W] : [u + W, v + L];
  iso.aoRect(u, v, u1, v1, z, 0.02, 0.35);
  const m = mat(stone);
  const leg = 0.012;
  if (along === 'u') {
    iso.box(u + 0.006, v + 0.004, u + 0.006 + leg, v1 - 0.004, z, z + 0.022, mat(shade(stone, -0.1)));
    iso.box(u1 - 0.006 - leg, v + 0.004, u1 - 0.006, v1 - 0.004, z, z + 0.022, mat(shade(stone, -0.1)));
  } else {
    iso.box(u + 0.004, v + 0.006, u1 - 0.004, v + 0.006 + leg, z, z + 0.022, mat(shade(stone, -0.1)));
    iso.box(u + 0.004, v1 - 0.006 - leg, u1 - 0.004, v1 - 0.006, z, z + 0.022, mat(shade(stone, -0.1)));
  }
  iso.boxLit(u, v, u1, v1, z + 0.022, z + 0.03, m);
}

/** Cast-iron lamp post with a lantern. */
export function lampPost(iso: Iso, u: number, v: number, z: number, h = 0.2): void {
  iso.aoEllipse(u, v, 0.012, z, 0.01, 0.3);
  iso.box(u - 0.008, v - 0.008, u + 0.008, v + 0.008, z, z + 0.02, mat('#3a3a3e'));
  iso.line([u, v, z + 0.02], [u, v, z + h], '#2c2c30', 2);
  iso.line([u, v, z + 0.02], [u, v, z + h], alpha('#8a8a90', 0.6), 0.6);
  iso.box(u - 0.012, v - 0.012, u + 0.012, v + 0.012, z + h, z + h + 0.03, { top: '#2c2c30', left: '#fff1b8', right: '#e8c870', line: alpha('#1a1a1c', 0.8) });
  iso.lathe(u, v, z + h + 0.03, [[0, 0.016], [0.012, 0]], () => '#2c2c30', { outline: false });
}

/** Tiny standing / sitting person for scale and life. */
export function person(iso: Iso, rng: Rng, u: number, v: number, z: number, sitting = false, color?: string): void {
  const col = color ?? P.kurta[Math.floor(rng() * P.kurta.length)];
  const H = sitting ? 0.03 : 0.055;
  iso.ellipse(u + 0.008, v, z, 0.012, 'rgba(30,20,12,0.3)');
  iso.lathe(u, v, z, [[0, 0.006], [H * 0.45, 0.008], [H * 0.8, 0.007], [H, 0.004]], () => col, { outline: true, lit: 0.25 });
  iso.lathe(u, v, z + H, [[0, 0.0045], [0.006, 0.006], [0.012, 0.0035], [0.014, 0]], () => '#6b4630', { outline: true });
  iso.ellipse(u - 0.001, v, z + H + 0.012, 0.004, '#231c18');
}

/** Stone fountain jet with spray. */
export function fountainJet(iso: Iso, rng: Rng, u: number, v: number, z: number, h: number): void {
  const { ctx } = iso;
  const [x0, y0] = iso.pt(u, v, z);
  const [, y1] = iso.pt(u, v, z + h);
  ctx.strokeStyle = alpha('#e8f7f7', 0.8);
  ctx.lineWidth = 1.6 * iso.px;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();
  // falling arcs
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const [ex, ey] = iso.pt(u + Math.cos(a) * h * 0.35, v + Math.sin(a) * h * 0.35, z);
    ctx.strokeStyle = alpha('#dff2f2', 0.55);
    ctx.lineWidth = 0.9 * iso.px;
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.quadraticCurveTo((x0 + ex) / 2 + (ex - x0) * 0.3, y1 - 2 * iso.px, ex, ey);
    ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = alpha('#ffffff', 0.5 + rng() * 0.4);
    ctx.fillRect(x0 + (rng() - 0.5) * h * iso.T * 0.6, y1 + rng() * (y0 - y1), 1.2 * iso.px, 1.2 * iso.px);
  }
  iso.ellipse(u, v, z + 0.001, h * 0.3, alpha('#ffffff', 0.35));
}

/**
 * Sunken stone-edged water channel (char-bagh nahr) spanning a rectangle; top surface at z.
 * `edge` is the kerb width.
 */
export function waterChannel(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, edge = 0.018, stone: string = C.chunar): void {
  const m = mat(stone);
  // kerb ring
  iso.box(u0, v0, u1, v1, z - 0.004, z + 0.01, m);
  const d = 0.012;
  const iu0 = u0 + edge;
  const iv0 = v0 + edge;
  const iu1 = u1 - edge;
  const iv1 = v1 - edge;
  // inner back walls (visible: face at u = iu0 facing +u, face at v = iv0 facing +v)
  iso.poly(iso.topQuad(iu0, iv0, iu1, iv1, z + 0.01), shade(stone, -0.35));
  iso.poly(iso.faceUQuad(iu0, iv0, iv1, z + 0.01 - d, z + 0.01), shade(stone, -0.28));
  iso.poly(iso.faceVQuad(iv0, iu0, iu1, z + 0.01 - d, z + 0.01), shade(stone, -0.1));
  const water = iso.topQuad(iu0, iv0, iu1, iv1, z + 0.01 - d * 0.7);
  iso.clipped(iso.topQuad(iu0, iv0, iu1, iv1, z + 0.01), () => waterSurface(iso, rng, water, P.pool, P.poolDeep));
  iso.line([iu0, iv1, z + 0.01], [iu1, iv1, z + 0.01], alpha('#2a1a10', 0.35), 1);
  iso.line([u0, v1, z + 0.01], [u1, v1, z + 0.01], alpha('#fff4dc', 0.6), 1);
}

/** Square stone pool (hauz) with a moulded rim, water and optional fountain. */
export function hauz(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, rimH = 0.03, stone: string = C.chunar, jet = true): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.04, 0.3);
  const m = mat(stone);
  const t = Math.min(u1 - u0, v1 - v0) * 0.1;
  iso.box(u0, v0, u1, v1, z, z + rimH, m);
  const w = iso.topQuad(u0 + t, v0 + t, u1 - t, v1 - t, z + rimH);
  iso.poly(w, shade(stone, -0.3));
  iso.poly(iso.faceUQuad(u0 + t, v0 + t, v1 - t, z + rimH - 0.012, z + rimH), shade(stone, -0.3));
  iso.poly(iso.faceVQuad(v0 + t, u0 + t, u1 - t, z + rimH - 0.012, z + rimH), shade(stone, -0.12));
  iso.clipped(w, () => waterSurface(iso, rng, iso.topQuad(u0 + t, v0 + t, u1 - t, v1 - t, z + rimH - 0.008), P.pool, P.poolDeep));
  // lotus pads
  for (let i = 0; i < 4; i++) {
    const pu = u0 + t + 0.02 + rng() * (u1 - u0 - 2 * t - 0.04);
    const pv = v0 + t + 0.02 + rng() * (v1 - v0 - 2 * t - 0.04);
    iso.ellipse(pu, pv, z + rimH - 0.007, 0.012 + rng() * 0.008, '#4f8a38', alpha('#2f5a22', 0.7), 0.6);
    if (rng() < 0.5) iso.ellipse(pu, pv, z + rimH - 0.002, 0.005, '#f0a8c0');
  }
  iso.line([u0, v1, z + rimH], [u1, v1, z + rimH], alpha('#fff4dc', 0.7), 1.1);
  if (jet) fountainJet(iso, rng, (u0 + u1) / 2, (v0 + v1) / 2, z + rimH - 0.008, Math.min(u1 - u0, v1 - v0) * 0.55);
}

/**
 * Chabutra: raised square platform around a tree trunk, with a small whitewashed shrine niche,
 * a sindoor-smeared stone and sacred threads. Returns the platform top height.
 */
export function chabutra(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number, stone: string = C.chunar): number {
  const h = 0.045;
  iso.aoRect(u - r, v - r, u + r, v + r, z, 0.04, 0.4);
  const m = mat(stone);
  iso.boxLit(u - r, v - r, u + r, v + r, z, z + h * 0.55, m);
  iso.boxLit(u - r * 0.82, v - r * 0.82, u + r * 0.82, v + r * 0.82, z + h * 0.55, z + h, mat(C.whitewash, { right: -0.2 }));
  // ochre band on the upper step
  iso.poly(iso.faceVQuad(v + r * 0.82, u - r * 0.82, u + r * 0.82, z + h * 0.62, z + h * 0.78), alpha('#d98f3a', 0.9));
  iso.poly(iso.faceUQuad(u + r * 0.82, v - r * 0.82, v + r * 0.82, z + h * 0.62, z + h * 0.78), alpha(shade('#d98f3a', -0.2), 0.9));
  const zt = z + h;
  // tiny shrine niche at the back-left
  const su = u - r * 0.7;
  const sv = v + r * 0.1;
  iso.box(su, sv, su + 0.05, sv + 0.06, zt, zt + 0.05, mat(C.whitewash, { right: -0.2 }));
  iso.poly(iso.faceUQuad(su + 0.05, sv + 0.015, sv + 0.045, zt, zt + 0.035), '#3a2a22');
  iso.squareLathe(su + 0.025, sv + 0.03, zt + 0.05, [[0, 0.032], [0.025, 0.02], [0.04, 0]], (t) => (t < 0.4 ? C.whitewash : shade(C.whitewash, -0.05)));
  iso.lathe(su + 0.025, sv + 0.03, zt + 0.09, [[0, 0.004], [0.012, 0]], () => C.brass, { outline: false });
  // sindoor stone + diyas + marigold at the front
  iso.lathe(u + r * 0.45, v + r * 0.5, zt, [[0, 0.012], [0.012, 0.01], [0.02, 0]], () => '#e0501e', { outline: true, lit: 0.35 });
  const { ctx } = iso;
  for (let i = 0; i < 9; i++) {
    const [x, y] = iso.pt(u + r * (0.1 + rng() * 0.6), v + r * (0.55 + rng() * 0.3), zt);
    ctx.fillStyle = i % 3 === 0 ? '#e0761a' : C.marigold;
    ctx.beginPath();
    ctx.arc(x, y - rng() * 2 * iso.px, 1.5 * iso.px, 0, Math.PI * 2);
    ctx.fill();
  }
  void rng;
  return zt;
}

/** Red and yellow sacred threads wound round a trunk (drawn over the trunk). */
export function kalava(iso: Iso, u: number, v: number, z: number, r: number): void {
  for (let i = 0; i < 4; i++) {
    const zz = z + 0.03 + i * 0.008;
    const [x, y] = iso.pt(u, v, zz);
    const [rx, ry] = iso.ellipseRadii(r * 1.05);
    iso.ctx.strokeStyle = i % 2 ? '#f2c14e' : '#d9433a';
    iso.ctx.lineWidth = 1.2 * iso.px;
    iso.ctx.beginPath();
    iso.ctx.ellipse(x, y, rx, ry, 0, 0.05, Math.PI - 0.05);
    iso.ctx.stroke();
  }
}

// ============================================================================
// Animals
// ============================================================================

/** A cow (white/grey Indian breed with a hump) facing +u or +v. */
export function cow(iso: Iso, u: number, v: number, z: number, dir: 'u' | 'v', coat = '#ece6da', sitting = false, s = 1.35): void {
  const L = 0.085;
  const W = 0.032;
  const H = sitting ? 0.0 : 0.032;
  const B = 0.036; // body depth
  const P3u = (a: number, b: number, h: number): P3 => (dir === 'u' ? [u + a * s, v + b * s, z + h * s] : [u + b * s, v + a * s, z + h * s]);
  const bx = (a0: number, a1: number, b0: number, b1: number, h0: number, h1: number, col: string) => {
    const p0 = P3u(a0, b0, h0);
    const p1 = P3u(a1, b1, h1);
    iso.box(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), p0[2], p1[2], mat(col, { right: -0.3, top: 0.12 }));
  };
  const s0 = P3u(-L / 2, -W / 2, 0);
  const s1 = P3u(L / 2, W / 2, 0);
  iso.ellipse((s0[0] + s1[0]) / 2 + 0.02, (s0[1] + s1[1]) / 2, z, 0.055 * s, 'rgba(30,20,12,0.22)');
  if (!sitting) {
    const legs: [number, number][] = [[-L / 2 + 0.008, -W / 2 + 0.006], [-L / 2 + 0.008, W / 2 - 0.006], [L / 2 - 0.012, -W / 2 + 0.006], [L / 2 - 0.012, W / 2 - 0.006]];
    for (const [a, b] of legs) iso.line(P3u(a, b, 0), P3u(a, b, H), shade(coat, -0.45), 2.4);
  }
  bx(-L / 2, L / 2, -W / 2, W / 2, H, H + B, coat);
  // hump + head + ears + horns
  bx(L / 2 - 0.028, L / 2 - 0.012, -W / 2 + 0.004, W / 2 - 0.004, H + B, H + B + 0.012, shade(coat, -0.05));
  bx(L / 2 - 0.004, L / 2 + 0.024, -0.011, 0.011, H + B * 0.55, H + B + 0.008, shade(coat, -0.03));
  bx(L / 2 + 0.018, L / 2 + 0.03, -0.008, 0.008, H + B * 0.5, H + B * 0.78, '#3a2e2a');
  iso.line(P3u(L / 2 + 0.006, -0.008, H + B + 0.008), P3u(L / 2 + 0.0, -0.014, H + B + 0.024), '#3a3028', 1.4);
  iso.line(P3u(L / 2 + 0.006, 0.008, H + B + 0.008), P3u(L / 2 + 0.0, 0.014, H + B + 0.024), '#3a3028', 1.4);
  // tail
  iso.line(P3u(-L / 2, 0, H + B * 0.9), P3u(-L / 2 - 0.006, 0.004, H + B * 0.2), shade(coat, -0.4), 1);
  // saffron neck cloth
  const c0 = P3u(L / 2 - 0.006, W / 2 + 0.001, H + B * 0.35);
  const c1 = P3u(L / 2 + 0.002, W / 2 + 0.001, H + B * 0.9);
  iso.line(c0, c1, C.saffron, 1.6);
}

// ============================================================================
// Water craft
// ============================================================================

/**
 * Wooden Ganga rowing boat. (u, v) is the centre, `len` along `dir`, floating at water level z.
 * The +b side (towards +v for dir 'u', +u for dir 'v') is the visible outer hull.
 */
export function rowBoat(iso: Iso, rng: Rng, u: number, v: number, z: number, len: number, dir: 'u' | 'v', band: string, opts: { canopy?: boolean; oars?: boolean } = {}): void {
  const W = len * 0.32;
  const G = len * 0.14; // gunwale height above water
  const f = (a: number, b: number, h: number): P3 => (dir === 'u' ? [u + a, v + b, z + h] : [u + b, v + a, z + h]);
  const n = 10;
  const side = (b: number, hFn: (t: number) => number, wf = 1): P3[] => {
    const out: P3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = -len / 2 + t * len;
      const w = (W / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) * wf;
      out.push(f(a, b * w, hFn(t)));
    }
    return out;
  };
  const sheer = (t: number) => G + Math.pow(Math.abs(t - 0.5) * 2, 3) * G * 0.9; // raised bow and stern
  // shadow / dark water under the hull + wake
  const c = f(0, 0, 0);
  iso.ellipse(c[0] + 0.01, c[1] + 0.005, z, len * 0.42, 'rgba(20,40,50,0.28)');
  const topP = side(1, sheer);
  const topN = side(-1, sheer);
  const keelP = side(1, () => -0.004, 0.62);
  // outer visible hull (+b side)
  const hull: P3[] = [...topP, ...keelP.slice().reverse()];
  iso.poly(hull, '#6e4a2c', alpha('#2a1a10', 0.8), 1.1);
  iso.clipped(hull, () => {
    // painted band under the gunwale + plank lines
    const bandTop = side(1, (t) => sheer(t) - 0.001);
    const bandBot = side(1, (t) => sheer(t) - G * 0.38, 0.93);
    iso.poly([...bandTop, ...bandBot.slice().reverse()], band);
    for (let k = 1; k < 3; k++) iso.polyline(side(1, (t) => sheer(t) * (1 - k * 0.3), 0.9 + k * 0.02), alpha('#2a1a10', 0.35), 0.7);
    iso.polyline(side(1, () => 0.002, 0.64), alpha('#1a2a30', 0.6), 2);
  });
  // interior (seen from above)
  const inner: P3[] = [...topP, ...topN.slice().reverse()];
  iso.poly(inner, '#4e321d', alpha('#2a1a10', 0.8), 1);
  const floor = [...side(1, () => G * 0.35, 0.72), ...side(-1, () => G * 0.35, 0.72).reverse()];
  iso.poly(floor, '#8a6340');
  iso.clipped(floor, () => {
    for (let k = -2; k <= 2; k++) iso.line(f(-len / 2, (k * W) / 10, G * 0.35), f(len / 2, (k * W) / 10, G * 0.35), alpha('#4e321d', 0.5), 0.6);
  });
  // thwarts (seats)
  for (const a of [-0.22, 0.05, 0.28]) {
    const t = 0.5 + a;
    const w = (W / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) * 0.94;
    const aa = -len / 2 + t * len;
    iso.box(Math.min(f(aa - len * 0.03, -w, 0)[0], f(aa + len * 0.03, w, 0)[0]), Math.min(f(aa - len * 0.03, -w, 0)[1], f(aa + len * 0.03, w, 0)[1]), Math.max(f(aa - len * 0.03, -w, 0)[0], f(aa + len * 0.03, w, 0)[0]), Math.max(f(aa - len * 0.03, -w, 0)[1], f(aa + len * 0.03, w, 0)[1]), z + G * 0.7, z + G * 0.82, mat('#a07a4e'), { edges: false });
  }
  // gunwale rim highlight
  iso.polyline(topP, alpha('#e8c890', 0.9), 1.3);
  iso.polyline(topN, alpha('#3a2616', 0.8), 1.1);
  if (opts.oars) {
    const a0 = f(-len * 0.05, W * 0.3, G);
    const a1 = f(len * 0.2, W * 1.6, -0.002);
    iso.line(a0, a1, '#c9a26a', 1.6);
    iso.line(f(len * 0.12, W * 1.1, 0.004), a1, '#b08650', 3);
  }
  if (opts.canopy) {
    // shamiyana canopy on bamboo poles over the middle
    const h = len * 0.34;
    const a0 = -len * 0.18;
    const a1 = len * 0.22;
    const b = W * 0.42;
    for (const [aa, bb] of [[a0, b], [a1, b], [a1, -b]] as [number, number][]) iso.line(f(aa, bb, G), f(aa, bb, G + h), '#6b4a2a', 1.3);
    const col = rng() < 0.5 ? '#e8dcc2' : '#e46a3a';
    iso.poly([f(a0, -b - 0.004, G + h), f(a1, -b - 0.004, G + h), f(a1, b + 0.004, G + h), f(a0, b + 0.004, G + h)], col, alpha(shade(col, -0.5), 0.7), 1);
    iso.poly([f(a0, b + 0.004, G + h), f(a1, b + 0.004, G + h), f(a1, b + 0.004, G + h - 0.012), f(a0, b + 0.004, G + h - 0.012)], shade(col, -0.2));
    for (let i = 0; i < 6; i++) {
      const aa = a0 + ((i + 0.5) / 6) * (a1 - a0);
      iso.line(f(aa, b + 0.004, G + h - 0.012), f(aa + 0.004, b + 0.004, G + h - 0.02), alpha(C.marigold, 0.9), 1.2);
    }
  }
  // ripples
  for (let i = 0; i < 3; i++) {
    const t = 0.15 + i * 0.35;
    const a = -len / 2 + t * len;
    const p0 = f(a, W * 0.55, 0);
    const p1 = f(a + len * 0.14, W * 0.62, 0);
    iso.line(p0, p1, alpha('#e2f4f2', 0.55), 1);
  }
}

/** Wooden plank deck on posts over water: rectangle at height z (posts go down to z = -0.03). */
export function plankDeck(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, along: 'u' | 'v', wood = '#9a7048'): void {
  const th = 0.014;
  // posts (behind first, only the visible front rows matter)
  const posts: [number, number][] = [];
  const stepA = 0.16;
  if (along === 'u') for (let a = u0 + 0.02; a < u1; a += stepA) posts.push([a, v0 + 0.01], [a, v1 - 0.01]);
  else for (let a = v0 + 0.02; a < v1; a += stepA) posts.push([u0 + 0.01, a], [u1 - 0.01, a]);
  for (const [pu, pv] of posts) {
    iso.ellipse(pu + 0.004, pv, -0.002, 0.016, alpha('#16323a', 0.35));
    iso.box(pu - 0.007, pv - 0.007, pu + 0.007, pv + 0.007, -0.03, z, mat('#5a3e26'), { noTop: true });
    iso.ellipse(pu, pv, 0, 0.018, null, alpha('#e2f4f2', 0.55), 0.8);
  }
  iso.box(u0, v0, u1, v1, z - th, z, mat(wood, { top: 0.12, right: -0.35 }), { noTop: true });
  const top = iso.topQuad(u0, v0, u1, v1, z);
  iso.poly(top, shade(wood, 0.12));
  iso.clipped(top, () => {
    const dp = 0.026;
    if (along === 'u') {
      for (let v = v0 + dp; v < v1; v += dp) iso.line([u0, v, z], [u1, v, z], alpha('#3a2616', 0.4), 0.7);
      for (let v = v0; v < v1; v += dp) {
        const off = rng() * 0.2;
        for (let u = u0 + off; u < u1; u += 0.22) iso.line([u, v, z], [u, v + dp, z], alpha('#3a2616', 0.35), 0.6);
        iso.poly(iso.topQuad(u0, v, u1, v + dp, z), alpha(shade(wood, (rng() - 0.5) * 0.3), 0.35));
      }
    } else {
      for (let u = u0 + dp; u < u1; u += dp) iso.line([u, v0, z], [u, v1, z], alpha('#3a2616', 0.4), 0.7);
      for (let u = u0; u < u1; u += dp) {
        const off = rng() * 0.2;
        for (let v = v0 + off; v < v1; v += 0.22) iso.line([u, v, z], [u + dp, v, z], alpha('#3a2616', 0.35), 0.6);
        iso.poly(iso.topQuad(u, v0, u + dp, v1, z), alpha(shade(wood, (rng() - 0.5) * 0.3), 0.35));
      }
    }
  });
  iso.line([u0, v1, z], [u1, v1, z], alpha('#f3dcae', 0.7), 1);
  iso.line([u1, v0, z], [u1, v1, z], alpha('#f3dcae', 0.4), 0.8);
}

/** Short mooring bollard. */
export function bollard(iso: Iso, u: number, v: number, z: number): void {
  iso.lathe(u, v, z, [[0, 0.01], [0.016, 0.008], [0.022, 0.012], [0.026, 0]], () => '#3a3a3e', { outline: true, lit: 0.3 });
}

/** A rope from a point on land to a boat. */
export function rope(iso: Iso, a: P3, b: P3): void {
  const m: P3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.min(a[2], b[2]) - 0.01];
  iso.polyline([a, m, b], alpha('#d8c49a', 0.9), 0.8);
}
