// Station: Carbon Arc Welding (اللحام بقوس الكربون)
import * as THREE from 'three';
import { buildHolder, buildClamp, buildPlug, Cable, TABLE_Y, JOINT } from '../models.js';
import { orientTool, mesh } from '../gasparts.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Textures } from '../textures.js';
import { PPE } from '../data.js';
import { ICON } from '../core/icons.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const S = {
  id: 'caw', name: 'اللحام بقوس الكربون', code: 'CAW', icon: ICON.carbon, ready: true,
  stages: [['explore', 'اتعرّف'], ['assemble', 'ركّب'], ['operate', 'شغّل'], ['weld', 'الحم'], ['inspect', 'افحص']]
};
S.parts = [
  { id: 'machine', name: 'مقوّم التيار المستمر', en: 'DC transformer–rectifier', far: 1.1,
    desc: 'ماكينة تقيلة فيها محوّل ومقوّم بيطلّعوا تيار مستمر ثابت. التيار بيتظبط بطارة اليد، والعدّاد بالإبرة بيبيّن الأمبير. القوس بيتولد بين قطب كربون (جرافيت) والشغلانة، والقطب مابيدوبش.',
    facts: ['القطب الكربون بيتوصل على السالب (DCEN) عشان يستهلك أبطأ ومايدخّلش كربون في المعدن.'], safety: 'قوس الكربون أشد إضاءة؛ استخدم عدسة ١٢ على الأقل.' },
  { id: 'sockets', name: 'أطراف التوصيل', en: 'Output terminals', far: 0.45, desc: 'الماسك على السالب والأرضي على الموجب.', facts: ['لو اتعكست القطبية، الكربون بيسخن جداً ويستهلك بسرعة ويتلوّث المعدن بالكربون.'], safety: '' },
  { id: 'holder', name: 'ماسك قطب الكربون', en: 'Carbon electrode holder', far: 0.5,
    desc: 'ماسك تقيل بفكوك نحاس وواقي حراري، بيمسك قطب الكربون من نص طوله تقريباً.', facts: ['طول الكربون الطالع من الماسك حوالي ٥٠–٧٥ مم.'], safety: 'الماسك بيسخن جداً؛ استخدم جوانتي جلد تقيل.' },
  { id: 'carbon', name: 'قطب الكربون (جرافيت)', en: 'Carbon / graphite electrode', far: 0.35,
    desc: 'قطب من الجرافيت، غالباً مطلي نحاس عشان يوصّل التيار أحسن ويستهلك أبطأ. طرفه بيتبرى مخروطي.',
    facts: ['أقطار شائعة: ٦، ٨، ١٠ مم.', 'بيستهلك ببطء بالأكسدة، مش بالانصهار.'], safety: '' },
  { id: 'rods', name: 'سلك الإضافة', en: 'Filler rods', far: 0.4, desc: 'بيتغمس في البركة باليد التانية زي لحام الغاز.', facts: [], safety: '' },
  { id: 'twin', name: 'تورش الكربون المزدوج', en: 'Twin-carbon torch', far: 0.4,
    desc: 'قطبين كربون والقوس بينهم هما الاتنين (تيار متردد)، والشغلانة مش جزء من الدايرة. بيستخدم كمصدر حرارة للحام النحاس والتشكيل واللحام بالمونة.', facts: [], safety: '' },
  { id: 'gouge', name: 'القطع والتشطيف بالكربون والهوا', en: 'Air-carbon arc gouging', far: 0.4,
    desc: 'نفس فكرة القوس الكربوني بس معاه نفث هوا مضغوط بيطرد المعدن المنصهر؛ بنستخدمه لفتح مجاري وإزالة لحامات معيبة.',
    facts: ['بيشتغل على القطبية العكسية DCEP مع ضاغط هوا ٥–٧ بار.'], safety: 'صوت عالي جداً ورذاذ معدن كتير؛ واقي سمع ووش كامل.' },
  { id: 'clamp', name: 'ماسك الأرضي', en: 'Work clamp', far: 0.4, desc: 'متوصّل على الموجب في الطريقة دي.', facts: [], safety: '' },
  { id: 'plates', name: 'قطع الشغل', en: 'Thin sheet 2 mm', far: 0.4, desc: 'صاج رفيع ٢ مم. قوس الكربون مناسب للصاج الرفيع لأن الحرارة أهدى ومنتشرة.', facts: [], safety: '' }
];

let ctxRef, m, holder, carbon, clamp, plugH, plugG, cableH, cableG, cbox, rods, rod, twin, gouge;
const st = { dia: 8, current: 160, power: true, ppe: {} };
const RANGE = { 6: [60, 100], 8: [90, 140], 10: [130, 180] };
const asm = {};
const DLh = V3(1, 0, 0);

