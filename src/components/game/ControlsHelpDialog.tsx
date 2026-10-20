'use client';

import React, { useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KEY_BINDINGS, MOUSE_BINDINGS, formatKeyLabel } from '@/lib/controlsConfig';
import { isDevMode } from '@/lib/devMode';
import { useMobile } from '@/hooks/useMobile';
import { PROBLEM_KINDS, type ProblemKind } from '@/lib/problemIcons';
import { RING } from '@/components/game/problemIconsDraw';

const LABELS = {
  title: msg('Controls'),
  description: msg('Keyboard and mouse controls. Shortcuts are ignored while typing.'),
  keyboard: msg('Keyboard'),
  mouse: msg('Mouse'),
  openButton: msg('Show Controls'),
  openButtonDesc: msg('Keyboard and mouse shortcuts (or press ?)'),
  legend: msg('Map warning icons'),
  legendDesc: msg('Small round icons over buildings say what is wrong.'),
  legendButton: msg('Map warning icons'),
  legendButtonDesc: msg('What the icons over buildings mean'),
};

const PROBLEM_LEGEND: Record<ProblemKind, string> = {
  fire: msg('On fire: build fire stations'),
  flood: msg('Flooded by the Ganga: build embankments'),
  disease: msg('Disease outbreak in this block: build a hospital'),
  no_road: msg('No road access: draw a road beside it'),
  power_cut: msg('Rolling power cut: power supply is short'),
  no_power: msg('No power line: connect it to a power plant'),
  no_water: msg('No water: build a water tower nearby'),
  abandoned: msg('Abandoned: check demand, power, water and pollution'),
};

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block rounded border border-chrome-border bg-chrome-well px-1.5 py-0.5 font-mono text-[11px] leading-none text-chrome-text whitespace-nowrap">
      {children}
    </kbd>
  );
}

export interface ControlsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Controls help panel, generated from KEY_BINDINGS and MOUSE_BINDINGS (S1-T10). */
export function ControlsHelpDialog({ open, onOpenChange }: ControlsHelpDialogProps) {
  const m = useMessages();
  const { isTouchDevice } = useMobile();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-w-[480px] max-h-[85vh] overflow-y-auto" data-testid="controls-help">
        <DialogHeader>
          <DialogTitle>{m(isTouchDevice ? LABELS.legend : LABELS.title)}</DialogTitle>
          <DialogDescription>{m(isTouchDevice ? LABELS.legendDesc : LABELS.description)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-2">{m(LABELS.legend)}</div>
            <ul className="space-y-1.5">
              {PROBLEM_KINDS.map((kind) => (
                <li key={kind} className="flex items-center gap-2 text-chrome-muted">
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 shrink-0 rounded-full border-2 bg-slate-900/85"
                    style={{ borderColor: RING[kind] }}
                  />
                  {m(PROBLEM_LEGEND[kind])}
                </li>
              ))}
            </ul>
          </section>
          {!isTouchDevice && (<>
          <section>
            <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-2">{m(LABELS.mouse)}</div>
            <table className="w-full">
              <tbody>
                {MOUSE_BINDINGS.map((row) => (
                  <tr key={row.input} className="border-b border-chrome-border/60 last:border-0">
                    <td className="py-1 pr-3 align-top whitespace-nowrap"><KeyCap>{m(row.input)}</KeyCap></td>
                    <td className="py-1 text-chrome-muted">{m(row.label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <div className="text-[10px] text-chrome-muted uppercase tracking-wider mb-2">{m(LABELS.keyboard)}</div>
            <table className="w-full">
              <tbody>
                {KEY_BINDINGS.filter((b) => b.action !== 'perfHud' || isDevMode()).map((binding) => (
                  <tr key={binding.action} className="border-b border-chrome-border/60 last:border-0">
                    <td className="py-1 pr-3 align-top whitespace-nowrap"><KeyCap>{formatKeyLabel(binding.keyLabel)}</KeyCap></td>
                    <td className="py-1 text-chrome-muted">{m(binding.label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          </>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Settings row: a button that opens the controls help panel. */
export function ControlsHelpButton() {
  const m = useMessages();
  const { isTouchDevice } = useMobile();
  const [open, setOpen] = useState(false);
  return (
    <div className="py-2">
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        {m(isTouchDevice ? LABELS.legendButton : LABELS.openButton)}
      </Button>
      <p className="text-chrome-muted text-xs mt-1 text-center">{m(isTouchDevice ? LABELS.legendButtonDesc : LABELS.openButtonDesc)}</p>
      <ControlsHelpDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
