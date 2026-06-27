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
| `SHIFT` | hurry — the band picks up with you |
| `M` | mute the band |

By default the city drives: a slow, choreographed dolly travels the avenue
toward the **Herald**, the impossible central tower. Press `C` to take control.

## What's inside

- **`src/city.js`** — procedural Art Deco skyline. Towers are built as stepped
  ziggurat setbacks crowned with brass finials and spires; ten thousand windows
  are baked into emissive textures so they cost almost nothing. A red aviation
  beacon pulses at every spire.
- **`src/atmosphere.js`** — the air: layered fog, drifting haze, slanting rain,
  and great searchlights raking the sky.
- **`src/camera.js`** — the direction: a hand-authored spline of "stations" for
  the cinematic dolly, plus a weighty manual fly-cam.
- **`src/audio/jazz.js`** — **The Band.** A generative noir-jazz combo (walking
  upright bass, brushed swing drums, comping piano, muted trumpet) playing
  through wandering ii–V–i cells so the harmony never obviously repeats. Music
  behaves as another architectural layer; intensity rises as you climb and hurry.
- **`src/main.js`** — renderer, sculpting light, a real wet-street reflection,
  and a noir post-processing stack (bloom, teal/amber split-tone, vignette,
  film grain, edge chromatic aberration).

## Build

```bash
npm run build      # bundles src/ → dist/city.bundle.js (Three.js included)
```

## Philosophy

Every shadow has purpose. Every reflection tells a story. Every sound reinforces
space. This city is never "done" — each system is meant to be revisited,
criticized, and rebuilt better.
