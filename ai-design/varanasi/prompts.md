# Varanasi Sprite Pack Prompts

Image-generation prompts for the Varanasi art (Sprint 3, tasks S3-T2 and S3-T3; landmarks from S5-T2).
Until painted art exists, the game uses the procedural stand-ins in
`src/components/game/procedural/varanasiSprites.ts` (preview: `/dev/sprites` in `npm run dev`).
When a painted image is ready, convert it with `skills/varanasi-image-to-asset/SKILL.md`: keep the raw image in
`ai-design/varanasi/`, ship the processed PNG + WebP in `public/assets/`.

Every prompt below must keep the mandatory terms from `ai-design/terms.md`: isometric-compatible, oblique overhead view,
3/4 top-down, orthographic, game sprite, and solid bright red background (`#FF0000`).

---

## 1. Shared style block (paste at the start of every prompt)

Warm, realistic isometric pixel-art-style game sprite for a SimCity-like city builder set in Varanasi, India, rendered in an
isometric-compatible, oblique overhead view, 3/4 top-down, orthographic projection (no perspective, no vanishing points),
matching the camera angle and scale of the existing IsoCity sprite sheets: the ground footprint is a flat diamond that is
about 1.67 times as wide as it is tall (tile height = 0.6 × tile width), with the building's front corner pointing straight
down. Soft painted shading with one consistent light from the top-left: roofs and ground brightest, left-facing walls lit,
right-facing walls in soft shade, gentle ambient occlusion where walls meet the ground, subtle dark outlines. Each building
stands on its own thin ground slab (packed earth, paving or lawn) with a visible edge, like a small diorama. Palette:
sandstone and ochre, cream Chunar stone, faded pastel plaster (pink, yellow, turquoise), whitewash, terracotta, weathered
concrete, monsoon stains and rain streaks. Indian details where they fit: black plastic rooftop water tanks, laundry lines,
steel shutters, satellite dishes, potted tulsi plants, peepal and neem trees. No people, no vehicles, no animals, no text,
no letters or numbers, no logos, no brand names, no watermark. Solid bright red background (`#FF0000`), flat, with no
gradient, no shadow cast onto the background, no border, no alpha channel.

### Colour rule for the red chroma key (important)

The loader (`src/components/game/imageLoader.ts`) makes every pixel within colour distance 155 of pure red transparent.
Any red, orange-red, pink-red, terracotta or maroon that is too close to `#FF0000` will be punched out of the sprite.
Keep these colours clearly away from pure red:

| Wanted colour | Safe choice (example) | Avoid |
|---------------|-----------------------|-------|
| Saffron / marigold | golden saffron `#F4A300`, marigold `#F2B01E` | orange-red `#FF5A1F` |
| Government maroon trim | deep brown-maroon `#5A2A24` | bright maroon `#8C1C1C` |
| Brick | brown brick `#7E4A36`, `#6E4633` | orange-red brick `#B5452E` |
| Terracotta / clay pots | earthy `#8A5A40` | `#C0502F` |
| Pink plaster | dusty pink `#D9A8A2` | salmon red `#F0645A` |

After generation, always preview the sheet through the chroma key (run the game or `/dev/sprites`) and look for holes.

---

## 2. Varanasi main sheet (S3-T2): `ai-design/varanasi/sprites_varanasi.png`

Same 5×6 grid, order and scale as `public/assets/sprites_red_water_new.png` (2048 × 2048 pixels, 5 columns × 6 rows,
one sprite per cell, row by row, left to right). The runtime pack maps cells by this order (`spriteOrder` in
`src/lib/renderConfig.ts`), so the order must not change.

**Prompt:**

