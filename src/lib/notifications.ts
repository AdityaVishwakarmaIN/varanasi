/**
 * Notifications with a location, severity and overlay, and forecasts on the calendar strip (S4-T4).
 * Pure helpers: the simulation and the context use them to add notifications, and to pause on a crisis.
 */
import type { Forecast, GameState, Notification } from '@/types/game';
import { absoluteDay } from '@/lib/seasons';

/** Optional fields a caller can add to a notification: where it is, which overlay explains it, how bad it is. */
export type NotificationExtras = Pick<Notification, 'x' | 'y' | 'overlay' | 'severity'>;

export const NOTIFICATION_CONFIG = {
  /** Notifications kept on the state (newest first). */
  maxKept: 10,
  /** Forecasts kept on the calendar strip. */
  maxForecasts: 12,
  /** Toast display times in ms. A crisis stays longer. */
  toastMs: 6000,
  crisisToastMs: 12000,
  /** Toasts on screen at once. */
  maxToasts: 3,
} as const;

/** Adds notifications (newest first) and trims the list to `maxKept`. */
export function pushNotifications(list: readonly Notification[], added: readonly Notification[]): Notification[] {
  if (added.length === 0) return list as Notification[];
  return [...added, ...list].slice(0, NOTIFICATION_CONFIG.maxKept);
}

/** True when any of `added` is a crisis and the city pauses on crises (the default). */
export function shouldPauseForCrisis(state: Pick<GameState, 'pauseOnCrisis'>, added: readonly Notification[]): boolean {
  return state.pauseOnCrisis !== false && added.some((n) => n.severity === 'crisis');
}

/** Absolute day of the state's calendar date. */
export function getToday(state: Pick<GameState, 'year' | 'month' | 'day'>): number {
  return absoluteDay(state.year, state.month, state.day);
}

export interface ForecastInput {
  /** Stable id: a forecast with the same id replaces the old one (no duplicates). */
  id: string;
  title: string;
  description: string;
  daysAhead: number;
  icon: string;
  x?: number;
  y?: number;
  overlay?: Notification['overlay'];
}

/**
 * Puts a forecast on the calendar strip and sends a `warning` notification about it.
 * Returns the changed fields, to spread into the new state.
 */
export function addForecast(
  state: Pick<GameState, 'year' | 'month' | 'day' | 'forecasts' | 'notifications'>,
  input: ForecastInput,
  now: number = Date.now()
): Pick<GameState, 'forecasts' | 'notifications'> {
  const day = getToday(state) + Math.max(0, Math.round(input.daysAhead));
  const forecast: Forecast = { id: input.id, day, icon: input.icon, title: input.title, description: input.description };
  const others = (state.forecasts ?? []).filter((f) => f.id !== input.id);
  const forecasts = [...others, forecast].sort((a, b) => a.day - b.day).slice(0, NOTIFICATION_CONFIG.maxForecasts);
  const notification: Notification = {
    id: `forecast-${input.id}-${day}`,
    title: input.title,
    description: input.description,
    icon: input.icon,
    timestamp: now,
    severity: 'warning',
    ...(input.x !== undefined && input.y !== undefined ? { x: input.x, y: input.y } : {}),
    ...(input.overlay ? { overlay: input.overlay } : {}),
  };
  return { forecasts, notifications: pushNotifications(state.notifications, [notification]) };
}

/** Drops forecasts whose day has passed. Returns the same array when nothing changed. */
export function pruneForecasts(forecasts: Forecast[] | undefined, today: number): Forecast[] | undefined {
  if (!forecasts || forecasts.length === 0) return forecasts;
  const kept = forecasts.filter((f) => f.day >= today);
  return kept.length === forecasts.length ? forecasts : kept;
}
