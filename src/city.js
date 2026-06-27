/* =========================================================================
   THE CITY — procedural Art Deco skyline
   -------------------------------------------------------------------------
   Towers are built as stepped "ziggurat" setbacks (the Deco signature),
   crowned with spires and finials. Windows are baked as emissive grids so
   ten thousand of them cost almost nothing. The streets are a wet, dark
   mirror. Everything is meant to make the visitor feel small.
   ========================================================================= */
import * as THREE from "three";

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const chance = (p) => Math.random() < p;

// A deterministic-ish window texture: lit amber grid on dark stone, with a
// scatter of dark (unlit) windows so the building reads as inhabited.
function makeWindowTexture(cols, rows, warmth = 1) {
  const cell = 16;
  const c = document.createElement("canvas");
  c.width = cols * cell; c.height = rows * cell;
  const g = c.getContext("2d");
  // stone base with subtle vertical banding (Deco pilasters)
  g.fillStyle = "#0b0d13"; g.fillRect(0, 0, c.width, c.height);
  for (let x = 0; x < cols; x++) {
    const band = (x % 3 === 0) ? "#0e1118" : "#090b10";
    g.fillStyle = band;
    g.fillRect(x * cell, 0, cell, c.height);
  }
  // windows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = Math.random();
      const px = x * cell + 3, py = y * cell + 3, w = cell - 6, h = cell - 7;
      if (lit > 0.62) {
        // warm interior glow, varied
        const v = 120 + Math.random() * 110;
        const r = Math.min(255, v * (1.0 * warmth));
        const gr = Math.min(255, v * (0.72 * warmth));
        const b = Math.min(255, v * (0.38));
        g.fillStyle = `rgb(${r | 0},${gr | 0},${b | 0})`;
        g.fillRect(px, py, w, h);
        // hot core
        g.fillStyle = `rgba(255,235,190,${0.25 + Math.random() * 0.4})`;
        g.fillRect(px + 1, py + 1, w - 2, (h - 2) * (0.4 + Math.random() * 0.4));
      } else if (lit > 0.5) {
        g.fillStyle = "#1a1206"; g.fillRect(px, py, w, h); // dim
      } else {
        g.fillStyle = "#05060a"; g.fillRect(px, py, w, h); // dark
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.beacons = [];          // pulsing rooftop lights
    this.spires = [];
    this._buildMaterials();
  }

  _buildMaterials() {
    // a handful of shared window textures -> draw-call & memory friendly
    this.windowTextures = [];
    for (let i = 0; i < 6; i++) {
      const cols = randInt(8, 14), rows = randInt(16, 30);
      this.windowTextures.push(makeWindowTexture(cols, rows, rand(0.85, 1.15)));
    }
    this.stone = new THREE.MeshStandardMaterial({
      color: 0x14161d, roughness: 0.92, metalness: 0.08,
    });
    this.darkStone = new THREE.MeshStandardMaterial({
      color: 0x0a0c12, roughness: 0.95, metalness: 0.05,
    });
    this.brass = new THREE.MeshStandardMaterial({
      color: 0x6b531f, roughness: 0.35, metalness: 0.9,
      emissive: 0x1a1304, emissiveIntensity: 0.4,
    });
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
  }

  build() {
    this._ground();
    this._avenue();
    this._skyline();
    this._herald();    // the one impossible central tower
    return this;
  }

  // ---- the wet street --------------------------------------------------
  _ground() {
    const geo = new THREE.PlaneGeometry(4000, 4000);
    // dark, wet, faintly reflective asphalt. Real reflections come from the
    // mirror plane added in main.js; this is the substrate beneath it.
    const mat = new THREE.MeshStandardMaterial({
      color: 0x05060a, roughness: 0.18, metalness: 0.6,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.02;
    m.receiveShadow = true;
    this.group.add(m);
    this.ground = m;
  }

  // ---- the central avenue the camera travels ---------------------------
  _avenue() {
    // sodium street lamps marching down the avenue (the "viaduct")
    this.lamps = [];
    const lampGeo = new THREE.SphereGeometry(0.6, 10, 10);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a });
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.26, 14, 8);
    for (let z = -900; z < 900; z += 70) {
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(poleGeo, this.brass);
        pole.position.set(side * 26, 7, z);
        this.group.add(pole);
        const bulb = new THREE.Mesh(lampGeo, lampMat);
        bulb.position.set(side * 26, 14.4, z);
        this.group.add(bulb);
        const pl = new THREE.PointLight(0xffb765, 18, 90, 2.0);
        pl.position.set(side * 26, 14, z);
        this.group.add(pl);
        this.lamps.push({ light: pl, base: 18, phase: Math.random() * 6.28 });
      }
    }
  }

  // ---- a single Art Deco tower -----------------------------------------
  makeTower(x, z, opts = {}) {
    const tower = new THREE.Group();
    let w = opts.w ?? rand(18, 40);
    let d = opts.d ?? rand(18, 40);
    let h = opts.h ?? rand(60, 200);
    const setbacks = randInt(3, 6);
    const tex = opts.tex ?? this.windowTextures[randInt(0, this.windowTextures.length - 1)];

    let baseY = 0;
    let curW = w, curD = d;
    const stepH = h / setbacks;
    for (let s = 0; s < setbacks; s++) {
      const segH = stepH * rand(0.7, 1.15);
      const geo = new THREE.BoxGeometry(curW, segH, curD);
      // emissive window map on the four sides; plain stone on top/bottom
      const sideMat = new THREE.MeshStandardMaterial({
        map: tex.clone(), emissiveMap: tex, emissive: 0xffb878,
        emissiveIntensity: 0.85, color: 0x20242e, roughness: 0.85, metalness: 0.1,
      });
      sideMat.map.repeat.set(Math.max(1, curW / 18), Math.max(1, segH / 22));
      sideMat.map.wrapS = sideMat.map.wrapT = THREE.RepeatWrapping;
      sideMat.emissiveMap.wrapS = sideMat.emissiveMap.wrapT = THREE.RepeatWrapping;
      const mats = [sideMat, sideMat, this.stone, this.stone, sideMat, sideMat];
      const seg = new THREE.Mesh(geo, mats);
      seg.position.y = baseY + segH / 2;
      seg.castShadow = true; seg.receiveShadow = true;
      tower.add(seg);

      // brass cornice ledge between setbacks
      if (s < setbacks - 1) {
        const ledge = new THREE.Mesh(
          new THREE.BoxGeometry(curW + 1.4, 1.2, curD + 1.4), this.brass);
        ledge.position.y = baseY + segH;
        tower.add(ledge);
      }
      baseY += segH;
      curW *= rand(0.7, 0.84);
      curD *= rand(0.7, 0.84);
    }

    // crown: stepped finial + spire (the Chrysler gesture)
    const crown = new THREE.Group();
    let cw = curW;
    for (let i = 0; i < 4; i++) {
      const ch = rand(2.5, 5);
      const c = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cw), this.brass);
      c.position.y = baseY + ch / 2;
      crown.add(c);
      baseY += ch;
      cw *= 0.66;
    }
    if (chance(0.7)) {
      const spireH = rand(10, 40);
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(0.8, cw * 0.4), spireH, 6), this.brass);
      spire.position.y = baseY + spireH / 2;
      crown.add(spire);
      baseY += spireH;
      // a red aviation beacon at the very tip
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), this.beaconMat);
      beacon.position.y = baseY;
      crown.add(beacon);
      const bl = new THREE.PointLight(0xff4422, 6, 60, 2);
      bl.position.y = baseY;
      crown.add(bl);
      this.beacons.push({ mesh: beacon, light: bl, phase: Math.random() * 6.28 });
    }
    tower.add(crown);

    tower.position.set(x, 0, z);
    tower.userData.height = baseY;
    this.group.add(tower);
    return tower;
  }

  // ---- fill the world with towers --------------------------------------
  _skyline() {
    const placed = [];
    const overlaps = (x, z, r) =>
      placed.some(p => Math.hypot(p.x - x, p.z - z) < (p.r + r) * 0.9);

    // blocks flanking the avenue, denser & taller toward the centre
    for (let ring = 0; ring < 7; ring++) {
      const count = 14 + ring * 6;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
        const radius = 70 + ring * 95 + rand(-30, 30);
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        // keep the central avenue (a corridor along z) clear
        if (Math.abs(x) < 40 && Math.abs(z) < 950) continue;
        const w = rand(20, 46), d = rand(20, 46);
        const r = Math.max(w, d) * 0.6;
        if (overlaps(x, z, r)) continue;
        // taller toward the core, shorter at the rim
        const coreBias = 1 - Math.min(1, radius / 700);
        const h = rand(50, 90) + coreBias * rand(60, 200);
        this.makeTower(x, z, { w, d, h });
        placed.push({ x, z, r });
      }
    }
  }

  // ---- the impossible central tower (the "Herald") ---------------------
  _herald() {
    // a single monolith far down the avenue that anchors the whole view.
    const x = 0, z = -1100;
    const t = this.makeTower(x, z, { w: 70, d: 70, h: 360 });
    t.userData.isHerald = true;
    // wrap it in vertical light ribs (Deco fluting picked out by light)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 300, 1.2),
        new THREE.MeshStandardMaterial({
          color: 0x3a2c0e, emissive: 0xffa53c, emissiveIntensity: 1.4,
          roughness: 0.4, metalness: 0.8,
        }));
      rib.position.set(x + Math.cos(a) * 38, 150, z + Math.sin(a) * 38);
      this.group.add(rib);
    }
    this.herald = t;
    this.heraldPos = new THREE.Vector3(x, 0, z);
  }

  // ---- per-frame life --------------------------------------------------
  update(t) {
    // aviation beacons pulse like distant heartbeats
    for (const b of this.beacons) {
      const p = (Math.sin(t * 1.4 + b.phase) * 0.5 + 0.5);
      const v = p * p;
      b.light.intensity = 1 + v * 8;
      b.mesh.material.color.setRGB(0.5 + v * 0.5, 0.1 * v, 0.05 * v);
    }
    // street lamps flicker faintly, like old sodium gas
    for (const l of this.lamps) {
      l.light.intensity = l.base * (0.92 + Math.sin(t * 9 + l.phase) * 0.04 + Math.random() * 0.02);
    }
  }
}
