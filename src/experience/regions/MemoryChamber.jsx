import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { state } from '../../journey.js'
import { Region, Inscription } from './Region.jsx'

/*
 * REGION V — THE MEMORY CHAMBER
 * Not books. Moments. Each sphere of amber light holds one human
 * instant, deposited here the moment it happened, kept forever.
 */

const ORBS = 150

const orbVert = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aData; // x: scale, y: seed
uniform float uTime;
uniform vec3 uCursor;
varying float vFresnel;
varying float vSeed;
void main() {
  vSeed = aData.y;
  float t = uTime;
  vec3 center = aPos + vec3(
    sin(t * 0.14 + aData.y * 6.28) * 2.2,
    sin(t * 0.10 + aData.y * 12.5) * 1.8,
    sin(t * 0.08 + aData.y * 20.0) * 2.2
  );
  // memories lean toward whoever comes close
  vec3 toC = uCursor - center;
  float dc = length(toC);
  center += (toC / max(dc, 0.001)) * smoothstep(14.0, 0.0, dc) * 1.8;

  vec3 world = center + position * aData.x * (0.9 + 0.1 * sin(t * 0.7 + aData.y * 40.0));
  vec3 n = normalize(position);
  vec3 viewDir = normalize((inverse(viewMatrix) * vec4(0.0, 0.0, 0.0, 1.0)).xyz - world);
  vFresnel = pow(1.0 - abs(dot(n, viewDir)), 1.8);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`

const orbFrag = /* glsl */ `
varying float vFresnel;
varying float vSeed;
void main() {
  vec3 amber = vec3(1.0, 0.72, 0.38);
  vec3 pale = vec3(1.0, 0.9, 0.7);
  vec3 col = mix(amber, pale, vSeed * 0.6);
  float a = 0.06 + vFresnel * 0.85;
  gl_FragColor = vec4(col * (0.5 + vSeed * 0.6), a);
}
`

const MOMENTS = [
  ['a first step', [-9, 5, -12], 0.62],
  ['a last goodbye', [8, -3, -22], 0.66],
  ['a hand held in silence', [-6, -7, -34], 0.58],
  ['a victory no one saw', [10, 7, -44], 0.6],
  ['a lullaby, half-remembered', [-9, 10, -56], 0.58],
  ['the smell of rain on a childhood street', [4, -9, -64], 0.52],
]

export default function MemoryChamber({ position }) {
  const geometry = useMemo(() => {
    const base = new THREE.SphereGeometry(1, 18, 14)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.normal = base.attributes.normal
    geo.attributes.uv = base.attributes.uv
    const pos = new Float32Array(ORBS * 3)
    const data = new Float32Array(ORBS * 2)
    for (let i = 0; i < ORBS; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 46
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30
      pos[i * 3 + 2] = -Math.random() * 76
      data[i * 2] = 0.28 + Math.pow(Math.random(), 2) * 1.1
      data[i * 2 + 1] = Math.random()
    }
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 2))
    geo.instanceCount = ORBS
    return geo
  }, [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCursor: { value: new THREE.Vector3(0, 0, 9999) },
  }), [])

  useFrame((_, d) => {
    uniforms.uTime.value += d
    // cursor position transformed into region-local space
    uniforms.uCursor.value.copy(state.cursorWorld)
    uniforms.uCursor.value.x -= position.x
    uniforms.uCursor.value.y -= position.y
    uniforms.uCursor.value.z -= position.z
  })

  return (
    <Region index={5} position={position}>
      <mesh geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          vertexShader={orbVert}
          fragmentShader={orbFrag}
          uniforms={uniforms}
          transparent depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight position={[0, 4, -30]} color="#ffb866" intensity={40} distance={90} decay={1.8} />
      {MOMENTS.map(([m, pos, size]) => (
        <Inscription key={m} position={pos} size={size} serif color="#ffd9a8" sway={0.7} opacity={0.85}>
          {m}
        </Inscription>
      ))}
      <Inscription position={[0, 13, -40]} size={0.9} color="#e8c48f" letterSpacing={0.3} opacity={0.6}>
        EVERYTHING IS PRESERVED
      </Inscription>
    </Region>
  )
}
