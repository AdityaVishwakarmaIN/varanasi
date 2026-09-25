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
      className="fixed z-[9999] top-[calc(5rem+env(safe-area-inset-top))] left-3 right-3 md:top-auto md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2"
    >
      <div className="flex items-start gap-3 bg-card border border-destructive/60 rounded-sm shadow-lg p-3 md:max-w-md">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p><T>Couldn&apos;t save your city. Export it from Settings to keep a copy.</T></p>
          <Button size="sm" variant="outline" className="mt-2 h-8" onClick={onOpenSettings}>
            <T>Open Settings</T>
          </Button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
