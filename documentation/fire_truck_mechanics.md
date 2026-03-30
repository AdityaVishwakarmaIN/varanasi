# Fire Truck Mechanics — Developer Summary

## Key Files

| File | Role |
|---|---|
| `src/lib/fireConfig.ts` | All fire constants (`FIRE_SIMULATION_CONFIG`, `FIRE_RESPONSE_CONFIG`, helpers) |
| `src/lib/simulation.ts` | Fire tick: progress, spread, ignition |
| `src/components/game/vehicleSystems.ts` | Dispatch logic, vehicle state machine, extinguishment |
| `src/components/game/types.ts` | `EmergencyVehicle` type (includes `pathLength`) |

---

## Fire Simulation Tick (`simulation.ts`)

Runs every game tick per burning tile.

```
onFire=true → fireProgress += 1 per tick
fireProgress >= 100 → building replaced with grass (destroyed)
```

- **Coverage does NOT extinguish** — it only reduces spread chance.
- **Spread**: adjacent burning tiles trigger `getFireSpreadChance(adjacentCount, fireCoverage, weather)`.
- **Ignition**: random chance per tile per tick via `getRandomFireIgnitionChance(type, weather)`, scaled by `FIRE_WEATHER_MULTIPLIERS`.

---

## Dispatch Gate (`updateEmergencyDispatch` in `vehicleSystems.ts`)

Called every ~1.5 **game-speed-scaled** seconds (`emergencyDispatchTimerRef -= delta * speedMultiplier`). For each unresponded fire:

1. Find nearest fire station (`findNearestFireStation`).
2. **Per-station cap**: skip if station already has `≥ maxTrucksPerStation (5)` active trucks.
3. **Radius cap**: compute `effectiveRange = SERVICE_CONFIG.fire_station.range × (1 + (level-1) × 0.2)`.
   Skip if `euclideanDist² > effectiveRange²`. Matches the visual overlay ring exactly.
4. Dispatch truck → store in `activeFiresRef` to prevent duplicate dispatch.

---

## Vehicle State Machine (`updateEmergencyVehicles`)

```
dispatching → (reaches target tile) → responding → (respondTime >= respondDuration) → returning → (reaches station) → removed
```

### On-Scene Duration
```ts
const effectiveRange = SERVICE_CONFIG.fire_station.range * (1 + (level-1) * 0.2);
const euclidean = clamp(dist(station, fire), 1, effectiveRange);
respondDuration = euclidean / 2;  // seconds (game-speed scaled)
```

| Station lv | Max range | Max on-scene |
|---|---|---|
| 1 | 18 tiles | 9s |
| 3 | ~25 tiles | ~12.5s |
| 5 | ~32 tiles | ~16s |

### Extinguishment (on `respondTime >= respondDuration`)
```ts
targetTile.building.onFire = false;
targetTile.building.fireProgress = 0;
activeFiresRef.delete(targetKey);
// vehicle transitions to 'returning', pathfinds back to station
```

---

## Config Reference

### `FIRE_SIMULATION_CONFIG`
| Key | Value | Purpose |
|---|---|---|
| `fireProgressPerTick` | 1 | Fire progress per simulation tick |
| `destructionThreshold` | 100 | Ticks before building is destroyed |
| `spreadChancePerAdjacentFire` | 0.005 | Base spread probability per adjacent fire |
| `maxCoverageSpreadReduction` | 0.95 | Max spread reduction from coverage |
| `randomIgnitionChance` | 0.00003 | Base random ignition per tile per tick |

### `FIRE_RESPONSE_CONFIG`
| Key | Value | Purpose |
|---|---|---|
| `fireTruckSpeed` | 0.8 | Truck movement speed |
| `maxTrucksPerStation` | 5 | Max simultaneously active trucks per station |

### `FIRE_WEATHER_MULTIPLIERS`
| Weather | Multiplier |
|---|---|
| `clear` | 1× |
| `light_clouds` | 3× |
| `storm` | 10× |
| `severe_storm` | 50× |

---

## What Was Removed

- **Passive suppression** (`getFireSuppressionChance`): fires previously self-extinguished every tick based on coverage. Deleted entirely.
- **Station cooldown**: post-return dispatch gate was prototyped then removed.
- **Staged extinguishment**: not implemented — extinguishment is instant on truck arrival.
