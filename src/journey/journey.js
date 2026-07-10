import * as THREE from 'three'

/**
 * The spine of Eden — one unbroken path through the whole ecosystem.
 * There are no pages, no sections. Only this line through the world.
 */
export const path = new THREE.CatmullRomCurve3(
  [
    // the clearing where the seed falls
    [0, 7, 14],
    [2, 7, -30],
    // I — The Luminous Forest
    [8, 7.5, -70],
    [-9, 8.5, -115],
    [5, 10, -155],
    // ascent — II The Floating Gardens
    [0, 20, -200],
    [-12, 36, -250],
    [12, 44, -300],
    // descent — III The Crystal River
    [0, 26, -350],
    [-8, 11, -400],
    [7, 8, -450],
    // IV — The Giants (the open valley)
    [0, 15, -500],
    [-13, 23, -555],
    [9, 25, -610],
    // V — The Bloom
    [0, 13, -660],
    [-11, 8.5, -708],
    [9, 8.5, -752],
    // VI — The Memory Trees
    [0, 10, -800],
    [-7, 11, -848],
    [7, 12, -892],
    // VII — The Horizon (the climb)
    [0, 22, -930],
    [0, 46, -962],
    [0, 64, -996],
  ].map((p) => new THREE.Vector3(...p)),
  false,
  'catmullrom',
  0.5
)

export const BIOMES = [
  {
    name: 'The Luminous Forest',
    caption: 'A floresta aprendeu a fazer sua própria luz.',
    range: [0.0, 0.155],
    skyTop: '#071426',
    skyLow: '#0e4038',
    fog: '#0a2e2a',
    fogDensity: 0.0155,
    glow: '#52ffc0',
    sun: '#9fffe0',
    sunI: 0.55,
    stars: 0.7,
    aurora: 0.22,
  },
  {
    name: 'The Floating Gardens',
    caption: 'A terra esqueceu o peso de si mesma.',
    range: [0.155, 0.3],
    skyTop: '#123055',
    skyLow: '#88bccb',
    fog: '#628fa6',
    fogDensity: 0.0068,
    glow: '#b8f4ff',
    sun: '#fff4d8',
    sunI: 1.15,
    stars: 0.08,
    aurora: 0.12,
  },
  {
    name: 'The Crystal River',
    caption: 'A água guardou o céu dentro de si.',
    range: [0.3, 0.45],
    skyTop: '#0a2036',
    skyLow: '#207a84',
    fog: '#12414e',
    fogDensity: 0.011,
    glow: '#6ce4ff',
    sun: '#c9f6ff',
    sunI: 0.8,
    stars: 0.25,
    aurora: 0.18,
  },
  {
    name: 'The Giants',
    caption: 'Eles atravessam o céu há mil anos. Ninguém os apressa.',
    range: [0.45, 0.6],
    skyTop: '#1b1f40',
    skyLow: '#93739f',
    fog: '#4c4066',
    fogDensity: 0.0082,
    glow: '#e0bdff',
    sun: '#ffd9c2',
    sunI: 0.9,
    stars: 0.35,
    aurora: 0.4,
  },
  {
    name: 'The Bloom',
    caption: 'A vida, em sua forma máxima, é uma cor sem nome.',
    range: [0.6, 0.74],
    skyTop: '#2c1a3e',
    skyLow: '#ff9e78',
    fog: '#a86680',
    fogDensity: 0.009,
    glow: '#ffb3ec',
    sun: '#ffc79e',
    sunI: 1.2,
    stars: 0.1,
    aurora: 0.08,
  },
  {
    name: 'The Memory Trees',
    caption: 'Nada foi esquecido. A floresta lembra por nós.',
    range: [0.74, 0.88],
    skyTop: '#04060e',
    skyLow: '#1c2b40',
    fog: '#0b1322',
    fogDensity: 0.0148,
    glow: '#8fd8ff',
    sun: '#7fa8d8',
    sunI: 0.35,
    stars: 0.95,
    aurora: 0.85,
  },
  {
    name: 'The Horizon',
    caption: 'Tudo o que restou. Tudo o que sempre esteve por vir.',
    range: [0.88, 1.0],
    skyTop: '#3d70ac',
    skyLow: '#f2d5a4',
    fog: '#aabed4',
    fogDensity: 0.0038,
    glow: '#fff2c9',
    sun: '#fff0d0',
    sunI: 1.05,
    stars: 0.0,
    aurora: 0.15,
  },
]

// pre-parse colors once
const parsed = BIOMES.map((b) => ({
  ...b,
  _skyTop: new THREE.Color(b.skyTop),
  _skyLow: new THREE.Color(b.skyLow),
  _fog: new THREE.Color(b.fog),
  _glow: new THREE.Color(b.glow),
  _sun: new THREE.Color(b.sun),
}))

export const biomeAt = (t) => {
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (t >= parsed[i].range[0]) return i
  }
  return 0
}

const BLEND = 0.045 // breadth of the transition between worlds

/**
 * Sample the ecosystem's mood at journey position t.
 * Writes into `out` (no allocation) : { skyTop, skyLow, fog, glow, sun:Color,
 * fogDensity, sunI, stars, index }
 */
export const samplePalette = (t, out) => {
  const i = biomeAt(t)
  const cur = parsed[i]
  out.skyTop.copy(cur._skyTop)
  out.skyLow.copy(cur._skyLow)
  out.fog.copy(cur._fog)
  out.glow.copy(cur._glow)
  out.sun.copy(cur._sun)
  out.fogDensity = cur.fogDensity
  out.sunI = cur.sunI
  out.stars = cur.stars
  out.aurora = cur.aurora
  out.index = i

  // blend toward the next biome as we approach its threshold
  const next = parsed[i + 1]
  if (next) {
    const edge = next.range[0]
    const a = THREE.MathUtils.smoothstep(t, edge - BLEND, edge + BLEND)
    if (a > 0) {
      out.skyTop.lerp(next._skyTop, a)
      out.skyLow.lerp(next._skyLow, a)
      out.fog.lerp(next._fog, a)
      out.glow.lerp(next._glow, a)
      out.sun.lerp(next._sun, a)
      out.fogDensity = THREE.MathUtils.lerp(cur.fogDensity, next.fogDensity, a)
      out.sunI = THREE.MathUtils.lerp(cur.sunI, next.sunI, a)
      out.stars = THREE.MathUtils.lerp(cur.stars, next.stars, a)
      out.aurora = THREE.MathUtils.lerp(cur.aurora, next.aurora, a)
      if (a > 0.5) out.index = i + 1
    }
  }
  return out
}

export const makePaletteSample = () => ({
  skyTop: new THREE.Color(),
  skyLow: new THREE.Color(),
  fog: new THREE.Color(),
  glow: new THREE.Color(),
  sun: new THREE.Color(),
  fogDensity: 0.01,
  sunI: 1,
  stars: 0,
  aurora: 0,
  index: 0,
})

/** World-space center of a biome, for placing its life. */
export const biomeCenter = (i) => {
  const [a, b] = BIOMES[i].range
  return path.getPointAt((a + b) / 2)
}
