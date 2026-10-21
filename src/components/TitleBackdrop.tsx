'use client';

import React from 'react';
import { BuildingArtThumb } from '@/components/game/BuildingArtThumb';
import { cn } from '@/lib/utils';

/** The riverfront skyline, left to right: building type, variant, box size (px at scale 1). */
const SKYLINE: { type: string; variant?: number; size: number }[] = [
  { type: 'informal_housing', variant: 1, size: 92 },
  { type: 'landmark_ramnagar_fort', size: 176 },
  { type: 'ghat', size: 112 },
  { type: 'informal_housing', variant: 2, size: 84 },
  { type: 'landmark_kashi_vishwanath', size: 208 },
  { type: 'landmark_dashashwamedh', size: 164 },
  { type: 'ghat', variant: 1, size: 112 },
  { type: 'informal_housing', size: 96 },
  { type: 'jal_sansthan_water_works', size: 132 },
  { type: 'informal_housing', variant: 3, size: 84 },
];

/** Diya positions on the water: left %, top % within the river band, delay s. */
const DIYAS: [number, number, number][] = [
  [12, 38, 0], [28, 66, 1.2], [47, 46, 0.6], [63, 72, 2.1], [78, 40, 1.7], [91, 60, 0.9],
];

/** Compact (phone) skyline: fewer buildings so the whole row fits a 390px screen uncropped. */
const SKYLINE_COMPACT: typeof SKYLINE = [
  { type: 'informal_housing', variant: 1, size: 92 },
  { type: 'landmark_dashashwamedh', size: 164 },
  { type: 'landmark_kashi_vishwanath', size: 208 },
  { type: 'ghat', variant: 1, size: 112 },
  { type: 'jal_sansthan_water_works', size: 132 },
];

function Skyline({ scale, className, compact }: { scale: number; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-end justify-center', className)}>
      {(compact ? SKYLINE_COMPACT : SKYLINE).map((b, i) => (
        <BuildingArtThumb
          key={i}
          type={b.type}
          variant={b.variant}
          size={Math.round(b.size * scale)}
          className="-mx-[1.5%]"
        />
      ))}
    </div>
  );
}

/**
 * Title-screen backdrop: a dusk sky over the Ganga with the city's code-drawn skyline, its
 * reflection, and floating diyas. Pure CSS (transform/opacity animations), no canvas loop.
 */
