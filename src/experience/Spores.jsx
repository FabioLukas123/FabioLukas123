import { useMemo } from 'react'
import * as THREE from 'three'
import { path } from '../journey/journey'
import { NOISE, withWorld } from './shaders/lib'
import { eden, world } from '../state'

/**
 * The air of Eden is inhabited. Spores, pollen, embers of light —
 * a single GPU particle field threaded along the entire journey,
 * drifting on noise winds and gathering around the presence.
 */
export default function Spores() {
  const { geometry, material } = useMemo(() => {
    const count = [2600, 5200, 9000][eden.tier]
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const scale = new Float32Array(count)
    const p = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      const t = Math.pow(Math.random(), 0.9)
      path.getPointAt(t, p)
      pos[i * 3] = p.x + (Math.random() - 0.5) * 64
      pos[i * 3 + 1] = Math.max(0.4, p.y + (Math.random() - 0.42) * 26)
      pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 40
      seed[i] = Math.random()
      scale[i] = 0.35 + Math.pow(Math.random(), 2.4) * 1.8
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: withWorld({ uGlow: world.uGlow }),
      vertexShader: /* glsl */ `
        attribute float aSeed, aScale;
        varying float vA;
        varying float vSeed;
        uniform vec3 uPresence;
        uniform float uTime, uGenesis, uPresenceStrength;
        ${NOISE}
        void main(){
          vec3 p = position;
          // the wind is a field, not a direction
          float t = uTime * 0.14;
          p.x += snoise(vec3(position.yz * 0.05, t + aSeed * 9.0)) * 3.2;
          p.y += snoise(vec3(position.xz * 0.05, t * 1.3 + aSeed * 5.0)) * 2.2 + sin(uTime * 0.35 + aSeed * 40.0) * 0.6;
          p.z += snoise(vec3(position.xy * 0.05, t * 0.8 + aSeed * 3.0)) * 3.2;

          // drawn softly toward the presence
          vec3 toP = uPresence - p;
          float d = length(toP);
          p += (toP / max(d, 0.001)) * smoothstep(17.0, 1.5, d) * (0.8 + uPresenceStrength * 3.4) * (0.4 + aSeed * 0.6);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          gl_PointSize = aScale * (240.0 / max(dist, 1.0)) * (0.8 + 0.4 * sin(uTime * (0.7 + aSeed) + aSeed * 30.0));
          gl_Position = projectionMatrix * mv;

          float birth = smoothstep(aSeed * 0.5 + 0.3, aSeed * 0.5 + 0.55, uGenesis);
          vA = birth * smoothstep(90.0, 30.0, dist) * (0.35 + 0.65 * fract(aSeed * 7.31));
          vSeed = aSeed;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        varying float vSeed;
        uniform vec3 uGlow;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float core = exp(-d * d * 26.0);
          vec3 col = mix(uGlow, vec3(1.0, 0.98, 0.9), vSeed * 0.55);
          gl_FragColor = vec4(col, core * vA * 0.85);
        }
      `,
    })
    return { geometry, material }
  }, [])

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