function buildCarbon(M) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb87a4b, roughness: 0.35, metalness: 0.9 });
  const body = mesh(new THREE.CylinderGeometry(1, 1, 1, 16), mat); body.rotation.z = Math.PI / 2; g.add(body);
  const tip = mesh(new THREE.ConeGeometry(1, 1, 16), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.8 })); tip.rotation.z = -Math.PI / 2; g.add(tip);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.4), toneMapped: false, transparent: true, opacity: 0 })); g.add(glow);
  g.userData.set = (L, dia) => {
    const r = dia / 2000, tl = r * 3;
    body.scale.set(r, L - tl, r); body.position.x = (L - tl) / 2;
    tip.scale.set(r, tl, r); tip.position.x = L - tl / 2;
    glow.scale.setScalar(r * 1.3); glow.position.x = L - r * 0.5;
    g.userData.L = L;
  };
  g.userData.hot = h => { glow.material.opacity = h; };
  g.userData.set(0.15, 8);
  return g;
}


// Heavy DC rectifier (transformer–rectifier) — visually distinct from the inverter used in SMAW.
function buildRectifier(M) {
  const root = new THREE.Group(); root.position.set(-0.66, 0, 0.0);
  const W = 0.42, H = 0.72, D = 0.52, Y = 0.07;
  const body = new THREE.Group(); body.position.y = Y + H / 2; root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x3f5a4a, roughness: 0.55, metalness: 0.35, clearcoat: 0.25, bumpMap: Textures.paint().bumpMap, bumpScale: 0.7 });
  body.add(mesh(new RoundedBoxGeometry(W, H, D, 3, 0.012), paint));
  // louvers on both sides and top lifting eyes
  const louv = new THREE.MeshStandardMaterial({ color: 0x1b2620, roughness: 0.8 });
  for (let i = 0; i < 12; i++) [1, -1].forEach(sd => { const l = mesh(new THREE.BoxGeometry(0.006, 0.012, D * 0.6), louv, false); l.position.set(sd * (W / 2 + 0.002), H * 0.32 - i * 0.04, 0); l.rotation.z = sd * 0.5; body.add(l); });
  [-1, 1].forEach(sd => { const e = mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 20), M.steel); e.position.set(sd * 0.12, H / 2 + 0.025, 0); body.add(e); });
  // front panel
  const fz = D / 2 + 0.002;
  const panel = mesh(new THREE.BoxGeometry(W - 0.06, H * 0.55, 0.006), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 })); panel.position.set(0, H * 0.12, fz); body.add(panel);
  const plate = Textures.label((c, w, h) => {
    c.fillStyle = '#d8d4c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b2620'; c.textAlign = 'center';
    c.font = '700 34px "IBM Plex Mono", monospace'; c.fillText('DC RECTIFIER 250', w / 2, 46);
    c.font = '600 24px "IBM Plex Sans Arabic", sans-serif'; c.fillText('مقوّم تيار مستمر', w / 2, 82);
    c.font = '600 22px "IBM Plex Sans Arabic", sans-serif'; c.fillText('ضبط التيار', w * 0.72, h - 40); c.fillText('تشغيل', w * 0.24, h - 40);
  }, 512, 400);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, H * 0.55), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.6 })); pl.position.set(0, H * 0.12, fz + 0.0035); body.add(pl);
  // analog ammeter
  const gC = document.createElement('canvas'); gC.width = gC.height = 256; const gT = new THREE.CanvasTexture(gC); gT.colorSpace = THREE.SRGBColorSpace;
  const gx = gC.getContext('2d'); gx.fillStyle = '#f6f3ea'; gx.fillRect(0, 0, 256, 256); gx.strokeStyle = '#1b1d21'; gx.fillStyle = '#1b1d21'; gx.textAlign = 'center';
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.15 + i * 0.07); gx.lineWidth = i % 2 ? 2 : 4; gx.beginPath(); gx.moveTo(128 + Math.cos(a) * 110, 200 + Math.sin(a) * 110); gx.lineTo(128 + Math.cos(a) * (i % 2 ? 98 : 92), 200 + Math.sin(a) * (i % 2 ? 98 : 92)); gx.stroke(); if (!(i % 2)) { gx.font = '600 20px "IBM Plex Mono", monospace'; gx.fillText(String(i * 25), 128 + Math.cos(a) * 76, 206 + Math.sin(a) * 76); } }
  gx.font = '700 26px "IBM Plex Mono", monospace'; gx.fillText('A', 128, 175);
  const face = mesh(new THREE.BoxGeometry(0.13, 0.1, 0.008), [M.blackPlastic, M.blackPlastic, M.blackPlastic, M.blackPlastic, new THREE.MeshStandardMaterial({ map: gT, roughness: 0.3 }), M.blackPlastic]);
  face.position.set(0, H * 0.24, fz + 0.006); body.add(face);
  const bezel = mesh(new THREE.BoxGeometry(0.14, 0.11, 0.004), M.blackPlastic); bezel.position.set(0, H * 0.24, fz + 0.003); body.add(bezel);
  const needle = new THREE.Group(); needle.position.set(0, H * 0.24 - 0.028, fz + 0.011);
  const nd = mesh(new THREE.BoxGeometry(0.0015, 0.05, 0.001), new THREE.MeshStandardMaterial({ color: 0xc0261a }), false, false); nd.position.y = 0.025; needle.add(nd); body.add(needle);
  // handwheel for current (front, right)
  const knob = new THREE.Group(); knob.position.set(0.1, H * 0.02, fz + 0.03);
  const wheel = mesh(new THREE.TorusGeometry(0.05, 0.007, 10, 36), M.darkSteel); knob.add(wheel);
  for (let i = 0; i < 3; i++) { const sp = mesh(new THREE.BoxGeometry(0.1, 0.007, 0.007), M.darkSteel); sp.rotation.z = i * Math.PI / 3; knob.add(sp); }
  const hub = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 16), M.darkSteel); hub.rotation.x = Math.PI / 2; knob.add(hub);
  const grip = mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.04, 12), M.blackPlastic); grip.rotation.x = Math.PI / 2; grip.position.set(0.045, 0.0, 0.02); knob.add(grip);
  body.add(knob);
  // rotary power switch (left) + pilot lamp
  const sw = new THREE.Group(); sw.position.set(-0.1, H * 0.02, fz + 0.012);
  const swBase = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 24), M.blackPlastic); swBase.rotation.x = Math.PI / 2; sw.add(swBase);
  const rocker = mesh(new RoundedBoxGeometry(0.05, 0.014, 0.018, 2, 0.004), new THREE.MeshPhysicalMaterial({ color: 0x8a1d18, roughness: 0.35, clearcoat: 0.5 })); rocker.position.z = 0.012; sw.add(rocker);
  sw.userData.rocker = { rotation: { set x(v) { rocker.rotation.z = v > 0 ? -0.8 : 0.8; } } };
  body.add(sw);
  const ledG = mesh(new THREE.SphereGeometry(0.008, 14, 10), M.ledGreenOff); ledG.position.set(-0.1, H * 0.1, fz + 0.006); body.add(ledG);
  // heavy stud terminals at the bottom
  const sockets = {};
  [['plus', -0.09, true], ['minus', 0.09, false]].forEach(([k, x, red]) => {
    const t = new THREE.Group(); t.position.set(x, -H * 0.36, fz + 0.01);
    const ins = mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.02, 24), red ? M.redPlastic : M.blackPlastic); ins.rotation.x = Math.PI / 2; t.add(ins);
    const stud = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 12), M.brass); stud.rotation.x = Math.PI / 2; stud.position.z = 0.015; t.add(stud);
    const nut = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 6), M.brass); nut.rotation.x = Math.PI / 2; nut.position.z = 0.03; t.add(nut);
    body.add(t); sockets[k] = t;
  });
  const lbl = Textures.label((c, w, h) => { c.clearRect(0, 0, w, h); c.font = '700 80px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#c0261a'; c.fillText('+', 64, 100); c.fillStyle = '#1b1d21'; c.fillText('−', 192, 100); }, 256, 128);
  const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: lbl, transparent: true })); tl.position.set(0, -H * 0.27, fz + 0.002); body.add(tl);
  // under-frame with castors and a tow handle
  const frame = mesh(new THREE.BoxGeometry(W + 0.04, 0.03, D + 0.04), M.tube); frame.position.y = Y - 0.01; root.add(frame);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const w = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), M.rubber); w.rotation.z = Math.PI / 2; w.position.set(sx * (W / 2 - 0.02), 0.035, sz * (D / 2 - 0.03)); root.add(w); });
  const tow = mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 20, Math.PI), M.tube); tow.position.set(0, Y + H * 0.85, -D / 2 - 0.01); tow.rotation.x = Math.PI / 2; tow.rotation.z = Math.PI; root.add(tow);
  // three-phase supply cable to a wall isolator
  const box = mesh(new RoundedBoxGeometry(0.16, 0.22, 0.08, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.5, metalness: 0.4 })); box.position.set(-0.05, 0.9, -1.55); root.add(box);
  const lever = mesh(new THREE.BoxGeometry(0.02, 0.08, 0.03), M.redPlastic); lever.position.set(0.04, 0.92, -1.5); root.add(lever);
  const cordC = new THREE.CatmullRomCurve3([V3(0, Y + 0.2, -D / 2), V3(0.02, 0.06, -D / 2 - 0.15), V3(0.0, 0.015, -0.8), V3(-0.05, 0.015, -1.4), V3(-0.05, 0.4, -1.57), V3(-0.05, 0.79, -1.56)]);
  root.add(mesh(new THREE.TubeGeometry(cordC, 60, 0.011, 10), M.rubber));
  const drawDisplay = (val, on) => { needle.rotation.z = on ? THREE.MathUtils.degToRad(63 - THREE.MathUtils.clamp(val / 250, 0, 1) * 126) : THREE.MathUtils.degToRad(63); };
  return { root, body, knob, disp: face, drawDisplay, sw, sockets, ledG, socketWorld(k) { const v = new THREE.Vector3(); sockets[k].getWorldPosition(v); v.z += 0.025; return v; } };
}

