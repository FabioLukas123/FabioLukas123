import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry } from './TreeFactory'
import { NOISE, withWorld } from '../shaders/lib'
import { eden, world } from '../../state'

/**
 * BIOME V — THE BLOOM
 * The most beautiful region of the planet. Millions of flowers in
 * colors that had to be invented, breathing pollen made of light.
 */

const tagPart = (geo, part) => {
  const arr = new Float32Array(geo.attributes.position.count).fill(part)
  geo.setAttribute('aPart', new THREE.BufferAttribute(arr, 1))
  return geo
}

const makeFlowerGeometry = () => {
  const parts = []
  // stem
  const stem = new THREE.PlaneGeometry(0.05, 1, 1, 3)
  stem.translate(0, 0.5, 0)
  parts.push(tagPart(stem, 0))
  // petals — a corolla of six
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.PlaneGeometry(0.16, 0.34, 1, 2)
    petal.translate(0, 0.17, 0)
    petal.rotateX(-Math.PI / 3.2)
    petal.rotateY((i / 6) * Math.PI * 2)
    petal.translate(0, 1.0, 0)
    parts.push(tagPart(petal, 1))
  }
  // the luminous heart
  const core = new THREE.CircleGeometry(0.07, 8)
  core.rotateX(-Math.PI / 2.6)
  core.translate(0, 1.04, 0)
  parts.push(tagPart(core, 2))
  return mergeGeometries(parts)
}

