/* =========================================================================
   THE CITY — entry point
   Wires together world, air, lens, light, post, and the band.
   ========================================================================= */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

import { City } from "./city.js";
import { Atmosphere } from "./atmosphere.js";
import { Life } from "./life.js";
import { ClubInterior } from "./interior.js";
import { TheaterInterior } from "./theater_interior.js";
import { CameraDirector } from "./camera.js";
import { JazzEngine } from "./audio/jazz.js";

const canvas = document.getElementById("scene");
const $ = (id) => document.getElementById(id);

// ---- renderer ----------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Shadows are nearly invisible in this emissive, fog-bound night, and a
// shadow pass would re-render every tower a second time. We sculpt with
// directional shading + emissive + bloom instead, and keep the budget for
// the wet-street reflection, which earns its cost.
renderer.shadowMap.enabled = false;

// quality tier: phones get a lighter city so it still glides.
const LOW = matchMedia("(max-width: 820px), (pointer: coarse)").matches;

// ---- scene + fog -------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080e);
// two-layer atmosphere: exponential haze + colour
scene.fog = new THREE.FogExp2(0x0a0e16, 0.0016);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 6000);
camera.position.set(0, 6, 820);

// ---- lighting: light only to sculpt -----------------------------------
// a very low ambient so shadows stay deep
scene.add(new THREE.AmbientLight(0x223044, 0.25));
// the "moon": a cold key from high and behind, raking the stone
const moon = new THREE.DirectionalLight(0x6f86b8, 0.9);
moon.position.set(-300, 600, 400);
scene.add(moon);
// a warm sodium glow rising from the streets (the city's own light)
const cityGlow = new THREE.HemisphereLight(0x2a1c0a, 0x000000, 0.5);
scene.add(cityGlow);
// a single warm lantern that travels with the viewer, giving nearby stone
// and the wet street real falloff without paying for dozens of lights.
const lantern = new THREE.PointLight(0xffb368, 60, 130, 2.0);
scene.add(lantern);

// ---- world -------------------------------------------------------------
const city = new City(scene, LOW).build();
const atmosphere = new Atmosphere(scene, LOW);
const life = new Life(scene, LOW);
const interior = new ClubInterior(scene);
const theater = new TheaterInterior(scene);

// ---- wet street mirror -------------------------------------------------
// a real reflector for the rain-slicked avenue, dimmed and tinted noir.
const reflRes = LOW ? 384 : 768;
const mirror = new Reflector(new THREE.PlaneGeometry(1600, 2600), {
  clipBias: 0.003,
  textureWidth: reflRes,
  textureHeight: reflRes,
  color: 0x0c1018,
});
mirror.rotation.x = -Math.PI / 2;
mirror.position.y = 0.02;
mirror.position.z = -200;
scene.add(mirror);

// ---- camera director ---------------------------------------------------
const director = new CameraDirector(camera, canvas);
director.interior = interior;
// honour reduced-motion: gentler drift, calmer lens
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  director.speed *= 0.45;
  director.calm = true;
}

// ---- post processing ---------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.75, 0.72);
composer.addPass(bloom);

// noir colour grade: teal shadows, amber highlights, vignette, grain,
// subtle chromatic aberration at the edges.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1.15 },
    uAberration: { value: 0.0016 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uAberration;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d,d);
      // chromatic aberration grows toward the edges
      float a = uAberration * (0.4 + r2*2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d*a).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d*a).b;
      // split-tone: push shadows teal, highlights amber
      float l = dot(col, vec3(0.299,0.587,0.114));
      vec3 shadowTint = vec3(0.16,0.42,0.46);
      vec3 highTint   = vec3(1.0,0.78,0.45);
      vec3 graded = mix(col*shadowTint*1.6, col*highTint, smoothstep(0.15,0.8,l));
      col = mix(col, graded, 0.55);
      // vignette
      float vig = smoothstep(0.9, 0.18, r2*uVignette);
      col *= mix(0.35, 1.0, vig);
      // faint moving grain
      float g = hash(uv*vec2(1920.0,1080.0)+uTime)*0.038 - 0.019;
      col += g;
      // gentle filmic lift in the blacks so darkness has texture
      col = max(col, vec3(0.004,0.006,0.01));
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());

// ---- audio -------------------------------------------------------------
const band = new JazzEngine();

// ---- HUD wiring --------------------------------------------------------
const hud = $("hud");
const placeEl = $("place");
const trackEl = $("track");
const clockEl = $("clock");

