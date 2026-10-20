'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { formatINR, formatINRPerMonth } from '@/lib/format';

// Translatable UI labels
const UI_LABELS = {
  budget: msg('Budget'),
  income: msg('Income'),
  expenses: msg('Expenses'),
  net: msg('Net'),
  taxes: msg('Taxes'),
  tourism: msg('Tourism'),
};

export function BudgetPanel() {
  const { state, setActivePanel, setBudgetFunding } = useGame();
  const { budget, stats } = state;
  const m = useMessages();
  // S2-T9: income = taxes + tourism (tourism only on the Varanasi map). Old saves have no taxIncome.
  const taxIncome = stats.taxIncome ?? stats.income;
  const showTourism = state.mapId === 'varanasi';
  const tourismIncome = stats.tourismIncome ?? 0;
  const tourismShare = stats.income > 0 ? Math.round((tourismIncome / stats.income) * 100) : 0;
  
  const categories = [
    { key: 'police', ...budget.police },
    { key: 'fire', ...budget.fire },
    { key: 'health', ...budget.health },
    { key: 'education', ...budget.education },
    { key: 'transportation', ...budget.transportation },
    { key: 'parks', ...budget.parks },
    { key: 'power', ...budget.power },
    { key: 'water', ...budget.water },
  ];
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent showClose className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.budget)}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="hud-well rounded-none p-2.5 sm:p-3 min-w-0">
              <div className="hud-label mb-1.5">{m(UI_LABELS.income)}</div>
              <div className="text-green-800 font-mono font-semibold text-xs sm:text-base leading-tight break-words">{formatINRPerMonth(stats.income)}</div>
              <div className="mt-1 space-y-0.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-chrome-muted">{m(UI_LABELS.taxes)}</span>
                  <span className="font-mono">{formatINR(taxIncome)}</span>
                </div>
                {showTourism && (
                  <div className="flex justify-between gap-2" title={`${tourismShare}% of income`}>
                    <span className="text-chrome-muted">{m(UI_LABELS.tourism)}</span>
                    <span className="font-mono text-blue-800">{formatINR(tourismIncome)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="hud-well rounded-none p-2.5 sm:p-3 min-w-0">
              <div className="hud-label mb-1.5">{m(UI_LABELS.expenses)}</div>
              <div className="text-red-800 font-mono font-semibold text-xs sm:text-base leading-tight break-words">{formatINRPerMonth(stats.expenses)}</div>
            </div>
            <div className="hud-well rounded-none p-2.5 sm:p-3 min-w-0">
              <div className="hud-label mb-1.5">{m(UI_LABELS.net)}</div>
              <div className={`font-mono font-semibold text-xs sm:text-base leading-tight break-words ${stats.income - stats.expenses >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {formatINRPerMonth(stats.income - stats.expenses, true)}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.key} className="flex items-center gap-4">
                <Label className="w-24 sm:w-28 shrink-0 text-sm text-chrome-text">{cat.name}</Label>
                <Slider
                  value={[cat.funding]}
                  onValueChange={(value) => setBudgetFunding(cat.key as keyof typeof budget, value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="w-20 shrink-0 text-right font-mono leading-tight">
                  <span className="block text-sm text-chrome-text">{cat.funding}%</span>
                  <span className="block text-[11px] text-chrome-muted" title={`Full funding costs ${formatINRPerMonth(cat.cost)}`}>
                    {formatINRPerMonth(Math.floor((cat.cost * cat.funding) / 100))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
