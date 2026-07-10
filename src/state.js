import * as THREE from 'three'

/**
 * The living state of Eden.
 * A single mutable organism shared by every system — camera, biomes,
 * shaders, sound. Mutated inside the frame loop, never through React.
 */
export const eden = {
  // journey
  progress: 0, // smoothed 0..1 along the world
  target: 0, // where the visitor wants to be
  velocity: 0,

  // genesis (the opening: darkness -> seed -> tree -> world)
  awake: false, // visitor touched the void
  genesis: 0, // 0..1 growth of the world

  // presence (the cursor is not a cursor)
  pointer: new THREE.Vector2(0, 0), // ndc
  presence: new THREE.Vector3(0, 6, -10), // world position
  presenceStrength: 0, // 0..1, grows while the visitor moves

  // adaptive rendering
  tier: 2, // 0 = essence, 1 = life, 2 = abundance
  mobile: false,
}

/**
 * Uniforms shared by every shader in Eden, updated once per frame.
 * Every material references these exact objects, so the whole world
 * breathes on the same pulse.
 */
export const world = {
  uTime: { value: 0 },
  uGenesis: { value: 0 },
  uProgress: { value: 0 },
  uPresence: { value: eden.presence },
  uPresenceStrength: { value: 0 },
  uGlow: { value: new THREE.Color('#6fffc2') }, // current biome bio-light
  uSunDir: { value: new THREE.Vector3(0.3, 0.2, -1).normalize() },
  uSunColor: { value: new THREE.Color('#fff4d8') },
}

// a quiet door for tests and curious consoles
if (typeof window !== 'undefined') window.__EDEN__ = { eden, world }

const listeners = new Set()
export const onBiomeChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
let lastBiome = -2
export const announceBiome = (index) => {
  if (index === lastBiome) return
  lastBiome = index
  listeners.forEach((fn) => fn(index))
}
