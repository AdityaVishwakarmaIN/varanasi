/**
 * Indian-style procedural art: special buildings (hero assets).
 *   stadium        – Cricket Stadium: oval ground, tiered stands, pavilion, floodlight towers
 *   museum         – Indo-Saracenic museum (Bharat Kala Bhavan feel): sandstone, domes, lawn
 *   airport        – Lal Bahadur Shastri style terminal, apron with an airliner, ATC tower
 *   space_program  – ISRO-style campus: launch pad with rocket, big dish antenna, white labs
 *   amusement_park – Mela ground: giant wheel, carousel, shamianas, food stalls, lights
 * See ./index.ts for the drawing contract.
 */
import { alpha, mat, mix, seededRng, shade, type Iso, type P3 } from '../isoPainter';
import {
  C,
  OUTLINE,
  chhatri,
  dome,
  flag,
  grime,
  lawn,
  makeIso,
  paving,
  slab,
  weatherU,
  weatherV,
  windowU,
  windowV,
  type ProceduralSpriteDef,
} from '../varanasiSprites';
import {
  CLOTHES,
  DepthList,
  bunting,
  car,
  crowd,
  disc,
  floodlight,
  palm,
  person,
  pole,
  ringPts,
  shamiana,
  stall,
  stripedCone,
  tubeU,
  type Rng,
} from './specialKit';

type Ctx = Parameters<typeof makeIso>[0];

// ============================================================================
// CRICKET STADIUM (3×3)
// ============================================================================

const STADIUM_SCHEMES = [
  { seats: ['#2f6fb3', '#f0b429', '#2f6fb3', '#d8452f', '#1f9e9a', '#f0b429'], wall: '#e9dcc2', roof: '#f4f1ea', pav: '#f1ebdd', pavRoof: '#a8452f' },
  { seats: ['#d8452f', '#f4f0e6', '#3aa66a', '#f08a24', '#2f7fbf', '#e86aa6'], wall: '#d9c7a4', roof: '#e8eef2', pav: '#e3cfa6', pavRoof: '#3f7f5a' },
] as const;

function drawStadium(ctx: Ctx, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('stadium', variant);
  const sc = STADIUM_SCHEMES[variant % STADIUM_SCHEMES.length];
  const z0 = 0.03;
  slab(iso, rng, 0.03, z0, '#c2b497', '#8a7a5e', []);
  paving(iso, rng, 0.03, 0.03, 2.97, 2.97, z0, 0.25, 0.25, alpha('#8a7a5e', 0.28));
  iso.speckle(iso.topQuad(0.03, 0.03, 2.97, 2.97, z0), rng, 1800, ['#b2a486', '#cfc2a6', alpha('#8a7a5e', 0.5)], 1.3);
  const cu = 1.5;
  const cv = 1.5;
  const R0 = 0.92;
  const K = 6;
  const dr = 0.083;
  const dz = 0.034;
  const zBoard = z0 + 0.035;
  const Rout = R0 + K * dr;
  const zTier = (k: number) => zBoard + k * dz;
  const zTop = zTier(K - 1);
  const P = (a: number, r: number, z: number): P3 => [cu + Math.cos(a) * r, cv + Math.sin(a) * r, z];

  // ── the ground ──
  const field = ringPts([cu, cv, z0], [R0, 0, 0], [0, R0, 0], 48);
  iso.poly(field, '#5f9a3a');
  iso.clipped(field, () => {
    for (let i = 0; i < 16; i++) {
      const a = cu - R0 + (i * 2 * R0) / 16;
      if (i % 2) iso.poly(iso.topQuad(a, cv - R0, a + (2 * R0) / 16, cv + R0, z0), alpha('#8cc158', 0.35));
    }
    // outfield darkening towards the rope + soft wear near the pitch
    for (let k = 0; k < 4; k++) iso.ellipse(cu, cv, z0, R0 - k * 0.02, null, alpha('#2f5a20', 0.1), 6);
  });
  iso.speckle(field, rng, 1400, [alpha('#8cc158', 0.5), alpha('#3f6e2a', 0.4)], 1.1);
  // inner circle (dashed) and boundary rope
  const ic = ringPts([cu, cv, z0], [0.46, 0, 0], [0, 0.46, 0], 40);
  for (let i = 0; i < 40; i += 2) iso.line(ic[i], ic[i + 1], alpha('#ffffff', 0.7), 0.9);
  iso.polyline(ringPts([cu, cv, z0], [R0 - 0.06, 0, 0], [0, R0 - 0.06, 0], 48), alpha('#f4f0e6', 0.85), 1.4);
  // pitch + creases + stumps
  iso.poly(iso.topQuad(cu - 0.04, cv - 0.17, cu + 0.04, cv + 0.17, z0 + 0.001), '#d9c38c', alpha('#8a7448', 0.5), 0.8);
  iso.poly(iso.topQuad(cu - 0.02, cv - 0.15, cu + 0.02, cv + 0.15, z0 + 0.0015), alpha('#c4a868', 0.5));
  for (const s of [-1, 1]) {
    iso.line([cu - 0.04, cv + s * 0.125, z0 + 0.002], [cu + 0.04, cv + s * 0.125, z0 + 0.002], '#ffffff', 0.9);
    iso.line([cu - 0.025, cv + s * 0.145, z0 + 0.002], [cu + 0.025, cv + s * 0.145, z0 + 0.002], '#ffffff', 0.9);
    iso.line([cu, cv + s * 0.145, z0], [cu, cv + s * 0.145, z0 + 0.025], '#f4e6c0', 1.4);
  }
  // players: fielders in whites, two batters, bowler, umpire
  const fielders: [number, number][] = [[0.55, -0.1], [-0.5, 0.3], [0.3, 0.55], [-0.2, -0.6], [0.66, 0.4], [-0.66, -0.2], [0.1, 0.75], [0.35, -0.5], [-0.45, 0.62], [0.08, 0.3]];
  const pl: [number, number, string][] = fielders.map(([a, b]) => [cu + a, cv + b, '#f4f1e8']);
  pl.push([cu + 0.012, cv - 0.13, '#2f6fb3'], [cu - 0.012, cv + 0.13, '#2f6fb3'], [cu + 0.02, cv - 0.22, '#1e1e24'], [cu, cv + 0.2, '#f4f1e8']);
  pl.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
  for (const [u, v, c] of pl) person(iso, u, v, z0, c, rng, 0.045);

  // ── stands, pavilion and props in painter's order ──
  const segs = 48;
  const gap0 = (200 / 180) * Math.PI;
  const gap1 = (250 / 180) * Math.PI;
  const back = new DepthList();
  const front = new DepthList();
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    if (am > gap0 && am < gap1) continue;
    const d = Math.cos(am) + Math.sin(am);
    const seat = sc.seats[Math.floor(i / 4) % sc.seats.length];
    const light = Math.sin(am) * 0.1 - Math.cos(am) * 0.16;
    const tread = (k: number) => {
      const z = zTier(k);
      const q: P3[] = [P(a0, R0 + k * dr, z), P(a1, R0 + k * dr, z), P(a1, R0 + (k + 1) * dr, z), P(a0, R0 + (k + 1) * dr, z)];
      iso.poly(q, shade(seat, (k % 2 ? -0.06 : 0.04) + light * 0.4));
      // concrete walkway strip at the back of each tread
      iso.poly([P(a0, R0 + (k + 0.78) * dr, z), P(a1, R0 + (k + 0.78) * dr, z), P(a1, R0 + (k + 1) * dr, z), P(a0, R0 + (k + 1) * dr, z)], alpha('#d8d0c0', 0.8));
      // spectators
      const { ctx: c } = iso;
      const n = 3 + Math.floor(rng() * 3);
      for (let j = 0; j < n; j++) {
        if (rng() < 0.25) continue;
        const aa = a0 + rng() * (a1 - a0);
        const [x, y] = iso.pt(...P(aa, R0 + (k + 0.45) * dr, z));
        c.fillStyle = CLOTHES[Math.floor(rng() * CLOTHES.length)];
        c.fillRect(x - 1.1 * iso.px, y - 3.2 * iso.px, 2.2 * iso.px, 2.6 * iso.px);
        c.fillStyle = '#3a2618';
        c.fillRect(x - 0.8 * iso.px, y - 4.4 * iso.px, 1.6 * iso.px, 1.4 * iso.px);
      }
    };
    const riser = (k: number) => {
      const zb = k === 0 ? z0 : zTier(k - 1);
      const zt = zTier(k);
      const r = R0 + k * dr;
      const q: P3[] = [P(a0, r, zb), P(a1, r, zb), P(a1, r, zt), P(a0, r, zt)];
      if (k === 0) {
        // advertising boards around the rope
        const ad = ['#d8452f', '#f4f0e6', '#2f6fb3', '#f0b429', '#3aa66a', '#1e1e24'][i % 6];
        iso.poly(q, shade(ad, d < 0 ? 0.02 : -0.3));
        if (d < 0) iso.poly([P(a0 + 0.02, r - 0.001, zb + 0.012), P(a1 - 0.02, r - 0.001, zb + 0.012), P(a1 - 0.02, r - 0.001, zb + 0.022), P(a0 + 0.02, r - 0.001, zb + 0.022)], alpha(ad === '#f4f0e6' ? '#2a2a2e' : '#ffffff', 0.7));
      } else iso.poly(q, shade('#b8b0a0', d < 0 ? -0.05 + light * 0.3 : -0.35));
    };
    if (d < 0) {
      back.add(d, () => {
        for (let k = K - 1; k >= 0; k--) {
          tread(k);
          riser(k);
        }
      });
    } else {
      front.add(d, () => {
        for (let k = 0; k < K; k++) {
          riser(k);
          tread(k);
        }
        // outer wall with concourse openings
        const q: P3[] = [P(a0, Rout, z0), P(a1, Rout, z0), P(a1, Rout, zTop), P(a0, Rout, zTop)];
        iso.poly(q, shade(sc.wall, light), alpha('#3a2616', 0.25), 0.6);
        if (i % 2 === 0) {
          const m0 = a0 + (a1 - a0) * 0.25;
          const m1 = a0 + (a1 - a0) * 0.75;
          iso.poly([P(m0, Rout + 0.001, z0 + 0.06), P(m1, Rout + 0.001, z0 + 0.06), P(m1, Rout + 0.001, z0 + 0.14), P(m0, Rout + 0.001, z0 + 0.14)], '#3d4452');
        } else iso.poly([P(a0 + 0.03, Rout + 0.001, z0), P(a1 - 0.03, Rout + 0.001, z0), P(a1 - 0.03, Rout + 0.001, z0 + 0.05), P(a0 + 0.03, Rout + 0.001, z0 + 0.05)], '#4a3a30');
        iso.poly([P(a0, Rout + 0.002, zTop - 0.015), P(a1, Rout + 0.002, zTop - 0.015), P(a1, Rout + 0.002, zTop), P(a0, Rout + 0.002, zTop)], shade(sc.seats[0], light - 0.1));
        iso.poly([P(a0, Rout + 0.002, z0), P(a1, Rout + 0.002, z0), P(a1, Rout + 0.002, z0 + 0.018), P(a0, Rout + 0.002, z0 + 0.018)], alpha('#2a1a10', 0.25));
      });
    }
  }
  // ground shadow of the outer ring
  iso.ellipse(cu + 0.08, cv - 0.02, z0, Rout + 0.03, alpha('#2a1a10', 0.12));
  // back corner floodlight (behind everything)
  floodlight(iso, 0.24, 0.24, z0, 1.0, cu, cv);
  back.draw();
  // cantilever roof over the back stands
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    if (Math.cos(am) + Math.sin(am) > -0.75 || (am > gap0 && am < gap1)) continue;
    const zr = zTop + 0.16;
    iso.line(P(am, Rout - 0.01, zTop), P(am, Rout - 0.01, zr), '#8a8f96', 1.4);
    const rIn = R0 + dr * 2.3;
    iso.poly([P(a0, Rout, zr), P(a1, Rout, zr), P(a1, rIn, zr - 0.03), P(a0, rIn, zr - 0.03)], shade(sc.roof, -0.06 + (i % 2) * 0.05), alpha('#6a7078', 0.4), 0.6);
    iso.poly([P(a0, rIn, zr - 0.03), P(a1, rIn, zr - 0.03), P(a1, rIn, zr - 0.042), P(a0, rIn, zr - 0.042)], shade(sc.roof, -0.3));
  }
  // pavilion (back corner, facing the pitch)
  pavilion(iso, rng, 0.4, 0.4, 0.88, z0, sc.pav, sc.pavRoof);
  // sightscreen behind the bowler's arm (back end of the pitch)
  iso.box(cu - 0.13, cv - R0 - 0.05, cu + 0.13, cv - R0 - 0.02, zBoard, zBoard + 0.13, mat('#f7f5ee', { left: 0.05 }));
  // big scoreboard on the back-right stand
  const sbU = 2.02;
  iso.line([sbU + 0.05, 0.25, zTop], [sbU + 0.05, 0.25, zTop + 0.1], '#5a6068', 2);
  iso.line([sbU + 0.33, 0.25, zTop], [sbU + 0.33, 0.25, zTop + 0.1], '#5a6068', 2);
  iso.box(sbU, 0.22, sbU + 0.38, 0.26, zTop + 0.1, zTop + 0.3, mat('#2e3238'));
  iso.poly(iso.faceVQuad(0.261, sbU + 0.02, sbU + 0.36, zTop + 0.115, zTop + 0.285), '#141c26');
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const col = r === 0 ? '#f0b429' : c === 0 ? '#9fd4ff' : '#e8f0f4';
      const a = sbU + 0.035 + c * 0.11;
      iso.poly(iso.faceVQuad(0.262, a, a + (c === 0 ? 0.09 : 0.06), zTop + 0.24 - r * 0.04, zTop + 0.26 - r * 0.04), alpha(col, 0.85));
    }
  }
  // side floodlights (drawn with the stands they stand behind), then front stands, then front light
  front.add(0.0, () => floodlight(iso, 2.76, 0.24, z0, 0.95, cu, cv));
  front.add(0.01, () => floodlight(iso, 0.24, 2.76, z0, 0.95, cu, cv));
  front.draw();
  // concourse life at the front corner: trees, tea stall, fans
  iso.tree(2.3, 2.85, z0, 0.1, rng, 'neem');
  iso.tree(2.85, 2.25, z0, 0.1, rng, 'neem');
  crowd(iso, rng, 2.4, 2.4, 2.85, 2.85, z0, 16, 0.045);
  iso.tree(0.12, 2.2, z0, 0.08, rng, 'ashoka');
  iso.tree(2.2, 0.12, z0, 0.08, rng, 'ashoka');
}

