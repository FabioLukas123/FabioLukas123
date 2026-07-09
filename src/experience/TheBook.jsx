import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { state, smooth } from '../journey.js'
import { BOOK_POS } from './PageStorm.jsx'

/*
 * The single distant light. A book, open, waiting.
 * It is the seed of everything; the storm consumes it.
 */

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,244,214,1)')
  g.addColorStop(0.25, 'rgba(255,224,168,0.55)')
  g.addColorStop(0.6, 'rgba(180,140,90,0.12)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  return tex
}

export default function TheBook() {
  const group = useRef()
  const glowRef = useRef()
  const lightRef = useRef()
  const tex = useMemo(glowTexture, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const off = state.offset
    const gone = smooth(0.015, 0.06, off)
    const pulse = 1 + Math.sin(t * 1.6) * 0.06 + Math.sin(t * 4.2) * 0.02
    if (group.current) {
      group.current.visible = gone < 0.999
      const s = pulse * (1 - gone)
      group.current.scale.setScalar(Math.max(s, 0.0001))
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (1 - gone) * (0.85 + Math.sin(t * 2.2) * 0.12)
    }
    if (lightRef.current) {
      lightRef.current.intensity = (1 - gone * 0.4) * (46 + Math.sin(t * 3.1) * 8)
    }
  })

  return (
    <group ref={group} position={BOOK_POS}>
      {/* open pages */}
      <mesh rotation={[-0.9, 0, 0.42]} position={[-0.42, 0, 0]}>
        <planeGeometry args={[0.9, 1.24]} />
        <meshBasicMaterial color="#fff3d8" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-0.9, 0, -0.42]} position={[0.42, 0, 0]}>
        <planeGeometry args={[0.9, 1.24]} />
        <meshBasicMaterial color="#ffeecb" side={THREE.DoubleSide} />
      </mesh>
      {/* spine */}
      <mesh rotation={[-0.9, 0, 0]} position={[0, -0.06, 0]}>
        <boxGeometry args={[0.1, 1.24, 0.06]} />
        <meshBasicMaterial color="#2a1a0c" />
      </mesh>
      <sprite ref={glowRef} scale={[10, 10, 1]}>
        <spriteMaterial
          map={tex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <pointLight ref={lightRef} color="#ffd9a0" intensity={46} distance={70} decay={1.6} />
    </group>
  )
}
