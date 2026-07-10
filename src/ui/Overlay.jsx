import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { eden, world, onBiomeChange } from '../state'
import { BIOMES } from '../journey/journey'
import { soundscape } from '../audio/soundscape'

const GENESIS_LINES = [
  { at: 1.2, out: 5.4, text: 'A humanidade não desapareceu.' },
  { at: 6.2, out: 10.6, text: 'Ela apenas deixou de precisar da matéria.' },
  { at: 11.4, out: 16.4, text: 'Durante milhares de anos, a Terra ficou em silêncio.' },
  { at: 17.2, out: 22.5, text: 'E então, sem pressa nenhuma — floresceu.' },
]

if (typeof window !== 'undefined') window.__EDEN_GSAP__ = gsap

// quiet doors: ?auto (skip the button) ?fast (short genesis) ?mute (no audio)
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()

const MEMORIES = [
  'Panthera tigris — lembrada',
  'Loxodonta africana — lembrada',
  'Balaenoptera musculus — lembrada',
  'Apis mellifera — lembrada',
  'Danaus plexippus — lembrada',
  'Ailuropoda melanoleuca — lembrada',
  'Homo sapiens — lembrada, com carinho',
]

export default function Overlay() {
  const [phase, setPhase] = useState('void') // void -> genesis -> alive
  const [title, setTitle] = useState(null)
  const [whisper, setWhisper] = useState(null)
  const [hint, setHint] = useState(false)
  const [sound, setSound] = useState(true)
  const [ended, setEnded] = useState(false)
  const vineRef = useRef()
  const pendingBiome = useRef(null)
  const shownBiomes = useRef(new Set())
  const genesisLineRefs = useRef([])
  const titleTimer = useRef()

  const begin = () => {
    if (eden.awake) return
    eden.awake = true
    if (!params.has('mute')) {
      try {
        soundscape.start()
      } catch {
        // a silent Eden is still Eden
      }
    }
    setPhase('genesis')
    const fast = params.has('fast')
    const dur = fast ? 3 : 24
    gsap.to(world.uGenesis, { value: 1, duration: dur, ease: 'power1.inOut', delay: fast ? 0 : 0.6 })
    // the words that accompany the birth
    if (!fast) {
      GENESIS_LINES.forEach((l, i) => {
        gsap.delayedCall(l.at, () => genesisLineRefs.current[i]?.classList.add('visible'))
        gsap.delayedCall(l.out, () => genesisLineRefs.current[i]?.classList.remove('visible'))
      })
    }
    gsap.delayedCall(dur + 0.5, () => {
      setPhase('alive')
      setHint(true)
    })
  }

  // ?auto — the world may be asked to wake itself (tests, kiosks)
  useEffect(() => {
    if (params.has('auto')) begin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // biome titles — announced by the world, revealed only once each
  useEffect(
    () =>
      onBiomeChange((index) => {
        if (index < 0) return
        pendingBiome.current = index
      }),
    []
  )

  // one quiet loop: vine, whispers, sound engine, pending titles
  useEffect(() => {
    let raf
    let last = performance.now()
    let whisperAt = 0
    let whisperIdx = 0
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const p = eden.progress
      const g = world.uGenesis.value

      soundscape.update(p, g, dt)

      if (vineRef.current) {
        vineRef.current.style.transform = `scaleY(${p})`
      }

      // titles wait for the world to finish being born
      if (pendingBiome.current != null && g > 0.96) {
        const i = pendingBiome.current
        pendingBiome.current = null
        if (!shownBiomes.current.has(i)) {
          shownBiomes.current.add(i)
          clearTimeout(titleTimer.current)
          setTitle(BIOMES[i])
          titleTimer.current = setTimeout(() => setTitle(null), 5200)
        }
      }

      // the memory grove whispers
      const inMemory = p > BIOMES[5].range[0] && p < BIOMES[5].range[1] && g > 0.99
      if (inMemory && now - whisperAt > 6500) {
        whisperAt = now
        setWhisper(MEMORIES[whisperIdx++ % MEMORIES.length])
        setTimeout(() => setWhisper(null), 5000)
      }

      setEnded((e) => (p > 0.975 && g > 0.99 ? true : e && p > 0.9))

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // the walking hint retires after the first step
  useEffect(() => {
    if (!hint) return
    const clear = () => setHint(false)
    window.addEventListener('wheel', clear, { once: true, passive: true })
    window.addEventListener('touchmove', clear, { once: true, passive: true })
    return () => {
      window.removeEventListener('wheel', clear)
      window.removeEventListener('touchmove', clear)
    }
  }, [hint])

  return (
    <div className="overlay">
      {phase === 'void' && (
        <div className="void">
          <h1 className="wordmark">E D E N</h1>
          <p className="void-sub">o último paraíso da Terra</p>
          <button className="awaken" onClick={begin}>
            despertar
          </button>
          <p className="void-note">fones de ouvido recomendados</p>
        </div>
      )}

      {phase === 'genesis' && (
        <div className="genesis">
          {GENESIS_LINES.map((l, i) => (
            <p key={i} ref={(el) => (genesisLineRefs.current[i] = el)} className="genesis-line">
              {l.text}
            </p>
          ))}
        </div>
      )}

      {phase === 'alive' && (
        <>
          <div className={`biome-title ${title ? 'visible' : ''}`}>
            {title && (
              <>
                <h2>{title.name}</h2>
                <p>{title.caption}</p>
              </>
            )}
          </div>

          <div className={`whisper ${whisper ? 'visible' : ''}`}>{whisper}</div>

          <div className={`hint ${hint ? 'visible' : ''}`}>role para caminhar</div>

          <div className={`ending ${ended ? 'visible' : ''}`}>
            <h2>E D E N</h2>
            <p>A vida continuou.</p>
            <p>Ela apenas deixou de nos esperar.</p>
          </div>

          <div className="vine" aria-hidden="true">
            <div className="vine-track" />
            <div className="vine-sap" ref={vineRef} />
            {BIOMES.map((b, i) => (
              <span key={i} className="vine-node" style={{ top: `${((b.range[0] + b.range[1]) / 2) * 100}%` }} />
            ))}
          </div>
        </>
      )}

      {phase !== 'void' && (
        <button
          className="sound-toggle"
          onClick={() => setSound(soundscape.toggle())}
          aria-label={sound ? 'silenciar' : 'ouvir'}
        >
          {sound ? 'som' : 'silêncio'}
        </button>
      )}
    </div>
  )
}
