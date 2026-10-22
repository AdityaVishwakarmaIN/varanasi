---
name: ganga-river-economy
description: Use when a change reads or affects Ganga Health, river pollution, sewage treatment, riverfront tourism or ghat income - the input-target-step chain, STP rules, tourism and visitor pool, consumers of river health, and how to tune it.
---

# Ganga River Economy

Ganga Health (0-100) is the single river stat (pillar P2). It is a slow stock: each day it moves a fraction of the way toward a target computed from pollution loads near the river. Tourism, water works, happiness, health coverage, landmark income and the river's colour all read it. Extend this chain; never add a second river-health number.

## Read first
- skills/varanasi-world-model (units: sim people vs displayed)
- `SCORING_CONFIG.ganga` and the Ganga functions in `src/lib/scoring.ts`
- `src/lib/ganga.ts`, `src/lib/tourism.ts`

## The chain
1. Inputs: `gatherGangaInputs(grid, gridSize, stps)` (`ganga.ts`) walks the catchment (`getGangaCatchment(gridSize, radius)` in `riverZones.ts`) and returns industrial pollution, untreated people and riverside green tiles. STPs come from `findStps`.
2. Target: `calculateGangaTargetHealth(input)` (`scoring.ts`) returns `industrialLoad`, `sewageLoad`, `upstreamLoad`, `greenCredit`, `netLoad`, `targetHealth`, where `netLoad = max(0, industrial + sewage + upstream - green)` and `targetHealth = 100 * (1 - min(1, netLoad / riverCapacity))`.
3. Step: `stepGangaHealth(current, target, approachMultiplier)` moves by `dailyApproach` per day. The multiplier is `getGangaRecoveryMultiplier(season, riverLevel, current, target)` in `src/lib/seasons.ts`: `SEASON_CONFIG[season].gangaRecovery` (2 in monsoon) only while rising and not in flood, else 1.
4. Trend: `getGangaTrend(current, target)` (dead band `trendThreshold`), arrow `GANGA_TREND_ARROW`; level bands `getGangaHealthLevel`.
5. Explanation: `describeGangaCauses`, `describeGangaTileEffect`, tile effects `computeGangaTileEffects` / `getCachedGangaTileEffects` (`ganga.ts`). UI rules live in skills/surface-to-player.

## SCORING_CONFIG.ganga (current values)
| Key | Value | Meaning |
|---|---|---|
| `catchmentRadius` | 8 | land tiles this close drain to the river |
| `bankDistance` / `catchmentEdgeWeight` | 2 / 0.25 | full weight on the bank, falling linearly to 0.25 at the edge (`getGangaPollutionWeight`) |
| `industryWeight` | 0.12 | load per point of tile pollution |
| `sewagePerPerson` | 0.005 | load per untreated sim person (10,000 sim = 50 load) |
| `upstreamLoad` | 30 | load arriving from upstream |
| `riversideGreenCredit` | 0.75 | load removed per riverside tree/park tile (`GANGA_GREEN_TYPES`) |
| `riverCapacity` | 120 | net load at which target is 0 |
| `dailyApproach` | 0.05 | daily fraction toward target |
| `stpCapacity` / `stpRadius` | 5000 sim people / 14 tiles | per working STP |
| `lowHealthThreshold` / `lowHealthCoveragePenalty` | 40 / 20 | health-coverage hit for catchment residents (`getGangaHealthCoveragePenalty`) |
| `happinessWeight` | 0.05 | share in the Happiness composite (Varanasi only) |

## STPs
- `isWorkingStp`: `sewage_treatment_plant`, powered, not abandoned, `constructionProgress >= 100`. An unpowered or unfinished STP treats nobody.
- Each treats up to `stpCapacity` sim people within `stpRadius`. Placement rule lives in skills/add-building.

## Tourism (`src/lib/tourism.ts`, `TOURISM_CONFIG`)
- Per ghat: `calculateGhatIncome` = `ghatBaseIncome` (130/month) x `riverFactor(health)` = `(health/100)^riverExponent` (1.5) x road access (`roadAccessRadius` 3, else `noAccessFactor` 0.25) x commerce bonus (`commerceRadius` 4, +0.08/tile, cap 1.8) x cluster bonus (`clusterRadius` 3, +0.05/ghat, cap 1.5).
- Shared visitor pool: `visitorPoolCapacity` = `poolBaseGhats` (4) + residents / `poolResidentsPerGhat` (400 sim) + landmarks x `poolGhatsPerLandmark` (6). Past capacity, `visitorPoolFactor` scales each ghat by `(capacity / ghats)^poolExponent`, floored at `poolMinFactor` (0.4). Spamming ghats does not scale income.
- City total: `calculateTourismIncome(grid, gridSize, ghats, gangaHealth, seasonMultiplier, pool, extraGhats)`. Seasons scale it (`SEASON_CONFIG[season].tourism`: monsoon 0.5, post-monsoon 1.4). Landmark ghat positions (`extraGhats`, e.g. Dashashwamedh) earn and cluster like ghats but neither count toward nor shrink with the pool.
- Flooded ghats are closed: simulation.ts filters `openGhats` by the flood mask, so they earn 0 during a flood.
- Upkeep `GHAT_UPKEEP_MONTHLY` (30).

## Other consumers
- Water works output: `calculateWaterWorksCapacity(gangaHealth)` (`src/lib/utilities.ts`, `WATER_CONFIG.worksMinFactor`).
- Landmarks: `getLandmarkBonuses(placed, gangaHealth)` (`landmarks.ts`) scales river-affected landmark tourism by `riverFactor`.
- River colour: `getGangaRiverColor(health, alpha)` (`ganga.ts`).
- Example city start: `EXAMPLE_START_GANGA_HEALTH` (70) in `src/lib/exampleCity.ts`.

## Tuning method
1. Change config only; numbers are rupees per month or load points with a comment saying why.
2. Run the design-target tests: `src/lib/__tests__/tourism.test.ts` (tourism 15-25% of income), `economyBalance.test.ts` (ghat payback 36-60 months, landmark payback 24-48 months, upkeep on recreation/attractions/stations/bridges/ghats/landmarks).
3. If a target fails, retune config; change an assertion only with the owner's agreement.
4. Ask "what does the player do about it?" - every load source should have a counter (STP, green belt, moving industry).

## Gotchas
- Configs count SIM people (`stpCapacity` 5000 = 50,000 shown).
- Health is a slow stock: a change shows in the trend arrow at once but the number moves over days; test with many day steps.
- The river only exists on the Varanasi map; all of this is gated on `mapId === 'varanasi'`.
- Tile effects are cached; new inputs must be in the cache key or they go stale (skills/perf-budget).

## Verify
- `npx vitest run src/lib/__tests__/tourism.test.ts src/lib/__tests__/economyBalance.test.ts src/lib/__tests__/gangaUi.test.ts`
- Scenario by hand: factory on the bank -> trend down, health falls; add a powered STP and a green belt -> recovers.
- Run skills/verification-gate.
