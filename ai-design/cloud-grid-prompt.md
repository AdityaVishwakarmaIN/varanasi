# 3x3 Cloud Grid Prompt

Create a square 3x3 grid of stylized 2D cloud sprites for an isometric city-builder game, rendered in an isometric-compatible, slightly top-down oblique / 3/4 overhead, orthographic view that matches the map perspective. Keep the final image in a 1:1 aspect ratio with a uniform solid bright red background (`#FF0000`). Enforce all six requirements: isometric-compatible, oblique overhead view, 3/4 top-down, orthographic, game sprite, and solid bright red background (`#FF0000`). Each cell should contain one cloud variant, arranged in a clear progression from faintest to most thunderous and rainy, left to right and top to bottom.

Cell order must be:
1. top-left: barely visible wispy cirrus
2. top-center: thin high cirrus
3. top-right: soft fair-weather cumulus
4. middle-left: light patchy altocumulus
5. middle-center: layered stratus
6. middle-right: darker overcast stratus
7. bottom-left: heavy cumulonimbus
8. bottom-center: storm cumulonimbus with rain
9. bottom-right: massive severe thunderstorm cloud with a black core, dark base, and charcoal anvil top, with no white core

The grid must support four runtime weather styles:
- `clear`: no cloud sprite should be used at runtime
- `light_clouds`: use only the lighter cells, primarily 1, 2, 3, 4, with 5 as the darkest allowed edge case
- `storm`: use transitional and storm cells 5, 6, 7, 8
- `severe_storm`: use the darkest storm cells 6, 7, 8, 9, with 9 reserved as the signature extreme storm frame

The visual progression should therefore read as calm weather across the top row, transitional overcast in the middle row, and storm to severe storm across the bottom row.

Use a soft painted style with clean silhouettes, subtle shading, cohesive palette, and no transparency. Keep the sprites isolated, evenly spaced, and consistent in scale. No sky, no horizon, no landscape, no text, no labels, no border, and no alpha channel.
