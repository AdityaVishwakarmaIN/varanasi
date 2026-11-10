'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Start-up veil: a hazy, warm "morning fog over the Ganga" that covers the map from mount until
 * the first complete frame with real art is on screen (the map component decides when, from real
 * readiness signals), then fades out and unmounts. Deliberately not a loading screen: no spinner,
 * no text, just mist drifting slowly over sandstone and river tones.
 *
 * While shown it swallows map input (mouse, touch, wheel), so nothing can be built or panned on a
 * map the player cannot see. While fading it lets input through.
 */

/** Fade-out length. */
export const STARTUP_VEIL_FADE_MS = 350;

const VEIL_CSS = `
@keyframes startup-veil-drift-a { from { transform: translate3d(-6%, 0, 0); } to { transform: translate3d(6%, -1.5%, 0); } }
@keyframes startup-veil-drift-b { from { transform: translate3d(5%, 1%, 0); } to { transform: translate3d(-5%, -1%, 0); } }
@keyframes startup-veil-breathe { from { opacity: 0.55; } to { opacity: 0.8; } }
.startup-veil-mist-a { animation: startup-veil-drift-a 38s ease-in-out infinite alternate; }
.startup-veil-mist-b { animation: startup-veil-drift-b 52s ease-in-out infinite alternate; }
.startup-veil-river { animation: startup-veil-breathe 9s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) {
  .startup-veil-mist-a, .startup-veil-mist-b, .startup-veil-river { animation: none; }
}
`;

export function StartupVeil({ lifting, onGone }: { lifting: boolean; onGone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // The map listens for wheel / touchmove natively (passive: false) on its container; stop them
  // here natively too, or they would still pan / zoom the hidden map.
  useEffect(() => {
    const el = ref.current;
    if (!el || lifting) return;
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', block, { passive: false });
    el.addEventListener('touchmove', block, { passive: false });
    return () => {
      el.removeEventListener('wheel', block);
      el.removeEventListener('touchmove', block);
    };
  }, [lifting]);

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden select-none"
      style={{
        zIndex: 90,
        opacity: lifting ? 0 : 1,
        transition: `opacity ${STARTUP_VEIL_FADE_MS}ms ease-out`,
        pointerEvents: lifting ? 'none' : 'auto',
        cursor: 'default',
        // Warm haze: pale sky, sandstone, a cool band of river under the fog, sand below
        background:
          'linear-gradient(180deg, #f1e9da 0%, #ebdfca 34%, #dcdcce 58%, #d9d6c6 64%, #e2d3ba 82%, #dccaae 100%)',
      }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === 'opacity' && lifting) onGone();
      }}
      onTransitionCancel={(e) => {
        if (e.target === e.currentTarget && lifting) onGone();
      }}
      onMouseDown={stop}
      onMouseUp={stop}
      onMouseMove={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={stop}
      onTouchEnd={stop}
      onTouchCancel={stop}
      onPointerDown={stop}
    >
      <style>{VEIL_CSS}</style>
      {/* The river: a soft teal-grey band, barely there through the fog */}
      <div
        className="startup-veil-river absolute"
        style={{
          left: '-10%',
          right: '-10%',
          top: '52%',
          height: '18%',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(120, 160, 156, 0.32) 0%, rgba(120, 160, 156, 0.12) 45%, rgba(120, 160, 156, 0) 72%)',
          filter: 'blur(18px)',
        }}
      />
      {/* Two slow banks of mist */}
      <div
        className="startup-veil-mist-a absolute"
        style={{
          inset: '-20% -25%',
          background:
            'radial-gradient(ellipse 40% 22% at 30% 45%, rgba(255, 251, 243, 0.75) 0%, rgba(255, 251, 243, 0) 70%),' +
            'radial-gradient(ellipse 34% 18% at 72% 62%, rgba(255, 250, 240, 0.65) 0%, rgba(255, 250, 240, 0) 70%)',
          filter: 'blur(24px)',
        }}
      />
      <div
        className="startup-veil-mist-b absolute"
        style={{
          inset: '-20% -25%',
          background:
            'radial-gradient(ellipse 46% 20% at 60% 35%, rgba(250, 243, 230, 0.6) 0%, rgba(250, 243, 230, 0) 70%),' +
            'radial-gradient(ellipse 38% 16% at 22% 70%, rgba(255, 252, 246, 0.55) 0%, rgba(255, 252, 246, 0) 70%)',
          filter: 'blur(30px)',
        }}
      />
      {/* A faint warm light low in the east, the sun not yet through */}
      <div
        className="absolute"
        style={{
          inset: 0,
          background: 'radial-gradient(ellipse 50% 35% at 78% 30%, rgba(255, 226, 180, 0.28) 0%, rgba(255, 226, 180, 0) 70%)',
        }}
      />
    </div>
  );
}
