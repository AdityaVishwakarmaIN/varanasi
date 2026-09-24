import { describe, expect, it } from 'vitest';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { createMemoryStore, type KeyValueStore } from '@/lib/storage/idbStore';
import {
  createSerialQueue,
  migrateLegacySaves,
  safeWrite,
  SAVE_STORE_CONFIG,
  type LegacyStorage,
} from '@/lib/storage/saveStore';
import {
  isIsoCitySaveKey,
  ISOCITY_SAVED_CITIES_INDEX_KEY,
  ISOCITY_STORAGE_KEY,
  ISOCITY_UI_PREFERENCES_STORAGE_KEY,
} from '@/lib/isocityStorage';

/** Minimal in-memory stand-in for window.localStorage. */
class MemoryStorage implements LegacyStorage {
  private data = new Map<string, string>();
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
  }
  get length() {
    return this.data.size;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  snapshot() {
    return Object.fromEntries(this.data);
  }
}

const silentLogger = { error: () => {}, info: () => {} };

const cityJson = JSON.stringify({ grid: [[{ x: 0, y: 0 }]], gridSize: 1, stats: { money: 100, population: 0 } });
const oldAutosave = compressToUTF16(cityJson);
const oldCity = compressToUTF16(JSON.stringify({ ...JSON.parse(cityJson), cityName: 'Kashi' }));
const oldIndex = JSON.stringify([{ id: 'abc', cityName: 'Kashi', savedAt: 1 }]);

function legacyWithSaves() {
  return new MemoryStorage({
    [ISOCITY_STORAGE_KEY]: oldAutosave,
    [ISOCITY_SAVED_CITIES_INDEX_KEY]: oldIndex,
    'isocity-city-abc': oldCity,
    [ISOCITY_UI_PREFERENCES_STORAGE_KEY]: '{"showMinimap":false}',
    'isocity-sprite-pack': 'default',
  });
}

/** Wraps a store and makes selected operations fail or misbehave. */
function faultyStore(inner: KeyValueStore, faults: { batch?: boolean; corruptGet?: boolean }): KeyValueStore {
  return {
    get: async (key) => {
      const value = await inner.get(key);
      return faults.corruptGet && value !== undefined ? value + 'x' : value;
    },
    set: (key, value) => inner.set(key, value),
    del: (key) => inner.del(key),
    keys: () => inner.keys(),
    batch: async (ops) => {
      if (faults.batch) throw new Error('QuotaExceededError');
      return inner.batch(ops);
    },
  };
}

describe('isIsoCitySaveKey', () => {
  it('matches city saves but not UI preferences', () => {
    expect(isIsoCitySaveKey(ISOCITY_STORAGE_KEY)).toBe(true);
    expect(isIsoCitySaveKey(ISOCITY_SAVED_CITIES_INDEX_KEY)).toBe(true);
    expect(isIsoCitySaveKey('isocity-city-123')).toBe(true);
    expect(isIsoCitySaveKey(ISOCITY_UI_PREFERENCES_STORAGE_KEY)).toBe(false);
    expect(isIsoCitySaveKey('isocity-sprite-pack')).toBe(false);
    expect(isIsoCitySaveKey('isocity-tips-shown')).toBe(false);
  });
});

