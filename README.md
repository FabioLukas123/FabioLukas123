# THE LIBRARY OF HUMANITY

Every idea ever thought, kept in a single impossible structure.

This is not a website about books. It is a place. You cross a threshold in
total darkness, approach a single distant light, watch a book erupt into a
storm of pages, and travel one hallway of a structure that contains all
human knowledge — through seven regions, out to a height where the Library
reveals that the hallway was nothing at all.

## The journey

| | Region | |
|---|---|---|
| — | **The Void** | one light. one book. the storm begins |
| I | **The Hall of Origins** | a painted cave — hands, beasts, the first counting |
| II | **The Philosophers** | a cathedral without end; names float free of their bodies |
| III | **The Scientific Vault** | a galaxy for a ceiling, DNA for a chandelier |
| IV | **The Archive of Stories** | every story ever told, burning as a constellation |
| V | **The Memory Chamber** | not books — moments, held in amber light |
| VI | **The Forbidden Wing** | Alexandria burning forever, behind a sealed gate |
| VII | **The Future Shelves** | wireframe stacks assembling themselves for books not yet written |
| ∞ | **The Reveal** | the camera rises; the city of knowledge continues to every horizon |

## How it is built

- **React Three Fiber + Three.js + drei** — one continuous camera flight on an
  arc-length-parameterized Catmull-Rom spline; there are no pages, only regions.
- **Custom GLSL everywhere** — the page storm (12,000 instanced pages morphing
  from a closed book, through a vortex, into an endless drifting river — all in
  the vertex shader), the shelf-tower lattice with its rows of flickering lit
  books, the galaxy, the embers, the memory orbs' fresnel glow, the
  materializing wireframe towers.
- **GPU instancing throughout** — the entire architecture is a handful of draw
  calls. Regions cull themselves when the traveller is far away; the far field
  only materializes for the final reveal.
- **Procedural audio, no samples** — a stone-hall drone, synthetic-impulse
  convolution reverb, a distant choir, turning pages, whispers, embers and a
  sub-bass tremor, all synthesized live and crossfaded by region.
- **Procedural art** — the cave paintings are drawn onto a canvas texture at
  runtime: stencilled hands, beasts, spirals, tally marks.
- **The cursor is an instrument** — it attracts pages and memories inside the
  world, and reveals each region's hidden catalogue note.
- **Adaptive performance** — a performance monitor scales pixel ratio and
  particle counts; the experience degrades gracefully down to mobile.

## Run it

```bash
npm install
npm run dev      # develop
npm run build    # production build → dist/
```

Headphones recommended. The Library breathes.
