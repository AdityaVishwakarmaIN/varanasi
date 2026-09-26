# Sprint 5: Festivals, Landmarks, Feedback, Audio and Launch

> **Read first:** [README.md](README.md), [00-game-design.md](00-game-design.md).
> **Depends on:** Sprint 4 finished (seasons, calendar strip, crisis notifications with location, failure states).
> **Pillars served:** P4 Unmistakably Varanasi, P3 Proud problem-solver, P5 Familiar to play, P1 Never stutters (final check).

---

## 1. Goal

By the end of this sprint the game is **ready for real players**:

1. **Landmarks** unlock at population milestones and give big rewards: the long-term goals.
2. **Festivals** make the city come alive. **Dev Deepawali** and **Maha Shivratri** are management events the player prepares for.
3. The three-layer **feedback system** is complete: problem icons, named advisors, and a citizen feed.
4. **Contextual tips** cover every system.
5. **Music and sound** are in.
6. **Mobile** is polished end to end.
7. The game passes a **launch checklist** (performance, saves, credits, errors).

## 2. Game-development principles used in this sprint

| Principle | Plain-English meaning |
|-----------|----------------------|
| **Goals create meaning** | A sandbox needs something to aim for. Landmarks at milestones give "one more hour" motivation without forcing a win condition. |
| **Anticipation beats surprise** | A festival announced 30 days ahead, with a readiness checklist, is more fun than a random event. Planning *is* the gameplay. |
| **Juice** | Small effects (diyas lighting up, colour puffs, a satisfying placement sound) make actions feel rewarding. Keep them cheap and optional (quality presets). |
| **Progressive disclosure** | Teach a system only when it first matters (tips), so new players are not overwhelmed. |
| **Respectful representation** | Real religious sites and festivals are shown with care: no damage, no jokes about them, no destruction effects. |
| **Ship it measured** | Before launch, rerun every performance and save test. Launch with numbers, not hopes. |

## 3. What exists today (read before starting)

| Thing | Where | Notes |
|-------|-------|-------|
| Special buildings with demand bonuses | `stadium`, `museum`, `city_hall`, `airport` in `simulation.ts` (`calculateStats` around line 1930) | Copy this pattern for landmark bonuses. |
| Fireworks | `Firework` types in `src/components/game/types.ts` around line 438; `effectsSystems.ts` | **Reuse for Diwali.** |
| Night lighting | `src/components/game/lightingSystem.ts`, `lightingRenderer.ts`, `sceneLighting.ts` | **Reuse for diyas and Diwali lights.** |
| Advisors | `src/components/game/panels/AdvisorsPanel.tsx`, `AdvisorMessage` type | |
| Names generator | `src/lib/names.ts` | For the citizen feed. |
| Tips | `src/hooks/useTipSystem.ts` | |
| Calendar strip and forecasts | Sprint 4 (S4-T1, S4-T4) | Festivals go on the strip. |
| Mobile UI | `src/components/mobile/` | |
| Analytics | `@vercel/analytics` in `package.json` | Already present. |

---

## 4. Tasks

- [x] S5-T1: Landmark framework and unlocks
- [x] S5-T2: The five landmarks
- [x] S5-T3: Festival calendar and visual festivals
- [x] S5-T4: Management events: Dev Deepawali and Maha Shivratri
- [x] S5-T5: Problem icons (feedback layer 1)
- [x] S5-T6: Named advisors (feedback layer 2)
- [x] S5-T7: Citizen feed (feedback layer 3)
- [x] S5-T8: Contextual tips for every system
- [x] S5-T9: Music and sound
- [x] S5-T10: Mobile polish
- [x] S5-T11: Undo last action (stretch) — skipped: owner declined
- [ ] S5-T12: Launch checklist

---

### S5-T1: Landmark framework and unlocks

**Steps:**
1. Create `src/lib/landmarks.ts` with a config `LANDMARKS` (data only, see S5-T2) and pure functions:
   - `getUnlockedLandmarks(peakDisplayedPopulation: number): LandmarkId[]`
   - `canPlaceLandmark(id, x, y, state): { ok: boolean; reason?: string }`
2. Add `peakPopulation?: number` and `landmarksBuilt?: LandmarkId[]` to `GameState`. Unlocks use the **peak** population, so a landmark stays unlocked even if the population later drops.
3. **Build menu:** a new **"Landmarks"** group (Varanasi map only). Locked landmarks show greyed out with a lock and "Unlocks at 1,00,000 people". Unlocked landmarks show their cost.
   **Each landmark can be built once.**
