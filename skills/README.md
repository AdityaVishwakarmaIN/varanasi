# Project Skills

Task playbooks and reference for agents working on Varanasi. Start with `varanasi-world-model`, then the major skill for your task; it links to the minor skills it needs. Each fact lives in one skill only: follow the links instead of copying.

## Index

| Skill | Kind | Use when |
|---|---|---|
| [add-building](add-building/SKILL.md) | major | Adding or changing a building type: stats, placement rules, art, UI, save-safe ids. |
| [add-sim-system](add-sim-system/SKILL.md) | major | Adding or changing a simulated mechanic (crisis, calendar event, utility, economy rule, Ganga effect) in `simulateTick`. |
| [surface-to-player](surface-to-player/SKILL.md) | major | A system or metric exists and the player must see, understand and act on it (HUD, overlay, notification, advisor, tip, sound). |
| [render-feature](render-feature/SKILL.md) | major | Drawing or animating anything on the map so it works on Canvas2D and GPU within budget. |
| [add-map-or-scenario](add-map-or-scenario/SKILL.md) | major | Adding a start option, changing river geometry or map sizes, or touching the new-game flow. |
| [varanasi-world-model](varanasi-world-model/SKILL.md) | minor | Start of any gameplay, content or balance task: pitch, status, geography, module map, house rules, units. |
| [ganga-river-economy](ganga-river-economy/SKILL.md) | minor | Changing or tuning Ganga Health, treatment plants, catchment, tourism income or river consumers. |
| [calendar-and-crisis-gating](calendar-and-crisis-gating/SKILL.md) | minor | Anything dated or seasonal: calendar, weather, floods, festivals, crisis cadence and gates, forecasts. |
| [sim-golden-contract](sim-golden-contract/SKILL.md) | minor | Any change that can alter `simulateTick` output: determinism, toggles, golden fingerprints. |
| [save-compat-append-only-ids](save-compat-append-only-ids/SKILL.md) | minor | Adding ids, enum values, state fields or storage keys; touching load/save or version counters. |
| [procedural-sprite-authoring](procedural-sprite-authoring/SKILL.md) | minor | Painting or changing a procedural building sprite. |
| [render-pipeline-gotchas](render-pipeline-gotchas/SKILL.md) | minor | Touching `CanvasIsometricGrid.tsx`, `gpu/*`, vehicle systems or draw modules: depth order, layers, caches. |
| [perf-budget](perf-budget/SKILL.md) | minor | Anything that costs frame, tick or save time; measuring and logging performance. |
| [ui-css-and-touch-traps](ui-css-and-touch-traps/SKILL.md) | minor | Building or fixing UI: house style, tap targets, Tailwind quirks, z-index, map touch/wheel. |
| [verification-gate](verification-gate/SKILL.md) | minor | End of every task: gate commands and baselines, Playwright, Definition of Done, commit hygiene. |
| [ui-pattern-adherence](ui-pattern-adherence/SKILL.md) | minor | Any UI that should match an existing dialog, button, layout or theme: copy the real pattern first. |
| [agent-hierarchy](agent-hierarchy/SKILL.md) | minor | Delegating a big or ambiguous task: staffing Opus/Sonnet/Haiku tiers by need, fair visible competition, scoreboard. |
| [isometric-asset-sheets](isometric-asset-sheets/SKILL.md) | minor | Generating sprite-sheet images with consistent isometric format and sizing. |
| [varanasi-image-to-asset](varanasi-image-to-asset/SKILL.md) | minor | Turning an existing generated image into runtime-safe PNG/WebP assets wired into the renderer. |

`adding-asset-sheets.md` is an older guide, kept for history; prefer the asset skills above.

## Majors -> minors

| Major | Minors it links to |
|---|---|
| add-building | varanasi-world-model, save-compat-append-only-ids, ganga-river-economy, procedural-sprite-authoring, varanasi-image-to-asset, verification-gate (then surface-to-player; add-sim-system if it needs a new mechanic) |
| add-sim-system | varanasi-world-model, save-compat-append-only-ids, sim-golden-contract, calendar-and-crisis-gating, ganga-river-economy, perf-budget, verification-gate (then surface-to-player; render-feature for visuals) |
| surface-to-player | varanasi-world-model, ui-pattern-adherence, ui-css-and-touch-traps, perf-budget, verification-gate |
| render-feature | render-pipeline-gotchas, procedural-sprite-authoring, perf-budget, verification-gate |
| add-map-or-scenario | varanasi-world-model, ganga-river-economy, save-compat-append-only-ids, ui-pattern-adherence, perf-budget, verification-gate |

Every task ends with verification-gate.
