/* =========================================================================
   ATMOSPHERE FX — a single 2D canvas that sits over every scene
   -------------------------------------------------------------------------
   Reuses the old atmosphere ideas (rain, fog, searchlights, smoke) but as
   cheap, vector canvas layers instead of 3D. The director crossfades these
   parameters per scene, so the air itself dissolves between environments.
   ========================================================================= */

const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

const DEFAULTS = {
  rain: 0, fog: 0, beams: 0, smoke: 0, embers: 0,
  wind: 0.25, tint: [10, 14, 22], fogTint: [60, 80, 110],
};

export class AtmosphereFX {
  constructor(canvas) {
    this.c = canvas;
    this.x = canvas.getContext("2d");
    this.p = { ...DEFAULTS };          // live params
    this.target = { ...DEFAULTS };     // params we glide toward
    this._fade = 0.8;                  // seconds to reach a new target
    this.t = 0;
    this._initPools();
    this._resize();
    addEventListener("resize", () => this._resize());
  }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth; this.h = innerHeight;
    this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.c.style.width = this.w + "px"; this.c.style.height = this.h + "px";
    this.x.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _initPools() {
    this.drops = Array.from({ length: 700 }, () => this._newDrop(true));
    this.fogs = Array.from({ length: 14 }, () => ({
      x: rnd(0, 1), y: rnd(0.3, 1), r: rnd(0.25, 0.7), v: rnd(-0.01, 0.01),
      a: rnd(0.3, 1),
    }));
    this.smokeP = Array.from({ length: 90 }, () => this._newSmoke());
    this.emberP = Array.from({ length: 80 }, () => this._newEmber());
    this.beams = [
      { x: 0.3, sweep: 0.22, phase: 0, len: 1.4, spread: 0.05 },
      { x: 0.7, sweep: -0.17, phase: 2.1, len: 1.3, spread: 0.06 },
      { x: 0.5, sweep: 0.13, phase: 4.0, len: 1.5, spread: 0.045 },
    ];
  }

  _newDrop(seed) {
    return {
      x: Math.random(), y: seed ? Math.random() : -0.05,
      len: rnd(0.02, 0.06), spd: rnd(0.9, 1.7), w: rnd(0.6, 1.4),
    };
  }
  _newSmoke() {
    return { x: rnd(0.2, 0.8), y: rnd(0.6, 1.1), r: rnd(0.05, 0.18),
      vy: rnd(0.01, 0.03), drift: rnd(-0.01, 0.01), a: rnd(0.04, 0.12), life: rnd(0, 1) };
  }
  _newEmber() {
    return { x: Math.random(), y: rnd(0, 1), r: rnd(0.4, 1.6), vy: rnd(-0.02, -0.005),
      drift: rnd(-0.01, 0.01), tw: rnd(0, 6.28) };
  }

  // set new atmosphere; never snaps — it glides over `fade` seconds
  set(params, fade = 1.2) {
    this._fade = Math.max(0.001, fade);
    Object.assign(this.target, params);
  }

  update(dt, t) {
    this.t = t;
    const k = Math.min(1, dt / this._fade);
    for (const key of ["rain", "fog", "beams", "smoke", "embers", "wind"]) {
      this.p[key] = lerp(this.p[key], this.target[key], k);
    }
    for (let i = 0; i < 3; i++) {
      this.p.tint[i] = lerp(this.p.tint[i], this.target.tint[i], k);
      this.p.fogTint[i] = lerp(this.p.fogTint[i], this.target.fogTint[i], k);
    }
  }

