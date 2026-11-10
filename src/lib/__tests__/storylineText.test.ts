import { describe, expect, it } from 'vitest';
import { TIP_DEFINITIONS } from '@/hooks/useTipSystem';
import { SYSTEM_TIP_CHECKS, canHostFestival } from '@/lib/systemTips';
import { deriveAdvisorNotes, ADVISOR_FEED_CONFIG } from '@/lib/advisorFeed';
import { getActiveVoiceConditions } from '@/lib/citizenFeed';
import { CITIZEN_VOICES } from '@/lib/citizenVoices';
import { readinessLabelList } from '@/lib/festivals';
import { getLandmarkUnlockNotification } from '@/lib/landmarks';
import { emptyCity } from './feedbackLayers.helpers';

const tip = (id: string, state = emptyCity()) => {
  const def = TIP_DEFINITIONS.find((t) => t.id === id)!;
  return typeof def.message === 'function' ? def.message(state) : def.message;
};
const varanasi = () => {
  const s = emptyCity();
  s.mapId = 'varanasi';
  return s;
};
/** Nov 1: Dev Deepawali is 14 days away. */
const beforeDeepawali = (s: ReturnType<typeof emptyCity>) => {
  s.month = 11;
  s.day = 1;
  return s;
};

describe('readiness vocabulary', () => {
  it('lists the Event panel labels in table order', () => {
    expect(readinessLabelList()).toBe('crowd safety, fire and medical, access, sanitation and lights on');
  });
  it('the tip uses it and mentions the Ganga', () => {
    expect(tip('festival_prep')).toContain(readinessLabelList());
    expect(tip('festival_prep')).toContain('clean Ganga');
  });
});

describe('tip text', () => {
  it('debt tip matches the real loan', () => {
    const t = tip('debt_warning');
    expect(t).toContain('After 3 months in debt');
    expect(t).toContain('6 months of expenses');
    expect(t).toContain('no interest');
    expect(t).toContain('15% of your income');
    expect(t).toContain('24 months');
  });
  it('outbreak tip does not promise sewers', () => {
    expect(tip('first_outbreak')).not.toMatch(/sewer/i);
    expect(tip('first_outbreak')).toMatch(/hospital/);
    expect(tip('first_outbreak')).toMatch(/clean water/);
  });
  it('names buildings as the Varanasi build menu does, and generically elsewhere', () => {
    const v = varanasi();
    expect(tip('first_power_cut', v)).toContain('Thermal Power Stations');
    expect(tip('first_water_shortage', v)).toContain('Overhead Water Tanks');
    expect(tip('needs_safety_services', v)).toContain('Police Thanas');
    expect(tip('first_outbreak', v)).toContain('District Hospital');
    expect(tip('first_power_cut')).toContain('power plants');
    expect(tip('first_water_shortage')).toContain('water towers');
    expect(tip('needs_safety_services')).toContain('police stations');
  });
});

