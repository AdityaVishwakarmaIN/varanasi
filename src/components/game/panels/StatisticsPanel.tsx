'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatINR, formatINRPerMonth, formatIndianNumber, formatPopulation, POPULATION_DISPLAY_SCALE } from '@/lib/format';
import { getNextLandmark, getPeakDisplayedPopulation } from '@/lib/landmarks';
import { TOOL_INFO } from '@/types/game';
import { RiverIcon } from '@/components/ui/Icons';
import { getGangaTrend } from '@/lib/scoring';
import { GANGA_TREND_ARROW, describeGangaCauses, getGangaHealthLevel } from '@/lib/ganga';

type StatsTab = 'population' | 'money' | 'happiness' | 'ganga';

const GANGA_LEVEL_CLASS = { good: 'text-green-800', fair: 'text-amber-800', poor: 'text-red-800' } as const;

// Translatable UI labels
const UI_LABELS = {
  cityStatistics: msg('City Statistics'),
  population: msg('Population'),
  jobs: msg('Jobs'),
  treasury: msg('Treasury'),
  netPerMonth: msg('Net / month'),
  quarterly: msg('One point per quarter'),
  money: msg('Money'),
  happiness: msg('Happiness'),
  gangaHealth: msg('Ganga Health'),
  ganga: msg('Ganga'),
  headingTo: msg('heading to'),
  notEnoughData: msg('Not enough data yet. Keep playing to see historical trends.'),
};

