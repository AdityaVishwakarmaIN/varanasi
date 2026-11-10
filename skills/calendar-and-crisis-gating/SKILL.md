---
name: calendar-and-crisis-gating
description: Use when code depends on in-game time, seasons, weather, the monsoon and floods, heatwave/disease/collapse cadence, festivals, forecasts, or on the map and Crises-setting gates that decide whether a system runs.
---

# Calendar And Crisis Gating

The game runs on a fixed calendar: 30 ticks per day, 30-day months, 12 months. Seasons follow the Indian year, weather is rolled daily from the season, and every crisis or event runs at a known cadence behind explicit gates. Get the time maths and the gates right and systems stay fair (warned in advance) and testable.

## Read first
- `src/lib/seasons.ts` (calendar, seasons, weather)
- `src/lib/floods.ts`, `src/lib/crisisSim.ts`, `src/lib/festivalSim.ts`, `src/lib/forecast.ts`
- skills/add-sim-system for where these hook into `simulateTick`

## Calendar (`src/lib/seasons.ts`)
- `CALENDAR` (`ticksPerDay` 30, `daysPerMonth` 30, `monthsPerYear` 12, `epochYear`), `DAYS_PER_YEAR`, `TICKS_PER_YEAR`.
- `absoluteDay(year, month, day)` <-> `fromAbsoluteDay(abs)`. Months are 1-based. `getToday(state)` (`notifications.ts`) gives today's absolute day.
- Store every deadline, start and "until" as an absolute day (`weatherUntilDay`, `siltUntilDay`, forecast `day`). Compare with `>=`; never store month/day pairs that wrap at year end.
- Seasons: `getSeason(month)` -> `'summer'` (Mar-Jun), `'monsoon'` (Jul-Sep), `'postMonsoon'` (Oct-Nov), `'winter'` (Dec-Feb); `SEASON_MONTHS`, `SEASON_LABELS`, `SEASON_COLORS`.
- `SEASON_CONFIG[season]`: `powerDemand`, `waterDemand`, `tourism`, `treeGrowth`, `vehicleSpeed`, `gangaRecovery`. Seasonal effects obey `setSeasonalEffectsEnabled`.
- Calendar strip data: `getUpcomingMonths(month, year, count)`.

## Weather
- `SimWeather`: `clear`, `light_clouds`, `storm`, `severe_storm`, `fog`, `heat_haze`. Probabilities `SEASON_WEATHER`; tunables `WEATHER_CONFIG`.
- `pickWeather(season, rng)`, `rollWeatherDuration(rng)`, `advanceWeather(...)` - called once a day in `simulateTick`; state in `weather` / `weatherUntilDay`.
- `isFogActive(weather, hour)`, `getVehicleSpeedMultiplier(season, weather, hour)`.
- Weather is owned by the sim; the renderer only reads it.

## Monsoon and floods (`src/lib/floods.ts`, `floodSim.ts`)
- `rollMonsoonStrength(rng)` on `isMonsoonRollDay(month, day)` (`FLOOD_CONFIG.rollMonth` 6, `rollDay` 1) -> `'weak' | 'normal' | 'heavy'`; forecast `forecastDaysAhead` (30) days ahead.
- `getRiverLevel(month, day, strength)` 0..`MAX_RIVER_LEVEL` (3) during `floodStartMonth`-`floodEndMonth` (7-9); peak by strength (`peakLevel`).
- `computeFloodMask(gridSize, riverLevel, embankments)`, `getFloodRiskLevel`, `getEmbankmentProtection` (`embankmentRadius`), city mask `getCityFloodMask(state)`. Damage `getFloodDamageChance(type)`; silt tint `siltDays`.
- Day runner `runFloodDay`.