describe('festival gating', () => {
  it('festival tip and advisor note wait for a ghat', () => {
    const s = beforeDeepawali(varanasi());
    expect(canHostFestival(s, 'dev_deepawali')).toBe(false);
    expect(SYSTEM_TIP_CHECKS.festival_prep(s)).toBe(false);
    expect(deriveAdvisorNotes(s, null).some((n) => n.kind === 'festival_prep')).toBe(false);
    s.grid[10][10].building = { ...s.grid[10][10].building, type: 'ghat' };
    expect(SYSTEM_TIP_CHECKS.festival_prep(s)).toBe(true);
    const note = deriveAdvisorNotes(s, null).find((n) => n.kind === 'festival_prep');
    expect(note).toBeDefined();
    expect(JSON.stringify(note)).toContain(readinessLabelList());
  });
  it('festival crowds note and citizen voice also wait for a ghat', () => {
    const s = beforeDeepawali(varanasi());
    s.stats.population = 500;
    const hasVoice = () => getActiveVoiceConditions(s, null).some((c) => c.condition === 'festival_upcoming');
    expect(hasVoice()).toBe(false);
    s.month = 11;
    s.day = 15;
    s.hour = 19;
    expect(deriveAdvisorNotes(s, null).some((n) => n.kind === 'festival_now')).toBe(false);
    s.grid[10][10].building = { ...s.grid[10][10].building, type: 'ghat' };
    expect(deriveAdvisorNotes(s, null).some((n) => n.kind === 'festival_now')).toBe(true);
    s.month = 11;
    s.day = 1;
    expect(hasVoice()).toBe(true);
  });
  it('Shivratri can also be hosted at Kashi Vishwanath', () => {
    const s = varanasi();
    expect(canHostFestival(s, 'maha_shivratri')).toBe(false);
    s.grid[5][5].building = { ...s.grid[5][5].building, type: 'landmark_kashi_vishwanath' as never };
    expect(canHostFestival(s, 'maha_shivratri')).toBe(true);
    expect(canHostFestival(s, 'dev_deepawali')).toBe(false);
  });
});

describe('landmark text', () => {
  it('first_landmark tip uses the peak displayed population', () => {
    const s = varanasi();
    s.stats.population = 0;
    s.peakPopulation = 1_000_000;
    expect(SYSTEM_TIP_CHECKS.first_landmark_unlocked(s)).toBe(true);
    s.peakPopulation = 0;
    expect(SYSTEM_TIP_CHECKS.first_landmark_unlocked(s)).toBe(false);
  });
  it('unlock notification keeps proper nouns capitalised', () => {
    const n = getLandmarkUnlockNotification('landmark_kashi_vishwanath');
    expect(n.description).toContain('(within 8 tiles of the Ganga, on the west bank)');
  });
});

describe('advisor and citizen text', () => {
  it('deficit note waits for a settled population; debt note does not', () => {
    const s = emptyCity();
    s.stats.income = 10;
    s.stats.expenses = 100;
    s.stats.money = -5;
    s.stats.population = ADVISOR_FEED_CONFIG.minPopulationForServiceWarnings - 1;
    let kinds = deriveAdvisorNotes(s, null).map((n) => n.kind);
    expect(kinds).toContain('debt');
    expect(kinds).not.toContain('deficit');
    s.stats.population = ADVISOR_FEED_CONFIG.minPopulationForServiceWarnings;
    kinds = deriveAdvisorNotes(s, null).map((n) => n.kind);
    expect(kinds).toContain('deficit');
  });
  it('power advisor uses the Varanasi name only on that map', () => {
    const power = { supply: 50, demand: 100, ratio: 0.5, feeders: [0], cut: [0] };
    const v = varanasi();
    v.stats.power = power;
    expect(JSON.stringify(deriveAdvisorNotes(v, null).find((n) => n.kind === 'power_shortage'))).toContain('Thermal Power Station');
    const r = emptyCity();
    r.stats.power = power;
    expect(JSON.stringify(deriveAdvisorNotes(r, null).find((n) => n.kind === 'power_shortage'))).toContain('Build another power plant.');
  });
  it('housing_short needs an informal settlement, not just demand', () => {
    const s = varanasi();
    s.stats.population = 500;
    s.stats.demand = { ...s.stats.demand, residential: 80 };
    expect(getActiveVoiceConditions(s, null).some((a) => a.condition === 'housing_short')).toBe(false);
    s.grid[3][3].building = { ...s.grid[3][3].building, type: 'informal_housing' };
    expect(getActiveVoiceConditions(s, null).some((a) => a.condition === 'housing_short')).toBe(true);
  });
  it('festival_upcoming voice mentions no diyas', () => {
    const v = CITIZEN_VOICES.find((c) => c.id === 'festival_upcoming')!;
    expect(v.text).not.toMatch(/diya/i);
  });
});
