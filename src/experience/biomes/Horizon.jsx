import { useMemo } from 'react'
import * as THREE from 'three'
import { mulberry } from './TreeFactory'
import { NOISE, withWorld } from '../shaders/lib'
import { eden, world } from '../../state'

/**
 * BIOME VII — THE HORIZON
 * The end of the journey. Eden entire: ocean, mountains, sky and the
 * slow silhouettes of giants — everything in equilibrium, seen at once.
 */

export default function Horizon() {
  const ocean = useMemo(() => {
    const seg = eden.tier === 0 ? 60 : 110
    const geo = new THREE.PlaneGeometry(2000, 1000, seg, Math.floor(seg / 2))
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 1.4, -1420)
    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: withWorld({
        uDeep: { value: new THREE.Color('#123a52') },
        uLift: { value: new THREE.Color('#7fb4c9') },
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      }),
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        uniform float uTime;
        ${NOISE}
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position;
          p.y += snoise(vec3(p.x * 0.008, p.z * 0.008 + uTime * 0.02, uTime * 0.01)) * 2.2;
          vWorld = p;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;
        uniform vec3 uDeep, uLift, uSunDir, uSunColor;
        uniform float uTime;
        ${NOISE}
        #include <fog_pars_fragment>
        void main(){
          vec3 view = normalize(vWorld - cameraPosition);
          float fres = pow(1.0 - max(-view.y, 0.0), 3.0);
          vec3 col = mix(uDeep, uLift, fres);
          // the sun's road home
          float glint = pow(max(snoise(vec3(vWorld.x * 0.6, vWorld.z * 0.6, uTime * 0.4)), 0.0), 10.0);
          float road = exp(-abs(vWorld.x - uSunDir.x * 400.0) * 0.004);
          col += uSunColor * (glint * road * 0.9 + road * 0.07);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    return mesh
  }, [])

  const ranges = useMemo(() => {
    const LAYERS = 4
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: withWorld({
        uNear: { value: new THREE.Color('#27435f') },
        uFar: { value: new THREE.Color('#9fb6cd') },
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      }),
      vertexShader: /* glsl */ `
        attribute float aDepth;
        varying vec2 vUv;
        varying float vDepth;
        #include <fog_pars_vertex>
        void main(){
          vUv = uv;
          vDepth = aDepth;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDepth;
        uniform vec3 uNear, uFar, uSunColor;
        uniform float uGenesis;
        ${NOISE}
        #include <fog_pars_fragment>
        void main(){
          float ridge = 0.30
            + fbm(vec3(vUv.x * 5.0 + vDepth * 37.0, vDepth * 11.0, 3.0)) * 0.34
            + snoise(vec3(vUv.x * 17.0, vDepth * 23.0, 1.0)) * 0.05;
          float body = smoothstep(ridge, ridge - 0.012, vUv.y);
          if (body < 0.01) discard;
          vec3 col = mix(uNear, uFar, vDepth);
          // dawn kissing the crests
          col += uSunColor * smoothstep(ridge - 0.1, ridge, vUv.y) * (0.25 + vDepth * 0.3);
          gl_FragColor = vec4(col, body * smoothstep(0.8, 1.0, uGenesis));
          #include <fog_fragment>
        }
      `,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, LAYERS)
    mesh.frustumCulled = false
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const depth = new Float32Array(LAYERS)
    for (let i = 0; i < LAYERS; i++) {
      const d = i / (LAYERS - 1)
      p.set((i % 2 === 0 ? -1 : 1) * i * 60, 40 + i * 18, -1090 - i * 90)
      s.set(1500 + i * 320, 130 + i * 60, 1)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      depth[i] = d
    }
    geo.setAttribute('aDepth', new THREE.InstancedBufferAttribute(depth, 1))
    return mesh
  }, [])

  // at the overlook, light rises back into the sky — the planet exhaling
  const ascension = useMemo(() => {
    const rnd = mulberry(11011)
    const count = [300, 600, 1000][eden.tier]
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 120
      pos[i * 3 + 1] = rnd() * 90
      pos[i * 3 + 2] = -930 - rnd() * 160
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
          p.y = mod(position.y + uTime * (0.8 + aSeed * 1.4), 95.0);
          p.x += snoise(vec3(aSeed * 20.0, uTime * 0.06, p.y * 0.02)) * 4.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          gl_PointSize = (0.5 + aSeed) * (260.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
          vA = smoothstep(0.0, 12.0, p.y) * smoothstep(95.0, 60.0, p.y)
             * smoothstep(170.0, 60.0, dist) * smoothstep(0.9, 1.0, uGenesis);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float core = exp(-dot(c, c) * 18.0);
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.8), core * vA * 0.7);
        }
      `,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    return pts
  }, [])

  return (
    <group>
      <primitive object={ocean} />
      <primitive object={ranges} />
      <primitive object={ascension} />
    </group>
  )
}
