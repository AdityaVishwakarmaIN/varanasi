# Sprint 3: Indian City Life

> **Read first:** [README.md](README.md), [00-game-design.md](00-game-design.md).
> **Depends on:** Sprint 2 finished (Varanasi map, `mapId`, river zones, Ganga Health, ₹ formatting).
> **Pillars served:** P4 Unmistakably Varanasi, P3 Proud problem-solver, P5 Familiar to play.

---

## 1. Goal

By the end of this sprint, the city **looks, moves and struggles like an Indian city**:

1. Buildings use a new **Varanasi sprite pack** (sandstone, rooftop water tanks, bazaars).
2. The build menu uses **Indian names**, and Western-only buildings are hidden on the Varanasi map.
3. Roads carry a **mix** of cars, autos, e-rickshaws, motorbikes, cycle-rickshaws, buses and the occasional **cow**.
4. Dense commercial areas become **mixed-use** (shops below, homes above).
5. **Power cuts** happen when demand is higher than supply (rolling blackouts, not all-or-nothing).
6. **Water shortages** happen when supply is short.
7. **Informal settlements** appear when housing is short, and the player can formalise them.
8. **Pilgrim crowds** gather at the ghats.

## 2. Game-development principles used in this sprint

| Principle | Plain-English meaning |
|-----------|----------------------|
| **Reskin before rebuild** | Change what things *look like* and *are called* before inventing new systems. Existing IDs stay, so saves keep working. |
| **Readability over realism** | Traffic may look chaotic, but the player must still see at a glance where it is jammed. Detail never hides information. |
| **Soft failure states** | Power and water shortages degrade the city gradually (rotating cuts), which is easier to understand and fix than a sudden total collapse. |
| **Emergent problems** | Informal settlements grow **from the rules** (housing demand plus nearby jobs), not from a random script. The player can trace them to a cause. |
| **Keep every system on a budget** | New entities (cows, pilgrims, rickshaws) obey the entity caps and `QUALITY_PRESETS` from Sprint 1. |

## 3. What exists today (read before starting)

| Thing | Where | Notes |
|-------|-------|-------|
| Sprite packs | `src/lib/renderConfig.ts`: `SPRITE_PACKS`, `SPRITE_PACK_SPRITES4_CHINA` (around line 731) | A themed pack is a **copy of the default pack** with different image files but **the same sheet layout**. Follow the China pack exactly. |
| Sprite pipeline | `skills/varanasi-image-to-asset/SKILL.md`, `ai-design/terms.md`, `skills/adding-asset-sheets.md` | How to turn an AI-generated sheet into game assets (red `#FF0000` background, 960×960, PNG + WebP). |
| Tool names | `TOOL_INFO` in `src/games/isocity/types/game.ts` | Change `name` / `description`, **never the keys**. |
| Build menu groups | `src/components/game/Sidebar.tsx`, `src/components/mobile/MobileToolbar.tsx` | |
| Cars | `Car` type in `src/components/game/types.ts` line 14; `vehicleSystems.ts`, `trafficSystem.ts` | Cars are drawn in code with a `color`. There is no vehicle "kind" yet. |
| Pedestrians | `pedestrianSystem.ts`, `drawPedestrians.ts`; `PedestrianDestType` in `types.ts` line 216 | |
| Power and water | `calculateServiceCoverage` in `simulation.ts` around line 1309; `SERVICE_CONFIG` around line 1287 | Today coverage is **yes/no by range**. There is no capacity limit. |
| Abandonment | `simulation.ts` around line 1621 | Buildings are abandoned when demand is very negative. |
| Stats | `Stats` in `src/games/isocity/types/economy.ts` | |

---

## 4. Tasks

- [ ] S3-T1: Build-menu curation and Indian names
- [ ] S3-T2: Varanasi sprite pack
- [ ] S3-T3: Ghat, STP and new-building art
- [ ] S3-T4: Mixed traffic (vehicle kinds)
- [ ] S3-T5: Cows
- [ ] S3-T6: Mixed-use commercial
- [x] S3-T7: Power capacity and rolling power cuts
- [x] S3-T8: Water capacity, the Jal Sansthan water works and shortages
- [x] S3-T9: Informal settlements
- [x] S3-T10: Pilgrim crowds at the ghats
- [ ] S3-T11: Balance pass and sign-off

