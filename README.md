# Varanasi

An isometric city builder set in Varanasi, the city on the Ganga. You plan a living city along the river: ghats, bazaars, mohallas, monsoon floods, festivals and landmarks. The river's health depends on the choices you make.

It runs in the browser on desktop and mobile. It is built with Next.js, TypeScript and HTML5 Canvas.

## Features

-   **Varanasi map**: the river bend, the ghats and the neighbourhoods of the old city, drawn on an isometric grid.
-   **Living city**: zoning, roads, services, traffic, pedestrians, boats, and an economy with a budget.
-   **The Ganga**: river health, pollution and monsoon floods that reshape the riverfront every year.
-   **Festivals and landmarks**: a festival calendar (Dev Deepawali, Maha Shivratri and others) and landmarks that unlock as the city grows.
-   **Feedback**: problem icons, named advisors, a citizen feed and contextual tips.
-   **Sound**: synthesized sound effects, river and temple-bell ambience, and an optional music playlist (see `public/audio/LICENSES.md`).
-   **Mobile**: touch controls, bottom-sheet panels, safe-area support and a battery saver when paused.
-   **Saves**: autosave plus several saved cities in local storage.

## Getting started

Prerequisites: Node.js 18 or higher, and npm.

```bash
npm install
npm run dev      # http://localhost:3000
```

Other commands:

```bash
npm run build    # production build (also type-checks)
npm run lint     # ESLint
npm test         # unit tests (Vitest)
```

Developer tools (sprite test view, benchmarks, perf HUD) are hidden. Add `?dev=1` to the URL to show them.

Set `NEXT_PUBLIC_SITE_URL` in production so Open Graph links are absolute.

## Project layout

-   `src/app/`: Next.js App Router pages
-   `src/components/`: React components (`Game.tsx` is the main entry)
-   `src/context/`: global game state
-   `src/lib/`: simulation, rendering and game rules, with tests in `src/lib/__tests__/`
-   `documentation/`: game design and sprint plans

## Credits

Varanasi is built on [IsoCity](https://github.com/amilich/isometric-city) by Andrew Milich (MIT licence). The rendering engine, simulation base and sprite sheets come from IsoCity. The in-game Credits screen lists all art, font and audio sources.

## License

Distributed under the MIT License. See `LICENSE` for more information.
