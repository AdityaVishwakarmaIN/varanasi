import { describe, it, expect } from 'vitest';
import { setVehicleTransform } from '../vehicleTransform';
describe('setVehicleTransform', () => {
  it('matches scale/translate/translate/rotate composition', () => {
    const dpr = 2, zoom = 1.5, ox = 30, oy = -12, X = 100, Y = 50, ang = 0.7;
    let m: number[] = [];
    setVehicleTransform({ setTransform: (...a) => { m = a; } }, X, Y, Math.cos(ang), Math.sin(ang), dpr * zoom, dpr * ox, dpr * oy);
    const px = 1, py = 2;
    const rx = px * Math.cos(ang) - py * Math.sin(ang) + X, ry = px * Math.sin(ang) + py * Math.cos(ang) + Y;
    const ex = dpr * zoom * (rx + ox / zoom), ey = dpr * zoom * (ry + oy / zoom);
    expect(m[0] * px + m[2] * py + m[4]).toBeCloseTo(ex);
    expect(m[1] * px + m[3] * py + m[5]).toBeCloseTo(ey);
  });
  it('one call per vehicle instead of four', () => {
    let n = 0; const c = { setTransform: () => { n++; } };
    for (let i = 0; i < 1000; i++) setVehicleTransform(c, i, i, 1, 0, 1, 0, 0);
    expect(n).toBe(1000);
  });
});
