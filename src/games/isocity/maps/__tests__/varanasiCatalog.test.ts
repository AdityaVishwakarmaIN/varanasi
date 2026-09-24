import { describe, expect, it } from 'vitest';
import { TOOL_INFO, type Tool } from '@/games/isocity/types/game';
import { getToolDisplay, isToolVisible, RIVERFRONT_TOOLS, visibleTools } from '@/games/isocity/maps/varanasiCatalog';

describe('varanasiCatalog', () => {
  it('hides Western-only and resize tools on Varanasi, riverfront tools elsewhere', () => {
    expect(isToolVisible('space_program', 'varanasi')).toBe(false);
    expect(isToolVisible('expand_city', 'varanasi')).toBe(false);
    expect(isToolVisible('ghat', 'varanasi')).toBe(true);
    expect(isToolVisible('ghat', 'random')).toBe(false);
    expect(isToolVisible('ghat', undefined)).toBe(false);
    expect(isToolVisible('space_program', 'random')).toBe(true);
    expect(visibleTools(['road', 'space_program', 'ghat'] as Tool[], 'varanasi')).toEqual(['road', 'ghat']);
  });

  it('renames on Varanasi only and keeps cost', () => {
    const v = getToolDisplay('police_station', TOOL_INFO.police_station, 'varanasi');
    expect(v.name).toBe('Police Thana');
    expect(v.cost).toBe(TOOL_INFO.police_station.cost);
    expect(getToolDisplay('police_station', TOOL_INFO.police_station, 'random')).toBe(TOOL_INFO.police_station);
    expect(RIVERFRONT_TOOLS.every((t) => TOOL_INFO[t])).toBe(true);
  });
});
