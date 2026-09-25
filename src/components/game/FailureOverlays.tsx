'use client';

import React, { useState } from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { AlertTriangle, Landmark, Users } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FAILURE_CONFIG, monthsUntilBankruptcy, monthsUntilLoanOffer, type FailingStat } from '@/lib/failure';
import { formatIndianCompact, formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';

const LABELS = {
  treasuryEmpty: msg('The city treasury is empty'),
  peopleLeaving: msg('People are leaving the city'),
  loanTitle: msg('Emergency loan'),
  accept: msg('Accept loan'),
  decline: msg('Decline'),
  gameOverBankrupt: msg('The city has gone bankrupt'),
  gameOverExodus: msg('The people have left the city'),
  yearsSurvived: msg('Years survived'),
  peakPopulation: msg('Peak population'),
  peakGanga: msg('Peak Ganga Health'),
  whatWentWrong: msg('What went wrong'),
  loadLastAutosave: msg('Load last autosave'),
  noAutosave: msg('No earlier autosave of this city was found.'),
  newCity: msg('New city'),
};

/** Same text as FAILING_STAT_LINES in failure.ts, as literals so they can be translated. */
const FAILING_LINES: Record<FailingStat, string> = {
  money: msg('The treasury ran dry.'),
  happiness: msg('Residents were deeply unhappy.'),
  health: msg('Poor healthcare left people sick.'),
  education: msg('There were too few schools.'),
  safety: msg('Crime and fires made people feel unsafe.'),
  environment: msg('Pollution choked the city.'),
  gangaHealth: msg('The Ganga became too polluted.'),
};

/**
 * Failure states UI (S4-T11): the debt and exodus banners, the emergency loan dialog and the
 * game-over screen. `bannerClassName` places the banners for the desktop or mobile layout.
 */
export function FailureOverlays({ bannerClassName }: { bannerClassName?: string }) {
  const { state, acceptEmergencyLoan, declineEmergencyLoan, loadLastAutosave, newGame } = useGame();
  const m = useMessages();
  const gt = useGT();
  const [autosaveMissing, setAutosaveMissing] = useState(false);
  const failure = state.failure;
  const gameOver = state.gameOver;

  const inDebt = !gameOver && state.stats.money < 0;
  const lowHappiness = !gameOver && !!failure && failure.lowHappinessMonths > 0;

  let debtDetail: string | null = null;
  if (inDebt && failure) {
    const toBankruptcy = monthsUntilBankruptcy(failure);
    const toLoan = monthsUntilLoanOffer(failure);
    const parts = [gt('In debt for {months} months', { months: failure.monthsInDebt })];
    if (toBankruptcy !== null) parts.push(gt('{months} months until bankruptcy', { months: toBankruptcy }));
    else if (toLoan !== null && toLoan > 0) parts.push(gt('{months} months until an emergency loan is offered', { months: toLoan }));
    debtDetail = parts.join(' · ');
  }

  return (
    <>
      {(inDebt || lowHappiness) && (
        <div className={cn('pointer-events-none flex flex-col gap-2', bannerClassName)} role="status" aria-live="polite">
          {inDebt && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/80 bg-red-950/90 px-3 py-2 text-red-50 shadow-lg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{m(LABELS.treasuryEmpty)}</p>
                {debtDetail && <p className="text-xs text-red-200">{debtDetail}</p>}
              </div>
            </div>
          )}
          {lowHappiness && failure && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-md border px-3 py-2 shadow-lg',
                failure.exodusActive ? 'border-red-500/80 bg-red-950/90 text-red-50' : 'border-amber-500/80 bg-amber-950/90 text-amber-50'
              )}
            >
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                {failure.exodusActive && <p className="text-sm font-semibold">{m(LABELS.peopleLeaving)}</p>}
                <p className={cn(failure.exodusActive ? 'text-xs opacity-80' : 'text-sm font-medium')}>
                  {gt('Happiness has been critical for {months} months', { months: failure.lowHappinessMonths })}
                </p>
                {!failure.exodusActive && (
                  <p className="text-xs opacity-80">
                    {gt('{months} months until people start leaving', {
                      months: Math.max(0, FAILURE_CONFIG.exodusAfterMonths - failure.lowHappinessMonths),
                    })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!gameOver && failure?.loanStatus === 'offered'}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" aria-hidden />
              {m(LABELS.loanTitle)}
            </DialogTitle>
            <DialogDescription>
              {gt(
                'The State Government offers an emergency loan of {amount}. It will be repaid from {share}% of income for {months} months.',
                {
                  amount: formatINR(failure?.loanOfferAmount ?? 0),
                  share: Math.round(FAILURE_CONFIG.loanRepaymentShare * 100),
                  months: FAILURE_CONFIG.loanRepaymentMonths,
                }
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={declineEmergencyLoan}>{m(LABELS.decline)}</Button>
            <Button onClick={acceptEmergencyLoan}>{m(LABELS.accept)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!gameOver}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {gameOver && (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  {m(gameOver.reason === 'bankruptcy' ? LABELS.gameOverBankrupt : LABELS.gameOverExodus)}
                </DialogTitle>
                <DialogDescription className="text-base font-medium text-foreground">{state.cityName}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{m(LABELS.yearsSurvived)}</dt>
                <dd className="text-right font-medium">{gameOver.yearsSurvived}</dd>
                <dt className="text-muted-foreground">{m(LABELS.peakPopulation)}</dt>
                <dd className="text-right font-medium">{formatIndianCompact(gameOver.peakPopulation)}</dd>
                {gameOver.peakGangaHealth !== undefined && (
                  <>
                    <dt className="text-muted-foreground">{m(LABELS.peakGanga)}</dt>
                    <dd className="text-right font-medium">{Math.round(gameOver.peakGangaHealth)}</dd>
                  </>
                )}
              </dl>
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                <span className="font-medium">{m(LABELS.whatWentWrong)}: </span>
                {m(FAILING_LINES[gameOver.failingStat])}
              </div>
              {autosaveMissing && <p className="text-xs text-muted-foreground">{m(LABELS.noAutosave)}</p>}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={async () => setAutosaveMissing(!(await loadLastAutosave()))}
                >
                  {m(LABELS.loadLastAutosave)}
                </Button>
                <Button onClick={() => newGame({ mapId: state.mapId, size: state.gridSize })}>{m(LABELS.newCity)}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