export function TitleBackdrop({ compact = false }: { compact?: boolean }) {
  const scale = compact ? 0.5 : 1;
  const riverHeight = compact ? '28%' : '21%';
  const groundH = compact ? 18 : 30; // ghat / land strip the buildings stand on
  const sunSize = compact ? 64 : 110;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Dusk sky */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, hsl(236 48% 7%) 0%, hsl(240 42% 12%) 34%, hsl(268 34% 20%) 56%, hsl(338 38% 30%) 70%, hsl(22 70% 42%) 79%, hsl(34 88% 56%) 83%)',
        }}
      />
      <div className="absolute inset-0 title-jaali opacity-60" />

      {/* Stars */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 12% 18%, hsl(40 90% 90% / 0.9), transparent), radial-gradient(1px 1px at 27% 8%, hsl(40 90% 90% / 0.7), transparent), radial-gradient(1.5px 1.5px at 44% 22%, hsl(40 90% 90% / 0.8), transparent), radial-gradient(1px 1px at 63% 12%, hsl(40 90% 90% / 0.7), transparent), radial-gradient(1px 1px at 78% 26%, hsl(40 90% 90% / 0.6), transparent), radial-gradient(1.5px 1.5px at 88% 9%, hsl(40 90% 90% / 0.8), transparent), radial-gradient(1px 1px at 6% 36%, hsl(40 90% 90% / 0.5), transparent), radial-gradient(1px 1px at 55% 38%, hsl(40 90% 90% / 0.4), transparent)',
        }}
      />

      {/* Setting sun: small, half sunk behind the skyline at the horizon */}
      <div
        className="absolute left-[72%] animate-sun short:hidden"
        style={{
          width: sunSize,
          height: sunSize,
          marginLeft: -sunSize / 2,
          bottom: `calc(${riverHeight} + ${groundH}px - ${Math.round(sunSize * 0.35)}px)`,
          borderRadius: '9999px',
          background:
            'radial-gradient(circle at 50% 50%, hsl(44 100% 78%) 0%, hsl(36 100% 64%) 42%, hsl(22 95% 54% / 0.6) 62%, hsl(14 90% 45% / 0) 78%)',
        }}
      />

      {/* Ghat / ground strip so the skyline sits on land */}
      <div
        className="absolute inset-x-0"
        style={{
          bottom: riverHeight,
          height: groundH,
          background:
            'linear-gradient(180deg, hsl(28 24% 30%) 0%, hsl(26 26% 22%) 40%, hsl(24 28% 15%) 100%)',
          borderTop: '1px solid hsl(32 30% 38% / 0.7)',
        }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{ backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 5px, hsl(30 30% 10% / 0.45) 5px 6px)' }}
        />
      </div>

      {/* Skyline on the ghats */}
      <div className="absolute inset-x-0 short:hidden" style={{ bottom: `calc(${riverHeight} + ${Math.round(groundH * 0.45)}px)` }}>
        <Skyline compact={compact} scale={scale} className="drop-shadow-[0_-6px_24px_rgba(0,0,0,0.35)] [filter:saturate(0.92)_brightness(0.86)]" />
        {/* Dusk haze over the buildings so the text reads */}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(236_45%_10%/0.35)] to-transparent" />
      </div>

      {/* The Ganga */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: riverHeight }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, hsl(28 70% 42%) 0%, hsl(190 45% 26%) 16%, hsl(200 55% 16%) 45%, hsl(234 48% 8%) 100%)',
          }}
        />
        {/* Reflection */}
        <div className="absolute inset-x-0 top-0 origin-top short:hidden opacity-25 [transform:scaleY(-0.55)] blur-[1px]">
          <Skyline compact={compact} scale={scale} />
        </div>
        {/* Faint horizontal ripples */}
        <div
          className="absolute inset-y-0 left-0 w-[200%] animate-drift opacity-40"
          style={{
            backgroundImage: [
              'linear-gradient(90deg, transparent, hsl(40 90% 80% / 0.35), transparent) 0 12% / 170px 1px repeat-x',
              'linear-gradient(90deg, transparent, hsl(177 60% 70% / 0.25), transparent) 60px 27% / 130px 1px repeat-x',
              'linear-gradient(90deg, transparent, hsl(40 90% 80% / 0.25), transparent) 20px 44% / 210px 1px repeat-x',
              'linear-gradient(90deg, transparent, hsl(177 60% 70% / 0.18), transparent) 110px 63% / 150px 1px repeat-x',
              'linear-gradient(90deg, transparent, hsl(40 90% 80% / 0.14), transparent) 40px 82% / 240px 1px repeat-x',
            ].join(', '),
            maskImage: 'linear-gradient(180deg, black 0%, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 90%)',
          }}
        />
        {/* Diyas */}
        {DIYAS.map(([left, top, delay], i) => (
          <span
            key={i}
            className="absolute animate-float"
            style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
          >
            <span
              className="block animate-diya rounded-full"
              style={{
                width: compact ? 3 : 4,
                height: compact ? 3 : 4,
                animationDelay: `${delay}s`,
                background: 'hsl(42 100% 70%)',
                boxShadow: '0 0 5px 1px hsl(34 100% 56% / 0.6)',
              }}
            />
          </span>
        ))}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 45%, hsl(236 50% 4% / 0.65) 100%)' }}
      />
    </div>
  );
}

export default TitleBackdrop;
