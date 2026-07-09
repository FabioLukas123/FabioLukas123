import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { state, smooth, CURVE } from '../journey.js'

/*
 * The signature system. Every page of every book, one draw call.
 * Pages begin as a single closed book, erupt into a vortex, then
 * settle into an endless slow river of pages that roofs the entire
 * journey. All motion happens in the vertex shader.
 */

export const BOOK_POS = new THREE.Vector3(0, 0, 22)
const MAX_PAGES = 12000

const vertexShader = /* glsl */ `
attribute vec3 aBook;
attribute vec3 aShelf;
attribute vec4 aSeed;
uniform float uTime;
uniform float uProgress;
uniform vec3 uCursor;
varying vec2 vUv;
varying float vShade;
varying float vDepth;
varying float vInk;

mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1.,0.,0., 0.,c,-s, 0.,s,c); }
mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0.,s, 0.,1.,0., -s,0.,c); }

void main() {
  vUv = uv;
  vec4 s = aSeed;
  float t = uTime;

  // each page joins the storm at its own moment
  float p = smoothstep(s.x * 0.30, s.x * 0.30 + 0.70, uProgress);

  // vortex around the book
  float ang = s.y * 6.2831 + t * (0.15 + s.z * 0.25) + p * 7.0;
  float rad = 1.5 + p * (26.0 * s.w + 14.0 * p);
  vec3 vort = aBook + vec3(
    cos(ang) * rad,
    (s.z - 0.35) * 16.0 * p + sin(t * 0.35 + s.x * 9.0) * 0.7,
    sin(ang) * rad * 0.85
  );

  vec3 pos = mix(aBook, vort, smoothstep(0.0, 0.55, p));
  pos = mix(pos, aShelf, smoothstep(0.5, 1.0, p));

  // the settled river keeps drifting forever
  float settled = smoothstep(0.5, 1.0, p);
  pos.x += sin(t * 0.06 + aShelf.z * 0.013 + s.y * 6.28) * 2.4 * settled;
  pos.y += sin(t * 0.09 + aShelf.z * 0.021 + s.x * 6.28) * 1.2 * settled;

  // flutter
  float fl = sin(t * (1.2 + s.y * 2.8) + s.x * 21.0);
  vec3 local = rotX(fl * 0.6 + s.z * 6.28) * rotY(s.y * 6.28 + t * 0.22 * (s.x - 0.5)) * position;
  vec3 world = pos + local * (0.7 + s.w * 0.6);

  // the cursor attracts nearby ideas
  vec3 toC = uCursor - pos;
  float dc = length(toC);
  world += (toC / max(dc, 0.001)) * smoothstep(10.0, 0.0, dc) * 2.2;

  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vDepth = -mv.z;
  vShade = 0.62 + 0.30 * fl * 0.5 + s.w * 0.18;
  vInk = s.z;
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying float vShade;
varying float vDepth;
varying float vInk;
uniform vec3 uFogColor;

float hash(float n){ return fract(sin(n) * 43758.5453); }

void main() {
  vec3 paper = vec3(0.92, 0.88, 0.78) * vShade;
  // faint procedural lines of text
  float row = floor(vUv.y * 13.0);
  float inRow = step(fract(vUv.y * 13.0), 0.38);
  float margin = step(0.10, vUv.x) * step(vUv.x, 0.90) * step(0.10, vUv.y) * step(vUv.y, 0.92);
  float len = 0.9 - 0.35 * hash(row * 3.7 + vInk * 97.0);
  float ink = inRow * margin * step(vUv.x, len);
  vec3 col = mix(paper, paper * 0.42, ink * 0.85);
  float fog = 1.0 - exp(-vDepth * vDepth * 0.00030);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}
`

export default function PageStorm() {
  const matRef = useRef()
  const { scene } = useThree()

  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(0.62, 0.84)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.uv = base.attributes.uv

    const book = new Float32Array(MAX_PAGES * 3)
    const shelf = new Float32Array(MAX_PAGES * 3)
    const seed = new Float32Array(MAX_PAGES * 4)
    const v = new THREE.Vector3()
    for (let i = 0; i < MAX_PAGES; i++) {
      // packed into the closed book
      book[i * 3] = BOOK_POS.x + (Math.random() - 0.5) * 1.1
      book[i * 3 + 1] = BOOK_POS.y + (Math.random() - 0.5) * 0.34
      book[i * 3 + 2] = BOOK_POS.z + (Math.random() - 0.5) * 0.8

      // final home: the slow river of pages above the whole corridor
      const t = Math.pow(Math.random(), 0.85)
      CURVE.getPointAt(t, v)
      shelf[i * 3] = v.x + (Math.random() - 0.5) * 56
      shelf[i * 3 + 1] = v.y + 9 + Math.random() * 22
      shelf[i * 3 + 2] = v.z + (Math.random() - 0.5) * 26

      seed[i * 4] = Math.random()
      seed[i * 4 + 1] = Math.random()
      seed[i * 4 + 2] = Math.random()
      seed[i * 4 + 3] = Math.random()
    }
    geo.setAttribute('aBook', new THREE.InstancedBufferAttribute(book, 3))
    geo.setAttribute('aShelf', new THREE.InstancedBufferAttribute(shelf, 3))
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4))
    return geo
  }, [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uCursor: { value: new THREE.Vector3(0, 0, 9999) },
    uFogColor: { value: new THREE.Color('#020204') },
  }), [])

  useFrame((_, delta) => {
    const u = uniforms
    u.uTime.value += delta
    u.uProgress.value = smooth(0.012, 0.105, state.offset)
    u.uCursor.value.copy(state.cursorWorld)
    if (scene.fog) u.uFogColor.value.copy(scene.fog.color)
    geometry.instanceCount = Math.floor(MAX_PAGES * Math.max(0.3, state.quality))
  })

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
