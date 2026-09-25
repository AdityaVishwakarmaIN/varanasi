import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, simulateTick } from '@/lib/simulation';
import { absoluteDay, CALENDAR } from '@/lib/seasons';
import {
  addForecast,
  NOTIFICATION_CONFIG,
  pruneForecasts,
  pushNotifications,
  shouldPauseForCrisis,
} from '@/lib/notifications';
import type { GameState, Notification } from '@/types/game';

const note = (id: string, extras: Partial<Notification> = {}): Notification => ({
  id,
  title: id,
  description: '',
  icon: '!',
  timestamp: 0,
  ...extras,
});

describe('notifications with location and severity (S4-T4)', () => {
  it('adds newest first and keeps at most maxKept', () => {
    const old = Array.from({ length: NOTIFICATION_CONFIG.maxKept }, (_, i) => note(`old-${i}`));
    const next = pushNotifications(old, [note('new')]);
    expect(next[0].id).toBe('new');
    expect(next).toHaveLength(NOTIFICATION_CONFIG.maxKept);
    expect(pushNotifications(old, [])).toBe(old);
  });

  it('a crisis pauses by default and when the setting is on, not when it is off', () => {
    const crisis = [note('flood', { severity: 'crisis', x: 4, y: 5, overlay: 'water' })];
    expect(shouldPauseForCrisis({}, crisis)).toBe(true);
    expect(shouldPauseForCrisis({ pauseOnCrisis: true }, crisis)).toBe(true);
    expect(shouldPauseForCrisis({ pauseOnCrisis: false }, crisis)).toBe(false);
    expect(shouldPauseForCrisis({}, [note('info', { severity: 'warning' })])).toBe(false);
  });

  it('addForecast puts one entry on the calendar per id and sends a warning', () => {
    const base = { year: 2026, month: 6, day: 10, notifications: [] as Notification[], forecasts: undefined };
    const first = addForecast(base, { id: 'monsoon', title: 'Monsoon', description: 'Rain soon', daysAhead: 5, icon: '🌧️', x: 1, y: 2 }, 42);
    expect(first.forecasts).toEqual([
      { id: 'monsoon', day: absoluteDay(2026, 6, 15), icon: '🌧️', title: 'Monsoon', description: 'Rain soon' },
    ]);
    expect(first.notifications[0]).toMatchObject({ severity: 'warning', x: 1, y: 2, timestamp: 42 });
    const again = addForecast({ ...base, ...first }, { id: 'monsoon', title: 'Monsoon', description: 'Sooner', daysAhead: 2, icon: '🌧️' });
    expect(again.forecasts).toHaveLength(1);
    expect(again.forecasts![0].day).toBe(absoluteDay(2026, 6, 12));
  });

  it('prunes forecasts once their day has passed', () => {
    const f = [{ id: 'a', day: 10, icon: '', title: '', description: '' }, { id: 'b', day: 20, icon: '', title: '', description: '' }];
    expect(pruneForecasts(f, 5)).toBe(f);
    expect(pruneForecasts(f, 15)!.map((x) => x.id)).toEqual(['b']);
  });

  it('the simulation drops past forecasts at the day rollover', () => {
    const state: GameState = { ...createInitialGameState(20, 'N', createRng(1)), month: 3, day: 4, tick: CALENDAR.ticksPerDay - 1, speed: 1 };
    state.forecasts = [{ id: 'past', day: absoluteDay(2026, 3, 4) - 1, icon: '', title: '', description: '' }];
    state.year = 2026;
    const next = simulateTick(state, 'clear', createRng(2));
    expect(next.forecasts).toEqual([]);
    expect(next.speed).toBe(1);
  });
});
