import { useMemo } from 'react'
import * as THREE from 'three'
import Grove from './Grove'
import { makeTrunkMaterial, makeFoliageMaterial } from './TreeShaders'
import { mulberry } from './TreeFactory'
import { NOISE, withWorld } from '../shaders/lib'
import { eden } from '../../state'

/**
 * BIOME VI — THE MEMORY TREES
 * The oldest living things on Earth. Each one keeps the memory of a
 * species that no longer exists — and near them, the air remembers.
 */

const ANCIENTS = [
  { x: -22, z: -800, height: 62 },
  { x: 26, z: -818, height: 74 },
  { x: -30, z: -845, height: 58 },
  { x: 18, z: -862, height: 82 },
  { x: -14, z: -884, height: 66 },
  { x: 30, z: -894, height: 56 },
]

export default function MemoryTrees() {
  const trees = useMemo(() => {
    const rnd = mulberry(1959)
    return ANCIENTS.map((a, i) => ({
      ...a,
      birth: 0.8 + rnd() * 0.15,
      variant: i,
      girth: 1.5 + rnd() * 0.6,
    }))
  }, [])

  const trunkMaterial = useMemo(() => makeTrunkMaterial({ bark: '#0b0d14', vein: 1.25, glow: '#8fd8ff' }), [])
  const foliageMaterial = useMemo(() => makeFoliageMaterial({ deep: '#0a1626', light: '#1e3f5c', glow: '#a8e4ff' }), [])

  // the memories themselves — slow rings of luminous dust around each tree
  const memories = useMemo(() => {
    const rnd = mulberry(777333)
    const perTree = [140, 260, 420][eden.tier]
    const count = ANCIENTS.length * perTree
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const center = new Float32Array(count * 3)
    let k = 0
    ANCIENTS.forEach((a) => {
      for (let i = 0; i < perTree; i++) {
        const ang = rnd() * Math.PI * 2
        const r = 6 + rnd() * 14
        const y = 6 + rnd() * (a.height * 0.7)
        pos[k * 3] = a.x + Math.cos(ang) * r
        pos[k * 3 + 1] = y
        pos[k * 3 + 2] = a.z + Math.sin(ang) * r
        center[k * 3] = a.x
        center[k * 3 + 1] = y
        center[k * 3 + 2] = a.z
        seed[k] = rnd()
        k++
      }
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geo.setAttribute('aCenter', new THREE.BufferAttribute(center, 3))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: withWorld({ uMemory: { value: new THREE.Color('#9fdcff') } }),
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute vec3 aCenter;
        varying float vA, vSeed;
        uniform float uTime, uGenesis, uPresenceStrength;
        uniform vec3 uPresence;
        ${NOISE}
        void main(){
          // each mote orbits its tree — memory circling what remembers it
          vec3 rel = position - aCenter;
          float ang = uTime * (0.04 + aSeed * 0.05) * (aSeed > 0.5 ? 1.0 : -1.0);
          float ca = cos(ang), sa = sin(ang);
          vec3 p = aCenter + vec3(rel.x * ca - rel.z * sa, rel.y, rel.x * sa + rel.z * ca);
          p.y += sin(uTime * 0.4 + aSeed * 40.0) * 0.8;
          p.x += snoise(vec3(aSeed * 30.0, uTime * 0.12, p.z * 0.05)) * 0.7;

          // when the presence comes close, the memory wakes
          float near = smoothstep(26.0, 6.0, distance(uPresence, aCenter));

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          gl_PointSize = (0.6 + aSeed * 1.6) * (1.0 + near * 1.2) * (230.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
          float flicker = 0.5 + 0.5 * sin(uTime * (0.5 + aSeed * 2.0) + aSeed * 50.0);
          vA = (0.12 + near * 0.75) * flicker * smoothstep(120.0, 40.0, dist) * smoothstep(0.85, 1.0, uGenesis);
          vSeed = aSeed;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA, vSeed;
        uniform vec3 uMemory;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float core = exp(-dot(c, c) * 20.0);
          vec3 col = mix(uMemory, vec3(1.0), vSeed * 0.4);
          gl_FragColor = vec4(col, core * vA);
        }
      `,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    return pts
  }, [])

  return (
    <group>
      <Grove
        trees={trees}
        variantSeeds={[101, 137, 173]}
        trunkMaterial={trunkMaterial}
        foliageMaterial={foliageMaterial}
        branchCount={7}
      />
      <primitive object={memories} />
    </group>
  )
}
