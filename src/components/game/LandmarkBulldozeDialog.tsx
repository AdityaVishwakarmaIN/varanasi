'use client';

import React from 'react';
import { useGT, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { TOOL_INFO } from '@/types/game';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** S5-T1: bulldozing a landmark asks first, and gives no refund. */
export function LandmarkBulldozeDialog() {
  const { pendingLandmarkBulldoze, resolveLandmarkBulldoze } = useGame();
  const gt = useGT();
  const m = useMessages();
  const name = pendingLandmarkBulldoze ? m(TOOL_INFO[pendingLandmarkBulldoze.id].name) : '';

  return (
    <Dialog open={!!pendingLandmarkBulldoze} onOpenChange={(open) => { if (!open) resolveLandmarkBulldoze(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{gt('Bulldoze {name}?', { name })}</DialogTitle>
          <DialogDescription>
            {gt('This landmark will be demolished and its bonuses lost. You get no refund.')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => resolveLandmarkBulldoze(false)}>
            {gt('Keep it')}
          </Button>
          <Button variant="destructive" onClick={() => resolveLandmarkBulldoze(true)}>
            {gt('Bulldoze')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
