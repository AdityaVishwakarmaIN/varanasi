'use client';

import React, { useMemo } from 'react';
import { msg, useMessages } from 'gt-next';
import { Tile, TOOL_INFO, BUILDING_STATS } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CloseIcon } from '@/components/ui/Icons';
import { useGame } from '@/context/GameContext';
import {
  SERVICE_CONFIG,
  SERVICE_BUILDING_TYPES,
  SERVICE_MAX_LEVEL,
  SERVICE_RANGE_INCREASE_PER_LEVEL,
  SERVICE_UPGRADE_COST_BASE,
} from '@/lib/simulation';
import { formatINR, formatPopulation } from '@/lib/format';
import { describeGangaTileEffect, getGangaTileEffectInfo } from '@/lib/ganga';
import { isMixedUse } from '@/lib/mixedUse';
import { getMonsoonsThatFlood } from '@/lib/floods';
import { getEffectiveLandValue } from '@/lib/floodSim';
import { getBuildingDisplayName } from '@/games/isocity/maps/varanasiCatalog';
import { getTileStatusContext, getTileStatuses, type StatusSeverity, type TileStatus } from '@/lib/tileStatus';
import { ProblemIconGlyph } from '@/components/game/ProblemIconGlyph';
import { useScrollFade } from '@/hooks/useScrollFade';

interface TileInfoPanelProps {
  tile: Tile;
  services: {
    police: number[][];
    fire: number[][];
    health: number[][];
    education: number[][];
    power: boolean[][];
    water: boolean[][];
  };
  onClose: () => void;
  isMobile?: boolean;
}

const ZONE_LABELS: Record<string, string> = {
  residential: msg('Residential'),
  commercial: msg('Commercial'),
  industrial: msg('Industrial'),
};

const SEVERITY_TEXT: Record<StatusSeverity, string> = {
  critical: 'text-red-800',
  warning: 'text-amber-800',
  info: 'text-chrome-text',
};
const SEVERITY_DOT: Record<StatusSeverity, string> = {
  critical: 'bg-red-800',
  warning: 'bg-amber-700',
  info: 'bg-chrome-muted',
};

const BADGE_OK = 'border-green-800/40 bg-green-800/15 text-green-800 hover:bg-green-800/15';
const BADGE_WARN = 'border-amber-800/40 bg-amber-800/15 text-amber-800 hover:bg-amber-800/15';
const BADGE_BAD = 'border-red-800/40 bg-red-800/15 text-red-800 hover:bg-red-800/15';

