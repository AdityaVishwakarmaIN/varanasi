import { describe, expect, it } from 'vitest';
import { GAME_LOOP_CONFIG, SimulationScheduler, TICK_INTERVAL_MS, getTickIntervalMs } from '@/lib/gameLoop';

/** A hand-driven clock and frame queue standing in for performance.now / requestAnimationFrame. */
function createFakeEnv() {
  let time = 0;
  let nextId = 1;
  const pending = new Map<number, () => void>();
  return {
    env: {
      now: () => time,
      requestFrame: (cb: () => void) => {
        const id = nextId++;
        pending.set(id, cb);
        return id;
      },
      cancelFrame: (id: number) => {
        pending.delete(id);
      },
    },
    advance(ms: number) {
      time += ms;
    },
    /** Advance time by `frameMs`, then run every pending frame callback once. */
    frame(frameMs: number) {
      time += frameMs;
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((cb) => cb());
    },
    frames(count: number, frameMs: number) {
      for (let i = 0; i < count; i++) this.frame(frameMs);
    },
    get pendingFrames() {
      return pending.size;
    },
  };
}

function setup(intervalMs: number, tickCostMs = 0) {
  const fake = createFakeEnv();
  let interval = intervalMs;
  let ticks = 0;
  const scheduler = new SimulationScheduler(
    () => {
      ticks++;
      fake.advance(tickCostMs);
    },
    () => interval,
    fake.env,
  );
  return {
    fake,
    scheduler,
    get ticks() {
      return ticks;
    },
    setInterval(ms: number) {
      interval = ms;
    },
  };
}

describe('getTickIntervalMs', () => {
  it('uses the named config and pauses at speed 0', () => {
    expect(getTickIntervalMs(1, false)).toBe(TICK_INTERVAL_MS.desktop[0]);
    expect(getTickIntervalMs(3, false)).toBe(200);
    expect(getTickIntervalMs(2, true)).toBe(450);
    expect(getTickIntervalMs(0, false)).toBe(Infinity);
  });
});

describe('SimulationScheduler', () => {
  it('runs one tick per interval at 60 fps (same rate as setInterval)', () => {
    for (const interval of TICK_INTERVAL_MS.desktop) {
      const t = setup(interval);
      t.scheduler.start();
      t.fake.frames(625, 16); // 10 seconds at ~60 fps
      expect(t.ticks).toBe(Math.floor(10000 / interval));
    }
  });

  it('keeps the tick rate when frames are slow but under the guards', () => {
    const t = setup(200);
    t.scheduler.start();
    t.fake.frames(100, 100); // 10 fps for 10 s
    expect(t.ticks).toBe(50);
  });

  it('runs at most 2 ticks per frame and drops the extra time', () => {
    const t = setup(100);
    t.scheduler.start();
    t.fake.frame(1000); // 10 ticks owed
    expect(t.ticks).toBe(GAME_LOOP_CONFIG.maxTicksPerFrame);
    t.fake.frame(16); // the extra time was dropped: nothing owed yet
    expect(t.ticks).toBe(2);
    t.fake.frames(5, 16); // 96 ms since the drop: still under one interval
    expect(t.ticks).toBe(2);
    t.fake.frame(16);
    expect(t.ticks).toBe(3);
  });

  it('skips the second tick in a frame after a slow tick', () => {
    const t = setup(100, GAME_LOOP_CONFIG.slowTickMs + 1);
    t.scheduler.start();
    t.fake.frame(250); // 2 ticks owed, but the first one is slow
    expect(t.ticks).toBe(1);
    t.fake.frame(1); // the owed tick runs in the next frame
    expect(t.ticks).toBe(2);
  });

  it('does not tick at speed 0 and does not owe time from it', () => {
    const t = setup(Infinity);
    t.scheduler.start();
    t.fake.frames(120, 16);
    expect(t.ticks).toBe(0);
    t.setInterval(200);
    t.fake.frames(12, 16); // 192 ms
    expect(t.ticks).toBe(0);
    t.fake.frame(16);
    expect(t.ticks).toBe(1);
  });

  it('system pause stops ticking and the paused time is never owed', () => {
    const t = setup(200);
    t.scheduler.start();
    t.fake.frames(50, 20); // 1 s
    expect(t.ticks).toBe(5);
    t.scheduler.setPaused(true);
    expect(t.fake.pendingFrames).toBe(0);
    t.fake.advance(30000); // tab hidden for 30 s
    t.fake.frames(10, 16); // no frames are scheduled while paused
    expect(t.ticks).toBe(5);
    t.scheduler.setPaused(false);
    t.fake.frame(16);
    expect(t.ticks).toBe(5); // no catch-up burst
    t.fake.frames(50, 20);
    expect(t.ticks).toBe(10);
  });

  it('stop() cancels the loop and start() can restart it', () => {
    const t = setup(100);
    t.scheduler.start();
    t.fake.frames(10, 16);
    t.scheduler.stop();
    expect(t.fake.pendingFrames).toBe(0);
    expect(t.scheduler.isRunning).toBe(false);
    t.fake.advance(5000);
    t.scheduler.start();
    t.fake.frame(16);
    expect(t.ticks).toBe(1);
  });
});
