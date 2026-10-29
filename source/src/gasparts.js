// Gas equipment shared by OAW / TIG / MIG stations: cylinders, regulators with live gauges, flowmeters, hoses, flames.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Textures } from './textures.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, cast = true, receive = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; }

// ---------- gas cylinder (origin at floor, valve outlet points +X)
export function buildCylinder(M, o) {
  const g = new THREE.Group();
  const H = o.h, R = o.r;
  const prof = [[0, 0.0], [R * 0.85, 0.0], [R, 0.03], [R, H - R * 1.2], [R * 0.9, H - R * 0.6], [R * 0.6, H - R * 0.2], [R * 0.28, H - 0.01], [R * 0.25, H]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48);
  const paint = new THREE.MeshPhysicalMaterial({ color: o.color, roughness: 0.45, metalness: 0.25, clearcoat: 0.4, clearcoatRoughness: 0.35, bumpMap: Textures.paint().bumpMap, bumpScale: 0.5 });
  const body = mesh(geo, paint); g.add(body);
  if (o.shoulder != null) {
    const sh = mesh(new THREE.CylinderGeometry(R * 0.905, R * 1.002, R * 0.45, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: o.shoulder, roughness: 0.4, clearcoat: 0.4 }));
    sh.position.y = H - R * 0.75; g.add(sh);
  }
  // label band
  const lbl = Textures.label((c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(240,240,235,.92)'; c.fillRect(0, 40, w, 176);
    c.fillStyle = '#1b1e23'; c.textAlign = 'center';
    c.font = '700 70px "IBM Plex Sans Arabic", sans-serif'; c.fillText(o.labelAr, w / 2, 130);
    c.font = '600 50px "IBM Plex Mono", monospace'; c.fillText(o.labelEn, w / 2, 196);
  }, 512, 256);
  const band = mesh(new THREE.CylinderGeometry(R * 1.004, R * 1.004, 0.16, 48, 1, true, -0.7, 1.4), new THREE.MeshStandardMaterial({ map: lbl, transparent: true, roughness: 0.6 }), false, false);
  band.position.y = H * 0.62; band.rotation.y = Math.PI / 2; g.add(band);
  // foot ring
  const foot = mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.04, 40, 1, true), M.darkSteel); foot.position.y = 0.02; g.add(foot);
  // valve
  const v = new THREE.Group(); v.position.y = H;
  const stem = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 20), M.brass); stem.position.y = 0.035; v.add(stem);
  const blk = mesh(new RoundedBoxGeometry(0.05, 0.05, 0.045, 2, 0.008), M.brass); blk.position.y = 0.085; v.add(blk);
  const outlet = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.04, 16), M.brass); outlet.rotation.z = Math.PI / 2; outlet.position.set(0.038, 0.08, 0); v.add(outlet);
  const handle = new THREE.Group(); handle.position.y = 0.13;
  if (o.valve === 'key') {
    const sq = mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), M.steel); sq.position.y = 0.0; handle.add(sq);
    const key = mesh(new THREE.BoxGeometry(0.11, 0.012, 0.014), M.darkSteel); key.position.y = 0.018; handle.add(key);
  } else {
    const wheel = mesh(new THREE.TorusGeometry(0.03, 0.006, 10, 28), new THREE.MeshStandardMaterial({ color: o.wheel || 0x2a2d33, roughness: 0.5, metalness: 0.4 }));
    wheel.rotation.x = Math.PI / 2; handle.add(wheel);
    for (let i = 0; i < 3; i++) { const sp = mesh(new THREE.BoxGeometry(0.058, 0.005, 0.006), wheel.material); sp.rotation.y = i * Math.PI / 3; handle.add(sp); }
    const hub = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.018, 12), M.brass); handle.add(hub);
  }
  v.add(handle);
  g.add(v);
  g.userData = { valve: handle, outletLocal: V3(0.058, H + 0.08, 0), H, R };
  return g;
}

