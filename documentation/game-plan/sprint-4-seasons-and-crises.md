# Sprint 4: Seasons, Crises and the Challenge

> **Read first:** [README.md](README.md), [00-game-design.md](00-game-design.md).
> **Depends on:** Sprint 3 finished (power and water capacity, informal settlements, river zones, Ganga Health).
> **Pillars served:** P3 Proud problem-solver, P2 The Ganga is the heart, P4 Unmistakably Varanasi.

---

## 1. Goal

By the end of this sprint:

1. The year follows the **Indian calendar**: Summer, Monsoon, Post-monsoon, Winter. Each season changes gameplay.
2. The **monsoon floods** the riverbanks, with a strength that varies each year and is forecast in advance.
3. **Heatwaves**, **winter fog**, **disease outbreaks** and **old-building collapses** happen for understandable reasons.
4. The game can be **lost** (bankruptcy or exodus), with fair warning and one rescue option.
5. Every crisis is **forecast**, **located** (one click jumps to it) and **fixable**.

## 2. Game-development principles used in this sprint

| Principle | Plain-English meaning |
|-----------|----------------------|
| **Telegraphing** | Announce every threat before it hits ("Heavy monsoon expected in 3 weeks"). Losing to a surprise feels unfair; losing to a warning you ignored feels like *your* fault. |
| **Counterplay** | Every crisis has at least one thing the player can build or change to reduce it. No crisis is pure bad luck. |
| **Rhythm and pacing** | Seasons give the year a rhythm: calm → pressure → recovery. Players plan around it, which is what makes it strategic. |
| **Systemic consequences** | Crises come **from the existing systems** (river distance, water coverage, Ganga Health, building age). They are not random events stuck on top. |
| **Fail forward, but real failure exists** | Mistakes hurt and can be recovered from, once. Repeated neglect ends the game. |
| **Simulation owns the truth** | Weather and seasons are decided by the **simulation** (saved, testable), not by the renderer. The renderer only draws what the simulation says. |

## 3. What exists today (read before starting)

| Thing | Where | Notes |
|-------|-------|-------|
| Calendar | `simulateTick` in `simulation.ts` around line 2516 | **30 ticks = 1 day, 30 days = 1 month, 12 months = 1 year.** At speed 1 (500 ms per tick) one month ≈ 7.5 real minutes and one year ≈ 90 minutes. The **visual hour** (day/night) uses a separate 450-tick cycle. |
| Weather | `pickWeatherMode()` in `src/components/game/effectsSystems.ts` around line 653, `CLOUD_WEATHER_PROBABILITY_SPLIT` in `cloudWeatherConfig.ts` | Weather is **chosen by the renderer** with `Math.random()` and synced back to the simulation through a ref (`cloudWeatherModeRef` in `GameContext.tsx`). Modes: `clear`, `light_clouds`, `storm`, `severe_storm`. This sprint moves the choice into the simulation. |
| Fire and weather | `src/lib/fireConfig.ts`, docs in `documentation/fire_mechanics_and_weather_summary.md` | Fire already reacts to weather. Keep that working. |
| Tree growth and weather | `src/lib/treeGrowth.ts`, `documentation/tree-auto-growth-summary.md` | |
| Disasters toggle | `state.disastersEnabled` (used in `simulateTick` around line 2394) | |
| Notifications | `Notification` type in `src/games/isocity/types/game.ts` line 135 (no location field yet) | |
| Advisors | `AdvisorMessage` type (line 143), `src/components/game/panels/AdvisorsPanel.tsx` | |
| River helpers | `getRiverZone`, `getDistanceToGanga` (Sprint 2) | |
| Utilities | `src/lib/utilities.ts` (Sprint 3), with `seasonMultiplier` hooks already planned | |

---

## 4. Tasks

- [ ] S4-T1: Seasons model and the calendar strip
- [ ] S4-T2: Weather owned by the simulation, following the season
- [ ] S4-T3: Seasonal effects
- [ ] S4-T4: Crisis notifications (locate, jump, auto-pause)
- [ ] S4-T5: Monsoon floods
- [ ] S4-T6: Embankments (flood counterplay)
- [ ] S4-T7: Heatwaves
- [ ] S4-T8: Winter fog
- [ ] S4-T9: Disease outbreaks
- [ ] S4-T10: Old-building collapse
- [ ] S4-T11: Bankruptcy, emergency loan and exodus (failure states)
- [ ] S4-T12: Balance pass and sign-off

