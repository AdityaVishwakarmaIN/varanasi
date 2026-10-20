'use client';

import React, { useState, useCallback } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Tile } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayIcon, PauseIcon, CloseIcon } from '@/components/ui/Icons';
import { Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { formatPopulation } from '@/lib/format';
import { CalendarPanelBody, TopBarGroups, TopBarPanelShell, type TopBarPanelId } from '@/components/game/TopBarGroups';
import type { OverlayMode } from '@/components/game/types';
import { FogChip, SeasonDateLabel } from '@/components/game/SeasonCalendar';
import { FestivalChip } from '@/components/game/FestivalPanel';
import { describeGangaTileEffect, getGangaTileEffectInfo } from '@/lib/ganga';

// Translatable UI labels
const UI_LABELS = {
  pop: msg('Pop'),
  emptyLot: msg('Empty Lot'),
  jobs: msg('Jobs'),
  noPower: msg('No power'),
  noWater: msg('No water'),
  exitDialogTitle: msg('Exit to Main Menu'),
  exitDialogDescription: msg('Would you like to save your city before exiting?'),
  exitWithoutSaving: msg('Exit Without Saving'),
  saveAndExit: msg('Save & Exit'),
  zone: msg('Zone'),
  cancel: msg('Cancel'),
  landValue: msg('Land'),
  pollution: msg('Pollution'),
  power: msg('Power'),
  water: msg('Water'),
  pause: msg('Pause'),
  resume: msg('Resume'),
  speed: msg('Game speed'),
  calendar: msg('Calendar'),
};

// Sun/Moon icon for time of day
function TimeOfDayIcon({ hour }: { hour: number }) {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;

  if (isNight) {
    return (
      <svg className="w-3 h-3 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    return (
      <svg className="w-3 h-3 text-amber-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  } else {
    return (
      <svg className="w-3 h-3 text-amber-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  }
}

export function MobileTopBar({ 
  selectedTile, 
  services, 
  onCloseTile,
  gangaOverlayActive = false,
  onToggleGangaOverlay,
  overlayMode = 'none',
  onTogglePowerOverlay,
  onToggleWaterOverlay,
  onCalendarEventClick,
  onShare,
  onExit,
}: { 
  selectedTile: Tile | null;
  services: { police: number[][]; fire: number[][]; health: number[][]; education: number[][]; power: boolean[][]; water: boolean[][] };
  onCloseTile: () => void;
  /** Varanasi map: the Ganga Health chip toggles the Ganga overlay (S2-T8). */
  gangaOverlayActive?: boolean;
  onToggleGangaOverlay?: () => void;
  /** Power / water chips (S3-T7/T8) toggle those overlays. */
  overlayMode?: OverlayMode;
  onTogglePowerOverlay?: () => void;
  onToggleWaterOverlay?: () => void;
  /** Calendar-strip event clicked (festivals open the Event panel, S5-T4). */
  onCalendarEventClick?: (id: string) => void;
  onShare?: () => void;
  onExit?: () => void;
}) {
  const { state, setSpeed, visualHour, saveCity, discardUnsavedChanges } = useGame();
  const { year, month, day, speed, cityName } = state;
  // One panel open at a time: a group chip's details or the calendar.
  const [openId, setOpenId] = useState<TopBarPanelId | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  // Speed to resume at after a pause (the speed button shows it while paused)
  const [lastRunSpeed, setLastRunSpeed] = useState<1 | 2 | 3>(1);
  const shownSpeed: 1 | 2 | 3 = speed === 0 ? lastRunSpeed : speed;
  const changeSpeed = useCallback((next: 1 | 2 | 3) => {
    setLastRunSpeed(next);
    setSpeed(next);
  }, [setSpeed]);
  const m = useMessages();

  const handleSaveAndExit = useCallback(() => {
    saveCity();
    setShowExitDialog(false);
    onExit?.();
  }, [saveCity, onExit]);

  const handleExitWithoutSaving = useCallback(() => {
    discardUnsavedChanges(); // no autosave on the way out, so Continue restores the last save
    setShowExitDialog(false);
    onExit?.();
  }, [discardUnsavedChanges, onExit]);

  const handleCalendarEvent = useCallback((id: string) => {
    setOpenId(null);
    onCalendarEventClick?.(id);
  }, [onCalendarEventClick]);

  // S2-T8: "Effect on Ganga" for catchment tiles (memoized per grid inside ganga.ts).
  const gangaEffectInfo = selectedTile
    ? getGangaTileEffectInfo(state.grid, state.gridSize, state.mapId, selectedTile.x, selectedTile.y)
    : null;
  const gangaEffectLines = gangaEffectInfo ? describeGangaTileEffect(gangaEffectInfo, formatPopulation) : null;

  return (
    <>
      {/* Main Top Bar */}
      <Card className="hud-panel bg-chrome-panel text-chrome-text fixed top-0 left-0 right-0 z-40 rounded-none border-x-0 border-t-0 border-chrome-border safe-area-top safe-area-left safe-area-right">
        <div className="flex items-center px-3 py-0">
          {/* Left: city name, then the date and season (always shown, abbreviated); event chips share the date line and truncate first */}
          <button
            className="flex min-h-11 min-w-[7.5rem] flex-1 flex-col items-start justify-center overflow-hidden p-0 m-0 text-left active:opacity-70"
            id="topbar-trigger-calendar"
            onClick={() => setOpenId(openId === 'calendar' ? null : 'calendar')}
            aria-expanded={openId === 'calendar'}
            aria-controls="topbar-panel-calendar"
            aria-label={`${cityName}, ${String(m(UI_LABELS.calendar)).toLowerCase()}`}
          >
            <span className="block max-w-full min-w-[3rem] truncate font-sans font-semibold text-[15px] leading-none text-chrome-text pt-0.5">
              {cityName}
            </span>
            <span className="mt-0.5 flex max-w-full items-center gap-1 text-chrome-muted text-[10px] font-mono">
              <span className="shrink-0"><SeasonDateLabel month={month} year={year} short /></span>
              <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                <FogChip weather={state.weather} hour={visualHour} className="shrink-0" />
                <FestivalChip month={month} day={state.day} hour={visualHour} mapId={state.mapId} className="min-w-0 truncate whitespace-nowrap" />
              </span>
            </span>
          </button>

          {/* Speed controls and exit button. S1-T11: every button is a 44×44 px touch target;
              the four speed buttons became pause/resume + a speed button that cycles 1× → 2× → 3×. */}
          <div className="flex items-center -mr-2">
            <button
              onClick={() => (speed === 0 ? changeSpeed(shownSpeed) : setSpeed(0))}
              className="h-11 w-11 p-0 m-0 flex items-center justify-center"
              title={speed === 0 ? m(UI_LABELS.resume) : m(UI_LABELS.pause)}
              aria-label={speed === 0 ? m(UI_LABELS.resume) : m(UI_LABELS.pause)}
            >
              <span className={`h-8 w-8 flex items-center justify-center rounded-none transition-transform active:scale-95 ${
                speed === 0 ? 'hud-selected' : 'hud-well text-chrome-muted'
              }`}>
                {speed === 0 ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
              </span>
            </button>
            <button
              onClick={() => changeSpeed(speed === 0 ? shownSpeed : ((speed % 3) + 1) as 1 | 2 | 3)}
              className="h-11 w-11 p-0 m-0 flex items-center justify-center"
              title={m(UI_LABELS.speed)}
              aria-label={m(UI_LABELS.speed)}
            >
              <span className={`h-8 w-9 flex items-center justify-center rounded-none transition-transform active:scale-95 ${
                speed !== 0 ? 'hud-selected' : 'hud-well text-chrome-muted'
              }`}>
                <span className={`flex items-center ${shownSpeed === 3 ? '-space-x-[7px]' : '-space-x-[5px]'}`}>
                  {Array.from({ length: shownSpeed }, (_, i) => <PlayIcon key={i} size={12} />)}
                </span>
              </span>
            </button>

            {/* Language selector, Share, and Exit button group */}
            <LanguageSelector useDrawer iconSize={14} />

            {onShare && (
              <button
                onClick={onShare}
                className="h-11 w-11 p-0 m-0 flex items-center justify-center text-chrome-muted hover:text-chrome-text"
                title="Invite Players"
                aria-label="Invite Players"
              >
                <Users className="w-3.5 h-3.5" />
              </button>
            )}

            {onExit && (
              <button
                onClick={() => setShowExitDialog(true)}
                className="h-11 w-11 p-0 m-0 ml-2 border-l border-chrome-border flex items-center justify-center text-chrome-muted hover:text-chrome-text"
                title="Exit to Main Menu"
                aria-label="Exit to Main Menu"
              >
                <svg 
                  className="w-3.5 h-3.5 -scale-x-100" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>

        </div>

        {/* Group chips: one headline number each; the details open as a panel under the bar. */}
        <div className="flex items-center border-t border-chrome-border bg-chrome-well px-2">
          <TopBarGroups
            variant="mobile"
            className="w-full"
            openId={openId}
            onOpenChange={setOpenId}
            gangaOverlayActive={gangaOverlayActive}
            onToggleGangaOverlay={onToggleGangaOverlay}
            overlayMode={overlayMode}
            onTogglePowerOverlay={onTogglePowerOverlay}
            onToggleWaterOverlay={onToggleWaterOverlay}
          />
        </div>
        <TopBarPanelShell id="calendar" openId={openId} onOpenChange={setOpenId} variant="mobile" label={String(m(UI_LABELS.calendar))}>
          <CalendarPanelBody onEventClick={handleCalendarEvent} />
        </TopBarPanelShell>

        {/* Tile Info Row - Mobile Only: labelled stats that wrap; the close button is pinned and never clipped */}
        {selectedTile && (
          <div className="border-t border-chrome-border bg-chrome-well pl-3 pr-1 flex items-start gap-1 text-[11px]">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  selectedTile.zone === 'residential' ? 'bg-green-500' :
                  selectedTile.zone === 'commercial' ? 'bg-blue-500' :
                  selectedTile.zone === 'industrial' ? 'bg-amber-500' : 'bg-chrome-border'
                }`} />
                <span className="text-xs font-medium text-chrome-text capitalize">
                  {selectedTile.building.type === 'empty'
                    ? (selectedTile.zone === 'none' ? m(UI_LABELS.emptyLot) : `${selectedTile.zone} ${m(UI_LABELS.zone)}`)
                    : selectedTile.building.type.replace(/_/g, ' ')}
                </span>
              </div>

              {selectedTile.building.population > 0 && (
                <span className="text-chrome-muted">{m(UI_LABELS.pop)} <span className="font-mono text-chrome-text">{formatPopulation(selectedTile.building.population)}</span></span>
              )}
              {selectedTile.building.jobs > 0 && (
                <span className="text-chrome-muted">{m(UI_LABELS.jobs)} <span className="font-mono text-chrome-text">{formatPopulation(selectedTile.building.jobs)}</span></span>
              )}

              {/* Utilities: green when served, red when missing (not for river water) */}
              {selectedTile.building.type !== 'water' && (<>
              <span className={selectedTile.building.powered ? 'text-green-800' : 'text-red-800'}>
                {selectedTile.building.powered ? `✓ ${m(UI_LABELS.power)}` : m(UI_LABELS.noPower)}
              </span>
              <span className={selectedTile.building.watered ? 'text-green-800' : 'text-red-800'}>
                {selectedTile.building.watered ? `✓ ${m(UI_LABELS.water)}` : m(UI_LABELS.noWater)}
              </span>
              </>)}

              <span className="text-chrome-muted">{m(UI_LABELS.landValue)} <span className="font-mono text-chrome-text">{selectedTile.landValue}</span></span>

              {selectedTile.pollution > 0 && (
                <span className={selectedTile.pollution > 50 ? 'text-red-800' : selectedTile.pollution > 25 ? 'text-amber-800' : 'text-green-800'}>
                  {m(UI_LABELS.pollution)} <span className="font-mono">{Math.min(100, Math.round(selectedTile.pollution))}%</span>
                </span>
              )}
            </div>

            <button
              onClick={onCloseTile}
              aria-label="Close"
              className="h-11 w-11 flex items-center justify-center text-chrome-muted hover:text-chrome-text transition-colors shrink-0"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        )}

        {/* Effect on Ganga (Varanasi catchment tiles only) */}
        {selectedTile && gangaEffectLines && (
          <div className="border-t border-chrome-border bg-chrome-well px-3 py-1 flex items-center gap-1.5 text-[10px] min-w-0">
            <span className="text-chrome-muted shrink-0">Effect on Ganga:</span>
            <span className="truncate">
              {gangaEffectLines.map((line, i) => (
                <span
                  key={line.text}
                  className={line.tone === 'hurts' ? 'text-red-800' : line.tone === 'cleans' ? 'text-green-800' : 'text-chrome-muted'}
                >
                  {i > 0 ? ' · ' : ''}{line.text}
                </span>
              ))}
            </span>
          </div>
        )}
      </Card>

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m(UI_LABELS.exitDialogTitle)}</DialogTitle>
            <DialogDescription>
              {m(UI_LABELS.exitDialogDescription)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowExitDialog(false)}
              className="w-full sm:w-auto h-11"
            >
              {m(UI_LABELS.cancel)}
            </Button>
            <Button
              variant="outline"
              onClick={handleExitWithoutSaving}
              className="w-full sm:w-auto h-11"
            >
              {m(UI_LABELS.exitWithoutSaving)}
            </Button>
            <Button
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto h-11"
            >
              {m(UI_LABELS.saveAndExit)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MobileTopBar;
