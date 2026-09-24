# Sprint 2: Varanasi and the Ganga

> **Read first:** [README.md](README.md), [00-game-design.md](00-game-design.md).
> **Depends on:** Sprint 1 finished (big maps, perf HUD, tests, seeded RNG, IndexedDB saves).
> **Pillars served:** P2 The Ganga is the heart, P4 Unmistakably Varanasi.

---

## 1. Goal

By the end of this sprint, a player can:

1. Start a new game on a **recognisable Varanasi map**: the Ganga's crescent with the city side on the west bank
   and sandy floodplain on the east bank, plus the Assi and Varuna streams.
2. Build **ghats** on the west-bank riverfront.
3. See and manage **Ganga Health** (0–100). Pollution and sewage lower it. Treatment plants and riverside trees raise it.
4. Earn **tourism income** from ghats, which depends on Ganga Health.
5. Watch **boats** travelling on the Ganga between ghats.
6. See money in **₹** and population in **lakh** (population display ×10).

## 2. Game-development principles used in this sprint

| Principle | Plain-English meaning |
|-----------|----------------------|
| **Data-driven content** | The Varanasi map is described as **data** (river points and widths), not hand-placed tiles. The same data works at any map size. |
| **Single source of truth** | Anything that can be **computed** from the map data (which bank a tile is on, flood zone) is computed, not stored in saves. |
| **Readable feedback loops** | The player must see cause and effect: build a factory by the river → the river overlay turns red → Ganga Health's trend arrow points down → tourism income drops. |
| **Slow stocks, fast signals** | The river's health changes **slowly** (it is a "stock"), but the UI immediately shows the **trend** (a fast "signal"), so the player knows at once whether a change helped. |
| **Tune with targets, not guesses** | Balance numbers come with a *design target* (for example "tourism ≈ 15–25% of income mid-game"). Tune until the target is met. |

## 3. What exists today (read before starting)

| Thing | Where | Notes |
|-------|-------|-------|
| Map generation | `generateTerrain`, `generateLakes`, `generateOceans` in `src/lib/simulation.ts` (around line 162–600) | Random lakes and oceans. From S1-T1 these take an `rng` parameter. |
| Water bodies | `WaterBody` in `src/games/isocity/types/game.ts` line 126 | `type: 'lake' \| 'ocean'`, with a name and a list of tiles. Names are drawn as labels on the map. |
| Waterfront buildings | `WATERFRONT_BUILDINGS`, `requiresWaterAdjacency`, `getWaterAdjacency` in `simulation.ts` around line 619 | Used by the marina and pier. **Reuse for ghats.** |
| Boats | `src/components/game/boatSystem.ts`, `findMarinasAndPiers` (used in `CanvasIsometricGrid.tsx` around line 786) | Boats travel between marinas and piers. **Reuse for ghats.** |
| Pollution per tile | `tile.pollution`, updated in `simulateTick` around line 2389; green cleanup around line 2455 | |
| Stats and income | `calculateStats` in `simulation.ts` around line 1812; income at around line 1955 | |
| Scores | `src/lib/scoring.ts` (`SCORING_CONFIG`, `calculateRatings`) | Add Ganga Health here, in the same style. |
| Overlays | `src/components/game/overlays.ts` (`OVERLAY_CONFIG`, `getOverlayFillStyle`, `OVERLAY_MODES`), `OverlayMode` type in `src/components/game/types.ts` line 562 | |
| New game | `newGame(name?, size?)` in `GameContext.tsx` around line 1199; start screen in `src/app/page.tsx` | |
| Map sizes | `MAP_SIZES` in `src/lib/mapConfig.ts` (from S1-T8) | |
| Tips | `src/hooks/useTipSystem.ts` | |
| Art pipeline | `skills/varanasi-image-to-asset/SKILL.md` | For final sprites. Placeholders are fine this sprint. |

---

## 4. Tasks

- [ ] S2-T1: Indian number formatting and population scale
- [ ] S2-T2: Varanasi map data and generator
- [x] S2-T3: Map choice on the new-game screen, and branding
- [ ] S2-T4: River zones (bank and floodplain helpers)
- [ ] S2-T5: The Ghat building
- [ ] S2-T6: Sewage Treatment Plant (STP)
- [ ] S2-T7: Ganga Health score
- [ ] S2-T8: Ganga overlay and UI
- [ ] S2-T9: Tourism income
- [ ] S2-T10: Boats on the Ganga
- [ ] S2-T11: Tips, balance pass and sign-off

