// Centralized scoring engine for IsoCity / Varanasi.
//
// Single source of truth for every score the game computes: the five 0-100
// ratings (safety, health, education, environment, job satisfaction) and the
// Happiness composite that aggregates them. All tunable weights live in
// SCORING_CONFIG; all formulas live in the pure functions below. Nothing
// outside this module should hard-code a scoring weight or formula.

import type { BuildingType, ServiceCoverage } from '@/types/game';

/** All tunable scoring weights and targets, grouped by the score they drive. */
export const SCORING_CONFIG = {
  environment: {
    /** Tree coverage (% of all tiles) that yields the maximum green score. */
    targetTreePercent: 25,
    /** Maximum value any rating can reach. */
    scoreMax: 100,
    /** A park counts as this fraction (%) of a tree toward green coverage. */
    parkWeightPercent: 50,
  },
  safety: {
    /** Police coverage weight. */
    police: 0.7,
    /** Fire coverage weight. */
    fire: 0.3,
  },
  health: {
    /** Hospital/health coverage weight. */
    coverage: 0.8,
    /** Clean-air (inverse pollution) weight. */
    cleanAir: 0.2,
  },
  /** Weights for the Happiness composite. Should sum to 1.0. */
  happiness: {
    safety: 0.15,
    health: 0.2,
    education: 0.15,
    environment: 0.15,
    jobSatisfaction: 0.2,
    taxes: 0.15,
    /** Each point of tax rate removes this many points from the tax sub-score. */
    taxRatePenaltyPerPoint: 3,
  },
  /** Ganga Health (Varanasi map only). See documentation/game-plan/sprint-2-varanasi-and-the-ganga.md, S2-T7. */
  ganga: {
    /** Land tiles within this many tiles of the Ganga drain into it. */
    catchmentRadius: 8,
    /** Each point of tile pollution in the catchment adds this much load. */
    industryWeight: 1.0,
    /** Each untreated resident/worker in the catchment adds this much load. */
    sewagePerPerson: 0.02,
    /** Load the river already carries when it reaches the city. */
    upstreamLoad: 30,
    /** Each riverside tree/park tile removes this much load. */
    riversideGreenCredit: 0.5,
    /** Net load at which the river's target health reaches 0. */
    riverCapacity: 120,
    /** Each in-game day, health moves this fraction of the way to its target (slow stock). */
    dailyApproach: 0.05,
    /** Trend arrow shows up/down when target differs from current by more than this. */
    trendThreshold: 2,
    /** Population one powered Sewage Treatment Plant can treat. */
    stpCapacity: 2000,
    /** Radius (tiles) an STP collects sewage from. */
    stpRadius: 14,
    /** Below this health, residents in the catchment suffer a health-coverage penalty. */
    lowHealthThreshold: 40,
    /** Health-coverage points lost by catchment residents when the river is below the threshold. */
    lowHealthCoveragePenalty: 20,
    /** Weight of Ganga Health in the Happiness composite (Varanasi only; other weights are scaled down to keep the sum 1). */
    happinessWeight: 0.05,
  },
} as const;

const { environment: ENV, safety: SAFETY, health: HEALTH, happiness: HAPPINESS } =
  SCORING_CONFIG;

/** Tiles that count toward the playable area used by environment scoring. */
export function isEnvironmentPlayableBuildingType(buildingType: BuildingType): boolean {
  return buildingType !== 'empty';
}