---

### S4-T1: Seasons model and the calendar strip

**Steps:**
1. Create `src/lib/seasons.ts` (pure):
   ```ts
   export type Season = 'summer' | 'monsoon' | 'postMonsoon' | 'winter';
   export function getSeason(month: number): Season; // 3-6 summer, 7-9 monsoon, 10-11 postMonsoon, 12-2 winter
   export const SEASON_CONFIG: Record<Season, SeasonEffects>; // filled in S4-T3
   ```
2. **Calendar strip UI:** a thin bar under the top bar (desktop) or inside the date popover (mobile) showing the **next 3 months**: the season colour
   (summer orange, monsoon blue-grey, post-monsoon gold, winter pale blue) and icons for known upcoming events (forecast monsoon strength, festivals
   later in Sprint 5).
3. The top bar's date shows the season name next to it, for example "Jul 2026 · Monsoon".
4. Unit tests for `getSeason` for all 12 months.

**Acceptance criteria:** the season shows in the UI and changes on the right months.

---

### S4-T2: Weather owned by the simulation, following the season

**Why:** principle *simulation owns the truth*. Today weather is random in the renderer, so it cannot follow seasons, cannot be saved and cannot be tested.

**Files to read:** `effectsSystems.ts` (`pickWeatherMode` and where it is called, around lines 653 and 981), `cloudWeatherConfig.ts`, and how `cloudWeatherModeRef`
flows through `GameContext.tsx` into `simulateTick`.

**Steps:**
1. Add to `GameState` (optional fields, for old saves): `weather?: CloudWeatherMode` and `weatherUntilDay?: number` (an absolute day count).
2. Append two modes to `CloudWeatherMode`: `'fog'` and `'heat_haze'`. Fill every `Record<CloudWeatherMode, …>` the build complains about.
   - `fog`: few clouds, a soft white overlay whose strength depends on the hour (strong at hour 0–9, fading by 11).
   - `heat_haze`: clear sky, slightly warm and washed-out colour grading. **Keep it subtle.**
3. Config `SEASON_WEATHER` in `seasons.ts`: the probability of each mode per season (starting values):

   | Season | clear | light_clouds | storm | severe_storm | fog | heat_haze |
   |--------|-------|--------------|-------|--------------|-----|-----------|
   | summer | 0.45 | 0.20 | 0.05 | 0.00 | 0.00 | 0.30 |
   | monsoon | 0.05 | 0.25 | 0.50 | 0.20 | 0.00 | 0.00 |
   | postMonsoon | 0.55 | 0.35 | 0.10 | 0.00 | 0.00 | 0.00 |
   | winter | 0.45 | 0.20 | 0.00 | 0.00 | 0.35 | 0.00 |

4. In `simulateTick`: when the current day reaches `weatherUntilDay`, pick new weather from `SEASON_WEATHER[season]` and set `weatherUntilDay` to 2–5 days later.
   Use the simulation's random source (keep it injectable for tests).
5. The renderer **reads `state.weather`** instead of calling `pickWeatherMode()`. Remove the renderer's own random choice. The cloud visuals stay as they are.
6. Existing behaviour that depends on weather (fire, tree growth, lighting) now reads the simulation's weather. Check each one still works.

**Acceptance criteria:** July is mostly stormy, April is often hazy, and January mornings are foggy. Weather survives save/load. There are tests for the weather pick with a seeded RNG.

---

### S4-T3: Seasonal effects

**Fill `SEASON_CONFIG`** (starting values), and wire each number into the system it affects:

