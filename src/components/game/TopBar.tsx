// CHANGE SUMMARY: Decluttered the metrics ribbon into four grouped chips (People, Money, Services, River; see TopBarGroups.tsx)
// plus a calendar panel behind the date. The second row of rating bars, the demand bars and the tax slider moved into those panels.
// Earlier state: ~14 separate stats, a tax slider, a time-of-year bar and a second row of five rating bars.

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { msg, useMessages } from 'gt-next';
import { useLocale, useSetLocale } from 'gt-next/client';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/Icons';
import { LANGUAGE_OPTIONS } from '@/components/ui/LanguageSelector';
import { CalendarPanelBody, TopBarGroups, TopBarPanelShell, type TopBarPanelId } from '@/components/game/TopBarGroups';
import type { OverlayMode } from '@/components/game/types';
import { FogChip, SeasonDateLabel } from '@/components/game/SeasonCalendar';
import { FestivalChip } from '@/components/game/FestivalPanel';

// Translatable UI labels
const UI_LABELS = {
  viewOverlay: msg('View Overlay'),
  minimap: msg('Minimap'),
  languageSwitcher: msg('Language'),
  calendar: msg('Calendar'),
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
      <svg className="w-4 h-4 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    // Sunrise/sunset icon
    return (
      <svg className="w-4 h-4 text-orange-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  } else {
    // Sun icon
    return (
      <svg className="w-4 h-4 text-amber-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  }
};

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
  /** Fires when a detail popover opens or closes, so passive toasts can step aside. */
  onPanelOpenChange?: (open: boolean) => void;
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
  onPanelOpenChange,
}: TopBarProps) {
  const { state, setSpeed, visualHour } = useGame();
  const { year, month, day, speed, cityName } = state;
  const m = useMessages();
  const locale = useLocale();
  const setLocale = useSetLocale();
  // One panel open at a time: a group chip's details or the calendar.
  const [openId, setOpenId] = useState<TopBarPanelId | null>(null);
  const panelOpen = openId !== null;
  useEffect(() => { onPanelOpenChange?.(panelOpen); }, [panelOpen, onPanelOpenChange]);

  const formattedDate = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
  const speedLabels = ['Pause', 'Normal', 'Fast', 'Very Fast'];
  const handleCalendarEvent = useCallback((id: string) => {
    setOpenId(null);
    onCalendarEventClick?.(id);
  }, [onCalendarEventClick]);

  return (
    <div className="relative z-40 h-14 flex items-center gap-2 px-3 min-[1440px]:gap-3 min-[1440px]:px-4 border-b border-chrome-border bg-chrome-panel">
      <div className="flex shrink-0 items-center gap-3 min-[1440px]:gap-4">
        {/* Bounded slot: it grows to fit a festival / fog chip, up to a cap, instead of pushing the speed
            buttons sideways; past the cap a long city name truncates, never the chip.
            The date line opens the calendar panel (the season strip lives there now). */}
        <div className="relative min-w-48 max-w-60 min-[1440px]:min-w-56 min-[1440px]:max-w-72 shrink-0">
          <div className="flex items-center gap-1.5">
            <h1 className="min-w-0 shrink font-sans font-semibold text-chrome-text text-[19px] leading-none truncate" title={cityName}>{cityName}</h1>
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <FogChip weather={state.weather} hour={visualHour} />
              <FestivalChip month={month} day={day} hour={visualHour} mapId={state.mapId} />
            </span>
          </div>
          <button
            id="topbar-trigger-calendar"
            type="button"
            onClick={() => setOpenId(openId === 'calendar' ? null : 'calendar')}
            aria-expanded={openId === 'calendar'}
            aria-controls="topbar-panel-calendar"
            aria-label={`${String(m(UI_LABELS.calendar))}: ${formattedDate}`}
            title={formattedDate}
            className="press -ml-1 mt-1 flex max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-none px-1 py-0.5 text-chrome-muted text-[11px] font-mono hover:bg-chrome-well"
          >
            <SeasonDateLabel month={month} year={year} />
            <TimeOfDayIcon hour={visualHour} />
          </button>
          <TopBarPanelShell id="calendar" openId={openId} onOpenChange={setOpenId} variant="desktop" label={String(m(UI_LABELS.calendar))}>
            <CalendarPanelBody onEventClick={handleCalendarEvent} />
          </TopBarPanelShell>
        </div>
      </div>

      {/* Everything but the city name sits on the right; the gap in the middle keeps the name readable. */}
      <div className="ml-auto flex min-w-0 items-center gap-2 min-[1440px]:gap-3">
        <div className="hud-well flex shrink-0 items-center gap-0.5 rounded-none p-1" role="group" aria-label="Game speed">
          {[0, 1, 2, 3].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              className={`press h-8 w-8 rounded-none flex items-center justify-center ${
                speed === s ? 'hud-selected' : 'text-chrome-muted hover:text-chrome-text hover:bg-chrome-well'
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

        <TopBarGroups
        variant="desktop"
        openId={openId}
        onOpenChange={setOpenId}
        gangaOverlayActive={gangaOverlayActive}
        onToggleGangaOverlay={onToggleGangaOverlay}
        overlayMode={overlayMode}
        onTogglePowerOverlay={onTogglePowerOverlay}
        onToggleWaterOverlay={onToggleWaterOverlay}
      />

        <div className="flex shrink-0 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="press gap-1 h-11 px-2.5 min-[1440px]:px-3 rounded-none border border-chrome-border text-chrome-text hover:bg-chrome-well">
              <span className="text-xs">Options</span>
              <ChevronDown size={14} strokeWidth={1.75} className="text-chrome-muted" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <div className="px-2 py-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-chrome-muted">{String(m(UI_LABELS.viewOverlay))}</span>
                  <Switch checked={showOverlayPanel} onCheckedChange={onToggleOverlayPanel} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-chrome-muted">{String(m(UI_LABELS.minimap))}</span>
                  <Switch checked={showMinimap} onCheckedChange={onToggleMinimap} />
                </div>
              </div>
            </div>
            <Separator className="my-1" />
            <div className="px-2 py-1.5 text-xs uppercase tracking-wide text-chrome-muted">
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
                  <span className="text-xs text-chrome-text">✓</span>
                ) : (
                  <span className="w-3 h-3" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
