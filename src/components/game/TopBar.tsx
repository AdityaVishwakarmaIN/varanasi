// CHANGE SUMMARY: Replaced the desktop language button with an Options dropdown containing overlay/minimap toggles plus language selection.
// Earlier state: language selector was a standalone control and did not expose view panel visibility actions from the top bar.

'use client';

import React, { useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { useLocale, useSetLocale } from 'gt-next/client';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  PlayIcon,
  PauseIcon,
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  EnvironmentIcon,
  PopulationIcon,
  JobsIcon,
} from '@/components/ui/Icons';
import { HudStat } from '@/components/game/HudStat';
import { LANGUAGE_OPTIONS } from '@/components/ui/LanguageSelector';
import { formatINR, formatPopulation } from '@/lib/format';
import { GangaHealthChip } from '@/components/game/GangaHealthChip';
import { UtilityChip, shouldShowUtilityChip } from '@/components/game/UtilityChip';
import type { OverlayMode } from '@/components/game/types';
import { FogChip, SeasonDateLabel, SeasonStrip } from '@/components/game/SeasonCalendar';
import { FestivalChip } from '@/components/game/FestivalPanel';

// Translatable UI labels
const UI_LABELS = {
  population: msg('Population'),
  jobs: msg('Jobs'),
  funds: msg('Funds'),
  monthly: msg('Monthly'),
  tax: msg('Tax'),
  happiness: msg('Happiness'),
  health: msg('Health'),
  education: msg('Education'),
  safety: msg('Safety'),
  environment: msg('Environment'),
  viewOverlay: msg('View Overlay'),
  minimap: msg('Minimap'),
  languageSwitcher: msg('Language'),
};

// ============================================================================
// TIME OF DAY ICON
// ============================================================================

interface TimeOfDayIconProps {
  hour: number;
}

