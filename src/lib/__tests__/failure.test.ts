import { describe, expect, it } from 'vitest';
import {
  acceptEmergencyLoan,
  advanceFailureState,
  applyLoanRepayment,
  createFailureState,
  declineEmergencyLoan,
  getTopFailingStat,
  monthsUntilBankruptcy,
  monthsUntilExodus,
  monthsUntilLoanOffer,
  type FailureEvent,
  type FailureMonthInput,
  type FailureState,
} from '@/lib/failure';

const ok: FailureMonthInput = { money: 1000, happiness: 60, displayedPopulation: 10000, monthlyExpenses: 500 };
const broke: FailureMonthInput = { ...ok, money: -100 };
const miserable: FailureMonthInput = { ...ok, happiness: 20 };

function run(state: FailureState | undefined, months: FailureMonthInput[]) {
  let s = state;
  const all: FailureEvent[][] = [];
  for (const m of months) {
    const r = advanceFailureState(s, m);
    s = r.next;
    all.push(r.events);
  }
  return { state: s!, events: all };
}

const types = (events: FailureEvent[]) => events.map((e) => e.type);

describe('debt and the emergency loan', () => {
  it('counts months in debt and clears on recovery', () => {
    const r = run(undefined, [broke, broke, ok]);
    expect(r.events[0]).toContainEqual({ type: 'debt', monthsInDebt: 1 });
    expect(r.events[1]).toContainEqual({ type: 'debt', monthsInDebt: 2 });
    expect(types(r.events[2])).toContain('debtCleared');
    expect(r.state.monthsInDebt).toBe(0);
  });

  it('offers a loan of 6 x monthly expenses after 3 consecutive negative months', () => {
    const r = run(undefined, [broke, broke]);
    expect(r.state.loanStatus).toBe('none');
    expect(monthsUntilLoanOffer(r.state)).toBe(1);
    const third = advanceFailureState(r.state, broke);
    expect(third.events).toContainEqual({ type: 'loanOffered', amount: 3000 });
    expect(third.next.loanStatus).toBe('offered');
  });

  it('is offered only once per city', () => {
    const r = run(undefined, [broke, broke, broke]);
    const declined = declineEmergencyLoan(r.state);
    const later = run(declined, [ok, broke, broke, broke, broke, ok, broke, broke, broke]);
    const offers = later.events.flat().filter((e) => e.type === 'loanOffered');
    expect(offers).toHaveLength(0);
  });

  it('accepting pays out once and starts 24 months of 15% repayments', () => {
    const r = run(undefined, [broke, broke, broke]);
    const { next, amount } = acceptEmergencyLoan(r.state);
    expect(amount).toBe(3000);
    expect(next.loanStatus).toBe('accepted');
    expect(next.loan).toEqual({ monthsRemaining: 24, share: 0.15 });
    expect(acceptEmergencyLoan(next).amount).toBe(0);

    let loan = next.loan;
    let paid = 0;
    let months = 0;
    while (loan) {
      const step = applyLoanRepayment(2000, loan);
      paid += step.payment;
      loan = step.loan;
      months++;
    }
    expect(months).toBe(24);
    expect(paid).toBeCloseTo(24 * 300, 6);
    expect(applyLoanRepayment(-500, { monthsRemaining: 3, share: 0.15 }).payment).toBe(0);
    expect(applyLoanRepayment(1000, undefined)).toEqual({ payment: 0, loan: undefined });
  });

  it('an unanswered offer expires at the next month and counts as declined', () => {
    const r = run(undefined, [broke, broke, broke, broke]);
    expect(types(r.events[3])).toContain('loanOfferExpired');
    expect(r.state.loanStatus).toBe('declined');
    expect(r.state.debtMonthsAfterLoan).toBe(1);
  });
});