| Effect | Summer | Monsoon | Post-monsoon | Winter | Where it plugs in |
|--------|--------|---------|--------------|--------|-------------------|
| Power demand × | 1.30 | 1.00 | 1.00 | 1.05 | `seasonMultiplier` in `utilities.ts` (S3-T7) |
| Water demand × | 1.25 | 0.90 | 1.00 | 0.95 | `utilities.ts` (S3-T8) |
| Tourism income × | 0.80 | 0.50 | 1.40 | 1.10 | `tourism.ts` (S2-T9) |
| Tree growth × | 0.50 | 2.00 | 1.00 | 0.70 | `treeGrowth.ts` |
| Vehicle speed × | 1.00 | 0.85 | 1.00 | 1.00 (fog handled in S4-T8) | traffic speed |
| Ganga Health drift | — | river recovers 2× faster when not flooded (fresh water) | — | — | the "5% per day" step in S2-T7 |

**Acceptance criteria:** each multiplier is visible in the numbers (for example the tourism line in the budget drops in monsoon). A unit test covers each pure function that uses them.

---

### S4-T4: Crisis notifications (locate, jump, auto-pause)

**Why:** UX rule 4: "any problem is at most two clicks from its cause". This task is done **before** the crises, so every crisis can use it.

**Steps:**
1. Extend `Notification` with optional fields: `x?: number; y?: number; overlay?: OverlayMode; severity?: 'info' | 'warning' | 'crisis'`.
2. Clicking a notification that has `x, y` moves the camera smoothly to that tile (reuse the smooth camera from S1-T10) and turns on `overlay` if given.
3. **Settings → "Pause when a crisis starts"** (default **on**). A notification with `severity: 'crisis'` sets speed to 0 when this is on.
4. **Forecasts:** a helper `addForecast(title, description, daysAhead)` that puts an entry on the calendar strip (S4-T1) and sends a `warning` notification.

**Acceptance criteria:** a test crisis notification jumps the camera, turns on the overlay and pauses the game when the setting is on.

---

### S4-T5: Monsoon floods

**Why:** the signature Varanasi crisis. Real ghats flood every monsoon, and the east floodplain goes under.

**Model (config `FLOOD_CONFIG` in a new `src/lib/floods.ts`, pure functions):**

1. **Yearly monsoon strength**, rolled on **1 June** each year: `weak` (25%), `normal` (50%), `heavy` (25%).
   Immediately call `addForecast("Monsoon forecast: HEAVY", "The IMD expects a heavy monsoon. Riverbanks will flood in July–September.", 30)`.
   Store `monsoonStrength?: 'weak' | 'normal' | 'heavy'` on `GameState`.
2. **River level** (0–3), updated daily during monsoon months:
   - It rises gradually from July 1, peaks mid-August and falls back to 0 by September 30.
   - Peak level: weak = 1, normal = 2, heavy = 3.
   - Use a smooth curve (for example a sine shape over the 92 days) and round down to an integer.
   - Store it as `riverLevel?: number` on `GameState`.
3. **Which tiles flood** at each river level (use `getRiverZone` and `getDistanceToGanga`):

   | River level | Tiles that flood |
   |-------------|------------------|
   | 1 | `eastFloodplain` tiles within 3 tiles of the river |
   | 2 | all `eastFloodplain` tiles, plus `westRiverfront` tiles (the ghats go under) |
   | 3 | also `westBank` tiles within 3 tiles of the river, plus tiles within 2 tiles of the Assi and Varuna |

   Compute the flooded set as a **typed array mask** that is recomputed only when `riverLevel` changes (principle: *cache what rarely changes*).
4. **Effects on a flooded tile:**
   - The building counts as **unpowered and unwatered**, cannot grow, and its residents are unhappy.
   - **Ghats close:** they earn no tourism, but they take **no damage** (ghats are built to flood).
   - **Roads:** vehicles do not spawn on flooded road tiles, and vehicles already on them are removed (keep it simple; no re-routing needed).
   - **Damage:** each in-game day, a flooded building has a `FLOOD_DAMAGE_CHANCE = 0.01` chance of becoming **abandoned**. For `informal_housing` it is `0.05`.
5. **After the water recedes:** tiles that were flooded show a light **silt** tint for 10 days (visual only).
6. **Rendering:** draw flooded land tiles with a semi-transparent muddy-water layer (`rgba(110, 95, 60, 0.55)`) that animates slightly. It must be drawn in
   the same pass as water, so it costs almost nothing extra. Check frame time.