/** Colonial cricket pavilion: galleried storeys facing the ground, pitched roof, cupola and flags. */
function pavilion(iso: Iso, rng: Rng, u0: number, v0: number, s: number, z: number, wall: string, roof: string): void {
  const u1 = u0 + s * 0.5;
  const v1 = v0 + s * 0.5;
  const H = 0.36;
  iso.aoRect(u0, v0, u1, v1, z, 0.06, 0.4);
  iso.box(u0, v0, u1, v1, z, z + H, mat(wall));
  const storeys = 3;
  const sh = H / storeys;
  for (let st = 0; st < storeys; st++) {
    const zs = z + st * sh;
    // galleries: dark recess with white columns and a railing
    iso.poly(iso.faceVQuad(v1, u0 + 0.02, u1 - 0.02, zs + 0.012, zs + sh - 0.012), st === 0 ? '#4a3a32' : '#3d4452');
    iso.poly(iso.faceUQuad(u1, v0 + 0.02, v1 - 0.02, zs + 0.012, zs + sh - 0.012), st === 0 ? '#3a2c26' : '#303644');
    for (let a = u0 + 0.02; a <= u1 - 0.02 + 1e-6; a += (u1 - u0 - 0.04) / 5) iso.line([a, v1 + 0.002, zs + 0.01], [a, v1 + 0.002, zs + sh - 0.01], shade(wall, 0.2), 1.6);
    for (let a = v0 + 0.02; a <= v1 - 0.02 + 1e-6; a += (v1 - v0 - 0.04) / 5) iso.line([u1 + 0.002, a, zs + 0.01], [u1 + 0.002, a, zs + sh - 0.01], shade(wall, -0.12), 1.6);
    if (st > 0) {
      // people in the gallery + balcony rail
      for (let j = 0; j < 5; j++) {
        const [x, y] = iso.pt(u0 + 0.05 + j * 0.04, v1, zs + 0.03);
        iso.ctx.fillStyle = CLOTHES[(j * 3 + st) % CLOTHES.length];
        iso.ctx.fillRect(x - iso.px, y - 3 * iso.px, 2.2 * iso.px, 3 * iso.px);
      }
      iso.box(u0, v1, u1 + 0.02, v1 + 0.02, zs, zs + 0.006, mat(wall));
      iso.box(u1, v0, u1 + 0.02, v1, zs, zs + 0.006, mat(wall));
      iso.line([u0, v1 + 0.02, zs + 0.03], [u1 + 0.02, v1 + 0.02, zs + 0.03], shade(wall, 0.25), 1);
      iso.line([u1 + 0.02, v0, zs + 0.03], [u1 + 0.02, v1 + 0.02, zs + 0.03], shade(wall, 0.05), 1);
    }
  }
  grime(iso, u0, v0, u1, v1, z, 0.04, 0.2);
  // hipped roof
  const zr = z + H;
  const o = 0.03;
  const ap: P3[] = [
    [u0 + 0.12, v0 + 0.12, zr + 0.12],
    [u1 - 0.12, v1 - 0.12, zr + 0.12],
  ];
  const A: P3 = [u0 - o, v0 - o, zr];
  const B: P3 = [u1 + o, v0 - o, zr];
  const Cc: P3 = [u1 + o, v1 + o, zr];
  const D: P3 = [u0 - o, v1 + o, zr];
  iso.poly([B, Cc, ap[1], ap[0]], shade(roof, -0.25), OUTLINE, 0.8);
  iso.poly([Cc, D, ap[0], ap[1]], shade(roof, 0.05), OUTLINE, 0.8);
  iso.clipped([Cc, D, ap[0], ap[1]], () => {
    for (let a = u0; a < u1 + o; a += 0.025) iso.line([a, v1 + o, zr], [a, v0, zr + 0.2], alpha('#2a1a10', 0.18), 0.7);
  });
  iso.box(u0 + 0.16, v0 + 0.16, u1 - 0.16, v1 - 0.16, zr + 0.08, zr + 0.14, mat('#f4f0e6'));
  dome(iso, (u0 + u1) / 2, (v0 + v1) / 2, zr + 0.14, 0.07, '#f4f0e6', 'onion', C.brass);
  flag(iso, u0 + 0.05, v1 - 0.02, zr + 0.02, 0.28, '#f39b1d');
  flag(iso, u1 - 0.02, v0 + 0.05, zr + 0.02, 0.28, '#2f7fbf');
  void rng;
}

// ============================================================================
// MUSEUM (3×3)
// ============================================================================

/** Arcaded sandstone wing with chhajja and crenellated parapet. */
function sandWing(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, H: number, body: string, trim: string, storeys: number): void {
  iso.aoRect(u0, v0, u1, v1, z, 0.1, 0.45);
  iso.castShadow([
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ], z, H, 0.15);
  iso.box(u0, v0, u1, v1, z, z + H, mat(body));
  const plinth = 0.05;
  iso.box(u0 - 0.015, v0, u1 + 0.015, v1 + 0.015, z, z + plinth, mat(shade(body, -0.12)));
  const sh = (H - plinth) / storeys;
  for (let s = 0; s < storeys; s++) {
    const zs = z + plinth + s * sh;
    const nV = Math.max(2, Math.round((u1 - u0) / 0.12));
    for (let i = 0; i < nV; i++) {
      const a = u0 + ((i + 0.22) / nV) * (u1 - u0);
      const b = u0 + ((i + 0.78) / nV) * (u1 - u0);
      iso.archV(v1, a - 0.007, b + 0.007, zs + 0.015, zs + sh - 0.02, trim, true);
      iso.archV(v1, a, b, zs + 0.02, zs + sh - 0.03, s === 0 ? '#4a3430' : '#3e3a44', true);
    }
    const nU = Math.max(2, Math.round((v1 - v0) / 0.12));
    for (let i = 0; i < nU; i++) {
      const a = v0 + ((i + 0.22) / nU) * (v1 - v0);
      const b = v0 + ((i + 0.78) / nU) * (v1 - v0);
      iso.archU(u1, a - 0.007, b + 0.007, zs + 0.015, zs + sh - 0.02, shade(trim, -0.22), true);
      iso.archU(u1, a, b, zs + 0.02, zs + sh - 0.03, s === 0 ? '#3e2c28' : '#35313a', true);
    }
    // chhajja (sunshade ledge) over each storey
    const zc = zs + sh - 0.012;
    iso.box(u0 - 0.01, v1, u1 + 0.025, v1 + 0.025, zc - 0.006, zc, mat(trim), { edges: false });
    iso.box(u1, v0 - 0.01, u1 + 0.025, v1, zc - 0.006, zc, mat(trim), { edges: false });
    iso.line([u0 - 0.01, v1 + 0.025, zc - 0.006], [u1 + 0.025, v1 + 0.025, zc - 0.006], alpha('#2a1a10', 0.4), 1);
  }
  weatherV(iso, rng, v1, u0, u1, z, z + H, 14, 0.07);
  weatherU(iso, rng, u1, v0, v1, z, z + H, 12, 0.09);
  const zt = z + H;
  iso.box(u0 - 0.02, v0 - 0.02, u1 + 0.02, v1 + 0.02, zt, zt + 0.02, mat(trim));
  iso.poly(iso.topQuad(u0, v0, u1, v1, zt + 0.02), shade(body, 0.12));
  const merl = mat(trim);
  for (let u = u0; u < u1 - 0.02; u += 0.05) iso.box(u, v1 - 0.02, u + 0.025, v1, zt + 0.02, zt + 0.045, merl, { edges: false });
  for (let v = v0; v < v1 - 0.02; v += 0.05) iso.box(u1 - 0.02, v, u1, v + 0.025, zt + 0.02, zt + 0.045, merl, { edges: false });
}

/** Tall slender minaret/turret with a small onion dome. */
function turret(iso: Iso, u: number, v: number, z: number, H: number, r: number, stone: string, domeCol: string): void {
  iso.lathe(u, v, z, [
    [0, r * 1.25],
    [0.04, r * 1.25],
    [0.05, r],
    [H * 0.55, r * 0.92],
    [H * 0.56, r * 1.35],
    [H * 0.58, r * 1.35],
    [H * 0.59, r * 0.85],
    [H, r * 0.8],
    [H + 0.01, r * 1.3],
    [H + 0.02, r * 1.3],
  ], (t) => (t > 0.5 && t < 0.62 ? shade(stone, 0.1) : stone), { outline: true });
  dome(iso, u, v, z + H + 0.02, r * 1.1, domeCol, 'onion', C.brass);
}

