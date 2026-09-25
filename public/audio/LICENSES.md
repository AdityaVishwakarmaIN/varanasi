# Audio licences

Rule (Sprint 5, S5-T9): **no audio file may be added without a row in this table.** Only CC0 or
properly licensed audio. Record the source URL and the licence for every file.

## Sound effects and ambience

None of the game's sounds are files. Every sound effect (UI click, building placed, road drawn,
bulldoze, weekly money, notification, crisis alert, landmark unlocked, festival start) and the
river-and-temple-bell ambience are synthesized at runtime with the Web Audio API
(`src/lib/audio/audioConfig.ts` `SFX_RECIPES`, `src/lib/audio/audioManager.ts`). They are original to
this project and covered by the repository's licence.

## Music

No music ships yet. The game plays music only if `public/audio/music/playlist.json` exists:

```json
{
  "tracks": [
    { "title": "Raga at dawn", "src": ["/audio/music/raga-dawn.ogg", "/audio/music/raga-dawn.m4a"] }
  ]
}
```

Targets: 3–5 calm Indian classical instrumentals (sitar, bansuri, santoor, tanpura drone), 2–4
minutes each, `.ogg` plus a `.m4a` fallback for Safari, under 3 MB per track. Tracks play as a
shuffled playlist after the first user interaction.

| File | Title / author | Source URL | Licence | Added by / date |
| ---- | -------------- | ---------- | ------- | --------------- |
| *(none yet)* | | | | |