export default function TheBloom() {
  const flowers = useMemo(() => {
    const rnd = mulberry(60660)
    const count = [1400, 2800, 4600][eden.tier]
    const geo = makeFlowerGeometry()

    const mat = new THREE.ShaderMaterial({
      fog: true,
      side: THREE.DoubleSide,
      uniforms: withWorld({
        uGlow: world.uGlow,
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      }),
      vertexShader: /* glsl */ `
        attribute float aPart;
        attribute float aHue, aPhase, aBirth;
        varying vec3 vWorld, vNormalW;
        varying float vPart, vHue, vPhase;
        uniform float uTime, uGenesis, uPresenceStrength;
        uniform vec3 uPresence;
        ${NOISE}
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position;
          float g = clamp((uGenesis - aBirth) / 0.18, 0.0, 1.0);
          g = g * g * (3.0 - 2.0 * g);
          p *= g;

          vec4 base = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

          // one wind moves the whole meadow — a single breath
          float wind = snoise(vec3(base.x * 0.05, base.z * 0.05, uTime * 0.3));
          float lean = p.y * p.y;
          p.x += wind * lean * 0.4;
          p.z += snoise(vec3(base.z * 0.05, uTime * 0.24, base.x * 0.05)) * lean * 0.3;

          // the meadow parts gently around the presence
          vec2 away = base.xz - uPresence.xz;
          float pd = length(away);
          p.xz += (away / max(pd, 0.001)) * smoothstep(8.0, 0.6, pd) * (0.45 + uPresenceStrength) * lean * 0.9;

          // petals flutter
          p += normal * step(0.5, aPart) * sin(uTime * 2.1 + aPhase * 6.283) * 0.02;

          vPart = aPart;
          vHue = aHue;
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
        varying vec3 vWorld, vNormalW;
        varying float vPart, vHue, vPhase;
        uniform vec3 uGlow, uPresence, uSunColor, uSunDir;
        uniform float uTime, uPresenceStrength;
        #include <fog_pars_fragment>
        void main(){
          vec3 n = normalize(vNormalW);
          vec3 view = normalize(vWorld - cameraPosition);

          // colors never seen: a gradient with no earthly name
          vec3 a = vec3(1.0, 0.45, 0.72); // rose
          vec3 b = vec3(1.0, 0.72, 0.42); // ember
          vec3 c = vec3(0.72, 0.5, 1.0);  // violet
          vec3 petal = vHue < 0.5 ? mix(a, b, vHue * 2.0) : mix(b, c, vHue * 2.0 - 1.0);

          vec3 col;
          if (vPart < 0.5) {
            col = vec3(0.07, 0.22, 0.15) * (0.7 + 0.3 * n.y); // stem
          } else if (vPart < 1.5) {
            float rim = pow(1.0 - abs(dot(n, view)), 2.0);
            col = petal * (0.55 + 0.45 * max(dot(n, uSunDir), 0.0));
            col += petal * rim * 0.9;
            col += uSunColor * pow(max(dot(view, uSunDir), 0.0), 8.0) * 0.15; // backlit
          } else {
            // the heart holds actual light
            float pulse = 0.7 + 0.3 * sin(uTime * 1.6 + vPhase * 6.283);
            col = mix(petal, vec3(1.0, 0.92, 0.6), 0.7) * (1.4 * pulse);
          }

          float presence = smoothstep(10.0, 1.0, distance(vWorld, uPresence)) * (0.4 + uPresenceStrength);
          col += petal * presence * 0.7;

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    })

    const mesh = new THREE.InstancedMesh(geo, mat, count)
    mesh.frustumCulled = false
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const UP = new THREE.Vector3(0, 1, 0)
    const hue = new Float32Array(count)
    const phase = new Float32Array(count)
    const birth = new Float32Array(count)

    // the meadow grows in drifts, like weather left a pattern
    const clusters = []
    for (let i = 0; i < 34; i++) {
      clusters.push({ x: (rnd() - 0.5) * 66, z: -644 - rnd() * 122, r: 4 + rnd() * 12, hue: rnd() })
    }
    for (let i = 0; i < count; i++) {
      const cl = clusters[(rnd() * clusters.length) | 0]
      const ang = rnd() * Math.PI * 2
      const rad = Math.pow(rnd(), 0.6) * cl.r
      p.set(cl.x + Math.cos(ang) * rad, -0.3, cl.z + Math.sin(ang) * rad)
      q.setFromAxisAngle(UP, rnd() * Math.PI * 2)
      const h = 0.8 + rnd() * 1.9
      s.set(h, h, h)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      hue[i] = THREE.MathUtils.clamp(cl.hue + (rnd() - 0.5) * 0.3, 0, 1)
      phase[i] = rnd()
      birth[i] = 0.7 + rnd() * 0.28
    }
    geo.setAttribute('aHue', new THREE.InstancedBufferAttribute(hue, 1))
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    geo.setAttribute('aBirth', new THREE.InstancedBufferAttribute(birth, 1))
    return mesh
  }, [])

  const pollen = useMemo(() => {
    const rnd = mulberry(8080)
    const count = [700, 1500, 2600][eden.tier]
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 84
      pos[i * 3 + 1] = rnd() * 16
      pos[i * 3 + 2] = -636 - rnd() * 136
      seed[i] = rnd()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: withWorld({}),
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying float vA;
        uniform float uTime, uGenesis;
        ${NOISE}
        void main(){
          vec3 p = position;
          // pollen rises — light returning to the sky
          p.y = mod(position.y + uTime * (0.25 + aSeed * 0.5), 17.0);
          p.x += snoise(vec3(position.z * 0.04, uTime * 0.1, aSeed * 8.0)) * 2.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          gl_PointSize = (0.5 + aSeed * 1.4) * (200.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
          float fadeEdges = smoothstep(0.0, 2.0, p.y) * smoothstep(17.0, 13.0, p.y);
          vA = fadeEdges * smoothstep(80.0, 25.0, dist) * smoothstep(0.75, 0.95, uGenesis);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float core = exp(-dot(c, c) * 22.0);
          gl_FragColor = vec4(vec3(1.0, 0.85, 0.5), core * vA * 0.8);
        }
      `,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    return pts
  }, [])

  return (
    <group>
      <primitive object={flowers} />
      <primitive object={pollen} />
    </group>
  )
}
