---
name: surface-to-player
description: Use after a system, metric or building exists and the player must see, understand and act on it - HUD chip, stats panel, tile info, overlay, problem icon, notification or forecast, advisor, tip, citizen feed, sound.
---

# Surface To Player

This skill owns the feedback channels and the overlay tables. The design rule is "inform, don't preach": the player gets a number, its cause, its trend, where on the map it comes from, and what to do about it. Every problem should be at most two clicks from its cause. Ganga Health is the worked example: `src/lib/scoring.ts` (number) -> Stats -> `GangaHealthChip.tsx` (HUD) -> `panels/StatisticsPanel.tsx` (cause lines) -> `ganga` overlay (tile view) -> River advisor.

## Read first
- skills/varanasi-world-model (tone, units)
- skills/ui-pattern-adherence and skills/ui-css-and-touch-traps before building any UI
- `src/lib/notifications.ts`, `src/lib/advisors.ts`, `src/components/game/overlays.ts`

## Workflow
1. Write the four lines before any UI: value, cause, trend, action. Copy the Ganga helpers' shape: `describeGangaCauses`, `describeGangaTileEffect` (`src/lib/ganga.ts`), `getGangaTrend` + `GANGA_TREND_ARROW`.
2. Pick channels with the decision table below. One event, one channel, unless it is a crisis.
3. Add any derived text as a pure function in `src/lib/` with a test; components only render.
4. Format every number: `formatINR`, `formatINRPerMonth`, `formatIndianNumber`, `formatIndianCompact`, `toDisplayPopulation` (`src/lib/format.ts`). Never show raw sim population (it is display / 10).
5. Every string through `msg()` / `<T>` from gt-next. No English built by concatenation; use placeholders.
6. Build the UI with existing components (shadcn in `src/components/ui/`), then check phone width.

## Decision table
| Event | Channel |
|---|---|
| Ongoing metric | HUD chip (`HudStat.tsx`, `GangaHealthChip.tsx`, `UtilityChip.tsx`) + StatisticsPanel section |
| Where on the map | Overlay mode (below) |
| Per-building fault | Problem icon (`PROBLEM_KINDS` in `src/lib/problemIcons.ts`, drawn by `problemIconsDraw.ts`) + `TileInfoPanel.tsx` line |
| One-off event | Notification (`pushNotifications`) with `x`, `y`, `overlay` deep link |
| Coming soon | Forecast (`addForecast`, shown on `SeasonCalendar.tsx`) |
| Sustained big problem | Advisor note |
| First time a system matters | System tip |
| Flavour, mood | Citizen feed |
| Crisis | Notification `severity: 'crisis'` + advisor + problem icon (+ sound) |

Only `severity: 'crisis'` auto-pauses: `shouldPauseForCrisis` pauses when `state.pauseOnCrisis !== false`. Do not use it for routine news.

## Channels
- Notifications: `src/lib/notifications.ts` - `NOTIFICATION_CONFIG`, `pushNotifications`, `shouldPauseForCrisis`, `getToday`, `NotificationExtras` (`x`, `y`, `overlay`, `severity`), `addForecast` / `pruneForecasts` wrappers (`ForecastInput`). UI: `NotificationToasts.tsx`.
- Advisors: `src/lib/advisors.ts` - six `AdvisorId`s (treasury, engineer, river, health, police, fire), `ADVISOR_TOPICS` (topic -> advisor), `ADVISOR_CONFIG`, `AdvisorNote`, `createAdvisorNote`, `mergeAdvisorMessages`. Derivation: `deriveAdvisorNotes(state, problems)` in `src/lib/advisorFeed.ts` (`ADVISOR_FEED_CONFIG`). Hook `src/hooks/useAdvisorNotes.ts`; panel `panels/AdvisorsPanel.tsx`.
- Tips: `src/lib/systemTips.ts` - add to `SystemTipId` and `SYSTEM_TIP_CHECKS` (state -> boolean); river tips in `src/lib/gangaTips.ts`; driver `src/hooks/useTipSystem.ts`.
- Citizen feed: `src/lib/citizenFeed.ts`, `src/lib/citizenVoices.ts`; UI `CitizenFeed.tsx`.
- Sound: `src/lib/audio/audioConfig.ts`; hook `src/hooks/useGameAudio.ts`.

## Overlays
- `OverlayMode` union in `src/components/game/types.ts` - append only (it is stored).
- `src/components/game/overlays.ts`: `OVERLAY_CONFIG`, `OVERLAY_LEGEND`, `OVERLAY_MODES`, `OVERLAY_TO_BUILDING_TYPES`, colour maps (`OVERLAY_CIRCLE_COLORS`, `OVERLAY_CIRCLE_FILL_COLORS`, `OVERLAY_HIGHLIGHT_COLORS`), `getOverlayFillStyle`, `TOOL_TO_OVERLAY_MAP` (tool auto-selects overlay).
- Map gating: private `VARANASI_ONLY_OVERLAYS` (`ganga`, `flood`) via `getOverlayModesForMap(mapId)`.
- UI: `OverlayModeToggle.tsx` (must receive `mapId`, an earlier bug showed Varanasi overlays on random maps), `OverlayLegendChip.tsx`.
- Tile fills must come from a cached per-tile array, not recomputed per frame (skills/perf-budget).

## Gotchas
- A metric without a cause line reads as preaching. Show the biggest contributor, in rupees or people.
- Deep links (`x`, `y`, `overlay`) are what make "two clicks from the cause" true; always set them when the event has a place.
- Advisor notes are derived by `deriveAdvisorNotes` (memoised in `getAdvisorNotes`, `useAdvisorNotes.ts`), not saved in `GameState` (the older `advisorMessages` field is separate). Keep derivation pure and cheap. Shown tips persist per browser (`isocity-tips-shown` in `src/lib/feedbackPrefs.ts`).
- Do not add a new HUD chip when a StatisticsPanel line will do; the top bar is full on phones.

## Verify
- Tests: `src/lib/__tests__/gangaUi.test.ts`, `feedbackLayers.test.ts` (fixture `emptyCity` in `feedbackLayers.helpers.ts`), `advisors.test.ts`, `citizenFeedExpiry.test.ts`. Add a case for the new text/derivation.
- By hand: trigger the event, follow the deep link, see the overlay, read the cause, fix it, watch the trend flip.
- Check 1440 and 390x844 (skills/ui-css-and-touch-traps), then skills/verification-gate.