const MUSEUM_SCHEMES = [
  { body: '#dcc39a', trim: '#f2e4c6', dome: '#f6f1e6', banner: ['#a8452f', '#d98f3a'] },
  { body: '#b8634a', trim: '#f0e6d4', dome: '#f7f4ee', banner: ['#2f5e8a', '#d9a52b'] },
] as const;

/** Lighter-weight lawn than the shared helper: mow stripes plus a sparse speckle budget. */
function lightLawn(iso: Iso, rng: Rng, u0: number, v0: number, u1: number, v1: number, z: number, base: string, perTile = 150): void {
  const pts = iso.topQuad(u0, v0, u1, v1, z);
  iso.poly(pts, base);
  const stripe = alpha(shade(base, 0.08), 0.5);
  for (let u = u0; u < u1; u += 0.16) iso.poly(iso.topQuad(u, v0, Math.min(u + 0.08, u1), v1, z), stripe);
  iso.speckle(pts, rng, Math.round(perTile * (u1 - u0) * (v1 - v0)), [shade(base, 0.18), shade(base, -0.18), '#9cbc5a'], 1.3);
}

function drawMuseum(ctx: Ctx, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('museum', variant);
  const sc = MUSEUM_SCHEMES[variant % MUSEUM_SCHEMES.length];
  const z0 = 0.03;
  slab(iso, rng, 0.03, z0, C.lawn, '#7a6446', []);
  lightLawn(iso, rng, 0.05, 0.05, 2.95, 2.95, z0, C.lawn);
  // forecourt and approach path (building faces +v)
  const path = '#dccaa4';
  iso.poly(iso.topQuad(0.25, 1.62, 2.75, 1.9, z0 + 0.002), path);
  iso.poly(iso.topQuad(1.3, 1.62, 1.7, 2.97, z0 + 0.002), path);
  paving(iso, rng, 1.3, 1.62, 1.7, 2.97, z0 + 0.002, 0.1, 0.1, alpha('#a8966f', 0.45));
  paving(iso, rng, 0.25, 1.62, 2.75, 1.9, z0 + 0.002, 0.14, 0.14, alpha('#a8966f', 0.35));
  // trees behind
  iso.tree(0.25, 0.3, z0, 0.15, rng, 'peepal');
  iso.tree(2.75, 0.3, z0, 0.14, rng, 'neem');
  iso.tree(1.5, 0.15, z0, 0.12, rng, 'neem');
  // side wings, central hall
  const H = 0.36;
  sandWing(iso, rng, 0.3, 0.6, 0.95, 1.45, z0, H * 0.82, sc.body, sc.trim, 2);
  sandWing(iso, rng, 0.95, 0.45, 2.05, 1.5, z0, H, sc.body, sc.trim, 2);
  sandWing(iso, rng, 2.05, 0.6, 2.7, 1.45, z0, H * 0.82, sc.body, sc.trim, 2);
  // wing-end chhatris
  for (const [u, v] of [
    [0.36, 0.66],
    [0.79, 1.29],
    [2.11, 0.66],
    [2.54, 1.29],
  ] as [number, number][])
    turret(iso, u + 0.05, v + 0.05, z0 + H * 0.82 + 0.02, 0.08, 0.04, sc.trim, sc.dome);
  // central drum + great dome
  const dz = z0 + H + 0.02;
  iso.lathe(1.5, 0.97, dz, [
    [0, 0.31],
    [0.03, 0.31],
    [0.035, 0.27],
    [0.12, 0.27],
    [0.13, 0.29],
    [0.145, 0.29],
  ], (t) => (t > 0.85 ? sc.trim : t < 0.25 ? sc.trim : sc.body), { outline: true });
  // drum windows (front half)
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.25 + (i / 8) * Math.PI;
    const pu = 1.5 + Math.cos(a) * 0.272;
    const pv = 0.97 + Math.sin(a) * 0.272;
    iso.line([pu, pv, dz + 0.05], [pu, pv, dz + 0.105], '#3e3a44', 2.2);
  }
  dome(iso, 1.5, 0.97, dz + 0.145, 0.28, sc.dome, 'onion', C.gold);
  // corner chhatris of the central hall
  for (const [u, v] of [
    [2.0 - 0.13, 0.5],
    [1.0, 1.5 - 0.13],
    [2.0 - 0.13, 1.5 - 0.13],
  ] as [number, number][])
    chhatri(iso, rng, u, v, z0 + H + 0.02, 0.11, sc.trim, sc.dome, 0.11);
  // entrance iwan (tall portal) with flanking turrets
  const pu0 = 1.22;
  const pu1 = 1.78;
  const pv0 = 1.5;
  const pv1 = 1.66;
  const PH = 0.46;
  iso.aoRect(pu0, pv0, pu1, pv1, z0, 0.05, 0.4);
  iso.box(pu0, pv0, pu1, pv1, z0, z0 + PH, mat(sc.trim, { right: -0.25 }));
  iso.archV(pv1, pu0 + 0.07, pu1 - 0.07, z0 + 0.04, z0 + PH - 0.06, shade(sc.body, -0.05), true);
  iso.archV(pv1, pu0 + 0.1, pu1 - 0.1, z0 + 0.05, z0 + PH - 0.1, '#43302a', true);
  iso.archV(pv1, pu0 + 0.2, pu1 - 0.2, z0, z0 + 0.16, '#2a1e1a');
  // decorative frieze and parapet
  iso.poly(iso.faceVQuad(pv1, pu0, pu1, z0 + PH - 0.04, z0 + PH - 0.025), shade(sc.body, -0.2));
  for (let u = pu0 + 0.01; u < pu1 - 0.02; u += 0.045) iso.box(u, pv1 - 0.02, u + 0.025, pv1, z0 + PH, z0 + PH + 0.03, mat(sc.trim), { edges: false });
  // steps
  for (let k = 0; k < 3; k++) iso.box(pu0 + 0.05, pv1 + k * 0.025, pu1 - 0.05, pv1 + (k + 1) * 0.025, z0, z0 + 0.03 - k * 0.01, mat(shade(sc.trim, -0.05)));
  turret(iso, pu0 - 0.01, pv1 - 0.03, z0, PH + 0.05, 0.035, sc.trim, sc.dome);
  turret(iso, pu1 + 0.01, pv1 - 0.03, z0, PH + 0.05, 0.035, sc.trim, sc.dome);
  // exhibition banners between the ground-floor arches
  for (const [u, col] of [
    [0.5, sc.banner[0]],
    [0.72, sc.banner[1]],
    [2.23, sc.banner[1]],
    [2.45, sc.banner[0]],
  ] as [number, string][]) {
    iso.poly(iso.faceVQuad(1.456, u, u + 0.06, z0 + 0.1, z0 + 0.26), col, alpha('#2a1a10', 0.5), 0.8);
    iso.poly(iso.faceVQuad(1.457, u + 0.012, u + 0.048, z0 + 0.2, z0 + 0.23), alpha('#fff4dc', 0.8));
  }
  // lawn features: Ashokan lion pillar replica, fountain, sculptures, trees, visitors
  const lp: [number, number] = [0.72, 2.25];
  iso.aoEllipse(lp[0], lp[1], 0.06, z0, 0.05, 0.4);
  iso.box(lp[0] - 0.06, lp[1] - 0.06, lp[0] + 0.06, lp[1] + 0.06, z0, z0 + 0.04, mat('#c9b690'));
  iso.lathe(lp[0], lp[1], z0 + 0.04, [
    [0, 0.024],
    [0.36, 0.019],
    [0.37, 0.03],
    [0.39, 0.034],
    [0.41, 0.028],
    [0.43, 0.03],
  ], () => '#d9c9a4', { outline: true });
  iso.lathe(lp[0], lp[1], z0 + 0.47, [
    [0, 0.026],
    [0.03, 0.022],
    [0.05, 0.012],
    [0.06, 0],
  ], () => '#c7b27f', { outline: true });
  const fc: [number, number] = [2.2, 2.35];
  iso.cylinder(fc[0], fc[1], 0.2, z0, z0 + 0.04, '#e8dcc2', null);
  iso.ellipse(fc[0], fc[1], z0 + 0.04, 0.17, '#5f9fb0', alpha('#2a4a55', 0.5), 1);
  iso.ellipse(fc[0] - 0.03, fc[1] - 0.03, z0 + 0.041, 0.08, alpha('#dff3f0', 0.35));
  iso.cylinder(fc[0], fc[1], 0.035, z0 + 0.04, z0 + 0.1, '#e8dcc2');
  iso.lathe(fc[0], fc[1], z0 + 0.1, [
    [0, 0.07],
    [0.015, 0.06],
    [0.02, 0],
  ], () => '#e8dcc2', { outline: true });
  // topiary / flower beds along the path
  for (const v of [2.1, 2.45, 2.8]) {
    for (const u of [1.2, 1.8]) {
      iso.aoEllipse(u, v, 0.05, z0, 0.03, 0.35);
      iso.lathe(u, v, z0, [
        [0, 0.045],
        [0.05, 0.05],
        [0.09, 0],
      ], () => '#4f7d32', { outline: true });
    }
  }
  for (const [u0, v0] of [
    [0.3, 2.05],
    [2.0, 2.0],
  ] as [number, number][]) {
    iso.poly(iso.topQuad(u0, v0 + 0.55, u0 + 0.5, v0 + 0.72, z0 + 0.003), '#8a5a3a');
    iso.speckle(iso.topQuad(u0, v0 + 0.55, u0 + 0.5, v0 + 0.72, z0 + 0.004), rng, 90, ['#f5a623', '#e0761a', '#d8452f', '#f4e04a'], 2);
  }
  crowd(iso, rng, 1.32, 1.95, 1.68, 2.9, z0, 9, 0.05);
  crowd(iso, rng, 0.4, 1.7, 2.6, 1.86, z0, 7, 0.05);
  iso.tree(0.25, 2.75, z0, 0.13, rng, 'neem');
  iso.tree(2.8, 1.75, z0, 0.12, rng, 'ashoka');
  iso.tree(0.15, 1.7, z0, 0.1, rng, 'ashoka');
  iso.tree(2.75, 2.8, z0, 0.14, rng, 'peepal');
}

// ============================================================================
// AIRPORT (4×4)
// ============================================================================

interface Livery {
  body: string;
  tail: string;
  stripe: string;
}

/**
 * Airliner parked along +u (nose towards the screen lower-right). `kind` jet = low wing + two
 * podded engines; prop = high wing, two turboprops and a T-tail.
 */
