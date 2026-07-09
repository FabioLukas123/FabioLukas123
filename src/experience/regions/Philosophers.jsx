import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { Region, Inscription } from './Region.jsx'

/*
 * REGION II — THE PHILOSOPHERS
 * A cathedral with no ceiling. Columns recede past counting,
 * shafts of light fall from nowhere, and the names float free
 * of their bodies, still arguing.
 */

const NAMES = [
  ['PLATO', [-5, 6, -6], 1.5],
  ['ARISTOTLE', [6, 2, -16], 1.3],
  ['MARCUS AURELIUS', [-5, -3, -26], 1.1],
  ['KANT', [6, 8, -38], 1.6],
  ['NIETZSCHE', [-6, 1, -48], 1.7],
  ['DOSTOEVSKY', [5, -5, -58], 1.4],
  ['CONFUCIUS', [-3, 11, -70], 1.2],
  ['HYPATIA', [3, 4, -80], 1.2],
]

export default function Philosophers({ position }) {
  const swirl = useRef()

  const columns = useMemo(() => {
    const m = new THREE.Object3D()
    const mats = []
    for (let i = 0; i < 30; i++) {
      const side = i % 2 === 0 ? 1 : -1
      m.position.set(side * (13 + (i % 4)), 2, 6 - Math.floor(i / 2) * 9)
      m.scale.set(1, 1 + (i % 3) * 0.25, 1)
      m.updateMatrix()
      mats.push(m.matrix.clone())
    }
    return mats
  }, [])

  useFrame(({ clock }) => {
    if (swirl.current) swirl.current.rotation.y = clock.elapsedTime * 0.02
  })

  return (
    <Region index={2} position={position}>
      <instancedMesh args={[undefined, undefined, columns.length]} ref={(mesh) => {
        if (mesh && !mesh.userData.set) {
          columns.forEach((mat, i) => mesh.setMatrixAt(i, mat))
          mesh.instanceMatrix.needsUpdate = true
          mesh.userData.set = true
        }
      }}>
        <cylinderGeometry args={[0.9, 1.15, 44, 10]} />
        <meshStandardMaterial color="#39415c" roughness={0.85} metalness={0.1} />
      </instancedMesh>

      {/* light from nowhere */}
      <pointLight position={[0, 26, -20]} color="#8fb0ff" intensity={160} distance={130} decay={1.6} />
      <pointLight position={[-6, 8, -60]} color="#6a86d8" intensity={60} distance={90} decay={1.6} />

      {/* volumetric shafts */}
      {[[-6, -12], [3, -30], [-2, -50], [8, -68]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx, 12, sz]} rotation={[0, 0, 0.12 * (i % 2 ? 1 : -1)]}>
          <coneGeometry args={[4.5, 44, 20, 1, true]} />
          <meshBasicMaterial
            color="#b8ccff" transparent opacity={0.016} fog={false}
            blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      <group ref={swirl}>
        {NAMES.map(([name, pos, size]) => (
          <Inscription key={name} position={pos} size={size} sway={0.8} color="#d4e2ff">
            {name}
          </Inscription>
        ))}
      </group>

      <Inscription position={[0, -8, -34]} size={0.8} serif color="#8fa8d8" opacity={0.85}>
        the unexamined life is not worth living
      </Inscription>
      <Inscription position={[2, 14, -64]} size={0.7} serif color="#7d95c8" opacity={0.7}>
        he who has a why to live can bear almost any how
      </Inscription>

      <Sparkles count={70} color="#9db4e8" size={3.5} scale={[34, 30, 90]} position={[0, 6, -36]} speed={0.25} opacity={0.6} />
    </Region>
  )
}
