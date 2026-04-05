---
name: varanasi-image-to-asset
description: Convert generated images or image sheets into runtime-safe assets for the Varanasi project. Use when an image already exists and Codex needs to inspect it, keep the raw source untouched, export paired `960x960` PNG and WebP runtime assets with lossless compression, wire them into `public/assets`, connect them to the game renderer, and verify that chroma-key filtering, crop math, and runtime loading behave correctly in this repo.
---

# Varanasi Image To Asset

Use this skill after the image already exists. If the task is to generate the image itself, use the repo's asset-generation guidance first, then return to this skill for conversion and integration.

## Workflow

- Read the design source in `ai-design/` first. Start with the prompt file and any companion notes that define style, camera angle, background color, grid layout, and ordering.
- Inspect the actual image, not just the prompt. Confirm the sheet layout, progression order, margins, artifacts, and whether cells are evenly spaced.
- Verify exact pixel dimensions on disk. Do not assume a described `3x3` or `6x5` sheet has clean integer cells until the file is measured.
- Treat the file in `ai-design/` as raw source. Do not overwrite it, resize it in place, or use it directly as the shipped runtime asset.
- Find the runtime code path being replaced. Keep spawn logic, movement, opacity, zoom fade, and gameplay behavior unless the asset itself requires a behavioral change.
- Find the existing image pipeline before making format decisions. In this repo, `src/components/game/imageLoader.ts` prefers WebP when available and applies red chroma-key filtering to sprite assets.
- Copy the raw source image into `public/assets/` with a stable descriptive name and do all runtime processing on that copy. Do not leave production-referenced assets only in `ai-design/`.
- Export exactly two runtime asset files: one PNG and one WebP.
- Both runtime asset files must be exactly `960x960` pixels before handoff.
- If the raw source is not already `960x960`, resize or pad the runtime export copy to `960x960` without modifying the raw source file.
- Lossless compression is mandatory for both runtime asset files before handoff.
- Add a dedicated config file when the sheet needs explicit crop rectangles or per-frame metadata. Store the runtime path, source rectangles, and base draw sizes there.
- Use explicit crop rectangles instead of assuming full-cell crops when the source has uneven margins or visible artifacts.
- Extend runtime types only as much as needed. Add a sprite key or frame identifier if the renderer needs it, but keep the higher-level semantic type if gameplay logic depends on it.
- Update the spawn or selection code to choose a sprite/frame key while preserving the existing semantic category.
- Replace the draw path only after the asset config and preload path exist.
- Preload the asset through the shared loader instead of ad hoc image loading.
- Run `npx tsc --noEmit` after integration. Use this as the primary compile check.
- Run build or lint only as secondary validation, and separate unrelated repo failures from asset-specific failures.

## Output Contract

- Do not choose between PNG and WebP in this workflow. Produce both.
- PNG and WebP are a paired runtime deliverable.
- Both output files must be `960x960`.
- Both output files must use lossless compression.
- The raw source in `ai-design/` must remain unchanged.

## Chroma-Key Rule

- Inspect `src/components/game/imageLoader.ts` before finalizing the asset.
- Check the background color, the threshold logic, and whether the loader prefers WebP.
- Since the loader may prefer WebP, validate both runtime outputs against the chroma-key behavior instead of assuming one format is enough.
- If a new asset should use a special chroma-key threshold, make that decision explicitly and document why.
- If clipped corners or sliced edges appear, debug in this order:
- Check whether runtime loaded WebP instead of PNG.
- Check whether either runtime asset was exported with accidental lossy compression.
- Check whether chroma-key filtering is too aggressive for the painted edge quality.
- Only after that, revisit crop rectangles or sprite placement math.

## Project-Specific Paths

- Prompt and source planning: `ai-design/`
- Runtime image assets: `public/assets/`
- Asset compression: `scripts/compress-images.mjs`
- Shared image loader and chroma-key filter: `src/components/game/imageLoader.ts`
- Main city cloud integration example:
- Config: `src/components/game/cloudSpriteConfig.ts`
- Render path: `src/components/game/effectsSystems.ts`
- Preload path: `src/components/game/CanvasIsometricGrid.tsx`

## Final Verification

- Confirm the raw source image in `ai-design/` is unchanged.
- Confirm the asset exists in `public/assets/`.
- Confirm both runtime asset files exist: PNG and WebP.
- Confirm both runtime asset files are exactly `960x960`.
- Confirm both runtime asset files are losslessly compressed.
- Confirm crop math matches the actual asset dimensions.
- Confirm the renderer preloads and draws the asset from the shared config.
- Confirm `npx tsc --noEmit` passes.
- State scope explicitly if only one renderer or subsystem was migrated.