---

### S2-T1: Indian number formatting and population scale

**Why:** "Indian look" plus a "full city of lakhs" (see design §5.1).

**Files to read:** search the codebase for `formatMoney`, `formatPopulation`, `toLocaleString` and `'$'`. There are several copies,
for example in `SettingsPanel.tsx`, `src/app/page.tsx`, `TopBar.tsx` and `StatisticsPanel.tsx`.

**Steps:**
1. Create `src/lib/format.ts` with:
   ```ts
   export const POPULATION_DISPLAY_SCALE = 10;
   /** 1234567 -> "12,34,567" (Indian digit grouping) */
   export function formatIndianNumber(n: number): string;
   /** Money. Under 1 lakh: "₹45,300". Under 1 crore: "₹12.3 lakh". Otherwise: "₹3.4 crore". Negative: "-₹5,000". */
   export function formatINR(n: number): string;
   /** Takes the SIMULATION population, multiplies by POPULATION_DISPLAY_SCALE, then formats with lakh/crore words. */
   export function formatPopulation(simPopulation: number): string;
   ```
2. Replace **every** player-visible money and population display with these functions. Delete the local copies.
3. **Do not** change the simulation's population numbers. The scale is for display only.
4. Unit tests for all three functions, including 0, negative numbers, 99,999, 1,00,000, 99,99,999 and 1,00,00,000.

**Acceptance criteria:** no `$` is visible anywhere in the game. Population shows lakh for big cities. Tests pass.

---

### S2-T2: Varanasi map data and generator

**Why:** the heart of this sprint: a map the player recognises.

**Files to read:** `generateTerrain`, `generateLakes`, `createInitialGameState` in `simulation.ts`, and `src/lib/rng.ts`.

**Coordinate convention used in this doc:** map positions are given as **fractions from 0 to 1**.
`u` goes from the **west edge (0)** to the **east edge (1)** and becomes grid `x`. `v` goes from the **north edge (0)** to the
**south edge (1)** and becomes grid `y`. So `(u, v) = (0.5, 0.5)` is the map centre. Tile = `(round(u × (size−1)), round(v × (size−1)))`.

**Map data** (put it exactly like this in a new file `src/games/isocity/maps/varanasi.ts`):

```ts
export const VARANASI_MAP = {
  id: 'varanasi',
  // The Ganga: enters from the south, bulges WEST in the middle (the crescent), then leaves to the north-east.
  // The west bank of the bulge is where the ghats are.
  ganga: {
    name: 'Ganga',
    widthFraction: 0.05,          // river width = 5% of map size (8 tiles at 160)
    points: [                     // centreline, south to north
      { u: 0.62, v: 1.00 },
      { u: 0.56, v: 0.85 },
      { u: 0.51, v: 0.68 },       // deepest part of the crescent (most western point is around here)
      { u: 0.52, v: 0.50 },
      { u: 0.58, v: 0.34 },
      { u: 0.70, v: 0.20 },
      { u: 0.86, v: 0.10 },
      { u: 1.00, v: 0.05 },
    ],
  },
  tributaries: [
    { name: 'Assi',   widthTiles: 1, points: [ { u: 0.30, v: 0.90 }, { u: 0.42, v: 0.86 }, { u: 0.54, v: 0.84 } ] },
    { name: 'Varuna', widthTiles: 2, points: [ { u: 0.00, v: 0.30 }, { u: 0.20, v: 0.26 }, { u: 0.40, v: 0.30 }, { u: 0.63, v: 0.28 } ] },
  ],
  eastFloodplainFraction: 0.10,   // sandy floodplain width on the EAST bank = 10% of map size
  treeDensity: { westBank: 0.06, eastBank: 0.02 },  // chance a land tile starts as a tree
} as const;
```

**Steps:**
1. Write `generateVaranasiTerrain(size: number, rng: Rng): { grid: Tile[][]; waterBodies: WaterBody[] }` in a new file
   `src/games/isocity/maps/generateVaranasi.ts`:
   - Start with all grass (same as `generateTerrain`).
   - **Draw the river:** turn the centreline points into a smooth curve (use Catmull-Rom interpolation, sampling at least
     `size × 4` points). For every tile, compute the distance to the nearest sampled point. If the distance is ≤ half the river width,
     the tile becomes `water`. Add a tiny wobble to the width using `perlinNoise` (±15%) so the banks look natural, not perfectly smooth.
   - Draw the **tributaries** the same way, with their fixed widths in tiles.
   - Create `WaterBody` entries named **"Ganga"**, **"Assi"** and **"Varuna"** (add `'river'` to the `WaterBody.type` union).
   - Add trees using `treeDensity` (west or east of the river centreline decides which density).
   - **Clean-up pass:** remove single isolated water tiles and fill single-tile holes in the river, so there are no ugly specks.
