import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { Region, Inscription } from './Region.jsx'

/*
 * REGION VII — THE FUTURE SHELVES
 * The stacks are still assembling themselves. Wireframe towers
 * flicker into being; blank white books drift upward to take
 * their places on shelves that do not exist yet.
 */

const TOWERS = 46
const BOOKS = 240

const towerVert = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aScale;
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vY;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec3 world = position * aScale + aPos;
  vY = (position.y + 0.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`

const towerFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vY;
void main() {
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float wire = smoothstep(0.045, 0.0, edge);
  // a scanline of becoming sweeps upward forever
  float scan = fract(vY * 1.5 - uTime * 0.14 + vSeed);
  float band = smoothstep(0.25, 0.0, abs(scan - 0.5)) * 0.5;
  float built = step(fract(vSeed * 91.7), 0.85);
  float a = (wire * 0.75 + band * 0.25) * built;
  vec3 col = mix(vec3(0.35, 0.8, 1.0), vec3(0.9, 0.98, 1.0), wire);
  gl_FragColor = vec4(col, a * 0.55);
}
`

const bookVert = /* glsl */ `
attribute vec3 aPos;
attribute float aSeed;
uniform float uTime;
varying float vGlow;
void main() {
  vec3 p = aPos;
  float rise = mod(aSeed * 40.0 + uTime * (0.5 + aSeed), 44.0);
  p.y = rise - 20.0;
  p.x += sin(uTime * 0.3 + aSeed * 30.0) * 1.2;
  vGlow = smoothstep(0.0, 6.0, rise) * smoothstep(44.0, 34.0, rise);
  vec3 world = p + position * (0.5 + aSeed * 0.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`

const bookFrag = /* glsl */ `
varying float vGlow;
void main() {
  gl_FragColor = vec4(vec3(0.85, 0.95, 1.0), vGlow * 0.85);
}
`

export default function FutureShelves({ position }) {
  const towerGeo = useMemo(() => {
    const base = new THREE.BoxGeometry(1, 1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.normal = base.attributes.normal
    geo.attributes.uv = base.attributes.uv
    const pos = new Float32Array(TOWERS * 3)
    const scl = new Float32Array(TOWERS * 3)
    const seed = new Float32Array(TOWERS)
    for (let i = 0; i < TOWERS; i++) {
      const side = i % 2 === 0 ? 1 : -1
      pos[i * 3] = side * (9 + Math.random() * 22)
      pos[i * 3 + 1] = Math.random() * 16 - 6
      pos[i * 3 + 2] = 4 - Math.random() * 78
      scl[i * 3] = 2.5 + Math.random() * 4
      scl[i * 3 + 1] = 14 + Math.random() * 34
      scl[i * 3 + 2] = 2.5 + Math.random() * 5
      seed[i] = Math.random()
    }
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scl, 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    geo.instanceCount = TOWERS
    return geo
  }, [])

  const bookGeo = useMemo(() => {
    const base = new THREE.BoxGeometry(0.5, 0.7, 0.1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.normal = base.attributes.normal
    geo.attributes.uv = base.attributes.uv
    const pos = new Float32Array(BOOKS * 3)
    const seed = new Float32Array(BOOKS)
    for (let i = 0; i < BOOKS; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 52
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = 4 - Math.random() * 76
      seed[i] = Math.random()
    }
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    geo.instanceCount = BOOKS
    return geo
  }, [])

  const uni1 = useMemo(() => ({ uTime: { value: 0 } }), [])
  const uni2 = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((_, d) => { uni1.uTime.value += d; uni2.uTime.value += d })

  return (
    <Region index={7} position={position}>
      <mesh geometry={towerGeo} frustumCulled={false}>
        <shaderMaterial
          vertexShader={towerVert} fragmentShader={towerFrag} uniforms={uni1}
          transparent depthWrite={false} side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh geometry={bookGeo} frustumCulled={false}>
        <shaderMaterial
          vertexShader={bookVert} fragmentShader={bookFrag} uniforms={uni2}
          transparent depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Sparkles count={80} color="#bfe8ff" size={3} scale={[50, 40, 80]} position={[0, 4, -36]} speed={0.9} opacity={0.7} />
      <Inscription position={[0, 8, -30]} size={1.15} color="#dff2ff" letterSpacing={0.3} opacity={0.85}>
        RESERVED
      </Inscription>
      <Inscription position={[0, 4.6, -30]} size={0.6} serif color="#8fc8e8" opacity={0.8}>
        for the books you have not written yet
      </Inscription>
      <Inscription position={[-4, -8, -52]} size={0.6} serif color="#6aa8cc" opacity={0.7}>
        sciences without names, waiting to be practiced
      </Inscription>
    </Region>
  )
}