> [Shared style block] Create a square 2048 × 2048 sprite sheet laid out as an even grid of 5 columns and 6 rows, one
> isolated building per cell, centred in its cell with generous red margins, all at the same scale and camera as a
> classic isometric city-builder sheet. Cells, row by row, left to right:
>
> Row 1:
> 1. an 8–10 storey concrete apartment block with balconies, window grilles, AC units and black water tanks on the roof;
> 2. a glass-and-concrete commercial complex (6–8 storeys) with a blank signboard band and a bank-branch ground floor;
> 3. a small industrial workshop with sheds, a short chimney, drums and stacked materials;
> 4. a fire station: cream building with deep brown-maroon trim, two red-brown fire-truck bays with shutters, boundary wall;
> 5. a district hospital: 3-storey cream government building with deep maroon bands, a porch, boundary wall and a few trees.
>
> Row 2:
> 6. a small neighbourhood park with neem trees, a paved path, benches and a small whitewashed shrine platform under a peepal tree;
> 7. a large garden with lawns, flowering bushes, a stepped kund (tank) with water and a small chhatri pavilion;
> 8. an outdoor badminton court with a net, a low fence and floodlight poles;
> 9. a police thana: 2-storey cream building with deep maroon trim, a flagless flagpole, a boundary wall and a gate;
> 10. a government school: 2-storey cream building with maroon bands, a verandah with arches, a dusty playground and a boundary wall.
>
> Row 3:
> 11. a college campus: sandstone academic blocks with arched verandahs around a lawn;
> 12. a concrete overhead water tank on eight pillars with bracing rings, cream with a deep maroon band (Intze type);
> 13. a thermal power station with two cooling towers, a tall chimney, conveyor belts and transformers;
> 14. a cricket stadium: oval stands, a green outfield, a brown pitch strip in the middle and floodlight towers;
> 15. a science centre with a white planetarium dome and a small garden (this building is hidden on the Varanasi map).
>
> Row 4:
> 16. a single peepal tree with a broad canopy and heart-shaped leaves, on a small grass base;
> 17. a 2-storey pucca house with a flat roof terrace, parapet, black water tank, laundry line and a small yard;
> 18. a haveli: a 3-storey courtyard mansion in ochre sandstone with carved jharokha balconies and an arched gateway;
> 19. a 1-storey pucca house in faded pastel plaster with a flat roof, water tank, steel door and a potted tulsi plant;
> 20. a 2-storey bazaar building: shops with rolled-up steel shutters and awnings below, a home with balconies above.
>
> Row 5:
> 21. a small single-storey bazaar shop with a steel shutter, a cloth awning and goods stacked outside;
> 22. a godown (warehouse) with a corrugated roof, loading platform and sacks;
> 23. a Banarasi silk-weaving shed: long low brick building with skylights, handloom frames visible through open doors;
> 24. a brick kiln with a tall tapering chimney and stacks of drying bricks;
> 25. a larger industrial unit with sheds, tanks, pipes and a chimney.
>
> Row 6:
> 26. a small regional airport terminal with a control tower and an apron (runway cropped to the slab);
> 27. a metro station entrance: a canopy over stairs, sandstone-clad walls, railings;
> 28. the Nagar Nigam municipal office: a stately colonial-era sandstone building with a central portico and a small dome;
> 29. a museum in Indo-Saracenic style with arches, chhatris and a courtyard garden;
> 30. a mela fairground with a giant wheel, colourful canopies and stalls.
>
> Keep every sprite isolated with no overlap between cells. Solid bright red background (`#FF0000`).

**Companion sheets** (same grid and order, same prompt with one extra sentence):

| File | Extra sentence |
|------|----------------|
| `sprites_varanasi_construction.png` | "Show every building under construction: bamboo scaffolding, exposed brick and concrete frames, green safety nets, sand and brick piles." |
| `sprites_varanasi_abandoned.png` | "Show every building abandoned: faded paint, broken windows, plants growing from cracks, monsoon stains, no people." |
| `sprites_varanasi_dense.png` | "Make each residential/commercial cell a denser, taller variant of the same type (more floors, packed balconies, more rooftop tanks)." |
| `sprites_varanasi_parks.png` | Use the parks sheet order from `SPRITE_PACK_SPRITES4.parksBuildings` and describe each park with Indian planting (neem, ashoka, bougainvillea) and kund-style water. |

---

## 3. Varanasi specials sheet (S3-T3 and S5-T2): `ai-design/varanasi/sprites_varanasi_specials.png`

One 5×6 sheet (2048 × 2048) for the buildings that only exist in this project. Cells not listed stay empty red.
The river side of every waterfront sprite is the **lower-right** edge of the diamond (the game mirrors the image for the
other orientation), so steps descend towards the lower-right.

