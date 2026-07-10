import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { eden, world, announceBiome } from '../state'
import { path, biomeAt } from '../journey/journey'

const WHEEL = 0.000145
const TOUCH = 0.00052
const DRIFT = 0.000042 // the world's own slow current, when the visitor rests

export default function CameraRig() {
  const { camera, gl } = useThree()
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      ahead: new THREE.Vector3(),
      look: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      tangent: new THREE.Vector3(),
      lastTangent: new THREE.Vector3(0, 0, -1),
      seedFocus: new THREE.Vector3(2, 8, -22),
      genesisEye: new THREE.Vector3(0, 6.4, 16),
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      plane: new THREE.Plane(),
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      hit: new THREE.Vector3(),
      lastPointer: new THREE.Vector2(),
    }),
    []
  )
  const idle = useRef(0)
  const roll = useRef(0)

  useEffect(() => {
    const el = gl.domElement
    const nudge = (d) => {
      if (!eden.awake || world.uGenesis.value < 0.88) return
      eden.target = THREE.MathUtils.clamp(eden.target + d, 0, 1)
      idle.current = 0
    }
    const onWheel = (e) => {
      e.preventDefault()
      nudge(e.deltaY * WHEEL)
    }
    let touchY = null
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      if (touchY == null) return
      const y = e.touches[0].clientY
      nudge((touchY - y) * TOUCH)
      touchY = y
    }
    const onKey = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') nudge(0.006)
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nudge(-0.006)
    }
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1
      eden.pointer.set(x, y)
    }
    const onTouchAsPointer = (e) => {
      const t = e.touches[0]
      if (!t) return
      eden.pointer.set((t.clientX / window.innerWidth) * 2 - 1, -(t.clientY / window.innerHeight) * 2 + 1)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchmove', onTouchAsPointer, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchmove', onTouchAsPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', onMove)
    }
  }, [gl])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = world.uTime.value
    const g = world.uGenesis.value

    // ---- the visitor's presence: a point of will in the world ----
    const moved = v.lastPointer.distanceTo(eden.pointer)
    v.lastPointer.copy(eden.pointer)
    const targetStrength = THREE.MathUtils.clamp(moved * 26, 0, 1)
    eden.presenceStrength += (Math.max(targetStrength, eden.presenceStrength * 0.985) - eden.presenceStrength) * 0.5
    eden.presenceStrength *= Math.pow(0.6, dt) // slow exhale
    world.uPresenceStrength.value = eden.presenceStrength
    // project the pointer ~13 units ahead of the camera
    v.ray.setFromCamera(eden.pointer, camera)
    camera.getWorldDirection(v.tangent)
    v.plane.setFromNormalAndCoplanarPoint(v.tangent, v.hit.copy(camera.position).addScaledVector(v.tangent, 13))
    if (v.ray.ray.intersectPlane(v.plane, v.hit)) {
      eden.presence.lerp(v.hit, 1 - Math.pow(0.002, dt))
    }

    // ---- journey ----
    idle.current += dt
    if (eden.awake && g > 0.999 && idle.current > 6 && eden.target < 1) {
      eden.target = Math.min(1, eden.target + DRIFT * dt * 60)
    }
    const prev = eden.progress
    eden.progress += (eden.target - eden.progress) * (1 - Math.pow(0.0035, dt))
    eden.velocity = (eden.progress - prev) / Math.max(dt, 1e-4)
    world.uProgress.value = eden.progress

    const p = eden.progress
    path.getPointAt(p, v.pos)
    path.getPointAt(Math.min(p + 0.012, 1), v.ahead)

    // breathing — the camera is alive too
    const breathe = Math.sin(t * 0.42) * 0.22 + Math.sin(t * 0.9 + 1.7) * 0.08
    v.pos.y += breathe * 0.35
    v.pos.x += Math.sin(t * 0.23) * 0.3

    // gentle parallax toward the visitor's gaze
    v.look.copy(v.ahead)
    v.look.x += eden.pointer.x * 3.2
    v.look.y += eden.pointer.y * 1.9 + breathe * 0.2

    // at the overlook, the gaze settles onto Eden entire
    const endGaze = THREE.MathUtils.smoothstep(p, 0.93, 0.995)
    v.look.y -= endGaze * 30
    v.look.z -= endGaze * 60

    // genesis: held in the clearing, watching the first life
    const ctrl = THREE.MathUtils.smoothstep(g, 0.86, 1)
    if (ctrl < 1) {
      const drift = Math.min(g * 1.6, 1)
      v.genesisEye.set(Math.sin(t * 0.07) * 2.2, 6.2 + Math.sin(t * 0.3) * 0.25 + drift * 1.2, 16 - drift * 2)
      v.seedFocus.set(2, 2 + g * 9, -22)
      v.pos.lerpVectors(v.genesisEye, v.pos, ctrl)
      v.look.lerpVectors(v.seedFocus, v.look, ctrl)
    }

    camera.position.copy(v.pos)

    // bank into the curve, like something flying slowly
    path.getTangentAt(p, v.tangent)
    const turn = v.tangent.x - v.lastTangent.x
    v.lastTangent.lerp(v.tangent, 0.08)
    roll.current += (THREE.MathUtils.clamp(-turn * 60, -0.06, 0.06) - roll.current) * 0.03

    v.m.lookAt(camera.position, v.look, v.up)
    v.q.setFromRotationMatrix(v.m)
    camera.quaternion.slerp(v.q, 1 - Math.pow(0.001, dt))
    camera.rotateZ(roll.current)

    const speed = Math.abs(eden.velocity)
    const fov = 54 + THREE.MathUtils.clamp(speed * 260, 0, 10)
    camera.fov += (fov - camera.fov) * 0.06
    camera.updateProjectionMatrix()

    announceBiome(eden.awake ? biomeAt(p) : -1)
  })

  return null
}