S.build = ctx => {
  ctxRef = ctx;
  const M = ctx.M, R = S.root;
  m = buildRectifier(M); R.add(m.root);
  holder = buildHolder(M); R.add(holder);
  const shield = mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.02, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide })); shield.rotation.z = Math.PI / 2; shield.position.x = 0.02; holder.add(shield);
  carbon = buildCarbon(M); carbon.position.x = 0.045; holder.add(carbon);
  clamp = buildClamp(M); R.add(clamp);
  plugH = buildPlug(M, false); plugG = buildPlug(M, true); R.add(plugH, plugG);
  cableH = new Cable(M); cableG = new Cable(M); R.add(cableH.mesh, cableG.mesh);
  cbox = new THREE.Group();
  const bx = mesh(new THREE.BoxGeometry(0.32, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.7 })); bx.position.y = 0.015; cbox.add(bx);
  for (let i = 0; i < 5; i++) { const c = buildCarbon(M); c.userData.set(0.3, 8); c.position.set(-0.15, 0.036, -0.025 + i * 0.012); cbox.add(c); }
  cbox.position.set(-0.05, TABLE_Y, 0.2); cbox.rotation.y = 0.12; R.add(cbox);
  rods = new THREE.Group();
  for (let i = 0; i < 5; i++) { const r = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.6, 8), M.copper); r.rotation.z = Math.PI / 2; r.position.set(0, 0.0013, i * 0.003); rods.add(r); }
  rods.position.set(0.34, TABLE_Y, -0.2); R.add(rods);
  rod = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 8), M.copper); rod.visible = false; R.add(rod);
  // twin-carbon torch and gouging torch on the shelf (for explanation)
  twin = new THREE.Group();
  const th = mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.14, 18), M.blackPlastic); th.rotation.z = Math.PI / 2; twin.add(th);
  [-1, 1].forEach(s => { const c = buildCarbon(M); c.userData.set(0.12, 6); c.position.set(0.07, 0, s * 0.012); c.rotation.y = s * 0.25; twin.add(c); });
  twin.position.set(0.3, 0.215, 0.06); R.add(twin);
  gouge = new THREE.Group();
  const gh = mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.15, 18), new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.5 })); gh.rotation.z = Math.PI / 2; gouge.add(gh);
  const gHead = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), M.copper); gHead.position.x = 0.09; gouge.add(gHead);
  const gc = buildCarbon(M); gc.userData.set(0.15, 8); gc.position.set(0.1, 0.0, 0); gc.rotation.z = -0.5; gouge.add(gc);
  gouge.position.set(0.5, 0.215, -0.08); R.add(gouge);
  const tag = (o, id) => { o.userData.pick = id; };
  tag(m.body, 'machine'); tag(m.sockets.plus, 'sockets'); tag(m.sockets.minus, 'sockets'); tag(holder, 'holder'); tag(carbon, 'carbon'); tag(clamp, 'clamp'); tag(plugH, 'plugH'); tag(plugG, 'plugG'); tag(cbox, 'cbox'); tag(rods, 'rods'); tag(twin, 'twin'); tag(gouge, 'gouge'); tag(m.sw, 'switch'); tag(cableH.mesh, 'holder'); tag(cableG.mesh, 'clamp');
  S._pick = [m.body, m.sockets.plus, m.sockets.minus, holder, clamp, plugH, plugG, cbox, rods, twin, gouge, m.sw, cableH.mesh, cableG.mesh];
  S.setAssembled(true); setPower(true); updateMachine();
};
S.pickables = () => S._pick;
S.exploreMap = { plugH: 'sockets', plugG: 'sockets', cbox: 'carbon', switch: 'machine' };
S.enter = ctx => ctx.setPlates({ t: 0.002, kind: 'butt' });

