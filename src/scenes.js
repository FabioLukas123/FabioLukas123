/* =========================================================================
   THE SCENES — a lost Batman: TAS reel, drawn in vectors
   -------------------------------------------------------------------------
   No 3D, no meshes. Each scene is layered SVG/HTML "matte painting" with
   parallax, animated windows and light. The director crossfades between them
   and the AtmosphereFX canvas adds rain / fog / beams / smoke on top.

   Each scene: { id, title, subtitle, mood, dur, fx, build(host) }
   build() fills a host <div> with absolutely-positioned layers; layers tagged
   data-depth get subtle mouse parallax from the director.
   ========================================================================= */

const NS = "http://www.w3.org/2000/svg";
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));

// ---- helpers -----------------------------------------------------------
function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
}
function layer(depth) {
  const d = el("div", "layer");
  d.dataset.depth = depth;          // 0 = static, 1 = strong parallax
  return d;
}

// a procedural Art Deco skyline as an SVG string (silhouette + lit windows)
function skyline(opts = {}) {
  const w = 1600, h = opts.h || 520;
  const fill = opts.fill || "#05070d";
  const count = opts.count || 18;
  const minH = opts.minH || 0.3, maxH = opts.maxH || 0.95;
  const lit = opts.lit !== false;
  let towers = "", windows = "";
  let x = -20;
  while (x < w + 20) {
    const bw = rnd(40, 110);
    const bh = h * rnd(minH, maxH);
    const by = h - bh;
    const steps = ri(1, 3);
    // stepped setback body
    let cw = bw, cx = x, cy = by, body = "";
    for (let s = 0; s < steps; s++) {
      const sh = (h - cy) / (steps - s) * rnd(0.6, 1);
      body += `<rect x="${cx}" y="${cy}" width="${cw}" height="${h - cy}"/>`;
      cy += sh * 0.0; // keep base; setbacks are width insets going up
      cx += cw * 0.12; cw *= 0.76; cy = by + (s + 1) * (bh / (steps + 1));
    }
    towers += `<g>${body}</g>`;
    // a spire / antenna sometimes
    if (Math.random() < 0.4) {
      const sx = x + bw / 2;
      towers += `<rect x="${sx - 1.5}" y="${by - rnd(18, 60)}" width="3" height="${rnd(18, 60)}"/>`;
    }
    // lit windows grid on the lower body
    if (lit) {
      const cols = Math.max(2, Math.floor(bw / 14));
      const rows = Math.max(3, Math.floor(bh / 16));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.5) continue;
          const wx = x + 6 + c * (bw - 10) / cols;
          const wy = by + 8 + r * (bh - 12) / rows;
          const ww = (bw - 10) / cols * 0.55;
          const wh = (bh - 12) / rows * 0.5;
          const warm = Math.random();
          const col = warm > 0.78 ? "#bfe3ff" : warm > 0.62 ? "#cdebd2" : "#ffd07a";
          const dly = (Math.random() * 8).toFixed(2);
          windows += `<rect class="win" x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${ww.toFixed(1)}" height="${wh.toFixed(1)}" fill="${col}" style="animation-delay:${dly}s"/>`;
        }
      }
    }
    x += bw + rnd(4, 26);
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice" class="sky-svg">
      <g fill="${fill}">${towers}</g><g>${windows}</g></svg>`;
}

function titleCard(title, subtitle) {
  const t = el("div", "card");
  t.innerHTML = `<div class="card__rule"></div>
    <h2 class="card__title">${title}</h2>
    <div class="card__sub">${subtitle || ""}</div>
    <div class="card__rule"></div>`;
  return t;
}

// =========================================================================
//  SCENES
// =========================================================================
export const SCENES = [

  // 1 — OPENING ----------------------------------------------------------
  { id: "opening", title: "GOTHAM", subtitle: "A CITY THAT NEVER SLEEPS, ONLY DREAMS",
    mood: "opening", dur: 15000,
    fx: { rain: 0.25, fog: 0.6, beams: 0.5, smoke: 0, embers: 0.1, wind: 0.4,
          tint: [4, 6, 12], fogTint: [40, 56, 86] },
    build(host) {
      host.style.background = "radial-gradient(120% 90% at 50% 12%, #0b0f1a 0%, #05070e 55%, #000 100%)";
      const far = layer(0.15); far.innerHTML = skyline({ h: 440, count: 22, fill: "#070a12", minH: 0.2, maxH: 0.6 });
      far.style.bottom = "0"; far.style.opacity = "0.8";
      const near = layer(0.4); near.innerHTML = skyline({ h: 560, count: 14, fill: "#03050a", minH: 0.4, maxH: 1 });
      near.style.bottom = "0";
      const moon = el("div", "moon"); moon.style.cssText = "left:72%;top:16%";
      host.append(moon, far, near, titleCard(this.title, this.subtitle));
    } },

  // 2 — GRAND ENTRANCE ---------------------------------------------------
  { id: "entrance", title: "THE WAYNE", subtitle: "MARBLE, BRASS AND OLD MONEY",
    mood: "entrance", dur: 14000,
    fx: { rain: 0.12, fog: 0.3, beams: 0.1, smoke: 0, embers: 0.15, wind: 0.2,
          tint: [8, 7, 5], fogTint: [70, 60, 50] },
    build(host) {
      host.style.background = "linear-gradient(180deg,#0a0a10 0%, #14100a 70%, #1c150c 100%)";
      const facade = layer(0.1);
      facade.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="sky-svg">
        <defs><linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#caa14a"/><stop offset="1" stop-color="#6b531f"/></linearGradient></defs>
        <g fill="#0b0c12">
          <rect x="0" y="0" width="1600" height="900"/></g>
        <g fill="url(#brass)">
          ${Array.from({length:7},(_,i)=>`<rect x="${180+i*180}" y="220" width="26" height="560"/>`).join("")}
          <rect x="120" y="190" width="1360" height="34"/>
          <polygon points="120,190 800,90 1480,190"/>
        </g>
        <g fill="#1a130a"><rect x="660" y="470" width="280" height="320"/></g>
        <rect x="660" y="470" width="280" height="320" fill="#ffcf8a" opacity="0.22"/>
      </svg>`;
      const glow = el("div", "doorglow"); glow.style.cssText = "left:50%;bottom:0;transform:translateX(-50%)";
      host.append(facade, glow, titleCard(this.title, this.subtitle));
    } },

  // 3 — LUXURY ELEVATOR --------------------------------------------------
  { id: "elevator", title: "GOING UP", subtitle: "FLOOR BY FLOOR INTO THE DARK",
    mood: "elevator", dur: 12000,
    fx: { rain: 0, fog: 0.18, beams: 0, smoke: 0.05, embers: 0.05, wind: 0,
          tint: [6, 5, 4], fogTint: [60, 50, 40] },
    build(host) {
      host.style.background = "linear-gradient(180deg,#100c07,#1b140b 50%,#0c0905)";
      const cab = layer(0.05);
      cab.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="sky-svg">
        <defs><linearGradient id="b2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e8cd86"/><stop offset="1" stop-color="#7a5e26"/></linearGradient></defs>
        <g fill="#0a0805">
          <rect x="120" y="0" width="120" height="900"/><rect x="1360" y="0" width="120" height="900"/>
          <rect x="240" y="0" width="1120" height="60"/><rect x="240" y="840" width="1120" height="60"/></g>
        <g fill="url(#b2)" opacity="0.85">
          ${Array.from({length:10},(_,i)=>`<rect x="${260+i*112}" y="60" width="10" height="780"/>`).join("")}
        </g>
        <circle cx="800" cy="150" r="64" fill="none" stroke="url(#b2)" stroke-width="6"/>
        <g class="floor-needle" style="transform-origin:800px 150px"><rect x="797" y="96" width="6" height="60" fill="#e8cd86"/></g>
      </svg>`;
      const rise = el("div", "elev-rise");   // light streaks rising past
      rise.innerHTML = Array.from({length:14},()=>`<i style="left:${rnd(8,92)}%;animation-delay:${rnd(0,3).toFixed(2)}s;animation-duration:${rnd(1.6,3.2).toFixed(2)}s"></i>`).join("");
      host.append(cab, rise, titleCard(this.title, this.subtitle));
    } },

  // 4 — JAZZ CLUB --------------------------------------------------------
  { id: "club", title: "THE BLUE NOTE", subtitle: "WHERE THE CITY KEEPS ITS SECRETS",
    mood: "club", dur: 20000,
    fx: { rain: 0, fog: 0.12, beams: 0, smoke: 0.5, embers: 0.2, wind: 0,
          tint: [6, 4, 8], fogTint: [80, 60, 90] },
    build(host) {
      host.style.background = "radial-gradient(90% 80% at 50% 70%, #1a0f16 0%, #0a060c 60%, #000 100%)";
      const stage = layer(0.12);
      stage.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="sky-svg">
        <defs><radialGradient id="sun" cx="50%" cy="40%" r="60%">
          <stop offset="0" stop-color="#ffd58a"/><stop offset="0.5" stop-color="#b9742e"/><stop offset="1" stop-color="#2a0f08"/></radialGradient></defs>
        <rect x="0" y="0" width="1600" height="900" fill="#0a060c"/>
        <g class="sunburst" style="transform-origin:800px 360px">
          ${Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return `<polygon points="800,360 ${800+Math.cos(a)*900},${360+Math.sin(a)*900} ${800+Math.cos(a+0.13)*900},${360+Math.sin(a+0.13)*900}" fill="${i%2?'#3a1d10':'#5a2c14'}"/>`}).join("")}
        </g>
        <circle cx="800" cy="360" r="150" fill="url(#sun)"/>
        <rect x="0" y="600" width="1600" height="300" fill="#08040a"/>
        <!-- band silhouettes -->
        <g fill="#000" class="band">
          <g class="sway"><ellipse cx="560" cy="600" rx="34" ry="60"/><circle cx="560" cy="528" r="22"/></g>
          <rect x="650" y="560" width="120" height="80"/>  <!-- piano -->
          <g class="sway2"><rect x="900" y="500" width="16" height="120"/><circle cx="908" cy="486" r="20"/></g> <!-- bass -->
          <g class="sway"><circle cx="1040" cy="520" r="20"/><rect x="1024" y="540" width="32" height="70"/></g> <!-- horn -->
        </g></svg>`;
      const spot = el("div", "spot"); spot.style.cssText = "left:50%;top:0;transform:translateX(-50%)";
      host.append(stage, spot, titleCard(this.title, this.subtitle));
    } },

  // 5 — LIBRARY ----------------------------------------------------------
  { id: "library", title: "THE READING ROOM", subtitle: "DUST, LEATHER AND SILENCE",
    mood: "library", dur: 14000,
    fx: { rain: 0, fog: 0.12, beams: 0, smoke: 0, embers: 0.4, wind: 0,
          tint: [6, 6, 4], fogTint: [50, 50, 40] },
    build(host) {
      host.style.background = "linear-gradient(180deg,#0c0a07,#15110b 60%,#0a0806)";
      const shelves = layer(0.1);
      let cols = "";
      for (let i = 0; i < 9; i++) {
        const x = 80 + i * 170;
        cols += `<rect x="${x}" y="120" width="150" height="700" fill="#0a0805"/>`;
        for (let r = 0; r < 9; r++) cols += `<rect x="${x+6}" y="${134+r*76}" width="138" height="60" fill="#1a120a"/>`;
        for (let r = 0; r < 9; r++) for (let b = 0; b < 12; b++)
          if (Math.random() < 0.85)
            cols += `<rect x="${x+8+b*11.3}" y="${136+r*76}" width="${rnd(6,10).toFixed(1)}" height="56" fill="hsl(${ri(20,45)},${ri(25,55)}%,${ri(12,26)}%)"/>`;
      }
      shelves.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="sky-svg">${cols}</svg>`;
      const lamp = el("div", "lamp-green"); lamp.style.cssText = "left:50%;top:46%;transform:translateX(-50%)";
      host.append(shelves, lamp, titleCard(this.title, this.subtitle));
    } },

  // 6 — OLD CINEMA -------------------------------------------------------
  { id: "cinema", title: "THE ORPHEUM", subtitle: "A FLICKER OF SOMEONE ELSE'S DREAM",
    mood: "cinema", dur: 15000,
    fx: { rain: 0, fog: 0.14, beams: 0, smoke: 0.18, embers: 0.1, wind: 0,
          tint: [4, 4, 6], fogTint: [60, 60, 80] },
    build(host) {
      host.style.background = "#020203";
      const room = layer(0.06);
      let seats = "";
      for (let r = 0; r < 6; r++) {
        const y = 560 + r * 60, s = 1 + r * 0.08;
        for (let c = 0; c < 14; c++)
          seats += `<rect x="${120 + c*108*s - r*40}" y="${y}" width="${64*s}" height="${70*s}" rx="14" fill="#05040a"/>`;
      }
      room.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="sky-svg">
        <rect x="0" y="0" width="1600" height="900" fill="#040406"/>
        <g fill="url(#br)"><rect x="360" y="120" width="880" height="20"/></g>
        <rect class="screen" x="430" y="150" width="740" height="330" fill="#cfd6e0"/>
        <g fill="#0a0a10"><rect x="360" y="120" width="70" height="380"/><rect x="1170" y="120" width="70" height="380"/></g>
        ${seats}</svg>`;
      host.append(room, titleCard(this.title, this.subtitle));
    } },

  // 7 — CLOCK TOWER ------------------------------------------------------
  { id: "clock", title: "THE CLOCK TOWER", subtitle: "TIME LEANS OVER THE CITY",
    mood: "clock", dur: 14000,
    fx: { rain: 0.2, fog: 0.4, beams: 0.2, smoke: 0, embers: 0.05, wind: 0.5,
          tint: [4, 6, 10], fogTint: [50, 64, 90] },
    build(host) {
      host.style.background = "radial-gradient(80% 80% at 50% 50%, #11151f 0%, #06080e 70%, #000 100%)";
      const tower = layer(0.08);
      tower.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="sky-svg">
        <g fill="#05070d">
          <rect x="500" y="-20" width="600" height="940"/>
          ${Array.from({length:8},(_,i)=>`<rect x="${500+i*86}" y="-20" width="10" height="940" fill="#0a0d15"/>`).join("")}
        </g>
        <circle cx="800" cy="420" r="240" fill="#0a0d16" stroke="#caa14a" stroke-width="10"/>
        <circle cx="800" cy="420" r="216" fill="#1b1c10" opacity="0.85"/>
        ${Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return `<rect x="797" y="${420-206}" width="6" height="26" fill="#caa14a" transform="rotate(${i*30} 800 420)"/>`}).join("")}
        <g class="clock-h" style="transform-origin:800px 420px"><rect x="794" y="300" width="12" height="130" fill="#e8cd86"/></g>
        <g class="clock-m" style="transform-origin:800px 420px"><rect x="796" y="250" width="8" height="180" fill="#e8cd86"/></g>
        <circle cx="800" cy="420" r="14" fill="#caa14a"/>
      </svg>`;
      const back = layer(0.3); back.innerHTML = skyline({ h: 360, fill: "#04060c", minH: 0.2, maxH: 0.5 });
      back.style.bottom = "0"; back.style.opacity = "0.5";
      host.append(back, tower, titleCard(this.title, this.subtitle));
    } },

  // 8 — ROOFTOP IN THE RAIN ---------------------------------------------
  { id: "rooftop", title: "THE LONG WATCH", subtitle: "RAIN, AND A CITY WORTH SAVING",
    mood: "rooftop", dur: 17000,
    fx: { rain: 0.95, fog: 0.5, beams: 0.45, smoke: 0, embers: 0, wind: 0.8,
          tint: [4, 7, 12], fogTint: [50, 66, 96] },
    build(host) {
      host.style.background = "radial-gradient(120% 100% at 50% 0%, #0c121e 0%, #05080f 55%, #000 100%)";
      const back = layer(0.3); back.innerHTML = skyline({ h: 520, fill: "#05080f", minH: 0.3, maxH: 0.95 });
      back.style.bottom = "8%"; back.style.opacity = "0.85";
      const moon = el("div", "moon"); moon.style.cssText = "left:18%;top:14%";
      const ledge = layer(0.02);
      ledge.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" class="sky-svg">
        <g fill="#020308"><rect x="0" y="760" width="1600" height="200"/>
          ${Array.from({length:20},(_,i)=>`<rect x="${i*84}" y="720" width="60" height="60"/>`).join("")}
          <!-- a gargoyle silhouette -->
          <path d="M1230 760 q40 -120 120 -120 q-30 40 -10 70 q60 -10 80 30 q-40 10 -50 50 q-30 -20 -60 -10 q10 -40 -80 -10 z"/>
        </g></svg>`;
      const figure = el("div", "figure"); // a lone caped silhouette
      figure.style.cssText = "left:22%;bottom:18%";
      host.append(moon, back, figure, ledge, titleCard(this.title, this.subtitle));
    } },

  // 9 — FINAL SKYLINE ----------------------------------------------------
  { id: "skyline", title: "GOTHAM", subtitle: "— END OF REEL —",
    mood: "skyline", dur: 20000,
    fx: { rain: 0.18, fog: 0.5, beams: 0.7, smoke: 0, embers: 0.12, wind: 0.4,
          tint: [4, 6, 12], fogTint: [44, 60, 92] },
    build(host) {
      host.style.background = "radial-gradient(120% 100% at 50% 8%, #0e1422 0%, #06080f 55%, #000 100%)";
      const moon = el("div", "moon big"); moon.style.cssText = "left:50%;top:12%;transform:translateX(-50%)";
      const far = layer(0.18); far.innerHTML = skyline({ h: 460, fill: "#070b14", minH: 0.25, maxH: 0.7 });
      far.style.bottom = "0"; far.style.opacity = "0.85";
      const mid = layer(0.35); mid.innerHTML = skyline({ h: 580, fill: "#04060d", minH: 0.4, maxH: 1 });
      mid.style.bottom = "0";
      const near = layer(0.6); near.innerHTML = skyline({ h: 680, fill: "#01030a", minH: 0.5, maxH: 1.1, lit: false });
      near.style.bottom = "0";
      host.append(moon, far, mid, near, titleCard(this.title, this.subtitle));
    } },
];