2. In `createInitialGameState`, add an optional parameter `mapId: 'random' | 'varanasi' = 'random'`. When it is `'varanasi'`, use
   `generateVaranasiTerrain`. Store `mapId` on the game state: add `mapId?: 'random' | 'varanasi'` to `GameState`. It is optional so
   old saves still load, and a missing value means `'random'`.
3. On `mapId === 'varanasi'`, **hide the Expand City and Shrink City tools** (design: fixed-size map).
4. Tests (`src/games/isocity/maps/__tests__/varanasi.test.ts`):
   - At sizes 60, 120 and 160: the Ganga is **one connected** body of water that touches the south edge and the east edge.
   - Water covers between 5% and 12% of all tiles.
   - The same seed gives the same map.

**Acceptance criteria:** a Varanasi game shows a crescent-shaped river that looks like the Ganga at Varanasi (compare with any
satellite map of Varanasi, where the river bends like a crescent with the city on the west side). Tests pass.

**How to test:** start a Varanasi game at 160 and at 120. Zoom out fully and take a screenshot. The owner signs off that it "reads as Varanasi".

---

### S2-T3: Map choice on the new-game screen, and branding

**Files to read:** `src/app/page.tsx`, `src/app/layout.tsx` (metadata), `newGame` in `GameContext.tsx`, `src/components/game/panels/SettingsPanel.tsx`.

**Steps:**
1. Extend `newGame(name?, size?)` to `newGame(options?: { name?: string; mapId?: 'random' | 'varanasi' })`. Size comes from `MAP_SIZES[mapId]`
   (desktop or mobile). Update every caller.
2. On the start screen's "New game" flow, show two large cards:
   - **Varanasi** (selected by default): "The holy city on the Ganga. Recommended."
   - **Random map**: "A random landscape with lakes and coastline."
   The city name defaults to "Varanasi" for the Varanasi map and "New City" for random.
3. Branding: the page `<title>`, the metadata description and the start-screen heading say **"Varanasi"**. Keep the credit to IsoCity
   (MIT licence) somewhere visible, for example in Settings → About or the footer. **This is required by the licence.**

**Acceptance criteria:** both map choices work. The tab title says Varanasi. The IsoCity credit is present.

---

### S2-T4: River zones (bank and floodplain helpers)

**Why:** ghats, floods (Sprint 4) and the Ganga score all need to know "which bank is this tile on?" and "how close to the river is it?".

**Steps:**
1. In `src/games/isocity/maps/riverZones.ts`, write **pure** functions computed from `VARANASI_MAP` plus `gridSize`. They are **not saved**:
   ```ts
   export type RiverZone = 'river' | 'westRiverfront' | 'westBank' | 'eastFloodplain' | 'eastBank' | 'none';
   export function getRiverZone(x: number, y: number, gridSize: number, mapId: MapId | undefined): RiverZone;
   export function getDistanceToGanga(x: number, y: number, gridSize: number, mapId: MapId | undefined): number; // in tiles
   ```
   (Implemented with an explicit `mapId` argument: a random map and a Varanasi map can have the same size, so size alone cannot tell them apart.
   The river shape depends only on the map data and size, never on the seed, so zones are reproducible without saving them.)
   - `westRiverfront` = a land tile **west** of the Ganga centreline that touches a Ganga water tile (4-neighbour).
   - `eastFloodplain` = a land tile east of the centreline within `eastFloodplainFraction × size` tiles of the river.
2. Because these are called often, **precompute once per gridSize** into typed arrays (`Uint8Array` for the zone, `Uint16Array` for the distance)
   and cache them. Recompute only if `gridSize` changes.
3. On the random map (`mapId !== 'varanasi'`) the functions return `'none'` and `Infinity`.
4. **Draw the east floodplain as sand:** in the renderer, tiles in `eastFloodplain` that are empty grass draw with a **sand colour** base
   (warm beige, for example `#d9c49a`) instead of green. Look at how beach drawing already works and reuse it if possible.
5. Tests: a tile known to be in the river returns `'river'`. The tile just west of it returns `'westRiverfront'`, and so on.

