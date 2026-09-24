/**
 * IsoCity Economy Types
 */

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
