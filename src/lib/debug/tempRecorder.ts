/**
 * TEMP-RECORDER: temporary, dev-only "flight recorder" for the game.
 *
 * What it is
 *   Records what the player did and what the game was doing, so a freeze ("This page isn't
 *   responding") or an error leaves a precise trail on disk. Every call is a no-op unless
 *   `process.env.NODE_ENV === 'development'` and a real browser window exists (never in SSR,
 *   never in tests, never in the render worker).
 *
 *   - `recordEvent(type, data)`  one timestamped, sequence-numbered event (cheap, never throws).
 *   - `markPhase(name, data)` / `endPhase(name)`  "the main thread is now inside X". The open
 *     phase stack is sent with every flush and with every hang record, so a hang is attributed
 *     to the last phase entered and not exited.
 *   - also exposed as `window.__tempRecorder` (call it from the console or other code).
 *
 *   Events are posted at once to a dedicated Web Worker (built from a Blob URL, no bundler
 *   config). The worker owns the buffer and POSTs batches every ~2 s to `/api/temp-recorder`,
 *   which appends them to `debug-logs/session-<sessionId>.jsonl` at the repo root. The main
 *   thread posts a heartbeat every 500 ms; if none arrives for 3 s (while the tab is visible)
 *   the worker writes HANG_DETECTED (stall length, open phases, last 200 events, recent phase
 *   transitions), then STILL_HUNG every 10 s, then HANG_RECOVERED when heartbeats resume.
 *
 * How to read the log
 *   One JSON object per line. `src` is "m" (main thread) or "w" (worker); `seq` is per source;
 *   `t` is main-thread performance.now() in ms; `iso` is the wall clock. Useful filters:
 *     grep -n '"type":"HANG_\|"type":"STILL_HUNG\|"type":"error\|"type":"rejection' debug-logs/session-<id>.jsonl
 *   Read the lines just before the first HANG_DETECTED; its `data.openPhases` names the code
 *   that was running. `FLUSH` lines (one per batch) carry the open phase stack at that moment.
 *   The session id is shown bottom-left in the game ("REC ..."), with a "Copy log path" button.
 *
 * How to remove it
 *   1. grep -rn TEMP-RECORDER src   (remove every marked block / call site / import it lists)
 *   2. delete src/lib/debug/tempRecorder.ts, src/components/debug/TempRecorder.tsx,
 *      src/app/api/temp-recorder/route.ts, and the debug-logs/ folder
 *   3. drop the `debug-logs/` line (TEMP-RECORDER) from .gitignore
 */

type Data = Record<string, unknown>;

export interface TempRecorderApi {
  sessionId: string;
  logPath: string;
  recordEvent: (type: string, data?: Data) => void;
  markPhase: (name: string, data?: Data) => void;
  /** `silent`: do not write the automatic `phase:slow` record (the caller records its own). */
  endPhase: (name: string, opts?: { silent?: boolean }) => void;
  flush: () => void;
}

declare global {
  interface Window {
    __tempRecorder?: TempRecorderApi;
  }
}

const ENDPOINT = '/api/temp-recorder';
const HEARTBEAT_MS = 500;
const MAX_STRING = 400;
const MAX_KEYS = 24;
const MAX_ARRAY = 16;
const MAX_DEPTH = 3;
const SLOW_PHASE_MS = 50;

function isEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Worker !== 'undefined'
  );
}