// ---------- dial gauge face texture
function gaugeTex(max, unit, red, label) {
  return Textures.label((c, w, h) => {
    const cx = w / 2, cy = h / 2, R = w * 0.46;
    c.fillStyle = '#f4f2ea'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    if (red != null) { c.strokeStyle = '#d23a2a'; c.lineWidth = 14; c.beginPath(); c.arc(cx, cy, R * 0.82, a0 + (a1 - a0) * (red / max), a1); c.stroke(); }
    c.strokeStyle = '#1c1f24'; c.fillStyle = '#1c1f24'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * i / 10, r1 = R * 0.86, r2 = R * (i % 2 ? 0.78 : 0.72);
      c.lineWidth = i % 2 ? 3 : 5; c.beginPath(); c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); c.stroke();
      if (!(i % 2)) { c.font = '600 30px "IBM Plex Mono", monospace'; const v = max * i / 10; c.fillText(v % 1 ? v.toFixed(1) : v, cx + Math.cos(a) * R * 0.56, cy + Math.sin(a) * R * 0.56); }
    }
    c.font = '600 28px "IBM Plex Mono", monospace'; c.fillText(unit, cx, cy + R * 0.42);
    c.font = '600 26px "IBM Plex Sans Arabic", sans-serif'; c.fillText(label, cx, cy - R * 0.32);
  }, 256, 256);
}

function buildGauge(M, max, unit, red, label) {
  const g = new THREE.Group();
  const shell = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 32), M.darkSteel); shell.rotation.x = Math.PI / 2; g.add(shell);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.027, 40), new THREE.MeshStandardMaterial({ map: gaugeTex(max, unit, red, label), roughness: 0.4 }));
  face.position.z = 0.0112; g.add(face);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.028, 40), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, clearcoat: 1 }));
  glass.position.z = 0.0122; g.add(glass);
  const needle = new THREE.Group(); needle.position.z = 0.0116;
  const nm = mesh(new THREE.BoxGeometry(0.0018, 0.022, 0.0008), new THREE.MeshStandardMaterial({ color: 0xc0261a, roughness: 0.4 }), false, false); nm.position.y = 0.009; needle.add(nm);
  const hubm = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.002, 12), M.darkSteel, false, false); hubm.rotation.x = Math.PI / 2; needle.add(hubm);
  g.add(needle);
  g.userData.set = v => { const k = THREE.MathUtils.clamp(v / max, 0, 1.02); needle.rotation.z = THREE.MathUtils.degToRad(135 - k * 270); };
  g.userData.set(0);
  return g;
}

// ---------- pressure regulator with two gauges (inlet at origin, body extends +X, outlet +X end)
export function buildRegulator(M, o) {
  const g = new THREE.Group();
  const nut = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 6), M.brass); nut.rotation.z = Math.PI / 2; nut.position.x = 0.011; g.add(nut);
  if (o.leftHand) for (let i = 0; i < 6; i++) { const n = mesh(new THREE.BoxGeometry(0.004, 0.003, 0.03), M.darkSteel, false); n.position.set(0.011, 0.012 * Math.cos(i), 0.012 * Math.sin(i)); n.rotation.x = i; g.add(n); }
  const neck = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 16), M.brass); neck.rotation.z = Math.PI / 2; neck.position.x = 0.04; g.add(neck);
  const bodyMat = new THREE.MeshStandardMaterial({ color: o.color ?? 0xc9a25a, roughness: 0.32, metalness: 0.95 });
  const body = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 32), bodyMat); body.rotation.x = Math.PI / 2; body.position.set(0.085, 0, 0); g.add(body);
  const bonnet = mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.035, 32), new THREE.MeshPhysicalMaterial({ color: o.tint ?? 0x1d4f8f, roughness: 0.35, clearcoat: 0.6 })); bonnet.rotation.x = Math.PI / 2; bonnet.position.set(0.085, 0, 0.04); g.add(bonnet);
  const screw = new THREE.Group(); screw.position.set(0.085, 0, 0.066);
  const sStem = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 12), M.steel); sStem.rotation.x = Math.PI / 2; screw.add(sStem);
  const tbar = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.07, 12), M.blackPlastic); tbar.rotation.z = Math.PI / 2; tbar.position.z = 0.016; screw.add(tbar);
  g.add(screw);
  const hp = buildGauge(M, o.hpMax ?? 300, 'bar', null, 'المحتوى'); hp.position.set(0.085, 0.058, -0.004); hp.rotation.y = 0; g.add(hp);
  const lp = buildGauge(M, o.lpMax ?? 10, 'bar', o.lpRed, 'التشغيل'); lp.position.set(0.15, 0.0, 0.0); lp.rotation.y = -Math.PI / 2 + 0.35; g.add(lp);
  // the low pressure gauge faces the viewer: rotate to face +Z
  lp.rotation.set(0, 0, 0); lp.position.set(0.085, -0.06, 0.0);
  const out = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 16), M.brass); out.rotation.z = Math.PI / 2; out.position.set(0.135, 0, 0); g.add(out);
  g.userData = { hp: hp.userData, lp: lp.userData, screw, outletLocal: V3(0.152, 0, 0) };
  return g;
}