4. **Unlock moment:** when a landmark unlocks, show a celebratory notification (not a crisis), a short sound (S5-T9) and a glow on the Landmarks menu button until the player opens it.
5. **Protection:** landmarks **never** catch fire, collapse, become abandoned or take flood damage. Bulldozing one needs a confirm dialog and gives no refund.
6. The progress to the next landmark is shown in the Statistics panel: "Next landmark: Sarnath at 3,00,000 (you: 2,41,000)".

**Acceptance criteria:** unlock thresholds work from the peak population, each landmark can be built only once, and protection works (unit tests for the unlock and placement functions).

**Done:** `src/lib/landmarks.ts` (config + pure functions, tests in `landmarks.test.ts`). `GameState.peakPopulation` (simulation units) / `landmarksBuilt` / `landmarksSeen` (all optional). `simulateTick` tracks the peak and posts a gold "Landmark unlocked" notification (icon `landmark`, severity `info`); old saves start tracking silently; toggle `setLandmarkUnlocksEnabled` (off in the golden tests). Landmarks group (Varanasi only) in the sidebar, mobile toolbar and command menu: locked = greyed + lock + "Unlocks at N people", built = "Built"; the group (and the mobile "more" button) pulses until opened. `placeBuilding` refuses locked/duplicate/badly placed landmarks (red reasons via `placement.ts`). Protection: no fire (`isBuildingFireEligible`), no flood damage (`getFloodDamageChance`), no collapse (`runCollapseDay`); abandonment never applied (not zoned). Bulldozing asks first (`LandmarkBulldozeDialog`) and refunds nothing; it removes the id from `landmarksBuilt`, so the landmark can be rebuilt at full price. Statistics panel shows "Next landmark: X at N (you: M)". **Deferred:** the unlock sound (S5-T9, no audio module yet).

---

### S5-T2: The five landmarks

Append each ID at the **end** of `BUILDING_STATS`. The art goes through the sprite pipeline with **extra care for accuracy and respect**: recognisable silhouettes, no invented
religious imagery, no text.

| ID | Name | Unlock (displayed pop.) | Size | Cost | Placement | Effects (starting values) |
|----|------|-------------------------|------|------|-----------|---------------------------|
| `landmark_dashashwamedh` | Dashashwamedh Ghat | 50,000 | 2×2 | ₹15,000 | Must include at least 2 `westRiverfront` tiles | Counts as **4 ghats** for tourism. The nightly **Ganga Aarti** happens here (S5-T3). Happiness +2 city-wide |
| `landmark_kashi_vishwanath` | Kashi Vishwanath Temple | 1,00,000 | 2×2 | ₹40,000 | Within 8 tiles of the Ganga (west bank) | Tourism +₹150/tick × Ganga factor. Commercial demand +10. Pilgrim crowds (S3-T10) ×2 within 10 tiles. Needed for Maha Shivratri to be at full scale |
| `landmark_bhu` | Banaras Hindu University | 2,00,000 | 4×4 | ₹60,000 | Any land, **not** in a flood zone | Education coverage with 2× university range. Residential demand +10. Commercial demand +5 |
| `landmark_sarnath` | Sarnath | 3,00,000 | 3×3 | ₹50,000 | Northern quarter of the map (`v < 0.25`, west of the Ganga) | International tourism +₹200/tick (**not** affected by Ganga Health). Happiness +3 |
| `landmark_ramnagar_fort` | Ramnagar Fort | 5,00,000 | 3×3 | ₹80,000 | East bank (`eastBank` zone, **not** floodplain) | Tourism +₹250/tick. Boat routes (S2-T10) also run to the fort. Land value +20 within 6 tiles |

**Acceptance criteria:** all five can be unlocked, placed (with clear red reasons when a spot is not allowed) and give their effects. The owner signs off on the art.