function airliner(iso: Iso, uT: number, vc: number, z: number, L: number, liv: Livery, kind: 'jet' | 'prop'): void {
  const { ctx } = iso;
  const r = L * (kind === 'jet' ? 0.052 : 0.058);
  const zc = z + (kind === 'jet' ? 0.05 : 0.035) + r;
  const uN = uT + L;
  const rad = (s: number) => {
    if (s < 0.26) return r * (0.25 + 0.75 * Math.pow(s / 0.26, 0.6));
    if (s > 0.86) return r * Math.sqrt(Math.max(0.02, 1 - Math.pow((s - 0.86) / 0.14, 2)));
    return r;
  };
  const zs = (s: number) => zc + (s < 0.26 ? (1 - s / 0.26) * r * 0.55 : 0) - (s > 0.86 ? (s - 0.86) * r * 1.2 : 0);
  const at = (s: number) => uT + L * s;
  const wingZ = kind === 'jet' ? zc - r * 0.55 : zc + r * 0.8;
  const span = L * (kind === 'jet' ? 0.5 : 0.55);
  const wr0 = kind === 'jet' ? 0.4 : 0.44;
  const wr1 = kind === 'jet' ? 0.6 : 0.56;
  const sweep = kind === 'jet' ? L * 0.16 : L * 0.02;
  const tipC = L * (kind === 'jet' ? 0.07 : 0.08);
  const wing = (sgn: number): P3[] => [
    [at(wr1), vc, wingZ],
    [at(wr1) - sweep, vc + sgn * span, wingZ + 0.02],
    [at(wr1) - sweep - tipC, vc + sgn * span, wingZ + 0.02],
    [at(wr0), vc, wingZ],
  ];
  const stabZ = kind === 'jet' ? zs(0.05) : zs(0.05) + L * 0.17;
  const stab = (sgn: number): P3[] => [
    [at(0.16), vc, stabZ],
    [at(0.07), vc + sgn * L * 0.17, stabZ + 0.01],
    [at(0.02), vc + sgn * L * 0.17, stabZ + 0.01],
    [at(0.02), vc, stabZ],
  ];
  const engV = span * (kind === 'jet' ? 0.36 : 0.33);
  const engine = (sgn: number) => {
    const ev = vc + sgn * engV;
    if (kind === 'jet') {
      const er = r * 0.5;
      const ez = wingZ - er * 1.1;
      iso.line([at(wr1) - sweep * 0.36, ev, wingZ], [at(wr1) - sweep * 0.36 + 0.02, ev, ez], '#8a9098', 2);
      const u0 = at(wr1) - sweep * 0.3 - L * 0.02;
      const u1 = u0 + L * 0.15;
      tubeU(iso, u0, u1, ev, () => ez, (s) => er * (s > 0.92 ? 0.93 : s < 0.15 ? 0.7 + s * 2 : 1), '#dde2e6');
      disc(iso, [u1 + 0.001, ev, ez], [0, er * 0.8, 0], [0, 0, er * 0.8], '#2a2e34');
      disc(iso, [u1 + 0.002, ev, ez], [0, er * 0.25, 0], [0, 0, er * 0.25], '#9aa0a6');
    } else {
      const er = r * 0.38;
      const ez = wingZ - er * 0.6;
      const u0 = at(wr0) - L * 0.04;
      const u1 = at(wr1) + L * 0.08;
      tubeU(iso, u0, u1, ev, () => ez, (s) => er * (s > 0.85 ? 1 - (s - 0.85) * 3 : 1), liv.body);
      disc(iso, [u1 + 0.004, ev, ez], [0, er * 3.2, 0], [0, 0, er * 3.2], alpha('#3a3e44', 0.28));
      iso.line([u1 + 0.004, ev - er * 3, ez + er * 0.6], [u1 + 0.004, ev + er * 3, ez - er * 0.6], alpha('#2a2e34', 0.8), 1.3);
    }
  };
  // shadow on the apron
  const sh = (p: P3): P3 => [p[0] + (p[2] - z) * 0.45, p[1] - (p[2] - z) * 0.15, z];
  iso.poly([...wing(1), ...wing(-1).reverse()].map(sh), alpha('#1e1a14', 0.2));
  iso.poly([
    [uT, vc - r * 0.7, z],
    [uN, vc - r * 0.5, z],
    [uN, vc + r * 0.5, z],
    [uT, vc + r * 0.7, z],
  ].map((p) => sh([p[0], p[1], zc] as P3)), alpha('#1e1a14', 0.24));
  // landing gear
  for (const [s, dv] of [
    [0.84, 0],
    [0.5, r * 0.8],
    [0.5, -r * 0.8],
  ] as [number, number][]) {
    iso.line([at(s), vc + dv, z], [at(s), vc + dv, zs(s) - r * 0.7], '#5a5e64', 1.6);
    iso.ellipse(at(s), vc + dv, z + 0.008, 0.012, '#1e1e22');
  }
  // far side
  if (kind === 'jet') engine(-1);
  iso.poly(wing(-1), shade('#d6dbe0', -0.12), alpha('#3a3e44', 0.6), 0.8);
  if (kind === 'prop') engine(-1);
  iso.poly(stab(-1), shade('#d6dbe0', -0.1), alpha('#3a3e44', 0.6), 0.8);
  // fuselage
  tubeU(iso, uT, uN, vc, zs, rad, liv.body);
  const onSkin = (s: number, th: number): P3 => [at(s), vc + rad(s) * Math.cos(th), zs(s) + rad(s) * Math.sin(th)];
  // cheatline + belly
  const stripe: P3[] = [];
  for (let s = 0.06; s <= 0.95; s += 0.02) stripe.push(onSkin(s, -0.25));
  iso.polyline(stripe, liv.stripe, Math.max(1.5, r * iso.T * 0.16 / iso.px));
  const stripe2: P3[] = [];
  for (let s = 0.1; s <= 0.9; s += 0.02) stripe2.push(onSkin(s, -0.55));
  iso.polyline(stripe2, alpha(liv.tail, 0.8), Math.max(1, r * iso.T * 0.08 / iso.px));
  // cabin windows
  for (let s = 0.22; s < 0.82; s += 0.024) {
    const [x, y] = iso.pt(...onSkin(s, 0.3));
    ctx.fillStyle = '#28323e';
    ctx.fillRect(x - 0.9 * iso.px, y - 1.1 * iso.px, 1.8 * iso.px, 2.2 * iso.px);
  }
  // doors
  for (const s of [0.8, 0.25]) {
    const a = onSkin(s, -0.3);
    const b = onSkin(s, 0.55);
    iso.poly([a, [a[0] + L * 0.025, a[1], a[2]], [b[0] + L * 0.025, b[1], b[2]], b], null, alpha('#4a5058', 0.7), 0.8);
  }
  // cockpit windows
  const cw: P3[] = [onSkin(0.935, 0.25), onSkin(0.965, 0.2), onSkin(0.965, 0.55), onSkin(0.93, 0.62)];
  iso.poly(cw, '#1e2630');
  // fin
  const finBase = zs(0.1) + r * 0.6;
  const finTop = finBase + L * (kind === 'jet' ? 0.19 : 0.17);
  const fin: P3[] = [
    [at(0.28), vc, finBase - r * 0.2],
    [at(0.06), vc, finTop],
    [at(-0.04), vc, finTop],
    [at(0.02), vc, finBase - r * 0.3],
  ];
  iso.poly(fin, liv.tail, alpha(shade(liv.tail, -0.5), 0.7), 0.8);
  iso.poly([
    [at(0.12), vc + 0.001, finBase + (finTop - finBase) * 0.45],
    [at(0.08), vc + 0.001, finBase + (finTop - finBase) * 0.75],
    [at(0.03), vc + 0.001, finBase + (finTop - finBase) * 0.6],
  ], alpha('#fff6e0', 0.9));
  // near side
  iso.poly(stab(1), '#e2e6ea', alpha('#3a3e44', 0.6), 0.8);
  if (kind === 'jet') engine(1);
  iso.poly(wing(1), '#e4e8ec', alpha('#3a3e44', 0.6), 0.8);
  iso.line(wing(1)[0], wing(1)[1], alpha('#ffffff', 0.7), 0.8);
  iso.line(wing(1)[2], wing(1)[3], alpha('#8a9098', 0.6), 1);
  if (kind === 'prop') engine(1);
}

/** Jet bridge from the terminal facade (v = v0) to v1 at u. */
function jetBridge(iso: Iso, u: number, v0: number, v1: number, z: number): void {
  const zb = z + 0.1;
  iso.box(u - 0.035, v0, u + 0.035, v1, zb, zb + 0.055, mat('#c9ccd0'));
  for (let v = v0 + 0.05; v < v1; v += 0.05) iso.line([u - 0.035, v, zb + 0.055], [u - 0.035, v, zb], alpha('#6a7078', 0.35), 0.7);
  iso.poly(iso.faceUQuad(u + 0.035, v0 + 0.02, v1 - 0.02, zb + 0.02, zb + 0.04), '#3a4450');
  iso.line([u, v1 - 0.06, z], [u, v1 - 0.06, zb], '#5a6068', 2.2);
  iso.ellipse(u, v1 - 0.06, z + 0.006, 0.02, '#2a2a2e');
  iso.box(u - 0.05, v1 - 0.01, u + 0.05, v1 + 0.04, zb - 0.005, zb + 0.065, mat('#b8bcc2'));
}

/** Barrel-vaulted terminal roof along u, from v = vA to vB, rising `rise` above zH. */
function barrelRoof(iso: Iso, u0: number, u1: number, vA: number, vB: number, zH: number, rise: number, base: string): void {
  const n = 14;
  const pt = (t: number): [number, number] => [vA + (vB - vA) * t, zH + rise * Math.sin(Math.PI * t)];
  for (let k = 0; k < n; k++) {
    const [va, za] = pt(k / n);
    const [vb, zb] = pt((k + 1) / n);
    const t = (k + 0.5) / n;
    iso.poly([
      [u0, va, za],
      [u1, va, za],
      [u1, vb, zb],
      [u0, vb, zb],
    ], shade(base, -0.12 + t * 0.28));
  }
  // standing seams
  for (let u = u0 + 0.06; u < u1; u += 0.06) {
    const pts: P3[] = [];
    for (let k = 0; k <= n; k++) {
      const [v, z] = pt(k / n);
      pts.push([u, v, z + 0.002]);
    }
    iso.polyline(pts, alpha(shade(base, -0.4), 0.35), 0.6);
  }
  // skylight ribbon along the crown
  iso.poly([
    [u0 + 0.05, pt(0.47)[0], pt(0.47)[1] + 0.003],
    [u1 - 0.05, pt(0.47)[0], pt(0.47)[1] + 0.003],
    [u1 - 0.05, pt(0.55)[0], pt(0.55)[1] + 0.003],
    [u0 + 0.05, pt(0.55)[0], pt(0.55)[1] + 0.003],
  ], alpha('#5a8aa8', 0.8));
  // gable end (+u face) with fascia thickness
  const g: P3[] = [];
  for (let k = 0; k <= n; k++) {
    const [v, z] = pt(k / n);
    g.push([u1, v, z]);
  }
  const gable: P3[] = [...g, ...g.slice().reverse().map((p) => [p[0], p[1], p[2] - 0.025] as P3)];
  iso.poly(gable, shade(base, -0.35), alpha('#1e1e22', 0.5), 0.8);
  iso.poly(iso.faceVQuad(vB, u0, u1, zH - 0.025, zH), shade(base, -0.05), alpha('#1e1e22', 0.5), 0.8);
  iso.line([u0, vB, zH], [u1, vB, zH], alpha('#ffffff', 0.6), 1);
}

