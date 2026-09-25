import { describe, expect, it } from 'vitest';
import { TOOL_INFO, type Tool } from '@/games/isocity/types/game';
import { getBuildingDisplayName, getToolDisplay, isToolVisible, RIVERFRONT_TOOLS, visibleTools } from '@/games/isocity/maps/varanasiCatalog';

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

  it('names placed buildings on Varanasi only (S3-T1)', () => {
    expect(getBuildingDisplayName('animal_pens_farm', 'varanasi')).toBe('Gaushala');
    expect(getBuildingDisplayName('animal_pens_farm', 'random')).toBeUndefined();
    expect(getBuildingDisplayName('house_small', 'varanasi')).toBeUndefined();
  });

  it('hides every tool the plan lists on Varanasi, and none on the random map', () => {
    const hidden = ['space_program', 'baseball_stadium', 'football_field', 'mini_golf_course', 'go_kart_track', 'skate_park',
      'mountain_lodge', 'mountain_trailhead', 'cabin_house', 'campground', 'roller_coaster_small', 'pier_large', 'bleachers_field'] as Tool[];
    for (const t of hidden) {
      expect(isToolVisible(t, 'varanasi')).toBe(false);
      expect(isToolVisible(t, 'random')).toBe(true);
    }
  });
});