**Done:** ids appended at the end of `BuildingType`/`BUILDING_STATS`/`Tool`/share-format lists; `TOOL_INFO` costs and sizes as in the table; procedural placeholder sprites in `varanasiSprites.ts`. Effects through existing systems in `calculateStats`: happiness and R/C demand bonuses, Dashashwamedh as 4 extra ghats in `calculateTourismIncome`, flat tourism (Kashi and Ramnagar × Ganga factor, Sarnath not), BHU as an education service building with 2× university range, Ramnagar land value +20 within 6 tiles (`getEffectiveLandValue`). **Deferred:** Kashi's local pilgrim-crowd ×2 within 10 tiles (only the city-wide tourism effect applies), boat routes to Ramnagar Fort, the Ganga Aarti / full-scale Shivratri hooks (left to S5-T3/T4; `landmarksBuilt` holds the standing landmarks), and the owner's art sign-off. Side effect: BHU can be upgraded like other service buildings.

---

### S5-T3: Festival calendar and visual festivals

**Steps:**
1. Create `src/lib/festivals.ts` with a config `FESTIVALS` (fixed dates, for simplicity; real festivals follow the lunar calendar, but fixed dates are fine for a game):

   | ID | Name | Date (month/day) | Duration | Type |
   |----|------|------------------|----------|------|
   | `maha_shivratri` | Maha Shivratri | 2/26 | 2 days | **management** (S5-T4) |
   | `holi` | Holi | 3/14 | 2 days | visual |
   | `diwali` | Diwali | 11/1 | 3 days | visual |
   | `chhath` | Chhath Puja | 11/6 | 2 days | visual |
   | `dev_deepawali` | Dev Deepawali | 11/15 | 1 day | **management** (S5-T4) |
   | `ganga_aarti` | Ganga Aarti | every day, visual hour 18–20 | — | visual |

2. Put every upcoming festival on the **calendar strip** (S4-T1), 30 days ahead.
3. **Visual festivals.** Every one of them respects `QUALITY_PRESETS`, and on Low they reduce to a simple tint or nothing:
   - **Ganga Aarti** (daily): small flickering lamp lights in a row on the Dashashwamedh landmark (or the largest ghat cluster if it is not built), plus a denser crowd there.
   - **Holi:** coloured powder puffs (pink, green, yellow, blue particles) over residential areas during the day. Reuse the particle patterns from smog or fireworks.
   - **Diwali:** warm small lights on buildings at night (reuse the night-lighting system) plus fireworks (reuse the firework system).
   - **Chhath:** crowds on the riverbank at dawn and dusk.
   - **Dev Deepawali visuals:** thousands of diyas: a warm light dot on **every** `westRiverfront` tile and every ghat. This must be **one batched draw**, not one draw per diya (check the perf HUD).
4. A small festival chip appears in the top bar during a festival ("🪔 Diwali").

**Acceptance criteria:** each festival appears on the right date and looks right. On the benchmark, festival nights stay within the frame budget (add perf-log rows for Dev Deepawali night).

**Done:** `src/lib/festivals.ts` (config, active/upcoming queries, crowd and tourism helpers) plus `src/lib/festivalSim.ts` (daily step, wired into `simulateTick` behind `setFestivalsEnabled`, which is off in the golden tests). Every festival goes on the season strip 30 days ahead (announced once per occurrence, Varanasi map only). Visuals live in `src/components/game/festivalDraw.ts` and are drawn on the existing air layer (CPU and Pixi): Dev Deepawali diyas on every riverfront tile and ghat in one batched path (plus one glow pass when zoomed in), Aarti lamps at Dashashwamedh or the largest ghat cluster, Holi puffs over homes (batched by colour), Diwali warm lights on lived-in buildings (batched, capped) plus the firework system forced on, with ghats as launch sites. Nothing is drawn on Low quality (`particleFraction` 0). Crowds go through the pedestrian/pilgrim multipliers. The top bar shows a festival chip. Deviations and deferrals: Diwali lights are a new batched draw, not the night-lighting worker. Chhath has no drawing of its own, only a denser crowd. Because a visual day is 450 ticks, a festival day is only about 1.6 visual hours, so lamps also show by day at reduced alpha. **Deferred:** the Dev Deepawali night perf-log rows need a browser benchmark run, which could not be done here.

---

### S5-T4: Management events: Dev Deepawali and Maha Shivratri

**Why:** design decision: "a few big festivals are crowd-management challenges". Principle: *anticipation beats surprise*.

**Event area:**
- Dev Deepawali: all `westRiverfront` tiles plus land within 5 tiles of any ghat.
- Maha Shivratri: within 10 tiles of Kashi Vishwanath (or, if it is not built, within 10 tiles of the largest ghat cluster, with visitors × 0.5).

