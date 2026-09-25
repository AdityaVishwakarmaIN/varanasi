'use client';

import React, { useState } from 'react';
import { T } from 'gt-next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ISOCITY_URL = 'https://github.com/amilich/isometric-city';

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="text-sm space-y-1.5">{children}</div>
    </section>
  );
}

/** Credits screen (S5-T12): IsoCity (MIT), art sources, fonts and audio licences. */
export function CreditsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle><T>Credits</T></DialogTitle>
          <DialogDescription><T>Varanasi: a city builder on the Ganga.</T></DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Section title={<T>Game engine</T>}>
            <p>
              <T>
                Built on{' '}
                <a href={ISOCITY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  IsoCity
                </a>{' '}
                by Andrew Milich and contributors, used under the MIT licence (Copyright (c) 2025 amilich).
              </T>
            </p>
          </Section>
          <Section title={<T>Art</T>}>
            <p><T>Building, vehicle and terrain sprite sheets: from IsoCity (MIT licence).</T></p>
            <p><T>Varanasi buildings (ghats, temples and other riverfront buildings): drawn in code for this game.</T></p>
            <p><T>Fonts: Playfair Display and DM Sans (SIL Open Font License). Icons: Lucide (ISC licence).</T></p>
          </Section>
          <Section title={<T>Sound</T>}>
            <p><T>All sound effects and the river and temple-bell ambience are synthesized live in your browser. No recorded audio is used, so there is nothing to license.</T></p>
            <p><T>Music is optional. Any music tracks added to the game are listed with their source and licence (CC0 or properly licensed only) in public/audio/LICENSES.md.</T></p>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A button that opens the credits. */
export function CreditsButton({ className, variant = 'outline' }: { className?: string; variant?: 'outline' | 'ghost' | 'link' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <T>Credits</T>
      </Button>
      <CreditsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
