/* =========================================================================
   LIFE — the city is not empty
   -------------------------------------------------------------------------
   Traffic. Through fog and bloom, a pair of white headlights and two red
   tail-lamps reads instantly as a car at night, for almost no cost. Cars
   run the avenue and a few cross-streets, recycling around the camera so
   there is always movement somewhere in the frame. They reflect in the
   wet street because the mirror re-renders the whole scene.
   ========================================================================= */
import * as THREE from "three";

function glowTex(hex, soft = 0.35) {
  const col = new THREE.Color(hex);
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
  grd.addColorStop(0, `rgba(${rgb},1)`);
  grd.addColorStop(soft, `rgba(${rgb},0.6)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Life {
  constructor(scene, low = false) {
    this.scene = scene;
    this.low = low;
    this.cars = [];
    this._headTex = glowTex(0xfff0d0, 0.3);
    this._tailTex = glowTex(0xff2a18, 0.4);
    this._bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0a0b0f, roughness: 0.25, metalness: 0.7,
    });
    this._build();
    this._elevated();
  }

  // a warm row-of-windows texture for the train cars
  _trainTex() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 32;
    const g = c.getContext("2d");
    g.fillStyle = "#0c0a07"; g.fillRect(0, 0, 256, 32);
    for (let x = 6; x < 250; x += 20) {
      const lit = Math.random() > 0.25;
      g.fillStyle = lit ? "#ffd79a" : "#1a130a";
      g.fillRect(x, 9, 13, 15);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---- the elevated line crossing the mid-distance ---------------------
  _elevated() {
    const Z = -400, Y = 40, SPAN = 560;
    const steel = new THREE.MeshStandardMaterial({
      color: 0x0c0e14, roughness: 0.7, metalness: 0.6,
    });
    // the deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(SPAN, 2.4, 12), steel);
    deck.position.set(0, Y, Z);
    this.scene.add(deck);
    // a low parapet truss along each side
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(SPAN, 2.6, 0.6), steel);
      rail.position.set(0, Y + 2.4, Z + s * 5.6);
      this.scene.add(rail);
    }
    // support pylons (skip the central avenue so it can pass beneath)
    for (let x = -SPAN / 2 + 30; x <= SPAN / 2 - 30; x += 70) {
      if (Math.abs(x) < 44) continue;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(7, Y, 7), steel);
      pylon.position.set(x, Y / 2, Z);
      this.scene.add(pylon);
      // a cross-brace arch
      const brace = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 16), steel);
      brace.position.set(x, Y - 6, Z);
      this.scene.add(brace);
    }

    // amber running-lights strung along both deck edges, so the elevated line
    // reads as a lit structure at night even when no train is crossing.
    const rl = [];
    for (let x = -SPAN / 2; x <= SPAN / 2; x += 11) {
      for (const s of [-1, 1]) { rl.push(x, Y + 4.2, Z + s * 6); }
    }
    const rlGeo = new THREE.BufferGeometry();
    rlGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rl), 3));
    const runlights = new THREE.Points(rlGeo, new THREE.PointsMaterial({
      color: 0xffc070, size: 2.4, sizeAttenuation: true, transparent: true,
      opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(runlights);

    // a station headhouse on the curb, with a lit platform up at the deck
    const station = new THREE.Group();
    const sx = 48;                              // on the right curb
    const house = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 18),
      new THREE.MeshStandardMaterial({
        color: 0x16120b, emissive: 0xffc070, emissiveIntensity: 0.45, roughness: 0.8,
      }));
    house.position.set(sx, 8, Z + 8);
    station.add(house);
    // a stair mass climbing toward the deck
    const stair = new THREE.Mesh(new THREE.BoxGeometry(7, Y, 10), steel);
    stair.position.set(sx - 8, Y / 2, Z + 4);
    stair.rotation.z = 0.06;
    station.add(stair);
    // a lit platform canopy at deck level
    const plat = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 16),
      new THREE.MeshStandardMaterial({
        color: 0x16120b, emissive: 0xffc070, emissiveIntensity: 0.5, roughness: 0.8,
      }));
    plat.position.set(sx - 6, Y + 4.5, Z);
    station.add(plat);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 18), steel);
    canopy.position.set(sx - 6, Y + 11, Z);
    station.add(canopy);
    this.scene.add(station);
    // a warm glow at the entrance and a TRAINS blade are added by City signage;
    // here we just spill light at the doorway
    const spill = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._headTex, color: 0xffc070, transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    spill.scale.set(20, 20, 1);
    spill.position.set(sx, 4, Z + 18);
    station.add(spill);

    // the train: a head with a lamp and a string of lit cars
    const tex = this._trainTex();
    const train = new THREE.Group();
    const carMat = new THREE.MeshStandardMaterial({
      color: 0x14110b, emissive: 0xffd79a, emissiveMap: tex, map: tex,
      emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.3,
    });
    const cars = this.low ? 3 : 5;
    const half = (cars - 1) / 2;
    for (let i = 0; i < cars; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 8), carMat);
      // centred on the group origin (local z=0) so a 180° flip reverses cleanly
      car.position.set((i - half) * 33, Y + 6.4, 0);
      train.add(car);
    }
    // forward headlight at the +x nose (rotate the group to travel the other way)
    const nose = half * 33 + 20;
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._headTex, color: 0xfff4d8, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    lamp.scale.set(11, 11, 1);
    lamp.position.set(nose, Y + 6.4, 0);
    train.add(lamp);
    train.position.set(-(SPAN / 2 + 160), 0, Z);
    this.scene.add(train);
    this.train = train;
    this.trainState = {
      Z, Y, span: SPAN, len: cars * 33,
      x: -(SPAN / 2 + 160), speed: 95, dir: 1, wait: 3,
    };
  }

  _makeCar(headColor) {
    const car = new THREE.Group();
    // a low, dark, faintly reflective body so the wet street has something
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 5.4), this._bodyMat);
    body.position.y = 0.9;
    car.add(body);
    const head = new THREE.SpriteMaterial({
      map: this._headTex, color: headColor, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const tail = new THREE.SpriteMaterial({
      map: this._tailTex, color: 0xff2a18, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    for (const sx of [-0.9, 0.9]) {
      const h = new THREE.Sprite(head.clone());
      h.scale.set(2.8, 2.8, 1); h.position.set(sx, 1.0, 2.9);
      car.add(h);
      const t = new THREE.Sprite(tail.clone());
      t.material.opacity = 0.7;
      t.scale.set(1.7, 1.7, 1); t.position.set(sx, 1.0, -2.9);
      car.add(t);
      // a long thin "throw" of light on the road ahead
      const beam = new THREE.Sprite(head.clone());
      beam.material.opacity = 0.32;
      beam.scale.set(4, 14, 1); beam.position.set(sx, 0.2, 7);
      car.add(beam);
    }
    return car;
  }

  _build() {
    // Avenue traffic: two lanes running along z (the corridor is |x|<40).
    const avenueCars = this.low ? 6 : 10;
    for (let i = 0; i < avenueCars; i++) {
      const dir = i % 2 === 0 ? 1 : -1;           // toward / away
      const lane = dir > 0 ? 9 : -9;
      const car = this._makeCar(0xfff0d0);
      car.userData = {
        axis: "z", dir, lane,
        speed: 38 + Math.random() * 46,
        pos: -900 + Math.random() * 1800,
      };
      car.rotation.y = dir > 0 ? 0 : Math.PI;
      this.scene.add(car);
      this.cars.push(car);
    }
    // Cross-street traffic on a few intersections, running along x.
    const crossZ = [-150, -430, -710, 130];
    const crossCars = this.low ? 4 : 8;
    for (let i = 0; i < crossCars; i++) {
      const z = crossZ[i % crossZ.length];
      const dir = i % 2 === 0 ? 1 : -1;
      const car = this._makeCar(0xfff0d0);
      car.userData = {
        axis: "x", dir, lane: z + (dir > 0 ? 7 : -7),
        speed: 30 + Math.random() * 40,
        pos: -350 + Math.random() * 700,
      };
      car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(car);
      this.cars.push(car);
    }
  }

  update(dt, camera) {
    // the elevated train: glides across, then waits offstage and returns
    const ts = this.trainState;
    if (ts) {
      if (ts.wait > 0) {
        ts.wait -= dt;
        this.train.visible = false;
      } else {
        this.train.visible = true;
        ts.x += ts.speed * ts.dir * dt;
        this.train.position.x = ts.x;
        const off = ts.span / 2 + ts.len + 120;
        if (ts.dir > 0 && ts.x > off) { ts.dir = -1; ts.wait = 4 + Math.random() * 6; this.train.rotation.y = Math.PI; ts.x = off; }
        else if (ts.dir < 0 && ts.x < -off) { ts.dir = 1; ts.wait = 4 + Math.random() * 6; this.train.rotation.y = 0; ts.x = -off; }
      }
    }

    const cz = camera.position.z, cx = camera.position.x;
    for (const car of this.cars) {
      const d = car.userData;
      d.pos += d.speed * d.dir * dt;
      if (d.axis === "z") {
        // recycle relative to the camera so traffic is always present
        if (d.dir > 0 && d.pos > cz + 600) d.pos = cz - 900;
        if (d.dir < 0 && d.pos < cz - 600) d.pos = cz + 900;
        car.position.set(d.lane, 0, d.pos);
      } else {
        if (d.pos > 380) d.pos = -380;
        if (d.pos < -380) d.pos = 380;
        car.position.set(d.pos, 0, d.lane);
      }
    }
  }
}