**Readiness checklist** (computed live, shown in an **Event panel** that opens from the calendar strip or a notification 30 days before):

| Requirement | Pass if (inside the event area) | Hint text when failing |
|-------------|--------------------------------|------------------------|
| Crowd safety | average police coverage ≥ 70% | "Build police thanas near the ghats" |
| Fire and medical | average fire coverage ≥ 50% **and** a hospital in range of the area | "Add a fire station and hospital nearby" |
| Access | at least 1 road tile per 6 tiles of the area, **and** average traffic on those roads below `EVENT_TRAFFIC_LIMIT` | "Add roads or a rail station so visitors can get in" |
| Sanitation | water coverage ≥ 80% **and** Ganga Health ≥ 50 | "Improve water supply and clean the Ganga" |
| Lights on | city power supply ratio = 100% (no rolling cuts) | "Add power capacity. Cuts during the festival would be a disaster" |

**Outcome** (applied on the festival day):

| Requirements passed | Result |
|---------------------|--------|
| 5 | **Triumph:** tourism × 3 during the event, happiness +5 for 60 days, notification "Dev Deepawali was magnificent! Visitors are raving." |
| 3–4 | **Success:** tourism × 2 during the event, happiness +2 |
| 0–2 | **Overwhelmed:** tourism × 1, happiness −5 for 30 days, a crisis notification naming the failed requirements ("Crowds overwhelmed the ghats: not enough police, traffic jams"). **No** injuries or deaths are shown. Keep the tone serious, not dark |

- During the event: pedestrians in the event area × 3 (within the quality cap) and traffic spawns × 1.5 on roads leading in.
- The Event panel lets the player **click each failing requirement** to jump to the area with the relevant overlay on (reuse S4-T4).
- Unit tests: checklist evaluation for pass and fail inputs, and outcome selection.

**Acceptance criteria:** the player is told 30 days ahead, can see and fix each requirement, and the result matches the checklist.

**Done:** event areas, the live checklist and outcomes are in `festivals.ts` and `festivalSim.ts`, with unit tests in `festivals.test.ts` and `festivalSim.test.ts`. A notification with a location is sent 30 days ahead. On the day, the outcome is resolved and a notification is sent (crisis severity when overwhelmed, naming the failed requirements). Tourism × 3/× 2 applies for the event days and the happiness modifier lasts for its duration. Without Kashi Vishwanath, Shivratri runs at half scale around the largest ghat cluster. With no ghats, the event passes quietly. `FestivalPanel.tsx` provides a banner while an event is coming and an Event panel (opened from the banner, the calendar-strip icon or the notification). Each failing row jumps to the area with its overlay. Deviations: tiles carry no live traffic value, so road traffic is estimated from people per road tile (a rail station counts as 6 road tiles). There is no traffic overlay, so the Access row jumps without one. Pedestrians × 3 and cars × 1.5 are applied to the in-view spawn caps (still within the quality caps), not only inside the event area. "Success" happiness +2 lasts 30 days (not specified in the plan).

---

### S5-T5: Problem icons (feedback layer 1)

**Steps:**
1. Standardise **one set** of small icons drawn above buildings: no power ⚡, no water 💧, no road access 🛣, on fire 🔥, flooded 🌊, disease ☣, rolling cut (power flicker),
   and abandoned. Use simple drawn shapes or a tiny icon sprite sheet, not emoji fonts (they render differently on each device).
2. **One icon per building at most**, chosen by priority: fire > flood > disease > no road > no power > no water > abandoned.
3. **LOD:** below zoom 0.6, show **district-level** icons instead (one icon per 16×16 block, for its most common problem). Nothing is drawn per building.
4. A toggle in Settings: "Show problem icons" (default on).

**Acceptance criteria:** icons are readable at every zoom, never cluttered, and cheap (perf HUD).

**Done:** `src/lib/problemIcons.ts` (pure, tested) derives one problem per building from the grid, the flood mask, outbreaks and rolling cuts. `src/components/game/problemIconsDraw.ts` draws vector badges (no emoji) on the air layer in both the canvas and Pixi paths. It rescans at most once a second, only when state changed, and adds a `problemIcons` perf-HUD count. Below zoom 0.6 it draws one badge per 16×16 block, with a count. Infected blocks get one biohazard badge each (deferred from S4-T9). Settings has "Show problem icons". Notes: at building zoom, fire keeps the existing pulsing incident marker rather than getting a second badge. No-road badges also mark empty zoned lots, which is why those lots never grow. Readability and perf were not checked in a browser (no dev server in this task).

