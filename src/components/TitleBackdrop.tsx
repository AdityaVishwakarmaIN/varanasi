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
  [8, 30, 0], [15, 62, 1.2], [23, 42, 0.6], [31, 75, 2.1], [38, 34, 1.7], [46, 58, 0.3],
  [53, 28, 2.4], [60, 70, 1.1], [67, 44, 0.9], [74, 64, 1.9], [82, 36, 0.4], [90, 56, 1.5],
];

function Skyline({ scale, className }: { scale: number; className?: string }) {
  return (
    <div className={cn('flex items-end justify-center', className)}>
      {SKYLINE.map((b, i) => (
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
  const scale = compact ? 0.52 : 1;
  const riverHeight = compact ? '17%' : '21%';
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
      <div className="absolute inset-0 jaali-bg opacity-60" />

      {/* Stars */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 12% 18%, hsl(40 90% 90% / 0.9), transparent), radial-gradient(1px 1px at 27% 8%, hsl(40 90% 90% / 0.7), transparent), radial-gradient(1.5px 1.5px at 44% 22%, hsl(40 90% 90% / 0.8), transparent), radial-gradient(1px 1px at 63% 12%, hsl(40 90% 90% / 0.7), transparent), radial-gradient(1px 1px at 78% 26%, hsl(40 90% 90% / 0.6), transparent), radial-gradient(1.5px 1.5px at 88% 9%, hsl(40 90% 90% / 0.8), transparent), radial-gradient(1px 1px at 6% 36%, hsl(40 90% 90% / 0.5), transparent), radial-gradient(1px 1px at 55% 38%, hsl(40 90% 90% / 0.4), transparent)',
        }}
      />

      {/* Setting sun */}
      <div
        className="absolute left-[74%] animate-sun"
        style={{
          width: compact ? 180 : 360,
          height: compact ? 180 : 360,
          marginLeft: compact ? -90 : -180,
          bottom: `calc(${riverHeight} + ${compact ? 34 : 70}px)`,
          borderRadius: '9999px',
          background:
            'radial-gradient(circle at 50% 50%, hsl(44 100% 78%) 0%, hsl(36 100% 62%) 30%, hsl(22 95% 52% / 0.55) 52%, hsl(14 90% 45% / 0) 70%)',
        }}
      />

      {/* Skyline on the ghats */}
      <div className="absolute inset-x-0" style={{ bottom: riverHeight }}>
        <Skyline scale={scale} className="drop-shadow-[0_-6px_24px_rgba(0,0,0,0.35)] [filter:saturate(0.92)_brightness(0.86)]" />
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
        <div className="absolute inset-x-0 top-0 origin-top opacity-25 [transform:scaleY(-0.55)] blur-[1px]">
          <Skyline scale={scale} />
        </div>
        {/* Shimmer */}
        <div
          className="absolute inset-y-0 left-0 w-[200%] animate-drift opacity-40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 38px, hsl(40 90% 80% / 0.35) 38px 60px, transparent 60px 130px), repeating-linear-gradient(180deg, transparent 0 7px, hsl(177 60% 60% / 0.12) 7px 8px)',
            maskImage: 'linear-gradient(180deg, black 0%, transparent 80%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 80%)',
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
                width: compact ? 4 : 6,
                height: compact ? 4 : 6,
                animationDelay: `${delay}s`,
                background: 'hsl(42 100% 70%)',
                boxShadow: '0 0 8px 3px hsl(34 100% 56% / 0.7), 0 0 22px 8px hsl(28 100% 50% / 0.25)',
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
