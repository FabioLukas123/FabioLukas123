import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { state, REGIONS, regionBlend } from '../journey.js'

/*
 * The dust of the Library — motes, distant sparks of thought.
 * A shell of points that follows the camera; tint follows the region.
 */

const COUNT = 2400

const vertexShader = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vTwinkle;
varying float vSeed;
void main() {
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = sin(uTime * (0.6 + aSeed * 2.2) + aSeed * 40.0);
  vTwinkle = 0.5 + 0.5 * tw;
  gl_PointSize = (1.5 + aSeed * 3.4) * (140.0 / -mv.z) * (0.6 + 0.4 * vTwinkle);
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uTint;
varying float vTwinkle;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a * (0.25 + 0.75 * vTwinkle);
  vec3 col = mix(uTint, vec3(1.0), vSeed * 0.5);
  gl_FragColor = vec4(col, a * 0.55);
}
`

const tintA = new THREE.Color()
const tintB = new THREE.Color()

export default function Cosmos() {
  const ref = useRef()
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      const r = 40 + Math.pow(Math.random(), 0.5) * 260
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
      seed[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return geo
  }, [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uTint: { value: new THREE.Color('#8fa3c8') },
  }), [])

  useFrame(({ camera }, delta) => {
    uniforms.uTime.value += delta
    ref.current.position.copy(camera.position)
    ref.current.rotation.y += delta * 0.004
    // tint follows the journey
    const { i, t } = regionBlend(THREE.MathUtils.clamp(state.offset, 0, 1))
    tintA.set(REGIONS[i].tint)
    tintB.set(REGIONS[i + 1].tint)
    uniforms.uTint.value.copy(tintA).lerp(tintB, t)
  })

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
