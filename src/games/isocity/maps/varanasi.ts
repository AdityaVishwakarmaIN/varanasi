/**
 * Varanasi map data (Sprint 2, S2-T2).
 *
 * The map is described as DATA, not hand-placed tiles, so it works at any map size.
 * Coordinates are fractions from 0 to 1:
 *   u = west edge (0) → east edge (1)   → grid x
 *   v = north edge (0) → south edge (1) → grid y
 * Tile = (round(u × (size − 1)), round(v × (size − 1))).
 */
export const VARANASI_MAP = {
  id: 'varanasi',
  // The Ganga: enters from the south, bulges WEST in the middle (the crescent), then leaves to the north-east.
  // The west bank of the bulge is where the ghats are.
  ganga: {
    name: 'Ganga',
    widthFraction: 0.05, // river width = 5% of map size (8 tiles at 160)
    points: [
      // centreline, south to north
      { u: 0.62, v: 1.0 },
      { u: 0.56, v: 0.85 },
      { u: 0.51, v: 0.68 }, // deepest part of the crescent (most western point is around here)
      { u: 0.52, v: 0.5 },
      { u: 0.58, v: 0.34 },
      { u: 0.7, v: 0.2 },
      { u: 0.86, v: 0.1 },
      { u: 1.0, v: 0.05 },
    ],
  },
  tributaries: [
    { name: 'Assi', widthTiles: 1, points: [{ u: 0.3, v: 0.9 }, { u: 0.42, v: 0.86 }, { u: 0.54, v: 0.84 }] },
    {
      name: 'Varuna',
      widthTiles: 2,
      points: [{ u: 0.0, v: 0.3 }, { u: 0.2, v: 0.26 }, { u: 0.4, v: 0.3 }, { u: 0.63, v: 0.28 }],
    },
  ],
  eastFloodplainFraction: 0.1, // sandy floodplain width on the EAST bank = 10% of map size
  treeDensity: { westBank: 0.06, eastBank: 0.02 }, // chance a land tile starts as a tree
} as const;

/** Tunables for how the river data is turned into tiles. */
export const VARANASI_GEN_CONFIG = {
  /** Centreline samples per tile of map size (the doc asks for at least 4). */
  samplesPerTile: 4,
  /** Bank wobble: ± fraction of the river's half-width. */
  bankWobble: 0.15,
  /** Minimum half-width in tiles so small maps still have a real river. */
  minHalfWidth: 1.25,
  /** Tributaries: extra half-width so thin streams stay 4-connected (no diagonal-only gaps). */
  tributaryHalfWidthPad: 0.35,
} as const;

export type MapId = 'random' | 'varanasi';