**Acceptance criteria:** the east bank looks like a sandy floodplain. The helpers are tested.

---

### S2-T5: The Ghat building

**Why:** ghats are the face of Varanasi and the source of tourism.

**Files to read:** `BUILDING_STATS` and `BuildingType` in `src/games/isocity/types/buildings.ts`, `TOOL_INFO` and `Tool` in
`src/games/isocity/types/game.ts`, `WATERFRONT_BUILDINGS` / `getWaterAdjacency` / `placeBuilding` in `simulation.ts`,
`src/components/game/Sidebar.tsx` (tool groups; the marina/pier group is around line 545), `src/lib/renderConfig.ts`, `src/components/game/placeholders.ts`.

**Definition:**

| Field | Value |
|-------|-------|
| ID | `ghat` (append to the **end** of `BUILDING_STATS`, see README rule 5) |
| Name shown | "Ghat" |
| Description | "Stone steps to the Ganga. Draws pilgrims and tourists." |
| Size | 1×1 (players build rows of ghats along the bank) |
| Cost | ₹800 |
| Jobs | 4 |
| Pollution | 0 |
| Land value | +10 |
| Placement rule | Tile must be `westRiverfront` (S2-T4). Everywhere else is red with the reason "Ghats must be on the Ganga's west bank" |
| Facing | Steps face the water. Use `getWaterAdjacency` to decide `flipped`, like the marina does |
| Build-menu group | New group **"Riverfront"** (listed first on the Varanasi map). It also holds the STP (S2-T6) |
| Sprite | Placeholder this sprint: a drawn sandstone-coloured stepped wedge (see how `placeholders.ts` draws simple shapes). Final art in Sprint 3 |

**Steps:**
1. Add the type, stats, tool and tool info as in the table.
2. Add the placement rule to the placement check in `placeBuilding` (or the function it uses). Make the **reason string** available to the
   placement preview from S1-T10.
3. Show the ghat tool **only when `mapId === 'varanasi'`**.
4. Adjacent ghats should look like one continuous row of steps. If the placeholder cannot do that yet, write it in "Notes for later" for the art task.

**Acceptance criteria:** ghats can be placed only on the west riverfront, face the water and survive save/load.

---

### S2-T6: Sewage Treatment Plant (STP)

**Why:** the player needs a clear tool to fix the river.

