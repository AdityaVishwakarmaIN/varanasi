/**
 * Failure states: debt, the emergency loan, bankruptcy and exodus (Sprint 4, S4-T11).
 * Pure monthly state machine; tunables in FAILURE_CONFIG.
 *
 * Call `advanceFailureState` once at each month change with end-of-month numbers. It returns the new state
 * and a list of events for the UI (banners, the loan dialog, abandonment, game over). The loan dialog's
 * buttons call `acceptEmergencyLoan` / `declineEmergencyLoan`; each month the caller also runs
 * `applyLoanRepayment` while a loan is being repaid.
 *
 * These are NOT switched off by the "Crises" (disastersEnabled) setting.
 */

export const FAILURE_CONFIG = {
  /** Consecutive months with money < 0 before the one-time emergency loan is offered. */
  loanOfferAfterDebtMonths: 3,
  /** Loan amount = this many months of current expenses. */
  loanExpenseMonths: 6,
  /** Share of monthly income taken to repay the loan, and for how many months. */
  loanRepaymentShare: 0.15,
  loanRepaymentMonths: 24,
  /** Consecutive months with money < 0, after the loan was used or declined, that end the game. */
  bankruptcyAfterDebtMonths: 6,
  /** Happiness below this is "critical". */
  criticalHappiness: 30,
  /** Consecutive critical months before people start leaving. */
  exodusAfterMonths: 12,
  /** Share of residential buildings abandoned each month during an exodus. */
  exodusAbandonmentShare: 0.02,
  /** During an exodus, the game ends when displayed population < this share of its all-time peak. */
  exodusGameOverPeakShare: 0.2,
} as const;

/** Emergency loan status. `offered` = dialog shown, not answered yet. */
export type LoanStatus = 'none' | 'offered' | 'accepted' | 'declined';

/** A loan being repaid from income. */
export interface LoanState {
  monthsRemaining: number;
  /** Share of monthly income taken (0.15). */
  share: number;
}

export type GameOverReason = 'bankruptcy' | 'exodus';

/** Store as `failure?: FailureState` on GameState (undefined in old saves → `createFailureState()`). */
export interface FailureState {
  /** Consecutive month-ends with money < 0. */
  monthsInDebt: number;
  loanStatus: LoanStatus;
  /** Amount offered (set when the loan is offered). */
  loanOfferAmount?: number;
  /** Repayment in progress, if the loan was accepted and is not paid off. */
  loan?: LoanState;
  /** Consecutive negative month-ends counted after the loan was accepted or declined. */
  debtMonthsAfterLoan: number;
  /** Consecutive month-ends with happiness below `criticalHappiness`. */
  lowHappinessMonths: number;
  exodusActive: boolean;
  peakDisplayedPopulation: number;
  peakGangaHealth?: number;
  gameOver?: GameOverReason;
}

/** End-of-month numbers. */
export interface FailureMonthInput {
  money: number;
  happiness: number;
  /** Population as shown to the player (× POPULATION_DISPLAY_SCALE). */
  displayedPopulation: number;
  /** Current monthly expenses (for the loan amount). */
  monthlyExpenses: number;
  /** Optional, tracked for the game-over screen. */
  gangaHealth?: number;
}

export type FailureEvent =
  | { type: 'debt'; monthsInDebt: number }
  | { type: 'debtCleared' }
  | { type: 'loanOffered'; amount: number }
  | { type: 'loanOfferExpired' }
  | { type: 'happinessCritical'; months: number }
  | { type: 'exodusStarted' }
  | { type: 'exodusAbandonment'; share: number }
  | { type: 'exodusEnded' }
  | { type: 'gameOver'; reason: GameOverReason };

/** Fresh state for a new city (or an old save). */
export function createFailureState(): FailureState {
  return {
    monthsInDebt: 0,
    loanStatus: 'none',
    debtMonthsAfterLoan: 0,
    lowHappinessMonths: 0,
    exodusActive: false,
    peakDisplayedPopulation: 0,
  };
}

