import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  CITIZEN_VOICES,
  INDIAN_FIRST_NAMES,
  VARANASI_MOHALLAS,
  formatCitizenVoice,
  getMohallaForFeeder,
  pickCitizenVoice,
  pickFirstName,
  type VoiceCondition,
} from '@/lib/citizenVoices';

describe('mohallas and names', () => {
  it('includes the doc examples, with no duplicates', () => {
    const names = VARANASI_MOHALLAS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of ['Lanka', 'Assi', 'Godowlia', 'Sigra', 'Bhelupur', 'Lahurabir', 'Chowk', 'Maidagin', 'Sarnath', 'Ramnagar']) {
      expect(names).toContain(n);
    }
    for (const m of VARANASI_MOHALLAS) {
      expect(m.u).toBeGreaterThanOrEqual(0);
      expect(m.u).toBeLessThanOrEqual(1);
      expect(m.v).toBeGreaterThanOrEqual(0);
      expect(m.v).toBeLessThanOrEqual(1);
    }
  });

  it('feeders map deterministically to listed mohallas, following geography', () => {
    const count = 100; // 160×160 map, 16×16 feeders
    const all = new Set<string>();
    for (let i = 0; i < count; i++) {
      const a = getMohallaForFeeder(i, count);
      expect(a).toBe(getMohallaForFeeder(i, count));
      expect(VARANASI_MOHALLAS.map((m) => m.name)).toContain(a);
      all.add(a);
    }
    expect(all.size).toBeGreaterThanOrEqual(15);
    expect(getMohallaForFeeder(5, count)).toBe('Sarnath'); // top row, middle
    expect(getMohallaForFeeder(94, count)).toBe('Lanka'); // bottom row, left of middle
    expect(getMohallaForFeeder(88, count)).toBe('Ramnagar'); // south-east
    expect(VARANASI_MOHALLAS.map((m) => m.name)).toContain(getMohallaForFeeder(0, 1));
  });

  it('first names are unique, plentiful and plain', () => {
    expect(new Set(INDIAN_FIRST_NAMES).size).toBe(INDIAN_FIRST_NAMES.length);
    expect(INDIAN_FIRST_NAMES.length).toBeGreaterThanOrEqual(50);
    for (const n of INDIAN_FIRST_NAMES) expect(n).toMatch(/^[A-Z][a-z]+$/);
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) expect(INDIAN_FIRST_NAMES).toContain(pickFirstName(rng));
  });
});

describe('citizen voice templates', () => {
  it('at least 30 templates, at least a third positive, unique ids', () => {
    expect(CITIZEN_VOICES.length).toBeGreaterThanOrEqual(30);
    const positive = CITIZEN_VOICES.filter((v) => v.positive).length;
    expect(positive * 3).toBeGreaterThanOrEqual(CITIZEN_VOICES.length);
    expect(new Set(CITIZEN_VOICES.map((v) => v.id)).size).toBe(CITIZEN_VOICES.length);
  });

  it('only {name} and {area} placeholders, plain English text', () => {
    for (const v of CITIZEN_VOICES) {
      const placeholders = v.text.match(/\{[^}]*\}/g) ?? [];
      for (const p of placeholders) expect(['{name}', '{area}']).toContain(p);
      expect(v.text).toMatch(/^[\x20-\x7E–]+$/);
    }
  });

  it('follows the content rules (no caste, politics or religious jokes)', () => {
    const banned = /caste|brahmin|dalit|party|election|vote|minister|mla|\bmp\b|government is|modi|congress|bjp|hindu|muslim|joke|god\b/i;
    for (const v of CITIZEN_VOICES) expect(v.text).not.toMatch(banned);
  });

  it('covers every system', () => {
    const conditions = new Set(CITIZEN_VOICES.map((v) => v.condition));
    for (const c of ['power_cut', 'water_shortage', 'ganga_clean', 'traffic_high', 'festival_success', 'flood', 'heatwave', 'disease'] as VoiceCondition[]) {
      expect(conditions.has(c)).toBe(true);
    }
  });

  it('formats name and area', () => {
    const v = CITIZEN_VOICES.find((x) => x.id === 'power_cut_cricket')!;
    expect(formatCitizenVoice(v, { name: 'Ravi', area: 'Sigra' })).toBe('Power cut again during the cricket match! – Ravi, Sigra');
  });
});

describe('picking a voice', () => {
  it('returns null when nothing matches', () => {
    expect(pickCitizenVoice([], createRng(1))).toBeNull();
  });

  it('only matches active conditions', () => {
    const rng = createRng(4);
    for (let i = 0; i < 50; i++) {
      const v = pickCitizenVoice(['power_cut', 'ganga_clean'], rng)!;
      expect(['power_cut', 'ganga_clean']).toContain(v.condition);
    }
  });

  it('avoids recent ids, and repeats the oldest only when it must', () => {
    const rng = createRng(8);
    const powerCut = CITIZEN_VOICES.filter((v) => v.condition === 'power_cut').map((v) => v.id);
    const recent: string[] = [];
    for (let i = 0; i < powerCut.length; i++) {
      const v = pickCitizenVoice(['power_cut'], rng, recent)!;
      expect(recent).not.toContain(v.id);
      recent.push(v.id);
    }
    expect(new Set(recent).size).toBe(powerCut.length);
    expect(pickCitizenVoice(['power_cut'], rng, recent)!.id).toBe(recent[0]);
  });
});