// ---------- flowmeter regulator (argon / CO2): one content gauge + glass tube with float ball
export function buildFlowmeter(M, o = {}) {
  const g = new THREE.Group();
  const nut = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 6), M.brass); nut.rotation.z = Math.PI / 2; nut.position.x = 0.011; g.add(nut);
  const body = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 28), new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.32, metalness: 0.95 })); body.rotation.x = Math.PI / 2; body.position.x = 0.06; g.add(body);
  const hp = buildGauge(M, 300, 'bar', null, 'المحتوى'); hp.position.set(0.06, 0, 0.034); g.add(hp);
  const tube = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 20), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, roughness: 0.05, transparent: true, opacity: 0.35, thickness: 0.004 }), false, false);
  tube.position.set(0.11, 0.06, 0); g.add(tube);
  const capT = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), M.brass); capT.position.set(0.11, 0.115, 0); g.add(capT);
  const capB = capT.clone(); capB.position.y = 0.005; g.add(capB);
  const scale = Textures.label((c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#e8eef5'; c.font = '600 22px "IBM Plex Mono", monospace'; c.textAlign = 'right'; for (let i = 0; i <= 5; i++) { const y = h - 20 - i * (h - 40) / 5; c.fillRect(w - 40, y - 1, 40, 3); c.fillText(String(i * 5), w - 48, y + 8); } c.fillText('L/min', w - 4, 18); }, 128, 256);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.1), new THREE.MeshBasicMaterial({ map: scale, transparent: true })); sc.position.set(0.096, 0.06, 0.006); g.add(sc);
  const ball = mesh(new THREE.SphereGeometry(0.0055, 16, 12), new THREE.MeshStandardMaterial({ color: 0x24c28a, roughness: 0.3 }), false, false); ball.position.set(0.11, 0.015, 0); g.add(ball);
  const knob = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 16), M.blackPlastic); knob.rotation.x = Math.PI / 2; knob.position.set(0.11, 0.0, 0.016); g.add(knob);
  const out = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 12), M.brass); out.rotation.z = Math.PI / 2; out.position.set(0.13, -0.004, 0); g.add(out);
  g.userData = { hp: hp.userData, setFlow: f => { ball.position.y = 0.015 + THREE.MathUtils.clamp(f / 25, 0, 1) * 0.088; }, outletLocal: V3(0.145, -0.004, 0) };
  return g;
}