---

### S5-T6: Named advisors (feedback layer 2)

**Steps:** rework `AdvisorsPanel.tsx` and the advisor message creation into **five advisors** (names and roles are English with an Indian flavour; each has a simple illustrated avatar):

| Advisor | Covers |
|---------|--------|
| Treasury Officer | Money, taxes, loans, bankruptcy risk |
| City Engineer | Power, water, roads, traffic, collapses |
| River Officer | Ganga Health, floods, embankments, ghats, tourism |
| Health Officer | Health, disease, heatwaves |
| Police Commissioner | Safety, crime, festivals and crowds |

- Every advisor message has: `priority`, a one-line **problem**, a one-line **suggested fix**, and a **"Show me"** button (location plus overlay, reusing S4-T4).
- The panel is sorted by priority. The top-bar advisor button shows a badge with the count of `high` and `critical` messages.
- At most **3 messages per advisor** at a time. Newer messages replace older ones of the same kind.

**Acceptance criteria:** every crisis and system from Sprints 2–5 produces a message from the right advisor, with a working "Show me".

**Done:** `src/lib/advisorFeed.ts` derives notes for the five advisors from GameState once per in-game day (`useAdvisorNotes`). They are capped at 3 per advisor and sorted by priority through `mergeAdvisorMessages`. `AdvisorsPanel` shows SVG avatars, the problem, the fix and "Show me" (jump plus overlay, as in S4-T4). The badge counts high and critical notes on the desktop sidebar button and on the mobile menu. Deferred: festival and landmark notes only use the pure `festivals.ts`/`landmarks.ts` rules; they will not use S5-T1..T4 game state until that is wired in. The old `state.advisorMessages` in simulation.ts is left as it was, and the panel no longer reads it. Avatars are simple SVG portraits.

---

### S5-T7: Citizen feed (feedback layer 3)

**Steps:**
1. A small collapsible **"Voices of the City"** feed (desktop: bottom-left; mobile: inside the notifications sheet).
2. Messages come from **templates keyed by conditions**, in a config `CITIZEN_VOICES`. For example:
   - power cut in the block → "Power cut again during the cricket match! – {name}, {area}"
   - Ganga Health > 80 → "Took my kids for a boat ride. The river looks cleaner than I remember. – {name}"
   - traffic high → "Two hours in traffic near {area}. Two hours!"
   - after a successful festival → "Never seen the ghats so beautiful."
   Write **at least 30 templates** across all systems. **At least a third must be positive**, so good play is rewarded.
3. `{name}` comes from `src/lib/names.ts` (add Indian names if needed). `{area}` is a neighbourhood name: add a small list of real Varanasi mohalla names
   (for example Lanka, Assi, Godowlia, Sigra, Bhelupur, Lahurabir, Chowk, Maidagin) and assign them to feeder blocks.
4. At most **one new message per in-game week**. Clicking a message jumps to its area.
5. **Content rules:** no religious jokes, no caste, no politics, no real people's names, and English only.

**Acceptance criteria:** the feed reflects what is happening in the city. The owner reviews all templates.

**Done:** `src/lib/citizenFeed.ts` maps the city's current state to `CITIZEN_VOICES` conditions and posts at most one message per in-game week. `{area}` is the mohalla of the place, or a random one on Varanasi. `CitizenFeed.tsx` is collapsible and keeps the last 8 messages per city in localStorage. Clicking a message that has a place jumps to it. On desktop the feed sits bottom-left, above the overlay bar. There is no mobile notifications sheet, so on mobile it is a collapsed chip bottom-left, above the toolbar. The owner has not reviewed the templates yet.

---

### S5-T8: Contextual tips for every system

Add tips (same pattern as `useTipSystem.ts`) that fire **once**, when a system first matters. At minimum:
`first_power_cut`, `first_water_shortage`, `first_informal_settlement` (explains formalising), `monsoon_forecast` (explains the flood overlay and embankments),
`first_heatwave`, `first_outbreak`, `first_landmark_unlocked`, `festival_prep` (explains the Event panel), `debt_warning` (explains the loan).
A **"Reset tips"** button in Settings.

**Acceptance criteria:** a new player sees each tip exactly once, at the right moment.

