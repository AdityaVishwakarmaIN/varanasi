# 00: Game Design (Scope and Requirements)

> **Status:** Agreed with the project owner on 2026-09-24 after a 32-question design review.
> If code and this doc disagree about *what* the game should do, this doc wins.
> If you think this doc is wrong, ask the owner. Do not silently change it.

---

## 1. The pitch (one sentence)

**A challenging, SimCity-style city builder set in real Varanasi, where the Ganga (its pollution,
monsoon floods, boats and pilgrims) drives the city, and the game stays smooth in any browser,
including on phones.**

## 2. Design pillars

Every feature must support at least one pillar. If a feature supports none, cut it.

| # | Pillar | What it means in practice |
|---|--------|---------------------------|
| P1 | **Never stutters** | Smooth panning and zooming matter more than visual detail. If the device struggles, the game quietly lowers detail. It never freezes. |
| P2 | **The Ganga is the heart** | The river is not decoration. Its health, floods and ghats affect money, health, happiness and tourism. |
| P3 | **Proud problem-solver** | The city is hard to run. Problems are visible, understandable and fixable. Solving them should feel earned. |
| P4 | **Unmistakably Varanasi** | Real geography, Indian buildings and vehicles, Indian seasons and festivals. The player should recognise the city at a glance. |
| P5 | **Familiar to play** | Anyone who has played SimCity or Cities: Skylines should know what to do within 2 minutes. Indian flavour sits on top of familiar systems and never replaces them. |

## 3. Who we are building for

- **Main player:** a PC strategy fan who knows SimCity or Cities: Skylines and plays in a desktop browser.
- **Second:** the same person on their phone. The full game works on mobile with a touch-adapted UI,
  but desktop comes first when trade-offs are needed.
- **Language:** English only (Indian names for places and things are fine and encouraged).
- **Session length:** flexible, from 10 minutes to 3 hours. Autosave means the player can close the tab at any time.

## 4. The core loop

```
 ┌─► Look at the city (overlays, scores, advisor warnings)
 │        │
 │        ▼
 │   Spot a problem  (traffic jam, dirty river, power cut, flood risk, low money)
 │        │
 │        ▼
 │   Build or change something  (roads, zones, services, ghats, treatment plants, taxes)
 │        │
 │        ▼
 │   Time passes  (city grows, seasons turn, crises and festivals arrive)
 │        │
 └────────┘   ...and the result shows up in scores, money and the city itself
```

**Long-term goal:** there is no "win" screen. This is a **hard sandbox**. The goal is to build the best
Varanasi you can. Milestones unlock real landmarks, and bad management can end the game
(bankruptcy or the population leaving).

## 5. Decisions (the complete list)

### 5.1 World

| Topic | Decision |
|-------|----------|
| Setting | **Real Varanasi.** The Ganga flows north in a crescent. The city and ghats are on the west bank and a sandy floodplain is on the east bank. The Assi (south) and Varuna (north) streams join from the west. |
| Map choice at new game | **Varanasi** (default) or **Random map** (the existing generator). |
| Map size | Varanasi map: **160×160 tiles on desktop, 120×120 on mobile**. Fixed size, so the Expand/Shrink City tools are turned off on this map. Random map: current behaviour. |
| Population scale | The simulation's population number is **multiplied by 10 for display** (`POPULATION_DISPLAY_SCALE = 10`), so a full map reads as several lakh people, matching the real city's scale. The simulation itself is unchanged. |
| Landmarks | Real landmarks (Kashi Vishwanath, Dashashwamedh Ghat, BHU, Sarnath, Ramnagar Fort) **unlock at population milestones** and give large bonuses. They are shown respectfully: no damage, no fire and no demolition jokes. |
| Heritage vs development | **Not a theme.** No demolition dilemmas. |

### 5.2 Systems

