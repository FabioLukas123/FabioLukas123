import { useMemo } from 'react'
import * as THREE from 'three'
import { mulberry } from './TreeFactory'
import { NOISE, withWorld } from '../shaders/lib'
import { eden, world } from '../../state'

/**
 * BIOME II — THE FLOATING GARDENS
 * The land forgot its own weight. Islands hang in the air, trailing
 * waterfalls that never reach the ground.
 */

const makeIslandGeometry = () => {
  const g = new THREE.IcosahedronGeometry(1, 3)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  const rnd = mulberry(99)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = 1 + (rnd() - 0.5) * 0.14
    if (v.y < 0) {
      // the underside tapers into a hanging root of stone
      const pinch = 1 - Math.min(-v.y, 1) * 0.72
      v.x *= pinch * r
      v.z *= pinch * r
      v.y *= 2.3
    } else {
      // a soft meadow crown
      v.y *= 0.42
      v.x *= r
      v.z *= r
    }
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export default function FloatingGardens() {
  const { islands, falls } = useMemo(() => {
    const rnd = mulberry(3141)
    const count = [12, 20, 28][eden.tier]

    const islandGeo = makeIslandGeometry()
    const islandMat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: withWorld({
        uRock: { value: new THREE.Color('#2e3440') },
        uMoss: { value: new THREE.Color('#3f9b63') },
        uGlow: world.uGlow,
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      }),
      vertexShader: /* glsl */ `
        attribute float aPhase, aBirth;
        varying vec3 vWorld, vNormalW, vLocal;
        varying float vPhase;
        uniform float uTime, uGenesis;
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position;
          float g = clamp((uGenesis - aBirth) / 0.25, 0.0, 1.0);
          g = g * g * (3.0 - 2.0 * g);
          p *= g;
          vLocal = position;
          vPhase = aPhase;
          vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
          // weightless — each island rides its own slow swell
          wp.y += sin(uTime * 0.22 + aPhase * 6.283) * 1.7;
          wp.x += sin(uTime * 0.13 + aPhase * 9.42) * 0.8;
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
        uniform vec3 uRock, uMoss, uGlow, uPresence, uSunDir, uSunColor;
        uniform float uTime, uPresenceStrength;
        ${NOISE}
        #include <fog_pars_fragment>
        void main(){
          vec3 n = normalize(vNormalW);
          // stone with strata
          float strata = 0.75 + 0.25 * sin(vLocal.y * 14.0 + snoise(vLocal * 3.0) * 3.0);
          vec3 col = uRock * strata * (0.55 + 0.45 * max(dot(n, uSunDir), 0.0));
          // meadow on every upward face
          float up = smoothstep(0.35, 0.75, n.y);
          vec3 moss = uMoss * (0.7 + 0.3 * snoise(vec3(vWorld.xz * 0.8, vPhase * 10.0)));
          col = mix(col, moss, up);
          col += uSunColor * up * 0.18 * max(dot(n, uSunDir), 0.0);
          // luminous lichen where stone meets air
          float rim = pow(1.0 - abs(dot(n, normalize(vWorld - cameraPosition))), 3.0);
          col += uGlow * rim * 0.35;
          // gravity roots: the underside drips light
          float under = smoothstep(-0.2, -1.4, vLocal.y);
          col += uGlow * under * (0.25 + 0.2 * sin(uTime * 1.1 + vPhase * 6.283)) ;
          float presence = smoothstep(18.0, 3.0, distance(vWorld, uPresence)) * (0.3 + uPresenceStrength);
          col += uGlow * presence * 0.4;
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    })

    const islands = new THREE.InstancedMesh(islandGeo, islandMat, count)
    islands.frustumCulled = false
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const phase = new Float32Array(count)
    const birth = new Float32Array(count)
    const fallSpecs = []
    for (let i = 0; i < count; i++) {
      const z = -185 - rnd() * 130
      const side = rnd() > 0.5 ? 1 : -1
      const x = side * (17 + rnd() * 55)
      const y = 16 + rnd() * 42
      const r = 4 + Math.pow(rnd(), 1.5) * 11
      p.set(x, y, z)
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2)
      s.set(r, r, r)
      m.compose(p, q, s)
      islands.setMatrixAt(i, m)
      phase[i] = rnd()
      birth[i] = 0.55 + rnd() * 0.4
      if (rnd() > 0.45) fallSpecs.push({ x, y: y - r * 0.35, z, w: r * 0.34, h: 14 + rnd() * 22, phase: phase[i] })
    }
    islandGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    islandGeo.setAttribute('aBirth', new THREE.InstancedBufferAttribute(birth, 1))

    // waterfalls that dissolve into mist before they land
    const fallGeo = new THREE.PlaneGeometry(1, 1)
    const fallMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: withWorld({}),
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying vec2 vUv;
        varying float vSeed;
        uniform float uTime;
        void main(){
          vUv = uv;
          vSeed = aSeed;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          wp.y += sin(uTime * 0.22 + aSeed * 6.283) * 1.7; // ride with the island
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vSeed;
        uniform float uTime, uGenesis;
        ${NOISE}
        void main(){
          float streaks = snoise(vec3(vUv.x * 9.0 + vSeed * 40.0, vUv.y * 3.0 + uTime * 0.9, vSeed * 7.0));
          float body = smoothstep(-0.35, 0.6, streaks);
          float across = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 1.4);
          float head = smoothstep(1.0, 0.92, vUv.y);
          float dissolve = smoothstep(0.0, 0.45, vUv.y); // fades to mist below
          float a = body * across * head * dissolve * 0.5 * smoothstep(0.6, 1.0, uGenesis);
          vec3 col = mix(vec3(0.55, 0.8, 0.9), vec3(0.9, 0.98, 1.0), body);
          gl_FragColor = vec4(col, a);
        }
      `,
    })
    const falls = new THREE.InstancedMesh(fallGeo, fallMat, Math.max(fallSpecs.length, 1))
    falls.frustumCulled = false
    const fSeed = new Float32Array(Math.max(fallSpecs.length, 1))
    fallSpecs.forEach((f, i) => {
      p.set(f.x, f.y - f.h / 2, f.z)
      q.identity()
      s.set(f.w, f.h, 1)
      m.compose(p, q, s)
      falls.setMatrixAt(i, m)
      fSeed[i] = f.phase
    })
    fallGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(fSeed, 1))

    return { islands, falls }
  }, [])

  return (
    <group>
      <primitive object={islands} />
      <primitive object={falls} />
    </group>
  )
}