/**
 * Monthly step. Order: peaks → debt counter → an unanswered loan offer expires (counts as declined) →
 * loan offer → bankruptcy counter → happiness / exodus → exodus game over. Once `gameOver` is set the state
 * no longer changes.
 */
export function advanceFailureState(
  prev: FailureState | undefined,
  input: FailureMonthInput
): { next: FailureState; events: FailureEvent[] } {
  const c = FAILURE_CONFIG;
  const s: FailureState = { ...(prev ?? createFailureState()) };
  const events: FailureEvent[] = [];
  if (s.gameOver) return { next: s, events };

  s.peakDisplayedPopulation = Math.max(s.peakDisplayedPopulation, input.displayedPopulation);
  if (input.gangaHealth !== undefined) s.peakGangaHealth = Math.max(s.peakGangaHealth ?? 0, input.gangaHealth);

  // --- Debt ---
  const inDebt = input.money < 0;
  if (inDebt) {
    s.monthsInDebt++;
    events.push({ type: 'debt', monthsInDebt: s.monthsInDebt });
  } else {
    if (s.monthsInDebt > 0) events.push({ type: 'debtCleared' });
    s.monthsInDebt = 0;
  }

  if (s.loanStatus === 'offered') {
    s.loanStatus = 'declined';
    events.push({ type: 'loanOfferExpired' });
  }

  if (inDebt && s.loanStatus === 'none' && s.monthsInDebt >= c.loanOfferAfterDebtMonths) {
    s.loanStatus = 'offered';
    s.loanOfferAmount = getEmergencyLoanAmount(input.monthlyExpenses);
    events.push({ type: 'loanOffered', amount: s.loanOfferAmount });
  }

  if (s.loanStatus === 'accepted' || s.loanStatus === 'declined') {
    s.debtMonthsAfterLoan = inDebt ? s.debtMonthsAfterLoan + 1 : 0;
    if (s.debtMonthsAfterLoan >= c.bankruptcyAfterDebtMonths) {
      s.gameOver = 'bankruptcy';
      events.push({ type: 'gameOver', reason: 'bankruptcy' });
      return { next: s, events };
    }
  }

  // --- Happiness / exodus ---
  if (input.happiness < c.criticalHappiness) {
    s.lowHappinessMonths++;
    events.push({ type: 'happinessCritical', months: s.lowHappinessMonths });
    if (s.lowHappinessMonths >= c.exodusAfterMonths) {
      if (!s.exodusActive) events.push({ type: 'exodusStarted' });
      s.exodusActive = true;
      events.push({ type: 'exodusAbandonment', share: c.exodusAbandonmentShare });
    }
  } else {
    s.lowHappinessMonths = 0;
    if (s.exodusActive) events.push({ type: 'exodusEnded' });
    s.exodusActive = false;
  }

  if (s.exodusActive && s.peakDisplayedPopulation > 0 && input.displayedPopulation < c.exodusGameOverPeakShare * s.peakDisplayedPopulation) {
    s.gameOver = 'exodus';
    events.push({ type: 'gameOver', reason: 'exodus' });
  }

  return { next: s, events };
}

/** Loan amount for the given monthly expenses (6 months' worth). */
export function getEmergencyLoanAmount(monthlyExpenses: number): number {
  return Math.max(0, Math.round(FAILURE_CONFIG.loanExpenseMonths * monthlyExpenses));
}

/** "Accept" in the loan dialog: returns the new state and the money to add. No-op unless a loan is on offer. */
export function acceptEmergencyLoan(state: FailureState): { next: FailureState; amount: number } {
  if (state.loanStatus !== 'offered') return { next: state, amount: 0 };
  return {
    next: {
      ...state,
      loanStatus: 'accepted',
      debtMonthsAfterLoan: 0,
      loan: { monthsRemaining: FAILURE_CONFIG.loanRepaymentMonths, share: FAILURE_CONFIG.loanRepaymentShare },
    },
    amount: state.loanOfferAmount ?? 0,
  };
}

