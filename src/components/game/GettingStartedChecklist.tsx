'use client';

/**
 * "Getting started" checklist for a new city: road, zone next to it, power, water. Each step ticks off from
 * the live city (checked every few seconds, not every render) and clicking a step picks its tool.
 * Closed for good per city (by id) once all four are done or the player dismisses it.
 */
import React, { useEffect, useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { GameState, Tool } from '@/types/game';
import { useGame } from '@/context/GameContext';
import { closeChecklist, isChecklistClosed } from '@/lib/feedbackPrefs';
import { cn } from '@/lib/utils';

const CHECK_INTERVAL_MS = 3000;

const LABELS = {
  title: msg('Getting started'),
  dismiss: msg('Dismiss checklist'),
  expand: msg('Show checklist'),
  collapse: msg('Hide checklist'),
};

type StepId = 'road' | 'zone' | 'power' | 'water';
type Progress = Record<StepId, boolean>;

const STEPS: { id: StepId; label: ReturnType<typeof msg>; tool: Tool }[] = [
  { id: 'road', label: msg('Build a road'), tool: 'road' },
  { id: 'zone', label: msg('Zone land next to it'), tool: 'zone_residential' },
  { id: 'power', label: msg('Add power'), tool: 'power_plant' },
  { id: 'water', label: msg('Add water'), tool: 'water_tower' },
];

const NONE: Progress = { road: false, zone: false, power: false, water: false };

const isRoad = (type: string) => type === 'road' || type === 'bridge';

/** One grid pass: which of the four starter steps the city has done. */
export function getStarterProgress(state: Pick<GameState, 'grid' | 'gridSize'>): Progress {
  const { grid, gridSize } = state;
  const p: Progress = { ...NONE };
  for (let y = 0; y < gridSize; y++) {
    const row = grid[y];
    for (let x = 0; x < gridSize; x++) {
      const tile = row[x];
      const type = tile.building.type;
      if (isRoad(type)) p.road = true;
      else if (type === 'power_plant') p.power = true;
      else if (type === 'water_tower' || type === 'jal_sansthan_water_works') p.water = true;
      if (!p.zone && tile.zone !== 'none') {
        p.zone =
          (x > 0 && isRoad(row[x - 1].building.type)) ||
          (x < gridSize - 1 && isRoad(row[x + 1].building.type)) ||
          (y > 0 && isRoad(grid[y - 1][x].building.type)) ||
          (y < gridSize - 1 && isRoad(grid[y + 1][x].building.type));
      }
    }
  }
  return p;
}

const isComplete = (p: Progress) => p.road && p.zone && p.power && p.water;

/** Mount with `key={cityId}` so a new city starts fresh. */
export function GettingStartedChecklist({
  cityId,
  compact = false,
  className,
}: {
  cityId: string;
  /** Mobile: starts collapsed to a one-line header. */
  compact?: boolean;
  className?: string;
}) {
  const m = useMessages();
  const { latestStateRef, setTool } = useGame();
  const [closed, setClosed] = useState(() => isChecklistClosed(cityId));
  const [expanded, setExpanded] = useState(!compact);
  const [progress, setProgress] = useState<Progress>(NONE);

  useEffect(() => {
    if (closed) return;
    const check = () => {
      const next = getStarterProgress(latestStateRef.current);
      setProgress((prev) => (STEPS.every((s) => prev[s.id] === next[s.id]) ? prev : next));
      if (isComplete(next)) {
        closeChecklist(cityId);
        setClosed(true);
      }
    };
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [closed, cityId, latestStateRef]);

  if (closed) return null;

  const done = STEPS.filter((s) => progress[s.id]).length;
  const dismiss = () => {
    closeChecklist(cityId);
    setClosed(true);
  };

  return (
    <div className={cn('hud-panel pointer-events-auto rounded-xl p-2.5 text-sm', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={m(expanded ? LABELS.collapse : LABELS.expand)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left min-h-8"
        >
          <span className="font-semibold text-foreground truncate">{m(LABELS.title)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{done}/{STEPS.length}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={m(LABELS.dismiss)}
          className="text-muted-foreground hover:text-foreground -m-1 min-w-11 min-h-11 md:min-w-8 md:min-h-8 rounded-lg flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <ol className="mt-1.5 flex flex-col gap-0.5">
          {STEPS.map((step) => {
            const isDone = progress[step.id];
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setTool(step.tool)}
                  className="w-full flex items-center gap-2 rounded-lg px-1.5 py-1 min-h-8 text-left hover:bg-sandstone/[0.06]"
                >
                  <span
                    className={cn(
                      'h-4 w-4 shrink-0 rounded-full ring-1 flex items-center justify-center',
                      isDone ? 'bg-marigold/20 ring-marigold/60 text-marigold' : 'ring-sandstone/30'
                    )}
                  >
                    {isDone && <Check className="w-3 h-3" />}
                  </span>
                  <span className={cn('text-xs', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                    {m(step.label)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