**Done:** `src/lib/systemTips.ts` (pure, tested) holds the nine conditions, and `useTipSystem.ts` has their messages, ranked above the general tips. Crisis tips need disasters on. Settings → "Reset tips" clears the shown list, including in the running game. Notes: `first_landmark_unlocked` uses current population (there is no peak-population field yet), and `festival_prep` refers to the Event panel from S5-T4.

---

### S5-T9: Music and sound

**Steps:**
1. **Sourcing:** only **CC0 or properly licensed** audio. Record every file's source and licence in `public/audio/LICENSES.md`. **No audio without a recorded licence.**
2. **Music:** 3–5 calm Indian classical instrumental tracks (sitar, bansuri, santoor, tanpura drone), each 2–4 minutes, looping as a shuffled playlist. Use compressed
   formats (`.ogg` plus a `.m4a` fallback for Safari). Target under 3 MB per track.
3. **Sound effects** (short, under 50 KB each): UI click, building placed, road drawn, bulldoze, money received (weekly tick, very subtle), notification, crisis alert,
   landmark unlocked, festival start.
4. **Ambient (Medium and High quality only):** a soft river-and-temple-bell loop whose volume rises when the camera is zoomed in near ghats.
5. Create `src/lib/audio/audioManager.ts` using the Web Audio API: master, music and SFX volume, mute, and **lazy loading after the game is interactive** (never
   delay the first load). Start music only after the first user interaction (browser autoplay rules).
6. **Settings:** volume sliders and a mute toggle. Saved in UI preferences (localStorage is fine for these).

**Acceptance criteria:** there is sound for every listed action, and loading is still within the 00-game-design §7 targets. It is muted when the tab is hidden, and licences are recorded.

**Done:** `src/lib/audio/` (config + pure helpers in `audioConfig.ts`, Web Audio `audioManager.ts` loaded by dynamic import on the first
pointer/key input, facade `playSfx(id)` in `index.ts`). All nine SFX are synthesized in code (no files, no licence needed); ambient river +
bells plays on Medium/High only, scaled by zoom and nearby ghat/water tiles. Music is optional: tracks listed in `public/audio/music/playlist.json`
are shuffled and streamed (.ogg, .m4a fallback); none are shipped yet, so music is silent until licensed tracks are added and recorded in
`public/audio/LICENSES.md`. Everything is silenced when the tab is hidden. Volume sliders + mute in Settings → Sound (localStorage).
Hooks: placement/road/bulldoze sounds in GameContext, click/notification/alert/weekly money in `useGameAudio`; landmark/festival features call `playSfx('unlock' | 'festival')`.

---

### S5-T10: Mobile polish

**Steps:** go through every screen at **390×844** and **360×740** (Chrome DevTools device mode) and on one real Android phone:
1. Start screen, new-game map choice, build menu, all panels (budget, stats, advisors, settings, event panel), tile info, notifications, citizen feed, calendar strip, game-over screen.
2. Panels open as **bottom sheets** on mobile. Nothing is cut off, and nothing needs horizontal scrolling.
3. Touch targets are at least 44×44 px. Respect the safe areas (notch, home bar).
4. **Battery saver:** when the game is paused and there has been no input for 5 s, render at **10 fps**, and return to full rate instantly on touch.
5. Landscape and portrait both work, or portrait-only is enforced with a friendly rotate message (the owner decides; ask).

**Acceptance criteria:** a checklist of every screen × both sizes, all passing, is added to "Notes for later" as a record.

**Done:** Radix dialogs (all panels) become bottom sheets under 640 px (`ui/dialog.tsx`); safe-area insets on the top bar, toolbar, canvas
padding, notifications and toasts; 44 px touch targets (toolbar fits 8 buttons at 360 px, slider thumbs, toast buttons); battery saver
(`src/lib/batterySaver.ts`, 10 fps after 5 s idle while paused, full rate on the next input). Checked by code review only: the on-device pass
at 390×844 / 360×740 / real Android still needs a human. Orientation: both work, nothing enforced; **owner decision pending**. There is no
game-over screen yet.

---

### S5-T11: Undo last action (stretch; do only if time allows)

- `Ctrl+Z` (desktop) and an undo button (mobile) undo the last player **placement, bulldoze or zoning** action, up to 20 steps back.
- Store for each action: the changed tiles' previous values plus the money spent. Undo restores them **only if those tiles have not changed since** (otherwise show "Can't undo: the city has changed there").
- Simulation effects (growth, income) are **not** rolled back.