const POSE = {
  holderRest: { p: V3(0.66, TABLE_Y + 0.02, 0.21), r: new THREE.Euler(0, Math.PI + 0.25, -0.05) },
  clampOn: { p: V3(0.86, TABLE_Y - 0.006, -0.06), r: new THREE.Euler(0, Math.PI, 0) },
  clampFloor: { p: V3(0.62, 0.018, 0.62), r: new THREE.Euler(Math.PI / 2, 0, 0.6) },
  plugHFloor: { p: V3(-0.3, 0.017, 0.62), r: new THREE.Euler(0, 1.9, 0) },
  plugGFloor: { p: V3(-0.1, 0.017, 0.7), r: new THREE.Euler(0, 1.2, 0) }
};
const ap = (o, p) => { o.position.copy(p.p); o.rotation.copy(p.r); };
const sockW = k => { m.root.updateMatrixWorld(true); return m.socketWorld(k).add(V3(0, 0, 0.012)); };
const anc = (o, l) => { o.updateMatrixWorld(true); return l.clone().applyMatrix4(o.matrixWorld); };
const dirW = (o, l) => { o.updateMatrixWorld(true); return l.clone().transformDirection(o.matrixWorld); };
function updateCables(free) {
  cableH.update(anc(plugH, plugH.userData.cableAnchor), dirW(plugH, V3(0, 0, 1)), anc(holder, holder.userData.cableAnchor), dirW(holder, V3(-1, 0, 0)), { bSide: free ? 'free' : 'table', lipX: 0.6 });
  cableG.update(anc(plugG, plugG.userData.cableAnchor), dirW(plugG, V3(0, 0, 1)), anc(clamp, clamp.userData.cableAnchor), dirW(clamp, V3(-1, 0, 0)), { bSide: asm.clamp ? 'hang' : 'floor' });
}
S.afterMove = () => updateCables();
function setPower(on) { st.power = on; m.sw.userData.rocker.rotation.x = on ? -0.18 : 0.18; m.ledG.material = on ? ctxRef.M.ledGreenOn : ctxRef.M.ledGreenOff; m.drawDisplay(st.current, on); }
function updateMachine() { m.knob.rotation.z = -((st.current - 40) / 160) * Math.PI * 4; m.drawDisplay(st.current, st.power); }
S.setAssembled = all => {
  ['plugH', 'plugG', 'clamp', 'carbon'].forEach(k => asm[k] = all);
  if (all) { plugH.position.copy(sockW('minus')); plugH.rotation.set(0, 0, 0); plugG.position.copy(sockW('plus')); plugG.rotation.set(0, 0, 0); ap(clamp, POSE.clampOn); }
  else { ap(plugH, POSE.plugHFloor); ap(plugG, POSE.plugGFloor); ap(clamp, POSE.clampFloor); }
  ap(holder, POSE.holderRest);
  carbon.visible = all; carbon.userData.set(0.15, st.dia); carbon.userData.hot(0);
  updateCables();
};

