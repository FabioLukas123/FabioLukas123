import { useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { eden, world } from '../state'
import CameraRig from './CameraRig'
import Atmosphere from './Atmosphere'
import Terrain from './Terrain'
import Presence from './Presence'
import Spores from './Spores'
import Seed from './Seed'
import LuminousForest from './biomes/LuminousForest'
import FloatingGardens from './biomes/FloatingGardens'
import CrystalRiver from './biomes/CrystalRiver'
import Giants from './biomes/Giants'
import TheBloom from './biomes/TheBloom'
import MemoryTrees from './biomes/MemoryTrees'
import Horizon from './biomes/Horizon'

/** One heartbeat for the entire organism. */
const Pulse = () => {
  useFrame((_, delta) => {
    world.uTime.value += Math.min(delta, 0.05)
  })
  return null
}

export default function Experience() {
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio, eden.tier === 2 ? 1.75 : 1.25))

  return (
    <Canvas
      dpr={dpr}
      camera={{ fov: 54, near: 0.1, far: 1700, position: [0, 6.4, 16] }}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
      }}
    >
      <color attach="background" args={['#020308']} />
      <PerformanceMonitor
        // adaptive rendering: resolution yields before beauty does
        onIncline={() => setDpr((d) => Math.min(window.devicePixelRatio, 2, d + 0.25))}
        onDecline={() => setDpr((d) => Math.max(0.8, d - 0.25))}
      >
        <Pulse />
        <CameraRig />
        <Atmosphere />
        <Terrain />
        <Seed />
        <Presence />
        <Spores />
        <LuminousForest />
        <FloatingGardens />
        <CrystalRiver />
        <Giants />
        <TheBloom />
        <MemoryTrees />
        <Horizon />
      </PerformanceMonitor>
      {eden.tier > 0 && (
        <EffectComposer multisampling={eden.tier === 2 ? 4 : 0}>
          <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.24} luminanceSmoothing={0.3} radius={0.8} />
          <Vignette offset={0.24} darkness={0.46} />
          <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.06} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
