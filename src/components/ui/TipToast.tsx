'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lightbulb, SkipForward, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { T, useGT, useMessages } from 'gt-next';

export interface TipToastProps {
  message: string;
  isVisible: boolean;
  onContinue: () => void;
  onSkipAll: () => void;
  /**
   * When set, the tip renders in place (no portal, no fixed position) and this class
   * places it. The game uses this to stack the tip inside a HUD column so it never
   * covers the overlay bar, the citizen feed or the notifications.
   */
  className?: string;
}

function TipToastContent({ message, isVisible, onContinue, onSkipAll, className }: TipToastProps) {
  const gt = useGT();
  const m = useMessages();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const inline = className !== undefined;

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Small delay to trigger animation
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setIsAnimating(false);
      // Wait for exit animation before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto transition-[opacity,transform] duration-300 ease-out',
        inline
          ? className
          : cn(
              'fixed z-[9999]',
              // Mobile: below the top bar, full width with margins
              'top-[calc(5rem+env(safe-area-inset-top))] left-3 right-3',
              // Desktop: top right, under the top bar and stats row
              'md:top-[108px] md:left-auto md:right-4 md:w-[22rem]'
            ),
        isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
      )}
    >
      <div className="hud-glass gold-hairline relative rounded-2xl overflow-hidden w-full">
        {/* Content */}
        <div className="p-3.5 flex items-start gap-3">
          <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-b from-marigold/25 to-saffron/10 ring-1 ring-marigold/40 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-marigold animate-diya" aria-hidden />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <p className="hud-label mb-1">{gt('Tip')}</p>
            <p className="text-sm text-foreground leading-relaxed">
              {m(message)}
            </p>
          </div>

          <button
            onClick={onContinue}
            className="flex-shrink-0 -mt-1 -mr-1 h-11 w-11 max-md:h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-sandstone/[0.07] transition-colors"
            aria-label={gt('Dismiss tip')}
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="px-3.5 pb-3.5 flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipAll}
            className="text-xs text-muted-foreground hover:text-foreground gap-1 h-11 md:h-9"
          >
            <T>
              <SkipForward className="w-3.5 h-3.5" />
              Skip All Tips
            </T>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onContinue}
            className="text-xs gap-1 h-11 md:h-9 px-4"
          >
            <T>
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </T>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TipToast(props: TipToastProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (props.className !== undefined) {
    return <TipToastContent {...props} />;
  }

  // Use portal to render at document body level to avoid z-index/overflow issues
  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <TipToastContent {...props} />,
    document.body
  );
}
