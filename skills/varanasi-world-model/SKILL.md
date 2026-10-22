---
name: varanasi-world-model
description: Use at the start of any gameplay, content or balance task in this repo - pitch and tone, what has shipped, Varanasi geography and zone ids, which module owns which mechanic, the game-plan rules, and units (sim population x10, lakh/crore, rupees).
---

# Varanasi World Model

Varanasi is a fork of IsoCity turned into a hard-sandbox city builder set in real Varanasi, where the Ganga's health, floods, boats and pilgrims drive the economy, and the game must never stutter. This skill is the shared map of the project: what the game is, what already exists, where each mechanic lives, and the house rules every task follows. Read it first; then go to the task skill (see skills/README.md).

## Read first
1. `documentation/game-plan/00-game-design.md` - scope and requirements. If code and this doc disagree about WHAT the game does, the doc wins; ask the owner before changing it.
2. `documentation/game-plan/README.md` - working rules and Definition of Done.
3. The sprint doc for your task (`documentation/game-plan/sprint-<n>-*.md`), including its "Notes for later".

## Pitch and tone
- Pillars: P1 Never stutters, P2 The Ganga is the heart, P3 Proud problem-solver, P4 Unmistakably Varanasi, P5 Familiar to play. A feature that supports none is cut.
- Hard sandbox: one mode, bankruptcy and citizen loss are possible, landmarks unlock at milestones.
- Faceless planner: no mayor, no elections, no individual-citizen following.
- Inform, don't preach: pollution is a system to master, shown with causes, not a lecture.
- English only (Indian names encouraged). The city pauses when the tab is closed; no idle progress.
- Warn before punishing: floods, festivals, bankruptcy, heatwaves are forecast in advance.

## Status truth (as of these skills)
- Shipped: Milestone 1 (Varanasi map, ghats, Ganga Health, tourism, boats) and Sprints 1-5 (performance and controls; Varanasi and the Ganga; Indian city life; seasons and crises; festivals, landmarks and launch).
- Open: unticked tasks in the sprint docs - S1-T13 (real-hardware measurement), S2-T11, S3-T11, S4-T12, S5-T12 (launch checklist). Grep `- \[ \]` in `documentation/game-plan/`.
- S5-T11 (undo) is marked skipped, yet `src/lib/undo.ts` and `UndoToast.tsx` exist. Read the code before assuming either way.
- Cut from v1 (design doc section 6.2): pre-built old-city start and scenario missions, multiplayer (code hidden), other languages, heritage-vs-development, government schemes, idle progress.
- Types live in `src/games/isocity/types/*`; `src/types/game.ts` only re-exports.

## Geography (Varanasi map)
- Ganga enters from the south, bulges west into the crescent mid-map, leaves to the north-east. Data in `VARANASI_MAP` (`src/games/isocity/maps/varanasi.ts`) as map fractions, so it scales with size.
- City on the west bank; ghats go on the west riverfront. East bank: sandy floodplain then land (Ramnagar Fort's side).
- Tributaries from the west: Assi (south), Varuna (north).
- Zone ids (`RiverZone`, `riverZones.ts`): `river`, `westRiverfront`, `westBank`, `eastFloodplain`, `eastBank`, `none` (any non-Varanasi tile).
- Map ids: `'varanasi'` (default, 160 desktop / 120 mobile) and `'random'` (70 / 50). Missing `mapId` in a save means `'random'`.

## Module map (who owns what)
| Mechanic | Owner |
|---|---|
| Tick, placement, services, totals | `src/lib/simulation.ts` |
| Placement validity + reasons | `src/lib/placement.ts` |
| Scores incl. Ganga Health | `src/lib/scoring.ts` (`SCORING_CONFIG`) |
| River inputs, STPs, riverfront rules, river colour | `src/lib/ganga.ts` |
| Ghat tourism | `src/lib/tourism.ts` |
| Calendar, seasons, weather | `src/lib/seasons.ts` |
| Monsoon, river level, floods | `src/lib/floods.ts`, `floodSim.ts` |
| Heatwave, disease, collapse | `heatwave.ts`, `disease.ts`, `collapse.ts`, `crisisSim.ts` |
| Festivals | `festivals.ts`, `festivalSim.ts` |
| Landmarks | `landmarks.ts` |
| Power and water | `utilities.ts`, `utilityCuts.ts` |
| Informal settlements | `informal.ts`, `informalSim.ts` |
| Mixed-use | `mixedUse.ts` |
| Bankruptcy, loans | `failure.ts` |
| Tax, upkeep | `tax.ts`, `upkeep.ts` |
| Notifications, forecasts, advisors, tips | `notifications.ts`, `forecast.ts`, `advisors.ts`, `advisorFeed.ts`, `systemTips.ts` |
| Map data and menus | `src/games/isocity/maps/*` |
| Rendering | `src/components/game/*` (see skills/render-feature) |
| Global state, load, actions | `src/context/GameContext.tsx` |

## House rules (from documentation/game-plan/README.md)
1. Read every file the task lists before writing.
2. One task per commit; commit as `S<sprint>-T<task>: <short description>`.
3. Stay inside the task; side observations go under "Notes for later" in the sprint doc.
4. Never rename `BuildingType`, `Tool`, `ZoneType`, `OverlayMode` values or storage keys (skills/save-compat-append-only-ids).
5. New building types go at the END of `BUILDING_STATS`.
6. No magic numbers: tunables in a named config like `SCORING_CONFIG`.
7. Game logic is pure: no React, DOM, canvas or `window`.
8. UI strings via `msg()`; shadcn components; `@/` imports.
9. Tick the task checkbox; log performance numbers in `perf-log.md`. When unsure, stop and ask the owner.

## Units
- Sim population x `POPULATION_DISPLAY_SCALE` (10) = displayed population (`toDisplayPopulation`, `src/lib/format.ts`). Configs count sim people unless named otherwise; landmark unlocks use displayed (peak) population.
- Money is rupees; show with `formatINR` / `formatINRPerMonth`. Large numbers use Indian grouping (1,00,000) and lakh/crore (`formatIndianNumber`, `formatIndianCompact`).
- Time: 30 ticks per day, 30-day months (skills/calendar-and-crisis-gating).

## Gotchas
- vision.md predates the design doc; where they differ (scenarios), the design doc wins.
- Most storage keys are `isocity-*` (inherited); do not "fix" them.
- The random map must keep working; Varanasi-only systems gate on `mapId`.

## Verify
- You can name the pillar your change serves, the module that owns it, and the sprint task id.
- Finish with skills/verification-gate.
