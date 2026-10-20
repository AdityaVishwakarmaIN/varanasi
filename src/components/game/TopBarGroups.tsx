'use client';

/**
 * Grouped top-bar chips, shared by the desktop TopBar and the MobileTopBar.
 *
 * The bar shows four compact chips (People, Money, Services, River), each with ONE headline number and a status
 * colour. A chip escalates (tinted border + a short reason such as "Deficit" or "Falling") only when something is
 * wrong. Clicking a chip opens a panel with the group's details and controls; the tax slider lives in Money, the
 * power / water / Ganga overlay toggles live in Services / River.
 *
 * There is no popover primitive installed, so `TopBarPanelShell` is a small disclosure: the trigger carries
 * aria-expanded / aria-controls, the panel follows it in the DOM (Tab flows into it), Esc closes it and returns
 * focus to the trigger, leaving it with Tab closes it, and a transparent backdrop swallows the click that
 * dismisses it, so closing never places a building on the map.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Landmark, Wallet } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { Slider } from '@/components/ui/slider';
import {
  EducationIcon,
  EnvironmentIcon,
  HappyIcon,
  HealthIcon,
  PopulationIcon,
  PowerIcon,
  RiverIcon,
  SafetyIcon,
  WaterIcon,
} from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { formatINR, formatINRPerMonth, formatPopulation, formatIndianNumber } from '@/lib/format';
import { TAX_RATE_MAX, TAX_RATE_MIN, TAX_RATE_WARN_ABOVE } from '@/lib/tax';
import { POWER_CONFIG, WATER_CONFIG, getSupplyStatus } from '@/lib/utilities';
import { GANGA_TREND_ARROW, describeGangaCauses, getGangaHealthLevel } from '@/lib/ganga';
import { getGangaTrend } from '@/lib/scoring';
import { getSupplyLabel } from '@/components/game/UtilityChip';
import type { OverlayMode } from '@/components/game/types';
import type { UtilitySupplyStats } from '@/types/game';
import { SeasonStrip } from '@/components/game/SeasonCalendar';

export type GroupId = 'people' | 'money' | 'services' | 'river';
export type TopBarPanelId = GroupId | 'calendar';
type Variant = 'desktop' | 'mobile';
type Level = 'idle' | 'ok' | 'warn' | 'bad';

const LEVEL_RANK: Record<Level, number> = { idle: 0, ok: 1, warn: 2, bad: 3 };

/** Text colours with 4.5:1+ contrast on the sandstone chrome (green/amber 900, red 800). */
const LEVEL_TEXT: Record<Level, string> = {
  idle: 'text-chrome-muted',
  ok: 'text-green-900',
  warn: 'text-amber-900',
  bad: 'text-red-800',
};
/** Headline number: plain text when fine, coloured only when it needs attention. */
const VALUE_TEXT: Record<Level, string> = {
  idle: 'text-chrome-muted',
  ok: 'text-chrome-text',
  warn: 'text-amber-900',
  bad: 'text-red-800',
};
const LEVEL_BAR: Record<Level, string> = {
  idle: 'bg-chrome-border',
  ok: 'bg-green-700',
  warn: 'bg-amber-600',
  bad: 'bg-red-700',
};
/** Escalation: only warn / bad change the chip frame. */
const LEVEL_FRAME: Record<Level, string> = {
  idle: '',
  ok: '',
  warn: 'border-l-[3px] !border-l-amber-700',
  bad: 'border-l-[3px] !border-l-red-700',
};

/** Rating bands (happiness, health, education, safety, environment): good ≥ 60, fair 40–59, poor < 40. */
function ratingLevel(value: number, empty: boolean): Level {
  if (empty) return 'idle';
  return value >= 60 ? 'ok' : value >= 40 ? 'warn' : 'bad';
}

function supplyLevel(supply: UtilitySupplyStats, kind: 'power' | 'water'): Level {
  const status = getSupplyStatus(supply.ratio, kind === 'power' ? POWER_CONFIG : WATER_CONFIG);
  return status === 'red' ? 'bad' : status === 'amber' ? 'warn' : 'ok';
}

const triggerId = (id: TopBarPanelId) => `topbar-trigger-${id}`;

// ============================================================================
// Summaries: headline number + status per group
// ============================================================================

