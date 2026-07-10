import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE, withWorld } from '../shaders/lib'
import { world } from '../../state'

/**
 * BIOME IV — THE GIANTS
 * Beings larger than mountains, older than the forests below them.
 * They cross the sky in circles that take an hour. Nothing hunts.
 * Nothing flees. They simply continue.
 */

const makeGiantGeometry = () => {
  // body — a long soft body tapering into a tail
  const body = new THREE.SphereGeometry(1, 28, 20)
  const pos = body.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    v.z *= 2.9
    v.y *= 0.52
    const t = THREE.MathUtils.clamp((v.z + 2.9) / 5.8, 0, 1) // 0 head, 1 tail
    const taper = THREE.MathUtils.lerp(1, 0.06, Math.pow(Math.max(t - 0.35, 0) / 0.65, 1.35))
    v.x *= taper
    v.y *= taper
    // wings — the body widens into a mantle amidships
    const wing = Math.exp(-Math.pow((t - 0.32) / 0.24, 2.0))
    v.x *= 1 + wing * 2.6 * Math.abs(v.x)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  body.computeVertexNormals()
  return body
}

const CREATURES = [
  // the valley crossing — biome IV
  { center: [0, 95, -560], radius: 130, height: 14, speed: 0.016, scale: 34, phase: 0.0 },
  { center: [-60, 60, -540], radius: 90, height: 8, speed: -0.021, scale: 22, phase: 2.4 },
  { center: [70, 130, -590], radius: 150, height: 20, speed: 0.011, scale: 44, phase: 4.2 },
  { center: [0, 40, -520], radius: 70, height: 6, speed: -0.028, scale: 12, phase: 1.2 },
  // and far away, over the final ocean — seen again from the horizon
  { center: [-80, 130, -1360], radius: 200, height: 26, speed: 0.009, scale: 60, phase: 3.1 },
  { center: [180, 90, -1290], radius: 130, height: 12, speed: -0.013, scale: 34, phase: 5.5 },
]

export default function Giants() {
  const mesh = useRef()

  const { geometry, material } = useMemo(() => {
    const geometry = makeGiantGeometry()
    const phase = new Float32Array(CREATURES.length)
    CREATURES.forEach((c, i) => (phase[i] = c.phase))
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))

    const material = new THREE.ShaderMaterial({
      fog: true,
      uniforms: withWorld({
        uBody: { value: new THREE.Color('#232b3f') },
        uBelly: { value: new THREE.Color('#4a5878') },
        uGlow: world.uGlow,
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      }),
      vertexShader: /* glsl */ `
        attribute float aPhase;
        varying vec3 vWorld, vNormalW, vLocal;
        varying float vPhase;
        uniform float uTime, uGenesis;
        ${NOISE}
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position;
          float t = clamp((p.z + 2.9) / 5.8, 0.0, 1.0);
          // one slow wave travels the length of the body — patience made visible
          float swim = sin(p.z * 0.9 - uTime * 0.55 + aPhase * 6.283);
          p.y += swim * 0.22 * (0.25 + t * t);
          // the mantle beats like a breath, not a wing
          p.y += abs(p.x) * sin(uTime * 0.5 + aPhase * 6.283 + p.z * 0.3) * 0.3;

          vLocal = position;
          vPhase = aPhase;
          vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld, vNormalW, vLocal;
        varying float vPhase;
        uniform vec3 uBody, uBelly, uGlow, uSunDir, uSunColor, uPresence;
        uniform float uTime, uGenesis;
        ${NOISE}
        #include <fog_pars_fragment>
        void main(){
          vec3 n = normalize(vNormalW);
          vec3 view = normalize(vWorld - cameraPosition);

          vec3 col = mix(uBody, uBelly, smoothstep(0.1, -0.4, vLocal.y));
          col *= 0.8 + 0.2 * snoise(vLocal * 2.0);
          col += uSunColor * max(dot(n, uSunDir), 0.0) * 0.22;

          // constellations along the flank — a language no one is left to read
          float lines = smoothstep(0.06, 0.0, abs(fract(vLocal.z * 1.4 + snoise(vLocal * 1.2) * 0.4) - 0.5) - 0.32);
          float travel = 0.45 + 0.55 * sin(vLocal.z * 2.2 - uTime * 0.8 + vPhase * 6.283);
          float spots = pow(max(snoise(vLocal * 5.0 + vPhase), 0.0), 3.0);
          col += uGlow * (lines * travel * 0.7 + spots * 0.85) * smoothstep(-0.1, -0.35, vLocal.y);

          // rim against the sky — how you know how large they are
          float fres = pow(1.0 - abs(dot(n, view)), 2.5);
          col += uGlow * fres * 0.3;

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    })
    return { geometry, material }
  }, [])

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      next: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      look: new THREE.Matrix4(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    []
  )

  useFrame(() => {
    if (!mesh.current) return
    const t = world.uTime.value
    const g = THREE.MathUtils.smoothstep(world.uGenesis.value, 0.7, 1)
    CREATURES.forEach((c, i) => {
      const a = t * c.speed + c.phase
      const a2 = a + 0.02 * Math.sign(c.speed)
      tmp.p.set(
        c.center[0] + Math.cos(a) * c.radius,
        c.center[1] + Math.sin(a * 2.0) * c.height,
        c.center[2] + Math.sin(a) * c.radius
      )
      tmp.next.set(
        c.center[0] + Math.cos(a2) * c.radius,
        c.center[1] + Math.sin(a2 * 2.0) * c.height,
        c.center[2] + Math.sin(a2) * c.radius
      )
      tmp.look.lookAt(tmp.next, tmp.p, tmp.up) // geometry nose points -z
      tmp.q.setFromRotationMatrix(tmp.look)
      tmp.s.setScalar(c.scale * g)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      mesh.current.setMatrixAt(i, tmp.m)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, CREATURES.length]}
      frustumCulled={false}
    />
  )
}
