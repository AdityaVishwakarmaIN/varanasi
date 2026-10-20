'use client';

import React, { useMemo } from 'react';
import { msg, useMessages } from 'gt-next';
import { Tile, BuildingType, TOOL_INFO, Tool, BUILDING_STATS } from '@/types/game';
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
import { INFORMAL_CONFIG } from '@/lib/informal';
import { isMixedUse } from '@/lib/mixedUse';
import { getMonsoonsThatFlood } from '@/lib/floods';
import { getCityFloodMask, getCityFloodRisk, getEffectiveLandValue } from '@/lib/floodSim';
import { getBuildingDisplayName } from '@/games/isocity/maps/varanasiCatalog';

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

export function TileInfoPanel({ 
  tile, 
  services, 
  onClose,
  isMobile = false
}: TileInfoPanelProps) {
  const { x, y } = tile;
  const { state, upgradeServiceBuilding } = useGame();
  const m = useMessages();
  const displayName = getBuildingDisplayName(tile.building.type, state.mapId);
  
  // Which rows make sense for this tile: river water has no utilities, and a power plant has no residents
  const isWater = tile.building.type === 'water';
  const stats = BUILDING_STATS[tile.building.type];
  const isZoned = tile.zone !== 'none';
  const showLevel = isZoned || (stats ? stats.maxPop > 0 || stats.maxJobs > 0 : false);
  const showPopulation = tile.building.population > 0 || (stats?.maxPop ?? 0) > 0 || tile.zone === 'residential';
  const showJobs = tile.building.jobs > 0 || (stats?.maxJobs ?? 0) > 0 || tile.zone === 'commercial' || tile.zone === 'industrial';

  // Check if this is a service building
  const isServiceBuilding = SERVICE_BUILDING_TYPES.has(tile.building.type);
  
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
  
  // S4-T5: which monsoons flood this tile, and whether it is under water now
  const floodRisk = getCityFloodRisk(state)?.[y * state.gridSize + x] ?? 0;
  const floodsIn = getMonsoonsThatFlood(floodRisk);
  const isFlooded = !!getCityFloodMask(state)?.[y * state.gridSize + x];
  
  // S3-T9: how to turn a settlement into proper homes, and how far along it is
  const isInformal = tile.building.type === 'informal_housing';
  const formaliseDays = isInformal ? state.informal?.formaliseDays[String(y * state.gridSize + x)] ?? 0 : 0;
  
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
      className={`${isMobile ? 'fixed left-0 right-0 w-full rounded-none border-x-0 border-t border-b z-30' : 'absolute top-4 right-4 w-72 z-50 max-h-[calc(100%-15rem)] overflow-y-auto'}`} 
      style={isMobile ? { top: 'calc(72px + env(safe-area-inset-top, 0px))' } : undefined}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-sans">Tile ({x}, {y})</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <CloseIcon size={14} />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-chrome-muted">Building</span>
          <span className="capitalize">
            {isInformal ? 'Informal settlement' : displayName ? m(displayName) : tile.building.type.replace(/_/g, ' ')}
          </span>
        </div>
        {!isWater && isZoned && (
        <div className="flex justify-between">
          <span className="text-chrome-muted">Zone</span>
          <Badge variant={
            tile.zone === 'residential' ? 'default' :
            tile.zone === 'commercial' ? 'secondary' :
            tile.zone === 'industrial' ? 'outline' : 'secondary'
          } className={
            tile.zone === 'residential' ? 'bg-green-500/20 text-green-800' :
            tile.zone === 'commercial' ? 'bg-blue-500/20 text-blue-800' :
            tile.zone === 'industrial' ? 'bg-amber-500/20 text-amber-800' : ''
          }>
            {tile.zone === 'none' ? 'Unzoned' : tile.zone}
          </Badge>
        </div>
        )}
        {!isWater && showLevel && (
          <div className="flex justify-between">
            <span className="text-chrome-muted">Level</span>
            <span>{tile.building.level}/5</span>
          </div>
        )}
        {!isWater && showPopulation && (
          <div className="flex justify-between">
            <span className="text-chrome-muted">Population</span>
            <span>{formatPopulation(tile.building.population)}</span>
          </div>
        )}
        {!isWater && showJobs && (
          <div className="flex justify-between">
            <span className="text-chrome-muted">Jobs</span>
            <span>{formatPopulation(tile.building.jobs)}</span>
          </div>
        )}
        {isMixedUse(tile.building.type, tile.building.level) && tile.building.population > 0 && (
          <div className="text-xs text-chrome-muted">
            {m(msg('Shops: {jobs} jobs · Homes above: {residents} residents', {
              jobs: formatPopulation(tile.building.jobs),
              residents: formatPopulation(tile.building.population),
            }))}
          </div>
        )}
        
        {!isWater && (<>
        <Separator />
        
        <div className="flex justify-between">
          <span className="text-chrome-muted">Power</span>
          <Badge variant={tile.building.powered ? 'default' : 'destructive'}>
            {tile.building.powered ? 'Connected' : 'No Power'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-chrome-muted">Water</span>
          <Badge variant={tile.building.watered ? 'default' : 'destructive'} className={tile.building.watered ? 'bg-cyan-500/20 text-cyan-800' : ''}>
            {tile.building.watered ? 'Connected' : 'No Water'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-chrome-muted">Land Value</span>
          <span>{formatINR(getEffectiveLandValue(state.grid, state.gridSize, x, y))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-chrome-muted">Pollution</span>
          <span className={tile.pollution > 50 ? 'text-red-800' : tile.pollution > 25 ? 'text-amber-800' : 'text-green-800'}>
            {Math.max(0, Math.min(100, Math.round(tile.pollution)))}%
          </span>
        </div>
        </>)}
        {state.mapId === 'varanasi' && tile.building.type !== 'water' && (
          <div className="flex justify-between gap-2">
            <span className="text-chrome-muted">Floods in</span>
            <span className={isFlooded ? 'text-red-800' : floodsIn.length > 0 ? 'text-amber-800' : 'text-green-800'}>
              {isFlooded ? 'Under water now' : floodsIn.length > 0 ? `${floodsIn.join(' / ')} monsoons` : 'Never'}
            </span>
          </div>
        )}
        {gangaEffectLines && (
          <div className="flex flex-col gap-0.5">
            <span className="text-chrome-muted">Effect on Ganga</span>
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
        
        {isInformal && (
          <div className="flex flex-col gap-1 rounded-md bg-amber-500/10 p-2 text-xs">
            <span className="text-amber-800">{INFORMAL_CONFIG.tileInfoHint}</span>
            <span className="text-chrome-muted">
              {formaliseDays > 0
                ? `Proper homes in ${INFORMAL_CONFIG.formaliseDays - formaliseDays} days (${formaliseDays}/${INFORMAL_CONFIG.formaliseDays})`
                : 'Pays no tax until it becomes proper homes.'}
            </span>
          </div>
        )}
        
        {tile.building.onFire && (
          <>
            <Separator />
            <div className="flex justify-between text-red-800">
              <span>ON FIRE!</span>
              <span>{Math.round(tile.building.fireProgress)}% damage</span>
            </div>
          </>
        )}
        
        {!isWater && (<>
        <Separator />
        <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-2">Service Coverage</div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-chrome-muted">Police</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-chrome-muted">Fire</span>
            <span>{Math.round(services.fire[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-chrome-muted">Health</span>
            <span>{Math.round(services.health[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-chrome-muted">Education</span>
            <span>{Math.round(services.education[y][x])}%</span>
          </div>
        </div>
        </>)}
        
        {upgradeInfo && (
          <>
            <Separator />
            <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-2">Upgrade</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-chrome-muted">Coverage Range</span>
                <span className="font-mono">
                  {upgradeInfo.currentEffectiveRange} → {upgradeInfo.nextEffectiveRange} tiles
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-chrome-muted">Upgrade Cost</span>
                <span className={`font-mono ${upgradeInfo.canAfford ? 'text-chrome-text' : 'text-red-800'}`}>
                  {formatINR(upgradeInfo.cost)}
                </span>
              </div>
              <Button
                onClick={handleUpgrade}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={!upgradeInfo.canAfford || upgradeInfo.isUnderConstruction || upgradeInfo.isAbandoned}
                className="w-full"
                size="sm"
              >
                Upgrade to Level {upgradeInfo.currentLevel + 1}
              </Button>
              {!upgradeInfo.canAfford && (
                <p className="text-xs text-chrome-muted text-center">
                  Insufficient funds
                </p>
              )}
              {upgradeInfo.isUnderConstruction && (
                <p className="text-xs text-chrome-muted text-center">
                  Building under construction
                </p>
              )}
              {upgradeInfo.isAbandoned && (
                <p className="text-xs text-chrome-muted text-center">
                  Building is abandoned
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