function drawAirport(ctx: Ctx, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 4);
  const rng = seededRng('airport', variant);
  const z0 = 0.025;
  slab(iso, rng, 0.03, z0, '#c9c4b8', '#8a8478', []);
  // grass strips and runway
  lightLawn(iso, rng, 0.03, 2.88, 3.97, 3.97, z0, '#86a64e', 250);
  const rv0 = 3.08;
  const rv1 = 3.78;
  iso.poly(iso.topQuad(0.03, rv0, 3.97, rv1, z0 + 0.002), '#4e4e54');
  iso.speckle(iso.topQuad(0.03, rv0, 3.97, rv1, z0 + 0.002), rng, 700, ['#5a5a60', '#44444a'], 1.2);
  const rc = (rv0 + rv1) / 2;
  for (let u = 0.6; u < 3.8; u += 0.3) iso.poly(iso.topQuad(u, rc - 0.008, u + 0.16, rc + 0.008, z0 + 0.003), '#f4f4f0');
  iso.line([0.03, rv0 + 0.03, z0 + 0.003], [3.97, rv0 + 0.03, z0 + 0.003], '#f0f0ea', 1);
  iso.line([0.03, rv1 - 0.03, z0 + 0.003], [3.97, rv1 - 0.03, z0 + 0.003], '#f0f0ea', 1);
  for (let v = rv0 + 0.07; v < rv1 - 0.07; v += 0.07) iso.poly(iso.topQuad(0.12, v, 0.4, v + 0.035, z0 + 0.003), '#f4f4f0');
  iso.poly(iso.topQuad(0.9, rc - 0.16, 1.15, rc - 0.1, z0 + 0.003), '#f4f4f0');
  iso.poly(iso.topQuad(0.9, rc + 0.1, 1.15, rc + 0.16, z0 + 0.003), '#f4f4f0');
  for (let u = 0.2; u < 3.9; u += 0.25) {
    iso.ellipse(u, rv0 - 0.02, z0 + 0.004, 0.008, '#f7e27a');
    iso.ellipse(u, rv1 + 0.02, z0 + 0.004, 0.008, '#f7e27a');
  }
  // apron with slab joints and taxi lines
  iso.poly(iso.topQuad(0.03, 1.25, 3.97, 2.88, z0 + 0.001), '#d4cfc4');
  paving(iso, rng, 0.03, 1.25, 3.97, 2.88, z0 + 0.001, 0.2, 0.2, alpha('#9a948a', 0.35));
  iso.poly(iso.topQuad(3.3, 2.88, 3.62, rv0, z0 + 0.002), '#56565c');
  iso.line([3.46, 2.4, z0 + 0.003], [3.46, rv0 + 0.3, z0 + 0.003], '#e8c02a', 1.4);
  iso.line([0.1, 2.4, z0 + 0.003], [3.46, 2.4, z0 + 0.003], '#e8c02a', 1.4);
  for (const u of [0.75, 2.0]) iso.line([u + 0.3, 2.4, z0 + 0.003], [u + 0.3, 1.45, z0 + 0.003], '#e8c02a', 1.2);
  // landside car park (back right)
  iso.poly(iso.topQuad(2.95, 0.08, 3.95, 1.15, z0 + 0.001), '#6a6a6e');
  for (let u = 3.05; u < 3.9; u += 0.14) iso.line([u, 0.12, z0 + 0.002], [u, 0.45, z0 + 0.002], alpha('#f4f4f0', 0.7), 0.8);
  for (let u = 3.05; u < 3.9; u += 0.14) iso.line([u, 0.75, z0 + 0.002], [u, 1.08, z0 + 0.002], alpha('#f4f4f0', 0.7), 0.8);
  const carCols = ['#f4f4f0', '#c0392b', '#2f6fb3', '#9aa0a6', '#2a2a2e', '#f0b429', '#f4f4f0'];
  for (let i = 0; i < 12; i++) {
    const row = i < 6 ? 0.18 : 0.8;
    if (rng() < 0.2) continue;
    car(iso, 3.07 + (i % 6) * 0.14, row, z0, carCols[Math.floor(rng() * carCols.length)], 'v');
  }
  iso.tree(3.8, 0.1, z0, 0.1, rng, 'neem');
  iso.tree(2.85, 0.1, z0, 0.09, rng, 'neem');
  // terminal
  const tu0 = 0.28;
  const tu1 = 2.72;
  const tv0 = 0.35;
  const tv1 = 1.2;
  const TH = 0.2;
  iso.tree(0.15, 0.15, z0, 0.1, rng, 'neem');
  iso.aoRect(tu0, tv0, tu1, tv1, z0, 0.1, 0.45);
  iso.box(tu0, tv0, tu1, tv1, z0, z0 + TH, mat('#e3cfa6'));
  // glass curtain wall on the airside (+v) face
  const glass = ctx.createLinearGradient(0, iso.sy(0, tv1, z0 + TH), 0, iso.sy(0, tv1, z0));
  glass.addColorStop(0, '#6f9fb8');
  glass.addColorStop(0.6, '#3f6a86');
  glass.addColorStop(1, '#2d4a60');
  iso.poly(iso.faceVQuad(tv1, tu0 + 0.03, tu1 - 0.03, z0 + 0.025, z0 + TH - 0.01), glass);
  for (let u = tu0 + 0.03; u < tu1 - 0.02; u += 0.07) iso.line([u, tv1 + 0.001, z0 + 0.025], [u, tv1 + 0.001, z0 + TH - 0.01], alpha('#dfe8ee', 0.55), 0.8);
  iso.line([tu0 + 0.03, tv1 + 0.001, z0 + 0.11], [tu1 - 0.03, tv1 + 0.001, z0 + 0.11], alpha('#dfe8ee', 0.6), 0.9);
  // reflections
  for (let i = 0; i < 6; i++) {
    const a = tu0 + 0.2 + i * 0.4;
    iso.poly([
      [a, tv1 + 0.002, z0 + 0.03],
      [a + 0.08, tv1 + 0.002, z0 + 0.03],
      [a + 0.18, tv1 + 0.002, z0 + TH - 0.015],
      [a + 0.1, tv1 + 0.002, z0 + TH - 0.015],
    ], alpha('#e8f4fa', 0.18));
  }
  // sandstone jaali screen on the +u end wall
  iso.poly(iso.faceUQuad(tu1, tv0 + 0.04, tv1 - 0.04, z0 + 0.03, z0 + TH - 0.02), shade('#c9ae80', -0.18));
  iso.clipped(iso.faceUQuad(tu1, tv0 + 0.04, tv1 - 0.04, z0 + 0.03, z0 + TH - 0.02), () => {
    for (let v = tv0; v < tv1; v += 0.035) {
      iso.line([tu1, v, z0], [tu1, v + 0.25, z0 + TH], alpha('#6a4a2a', 0.45), 0.8);
      iso.line([tu1, v, z0 + TH], [tu1, v + 0.25, z0], alpha('#6a4a2a', 0.45), 0.8);
    }
  });
  grime(iso, tu0, tv0, tu1, tv1, z0, 0.03, 0.2);
  barrelRoof(iso, tu0 - 0.06, tu1 + 0.08, tv0 - 0.05, tv1 + 0.12, z0 + TH, 0.11, variant % 2 ? '#b8c2c8' : '#d4d8da');
  // name board on the roof crown (abstract lettering)
  const nb0 = 1.1;
  iso.poly(iso.faceVQuad(tv1 - 0.3, nb0, nb0 + 0.8, z0 + TH + 0.1, z0 + TH + 0.17), '#f6f1e6', alpha('#3a3024', 0.6), 0.8);
  for (let i = 0; i < 6; i++) iso.poly(iso.faceVQuad(tv1 - 0.299, nb0 + 0.05 + i * 0.12, nb0 + 0.13 + i * 0.12, z0 + TH + 0.12, z0 + TH + 0.15), i < 3 ? '#c0501f' : '#1f3f6a');
  // flag on the roof
  flag(iso, tu0 + 0.1, tv1 - 0.1, z0 + TH + 0.05, 0.22, C.saffron);
  // ATC tower (right side of apron, drawn before the aircraft in front of it)
  const au = 3.45;
  const av = 1.5;
  iso.box(au - 0.2, av - 0.18, au + 0.2, av + 0.18, z0, z0 + 0.12, mat('#e8e2d4'));
  windowV(iso, av + 0.18, au - 0.15, au + 0.15, z0 + 0.04, z0 + 0.09, '#3d5a70');
  windowU(iso, au + 0.2, av - 0.13, av + 0.13, z0 + 0.04, z0 + 0.09, '#2f4a5e');
  iso.castShadow([
    [au - 0.06, av - 0.06],
    [au + 0.06, av - 0.06],
    [au + 0.06, av + 0.06],
    [au - 0.06, av + 0.06],
  ], z0, 0.8, 0.12);
  iso.lathe(au, av, z0 + 0.12, [
    [0, 0.075],
    [0.55, 0.06],
    [0.58, 0.1],
    [0.6, 0.13],
  ], (t) => (t > 0.9 ? '#d8d2c4' : '#efe9dc'), { outline: true });
  for (let zz = z0 + 0.2; zz < z0 + 0.65; zz += 0.08) iso.line([au + 0.05, av + 0.045, zz], [au + 0.05, av + 0.045, zz + 0.04], '#3d5a70', 1.4);
  iso.lathe(au, av, z0 + 0.72, [
    [0, 0.13],
    [0.02, 0.14],
    [0.09, 0.145],
    [0.1, 0.15],
    [0.12, 0.15],
    [0.13, 0.1],
    [0.15, 0.04],
  ], (t) => (t > 0.12 && t < 0.62 ? '#2a4256' : t >= 0.62 ? '#8a3a2a' : '#e8e2d4'), { outline: true, lit: 0.35 });
  iso.line([au, av, z0 + 0.87], [au, av, z0 + 0.98], '#5a5e64', 1.2);
  iso.ellipse(au, av, z0 + 0.98, 0.008, '#e84a2a');
  // bridges and aircraft
  jetBridge(iso, 2.05, tv1, 1.78, z0);
  jetBridge(iso, 0.8, tv1, variant % 2 ? 1.78 : 1.58, z0);
  // ground service vehicles
  const tractor = (u: number, v: number, col: string) => {
    iso.box(u, v, u + 0.07, v + 0.05, z0, z0 + 0.035, mat(col));
    for (let i = 1; i <= 3; i++) {
      iso.box(u - i * 0.09, v, u - i * 0.09 + 0.075, v + 0.05, z0 + 0.008, z0 + 0.03, mat('#8a9098'));
      iso.box(u - i * 0.09 + 0.008, v + 0.008, u - i * 0.09 + 0.067, v + 0.042, z0 + 0.03, z0 + 0.05, mat(['#2f6fb3', '#c0392b', '#3aa66a'][i - 1]));
    }
  };
  tractor(1.55, 2.55, '#e8c02a');
  if (variant % 2) {
    airliner(iso, 0.2, 1.95, z0, 1.0, { body: '#f4f4f2', tail: '#2f6fb3', stripe: '#d8452f' }, 'prop');
    airliner(iso, 1.25, 2.02, z0, 1.35, { body: '#f6f6f4', tail: '#c0392b', stripe: '#c0392b' }, 'jet');
  } else {
    airliner(iso, 1.1, 2.02, z0, 1.45, { body: '#f6f6f4', tail: '#e8761a', stripe: '#1f3f6a' }, 'jet');
    // fuel truck
    iso.box(0.45, 2.2, 0.72, 2.3, z0, z0 + 0.06, mat('#e8e2d4'));
    tubeU(iso, 0.47, 0.66, 2.25, () => z0 + 0.095, () => 0.04, '#d8d4c8');
    iso.box(0.66, 2.2, 0.75, 2.3, z0 + 0.01, z0 + 0.075, mat('#c0392b'));
  }
  // follow-me car, windsock, crew
  car(iso, 3.0, 2.6, z0, '#f0c020', 'u');
  pole(iso, 0.3, 2.95, z0, 0.16, '#d8d4c8', 1.2);
  tubeU(iso, 0.3, 0.42, 2.95, (s) => z0 + 0.155 - s * 0.02, (s) => 0.02 - s * 0.008, '#f07a1a', false);
  for (const [u, v] of [
    [2.2, 2.3],
    [2.28, 2.45],
    [1.3, 2.5],
  ] as [number, number][])
    person(iso, u, v, z0, '#f07a1a', rng, 0.05);
  iso.tree(3.9, 2.0, z0, 0.1, rng, 'ashoka');
}

// ============================================================================
// SPACE PROGRAMME (3×3)
// ============================================================================

