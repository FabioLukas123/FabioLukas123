import { useMemo } from 'react'
import * as THREE from 'three'
import { NOISE, withWorld } from './shaders/lib'
import { eden } from '../state'

/**
 * The ground of Eden. Not dirt — a nervous system.
 * Bioluminescent veins run beneath the whole world, spreading out
 * from the first seed during genesis, and leaning toward the presence.
 */
export default function Terrain() {
  const geometry = useMemo(() => {
    const seg = eden.tier === 0 ? [96, 260] : [150, 400]
    const g = new THREE.PlaneGeometry(880, 1360, seg[0], seg[1])
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, -510)
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        fog: true,
        uniforms: withWorld({
          uSoil: { value: new THREE.Color('#0a1410') },
          uGlowA: { value: new THREE.Color('#3dffb0') },
          uGlowB: { value: new THREE.Color('#7fd8ff') },
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        }),
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          varying float vSlope;
          ${NOISE}
          #include <fog_pars_vertex>
          void main(){
            vec3 p = position;
            // eternal geology — layered, slow
            float hill = fbm(vec3(p.x * 0.016, 0.0, p.z * 0.016)) * 5.2;
            float detail = snoise(vec3(p.x * 0.09, 0.0, p.z * 0.09)) * 0.9;
            // keep the traveled corridor gentle
            float corridor = smoothstep(60.0, 18.0, abs(p.x));
            p.y += (hill + detail) * mix(1.0, 0.25, corridor);
            vSlope = hill;
            vWorld = p;
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vWorld;
          varying float vSlope;
          uniform vec3 uSoil, uGlowA, uGlowB, uPresence;
          uniform float uTime, uGenesis, uPresenceStrength;
          ${NOISE}
          #include <fog_pars_fragment>

          float zone(float z, float a, float b){
            return smoothstep(a + 30.0, a - 10.0, z) * smoothstep(b - 30.0, b + 10.0, z);
          }

          void main(){
            vec3 col = uSoil * (0.7 + 0.3 * snoise(vWorld * 0.25));
            col += uSoil * vSlope * 0.12;

            // where the veins remember to shine
            float forest = zone(vWorld.z, 20.0, -190.0);
            float memory = zone(vWorld.z, -770.0, -910.0);
            float bloomz = zone(vWorld.z, -640.0, -770.0);
            float riverz = zone(vWorld.z, -340.0, -470.0);

            // moss & meadow tints
            col = mix(col, vec3(0.05, 0.10, 0.07), forest * 0.8);
            col = mix(col, vec3(0.11, 0.06, 0.09), bloomz * 0.8);
            col = mix(col, vec3(0.03, 0.05, 0.09), memory * 0.8);

            // the root network — thin luminous filaments
            float n = snoise(vec3(vWorld.x * 0.075, 0.0, vWorld.z * 0.075));
            float n2 = snoise(vec3(vWorld.x * 0.028 + 40.0, 0.0, vWorld.z * 0.028));
            float vein = smoothstep(0.075, 0.0, abs(n)) + 0.6 * smoothstep(0.05, 0.0, abs(n2));

            // life travels along them
            float pulse = 0.55 + 0.45 * sin(uTime * 1.35 + n2 * 14.0 - vWorld.z * 0.05);

            // genesis: the network grows out from the first seed
            float seedDist = distance(vWorld.xz, vec2(2.0, -22.0));
            float grown = smoothstep(seedDist, seedDist + 60.0, pow(uGenesis, 1.4) * 1500.0);

            float strength = forest * 1.0 + memory * 0.9 + riverz * 0.35 + bloomz * 0.2;
            vec3 veinCol = mix(uGlowA, uGlowB, memory + riverz * 0.5);

            // the ground brightens under the visitor's presence
            float near = smoothstep(16.0, 2.0, distance(vWorld, uPresence));
            float presence = near * (0.35 + uPresenceStrength);

            col += veinCol * vein * pulse * grown * (strength * 0.9 + presence * 1.4);
            col += veinCol * 0.02 * grown * strength; // faint ambient bio-light

            gl_FragColor = vec4(col, 1.0);
            #include <fog_fragment>
          }
        `,
      }),
    []
  )

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
