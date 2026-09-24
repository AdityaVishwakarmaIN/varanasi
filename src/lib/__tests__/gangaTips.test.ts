import { describe, expect, it } from 'vitest';
import {
  GANGA_TIPS_CONFIG,
  gameDayIndex,
  isGangaFallingLongEnough,
  isSewageDominant,
  needsFirstGhat,
  nextGangaFallingDays,
} from '@/lib/gangaTips';

describe('Ganga tips', () => {
  it('build_first_ghat uses the displayed population', () => {
    expect(needsFirstGhat(500, 0)).toBe(false); // 5,000 displayed: not more than 5,000
    expect(needsFirstGhat(501, 0)).toBe(true);
    expect(needsFirstGhat(10_000, 1)).toBe(false);
  });

  it('ganga_falling counts consecutive down days', () => {
    let days = 0;
    for (let i = 0; i < GANGA_TIPS_CONFIG.fallingTrendDays - 1; i++) days = nextGangaFallingDays(days, 'down', 1);
    expect(isGangaFallingLongEnough(days)).toBe(false);
    expect(nextGangaFallingDays(days, 'down', 0)).toBe(days);
    days = nextGangaFallingDays(days, 'down', 1);
    expect(isGangaFallingLongEnough(days)).toBe(true);
    expect(nextGangaFallingDays(days, 'flat', 1)).toBe(0);
    expect(nextGangaFallingDays(days, 'up', 1)).toBe(0);
    expect(nextGangaFallingDays(3, 'down', 4)).toBe(7);
    // A loaded save (time jumps) starts over.
    expect(nextGangaFallingDays(3, 'down', -5)).toBe(0);
    expect(nextGangaFallingDays(3, 'down', 400)).toBe(0);
  });

  it('counts calendar days across months and years', () => {
    expect(gameDayIndex(2024, 1, 2) - gameDayIndex(2024, 1, 1)).toBe(1);
    expect(gameDayIndex(2024, 2, 1) - gameDayIndex(2024, 1, 30)).toBe(1);
    expect(gameDayIndex(2025, 1, 1) - gameDayIndex(2024, 12, 30)).toBe(1);
  });

  it('needs_stp fires when sewage is more than half the net load', () => {
    expect(isSewageDominant(50, 100)).toBe(false);
    expect(isSewageDominant(51, 100)).toBe(true);
    expect(isSewageDominant(0, 0)).toBe(false);
  });
});
