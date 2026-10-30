// Hands-on cleaning with the real tools: wire-brush the joint before welding (rust / mill scale),
// chip the slag off with the chipping hammer after welding, then brush the bead.
import * as THREE from 'three';
import { JOINT } from '../models.js';

export function createCleaning({ E, audio, sim, hammer, brush, onChange }) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let mode = null;          // { kind: 'pre' | 'chip' | 'post', prog }
  let saved = null, swing = 0, scrub = 0, pressed = false, lastX = null, overTool = false;

  // ---- rust / mill-scale layer over the joint area (painted away by brushing)
  const GW = 64, GH = 16, cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const dirt = new Float32Array(GW * GH);
  const rust = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  rust.rotation.x = -Math.PI / 2; rust.visible = false; rust.renderOrder = 2; E.scene.add(rust);
  const RX0 = () => JOINT.x0 - 0.012, RX1 = () => JOINT.x1 + 0.012, RZ = 0.032;
  function paintRust() {
    const c = cv.getContext('2d'); c.clearRect(0, 0, 512, 128);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 512, y = Math.random() * 128, r = 3 + Math.random() * 14;
      const g = c.createRadialGradient(x, y, 0, x, y, r), k = Math.random();
      const col = k < 0.5 ? [105 + Math.random() * 30, 52 + Math.random() * 18, 24] : k < 0.8 ? [72, 44, 28] : [58, 58, 60];
      g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2]},${0.4 + Math.random() * 0.3})`); g.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2]},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    // oily patch
    c.fillStyle = 'rgba(30,25,15,.35)'; c.beginPath(); c.ellipse(330, 70, 40, 18, 0.3, 0, 7); c.fill();
    dirt.fill(1); tex.needsUpdate = true;
  }
  function scrubAt(x, z) {
    const u = (x - RX0()) / (RX1() - RX0()), v = (z - (JOINT.z - RZ)) / (2 * RZ);
    if (u < -0.05 || u > 1.05 || v < -0.2 || v > 1.2) return false;
    const c = cv.getContext('2d'); c.save(); c.globalCompositeOperation = 'destination-out';
    const px = u * 512, py = (1 - v) * 128, g = c.createRadialGradient(px, py, 0, px, py, 34);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px - 36, py - 36, 72, 72); c.restore();
    tex.needsUpdate = true;
    const gx = Math.round(u * (GW - 1)), gy = Math.round((1 - v) * (GH - 1));
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const X = gx + i, Y = gy + j; if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue; const k = dirt[Y * GW + X]; dirt[Y * GW + X] = Math.max(0, k - 0.22 * (1 - Math.hypot(i, j) / 4.5)); }
    return true;
  }
  const cleanFrac = () => { let s = 0, n = 0; for (let y = 3; y < GH - 3; y++) for (let x = 0; x < GW; x++) { s += dirt[y * GW + x]; n++; } return 1 - s / n; };

  // ---- flying slag chips
  const chipGeo = new THREE.DodecahedronGeometry(0.0022, 0), chipMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.3, metalness: 0.1 });
  const chips = []; for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(chipGeo, chipMat); m.visible = false; E.scene.add(m); chips.push({ m, v: new THREE.Vector3(), t: 0 }); }
  function burst(x) {
    for (let k = 0; k < 6; k++) {
      const c = chips.find(q => q.t <= 0); if (!c) break;
      c.m.position.set(x + (Math.random() - 0.5) * 0.01, JOINT.y + 0.002, JOINT.z + (Math.random() - 0.5) * 0.006);
      c.v.set((Math.random() - 0.5) * 0.4, 0.35 + Math.random() * 0.4, (Math.random() - 0.3) * 0.4); c.t = 0.9; c.m.visible = true; c.m.scale.setScalar(0.6 + Math.random());
    }
  }

  function pose(tool, on) {
    if (on) { if (!saved) saved = { hp: hammer.position.clone(), hr: hammer.rotation.clone(), bp: brush.position.clone(), br: brush.rotation.clone() }; }
    else if (saved) { hammer.scale.setScalar(1); brush.scale.setScalar(1); hammer.position.copy(saved.hp); hammer.rotation.copy(saved.hr); brush.position.copy(saved.bp); brush.rotation.copy(saved.br); saved = null; }
  }
  function start(kind) {
    mode = { kind, prog: 0 };
    if (kind === 'pre') { paintRust(); rust.visible = true; const w = RX1() - RX0(); rust.scale.set(w, 2 * RZ, 1); rust.position.set((RX0() + RX1()) / 2, JOINT.y + 0.0004, JOINT.z); }
    pose(null, true);
    const tool = kind === 'chip' ? hammer : brush;
    tool.position.set(0.3, JOINT.y + 0.03, JOINT.z + 0.03); tool.rotation.set(0, kind === 'chip' ? Math.PI * 0.8 : 0.9, 0); tool.scale.setScalar(0.7);
    E.controls.enabled = false; update();
  }
  function stop() { if (!mode) return; mode = null; rust.visible = false; pose(null, false); E.controls.enabled = true; pressed = false; }
  function finish() { const k = mode.kind; stop(); onChange && onChange({ done: k }); }
  function skip() { if (mode) finish(); }
  function update() { onChange && onChange({ prog: mode ? mode.prog : 1, kind: mode && mode.kind }); }

  function project(ev) { E.setRay(ev); plane.constant = -JOINT.y; return E.ray.ray.intersectPlane(plane, hit) ? hit : null; }
  function pointer(ev, phase) {
    if (!mode) return false;
    const p = project(ev);
    if (phase === 'down') { pressed = true; E.renderer.domElement.setPointerCapture(ev.pointerId); }
    if (phase === 'up') { pressed = false; lastX = null; return true; }
    if (!p) return true;
    const tool = mode.kind === 'chip' ? hammer : brush;
    const x = THREE.MathUtils.clamp(p.x, JOINT.x0 - 0.02, JOINT.x1 + 0.02), z = THREE.MathUtils.clamp(p.z, JOINT.z - 0.04, JOINT.z + 0.04);
    if (mode.kind === 'chip') {
      tool.position.set(x, JOINT.y + 0.1 + (pressed ? 0 : 0.02), JOINT.z + 0.004);
      if (phase === 'down') { swing = 1; strike(x); }
    } else {
      tool.position.set(x, JOINT.y + 0.0025, z);
      if (pressed) {
        scrub += Math.abs((lastX ?? x) - x) + 0.0005; lastX = x;
        if (mode.kind === 'pre') { if (scrubAt(x, z)) { if (Math.random() < 0.3) audio.sfx('chip'); mode.prog = cleanFrac(); } }
        else { sim.brushAt(x, 0.012); mode.prog = Math.min(1, sim.brushedFrac() * 1.08); if (Math.random() < 0.25) audio.sfx('chip'); }
        update();
        if (mode.prog >= (mode.kind === 'pre' ? 0.86 : 0.9)) { audio.sfx('ok'); finish(); }
      }
    }
    return true;
  }
  function strike(x) {
    const hits = sim.chipAt(x, 0.01);
    audio.sfx('chip'); if (hits.length) burst(x);
    mode.prog = 1 - sim.slagLeft(); update();
    if (mode.prog > 0.97 && !mode.ending) { mode.ending = true; audio.sfx('ok'); setTimeout(() => mode && finish(), 450); }
  }
  function frame(dt) {
    for (const c of chips) { if (c.t <= 0) continue; c.t -= dt; c.v.y -= 2.2 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 9; if (c.m.position.y < JOINT.y - 0.004) { c.m.position.y = JOINT.y - 0.004; c.v.multiplyScalar(0.3); } if (c.t <= 0) c.m.visible = false; }
    if (!mode) return;
    if (mode.kind === 'chip') {
      // strike: the chisel end comes down onto the bead, slag cracks off there
      const base = hammer.position.y;
      if (swing > 0) {
        const prev = swing; swing = Math.max(0, swing - dt * 5.5);
        const k = swing > 0.5 ? (1 - swing) * 2 : swing * 2;   // 0→1→0
        hammer.rotation.set(-0.6 + k * 0.6, Math.PI * 0.8, 0); hammer.position.y = JOINT.y + 0.1 - k * 0.012;
        void prev;
      } else hammer.rotation.set(-0.6, Math.PI * 0.8, 0);
      void base;
    } else if (pressed) { brush.rotation.z = Math.sin(performance.now() / 45) * 0.06; }
  }
  return { start, stop, skip, pointer, frame, get active() { return !!mode; }, get kind() { return mode && mode.kind; }, get prog() { return mode ? mode.prog : 0; }, cleanFrac };
}
