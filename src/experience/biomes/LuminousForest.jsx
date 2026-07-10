import { useMemo } from 'react'
import * as THREE from 'three'
import Grove from './Grove'
import { makeTrunkMaterial, makeFoliageMaterial } from './TreeShaders'
import { mulberry } from './TreeFactory'
import { NOISE, withWorld } from '../shaders/lib'
import { eden } from '../../state'

/**
 * BIOME I — THE LUMINOUS FOREST
 * Giant trees with translucent crowns; light falls in shafts;
 * everything the ground remembers glows.
 */

const SEED = new THREE.Vector2(2, -22) // where the first seed fell

const useBeams = () => {
  return useMemo(() => {
    const count = eden.tier === 0 ? 7 : 14
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: withWorld({}),
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying vec2 vUv;
        varying float vSeed;
        void main(){
          vUv = uv;
          vSeed = aSeed;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vSeed;
        uniform float uTime, uGenesis;
        uniform vec3 uSunColor;
        ${NOISE}
        void main(){
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float fall = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          float dust = 0.6 + 0.4 * snoise(vec3(vUv.x * 3.0 + vSeed * 20.0, vUv.y * 2.0 - uTime * 0.05, uTime * 0.03));
          float slowBreath = 0.65 + 0.35 * sin(uTime * 0.21 + vSeed * 6.283);
          float a = pow(across, 2.4) * fall * dust * slowBreath * 0.16 * smoothstep(0.5, 1.0, uGenesis);
          gl_FragColor = vec4(uSunColor * 1.35, a);
        }
      `,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    const rnd = mulberry(4242)
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      p.set((rnd() - 0.5) * 110, 26 + rnd() * 14, 4 - rnd() * 195)
      e.set(0, rnd() * 0.8 - 0.4, -0.31 - rnd() * 0.14) // leaning with the sun
      q.setFromEuler(e)
      s.set(3 + rnd() * 8, 58 + rnd() * 22, 1)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      seeds[i] = rnd()
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    mesh.frustumCulled = false
    return mesh
  }, [])
}

export default function LuminousForest() {
  const trees = useMemo(() => {
    const rnd = mulberry(1817)
    const list = []
    // the first tree — the one the visitor watches being born
    list.push({ x: 2, z: -22, height: 38, birth: 0.14, variant: 0, girth: 1.15 })

    const count = [26, 40, 52][eden.tier]
    for (let i = 0; i < count; i++) {
      const z = 16 - rnd() * 215
      const side = rnd() > 0.5 ? 1 : -1
      const x = side * (13 + Math.pow(rnd(), 1.4) * 72)
      const d = Math.hypot(x - SEED.x, z - SEED.y)
      list.push({
        x,
        z,
        height: 24 + Math.pow(rnd(), 1.6) * 46, // some of them are colossal
        birth: 0.34 + Math.min(d / 240, 1) * 0.52 + rnd() * 0.05,
        variant: (rnd() * 3) | 0,
        girth: 0.85 + rnd() * 0.5,
      })
    }
    return list
  }, [])

  const trunkMaterial = useMemo(() => makeTrunkMaterial({ bark: '#151009', vein: 0.7 }), [])
  const foliageMaterial = useMemo(() => makeFoliageMaterial({ deep: '#0a3323', light: '#2c8a58' }), [])
  const beams = useBeams()

  return (
    <group>
      <Grove trees={trees} variantSeeds={[11, 29, 47]} trunkMaterial={trunkMaterial} foliageMaterial={foliageMaterial} />
      <primitive object={beams} />
    </group>
  )
}
