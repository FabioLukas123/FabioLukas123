import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '../state'
import { samplePalette, makePaletteSample } from '../journey/journey'
import { NOISE, withWorld } from './shaders/lib'

/**
 * The sky is not a backdrop. It is the largest living thing in Eden —
 * gradient, stars, sun, aurora, all breathing with the journey.
 */
const SkyMaterial = () => {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: withWorld({
          uSkyTop: { value: new THREE.Color('#071426') },
          uSkyLow: { value: new THREE.Color('#0e4038') },
          uSun: { value: new THREE.Color('#9fffe0') },
          uAuroraColor: { value: new THREE.Color('#52ffc0') },
          uSunDir: { value: new THREE.Vector3(0.25, 0.2, -1).normalize() },
          uStars: { value: 0.7 },
          uAurora: { value: 0.2 },
          uSunI: { value: 0.6 },
        }),
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){
            vDir = position;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          uniform vec3 uSkyTop, uSkyLow, uSun, uAuroraColor, uSunDir;
          uniform float uStars, uAurora, uSunI, uTime, uGenesis;
          ${NOISE}
          void main(){
            vec3 d = normalize(vDir);
            float h = d.y * 0.5 + 0.5;

            vec3 col = mix(uSkyLow, uSkyTop, smoothstep(0.42, 0.72, h));
            // the memory of daylight lingering at the horizon
            col += uSkyLow * 0.35 * pow(1.0 - abs(d.y), 6.0);

            // sun — never a lamp, always an event
            float s = max(dot(d, normalize(uSunDir)), 0.0);
            col += uSun * (pow(s, 1200.0) * 1.8 + pow(s, 32.0) * 0.26 * uSunI + pow(s, 4.0) * 0.08 * uSunI);

            // slow volumetric cloud veils
            float veil = fbm(vec3(d.x * 2.1, d.y * 3.4 + uTime * 0.008, d.z * 2.1 + uTime * 0.012));
            col += uSkyLow * veil * 0.14 * smoothstep(0.0, 0.35, d.y);

            // stars — sharper when the world is darker
            float starsVis = max(uStars, 1.0 - uGenesis);
            if (starsVis > 0.01 && d.y > -0.1) {
              vec2 sph = vec2(atan(d.z, d.x) * 40.0, d.y * 110.0);
              vec2 cell = floor(sph);
              vec2 f = fract(sph) - 0.5;
              float rnd = hash21(cell);
              float star = smoothstep(0.35, 0.0, length(f - (vec2(hash21(cell + 7.1), hash21(cell + 3.7)) - 0.5) * 0.6));
              star *= step(0.93, rnd);
              float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + rnd * 3.0) + rnd * 40.0);
              col += vec3(0.85, 0.92, 1.0) * star * twinkle * starsVis * smoothstep(0.0, 0.25, d.y);
            }

            // aurora — the planet's own dreaming
            if (uAurora > 0.02) {
              float band = smoothstep(0.12, 0.42, d.y) * smoothstep(0.95, 0.5, d.y);
              float n1 = snoise(vec3(d.x * 2.3, d.y * 5.0 - uTime * 0.03, d.z * 2.3 + uTime * 0.02));
              float n2 = snoise(vec3(d.x * 5.0 + 13.0, d.y * 9.0 + uTime * 0.05, d.z * 5.0));
              float a = band * smoothstep(0.1, 0.8, n1 * 0.7 + n2 * 0.3 + 0.35);
              col += uAuroraColor * a * uAurora * (0.5 + 0.5 * sin(uTime * 0.11 + d.x * 3.0));
            }

            // genesis: the void before the first seed
            col = mix(col * 0.02 + vec3(0.002, 0.004, 0.008), col, smoothstep(0.05, 0.75, uGenesis));

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  )
}

export default function Atmosphere() {
  const { scene } = useThree()
  const sky = useRef()
  const sun = useRef()
  const hemi = useRef()
  const mat = SkyMaterial()
  const pal = useMemo(() => makePaletteSample(), [])
  const fog = useMemo(() => new THREE.FogExp2('#0a2e2a', 0.016), [])
  const sunDir = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    const g = world.uGenesis.value
    samplePalette(world.uProgress.value, pal)

    // the sky follows the visitor — Eden has no edges
    if (sky.current) sky.current.position.copy(camera.position)

    mat.uniforms.uSkyTop.value.copy(pal.skyTop)
    mat.uniforms.uSkyLow.value.copy(pal.skyLow)
    mat.uniforms.uSun.value.copy(pal.sun)
    mat.uniforms.uAuroraColor.value.copy(pal.glow)
    mat.uniforms.uStars.value = pal.stars
    mat.uniforms.uAurora.value = pal.aurora
    mat.uniforms.uSunI.value = pal.sunI
    sunDir.set(0.3, 0.16 + world.uProgress.value * 0.22, -1).normalize()
    mat.uniforms.uSunDir.value.copy(sunDir)
    world.uSunDir.value.copy(sunDir)
    world.uSunColor.value.copy(pal.sun)

    // fog: the void is thick; genesis exhales it away
    const dark = THREE.MathUtils.smoothstep(g, 0.0, 0.8)
    fog.color.copy(pal.fog).multiplyScalar(0.15 + 0.85 * dark)
    fog.density = THREE.MathUtils.lerp(0.05, pal.fogDensity, dark)
    scene.fog = fog

    world.uGlow.value.copy(pal.glow)

    if (sun.current) {
      sun.current.color.copy(pal.sun)
      sun.current.intensity = pal.sunI * 1.35 * dark
      sun.current.position.copy(camera.position).addScaledVector(sunDir, 120)
      sun.current.target.position.copy(camera.position)
      sun.current.target.updateMatrixWorld()
    }
    if (hemi.current) {
      hemi.current.color.copy(pal.skyTop).lerp(pal.skyLow, 0.5)
      hemi.current.groundColor.copy(pal.fog).multiplyScalar(0.6)
      hemi.current.intensity = (0.25 + pal.sunI * 0.5) * dark
    }
  })

  return (
    <group>
      <mesh ref={sky} material={mat} frustumCulled={false}>
        <sphereGeometry args={[900, 32, 24]} />
      </mesh>
      <directionalLight ref={sun} intensity={0.8} />
      <hemisphereLight ref={hemi} intensity={0.4} />
    </group>
  )
}