/** "Decline" in the loan dialog. No-op unless a loan is on offer. */
export function declineEmergencyLoan(state: FailureState): FailureState {
  if (state.loanStatus !== 'offered') return state;
  return { ...state, loanStatus: 'declined', debtMonthsAfterLoan: 0 };
}

/**
 * Monthly loan repayment: 15% of (positive) monthly income, for 24 months. Add `payment` to expenses.
 * Returns `loan: undefined` once it is paid off (or when there is no loan).
 */
export function applyLoanRepayment(income: number, loan: LoanState | undefined): { payment: number; loan: LoanState | undefined } {
  if (!loan || loan.monthsRemaining <= 0) return { payment: 0, loan: undefined };
  const payment = Math.max(0, income) * loan.share;
  const monthsRemaining = loan.monthsRemaining - 1;
  return { payment, loan: monthsRemaining > 0 ? { ...loan, monthsRemaining } : undefined };
}

/** Months until the loan is offered while in debt (null when not in debt or already handled). */
export function monthsUntilLoanOffer(state: FailureState): number | null {
  if (state.monthsInDebt <= 0 || state.loanStatus !== 'none') return null;
  return Math.max(0, FAILURE_CONFIG.loanOfferAfterDebtMonths - state.monthsInDebt);
}

/** "X months until bankruptcy": only counts down once the loan was used or declined and the city is in debt. */
export function monthsUntilBankruptcy(state: FailureState): number | null {
  if (state.gameOver) return 0;
  if (state.loanStatus !== 'accepted' && state.loanStatus !== 'declined') return null;
  if (state.debtMonthsAfterLoan <= 0) return null;
  return Math.max(0, FAILURE_CONFIG.bankruptcyAfterDebtMonths - state.debtMonthsAfterLoan);
}

/** Months until the exodus starts while happiness is critical (null when it is not; 0 once it has started). */
export function monthsUntilExodus(state: FailureState): number | null {
  if (state.exodusActive) return 0;
  if (state.lowHappinessMonths <= 0) return null;
  return Math.max(0, FAILURE_CONFIG.exodusAfterMonths - state.lowHappinessMonths);
}

/** Stats `getTopFailingStat` looks at. Ratings are 0–100. */
export interface FailingStatInput {
  money: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  gangaHealth?: number;
}

export type FailingStat = 'money' | 'happiness' | 'health' | 'education' | 'safety' | 'environment' | 'gangaHealth';

/** "What went wrong" lines for the game-over screen. Wrap in `msg()` in UI code. */
export const FAILING_STAT_LINES: Record<FailingStat, string> = {
  money: 'The treasury ran dry.',
  happiness: 'Residents were deeply unhappy.',
  health: 'Poor healthcare left people sick.',
  education: 'There were too few schools.',
  safety: 'Crime and fires made people feel unsafe.',
  environment: 'Pollution choked the city.',
  gangaHealth: 'The Ganga became too polluted.',
};

/**
 * The stat most to blame. Negative money always wins (bankruptcy); otherwise the lowest 0–100 rating,
 * ties going to the earlier entry in: happiness, health, gangaHealth, safety, education, environment.
 */
export function getTopFailingStat(stats: FailingStatInput): { stat: FailingStat; value: number; line: string } {
  if (stats.money < 0) return { stat: 'money', value: stats.money, line: FAILING_STAT_LINES.money };
  const order = ['happiness', 'health', 'gangaHealth', 'safety', 'education', 'environment'] as const;
  let best: FailingStat = 'happiness';
  let bestValue = stats.happiness;
  for (const k of order) {
    const v = stats[k];
    if (v === undefined) continue;
    if (v < bestValue) {
      best = k;
      bestValue = v;
    }
  }
  return { stat: best, value: bestValue, line: FAILING_STAT_LINES[best] };
}
