// Storage-agnostic save logic: legacy localStorage migration, safe writes and
// a serial queue. Everything takes its stores as arguments, so it can be unit
// tested against `createMemoryStore()` without a browser.

import type { KeyValueStore } from '@/lib/storage/idbStore';

export const SAVE_STORE_CONFIG = {
  /** Suffix of the temporary key a save is written to before the swap. */
  tempKeySuffix: '.tmp',
} as const;

/** The subset of the Web Storage API that migration needs (localStorage fits). */
export interface LegacyStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export type MigrationResult =
  | { status: 'none' }
  | { status: 'migrated'; keys: string[] }
  | { status: 'failed'; keys: string[]; error: unknown };

type Logger = Pick<Console, 'error' | 'info'>;

/**
 * Move legacy save keys from localStorage into the key-value store.
 *
 * 1. Copy every matching key into the store (one atomic batch). Keys that the
 *    store already has are not overwritten: the store copy is newer (the game
 *    kept saving there after an earlier failed migration).
 * 2. Read every key back and check it matches what was copied.
 * 3. Only then delete the legacy keys.
 *
 * If anything fails, the legacy keys are left untouched, the error is logged
 * and the migration is retried on the next start.
 */
export async function migrateLegacySaves(
  store: KeyValueStore,
  legacy: LegacyStorage,
  isSaveKey: (key: string) => boolean,
  logger: Logger = console,
): Promise<MigrationResult> {
  const legacyKeys: string[] = [];
  let keysToMigrate: string[] = [];

  try {
    for (let i = 0; i < legacy.length; i++) {
      const key = legacy.key(i);
      if (key && isSaveKey(key)) legacyKeys.push(key);
    }
    if (legacyKeys.length === 0) return { status: 'none' };
    keysToMigrate = legacyKeys;

    const legacyValues = new Map<string, string>();
    for (const key of legacyKeys) {
      const value = legacy.getItem(key);
      if (value !== null) legacyValues.set(key, value);
    }

    // Step 1: copy (skip keys the store already holds).
    const toCopy: string[] = [];
    for (const key of legacyValues.keys()) {
      if ((await store.get(key)) === undefined) toCopy.push(key);
    }
    await store.batch(toCopy.map((key) => ({ type: 'set' as const, key, value: legacyValues.get(key)! })));

    // Step 2: verify the copy reads back correctly.
    const copied = new Set(toCopy);
    for (const key of legacyValues.keys()) {
      const stored = await store.get(key);
      if (stored === undefined || (copied.has(key) && stored !== legacyValues.get(key))) {
        throw new Error(`Save migration read-back mismatch for key "${key}"`);
      }
    }

    // Step 3: only now remove the legacy copies.
    for (const key of legacyKeys) {
      legacy.removeItem(key);
    }

    logger.info(`Migrated ${legacyKeys.length} save key(s) from localStorage to IndexedDB`);
    return { status: 'migrated', keys: legacyKeys };
  } catch (error) {
    logger.error('Save migration failed; keeping the old localStorage saves:', error);
    return { status: 'failed', keys: keysToMigrate, error };
  }
}

/**
 * Crash-safe write: the value goes to `<key>.tmp` first and is then swapped
 * into `key`. All three steps run in one atomic `batch` (a single IndexedDB
 * readwrite transaction), so a crash or error at any point leaves the
 * previous good save in `key` untouched: the transaction either commits
 * fully or not at all.
 */
export async function safeWrite(store: KeyValueStore, key: string, value: string): Promise<void> {
  const tempKey = key + SAVE_STORE_CONFIG.tempKeySuffix;
  await store.batch([
    { type: 'set', key: tempKey, value },
    { type: 'set', key, value },
    { type: 'del', key: tempKey },
  ]);
}

/**
 * Runs async jobs one after another. Used so read-modify-write updates (such
 * as the saved-cities index) never interleave and lose an update.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(job: () => Promise<T>): Promise<T> {
      const result = tail.then(job, job);
      tail = result.catch(() => undefined);
      return result;
    },
    /** Resolves once every job queued so far has finished. */
    idle(): Promise<void> {
      return tail.then(() => undefined);
    },
  };
}