describe('migrateLegacySaves', () => {
  it('does nothing when there are no old saves', async () => {
    const store = createMemoryStore();
    const legacy = new MemoryStorage({ [ISOCITY_UI_PREFERENCES_STORAGE_KEY]: '{}' });
    const result = await migrateLegacySaves(store, legacy, isIsoCitySaveKey, silentLogger);
    expect(result.status).toBe('none');
    expect(store.data.size).toBe(0);
    expect(legacy.length).toBe(1);
  });

  it('copies saves byte-for-byte, then removes only the old save keys', async () => {
    const store = createMemoryStore();
    const legacy = legacyWithSaves();
    const result = await migrateLegacySaves(store, legacy, isIsoCitySaveKey, silentLogger);

    expect(result.status).toBe('migrated');
    expect(await store.get(ISOCITY_STORAGE_KEY)).toBe(oldAutosave);
    expect(await store.get(ISOCITY_SAVED_CITIES_INDEX_KEY)).toBe(oldIndex);
    expect(await store.get('isocity-city-abc')).toBe(oldCity);
    // The compressed payload still decodes to the same city.
    expect(decompressFromUTF16((await store.get(ISOCITY_STORAGE_KEY))!)).toBe(cityJson);

    // Old save keys gone, UI preferences kept in localStorage.
    expect(legacy.snapshot()).toEqual({
      [ISOCITY_UI_PREFERENCES_STORAGE_KEY]: '{"showMinimap":false}',
      'isocity-sprite-pack': 'default',
    });
    // UI preferences were not copied into the saves store.
    expect(await store.get(ISOCITY_UI_PREFERENCES_STORAGE_KEY)).toBeUndefined();
  });

  it('keeps the old keys when the copy fails', async () => {
    const inner = createMemoryStore();
    const legacy = legacyWithSaves();
    const before = legacy.snapshot();
    const result = await migrateLegacySaves(faultyStore(inner, { batch: true }), legacy, isIsoCitySaveKey, silentLogger);

    expect(result.status).toBe('failed');
    expect(legacy.snapshot()).toEqual(before);
    expect(inner.data.size).toBe(0);
  });

  it('keeps the old keys when the read-back does not match', async () => {
    const inner = createMemoryStore();
    const legacy = legacyWithSaves();
    const before = legacy.snapshot();
    const result = await migrateLegacySaves(faultyStore(inner, { corruptGet: true }), legacy, isIsoCitySaveKey, silentLogger);

    expect(result.status).toBe('failed');
    expect(legacy.snapshot()).toEqual(before);
  });

  it('succeeds on a retry after a failed attempt', async () => {
    const inner = createMemoryStore();
    const legacy = legacyWithSaves();
    await migrateLegacySaves(faultyStore(inner, { batch: true }), legacy, isIsoCitySaveKey, silentLogger);
    const result = await migrateLegacySaves(inner, legacy, isIsoCitySaveKey, silentLogger);

    expect(result.status).toBe('migrated');
    expect(await inner.get(ISOCITY_STORAGE_KEY)).toBe(oldAutosave);
    expect(legacy.getItem(ISOCITY_STORAGE_KEY)).toBeNull();
  });

  it('does not overwrite a newer save already in the store', async () => {
    const newer = compressToUTF16('{"newer":true}');
    const store = createMemoryStore({ [ISOCITY_STORAGE_KEY]: newer });
    const legacy = legacyWithSaves();
    const result = await migrateLegacySaves(store, legacy, isIsoCitySaveKey, silentLogger);

    expect(result.status).toBe('migrated');
    expect(await store.get(ISOCITY_STORAGE_KEY)).toBe(newer);
    expect(await store.get('isocity-city-abc')).toBe(oldCity);
    expect(legacy.getItem(ISOCITY_STORAGE_KEY)).toBeNull();
  });
});

describe('safeWrite', () => {
  it('writes the value and leaves no temporary key behind', async () => {
    const store = createMemoryStore({ [ISOCITY_STORAGE_KEY]: 'old' });
    await safeWrite(store, ISOCITY_STORAGE_KEY, 'new');
    expect(await store.get(ISOCITY_STORAGE_KEY)).toBe('new');
    expect(await store.keys()).toEqual([ISOCITY_STORAGE_KEY]);
    expect(await store.get(ISOCITY_STORAGE_KEY + SAVE_STORE_CONFIG.tempKeySuffix)).toBeUndefined();
  });

  it('keeps the last good save when the write fails', async () => {
    const inner = createMemoryStore({ [ISOCITY_STORAGE_KEY]: 'last-good' });
    await expect(safeWrite(faultyStore(inner, { batch: true }), ISOCITY_STORAGE_KEY, 'new')).rejects.toThrow();
    expect(await inner.get(ISOCITY_STORAGE_KEY)).toBe('last-good');
    expect(inner.data.size).toBe(1);
  });
});

describe('createSerialQueue', () => {
  it('runs jobs in order, one at a time, and survives a failing job', async () => {
    const queue = createSerialQueue();
    const log: string[] = [];
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const a = queue.run(async () => {
      log.push('a-start');
      await delay(10);
      log.push('a-end');
      return 'a';
    });
    const b = queue.run(async () => {
      log.push('b');
      throw new Error('b failed');
    });
    const c = queue.run(async () => {
      log.push('c');
      return 'c';
    });

    await expect(a).resolves.toBe('a');
    await expect(b).rejects.toThrow('b failed');
    await expect(c).resolves.toBe('c');
    await queue.idle();
    expect(log).toEqual(['a-start', 'a-end', 'b', 'c']);
  });
});
