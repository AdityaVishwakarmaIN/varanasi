/**
 * EMBER T1: smooth car following. Instead of a binary stop when a car is closer than FOLLOW_STOP_GAP,
 * the follower eases its speed with the distance to the car ahead (in tiles), so queues compress and
 * release like a platoon rather than stop-and-go. Pure, allocation-free.
 */
export const FOLLOW_STOP_GAP = 0.2;
export const FOLLOW_FREE_GAP = 0.55;
/** Width of the easing band above the hold distance. */
export const FOLLOW_BAND = FOLLOW_FREE_GAP - FOLLOW_STOP_GAP;

/**
 * 0 = hold, 1 = free flow; smooth ease between the two gaps. stopGap lets the caller pass a
 * kind-aware hold distance (bikes tuck closer than buses); the easing band keeps its width.
 */
export function followSpeedFactor(gap: number, stopGap: number = FOLLOW_STOP_GAP): number {
  const freeGap = stopGap + FOLLOW_BAND;
  if (gap <= stopGap) return 0;
  if (gap >= freeGap) return 1;
  const t = (gap - stopGap) / (freeGap - stopGap);
  return t * t * (3 - 2 * t) * 0.85 + t * 0.15;
}
