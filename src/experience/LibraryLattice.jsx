import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { state, smooth, STATIONS } from '../journey.js'

/*
 * The architecture of the Library: endless brutalist shelf-towers
 * lining the corridor, every face pierced by rows of lit books.
 * One instanced draw call per field. The far field only reveals
 * itself at the end, when the camera rises above the corridor.
 */

const vertexShader = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aScale;
attribute float aSeed;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vSeed;
varying float vDepth;

void main() {
  vSeed = aSeed;
  vec3 world = position * aScale + aPos;
  vWorld = world;
  vNormal = normal;
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying float vSeed;
varying float vDepth;
uniform vec3 uFogColor;
uniform vec3 uWarm;
uniform float uTime;
uniform float uReveal;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  // dark stone
  vec3 col = vec3(0.030, 0.032, 0.042);

  // rows of lit books on the faces that look into the corridor
  float facing = abs(vNormal.x) + abs(vNormal.z) * 0.6;
  vec2 cell = vec2(
    (abs(vNormal.x) > 0.5 ? vWorld.z : vWorld.x) * 1.35,
    vWorld.y * 0.62
  );
  vec2 id = floor(cell);
  vec2 f = fract(cell);
  float on = hash(id + vSeed * 17.0);
  float slit = step(0.18, f.x) * step(f.x, 0.82) * step(0.30, f.y) * step(f.y, 0.62);
  float lit = step(0.42, on) * slit * facing;
  float flicker = 0.72 + 0.28 * sin(uTime * (1.5 + on * 3.0) + on * 40.0);
  vec3 warm = mix(uWarm, vec3(0.45, 0.62, 0.95), step(0.93, on));
  col += warm * lit * flicker * (0.55 + on * 0.8);

  // the far field materializes cell by cell as the camera rises
  if (uReveal < 0.995 && hash(id * 3.1 + vSeed) > uReveal) discard;

  float fog = 1.0 - exp(-vDepth * vDepth * 0.000048);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}
`

// each region keeps a clearing around its station — a hall inside the stacks
function nearStation(z) {
  for (let s = 1; s < STATIONS.length; s++) {
    if (Math.abs(z - STATIONS[s].z) < 36) return true
  }
  return false
}

function buildField({ count, span, spread, far }) {
  const pos = new Float32Array(count * 3)
  const scl = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1
    let x, z
    if (far) {
      x = (Math.random() - 0.5) * spread * 2
      z = -300 - Math.random() * 1500
      if (Math.abs(x) < 60 && z > -1100) x = Math.sign(x || 1) * (60 + Math.random() * spread)
    } else {
      x = side * (22 + Math.random() * spread)
      z = 70 - (i / count) * span - Math.random() * 14
      if (nearStation(z)) x = side * (46 + Math.random() * spread)
    }
    const h = far ? 40 + Math.random() * 160 : 24 + Math.random() * 70
    pos[i * 3] = x
    pos[i * 3 + 1] = h / 2 - 26 - Math.random() * 16
    pos[i * 3 + 2] = z
    scl[i * 3] = 4 + Math.random() * 8
    scl[i * 3 + 1] = h
    scl[i * 3 + 2] = 6 + Math.random() * 10
    seed[i] = Math.random()
  }
  return { pos, scl, seed }
}

function Field({ params, warm, farField = false }) {
  const { scene } = useThree()
  const geometry = useMemo(() => {
    const base = new THREE.BoxGeometry(1, 1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.normal = base.attributes.normal
    geo.attributes.uv = base.attributes.uv
    const { pos, scl, seed } = buildField(params)
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scl, 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    geo.instanceCount = params.count
    return geo
  }, [])

  const uniforms = useMemo(() => ({
    uFogColor: { value: new THREE.Color('#020204') },
    uWarm: { value: new THREE.Color(warm) },
    uTime: { value: 0 },
    uReveal: { value: farField ? 0 : 1 },
  }), [])

  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    if (scene.fog) uniforms.uFogColor.value.copy(scene.fog.color)
    if (farField) uniforms.uReveal.value = smooth(0.80, 0.97, state.offset)
    geometry.instanceCount = Math.floor(params.count * Math.max(0.4, state.quality))
  })

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}

export default function LibraryLattice() {
  return (
    <>
      {/* the corridor walls */}
      <Field params={{ count: 320, span: 1180, spread: 34, far: false }} warm="#c88a3a" />
      {/* the endless city of knowledge, seen from above at the end */}
      <Field params={{ count: 420, span: 0, spread: 700, far: true }} warm="#b87f3a" farField />
    </>
  )
}
