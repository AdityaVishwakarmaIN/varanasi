'use client';

/**
 * Season label and calendar strip (S4-T1).
 * The strip shows the current month plus the next ones in their season colours, with a marker for today
 * and icons for upcoming events (forecasts from S4-T4, festivals from Sprint 5).
 */
import React from 'react';
import { msg, useMessages } from 'gt-next';
import {
  CALENDAR,
  SEASON_COLORS,
  absoluteDay,
  getSeason,
  getUpcomingMonths,
  isFogActive,
  type Season,
  type SimWeather,
} from '@/lib/seasons';

/** Season names for the UI (wrapped with msg() like TOOL_INFO). */
export const SEASON_NAMES: Record<Season, string> = {
  summer: msg('Summer'),
  monsoon: msg('Monsoon'),
  postMonsoon: msg('Post-monsoon'),
  winter: msg('Winter'),
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Months shown on the strip: this month and the next two. */
export const CALENDAR_STRIP_MONTHS = 3;

/** An upcoming event drawn on the strip at its absolute day. */
export interface CalendarEvent {
  id: string;
  /** Absolute day (see `absoluteDay` in seasons.ts). */
  day: number;
  /** A short emoji or glyph. */
  icon: string;
  title: string;
}

/** "Jul 2026 · Monsoon": the date with its season, for both top bars. */
export function SeasonDateLabel({ month, year }: { month: number; year: number }) {
  const m = useMessages();
  const season = getSeason(month);
  return (
    <span className="inline-flex items-center gap-1">
      <span>{MONTH_ABBR[month - 1]} {year}</span>
      <span aria-hidden>·</span>
      <span style={{ color: SEASON_COLORS[season] }}>{m(SEASON_NAMES[season])}</span>
    </span>
  );
}

interface SeasonStripProps {
  month: number;
  year: number;
  day: number;
  events?: readonly CalendarEvent[];
  /** `compact` is the thin desktop bar; `full` adds month and season labels (mobile details panel). */
  variant?: 'compact' | 'full';
  className?: string;
}

export const SeasonStrip = React.memo(function SeasonStrip({
  month,
  year,
  day,
  events = [],
  variant = 'compact',
  className = '',
}: SeasonStripProps) {
  const m = useMessages();
  const months = getUpcomingMonths(month, year, CALENDAR_STRIP_MONTHS);
  const first = months[0].startDay;
  const span = months[months.length - 1].endDay - first;
  const today = absoluteDay(year, month, day);
  const todayPct = ((today - first) / span) * 100;
  const visibleEvents = events.filter((e) => e.day >= today && e.day < first + span);
  const full = variant === 'full';

  return (
    <div className={`relative w-full ${className}`}>
      <div className={`relative flex w-full overflow-hidden rounded-sm ${full ? 'h-6' : 'h-1.5'}`}>
        {months.map((cm) => {
          const label = `${MONTH_ABBR[cm.month - 1]} ${cm.year} · ${m(SEASON_NAMES[cm.season])}`;
          return (
            <div
              key={`${cm.year}-${cm.month}`}
              className="flex-1 flex items-center justify-center border-r border-background/60 last:border-r-0"
              style={{ backgroundColor: SEASON_COLORS[cm.season] }}
              title={label}
            >
              {full && (
                <span className="text-[10px] font-medium text-black/75 truncate px-1">
                  {MONTH_ABBR[cm.month - 1]} · {m(SEASON_NAMES[cm.season])}
                </span>
              )}
            </div>
          );
        })}
        {/* Today marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/80"
          style={{ left: `${Math.min(99.5, Math.max(0, todayPct))}%` }}
          aria-hidden
        />
      </div>
      {visibleEvents.length > 0 && (
        <div className={`relative w-full ${full ? 'h-5 mt-0.5' : 'h-3'}`}>
          {visibleEvents.map((e) => (
            <span
              key={e.id}
              className={`absolute -translate-x-1/2 leading-none ${full ? 'text-sm' : 'text-[10px]'}`}
              style={{ left: `${((e.day - first) / span) * 100}%` }}
              title={e.title}
            >
              {e.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

/** Days in one strip, for tests and callers that place events. */
export const CALENDAR_STRIP_DAYS = CALENDAR_STRIP_MONTHS * CALENDAR.daysPerMonth;

/** Small "Fog" chip shown while winter fog is active (S4-T8): cars slow down and flights are grounded. */
export function FogChip({ weather, hour, className = '' }: { weather: SimWeather | undefined; hour: number; className?: string }) {
  const m = useMessages();
  if (!isFogActive(weather, hour)) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded bg-slate-500/20 px-1 text-[10px] leading-4 text-slate-200 ${className}`}
      title={m(FOG_TOOLTIP)}
    >
      ☁ {m(FOG_LABEL)}
    </span>
  );
}

const FOG_LABEL = msg('Fog');
const FOG_TOOLTIP = msg('Winter fog: traffic is slower and flights are grounded until it lifts.');
