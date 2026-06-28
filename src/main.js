/* =========================================================================
   THE CITY — an interactive Dark Deco reel
   Entry point: the overture gate, then the projectionist runs the film.
   ========================================================================= */
import { AtmosphereFX } from "./fx.js";
import { JazzEngine } from "./audio/jazz.js";
import { Director } from "./director.js";

const $ = (id) => document.getElementById(id);

const gate = $("gate");
const enterBtn = $("enter");
const stage = $("stage");
const fxCanvas = $("fx");
const hud = $("hud");

const fx = new AtmosphereFX(fxCanvas);
const band = new JazzEngine();
const director = new Director({
  stage, fx, band,
  hud: { chapter: $("chapter"), bar: $("bar") },
});

let entered = false;
function enter() {
  if (entered) return;
  entered = true;
  enterBtn.classList.add("is-loading");
  gate.classList.add("is-hidden");
  hud.classList.add("is-live");
  band.start().catch(() => {});
  director.start();
}
enterBtn.addEventListener("click", enter);

// sound toggle (button + M)
const soundBtn = $("sound");
function toggleSound() {
  const muted = band.toggleMute();
  if (soundBtn) soundBtn.textContent = muted ? "SOUND ✕" : "SOUND ♪";
}
soundBtn?.addEventListener("click", toggleSound);
addEventListener("keydown", (e) => {
  if (!entered) return;
  if (e.code === "KeyM") toggleSound();
});

// a faux overture meter so the first frames settle
const loadbar = $("loadbar")?.querySelector("i");
if (loadbar) {
  let v = 0;
  const id = setInterval(() => {
    v = Math.min(100, v + Math.random() * 26);
    loadbar.style.width = v + "%";
    if (v >= 100) clearInterval(id);
  }, 200);
}

window.__film = director;
window.__band = band;
