'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import type { MapId } from '@/games/isocity/maps/varanasi';

const LABELS = {
  varanasiTitle: msg('Varanasi'),
  varanasiText: msg('The holy city on the Ganga. Recommended.'),
  randomTitle: msg('Random map'),
  randomText: msg('A random landscape with lakes and coastline.'),
};

/** Tiny illustration: the Ganga crescent with ghats on the west bank. */
function VaranasiThumb() {
  return (
    <svg viewBox="0 0 96 64" className="w-full h-full" aria-hidden="true">
      <rect width="96" height="64" fill="#5b7d45" />
      <path d="M96 4 C 78 8, 64 14, 58 24 C 52 34, 52 44, 60 64 L 96 64 Z" fill="#d9c49a" />
      <path
        d="M98 3 C 80 7, 60 13, 53 24 C 47 34, 48 46, 57 66"
        fill="none"
        stroke="#3a7bd5"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {[26, 31, 36, 41].map((y) => (
        <rect key={y} x="44" y={y} width="4" height="3" fill="#e8c98f" />
      ))}
      <path d="M0 20 C 14 18, 30 22, 52 20" fill="none" stroke="#3a7bd5" strokeWidth="2" />
      <path d="M24 56 C 34 54, 44 54, 54 53" fill="none" stroke="#3a7bd5" strokeWidth="1.5" />
    </svg>
  );
}

function RandomThumb() {
  return (
    <svg viewBox="0 0 96 64" className="w-full h-full" aria-hidden="true">
      <rect width="96" height="64" fill="#5b7d45" />
      <ellipse cx="28" cy="24" rx="12" ry="8" fill="#3a7bd5" />
      <ellipse cx="66" cy="42" rx="9" ry="6" fill="#3a7bd5" />
      <path d="M0 50 C 20 46, 30 58, 50 64 L 0 64 Z" fill="#3a7bd5" />
    </svg>
  );
}

/** Two large cards to pick the map for a new city (S2-T3). */
export function MapChoiceCards({
  value,
  onChange,
  compact = false,
}: {
  value: MapId;
  onChange: (mapId: MapId) => void;
  compact?: boolean;
}) {
  const m = useMessages();
  const cards: { id: MapId; title: unknown; text: unknown; thumb: React.ReactNode }[] = [
    { id: 'varanasi', title: LABELS.varanasiTitle, text: LABELS.varanasiText, thumb: <VaranasiThumb /> },
    { id: 'random', title: LABELS.randomTitle, text: LABELS.randomText, thumb: <RandomThumb /> },
  ];
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const selected = value === card.id;
        return (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(card.id)}
            className={`text-left rounded-md border overflow-hidden transition-colors min-h-[44px] ${
              selected ? 'border-amber-400 ring-2 ring-amber-400/60 bg-amber-400/10' : 'border-white/15 hover:border-white/40'
            }`}
          >
            {!compact && <div className="aspect-[3/2] w-full">{card.thumb}</div>}
            <div className="p-2.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{m(card.title as Parameters<typeof m>[0])}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{m(card.text as Parameters<typeof m>[0])}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
