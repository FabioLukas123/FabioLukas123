/**
 * The sound of Eden — synthesized alive, every visit unrepeatable.
 * No samples, no loops of a dead recording: wind is filtered chaos,
 * water is chaos passed through a reed, the music is a slow generative
 * conversation in Lydian mode that never plays the same way twice.
 */

const ZONES = [
  { c: 0.075, w: 0.09 }, // forest
  { c: 0.23, w: 0.09 }, // gardens
  { c: 0.375, w: 0.09 }, // river
  { c: 0.525, w: 0.09 }, // giants
  { c: 0.67, w: 0.085 }, // bloom
  { c: 0.81, w: 0.085 }, // memory
  { c: 0.95, w: 0.09 }, // horizon
]
const zone = (p, i) => Math.exp(-Math.pow((p - ZONES[i].c) / ZONES[i].w, 2))

// A major-ish Lydian palette, in Hz, low to high
const SCALE = [110, 123.47, 138.59, 164.81, 185, 220, 246.94, 277.18, 329.63, 369.99, 440, 554.37, 659.25]
const CHORDS = [
  [0, 4, 7, 11], // warm
  [1, 5, 8, 12], // lifted
  [2, 4, 9, 11], // suspended
  [0, 5, 7, 12], // open
]

export class Soundscape {
  constructor() {
    this.ctx = null
    this.enabled = true
    this._t = 0
    this._nextPluck = 2
    this._nextCall = 6
    this._nextChirp = 1
  }

