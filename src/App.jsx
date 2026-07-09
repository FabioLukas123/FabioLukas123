import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Experience from './experience/Experience.jsx'
import Threshold from './ui/Threshold.jsx'
import Overlay from './ui/Overlay.jsx'
import Cursor from './ui/Cursor.jsx'

export default function App() {
  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{ fov: 55, near: 0.1, far: 1500, position: [0, 0, 64] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.1
        }}
      >
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>
      <Overlay />
      <Threshold />
      <Cursor />
    </>
  )
}
