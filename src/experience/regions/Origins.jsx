import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { Region, Inscription } from './Region.jsx'

/*
 * REGION I — THE HALL OF ORIGINS
 * A vast cave wall, painted forty thousand years ago, lit by a fire
 * that never went out. The paintings are drawn procedurally: hands,
 * beasts, spirals, the first alphabet of the species.
 */

function paintCave() {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1024
  const x = c.getContext('2d')

  // rock
  x.fillStyle = '#20140c'
  x.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 900; i++) {
    const shade = 18 + Math.random() * 26
    x.fillStyle = `rgba(${shade + 14},${shade + 6},${shade},${0.12 + Math.random() * 0.2})`
    x.beginPath()
    x.ellipse(
      Math.random() * c.width, Math.random() * c.height,
      20 + Math.random() * 140, 10 + Math.random() * 70,
      Math.random() * Math.PI, 0, Math.PI * 2)
    x.fill()
  }

  const ochres = ['rgba(214,124,52,', 'rgba(188,72,40,', 'rgba(226,168,92,', 'rgba(160,50,34,']
  const ochre = (a) => ochres[(Math.random() * ochres.length) | 0] + a + ')'

  // stencilled hands
  for (let i = 0; i < 14; i++) {
    const hx = 100 + Math.random() * (c.width - 200)
    const hy = 120 + Math.random() * (c.height - 260)
    const s = 26 + Math.random() * 26
    const rot = (Math.random() - 0.5) * 1.2
    x.save()
    x.translate(hx, hy)
    x.rotate(rot)
    x.fillStyle = ochre(0.16 + Math.random() * 0.14)
    // spray halo
    x.beginPath()
    x.ellipse(0, 0, s * 1.9, s * 2.2, 0, 0, Math.PI * 2)
    x.fill()
    // negative hand
    x.fillStyle = '#20140c'
    x.beginPath()
    x.ellipse(0, s * 0.35, s * 0.62, s * 0.8, 0, 0, Math.PI * 2)
    x.fill()
    for (let f = 0; f < 5; f++) {
      const fa = (f - 2) * 0.3 + (Math.random() - 0.5) * 0.06
      const fl = s * (f === 0 ? 0.8 : 1.15 - Math.abs(f - 2.6) * 0.12)
      x.save()
      x.rotate(fa)
      x.fillRect(-s * 0.09, -s * 0.42 - fl, s * 0.19, fl + s * 0.2)
      x.restore()
    }
    x.restore()
  }

  // beasts — arched backs, legs, horns
  for (let i = 0; i < 7; i++) {
    const bx = 150 + Math.random() * (c.width - 400)
    const by = 180 + Math.random() * (c.height - 360)
    const s = 60 + Math.random() * 80
    x.save()
    x.translate(bx, by)
    x.scale(Math.random() > 0.5 ? 1 : -1, 1)
    x.strokeStyle = ochre(0.55 + Math.random() * 0.3)
    x.lineWidth = 6 + Math.random() * 5
    x.lineCap = 'round'
    x.beginPath()
    x.moveTo(-s, 0)
    x.quadraticCurveTo(-s * 0.4, -s * 0.78, s * 0.25, -s * 0.5)
    x.quadraticCurveTo(s * 0.8, -s * 0.42, s, -s * 0.1)
    x.stroke()
    x.beginPath()
    x.moveTo(-s * 0.85, 0)
    x.quadraticCurveTo(-s * 0.2, s * 0.22, s * 0.6, s * 0.05)
    x.stroke()
    for (const lx of [-s * 0.7, -s * 0.45, s * 0.3, s * 0.55]) {
      x.beginPath()
      x.moveTo(lx, s * 0.05)
      x.lineTo(lx + (Math.random() - 0.5) * 10, s * 0.55)
      x.stroke()
    }
    x.beginPath()
    x.moveTo(s * 0.86, -s * 0.3)
    x.quadraticCurveTo(s * 1.15, -s * 0.75, s * 0.95, -s * 0.95)
    x.stroke()
    x.restore()
  }

  // spirals, dot rows, tallies — the first counting
  for (let i = 0; i < 9; i++) {
    const sx = 80 + Math.random() * (c.width - 160)
    const sy = 90 + Math.random() * (c.height - 180)
    x.strokeStyle = ochre(0.5)
    x.fillStyle = ochre(0.6)
    x.lineWidth = 4
    const kind = i % 3
    if (kind === 0) {
      x.beginPath()
      for (let a = 0; a < Math.PI * 6; a += 0.1) {
        const r = a * 3.4
        const px = sx + Math.cos(a) * r
        const py = sy + Math.sin(a) * r
        a === 0 ? x.moveTo(px, py) : x.lineTo(px, py)
      }
      x.stroke()
    } else if (kind === 1) {
      for (let d = 0; d < 8; d++) {
        x.beginPath()
        x.arc(sx + d * 16, sy + Math.sin(d) * 5, 4.5, 0, Math.PI * 2)
        x.fill()
      }
    } else {
      for (let d = 0; d < 6; d++) x.fillRect(sx + d * 12, sy, 4, 34)
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export default function Origins({ position }) {
  const tex = useMemo(paintCave, [])
  const fire = useRef()

  useFrame(({ clock }) => {
    if (fire.current) {
      const t = clock.elapsedTime
      fire.current.intensity =
        30 + Math.sin(t * 7.3) * 6 + Math.sin(t * 11.7) * 4 + Math.sin(t * 3.1) * 5
    }
  })

  return (
    <Region index={1} position={position}>
      {/* the painted vault, seen from inside */}
      {/* the gap in the wall faces +z, where the traveller enters */}
      <mesh rotation={[0, Math.PI * 0.33, 0]} position={[0, 4, -8]}>
        <cylinderGeometry args={[30, 34, 46, 48, 1, true, 0, Math.PI * 1.35]} />
        <meshStandardMaterial map={tex} roughness={1} metalness={0} side={THREE.BackSide} />
      </mesh>
      {/* the fire that never went out */}
      <pointLight ref={fire} position={[2, -6, -10]} color="#ff9a3c" distance={90} decay={1.7} />
      <pointLight position={[-6, 10, -2]} color="#5a4030" intensity={5} distance={60} />
      <Sparkles count={50} color="#ffb066" size={5} scale={[26, 18, 26]} position={[2, 0, -10]} speed={0.6} opacity={0.7} />
      <Inscription position={[0, -9, -14]} size={0.62} serif color="#e0a06a" opacity={0.8}>
        before words, the hand. before the hand, the wonder.
      </Inscription>
    </Region>
  )
}
