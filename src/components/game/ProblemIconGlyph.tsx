'use client';

import React, { useEffect, useRef } from 'react';
import { drawProblemBadge } from '@/components/game/problemIconsDraw';
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import type { ProblemKind } from '@/lib/problemIcons';

/** Phase that shows the power-cut glyph lit (its map badge flickers). */
const STILL_TIME = 0.2;

/** The map's problem badge for `kind`, drawn by the same code, as a small inline icon (tile panel, help legend). */
export function ProblemIconGlyph({ kind, size = 18, className }: { kind: ProblemKind; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = typeof window !== 'undefined' ? Math.min(3, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const r = size / 2;
    // Leave room for the ring's stroke
    drawProblemBadge(ctx as unknown as IsoRenderer, r, r, kind, r - 1, 1, STILL_TIME);
  }, [kind, size]);
  return <canvas ref={ref} aria-hidden="true" className={className} style={{ width: size, height: size, flexShrink: 0 }} />;
}