## Crisis cadence (`src/lib/crisisSim.ts`)
- Heatwave and disease roll on `isWeeklyCheckDay(today)` (`today % CRISIS_SIM_CONFIG.weekDays === 0`, 7).
- `runHeatwaveDay(heatwave, today, season, rng)` with `getShadeMask`; `runDiseaseDay(input, rng)` with `getOutbreakMask`, `getDiseaseHealthPenalty`; `runCollapseDay(...)` (skips landmarks).
- Configs: `HEATWAVE_CONFIG`, `DISEASE_CONFIG`, `COLLAPSE_CONFIG`.

## Festivals (`src/lib/festivals.ts`, `festivalSim.ts`)
- `FESTIVALS` ids: `maha_shivratri`, `holi`, `diwali`, `chhath`, `dev_deepawali`, `ganga_aarti`; `FestivalType` `'visual' | 'management'` (`isManagementFestival`).
- Announce `EVENT_CONFIG.announceDaysAhead`; `getActiveFestivals`, `getUpcomingFestivals`, `getUpcomingManagementEvent`.
- Readiness: `getEventArea` (largest ghat cluster via `findGhatTiles` / `getLargestGhatCluster`), `measureReadiness`, `evaluateReadiness` -> checklist with `READINESS_TEXT` (crowd_safety, fire_medical, access, sanitation, lights), outcome `resolveEvent` / `EVENT_OUTCOMES`.
- Day runner `runFestivalDay(city, today, month, day)`; forecasts via `applyFestivalForecasts`.

## Gates in `simulateTick`
| System | Runs when |
|---|---|
| Daily work | `newTick === 0` |
| Monthly work | `newMonth !== state.month` |
| Floods | `floodsEnabled && newTick === 0 && state.mapId === 'varanasi'`; flood mask also needs `state.disastersEnabled !== false` |
| Heatwave, disease, collapse | `crisesOn = crisesEnabled && state.disastersEnabled !== false` |
| Festivals | `festivalsEnabled && newTick === 0 && state.mapId === 'varanasi'` |
| Failure states (bankruptcy, loans) | monthly, `failureStatesEnabled`; NOT switched off by `disastersEnabled` |

`disastersEnabled` is the player's Crises setting: it turns off floods, heatwaves, disease and collapse, nothing else.

## Forecasts
- Two layers with the same function names:
  - `src/lib/forecast.ts` (pure list ops): `addForecast(list, forecast, today)` replaces by id, sorts by day, drops past entries, caps at `FORECAST_CONFIG.maxForecasts` (20); `pruneForecasts(list, today)`.
  - `src/lib/notifications.ts` (what sim code calls): `addForecast(state, input: ForecastInput)` puts it on the calendar strip AND sends a `warning` notification, returning `{ forecasts, notifications }` to spread; `input.daysAhead` sets the day; optional `x`, `y`, `overlay` deep link.
- `id` is stable: a forecast with the same id replaces the old one. Ids in use: `'monsoon'`, `'heatwave'`, `festival-<id>`. Never put a timestamp in an id.
- `ForecastKind`: `monsoon`, `flood`, `heatwave`, `disease`, `festival`, `other`.
- `simulateTick` prunes forecasts once a day (`newTick === 0`) before adding new ones.

## Gotchas
- Tick 0 of a day is the only daily hook; work placed elsewhere runs 30 times a day.
- Month is 1-based in state and `absoluteDay`; arrays indexed by month need `month - 1`.
- A test that wants a monsoon must set month/day and `monsoonStrength`, not just tick for months.
- Warn before punishing (design rule): every new crisis needs a forecast or an announcement before damage.

## Verify
- Tests in `src/lib/__tests__/`: `seasons.test.ts`, `seasonEffects.test.ts`, `floods.test.ts`, `floodSim.test.ts`, `heatwave.test.ts`, `disease.test.ts`, `collapse.test.ts`, `crisisSim.test.ts`, `festivals.test.ts`, `festivalSim.test.ts`, `forecast.test.ts`, `failure.test.ts`, `failureSim.test.ts`.
- Toggle Crises off in Settings: floods/heatwave/disease/collapse stop, bankruptcy still works.
- Run skills/verification-gate.
