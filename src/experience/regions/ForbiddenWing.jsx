import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Region, Inscription } from './Region.jsx'

/*
 * REGION VI — THE FORBIDDEN WING
 * Alexandria burning, forever. Ash rises past ruined colonnades
 * toward a gate that has never been opened from this side.
 */

const EMBERS = 1100

const emberVert = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vHeat;
void main() {
  float t = uTime;
  vec3 p = position;
  // embers rise on a 26-unit loop
  float rise = mod(p.y + t * (0.8 + aSeed * 1.4), 30.0);
  p.y = rise - 14.0;
  p.x += sin(t * (0.4 + aSeed) + aSeed * 40.0 + rise * 0.22) * 1.6;
  p.z += cos(t * 0.5 + aSeed * 60.0 + rise * 0.18) * 1.4;
  vHeat = (1.0 - rise / 30.0) * (0.5 + 0.5 * sin(t * (3.0 + aSeed * 6.0) + aSeed * 90.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.2 + aSeed * 2.6) * (150.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const emberFrag = /* glsl */ `
varying float vHeat;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  vec3 hot = vec3(1.0, 0.62, 0.22);
  vec3 cool = vec3(0.5, 0.10, 0.05);
  gl_FragColor = vec4(mix(cool, hot, vHeat), a * (0.15 + vHeat * 0.8));
}
`

export default function ForbiddenWing({ position }) {
  const gateGlow = useRef()
  const fireLight = useRef()

  const emberGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(EMBERS * 3)
    const seed = new Float32Array(EMBERS)
    for (let i = 0; i < EMBERS; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50
      pos[i * 3 + 1] = Math.random() * 30
      pos[i * 3 + 2] = -Math.random() * 70
      seed[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return geo
  }, [])

  const ruins = useMemo(() => {
    const mats = []
    const o = new THREE.Object3D()
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const fallen = Math.random() < 0.3
      o.position.set(side * (10 + Math.random() * 8), fallen ? -10 : -2 + Math.random() * 3, 4 - i * 3.4)
      o.rotation.set(fallen ? Math.PI / 2.2 : (Math.random() - 0.5) * 0.16, Math.random() * 0.4, fallen ? 0.4 : (Math.random() - 0.5) * 0.1)
      o.scale.set(1.2, fallen ? 0.8 : 0.6 + Math.random() * 0.7, 1.2)
      o.updateMatrix()
      mats.push(o.matrix.clone())
      o.rotation.set(0, 0, 0)
    }
    return mats
  }, [])

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }, d) => {
    uniforms.uTime.value += d
    const t = clock.elapsedTime
    if (gateGlow.current) gateGlow.current.material.opacity = 0.12 + Math.sin(t * 1.1) * 0.04 + Math.sin(t * 5.7) * 0.02
    if (fireLight.current) fireLight.current.intensity = 34 + Math.sin(t * 9.2) * 8 + Math.sin(t * 4.1) * 6
  })

  return (
    <Region index={6} position={position}>
      <points geometry={emberGeo} position={[0, 0, -20]} frustumCulled={false}>
        <shaderMaterial
          vertexShader={emberVert}
          fragmentShader={emberFrag}
          uniforms={uniforms}
          transparent depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* ruined colonnade */}
      <instancedMesh args={[undefined, undefined, ruins.length]} ref={(mesh) => {
        if (mesh && !mesh.userData.set) {
          ruins.forEach((m, i) => mesh.setMatrixAt(i, m))
          mesh.instanceMatrix.needsUpdate = true
          mesh.userData.set = true
        }
      }}>
        <cylinderGeometry args={[1, 1.2, 26, 8]} />
        <meshStandardMaterial color="#16090a" roughness={1} />
      </instancedMesh>

      {/* the sealed gate */}
      <group position={[0, -1, -58]}>
        <mesh ref={gateGlow} position={[0, 2, -3]}>
          <planeGeometry args={[16, 26]} />
          <meshBasicMaterial
            color="#ff2a10" transparent opacity={0.14} fog={false}
            blending={THREE.AdditiveBlending} depthWrite={false}
          />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[(i - 4) * 1.7, 2, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 26, 8]} />
            <meshStandardMaterial color="#0a0505" roughness={0.6} metalness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 15.4, 0]}>
          <boxGeometry args={[16.4, 1.6, 1.6]} />
          <meshStandardMaterial color="#0a0505" roughness={0.7} metalness={0.6} />
        </mesh>
      </group>

      <pointLight ref={fireLight} position={[0, -6, -30]} color="#ff4a1a" distance={90} decay={1.7} />
      <pointLight position={[0, 2, -62]} color="#ff2010" intensity={50} distance={50} decay={1.6} />

      <Inscription position={[0, -9, -26]} size={0.72} serif color="#c46a5a" opacity={0.85}>
        here lie the libraries we burned
      </Inscription>
      <Inscription position={[0, 11, -50]} size={1.1} color="#8f3a2e" letterSpacing={0.5} opacity={0.7}>
        DO NOT ASK WHAT WAS LOST
      </Inscription>
    </Region>
  )
}