/** One status: the map's glyph (or a severity dot), what is wrong, why, and what to do. */
function StatusEntry({ status, m }: { status: TileStatus; m: (s: string) => string }) {
  return (
    <li className="flex gap-2" data-testid={`tile-status-${status.kind}`}>
      <span className="mt-0.5 flex w-[18px] shrink-0 justify-center">
        {status.icon
          ? <ProblemIconGlyph kind={status.icon} size={18} />
          : <span className={`mt-1 h-2 w-2 rounded-full ${SEVERITY_DOT[status.severity]}`} aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className={`text-xs font-semibold ${SEVERITY_TEXT[status.severity]}`}>{m(status.title)}</div>
        <p className="text-xs leading-snug text-chrome-text">{m(status.cause)}</p>
        {status.notes.map((note) => (
          <p key={note} className="text-xs leading-snug text-chrome-muted">{m(note)}</p>
        ))}
        {status.fix && (
          <p className="text-xs leading-snug text-chrome-text">
            <span className="font-semibold text-chrome-accent">{m(msg('What to do:'))}</span> {m(status.fix)}
          </p>
        )}
      </div>
    </li>
  );
}

export function TileInfoPanel({
  tile,
  services,
  onClose,
  isMobile = false
}: TileInfoPanelProps) {
  const { x, y } = tile;
  const { state, upgradeServiceBuilding } = useGame();
  const m = useMessages();
  const [scrollRef, scrollFadeStyle] = useScrollFade<HTMLDivElement>();
  const displayName = getBuildingDisplayName(tile.building.type, state.mapId);
  const b = tile.building;

  // Which rows make sense for this tile: river water has no utilities, and a power plant has no residents
  const isWater = b.type === 'water';
  const stats = BUILDING_STATS[b.type];
  const isZoned = tile.zone !== 'none';
  const isInformal = b.type === 'informal_housing';
  const isBuilding = !['grass', 'empty', 'water', 'road', 'bridge', 'rail', 'tree'].includes(b.type);
  const underConstruction = b.constructionProgress !== undefined && b.constructionProgress < 100;
  // Abandoned / unfinished buildings keep their level number but house nobody: say so instead of "Level 5/5, 0 people"
  const inactive = b.abandoned || underConstruction;
  const showLevel = !inactive && isBuilding && (isZoned || (stats ? stats.maxPop > 0 || stats.maxJobs > 0 : false));
  const showPopulation = b.population > 0 || (stats?.maxPop ?? 0) > 0 || (tile.zone === 'residential' && isBuilding);
  const showJobs = b.jobs > 0 || (stats?.maxJobs ?? 0) > 0 || ((tile.zone === 'commercial' || tile.zone === 'industrial') && isBuilding);
  const inactiveLabel = b.abandoned ? m(msg('none (abandoned)')) : m(msg('none yet (being built)'));

  // Check if this is a service building
  const isServiceBuilding = SERVICE_BUILDING_TYPES.has(b.type);

  // What is wrong here, why, and what to do (same rules as the map's problem icons)
  const statusContext = useMemo(() => getTileStatusContext(state, x, y), [state, x, y]);
  const statuses = useMemo(() => getTileStatuses(statusContext), [statusContext]);

  // Calculate upgrade cost and info for service buildings
  const upgradeInfo = useMemo(() => {
    if (!isServiceBuilding) return null;

    const buildingType = tile.building.type;
    // Service buildings are also Tools, so we can safely cast
    const baseCost = (TOOL_INFO as Record<string, { cost: number }>)[buildingType]?.cost ?? 0;
    const currentLevel = tile.building.level;

    if (currentLevel >= SERVICE_MAX_LEVEL) return null;

    const upgradeCost = baseCost * Math.pow(SERVICE_UPGRADE_COST_BASE, currentLevel);
    const canAfford = state.stats.money >= upgradeCost;
    const isUnderConstruction = tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100;
    const isAbandoned = tile.building.abandoned;

    // Get base range and calculate effective range
    const config = SERVICE_CONFIG[buildingType as keyof typeof SERVICE_CONFIG];
    const baseRange = config?.range ?? 0;
    const currentEffectiveRange = Math.floor(baseRange * (1 + (currentLevel - 1) * SERVICE_RANGE_INCREASE_PER_LEVEL));
    const nextEffectiveRange = Math.floor(baseRange * (1 + currentLevel * SERVICE_RANGE_INCREASE_PER_LEVEL));

    return {
      cost: upgradeCost,
      canAfford,
      isUnderConstruction,
      isAbandoned,
      currentLevel,
      maxLevel: SERVICE_MAX_LEVEL,
      baseRange,
      currentEffectiveRange,
      nextEffectiveRange,
    };
  }, [isServiceBuilding, tile.building, state.stats.money]);

  // S2-T8: what this tile does to the Ganga (Varanasi catchment tiles only). Effects are memoized per grid in ganga.ts.
  const gangaEffectLines = useMemo(() => {
    const info = getGangaTileEffectInfo(state.grid, state.gridSize, state.mapId, x, y);
    return info ? describeGangaTileEffect(info, formatPopulation) : null;
  }, [state.grid, state.gridSize, state.mapId, x, y]);

  // S4-T5: which monsoons flood this tile (the status above explains it when the tile is at risk)
  const floodsIn = getMonsoonsThatFlood(statusContext.floodRisk);
  const floodExplained = statuses.some((s) => s.kind === 'flood' || s.kind === 'flood_risk');

  const powerBadge = b.powered
    ? { label: m(msg('Connected')), cls: BADGE_OK }
    : statusContext.powerCut ? { label: m(msg('Rolling cut')), cls: BADGE_WARN } : { label: m(msg('No power')), cls: BADGE_BAD };
  const waterBadge = b.watered
    ? { label: m(msg('Connected')), cls: BADGE_OK }
    : statusContext.waterCut ? { label: m(msg('Rolling cut')), cls: BADGE_WARN } : { label: m(msg('No water')), cls: BADGE_BAD };

  const buildingName = isInformal
    ? m(msg('Informal settlement'))
    : displayName ? m(displayName) : b.type.replace(/_/g, ' ');

  const handleUpgrade = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!upgradeInfo || !upgradeInfo.canAfford) return;
    const success = upgradeServiceBuilding(x, y);
    if (success) {
      // Optionally add notification here
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      ref={scrollRef}
      data-no-wheel-zoom
      data-testid="tile-info-panel"
      className={`${isMobile ? 'fixed left-0 right-0 w-full rounded-none border-x-0 border-t border-b z-30' : 'absolute top-4 right-4 w-72 z-50 max-h-[calc(100%-15rem)] overflow-y-auto'}`}
      style={isMobile ? { top: 'calc(72px + env(safe-area-inset-top, 0px))', ...scrollFadeStyle } : scrollFadeStyle}
      onClick={handleCardClick}
      // Touches on the sheet must not reach the map (pan / tap / long-press)
      onTouchStart={isMobile ? (e) => e.stopPropagation() : undefined}
      onTouchEnd={isMobile ? (e) => e.stopPropagation() : undefined}
    >
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-sans capitalize truncate">{buildingName}</CardTitle>
          <div className="text-[10px] text-chrome-muted">{m(msg('Tile ({x}, {y})', { x, y }))}</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={m(msg('Close'))} className="h-8 w-8 shrink-0 text-chrome-text hover:bg-chrome-well">
          <CloseIcon size={16} />
        </Button>
      </CardHeader>

      <CardContent className={`${isMobile ? 'space-y-3' : 'space-y-2'} text-sm`}>
        {!isWater && (
          <section aria-label={m(msg('Status'))} data-testid="tile-status">
            <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-1">{m(msg('Status'))}</div>
            {statuses.length > 0 ? (
              <ul className="space-y-2">
                {statuses.map((s) => <StatusEntry key={s.kind} status={s} m={m} />)}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-xs text-green-800">
                <span className="h-2 w-2 rounded-full bg-green-800" aria-hidden="true" />
                {m(msg('No problems'))}
              </div>
            )}
          </section>
        )}
        {!isWater && <Separator />}

        {!isWater && isZoned && (
        <div className="flex justify-between">
          <span className="text-chrome-muted">{m(msg('Zone'))}</span>
          <Badge variant="outline" className={
            tile.zone === 'residential' ? 'border-green-800/40 bg-green-800/15 text-green-800' :
            tile.zone === 'commercial' ? 'border-blue-800/40 bg-blue-800/15 text-blue-800' :
            tile.zone === 'industrial' ? 'border-amber-800/40 bg-amber-800/15 text-amber-800' : 'border-chrome-border bg-chrome-well text-chrome-text'
          }>
            {ZONE_LABELS[tile.zone] ? m(ZONE_LABELS[tile.zone]) : tile.zone}
          </Badge>
        </div>
        )}
        {!isWater && showLevel && (
          <div className="flex justify-between">
            <span className="text-chrome-muted">{m(msg('Level'))}</span>
            <span>{b.level}/{isServiceBuilding ? SERVICE_MAX_LEVEL : 5}</span>
          </div>
        )}
        {!isWater && showPopulation && (
          <div className="flex justify-between">
            <span className="text-chrome-muted">{m(msg('Population'))}</span>
            <span className={inactive ? 'text-chrome-muted' : undefined}>{inactive ? inactiveLabel : formatPopulation(b.population)}</span>
          </div>
        )}
        {!isWater && showJobs && (
          <div className="flex justify-between">
            <span className="text-chrome-muted">{m(msg('Jobs'))}</span>
            <span className={inactive ? 'text-chrome-muted' : undefined}>{inactive ? inactiveLabel : formatPopulation(b.jobs)}</span>
          </div>
        )}
        {isMixedUse(b.type, b.level) && b.population > 0 && (
          <div className="text-xs text-chrome-muted">
            {m(msg('Shops: {jobs} jobs · Homes above: {residents} residents', {
              jobs: formatPopulation(b.jobs),
              residents: formatPopulation(b.population),
            }))}
          </div>
        )}

        {!isWater && (<>
        <Separator />

        <div className="flex justify-between">
          <span className="text-chrome-muted">{m(msg('Power'))}</span>
          <Badge variant="outline" className={powerBadge.cls}>{powerBadge.label}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-chrome-muted">{m(msg('Water'))}</span>
          <Badge variant="outline" className={waterBadge.cls}>{waterBadge.label}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-chrome-muted">{m(msg('Land value'))}</span>
          <span>{formatINR(getEffectiveLandValue(state.grid, state.gridSize, x, y))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-chrome-muted">{m(msg('Pollution'))}</span>
          <span className={tile.pollution > 50 ? 'text-red-800' : tile.pollution > 25 ? 'text-amber-800' : 'text-green-800'}>
            {Math.max(0, Math.min(100, Math.round(tile.pollution)))}%
          </span>
        </div>
        </>)}
        {state.mapId === 'varanasi' && !isWater && !floodExplained && (
          <div className="flex justify-between gap-2">
            <span className="text-chrome-muted shrink-0">{m(msg('Floods in'))}</span>
            <span className={`text-right ${floodsIn.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
              {floodsIn.length > 0 ? m(msg('{monsoons} monsoons', { monsoons: floodsIn.join(' / ') })) : m(msg('Never'))}
            </span>
          </div>
        )}
        {gangaEffectLines && (
          <div className="flex flex-col gap-0.5">
            <span className="text-chrome-muted">{m(msg('Effect on Ganga'))}</span>
            <span className="flex flex-col">
              {gangaEffectLines.map(line => (
                <span
                  key={line.text}
                  className={line.tone === 'hurts' ? 'text-red-800' : line.tone === 'cleans' ? 'text-green-800' : 'text-chrome-muted'}
                >
                  {line.text}
                </span>
              ))}
            </span>
          </div>
        )}

        {!isWater && (<>
        <Separator />
        <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-2">{m(msg('Service coverage'))}</div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-chrome-muted">{m(msg('Police'))}</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-chrome-muted">{m(msg('Fire'))}</span>
            <span>{Math.round(services.fire[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-chrome-muted">{m(msg('Health'))}</span>
            <span>{Math.round(services.health[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-chrome-muted">{m(msg('Education'))}</span>
            <span>{Math.round(services.education[y][x])}%</span>
          </div>
        </div>
        </>)}

        {upgradeInfo && (
          <>
            <Separator />
            <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-2">{m(msg('Upgrade'))}</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-chrome-muted">{m(msg('Coverage range'))}</span>
                <span className="font-mono">
                  {m(msg('{from} → {to} tiles', { from: upgradeInfo.currentEffectiveRange, to: upgradeInfo.nextEffectiveRange }))}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-chrome-muted">{m(msg('Upgrade cost'))}</span>
                <span className={`font-mono ${upgradeInfo.canAfford ? 'text-chrome-text' : 'text-red-800'}`}>
                  {formatINR(upgradeInfo.cost)}
                </span>
              </div>
              <Button
                onClick={handleUpgrade}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={!upgradeInfo.canAfford || upgradeInfo.isUnderConstruction || upgradeInfo.isAbandoned}
                className={isMobile ? 'w-full h-11' : 'w-full'}
                size="sm"
              >
                {m(msg('Upgrade to level {level}', { level: upgradeInfo.currentLevel + 1 }))}
              </Button>
              {!upgradeInfo.canAfford && (
                <p className="text-xs text-chrome-muted text-center">
                  {m(msg('Insufficient funds'))}
                </p>
              )}
              {upgradeInfo.isUnderConstruction && (
                <p className="text-xs text-chrome-muted text-center">
                  {m(msg('Building under construction'))}
                </p>
              )}
              {upgradeInfo.isAbandoned && (
                <p className="text-xs text-chrome-muted text-center">
                  {m(msg('Building is abandoned'))}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