7. **New overlay `'flood'`** (append to `OverlayMode`): shows **flood risk** at any time of year. Colour by the lowest river level that floods the tile
   (level 1 = dark red, 2 = orange, 3 = yellow). Tile info shows "Floods in: weak / normal / heavy monsoons".
8. Advisor: when a monsoon starts, list the number of buildings in flood zones and point to the flood overlay.
9. Unit tests: the flood mask for each level on a 60×60 Varanasi map (counts go up as the level goes up; ghat tiles flood at level 2).

**Acceptance criteria:** in a heavy monsoon the east bank and ghats go under and recede in September. The overlay predicts exactly which tiles flooded. There is no frame-time regression.

---

### S4-T6: Embankments (flood counterplay)

| Field | Value |
|-------|-------|
| ID | `embankment` (append to `BUILDING_STATS`) |
| Name shown | "Embankment (Tatbandh)" |
| Size | 1×1, can be dragged in a line like roads (reuse the drag-to-place behaviour if possible; otherwise single placement) |
| Cost | ₹300 per tile |
| Where | Any land tile within 4 tiles of the Ganga **except** ghat tiles |
| Effect | Land tiles within `EMBANKMENT_RADIUS = 4` that are on the **same bank**, and not between the embankment and the river, flood **one river level later** (a tile that floods at level 2 now floods only at level 3; level-3 tiles become safe). Several embankments do not stack. |
| Downside | Land value −10 within 2 tiles (it blocks the river view), and it cannot hold ghats |
| Art | Placeholder: a grey-brown raised bank. Real art later |

**Acceptance criteria:** a line of embankments visibly shrinks the flood overlay behind it, and the flood mask tests are extended to cover it.

---

### S4-T7: Heatwaves

**Rules (config `HEATWAVE_CONFIG`):**
- Only in summer. Each in-game week: `HEATWAVE_CHANCE = 0.25` to schedule a heatwave starting **3 days later** (forecast immediately), lasting 5–10 days.
- During a heatwave: weather is forced to `heat_haze`, power demand gets an extra ×1.15, and water demand gets an extra ×1.15 (on top of the season multipliers).
- **Health hit:** residential tiles **without power or without water** during the heatwave: health −15 on the tile, happiness −.
- **Counterplay:** tiles with a tree or park within 3 tiles take only half the health hit (shade). A hospital in range halves it again.
- Notification (crisis): "Heatwave! Neighbourhoods without power or water are suffering." with `overlay: 'power'`.

**Acceptance criteria:** heatwaves are forecast, stress power and water, and hurt only the tiles that lack services. Greenery measurably helps (unit test).

---

### S4-T8: Winter fog

- In winter, when `weather === 'fog'`, during hours 0–10: vehicle speed ×0.6 and **no planes take off or land** (the airport pauses its flights).
  Tourism is unaffected.
- Visual: the fog overlay from S4-T2. On Low quality, use a single flat semi-transparent white layer (cheap).
- There is no crisis notification. It is atmosphere plus a small slowdown. Show a small ☁ "Fog" chip in the top bar.

**Acceptance criteria:** foggy mornings look and feel slower and clear up by midday.

---

### S4-T9: Disease outbreaks

**Rules (config `DISEASE_CONFIG`, pure functions in `src/lib/disease.ts`):**
- Checked once per in-game week, **per feeder zone** (the same 16×16 blocks as S3-T7).
- `risk = BASE (0.01) × densityFactor × waterFactor × riverFactor × floodFactor × seasonFactor`, where:
  - `densityFactor = 1 + population in the block / 2000`
  - `waterFactor = 1 + (share of residential tiles in the block without water)` (range 1–2)
  - `riverFactor = gangaHealth < 50 ? 1.5 : 1` (only for blocks with catchment tiles)
  - `floodFactor = 2` if the block had flooded tiles in the last 20 days, otherwise 1
  - `seasonFactor = 2` in monsoon and post-monsoon, otherwise 1
