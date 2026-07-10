import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eden, world } from '../state'
import { NOISE, withWorld } from './shaders/lib'

/**
 * Not a cursor. A presence.
 * A soft knot of light that drifts where the visitor's attention goes;
 * the world leans toward it, and it exhales when the visitor is still.
 */
export default function Presence() {
  const group = useRef()
  const light = useRef()

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: withWorld({ uColor: { value: world.uGlow.value } }),
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){
            vUv = uv;
            // billboard
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform vec3 uColor;
          uniform float uTime, uPresenceStrength, uGenesis;
          ${NOISE}
          void main(){
            vec2 c = vUv - 0.5;
            float d = length(c);
            float breathe = 0.85 + 0.15 * sin(uTime * 1.7);
            float halo = exp(-d * d * 34.0) * 0.55 + exp(-d * d * 7.0) * 0.12;
            float flicker = 0.8 + 0.2 * snoise(vec3(c * 6.0, uTime * 0.8));
            float a = halo * breathe * flicker * (0.25 + uPresenceStrength * 0.75) * smoothstep(0.1, 0.5, uGenesis);
            gl_FragColor = vec4(uColor * 1.6, a);
          }
        `,
      }),
    []
  )

  useFrame(() => {
    if (group.current) group.current.position.copy(eden.presence)
    if (light.current) {
      light.current.color.copy(world.uGlow.value)
      light.current.intensity = (0.6 + eden.presenceStrength * 2.6) * world.uGenesis.value * 14
    }
    material.uniforms.uColor.value = world.uGlow.value
  })

  return (
    <group ref={group}>
      <mesh material={material} frustumCulled={false}>
        <planeGeometry args={[7, 7]} />
      </mesh>
      <pointLight ref={light} distance={26} decay={2} intensity={8} />
    </group>
  )
}
