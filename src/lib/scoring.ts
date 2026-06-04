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
}

/** Happiness composite (0-100) — the headline score. */
export function calculateHappiness(inputs: HappinessInputs): number {
  const taxScore = 100 - inputs.taxRate * HAPPINESS.taxRatePenaltyPerPoint;
  return Math.min(
    ENV.scoreMax,
    inputs.safety * HAPPINESS.safety +
      inputs.health * HAPPINESS.health +
      inputs.education * HAPPINESS.education +
      inputs.environment * HAPPINESS.environment +
      inputs.jobSatisfaction * HAPPINESS.jobSatisfaction +
      taxScore * HAPPINESS.taxes
  );
}

export interface RatingsInput {
  services: ServiceCoverage;
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
  const safety = calculateSafetyScore(
    calculateAverageCoverage(input.services.police),
    calculateAverageCoverage(input.services.fire)
  );
  const health = calculateHealthScore(
    calculateAverageCoverage(input.services.health),
    input.totalPollution,
    input.totalTiles
  );
  const education = calculateEducationScore(calculateAverageCoverage(input.services.education));
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
  });

  return { safety, health, education, environment, jobSatisfaction, happiness };
}