function fmtClock(t) {
  // a slow noir clock: always somewhere after midnight
  const mins = (Math.floor(t * 12) + 12 * 60 + 137) % (24 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  const hh = ((h + 11) % 12 + 1);
  return `${hh}:${m.toString().padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const promptEl = $("prompt");
let lastPlace = "";
let nearClub = false;
let canEnterClub = false;
let activeVenue = null;
function updateHud(time) {
  const place = director.inClub ? director.stationName
    : (nearClub ? "THE BLUE NOTE" : director.stationName);
  if (place !== lastPlace) {
    lastPlace = place;
    placeEl.style.opacity = "0";
    setTimeout(() => { placeEl.textContent = place; placeEl.style.opacity = "1"; }, 600);
  }
  clockEl.textContent = fmtClock(time);
  trackEl.textContent = band.muted
    ? "SILENCE"
    : ((nearClub || director.inClub) ? `INSIDE · ${band.currentChordName}` : `THE BAND · ${band.currentChordName}`);
  // the doorway prompt
  if (promptEl) {
    if (canEnterClub && activeVenue) promptEl.textContent = `[ E ]  STEP INSIDE · ${activeVenue.name}`;
    else if (director.mode === "interior") promptEl.textContent = "[ E ]  BACK TO THE STREET";
    else promptEl.textContent = "";
    promptEl.style.opacity = (canEnterClub || director.mode === "interior") ? "1" : "0";
  }
}

// ---- the overture gate -------------------------------------------------
const gate = $("gate");
const enterBtn = $("enter");
const loadbar = $("loadbar").querySelector("i");

// a brief faux-load so the first frames render warm
let loaded = 0;
const loadTick = setInterval(() => {
  loaded = Math.min(100, loaded + Math.random() * 22);
  loadbar.style.width = loaded + "%";
  if (loaded >= 100) clearInterval(loadTick);
}, 180);

let entered = false;
function enter() {
  if (entered) return;
  entered = true;
  enterBtn.classList.add("is-loading");
  // open the door immediately; let the band warm up without blocking the city
  gate.classList.add("is-hidden");
  hud.classList.add("is-live");
  hud.setAttribute("aria-hidden", "false");
  director.startIntro();   // play the establishing shot before the rail
  band.start().catch(() => { /* audio may be blocked; the city stays silent */ });
}
enterBtn.addEventListener("click", enter);

// ---- global keys -------------------------------------------------------
addEventListener("keydown", (e) => {
  if (!entered) return;
  if (e.code === "KeyM") band.toggleMute();
  if (e.code === "KeyE") {
    if (director.mode === "interior") director.exitClub();
    else if (canEnterClub && activeVenue) { director.interior = activeVenue; director.enterClub(); }
    return;
  }
  // C only toggles the walk-cam out in the city, not during the club visit
  if (e.code === "KeyC" && !director.inClub) director.toggleMode();
});
// clicking the canvas in manual mode re-locks the pointer
canvas.addEventListener("click", () => {
  if (!entered) return;
  // tap to step in/out of a venue (touch-friendly), else relock the walk-cam
  if (director.mode === "interior") { director.exitClub(); return; }
  if (canEnterClub && activeVenue) { director.interior = activeVenue; director.enterClub(); return; }
  if (director.mode === "manual") canvas.requestPointerLock?.();
});

// ---- resize ------------------------------------------------------------
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});

// ---- the loop ----------------------------------------------------------
const clock = new THREE.Clock();
let frame = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;

  const intensity = director.update(dt, time);

  // proximity to the hidden jazz club: the closer you stand, the louder and
  // more present the band — and inside, it's all around you.
  // the jazz band swells as you near the club (and fills the room inside)
  let prox;
  if (director.inClub) {
    prox = 1; nearClub = true;
  } else {
    const dClub = camera.position.distanceTo(city.clubPos);
    prox = Math.max(0, Math.min(1, 1 - (dClub - 30) / 220));
    nearClub = prox > 0.45;
  }
  band.setProximity(prox);
  band.setIntensity(Math.max(intensity, prox * 0.85));
  if (city.clubGlow) city.clubGlow.material.opacity = 0.55 + 0.3 * Math.sin(time * 2) + prox * 0.4;

  // pick the nearest doorway you could step into (the club or the theater)
  if (!director.inClub) {
    const dC = camera.position.distanceTo(interior.doorPos);
    const dT = camera.position.distanceTo(theater.doorPos);
    if (dT <= dC && dT < 60) { activeVenue = theater; canEnterClub = true; }
    else if (dC < 60) { activeVenue = interior; canEnterClub = true; }
    else { activeVenue = null; canEnterClub = false; }
  } else { canEnterClub = false; }

  city.update(time);
  interior.update(dt, time);
  theater.update(dt, time);
  atmosphere.update(dt, time, camera);
  life.update(dt, camera);
  // underground, hide the rain and the street mirror (saves a full pass)
  if (atmosphere.rain) atmosphere.rain.visible = !director.inClub;
  mirror.visible = !director.inClub;

  // the travelling lantern hangs just above and ahead of the viewer
  lantern.position.set(camera.position.x, camera.position.y + 6, camera.position.z);

  // bloom breathes a little with the music's intensity
  bloom.strength = 0.62 + intensity * 0.4 + Math.sin(time * 0.6) * 0.04;
  gradePass.uniforms.uTime.value = time;

  // keep the mirror following the camera down the avenue (cheap, big payoff)
  mirror.position.z = camera.position.z - 200;

  composer.render();

  if (entered && (frame++ % 6 === 0)) updateHud(time);
}
tick();

// expose for debugging in the console
window.__city = { scene, camera, city, band, director, renderer, composer, life, atmosphere, interior, theater };