| Topic | Decision |
|-------|----------|
| Player role | Faceless planner. No mayor, no elections, no story. |
| Difficulty | **Challenging.** You can go bankrupt, and the population can leave. |
| Mode | One mode: **hard sandbox** with milestone unlocks. |
| Economy | Classic taxes and budget, plus **tourism income** from ghats and landmarks. |
| Zoning | Residential, Commercial, Industrial (as today). **Dense commercial becomes mixed-use** (shops below, homes above). A new **Ghat** placement is allowed only on the west-bank riverfront. |
| Ganga | Central mechanic: **Ganga Health** (0–100), floods, boats, ghat tourism. It reflects real problems (sewage and industrial waste) as systems to solve, not as lectures. |
| Indian city problems | All of them: mixed-vehicle traffic, power cuts, water supply shortages, informal settlements, pilgrim crowds. |
| Seasons | The full Indian calendar: **Summer** (Mar–Jun), **Monsoon** (Jul–Sep), **Post-monsoon** (Oct–Nov), **Winter** (Dec–Feb). Each season changes gameplay. |
| Crises | Monsoon floods, heatwaves, fires and building collapse, disease outbreaks. |
| Festivals | All festivals are **visual** (diyas, colours, crowds). **Dev Deepawali** and **Maha Shivratri** are also **management events** (crowds, traffic, safety). |
| Traffic | Realistic Indian mix: cars, autos, e-rickshaws, motorbikes, cycle-rickshaws, buses and cows. It looks messy but stays readable. |
| Citizens | Visible crowds for atmosphere. The player manages statistics, not individual people. |
| Time away | The game **pauses** when the tab is closed or hidden. No idle progress. |
| Multiplayer | **Turned off for now** (the code stays, hidden behind a flag). |

### 5.3 Presentation

| Topic | Decision |
|-------|----------|
| Art style | Warm, realistic isometric pixel art: sandstone, faded paint, rooftop water tanks, laundry lines. |
| Feedback | Three layers: (1) **icons and overlays** for quick reading, (2) **advisors** for big problems, (3) a **citizen feed** of short one-liners for flavour. |
| Onboarding | **Contextual tips** that appear when a system first matters. No forced tutorial. |
| Audio | Calm Indian classical background music plus light UI and ambient sound effects. |
| Money | Shown in **₹** with Indian grouping (₹12,34,567), using lakh and crore for big numbers (₹3.4 crore). |

## 6. Scope: what is in and what is out

### 6.1 In scope (v1.0, across the 5 sprints)

| Sprint | Theme | Player-visible result |
|--------|-------|-----------------------|
| 1 | Performance and controls | Big maps run smoothly, controls feel good on mouse, keyboard and touch, saves are reliable |
| 2 | Varanasi and the Ganga | Start a game on the real Varanasi map. Ghats, Ganga Health, tourism income, river boats |
| 3 | Indian city life | Indian buildings and vehicles, mixed-use growth, power cuts, water shortages, informal settlements |
| 4 | Seasons and crises | Seasons, monsoon floods, heatwaves, fog, disease, building collapse, bankruptcy and exodus |
| 5 | Festivals, landmarks and launch | Festivals, landmark unlocks, advisors and citizen feed, audio, mobile polish, launch |

### 6.2 Cut from v1 (maybe later)

These were discussed but are **not** part of v1. Do not build them.

- Pre-built "old city" start and scripted scenario missions.
- Multiplayer and co-op (the code stays but is hidden).
- Following individual citizens.
- Languages other than English.
- A heritage-versus-development system.
- Government schemes (Smart City, AMRUT and so on) as a separate income source.
- Idle or offline progress.
- Western-only content that clashes with the setting: space program, baseball, American football,
  mini golf and the go-kart track. These are **hidden from the build menu** on the Varanasi map (never
  deleted, because of saves) or **re-skinned** as Indian equivalents (see Sprint 3).

### 6.3 Added by the planner (not in the original wish list, but needed)

| Addition | Why |
|----------|-----|
| Performance budgets and a benchmark city (Sprint 1) | "Never stutters" has to be measurable, or it will slowly get worse. |
| Quality presets plus automatic quality (Sprint 1) | Needed to hit the frame-rate target on weak phones and laptops. |
| Unit tests for game logic (Sprint 1) | The game has no tests yet. Pure-logic tests stop balance and scoring changes from silently breaking things. |
| Saves in IndexedDB instead of localStorage (Sprint 1) | localStorage holds only about 5 MB, which a 160×160 city can exceed. |
| Population display scale ×10 (Sprint 2) | Makes the city feel lakh-sized without a slower simulation. |
| Crisis forecasts and optional auto-pause (Sprint 4) | Challenging must still be fair: the player sees trouble coming. |
| Undo last placement (Sprint 5, stretch) | Strategy players expect it. |

