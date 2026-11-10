---
name: ui-css-and-touch-traps
description: Use when building or fixing any game UI (panels, flyouts, toasts, HUD chips, mobile toolbar, dialogs) to get the house style, tap-target rules, Tailwind quirks, z-index ladder and map touch/wheel handling right on desktop, tablet and phone. Extends ui-pattern-adherence.
---

# UI CSS and Touch Traps

The UI sits on top of a full-screen canvas that eats wheel and touch input, and global CSS forces tap-target sizes per device class. Most UI bugs so far were a selector winning over a Tailwind class, a flyout under the wrong layer, or the map stealing a scroll. First follow skills/ui-pattern-adherence (copy the nearest real component); this skill adds the project-specific traps. Feedback content (which channel, what to say) is skills/surface-to-player.

## Read first
- skills/ui-pattern-adherence
- `src/app/globals.css` (tokens, tap-target media rules), `tailwind.config.js`
- The nearest existing component: `src/components/game/Sidebar.tsx`, `TopBar.tsx`, `panels/*`, `src/components/mobile/MobileToolbar.tsx`, `MobileTopBar.tsx`

## Reference

### House style
- Flat warm sandstone chrome, square corners: `--radius: 0px`; use `rounded-none`, never round a new panel.
- Fonts from `src/app/layout.tsx`: `DM_Sans` (body), `Rozha_One` (display).
- `--chrome-accent` (terracotta, `14 62% 44%`) marks the selected/active state only, not decoration or warnings.
- Panels reuse existing classes (`hud-panel`, `hud-glass`, `bg-chrome-panel`, `border-chrome-border`, `hud-label`); grep for them instead of inventing colours.
- All strings go through gt-next (`gt('...')` / `msg()`), see skills/surface-to-player.

### Tap targets (`globals.css`)
| Media query | Selector | Min size |
|---|---|---|
| `(max-width: 768px)` phone | `button, [role="button"]` | 44px |
| `(min-width: 769px) and (max-width: 1023px), (min-width: 769px) and (pointer: coarse)` tablet / touch laptop | `button:not([role="switch"]):not([role="checkbox"]):not([role="radio"]), [role="button"]` | 40px |
| `(pointer: coarse) and (max-height: 500px)` phone held sideways | same `:not(...)` selector | 44px |
- The `:not(...)` selector has specificity (0,3,1) and beats any single Tailwind utility (`min-h-0`, `min-w-0`, `h-6`): on tablets and landscape phones a "small" button is still 40-44px. Switches, checkboxes and radios are exempt by role.
- The phone rule's plain `button` selector is weak, so a Tailwind `min-h-*` / `min-w-*` class does override it on portrait phones. Do not shrink tap targets below 44px there (design §8: touch targets at least 44x44 on mobile).
- To really override, use `!` (`!min-h-0`) or a role exemption, and only for non-primary controls.

### Tailwind quirks (`tailwind.config.js`)
- Custom variant `short` = `@media (max-height: 500px)` (added with `addVariant`, not `screens`, so `max-*` keeps working). It can lose to `md:` utilities on the same property; existing overrides use `!` (`short:!h-...` in `SettingsPanel.tsx`, `short:!min-h-...` in `NotificationToasts.tsx`). Check the landscape result rather than trusting order.
- `content` globs cover only `src/pages`, `src/components` and `src/app`. Class names written only in `src/hooks`, `src/lib` or `src/context` are not generated; keep class strings in components, or use inline `style` there (as `useScrollFade` does).

### Z-index ladder
| z | What |
|---|---|
| 30 | Mobile TileInfoPanel |
| 40 | Sidebar, TopBar, MobileTopBar |
| 42 | OverlayModeToggle, MiniMap (`z-[42]`) |
| 44 / 45 | Sidebar flyout hover bridge / flyout, portalled to `document.body` with `createPortal` |
| 45 / 46 | MobileToolbar sheet scrim / sheet |
| 50 | Dialogs, desktop TileInfoPanel, MobileToolbar bar |
- A flyout rendered inside the sidebar is clipped and sits under the toggle and minimap; portal it to `body` and use 44/45 like `Sidebar.tsx`.

### Map input
- The canvas `handleWheel` and `handleTouchMove` (`CanvasIsometricGrid.tsx`) call `preventDefault()` unless the target is inside `[data-no-wheel-zoom]`. Any scrollable panel laid over the map needs that attribute (as `TileInfoPanel` has), or it zooms the map instead of scrolling.
- Gesture rules are pure in `src/lib/touchGestures.ts`: `classifyTouch`, `hasMovedBeyondTap`, `needsTapConfirm`, `createPinchStart`, `computePinchPose`; tests in `src/lib/__tests__/touchGestures.test.ts`. Change thresholds there, not in handlers.
- Long scroll lists: `useScrollFade` (`src/hooks/useScrollFade.ts`) fades the last 44px so cut-off content reads as scrollable; add `overscroll-contain`.

## Gotchas
- Past fixes worth reading before similar work: `07208d3` (phone 44px over tablet 40px), `9bdd4b3` (landscape 44px, flyouts above toggle/minimap, portalled submenu), `be4ca1b` (wheel scrolls the tile panel, flyout lists fade).
- `[role="dialog"]` on phones gets forced `max-width`/`max-height` with `!important` in `globals.css`; size dialogs inside that.
- Width 769-1023px is "tablet" even with a mouse; check it, not just 768 and 1440.
- `min-[1440px]:` is used in `TopBar.tsx` for the roomy desktop layout; match it for top-bar items.

## Verify
- Screenshot at 1440x900, 768x1024, 390x844 and 844x390 (landscape phone). Use the Playwright recipe in skills/verification-gate, with touch on for the phone sizes.
- On 390x844 and 844x390: every new button at least 44px, nothing under the toolbar or notch.
- Scroll every new panel with wheel and finger over the map: the panel scrolls, the map does not zoom.
- Open a flyout next to the minimap and overlay toggle: the flyout is on top, dialogs above it.
- Then skills/verification-gate.
