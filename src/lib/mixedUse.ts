/**
 * Mixed-use commercial (S3-T6): small bazaar shops and low offices at level ≥ 2 also house residents
 * ("shops below, homes above"). Applies to all maps.
 *
 * Jobs in `evolveBuilding` (src/lib/simulation.ts) are
 *   jobs = floor(maxJobs × max(1, level) × efficiency × 0.8), efficiency = 0.5·powered + 0.5·watered.
 * Residents mirror that exactly, with maxJobs replaced by maxJobs × residentRatio:
 *   residents = floor(maxJobs × residentRatio × max(1, level) × efficiency × fillFactor)
 */
import type { BuildingType } from '@/games/isocity/types/buildings';
import { formatIndianNumber } from '@/lib/format';

export const MIXED_USE_CONFIG = {
  /** Commercial building types that get homes above. */
  types: ['shop_small', 'shop_medium', 'office_low'] as readonly BuildingType[],
  /** Minimum building level for homes above. */
  minLevel: 2,
  /** MIXED_USE_RESIDENT_RATIO: residents per job slot (before level scaling). */
  residentRatio: 0.4,
  /** Same 0.8 fill factor `evolveBuilding` applies to jobs and population. */
  fillFactor: 0.8,
} as const;

/** True when a building of this type and level has homes above. */
export function isMixedUse(buildingType: BuildingType, level: number): boolean {
  return MIXED_USE_CONFIG.types.includes(buildingType) && level >= MIXED_USE_CONFIG.minLevel;
}

/**
 * Residents living above a commercial building. 0 for non-mixed-use types or levels below minLevel.
 * @param maxJobs BUILDING_STATS[type].maxJobs
 * @param efficiency 0–1, the same utility efficiency used for jobs (defaults to fully served)
 */
export function getMixedUseResidents(buildingType: BuildingType, level: number, maxJobs: number, efficiency = 1): number {
  if (!isMixedUse(buildingType, level) || !(maxJobs > 0)) return 0;
  const eff = Math.min(1, Math.max(0, efficiency));
  const c = MIXED_USE_CONFIG;
  return Math.floor(maxJobs * c.residentRatio * Math.max(1, level) * eff * c.fillFactor);
}

/** Tile-info line: "Shops: 45 jobs · Homes above: 18 residents". */
export function formatMixedUseInfo(jobs: number, residents: number): string {
  return `Shops: ${formatIndianNumber(jobs)} jobs · Homes above: ${formatIndianNumber(residents)} residents`;
}