// ---------- flame (oxy-acetylene). Built along local -Y (pointing out of the torch tip).
export function buildFlame() {
  const g = new THREE.Group();
  const add = (geo, color, opacity) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); g.add(m); return m; };
  const cone = new THREE.ConeGeometry(1, 1, 24, 1, true); cone.translate(0, -0.5, 0); cone.rotateX(Math.PI);
  // geometry now spans y 0..-1 with the tip at -1
  const inner = add(cone.clone(), new THREE.Color(3.2, 4.2, 6.5), 0.95);
  const feather = add(cone.clone(), new THREE.Color(1.6, 1.7, 2.2), 0.35);
  const env = add(cone.clone(), new THREE.Color(0.25, 0.45, 1.6), 0.28);
  const envTip = add(cone.clone(), new THREE.Color(1.6, 0.6, 0.15), 0.18);
  const jet = add(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, -0.5, 0), new THREE.Color(3, 3.4, 4), 0.55);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Textures.glowSprite(), color: new THREE.Color(0.6, 0.8, 1.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  glow.scale.setScalar(0.02); g.add(glow);
  g.visible = false;
  // ratio: oxygen/acetylene (≈1 neutral). size: overall flow. cut: cutting jet on
  g.userData.set = (ratio, size = 1, cut = false) => {
    const r = THREE.MathUtils.clamp(ratio, 0.4, 1.8), s = THREE.MathUtils.clamp(size, 0.2, 1.6);
    const ic = (r > 1.1 ? 0.0045 - (r - 1.1) * 0.004 : 0.0055) * s;   // oxidizing → short pointed cone
    inner.scale.set(0.0012 * s, Math.max(0.0018, ic), 0.0012 * s);
    const fl = r < 0.95 ? (0.95 - r) * 0.06 * s : 0;                   // carburizing → acetylene feather
    feather.visible = fl > 0.001; feather.scale.set(0.0022 * s, ic + fl, 0.0022 * s);
    const el = (0.045 - Math.max(0, r - 1) * 0.02) * s;
    env.scale.set(0.006 * s, el, 0.006 * s); envTip.scale.set(0.009 * s, el * 1.15, 0.009 * s);
    jet.visible = cut; jet.scale.set(0.0009, 0.05, 0.0009);
    glow.position.y = -ic; glow.scale.setScalar(0.025 * s);
    g.userData.ratio = r;
  };
  g.userData.flicker = t => { const f = 0.94 + Math.sin(t * 40) * 0.03 + Math.random() * 0.04; env.scale.x = env.scale.z = env.scale.x * 0.98 + 0.006 * f * 0.02 + env.scale.x * 0.0; envTip.material.opacity = 0.14 + Math.random() * 0.06; inner.material.opacity = 0.9 + Math.random() * 0.1; };
  g.userData.set(1, 1, false);
  return g;
}

export function flameType(r) { return r < 0.92 ? 'carb' : r > 1.12 ? 'oxid' : 'neutral'; }
export const FLAME_NAMES = { carb: 'لهب مكربن (زيادة أسيتيلين)', neutral: 'لهب متعادل', oxid: 'لهب مؤكسد (زيادة أكسجين)' };
export { mesh, V3 };

// Orient a tool so that its local tip direction `dl` points along world `dw`, with local `ul` towards world `uw`.
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
export function orientTool(obj, dl, ulRef, dw, uwRef) {
  const ul = ulRef.clone().sub(dl.clone().multiplyScalar(ulRef.dot(dl))).normalize();
  const d = dw.clone().normalize();
  const uw = uwRef.clone().sub(d.clone().multiplyScalar(uwRef.dot(d))).normalize();
  _m1.makeBasis(dl, ul, dl.clone().cross(ul)); _m2.makeBasis(d, uw, d.clone().cross(uw));
  _m2.multiply(_m1.transpose());
  obj.quaternion.setFromRotationMatrix(_m2);
}