/** Square lattice tower (umbilical / service tower), with coloured bands. */
function latticeTower(iso: Iso, u: number, v: number, s: number, z: number, H: number, band: string): void {
  const u1 = u + s;
  const v1 = v + s;
  iso.castShadow([
    [u, v],
    [u1, v],
    [u1, v1],
    [u, v1],
  ], z, H, 0.14);
  const edge = (a: [number, number], col: string, lw = 1.8) => iso.line([a[0], a[1], z], [a[0], a[1], z + H], col, lw);
  edge([u, v], '#6a6e74');
  const levels = Math.round(H / 0.07);
  for (let k = 0; k < levels; k++) {
    const za = z + (H * k) / levels;
    const zb = z + (H * (k + 1)) / levels;
    const col = Math.floor(k / 2) % 2 ? band : '#e8e4dc';
    iso.line([u, v1, za], [u1, v1, zb], alpha('#5a5e64', 0.8), 0.8);
    iso.line([u1, v, za], [u1, v1, zb], alpha('#4a4e54', 0.8), 0.8);
    iso.line([u, v1, zb], [u1, v1, zb], col, 1.4);
    iso.line([u1, v, zb], [u1, v1, zb], shade(col, -0.25), 1.4);
    // service floors (solid decks every few levels)
    if (k % 4 === 3) iso.box(u - 0.01, v - 0.01, u1 + 0.01, v1 + 0.01, zb - 0.008, zb, mat('#9aa0a6'), { edges: false });
  }
  edge([u1, v], shade(band, -0.2));
  edge([u, v1], band, 2);
  edge([u1, v1], shade(band, 0.1), 2.2);
  iso.box(u - 0.02, v - 0.02, u1 + 0.02, v1 + 0.02, z + H, z + H + 0.03, mat('#b8bcc2'));
  pole(iso, u + s / 2, v + s / 2, z + H + 0.03, 0.2, '#8a8f96', 1.2);
}

/** PSLV-style launcher: core stage, strap-on boosters and an ogive payload fairing. */
function rocket(iso: Iso, u: number, v: number, z: number, H: number): void {
  const R = 0.055;
  const booster = (a: number) => {
    const bu = u + Math.cos(a) * (R + 0.024);
    const bv = v + Math.sin(a) * (R + 0.024);
    iso.lathe(bu, bv, z, [
      [0, 0.02],
      [0.02, 0.024],
      [H * 0.3, 0.024],
      [H * 0.34, 0.016],
      [H * 0.37, 0],
    ], (t) => (t < 0.08 ? '#4a4e54' : t > 0.8 ? '#e0701a' : '#f2efe8'), { outline: true });
  };
  const angles = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + 0.3);
  angles.filter((a) => Math.cos(a) + Math.sin(a) < 0).forEach(booster);
  iso.lathe(u, v, z, [
    [0, R * 0.9],
    [0.03, R],
    [H * 0.55, R],
    [H * 0.56, R * 0.85],
    [H * 0.74, R * 0.85],
    [H * 0.76, R * 1.12],
    [H * 0.88, R * 1.12],
    [H * 0.95, R * 0.8],
    [H * 0.99, R * 0.3],
    [H, 0],
  ], (t) => {
    if (t < 0.05) return '#4a4e54';
    if (t > 0.35 && t < 0.4) return '#2a2e34';
    if (t > 0.55 && t < 0.58) return '#2a2e34';
    if (t > 0.74) return '#f6f4ee';
    return t > 0.58 ? '#dcdad2' : '#f2efe8';
  }, { outline: true, lit: 0.25 });
  // tricolour band on the core
  for (const [dz, col] of [
    [0.3, C.saffron],
    [0.31, '#f6f4ee'],
    [0.32, '#2f8a3a'],
  ] as [number, string][]) {
    const pts = ringPts([u, v, z + H * dz], [R + 0.001, 0, 0], [0, R + 0.001, 0], 10, -Math.PI * 0.25, Math.PI * 0.75);
    iso.polyline(pts, col, 1.6);
  }
  angles.filter((a) => Math.cos(a) + Math.sin(a) >= 0).forEach(booster);
}

/** Large parabolic dish antenna on a yoke, tilted up towards the viewer's left. */
function dishAntenna(iso: Iso, u: number, v: number, z: number, R: number): void {
  const { ctx } = iso;
  iso.aoEllipse(u, v, 0.14, z, 0.08, 0.45);
  iso.box(u - 0.1, v - 0.1, u + 0.1, v + 0.1, z, z + 0.12, mat('#e8e4dc'));
  windowV(iso, v + 0.1, u - 0.05, u + 0.05, z, z + 0.08, '#3a4450');
  iso.lathe(u, v, z + 0.12, [
    [0, 0.07],
    [0.08, 0.05],
    [0.12, 0.05],
  ], () => '#d8d4cc', { outline: true });
  const zc = z + 0.12 + R * 0.72;
  // yoke arms
  iso.line([u - 0.05, v - 0.05, z + 0.22], [u - 0.02, v + 0.02, zc], '#8a8f96', 3);
  const n: [number, number, number] = [-0.38, 0.38, 0.843];
  const k = Math.SQRT1_2;
  const e1: [number, number, number] = [R * k, R * k, 0];
  const e2: [number, number, number] = [-n[2] * k * R, n[2] * k * R, (n[0] - n[1]) * k * R];
  const c: P3 = [u, v, zc];
  // back rim shadow + dish bowl
  disc(iso, [c[0] + 0.01, c[1] - 0.01, c[2] - 0.01], e1, e2, alpha('#3a3e44', 0.6));
  const g = ctx.createLinearGradient(-1, -1, 1, 1);
  g.addColorStop(0, '#9aa2aa');
  g.addColorStop(0.45, '#e8ecee');
  g.addColorStop(1, '#fbfcfc');
  disc(iso, c, e1, e2, g);
  // panel rings (deeper towards the centre)
  for (const rho of [0.33, 0.66]) {
    const depth = (1 - rho * rho) * R * 0.18;
    const cc: P3 = [c[0] - n[0] * depth, c[1] - n[1] * depth, c[2] - n[2] * depth];
    iso.polyline(ringPts(cc, [e1[0] * rho, e1[1] * rho, 0], [e2[0] * rho, e2[1] * rho, e2[2] * rho], 32), alpha('#8a929a', 0.55), 0.7);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const p0 = ringPts([c[0] - n[0] * R * 0.16, c[1] - n[1] * R * 0.16, c[2] - n[2] * R * 0.16], [e1[0] * 0.2, e1[1] * 0.2, 0], [e2[0] * 0.2, e2[1] * 0.2, e2[2] * 0.2], 1, a, a)[0];
    const p1 = ringPts(c, e1, e2, 1, a, a)[0];
    iso.line(p0, p1, alpha('#8a929a', 0.4), 0.6);
  }
  iso.polyline(ringPts(c, e1, e2, 48), '#6a727a', 1.4);
  // feed struts + sub-reflector
  const f: P3 = [c[0] + n[0] * R * 0.55, c[1] + n[1] * R * 0.55, c[2] + n[2] * R * 0.55];
  for (const a of [Math.PI * 0.5, Math.PI * 1.17, Math.PI * 1.83]) iso.line(ringPts(c, e1, e2, 1, a, a)[0], f, '#5a6068', 1.3);
  disc(iso, f, [e1[0] * 0.12, e1[1] * 0.12, 0], [e2[0] * 0.12, e2[1] * 0.12, e2[2] * 0.12], '#c8ccd0');
}

