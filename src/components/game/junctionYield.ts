/**
 * Junction negotiation (Ember, arena round 2): a car held by a red light may roll through when nobody is
 * crossing. It still waits if any car is in the junction or close on the cross street, so a lit junction
 * with traffic behaves as before and an empty one stops holding cars for nothing.
 * Pure and allocation-free; a thin call site in vehicleSystems.updateCars uses it.
 */
import type { Car, CarDirection } from './types';

const isNorthSouth = (d: CarDirection) => d === 'north' || d === 'south';

export function canRollThroughRed(
  carsByTile: Map<number, Car[]>,
  gridSize: number,
  junctionX: number,
  junctionY: number,
  direction: CarDirection,
  /** Cross-street tiles on each side that count as "close" (default 2). */
  reach = 2
): boolean {
  const inJunction = carsByTile.get(junctionY * gridSize + junctionX);
  if (inJunction && inJunction.length > 0) return false;
  const ns = isNorthSouth(direction);
  for (let d = 1; d <= reach; d++) {
    for (let side = -1; side <= 1; side += 2) {
      const tx = ns ? junctionX + side * d : junctionX;
      const ty = ns ? junctionY : junctionY + side * d;
      if (tx < 0 || ty < 0 || tx >= gridSize || ty >= gridSize) continue;
      const cars = carsByTile.get(ty * gridSize + tx);
      if (!cars) continue;
      for (let i = 0; i < cars.length; i++) {
        // A cross-street car counts when it is on that axis (it may be heading for the junction)
        if (isNorthSouth(cars[i].direction) !== ns) return false;
      }
    }
  }
  return true;
}
