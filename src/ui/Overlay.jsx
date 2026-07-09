import { useEffect, useRef, useState } from 'react'
import { state, REGIONS, regionWeight, regionAt, STATION_OFFSETS } from '../journey.js'
import { audio } from '../audio/AudioEngine.js'

/*
 * Everything written over the world: region inscriptions, the
 * descent rail, the wordmark. Driven directly from the journey
 * state at animation-frame rate — React never re-renders here.
 */

const NOTES = [
  'contents: everything',
  'shelf count unknown — the walls predate counting',
  'catalogued under: questions without final answers',
  'scale of holdings: 10⁻³⁵ m to 10²⁶ m',
  'every telling of every story, including this one',
  'deposits accepted continuously since the first goodbye',
  'access denied — the librarians remember why',
  'acquisitions expected: ∞',
  'you are always welcome to return',
]

export default function Overlay() {
  const cardRefs = useRef([])
  const fillRef = useRef()
  const nodeRefs = useRef([])
  const markRef = useRef()
  const hintRef = useRef()
  const againRef = useRef()
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    let raf
    const loop = () => {
      const off = state.offset
      REGIONS.forEach((_, r) => {
        const el = cardRefs.current[r]
        if (!el) return
        const w = state.entered ? regionWeight(off, r, r === 0 ? 0.4 : 0.5) : 0
        el.style.opacity = w
        el.style.transform = `translate(-50%, ${(1 - w) * 26}px)`
        el.style.visibility = w > 0.01 ? 'visible' : 'hidden'
        const node = nodeRefs.current[r]
        if (node) node.classList.toggle('is-active', regionAt(off) === r && state.entered)
      })
      if (fillRef.current) fillRef.current.style.height = `${off * 100}%`
      if (markRef.current) markRef.current.style.opacity = off > 0.08 && off < 0.92 ? 0.85 : 0
      if (hintRef.current) hintRef.current.style.opacity = state.entered && off < 0.012 ? 1 : 0
      if (againRef.current) againRef.current.style.opacity = off > 0.965 ? 1 : 0
      if (againRef.current) againRef.current.style.pointerEvents = off > 0.965 ? 'auto' : 'none'
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const beginAgain = () => {
    if (state.scrollEl) state.scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleMute = () => setMuted(audio.toggleMute())

  return (
    <div className="overlay">
      <div className="wordmark" ref={markRef}>THE LIBRARY OF HUMANITY</div>

      <button className="mute" onClick={toggleMute} data-hover aria-label="sound">
        {muted ? 'SOUND OFF' : 'SOUND ON'}
      </button>

      {/* the descent rail */}
      <div className="rail">
        <div className="rail-line"><div className="rail-fill" ref={fillRef} /></div>
        {REGIONS.map((r, i) => (
          <div
            key={i}
            className="rail-node"
            style={{ top: `${STATION_OFFSETS[i] * 100}%` }}
            ref={(el) => (nodeRefs.current[i] = el)}
          >
            <span className="rail-numeral">{r.numeral || '·'}</span>
          </div>
        ))}
      </div>

      {/* region inscriptions */}
      {REGIONS.map((r, i) => (
        <div
          key={i}
          className="card"
          ref={(el) => (cardRefs.current[i] = el)}
          data-hover
        >
          {r.numeral && <div className="card-numeral">{r.numeral}</div>}
          <div className="card-title">{r.title}</div>
          <div className="card-line">{r.line}</div>
          <div className="card-note">{NOTES[i]}</div>
        </div>
      ))}

      <div className="hint" ref={hintRef}>
        <span>SCROLL TO TRAVEL</span>
        <div className="hint-line" />
      </div>

      <button className="again" ref={againRef} onClick={beginAgain} data-hover>
        RETURN TO THE FIRST LIGHT
      </button>
    </div>
  )
}
