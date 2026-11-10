'use client';

/**
 * One layout for everything that floats over the map (desktop). Instead of each panel picking its own
 * absolute coordinates, Game.tsx hands its floating UI to five named regions:
 *
 *   top-left      notifications (bell, live status chips), citizen voices, notification toasts
 *   top-right     persistent panels in one column: co-op card, tile info, tip, getting-started checklist
 *   bottom-left   view overlay legend + overlay bar
 *   bottom-centre transient messages: banners, paused bar, toasts (undo, save error, placement errors),
 *                 and the tool hint as a slim line at the very bottom
 *   bottom-right  minimap
 *
 * The layer fills the map area (right of the sidebar, under the top bar) and splits it into a top band
 * and a bottom band, so a top region can never run into a bottom one; inside a band the regions sit side
 * by side in flex rows, so they cannot overlap either. When the map is too narrow for the bottom-centre
 * stack to fit between the overlay bar and the minimap, it moves onto its own row above them.
 *
 * Components rendered elsewhere (the undo toast lives in GameProvider, the tool hint in the canvas) reach
 * a region through a named slot: `<OverlaySlot name="toasts" />` marks the place and `useOverlaySlot`
 * returns the element to portal into.
 *
 * While a press that started on the map is held (zone drag, road stroke, pan), the canvas sets
 * `data-map-gesture` on the map root (`[data-map-root]`) and the whole layer lets the pointer through.
 */

import React, { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Named slots (portal targets) shared across React trees
// ---------------------------------------------------------------------------

export type OverlaySlotName = 'toasts' | 'hint';

const slotElements = new Map<OverlaySlotName, HTMLElement>();
const slotListeners = new Set<() => void>();

function notifySlots() {
  slotListeners.forEach((listener) => listener());
}

function subscribeSlots(listener: () => void) {
  slotListeners.add(listener);
  return () => {
    slotListeners.delete(listener);
  };
}

/** The element currently marked as slot `name`, or null (no layer mounted, e.g. the title screen). */
export function useOverlaySlot(name: OverlaySlotName): HTMLElement | null {
  return useSyncExternalStore(
    subscribeSlots,
    () => slotElements.get(name) ?? null,
    () => null,
  );
}

/** Marks where portalled overlay content for `name` goes. Hidden while empty, so it adds no gap. */
export function OverlaySlot({ name, className }: { name: OverlaySlotName; className?: string }) {
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    slotElements.set(name, el);
    notifySlots();
    return () => {
      if (slotElements.get(name) === el) {
        slotElements.delete(name);
        notifySlots();
      }
    };
  }, [name]);
  return <div ref={ref} data-overlay-slot={name} className={cn('empty:hidden', className)} />;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Narrowest the bottom-centre stack may get before it moves onto its own row (px, = 20rem). */
const MIN_BOTTOM_CENTER_PX = 320;
/** Must match the layer padding and region gap below (p-3, gap-2). */
const LAYER_PADDING_PX = 12;
const REGION_GAP_PX = 8;

/**
 * Pointer handling: the layer and its regions are `pointer-events-none`, so empty space passes clicks,
 * hovers and wheel to the map; each floating panel opts back in with `pointer-events-auto`. During a
 * map gesture every descendant is forced back to `none`.
 */
const LAYER_CLASS = cn(
  'absolute inset-0 z-30 flex flex-col gap-2 p-3 pointer-events-none',
  '[[data-map-gesture]_&_*]:!pointer-events-none',
);

export interface MapOverlayLayerProps {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  bottomLeft?: React.ReactNode;
  bottomCenter?: React.ReactNode;
  bottomRight?: React.ReactNode;
}

export function MapOverlayLayer({ topLeft, topRight, bottomLeft, bottomCenter, bottomRight }: MapOverlayLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const bottomLeftRef = useRef<HTMLDivElement>(null);
  const bottomRightRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);

  // Measure the content width of the bottom corners (not their flex boxes, which grow to centre the
  // middle stack). The decision does not change those widths, so it cannot oscillate.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    const left = bottomLeftRef.current;
    const right = bottomRightRef.current;
    if (!layer || !left || !right || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const corners = left.offsetWidth + right.offsetWidth;
      const room = layer.clientWidth - 2 * LAYER_PADDING_PX - corners - 2 * REGION_GAP_PX;
      setStacked(room < MIN_BOTTOM_CENTER_PX);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(layer);
    observer.observe(left);
    observer.observe(right);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={layerRef} data-map-overlays className={LAYER_CLASS}>
      {/* Top band: takes the height the bottom band leaves; its regions shrink or scroll inside it */}
      <div className="flex min-h-0 flex-1 items-stretch justify-between gap-2">
        <div data-overlay-region="top-left" className="flex min-h-0 min-w-0 max-w-[24rem] flex-1 flex-col items-start gap-2">
          {topLeft}
        </div>
        <div
          data-overlay-region="top-right"
          className="flex min-h-0 w-[22rem] max-w-[50%] shrink-0 flex-col items-end gap-2 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]"
        >
          {topRight}
        </div>
      </div>

      {/* Bottom band: overlay bar | transient stack | minimap, bottom-aligned */}
      <div className={cn('flex shrink-0 items-end gap-2', stacked ? 'flex-wrap' : 'flex-nowrap')}>
        {/* The corners grow equally (basis 0) but never below their content, which centres the middle
            stack on the map whenever it has room and pushes it aside only as far as needed. */}
        <div data-overlay-region="bottom-left" className="flex min-w-max flex-1 basis-0 justify-start">
          <div ref={bottomLeftRef} className="flex w-max flex-col items-start gap-2">
            {bottomLeft}
          </div>
        </div>
        <div
          data-overlay-region="bottom-center"
          className={cn('flex min-w-0 justify-center', stacked ? 'order-first basis-full' : 'grow-0 shrink basis-[26rem]')}
        >
          <div className="flex w-full max-w-[26rem] flex-col items-center gap-2">
            {bottomCenter}
          </div>
        </div>
        <div data-overlay-region="bottom-right" className="flex min-w-max flex-1 basis-0 justify-end">
          <div ref={bottomRightRef} className="flex w-max flex-col items-end gap-2">
            {bottomRight}
          </div>
        </div>
      </div>
    </div>
  );
}
