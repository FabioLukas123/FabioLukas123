/* =========================================================================
   THE PROJECTIONIST — runs the reel
   -------------------------------------------------------------------------
   Plays the scenes like an animated film: each transition is a slow cross-
   dissolve, the AtmosphereFX air glides to the new scene, and the band
   re-voices to the scene's mood. Auto-advances, but the visitor can step
   with ← / → / space, or let it run.
   ========================================================================= */
import { SCENES } from "./scenes.js";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export class Director {
  constructor({ stage, fx, band, hud }) {
    this.stage = stage;
    this.fx = fx;
    this.band = band;
    this.hud = hud;
    this.i = -1;
    this.cur = null;           // { host, scene }
    this._timer = null;
    this._fade = 1800;         // crossfade ms
    this.mx = 0; this.my = 0;
    this.paused = false;
    this._t0 = 0;              // scene start time
    this._dur = 9999;
    addEventListener("mousemove", (e) => {
      this.mx = (e.clientX / innerWidth - 0.5) * 2;
      this.my = (e.clientY / innerHeight - 0.5) * 2;
    });
    addEventListener("keydown", (e) => {
      if (e.code === "ArrowRight" || e.code === "Space") { e.preventDefault(); this.next(true); }
      if (e.code === "ArrowLeft") this.prev();
    });
  }

  start() { this.go(0); this._loop(); }

  go(index, manual) {
    index = Math.max(0, Math.min(SCENES.length - 1, index));
    if (index === this.i) return;
    const scene = SCENES[index];
    this.i = index;

    // build the new scene host
    const host = document.createElement("div");
    host.className = "scene";
    scene.build(host);
    host.style.opacity = "0";
    this.stage.appendChild(host);
    // force reflow then fade in
    void host.offsetWidth;
    host.style.transition = `opacity ${this._fade}ms ease`;
    host.style.opacity = "1";

    // the air and the band dissolve with the picture
    this.fx.set(scene.fx, this._fade / 1000 + 0.6);
    this.band.setMood(scene.mood);

    // retire the old scene
    const old = this.cur;
    if (old) {
      old.host.style.transition = `opacity ${this._fade}ms ease`;
      old.host.style.opacity = "0";
      setTimeout(() => old.host.remove(), this._fade + 60);
    }
    this.cur = { host, scene };

    // HUD chapter label
    if (this.hud.chapter) {
      this.hud.chapter.textContent = `${ROMAN[index]} · ${scene.title}`;
    }

    // schedule the next reel
    this._t0 = performance.now();
    this._dur = scene.dur;
    clearTimeout(this._timer);
    if (index < SCENES.length - 1) {
      this._timer = setTimeout(() => { if (!this.paused) this.next(); }, scene.dur);
    }
  }

  next(manual) {
    if (this.i < SCENES.length - 1) this.go(this.i + 1, manual);
  }
  prev() { if (this.i > 0) this.go(this.i - 1, true); }

  _loop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      // atmosphere
      this.fx.update(dt, t);
      this.fx.render();
      // parallax on the current scene's depth layers
      if (this.cur) {
        const layers = this.cur.host.querySelectorAll(".layer");
        layers.forEach((l) => {
          const d = parseFloat(l.dataset.depth || "0");
          const px = -this.mx * d * 26, py = -this.my * d * 14;
          l.style.transform = `translate(${px}px, ${py}px) scale(${1 + d * 0.06})`;
        });
      }
      // progress bar
      if (this.hud.bar) {
        const p = Math.min(1, (now - this._t0) / this._dur);
        this.hud.bar.style.transform = `scaleX(${p})`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