// ---------------------------------------------------------------------------------------------
// Worker source (plain ES2019 string, no template literals inside so it survives as-is).
// ---------------------------------------------------------------------------------------------
const WORKER_SOURCE = [
  'var sessionId = "unknown";',
  'var endpoint = "/api/temp-recorder";',
  'var buffer = [];',          // pending records to POST
  'var BUFFER_CAP = 5000;',
  'var dropped = 0;',
  'var recent = [];',          // ring of last 200 main-thread events (for hang records)
  'var RECENT_CAP = 200;',
  'var phases = [];',          // open phase stack
  'var phaseLog = [];',        // ring of recent phase transitions
  'var PHASE_LOG_CAP = 100;',
  'var wseq = 0;',
  'var lastHb = Date.now();',
  'var lastHbT = 0;',
  'var hidden = false;',
  'var hung = false;',
  'var hangStart = 0;',
  'var lastStill = 0;',
  'var inFlight = false;',
  'function iso(ms) { try { return new Date(ms).toISOString(); } catch (e) { return null; } }',
  'function push(rec) {',
  '  buffer.push(rec);',
  '  if (buffer.length > BUFFER_CAP) { var n = buffer.length - BUFFER_CAP; buffer.splice(0, n); dropped += n; }',
  '}',
  'function workerRecord(type, data) {',
  '  var now = Date.now();',
  '  push({ src: "w", seq: ++wseq, t: null, iso: iso(now), type: type, data: data || {} });',
  '}',
  'function openPhases(now) {',
  '  return phases.map(function (p) { return { name: p.name, forMs: now - p.wall, data: p.data }; });',
  '}',
  'var MAX_BODY = 900000;',
  'function encode(batch) {',
  '  try { return JSON.stringify({ sessionId: sessionId, records: batch }); } catch (e) { return null; }',
  '}',
  'function flush() {',
  '  if (inFlight || buffer.length === 0) return;',
  '  var now = Date.now();',
  '  var take = Math.min(buffer.length, 1500);',
  '  var batch, body;',
  '  for (;;) {',
  '    batch = buffer.slice(0, take);',
  '    body = encode(batch);',
  '    if (body !== null && body.length <= MAX_BODY) break;',
  '    if (take > 1) { take = Math.ceil(take / 2); continue; }',
  '    // one record too large (or not serialisable): keep only its header',
  '    var r0 = buffer[0];',
  '    batch = [{ src: r0.src, seq: r0.seq, t: r0.t, iso: r0.iso, type: r0.type, data: { truncated: true } }];',
  '    body = encode(batch);',
  '    break;',
  '  }',
  '  buffer.splice(0, take);',
  '  batch.push({ src: "w", seq: ++wseq, t: null, iso: iso(now), type: "FLUSH", data: { count: batch.length, dropped: dropped, pending: buffer.length, openPhases: openPhases(now), msSinceHeartbeat: now - lastHb, hidden: hidden } });',
  '  dropped = 0;',
  '  body = encode(batch);',
  '  if (body === null) return;',
  '  inFlight = true;',
  '  fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: body, keepalive: body.length < 60000 })',
  '    .then(function (r) {',
  '      // 4xx will never succeed (bad request / route disabled): drop. 5xx: retry later.',
  '      if (r.status >= 500) throw new Error("HTTP " + r.status);',
  '    })',
  '    .catch(function () {',
  '      // network error or dev-server restart: put the batch back (minus its FLUSH line)',
  '      batch.pop();',
  '      buffer = batch.concat(buffer);',
  '      if (buffer.length > BUFFER_CAP) { var n = buffer.length - BUFFER_CAP; buffer.splice(0, n); dropped += n; }',
  '    })',
  '    .then(function () { inFlight = false; });',
  '}',
  'function check() {',
  '  var now = Date.now();',
  '  if (hidden) return;',
  '  var since = now - lastHb;',
  '  if (!hung && since > 3000) {',
  '    hung = true; hangStart = lastHb; lastStill = now;',
  '    workerRecord("HANG_DETECTED", { msSinceHeartbeat: since, lastHeartbeatT: lastHbT, openPhases: openPhases(now), recentPhaseTransitions: phaseLog.slice(), lastEvents: recent.slice() });',
  '    flush();',
  '  } else if (hung && now - lastStill >= 10000) {',
  '    lastStill = now;',
  '    workerRecord("STILL_HUNG", { msSinceHeartbeat: since, openPhases: openPhases(now) });',
  '    flush();',
  '  }',
  '}',
  'self.onmessage = function (ev) {',
  '  var m = ev.data; if (!m) return;',
  '  var now = Date.now();',
  '  switch (m.k) {',
  '    case "init": sessionId = m.sessionId; endpoint = m.endpoint; lastHb = now; break;',
  '    case "e":',
  '      m.ev.iso = iso(m.ev.wall); delete m.ev.wall;',
  '      push(m.ev);',
  '      recent.push(m.ev); if (recent.length > RECENT_CAP) recent.shift();',
  '      break;',
  '    case "pp":',
  '      phases.push({ name: m.name, wall: m.wall, data: m.data });',
  '      phaseLog.push({ op: "start", name: m.name, t: m.t }); if (phaseLog.length > PHASE_LOG_CAP) phaseLog.shift();',
  '      break;',
  '    case "pe":',
  '      for (var i = phases.length - 1; i >= 0; i--) { if (phases[i].name === m.name) { phases.length = i; break; } }',
  '      phaseLog.push({ op: "end", name: m.name, t: m.t }); if (phaseLog.length > PHASE_LOG_CAP) phaseLog.shift();',
  '      break;',
  '    case "hb":',
  '      if (hung) { hung = false; workerRecord("HANG_RECOVERED", { stallMs: now - hangStart, openPhasesAtRecovery: openPhases(now) }); flush(); }',
  '      lastHb = now; lastHbT = m.t;',
  '      break;',
  '    case "vis":',
  '      hidden = !!m.hidden; lastHb = now;',
  '      if (hidden) flush();',
  '      break;',
  '    case "flush": flush(); break;',
  '  }',
  '};',
  'setInterval(check, 500);',
  'setInterval(flush, 2000);',
].join('\n');

