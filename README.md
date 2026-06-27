# THE CITY — A Dark Deco Metropolis

> Steel and shadow. A thousand lit windows and no one at home.
> Somewhere below, a band is already playing.

This is not a website. It is a living **Dark Deco city** — a timeless noir
metropolis you can explore in the browser, where Art Deco architecture, noir
light, monumental engineering and jazz become a single continuous experience.
It is meant to feel like stepping inside *Batman: The Animated Series*, built
with real-time WebGL.

Darkness is the primary material. Light exists only to sculpt the architecture.
The score is **generated live** — it never loops, and it breathes with how you move.

## Enter

Open `index.html` from any static host, or run it locally:

```bash
npm install        # only needed to rebuild
npm run dev        # builds + serves at http://localhost:5173
```

The experience is fully self-contained — the built bundle in `dist/` carries
its own copy of Three.js, so the city needs **no network at runtime**.

## How to move

| Input | Effect |
|------|--------|
| `ENTER THE CITY` | begin (also unlocks audio) |
| `C` | hand the wheel back and forth — *let the city drive* (cinematic dolly) ↔ walk it yourself |
| `W A S D` + mouse | drift and look (manual mode) |
| drag / swipe | glance around the moving city (works on touch) |
| `E` / tap prompt | at the club door, ride the elevator down into THE BLUE NOTE (and back up) |
| `SHIFT` | hurry — the band picks up with you |
| `M` | mute the band |

Entering plays a choreographed establishing shot — the city spread out beneath
the stars — then settles into a slow dolly down the avenue toward the
**Herald**, the impossible central tower. By default the city drives; press `C`
to take control, or just drag to glance around without stopping.

Wander down to **THE BLUE NOTE**, the jazz club off the avenue — the band gets
louder and more present the closer you stand, and at the door you can **ride
the elevator down inside**, into the basement room where the band is playing.

## What's inside

- **`src/city.js`** — procedural Art Deco skyline. Towers are built as stepped
  ziggurat setbacks crowned with brass finials and spires; thousands of windows
  are baked into emissive textures (warm tungsten, cold fluorescent, green
  office light) so they cost almost nothing. Spired towers carry a pulsing red
  aviation beacon; the rest get working rooftops — water towers, vents, antenna
  masts. Neon blade signs line the avenue, and **THE BLUE NOTE** jazz club sits
  in a carved gap in the canyon wall.
- **`src/atmosphere.js`** — the air and the heavens: a gradient sky dome, a low
  moon, a breathing star field, layered fog, drifting haze, slanting rain, and
  great searchlights raking the sky.
- **`src/life.js`** — the city is not empty: headlamp/tail-light traffic runs
  the avenue and cross-streets, and an elevated train periodically glides across
  a lit viaduct (with a station headhouse) in the mid-distance.
- **`src/interior.js`** — **THE BLUE NOTE**, a fully walkable basement jazz
  club reached by a brass elevator down a rung-lined shaft: a lit stage and a
  four-piece band in silhouette, candle-lit tables, a back bar, spotlit smoke.
  Inside, the score is locked fully present.
- **`src/camera.js`** — the direction: a one-time establishing shot, a
  hand-authored spline of "stations" for the cinematic dolly, a weighty manual
  fly-cam, and drag-to-peek for touch.
- **`src/audio/jazz.js`** — **The Band.** A generative noir-jazz combo (walking
  upright bass, brushed swing drums, comping piano, muted trumpet and a soft
  pad) playing through wandering ii–V–i cells so the harmony never obviously
  repeats. Music behaves as another architectural layer; intensity rises as you
  climb and hurry, and the mix swells as you approach the club. A limiter keeps
  busy bars clean.
- **`src/main.js`** — renderer, sculpting light, a real wet-street reflection,
  quality tiers for mobile, and a noir post-processing stack (bloom, teal/amber
  split-tone, vignette, film grain, edge chromatic aberration).

## Build

```bash
npm run build      # bundles src/ → dist/city.bundle.js (Three.js included)
```

## Philosophy

Every shadow has purpose. Every reflection tells a story. Every sound reinforces
space. This city is never "done" — each system is meant to be revisited,
criticized, and rebuilt better.