> [Shared style block] Create a square 2048 × 2048 sprite sheet laid out as an even grid of 5 columns and 6 rows, one
> isolated sprite per cell, row by row, left to right, same camera and scale as a classic isometric city-builder sheet.
> Cells 1–3 and 4 must fill their whole diamond edge to edge with no slab border, because they tile seamlessly in rows.
>
> 1. Ghat, plain (1 tile): sandstone steps filling the whole tile, a flat paved platform along the upper-left edge,
>    a flight of steps, a landing, a second flight and a wet algae-darkened ledge along the lower-right (river) edge;
>    the step lines run parallel to the river edge and reach both side edges of the diamond so neighbouring tiles join;
>    a few marigold heaps and brass pots.
> 2. Ghat with pavilion (1 tile): the same steps with identical heights, plus a small stone chhatri (four pillars and a
>    small dome) on the platform and one large flat bamboo-cane umbrella over a wooden takht on the landing.
> 3. Ghat with shrine (1 tile): the same steps, plus a small whitewashed shrine platform with a tiny curved spire and a
>    golden-saffron triangular flag on a bamboo pole on the platform.
> 4. Embankment (1 tile): a raised grey-brown earthen bank filling the whole tile, flat compacted-earth top with grass
>    tufts, stone-pitched side walls with weep holes; tileable in straight lines in both directions.
> 5. Informal housing A (1 tile): three small self-built homes of exposed brown brick and turquoise plaster with
>    corrugated tin roofs (grey and rusty brown) and a blue tarpaulin roof held down with bricks and a tyre, a black
>    rooftop water tank, a blue plastic water drum, a woven charpai cot, a clothes line with colourful clothes, a tulsi
>    pot; tidy, lived-in and dignified.
> 6. Informal housing B (1 tile): a narrow 2-storey brick home, ground floor plastered dusty pink with a turquoise door,
>    a tarpaulin shelter and a satellite dish on the roof, plus a lean-to tin shack, drums, potted plants and laundry.
> 7. Sewage treatment plant (2×2 tiles): a walled concrete compound with two round clarifier tanks (one murky olive,
>    one clearer blue-green) with rotating bridges, a rectangular aeration tank with white bubbles, blue and grey pipes,
>    a small cream control building with a blue band and a black rooftop water tank, a gate and a few trees.
> 8. Jal Sansthan water works (3×3 tiles): a cream government compound with a deep brown-maroon coping on its boundary
>    wall, a tall Intze overhead tank on eight pillars (cream with a maroon band), rectangular filter beds with blue water,
>    a round clarifier, a pump house with arched windows, an intake well tower, pipes, lawns and ashoka trees.
>
> Cells 9–13 are real landmarks: draw recognisable silhouettes with care and respect, no invented religious imagery,
> no idols, no symbols, no text, no damage.
>
> 9. Dashashwamedh Ghat (2×2 tiles): a grand two-tier stepped ghat; old ochre, pink and cream riverfront buildings with
>    arched windows and jharokhas along the upper-left edge; three stone chhatris on the high terrace; a broad flight of
>    steps down to a landing with five small square aarti platforms in a row (each with a brass lamp stand and a saffron
>    cloth); large cane umbrellas; a wet ledge along the lower-right river edge. The lower-right half must use the same
>    step heights as the plain ghat so it joins a row of ghats.
> 10. Kashi Vishwanath Temple (2×2 tiles): a pale stone courtyard with cream sandstone arcaded ranges along the two back
>     edges, a central white marble sanctum topped by a tall gold-plated curvilinear shikhara with miniature spires, an
>     amalaka and a finial with a small saffron pennant, a gold-plated dome over the porch, a smaller white stone spire
>     beside it, a peepal tree, low railings and a gateway on the front edges.
> 11. Banaras Hindu University (4×4 tiles): a large Indo-Saracenic academic building in pinkish-red sandstone with cream
>     trim, two storeys of pointed arched verandahs, a U-shaped plan around a forecourt, domed chhatris at the wing ends,
>     a central clock tower with plain clock faces (no numerals) and a dome, green lawns, paved avenues lined with ashoka
>     trees and a small round fountain.
> 12. Sarnath, Dhamek Stupa (3×3 tiles): the massive cylindrical Dhamek Stupa on a round stone platform, lower part of
>     buff carved stone with a decorative band and eight projecting faces with small arched niches, upper part of weathered
>     red-brown brick with a worn, rounded top; green lawns, low red-brick monastery ruins laid out as grids of cells,
>     two small votive stupas, a brick path, a few trees.
> 13. Ramnagar Fort (3×3 tiles): a cream Chunar-sandstone riverside fort with high ramparts, crenellations, round corner
>     bastions with small domed kiosks, a tall arched gateway flanked by two turrets, many jharokha balconies on the
>     river-facing (lower-right) wall, and a multi-storey palace block inside with rooftop chhatris and a small garden.
>
> Solid bright red background (`#FF0000`).