function drawSpaceProgram(ctx: Ctx, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 3);
  const rng = seededRng('space_program', variant);
  const z0 = 0.03;
  slab(iso, rng, 0.03, z0, C.lawn, '#7a6446', []);
  lightLawn(iso, rng, 0.05, 0.05, 2.95, 2.95, z0, '#7aa046');
  // roads
  const road = '#8a8a8e';
  iso.poly(iso.topQuad(0.05, 1.92, 2.95, 2.08, z0 + 0.002), road);
  iso.poly(iso.topQuad(1.52, 0.1, 1.68, 2.95, z0 + 0.002), road);
  for (let u = 0.1; u < 2.9; u += 0.12) iso.line([u, 2.0, z0 + 0.003], [u + 0.06, 2.0, z0 + 0.003], alpha('#f4f4f0', 0.8), 0.9);
  // launch complex pad (back right)
  iso.poly(iso.topQuad(1.72, 0.08, 2.92, 1.25, z0 + 0.002), '#c4c0b6');
  paving(iso, rng, 1.72, 0.08, 2.92, 1.25, z0 + 0.002, 0.15, 0.15, alpha('#8a857a', 0.4));
  iso.poly(iso.topQuad(2.3, 0.72, 2.55, 1.18, z0 + 0.003), '#3a3632');
  iso.poly(iso.topQuad(2.32, 0.95, 2.53, 1.16, z0 + 0.004), alpha('#6a5a4a', 0.6));
  // lightning masts
  for (const [u, v] of [
    [1.82, 0.18],
    [2.85, 0.18],
  ] as [number, number][])
    pole(iso, u, v, z0, 1.05, '#8a8f96', 1.6);
  // vehicle assembly building (back left)
  const vu0 = 0.2;
  const vu1 = 1.2;
  const vv0 = 0.2;
  const vv1 = 0.85;
  const VH = 0.62;
  iso.tree(0.12, 1.0, z0, 0.08, rng, 'neem');
  iso.aoRect(vu0, vv0, vu1, vv1, z0, 0.1, 0.45);
  iso.castShadow([
    [vu0, vv0],
    [vu1, vv0],
    [vu1, vv1],
    [vu0, vv1],
  ], z0, VH, 0.14);
  iso.box(vu0, vv0, vu1, vv1, z0, z0 + VH, mat('#f2f0ea', { right: -0.22 }));
  // tall door on the +u face (towards the pad) with panel lines
  iso.poly(iso.faceUQuad(vu1, vv0 + 0.18, vv1 - 0.18, z0, z0 + VH - 0.08), '#c8ccd0');
  for (let zz = z0 + 0.05; zz < z0 + VH - 0.08; zz += 0.05) iso.line([vu1, vv0 + 0.18, zz], [vu1, vv1 - 0.18, zz], alpha('#6a7078', 0.5), 0.8);
  // blue stripe + emblem on the +v face
  iso.poly(iso.faceVQuad(vv1, vu0, vu1, z0 + VH - 0.06, z0 + VH - 0.035), '#1f4f8a');
  iso.poly(iso.faceUQuad(vu1, vv0, vv1, z0 + VH - 0.06, z0 + VH - 0.035), shade('#1f4f8a', -0.2));
  const em: P3 = [0.7, vv1 + 0.002, z0 + 0.36];
  disc(iso, em, [0.1, 0, 0], [0, 0, 0.1], '#f6f4ee');
  disc(iso, [em[0] - 0.015, em[1], em[2] - 0.01], [0.075, 0, 0], [0, 0, 0.075], '#e8761a');
  disc(iso, [em[0] + 0.02, em[1], em[2] + 0.015], [0.06, 0, 0], [0, 0, 0.06], '#f6f4ee');
  iso.poly([
    [em[0] - 0.07, em[1], em[2] - 0.07],
    [em[0] + 0.08, em[1], em[2] + 0.05],
    [em[0] + 0.03, em[1], em[2] + 0.06],
  ], '#1f4f8a');
  for (let u = vu0 + 0.08; u < vu1 - 0.05; u += 0.14) windowV(iso, vv1, u, u + 0.06, z0 + 0.06, z0 + 0.11, '#3a4a5a');
  weatherV(iso, rng, vv1, vu0, vu1, z0, z0 + VH, 12, 0.06);
  weatherU(iso, rng, vu1, vv0, vv1, z0, z0 + VH, 10, 0.08);
  // service tower, crane arm, rocket
  latticeTower(iso, 2.02, 0.35, 0.2, z0, 1.02, '#c0392b');
  rocket(iso, 2.42, 0.62, z0 + 0.01, 0.92);
  iso.box(2.22, 0.5, 2.38, 0.54, z0 + 0.58, z0 + 0.61, mat('#9aa0a6'));
  iso.box(2.22, 0.5, 2.38, 0.54, z0 + 0.78, z0 + 0.81, mat('#9aa0a6'));
  // big tracking dish (front right)
  dishAntenna(iso, 2.35, 2.45, z0, 0.36);
  // mission control (front left): white, blue glass ribbons, rooftop dishes
  const mu0 = 0.25;
  const mu1 = 1.3;
  const mv0 = 1.15;
  const mv1 = 1.72;
  const MH = 0.24;
  iso.aoRect(mu0, mv0, mu1, mv1, z0, 0.08, 0.45);
  iso.castShadow([
    [mu0, mv0],
    [mu1, mv0],
    [mu1, mv1],
    [mu0, mv1],
  ], z0, MH, 0.14);
  iso.box(mu0, mv0, mu1, mv1, z0, z0 + MH, mat('#f4f2ec', { right: -0.22 }));
  for (const zz of [z0 + 0.04, z0 + 0.13]) {
    iso.poly(iso.faceVQuad(mv1, mu0 + 0.04, mu1 - 0.04, zz, zz + 0.06), '#35668f');
    iso.poly(iso.faceUQuad(mu1, mv0 + 0.04, mv1 - 0.04, zz, zz + 0.06), '#284f70');
    for (let u = mu0 + 0.04; u < mu1 - 0.03; u += 0.06) iso.line([u, mv1 + 0.001, zz], [u, mv1 + 0.001, zz + 0.06], alpha('#e8f0f4', 0.5), 0.7);
    iso.line([mu0 + 0.04, mv1 + 0.001, zz + 0.06], [mu1 - 0.04, mv1 + 0.001, zz + 0.06], alpha('#ffffff', 0.7), 0.9);
  }
  iso.box(0.62, mv1, 0.92, mv1 + 0.08, z0, z0 + 0.1, mat('#e8e4dc'));
  iso.poly(iso.faceVQuad(mv1 + 0.08, 0.68, 0.86, z0, z0 + 0.07), '#3a4a5a');
  iso.poly(iso.topQuad(mu0 + 0.02, mv0 + 0.02, mu1 - 0.02, mv1 - 0.02, z0 + MH + 0.001), '#d8d4ca');
  iso.box(mu0, mv0, mu1, mv0 + 0.02, z0 + MH, z0 + MH + 0.025, mat('#f4f2ec'));
  iso.box(mu0, mv0, mu0 + 0.02, mv1, z0 + MH, z0 + MH + 0.025, mat('#f4f2ec'));
  // small rooftop dishes
  for (const [u, v] of [
    [0.5, 1.35],
    [0.95, 1.4],
  ] as [number, number][]) {
    iso.line([u, v, z0 + MH], [u, v, z0 + MH + 0.06], '#8a8f96', 1.4);
    disc(iso, [u, v, z0 + MH + 0.08], [0.05, 0.05, 0], [-0.04, 0.04, 0.035], '#e8ecee');
  }
  // flag pole with the tricolour and palms
  pole(iso, 1.3, 2.3, z0, 0.38, '#d8d4c8', 1.2);
  for (const [i, col] of [C.saffron, '#f6f4ee', '#2f8a3a'].entries()) {
    iso.poly([
      [1.3, 2.3, z0 + 0.37 - i * 0.025],
      [1.42, 2.18, z0 + 0.37 - i * 0.025],
      [1.42, 2.18, z0 + 0.345 - i * 0.025],
      [1.3, 2.3, z0 + 0.345 - i * 0.025],
    ], col);
  }
  iso.ellipse(1.36, 2.24, z0 + 0.345, 0.008, '#1f3f8a');
  const palmSpots: [number, number, number][] = [
    [0.2, 2.3, 0.28],
    [0.55, 2.75, 0.3],
    [0.95, 2.45, 0.26],
    [2.85, 1.6, 0.3],
    [1.9, 2.85, 0.28],
    [2.9, 2.9, 0.26],
  ];
  for (const [u, v, hh] of palmSpots) palm(iso, u, v, z0, hh, rng);
  // staff bus on the road
  iso.box(0.4, 1.95, 0.75, 2.05, z0 + 0.01, z0 + 0.08, mat('#f4f2ec'));
  iso.poly(iso.faceVQuad(2.051, 0.42, 0.73, z0 + 0.045, z0 + 0.07), '#2f4a5e');
  iso.poly(iso.faceVQuad(2.051, 0.4, 0.75, z0 + 0.02, z0 + 0.03), '#1f4f8a');
  crowd(iso, rng, 1.0, 1.8, 1.45, 1.9, z0, 5, 0.05);
}

// ============================================================================
// MELA GROUND (4×4)
// ============================================================================

/** Giant wheel in the plane v = vc, facing the viewer's left. */
function giantWheel(iso: Iso, rng: Rng, uc: number, vc: number, z: number, R: number): void {
  const zc = z + R + 0.1;
  const spokes = 16;
  const halfW = 0.045;
  // shadow on the ground
  iso.poly([
    [uc - R * 0.2, vc - 0.05, z],
    [uc + R * 1.4, vc - 0.3, z],
    [uc + R * 1.6, vc - 0.1, z],
    [uc + R * 0.2, vc + 0.05, z],
  ], alpha('#2a1a10', 0.14));
  const rim = (dv: number, col: string, lw: number) => iso.polyline(ringPts([uc, vc + dv, zc], [R, 0, 0], [0, 0, R], 64), col, lw);
  const legs = (dv: number, col: string) => {
    iso.line([uc - R * 0.55, vc + dv * 3, z], [uc, vc + dv, zc], col, 3.2);
    iso.line([uc + R * 0.55, vc + dv * 3, z], [uc, vc + dv, zc], col, 3.2);
    iso.line([uc - R * 0.28, vc + dv * 2, z + R * 0.5], [uc + R * 0.28, vc + dv * 2, z + R * 0.5], col, 1.6);
  };
  // back frame
  legs(-halfW, '#8a4a2a');
  rim(-halfW, '#6a3a22', 2.4);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    iso.line([uc, vc - halfW, zc], [uc + Math.cos(a) * R, vc - halfW, zc + Math.sin(a) * R], alpha('#6a3a22', 0.7), 0.9);
  }
  // gondolas hanging between the rims
  const gcols = ['#d8452f', '#f0b429', '#2f7fbf', '#3aa66a', '#e86aa6', '#f08a24'];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + 0.1;
    const gu = uc + Math.cos(a) * R;
    const gz = zc + Math.sin(a) * R;
    const col = gcols[i % gcols.length];
    iso.line([gu, vc, gz], [gu, vc, gz - 0.04], '#3a2a1e', 0.9);
    iso.box(gu - 0.03, vc - 0.035, gu + 0.03, vc + 0.035, gz - 0.085, gz - 0.04, mat(col));
    iso.box(gu - 0.035, vc - 0.04, gu + 0.035, vc + 0.04, gz - 0.04, gz - 0.03, mat(shade(col, 0.2)), { edges: false });
    if (rng() < 0.6) person(iso, gu, vc + 0.02, gz - 0.07, CLOTHES[i % CLOTHES.length], rng, 0.035);
  }
  // hub + front frame
  iso.line([uc, vc - halfW, zc], [uc, vc + halfW, zc], '#4a3a2a', 4);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    iso.line([uc, vc + halfW, zc], [uc + Math.cos(a) * R, vc + halfW, zc + Math.sin(a) * R], '#c0392b', 1.1);
  }
  rim(halfW, '#8a2a1e', 3.4);
  rim(halfW, '#e0503a', 2);
  iso.polyline(ringPts([uc, vc + halfW, zc], [R * 0.45, 0, 0], [0, 0, R * 0.45], 32), '#f0b429', 1.2);
  // bulbs
  const { ctx } = iso;
  const pts = ringPts([uc, vc + halfW + 0.002, zc], [R, 0, 0], [0, 0, R], 48);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, y] = iso.pt(...pts[i]);
    ctx.fillStyle = alpha(i % 2 ? '#fff2a8' : '#ffd070', 0.9);
    ctx.fillRect(x - 0.9 * iso.px, y - 0.9 * iso.px, 1.8 * iso.px, 1.8 * iso.px);
  }
  iso.ellipse(uc, vc + halfW, zc, 0.03, '#f0b429', alpha('#3a2a1e', 0.7), 1);
  legs(halfW, '#b8603a');
  // ticket booth
  iso.box(uc - 0.1, vc + 0.12, uc + 0.06, vc + 0.24, z, z + 0.1, mat('#f0b429'));
  iso.box(uc - 0.12, vc + 0.1, uc + 0.08, vc + 0.26, z + 0.1, z + 0.115, mat('#c0392b'));
}

/** Carousel with a striped cone roof, horses and a central mirrored column. */
function carousel(iso: Iso, rng: Rng, u: number, v: number, z: number, r: number, c1: string, c2: string): void {
  iso.aoEllipse(u, v, r, z, 0.06, 0.4);
  iso.cylinder(u, v, r, z, z + 0.035, '#8a5a3a', shade('#c9a877', 0.05));
  const H = 0.18;
  // horses and poles, back to front
  const items: { a: number; d: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    items.push({ a, d: Math.cos(a) + Math.sin(a) });
  }
  items.sort((p, q) => p.d - q.d);
  const col = (p: { a: number }) => (Math.round(p.a * 10) % 2 ? '#f4f0e6' : '#e0a040');
  const drawItem = (p: { a: number }) => {
    const pu = u + Math.cos(p.a) * r * 0.75;
    const pv = v + Math.sin(p.a) * r * 0.75;
    iso.line([pu, pv, z + 0.035], [pu, pv, z + 0.035 + H], '#d9a52b', 1.2);
    iso.box(pu - 0.025, pv - 0.012, pu + 0.025, pv + 0.012, z + 0.07, z + 0.1, mat(col(p)), { edges: true });
    iso.box(pu + 0.015, pv - 0.01, pu + 0.03, pv + 0.01, z + 0.1, z + 0.125, mat(col(p)), { edges: false });
  };
  items.filter((p) => p.d < 0).forEach(drawItem);
  iso.cylinder(u, v, 0.06, z + 0.035, z + 0.035 + H, '#d9a52b', null);
  iso.speckle(ringPts([u, v, z + 0.1], [0.06, 0, 0], [0, 0.06, 0], 8), rng, 20, ['#fff6d0', '#f0b429'], 1.4);
  items.filter((p) => p.d >= 0).forEach(drawItem);
  stripedCone(iso, u, v, z + 0.035 + H, r * 1.08, 0.16, [c1, c2]);
  flag(iso, u, v, z + 0.035 + H + 0.15, 0.12, C.saffron);
  bunting(iso, [u - r, v + r * 0.2, z + H], [u + r * 0.2, v + r, z + H], ['#fff2a8', '#ffd070'], 'bulbs', 0.01);
}

/** Chair-o-plane (jhula) swing ride. */
function swingRide(iso: Iso, u: number, v: number, z: number, r: number): void {
  iso.aoEllipse(u, v, r * 0.5, z, 0.06, 0.35);
  const H = 0.42;
  iso.cylinder(u, v, 0.03, z, z + H, '#c0392b', null);
  const chairs: { a: number; d: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    chairs.push({ a, d: Math.cos(a) + Math.sin(a) });
  }
  chairs.sort((p, q) => p.d - q.d);
  const cols = ['#2f7fbf', '#f0b429', '#3aa66a', '#e86aa6'];
  const drawChair = (p: { a: number }, i: number) => {
    const top: P3 = [u + Math.cos(p.a) * r * 0.6, v + Math.sin(p.a) * r * 0.6, z + H - 0.03];
    const ch: P3 = [u + Math.cos(p.a) * r, v + Math.sin(p.a) * r, z + H - 0.2];
    iso.line(top, ch, alpha('#3a3a3e', 0.8), 0.7);
    iso.box(ch[0] - 0.015, ch[1] - 0.015, ch[0] + 0.015, ch[1] + 0.015, ch[2] - 0.02, ch[2], mat(cols[i % cols.length]), { edges: false });
  };
  chairs.filter((p) => p.d < 0).forEach(drawChair);
  stripedCone(iso, u, v, z + H - 0.04, r * 0.62, 0.12, ['#f0b429', '#c0392b']);
  chairs.filter((p) => p.d >= 0).forEach(drawChair);
}