S.partObject = id => ({ machine: m.body, sockets: m.sockets.minus, holder, carbon, rods, twin, gouge, clamp, plates: ctxRef.shared.plates }[id]);
S.partHighlight = id => id === 'sockets' ? [m.sockets.plus, m.sockets.minus] : id === 'carbon' ? [carbon, cbox] : [S.partObject(id)];
S.partAnchor = id => {
  const v = new THREE.Vector3();
  switch (id) {
    case 'machine': m.body.localToWorld(v.set(0.15, 0.08, 0)); break;
    case 'sockets': m.sockets.minus.getWorldPosition(v); v.x -= 0.06; break;
    case 'holder': holder.localToWorld(v.set(-0.06, 0, 0)); break;
    case 'carbon': holder.localToWorld(v.set(0.12, 0, 0)); break;
    case 'rods': rods.getWorldPosition(v); break;
    case 'twin': twin.getWorldPosition(v); v.y += 0.02; break;
    case 'gouge': gouge.getWorldPosition(v); v.y += 0.02; break;
    case 'clamp': clamp.getWorldPosition(v); break;
    case 'plates': v.set(0.3, JOINT.y, 0.05); break;
  }
  return v;
};
S.explodeItems = () => [{ o: holder, d: V3(0.04, 0.16, 0.06) }, { o: carbon, d: V3(0.09, 0, 0) }, { o: plugH, d: V3(0, 0.02, 0.12) }, { o: plugG, d: V3(0, 0.02, 0.12) }, { o: clamp, d: V3(0.12, 0.1, 0) }];
S.cams = {
  explore: () => ({ pos: V3(0.62, 1.3, 1.42), target: V3(0.08, 0.55, 0.08) }),
  assemble: () => ({ pos: V3(0.3, 1.32, 1.72), target: V3(0.05, 0.42, 0.18) }),
  operate: () => ({ pos: V3(-0.25, 0.92, 1.3), target: V3(-0.62, 0.48, 0.22) })
};

