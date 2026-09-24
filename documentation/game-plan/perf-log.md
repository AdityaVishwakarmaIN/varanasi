# Performance Log

Every performance measurement goes here, newest at the bottom. How to measure: see Sprint 1, tasks S1-T2 and S1-T3.

- **Device:** write the actual machine (for example "Laptop i5-1135G7, Iris Xe, Chrome 128") or "DevTools CPU 4× throttle".
- **Map:** `bench-120`, `bench-160`, or `varanasi-160-full` (from Sprint 2 on).
- **Renderer:** `canvas` or `gpu`.
- All times are in milliseconds.

| Date | Commit | Device | Map | Renderer | FPS | Frame p95 | Frame max | Tick p95 | Tick max | Save max | Notes |
|------|--------|--------|-----|----------|-----|-----------|-----------|----------|----------|----------|-------|
| 2026-09-24 | 243c14d (before S1-T5) | CI container (Node) | bench-160 | n/a (sim only) | – | – | – | 27.7–30.0 | 43–45 | – | S1-T5 baseline. `BENCH=1 npx vitest run src/lib/__tests__/simBench.test.ts` (200 ticks after 20 warm-up, seeded `Math.random`), load avg ~5 on 4 CPUs. p50 14.3. Top costs (CPU profile): GC 29–36% (every tick cloned all 160 rows = 51k objects), row cloning ~2 ms, `calculateServiceCoverage` ~1.4 ms, `calculateStats` ~0.8 ms, then `updateBudgetCosts`, `generateAdvisorMessages`, `calculateAverageCoverage`, pollution cleanup (~0.5 ms each). |
| 2026-09-24 | S1-T5 | CI container (Node) | bench-160 | n/a (sim only) | – | – | – | 17.6–21.8 | 67–153 | – | S1-T5 result, same-session A/B (old `simulateTick` from 243c14d vs new, each alone in its own Node process, same seeded city and random sequence, alternating runs; load avg 7–9 on 4 CPUs with other agents running browsers): **before p50 21.8–24.8 / p95 61–76 ms → after p50 5.8–6.6 / p95 17.6–21.8 ms** (~3.5× faster, identical results). Committed bench (vitest) at the same load: p50 6.9–7.3, p95 28–41. Under this load p95 is dominated by CPU contention and GC; scaling by the before-run ratio suggests p50 ≈ 4 ms / p95 ≈ 11–13 ms on a quiet 4-core box. |
| 2026-09-24 | 4de2a54 (S1-T7/T8) | CI container, 4 shared vCPU, headless Chromium, software GL (no GPU) | bench-160 | canvas | 14.7 | 166.7 | 583.3 | 32.7 | 104.1 | 10.1 | Quality Auto. Auto quality (starts High, drops by itself). Entities at end: 22 cars, 0 pedestrians (dropped to Low). |
| 2026-09-24 | 4de2a54 (S1-T7/T8) | CI container, 4 shared vCPU, headless Chromium, software GL (no GPU) | bench-160 | canvas | 9.4 | 233.4 | 716.7 | 29.4 | 105.6 | 7.3 | Quality High. Forced High: 221 pedestrians, 10 clouds. |
| 2026-09-24 | 4de2a54 (S1-T7/T8) | CI container, 4 shared vCPU, headless Chromium, software GL (no GPU) | bench-160 | canvas | 19.7 | 116.7 | 600 | 35.9 | 58.8 | 7.6 | Quality Low. Forced Low: ~2× the fps of High. |
| 2026-09-24 | 4de2a54 (S1-T7/T8) | CI container, 4 shared vCPU, headless Chromium, software GL (no GPU) | bench-120 | canvas | 17.8 | 116.7 | 483.4 | 20.3 | 137.4 | 6.4 | Quality Auto.  |
| 2026-09-24 | 4de2a54 (S1-T7/T8) | CI container, 4 shared vCPU, headless Chromium, software GL (no GPU) | bench-160 | gpu | 1.2 | 1100 | 1683.2 | 26.5 | 42.7 | 15.9 | Quality Auto. PixiJS on SwiftShader (software WebGL): not representative of a real GPU, but it is why `gpuByDefault` stays off until measured on real hardware. |
| 2026-09-24 | 4de2a54 (S1-T7/T8) | CI container, 4 shared vCPU, headless Chromium, software GL (no GPU) | bench-120 | canvas | 5.9 | 333.3 | 2649.9 | 65.4 | 86 | 14.9 | Quality Auto. Mobile sim: 390×844, touch, CPU 4× throttle. |
| 2026-09-24 | 4de2a54 (S1-T7/T8) | CI container, 4 shared vCPU, headless Chromium, software GL (no GPU) | bench-120 | canvas | 5.4 | 333.4 | 2150 | 57 | 95.1 | 20.1 | Quality Low. Mobile sim, forced Low: no better than Auto, so on a throttled CPU the cost is the simulation tick and base tile drawing, not effects. |

**S1-T5 result: tick p95 = ~18–22 ms (CI container under heavy load; est. ~11–13 ms quiet) → S1-T6 needed: yes** by the gate. S1-T6 was **not** implemented: its design sends the whole state to the worker and back every tick, and on the 160 benchmark state that costs the main thread more than the tick itself (`postMessage` ~31 ms to serialise + ~52 ms to deserialise, `structuredClone` ~80 ms, same conditions). See the S1-T5 notes in the Sprint 1 doc for the alternatives; owner to decide.


**S1-T7/T8 measurements (2026-09-24, fly-through on the production build):** this container has no GPU and four shared vCPUs, so the frame
numbers are far above the targets and are only good for **comparing** runs. What they show:
- Quality presets work: on bench-160, Low draws about twice as many frames as High (19.7 vs 9.4 fps), and Auto settles between them.
- The simulation tick (p95 20–36 ms at speed 3 on desktop) is now a large share of the frame on this machine, so a faster tick is the next
  lever for the frame targets (see S1-T6 notes).
- Earlier "bench-160" browser runs were **invalid**: since Sprint 2 the Varanasi map is also 160 tiles, and the fly-through started on the empty
  Varanasi map before the benchmark city loaded. That is fixed (4de2a54): the runner now waits for the benchmark city itself, and a
  real bug where a tick could overwrite a just-loaded city is fixed too.
- **The frame targets still need a run on real hardware** (a mid-range laptop and a real phone). That is the remaining step for S1-T13.