## 7. Performance targets (hard requirements)

The **benchmark city** is defined in Sprint 1 (task S1-T1). All targets are measured on it.

| Metric | Desktop target | Mobile target |
|--------|----------------|---------------|
| Reference device | Laptop with a 4-core CPU and integrated graphics, Chrome | Mid-range Android phone (about ₹15,000 class), Chrome |
| Map size tested | 160×160, fully built | 120×120, fully built |
| Frame rate while panning and zooming | 60 fps (p95 frame time ≤ 16.7 ms) | 30 fps (p95 frame time ≤ 33 ms) |
| Worst single frame while panning (hitch) | ≤ 50 ms | ≤ 100 ms |
| Simulation tick cost on the main thread | ≤ 4 ms | ≤ 8 ms |
| Main-thread block during autosave | ≤ 16 ms | ≤ 33 ms |
| Time until the start screen is usable | ≤ 3 s (broadband) | ≤ 6 s (4G) |

If a target cannot be met, the game must **automatically reduce detail** (see S1-T6) instead of dropping frames.

## 8. Game-feel and UX rules

1. **Every action gets instant feedback**: a sound, an animation or a number change within 100 ms.
2. **Show cost and validity before placement.** A hovering building shows green (allowed) or red
   (not allowed) plus its cost. A red placement shows *why*, for example "Ghats must touch the Ganga's west bank".
3. **Warn before punishing.** Floods, festivals, bankruptcy and heatwaves are announced in advance
   (see Sprint 4).
4. **Any problem is at most two clicks from its cause.** A notification → click → the camera jumps to the
   place → the relevant overlay turns on.
5. **Readable at every zoom level.** When zoomed out, detail is hidden before clarity is lost.
6. **Touch targets are at least 44×44 px** on mobile.
7. **Never lose progress.** Autosave runs regularly, when the tab is hidden, and before the page closes.

## 9. Content lists (reference)

### 9.1 Seasons (details in Sprint 4)

| Season | Months | Main effects |
|--------|--------|--------------|
| Summer | Mar–Jun | Heatwaves, higher power and water demand, dust |
| Monsoon | Jul–Sep | Heavy rain, river flooding, disease risk, fewer tourists |
| Post-monsoon | Oct–Nov | Festival season, most tourists, river recedes |
| Winter | Dec–Feb | Fog (slower traffic), pleasant weather, steady tourism |

### 9.2 Landmarks (details in Sprint 5)

| Landmark | Unlocks at (displayed population) | Where it can go |
|----------|-----------------------------------|-----------------|
| Dashashwamedh Ghat | 50,000 | West-bank riverfront |
| Kashi Vishwanath Temple | 1,00,000 | Within 8 tiles of the west bank |
| Banaras Hindu University (BHU) | 2,00,000 | Anywhere on land (4×4) |
| Sarnath | 3,00,000 | Northern quarter of the map |
| Ramnagar Fort | 5,00,000 | East bank |

### 9.3 Festivals (details in Sprint 5)

| Festival | Month | Type |
|----------|-------|------|
| Ganga Aarti | Every evening | Visual (lamps and crowd on the main ghat) |
| Holi | March | Visual (colours) |
| Maha Shivratri | Feb/Mar | **Management event** (temple crowds) |
| Diwali | Oct/Nov | Visual (lights across the city) |
| Dev Deepawali | November | **Management event** (ghat crowds and a tourism spike) |
| Chhath | November | Visual (riverbank gatherings) |

## 10. How we know v1 is good (success criteria)

- A new player can place their first working neighbourhood (roads, zones, power, water) in under 5 minutes without help.
- A playtester can tell it is Varanasi from a screenshot of the default map.
- All performance targets in section 7 are met on the benchmark city.
- A typical first city either thrives or fails **because of player decisions**, and the player can explain why.
- There are no known bugs that lose saves.
