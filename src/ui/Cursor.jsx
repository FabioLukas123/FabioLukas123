import { useEffect, useRef } from 'react'
import { state } from '../journey.js'

/*
 * Not a cursor — an instrument of discovery. A slow ring that
 * breathes, tightens over anything that can be touched, and pulls
 * nearby pages and memories toward it inside the world.
 */

export default function Cursor() {
  const ringRef = useRef()
  const dotRef = useRef()

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    document.documentElement.classList.add('has-cursor')
    const pos = { x: innerWidth / 2, y: innerHeight / 2 }
    const target = { x: pos.x, y: pos.y }
    let hovering = false

    const onMove = (e) => {
      target.x = e.clientX
      target.y = e.clientY
      state.mouse.set(
        (e.clientX / innerWidth) * 2 - 1,
        -(e.clientY / innerHeight) * 2 + 1,
      )
    }
    const onOver = (e) => {
      hovering = !!e.target.closest('[data-hover]')
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)

    let raf
    const loop = (t) => {
      pos.x += (target.x - pos.x) * 0.16
      pos.y += (target.y - pos.y) * 0.16
      const breathe = 1 + Math.sin(t * 0.0016) * 0.08
      const scale = (hovering ? 1.8 : 1) * breathe
      if (ringRef.current) {
        ringRef.current.style.transform =
          `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(${scale})`
        ringRef.current.classList.toggle('is-hover', hovering)
      }
      if (dotRef.current) {
        dotRef.current.style.transform =
          `translate(${target.x}px, ${target.y}px) translate(-50%, -50%)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      cancelAnimationFrame(raf)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [])

  return (
    <>
      <div className="cursor-ring" ref={ringRef} />
      <div className="cursor-dot" ref={dotRef} />
    </>
  )
}