---

### S3-T1: Build-menu curation and Indian names

**Why:** the fastest, cheapest way to make the game feel Indian (principle: *reskin before rebuild*).

**Steps:**
1. Create `src/games/isocity/maps/varanasiCatalog.ts` with two maps: `VARANASI_DISPLAY` (tool/building ID → `{ name, description }`) and
   `VARANASI_HIDDEN_TOOLS` (a set of tool IDs hidden from the build menu on the Varanasi map).
2. When `mapId === 'varanasi'`, the build menu, tile info and tooltips use `VARANASI_DISPLAY` names where present. Otherwise they use `TOOL_INFO`.
   Wrap the new strings with `msg(...)` like the existing ones.
3. Use these starting values:

| ID | Varanasi name | Description |
|----|---------------|-------------|
| `police_station` | Police Thana | Keeps the neighbourhood safe |
| `fire_station` | Fire Station | Fights fires in dense lanes |
| `hospital` | District Hospital | Improves health (2×2) |
| `school` | Government School | Basic education (2×2) |
| `university` | College | Higher education (3×3). BHU arrives as a landmark later |
| `power_plant` | Thermal Power Station | Generates electricity (2×2) |
| `water_tower` | Overhead Water Tank | Stores and supplies water |
| `city_hall` | Nagar Nigam Office | Municipal headquarters. Boosts all demand |
| `stadium` | Cricket Stadium | Boosts commercial demand (3×3) |
| `baseball_field_small` | Cricket Ground | Local cricket ground (2×2) |
| `basketball_courts` | Kabaddi Court | Outdoor kabaddi court |
| `tennis` | Badminton Court | Recreation |
| `amusement_park` | Mela Ground | Fairground. Major boost to commercial demand |
| `community_center` | Community Hall | Local gathering place |
| `pond_park` | Kund | A traditional stepped water tank with a garden |
| `animal_pens_farm` | Gaushala | Cow shelter. Reduces stray cows (see S3-T5) |
| `greenhouse_garden` | Plant Nursery | Greenery |
| `marina_docks_small` | Boat Jetty | Riverside boat landing |
| `park` / `park_large` | Park / Large Garden | |
| `zone_residential` / `zone_commercial` / `zone_industrial` | Residential / Bazaar & Commercial / Industrial | |

4. **Hidden on the Varanasi map** (`VARANASI_HIDDEN_TOOLS`): `space_program`, `baseball_stadium`, `football_field`, `mini_golf_course`,
   `go_kart_track`, `skate_park`, `mountain_lodge`, `mountain_trailhead`, `cabin_house`, `campground`, `roller_coaster_small`, `pier_large`,
   `bleachers_field`. **Existing buildings of these types in a save still work and draw.** Only the menu hides them.

**Acceptance criteria:** on a Varanasi map, the menu shows the Indian names and none of the hidden tools. On a random map, nothing changed.

---

### S3-T2: Varanasi sprite pack

**Why:** pillar P4. This is the single biggest visual change.

**Files to read:** `src/lib/renderConfig.ts` (the whole default pack `SPRITE_PACK_SPRITES4` and the China pack), `skills/varanasi-image-to-asset/SKILL.md`,
`skills/adding-asset-sheets.md`, `ai-design/terms.md`, `ai-design/image-to-asset-sop.md`.

**Art direction (give this to whoever makes the images):**
- Warm, realistic isometric pixel art in the **same camera angle, scale and grid layout** as the existing sheets.
- Palette: sandstone and ochre, faded pastel plaster (pink, yellow, turquoise), whitewash, terracotta, weathered concrete.
- Details: black plastic **rooftop water tanks**, laundry lines, shop signboards (no readable brand names), steel shutters, small temple shikharas on
  some rooftops, satellite dishes, peepal trees.
