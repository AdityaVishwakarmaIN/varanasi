'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { Label } from '@/components/ui/label';
import { useGraphicsSettings } from '@/hooks/useGraphicsSettings';
import { setQualitySetting, setRendererSetting } from '@/lib/graphicsSettings';
import type { QualitySetting } from '@/lib/qualityConfig';
import type { RendererSetting } from '@/lib/rendererSelection';

const LABELS = {
  quality: msg('Graphics Quality'),
  qualityDesc: msg('Auto lowers detail when the frame rate drops'),
  renderer: msg('Renderer'),
  rendererDesc: msg('GPU is faster on large cities; Canvas works everywhere'),
  auto: msg('Auto'),
  low: msg('Low'),
  medium: msg('Medium'),
  high: msg('High'),
  gpu: msg('GPU'),
  canvas: msg('Canvas'),
  gpuFailed: msg('GPU renderer failed on this device; using Canvas.'),
  active: msg('In use:'),
} as const;

const QUALITY_OPTIONS: QualitySetting[] = ['auto', 'low', 'medium', 'high'];
const RENDERER_OPTIONS: RendererSetting[] = ['auto', 'gpu', 'canvas'];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          className={`flex-1 px-2 py-2 text-sm font-medium transition-colors ${
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {label(opt)}
        </button>
      ))}
    </div>
  );
}

/** Quality and renderer pickers (S1-T7/T8). Choices persist in localStorage. */
export function GraphicsSettings() {
  const m = useMessages();
  const g = useGraphicsSettings();
  const name = (v: string) => m(LABELS[v as keyof typeof LABELS]);

  return (
    <>
      <div className="py-2">
        <Label>{m(LABELS.quality)}</Label>
        <p className="text-muted-foreground text-xs mb-2">{m(LABELS.qualityDesc)}</p>
        <Segmented options={QUALITY_OPTIONS} value={g.qualitySetting} onChange={setQualitySetting} label={name} />
        {g.qualitySetting === 'auto' && (
          <p className="text-muted-foreground text-[11px] mt-1">
            {m(LABELS.active)} {name(g.qualityLevel)}
          </p>
        )}
      </div>
      <div className="py-2">
        <Label>{m(LABELS.renderer)}</Label>
        <p className="text-muted-foreground text-xs mb-2">{m(LABELS.rendererDesc)}</p>
        <Segmented options={RENDERER_OPTIONS} value={g.rendererSetting} onChange={setRendererSetting} label={name} />
        {g.gpuFailed ? (
          <p className="text-amber-500 text-[11px] mt-1">{m(LABELS.gpuFailed)}</p>
        ) : (
          g.rendererSetting === 'auto' && (
            <p className="text-muted-foreground text-[11px] mt-1">
              {m(LABELS.active)} {name(g.renderer)}
            </p>
          )
        )}
      </div>
    </>
  );
}
