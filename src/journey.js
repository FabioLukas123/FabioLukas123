import * as THREE from 'three'

/*
 * The single source of truth for the journey through the Library.
 * The camera travels a spline through nine stations; every region,
 * shader and sound reads the same normalized offset (0..1).
 */

export const BASE = import.meta.env.BASE_URL || './'
export const FONT_DISPLAY = BASE + 'fonts/cinzel-400.ttf'
export const FONT_DISPLAY_BOLD = BASE + 'fonts/cinzel-600.ttf'
export const FONT_SERIF = BASE + 'fonts/cormorant-400.ttf'
export const FONT_SERIF_ITALIC = BASE + 'fonts/cormorant-400i.ttf'

// Mutable shared state — read by the overlay, the cursor, the audio
// engine and the shaders on every frame. No re-renders involved.
export const state = {
  offset: 0,            // damped scroll progress 0..1
  velocity: 0,
  entered: false,       // user has crossed the threshold
  mouse: new THREE.Vector2(0, 0),   // NDC
  cursorWorld: new THREE.Vector3(), // cursor projected into the scene
  quality: 1,           // 0.35..1, set by the performance monitor
  regionIndex: -1,
}

export const STATIONS = [
  new THREE.Vector3(0, 0, 64),      // 0 the void
  new THREE.Vector3(0, -2, -90),    // 1 hall of origins
  new THREE.Vector3(10, 5, -205),   // 2 the philosophers
  new THREE.Vector3(-12, 2, -330),  // 3 the scientific vault
  new THREE.Vector3(8, -4, -455),   // 4 the archive of stories
  new THREE.Vector3(-8, 3, -575),   // 5 the memory chamber
  new THREE.Vector3(5, -7, -700),   // 6 the forbidden wing
  new THREE.Vector3(0, 12, -830),   // 7 the future shelves
  new THREE.Vector3(0, 46, -1000),  // 8 the reveal
]

export const CURVE = new THREE.CatmullRomCurve3(STATIONS, false, 'catmullrom', 0.35)

export const N_SEG = STATIONS.length - 1 // 8 segments

// getPointAt() is arc-length parameterized, but the stations are not
// equally spaced — compute each station's true arc-length offset so
// regions, overlay and audio all agree on where the camera actually is.
export const STATION_OFFSETS = (() => {
  const divisions = N_SEG * 100
  const lengths = CURVE.getLengths(divisions)
  const total = lengths[divisions]
  return STATIONS.map((_, i) => lengths[Math.round((i / N_SEG) * divisions)] / total)
})()

// Regions are indexed 1..7 (segment bands). 0 is the opening, 8 the finale.
export const REGIONS = [
  {
    numeral: '',
    title: 'THE LIBRARY OF HUMANITY',
    line: 'Every idea ever thought, kept in a single place.',
    fog: '#020204', tint: '#8fa3c8',
  },
  {
    numeral: 'I',
    title: 'THE HALL OF ORIGINS',
    line: 'The first fire. The first mark. The birth of thought.',
    fog: '#0b0503', tint: '#e08a3c',
  },
  {
    numeral: 'II',
    title: 'THE PHILOSOPHERS',
    line: 'A cathedral without end, where ideas become architecture.',
    fog: '#05060c', tint: '#9db4e8',
  },
  {
    numeral: 'III',
    title: 'THE SCIENTIFIC VAULT',
    line: 'Galaxies and atoms, shelved side by side.',
    fog: '#020508', tint: '#4fd8e8',
  },
  {
    numeral: 'IV',
    title: 'THE ARCHIVE OF STORIES',
    line: 'Every story ever told, burning as a constellation.',
    fog: '#060409', tint: '#c9a2ff',
  },
  {
    numeral: 'V',
    title: 'THE MEMORY CHAMBER',
    line: 'First steps. Last goodbyes. Everything is preserved.',
    fog: '#080503', tint: '#ffca7a',
  },
  {
    numeral: 'VI',
    title: 'THE FORBIDDEN WING',
    line: 'What was burned. What was lost. What still smoulders.',
    fog: '#070202', tint: '#ff5a3c',
  },
  {
    numeral: 'VII',
    title: 'THE FUTURE SHELVES',
    line: 'Books not yet written. Sciences not yet born.',
    fog: '#030608', tint: '#bfe8ff',
  },
  {
    numeral: '∞',
    title: 'YOU HAVE SEEN ONE HALLWAY',
    line: 'Of one wing. Of one floor. The Library continues.',
    fog: '#020204', tint: '#cdd7ee',
  },
]

// Which region (0..8) a given offset is closest to.
export function regionAt(offset) {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i <= N_SEG; i++) {
    const d = Math.abs(offset - STATION_OFFSETS[i])
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}

// 0..1 weight for region r, peaking at its station, gone by the next.
export function regionWeight(offset, r, spread = 0.62) {
  const d = Math.abs(offset - STATION_OFFSETS[r]) * N_SEG
  const t = Math.max(0, Math.min(1, 1 - d / spread))
  return t * t * (3 - 2 * t)
}

// Between which two stations does this offset sit, and how far across?
export function regionBlend(offset) {
  for (let i = 0; i < N_SEG; i++) {
    if (offset <= STATION_OFFSETS[i + 1]) {
      const span = STATION_OFFSETS[i + 1] - STATION_OFFSETS[i]
      return { i, t: THREE.MathUtils.clamp((offset - STATION_OFFSETS[i]) / span, 0, 1) }
    }
  }
  return { i: N_SEG - 1, t: 1 }
}

export function smooth(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
