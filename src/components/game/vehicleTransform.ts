/** Sets the canvas matrix for a vehicle at world (x,y) rotated by angle in ONE call, replacing save/translate/rotate/restore. */
export function setVehicleTransform(
  ctx: { setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void },
  x: number, y: number, cos: number, sin: number, scale: number, tx: number, ty: number,
): void {
  // scale = dpr*zoom ; tx,ty = dpr*offset (device px)
  ctx.setTransform(scale * cos, scale * sin, -scale * sin, scale * cos, scale * x + tx, scale * y + ty);
}