export const TimeOfDayIcon = ({ hour }: TimeOfDayIconProps) => {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;
  
  if (isNight) {
    // Moon icon
    return (
      <svg className="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    // Sunrise/sunset icon
    return (
      <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  } else {
    // Sun icon
    return (
      <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  }
};

// ============================================================================
// STAT BADGE
// ============================================================================

interface StatBadgeProps {
  value: string;
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function StatBadge({ value, label, variant = 'default' }: StatBadgeProps) {
  const colorClass = variant === 'success' ? 'text-green-500' : 
                     variant === 'warning' ? 'text-amber-500' : 
                     variant === 'destructive' ? 'text-red-500' : 'text-foreground';
  
  return (
    <div className="flex flex-col items-start min-w-[70px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className={`whitespace-nowrap text-sm font-mono tabular-nums font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}

// ============================================================================
// DEMAND INDICATOR
// ============================================================================

interface DemandIndicatorProps {
  label: string;
  demand: number;
  color: string;
}

export function DemandIndicator({ label, demand, color }: DemandIndicatorProps) {
  const height = Math.abs(demand) / 2;
  const isPositive = demand >= 0;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[9px] font-bold leading-none ${color}`}>{label}</span>
      <div className="w-2.5 h-7 bg-black/40 ring-1 ring-gold/15 relative rounded-full overflow-hidden">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gold/30" />
        <div
          className={`absolute left-0 right-0 rounded-full ${color.replace('text-', 'bg-')}`}
          style={{
            height: `${height}%`,
            top: isPositive ? `${50 - height}%` : '50%',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MINI STAT (for StatsPanel)
// ============================================================================

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

export function MiniStat({ icon, label, value }: MiniStatProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = value >= 70 ? 'text-emerald-300' : value >= 40 ? 'text-amber-300' : 'text-red-400';
  const bar = value >= 70 ? 'bg-emerald-400' : value >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`${label} ${pct}%`}>
      <span className="text-gold/80">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="relative h-1 w-12 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <span className={`absolute inset-y-0 left-0 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`font-mono font-semibold w-8 ${color}`}>{pct}%</span>
    </div>
  );
}

// ============================================================================
// STATS PANEL
// ============================================================================

export const StatsPanel = React.memo(function StatsPanel() {
  const { state } = useGame();
  const { stats } = state;
  const m = useMessages();
  
  return (
    <div className="relative z-10 h-8 flex items-center justify-center gap-7 text-xs border-b border-gold/15 bg-gradient-to-b from-[hsl(234_40%_10%)] to-[hsl(234_42%_8%)]">
      <MiniStat icon={<HappyIcon size={12} />} label={String(m(UI_LABELS.happiness))} value={stats.happiness} />
      <MiniStat icon={<HealthIcon size={12} />} label={String(m(UI_LABELS.health))} value={stats.health} />
      <MiniStat icon={<EducationIcon size={12} />} label={String(m(UI_LABELS.education))} value={stats.education} />
      <MiniStat icon={<SafetyIcon size={12} />} label={String(m(UI_LABELS.safety))} value={stats.safety} />
      <MiniStat icon={<EnvironmentIcon size={12} />} label={String(m(UI_LABELS.environment))} value={stats.environment} />
    </div>
  );
});

// ============================================================================
// TOP BAR
// ============================================================================

interface TopBarProps {
  showOverlayPanel: boolean;
  showMinimap: boolean;
  onToggleOverlayPanel: (isVisible: boolean) => void;
  onToggleMinimap: (isVisible: boolean) => void;
  /** Varanasi map: the Ganga Health chip toggles the Ganga overlay. */
  gangaOverlayActive?: boolean;
  onToggleGangaOverlay?: () => void;
  /** Power / water chips (S3-T7/T8) toggle those overlays. */
  overlayMode?: OverlayMode;
  onTogglePowerOverlay?: () => void;
  onToggleWaterOverlay?: () => void;
  /** Calendar-strip event clicked (festivals open the Event panel, S5-T4). */
  onCalendarEventClick?: (id: string) => void;
}

export const TopBar = React.memo(function TopBar({
  showOverlayPanel,
  showMinimap,
  onToggleOverlayPanel,
  onToggleMinimap,
  gangaOverlayActive = false,
  onToggleGangaOverlay,
  overlayMode = 'none',
  onTogglePowerOverlay,
  onToggleWaterOverlay,
  onCalendarEventClick,
}: TopBarProps) {
  const { state, setSpeed, setTaxRate, visualHour } = useGame();
  const { stats, year, month, day, speed, taxRate, cityName } = state;
  const gangaHealth = state.mapId === 'varanasi' ? stats.gangaHealth : undefined;
  const m = useMessages();
  const locale = useLocale();
  const setLocale = useSetLocale();
  
  const formattedDate = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
  
  const monthly = stats.income - stats.expenses;
  const speedLabels = ['Pause', 'Normal', 'Fast', 'Very Fast'];

  return (
    <div className="relative z-20 h-16 flex items-center justify-between gap-3 px-4 border-b border-gold/25 bg-gradient-to-b from-[hsl(var(--hud-top))] to-[hsl(var(--hud-bottom))] shadow-[inset_0_1px_0_hsl(var(--hud-highlight)/0.06),0_6px_20px_-8px_rgb(0_0_0/0.7)]">
      {/* Gold hairline along the bottom edge */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="ornament text-marigold" aria-hidden />
            <h1 className="font-display text-[19px] leading-none text-sandstone truncate max-w-[180px]">{cityName}</h1>
          </div>
          <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-muted-foreground text-[11px] font-mono">
            <Tooltip>
              <TooltipTrigger asChild>
                <span><SeasonDateLabel month={month} year={year} /></span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formattedDate}</p>
              </TooltipContent>
            </Tooltip>
            <TimeOfDayIcon hour={visualHour} />
            <FogChip weather={state.weather} hour={visualHour} />
            <FestivalChip month={month} day={day} hour={visualHour} mapId={state.mapId} />
          </div>
          <SeasonStrip month={month} year={year} day={day} events={state.forecasts} onEventClick={onCalendarEventClick} className="mt-1 max-w-[160px]" />
        </div>
        
        <div className="hud-well flex items-center gap-0.5 rounded-xl p-1" role="group" aria-label="Game speed">
          {[0, 1, 2, 3].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              className={`press h-8 w-8 rounded-lg flex items-center justify-center ${
                speed === s ? 'hud-selected' : 'text-muted-foreground hover:text-foreground hover:bg-sandstone/10'
              }`}
              title={speedLabels[s]}
              aria-label={speedLabels[s]}
              aria-pressed={speed === s}
            >
              {s === 0 ? <PauseIcon size={12} /> : 
               s === 1 ? <PlayIcon size={12} /> : 
               s === 2 ? (
                 <div className="flex items-center -space-x-[5px]">
                   <PlayIcon size={12} />
                   <PlayIcon size={12} />
                 </div>
               ) :
               <div className="flex items-center -space-x-[7px]">
                 <PlayIcon size={12} />
                 <PlayIcon size={12} />
                 <PlayIcon size={12} />
               </div>}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 min-w-0">
        <HudStat
          icon={<PopulationIcon size={16} />}
          tint="sandstone"
          value={formatPopulation(stats.population)}
          label={String(m(UI_LABELS.population))}
        />
        <HudStat
          icon={<JobsIcon size={16} />}
          tint="sandstone"
          value={formatPopulation(stats.jobs)}
          label={String(m(UI_LABELS.jobs))}
        />
        <HudStat
          icon={<span className="text-[15px] font-bold leading-none">₹</span>}
          tint="marigold"
          value={formatINR(stats.money)}
          label={String(m(UI_LABELS.funds))}
          tone={stats.money < 0 ? 'destructive' : stats.money < 1000 ? 'warning' : 'default'}
        />
        <HudStat
          icon={<span className="text-sm font-bold leading-none">{monthly >= 0 ? '▲' : '▼'}</span>}
          tint={monthly >= 0 ? 'good' : 'bad'}
          value={`${monthly >= 0 ? '+' : ''}${formatINR(monthly)}`}
          label={String(m(UI_LABELS.monthly))}
          tone={monthly >= 0 ? 'success' : 'destructive'}
        />
        {gangaHealth !== undefined && onToggleGangaOverlay && (
          <GangaHealthChip
            variant="desktop"
            gangaHealth={gangaHealth}
            gangaHealthTarget={stats.gangaHealthTarget}
            active={gangaOverlayActive}
            onClick={onToggleGangaOverlay}
          />
        )}
        {(['power', 'water'] as const).map((kind) => {
          const supply = stats[kind];
          const onToggle = kind === 'power' ? onTogglePowerOverlay : onToggleWaterOverlay;
          if (!onToggle || !shouldShowUtilityChip(supply, 'desktop')) return null;
          return (
            <UtilityChip
              key={kind}
              kind={kind}
              variant="desktop"
              stats={supply}
              active={overlayMode === kind}
              onClick={onToggle}
            />
          );
        })}
      </div>
      
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5" role="group" aria-label="Zone demand">
          <DemandIndicator label="R" demand={stats.demand.residential} color="text-green-500" />
          <DemandIndicator label="C" demand={stats.demand.commercial} color="text-blue-500" />
          <DemandIndicator label="I" demand={stats.demand.industrial} color="text-amber-500" />
        </div>
        
        <div className="hud-well flex items-center gap-2 rounded-xl h-11 px-3">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{m(UI_LABELS.tax)}</span>
          <Slider
            value={[taxRate]}
            onValueChange={(value) => setTaxRate(value[0])}
            min={0}
            max={100}
            step={1}
            className="w-14"
            aria-label={String(m(UI_LABELS.tax))}
          />
          <span className="text-foreground text-xs font-mono font-semibold w-7">{taxRate}%</span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="press gap-1 h-11 px-3 rounded-xl border border-gold/15 hover:border-gold/40">
              <span className="text-xs">Options</span>
              <span className="text-xs text-gold/80" aria-hidden>▾</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <div className="px-2 py-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{String(m(UI_LABELS.viewOverlay))}</span>
                  <Switch checked={showOverlayPanel} onCheckedChange={onToggleOverlayPanel} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{String(m(UI_LABELS.minimap))}</span>
                  <Switch checked={showMinimap} onCheckedChange={onToggleMinimap} />
                </div>
              </div>
            </div>
            <Separator className="my-1" />
            <div className="px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              {String(m(UI_LABELS.languageSwitcher))}
            </div>
            {LANGUAGE_OPTIONS.map((language) => (
              <DropdownMenuItem
                key={language.code}
                onClick={() => setLocale(language.code)}
                className="flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="text-xs">{language.name}</span>
                {language.code === locale ? (
                  <span className="text-xs text-marigold">✓</span>
                ) : (
                  <span className="w-3 h-3" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