S.asmSteps = [
  { id: 'power', title: 'اطفي الماكينة', hint: 'المس مفتاح التشغيل.' },
  { id: 'plugH', title: 'وصّل كابل الماسك بالسالب (−)', hint: 'المس فيشة الماسك، وبعدين الطرف المناسب.' },
  { id: 'plugG', title: 'وصّل كابل الأرضي بالموجب (+)', hint: 'المس فيشة الأرضي، وبعدين الطرف الفاضي.' },
  { id: 'clamp', title: 'ثبّت ماسك الأرضي على الطاولة', hint: 'المس ماسك الأرضي.' },
  { id: 'carbon', title: 'ركّب قطب الكربون (مبري مخروطي) وطلّعه ٧٥ مم', hint: 'المس علبة أقطاب الكربون.' }
];
S.asmStart = () => setPower(true);
S.asmTargets = (step, ctx) => {
  const s = S.asmSteps[step]; if (!s) return [];
  const p = ctx.state.asm.picked;
  return { power: [m.sw], plugH: p ? [m.sockets.plus, m.sockets.minus] : [plugH], plugG: p ? [m.sockets.plus] : [plugG], clamp: [clamp], carbon: [cbox] }[s.id];
};
function moveObj(ctx, obj, toP, toR, dur, done0) {
  ctx.state.asm.busy = true; const done = () => { ctx.state.asm.busy = false; done0 && done0(); };
  const p0 = obj.position.clone(), q0 = obj.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(toR);
  ctx.E.tween(dur, k => { const e = ctx.ease(k); obj.position.lerpVectors(p0, toP, e); obj.position.y += Math.sin(Math.PI * e) * 0.1; obj.quaternion.slerpQuaternions(q0, q1, e); updateCables(); }, done);
}
S.asmPick = (id, ctx, r) => {
  const a = ctx.state.asm, s = S.asmSteps[a.step]; if (!s) return;
  if (st.power && s.id !== 'power' && id !== 'switch') return ctx.asmMsg('bad', 'اطفي الماكينة الأول.');
  switch (s.id) {
    case 'power': if (id === 'switch') { setPower(false); ctx.audio.sfx('clunk'); ctx.next('الماكينة مطفية.'); } else ctx.asmMsg('bad', 'اطفي الماكينة الأول.'); break;
    case 'plugH': case 'plugG': {
      const isH = s.id === 'plugH', plug = isH ? plugH : plugG;
      if (!a.picked) { if (id === s.id) { a.picked = true; ctx.asmMsg('info', 'المس الطرف المناسب.'); ctx.E.setHighlight(S.asmTargets(a.step, ctx)); } else ctx.asmMsg('bad', 'المس الفيشة الصح الأول.'); return; }
      if (id !== 'sockets') return ctx.asmMsg('bad', 'المس طرف توصيل.');
      const which = r && r.object === m.sockets.plus ? 'plus' : 'minus';
      if (isH && which === 'plus') return ctx.asmMsg('bad', 'لأ! في لحام الكربون الماسك على السالب (DCEN). على الموجب الكربون هيسخن ويستهلك بسرعة ويلوّث المعدن.');
      if (!isH && which === 'minus') return ctx.asmMsg('bad', 'السالب عليه الماسك. الأرضي على الموجب.');
      a.picked = null; ctx.E.setHighlight([]);
      moveObj(ctx, plug, sockW(which), new THREE.Euler(0, 0, 0), 1, () => { asm[s.id] = true; ctx.audio.sfx('clunk'); ctx.next(isH ? 'الماسك على السالب (DCEN).' : 'الأرضي على الموجب.'); });
      break;
    }
    case 'clamp': if (id === 'clamp') { ctx.E.setHighlight([]); moveObj(ctx, clamp, POSE.clampOn.p, POSE.clampOn.r, 1, () => { asm.clamp = true; updateCables(); ctx.next('ماسك الأرضي متثبّت.'); }); } else ctx.asmMsg('bad', 'المس ماسك الأرضي.'); break;
    case 'carbon': if (id === 'cbox') { carbon.visible = true; carbon.userData.set(0.15, st.dia); asm.carbon = true; ctx.next('قطب الكربون اتركّب وطرفه مبري مخروطي.'); } else ctx.asmMsg('bad', 'المس علبة أقطاب الكربون.'); break;
  }
};
S.asmAuto = ctx => {
  const a = ctx.state.asm, s = S.asmSteps[a.step]; if (!s) return;
  if (s.id === 'power') S.asmPick('switch', ctx);
  else if (s.id === 'plugH' || s.id === 'plugG') { if (!a.picked) S.asmPick(s.id, ctx); S.asmPick('sockets', ctx, { object: s.id === 'plugH' ? m.sockets.minus : m.sockets.plus }); }
  else S.asmPick(s.id === 'clamp' ? 'clamp' : 'cbox', ctx);
};