// ---------------------------------------------------------------------------------------------
// Value capping: makes any value small and structured-cloneable, without walking big objects.
// ---------------------------------------------------------------------------------------------
function cap(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'string') {
    const s = value as string;
    return s.length > MAX_STRING ? s.slice(0, MAX_STRING) + '...(' + s.length + ')' : s;
  }
  if (t === 'bigint' || t === 'symbol') return String(value);
  if (t === 'function') return '[fn ' + ((value as { name?: string }).name || 'anonymous') + ']';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: cap(value.message, MAX_DEPTH),
      stack: typeof value.stack === 'string' ? value.stack.slice(0, 1500) : undefined,
    };
  }
  if (typeof Element !== 'undefined' && value instanceof Element) return describeTarget(value);
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? '[array ' + value.length + ']' : '[object]';
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    const n = Math.min(value.length, MAX_ARRAY);
    for (let i = 0; i < n; i++) out.push(cap(value[i], depth + 1));
    if (value.length > MAX_ARRAY) out.push('...(' + value.length + ' items)');
    return out;
  }
  if (t === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      const name = (proto && proto.constructor && proto.constructor.name) || 'object';
      if (name === 'Map' || name === 'Set') return '[' + name + ' size ' + (value as Map<unknown, unknown>).size + ']';
      // Class instances (DOM, Pixi, typed arrays...) are never walked.
      return '[' + name + ']';
    }
    const out: Data = {};
    let n = 0;
    for (const key in value as Data) {
      if (n++ >= MAX_KEYS) {
        out['...'] = 'more keys';
        break;
      }
      out[key] = cap((value as Data)[key], depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Short description of a DOM node: tag#id.class [testid] "label or text". */
export function describeTarget(target: EventTarget | null): string {
  try {
    if (!target || typeof Element === 'undefined' || !(target instanceof Element)) {
      return target === window ? 'window' : target === document ? 'document' : String(target);
    }
    const el = (target.closest('button,a,[role="button"],[role="menuitem"],[role="tab"],label,[data-testid]') ?? target) as Element;
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id.slice(0, 40);
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    if (cls) s += '.' + cls.slice(0, 50);
    const testId = el.getAttribute('data-testid');
    if (testId) s += ' [testid=' + testId.slice(0, 40) + ']';
    const label = el.getAttribute('aria-label') || el.getAttribute('title');
    if (label) s += ' "' + label.slice(0, 50) + '"';
    else if (el.childElementCount < 8) {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (text) s += ' "' + text.slice(0, 50) + '"';
    }
    if (el !== target) s += ' > ' + target.tagName.toLowerCase();
    return s;
  } catch {
    return '?';
  }
}

// ---------------------------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------------------------
function makeSessionId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  return (
    d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '-' + rand
  );
}

function createRecorder(): TempRecorderApi | null {
  let worker: Worker;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url, { name: 'temp-recorder' });
  } catch {
    return null;
  }
  const sessionId = makeSessionId();
  let seq = 0;
  const phaseStarts: { name: string; t: number }[] = [];

  const post = (msg: unknown) => {
    try {
      worker.postMessage(msg);
    } catch {
      // never throw into game code
    }
  };

  const recordEvent = (type: string, data?: Data) => {
    try {
      post({
        k: 'e',
        ev: { src: 'm', seq: ++seq, t: Math.round(performance.now() * 10) / 10, wall: Date.now(), type, data: data ? cap(data, 0) : {} },
      });
    } catch {
      // never throw into game code
    }
  };

  const markPhase = (name: string, data?: Data) => {
    try {
      const t = performance.now();
      phaseStarts.push({ name, t });
      if (phaseStarts.length > 64) phaseStarts.shift();
      post({ k: 'pp', name, t: Math.round(t), wall: Date.now(), data: data ? cap(data, 1) : undefined });
    } catch {
      // never throw into game code
    }
  };

  const endPhase = (name: string, opts?: { silent?: boolean }) => {
    try {
      const t = performance.now();
      for (let i = phaseStarts.length - 1; i >= 0; i--) {
        if (phaseStarts[i].name === name) {
          const ms = t - phaseStarts[i].t;
          phaseStarts.length = i;
          if (ms > SLOW_PHASE_MS && !opts?.silent) recordEvent('phase:slow', { name, ms: Math.round(ms) });
          break;
        }
      }
      post({ k: 'pe', name, t: Math.round(t) });
    } catch {
      // never throw into game code
    }
  };

  worker.onerror = (e) => {
    try {
      console.warn('[temp-recorder] worker error:', e.message);
    } catch {
      // ignore
    }
  };
  // Absolute URL: inside a Blob-URL worker a relative URL would resolve against `blob:` and fail.
  post({ k: 'init', sessionId, endpoint: location.origin + ENDPOINT });
  setInterval(() => post({ k: 'hb', t: Math.round(performance.now()) }), HEARTBEAT_MS);
  const onVisibility = () => post({ k: 'vis', hidden: document.hidden });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => post({ k: 'flush' }));
  onVisibility();

  return {
    sessionId,
    logPath: 'debug-logs/session-' + sessionId + '.jsonl',
    recordEvent,
    markPhase,
    endPhase,
    flush: () => post({ k: 'flush' }),
  };
}

