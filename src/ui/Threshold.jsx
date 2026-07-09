import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { state } from '../journey.js'
import { audio } from '../audio/AudioEngine.js'

/*
 * The threshold. Total darkness, one distant light, and a door
 * that only opens when the traveller chooses to cross.
 */

export default function Threshold() {
  const { active, progress } = useProgress()
  const [phase, setPhase] = useState('waiting') // waiting -> crossing -> gone
  const [warm, setWarm] = useState(false)

  // everything in the Library is procedural — the loading manager may
  // never activate, so the door opens after the first breath either way
  useEffect(() => {
    const t = setTimeout(() => setWarm(true), 1800)
    return () => clearTimeout(t)
  }, [])
  const ready = warm && !active

  useEffect(() => {
    if (phase === 'crossing') {
      const t = setTimeout(() => setPhase('gone'), 2400)
      return () => clearTimeout(t)
    }
  }, [phase])

  if (phase === 'gone') return null

  const cross = () => {
    if (!ready || phase !== 'waiting') return
    audio.start()
    audio.pageTurn(0.12)
    state.entered = true
    setPhase('crossing')
  }

  return (
    <div className={`threshold ${phase === 'crossing' ? 'threshold--crossing' : ''}`}>
      <div className="threshold-light" />
      <div className="threshold-body">
        <p className="threshold-kicker">SOMEWHERE</p>
        <h1 className="threshold-title">
          EVERY IDEA EVER THOUGHT<br />IS KEPT IN A SINGLE PLACE
        </h1>
        <p className="threshold-sub">
          It was not built. It simply exists — the way gravity exists.
          <br />
          You are standing at its only door.
        </p>
        <button
          className={`threshold-enter ${ready ? 'is-ready' : ''}`}
          onClick={cross}
          data-hover
        >
          <span className="threshold-enter-line" />
          {ready ? 'CROSS THE THRESHOLD' : active ? `OPENING  ${Math.floor(progress)}%` : 'OPENING'}
          <span className="threshold-enter-line" />
        </button>
        <p className="threshold-hint">headphones recommended — the Library breathes</p>
      </div>
    </div>
  )
}
