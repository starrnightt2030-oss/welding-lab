// Hands-on cleaning with the real tools: wire-brush the joint before welding (rust / mill scale),
// chip the slag off with the chipping hammer after welding, then brush the bead.
import * as THREE from 'three';
import { JOINT } from '../models.js';

export function createCleaning({ E, audio, sim, hammer, brush, onChange, workFrame }) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let mode = null;          // { kind: 'pre' | 'chip' | 'post', prog }
  let saved = null, swing = 0, scrub = 0, pressed = false, lastX = null, overTool = false;

  // ---- rust / mill-scale layer over the joint area (painted away by brushing)
  const GW = 64, GH = 16, cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const dirt = new Float32Array(GW * GH);
  // the layer follows the real surfaces of each joint (taper of a thicker plate, the step of a lap, the web of a tee)
  // and lives in the work frame, so it stays on the piece when it is mounted in a welding position
  const rustMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
  const rust = new THREE.Group(); rust.visible = false; rust.renderOrder = 2; (workFrame || E.scene).add(rust);
  const RX0 = () => JOINT.x0 - 0.012, RX1 = () => JOINT.x1 + 0.012, RZ = 0.032;
  const vOf = z => (z - (JOINT.z - RZ)) / (2 * RZ);
  function strip(pts) {   // pts: rows of [y, z, v] across the joint; columns span x
    const pos = [], uv = [], idx = [], x0 = RX0(), x1 = RX1();
    pts.forEach(([y, z, v]) => { pos.push(x0, y, z, x1, y, z); uv.push(0, v, 1, v); });
    for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rustMat); m.renderOrder = 2; return m;
  }
  function layoutRust() {
    rust.children.slice().forEach(m => { rust.remove(m); m.geometry.dispose(); });
    const Z = JOINT.z, N = 64, top = [], lift = 0.0004;
    for (let i = 0; i <= N; i++) { const z = Z - RZ + (2 * RZ) * i / N; top.push([(JOINT.surf ? JOINT.surf(z) : JOINT.y) + lift, z, vOf(z)]); }
    rust.add(strip(top));
    if (JOINT.kind === 'tee') {   // mill scale on the face of the web too, cleaned together with the corner
      const w = [];
      for (let i = 0; i <= 8; i++) { const h = 0.032 * i / 8; w.push([JOINT.y + h, Z + lift, vOf(Z + 0.008) + (i / 8) * (vOf(Z + 0.02) - vOf(Z + 0.008))]); }
      rust.add(strip(w));
    }
  }
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
    dirt.fill(1); tex.needsUpdate = true; layoutRust(); painted = true;
  }
  let painted = false;
  // which rows of the dirt grid lie on surfaces the brush can reach (behind a tee's web is out of reach)
  const rowOK = y => { const v = 1 - y / (GH - 1); return JOINT.kind === 'tee' ? v > 0.56 && v < 0.98 : v > 0.12 && v < 0.9; };
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
  const cleanFrac = () => { let s = 0, n = 0; for (let y = 0; y < GH; y++) { if (!rowOK(y)) continue; for (let x = 2; x < GW - 2; x++) { s += dirt[y * GW + x]; n++; } } return n ? 1 - s / n : 1; };

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
    if (kind === 'pre') { if (!painted) paintRust(); rust.visible = true; }
    pose(null, true);
    const tool = kind === 'chip' ? hammer : brush;
    tool.position.set(0.3, JOINT.y + 0.03, JOINT.z + 0.03); tool.rotation.set(0, kind === 'chip' ? Math.PI * 0.8 : -0.4, kind === 'chip' ? 0 : 0.32); tool.scale.setScalar(kind === 'chip' ? 0.7 : 0.45);
    E.controls.enabled = false; update();
  }
  function stop() { if (!mode) return; mode = null; pose(null, false); E.controls.enabled = true; pressed = false; }
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
    const x = THREE.MathUtils.clamp(p.x, JOINT.x0 - 0.02, JOINT.x1 + 0.02), z = THREE.MathUtils.clamp(p.z, JOINT.kind === 'tee' ? JOINT.z + 0.012 : JOINT.z - 0.03, JOINT.z + 0.04);
    if (mode.kind === 'chip') {
      tool.position.set(x, JOINT.y + 0.1 + (pressed ? 0 : 0.02), JOINT.z + 0.004);
      if (phase === 'down') { swing = 1; strike(x); }
    } else {
      tool.position.set(x, (JOINT.surf ? JOINT.surf(z) : JOINT.y) + 0.003 + 0.07 * 0.45 * Math.sin(0.32), z);
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
    } else if (pressed) { brush.rotation.z = 0.32 + Math.sin(performance.now() / 45) * 0.04; }
  }
  // fresh rusty plates (new exercise) / show what is left on the piece / hide
  function freshRust() { paintRust(); }
  function showRust(on) { if (on && !painted) paintRust(); rust.visible = !!on; }
  return { start, stop, skip, pointer, frame, freshRust, showRust, get active() { return !!mode; }, get kind() { return mode && mode.kind; }, get prog() { return mode ? mode.prog : 0; }, cleanFrac };
}
