/*
 * The Library breathes.
 *
 * Everything you hear is synthesized in real time — no samples.
 * A stone-hall drone, a distant choir, turning pages, whispers,
 * embers, and a sub-bass that belongs to the Forbidden Wing.
 * Region mixing is driven every frame by the journey offset.
 */

import { N_SEG, regionWeight } from '../journey.js'

function makeNoiseBuffer(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < len; i++) {
    // pink-ish noise via Paul Kellet's economy filter
    const w = Math.random() * 2 - 1
    b0 = 0.997 * b0 + 0.0290 * w
    b1 = 0.985 * b1 + 0.0329 * w
    b2 = 0.950 * b2 + 0.0578 * w
    d[i] = (b0 + b1 + b2 + w * 0.1054) * 0.55
  }
  return buf
}

function makeImpulse(ctx, seconds = 3.4, decay = 2.6) {
  // synthetic stone-hall impulse response
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

export class AudioEngine {
  constructor() {
    this.started = false
    this.muted = false
  }

  start() {
    if (this.started) return
    this.started = true
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -20
    comp.ratio.value = 6
    this.master.connect(comp)
    comp.connect(ctx.destination)

    // cathedral reverb
    this.verb = ctx.createConvolver()
    this.verb.buffer = makeImpulse(ctx)
    this.verbGain = ctx.createGain()
    this.verbGain.gain.value = 0.5
    this.verb.connect(this.verbGain)
    this.verbGain.connect(this.master)

    this.noiseBuf = makeNoiseBuffer(ctx)

    this._buildDrone()
    this._buildBreath()
    this._buildChoir()
    this._buildSub()
    this._loops()

    this.master.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 4)
  }

  _osc(type, freq, dest, gain = 0.1, detune = 0) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    const g = this.ctx.createGain()
    g.gain.value = gain
    o.connect(g)
    g.connect(dest)
    o.start()
    return { o, g }
  }

  _buildDrone() {
    const ctx = this.ctx
    this.droneGain = ctx.createGain()
    this.droneGain.gain.value = 0.16
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 220
    lp.Q.value = 0.8
    this.droneGain.connect(lp)
    lp.connect(this.master)
    lp.connect(this.verb)
    this.droneFilter = lp

    // D drone: root, fifth, octave — slightly detuned pairs
    this._osc('sawtooth', 36.71, this.droneGain, 0.20, -6)   // D1
    this._osc('sawtooth', 36.71, this.droneGain, 0.20, 7)
    this._osc('sine', 73.42, this.droneGain, 0.30)           // D2
    this._osc('sine', 110.0, this.droneGain, 0.10, 4)        // A2
    this._osc('triangle', 146.83, this.droneGain, 0.05, -5)  // D3

    // slow breathing of the filter
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05
    const lfoG = ctx.createGain()
    lfoG.gain.value = 90
    lfo.connect(lfoG)
    lfoG.connect(lp.frequency)
    lfo.start()
  }

  _buildBreath() {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 340
    bp.Q.value = 0.4
    this.breathGain = ctx.createGain()
    this.breathGain.gain.value = 0.05
    src.connect(bp)
    bp.connect(this.breathGain)
    this.breathGain.connect(this.master)
    src.start()
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const g = ctx.createGain()
    g.gain.value = 0.028
    lfo.connect(g)
    g.connect(this.breathGain.gain)
    lfo.start()
  }

  _buildChoir() {
    // a far-away choir: harmonic sines with slow vibrato, heavy reverb
    const ctx = this.ctx
    this.choirGain = ctx.createGain()
    this.choirGain.gain.value = 0
    this.choirGain.connect(this.verb)
    this.choirGain.connect(this.master)
    const freqs = [220, 293.66, 440, 587.33]
    freqs.forEach((f, i) => {
      const { o } = this._osc('sine', f, this.choirGain, 0.05 - i * 0.008, (i - 1.5) * 8)
      const vib = ctx.createOscillator()
      vib.frequency.value = 0.12 + i * 0.07
      const vg = ctx.createGain()
      vg.gain.value = f * 0.004
      vib.connect(vg)
      vg.connect(o.frequency)
      vib.start()
    })
  }

  _buildSub() {
    const ctx = this.ctx
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0
    this.subGain.connect(this.master)
    this._osc('sine', 27.5, this.subGain, 0.6)
    const tremor = ctx.createOscillator()
    tremor.frequency.value = 0.9
    const tg = ctx.createGain()
    tg.gain.value = 0.18
    tremor.connect(tg)
    tg.connect(this.subGain.gain)
    tremor.start()
  }

  // one turning page: a short shaped noise burst with flutter
  pageTurn(vol = 0.1) {
    if (!this.started || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 0.8 + Math.random() * 0.7
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(900 + Math.random() * 1800, t)
    bp.frequency.exponentialRampToValueAtTime(500 + Math.random() * 400, t + 0.25)
    bp.Q.value = 1.1
    const g = ctx.createGain()
    const dur = 0.14 + Math.random() * 0.22
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp); bp.connect(g); g.connect(this.master); g.connect(this.verb)
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.05)
  }

  // a whisper: formant-swept noise, barely audible
  whisper() {
    if (!this.started || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 0.5
    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'; f1.Q.value = 9
    const f2 = ctx.createBiquadFilter()
    f2.type = 'bandpass'; f2.Q.value = 12
    const dur = 0.9 + Math.random() * 1.4
    // sweep through vowel-ish formants
    f1.frequency.setValueAtTime(400 + Math.random() * 300, t)
    f1.frequency.linearRampToValueAtTime(600 + Math.random() * 500, t + dur)
    f2.frequency.setValueAtTime(1400 + Math.random() * 800, t)
    f2.frequency.linearRampToValueAtTime(1000 + Math.random() * 900, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, t + dur * 0.3)
    g.gain.linearRampToValueAtTime(0, t + dur)
    src.connect(f1); f1.connect(f2); f2.connect(g)
    g.connect(this.verb); g.connect(this.master)
    src.start(t, Math.random() * 1.8)
    src.stop(t + dur + 0.1)
  }

  // low wooden knock — an ember collapsing, a shelf settling
  knock() {
    if (!this.started || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120 + Math.random() * 80, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.14, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    o.connect(g); g.connect(this.master); g.connect(this.verb)
    o.start(t); o.stop(t + 0.5)
  }

  _loops() {
    const tick = () => {
      if (!this.started) return
      const off = this._offset ?? 0
      // pages turn more in the storm and the archive
      const storm = off < 0.09 ? 1.5 : 1
      if (Math.random() < 0.5 * storm) this.pageTurn(0.03 + Math.random() * 0.06)
      // whispers live with the philosophers, memories, the forbidden wing
      const wWeight = Math.max(
        regionWeight(off, 2), regionWeight(off, 5), regionWeight(off, 6))
      if (Math.random() < wWeight * 0.65) this.whisper()
      if (Math.random() < regionWeight(off, 6) * 0.3) this.knock()
      this._timer = setTimeout(tick, 700 + Math.random() * 1800)
    }
    tick()
  }

  // called every frame with the journey offset
  update(offset) {
    if (!this.started) return
    this._offset = offset
    const t = this.ctx.currentTime
    const choir = Math.max(regionWeight(offset, 2), regionWeight(offset, 5) * 0.5,
      regionWeight(offset, N_SEG) * 0.8)
    const sub = regionWeight(offset, 6)
    const sci = regionWeight(offset, 3)
    this.choirGain.gain.setTargetAtTime(choir * 0.5, t, 0.8)
    this.subGain.gain.setTargetAtTime(sub * 0.35, t, 0.8)
    // brighter, thinner drone inside the scientific vault
    this.droneFilter.frequency.setTargetAtTime(220 + sci * 500, t, 0.9)
    this.verbGain.gain.setTargetAtTime(0.35 + choir * 0.4, t, 1.2)
  }

  toggleMute() {
    if (!this.started) return false
    this.muted = !this.muted
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.3)
    return this.muted
  }
}

export const audio = new AudioEngine()
