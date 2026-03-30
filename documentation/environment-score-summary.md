# Environment Scoring Summary

## Commit

- `80237c9` - `Adjust environment scoring and document changes`

## Scope

This summary only covers the environment scoring changes introduced in this commit.

## Main scoring changes

- Removed the old built-in environment baseline. New cities no longer start with an automatic positive score.
- Replaced the previous formula with a dedicated `calculateEnvironmentScore()` helper in `src/lib/simulation.ts`.
- Lowered the target green coverage for a max score from an effective `35%` tree-equivalent baseline to `25%`.
- Water no longer contributes direct positive environment value.
- Parks still help, but at half the weight of trees.
- Pollution is now applied as a direct per-tile penalty.
- Final environment is clamped to the integer range `0..100`.

## New formula

The score is now computed from four values:

- `treeCount`
- `parkCount`
- `totalPollution`
- `playableTileCount`

Implementation summary:

- Trees contribute `100` coverage units each.
- Parks contribute `50` coverage units each.
- Target coverage is `25` units per playable tile.
- Green score = `floor((treeCount * 100 + parkCount * 50) * 100 / (playableTileCount * 25))`
- Pollution penalty = `floor(totalPollution / playableTileCount)`
- Final score = `clamp(greenScore - pollutionPenalty, 0, 100)`

## Tile counting rules

Environment uses `playableTileCount`, not raw map area.

- Tiles whose building type is `empty` are excluded.
- Water tiles are included in the denominator.
- Grass, trees, zoned tiles, service buildings, and other non-`empty` tiles are included.

Practical effect:

- Water makes it harder to reach a high environment score because it counts toward the map area target, but does not add green value by itself.

## What no longer applies

The old score effectively included:

- a built-in `+50` baseline
- direct positive contribution from water
- a green ratio based on `(treeCount + waterCount + parkCount) / (size * size)`

That model is gone. The new score is based on tree and park coverage over playable tiles, minus pollution.

## Initialization changes

- `createInitialStats()` now defaults environment to `0` instead of `75`.
- `createInitialGameState()` immediately recalculates the starting environment from the generated terrain, so a new map starts with a real score based on its trees and playable area.
- `generateRandomAdvancedCity()` now also uses the same environment formula instead of assigning a random environment number.

## Key file touched

- `src/lib/simulation.ts`