interface GroupSummary {
  level: Level;
  /** The one headline number. */
  value: string;
  /** Short reason shown next to the group name when it needs attention ("Deficit", "Falling"), else null. */
  reason: string | null;
  /** Full sentence for screen readers. */
  spoken: string;
}

interface ServiceItem {
  id: 'power' | 'water' | 'health' | 'education' | 'safety';
  label: string;
  level: Level;
  /** Lower is worse; used to pick the headline among equally bad items. */
  score: number;
  text: string;
}

function useServiceItems(): ServiceItem[] {
  const { state } = useGame();
  const { stats } = state;
  const empty = stats.population <= 0;
  const items: ServiceItem[] = [];
  (['power', 'water'] as const).forEach((kind) => {
    const supply = stats[kind];
    if (!supply || !(supply.demand > 0)) return;
    items.push({
      id: kind,
      label: kind === 'power' ? 'Power' : 'Water',
      level: supplyLevel(supply, kind),
      score: supply.ratio * 100,
      text: getSupplyLabel(supply),
    });
  });
  if (!empty) {
    (
      [
        ['health', 'Health', stats.health],
        ['education', 'Education', stats.education],
        ['safety', 'Safety', stats.safety],
      ] as const
    ).forEach(([id, label, value]) => {
      items.push({ id, label, level: ratingLevel(value, false), score: value, text: `${Math.round(value)}%` });
    });
  }
  return items;
}

function useRawGroupSummary(id: GroupId): GroupSummary {
  const { state } = useGame();
  const { stats, taxRate } = state;
  const services = useServiceItems();
  const empty = stats.population <= 0;

  if (id === 'people') {
    const level = ratingLevel(stats.happiness, empty);
    const reason = level === 'bad' ? 'Unhappy' : level === 'warn' ? 'Uneasy' : null;
    const value = formatPopulation(stats.population);
    return { level, value, reason, spoken: `People: population ${value}${reason ? `, ${reason.toLowerCase()}` : ''}` };
  }

  if (id === 'money') {
    const monthly = stats.income - stats.expenses;
    let level: Level = 'ok';
    let reason: string | null = null;
    if (stats.money < 0) {
      level = 'bad';
      reason = 'Debt';
    } else if (monthly < 0) {
      level = stats.money < -monthly * 3 ? 'bad' : 'warn';
      reason = 'Deficit';
    } else if (stats.money < 1000) {
      level = 'warn';
      reason = 'Low cash';
    } else if (taxRate > TAX_RATE_WARN_ABOVE) {
      level = 'warn';
      reason = 'High tax';
    }
    const value = formatINR(stats.money);
    return { level, value, reason, spoken: `Money: funds ${value}${reason ? `, ${reason.toLowerCase()}` : ''}` };
  }

  if (id === 'services') {
    if (services.length === 0) return { level: 'idle', value: '—', reason: null, spoken: 'Services: nothing to measure yet' };
    const worst = services.reduce((a, b) =>
      LEVEL_RANK[b.level] > LEVEL_RANK[a.level] || (b.level === a.level && b.score < a.score) ? b : a
    );
    if (worst.level === 'ok') return { level: 'ok', value: 'All OK', reason: null, spoken: 'Services: all fine' };
    const value = `${worst.label} ${worst.text}`;
    return { level: worst.level, value, reason: null, spoken: `Services: ${value}, ${worst.level === 'bad' ? 'critical' : 'needs attention'}` };
  }

  // river
  if (stats.gangaHealth === undefined) {
    const level = ratingLevel(stats.environment, empty);
    const value = empty ? '—' : `${Math.round(stats.environment)}%`;
    return { level, value, reason: null, spoken: `Environment ${value}` };
  }
  const health = Math.round(stats.gangaHealth);
  const trend = getGangaTrend(stats.gangaHealth, stats.gangaHealthTarget ?? stats.gangaHealth);
  const gLevel = getGangaHealthLevel(stats.gangaHealth);
  let level: Level = gLevel === 'good' ? 'ok' : gLevel === 'fair' ? 'warn' : 'bad';
  let reason: string | null = null;
  if (trend === 'down') {
    if (level === 'ok') level = 'warn';
    reason = 'Falling';
  } else if (level === 'bad') reason = 'Polluted';
  const value = `${health} ${GANGA_TREND_ARROW[trend]}`;
  return { level, value, reason, spoken: `River: Ganga health ${health}${reason ? `, ${reason.toLowerCase()}` : ''}` };
}

