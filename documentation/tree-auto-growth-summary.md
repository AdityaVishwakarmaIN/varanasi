# Tree Auto-Growth System Summary

## Implementation Scope

- Automatic tree growth on grass/plain tiles during simulation ticks.
- Weather-driven probability system integrated with existing cloud weather modes.
- No save-state changes required; runtime calculation similar to fire weather mechanics.
- Trees grow only on tiles with `building.type === 'grass'`.

## Growth Probabilities

Per-tick probability for each grass tile based on current weather:

| Weather Mode | Probability | Description |
|--------------|-------------|-------------|
| `clear` | 0% | No tree growth (skips calculation) |
| `light_clouds` | 0.002% | Extremely slow natural growth |
| `storm` | 0.008% | Very slow growth with moisture |
| `severe_storm` | 0.04% | Slow growth from heavy rain |

## Configuration

All tree growth settings are centralized in `src/lib/treeGrowth.ts`:

```typescript
export const TREE_GROWTH_CONFIG: Record<CloudWeatherMode, number> = {
  clear: 0,
  light_clouds: 0.00002,
  storm: 0.00008,
  severe_storm: 0.0004,
};
```

## Integration

### Simulation Tick
- Tree growth pass runs after main building processing in `simulateTick()`.
- Iterates over all grass tiles and applies weather-based probability.
- Uses existing row-cloning optimization to minimize unnecessary mutations.

### Files Modified
- `src/lib/treeGrowth.ts` (NEW) - Core growth logic and configuration
- `src/lib/simulation.ts` - Imported `tryGrowTree()` and added growth pass

### Function Signature
```typescript
export function tryGrowTree(tile: Tile, growthChance: number): boolean
```

**Parameters:**
- `tile`: The tile to potentially grow a tree on (must be grass type)
- `growthChance`: Pre-calculated probability for current weather (0 = skip entirely)

**Returns:**
- `true` if a tree was grown, `false` otherwise

## Design Decisions

### Why Weather-Based?
- Storms bring moisture, which naturally accelerates plant growth.
- Clear weather represents dry conditions with minimal spontaneous growth.
- Integrates with existing weather system without additional state.

### Why Grass Tiles Only?
- Grass represents undeveloped, natural land suitable for vegetation.
- Prevents trees from growing on roads, buildings, or water.
- Consistent with terrain generation logic in `generateTerrain()`.

### Performance Considerations
- **Early exit for clear weather**: Entire tree growth pass is skipped when weather is `clear` (0% chance), avoiding all iteration and calculations.
- **Pre-calculated probability**: Weather lookup happens once per tick, not per tile.
- **No Math.random() for clear weather**: Zero CPU waste when growth is disabled.
- **Lazy row cloning**: Rows are only cloned AFTER a tree actually grows, avoiding ~99.96% of unnecessary memory allocations.
- **Grass-only filtering**: Non-grass tiles are skipped immediately without function call overhead.
- **Single pass iteration**: Same efficient pattern as pollution cleanup.

## Future Enhancements (Optional)

- **Seasonal modifiers**: Adjust growth rates by in-game season.
- **Soil quality**: Tiles near water or parks could have higher growth rates.
- **Tree caps**: Maximum tree density per region to prevent overgrowth.
- **Species variety**: Different tree types based on biome or location.
- **Player control**: Option to disable auto-growth or set growth rate multiplier.

## Testing Notes

- Growth is probabilistic; individual ticks may not show visible changes.
- Over many ticks, average growth rate should match configured probabilities.
- **Expected growth per 10,000 grass tiles per tick:**
  - `light_clouds`: ~0.2 trees (1 tree every ~5 ticks)
  - `storm`: ~0.8 trees (1 tree every ~1-2 ticks)
  - `severe_storm`: ~4 trees (4 trees per tick on average)
- Severe storms produce noticeably faster reforestation than clear weather.
- No growth occurs on zoned grass tiles awaiting development.
- For a 50x50 grid (2,500 tiles), expect ~1 tree per tick during severe storms.
