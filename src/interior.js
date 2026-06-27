/* =========================================================================
   THE BLUE NOTE — the room the whole score belongs to
   -------------------------------------------------------------------------
   "Somewhere below, a band is already playing." So the club is downstairs.
   From the doorway you ride a brass elevator cab down a rung-lined shaft and
   step out into an intimate basement jazz room: a lit stage, a four-piece
   band playing in silhouette, candle-lit tables, a back bar, and smoke.
   Inside, the generative band becomes fully present — music as a place.
   ========================================================================= */
import * as THREE from "three";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (x) => x * x * (3 - 2 * x);

// the room sits underground, beneath the club's gap in the avenue wall
const ROOM = { x: -70, z: 150, floor: -56, h: 13, w: 48, d: 42 };
const CEIL = ROOM.floor + ROOM.h;                 // -43
const ZSTAGE = ROOM.z - ROOM.d / 2 + 5;           // far end
const CABX = ROOM.x, CABZ = ROOM.z + ROOM.d / 2 - 6;

export class ClubInterior {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;       // only shown while you're inside
    scene.add(this.group);
    this.figures = [];
    this.candles = [];
    this._mats();
    this._room();
    this._stageAndBand();
    this._tables();
    this._bar();
    this._shaftAndCab();
    this._lightsAndHaze();
  }

  _mats() {
    this.wood = new THREE.MeshStandardMaterial({ color: 0x1c1208, roughness: 0.35, metalness: 0.25 });
    this.wall = new THREE.MeshStandardMaterial({ color: 0x120d0a, roughness: 0.85, metalness: 0.05 });
    this.oxblood = new THREE.MeshStandardMaterial({ color: 0x2a0f12, roughness: 0.8 });
    this.brass = new THREE.MeshStandardMaterial({ color: 0x7a5f24, roughness: 0.3, metalness: 0.95, emissive: 0x1a1304, emissiveIntensity: 0.5 });
    this.figureMat = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.6, metalness: 0.2 });
    this.dark = new THREE.MeshStandardMaterial({ color: 0x0a0807, roughness: 0.9 });
  }

  _box(w, h, d, mat, x, y, z, parent = this.group) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }

  _room() {
    const { x, z, floor, w, d } = ROOM;
    // floor (faintly reflective wood) + ceiling
    this._box(w, 0.6, d, this.wood, x, floor, z);
    this._box(w, 0.6, this.dark ? d : d, this.dark, x, CEIL, z);
    // walls (oxblood with brass vertical fluting)
    this._box(w, ROOM.h, 0.8, this.oxblood, x, floor + ROOM.h / 2, z - d / 2);  // back (stage)
    this._box(w, ROOM.h, 0.8, this.wall, x, floor + ROOM.h / 2, z + d / 2);     // front
    this._box(0.8, ROOM.h, d, this.oxblood, x - w / 2, floor + ROOM.h / 2, z);  // left
    this._box(0.8, ROOM.h, d, this.oxblood, x + w / 2, floor + ROOM.h / 2, z);  // right
    // brass fluting ribs along the side walls
    for (let i = -4; i <= 4; i++) {
      this._box(0.4, ROOM.h - 1, 0.4, this.brass, x - w / 2 + 0.6, floor + ROOM.h / 2, z + i * 4);
      this._box(0.4, ROOM.h - 1, 0.4, this.brass, x + w / 2 - 0.6, floor + ROOM.h / 2, z + i * 4);
    }
  }

  _sunburst() {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#1a0f06"; g.fillRect(0, 0, 256, 256);
    g.translate(128, 150);
    for (let i = 0; i < 28; i++) {
      g.rotate((Math.PI * 2) / 28);
      const grd = g.createLinearGradient(0, 0, 0, -150);
      grd.addColorStop(0, "rgba(255,180,90,0.95)");
      grd.addColorStop(1, "rgba(255,180,90,0)");
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.lineTo(2, -150); g.lineTo(-2, -150); g.closePath(); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  _figure(x, z, scale = 1) {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1 * scale, 2.4 * scale, 4, 8), this.figureMat);
    body.position.y = ROOM.floor + 1 + 2.4 * scale;
    f.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.8 * scale, 12, 12), this.figureMat);
    head.position.y = ROOM.floor + 1 + 4.6 * scale;
    f.add(head);
    f.position.set(x, 0, z);
    this.group.add(f);
    this.figures.push({ f, phase: Math.random() * 6.28, base: f.position.y });
    return f;
  }

  _stageAndBand() {
    const { x } = ROOM;
    // raised stage platform
    this._box(ROOM.w * 0.7, 1.4, 9, this.wood, x, ROOM.floor + 0.7, ZSTAGE + 1);
    // glowing deco sunburst backdrop
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 14),
      new THREE.MeshBasicMaterial({ map: this._sunburst(), transparent: true }));
    back.position.set(x, ROOM.floor + 8, ZSTAGE - 0.4);
    this.group.add(back);

    const sY = ROOM.floor + 1.4;
    // pianist + baby grand
    this._figure(x - 12, ZSTAGE + 2, 1);
    const piano = this._box(8, 3, 5, this.dark, x - 14, sY + 1.5, ZSTAGE + 3);
    this._box(8.4, 0.3, 5.4, this.brass, x - 14, sY + 3.1, ZSTAGE + 3); // lid trim
    // upright bass + player
    this._figure(x - 3, ZSTAGE + 2.5, 1.05);
    const bass = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 4.5, 4, 8), this.dark);
    bass.position.set(x - 1.5, sY + 4.2, ZSTAGE + 2.5);
    this.group.add(bass);
    const neck = this._box(0.4, 4, 0.4, this.dark, x - 1.5, sY + 8, ZSTAGE + 2.5);
    // drummer + kit
    this._figure(x + 7, ZSTAGE + 2, 0.95);
    for (const [dx, r] of [[5, 1.6], [8, 1.3], [10, 1.1]]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.6, 12), this.dark);
      drum.position.set(x + dx, sY + 2 + r * 0.2, ZSTAGE + 3.5);
      this.group.add(drum);
    }
    // a trumpet player out front with a bright bell
    const tp = this._figure(x + 13, ZSTAGE + 4.5, 1);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd79a }));
    bell.position.set(x + 14.5, sY + 4.6, ZSTAGE + 5.5);
    this.group.add(bell);
  }

  _tables() {
    const { x, z } = ROOM;
    const spots = [
      [-14, 8], [-2, 10], [10, 7], [-10, 16], [4, 17], [14, 14], [-16, 12], [0, 22],
    ];
    for (const [ox, oz] of spots) {
      const tx = x + ox, tz = z + oz - 4;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.25, 14), this.dark);
      top.position.set(tx, ROOM.floor + 3, tz); this.group.add(top);
      this._box(0.3, 3, 0.3, this.dark, tx, ROOM.floor + 1.5, tz);
      // a candle: glass + flame (glow via bloom, no per-candle light)
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffb552 }));
      flame.position.set(tx, ROOM.floor + 3.6, tz);
      this.group.add(flame);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._halo(), color: 0xffae54, transparent: true, opacity: 0.8,
        depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(3.2, 3.2, 1); halo.position.copy(flame.position);
      this.group.add(halo);
      this.candles.push({ flame, halo, phase: Math.random() * 6.28 });
      // two patrons per table, in silhouette
      this._figure(tx - 1.6, tz + 0.6, 0.8);
      this._figure(tx + 1.6, tz - 0.4, 0.8);
    }
  }

  _halo() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,180,90,0.9)");
    grd.addColorStop(0.4, "rgba(255,150,70,0.3)");
    grd.addColorStop(1, "rgba(255,150,70,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  _bar() {
    const { x, z, w } = ROOM;
    const bx = x + w / 2 - 4;
    // counter
    this._box(3, 3.5, 22, this.wood, bx, ROOM.floor + 1.75, z + 4);
    this._box(3.4, 0.3, 22, this.brass, bx, ROOM.floor + 3.6, z + 4);
    // back-bar shelf with bottle silhouettes and a warm mirror glow
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(20, 6),
      new THREE.MeshBasicMaterial({ color: 0x3a2a14 }));
    glow.position.set(x + w / 2 - 1.2, ROOM.floor + 5, z + 4);
    glow.rotation.y = -Math.PI / 2; this.group.add(glow);
    for (let i = -9; i <= 9; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6 + Math.random(), 6), this.dark);
      b.position.set(x + w / 2 - 2.4, ROOM.floor + 5, z + 4 + i);
      this.group.add(b);
    }
  }

  _shaftAndCab() {
    // a rung-lined shaft from the street down to the room, and a brass cab
    const rungMat = new THREE.MeshStandardMaterial({ color: 0x141414, emissive: 0x332211, emissiveIntensity: 0.7, roughness: 0.7 });
    const shaft = new THREE.Group();
    // three solid sides; the -z side (camera's view) is lined with rungs
    this._box(0.6, 60, 8, this.dark, CABX + 4, -26, CABZ, shaft);
    this._box(0.6, 60, 8, this.dark, CABX - 4, -26, CABZ, shaft);
    this._box(8, 60, 0.6, this.dark, CABX, -26, CABZ + 4, shaft);   // back
    for (let y = 3; y > CEIL; y -= 3.2) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.3, 0.3), rungMat);
      r.position.set(CABX, y, CABZ - 3.8); shaft.add(r);
    }
    this.group.add(shaft);

    // the cab: floor, ceiling, back + side walls, open front (-z)
    const cab = new THREE.Group();
    this._box(6, 0.4, 6, this.brass, 0, -0.5, 0, cab);
    this._box(6, 0.4, 6, this.brass, 0, 5.5, 0, cab);
    this._box(6, 6, 0.4, this.dark, 0, 2.5, 3, cab);     // back
    this._box(0.4, 6, 6, this.brass, -3, 2.5, 0, cab);   // left
    this._box(0.4, 6, 6, this.brass, 3, 2.5, 0, cab);    // right
    // a glowing floor-indicator strip above the open front
    const ind = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffb552 }));
    ind.position.set(0, 5.2, -2.9); cab.add(ind);
    cab.position.set(CABX, 0, CABZ);
    this.group.add(cab);
    this.cab = cab;
    this.cabInd = ind;
  }

  _lightsAndHaze() {
    // a real spotlight washing the band (small room -> a couple of lights ok)
    const spot = new THREE.SpotLight(0xffd9a0, 60, 60, 0.6, 0.5, 1.2);
    spot.position.set(ROOM.x, CEIL - 0.5, ZSTAGE + 6);
    spot.target.position.set(ROOM.x, ROOM.floor + 2, ZSTAGE + 2);
    this.group.add(spot); this.group.add(spot.target);
    this.spot = spot;
    // a visible cone of light (additive) for atmosphere
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 7, 12, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffce92, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    cone.position.set(ROOM.x, CEIL - 6, ZSTAGE + 4);
    this.group.add(cone);
    // a warm fill at the bar
    const bar = new THREE.PointLight(0xffb060, 22, 40, 2);
    bar.position.set(ROOM.x + ROOM.w / 2 - 6, ROOM.floor + 5, ROOM.z + 4);
    this.group.add(bar);
    // low ambient so the room isn't pitch black
    this.group.add(new THREE.HemisphereLight(0x3a2a18, 0x0a0604, 0.5));
    // cigarette smoke
    this.haze = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._halo(), color: 0x6a6256, transparent: true, opacity: 0.05 + Math.random() * 0.06,
        depthWrite: false }));
      const sc = 8 + Math.random() * 14; s.scale.set(sc, sc, 1);
      s.position.set(ROOM.x + (Math.random() - 0.5) * ROOM.w, CEIL - 1 - Math.random() * 4, ROOM.z + (Math.random() - 0.5) * ROOM.d);
      this.group.add(s);
      this.haze.push({ s, drift: (Math.random() - 0.5) * 1.2 });
    }
  }

  show(v) { this.group.visible = v; }

  // ---- choreography ----------------------------------------------------
  // phase: "descend" | "interior" | "ascend"; k in 0..1; t = time
  cameraPose(phase, k, t) {
    const door = { p: V(-49, 4.5, 150), look: V(-66, 3.6, 150) };
    const cabTop = { p: V(CABX, 4.6, CABZ), look: V(CABX, 4.0, CABZ - 6) };
    const cabBot = { p: V(CABX, ROOM.floor + 4.8, CABZ), look: V(CABX, ROOM.floor + 4.2, CABZ - 6) };
    const table = { p: V(ROOM.x, ROOM.floor + 4.6, ROOM.z + 8), look: V(ROOM.x, ROOM.floor + 3.4, ZSTAGE + 2) };

    if (phase === "interior") {
      // settle at the table with a slow, breathing drift; glance handled elsewhere
      const p = table.p.clone();
      p.x += Math.sin(t * 0.3) * 1.6;
      p.y += Math.sin(t * 0.23) * 0.4;
      this.cab.position.y = ROOM.floor + 0.2;
      return { p, look: table.look.clone() };
    }

    // descend / ascend share a path; ascend just reverses k
    const kk = phase === "ascend" ? 1 - k : k;
    // move the cab along the shaft for the ride portion
    let cabY = 0;
    if (kk <= 0.28) cabY = 0;
    else if (kk >= 0.82) cabY = ROOM.floor + 0.2;
    else cabY = (1 - ease((kk - 0.28) / 0.54)) * 0 + ease((kk - 0.28) / 0.54) * (ROOM.floor + 0.2);
    this.cab.position.y = cabY;
    this.cabInd.material.color.setRGB(1, 0.6 + 0.2 * Math.sin(t * 8), 0.3);

    const lerp = (a, b, e) => ({
      p: a.p.clone().lerp(b.p, e), look: a.look.clone().lerp(b.look, e),
    });
    let pose;
    if (kk <= 0.28) pose = lerp(door, cabTop, ease(kk / 0.28));
    else if (kk < 0.82) {
      // riding inside the cab: camera tracks the cab as it descends
      const e = ease((kk - 0.28) / 0.54);
      pose = {
        p: V(CABX, 4.6 + (ROOM.floor + 4.8 - 4.6) * e, CABZ),
        look: V(CABX, 4.0 + (ROOM.floor + 4.2 - 4.0) * e, CABZ - 6),
      };
    } else pose = lerp(cabBot, table, ease((kk - 0.82) / 0.18));
    return pose;
  }

  update(dt, t) {
    if (!this.group.visible) return;
    for (const fg of this.figures) {           // the band & patrons sway
      fg.f.position.y = Math.sin(t * 1.6 + fg.phase) * 0.18;
      fg.f.rotation.z = Math.sin(t * 0.9 + fg.phase) * 0.03;
    }
    for (const c of this.candles) {            // candles flicker
      const f = 0.7 + Math.sin(t * 11 + c.phase) * 0.12 + Math.random() * 0.1;
      c.halo.material.opacity = 0.6 * f;
      c.flame.scale.setScalar(0.8 + 0.3 * f);
    }
    for (const h of this.haze) {               // smoke drifts
      h.s.position.x += h.drift * dt;
      if (h.s.position.x > ROOM.x + ROOM.w / 2) h.s.position.x = ROOM.x - ROOM.w / 2;
      if (h.s.position.x < ROOM.x - ROOM.w / 2) h.s.position.x = ROOM.x + ROOM.w / 2;
    }
    if (this.spot) this.spot.intensity = 55 + Math.sin(t * 2) * 8;
  }
}

export const CLUB_DOOR = V(-49, 4.5, 150);