- **Outbreak:** the block becomes "infected" for at least 14 days. Effects: health rating −25 for the block, no growth, and the block's population falls **1% per week**.
- **Resolves** when hospital coverage across the block averages ≥ 60% **and** water coverage ≥ 80%, then 14 days later. Or on its own after 60 days, with a bigger population loss.
- UI: a biohazard-style icon floating over the block, a crisis notification with `x, y` and `overlay: 'health'`, and an advisor explanation of the cause
  ("Dirty water and flooding in <area>"). The explanation must name the **top factor**.

**Acceptance criteria:** outbreaks happen mostly in dense, under-watered, flood-hit blocks during and after the monsoon, and building hospitals and water ends them. There are unit tests for `risk`.

---

### S4-T10: Old-building collapse

**Rules (config `COLLAPSE_CONFIG`):**
- Applies to residential and commercial buildings with `age > COLLAPSE_MIN_AGE` (starting value: the age a building reaches after about **8 in-game years**; check how `age` counts up in `simulateTick`).
- Daily chance `0.0005`, ×3 during monsoon, ×2 if the tile flooded this year.
- **Counterplay:** ×0.3 if the tile is within range of a fire station (inspection and rescue), or if the building was **upgraded** (level-up) in the last 2 years.
- Collapse = the building becomes **abandoned**, the population on the tile is removed, and a crisis notification is sent with location. It is not animated (a small dust-puff effect is optional).
- Must be rare: **on average at most 1 collapse per in-game year** in a well-run 1-lakh city. Tune until true.

**Acceptance criteria:** collapses are rare, explained and preventable.

---

### S4-T11: Bankruptcy, emergency loan and exodus (failure states)

**Why:** design decision "challenging: you can fail", with principle *fail forward, but real failure exists*.

**Rules (config `FAILURE_CONFIG`):**
1. **Debt warning:** when `money < 0`, show a persistent red banner "The city treasury is empty" with the number of months in debt.
2. **Emergency loan (once per city):** when money has been negative for **3 consecutive months**, offer a dialog:
   "The State Government offers an emergency loan of ₹X. It will be repaid from 15% of income for 24 months."
   (X = 6 months of current expenses.) Accept → money += X, and a repayment is added to expenses. Decline → nothing happens.
3. **Bankruptcy (game over):** money negative for **6 consecutive months** *after* the loan was used or declined.
4. **Exodus:** when happiness is below **30** for **12 consecutive months**, residential buildings start being abandoned (2% of them per month) and a banner shows
   "People are leaving the city". **Game over** if the displayed population falls below **20% of its all-time peak**.
5. **Every countdown is visible:** banners show "X months until bankruptcy" or "Happiness has been critical for X months".
6. **Game-over screen:** the city name, years survived, peak population, peak Ganga Health and a short "what went wrong" line (the top failing stat),
   with buttons **"Load last autosave"** and **"New city"**. Keep an extra autosave copy from 1 in-game month before game over so "Load last autosave" is useful.
7. The existing `disastersEnabled` setting is relabelled **"Crises"** (on by default). Turning it off also disables floods, heatwaves, disease and collapse, but **not** bankruptcy or exodus.

**Acceptance criteria:** both failures can be triggered in a test city, all warnings and countdowns appear first, the loan works once, and the game-over buttons work.

---

### S4-T12: Balance pass and sign-off

1. Play **two full in-game years** on a Varanasi map at speed 3 (about 70 minutes). Record the monsoon strengths, the floods, heatwaves, outbreaks and collapses, and whether each was understandable and fixable.
2. **Design targets (tune until true):**
   - A player who **ignores** flood risk and builds on the east bank loses real money in a normal monsoon.
   - A player who **plans** (embankments, no building on the floodplain, hospitals, water) comes through a heavy monsoon with only minor damage.
   - At most **one** crisis notification per in-game month on average outside the monsoon.
3. Rerun the benchmark **during a heavy-monsoon flood** on a full 160 map and add perf-log rows. Sprint 1 targets must still pass.

## 5. Sprint exit criteria

- [ ] All tasks ticked.
- [ ] Every crisis is forecast or explained, located and fixable (check each one).
- [ ] Both failure states work, with warnings.
- [ ] Sprint 1 performance targets pass during a flood.
- [ ] Old saves still load. Missing new fields get sensible defaults.

## 6. Notes for later

*(Implementers: add things you noticed but did not do here.)*
