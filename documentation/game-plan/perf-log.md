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

**S1-T5 result: tick p95 = ~18–22 ms (CI container under heavy load; est. ~11–13 ms quiet) → S1-T6 needed: yes** by the gate. S1-T6 was **not** implemented: its design sends the whole state to the worker and back every tick, and on the 160 benchmark state that costs the main thread more than the tick itself (`postMessage` ~31 ms to serialise + ~52 ms to deserialise, `structuredClone` ~80 ms, same conditions). See the S1-T5 notes in the Sprint 1 doc for the alternatives; owner to decide.