/** Decorated mela entrance gate (torana) on the +v edge, centred at u. */
function melaGate(iso: Iso, u: number, v: number, z: number, wdt: number): void {
  const H = 0.36;
  const pw = 0.07;
  const pil = (pu: number) => {
    iso.box(pu, v - pw / 2, pu + pw, v + pw / 2, z, z + H, mat('#f0b429'));
    for (let zz = z + 0.04; zz < z + H; zz += 0.07) {
      iso.poly(iso.faceVQuad(v + pw / 2, pu, pu + pw, zz, zz + 0.025), '#c0392b');
      iso.poly(iso.faceUQuad(pu + pw, v - pw / 2, v + pw / 2, zz, zz + 0.025), shade('#c0392b', -0.25));
    }
    dome(iso, pu + pw / 2, v, z + H, 0.045, '#e8761a', 'onion', C.gold);
  };
  pil(u - wdt / 2 - pw);
  // arched board
  const n = 16;
  const top: P3[] = [];
  const bot: P3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const uu = u - wdt / 2 + wdt * t;
    const arch = Math.sin(Math.PI * t) * 0.06;
    top.push([uu, v + 0.01, z + H - 0.02 + arch + 0.05]);
    bot.push([uu, v + 0.01, z + H - 0.08 + arch]);
  }
  iso.poly([...top, ...bot.reverse()], '#c0392b', alpha('#3a1a10', 0.7), 1);
  for (let i = 0; i < 5; i++) {
    const t0 = 0.12 + i * 0.16;
    const uu = u - wdt / 2 + wdt * t0;
    const arch = Math.sin(Math.PI * (t0 + 0.05)) * 0.06;
    iso.poly(iso.faceVQuad(v + 0.012, uu, uu + wdt * 0.1, z + H - 0.06 + arch, z + H - 0.015 + arch), ['#f0b429', '#f4f0e6', '#3aa66a', '#f4f0e6', '#f0b429'][i]);
  }
  pil(u + wdt / 2);
  // marigold garland swags
  const sw: P3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    sw.push([u - wdt / 2 + wdt * t, v + 0.015, z + H - 0.1 - Math.sin(Math.PI * t) * 0.03]);
  }
  iso.polyline(sw, '#e0761a', 2.2);
  iso.polyline(sw.map((p) => [p[0], p[1], p[2] - 0.004] as P3), alpha('#f5c030', 0.9), 1);
}

const MELA_TENTS = [
  ['#d8452f', '#f4e6c8'],
  ['#f0b429', '#c0392b'],
  ['#2f7fbf', '#f4f0e6'],
  ['#3aa66a', '#f0e0a0'],
  ['#e86aa6', '#f4f0e6'],
] as const;

function drawMela(ctx: Ctx, w: number, h: number, variant: number): void {
  const iso = makeIso(ctx, w, h, 4);
  const rng = seededRng('amusement_park', variant);
  const z0 = 0.02;
  slab(iso, rng, 0.03, z0, '#cfb088', '#8a6b4a', []);
  const ground = iso.topQuad(0.03, 0.03, 3.97, 3.97, z0);
  iso.speckle(ground, rng, 3000, ['#c09e74', '#dcc09a', '#b8966a', alpha('#8a6b4a', 0.5)], 1.4);
  // trampled paths + grass at the edges
  for (let i = 0; i < 10; i++) iso.ellipse(0.6 + rng() * 2.8, 0.6 + rng() * 2.8, z0, 0.2 + rng() * 0.25, alpha('#e2c8a0', 0.25));
  for (const [u, v, r] of [
    [0.3, 0.3, 0.3],
    [3.7, 0.3, 0.3],
    [0.3, 3.6, 0.25],
  ] as [number, number, number][])
    iso.ellipse(u, v, z0, r, alpha(C.grass, 0.55));
  // bamboo fence along the back edges
  const fence = (along: 'u' | 'v') => {
    for (let a = 0.08; a < 3.95; a += 0.12) {
      const p: P3 = along === 'u' ? [a, 0.06, z0] : [0.06, a, z0];
      iso.line(p, [p[0], p[1], z0 + 0.08], '#8a6a42', 1.2);
    }
    const a: P3 = along === 'u' ? [0.06, 0.06, z0 + 0.06] : [0.06, 0.06, z0 + 0.06];
    const b: P3 = along === 'u' ? [3.95, 0.06, z0 + 0.06] : [0.06, 3.95, z0 + 0.06];
    iso.line(a, b, '#a07a4a', 1.2);
    iso.line([a[0], a[1], a[2] - 0.03], [b[0], b[1], b[2] - 0.03], '#a07a4a', 1.2);
  };
  fence('u');
  fence('v');
  const flip = variant % 2 === 1;
  const X = (u: number) => (flip ? 4 - u : u);
  const list = new DepthList();
  const at = (u: number, v: number, f: () => void) => list.add(u + v, f);
  // big rides
  const wu = X(1.35);
  at(wu + 0.3, 1.0, () => giantWheel(iso, rng, wu, 0.95, z0, 0.78));
  const cu = X(3.05);
  at(cu, 1.2, () => carousel(iso, rng, cu, 1.2, z0, 0.34, variant ? '#2f7fbf' : '#d8452f', '#f4f0e6'));
  if (variant % 2 === 0) at(X(3.25), 2.25, () => swingRide(iso, X(3.25), 2.25, z0, 0.32));
  else at(X(3.25), 2.2, () => iso.tree(X(3.25), 2.2, z0, 0.2, rng, 'peepal'));
  // shamianas
  const tents: [number, number, number][] = [
    [0.35, 1.95, 0.45],
    [1.1, 2.05, 0.38],
    [2.0, 1.75, 0.42],
  ];
  tents.forEach(([u, v, s], i) => {
    const uu = flip ? 4 - u - s : u;
    const [c1, c2] = MELA_TENTS[(i + variant * 2) % MELA_TENTS.length];
    at(uu + s, v + s, () => shamiana(iso, uu, v, s, z0, 0.14, 0.14, c1, c2));
  });
  // stalls in two rows
  const goods = ['#f5a623', '#e0761a', '#f4e04a', '#d8452f', '#8a3a1a', '#f4f0e6'];
  const boards = ['#c0392b', '#1f9e9a', '#f0b429', '#2f6fb3', '#3aa66a', '#8e44ad'];
  const tarps = ['#2f6fb3', '#d8452f', '#f0b429', '#3aa66a', '#e86aa6', '#2f6fb3'];
  for (let i = 0; i < 5; i++) {
    const u = 0.25 + i * 0.36;
    const uu = flip ? 4 - u - 0.3 : u;
    at(uu + 0.3, 2.95, () => stall(iso, rng, uu, 2.8, 0.3, 0.16, z0, tarps[i], boards[(i + 2) % boards.length], goods));
  }
  for (let i = 0; i < 4; i++) {
    const u = 2.35 + i * 0.4;
    const uu = flip ? 4 - u - 0.3 : u;
    at(uu + 0.3, 3.35, () => stall(iso, rng, uu, 3.2, 0.3, 0.16, z0, tarps[(i + 3) % tarps.length], boards[i], goods));
  }
  // light strings between bamboo poles
  const poles: [number, number][] = [
    [0.3, 1.7],
    [1.6, 1.6],
    [2.8, 1.75],
    [0.3, 2.7],
    [1.9, 2.6],
    [3.7, 2.7],
  ];
  const ph = 0.3;
  for (const [u, v] of poles) at(X(u), v, () => pole(iso, X(u), v, z0, ph, '#8a6a42', 1.3));
  const strings: [number, number][] = [
    [0, 1],
    [1, 2],
    [3, 4],
    [4, 5],
    [0, 3],
    [2, 5],
  ];
  const bulbCols = ['#fff2a8', '#ff8a5a', '#8ad0ff', '#b8ff8a', '#ffd070'];
  const flagCols = ['#d8452f', '#f0b429', '#2f7fbf', '#3aa66a', '#e86aa6'];
  strings.forEach(([a, b], i) => {
    const pa = poles[a];
    const pb = poles[b];
    at(Math.max(X(pa[0]) + pa[1], X(pb[0]) + pb[1]) + 0.01, 0, () =>
      bunting(iso, [X(pa[0]), pa[1], z0 + ph], [X(pb[0]), pb[1], z0 + ph], i % 2 ? bulbCols : flagCols, i % 2 ? 'bulbs' : 'flags', 0.05),
    );
  });
  // crowds (added as small groups so they interleave with the stalls)
  const groups: [number, number, number, number, number][] = [
    [0.4, 2.5, 2.2, 2.75, 22],
    [0.5, 3.05, 2.2, 3.2, 12],
    [2.3, 3.55, 3.8, 3.8, 14],
    [2.3, 2.6, 3.0, 3.1, 10],
    [0.3, 1.2, 1.2, 1.7, 10],
    [2.2, 1.0, 2.7, 1.5, 6],
  ];
  for (const [u0, v0, u1, v1, n] of groups) {
    for (let i = 0; i < n; i++) {
      const u = X(u0 + rng() * (u1 - u0));
      const v = v0 + rng() * (v1 - v0);
      const col = CLOTHES[Math.floor(rng() * CLOTHES.length)];
      at(u + v, 0, () => person(iso, u, v, z0, col, rng, 0.05));
    }
  }
  // balloon seller
  const bu = X(1.9);
  at(bu + 3.0, 0, () => {
    person(iso, bu, 3.0, z0, '#f4f0e6', rng, 0.05);
    const { ctx: c } = iso;
    const [x, y] = iso.pt(bu + 0.02, 3.0, z0 + 0.12);
    for (let i = 0; i < 9; i++) {
      const bx = x + (rng() - 0.5) * 10 * iso.px;
      const by = y - rng() * 8 * iso.px;
      c.strokeStyle = alpha('#3a3a3e', 0.5);
      c.lineWidth = 0.5 * iso.px;
      c.beginPath();
      c.moveTo(x, y + 8 * iso.px);
      c.lineTo(bx, by);
      c.stroke();
      iso.blob(bx, by, 2.4 * iso.px, flagCols[i % flagCols.length], 0.3);
    }
  });
  list.draw();
  melaGate(iso, X(0.95), 3.9, z0, 0.55);
  iso.tree(X(3.75), 3.7, z0, 0.14, rng, 'neem');
}

// ============================================================================
// Registry
// ============================================================================

export const SPECIAL_SPRITES: Record<string, ProceduralSpriteDef> = {
  stadium: { footprint: 3, variants: 2, heightTiles: 0.6, draw: drawStadium },
  museum: { footprint: 3, variants: 2, heightTiles: 0.5, draw: drawMuseum },
  airport: { footprint: 4, variants: 2, heightTiles: 0.2, draw: drawAirport },
  space_program: { footprint: 3, variants: 1, heightTiles: 0.35, draw: drawSpaceProgram },
  amusement_park: { footprint: 4, variants: 2, heightTiles: 0.5, draw: drawMela },
};

