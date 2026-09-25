'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { getProceduralSprite, isVaranasiProceduralSprite } from '@/components/game/procedural/buildingArt';

/** Data-URL thumbnails, painted once per (type, variant, size tier) and shared by every thumb. */
const thumbCache = new Map<string, string>();

function thumbUrl(type: string, variant: number, tilePx: number): string | null {
  const key = `${type}|${variant}|${tilePx}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const sprite = getProceduralSprite(type, variant, false, tilePx);
  if (!sprite || !('toDataURL' in sprite.canvas)) return null;
  const url = sprite.canvas.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}

const noopSubscribe = () => () => {};

export interface BuildingArtThumbProps {
  /** BuildingType id. Renders nothing for types without code-drawn art. */
  type: string;
  variant?: number;
  /** Box size in CSS px; the art is fitted inside, bottom-aligned. */
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * The code-drawn building art as a small image, for build menus, tooltips and menus.
 * Painted on the client only (the canvas API is browser-only) and cached as a data URL.
 */
export function BuildingArtThumb({ type, variant = 0, size = 48, className, alt = '' }: BuildingArtThumbProps) {
  // Server render and hydration paint nothing; the client paints after (canvas is browser-only)
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const url = useMemo(() => {
    if (!isClient || !isVaranasiProceduralSprite(type)) return null;
    // Resolution tier: ~2× the box for crisp retina thumbs, never above 192 px per tile
    return thumbUrl(type, variant, size * 2 > 96 ? 192 : 96);
  }, [isClient, type, variant, size]);
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: 'inline-flex', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}
      aria-hidden={alt ? undefined : true}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} draggable={false} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      ) : null}
    </span>
  );
}

export default BuildingArtThumb;
