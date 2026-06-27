/* =========================================================================
   ATMOSPHERE — the air of the city
   -------------------------------------------------------------------------
   Darkness is the material. Here we add the stuff that catches light:
   layered fog, slow drifting haze sprites, falling rain, and two great
   searchlights raking the sky like a premiere that never ends.
   ========================================================================= */
import * as THREE from "three";

function hazeSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(120,140,160,0.20)");
  grd.addColorStop(0.5, "rgba(80,95,120,0.08)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this._haze();
    this._rain();
    this._searchlights();
  }

  // ---- drifting volumetric-feeling haze --------------------------------
  _haze() {
    const tex = hazeSprite();
    const mat = new THREE.SpriteMaterial({
      map: tex, color: 0x4a5a72, transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.haze = [];
    const N = 90;
    for (let i = 0; i < N; i++) {
      const s = new THREE.Sprite(mat.clone());
      const scale = 80 + Math.random() * 240;
      s.scale.set(scale, scale, 1);
      s.position.set(
        (Math.random() - 0.5) * 1600,
        Math.random() * 140 + 4,
        (Math.random() - 0.5) * 2200 - 300
      );
      s.material.opacity = 0.08 + Math.random() * 0.22;
      this.scene.add(s);
      this.haze.push({ s, drift: (Math.random() - 0.5) * 2, base: s.position.x });
    }
  }

  // ---- rain: long thin streaks, GPU points -----------------------------
  _rain() {
    const N = 7000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N);
    this.rainArea = { x: 900, y: 400, z: 1400 };
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.rainArea.x * 2;
      pos[i * 3 + 1] = Math.random() * this.rainArea.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.rainArea.z * 2 - 300;
      vel[i] = 180 + Math.random() * 220;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.rainVel = vel;
    const mat = new THREE.PointsMaterial({
      color: 0x9fb4c8, size: 1.4, transparent: true, opacity: 0.32,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  // ---- searchlight beams sweeping the sky ------------------------------
  _searchlights() {
    this.beams = [];
    const beamGeo = new THREE.CylinderGeometry(1.2, 26, 520, 24, 1, true);
    beamGeo.translate(0, 260, 0); // pivot at the base
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xbcd2e8, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const spots = [
      { x: -260, z: -500, speed: 0.22, phase: 0 },
      { x: 300, z: -780, speed: -0.17, phase: 2.1 },
      { x: 40, z: -1100, speed: 0.13, phase: 4.0 },
    ];
    for (const sp of spots) {
      const pivot = new THREE.Group();
      pivot.position.set(sp.x, 2, sp.z);
      const beam = new THREE.Mesh(beamGeo, beamMat.clone());
      pivot.add(beam);
      this.scene.add(pivot);
      this.beams.push({ pivot, ...sp });
    }
  }

  // ---- per-frame -------------------------------------------------------
  update(dt, t, camera) {
    // rain falls and recycles around the camera so it's always present
    const p = this.rain.geometry.attributes.position.array;
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < this.rainVel.length; i++) {
      const yi = i * 3 + 1;
      p[yi] -= this.rainVel[i] * dt;
      p[i * 3] += dt * 30; // wind slant
      if (p[yi] < 0) {
        p[yi] = this.rainArea.y;
        p[i * 3] = cx + (Math.random() - 0.5) * this.rainArea.x * 2;
        p[i * 3 + 2] = cz + (Math.random() - 0.5) * this.rainArea.z * 2;
      }
    }
    this.rain.geometry.attributes.position.needsUpdate = true;

    // haze drifts slowly, always wrapping past the camera
    for (const h of this.haze) {
      h.s.position.x += h.drift * dt;
      if (h.s.position.x > 900) h.s.position.x = -900;
      if (h.s.position.x < -900) h.s.position.x = 900;
    }

    // searchlights sweep
    for (const b of this.beams) {
      b.pivot.rotation.z = Math.sin(t * b.speed + b.phase) * 0.5;
      b.pivot.rotation.x = Math.cos(t * b.speed * 0.7 + b.phase) * 0.35 + 0.1;
    }
  }
}
