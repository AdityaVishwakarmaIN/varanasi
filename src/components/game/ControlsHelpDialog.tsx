'use client';

import React, { useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KEY_BINDINGS, MOUSE_BINDINGS } from '@/lib/controlsConfig';
import { isDevMode } from '@/lib/devMode';

const LABELS = {
  title: msg('Controls'),
  description: msg('Keyboard and mouse controls. Shortcuts are ignored while typing.'),
  keyboard: msg('Keyboard'),
  mouse: msg('Mouse'),
  openButton: msg('Show Controls'),
  openButtonDesc: msg('Keyboard and mouse shortcuts (or press ?)'),
};

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none text-foreground whitespace-nowrap">
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] max-h-[85vh] overflow-y-auto" data-testid="controls-help">
        <DialogHeader>
          <DialogTitle>{m(LABELS.title)}</DialogTitle>
          <DialogDescription>{m(LABELS.description)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{m(LABELS.mouse)}</div>
            <table className="w-full">
              <tbody>
                {MOUSE_BINDINGS.map((row) => (
                  <tr key={row.input} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-3 align-top whitespace-nowrap"><KeyCap>{m(row.input)}</KeyCap></td>
                    <td className="py-1 text-muted-foreground">{m(row.label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{m(LABELS.keyboard)}</div>
            <table className="w-full">
              <tbody>
                {KEY_BINDINGS.filter((b) => b.action !== 'perfHud' || isDevMode()).map((binding) => (
                  <tr key={binding.action} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-3 align-top whitespace-nowrap"><KeyCap>{binding.keyLabel}</KeyCap></td>
                    <td className="py-1 text-muted-foreground">{m(binding.label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Settings row: a button that opens the controls help panel. */
export function ControlsHelpButton() {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  return (
    <div className="py-2">
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        {m(LABELS.openButton)}
      </Button>
      <p className="text-muted-foreground text-xs mt-1 text-center">{m(LABELS.openButtonDesc)}</p>
      <ControlsHelpDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