S.operateEnter = () => updateMachine();
S.operatePick = (id, ctx) => { if (id === 'switch') { setPower(!st.power); ctx.renderPanel(); } };
const status = () => { const [lo, hi] = RANGE[st.dia], c = st.current; return c < lo ? ['low', 'قليل'] : c > hi ? ['high', 'عالي'] : ['ok', 'مظبوط']; };
S.operateHTML = () => {
  const [lo, hi] = RANGE[st.dia], s = status();
  return `
    <section class="card"><h3 class="sm">قطر قطب الكربون</h3><div class="seg3">${[6, 8, 10].map(d => `<button type="button" class="${st.dia === d ? 'on' : ''}" data-op="dia:${d}"><span class="mono">${d}</span> مم</button>`).join('')}</div></section>
    <section class="card"><div class="ph"><h3 class="sm">شدة التيار</h3><span class="tag ${s[0]}">${lo}–${hi} A</span></div>
      <div class="cur-ctl"><button type="button" class="round" data-op="cur-" aria-label="قلّل">${ICON.minus}</button><div class="cur-val"><span class="mono">${st.current}</span><small class="mono">A</small></div><button type="button" class="round acc" data-op="cur+" aria-label="زوّد">${ICON.plus}</button></div>
      <input type="range" min="40" max="200" step="5" value="${st.current}" data-op="current" aria-label="التيار"></section>
    <section class="card"><h3 class="sm">القطبية</h3><p class="small">الكربون على السالب = <b class="mono accent">DCEN</b>. الحرارة الأكبر في الشغلانة، والكربون يستهلك ببطء.</p></section>
    <section class="card"><h3 class="sm">مهمات الوقاية (عدسة ١٢)</h3><div class="ppe">${PPE.map(p => `<button type="button" class="${st.ppe[p.id] ? 'on' : ''}" data-op="ppe:${p.id}">${st.ppe[p.id] ? ICON.check : ICON.shield}${p.id === 'helmet' ? 'ماسك بعدسة ١٢' : p.name}</button>`).join('')}</div></section>
    <button type="button" class="btn ${st.power ? 'on-green' : ''}" data-op="power">${ICON.bolt}${st.power ? 'الماكينة شغالة' : 'شغّل الماكينة'}</button>`;
};
S.operateAction = (op, el, ctx) => {
  if (op === 'range:current') { st.current = +el.value; updateMachine(); clearTimeout(S._t); S._t = setTimeout(() => ctx.renderPanel(), 150); return; }
  if (op.startsWith('dia:')) { st.dia = +op.slice(4); carbon.userData.set(0.15, st.dia); }
  else if (op === 'cur-' || op === 'cur+') st.current = THREE.MathUtils.clamp(st.current + (op === 'cur+' ? 5 : -5), 40, 200);
  else if (op.startsWith('ppe:')) { const k = op.slice(4); st.ppe[k] = !st.ppe[k]; }
  else if (op === 'power') setPower(!st.power);
  ctx.audio.click(); updateMachine(); ctx.renderPanel();
};
S.operateReady = () => {
  const ok = status()[0] === 'ok', ppe = PPE.every(p => st.ppe[p.id]);
  return { ok: ok && ppe && st.power, label: !ppe ? 'البس مهمات الوقاية' : !st.power ? 'شغّل الماكينة' : !ok ? 'اظبط التيار' : 'ابدأ اللحام' };
};