| Field | Value |
|-------|-------|
| ID | `sewage_treatment_plant` (append to the end of `BUILDING_STATS`) |
| Name shown | "Sewage Treatment Plant" |
| Description | "Cleans sewage before it reaches the Ganga. Treats a large area." |
| Size | 2×2 |
| Cost | ₹2,500 |
| Upkeep | Added to the **water** budget line (`updateBudgetCosts`), ₹60 per month to start |
| Jobs | 20 |
| Pollution | 0 |
| Land value | −5 (people don't love living next to one) |
| Needs | Power (if unpowered, it treats nothing) |
| Effect | Treats sewage from up to `STP_CAPACITY = 2000` **simulation** population within `STP_RADIUS = 14` tiles (used in S2-T7) |
| Overlay | Shows its radius circle like other service buildings when the Ganga overlay is active |

**Steps:** add it like the ghat, in the "Riverfront" group, visible only on the Varanasi map. Placeholder sprite: reuse the water tower
style tinted blue-grey, or a simple drawn box with round tanks.

**Acceptance criteria:** it can be placed, costs upkeep and shows its radius on the Ganga overlay.

---

### S2-T7: Ganga Health score

**Why:** pillar P2. This is the number the whole river economy hangs on.

**Files to read:** `src/lib/scoring.ts` (the whole file), `calculateStats` in `simulation.ts`, `Stats` in `src/games/isocity/types/economy.ts`.

**Model** (put every number into `SCORING_CONFIG.ganga` in `scoring.ts`):

```
catchment        = all land tiles with getDistanceToGanga(x, y) <= CATCHMENT_RADIUS (8)

industrialLoad   = Σ over catchment tiles of tile.pollution                   × INDUSTRY_WEIGHT (1.0)
sewageLoad       = Σ over catchment residential/commercial tiles of population × SEWAGE_PER_PERSON (0.02)
                   minus treated sewage (each POWERED STP removes up to STP_CAPACITY population within STP_RADIUS;
                   a tile's population can be treated only once)
upstreamLoad     = UPSTREAM_LOAD (constant 30). The river arrives already somewhat polluted, as in reality
greenCredit      = number of tree or park tiles that are westRiverfront or eastFloodplain × RIVERSIDE_GREEN_CREDIT (0.5)

netLoad          = max(0, industrialLoad + sewageLoad + upstreamLoad − greenCredit)
targetHealth     = 100 × (1 − min(1, netLoad / RIVER_CAPACITY (120)))
```

- **Slow stock:** each in-game **day**, `gangaHealth` moves **5%** of the way toward `targetHealth`
  (`gangaHealth += (targetHealth − gangaHealth) × 0.05`). Rivers recover slowly and get polluted slowly.
- **Starting value:** a new Varanasi game starts at `targetHealth` of an empty map (with only upstream load this is 75). This fits reality: the river is not pristine even before you build.
- **Trend:** also store `gangaHealthTarget` so the UI can show an arrow (↑ if target > current + 2, ↓ if target < current − 2, → otherwise).
- On the random map, Ganga Health is not computed and not shown.

**Steps:**
1. Add `gangaHealth?: number` and `gangaHealthTarget?: number` to `Stats` (optional for old saves).
2. Write `calculateGangaTargetHealth(input)` as a **pure** function in `scoring.ts`, taking the numbers above as input. The simulation gathers
   the inputs, and the function does the maths.
3. Call it from the stats calculation (only on the Varanasi map). Do the "move 5% per day" step in `simulateTick` when the day changes.
4. **Effects of Ganga Health** (config values):
   - Tourism multiplier (used in S2-T9).
   - **Health rating:** if `gangaHealth < 40`, residents in the catchment count as having −20 health coverage.
   - **Happiness:** add `gangaHealth` as a small input to the Happiness composite (weight 0.05; reduce the other weights proportionally so they still sum to 1.0).
5. **Performance:** the catchment tile list comes from the S2-T4 cache. Never loop over the whole map just to find it.
6. Tests: an empty map gives 75 (±1). Adding a large industrial load lowers the target. Adding a powered STP near homes raises it. The result is always 0–100.

**Acceptance criteria:** tests pass. In-game, a factory row on the riverfront makes the trend arrow point down within one in-game day.

---

### S2-T8: Ganga overlay and UI

**Files to read:** `src/components/game/overlays.ts`, `src/components/game/OverlayModeToggle.tsx`, `src/components/game/panels/StatisticsPanel.tsx`,
`src/components/game/TopBar.tsx`, `src/components/mobile/MobileTopBar.tsx`.

**Steps:**
1. Add `'ganga'` to the **end** of the `OverlayMode` union and fill every `Record<OverlayMode, …>` in `overlays.ts`
   (the TypeScript build will point to each one you missed).
2. Overlay look:
   - **River tiles** are tinted by Ganga Health: 0 = brown `#6b4f2a`, 50 = murky green `#5f7f5a`, 100 = clean blue `#3a7bd5`.
   - **Catchment land tiles** are tinted by what they do to the river: **red** if they add pollution or untreated sewage, **green** if they
     clean (riverside trees, or tiles covered by an STP), transparent if neutral.
   - STP radius circles are shown.
3. **Top bar:** a small river icon with the Ganga Health number and trend arrow (Varanasi map only). Clicking it turns on the Ganga overlay.
4. **Statistics panel:** a "Ganga Health" row and a history chart line, like the other stats (add it to `history` points).
5. **Tile info:** clicking a catchment tile shows "Effect on Ganga: +X pollution" or "Treated by STP".

**Acceptance criteria:** the overlay makes it obvious which buildings hurt the river. The top-bar number and arrow update live.

---

### S2-T9: Tourism income

**Model** (config `TOURISM_CONFIG` in a new `src/lib/tourism.ts`, as pure functions):

```
for each ghat (and later, landmarks):
  base          = GHAT_BASE_INCOME (₹12, a MONTHLY rate like stats.income; money is paid weekly as (income − expenses) / 4)
  riverFactor   = (gangaHealth / 100) ^ 1.5            // dirty river → far fewer visitors
  accessFactor  = road within 3 tiles ? 1.0 : 0.25
  commerceBonus = 1 + 0.08 × (commercial tiles within 4 tiles), capped at 1.8
  clusterBonus  = 1 + 0.05 × (other ghats within 3 tiles), capped at 1.5   // a row of ghats beats scattered ones
  ghatIncome    = base × riverFactor × accessFactor × commerceBonus × clusterBonus
tourismIncome   = Σ ghatIncome
```

**Steps:**
1. Implement the functions and add `tourismIncome` to `income` in the stats calculation. Also store `stats.tourismIncome?: number`.
2. **Budget panel:** show income split into "Taxes" and "Tourism".
3. **Design target (tune until true):** in a healthy mid-game city (displayed population about 1 lakh, Ganga Health about 70, about 20 ghats in rows),
   tourism should be **15–25% of total income**. If it is not, adjust `GHAT_BASE_INCOME` only. Record the final value and why in the task commit message.
4. Tests for the pure functions (a clean river pays more than a dirty one, access matters, and the caps work).

**Acceptance criteria:** the design target is met in a test city. The budget shows tourism separately.

---

### S2-T10: Boats on the Ganga

**Files to read:** `src/components/game/boatSystem.ts`, `findMarinasAndPiers` (find where it is defined with a code search), `drawing.ts` / boat drawing code.

**Steps:**
1. Treat **ghats** as boat docks, in addition to marinas and piers.
2. On the Varanasi map, boats spawn at ghats and travel to **another ghat** along the river. Boats must stay on Ganga water tiles.
3. Boat count: at most `1 per 3 ghats`, capped by `QUALITY_PRESETS` (from S1-T7). Low quality = none.
4. Use the existing boat sprite for now (wooden rowing boats come with Sprint 3 art).
5. At **dusk** (in-game hour 18–20), boats near ghats carry a small lamp glow if night lighting is on (tiny touch; skip if it costs frame time).

**Acceptance criteria:** with 6+ ghats built, boats travel between them. The HUD shows the boat count. No frame-time regression on the benchmark.

---

### S2-T11: Tips, balance pass and sign-off

**Steps:**
1. Add contextual tips (in `useTipSystem.ts`, same pattern as existing tips):
   - `build_first_ghat`: shown when the displayed population exceeds 5,000 and there are no ghats. "Pilgrims come to Varanasi for the ghats. Build some on the Ganga's west bank to earn tourism income."
   - `ganga_falling`: shown when the Ganga Health trend has pointed down for 10 in-game days. "The Ganga is getting dirtier. Open the Ganga overlay to see what's polluting it."
   - `needs_stp`: shown when sewage is more than 50% of `netLoad`. "Untreated sewage is flowing into the Ganga. A Sewage Treatment Plant near homes will help."
2. Play a new Varanasi game for **45 minutes**. Write down: when the first ghat was affordable, the Ganga Health over time, and the tourism share of income.
   Tune the config values if the design targets are not met.
3. Rerun the Sprint 1 benchmark on a **Varanasi** map of 160 filled with buildings and add rows to perf-log.md. Performance targets must still pass.

## 5. Sprint exit criteria

- [ ] All tasks ticked.
- [ ] The owner confirms the map "reads as Varanasi".
- [ ] Ganga cause and effect is visible within one in-game day of a change.
- [ ] Tourism share design target met.
- [ ] Sprint 1 performance targets still pass (perf-log.md rows added).
- [ ] Old saves (random maps) still load and play.

## 6. Notes for later

*(Implementers: add things you noticed but did not do here.)*

- **S2-T8 (UI, steps 3–5):** the top-bar Ganga chip *toggles* the Ganga overlay (a second click turns it off), because the
  desktop overlay panel can be hidden. On mobile the chip sits in the second (R/C/I) row; the tile-info "Effect on Ganga" is an
  extra line under the mobile tile row. A home only partly covered by an STP shows "Partly treated by STP" next to its untreated
  sewage. In the screenshot session the Ganga overlay tinted catchment land red/green as expected, but the **river water tiles did not
  visibly change colour** by Ganga Health: check how `getGangaRiverColor` fills are drawn for water tiles in `CanvasIsometricGrid.tsx`.
- The new tile-info and chip strings are plain English (TileInfoPanel was already untranslated); wrap them in `msg()` when the panels are translated.
- **S2-T11 step 1:** the three Ganga tips run inside the existing 5-second tip check. `ganga_falling` and `needs_stp` read a context
  that `useTipSystem` refreshes once per in-game day (a counter of consecutive "down" days, and sewageLoad vs netLoad from
  `gatherGangaInputs`); a day jump of more than 30 days (a loaded save) restarts the count. Thresholds are in `GANGA_TIPS_CONFIG`
  (`src/lib/gangaTips.ts`). Steps 2–3 (45-minute playtest, Varanasi benchmark) are not done.
