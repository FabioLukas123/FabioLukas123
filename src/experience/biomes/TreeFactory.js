import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Deterministic pseudo-random — every tree is an individual, forever. */
export const mulberry = (seed) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const taperTube = (curve, segments, radial, radius, taperTo, flare = 0) => {
  const geo = new THREE.TubeGeometry(curve, segments, radius, radial, false)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  const center = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i)
    curve.getPointAt(u, center)
    v.fromBufferAttribute(pos, i).sub(center)
    let f = THREE.MathUtils.lerp(1, taperTo, Math.pow(u, 0.85))
    if (flare > 0) f *= 1 + flare * Math.pow(1 - u, 10)
    v.multiplyScalar(f).add(center)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Grow one tree: a curved, tapered trunk with reaching branches.
 * Returns merged geometry plus foliage anchor points (position + radius).
 */
export const makeTree = ({ seed = 1, height = 30, radius = height * 0.042, branchCount = 5 }) => {
  const rnd = mulberry(seed)
  const parts = []
  const tips = []

  // trunk — a slow S of growth toward the light
  const bend = () => (rnd() - 0.5) * height * 0.16
  const bx = bend()
  const bz = bend()
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bx * 0.4, height * 0.33, bz * 0.4),
    new THREE.Vector3(bx, height * 0.66, bz),
    new THREE.Vector3(bx * 0.55, height, bz * 0.55),
  ])
  parts.push(taperTube(trunkCurve, 16, 7, radius, 0.16, 1.35))
  const crown = trunkCurve.getPointAt(1)
  tips.push({ p: crown.clone(), r: height * 0.19 })

  // branches — each one an argument with gravity, won long ago
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < branchCount; i++) {
    const u = 0.46 + rnd() * 0.4
    const start = trunkCurve.getPointAt(u)
    const az = rnd() * Math.PI * 2
    const out = new THREE.Vector3(Math.cos(az), 0, Math.sin(az))
    const len = height * (0.24 + rnd() * 0.17) * (1.25 - u * 0.6)
    const mid = start.clone().addScaledVector(out, len * 0.5).addScaledVector(up, len * 0.22)
    const end = start.clone().addScaledVector(out, len).addScaledVector(up, len * 0.5)
    const c = new THREE.CatmullRomCurve3([start, mid, end])
    parts.push(taperTube(c, 8, 5, radius * 0.34 * (1.3 - u), 0.12))
    tips.push({ p: end, r: len * 0.42 })
  }

  const geometry = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return { geometry, tips, height }
}
