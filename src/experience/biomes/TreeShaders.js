import * as THREE from 'three'
import { NOISE, withWorld } from '../shaders/lib'
import { world } from '../../state'

/**
 * Bark that carries light. Sap-veins of bio-luminescence climb every
 * trunk, pulsing upward; roots glow where they meet the ground.
 */
export const makeTrunkMaterial = ({ bark = '#171009', vein = 0.85, glow = null } = {}) =>
  new THREE.ShaderMaterial({
    fog: true,
    uniforms: withWorld({
      uBark: { value: new THREE.Color(bark) },
      uGlow: glow ? { value: new THREE.Color(glow) } : world.uGlow,
      uVein: { value: vein },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    }),
    vertexShader: /* glsl */ `
      attribute float aBirth, aPhase, aHeight;
      varying vec3 vWorld, vNormalW;
      varying float vLocalY, vPhase, vGrow;
      uniform float uTime, uGenesis;
      ${NOISE}
      #include <fog_pars_vertex>
      void main(){
        vec3 p = position;
        float g = clamp((uGenesis - aBirth) / 0.24, 0.0, 1.0);
        g = g * g * (3.0 - 2.0 * g);
        p.y *= g;
        p.xz *= min(g * 1.4, 1.0);

        // the whole tree leans with a wind that never quite arrives
        float hn = clamp(position.y / max(aHeight, 1.0), 0.0, 1.0);
        float sway = sin(uTime * 0.42 + aPhase * 6.283) * 0.55
                   + snoise(vec3(uTime * 0.09, aPhase * 11.0, 0.0)) * 0.45;
        p.x += sway * hn * hn * 0.8;
        p.z += cos(uTime * 0.36 + aPhase * 6.283) * hn * hn * 0.4;

        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vLocalY = position.y;
        vPhase = aPhase;
        vGrow = g;
        vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld, vNormalW;
      varying float vLocalY, vPhase, vGrow;
      uniform vec3 uBark, uGlow, uPresence, uSunDir, uSunColor;
      uniform float uTime, uVein, uPresenceStrength;
      ${NOISE}
      #include <fog_pars_fragment>
      void main(){
        vec3 n = normalize(vNormalW);
        vec3 col = uBark * (0.7 + 0.3 * snoise(vec3(vWorld.x * 0.6, vLocalY * 0.3, vWorld.z * 0.6)));
        // sky falling on the upper bark
        col += uSunColor * 0.06 * max(dot(n, uSunDir), 0.0);
        col += vec3(0.05, 0.09, 0.11) * pow(max(n.y, 0.0), 2.0);

        // sap of light, climbing
        float filament = smoothstep(0.11, 0.0,
          abs(snoise(vec3(vWorld.x * 0.55, vWorld.z * 0.55, vLocalY * 0.2 - uTime * 0.07))));
        float pulse = 0.5 + 0.5 * sin(vLocalY * 1.3 - uTime * 2.1 + vPhase * 6.283);
        float roots = smoothstep(5.0, 0.0, vLocalY) * 0.9;
        // the light thins as it climbs — brightest where trunk meets earth
        float veinFade = mix(1.0, 0.4, clamp(vLocalY / 24.0, 0.0, 1.0));
        float presence = smoothstep(15.0, 2.0, distance(vWorld, uPresence)) * (0.5 + uPresenceStrength);
        col += uGlow * (filament * pulse * veinFade * (uVein * 0.5 + presence * 0.9) + roots * pulse * uVein * 0.55) * vGrow;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  })

/**
 * Canopy — translucent, backlit, breathing. Not leaves: a membrane of
 * living light that the sun passes through.
 */
export const makeFoliageMaterial = ({ deep = '#0b3524', light = '#2f8f5c', glow = null } = {}) =>
  new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: withWorld({
      uDeep: { value: new THREE.Color(deep) },
      uLight: { value: new THREE.Color(light) },
      uGlow: glow ? { value: new THREE.Color(glow) } : world.uGlow,
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    }),
    vertexShader: /* glsl */ `
      attribute float aBirth, aPhase, aTint;
      varying vec3 vWorld, vNormalW;
      varying float vPhase, vTint;
      uniform float uTime, uGenesis;
      ${NOISE}
      #include <fog_pars_vertex>
      void main(){
        vec3 p = position;
        // every crown breathes on its own rhythm
        p *= 1.0 + 0.05 * sin(uTime * 0.55 + aPhase * 6.283);
        p += normal * snoise(vec3(normal.x * 1.7 + aPhase * 9.0, normal.y * 1.7, uTime * 0.2)) * 0.32;

        float g = clamp((uGenesis - aBirth - 0.06) / 0.2, 0.0, 1.0);
        g = g * g * (3.0 - 2.0 * g);
        p *= g;

        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vPhase = aPhase;
        vTint = aTint;
        vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld, vNormalW;
      varying float vPhase, vTint;
      uniform vec3 uDeep, uLight, uGlow, uPresence, uSunDir, uSunColor;
      uniform float uTime, uPresenceStrength;
      ${NOISE}
      #include <fog_pars_fragment>
      void main(){
        vec3 n = normalize(vNormalW);
        vec3 view = normalize(vWorld - cameraPosition);

        vec3 col = mix(uDeep, uLight, vTint * (0.55 + 0.45 * n.y));

        // translucency — the sun read through the membrane
        float back = pow(max(dot(view, uSunDir), 0.0), 5.0);
        col += uSunColor * back * 0.55;

        // rim of bio-light
        float fres = pow(1.0 - abs(dot(n, view)), 2.2);
        col += uGlow * fres * 0.5;

        // slow shimmer of living cells
        col += uGlow * 0.1 * (0.5 + 0.5 * snoise(vec3(vWorld.xz * 0.8, uTime * 0.3 + vPhase * 5.0)));

        // the canopy notices the presence
        float presence = smoothstep(16.0, 3.0, distance(vWorld, uPresence)) * (0.35 + uPresenceStrength);
        col += uGlow * presence * 0.5;

        gl_FragColor = vec4(col, 0.9);
        #include <fog_fragment>
      }
    `,
  })