/** An alert shows at once but clears only after it has stayed clear this long, so chips don't flicker around a threshold. */
const ALERT_HOLD_MS = 4000;

function useGroupSummary(id: GroupId): GroupSummary {
  const raw = useRawGroupSummary(id);
  // Only Services holds its number (it names the culprit); the others keep a live number.
  const key = id === 'services' ? raw.value : '';
  const [held, setHeld] = useState({ level: raw.level, reason: raw.reason, value: key });
  const alerting = LEVEL_RANK[raw.level] >= LEVEL_RANK.warn;
  // An alert is adopted during render (no extra frame); only clearing waits.
  if (alerting && (held.level !== raw.level || held.reason !== raw.reason || held.value !== key)) {
    setHeld({ level: raw.level, reason: raw.reason, value: key });
  }
  useEffect(() => {
    if (alerting) return;
    const next = { level: raw.level, reason: raw.reason, value: key };
    const t = setTimeout(() => setHeld(next), ALERT_HOLD_MS);
    return () => clearTimeout(t);
  }, [alerting, raw.level, raw.reason, key]);
  const holding = LEVEL_RANK[raw.level] < LEVEL_RANK.warn && LEVEL_RANK[held.level] >= LEVEL_RANK.warn;
  if (!holding) return raw;
  // Still showing the alert: keep its colour and reason; the live number stays live except on Services, where the number names the culprit.
  return { ...raw, level: held.level, reason: held.reason, value: id === 'services' ? held.value : raw.value };
}

const GROUP_LABEL: Record<GroupId, string> = { people: 'People', money: 'Money', services: 'Services', river: 'River' };

function GroupIcon({ id, size }: { id: GroupId; size: number }) {
  switch (id) {
    case 'people':
      return <PopulationIcon size={size} />;
    case 'money':
      // The value already carries ₹, so the icon is a wallet rather than a second rupee sign.
      return <Wallet width={size} height={size} strokeWidth={1.75} />;
    case 'services':
      return <Landmark width={size} height={size} strokeWidth={1.75} />;
    default:
      return <RiverIcon size={size} />;
  }
}

// ============================================================================
// Panel shell (disclosure)
// ============================================================================

export function TopBarPanelShell({
  id,
  openId,
  onOpenChange,
  variant,
  label,
  className,
  children,
}: {
  id: TopBarPanelId;
  openId: TopBarPanelId | null;
  onOpenChange: (id: TopBarPanelId | null) => void;
  variant: Variant;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = openId === id;
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = `topbar-panel-${id}`;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onOpenChange(null);
      document.getElementById(triggerId(id))?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, id, onOpenChange]);

  if (!open) return null;
  return (
    <>
      {/* Behind the bar's own controls (-z-10 inside the bar's stacking context) but over the map. */}
      <div className="fixed inset-0 -z-10" onClick={() => onOpenChange(null)} aria-hidden />
      <div
        ref={panelRef}
        id={panelId}
        role="region"
        aria-label={label}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && !panelRef.current?.contains(next) && (next as HTMLElement).id !== triggerId(id)) onOpenChange(null);
        }}
        className={cn(
          'hud-panel animate-rise-in z-30 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-none border-chrome-accent text-chrome-text',
          variant === 'desktop'
            // The chips sit at the right of the bar, so the later panels open leftwards to stay on screen.
            ? cn('absolute top-full mt-2 w-[19rem]', id === 'services' || id === 'river' ? 'right-0' : 'left-0') : 'absolute inset-x-2 top-full mt-1 max-h-[calc(100dvh-10rem)]',
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-chrome-muted">{children}</h2>;
}

// ============================================================================
// Panel building blocks
// ============================================================================

function Row({ label, value, tone = 'text-chrome-text' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1 text-sm">
      <span className="text-chrome-muted">{label}</span>
      <span className={cn('font-mono font-semibold tabular-nums', tone)}>{value}</span>
    </div>
  );
}

function RatingRow({ icon, label, value, empty }: { icon: React.ReactNode; label: string; value: number; empty: boolean }) {
  const level = ratingLevel(value, empty);
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2 px-3 py-1 text-sm" role="group" aria-label={empty ? `${label}: no data yet` : `${label} ${pct}%`}>
      <span className="text-chrome-muted">{icon}</span>
      <span className="w-[5.5rem] shrink-0 text-chrome-muted">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-none bg-chrome-border" aria-hidden>
        {!empty && <span className={cn('absolute inset-y-0 left-0 rounded-none', LEVEL_BAR[level])} style={{ width: `${pct}%` }} />}
      </span>
      <span className={cn('w-9 text-right font-mono font-semibold tabular-nums', LEVEL_TEXT[level])}>{empty ? '—' : `${pct}%`}</span>
    </div>
  );
}

