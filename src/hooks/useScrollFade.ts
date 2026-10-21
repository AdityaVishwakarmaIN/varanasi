'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

const FADE = 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)';
const FADE_STYLE: CSSProperties = { maskImage: FADE, WebkitMaskImage: FADE };

/**
 * Tracks whether a scroll container has content hidden below its bottom edge.
 * Returns [ref callback, style]; attach both to the scroller: while content is hidden below the
 * fold the last 28px fade out, so truncated content never looks like it simply ends.
 */
export function useScrollFade<T extends HTMLElement>() {
  // A callback ref (stored in state) so portalled scrollers, mounted after the first
  // render, are still picked up.
  const [el, setEl] = useState<T | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    if (!el) return;
    const update = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [el]);

  return [setEl, moreBelow ? FADE_STYLE : undefined] as const;
}
