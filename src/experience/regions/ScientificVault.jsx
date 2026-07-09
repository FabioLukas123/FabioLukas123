import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Region, Inscription } from './Region.jsx'

/*
 * REGION III — THE SCIENTIFIC VAULT
 * A galaxy hangs from the ceiling. A strand of DNA turns like a
 * chandelier. The laws of the universe are inscribed in the air
 * between them, at the scale they deserve.
 */

const GALAXY_COUNT = 6500

const galaxyVert = /* glsl */ `
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
varying vec3 vColor;
varying float vSeed;
void main() {
  vColor = aColor;
  vSeed = aSeed;
  vec3 p = position;
  float a = uTime * 0.04 * (1.2 - length(p.xz) * 0.035);
  float c = cos(a), s = sin(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.4 + aSeed * 3.2) * (170.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const galaxyFrag = /* glsl */ `
varying vec3 vColor;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vColor, a * (0.35 + vSeed * 0.5));
}
`

function useGalaxy() {
  return useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(GALAXY_COUNT * 3)
    const col = new Float32Array(GALAXY_COUNT * 3)
    const seed = new Float32Array(GALAXY_COUNT)
    const inner = new THREE.Color('#bff4ff')
    const mid = new THREE.Color('#4fd8e8')
    const outer = new THREE.Color('#2a3f9f')
    const c = new THREE.Color()
    for (let i = 0; i < GALAXY_COUNT; i++) {
      const r = Math.pow(Math.random(), 1.6) * 17
      const branch = ((i % 3) / 3) * Math.PI * 2
      const spin = r * 0.32
      const rand = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.35 + r * 0.09)
      pos[i * 3] = Math.cos(branch + spin) * r + rand()
      pos[i * 3 + 1] = rand() * 0.55
      pos[i * 3 + 2] = Math.sin(branch + spin) * r + rand()
      const t = r / 17
      c.copy(inner).lerp(mid, Math.min(t * 2.2, 1))
      if (t > 0.45) c.lerp(outer, (t - 0.45) / 0.55)
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
      seed[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return geo
  }, [])
}

function DNA() {
  const group = useRef()
  const matrices = useMemo(() => {
    const list = []
    const o = new THREE.Object3D()
    for (let i = 0; i < 70; i++) {
      const t = i / 70
      const a = t * Math.PI * 7
      const y = (t - 0.5) * 26
      for (const phase of [0, Math.PI]) {
        o.position.set(Math.cos(a + phase) * 2.4, y, Math.sin(a + phase) * 2.4)
        o.scale.setScalar(0.26)
        o.updateMatrix()
        list.push(o.matrix.clone())
      }
      if (i % 3 === 0) {
        o.position.set(0, y, 0)
        o.rotation.set(0, -a, Math.PI / 2)
        o.scale.set(0.09, 4.4, 0.09)
        o.updateMatrix()
        list.push(o.matrix.clone())
        o.rotation.set(0, 0, 0)
      }
    }
    return list
  }, [])

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.16
  })

  return (
    <group ref={group} position={[13, 2, -30]}>
      <instancedMesh args={[undefined, undefined, matrices.length]} ref={(mesh) => {
        if (mesh && !mesh.userData.set) {
          matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
          mesh.instanceMatrix.needsUpdate = true
          mesh.userData.set = true
        }
      }}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial color="#1e93a8" fog={false} transparent opacity={0.6} />
      </instancedMesh>
    </group>
  )
}

function Atom() {
  const rings = useRef()
  const e1 = useRef(); const e2 = useRef(); const e3 = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (rings.current) {
      rings.current.rotation.x = t * 0.2
      rings.current.rotation.y = t * 0.13
    }
    const orbit = (ref, speed, phase, tilt) => {
      if (!ref.current) return
      const a = t * speed + phase
      ref.current.position.set(Math.cos(a) * 3.4, Math.sin(a) * 3.4 * tilt, Math.sin(a) * 1.4)
    }
    orbit(e1, 2.1, 0, 0.4); orbit(e2, 1.6, 2.1, -0.7); orbit(e3, 2.6, 4.2, 1)
  })
  return (
    <group position={[-14, -6, -46]}>
      <mesh>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshBasicMaterial color="#dffaff" fog={false} />
      </mesh>
      <group ref={rings}>
        {[0, 1.05, 2.1].map((r, i) => (
          <mesh key={i} rotation={[r, r * 0.7, 0]}>
            <torusGeometry args={[3.4, 0.02, 8, 60]} />
            <meshBasicMaterial color="#6fe8f8" transparent opacity={0.5} fog={false} />
          </mesh>
        ))}
      </group>
      {[e1, e2, e3].map((r, i) => (
        <mesh key={i} ref={r}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshBasicMaterial color="#ffffff" fog={false} />
        </mesh>
      ))}
    </group>
  )
}

const LAWS = [
  ['E = mc²', [-10, 9, -12], 1.7],
  ['a² + b² = c²', [9, -4, -20], 1.0],
  ['S = k · log W', [-6, -8, -38], 1.1],
  ['F = m · a', [12, 10, -52], 1.3],
  ['c = 299 792 458 m/s', [-3, 14, -62], 0.8],
]

export default function ScientificVault({ position }) {
  const galaxy = useGalaxy()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((_, d) => { uniforms.uTime.value += d })

  return (
    <Region index={3} position={position}>
      <points geometry={galaxy} position={[0, 24, -50]} rotation={[1.05, 0, 0.2]} frustumCulled={false}>
        <shaderMaterial
          vertexShader={galaxyVert}
          fragmentShader={galaxyFrag}
          uniforms={uniforms}
          transparent depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <DNA />
      <Atom />
      {LAWS.map(([law, pos, size]) => (
        <Inscription key={law} position={pos} size={size} serif color="#a8ecf8" sway={0.5} opacity={0.9}>
          {law}
        </Inscription>
      ))}
      <Inscription position={[0, -12, -30]} size={0.62} serif color="#5a9aa8" opacity={0.75}>
        the universe, catalogued from quark to filament
      </Inscription>
    </Region>
  )
}