export function StatisticsPanel() {
  const { state, setActivePanel } = useGame();
  const { history, stats } = state;
  const isVaranasi = state.mapId === 'varanasi' && stats.gangaHealth !== undefined;
  const gt = useGT();
  // S5-T1: "Next landmark: X at N (you: M)". Unlocks go by peak population, so a dip never re-locks.
  const nextLandmark = isVaranasi ? getNextLandmark(getPeakDisplayedPopulation(state)) : null;
  const [selectedTab, setActiveTab] = useState<StatsTab>('population');
  const activeTab: StatsTab = selectedTab === 'ganga' && !isVaranasi ? 'population' : selectedTab;
  const m = useMessages();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Series for the active tab. Ganga points only exist from when the river was simulated (old saves lack them).
  const series = useMemo(() => {
    switch (activeTab) {
      case 'population': return history.map(h => h.population);
      case 'money': return history.map(h => h.money);
      case 'happiness': return history.map(h => h.happiness);
      case 'ganga': return history.flatMap(h => (h.gangaHealth === undefined ? [] : [h.gangaHealth]));
    }
  }, [history, activeTab]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || series.length < 2) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const padX = 64; // room for the min/max value labels
    
    ctx.fillStyle = '#ece0c8';
    ctx.fillRect(0, 0, width, height);
    
    const data = series;
    let color = '#15803d';
    let formatValue = (v: number) => formatIndianNumber(v);
    
    switch (activeTab) {
      case 'population':
        color = '#15803d';
        formatValue = formatPopulation;
        break;
      case 'money':
        color = '#b45309';
        formatValue = formatINR;
        break;
      case 'happiness':
        color = '#be185d';
        formatValue = (v: number) => `${Math.round(v)}%`;
        break;
      case 'ganga':
        color = '#0e7490';
        break;
    }
    
    // Ganga Health is a 0-100 score: a fixed axis shows the real size of a change.
    const minVal = activeTab === 'ganga' ? 0 : Math.min(...data);
    const maxVal = activeTab === 'ganga' ? 100 : Math.max(...data);
    const range = maxVal - minVal || 1;
    
    ctx.strokeStyle = '#d3c3a3';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - padding * 2) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const stepX = (width - padX - padding) / (data.length - 1);
    
    data.forEach((val, i) => {
      const x = padX + i * stepX;
      const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();

    // Axis labels: the value range on the left (an empty axis tells the player nothing)
    ctx.fillStyle = '#6b5b3e';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatValue(maxVal), padX - 6, padding);
    ctx.fillText(formatValue(minVal), padX - 6, height - padding);
  }, [series, activeTab]);
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent showClose className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.cityStatistics)}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Card className="bg-chrome-well p-2 sm:p-3">
              <div className="hud-label mb-1.5">{m(UI_LABELS.population)}</div>
              <div className="font-mono tabular-nums font-semibold text-green-800 text-sm sm:text-base truncate">{formatPopulation(stats.population)}</div>
            </Card>
            <Card className="bg-chrome-well p-2 sm:p-3">
              <div className="hud-label mb-1.5">{m(UI_LABELS.jobs)}</div>
              <div className="font-mono tabular-nums font-semibold text-blue-800 text-sm sm:text-base truncate">{formatPopulation(stats.jobs)}</div>
            </Card>
            <Card className="bg-chrome-well p-2 sm:p-3">
              <div className="hud-label mb-1.5">{m(UI_LABELS.treasury)}</div>
              <div className="font-mono tabular-nums font-semibold text-chrome-text text-sm sm:text-base truncate">{formatINR(stats.money)}</div>
            </Card>
            <Card className="bg-chrome-well p-2 sm:p-3">
              <div className="hud-label mb-1.5">{m(UI_LABELS.netPerMonth)}</div>
              <div className={`font-mono tabular-nums font-semibold text-sm sm:text-base truncate ${stats.income - stats.expenses >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {formatINRPerMonth(stats.income - stats.expenses, true)}
              </div>
            </Card>
          </div>
          
          {isVaranasi && (
            <GangaHealthCard
              label={String(m(UI_LABELS.gangaHealth))}
              headingTo={String(m(UI_LABELS.headingTo))}
              gangaHealth={stats.gangaHealth ?? 0}
              gangaHealthTarget={stats.gangaHealthTarget}
              causes={stats.gangaLoad ? describeGangaCauses(stats.gangaLoad, formatPopulation) : []}
            />
          )}

          {nextLandmark && (
            <p className="text-xs sm:text-sm text-chrome-muted">
              {gt('Next landmark: {name} at {target} (you: {current})', {
                name: String(m(TOOL_INFO[nextLandmark.id].name)),
                target: formatIndianNumber(nextLandmark.unlockPopulation),
                current: formatIndianNumber(Math.round(stats.population * POPULATION_DISPLAY_SCALE)),
              })}
            </p>
          )}
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className={`grid w-full h-auto ${isVaranasi ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="population" className="text-xs sm:text-sm py-2 px-2 sm:px-3">{m(UI_LABELS.population)}</TabsTrigger>
              <TabsTrigger value="money" className="text-xs sm:text-sm py-2 px-2 sm:px-3">{m(UI_LABELS.money)}</TabsTrigger>
              <TabsTrigger value="happiness" className="text-xs sm:text-sm py-2 px-2 sm:px-3">{m(UI_LABELS.happiness)}</TabsTrigger>
              {isVaranasi && (
                <TabsTrigger value="ganga" className="text-xs sm:text-sm py-2 px-2 sm:px-3">{m(UI_LABELS.ganga)}</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          
          <Card className="p-4">
            {series.length < 2 ? (
              <div className="h-[200px] flex items-center justify-center text-chrome-muted text-sm">
                {m(UI_LABELS.notEnoughData)}
              </div>
            ) : (
              <>
                <canvas ref={canvasRef} width={536} height={200} className="w-full rounded-none" />
                <p className="mt-1 text-center text-[11px] text-chrome-muted">{m(UI_LABELS.quarterly)}</p>
              </>
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GangaHealthCard({
  label,
  headingTo,
  gangaHealth,
  gangaHealthTarget,
  causes,
}: {
  label: string;
  headingTo: string;
  gangaHealth: number;
  gangaHealthTarget: number | undefined;
  causes: string[];
}) {
  const target = gangaHealthTarget ?? gangaHealth;
  const trend = getGangaTrend(gangaHealth, target);
  const colorClass = GANGA_LEVEL_CLASS[getGangaHealthLevel(gangaHealth)];
  return (
    <Card className="bg-chrome-well p-2 sm:p-3 flex items-center gap-3">
      <RiverIcon size={20} className="text-blue-800 shrink-0" />
      <div className="min-w-0">
        <div className="hud-label mb-1.5">{label}</div>
        <div className={`font-mono tabular-nums font-semibold text-sm sm:text-base ${colorClass}`}>
          {Math.round(gangaHealth)} {GANGA_TREND_ARROW[trend]}
          <span className="ml-2 text-xs font-normal text-chrome-muted">
            ({headingTo} {Math.round(target)})
          </span>
        </div>
        {causes.length > 0 && target < 70 && (
          <ul className="mt-1 list-disc pl-4 text-xs font-normal text-chrome-muted">
            {causes.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
      </div>
    </Card>
  );
}
