import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { state, CURVE, REGIONS, STATIONS, regionAt, regionBlend } from '../journey.js'
import { audio } from '../audio/AudioEngine.js'
import PageStorm from './PageStorm.jsx'
import LibraryLattice from './LibraryLattice.jsx'
import Cosmos from './Cosmos.jsx'
import TheBook from './TheBook.jsx'
import Origins from './regions/Origins.jsx'
import Philosophers from './regions/Philosophers.jsx'
import ScientificVault from './regions/ScientificVault.jsx'
import ArchiveOfStories from './regions/ArchiveOfStories.jsx'
import MemoryChamber from './regions/MemoryChamber.jsx'
import ForbiddenWing from './regions/ForbiddenWing.jsx'
import FutureShelves from './regions/FutureShelves.jsx'
import Finale from './regions/Finale.jsx'

const posV = new THREE.Vector3()
const lookV = new THREE.Vector3()
const projV = new THREE.Vector3()
const fogA = new THREE.Color()
const fogB = new THREE.Color()
const smoothedMouse = new THREE.Vector2()

function JourneyRig() {
  const scroll = useScroll()
  const { scene, camera } = useThree()
  const fovRef = useRef(55)

  useFrame((_, delta) => {
    const offset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    state.velocity = THREE.MathUtils.lerp(
      state.velocity, (offset - state.offset) / Math.max(delta, 0.001), 0.1)
    state.offset = offset
    state.scrollEl = scroll.el
    state.regionIndex = regionAt(offset)

    // travel the spline; aim along the tangent so the very end of the
    // curve still has a well-defined gaze
    CURVE.getPointAt(Math.min(offset, 0.9999), posV)
    CURVE.getTangentAt(Math.min(offset, 0.9999), lookV)
    camera.position.copy(posV)
    lookV.multiplyScalar(10).add(posV)
    camera.lookAt(lookV)

    // mouse parallax + a breath of roll
    smoothedMouse.lerp(state.mouse, 0.045)
    camera.translateX(smoothedMouse.x * 1.6)
    camera.translateY(smoothedMouse.y * 0.9)
    camera.rotateZ(Math.sin(performance.now() * 0.0001) * 0.012 + smoothedMouse.x * -0.008)
    camera.rotateY(smoothedMouse.x * -0.03)
    camera.rotateX(smoothedMouse.y * 0.02)

    // speed widens the eye
    const targetFov = 55 + Math.min(Math.abs(state.velocity) * 260, 14)
    fovRef.current = THREE.MathUtils.lerp(fovRef.current, targetFov, 0.06)
    if (Math.abs(camera.fov - fovRef.current) > 0.01) {
      camera.fov = fovRef.current
      camera.updateProjectionMatrix()
    }

    // the cursor as a point in the world, 14 units ahead
    projV.set(state.mouse.x, state.mouse.y, 0.5).unproject(camera)
    projV.sub(camera.position).normalize()
    state.cursorWorld.copy(camera.position).addScaledVector(projV, 14)

    // atmosphere follows the region
    const { i, t } = regionBlend(offset)
    fogA.set(REGIONS[i].fog)
    fogB.set(REGIONS[i + 1].fog)
    fogA.lerp(fogB, t)
    if (scene.fog) scene.fog.color.copy(fogA)
    if (scene.background && scene.background.isColor) scene.background.copy(fogA)

    audio.update(offset)
    if (Math.abs(state.velocity) > 0.02 && Math.random() < 0.06) {
      audio.pageTurn(0.05)
    }
  })

  return null
}

function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.72}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[0.0005, 0.0009]}
        radialModulation
        modulationOffset={0.35}
      />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.55} />
      <Vignette eskil={false} offset={0.26} darkness={0.82} />
    </EffectComposer>
  )
}

export default function Experience() {
  const { gl } = useThree()

  return (
    <>
      <color attach="background" args={['#020204']} />
      <fogExp2 attach="fog" args={['#020204', 0.0135]} />
      <ambientLight intensity={0.18} color="#5a6a9a" />

      <PerformanceMonitor
        onChange={({ factor }) => {
          state.quality = 0.4 + 0.6 * factor
          gl.setPixelRatio(Math.min(
            window.devicePixelRatio, 0.9 + factor * 1.1))
        }}
      >
        <ScrollControls pages={20} damping={0.32}>
          <JourneyRig />
          <Cosmos />
          <PageStorm />
          <LibraryLattice />
          <TheBook />
          <Origins position={STATIONS[1]} />
          <Philosophers position={STATIONS[2]} />
          <ScientificVault position={STATIONS[3]} />
          <ArchiveOfStories position={STATIONS[4]} />
          <MemoryChamber position={STATIONS[5]} />
          <ForbiddenWing position={STATIONS[6]} />
          <FutureShelves position={STATIONS[7]} />
          <Finale position={STATIONS[8]} />
        </ScrollControls>
      </PerformanceMonitor>

      <Effects />
    </>
  )
}
