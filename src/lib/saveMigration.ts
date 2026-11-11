/**
 * The one place a stored city is checked and brought up to date before it is played (E3).
 * Every load path (autosave, saved cities, import, monthly backups) runs `migrateAndValidateState`.
 *
 * Pure apart from generating an id for a save that has none: raw parsed JSON in, a playable
 * GameState (or null when the save is structurally broken) out. The input object is mutated.
 */
import type { GameState } from '@/types/game';
import {
  createInitialBudget,
  createInitialStats,
  createServiceCoverage,
  generateUUID,
} from '@/lib/simulation';
import { hashString } from '@/lib/rng';

/** Tax is capped at 0-20% (older saves allowed up to 100). */
export const MAX_TAX_RATE = 20;
const DEFAULT_TAX_RATE = 9;

type Raw = any; // untrusted JSON: fields are checked one by one below

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finiteOr = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function isSquareGrid(grid: unknown, size: number): boolean {
  return Array.isArray(grid) && grid.length === size && grid.every((row) => Array.isArray(row) && row.length === size);
}

function isCoverageValid(services: unknown, size: number): boolean {
  if (!isObject(services)) return false;
  return (['police', 'fire', 'health', 'education', 'power', 'water'] as const).every((k) => isSquareGrid(services[k], size));
}

export interface MigrateOptions {
  /** Id to use when the save has none (e.g. the saved-city slot id). */
  fallbackId?: string;
}

/**
 * Run every save migration and structural check. Returns null when the save cannot be played
 * (no square grid of gridSize×gridSize, or a tile without a building/zone); rebuilds or defaults
 * everything else (stats, budget, services, non-finite numbers, tax range, ids, seed).
 */
export function migrateAndValidateState(raw: unknown, options: MigrateOptions = {}): GameState | null {
  if (!isObject(raw)) return null;
  const s = raw as Raw;

  // --- Structure: the grid must be gridSize × gridSize, every tile with a building and a zone
  const size = s.gridSize;
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) return null;
  if (!isSquareGrid(s.grid, size)) return null;
  for (let y = 0; y < size; y++) {
    const row = s.grid[y];
    for (let x = 0; x < size; x++) {
      const tile = row[x];
      if (!isObject(tile) || !isObject(tile.building) || typeof tile.building.type !== 'string' || typeof tile.zone !== 'string') {
        return null;
      }
      const b = tile.building as Raw;
      // park_medium was merged into park_large
      if (b.type === 'park_medium') b.type = 'park_large';
      // Old saves: existing buildings are complete and not abandoned
      if (b.constructionProgress === undefined) b.constructionProgress = 100;
      if (b.abandoned === undefined) b.abandoned = false;
      if (b.lastUpgradeDay !== undefined && (!Number.isSafeInteger(b.lastUpgradeDay) || (b.lastUpgradeDay as number) < 0)) delete b.lastUpgradeDay;
    }
  }
  if (s.selectedTool === 'park_medium') s.selectedTool = 'park_large';

  // --- Stats, budget and services: present, or rebuilt from defaults
  const initialStats = createInitialStats();
  const stats: Raw = isObject(s.stats) ? s.stats : {};
  for (const key of ['population', 'jobs', 'money', 'income', 'expenses', 'happiness', 'health', 'education', 'safety', 'environment'] as const) {
    stats[key] = finiteOr(stats[key], initialStats[key]);
  }
  const demand: Raw = isObject(stats.demand) ? stats.demand : {};
  for (const key of ['residential', 'commercial', 'industrial'] as const) {
    demand[key] = finiteOr(demand[key], initialStats.demand[key]);
  }
  stats.demand = demand;
  for (const key of ['gangaHealth', 'gangaHealthTarget', 'tourismIncome', 'taxIncome'] as const) {
    if (stats[key] !== undefined && !Number.isFinite(stats[key])) delete stats[key];
  }
  s.stats = stats;

  const initialBudget = createInitialBudget();
  const budget: Raw = isObject(s.budget) ? s.budget : {};
  for (const key of Object.keys(initialBudget) as (keyof typeof initialBudget)[]) {
    const cat = budget[key];
    budget[key] = isObject(cat)
      ? { name: typeof cat.name === 'string' ? cat.name : initialBudget[key].name, funding: finiteOr(cat.funding, 100), cost: finiteOr(cat.cost, 0) }
      : initialBudget[key];
  }
  s.budget = budget;

  // Coverage is recomputed every tick; an empty grid of the right size is enough to start from
  if (!isCoverageValid(s.services, size)) s.services = createServiceCoverage(size);

  // --- Calendar and speed
  s.year = finiteOr(s.year, 2024);
  s.month = clamp(Math.round(finiteOr(s.month, 1)), 1, 12);
  s.day = Math.max(1, Math.round(finiteOr(s.day, 1)));
  s.hour = finiteOr(s.hour, 12); // day/night cycle; default noon
  s.tick = finiteOr(s.tick, 0);
  s.speed = clamp(Math.round(finiteOr(s.speed, 1)), 0, 3);

  // --- Tax: effectiveTaxRate lags taxRate; both 0-20
  s.taxRate = clamp(finiteOr(s.taxRate, DEFAULT_TAX_RATE), 0, MAX_TAX_RATE);
  s.effectiveTaxRate = clamp(finiteOr(s.effectiveTaxRate, s.taxRate), 0, MAX_TAX_RATE);

  // --- Lists that older saves lack
  if (!Array.isArray(s.adjacentCities)) s.adjacentCities = [];
  for (const city of s.adjacentCities) {
    // Cities in old saves were already visible, so count as discovered
    if (isObject(city) && city.discovered === undefined) city.discovered = true;
  }
  if (!Array.isArray(s.waterBodies)) s.waterBodies = [];
  if (!Array.isArray(s.notifications)) s.notifications = [];
  if (!Array.isArray(s.advisorMessages)) s.advisorMessages = [];
  if (!Array.isArray(s.history)) s.history = [];

  // --- Identity
  if (typeof s.id !== 'string' || !s.id) s.id = options.fallbackId || generateUUID();
  if (typeof s.cityName !== 'string') s.cityName = 'City';
  // Per-city seed for yearly rolls; derived from the id so an old save gets the same one on every load
  if (typeof s.seed !== 'number' || !Number.isFinite(s.seed)) s.seed = hashString(s.id);

  // Multi-city support: one default city covering the map
  if (!Array.isArray(s.cities) || s.cities.length === 0) {
    s.cities = [{
      id: s.id || 'default-city',
      name: s.cityName,
      bounds: { minX: 0, minY: 0, maxX: size - 1, maxY: size - 1 },
      economy: {
        population: stats.population,
        jobs: stats.jobs,
        income: stats.income,
        expenses: stats.expenses,
        happiness: stats.happiness || 50,
        lastCalculated: 0,
      },
      color: '#3b82f6',
    }];
  }

  // --- Render/cache versions
  s.gameVersion = finiteOr(s.gameVersion, 0);
  s.structureVersion = finiteOr(s.structureVersion, 0);
  s.roadNetworkVersion = finiteOr(s.roadNetworkVersion, 0);

  return s as GameState;
}