**Scale inside the cells:** in the existing sheets a 1×1 building's slab spans about 80 % of the cell width. For this
sheet, draw the 1×1 cells (1–6) with their diamond at ~80 % of the cell width, and draw the larger footprints at the
same *tile* size where the cell allows it, otherwise shrink uniformly and set a per-building scale in the pack config
(`parksScales`-style) instead of distorting the art.

---

## 4. Single-sprite prompts

Use these when generating one sprite at a time (1024 × 1024, one centred sprite, same camera). They repeat the cell
descriptions above so each can be pasted on its own.

### 4.1 `ghat` (three variants, tileable)

> [Shared style block] Create one isolated 1×1 isometric tile sprite of a Varanasi ghat: warm sandstone steps that fill
> the entire diamond from edge to edge, with no slab border and no side wall on the upper-right and lower-left edges, so
> that identical tiles placed side by side form one continuous stepped riverbank. The upper-left third is a flat paved
> platform; then a flight of four steps, a paved landing, four more steps, and a wet, darker, algae-stained stone ledge along
> the lower-right edge where the river begins. Every step line is parallel to the lower-right edge and runs across the full
> tile. Small details: marigold heaps and brass lotas. [Variant B: add a small stone chhatri on the platform and a flat
> bamboo-cane umbrella over a wooden takht on the landing.] [Variant C: add a small whitewashed shrine platform with a tiny
> curved spire and a golden-saffron pennant on a bamboo pole.] Keep the step heights identical in all variants. Solid bright
> red background (`#FF0000`).

### 4.2 `embankment` (tileable)

> [Shared style block] Create one isolated 1×1 isometric tile sprite of a flood embankment (tatbandh): a raised grey-brown
> earthen bank that fills the entire diamond, flat compacted-earth top with pebbles and grass tufts kept away from the tile
> edges, vertical stone-pitched side walls with small weep holes, a little damp at the base. It must tile seamlessly in
> straight lines in both directions: no border lines on the top surface. Solid bright red background (`#FF0000`).

### 4.3 `informal_housing` (two variants)

> [Shared style block] Create one isolated 1×1 isometric sprite of an informal settlement plot in Varanasi, shown with dignity
> and care, not as a joke: small self-built homes of exposed brown brick and faded turquoise plaster, corrugated tin roofs
> (grey and rust brown) and a blue tarpaulin roof held down with bricks and an old tyre, a black plastic rooftop water tank,
> a blue water drum, a woven charpai cot, a clothes line with bright clothes, a potted tulsi plant, a swept packed-earth yard
> with a short brick path. [Variant B: a narrow 2-storey brick home with a dusty-pink plastered ground floor, a turquoise
> door, a rooftop tarpaulin shelter, a satellite dish and a lean-to tin shack beside it.] Solid bright red background (`#FF0000`).

### 4.4 `sewage_treatment_plant` (2×2)

> [Shared style block] Create one isolated 2×2-tile isometric sprite of a municipal sewage treatment plant: a low-walled
> concrete compound with a gate, two round clarifier tanks with rotating bridges (one with murky olive water, one with
> clearer blue-green water), a rectangular aeration tank with rows of white bubbles, blue and grey pipes, a small cream
> control building with a blue band, windows and a black rooftop water tank, grass verges and two trees. Clean and
> functional, not dirty. Solid bright red background (`#FF0000`).

### 4.5 `jal_sansthan_water_works` (3×3)

> [Shared style block] Create one isolated 3×3-tile isometric sprite of the Jal Sansthan water works, a government water
> treatment compound in cream paint with deep brown-maroon trim: a boundary wall with maroon coping and a gate with pillars,
> a tall Intze-type concrete overhead water tank on eight pillars with two bracing rings, rectangular filter beds with blue
> water and walkways, a round clarifier, a pump house with pointed arched windows, an intake well tower, blue and grey pipes,
> lawns and ashoka and neem trees. Solid bright red background (`#FF0000`).

