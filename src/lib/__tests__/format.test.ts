import { describe, expect, it } from 'vitest';
import { formatIndianNumber, formatINR, formatPopulation, POPULATION_DISPLAY_SCALE } from '@/lib/format';

describe('formatIndianNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [99_999, '99,999'],
    [100_000, '1,00,000'],
    [1_234_567, '12,34,567'],
    [9_999_999, '99,99,999'],
    [100_000_000, '10,00,00,000'],
    [-5000, '-5,000'],
    [12.6, '13'],
  ])('%d -> %s', (n, expected) => {
    expect(formatIndianNumber(n)).toBe(expected);
  });
});

describe('formatINR', () => {
  it.each([
    [0, '₹0'],
    [45_300, '₹45,300'],
    [99_999, '₹99,999'],
    [100_000, '₹1 lakh'],
    [1_230_000, '₹12.3 lakh'],
    [9_999_999, '₹1 crore'],
    [9_940_000, '₹99.4 lakh'],
    [10_000_000, '₹1 crore'],
    [34_000_000, '₹3.4 crore'],
    [-5000, '-₹5,000'],
    [-250_000, '-₹2.5 lakh'],
  ])('%d -> %s', (n, expected) => {
    expect(formatINR(n)).toBe(expected);
  });
});

describe('formatPopulation', () => {
  it('scales the simulation population for display', () => {
    expect(POPULATION_DISPLAY_SCALE).toBe(10);
    expect(formatPopulation(0)).toBe('0');
    expect(formatPopulation(9_999.9)).toBe('99,999');
    expect(formatPopulation(10_000)).toBe('1 lakh');
    expect(formatPopulation(999_999.9)).toBe('1 crore');
    expect(formatPopulation(1_000_000)).toBe('1 crore');
    expect(formatPopulation(-10)).toBe('-100');
  });
});
