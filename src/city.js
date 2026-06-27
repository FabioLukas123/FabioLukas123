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

// the jazz club's footprint on the avenue (a gap is carved here)
const CLUB = { side: -1, x: -54, z: 150 };

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
  constructor(scene, low = false) {
    this.scene = scene;
    this.low = low;
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
    this._avenueWalls();   // the canyon that leads the eye to the Herald
    this._skyline();
    this._herald();        // the one impossible central tower
    this._signs();         // neon blade signs glowing in the dark
    this._club();          // the hidden jazz club the score belongs to
    return this;
  }

  // ---- neon blade signs ------------------------------------------------
  // Vertical blade by default (letters stacked); horizontal for marquees.
  _neonTex(word, hex, horizontal = false) {
    const col = new THREE.Color(hex);
    const cell = 64, pad = 18;
    const c = document.createElement("canvas");
    const g = () => c.getContext("2d");
    if (horizontal) {
      c.height = cell + pad * 2;
      c.width = cell * 0.62 * word.length + pad * 2;
    } else {
      c.width = cell;
      c.height = cell * word.length + pad * 2;
    }
    const ctx = g();
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = `bold ${cell - 14}px "Futura","Century Gothic",sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
    for (let i = 0; i < word.length; i++) {
      const x = horizontal ? pad + cell * 0.62 * i + cell * 0.31 : cell / 2;
      const y = horizontal ? c.height / 2 : pad + cell * i + cell / 2;
      ctx.shadowColor = `rgba(${rgb},1)`; ctx.shadowBlur = 26;
      ctx.fillStyle = `rgba(${rgb},1)`;
      ctx.fillText(word[i], x, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(word[i], x, y);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { tex: t, ratio: c.height / c.width };
  }

  makeSign(word, x, z, hex, opts = {}) {
    const { tex, ratio } = this._neonTex(word, hex, opts.horizontal);
    const w = opts.w ?? 6;
    const h = w * ratio;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const ry = opts.ry ?? 0;
    sign.position.set(x, opts.y ?? 40, z);
    sign.rotation.y = ry;
    // a dark backing board, set just behind the sign along its normal, so the
    // neon reads as mounted hardware rather than floating light.
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.5, h * 1.08),
      new THREE.MeshStandardMaterial({ color: 0x07080c, roughness: 0.9 }));
    const nx = Math.sin(ry), nz = Math.cos(ry);
    board.position.set(x - nx * 0.3, sign.position.y, z - nz * 0.3);
    board.rotation.y = ry;
    this.group.add(board);
    this.group.add(sign);
    return sign;
  }

  _signs() {
    // a scatter of vertical neon signs facing the avenue, mostly amber with
    // the odd teal/red to break the monotony — pure noir storefront energy.
    const words = [
      ["HOTEL", 0xffb14a], ["JAZZ", 0x46c8d8], ["THEATRE", 0xffcf6a],
      ["BAR", 0xff4a4a], ["LOANS", 0xffb14a], ["CAFE", 0x46c8d8],
      ["ROOMS", 0xffb14a], ["DANCE", 0xff7a4a], ["NEWS", 0xffcf6a],
    ];
    let wi = 0;
    const count = this.low ? 5 : words.length;
    for (let i = 0; i < count; i++) {
      const w = words[wi++ % words.length];
      const side = i % 2 === 0 ? -1 : 1;
      const z = 600 - i * rand(120, 200);
      const x = side * rand(46, 60);
      this.makeSign(w[0], x, z, w[1], {
        y: rand(26, 64), w: rand(5, 8), ry: side > 0 ? -Math.PI / 2 : Math.PI / 2,
      });
    }
  }

  // ---- the hidden jazz club --------------------------------------------
  _club() {
    // A small, low marquee at street level. The generative score "lives"
    // here — the band gets louder and more present as you approach (handled
    // in main.js via clubPos). This is music as architecture.
    const x = CLUB.x, z = CLUB.z;
    this.clubPos = new THREE.Vector3(x + 8, 4, z);
    // a modest Deco facade behind the marquee — the club building itself
    const facade = this.makeTower(x - 16, z, { w: 40, d: 46, h: 54 });
    facade.userData.isClub = true;
    // marquee canopy jutting over the sidewalk toward the avenue
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(20, 1.4, 11), this.brass);
    canopy.position.set(x + 8, 9, z);
    this.group.add(canopy);
    // underside glow of the marquee (warm spill on the doorway)
    const spill = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._radialTex(0xffb765), color: 0xffb765, transparent: true,
      opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    spill.scale.set(24, 24, 1);
    spill.position.set(x + 12, 3.5, z);
    this.group.add(spill);
    // The marquee faces the avenue centre (+x). The blade is perpendicular so
    // it's legible coming down the avenue; the name runs along the canopy.
    this.makeSign("THE BLUE NOTE", x + 13, z, 0x6ec6ff,
      { y: 12.4, w: 16, ry: Math.PI / 2, horizontal: true });
    this.makeSign("JAZZ", x + 16, z + 7, 0xff4a7a,
      { y: 24, w: 6, ry: 0 });
    // warm doorway, set into the facade, facing the avenue
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 9),
      new THREE.MeshBasicMaterial({ color: 0xffcaa0 }));
    door.position.set(x + 4.1, 4.5, z);
    door.rotation.y = Math.PI / 2;
    this.group.add(door);
    this.clubGlow = spill;
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
    // Sodium street lamps marching down the avenue (the "viaduct").
    // The glow is sold by bloom (emissive bulbs) + a reflective light "pool"
    // decal on the wet street — NOT by 50 real point lights, which would
    // crater the framerate. A couple of camera-followed lights (in main.js)
    // give nearby contact light instead.
    this.lamps = [];
    const lampGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a });
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.26, 14, 8);
    const armGeo = new THREE.BoxGeometry(3.4, 0.4, 0.4);
    const poolTex = this._radialTex(0xffb765);
    const poolMat = new THREE.SpriteMaterial({
      map: poolTex, color: 0xffb765, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending, rotation: 0,
    });

    for (let z = -900; z < 900; z += 64) {
      for (const side of [-1, 1]) {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, this.brass);
        pole.position.set(side * 26, 7, z);
        lamp.add(pole);
        // a gooseneck arm reaching over the curb
        const arm = new THREE.Mesh(armGeo, this.brass);
        arm.position.set(side * 26 - side * 1.7, 13.6, z);
        lamp.add(arm);
        const bulb = new THREE.Mesh(lampGeo, lampMat.clone());
        bulb.position.set(side * 26 - side * 3.2, 13.2, z);
        lamp.add(bulb);
        // the pool of light on the wet asphalt, flattened onto the ground
        const pool = new THREE.Sprite(poolMat.clone());
        pool.scale.set(34, 34, 1);
        pool.position.set(side * 26 - side * 3.2, 0.4, z);
        pool.material.rotation = 0;
        lamp.add(pool);
        this.group.add(lamp);
        this.lamps.push({ bulb, pool, base: 0.5, phase: Math.random() * 6.28 });
      }
    }
  }

  // a soft round falloff texture, used for light pools and glows
  _radialTex(hex) {
    const col = new THREE.Color(hex);
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
    grd.addColorStop(0, `rgba(${rgb},0.9)`);
    grd.addColorStop(0.4, `rgba(${rgb},0.35)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---- a single Art Deco tower -----------------------------------------
  makeTower(x, z, opts = {}) {
    const tower = new THREE.Group();
    let w = opts.w ?? rand(18, 40);
    let d = opts.d ?? rand(18, 40);
    let h = opts.h ?? rand(60, 200);
    const setbacks = randInt(3, 6);
    const tex = opts.tex ?? this.windowTextures[randInt(0, this.windowTextures.length - 1)];
    // most interiors are warm tungsten; a few read as cold fluorescent or
    // green-shaded office light, so the skyline isn't one uniform amber.
    const glow = opts.glow ?? (chance(0.78) ? 0xffb878
      : chance(0.5) ? 0xbfd0ff : 0xb8e0c0);

    let baseY = 0;
    let curW = w, curD = d;
    const stepH = h / setbacks;
    for (let s = 0; s < setbacks; s++) {
      const segH = stepH * rand(0.7, 1.15);
      const geo = new THREE.BoxGeometry(curW, segH, curD);
      // emissive window map on the four sides; plain stone on top/bottom
      const sideMat = new THREE.MeshStandardMaterial({
        map: tex.clone(), emissiveMap: tex, emissive: glow,
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
      // a red aviation beacon at the very tip (glow comes from bloom)
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10),
        this.beaconMat.clone());
      beacon.position.y = baseY;
      crown.add(beacon);
      this.beacons.push({ mesh: beacon, phase: Math.random() * 6.28 });
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
    const rings = this.low ? 4 : 7;
    for (let ring = 0; ring < rings; ring++) {
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

  // ---- canyon walls flanking the avenue down to the Herald -------------
  _avenueWalls() {
    // Continuous ranks of towers along both curbs from the foreground all
    // the way to the Herald, so the avenue reads as a deep canyon instead
    // of petering out into empty asphalt. They grow taller toward the core.
    const step = this.low ? [74, 100] : [46, 66];
    for (let z = 760; z > -1040; z -= rand(step[0], step[1])) {
      for (const side of [-1, 1]) {
        // leave a gap in the curb for the jazz club storefront
        if (side === CLUB.side && Math.abs(z - CLUB.z) < 60) continue;
        const x = side * rand(52, 78);
        const depthBias = 1 - Math.min(1, Math.abs(z + 200) / 1100);
        const w = rand(24, 44), d = rand(24, 44);
        const h = rand(70, 120) + depthBias * rand(40, 170);
        this.makeTower(x, z, { w, d, h });
        // a second rank set back behind the first
        if (!this.low && chance(0.7)) {
          const x2 = side * rand(96, 150);
          this.makeTower(x2, z + rand(-20, 20),
            { w: rand(26, 46), d: rand(26, 46), h: rand(80, 200) });
        }
      }
    }
  }

  // ---- the impossible central tower (the "Herald") ---------------------
  _herald() {
    // a single monolith far down the avenue that anchors the whole view.
    const x = 0, z = -1140;
    const t = this.makeTower(x, z, { w: 86, d: 86, h: 440 });
    t.userData.isHerald = true;
    // wrap it in vertical light ribs (Deco fluting picked out by light)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 380, 1.4),
        new THREE.MeshStandardMaterial({
          color: 0x3a2c0e, emissive: 0xffa53c, emissiveIntensity: 1.5,
          roughness: 0.4, metalness: 0.8,
        }));
      rib.position.set(x + Math.cos(a) * 46, 190, z + Math.sin(a) * 46);
      this.group.add(rib);
    }
    this.herald = t;
    this.heraldPos = new THREE.Vector3(x, 0, z);
  }

  // ---- per-frame life --------------------------------------------------
  update(t) {
    // aviation beacons pulse like distant heartbeats; bloom turns the
    // emissive sphere into a halo, so we only animate its brightness.
    for (const b of this.beacons) {
      const p = (Math.sin(t * 1.4 + b.phase) * 0.5 + 0.5);
      const v = p * p;
      b.mesh.material.color.setRGB(0.35 + v * 0.95, 0.04 + 0.18 * v, 0.03 * v);
    }
    // street lamps flicker faintly, like old sodium gas — purely emissive
    for (const l of this.lamps) {
      const f = 0.9 + Math.sin(t * 9 + l.phase) * 0.05 + Math.random() * 0.02;
      l.pool.material.opacity = l.base * f;
      const g = 0.85 + 0.15 * f;
      l.bulb.material.color.setRGB(1 * g, 0.84 * g, 0.6 * g);
    }
  }
}
