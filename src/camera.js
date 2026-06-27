/* =========================================================================
   THE WALK — camera direction
   -------------------------------------------------------------------------
   Two modes, one feeling: you are small and the city is endless.
   · CINEMATIC: the city drives — a slow, choreographed dolly down the
     avenue toward the Herald tower, with gentle handheld sway.
   · MANUAL: you take the wheel (WASD + mouse look) but the lens keeps its
     noir weight — easing, drift, a low horizon so towers loom.
   ========================================================================= */
import * as THREE from "three";

// A hand-authored spline of "stations" the cinematic camera visits.
// Each: position, where it looks, and a name for the HUD.
const STATIONS = [
  { p: [0, 6, 820], look: [0, 60, -200], name: "THE VIADUCT" },
  { p: [-22, 9, 520], look: [40, 120, -300], name: "BRASS ROW" },
  { p: [18, 5, 240], look: [-30, 90, -400], name: "THE UNDERPASS" },
  { p: [-10, 22, -40], look: [0, 160, -600], name: "FOUNTAIN SQUARE" },
  { p: [12, 40, -360], look: [0, 220, -1100], name: "THE HIGH LINE" },
  { p: [0, 80, -680], look: [0, 280, -1100], name: "HERALD APPROACH" },
  { p: [0, 150, -940], look: [0, 320, -1100], name: "THE HERALD" },
];

export class CameraDirector {
  constructor(camera, dom) {
    this.cam = camera;
    this.dom = dom;
    this.mode = "cinematic";
    this.t = 0;            // 0..1 progress along the rail
    this.speed = 0.012;    // base rail speed
    this.hurry = false;

    // manual state
    this.pos = new THREE.Vector3(0, 6, 820);
    this.yaw = Math.PI;     // facing -z down the avenue
    this.pitch = -0.02;
    this.vel = new THREE.Vector3();
    this.keys = {};
    this._look = new THREE.Vector3();
    this._curLook = new THREE.Vector3(0, 60, -200);

    this._bindManual();
    this.stationName = STATIONS[0].name;
  }

  _bindManual() {
    addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.hurry = true;
    });
    addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.hurry = false;
    });
    // mouse look only when pointer is locked (manual mode)
    addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-0.9, Math.min(0.6, this.pitch));
    });
  }

  toggleMode() {
    if (this.mode === "cinematic") {
      this.mode = "manual";
      // seed manual state from current camera so there's no jump
      this.pos.copy(this.cam.position);
      this.dom.requestPointerLock?.();
    } else {
      this.mode = "cinematic";
      document.exitPointerLock?.();
    }
    return this.mode;
  }

  // sample the rail with a smooth catmull-ish blend between stations
  _sampleRail(t) {
    const n = STATIONS.length - 1;
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = this._smooth(f - i);
    const a = STATIONS[i], b = STATIONS[i + 1];
    const p = new THREE.Vector3(
      a.p[0] + (b.p[0] - a.p[0]) * k,
      a.p[1] + (b.p[1] - a.p[1]) * k,
      a.p[2] + (b.p[2] - a.p[2]) * k
    );
    const look = new THREE.Vector3(
      a.look[0] + (b.look[0] - a.look[0]) * k,
      a.look[1] + (b.look[1] - a.look[1]) * k,
      a.look[2] + (b.look[2] - a.look[2]) * k
    );
    this.stationName = k < 0.5 ? a.name : b.name;
    return { p, look };
  }

  _smooth(x) { return x * x * (3 - 2 * x); }

  // returns intensity 0..1 for the music (motion + height)
  update(dt, time) {
    let motion = 0;
    if (this.mode === "cinematic") {
      this.t += this.speed * dt * (this.hurry ? 2.2 : 1);
      if (this.t >= 1) this.t = 0; // loop the journey seamlessly
      const { p, look } = this._sampleRail(this.t);
      // handheld sway so it never feels like a slider
      p.x += Math.sin(time * 0.5) * 1.4;
      p.y += Math.sin(time * 0.37) * 0.8;
      this.cam.position.lerp(p, 1 - Math.pow(0.001, dt));
      this._curLook.lerp(look, 1 - Math.pow(0.01, dt));
      this.cam.lookAt(this._curLook);
      motion = this.hurry ? 0.7 : 0.4;
    } else {
      // manual fly
      const speed = (this.hurry ? 120 : 48) * dt;
      const dir = new THREE.Vector3();
      const fwd = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      ).multiplyScalar(-1);
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      if (this.keys["KeyW"]) dir.add(fwd);
      if (this.keys["KeyS"]) dir.sub(fwd);
      if (this.keys["KeyD"]) dir.add(right);
      if (this.keys["KeyA"]) dir.sub(right);
      if (this.keys["Space"]) dir.y += 1;
      if (this.keys["ControlLeft"]) dir.y -= 1;
      if (dir.lengthSq() > 0) dir.normalize();
      this.vel.lerp(dir.multiplyScalar(speed), 0.18);
      this.pos.add(this.vel);
      this.pos.y = Math.max(2.2, this.pos.y); // never below street
      this.cam.position.copy(this.pos);
      this._look.set(
        this.pos.x - fwd.x, this.pos.y - fwd.y, this.pos.z - fwd.z
      );
      // fwd already points where we travel; look the same way
      this.cam.lookAt(this.pos.x + fwd.x, this.pos.y + fwd.y, this.pos.z + fwd.z);
      motion = Math.min(1, this.vel.length() / speed) * (this.hurry ? 0.9 : 0.55);
      this.stationName = "OFF THE MAP";
    }
    // height adds to musical intensity (the higher you climb, the bigger)
    const heightFactor = Math.min(1, this.cam.position.y / 200);
    return Math.min(1, motion * 0.7 + heightFactor * 0.5);
  }
}