**Acceptance criteria:** undoing a road line within a few seconds restores the tiles and the money.

**Skipped:** the owner declined undo; not implemented.

---

### S5-T12: Launch checklist

- [ ] **Performance:** rerun every S1-T13 measurement on a full, late-game Varanasi 160 map (with landmarks and festivals). All targets pass. Record in perf-log.md.
- [ ] **Load time:** the start screen is usable in ≤ 3 s on desktop broadband and ≤ 6 s on throttled "Fast 4G" (DevTools). Audio and big sprite sheets load lazily.
- [ ] **Saves:** saves from **every** earlier sprint's build load correctly (keep one save file per sprint in `public/example-states/` for this test).
- [x] **Crash safety:** a React error boundary around the game. On a crash it autosaves (if possible) and shows "Something went wrong. Your city was saved." with a reload button.
- [x] **Dev tools hidden:** the benchmark buttons, sprite test view and perf HUD are available only with `?dev=1`.
- [x] **Credits screen:** IsoCity (MIT licence), art sources, audio licences.
- [x] **Metadata:** title, description and Open Graph image showing the Varanasi riverfront.
- [ ] **Playtest:** 3 people who have never seen the game each play for 30 minutes. Check the success criteria in 00-game-design §10. Write down what confused them.
- [x] **README:** the repo root `README.md` describes Varanasi (keeping the IsoCity credit).

**Done (code items):** `GameErrorBoundary` + `CrashSaveRegistrar` around the game (home and co-op), writing the autosave before showing
the message; dev tools, sprite test and perf HUD only with `?dev=1` (`src/lib/devMode.ts`; `?bench=` runs still work); Credits dialog on the
start screen and in Settings; metadata + a generated riverfront Open Graph image (`src/app/opengraph-image.tsx`, an illustration; swap for a
real screenshot later); README rewritten. **Still open (need a human/browser):** Performance and Load time measurements, the per-sprint
example saves in `public/example-states/`, and the Playtest. So S5-T12 stays unticked.

## 5. Sprint exit criteria (= v1.0 release criteria)

- [ ] All tasks ticked (S5-T11 may be "skipped: stretch").
- [ ] Every item in the launch checklist is ticked.
- [ ] All success criteria in 00-game-design §10 met.
- [ ] The owner approves the release.

## 6. Notes for later

*(Implementers: add things you noticed but did not do here.)*

- **Pure logic landed first (S5 part 1).** `src/lib/landmarks.ts`, `festivals.ts`, `citizenVoices.ts` and `advisors.ts` hold the data,
  rules and unit tests; the GameState/UI wiring is still to do.
- **BHU flood-zone check** takes an `isFloodZone(x, y)` callback (wire it to the Sprint 4 flood mask, "floods at any level"). Without it,
  the east floodplain and west riverfront count as flood zones.
- **Starting values not in the doc** (tune later): the "success" outcome's +2 happiness lasts 30 days; `EVENT_TRAFFIC_LIMIT = 60` on a
  0–100 traffic scale. `tile.traffic` is never written by the simulation today, so the access check needs a real traffic measure.
- **Mohallas are assigned by geography:** each feeder block goes to the nearest of ~30 real neighbourhoods placed on the map
  (u, v). At 160×160 (10×10 feeders) about 25 names appear; some central ones (Chowk, Lahurabir) only show on larger feeder grids.
- **Advisor message type** is `AdvisorNote` in `advisors.ts` (the old `AdvisorMessage` in `types/game.ts` has a different shape and
  should be migrated when the panel is reworked).
- **Owner review needed:** the citizen-voice templates and first-name list in `citizenVoices.ts`.
- **S5-T10 mobile checklist (code-reviewed, not device-tested; orientation pending owner decision).** Sizes 390×844 and 360×740:
  start screen ✓/✓ (credits button added); new-game map choice ✓/✓; build menu (toolbar + expanded menu, 70dvh scroll) ✓/✓; budget, stats,
  advisors, settings, event panels (bottom sheets, 85dvh scroll) ✓/✓; tile info ✓/✓; notifications (below safe area) ✓/✓; citizen feed and
  calendar strip: re-check after S5-T3/T7 land; game-over screen: none exists. Recheck all of these on a real Android phone.
