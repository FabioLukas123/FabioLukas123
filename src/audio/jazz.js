/* =========================================================================
   THE BAND — a generative noir-jazz engine (Web Audio, no samples)
   -------------------------------------------------------------------------
   Music as an architectural layer. A small combo plays forever:
     · upright bass walking quarter notes
     · brushed swing drums (ride + snare brush + soft kick)
     · piano comping minor/maj7/9 voicings through ii-V-I noir cells
     · a muted trumpet that improvises sparse melodic phrases
   The harmony wanders through related keys so nothing ever obviously loops.
   Intensity rises as the listener hurries / climbs.
   ========================================================================= */

const A4 = 440;
// note name -> midi
const NAMES = { C:0, "C#":1, Db:1, D:2, "D#":3, Eb:3, E:4, F:5, "F#":6, Gb:6,
                G:7, "G#":8, Ab:8, A:9, "A#":10, Bb:10, B:11 };

function midi(name, octave){ return NAMES[name] + (octave + 1) * 12; }
function mtof(m){ return A4 * Math.pow(2, (m - 69) / 12); }
const choose = (a) => a[(Math.random() * a.length) | 0];

// Chord shapes as semitone offsets from a root (rich, rootless-ish jazz colours)
const SHAPES = {
  min9:   [0, 3, 7, 10, 14],
  maj9:   [0, 4, 7, 11, 14],
  dom13:  [0, 4, 10, 14, 21],
  m7b5:   [0, 3, 6, 10],
  dim7:   [0, 3, 6, 9],
  min7:   [0, 3, 7, 10],
  maj7:   [0, 4, 7, 11],
};

// A library of noir "cells" (ii–V–i and chromatic turns), each: [rootName, shape, beats]
const CELLS = [
  [["D","m7b5"],["G","dom13"],["C","min9"]],        // ii–V–i in Cm
  [["A","min7"],["D","dom13"],["G","maj9"]],         // ii–V–I in G
  [["E","m7b5"],["A","dom13"],["D","min9"]],         // ii–V–i in Dm
  [["F","min9"],["Bb","dom13"],["Eb","maj9"]],       // ii–V–I in Eb
  [["C","min9"],["Ab","maj7"],["G","dom13"]],        // i–bVI–V vamp
  [["B","m7b5"],["E","dom13"],["A","min9"]],         // ii–V–i in Am
  [["C","min9"],["F","min9"]],                       // modal drift
  [["D","min9"],["G","dom13"]],                      // open vamp
];

export class JazzEngine {
  constructor(){
    this.ctx = null;
    this.master = null;
    this.started = false;
    this.muted = false;
    this.intensity = 0.0;        // 0..1, driven by the camera/exploration
    this._intensityTarget = 0.0;
    this.bpm = 78;               // slow, smoky
    this.swing = 0.62;           // ratio of first eighth in the pair
    this._beat = 0;
    this._barsInCell = 0;
    this._cell = null;
    this._cellIndex = 0;
    this._chord = null;
    this._nextNoteTime = 0;
    this._timer = null;
    this._convolver = null;
    this.currentChordName = "—";
  }

  async start(){
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    // long, smoky cathedral reverb so the combo sounds like it's in a hall
    this._convolver = this.ctx.createConvolver();
    this._convolver.buffer = this._impulse(3.4, 2.6);
    const wet = this.ctx.createGain(); wet.gain.value = 0.34;
    const dry = this.ctx.createGain(); dry.gain.value = 0.85;

    // gentle bus compression-ish: soft clip via waveshaper into master
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._softCurve();
    shaper.oversample = "4x";

    this.busDry = dry; this.busWet = wet;
    dry.connect(shaper); this._convolver.connect(wet); wet.connect(shaper);
    shaper.connect(this.master);
    this.master.connect(this.ctx.destination);

    // fade the band in like a door opening on a club
    this.master.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.master.gain.exponentialRampToValueAtTime(0.9, this.ctx.currentTime + 6);

    this.started = true;
    this._nextNoteTime = this.ctx.currentTime + 0.2;
    this._advanceCell();
    this._loop();
  }