- Background: solid bright red `#FF0000` (required by the pipeline's chroma-key).

**Mapping (what each existing sprite should become):**

| Existing building IDs | Varanasi look |
|-----------------------|---------------|
| `house_small`, `house_medium` | 1–2 storey pucca houses with flat roof terraces and water tanks |
| `mansion` | A haveli with a courtyard and carved jharokha windows |
| `apartment_low`, `apartment_high` | 4-storey and 8–10-storey concrete apartment blocks with balconies and tanks |
| `shop_small`, `shop_medium` | Bazaar shops with homes above (matches mixed-use, S3-T6) |
| `office_low`, `office_high` | Commercial complexes, bank branches |
| `mall` | A modern mall with a big signboard |
| `factory_*`, `warehouse` | Small workshops, a brick kiln with a chimney, silk-weaving (Banarasi saree) sheds, godowns |
| `police_station`, `fire_station`, `hospital`, `school` | Government buildings with cream/red paint and a boundary wall |
| `power_plant` | Thermal plant with cooling towers |
| `water_tower` | Concrete overhead water tank on pillars |
| Trees | Peepal, neem, banyan, ashoka |

**Steps:**
1. Produce the sheets following the pipeline skill: main, dense, modern, construction, abandoned and parks (the same set the default pack has).
   Keep the raw AI images in `ai-design/varanasi/` and the processed assets in `public/assets/`.
2. Add `SPRITE_PACK_VARANASI` to `renderConfig.ts` following the China pack: `id: 'varanasi'`, `name: 'Varanasi'`, pointing to the new files.
   Register it in `SPRITE_PACKS`.
3. On the Varanasi map, use the `varanasi` pack **by default**. Players can still change it in Settings.
4. If some sheets are not ready, leave those keys pointing to the default pack's files (the China pack does this) and note it in "Notes for later".

**Acceptance criteria:** a Varanasi map uses the new pack. No sprite is misaligned, cut off or shows a red fringe (check at zoom 1× and 3×).

---

### S3-T3: Ghat, STP and new-building art

**Steps:** using the same pipeline, replace the Sprint 2 placeholders with real sprites for: `ghat` (sandstone steps with a small chhatri umbrella or
shrine on some variants, **2–3 variants** chosen by tile position so a row does not look repetitive), `sewage_treatment_plant`, and
`informal_housing` and `jal_sansthan_water_works` (defined later in this sprint, so produce them now to batch the art work).
Adjacent ghats must join visually into one continuous stepped bank.

**Acceptance criteria:** a row of 10 ghats reads as one long riverfront. There are no visible seams at zoom 2×.

---

### S3-T4: Mixed traffic (vehicle kinds)

**Files to read:** `Car` type (`types.ts` line 14), `vehicleSystems.ts` (spawning and movement), `trafficSystem.ts`, the car drawing code (search `drawCar`).

**Steps:**
1. Add `kind: VehicleKind` to `Car`, where
   `type VehicleKind = 'car' | 'auto' | 'erickshaw' | 'motorbike' | 'cycle_rickshaw'`. Buses already exist separately.
2. Config `VEHICLE_MIX` in a new `src/lib/trafficConfig.ts` (starting values):

   | Kind | Share (Varanasi map) | Share (random map) | Speed multiplier | Look (drawn in code, like cars today) |
   |------|----------------------|--------------------|------------------|--------------------------------------|
   | car | 30% | 100% | 1.0 | as today |
   | auto | 25% | 0% | 0.8 | small 3-wheeler: yellow-green body, black canopy |
   | erickshaw | 15% | 0% | 0.6 | small boxy 3-wheeler, blue or green canopy |
   | motorbike | 25% | 0% | 1.1 | thin, one rider |
   | cycle_rickshaw | 5% | 0% | 0.4 | bicycle plus a small covered seat |

3. **Lane logic:** slower vehicles slow down vehicles directly behind them on the same tile and lane (they already follow each other, so check how).
   Motorbikes may **overtake** (shift lane offset) when blocked for more than 1 second.
4. **LOD:** below zoom 0.8 (see `getLODLevel`), draw every vehicle kind as the same simple coloured dot or rectangle. The detail is invisible anyway, and it keeps frame time low.
5. The vehicle count still obeys the `QUALITY_PRESETS` cap. Add the per-kind counts to the perf HUD entities.

**Acceptance criteria:** the Varanasi map shows the mix, with slow vehicles visibly creating queues. The random map is unchanged. There is no frame-time regression on the benchmark (add a perf-log row).

---

### S3-T5: Cows

**Why:** instantly recognisable, a bit funny, and a small traffic mechanic.

**Rules (config `COW_CONFIG`):**
- Cows are **wandering entities on roads** (a separate small list, not cars). Maximum `min(40, roadTiles / 60)`, lower on Low quality.
- A cow walks slowly along roads, sometimes **stands still for 5–20 seconds** in the middle of a road tile, then moves on.
- Vehicles approaching a standing cow on the same tile **slow to 30% speed** (they drive around it, they do not stop completely), so traffic never deadlocks.
- Each **Gaushala** (`animal_pens_farm`) reduces the maximum cow count by 10 (to a minimum of 0). This gives the player a way to control them.
- Draw: simple white or grey cow shape. Skip below zoom 0.8.
- Cows **never** affect pathfinding or block building placement.

**Acceptance criteria:** cows appear, pause on roads, cause gentle slowdowns and never cause a permanent jam. Building Gaushalas visibly reduces them.

---

### S3-T6: Mixed-use commercial

**Why:** Indian cities grow shops downstairs and homes upstairs (design §5.2).

**Files to read:** `BUILDING_STATS` (commercial entries), the population calculation in `calculateStats`, and the building growth/level-up code in `simulation.ts`.

**Rule (config `MIXED_USE_CONFIG`, applies to **all maps**):**
- Commercial buildings `shop_small`, `shop_medium` and `office_low` at **level ≥ 2** also house residents:
  `residents = maxJobs × MIXED_USE_RESIDENT_RATIO (0.4)`, scaled by the building's level the same way jobs are.
- These residents count toward population, taxes and service needs exactly like normal residents.
- Tile info shows "Shops: N jobs · Homes above: M residents".

**Acceptance criteria:** a dense bazaar street raises population. Tile info shows both numbers. A unit test covers the resident calculation.

---

### S3-T7: Power capacity and rolling power cuts

**Why:** load-shedding is a signature Indian city problem, and a good planning puzzle.

**Model (config `POWER_CONFIG` in a new `src/lib/utilities.ts`, as pure functions):**

```
supply  = Σ over powered-and-working power plants of PLANT_CAPACITY (5000) × (1 + 0.2 × (level − 1))
demand  = Σ over all buildings in power coverage of (population + jobs × 0.5)
          × seasonMultiplier  (1.0 for now; Sprint 4 sets 1.3 in summer)
ratio   = min(1, supply / demand)

Feeder zones: the map is divided into square blocks of FEEDER_SIZE (16) tiles.
If ratio < 1:
  cutFraction  = 1 − ratio
  blocksToCut  = round(cutFraction × numberOfBlocksWithDemand)
  Every in-game HOUR, choose which blocks are cut using a ROTATION (block index + hour, modulo),
  so the same neighbourhood is never cut all the time.
  Buildings in cut blocks are treated as unpowered for that hour.
```

**Steps:**
1. Implement the pure functions plus tests (supply/demand maths, and that rotation is fair: over 24 hours every block with demand is cut roughly the same number of hours).
2. Apply cuts **on top of** the cached coverage from S1-T5. Do **not** break the cache: coverage stays cached, and the cut mask is a separate small array per hour.
3. **Effects** of being cut: no growth or level-up during the cut, happiness −, and commercial income from that tile × 0.5 during the cut.
4. **UI:**
   - Top bar: a power icon with `supply %`. It turns amber below 100% and red below 80%.
   - The power overlay shows cut blocks darkened, with a small ⚡✕ icon.
   - Advisor message when ratio first drops below 1: "Demand is higher than supply. Neighbourhoods are taking turns without power. Build another power station."

**Acceptance criteria:** growing a city without adding plants causes visible rotating cuts. Adding a plant ends them. There is no tick-time regression.

---

### S3-T8: Water capacity, the Jal Sansthan water works and shortages

**Same idea as power**, with a link to the Ganga:

- `water_tower` (Overhead Water Tank) capacity: `TANK_CAPACITY = 1500`.
- **New building `jal_sansthan_water_works`** (append to `BUILDING_STATS`). Name: "Jal Sansthan Water Works". 3×3, cost ₹6,000, needs power,
  **must be within 3 tiles of the Ganga** (use `getDistanceToGanga`). Capacity `WORKS_CAPACITY = 12000 × (0.6 + 0.4 × gangaHealth / 100)`, so a
  dirtier river costs more to treat, which ties the river to the city. Upkeep goes on the water budget line. Visible only on the Varanasi map.
- Demand = population × 1.0 (× season multiplier, 1.0 for now).
- Shortage → **rotating supply** (same feeder-zone rotation as power, using `ratio`). Tiles without water: no growth, health −10 on the tile,
  happiness −. Advisor: "Taps are running dry in some neighbourhoods. Add water tanks, or build a Jal Sansthan Water Works by the Ganga."
- Top bar: a water-drop icon with supply %.

**Acceptance criteria:** as with power. Plus: lowering Ganga Health (in a test) lowers the water works' capacity.

**Done (notes):**
- S3-T7 and S3-T8 share one model: `src/lib/utilities.ts` (config + pure maths), `src/lib/utilityCuts.ts` (cuts applied as a
  copy on top of the cached coverage, so the S1-T5 cache is never written), and the wiring in `simulateTick`/`calculateStats`.
  The cut set for a tick comes from the previous tick's stats and changes once per in-game hour (`getRotationHour`).
- Top bar: `UtilityChip` (power and water, amber < 100%, red < 80%); clicking a chip toggles its overlay. On mobile the chips
  only show while supply is short.
- `jal_sansthan_water_works`: 3×3, ₹6,000, ₹300/month on the water line, range 20. Needs power to be built and to supply.
  Placement is checked in `placeBuilding` and explained in the preview ("must be within 3 tiles of the Ganga", or
  "Can't build on water" when the footprint overlaps the river). Varanasi only (Riverfront group).
- New random cities are topped up with plants/tanks (`ensureUtilityCapacity`) so they don't open in a blackout; the raw
  generator (goldens, `?bench=`) is unchanged and runs with cuts. Golden fingerprint tests run with capacity switched off.
- Tests: `utilities.test.ts`, `utilityCuts.test.ts`, `waterWorks.test.ts` (incl. "a dirtier Ganga lowers the works' supply").

---

### S3-T9: Informal settlements

**Why:** a real and sensitive Indian urban issue, handled as a **system to solve**, never as a joke.

**Definition:**

| Field | Value |
|-------|-------|
| ID | `informal_housing` (append to `BUILDING_STATS`) |
| Player can place it? | **No.** It spawns by itself. It is not in any menu |
| Name shown | "Informal Settlement" |
| Size | 1×1 |
| Residents | same as `house_medium` |
| Pays tax | **No** |
| Crime | +50% on the tile |
| Fire chance | ×2 |
| Health | −10 on the tile if it has no water |

**Spawn rule** (checked once per in-game **week**, config `INFORMAL_CONFIG`):
- Only if residential demand > 40 **and** there are fewer than `(population × 0.02)` empty residential-zoned tiles (not enough housing).
- Choose up to `MAX_SPAWNS_PER_WEEK = 3` empty, unzoned **grass** tiles within 6 tiles of commercial or industrial buildings and within 2 tiles of a road.
  Prefer tiles in `eastFloodplain` or `westRiverfront` (realistic, and it sets up the flood risk in Sprint 4).
- Never on a tile the player bulldozed in the last 30 in-game days.

**Player choices:**
1. **Formalise (the good path):** if an informal tile is **zoned residential** by the player and has road access, power and water for **30 in-game days**,
   it automatically becomes a `house_small`, with a notification: "Families in <area> now have proper homes." Happiness goes up.
2. **Bulldoze:** allowed, but applies a happiness penalty (−3 city-wide for 60 days, config) and a notification: "Families were displaced."
3. **Ignore:** it stays, with its crime, fire and health costs.

**Acceptance criteria:** settlements appear when housing is short and near jobs. Zoning plus services formalises them. Tile info explains how to formalise.
There are unit tests for the spawn conditions.

**Done (notes):**
- Pure rules stay in `src/lib/informal.ts`. `src/lib/informalSim.ts` applies them to the grid: candidate gathering with
  prefix-sum box queries (jobs within 6, road within 2), daily formalisation, weekly spawns, bulldoze bookkeeping.
  State lives in `GameState.informal` (bulldoze days for the 30-day cooldown, formalisation day counts, penalty/bonus end days).
- Crime is not simulated per tile, so "+50% crime on the tile" is applied to city safety, weighted by the share of people
  living in settlements. The health penalty is weighted the same way by the share with no water coverage.
- Settlements pay no tax, can catch fire (×2 chance), do not evolve while zoned, and keep their building when dezoned.
  Zoning over one is allowed only as residential (the formalise path).
- Bulldozing one: −3 happiness for 60 days and a "Families displaced" notification. Formalising: +1 for 60 days and
  "Families in <mohalla> now have proper homes." (mohalla name on Varanasi). Notifications are stored in
  `state.notifications`; the S4 notifications task shows them.
- Tile info shows "Informal Settlement", the formalise hint and the day count. Minimap colour is ochre.
- Golden fingerprints run with settlements switched off (`setInformalSettlementsEnabled`). A 60-map probe city with full
  demand gets 3 settlements per week, as specified.
- Tests: `informal.test.ts` (rules), `informalSim.test.ts` (spawn conditions, cooldown, formalisation, bulldoze, no tax).

---

### S3-T10: Pilgrim crowds at the ghats

**Files to read:** `pedestrianSystem.ts`, `PedestrianDestType` (`types.ts` line 216).

**Steps:**
1. Add `'ghat'` to `PedestrianDestType`. On the Varanasi map, a share of pedestrians (`PILGRIM_SHARE = 0.3`) choose the nearest reachable ghat as their destination.
2. At ghats, pedestrians linger (sit or stand) for longer than at other destinations.
3. The crowd size at ghats scales with `stats.tourismIncome` (more tourism means more people), capped by `QUALITY_PRESETS`.
4. Peak times: dawn (hour 5–8) and dusk (hour 17–20). Quieter at midday.
5. Pilgrims look slightly different: saffron, white or orange clothing colours.

**Acceptance criteria:** the ghats look busy at dawn and dusk and quiet at noon. There is no frame-time regression.

---

### S3-T11: Balance pass and sign-off

1. Play a Varanasi game for **60 minutes**. Check that power and water cuts happen **only** when the player under-builds, that informal settlements appear in a growing city and can be formalised, and that traffic looks Indian but readable.
2. Rerun the benchmark on a full Varanasi 160 map and add perf-log rows. Sprint 1 targets must still pass.
3. Screenshot the default view at dusk with a busy ghat row for the owner's sign-off.

## 5. Sprint exit criteria

- [ ] All tasks ticked.
- [ ] The owner signs off on the look (screenshots).
- [ ] Power, water and informal settlement systems are each understandable from UI text alone (ask someone who hasn't seen the code).
- [ ] Sprint 1 performance targets still pass.
- [ ] Old saves still load.

## 6. Notes for later

*(Implementers: add things you noticed but did not do here.)*

- **Pure logic landed first (S3 part 1).** `src/lib/utilities.ts`, `mixedUse.ts`, `informal.ts`, `trafficConfig.ts` and `pilgrims.ts`
  hold the rules and configs with unit tests; the simulation/UI wiring is still to do.
- **Rolling-cut fairness needs an absolute hour.** `getCutFeeders` rotates by `(hour × k) mod n` so consecutive hours continue where the
  last one stopped (max − min cut hours ≤ 1 over any run of hours). Pass `toAbsoluteHour(...)`, not hour-of-day, or the same feeders get
  the "extra" cut hour every day. Fairness assumes the set of feeders with demand and the cut count stay the same across those hours.
- **Starting values not in the doc** (tune in S3-T11): per-tile happiness penalty during a power or water cut (5), water tank level bonus
  (20% per level, mirroring power plants), informal preferred-zone weight (×4) and job-proximity bonus, pilgrims per ₹ of tourism income
  (0.5), cow pause chance per tile (0.15) and cow walk speed (0.15 × car).
- **`tile.traffic` is never written** by the simulation today (always 0), so anything that reads it (e.g. S5-T4's access check) needs a real
  traffic measure first.