S.weldSettings = () => ({ ...st });
S.weldProc = () => {
  const [lo, hi] = RANGE[st.dia];
  return {
    kind: 'arc', distName: 'طول القوس', angleName: 'زاوية القطب', settingName: 'ضبط التيار', angleShort: 'زاوية القطب',
    ideal: { angle: [60, 75], speed: [1.5, 3.2], dist: [5, 8] }, idealStart: 6.5,
    strikeBelow: 9.5, stickBelow: 1.2, breakAbove: 13, grace: 0.25,
    stickMsg: 'الكربون لمس البركة! ده بيدخّل كربون في المعدن ويخليه هش. ارفع وكمّل.',
    breakMsg: 'القوس طويل جداً واتقطع.',
    consumable: { len: 0.15, min: 0.04, rate: s => (s.current / 120) * 0.35 / 1000, name: 'الكربون', newName: 'كربون جديد', outMsg: 'قطب الكربون قصر. ركّب واحد جديد.', newMsg: 'ركّبت قطب كربون جديد.' },
    fillerLen: 0.6, aux: { label: 'سلك الإضافة', hint: 'اغمس في البركة', icon: ICON.plus },
    spacing: 0.0012, distPerMM: 0.55, relDistPerPx: 0.05, arcColor: 0xfff0d6, arcSize: 0.05, lightIntensity: 0.45, smoke: 3,
    bead: { color: [0.6, 0.58, 0.55], hot: [3, 1.4, 0.4], metal: 0.7, rough: 0.45, tint: (r, i, n, c) => c.setRGB(0.5, 0.48, 0.46) },
    dims: s => {
      const heat = THREE.MathUtils.clamp((s.settings.current - lo) / (hi - lo), -0.6, 1.6), sp = THREE.MathUtils.clamp(s.speed || 2.2, 0.5, 8);
      return { w: THREE.MathUtils.clamp(6.5 * (0.85 + heat * 0.25) * Math.pow(2.2 / sp, 0.4), 3.5, 11), h: s.aux ? 1.2 : 0.35, wobble: 0.8 };
    },
    flags: s => ({ spatter: s.dist > 9 ? 0.2 : 0, pore: s.dist > 10 ? 0.12 : 0, undercut: (s.speed > 4 || s.settings.current > hi + 5) ? 0.4 : 0 }),
    sparks: () => 25, poolMM: () => 6,
    settingScore: set => ({ v: set.current >= lo && set.current <= hi ? 100 : Math.max(30, 100 - (set.current < lo ? lo - set.current : set.current - hi) * 2) }),
    penetration: set => THREE.MathUtils.clamp(((set.current - lo) / (hi - lo)) * 0.5 + 0.7, 0.3, 1.3),
    defects: c => {
      const out = [];
      if (c.events.stuck) out.push({ name: 'تكربن المعدن', en: 'Carbon pickup', cause: 'الكربون لمس البركة ' + c.AR(c.events.stuck) + ' مرة.', fix: 'حافظ على طول قوس ٥–٨ مم.' });
      if (c.count('nofill')) out.push({ name: 'نقص امتلاء', en: 'Underfill', cause: 'ماضفتش سلك كفاية.', fix: 'اغمس السلك بانتظام.' });
      if (c.count('fast')) out.push({ name: 'عدم انصهار', en: 'Lack of fusion', cause: 'السرعة عالية.', fix: 'بطّأ.' });
      if (c.count('long')) out.push({ name: 'قوس طويل وغير مستقر', en: 'Wandering arc', cause: 'القوس أطول من ٨ مم.', fix: 'قرّب الكربون.' });
      if (st.current > hi) out.push({ name: 'سيحان الصاج', en: 'Burn-through', cause: 'التيار عالي على صاج ٢ مم.', fix: 'قلّل التيار.' });
      return out;
    },
    hint: 'المس بداية الوصلة واسحب ببطء. القوس هنا أطول من القطب المعدني (٥–٨ مم). اغمس السلك بالزرار.'
  };
};
S.hud = ctx => {
  const w = ctx.state.weld, sim = ctx.sim, [lo, hi] = RANGE[st.dia];
  return [
    { id: 'angle', label: 'زاوية القطب', hint: '60–75°', get: () => ({ val: ctx.state.angle, txt: ctx.state.angle + '°', min: 30, max: 90, lo: 60, hi: 75 }) },
    { id: 'speed', label: 'سرعة التقدّم', hint: '1.5–3.2 mm/s', get: o => ({ val: sim.on ? o.speed : null, txt: sim.on ? o.speed.toFixed(1) : '--', min: 0, max: 7, lo: 1.5, hi: 3.2 }) },
    { id: 'dist', label: 'طول القوس', hint: '5–8 مم', get: () => ({ val: w.pressing ? w.eff : null, txt: w.pressing ? (w.eff ?? 0).toFixed(1) + ' mm' : '--', min: 0, max: 13, lo: 5, hi: 8 }) },
    { id: 'cur', label: 'التيار', bar: false, hint: lo + '–' + hi + ' A', get: () => ({ txt: st.current + ' A' }) }
  ];
};
S.coach = (ctx, o) => {
  const w = ctx.state.weld;
  if (o.speed > 3.8) return 'بطّأ';
  if (o.speed < 1 && ctx.sim.time > 2) return 'اتحرك شوية';
  if (w.eff > 8.6) return 'القوس طويل، قرّب';
  if (w.eff < 4.4) return 'القوس قصير، الكربون قرب يلمس';
  if (ctx.sim.time > 3 && !w.aux && Math.random() < 0.015) return 'اغمس سلك الإضافة';
  return null;
};
let tick = 0;
S.weldEnter = ctx => { S.enter(ctx); ctx.state.angle = 68; rod.visible = true; carbon.userData.set(0.15, st.dia); ctx.resetTip(JOINT.x0 - 0.02, JOINT.y + 0.03); if (!st.power) setPower(true); };
S.weldPose = (ctx, tip) => {
  const a = THREE.MathUtils.degToRad(ctx.state.angle), L = ctx.sim.consumable;
  carbon.userData.set(L, st.dia); carbon.userData.hot(ctx.sim.on ? 1 : 0);
  const dir = V3(-Math.cos(a), Math.sin(a), 0.2).normalize();   // from tip back to holder (drag)
  orientTool(holder, DLh, V3(0, 1, 0), dir.clone().negate(), V3(0, 1, 0.2));
  holder.position.copy(tip).addScaledVector(dir, 0.045 + L);
  const w = ctx.state.weld, dip = w.aux && w.pressing;
  const rt = V3(tip.x + 0.005, JOINT.y + (dip ? 0.001 : 0.007), JOINT.z + 0.003), rdir = V3(0.75, 0.35, 0.55).normalize();
  rod.quaternion.setFromUnitVectors(V3(0, 1, 0), rdir); rod.scale.y = Math.max(0.05, ctx.sim.filler || 0.6); rod.position.copy(rt).addScaledVector(rdir, rod.scale.y / 2);
  if ((tick++ & 1) === 0) updateCables(true);
};
S.weldExit = () => { rod.visible = false; ap(holder, POSE.holderRest); carbon.userData.hot(0); updateCables(); };
S.inspectEnter = () => { ap(holder, POSE.holderRest); updateCables(); };

export default S;