  setIntensity(v){ this._intensityTarget = Math.max(0, Math.min(1, v)); }

  toggleMute(){
    this.muted = !this.muted;
    if (!this.ctx) return this.muted;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.9, t, 0.4);
    return this.muted;
  }

  // ---- scheduler ---------------------------------------------------------
  _loop(){
    if (!this.started) return;
    const lookahead = 0.1;
    while (this._nextNoteTime < this.ctx.currentTime + lookahead){
      this._scheduleBeat(this._beat, this._nextNoteTime);
      this._advanceTime();
    }
    this._timer = setTimeout(() => this._loop(), 25);
  }

  _advanceTime(){
    // smooth intensity glide
    this.intensity += (this._intensityTarget - this.intensity) * 0.04;
    // swing: the beat is split into two eighths; we schedule per eighth.
    const beatDur = 60 / this.bpm;
    const isDownEighth = (this._beat % 1) === 0;
    const half = isDownEighth ? beatDur * this.swing : beatDur * (1 - this.swing);
    this._nextNoteTime += half;
    this._beat += 0.5;

    if (this._beat % 4 === 0){
      this._barsInCell++;
      this._chord = this._nextChordInCell();
      if (this._barsInCell >= this._cellLength){ this._advanceCell(); }
    }
  }

  _advanceCell(){
    // occasionally modulate by picking a fresh cell; bias toward smooth motion
    this._cell = choose(CELLS);
    this._cellLength = this._cell.length;
    this._barsInCell = 0;
    this._cellPos = 0;
    this._chord = this._nextChordInCell(true);
  }

  _nextChordInCell(first){
    if (!first) this._cellPos = (this._cellPos + 1) % this._cell.length;
    const [root, shape] = this._cell[this._cellPos];
    this.currentChordName = `${root} ${shape}`;
    return { root, shape };
  }

  _scheduleBeat(beat, t){
    const whole = Math.floor(beat);
    const onBeat = (beat % 1) === 0;
    const I = this.intensity;

    // --- ride cymbal: classic swing pattern (ding, ding-da) ---
    if (onBeat){
      this._ride(t, 0.10 + 0.06 * I);
    } else if (whole % 2 === 1){ // the "da" of beats 2 & 4 area
      this._ride(t, 0.05 + 0.04 * I);
    }

    // --- brush snare on 2 and 4 (back-beat, soft) ---
    if (onBeat && (whole % 4 === 1 || whole % 4 === 3)){
      this._brush(t, 0.16 + 0.10 * I);
    }
    // --- soft kick: feathered on 1, ghost on 3 when busier ---
    if (onBeat && whole % 4 === 0) this._kick(t, 0.18 + 0.12 * I);
    if (onBeat && whole % 4 === 2 && I > 0.5) this._kick(t, 0.08);

    // --- walking bass: a note every beat ---
    if (onBeat && this._chord){
      this._bass(t, this._walk(whole));
    }

    // --- piano comping: stab on off-beats, sparse ---
    if (this._chord && !onBeat && (whole % 2 === 0) && Math.random() < 0.55 + 0.3 * I){
      this._comp(t, this._chord);
    }
    // occasional anticipation stab right before the bar
    if (this._chord && onBeat && whole % 4 === 0 && Math.random() < 0.4){
      this._comp(t, this._chord, 0.7);
    }

    // --- muted trumpet: sparse melodic phrases, more frequent with intensity ---
    if (onBeat && this._chord && Math.random() < (0.04 + 0.16 * I)){
      this._melody(t, this._chord);
    }
  }

  // ---- bass line state ---------------------------------------------------
  _walk(whole){
    if (!this._lastBass) this._lastBass = midi(this._chord.root, 2);
    const rootM = midi(this._chord.root, 2);
    const scale = SHAPES[this._chord.shape] || SHAPES.min7;
    const targets = scale.map(s => rootM + s);
    targets.push(rootM, rootM + 12);
    // prefer stepwise motion toward a chord tone
    let best = targets[0], bestD = 99;
    for (const cand of targets){
      const d = Math.abs(cand - this._lastBass) + (Math.random() * 3);
      if (d < bestD){ bestD = d; best = cand; }
    }
    // chromatic approach 25% of the time
    if (Math.random() < 0.25) best = this._lastBass + (Math.random() < 0.5 ? 1 : -1);
    best = Math.max(midi("E",1), Math.min(midi("G",3), best));
    this._lastBass = best;
    return best;
  }

  // ===== instrument voices =================================================
  _ride(t, gain){
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 6500;
    o.type = "square"; o2.type = "square";
    o.frequency.value = 7200 + Math.random() * 600;
    o2.frequency.value = 9300 + Math.random() * 800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); o2.connect(g); g.connect(hp);
    hp.connect(this.busDry); hp.connect(this._convolver);
    o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4);
  }

  _brush(t, gain){
    const noise = this._noiseSource(0.22);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    noise.connect(bp); bp.connect(g);
    g.connect(this.busDry); g.connect(this._convolver);
    noise.start(t);
  }

  _kick(t, gain){
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.busDry);
    o.start(t); o.stop(t + 0.25);
  }

  _bass(t, m){
    const f = mtof(m);
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 700; lp.Q.value = 1;
    o.type = "triangle"; o2.type = "sawtooth";
    o.frequency.value = f; o2.frequency.value = f * 1.001;
    const beatDur = 60 / this.bpm;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.08, t + beatDur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + beatDur * 0.95);
    o.connect(lp); o2.connect(lp); lp.connect(g);
    g.connect(this.busDry); g.connect(this._convolver);
    o.start(t); o2.start(t); o.stop(t + beatDur); o2.stop(t + beatDur);
  }

  _comp(t, chord, level = 1){
    const rootM = midi(chord.root, 4);
    const shape = SHAPES[chord.shape] || SHAPES.min7;
    // rootless-ish voicing: drop the root sometimes, keep colour tones
    const voicing = shape.slice(Math.random() < 0.6 ? 1 : 0);
    const beatDur = 60 / this.bpm;
    const dur = beatDur * (0.35 + Math.random() * 0.3);
    voicing.forEach((s, i) => {
      const m = rootM + s - (s > 12 ? 0 : 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 2200;
      o.type = "triangle";
      o.frequency.value = mtof(m);
      const peak = (0.05 + 0.02 * i) * level;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g);
      g.connect(this.busDry); g.connect(this._convolver);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }

  _melody(t, chord){
    const rootM = midi(chord.root, 5);
    const shape = SHAPES[chord.shape] || SHAPES.min7;
    const scale = [...shape, ...shape.map(s => s + 12)];
    const beatDur = 60 / this.bpm;
    // a short phrase of 2–4 notes, swung
    const n = 2 + ((Math.random() * 3) | 0);
    let cur = rootM + choose(scale);
    for (let i = 0; i < n; i++){
      const when = t + i * beatDur * this.swing;
      const dur = beatDur * (0.5 + Math.random() * 0.6);
      this._mutedTone(when, mtof(cur), dur, 0.09 + 0.05 * this.intensity);
      // step to a neighbour chord tone
      const step = choose([-2, -1, 1, 2, 3]);
      cur = rootM + choose(scale) + (Math.random() < 0.4 ? step : 0);
    }
  }

  _mutedTone(t, f, dur, gain){
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f * 2.2; bp.Q.value = 4; // "harmon mute" honk
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 3200;
    o.type = "sawtooth"; o2.type = "square";
    o.frequency.value = f; o2.frequency.value = f * 0.5;
    // breathy onset
    o.detune.setValueAtTime(-25, t); o.detune.linearRampToValueAtTime(0, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.06);
    g.gain.setValueAtTime(gain, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); o2.connect(bp); bp.connect(lp); lp.connect(g);
    g.connect(this.busDry); g.connect(this._convolver);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  // ---- helpers -----------------------------------------------------------
  _noiseSource(dur){
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf; return src;
  }

  _impulse(dur, decay){
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++){
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++){
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _softCurve(){
    const n = 1024, curve = new Float32Array(n), k = 1.6;
    for (let i = 0; i < n; i++){
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }
}
