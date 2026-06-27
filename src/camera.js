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
// Low in the canyon, eyes tilted up — the visitor stays small and the
// towers always loom. The Herald grows at the end of the avenue.
const STATIONS = [
  { p: [0, 5, 800], look: [0, 110, -200], name: "THE VIADUCT" },
  { p: [-20, 8, 520], look: [30, 150, -300], name: "BRASS ROW" },
  { p: [16, 5, 250], look: [-24, 130, -450], name: "THE UNDERPASS" },
  { p: [-12, 14, -30], look: [0, 200, -700], name: "FOUNTAIN SQUARE" },
  { p: [10, 22, -370], look: [0, 300, -1140], name: "THE HIGH LINE" },
  { p: [-6, 28, -680], look: [0, 360, -1140], name: "HERALD APPROACH" },
  { p: [0, 18, -940], look: [0, 300, -1110], name: "UNDER THE HERALD" },
  // the ascent up the Herald's lit ribs into the observatory
  { p: [0, 130, -1010], look: [0, 320, -1140], name: "THE ASCENT" },
  { p: [0, 280, -1052], look: [0, 400, -1140], name: "THE LONG CLIMB" },
  { p: [0, 372, -1066], look: [0, 150, -250], name: "THE OBSERVATORY" },
];

export class CameraDirector {
  constructor(camera, dom) {
    this.cam = camera;
    this.dom = dom;
    this.mode = "cinematic";
    this.t = 0;            // 0..1 progress along the rail
    this.railDir = 1;      // ping-pong direction (no snap-back at the ends)
    this.speed = 0.009;    // base rail speed
    this.hurry = false;

    // the establishing shot played once on entry
    this.introT = 0;
    this.introDur = 9.0;
    this._introStart = { p: [0, 2.4, 985], look: [-30, 240, -120] };

    // the club-interior visit (set by main.js)
    this.interior = null;
    this.phaseT = 0;
    this.descendDur = 7.5;
    this.ascendDur = 6.0;
    this._prevMode = "cinematic";

    // manual state
    this.pos = new THREE.Vector3(0, 6, 820);
    this.yaw = Math.PI;     // facing -z down the avenue
    this.pitch = -0.02;
    this.vel = new THREE.Vector3();
    this.keys = {};
    this._look = new THREE.Vector3();
    this._curLook = new THREE.Vector3(0, 60, -200);

    // drag-to-peek: glance around the moving city (touch + un-locked mouse)
    this.peekYaw = 0; this.peekPitch = 0;
    this._peekTargetYaw = 0; this._peekTargetPitch = 0;
    this._dragging = false; this._lastX = 0; this._lastY = 0;

    this._bindManual();
    this._bindDrag();
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

  // Pointer drag (no lock): peek in cinematic, free-look in manual. Works
  // for touch and mouse alike, so the city is explorable on a phone.
  _bindDrag() {
    const down = (x, y) => { this._dragging = true; this._lastX = x; this._lastY = y; };
    const move = (x, y) => {
      if (!this._dragging) return;
      const dx = x - this._lastX, dy = y - this._lastY;
      this._lastX = x; this._lastY = y;
      if (this.mode === "manual") {
        if (document.pointerLockElement === this.dom) return; // mouse-look owns it
        this.yaw -= dx * 0.004;
        this.pitch = Math.max(-0.9, Math.min(0.6, this.pitch - dy * 0.004));
      } else {
        this._peekTargetYaw = Math.max(-0.6, Math.min(0.6, this._peekTargetYaw + dx * 0.0045));
        this._peekTargetPitch = Math.max(-0.35, Math.min(0.35, this._peekTargetPitch + dy * 0.0045));
      }
    };
    const up = () => { this._dragging = false; };
    this.dom.addEventListener("pointerdown", (e) => down(e.clientX, e.clientY));
    addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  }

  // play the one-time establishing shot, then hand off to the rail
  startIntro() {
    this.mode = "intro";
    this.introT = 0;
    this.stationName = "THE CITY";
  }

  // ride the elevator down into the jazz club, and back out again
  enterClub() {
    if (!this.interior || this.mode === "descend" || this.mode === "interior" ||
        this.mode === "ascend") return false;
    this._prevMode = (this.mode === "manual") ? "manual" : "cinematic";
    this.mode = "descend";
    this.phaseT = 0;
    this.interior.show(true);
    if (document.pointerLockElement === this.dom) document.exitPointerLock?.();
    return true;
  }
  exitClub() {
    if (this.mode !== "interior") return false;
    this.mode = "ascend";
    this.phaseT = 0;
    return true;
  }
  get inClub() {
    return this.mode === "descend" || this.mode === "interior" || this.mode === "ascend";
  }

  toggleMode() {
    if (this.mode === "intro") { this.mode = "cinematic"; this.t = 0; }
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

    // ---- the club visit: elevator down, the room, elevator up ----------
    if (this.inClub) {
      if (this.mode === "descend") {
        this.phaseT += dt / this.descendDur;
        const pose = this.interior.cameraPose("descend", Math.min(1, this.phaseT), time);
        this.cam.position.copy(pose.p);
        this.cam.lookAt(pose.look);
        this.stationName = this.interior.enterLabel || "ENTERING";
        if (this.phaseT >= 1) this.mode = "interior";
      } else if (this.mode === "interior") {
        const pose = this.interior.cameraPose("interior", 0, time);
        this.cam.position.copy(pose.p);
        this.cam.lookAt(pose.look);
        // let people glance around the room
        if (!this._dragging) { this._peekTargetYaw *= 0.94; this._peekTargetPitch *= 0.94; }
        this.peekYaw += (this._peekTargetYaw - this.peekYaw) * 0.12;
        this.peekPitch += (this._peekTargetPitch - this.peekPitch) * 0.12;
        this.cam.rotateY(this.peekYaw);
        this.cam.rotateX(this.peekPitch);
        this.stationName = this.interior.name || "INSIDE";
      } else { // ascend
        this.phaseT += dt / this.ascendDur;
        const pose = this.interior.cameraPose("ascend", Math.min(1, this.phaseT), time);
        this.cam.position.copy(pose.p);
        this.cam.lookAt(pose.look);
        this.stationName = this.interior.exitLabel || "LEAVING";
        if (this.phaseT >= 1) {
          this.interior.show(false);
          this.mode = this._prevMode;
        }
      }
      return 0.78;   // the band is right here — keep it lively
    }

    if (this.mode === "intro") {
      this.introT += dt / this.introDur;
      const k = this._smooth(Math.min(1, this.introT));
      const s0 = STATIONS[0];
      const a = this._introStart;
      const p = new THREE.Vector3(
        a.p[0] + (s0.p[0] - a.p[0]) * k,
        a.p[1] + (s0.p[1] - a.p[1]) * k,
        a.p[2] + (s0.p[2] - a.p[2]) * k);
      this._curLook.set(
        a.look[0] + (s0.look[0] - a.look[0]) * k,
        a.look[1] + (s0.look[1] - a.look[1]) * k,
        a.look[2] + (s0.look[2] - a.look[2]) * k);
      this.cam.position.copy(p);
      this.cam.lookAt(this._curLook);
      this.stationName = "THE CITY";
      if (this.introT >= 1) { this.mode = "cinematic"; this.t = 0; }
      // the score swells in over the establishing shot
      return 0.12 + k * 0.3;
    }
    if (this.mode === "cinematic") {
      this.t += this.speed * dt * this.railDir * (this.hurry ? 2.2 : 1);
      // ping-pong so the endless journey never snaps back to the start
      if (this.t >= 1) { this.t = 1; this.railDir = -1; }
      else if (this.t <= 0) { this.t = 0; this.railDir = 1; }
      const { p, look } = this._sampleRail(this.t);
      // handheld sway so it never feels like a slider (calmed for reduced-motion)
      const sway = this.calm ? 0.25 : 1.0;
      p.x += Math.sin(time * 0.5) * 1.4 * sway;
      p.y += Math.sin(time * 0.37) * 0.8 * sway;
      this.cam.position.lerp(p, 1 - Math.pow(0.001, dt));
      this._curLook.lerp(look, 1 - Math.pow(0.01, dt));
      this.cam.lookAt(this._curLook);
      // glance offset springs back to the choreographed framing when released
      if (!this._dragging) { this._peekTargetYaw *= 0.94; this._peekTargetPitch *= 0.94; }
      this.peekYaw += (this._peekTargetYaw - this.peekYaw) * 0.12;
      this.peekPitch += (this._peekTargetPitch - this.peekPitch) * 0.12;
      this.cam.rotateY(this.peekYaw);
      this.cam.rotateX(this.peekPitch);
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