/** Average value across a service-coverage grid (0 when empty). */
export function calculateAverageCoverage(coverage: number[][]): number {
  let total = 0;
  let count = 0;
  for (const row of coverage) {
    for (const value of row) {
      total += value;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

/**
 * Environment rating (0-100). Tree coverage is measured against the full map
 * area (including water); parks act as a partial bonus; pollution subtracts.
 */
export function calculateEnvironmentScore(
  treeCount: number,
  parkCount: number,
  totalPollution: number,
  totalTiles: number
): number {
  if (totalTiles <= 0) return 0;

  const scaledTreeCoverage = treeCount * 100 + parkCount * ENV.parkWeightPercent;
  const scaledTargetCoverage = totalTiles * ENV.targetTreePercent;
  const greenScore = Math.floor((scaledTreeCoverage * ENV.scoreMax) / scaledTargetCoverage);
  const pollutionPenalty = Math.floor(totalPollution / totalTiles);

  return Math.min(ENV.scoreMax, Math.max(0, greenScore - pollutionPenalty));
}

/** Safety rating (0-100) from police and fire coverage. */
export function calculateSafetyScore(avgPoliceCoverage: number, avgFireCoverage: number): number {
  return Math.min(ENV.scoreMax, avgPoliceCoverage * SAFETY.police + avgFireCoverage * SAFETY.fire);
}

/** Health rating (0-100) from hospital coverage and clean air. */
export function calculateHealthScore(
  avgHealthCoverage: number,
  totalPollution: number,
  totalTiles: number
): number {
  const cleanAir = totalTiles > 0 ? 100 - totalPollution / totalTiles : 100;
  return Math.min(ENV.scoreMax, avgHealthCoverage * HEALTH.coverage + cleanAir * HEALTH.cleanAir);
}

/** Education rating (0-100) from education coverage. */
export function calculateEducationScore(avgEducationCoverage: number): number {
  return Math.min(ENV.scoreMax, avgEducationCoverage);
}

/** Job satisfaction (0-100): 100 when jobs meet or exceed population. */
export function calculateJobSatisfaction(jobs: number, population: number): number {
  return jobs >= population ? 100 : (jobs / (population || 1)) * 100;
}

export interface HappinessInputs {
  safety: number;
  health: number;
  education: number;
  environment: number;
  jobSatisfaction: number;
  taxRate: number;
  /** Varanasi map only: Ganga Health joins the composite with weight `SCORING_CONFIG.ganga.happinessWeight`. */
  gangaHealth?: number;
}

/** Happiness composite (0-100) — the headline score. */
export function calculateHappiness(inputs: HappinessInputs): number {
  const taxScore = 100 - inputs.taxRate * HAPPINESS.taxRatePenaltyPerPoint;
  const base = Math.min(
    ENV.scoreMax,
    inputs.safety * HAPPINESS.safety +
      inputs.health * HAPPINESS.health +
      inputs.education * HAPPINESS.education +
      inputs.environment * HAPPINESS.environment +
      inputs.jobSatisfaction * HAPPINESS.jobSatisfaction +
      taxScore * HAPPINESS.taxes
  );
  if (inputs.gangaHealth === undefined) return base;
  // Other weights are scaled down so all weights still sum to 1.
  const w = SCORING_CONFIG.ganga.happinessWeight;
  return Math.min(ENV.scoreMax, base * (1 - w) + Math.max(0, inputs.gangaHealth) * w);
}

/** Average coverage (0-100) of each percentage-based service grid. */
export interface CoverageAverages {
  police: number;
  fire: number;
  health: number;
  education: number;
}

export interface RatingsInput {
  services: ServiceCoverage;
  /**
   * Optional precomputed `calculateAverageCoverage` of each `services` grid. The simulation caches
   * these while coverage is unchanged; when omitted they are computed from `services`.
   */
  coverageAverages?: CoverageAverages;
  treeCount: number;
  parkCount: number;
  totalPollution: number;
  /** Tiles used for the health clean-air term (full grid: size * size). */
  totalTiles: number;
  /** Playable tiles used for the environment term. */
  playableTileCount: number;
  jobs: number;
  population: number;
  taxRate: number;
  /**
   * Varanasi map only (S2-T7): the river's effect on health and happiness.
   * `catchmentPopulationShare` = share (0-1) of the city's population living in the Ganga catchment.
   */
  ganga?: { health: number; catchmentPopulationShare: number };
}

export interface Ratings {
  safety: number;
  health: number;
  education: number;
  environment: number;
  jobSatisfaction: number;
  happiness: number;
}

/**
 * Compute all ratings plus the Happiness composite in one call. This is the
 * single entry point the simulation uses so scoring stays consistent everywhere.
 */
export function calculateRatings(input: RatingsInput): Ratings {
  const averages = input.coverageAverages ?? {
    police: calculateAverageCoverage(input.services.police),
    fire: calculateAverageCoverage(input.services.fire),
    health: calculateAverageCoverage(input.services.health),
    education: calculateAverageCoverage(input.services.education),
  };
  const safety = calculateSafetyScore(averages.police, averages.fire);
  const healthCoverage = input.ganga
    ? Math.max(0, averages.health - getGangaHealthCoveragePenalty(input.ganga.health, input.ganga.catchmentPopulationShare))
    : averages.health;
  const health = calculateHealthScore(healthCoverage, input.totalPollution, input.totalTiles);
  const education = calculateEducationScore(averages.education);
  const environment = calculateEnvironmentScore(
    input.treeCount,
    input.parkCount,
    input.totalPollution,
    input.playableTileCount
  );
  const jobSatisfaction = calculateJobSatisfaction(input.jobs, input.population);
  const happiness = calculateHappiness({
    safety,
    health,
    education,
    environment,
    jobSatisfaction,
    taxRate: input.taxRate,
    gangaHealth: input.ganga?.health,
  });

  return { safety, health, education, environment, jobSatisfaction, happiness };
}

// ---------------------------------------------------------------------------
// Ganga Health (S2-T7)
// ---------------------------------------------------------------------------

const GANGA = SCORING_CONFIG.ganga;

export interface GangaLoadInput {
  /** Sum of tile pollution over catchment land tiles. */
  catchmentPollution: number;
  /** Residents and workers in the catchment whose sewage is NOT treated by an STP. */
  untreatedPopulation: number;
  /** Tree/park tiles on the west riverfront or east floodplain. */
  riversideGreenTiles: number;
}

export interface GangaLoadResult {
  industrialLoad: number;
  sewageLoad: number;
  upstreamLoad: number;
  greenCredit: number;
  netLoad: number;
  /** 0-100: where Ganga Health is heading. */
  targetHealth: number;
}

/** Target Ganga Health (0-100) from what drains into the river. Pure. */
export function calculateGangaTargetHealth(input: GangaLoadInput): GangaLoadResult {
  const industrialLoad = Math.max(0, input.catchmentPollution) * GANGA.industryWeight;
  const sewageLoad = Math.max(0, input.untreatedPopulation) * GANGA.sewagePerPerson;
  const upstreamLoad = GANGA.upstreamLoad;
  const greenCredit = Math.max(0, input.riversideGreenTiles) * GANGA.riversideGreenCredit;
  const netLoad = Math.max(0, industrialLoad + sewageLoad + upstreamLoad - greenCredit);
  const targetHealth = 100 * (1 - Math.min(1, netLoad / GANGA.riverCapacity));
  return { industrialLoad, sewageLoad, upstreamLoad, greenCredit, netLoad, targetHealth };
}

/** One in-game day of the slow stock: move a fixed fraction of the way toward the target. */
export function stepGangaHealth(current: number, target: number): number {
  const next = current + (target - current) * GANGA.dailyApproach;
  return Math.min(100, Math.max(0, next));
}

export type GangaTrend = 'up' | 'down' | 'flat';

export function getGangaTrend(current: number, target: number): GangaTrend {
  if (target > current + GANGA.trendThreshold) return 'up';
  if (target < current - GANGA.trendThreshold) return 'down';
  return 'flat';
}

/** Health-coverage points lost city-wide when the river is below the low-health threshold (scaled by catchment share). */
export function getGangaHealthCoveragePenalty(gangaHealth: number, catchmentPopulationShare: number): number {
  if (gangaHealth >= GANGA.lowHealthThreshold) return 0;
  return GANGA.lowHealthCoveragePenalty * Math.min(1, Math.max(0, catchmentPopulationShare));
}
