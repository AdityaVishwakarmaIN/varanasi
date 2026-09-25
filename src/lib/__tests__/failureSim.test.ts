import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, simulateTick } from '@/lib/simulation';
import { acceptEmergencyLoan, FAILURE_CONFIG } from '@/lib/failure';
import type { GameState } from '@/types/game';

const SIZE = 30;

function newCity(): GameState {
  return createInitialGameState(SIZE, 'Failing', createRng(7));
}

/** Jumps to the last tick of the month and runs it, so the month-end step runs once. */
function endMonth(state: GameState): GameState {
  return simulateTick({ ...state, day: 30, tick: 29 }, 'clear');
}

function withMoney(state: GameState, money: number): GameState {
  return { ...state, stats: { ...state.stats, money } };
}

/** Puts `count` occupied small houses on land tiles. */
function addHomes(state: GameState, count: number): GameState {
  let placed = 0;
  for (let y = 0; y < SIZE && placed < count; y++) {
    for (let x = 0; x < SIZE && placed < count; x++) {
      const tile = state.grid[y][x];
      if (tile.building.type !== 'grass') continue;
      tile.building = { ...tile.building, type: 'house_small', population: 10, constructionProgress: 100, abandoned: false };
      tile.zone = 'residential';
      placed++;
    }
  }
  return state;
}

function countAbandonedHomes(state: GameState): number {
  let n = 0;
  for (const row of state.grid) for (const t of row) if (t.zone === 'residential' && t.building.abandoned) n++;
  return n;
}

describe('failure states in the simulation (S4-T11)', () => {
  it('a city in debt is offered the loan after 3 months and goes bankrupt 6 months after declining', () => {
    let state = withMoney(newCity(), -1_000_000);
    state = { ...state, speed: 1 };
    for (let i = 1; i < FAILURE_CONFIG.loanOfferAfterDebtMonths; i++) {
      state = endMonth(state);
      expect(state.failure?.monthsInDebt).toBe(i);
      expect(state.failure?.loanStatus).toBe('none');
    }
    expect(state.notifications.some((n) => n.title === 'The city treasury is empty')).toBe(true);
    state = endMonth(state);
    expect(state.failure?.loanStatus).toBe('offered');
    expect(state.notifications[0].title).toBe('Emergency loan offered');

    // Not answered: the offer lapses (declined), and the bankruptcy countdown starts
    for (let i = 0; i < FAILURE_CONFIG.bankruptcyAfterDebtMonths - 1; i++) {
      state = endMonth({ ...state, speed: 1 });
      expect(state.gameOver).toBeUndefined();
    }
    expect(state.failure?.loanStatus).toBe('declined');
    state = endMonth({ ...state, speed: 1 });
    expect(state.gameOver?.reason).toBe('bankruptcy');
    expect(state.gameOver?.failingStat).toBe('money');
    expect(state.speed).toBe(0);

    // Nothing changes once the game is over
    const after = endMonth(state);
    expect(after.failure).toBe(state.failure);
  });

  it('an accepted loan adds money and is repaid from income', () => {
    let state = withMoney(newCity(), -1);
    for (let i = 0; i < FAILURE_CONFIG.loanOfferAfterDebtMonths; i++) state = endMonth(state);
    expect(state.failure?.loanStatus).toBe('offered');
    const { next, amount } = acceptEmergencyLoan(state.failure!);
    state = { ...withMoney(state, state.stats.money + amount), failure: next };
    expect(state.failure?.loan?.monthsRemaining).toBe(FAILURE_CONFIG.loanRepaymentMonths);
    state = endMonth(state);
    expect(state.failure?.loan?.monthsRemaining).toBe(FAILURE_CONFIG.loanRepaymentMonths - 1);
  });

  it('an exodus abandons 2% of homes each month', () => {
    let state = addHomes(newCity(), 100);
    state = { ...state, taxRate: 100, effectiveTaxRate: 100 };
    state = {
      ...state,
      failure: {
        monthsInDebt: 0,
        loanStatus: 'none',
        debtMonthsAfterLoan: 0,
        lowHappinessMonths: FAILURE_CONFIG.exodusAfterMonths - 1,
        exodusActive: false,
        peakDisplayedPopulation: 0,
      },
    };
    const before = countAbandonedHomes(state);
    state = endMonth(state);
    expect(state.stats.happiness).toBeLessThan(FAILURE_CONFIG.criticalHappiness);
    expect(state.failure?.exodusActive).toBe(true);
    expect(countAbandonedHomes(state) - before).toBe(2);
    expect(state.notifications.some((n) => n.title === 'People are leaving the city')).toBe(true);
  });

  it('does nothing in the middle of a month', () => {
    const state = simulateTick(withMoney(newCity(), -5), 'clear');
    expect(state.failure).toBeUndefined();
  });
});