  start() {
    if (this.ctx) {
      this.ctx.resume()
      return
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -22
    comp.ratio.value = 6
    this.master.connect(comp)
    comp.connect(ctx.destination)

    // a cathedral of air — generated impulse reverb
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this._impulse(4.2, 2.2)
    this.reverbGain = ctx.createGain()
    this.reverbGain.gain.value = 0.5
    this.reverb.connect(this.reverbGain)
    this.reverbGain.connect(this.master)

    const noiseBuf = this._noise(6)

    // WIND — always present, the planet breathing
    this.wind = this._stem(0.15)
    const windSrc = ctx.createBufferSource()
    windSrc.buffer = noiseBuf
    windSrc.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'lowpass'
    this.windFilter.frequency.value = 420
    this.windFilter.Q.value = 0.4
    windSrc.connect(this.windFilter)
    this.windFilter.connect(this.wind.g)
    windSrc.start()
    // the gusts
    this.windLFO = ctx.createOscillator()
    this.windLFO.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 260
    this.windLFO.connect(lfoGain)
    lfoGain.connect(this.windFilter.frequency)
    this.windLFO.start()

    // WATER — chaos through a reed
    this.water = this._stem(0)
    const waterSrc = ctx.createBufferSource()
    waterSrc.buffer = noiseBuf
    waterSrc.loop = true
    waterSrc.playbackRate.value = 1.31
    const waterBP = ctx.createBiquadFilter()
    waterBP.type = 'bandpass'
    waterBP.frequency.value = 900
    waterBP.Q.value = 0.6
    const waterHP = ctx.createBiquadFilter()
    waterHP.type = 'highpass'
    waterHP.frequency.value = 300
    waterSrc.connect(waterBP)
    waterBP.connect(waterHP)
    waterHP.connect(this.water.g)
    waterSrc.start()

    // PAD — three detuned voices under a slow filter
    this.pad = this._stem(0)
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 620
    this.padFilter.connect(this.pad.g)
    this.padVoices = []
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator()
      o.type = i % 2 ? 'triangle' : 'sine'
      const g = ctx.createGain()
      g.gain.value = 0.0
      o.connect(g)
      g.connect(this.padFilter)
      o.start()
      this.padVoices.push({ o, g })
    }
    this._chord(0)

    this.ctx = ctx
  }

  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate
    const len = rate * seconds
    const buf = this.ctx.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
      }
    }
    return buf
  }

  _noise(seconds) {
    const rate = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, rate * seconds, rate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      // pink-ish: soften the hiss
      const white = Math.random() * 2 - 1
      last = last * 0.94 + white * 0.06
      d[i] = last * 6
    }
    return buf
  }

  _stem(v) {
    const g = this.ctx.createGain()
    g.gain.value = v
    g.connect(this.master)
    g.connect(this.reverb)
    return { g }
  }

  _chord(which) {
    const now = this.ctx.currentTime
    const chord = CHORDS[which % CHORDS.length]
    this.padVoices.forEach((v, i) => {
      const f = SCALE[chord[i % chord.length]] * (i > 1 ? 2 : 1)
      v.o.frequency.setTargetAtTime(f * (1 + (i - 1.5) * 0.0012), now, 4)
      v.g.gain.setTargetAtTime(0.05 + 0.012 * Math.sin(i * 2.1), now, 5)
    })
  }

  _bell(freq, vol, decay = 3.2) {
    const ctx = this.ctx
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const shimmer = ctx.createOscillator()
    shimmer.type = 'sine'
    shimmer.frequency.value = freq * 2.01
    const g = ctx.createGain()
    const g2 = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(vol, now + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
    g2.gain.value = 0.3
    o.connect(g)
    shimmer.connect(g2)
    g2.connect(g)
    g.connect(this.master)
    g.connect(this.reverb)
    o.start(now)
    shimmer.start(now)
    o.stop(now + decay + 0.1)
    shimmer.stop(now + decay + 0.1)
  }

  _call(vol) {
    // a giant, speaking across a valley
    const ctx = this.ctx
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(72, now)
    o.frequency.exponentialRampToValueAtTime(46, now + 3.4)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(vol, now + 1.2)
    g.gain.linearRampToValueAtTime(0, now + 4.4)
    o.connect(g)
    g.connect(this.master)
    g.connect(this.reverb)
    o.start(now)
    o.stop(now + 4.6)
  }

  _chirp(vol) {
    const ctx = this.ctx
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    const f = 1900 + Math.random() * 2600
    o.frequency.setValueAtTime(f, now)
    o.frequency.exponentialRampToValueAtTime(f * (1.1 + Math.random() * 0.3), now + 0.09)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(vol, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    o.connect(g)
    g.connect(this.reverb)
    o.start(now)
    o.stop(now + 0.2)
  }

  /** Called every frame with the journey state. */
  update(progress, genesis, dt) {
    if (!this.ctx || this.ctx.state !== 'running') return
    this._t += dt
    const now = this.ctx.currentTime
    const on = this.enabled ? 1 : 0
    const alive = Math.min(genesis * 1.6, 1)

    this.master.gain.setTargetAtTime(0.85 * on * alive, now, 0.8)

    const forest = zone(progress, 0)
    const gardens = zone(progress, 1)
    const river = zone(progress, 2)
    const giants = zone(progress, 3)
    const bloom = zone(progress, 4)
    const memory = zone(progress, 5)
    const horizon = zone(progress, 6)

    this.wind.g.gain.setTargetAtTime(0.1 + gardens * 0.1 + horizon * 0.12 + giants * 0.06, now, 1.5)
    this.windFilter.frequency.setTargetAtTime(380 + gardens * 320 + horizon * 260, now, 2)
    this.water.g.gain.setTargetAtTime(river * 0.11 + gardens * 0.035 + horizon * 0.05, now, 1.5)
    this.pad.g.gain.setTargetAtTime(0.5 + memory * 0.25 + horizon * 0.3, now, 2)
    this.padFilter.frequency.setTargetAtTime(500 + horizon * 700 + bloom * 300 + genesis * 120, now, 3)

    // generative events
    if (this._t > this._nextPluck) {
      this._nextPluck = this._t + 2.5 + Math.random() * 6
      const bright = bloom + gardens * 0.7 + horizon * 0.8 + forest * 0.5 + memory * 0.4
      if (bright > 0.15 && genesis > 0.5) {
        const idx = 4 + Math.floor(Math.random() * (SCALE.length - 4))
        this._bell(SCALE[idx] * 2, 0.035 * Math.min(bright, 1), memory > 0.4 ? 5.5 : 3.2)
      }
    }
    if (this._t > this._nextCall) {
      this._nextCall = this._t + 9 + Math.random() * 12
      if (giants > 0.25) this._call(0.16 * giants)
    }
    if (this._t > this._nextChirp) {
      this._nextChirp = this._t + 0.8 + Math.random() * 4
      const life = forest + bloom * 0.8
      if (life > 0.2 && genesis > 0.7 && Math.random() < 0.6) this._chirp(0.02 * life)
    }
    // the pad slowly reconsiders itself
    if (!this._chordAt || this._t - this._chordAt > 19) {
      this._chordAt = this._t
      this._chord((Math.random() * CHORDS.length) | 0)
    }
  }

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }
}

export const soundscape = new Soundscape()
