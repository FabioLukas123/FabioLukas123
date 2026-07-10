import { useMemo } from 'react'
import * as THREE from 'three'
import { makeTree, mulberry } from './TreeFactory'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Plant a grove: tree descriptions -> two instanced draw calls per variant
 * (trunks, foliage), with per-instance birth so the grove grows outward
 * from the first seed during genesis.
 */
export default function Grove({ trees, variantSeeds, trunkMaterial, foliageMaterial, branchCount = 5, foliageDetail = 2 }) {
  const meshes = useMemo(() => {
    const rnd = mulberry(variantSeeds[0] * 7919 + 13)
    const variants = variantSeeds.map((s) => makeTree({ seed: s, height: 30, branchCount }))
    const out = []
    const m = new THREE.Matrix4()
    const tipM = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()

    variants.forEach((variant, vi) => {
      const list = trees.filter((t) => t.variant % variants.length === vi)
      if (!list.length) return

      // trunks
      const tg = variant.geometry.clone()
      const trunk = new THREE.InstancedMesh(tg, trunkMaterial, list.length)
      const tBirth = new Float32Array(list.length)
      const tPhase = new Float32Array(list.length)
      const tHeight = new Float32Array(list.length)
      const treeMatrices = []
      list.forEach((t, i) => {
        const s = t.height / variant.height
        pos.set(t.x, t.y ?? 0, t.z)
        q.setFromAxisAngle(UP, t.ry ?? rnd() * Math.PI * 2)
        scl.set(s * (t.girth ?? 1), s, s * (t.girth ?? 1))
        m.compose(pos, q, scl)
        trunk.setMatrixAt(i, m)
        treeMatrices.push(m.clone())
        tBirth[i] = t.birth
        tPhase[i] = rnd()
        tHeight[i] = variant.height
      })
      tg.setAttribute('aBirth', new THREE.InstancedBufferAttribute(tBirth, 1))
      tg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(tPhase, 1))
      tg.setAttribute('aHeight', new THREE.InstancedBufferAttribute(tHeight, 1))
      trunk.frustumCulled = false
      trunk.instanceMatrix.needsUpdate = true

      // foliage — one blob per branch tip
      const blobCount = list.length * variant.tips.length
      const fg = new THREE.IcosahedronGeometry(1, foliageDetail)
      const fol = new THREE.InstancedMesh(fg, foliageMaterial, blobCount)
      const fBirth = new Float32Array(blobCount)
      const fPhase = new Float32Array(blobCount)
      const fTint = new Float32Array(blobCount)
      let k = 0
      list.forEach((t, i) => {
        variant.tips.forEach((tip) => {
          const stretch = 0.8 + rnd() * 0.5
          tipM.compose(tip.p, q.identity(), scl.set(tip.r * stretch, tip.r * (0.62 + rnd() * 0.3), tip.r * stretch))
          tipM.premultiply(treeMatrices[i])
          fol.setMatrixAt(k, tipM)
          fBirth[k] = t.birth
          fPhase[k] = rnd()
          fTint[k] = rnd()
          k++
        })
      })
      fg.setAttribute('aBirth', new THREE.InstancedBufferAttribute(fBirth, 1))
      fg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(fPhase, 1))
      fg.setAttribute('aTint', new THREE.InstancedBufferAttribute(fTint, 1))
      fol.frustumCulled = false
      fol.instanceMatrix.needsUpdate = true

      out.push(trunk, fol)
    })
    return out
  }, [])

  return (
    <group>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  )
}
