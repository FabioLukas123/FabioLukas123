import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Region, Inscription } from './Region.jsx'

/*
 * REGION IV — THE ARCHIVE OF STORIES
 * Books do not sit on shelves here. They burn as stars, and the
 * lines between them are the influence of one story upon another.
 * Myth touches novel. Epic touches lullaby.
 */

const STARS = 130

const starVert = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vSeed;
varying float vPulse;
void main() {
  vSeed = aSeed;
  vPulse = 0.6 + 0.4 * sin(uTime * (0.8 + aSeed * 1.6) + aSeed * 50.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (2.5 + aSeed * 6.0) * (170.0 / -mv.z) * (0.7 + 0.3 * vPulse);
  gl_Position = projectionMatrix * mv;
}
`

const starFrag = /* glsl */ `
varying float vSeed;
varying float vPulse;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.18, 0.0, d);
  float halo = smoothstep(0.5, 0.0, d) * 0.35;
  vec3 gold = vec3(1.0, 0.85, 0.55);
  vec3 violet = vec3(0.72, 0.58, 1.0);
  vec3 col = mix(violet, gold, step(0.62, vSeed));
  gl_FragColor = vec4(col, (core + halo) * vPulse);
}
`

const TITLES = [
  ['GILGAMESH', [-11, 7, -10], 0.85],
  ['THE ODYSSEY', [9, 3, -22], 0.95],
  ['ONE THOUSAND AND ONE NIGHTS', [-7, -4, -34], 0.7],
  ['THE DIVINE COMEDY', [10, 9, -46], 0.8],
  ['DON QUIXOTE', [-10, 12, -58], 0.9],
  ['THINGS FALL APART', [5, -7, -66], 0.7],
]

export default function ArchiveOfStories({ position }) {
  const group = useRef()

  const { starGeo, lineGeo } = useMemo(() => {
    const pts = []
    for (let i = 0; i < STARS; i++) {
      pts.push(new THREE.Vector3(
        (Math.random() - 0.5) * 44,
        (Math.random() - 0.5) * 30,
        -Math.random() * 78,
      ))
    }
    const starGeo = new THREE.BufferGeometry().setFromPoints(pts)
    const seed = new Float32Array(STARS)
    for (let i = 0; i < STARS; i++) seed[i] = Math.random()
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))

    // each story reaches for its two nearest kin
    const linePts = []
    for (let i = 0; i < STARS; i++) {
      const dists = pts.map((p, j) => [pts[i].distanceTo(p), j])
        .sort((a, b) => a[0] - b[0])
      for (let k = 1; k <= 2; k++) {
        if (dists[k] && dists[k][0] < 16) {
          linePts.push(pts[i].clone(), pts[dists[k][1]].clone())
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts)
    return { starGeo, lineGeo }
  }, [])

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }, d) => {
    uniforms.uTime.value += d
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * 0.05) * 0.06
  })

  return (
    <Region index={4} position={position}>
      <group ref={group}>
        <points geometry={starGeo} frustumCulled={false}>
          <shaderMaterial
            vertexShader={starVert}
            fragmentShader={starFrag}
            uniforms={uniforms}
            transparent depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        <lineSegments geometry={lineGeo} frustumCulled={false}>
          <lineBasicMaterial
            color="#8a68d8" transparent opacity={0.22} fog={false}
            blending={THREE.AdditiveBlending} depthWrite={false}
          />
        </lineSegments>
      </group>
      {TITLES.map(([t, pos, size]) => (
        <Inscription key={t} position={pos} size={size} sway={0.6} color="#e0d2ff" letterSpacing={0.22} opacity={0.8}>
          {t}
        </Inscription>
      ))}
      <Inscription position={[0, -12, -36]} size={0.66} serif color="#9a86c8" opacity={0.8}>
        every story that was ever told, telling itself again
      </Inscription>
    </Region>
  )
}
