'use client';

import React, { useEffect } from 'react';
import { T } from 'gt-next';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AUTOSAVE_CONFIG } from '@/lib/storage/saveConfig';

/**
 * Shown when saving the city fails (S1-T9). The same text is also pushed to
 * `state.notifications`.
 */
export function SaveErrorToast({
  onOpenSettings,
  onDismiss,
}: {
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTOSAVE_CONFIG.errorToastMs);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className="fixed z-[9999] bottom-[calc(132px+env(safe-area-inset-bottom))] left-3 right-3 animate-rise-in md:bottom-24 md:left-[calc(50%+112px)] md:right-auto md:-translate-x-1/2 md:w-[min(26rem,calc(100vw-40rem))]"
    >
      <div className="hud-panel flex items-start gap-3 rounded-2xl !border-red-400/60 p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-400/40" aria-hidden><AlertTriangle className="w-5 h-5 text-red-400" /></span>
        <div className="flex-1 text-sm">
          <p><T>Couldn&apos;t save your city. Export it from Settings to keep a copy.</T></p>
          <Button size="sm" variant="outline" className="mt-2 h-11 md:h-9" onClick={onOpenSettings}>
            <T>Open Settings</T>
          </Button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-mt-1 -mr-1 h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-sandstone/[0.07]"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
