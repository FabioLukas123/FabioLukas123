import { useMemo } from 'react'
import * as THREE from 'three'
import { mulberry } from './TreeFactory'
import { NOISE, withWorld } from '../shaders/lib'
import { eden, world } from '../../state'

/**
 * BIOME III — THE CRYSTAL RIVER
 * Water that kept the sky inside itself, flowing between minerals
 * that are not quite stone and not quite alive.
 */

export default function CrystalRiver() {
  const water = useMemo(() => {
    const seg = eden.tier === 0 ? [48, 90] : [80, 150]
    const geo = new THREE.PlaneGeometry(64, 190, seg[0], seg[1])
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 4.6, -408)
    const mat = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      uniforms: withWorld({
        uDeep: { value: new THREE.Color('#052733') },
        uShallow: { value: new THREE.Color('#0d5e66') },
        uSky: { value: new THREE.Color('#8fe8ff') },
        uGlow: world.uGlow,
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      }),
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying float vWave;
        uniform float uTime;
        ${NOISE}
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position;
          float w1 = snoise(vec3(p.x * 0.08, p.z * 0.05 + uTime * 0.12, uTime * 0.05));
          float w2 = snoise(vec3(p.x * 0.22, p.z * 0.16 + uTime * 0.3, 7.0));
          p.y += w1 * 0.55 + w2 * 0.18;
          vWave = w1 * 0.7 + w2 * 0.3;
          vWorld = p;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;
        varying float vWave;
        uniform vec3 uDeep, uShallow, uSky, uGlow, uPresence, uSunDir, uSunColor;
        uniform float uTime, uGenesis, uPresenceStrength;
        ${NOISE}
        #include <fog_pars_fragment>
        void main(){
          vec3 view = normalize(vWorld - cameraPosition);

          // a breathing surface normal
          float e = 0.6;
          float h0 = snoise(vec3(vWorld.x * 0.25, vWorld.z * 0.18 + uTime * 0.22, uTime * 0.07));
          float hx = snoise(vec3((vWorld.x + e) * 0.25, vWorld.z * 0.18 + uTime * 0.22, uTime * 0.07));
          float hz = snoise(vec3(vWorld.x * 0.25, (vWorld.z + e) * 0.18 + uTime * 0.22, uTime * 0.07));
          vec3 n = normalize(vec3(h0 - hx, 1.2, h0 - hz));

          float fres = pow(1.0 - max(dot(-view, n), 0.0), 3.0);
          vec3 col = mix(uDeep, uShallow, 0.5 + vWave * 0.5);
          col = mix(col, uSky, fres * 0.75);

          // the sun lays a path on the water
          vec3 r = reflect(view, n);
          float sunGlint = pow(max(dot(r, uSunDir), 0.0), 220.0);
          col += uSunColor * sunGlint * 2.4;

          // caustic minerals sparkling beneath
          float sparkle = pow(max(snoise(vec3(vWorld.x * 1.4, vWorld.z * 1.4, uTime * 0.6)), 0.0), 8.0);
          col += uGlow * sparkle * 0.8;

          // rings of attention spread from the presence
          float pd = distance(vWorld.xz, uPresence.xz);
          float ring = sin(pd * 2.2 - uTime * 3.4) * 0.5 + 0.5;
          col += uGlow * ring * smoothstep(13.0, 1.5, pd) * (0.15 + uPresenceStrength * 0.5);

          float alpha = 0.94 * smoothstep(0.55, 0.95, uGenesis);
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }
      `,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    return mesh
  }, [])

  const crystals = useMemo(() => {
    const rnd = mulberry(777)
    const count = [36, 64, 96][eden.tier]
    const geo = new THREE.OctahedronGeometry(1, 0)
    geo.scale(1, 2.3, 1)
    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: withWorld({
        uGlow: world.uGlow,
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      }),
      vertexShader: /* glsl */ `
        attribute float aPhase, aTint, aBirth;
        varying vec3 vWorld, vNormalW, vLocal;
        varying float vPhase, vTint;
        uniform float uGenesis;
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position;
          float g = clamp((uGenesis - aBirth) / 0.2, 0.0, 1.0);
          p *= g * g * (3.0 - 2.0 * g);
          vLocal = position;
          vPhase = aPhase;
          vTint = aTint;
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
        varying float vPhase, vTint;
        uniform vec3 uGlow, uPresence, uSunDir, uSunColor;
        uniform float uTime, uPresenceStrength;
        ${NOISE}
        #include <fog_pars_fragment>
        void main(){
          vec3 n = normalize(vNormalW);
          vec3 view = normalize(vWorld - cameraPosition);

          // two mineral bloodlines: aqua and violet
          vec3 tint = mix(vec3(0.2, 0.85, 1.0), vec3(0.62, 0.38, 1.0), step(0.5, vTint));
          vec3 col = tint * 0.05;

          // light lives inside them
          float inner = 0.5 + 0.5 * sin(uTime * 0.9 + vPhase * 6.283 + vLocal.y * 3.0);
          float bands = smoothstep(0.4, 0.0, abs(fract(vLocal.y * 2.0 - uTime * 0.1 + vPhase) - 0.5));
          float depth = snoise(vLocal * 4.0 + vPhase * 8.0) * 0.5 + 0.5;
          col += tint * inner * bands * (0.9 + depth * 0.6);

          float fres = pow(1.0 - abs(dot(n, view)), 2.4);
          col += tint * fres * 1.7;
          col += uSunColor * pow(max(dot(reflect(view, n), uSunDir), 0.0), 60.0) * 0.9;

          // they answer the presence like struck glass
          float presence = smoothstep(14.0, 2.0, distance(vWorld, uPresence));
          col += tint * presence * (0.5 + uPresenceStrength) * (0.6 + 0.4 * sin(uTime * 5.0 + vPhase * 20.0));

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
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const phase = new Float32Array(count)
    const tintA = new Float32Array(count)
    const birth = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const z = -338 - rnd() * 135
      const side = rnd() > 0.5 ? 1 : -1
      const x = side * (10 + rnd() * 26)
      const h = 1 + Math.pow(rnd(), 1.8) * 5.5
      p.set(x, 0.5, z)
      e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5)
      q.setFromEuler(e)
      s.set(h * 0.55, h, h * 0.55)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      phase[i] = rnd()
      tintA[i] = rnd()
      birth[i] = 0.6 + rnd() * 0.38
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tintA, 1))
    geo.setAttribute('aBirth', new THREE.InstancedBufferAttribute(birth, 1))
    return mesh
  }, [])

  return (
    <group>
      <primitive object={water} />
      <primitive object={crystals} />
    </group>
  )
}
