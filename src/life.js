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
