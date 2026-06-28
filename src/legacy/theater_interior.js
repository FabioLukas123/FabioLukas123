/* =========================================================================
   THE ORPHEUM — inside the picture palace
   -------------------------------------------------------------------------
   Step through the marquee doors and walk down the raked aisle of a Deco
   movie palace: a gilded proscenium framing a flickering silver screen, a
   sea of red seats with a scattered late-night audience, sconces and a cove
   of light overhead. The screen throws its restless glow across the room —
   every reflection telling a story. Same enter/leave verbs as the club.
   ========================================================================= */
import * as THREE from "three";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (x) => x * x * (3 - 2 * x);

// the auditorium sits behind the Orpheum facade (THEATER at x:58,z:-70)
const HALL = { x: 110, z: -70, floor: 0, h: 30, halfZ: 24, back: 80, front: 144 };

export class TheaterInterior {
  constructor(scene) {
    this.scene = scene;
    this.name = "THE ORPHEUM";
    this.enterLabel = "INSIDE";
    this.exitLabel = "TO THE STREET";
    this.doorPos = V(48, 4.5, -70);
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.figures = [];
    this._mats();
    this._shell();
    this._proscenium();
    this._seats();
    this._lights();
  }

  _mats() {
    this.gild = new THREE.MeshStandardMaterial({ color: 0x6e5523, roughness: 0.35, metalness: 0.9, emissive: 0x171005, emissiveIntensity: 0.5 });
    this.red = new THREE.MeshStandardMaterial({ color: 0x350f12, roughness: 0.85 });
    this.dark = new THREE.MeshStandardMaterial({ color: 0x0c0908, roughness: 0.9 });
    this.figureMat = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.6 });
  }

  _box(w, h, d, mat, x, y, z, p = this.group) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); p.add(m); return m;
  }

  _shell() {
    const { x, z, floor, h, halfZ, back, front } = HALL;
    const depth = front - back, cx = (front + back) / 2;
    this._box(depth, 1, halfZ * 2, this.dark, cx, floor, z);           // floor
    this._box(depth, 1, halfZ * 2, this.dark, cx, floor + h, z);       // ceiling
    this._box(depth, h, 1, this.red, cx, floor + h / 2, z - halfZ);    // left wall
    this._box(depth, h, 1, this.red, cx, floor + h / 2, z + halfZ);    // right wall
    this._box(1, h, halfZ * 2, this.dark, back, floor + h / 2, z);     // back wall
    // gilded pilasters down the side walls
    for (let i = 0; i < 6; i++) {
      const px = back + 8 + i * 11;
      this._box(1.2, h - 4, 1.2, this.gild, px, floor + h / 2, z - halfZ + 1);
      this._box(1.2, h - 4, 1.2, this.gild, px, floor + h / 2, z + halfZ - 1);
    }
  }

  _proscenium() {
    const { x, z, floor, front } = HALL;
    const sx = front - 1;
    // the glowing screen
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 17),
      new THREE.MeshBasicMaterial({ color: 0xcfd6e0 }));
    screen.position.set(sx - 0.4, floor + 12, z);
    screen.rotation.y = -Math.PI / 2;     // faces back down the hall (-x)
    this.group.add(screen);
    this.screen = screen;
    // gilded proscenium arch around it
    this._box(2.5, 24, 42, this.gild, sx + 1, floor + 12, z);            // back face
    this._box(3, 3, 46, this.gild, sx, floor + 22, z);                   // top lintel
    this._box(3, 26, 3, this.gild, sx, floor + 13, z - 20);              // left jamb
    this._box(3, 26, 3, this.gild, sx, floor + 13, z + 20);             // right jamb
    // a raised stage lip and red house curtains pulled to the sides
    this._box(6, 3, 40, this.dark, sx - 3, floor + 1.5, z);
    this._box(4, 22, 5, this.red, sx - 1, floor + 12, z - 17);
    this._box(4, 22, 5, this.red, sx - 1, floor + 12, z + 17);
  }

  _figure(x, z, s = 0.8) {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9 * s, 1.8 * s, 4, 6), this.figureMat);
    body.position.y = HALL.floor + 2.4 + 1.2 * s; f.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62 * s, 10, 10), this.figureMat);
    head.position.y = HALL.floor + 2.4 + 2.8 * s; f.add(head);
    f.position.set(x, 0, z); this.group.add(f);
    this.figures.push({ f, phase: Math.random() * 6.28 });
  }

  _seats() {
    const { x, z, floor, back, front } = HALL;
    // rows from near the back to near the stage, gently raked (back higher)
    for (let r = 0; r < 12; r++) {
      const rx = back + 12 + r * 7.5;
      const ry = floor + 1 + (11 - r) * 0.5;            // rake
      for (let s = -3; s <= 3; s++) {
        if (s === 0) continue;                           // centre aisle
        const sz = z + s * 5.5;
        this._box(2.4, 3.2, 4.2, this.red, rx, ry + 1.6, sz);   // seat back
        this._box(2.4, 0.8, 3, this.dark, rx + 1.4, ry + 1.4, sz); // seat
        // a scattered late-night audience
        if (Math.random() < 0.28) this._figure(rx + 0.6, sz, 0.8);
      }
    }
  }

  _lights() {
    const { x, z, floor, h, front } = HALL;
    // the projector throw: a cool flickering light from the screen
    this.proj = new THREE.PointLight(0xcdd8ec, 40, 130, 1.6);
    this.proj.position.set(front - 8, floor + 12, z);
    this.group.add(this.proj);
    // a warm cove glow so the gilding reads
    const cove = new THREE.PointLight(0xffb060, 14, 90, 2);
    cove.position.set((front + HALL.back) / 2, floor + h - 2, z);
    this.group.add(cove);
    this.group.add(new THREE.HemisphereLight(0x2a2030, 0x070506, 0.4));
    // sconces along the walls (emissive, bloom)
    for (let i = 0; i < 6; i++) {
      const px = HALL.back + 10 + i * 11;
      for (const s of [-1, 1]) {
        const sc = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffb866 }));
        sc.position.set(px, floor + 16, z + s * (HALL.halfZ - 1.4));
        this.group.add(sc);
      }
    }
  }

  show(v) { this.group.visible = v; }

  cameraPose(phase, k, t) {
    const door = { p: this.doorPos.clone(), look: V(72, 4.2, HALL.z) };
    const aisleTop = { p: V(HALL.back + 6, 5.5, HALL.z), look: V(120, 10, HALL.z) };
    const seat = { p: V(112, 6.2, HALL.z), look: V(HALL.front, 12, HALL.z) };

    if (phase === "interior") {
      const p = seat.p.clone();
      p.z += Math.sin(t * 0.25) * 2.2;            // shift in your seat
      p.y += Math.sin(t * 0.2) * 0.3;
      return { p, look: seat.look.clone() };
    }
    const kk = phase === "ascend" ? 1 - k : k;
    const lerp = (a, b, e) => ({ p: a.p.clone().lerp(b.p, e), look: a.look.clone().lerp(b.look, e) });
    if (kk <= 0.4) return lerp(door, aisleTop, ease(kk / 0.4));
    return lerp(aisleTop, seat, ease((kk - 0.4) / 0.6));
  }

  update(dt, t) {
    if (!this.group.visible) return;
    // the screen and projector flicker like running film
    const fl = 0.7 + 0.3 * Math.sin(t * 7) + (Math.random() - 0.5) * 0.25;
    if (this.screen) {
      const v = Math.max(0.4, Math.min(1.2, fl));
      this.screen.material.color.setRGB(0.78 * v, 0.82 * v, 0.92 * v);
    }
    if (this.proj) this.proj.intensity = 30 + 18 * Math.max(0, fl);
    for (const fg of this.figures) fg.f.position.y = Math.sin(t * 0.8 + fg.phase) * 0.05;
  }
}