describe('bankruptcy', () => {
  it('ends the game after 6 consecutive negative months after declining', () => {
    const offered = run(undefined, [broke, broke, broke]).state;
    let s = declineEmergencyLoan(offered);
    for (let i = 1; i <= 5; i++) {
      const r = advanceFailureState(s, broke);
      s = r.next;
      expect(s.gameOver).toBeUndefined();
      expect(monthsUntilBankruptcy(s)).toBe(6 - i);
    }
    const last = advanceFailureState(s, broke);
    expect(last.next.gameOver).toBe('bankruptcy');
    expect(last.events).toContainEqual({ type: 'gameOver', reason: 'bankruptcy' });
    // Frozen once over.
    expect(advanceFailureState(last.next, ok)).toEqual({ next: last.next, events: [] });
  });

  it('a positive month resets the bankruptcy countdown', () => {
    let s = acceptEmergencyLoan(run(undefined, [broke, broke, broke]).state).next;
    s = run(s, [broke, broke, broke, broke, broke, ok]).state;
    expect(s.debtMonthsAfterLoan).toBe(0);
    expect(monthsUntilBankruptcy(s)).toBeNull();
    s = run(s, [broke, broke, broke, broke, broke]).state;
    expect(s.gameOver).toBeUndefined();
    expect(advanceFailureState(s, broke).next.gameOver).toBe('bankruptcy');
  });

  it('there is no bankruptcy countdown before the loan decision', () => {
    const s = run(undefined, [broke, broke]).state;
    expect(monthsUntilBankruptcy(s)).toBeNull();
    expect(run(undefined, Array(20).fill(ok)).state.gameOver).toBeUndefined();
  });
});

describe('exodus', () => {
  it('starts after 12 consecutive months of happiness below 30, abandoning 2% per month', () => {
    const r = run(undefined, Array(11).fill(miserable));
    expect(r.state.exodusActive).toBe(false);
    expect(monthsUntilExodus(r.state)).toBe(1);
    expect(r.events.flat().some((e) => e.type === 'exodusAbandonment')).toBe(false);
    const twelfth = advanceFailureState(r.state, miserable);
    expect(twelfth.next.exodusActive).toBe(true);
    expect(types(twelfth.events)).toContain('exodusStarted');
    expect(twelfth.events).toContainEqual({ type: 'exodusAbandonment', share: 0.02 });
    const thirteenth = advanceFailureState(twelfth.next, miserable);
    expect(types(thirteenth.events)).not.toContain('exodusStarted');
    expect(thirteenth.events).toContainEqual({ type: 'exodusAbandonment', share: 0.02 });
  });

  it('a happy month resets the counter and ends the exodus', () => {
    const r = run(undefined, [...Array(12).fill(miserable), ok]);
    expect(types(r.events[12])).toContain('exodusEnded');
    expect(r.state.exodusActive).toBe(false);
    expect(r.state.lowHappinessMonths).toBe(0);
    expect(monthsUntilExodus(r.state)).toBeNull();
  });

  it('ends the game when population falls below 20% of its peak during an exodus', () => {
    let s = run(undefined, [{ ...ok, displayedPopulation: 50000 }, ...Array(12).fill({ ...miserable, displayedPopulation: 20000 })]).state;
    expect(s.peakDisplayedPopulation).toBe(50000);
    expect(s.gameOver).toBeUndefined();
    s = advanceFailureState(s, { ...miserable, displayedPopulation: 10000 }).next;
    expect(s.gameOver).toBeUndefined();
    const r = advanceFailureState(s, { ...miserable, displayedPopulation: 9999 });
    expect(r.next.gameOver).toBe('exodus');
    expect(r.events).toContainEqual({ type: 'gameOver', reason: 'exodus' });
  });

  it('a population drop without an exodus is not game over', () => {
    const s = run(undefined, [{ ...ok, displayedPopulation: 50000 }, { ...ok, displayedPopulation: 100 }]).state;
    expect(s.gameOver).toBeUndefined();
  });
});

describe('getTopFailingStat', () => {
  const stats = { money: 100, happiness: 40, health: 30, education: 50, safety: 60, environment: 70 };
  it('blames negative money first', () => {
    expect(getTopFailingStat({ ...stats, money: -1 }).stat).toBe('money');
  });
  it('otherwise the lowest rating, including Ganga Health when given', () => {
    expect(getTopFailingStat(stats)).toMatchObject({ stat: 'health', value: 30 });
    expect(getTopFailingStat({ ...stats, gangaHealth: 10 }).stat).toBe('gangaHealth');
    expect(getTopFailingStat(stats).line.length).toBeGreaterThan(0);
  });
  it('tracks the peak Ganga Health for the game-over screen', () => {
    const s = run(createFailureState(), [{ ...ok, gangaHealth: 60 }, { ...ok, gangaHealth: 75 }, { ...ok, gangaHealth: 50 }]).state;
    expect(s.peakGangaHealth).toBe(75);
  });
});