function DemandRow({ label, short, demand, bar }: { label: string; short: string; demand: number; bar: string }) {
  const pct = Math.min(100, Math.abs(demand));
  const positive = demand >= 0;
  return (
    <div className="grid grid-cols-[1.25rem_6rem_1fr_auto] items-center gap-2 px-3 py-1 text-sm" role="img" aria-label={`${label} demand ${Math.round(demand)}`}>
      <span className="w-4 text-center text-[11px] font-bold text-chrome-text" aria-hidden>{short}</span>
      <span className="truncate text-chrome-muted">{label}</span>
      <span className="relative h-1.5 min-w-0 overflow-hidden rounded-none bg-chrome-border" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px bg-chrome-text/50" />
        <span
          className={cn('absolute inset-y-0 rounded-none', positive ? bar : 'bg-red-700')}
          style={positive ? { left: '50%', width: `${pct / 2}%` } : { right: '50%', width: `${pct / 2}%` }}
        />
      </span>
      <span className="w-9 text-right font-mono text-xs font-semibold tabular-nums text-chrome-text">{demand > 0 ? '+' : ''}{Math.round(demand)}</span>
    </div>
  );
}

function OverlayButton({ active, onClick, label, variant }: { active: boolean; onClick: () => void; label: string; variant: Variant }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${active ? 'Hide' : 'Show'} the ${label} overlay`}
      className={cn(
        'press shrink-0 rounded-none border px-2.5 text-[11px] font-semibold',
        variant === 'mobile' ? 'h-11' : 'h-8',
        active ? 'hud-selected border-chrome-accent' : 'border-chrome-border bg-chrome-well text-chrome-text hover:bg-chrome-border/40'
      )}
    >
      {active ? 'On map' : 'Show on map'}
    </button>
  );
}

// ============================================================================
// Panels
// ============================================================================

function PeoplePanel() {
  const { state } = useGame();
  const { stats } = state;
  const empty = stats.population <= 0;
  return (
    <div className="pb-2">
      <PanelTitle>People</PanelTitle>
      <Row label="Population" value={formatPopulation(stats.population)} />
      <Row label="Jobs" value={formatPopulation(stats.jobs)} />
      <RatingRow icon={<HappyIcon size={14} />} label="Happiness" value={stats.happiness} empty={empty} />
      <PanelTitle>Zone demand</PanelTitle>
      <DemandRow label="Residential" short="R" demand={stats.demand.residential} bar="bg-green-700" />
      <DemandRow label="Commercial" short="C" demand={stats.demand.commercial} bar="bg-blue-700" />
      <DemandRow label="Industrial" short="I" demand={stats.demand.industrial} bar="bg-amber-600" />
    </div>
  );
}

function MoneyPanel() {
  const { state, setTaxRate } = useGame();
  const { stats, taxRate } = state;
  const monthly = stats.income - stats.expenses;
  const high = taxRate > TAX_RATE_WARN_ABOVE;
  return (
    <div className="pb-3">
      <PanelTitle>Money</PanelTitle>
      <Row label="Funds" value={formatINR(stats.money)} tone={stats.money < 0 ? 'text-red-800' : 'text-chrome-text'} />
      <Row label="Income" value={formatINRPerMonth(stats.income)} tone="text-green-900" />
      <Row label="Expenses" value={formatINRPerMonth(stats.expenses)} tone="text-red-800" />
      <Row label="Net" value={formatINRPerMonth(monthly, true)} tone={monthly >= 0 ? 'text-green-900' : 'text-red-800'} />
      <div className="mx-3 mt-2 border-t border-chrome-border pt-2">
        <div className="flex items-center justify-between text-sm">
          <label id="topbar-tax-label" className="text-chrome-muted">Tax rate</label>
          <span className={cn('font-mono font-semibold tabular-nums', high ? 'text-amber-900' : 'text-chrome-text')}>{taxRate}%</span>
        </div>
        <Slider
          value={[taxRate]}
          onValueChange={(value) => setTaxRate(value[0])}
          min={TAX_RATE_MIN}
          max={TAX_RATE_MAX}
          step={1}
          className="my-1 w-full"
          aria-labelledby="topbar-tax-label"
        />
        <div className="flex justify-between text-[10px] text-chrome-muted">
          <span>{TAX_RATE_MIN}%</span>
          <span>{high ? 'High taxes make people unhappy' : ''}</span>
          <span>{TAX_RATE_MAX}%</span>
        </div>
      </div>
    </div>
  );
}

function UtilityRow({
  kind,
  supply,
  active,
  onToggle,
  variant,
}: {
  kind: 'power' | 'water';
  supply: UtilitySupplyStats | undefined;
  active: boolean;
  onToggle?: () => void;
  variant: Variant;
}) {
  const label = kind === 'power' ? 'Power' : 'Water';
  const Icon = kind === 'power' ? PowerIcon : WaterIcon;
  if (!supply || !(supply.demand > 0)) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-sm text-chrome-muted">
        <Icon size={14} />
        <span className="w-[4.5rem]">{label}</span>
        <span>No demand yet</span>
      </div>
    );
  }
  const level = supplyLevel(supply, kind);
  const cutText = kind === 'power' ? 'without power' : 'with dry taps';
  return (
    <div className="px-3 py-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-chrome-muted"><Icon size={14} /></span>
        <span className="truncate text-chrome-muted">{label}</span>
        <span className={cn('flex-1 font-mono font-semibold tabular-nums', LEVEL_TEXT[level])}>{getSupplyLabel(supply)}</span>
        {onToggle && <OverlayButton active={active} onClick={onToggle} label={label.toLowerCase()} variant={variant} />}
      </div>
      <p className={cn('mt-0.5 pl-[1.375rem] text-[11px] leading-snug', supply.ratio < 1 ? LEVEL_TEXT[level] : 'text-chrome-muted')}>
        {formatIndianNumber(Math.round(supply.supply))} supply for {formatIndianNumber(Math.round(supply.demand))} demand.
        {supply.ratio < 1
          ? ` ${supply.cut.length} of ${supply.feeders.length} neighbourhoods take turns ${cutText}.`
          : ' Supply covers demand.'}
      </p>
    </div>
  );
}

function ServicesPanel({
  variant,
  overlayMode,
  onTogglePowerOverlay,
  onToggleWaterOverlay,
  close,
}: {
  variant: Variant;
  overlayMode: OverlayMode;
  onTogglePowerOverlay?: () => void;
  onToggleWaterOverlay?: () => void;
  close: () => void;
}) {
  const { state } = useGame();
  const { stats } = state;
  const empty = stats.population <= 0;
  const toggle = (fn?: () => void) => (fn ? () => { fn(); close(); } : undefined);
  return (
    <div className="pb-2">
      <PanelTitle>Services</PanelTitle>
      <UtilityRow kind="power" supply={stats.power} active={overlayMode === 'power'} onToggle={toggle(onTogglePowerOverlay)} variant={variant} />
      <UtilityRow kind="water" supply={stats.water} active={overlayMode === 'water'} onToggle={toggle(onToggleWaterOverlay)} variant={variant} />
      <div className="mt-1 border-t border-chrome-border pt-1">
        <RatingRow icon={<HealthIcon size={14} />} label="Health" value={stats.health} empty={empty} />
        <RatingRow icon={<EducationIcon size={14} />} label="Education" value={stats.education} empty={empty} />
        <RatingRow icon={<SafetyIcon size={14} />} label="Safety" value={stats.safety} empty={empty} />
      </div>
    </div>
  );
}

function RiverPanel({
  variant,
  gangaOverlayActive,
  onToggleGangaOverlay,
  close,
}: {
  variant: Variant;
  gangaOverlayActive: boolean;
  onToggleGangaOverlay?: () => void;
  close: () => void;
}) {
  const { state } = useGame();
  const { stats } = state;
  const empty = stats.population <= 0;
  const hasGanga = stats.gangaHealth !== undefined;
  const health = Math.round(stats.gangaHealth ?? 0);
  const target = Math.round(stats.gangaHealthTarget ?? stats.gangaHealth ?? 0);
  const trend = getGangaTrend(stats.gangaHealth ?? 0, stats.gangaHealthTarget ?? stats.gangaHealth ?? 0);
  const level = getGangaHealthLevel(health);
  const levelTone = level === 'poor' ? 'text-red-800' : level === 'fair' || trend === 'down' ? 'text-amber-900' : 'text-green-900';
  const trendWord = { up: 'improving', down: 'getting worse', flat: 'steady' }[trend];
  const causes = stats.gangaLoad && target < 70 ? describeGangaCauses(stats.gangaLoad, formatPopulation) : [];
  return (
    <div className="pb-2">
      <PanelTitle>{hasGanga ? 'River' : 'Environment'}</PanelTitle>
      {hasGanga && (
        <div className="px-3 py-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-chrome-muted"><RiverIcon size={14} /></span>
            <span className="w-[4.5rem] shrink-0 text-chrome-muted">Ganga</span>
            <span className={cn('flex-1 font-mono font-semibold tabular-nums', levelTone)}>
              {health} <span aria-hidden>{GANGA_TREND_ARROW[trend]}</span>
              <span className="sr-only">, {trendWord}</span>
            </span>
            {onToggleGangaOverlay && (
              <OverlayButton
                active={gangaOverlayActive}
                onClick={() => { onToggleGangaOverlay(); close(); }}
                label="Ganga"
                variant={variant}
              />
            )}
          </div>
          <p className="mt-0.5 pl-[1.375rem] text-[11px] leading-snug text-chrome-muted">
            Heading to {target}, {trendWord}.
          </p>
          {causes.length > 0 && (
            <div className="mt-1 pl-[1.375rem] text-[11px] leading-snug">
              <p className="font-semibold text-chrome-text">Main causes</p>
              <ol className="list-decimal pl-4 text-chrome-muted">
                {causes.map((c) => <li key={c}>{c}</li>)}
              </ol>
            </div>
          )}
        </div>
      )}
      <div className={hasGanga ? 'mt-1 border-t border-chrome-border pt-1' : ''}>
        <RatingRow icon={<EnvironmentIcon size={14} />} label="Environment" value={stats.environment} empty={empty} />
      </div>
    </div>
  );
}

/** Calendar panel body (opened from the date / city name): the season strip with upcoming events. */
export function CalendarPanelBody({ onEventClick }: { onEventClick?: (id: string) => void }) {
  const { state } = useGame();
  const { year, month, day } = state;
  return (
    <div className="pb-3">
      <PanelTitle>Calendar</PanelTitle>
      <div className="px-3">
        <SeasonStrip month={month} year={year} day={day} events={state.forecasts} variant="full" onEventClick={onEventClick} />
        <p className="mt-1 text-[11px] text-chrome-muted font-mono">
          {String(month).padStart(2, '0')}-{String(day).padStart(2, '0')}-{year}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Chips + panels
// ============================================================================

function GroupChip({
  id,
  variant,
  open,
  onClick,
}: {
  id: GroupId;
  variant: Variant;
  open: boolean;
  onClick: () => void;
}) {
  const summary = useGroupSummary(id);
  const alert = summary.level === 'warn' || summary.level === 'bad';
  const { state } = useGame();
  const label = id === 'river' && state.mapId !== 'varanasi' ? 'Environment' : GROUP_LABEL[id];
  // The group name stays in the caption even when escalating, so an alert never loses its identity.
  const caption = summary.reason ? `${label} ${summary.reason}` : label;
  const common = {
    id: triggerId(id),
    type: 'button' as const,
    onClick,
    'aria-expanded': open,
    'aria-controls': `topbar-panel-${id}`,
    'aria-label': `${summary.spoken}. ${open ? 'Close' : 'Open'} ${label.toLowerCase()} details.`,
  };

  if (variant === 'mobile') {
    return (
      <button
        {...common}
        className="-my-2 flex h-11 min-w-0 flex-1 items-center justify-center active:opacity-70"
      >
        <span
          className={cn(
            'hud-well flex h-7 w-full min-w-0 flex-col justify-center overflow-hidden rounded-none px-1.5 text-left leading-none',
            LEVEL_FRAME[summary.level],
            open && '!border-chrome-accent'
          )}
        >
          <span className={cn('truncate text-[10px] font-semibold uppercase tracking-[0.04em]', alert ? LEVEL_TEXT[summary.level] : 'text-chrome-muted')}>
            {caption}
          </span>
          <span className={cn('mt-[2px] truncate font-mono text-[12px] font-semibold tabular-nums', VALUE_TEXT[summary.level])}>
            {summary.value}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      {...common}
      className={cn(
        'hud-well press relative flex h-11 min-w-0 shrink items-center gap-2 overflow-hidden rounded-none pl-3.5 pr-2.5 text-left max-[1439px]:pl-3',
        open && '!border-chrome-accent'
      )}
    >
      {/* Status stripe: the same colour as the number, so the state reads before the digits do. */}
      <span className={cn('absolute inset-y-0 left-0 w-1', LEVEL_BAR[summary.level])} aria-hidden />
      <span className="shrink-0 text-chrome-muted"><GroupIcon id={id} size={16} /></span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className={cn('truncate font-mono text-[15px] font-semibold tabular-nums', VALUE_TEXT[summary.level])}>
          {summary.value}
        </span>
        <span className={cn('mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.04em]', alert ? LEVEL_TEXT[summary.level] : 'text-chrome-muted')}>
          {caption}
        </span>
      </span>
      <ChevronDown size={14} strokeWidth={1.75} className={cn('shrink-0 text-chrome-muted transition-transform max-[1439px]:hidden', open && 'rotate-180')} aria-hidden />
    </button>
  );
}

interface TopBarGroupsProps {
  variant: Variant;
  openId: TopBarPanelId | null;
  onOpenChange: (id: TopBarPanelId | null) => void;
  gangaOverlayActive?: boolean;
  onToggleGangaOverlay?: () => void;
  overlayMode?: OverlayMode;
  onTogglePowerOverlay?: () => void;
  onToggleWaterOverlay?: () => void;
  className?: string;
}

const GROUPS: GroupId[] = ['people', 'money', 'services', 'river'];

/** The four group chips and their panels. The parent owns `openId` so the calendar panel can share it. */
export function TopBarGroups({
  variant,
  openId,
  onOpenChange,
  gangaOverlayActive = false,
  onToggleGangaOverlay,
  overlayMode = 'none',
  onTogglePowerOverlay,
  onToggleWaterOverlay,
  className,
}: TopBarGroupsProps) {
  const close = () => onOpenChange(null);
  return (
    <div className={cn(variant === 'desktop' ? 'flex min-w-0 items-center gap-1.5 min-[1440px]:gap-2' : 'flex items-stretch gap-1', className)}>
      {GROUPS.map((id) => (
        // Desktop: each panel hangs under its own chip. Mobile: `contents`, so the panel anchors to the whole bar.
        <div key={id} className={variant === 'desktop' ? 'relative min-w-0 shrink' : 'contents'}>
          <GroupChip id={id} variant={variant} open={openId === id} onClick={() => onOpenChange(openId === id ? null : id)} />
          <TopBarPanelShell id={id} openId={openId} onOpenChange={onOpenChange} variant={variant} label={`${GROUP_LABEL[id]} details`}>
            {id === 'people' && <PeoplePanel />}
            {id === 'money' && <MoneyPanel />}
            {id === 'services' && (
              <ServicesPanel
                variant={variant}
                overlayMode={overlayMode}
                onTogglePowerOverlay={onTogglePowerOverlay}
                onToggleWaterOverlay={onToggleWaterOverlay}
                close={close}
              />
            )}
            {id === 'river' && (
              <RiverPanel variant={variant} gangaOverlayActive={gangaOverlayActive} onToggleGangaOverlay={onToggleGangaOverlay} close={close} />
            )}
          </TopBarPanelShell>
        </div>
      ))}
    </div>
  );
}