// Generic inverter machine box with a printed front panel (used for TIG / MIG)
export function buildInverter(M, o) {
  const root = new THREE.Group();
  const W = o.w, H = o.h, D = o.d;
  const body = new THREE.Group(); body.position.y = o.y + H / 2;
  const shellMat = new THREE.MeshPhysicalMaterial({ color: o.color, roughness: 0.42, metalness: 0.2, clearcoat: 0.35, bumpMap: Textures.paint().bumpMap, bumpScale: 0.5 });
  const shell = mesh(new RoundedBoxGeometry(W, H, D, 4, 0.016), shellMat); body.add(shell);
  const bez = mesh(new RoundedBoxGeometry(W + 0.006, H + 0.006, 0.03, 3, 0.01), M.blackPlastic); bez.position.z = D / 2 - 0.01; body.add(bez);
  const panel = mesh(new THREE.BoxGeometry(W - 0.03, H - 0.03, 0.004), M.panel); panel.position.z = D / 2 + 0.006; body.add(panel);
  const gfx = Textures.label((c, w, h) => { c.clearRect(0, 0, w, h); o.draw(c, w, h); }, 512, Math.round(512 * (H - 0.03) / (W - 0.03)));
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, H - 0.03), new THREE.MeshStandardMaterial({ map: gfx, transparent: true, roughness: 0.6 }));
  gp.position.z = D / 2 + 0.0085; body.add(gp);
  const fx = u => (u - 0.5) * (W - 0.03), fy = v => (0.5 - v) * (H - 0.03), fz = D / 2 + 0.01;
  // handle
  const hc = new THREE.CatmullRomCurve3([V3(0, 0, -D * 0.3), V3(0, 0.05, -D * 0.25), V3(0, 0.06, 0), V3(0, 0.05, D * 0.25), V3(0, 0, D * 0.3)]);
  const handle = mesh(new THREE.TubeGeometry(hc, 30, 0.012, 12), M.blackPlastic); handle.position.y = H / 2; body.add(handle);
  for (let i = 0; i < 8; i++) [1, -1].forEach(s => { const v = mesh(new THREE.BoxGeometry(0.002, 0.008, D * 0.3), new THREE.MeshStandardMaterial({ color: 0x0d0f12 }), false, false); v.position.set(s * (W / 2 + 0.0005), H * 0.2 - i * 0.022, -D * 0.1); body.add(v); });
  root.add(body);
  // cart
  if (o.cart) {
    const deck = mesh(new THREE.BoxGeometry(W + 0.08, 0.02, D + 0.08), M.tube); deck.position.y = o.y - 0.01; root.add(deck);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const wh = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24), M.rubber); wh.rotation.z = Math.PI / 2; wh.position.set(sx * (W / 2), 0.045, sz * (D / 2 - 0.02)); root.add(wh); });
    [-1, 1].forEach(s => { const p = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 12), M.tube); p.position.set(s * (W / 2 + 0.02), 0.45, -D / 2 - 0.03); root.add(p); });
  }
  // display
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 128;
  const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
  const dm = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: dt, emissiveIntensity: 1.4, roughness: 0.15 });
  const disp = mesh(new THREE.BoxGeometry(o.dispW || 0.09, 0.045, 0.004), [M.blackPlastic, M.blackPlastic, M.blackPlastic, M.blackPlastic, dm, M.blackPlastic], false, false);
  disp.position.set(fx(o.dispUV[0]), fy(o.dispUV[1]), fz); body.add(disp);
  const draw = (txt, on, color = '#7cd4ff') => { const c = dc.getContext('2d'); c.fillStyle = '#030405'; c.fillRect(0, 0, 256, 128); c.textAlign = 'right'; c.font = '600 84px "IBM Plex Mono", monospace'; c.fillStyle = '#0c1a22'; c.fillText('888', 236, 100); if (on) { c.fillStyle = color; c.fillText(txt, 236, 100); } dt.needsUpdate = true; };
  draw('', false);
  const knobs = (o.knobs || []).map(([u, v]) => {
    const k = new THREE.Group();
    const kb = mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.022, 40), M.knob); kb.rotation.x = Math.PI / 2; k.add(kb);
    const pt = mesh(new THREE.BoxGeometry(0.003, 0.013, 0.002), new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xff8a2b, emissiveIntensity: 0.4 })); pt.position.set(0, 0.01, 0.012); k.add(pt);
    k.position.set(fx(u), fy(v), fz + 0.01); body.add(k); return k;
  });
  const sockets = {};
  (o.sockets || []).forEach(([key, u, v, red]) => {
    const s = new THREE.Group();
    const ring = mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.016, 32), red ? M.redPlastic : M.blackPlastic); ring.rotation.x = Math.PI / 2; s.add(ring);
    const core = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.018, 24), M.brass); core.rotation.x = Math.PI / 2; core.position.z = 0.002; s.add(core);
    s.position.set(fx(u), fy(v), fz); body.add(s); sockets[key] = s;
  });
  const sw = new THREE.Group();
  const swb = mesh(new THREE.BoxGeometry(0.03, 0.044, 0.008), M.blackPlastic); sw.add(swb);
  const rocker = mesh(new THREE.BoxGeometry(0.024, 0.038, 0.01), new THREE.MeshPhysicalMaterial({ color: 0x8a1d18, roughness: 0.3, clearcoat: 0.6 })); rocker.position.z = 0.006; sw.add(rocker);
  sw.position.set(fx(o.swUV[0]), fy(o.swUV[1]), fz); body.add(sw); sw.userData.rocker = rocker;
  const led = mesh(new THREE.SphereGeometry(0.004, 12, 10), M.ledGreenOff); led.position.set(fx(o.ledUV[0]), fy(o.ledUV[1]), fz); body.add(led);
  return { root, body, disp, draw, knobs, sockets, sw, led, socketWorld(k) { const v = new THREE.Vector3(); sockets[k].getWorldPosition(v); return v; } };
}