### 4.6 `landmark_dashashwamedh` (2×2)

> [Shared style block] Create one isolated 2×2-tile isometric sprite of Dashashwamedh Ghat in Varanasi, respectful and
> recognisable, no people, no text: a grand two-tier stepped ghat whose steps descend towards the lower-right river edge;
> a row of old ochre, dusty-pink and cream riverfront buildings with arched windows and jharokhas along the upper-left edge;
> three stone chhatris on the high terrace; a broad flight of steps; on the lower landing a row of five small square aarti
> platforms, each with a brass lamp stand and a golden-saffron cloth; large flat bamboo-cane umbrellas; two saffron pennants
> on bamboo poles; a wet algae-darkened ledge at the river edge. The step lines reach both side edges so a row of ghats can
> continue on either side. Solid bright red background (`#FF0000`).

### 4.7 `landmark_kashi_vishwanath` (2×2)

> [Shared style block] Create one isolated 2×2-tile isometric sprite of the Kashi Vishwanath Temple, drawn with care and
> respect, recognisable silhouette, no invented religious imagery, no idols, no symbols, no text: a pale stone-paved
> courtyard enclosed on the two back edges by cream sandstone arcades with pointed arches and small domes; in the centre a
> white marble sanctum on a plinth topped by a tall gold-plated curvilinear shikhara with clustered miniature spires, an
> amalaka and a small golden-saffron pennant; a gold-plated dome over the porch; a smaller white stone spire beside it;
> a peepal tree; low railings and a small gateway on the front edges. Solid bright red background (`#FF0000`).

### 4.8 `landmark_bhu` (4×4)

> [Shared style block] Create one isolated 4×4-tile isometric sprite of Banaras Hindu University: a large Indo-Saracenic
> academic building in pinkish-red sandstone with cream bands, two storeys of pointed arched verandahs, a U-shaped plan
> around a forecourt, a central projecting porch, domed chhatris on the roof at the wing ends, a central clock tower with
> plain clock faces (no numerals, no text) and a cream dome, wide green lawns with mowing stripes, paved avenues lined with
> slim ashoka trees, large neem and peepal trees at the corners and a small round fountain. Solid bright red background (`#FF0000`).

### 4.9 `landmark_sarnath` (3×3)

> [Shared style block] Create one isolated 3×3-tile isometric sprite of Sarnath's Dhamek Stupa, accurate and respectful,
> no people, no text: a massive cylindrical stupa (about 1.5 times as tall as it is wide) on a round stone platform; the
> lower part of buff carved stone with a band of fine floral carving and eight slightly projecting faces with small arched
> niches; the upper part of weathered red-brown brick with visible courses and a worn, rounded, slightly flattened top;
> green lawns, low excavated red-brick monastery ruins laid out as grids of small cells, two small votive stupas, a brick
> path and a few trees. Solid bright red background (`#FF0000`).

### 4.10 `landmark_ramnagar_fort` (3×3)

> [Shared style block] Create one isolated 3×3-tile isometric sprite of Ramnagar Fort, the cream Chunar-sandstone riverside
> fort near Varanasi, respectful, undamaged, no text: high ramparts with crenellations and monsoon stains, round corner
> bastions with arrow slits and small domed kiosks, a tall arched gateway with wooden doors flanked by two square turrets
> with small onion domes, many jharokha balconies and arched windows on the river-facing lower-right wall, and inside a
> multi-storey palace block with rows of arched windows, jharokhas and rooftop chhatris, plus a small garden with a tree.
> Solid bright red background (`#FF0000`).

---

## 5. After generation (checklist)

1. Save the raw image unchanged in `ai-design/varanasi/` (for example `sprites_varanasi_specials_raw.png`).
2. Follow `skills/varanasi-image-to-asset/SKILL.md` to produce the PNG + WebP runtime copies in `public/assets/`.
3. Check the chroma key: no holes in saffron, maroon, brick or terracotta areas, no red fringe (zoom 1× and 3×).
4. Check tiling: place 10 ghats in a row and a line of embankments; there must be no visible seams at zoom 2×.
5. Compare against the procedural sprite in `/dev/sprites` for footprint, height and camera; the painted sprite replaces it
   one-for-one (same footprint, same river-facing edge, same `flipped` behaviour).
