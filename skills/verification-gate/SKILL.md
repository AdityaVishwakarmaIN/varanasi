---
name: verification-gate
description: Use at the end of every task, before handing back or committing - the gate commands with their current baselines, the headless Playwright recipe for seeing the game, the viewports and Ganga scenario to check, the Definition of Done, and commit and multi-agent hygiene.
---

# Verification Gate

A task is not done because it compiles. It is done when the gate passes with no new failures, the change was seen working in the real game at desktop and phone sizes, old saves still load, and the docs are updated (`documentation/game-plan/README.md` §3, Definition of Done). Run this last, every time.

## Read first
- `documentation/game-plan/README.md` (§2 house rules, §3 Definition of Done)
- The task's "How to test" steps in its sprint doc

## Workflow

### 1. Gate commands (from the repo root)
| Step | Command | Pass |
|---|---|---|
| Types | `npx tsc --noEmit -p .` | no output |
| Lint | `npm run lint 2>&1 \| grep problems` | baseline `17 problems (7 errors, 10 warnings)`; no new ones. Count before and after your change. |
| Tests | `npx vitest run --testTimeout 120000 --maxWorkers 2` | baseline 75 files passed, 1 skipped; 584 tests passed, 1 skipped; ~80 s. Re-run to get the current count; new tests raise it. |
| Build | `npm run build` | passes (runs `compress-images`, then `next build`) |
| Clean up | `git checkout -- public/assets/cloud-grid-images.webp` | the build rewrites this file; never commit it |
- The skipped file is the sim benchmark (`simBench.test.ts`, needs `BENCH=1`).
- A single worker RPC timeout under heavy machine load is a load artifact; re-run that file alone before believing it.
- Tests run in node only (`vitest.config.ts`, `src/**/*.test.ts`); browser behaviour is checked with Playwright below.

### 2. See it in the game (Playwright, headless)
Start `npm run dev` in the background (note its PID; Next serves on port 3000 unless taken). Then a node script:
```js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/');
  await page.getByText('Load Example').first().click();   // enters the game
  await page.screenshot({ path: '<scratchpad>/shot.png' });
  await browser.close();
})();
```
- `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is already set.
- GPU renderer: add `?renderer=gpu` and launch args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- Set localStorage `varanasi-graphics-quality` = `high` (via `addInitScript`) before judging visuals; headless auto-quality drops to low and turns off tree sway.
- Phone: `viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true`.
- Save screenshots to the scratchpad, never into the repo.

### 3. Viewports
1440x900 desktop, 768x1024 tablet edge, 390x844 phone, 844x390 landscape phone (skills/ui-css-and-touch-traps for what to look for).

### 4. Ganga scenario (any change to river, economy, placement or tourism)
On a Varanasi game:
- [ ] The crescent river reads as the Ganga.
- [ ] A ghat is allowed on the west bank and blocked on the east bank, with the reason shown.
- [ ] A factory next to the river makes Ganga Health drop; a treatment plant (STP) makes it recover.
- [ ] Tourism income shows in the budget.
- [ ] Boats move between ghats.

### 5. Definition of Done (README §3)
- [ ] Every acceptance criterion met.
- [ ] `npm run build` passes; `npm run lint` no new errors; `npm test` passes.
- [ ] "How to test" steps done by hand in the running game.
- [ ] An old save made before the change still loads (skills/save-compat-append-only-ids).
- [ ] Runs at 390x844.
- [ ] Task checkbox ticked in the sprint doc; perf numbers in `documentation/game-plan/perf-log.md` if measured (skills/perf-budget).
- [ ] Feature write-up in `documentation/` like the other summaries, if it is a feature.
- [ ] If sim output changed on purpose, goldens re-recorded and explained (skills/sim-golden-contract).

## Commit and hygiene
- One task per commit, message `S<sprint>-T<task>: <short description>` (e.g. `S1-T4: cache service coverage by structure version`).
- Out-of-scope findings go under "Notes for later" in the sprint doc, not into the diff.
- Scratch scripts, screenshots and logs live outside the repo (the session scratchpad).
- Kill only processes you started, by PID (`kill <pid>`). Never `pkill` or `killall`: other agents' dev servers and browsers share the machine.
- Subagents do not merge or rebase in rival agents' work; they report, and the lead cherry-picks.
- Do not commit or push unless the task says to.

## Gotchas
- Lint counts include pre-existing errors; compare the number, do not try to reach zero in an unrelated task.
- Headless FPS numbers are not performance evidence (skills/perf-budget).

## Verify
Report in the hand-off: the four gate results with counts, which viewports and scenario steps were checked (with screenshot paths), and anything left unverified.
