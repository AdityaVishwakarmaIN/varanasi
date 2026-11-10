'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isDevMode } from '@/lib/devMode';

/** Money granted by each cheat (toasts format these, so text always matches the grant). */
export const CHEAT_AMOUNTS = { konami: 50000, motherlode: 50000 } as const;

export type CheatTrigger =
  | { type: 'konami'; amount: number }
  | { type: 'vinnie' }
  | { type: 'motherlode'; amount: number };

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const MAX_BUFFER_SIZE = 50;

export function useCheatCodes() {
  const [triggeredCheat, setTriggeredCheat] = useState<CheatTrigger | null>(null);
  const [showVinnieDialog, setShowVinnieDialog] = useState(false);
  const konamiBufferRef = useRef<string[]>([]);
  const typedBufferRef = useRef<string>('');
  const konamiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTypingTarget = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el?.closest('input, textarea, select, [contenteditable="true"]');
  }, []);

  useEffect(() => {
    // Cheats are a developer tool: only listen with ?dev=1.
    if (!isDevMode()) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (isTypingTarget(e.target)) return;

      const key = e.key;

      // Check Konami code
      // Clear timeout if it exists
      if (konamiTimeoutRef.current) {
        clearTimeout(konamiTimeoutRef.current);
        konamiTimeoutRef.current = null;
      }

      konamiBufferRef.current.push(key.toLowerCase());
      if (konamiBufferRef.current.length > KONAMI_CODE.length) {
        konamiBufferRef.current.shift();
      }

      // Check if Konami code matches (check if buffer ends with the sequence)
      if (konamiBufferRef.current.length >= KONAMI_CODE.length) {
        const recentKeys = konamiBufferRef.current.slice(-KONAMI_CODE.length);
        const matches = recentKeys.every((k, i) => 
          k === KONAMI_CODE[i].toLowerCase()
        );
        if (matches) {
          setTriggeredCheat({ type: 'konami', amount: CHEAT_AMOUNTS.konami });
          konamiBufferRef.current = [];
          if (konamiTimeoutRef.current) {
            clearTimeout(konamiTimeoutRef.current);
            konamiTimeoutRef.current = null;
          }
        }
      }

      // Reset buffer if no key pressed for 2 seconds
      konamiTimeoutRef.current = setTimeout(() => {
        konamiBufferRef.current = [];
        konamiTimeoutRef.current = null;
      }, 2000);

      // Track typed characters for phrase detection
      // Only track letter keys (a-z) and space
      if (key.length === 1 && /[a-z\s]/i.test(key)) {
        typedBufferRef.current += key.toLowerCase();
        // Keep buffer size manageable
        if (typedBufferRef.current.length > MAX_BUFFER_SIZE) {
          typedBufferRef.current = typedBufferRef.current.slice(-MAX_BUFFER_SIZE);
        }

        // Check for cheat phrases (normalize spaces for matching)
        const buffer = typedBufferRef.current;
        const normalizedBuffer = buffer.replace(/\s+/g, '');
        
        if (buffer.includes('vinnie')) {
          console.log('🎮 Cheat activated: vinnie');
          setShowVinnieDialog(true);
          setTriggeredCheat({ type: 'vinnie' });
          typedBufferRef.current = '';
        } else if (normalizedBuffer.includes('motherlode')) {
          console.log('🎮 Cheat activated: motherlode');
          setTriggeredCheat({ type: 'motherlode', amount: CHEAT_AMOUNTS.motherlode });
          typedBufferRef.current = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (konamiTimeoutRef.current) {
        clearTimeout(konamiTimeoutRef.current);
      }
    };
  }, [isTypingTarget]);

  // Clear triggered cheat after handling
  const clearTriggeredCheat = useCallback(() => {
    setTriggeredCheat(null);
  }, []);

  return {
    triggeredCheat,
    showVinnieDialog,
    setShowVinnieDialog,
    clearTriggeredCheat,
  };
}
















