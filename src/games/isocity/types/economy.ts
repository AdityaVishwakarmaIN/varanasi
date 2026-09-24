/**
 * IsoCity Economy Types
 */

/** Supply and demand of one utility, and its rolling cuts (S3-T7 power, S3-T8 water). */
export interface UtilitySupplyStats {
  supply: number;
  demand: number;
  /** min(1, supply / demand); below 1 means rotating cuts. */
  ratio: number;
  /** Feeder blocks (see feederZones) that have demand, sorted. */
  feeders: number[];
  /** Feeder blocks cut during this tick. */
  cut: number[];
}

export interface Stats {
  population: number;
  jobs: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  demand: {
    residential: number;
    commercial: number;
    industrial: number;
  };
  /** Varanasi map only (S2-T7): river health 0-100 (a slow stock) and where it is heading. */
  gangaHealth?: number;
  gangaHealthTarget?: number;
  /** Varanasi map only (S2-T9): monthly tourism income, included in `income`. */
  tourismIncome?: number;
  /** Monthly tax income (the rest of `income`). */
  taxIncome?: number;
  /** Power and water capacity (S3-T7/T8). Missing in old saves until the next tick. */
  power?: UtilitySupplyStats;
  water?: UtilitySupplyStats;
}

export interface BudgetCategory {
  name: string;
  funding: number;
  cost: number;
}

export interface Budget {
  police: BudgetCategory;
  fire: BudgetCategory;
  health: BudgetCategory;
  education: BudgetCategory;
  transportation: BudgetCategory;
  parks: BudgetCategory;
  power: BudgetCategory;
  water: BudgetCategory;
}

export interface CityEconomy {
  population: number;
  jobs: number;
  income: number;
  expenses: number;
  happiness: number;
  lastCalculated: number;
}

export interface HistoryPoint {
  year: number;
  month: number;
  population: number;
  money: number;
  happiness: number;
  /** Varanasi map only. */
  gangaHealth?: number;
}