  render() {
    const { x, w, h, p, t } = this;
    x.clearRect(0, 0, w, h);

    // ---- fog: drifting soft blobs ----
    if (p.fog > 0.01) {
      x.globalCompositeOperation = "source-over";
      const [fr, fg, fb] = p.fogTint;
      for (const f of this.fogs) {
        f.x += f.v * 0.02; if (f.x > 1.1) f.x = -0.1; if (f.x < -0.1) f.x = 1.1;
        const cx = f.x * w, cy = f.y * h, r = f.r * w;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        const a = p.fog * f.a * 0.16;
        g.addColorStop(0, `rgba(${fr|0},${fg|0},${fb|0},${a})`);
        g.addColorStop(1, `rgba(${fr|0},${fg|0},${fb|0},0)`);
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill();
      }
    }

    // ---- searchlight beams (additive) ----
    if (p.beams > 0.01) {
      x.globalCompositeOperation = "lighter";
      for (const b of this.beams) {
        const ang = Math.sin(t * b.sweep + b.phase) * 0.5 - Math.PI / 2;
        const ox = b.x * w, oy = h * 1.05;
        const L = b.len * h;
        const a1 = ang - b.spread, a2 = ang + b.spread;
        const g = x.createLinearGradient(ox, oy, ox + Math.cos(ang) * L, oy + Math.sin(ang) * L);
        g.addColorStop(0, `rgba(190,210,235,${0.10 * p.beams})`);
        g.addColorStop(1, "rgba(190,210,235,0)");
        x.fillStyle = g;
        x.beginPath(); x.moveTo(ox, oy);
        x.lineTo(ox + Math.cos(a1) * L, oy + Math.sin(a1) * L);
        x.lineTo(ox + Math.cos(a2) * L, oy + Math.sin(a2) * L);
        x.closePath(); x.fill();
      }
    }

    // ---- smoke (additive, lazy) ----
    if (p.smoke > 0.01) {
      x.globalCompositeOperation = "lighter";
      for (const s of this.smokeP) {
        s.y -= s.vy * 0.01; s.x += s.drift * 0.01; s.life += 0.003;
        if (s.y < 0.2 || s.life > 1) Object.assign(s, this._newSmoke());
        const cx = s.x * w, cy = s.y * h, r = s.r * w;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        const a = p.smoke * s.a * Math.sin(Math.min(1, s.life) * Math.PI);
        g.addColorStop(0, `rgba(200,200,210,${a})`);
        g.addColorStop(1, "rgba(200,200,210,0)");
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill();
      }
    }

    // ---- embers / dust motes (additive) ----
    if (p.embers > 0.01) {
      x.globalCompositeOperation = "lighter";
      for (const e of this.emberP) {
        e.y += e.vy * 0.01; e.x += e.drift * 0.005; e.tw += 0.05;
        if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
        const a = p.embers * (0.4 + 0.6 * Math.abs(Math.sin(e.tw))) * 0.5;
        x.fillStyle = `rgba(255,200,130,${a})`;
        x.beginPath(); x.arc(e.x * w, e.y * h, e.r, 0, 6.2832); x.fill();
      }
    }

    // ---- rain (normal) ----
    if (p.rain > 0.01) {
      x.globalCompositeOperation = "source-over";
      x.lineCap = "round";
      const n = Math.floor(this.drops.length * p.rain);
      const wind = p.wind;
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        d.y += d.spd * 0.02; d.x += wind * 0.004;
        if (d.y > 1.05) { Object.assign(d, this._newDrop(false)); }
        const px = d.x * w, py = d.y * h;
        x.strokeStyle = `rgba(170,190,215,${0.28 * p.rain})`;
        x.lineWidth = d.w;
        x.beginPath(); x.moveTo(px, py);
        x.lineTo(px + wind * 18, py + d.len * h); x.stroke();
      }
    }

    // ---- vignette + faint tint (always) ----
    x.globalCompositeOperation = "source-over";
    const [tr, tg, tb] = p.tint;
    const vg = x.createRadialGradient(w / 2, h * 0.46, h * 0.2, w / 2, h * 0.5, h * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(${tr|0},${tg|0},${tb|0},0.72)`);
    x.fillStyle = vg; x.fillRect(0, 0, w, h);
  }
}