let instance: TempRecorderApi | null | undefined;

/** The recorder, created on first use (survives HMR through window.__tempRecorder). Null when disabled. */
export function getTempRecorder(): TempRecorderApi | null {
  if (instance !== undefined) return instance;
  if (!isEnabled()) {
    // Not cached when there is no window yet (module evaluated during SSR).
    return null;
  }
  try {
    instance = window.__tempRecorder ?? createRecorder();
    if (instance) window.__tempRecorder = instance;
  } catch {
    instance = null;
  }
  return instance;
}

export function recordEvent(type: string, data?: Data): void {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    getTempRecorder()?.recordEvent(type, data);
  } catch {
    // never throw into game code
  }
}

export function markPhase(name: string, data?: Data): void {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    getTempRecorder()?.markPhase(name, data);
  } catch {
    // never throw into game code
  }
}

export function endPhase(name: string, opts?: { silent?: boolean }): void {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    getTempRecorder()?.endPhase(name, opts);
  } catch {
    // never throw into game code
  }
}

// ---------------------------------------------------------------------------------------------
// Automatic capture (installed once by src/components/debug/TempRecorder.tsx)
// ---------------------------------------------------------------------------------------------
let captureInstalled = false;

function formatConsoleArgs(args: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < Math.min(args.length, 6); i++) out.push(cap(args[i], 1));
  return out;
}

function probeWebglRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return renderer;
  } catch {
    return null;
  }
}

