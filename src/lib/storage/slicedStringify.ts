// Time-sliced JSON serialization (S1-T9).
//
// JSON.stringify of a 160x160 city (~8 MB of JSON) blocks the main thread for
// 50-80 ms, which is a visible hitch. This produces exactly the same text as
// JSON.stringify(value), but in slices: whenever a slice has used up its time
// budget, the text so far is handed to `onChunk` and we yield to the event
// loop so input and drawing can run.
//
// Big arrays of objects (the tile grid, the service grids) are walked element
// by element; everything else is serialized with plain JSON.stringify. The
// value must not be mutated while this runs (game state is replaced, not
// mutated, so a captured state object stays consistent).

export const SLICED_STRINGIFY_CONFIG = {
  /** Max main-thread time per slice before yielding (ms). */
  sliceBudgetMs: 6,
  /**
   * Hand text to `onChunk` once this many characters have piled up, even
   * mid-slice. Joining + encoding a chunk costs time too (~1.5 MB took
   * 8-15 ms), so small chunks keep that cost inside the slice budget.
   */
  maxChunkChars: 256 * 1024,
  /** Arrays shorter than this are serialized in one go. */
  minArrayLengthToSplit: 8,
  /** Plain objects are split key by key only this deep (root = 0). */
  maxObjectSplitDepth: 1,
} as const;

export interface SlicedStringifyOptions {
  sliceBudgetMs?: number;
  /** Receives each finished slice of JSON text, in order. */
  onChunk: (text: string) => void;
  /** Called between slices; defaults to a macrotask yield. */
  yieldFn?: () => Promise<void>;
  /** Receives how long each slice blocked the thread (ms), e.g. for a perf HUD. */
  onSlice?: (ms: number) => void;
  now?: () => number;
}

const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasToJSON(value: object): boolean {
  return typeof (value as { toJSON?: unknown }).toJSON === 'function';
}

/** Serialize `value` like JSON.stringify, in time-budgeted slices. */
export async function stringifyInSlices(value: unknown, options: SlicedStringifyOptions): Promise<void> {
  const budget = options.sliceBudgetMs ?? SLICED_STRINGIFY_CONFIG.sliceBudgetMs;
  const yieldFn = options.yieldFn ?? defaultYield;
  const now = options.now ?? (() => performance.now());

  let parts: string[] = [];
  let pendingChars = 0;
  let sliceStart = now();

  const flush = () => {
    if (parts.length > 0) {
      options.onChunk(parts.join(''));
      parts = [];
      pendingChars = 0;
    }
  };

  const maybeYield = async () => {
    if (pendingChars >= SLICED_STRINGIFY_CONFIG.maxChunkChars) flush();
    if (now() - sliceStart >= budget) {
      flush();
      options.onSlice?.(now() - sliceStart);
      await yieldFn();
      sliceStart = now();
    }
  };

  // Returns false if the value serializes to nothing (undefined, function, symbol).
  const write = async (v: unknown, depth: number): Promise<boolean> => {
    if (Array.isArray(v) && !hasToJSON(v) && v.length >= SLICED_STRINGIFY_CONFIG.minArrayLengthToSplit) {
      const first = v[0];
      if (first !== null && typeof first === 'object') {
        parts.push('[');
        for (let i = 0; i < v.length; i++) {
          if (i > 0) parts.push(',');
          if (!(await write(v[i], depth + 1))) parts.push('null');
          await maybeYield();
        }
        parts.push(']');
        return true;
      }
    }

    if (isPlainObject(v) && !hasToJSON(v) && depth <= SLICED_STRINGIFY_CONFIG.maxObjectSplitDepth) {
      parts.push('{');
      let firstKey = true;
      for (const key of Object.keys(v)) {
        const child = v[key];
        // JSON.stringify drops these keys from objects
        if (child === undefined || typeof child === 'function' || typeof child === 'symbol') continue;
        parts.push(firstKey ? '' : ',', JSON.stringify(key), ':');
        firstKey = false;
        await write(child, depth + 1);
        await maybeYield();
      }
      parts.push('}');
      return true;
    }

    const text = JSON.stringify(v);
    if (text === undefined) return false;
    parts.push(text);
    pendingChars += text.length;
    return true;
  };

  if (!(await write(value, 0))) {
    throw new TypeError('Value cannot be serialized to JSON');
  }
  flush();
  options.onSlice?.(now() - sliceStart);
}
