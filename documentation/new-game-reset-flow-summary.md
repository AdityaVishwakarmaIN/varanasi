# New Game Reset Flow Summary

## Commit

- `eecc5ed` - `Add full reset flow for new game`

## What changed

- The landing page now separates `Continue` from a destructive `New Game` reset action.
- A new confirmation dialog blocks accidental resets before starting a fresh city.
- Resetting no longer clears only the active autosave. It clears all matching IsoCity storage keys, then boots the app with `GameProvider startFresh={true}`.
- Storage key names were centralized in a shared helper so `page.tsx` and `GameContext.tsx` stop duplicating string constants and parsing logic.

## User-facing flow

- If an autosave exists, the primary CTA stays `Continue`.
- A secondary `New Game` text action appears beside the language selector on both mobile and desktop landing pages.
- Clicking `New Game` opens `ResetGameDialog`.
- Confirming the dialog clears persisted state, closes any pending co-op modal, clears room code state, resets landing-page save metadata, and opens the game in fresh-start mode.
- Loading a saved city or example state explicitly sets `startFreshGame` back to `false` so those paths keep restoring persisted data normally.

## Storage changes

- New shared module: `src/lib/isocityStorage.ts`.
- Shared constants now define the autosave key, saved-city restore key, saved-city index key, saved-city prefix, sprite-pack key, and day/night preference key.
- `hasIsoCityAutosave()` validates the autosave by parsing compressed and legacy JSON formats before the UI decides whether `Continue` should appear.
- `loadIsoCitySavedCities()` becomes the shared landing-page loader for the saved cities list.
- `clearIsoCityStoredGameData()` removes every `localStorage` and `sessionStorage` key that starts with `isocity-` or `coaster-`.

## Integration notes

- `src/app/page.tsx` now owns the reset UX and calls the storage helper before mounting the game.
- `src/context/GameContext.tsx` was updated to consume the shared storage constants everywhere it reads or writes persisted state.
- The reset button is gated by `hasSaved`, so the destructive option appears only when a valid autosave exists, not merely when historical saved-city entries exist.
- Because the storage clearer is prefix-based, future features that store unrelated state under `isocity-` or `coaster-` will also be wiped by `New Game`.

## Key files touched

- `src/app/page.tsx`
- `src/context/GameContext.tsx`
- `src/lib/isocityStorage.ts`