function canvasSnapshot(): { count: number; canvases: Data[] } {
  const list = document.getElementsByTagName('canvas');
  const canvases: Data[] = [];
  for (let i = 0; i < Math.min(list.length, 12); i++) {
    const c = list[i];
    canvases.push({
      id: c.id || undefined,
      cls: typeof c.className === 'string' && c.className ? c.className.slice(0, 40) : undefined,
      w: c.width,
      h: c.height,
      cw: c.clientWidth,
      ch: c.clientHeight,
    });
  }
  return { count: list.length, canvases };
}

/** Installs the global listeners; returns an uninstall function. Safe to call more than once. */
export function installTempRecorderCapture(): () => void {
  if (process.env.NODE_ENV !== 'development') return () => {};
  const rec = getTempRecorder();
  if (!rec || captureInstalled) return () => {};
  captureInstalled = true;
  const cleanups: (() => void)[] = [];
  const on = (
    target: Window | Document,
    type: string,
    handler: (e: Event) => void,
    options: AddEventListenerOptions = { capture: true, passive: true },
  ) => {
    const wrapped = (e: Event) => {
      try {
        handler(e);
      } catch {
        // never throw into game code
      }
    };
    target.addEventListener(type, wrapped, options);
    cleanups.push(() => target.removeEventListener(type, wrapped, options));
  };
  const r = rec.recordEvent;

  try {
    // --- environment, once ------------------------------------------------------------------
    r('env', {
      userAgent: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
      gpuRendererEnv: process.env.NEXT_PUBLIC_GPU_RENDERER ?? null,
      url: location.pathname + location.search,
      webglRenderer: probeWebglRenderer(),
      canvases: document.getElementsByTagName('canvas').length,
      hardwareConcurrency: navigator.hardwareConcurrency,
    });

    // --- user input -------------------------------------------------------------------------
    const pointer = (e: Event) => {
      const p = e as PointerEvent;
      r(p.type, { button: p.button, buttons: p.buttons, x: Math.round(p.clientX), y: Math.round(p.clientY), pointerType: p.pointerType, target: describeTarget(p.target) });
    };
    on(window, 'pointerdown', pointer);
    on(window, 'pointerup', pointer);
    on(window, 'pointercancel', pointer);

    let lastMove = 0;
    on(window, 'pointermove', (e) => {
      const now = performance.now();
      if (now - lastMove < 250) return;
      lastMove = now;
      const p = e as PointerEvent;
      r('pointermove', { x: Math.round(p.clientX), y: Math.round(p.clientY), buttons: p.buttons, pointerType: p.pointerType });
    });

    let lastWheel = 0;
    let wheelSum = 0;
    let wheelCount = 0;
    on(window, 'wheel', (e) => {
      const w = e as WheelEvent;
      wheelSum += w.deltaY;
      wheelCount++;
      const now = performance.now();
      if (now - lastWheel < 250) return;
      lastWheel = now;
      r('wheel', { deltaY: Math.round(w.deltaY), sumDeltaY: Math.round(wheelSum), events: wheelCount, ctrlKey: w.ctrlKey, x: Math.round(w.clientX), y: Math.round(w.clientY) });
      wheelSum = 0;
      wheelCount = 0;
    });

    let lastRepeat = 0;
    on(window, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      const t = k.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (k.repeat) {
        const now = performance.now();
        if (now - lastRepeat < 250) return;
        lastRepeat = now;
      }
      r('keydown', { key: k.key.length > 20 ? k.key.slice(0, 20) : k.key, ctrl: k.ctrlKey, shift: k.shiftKey, alt: k.altKey, meta: k.metaKey, repeat: k.repeat });
    });

    const touch = (e: Event) => {
      const te = e as TouchEvent;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < Math.min(te.changedTouches.length, 3); i++) {
        pts.push({ x: Math.round(te.changedTouches[i].clientX), y: Math.round(te.changedTouches[i].clientY) });
      }
      r(te.type, { touches: te.touches.length, changed: pts, target: describeTarget(te.target) });
    };
    on(window, 'touchstart', touch);
    on(window, 'touchend', touch);
    on(window, 'touchcancel', touch);

    let lastResize = 0;
    on(window, 'resize', () => {
      const now = performance.now();
      if (now - lastResize < 250) return;
      lastResize = now;
      r('resize', { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio });
    }, { passive: true });

    on(document, 'visibilitychange', () => r('visibilitychange', { hidden: document.hidden }), { passive: true });

    // devicePixelRatio changes (browser zoom, moving to another monitor)
    let dprQuery: MediaQueryList | null = null;
    const onDpr = () => {
      r('dprchange', { devicePixelRatio: window.devicePixelRatio });
      armDpr();
    };
    const armDpr = () => {
      try {
        dprQuery?.removeEventListener('change', onDpr);
        dprQuery = window.matchMedia('(resolution: ' + window.devicePixelRatio + 'dppx)');
        dprQuery.addEventListener('change', onDpr);
      } catch {
        // ignore
      }
    };
    armDpr();
    cleanups.push(() => dprQuery?.removeEventListener('change', onDpr));

    // --- failures ---------------------------------------------------------------------------
    on(window, 'error', (e) => {
      const ev = e as ErrorEvent;
      if (ev.error === undefined && ev.message === undefined) {
        // resource load error (img/script) in the capture phase
        r('resource-error', { target: describeTarget(ev.target) });
        return;
      }
      r('error', { message: ev.message, source: ev.filename, line: ev.lineno, col: ev.colno, error: ev.error });
      rec.flush();
    });
    on(window, 'unhandledrejection', (e) => {
      r('rejection', { reason: (e as PromiseRejectionEvent).reason });
      rec.flush();
    });
    on(document, 'webglcontextlost', (e) => {
      r('webglcontextlost', { target: describeTarget(e.target), canvases: canvasSnapshot() });
      rec.flush();
    });
    on(document, 'webglcontextrestored', (e) => r('webglcontextrestored', { target: describeTarget(e.target) }));

    const origError = console.error;
    const origWarn = console.warn;
    let inConsole = false;
    const wrapConsole = (level: 'error' | 'warn', orig: (...a: unknown[]) => void) =>
      function tempRecorderConsole(this: unknown, ...args: unknown[]) {
        if (!inConsole) {
          inConsole = true;
          try {
            r('console.' + level, { args: formatConsoleArgs(args) });
          } catch {
            // ignore
          }
          inConsole = false;
        }
        return orig.apply(this, args);
      };
    console.error = wrapConsole('error', origError);
    console.warn = wrapConsole('warn', origWarn);
    cleanups.push(() => {
      console.error = origError;
      console.warn = origWarn;
    });

    // Long tasks and long animation frames
    const supported: readonly string[] = typeof PerformanceObserver !== 'undefined' ? PerformanceObserver.supportedEntryTypes ?? [] : [];
    const rate = { lt: 0, ltSkipped: 0, loaf: 0, loafSkipped: 0, windowStart: 0 };
    const allow = (kind: 'lt' | 'loaf'): number | false => {
      const now = performance.now();
      if (now - rate.windowStart > 1000) {
        rate.windowStart = now;
        rate.lt = 0;
        rate.loaf = 0;
      }
      if (rate[kind] >= 5) {
        if (kind === 'lt') rate.ltSkipped++;
        else rate.loafSkipped++;
        return false;
      }
      rate[kind]++;
      const skipped = kind === 'lt' ? rate.ltSkipped : rate.loafSkipped;
      if (kind === 'lt') rate.ltSkipped = 0;
      else rate.loafSkipped = 0;
      return skipped;
    };
    if (supported.includes('longtask')) {
      const po = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            const skipped = allow('lt');
            if (skipped === false) continue;
            const attribution = (entry as PerformanceEntry & { attribution?: { containerType?: string; containerName?: string; containerSrc?: string }[] }).attribution;
            r('longtask', {
              start: Math.round(entry.startTime),
              ms: Math.round(entry.duration),
              attribution: attribution?.slice(0, 2).map((a) => ({ type: a.containerType, name: a.containerName, src: a.containerSrc })),
              skippedBefore: skipped || undefined,
            });
          }
        } catch {
          // ignore
        }
      });
      po.observe({ type: 'longtask' });
      cleanups.push(() => po.disconnect());
    }
    if (supported.includes('long-animation-frame')) {
      type LoafScript = { sourceURL?: string; sourceFunctionName?: string; invoker?: string; invokerType?: string; duration: number; forcedStyleAndLayoutDuration?: number };
      const po = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            if (entry.duration < 100) continue;
            const skipped = allow('loaf');
            if (skipped === false) continue;
            const e = entry as PerformanceEntry & { blockingDuration?: number; renderStart?: number; styleAndLayoutStart?: number; scripts?: LoafScript[] };
            // Idle frames of a throttled (occluded / background) window: nothing blocked, no script ran long.
            if (e.blockingDuration === 0 && !(e.scripts ?? []).some((s) => s.duration >= 50)) continue;
            const scripts = (e.scripts ?? [])
              .slice()
              .sort((a, b) => b.duration - a.duration)
              .slice(0, 5)
              .map((s) => ({
                sourceURL: s.sourceURL ? s.sourceURL.slice(-120) : undefined,
                fn: s.sourceFunctionName,
                invoker: s.invoker ? s.invoker.slice(0, 80) : undefined,
                invokerType: s.invokerType,
                ms: Math.round(s.duration),
                forcedLayoutMs: s.forcedStyleAndLayoutDuration ? Math.round(s.forcedStyleAndLayoutDuration) : undefined,
              }));
            r('long-animation-frame', {
              start: Math.round(e.startTime),
              ms: Math.round(e.duration),
              blockingMs: e.blockingDuration !== undefined ? Math.round(e.blockingDuration) : undefined,
              renderMs: e.renderStart ? Math.round(e.startTime + e.duration - e.renderStart) : undefined,
              scripts,
              skippedBefore: skipped || undefined,
            });
          }
        } catch {
          // ignore
        }
      });
      po.observe({ type: 'long-animation-frame' });
      cleanups.push(() => po.disconnect());
    }

    // requestAnimationFrame gap monitor
    let rafId = 0;
    let lastFrame = performance.now();
    let wasHidden = document.hidden;
    // An occluded window is throttled to ~1 fps: those ~1000 ms gaps are summarised every 10 s instead.
    let throttledFrames = 0;
    let lastThrottledReport = 0;
    const frame = (now: number) => {
      try {
        const gap = now - lastFrame;
        if (gap > 250 && !document.hidden && !wasHidden) {
          if (gap > 950 && gap < 1050) {
            throttledFrames++;
            if (now - lastThrottledReport > 10000) {
              r('raf-throttled', { frames: throttledFrames, lastGapMs: Math.round(gap) });
              throttledFrames = 0;
              lastThrottledReport = now;
            }
          } else {
            r('raf-gap', { ms: Math.round(gap) });
          }
        }
        lastFrame = now;
        wasHidden = document.hidden;
      } catch {
        // ignore
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    cleanups.push(() => cancelAnimationFrame(rafId));

    // --- periodic snapshot ------------------------------------------------------------------
    const snapshot = () => {
      try {
        const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        const mb = (n: number) => Math.round(n / 1048576);
        r('snapshot', {
          ...canvasSnapshot(),
          heapMB: mem ? { used: mb(mem.usedJSHeapSize), total: mb(mem.totalJSHeapSize), limit: mb(mem.jsHeapSizeLimit) } : undefined,
          dpr: window.devicePixelRatio,
          hidden: document.hidden,
        });
      } catch {
        // ignore
      }
    };
    const snapId = window.setInterval(snapshot, 5000);
    cleanups.push(() => window.clearInterval(snapId));
  } catch {
    // never throw into game code
  }

  return () => {
    for (const c of cleanups) {
      try {
        c();
      } catch {
        // ignore
      }
    }
    captureInstalled = false;
  };
}

/** Console / other code access: window.__tempRecorder (set on first use). */
if (isEnabled()) {
  try {
    getTempRecorder();
  } catch {
    // ignore
  }
}
