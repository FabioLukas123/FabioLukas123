import { useMemo } from 'react'
import * as THREE from 'three'
import { NOISE, withWorld } from './shaders/lib'

/**
 * THE OPENING.
 * Darkness. Distant wind. A single seed of light drifts down through
 * the void, touches the soil — and the world begins.
 *
 * Everything here is a function of uGenesis:
 *   0.00–0.12  the seed falls
 *   0.12       impact — a ring of light
 *   0.12–0.5   the first tree grows (see LuminousForest, birth 0.14)
 *   0.3–1.0    the forest, then the world
 */
export default function Seed() {
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(10, 10)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: withWorld({}),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vFall;
        uniform float uGenesis, uTime;
        void main(){
          vUv = uv;
          float fall = smoothstep(0.0, 0.12, uGenesis);
          vFall = fall;
          // from the dark above, down to the soil
          vec3 anchor = vec3(2.0, mix(46.0, 0.6, fall), -22.0);
          anchor.x += sin(uTime * 0.7) * (1.0 - fall) * 1.6;
          vec4 mv = viewMatrix * vec4(anchor, 1.0);
          mv.xy += position.xy;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vFall;
        uniform float uGenesis, uTime;
        ${NOISE}
        void main(){
          vec2 c = vUv - 0.5;
          float d = length(c);

          // the seed — a small certainty of light
          float seed = exp(-d * d * 900.0) * 1.4 + exp(-d * d * 90.0) * 0.35;
          float alive = 0.8 + 0.2 * sin(uTime * 3.0);
          float before = 1.0 - smoothstep(0.12, 0.2, uGenesis);
          float a = seed * alive * before * smoothstep(0.0, 0.01, uGenesis);

          // impact — one ring, spreading like a held breath released
          float ringT = smoothstep(0.12, 0.3, uGenesis);
          if (ringT > 0.0 && ringT < 1.0) {
            float ring = exp(-pow((d - ringT * 0.48) * 26.0, 2.0));
            a += ring * (1.0 - ringT) * 1.2;
          }

          vec3 col = mix(vec3(0.6, 1.0, 0.85), vec3(1.0, 0.98, 0.9), d * 2.0);
          gl_FragColor = vec4(col, a);
        }
      `,
    })
    const m = new THREE.Mesh(geo, mat)
    m.frustumCulled = false
    return m
  }, [])

  return <primitive object={mesh} />
}
