// Station: MIG / MAG (اللحام بالسلك المستمر والغاز الواقي)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildClamp, buildPlug, Cable, TABLE_Y, JOINT } from '../models.js';
import { buildCylinder, buildFlowmeter, buildInverter, orientTool, mesh } from '../gasparts.js';
import { Textures } from '../textures.js';
import { ICON } from '../core/icons.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function makeWire(VAR) {
const CO2 = VAR === 'co2';
const S = {
  id: CO2 ? 'co2' : 'mig', name: CO2 ? 'اللحام بثاني أكسيد الكربون' : 'اللحام بالسلك والغاز الخامل', code: CO2 ? 'CO₂ / MAG' : 'MIG', icon: ICON.mig, ready: true,
  stages: [['explore', 'اتعرّف'], ['assemble', 'ركّب'], ['operate', 'شغّل'], ['weld', 'الحم'], ['inspect', 'افحص']]
};
S.parts = [
  { id: 'machine', name: CO2 ? 'ماكينة لحام CO₂' : 'ماكينة MIG', en: CO2 ? 'CO₂ welding power source (CV)' : 'MIG power source (CV)', far: 1.0,
    desc: 'ماكينة جهد ثابت (CV)، فيها وحدة تغذية سلك بتسحب السلك من البكرة وتدفعه في التورش بسرعة ثابتة.',
    facts: ['MIG = غاز خامل (أرجون) للألومنيوم. MAG = غاز نشط (CO₂ أو خليط أرجون + CO₂) للصلب.'], safety: 'افصل الكهربا قبل ما تفتح باب البكرة.' },
  { id: 'panel', name: 'منظّم الجهد وسرعة السلك', en: 'Voltage & wire-feed speed', far: 0.42,
    desc: 'الجهد بيحدد طول القوس وعرض الخط، وسرعة السلك بتحدد التيار وكمية المعدن. لازم الاتنين يكونوا متناسبين.',
    facts: ['جهد قليل مع سرعة سلك عالية: السلك بيخبط في الشغلانة (تخبيط).', 'جهد عالي مع سرعة قليلة: قوس طويل ورذاذ كتير.'], safety: '' },
  { id: 'spool', name: 'بكرة السلك', en: 'Wire spool', far: 0.45,
    desc: 'بكرة سلك صلب مطلي نحاس (ER70S-6) قطر ٠٫٨ أو ١ مم.', facts: ['البكرة لازم تلف بحرية، والفرامل بتمنعها تفك لوحدها.'], safety: '' },
  { id: 'drive', name: 'وحدة تغذية السلك', en: 'Wire drive rolls', far: 0.35,
    desc: 'بكرتين بيضغطوا على السلك ويدفعوه. مجرى البكرة لازم يناسب قطر السلك.', facts: ['ضغط زيادة يفرطح السلك، وضغط قليل يخليه يتزحلق.'], safety: 'ماتحطش صباعك قرب البكر وهو بيلف.' },
  { id: 'torch', name: 'تورش MIG', en: 'MIG torch (gun)', far: 0.4, view: V3(0.3, 0.5, 1),
    desc: 'فيه زناد (زرار) بيشغّل السلك والغاز والتيار مع بعض، ورقبة منحنية، وفوهة غاز، وجواها فونية نحاس التلامس.',
    facts: ['الفونية (Contact tip) لازم تناسب قطر السلك.', 'نضّف الفوهة من الرذاذ أول بأول.'], safety: '' },
  { id: 'euro', name: 'وصلة التورش (يورو)', en: 'Euro connector', far: 0.4, desc: 'وصلة واحدة بتوصّل التيار والغاز والسلك والتحكم للتورش.', facts: ['في السلك الصلب مع الغاز، التورش موجب (DCEP).'], safety: '' },
  CO2 ? { id: 'cylinder', name: 'أسطوانة ثاني أكسيد الكربون', en: 'CO₂ cylinder', far: 1.0,
    desc: 'ثاني أكسيد الكربون غاز نشط، رخيص، واختراقه عميق في الصلب. جوه الأسطوانة بيبقى سائل تحت ضغط حوالي ٥٠–٦٠ بار.',
    facts: ['لونها عندنا رمادي، ومكتوب عليها CO₂.', 'رذاذه أكتر من الخليط، والخط شكله أخشن شوية.'], safety: 'لازم تبقى واقفة ومربوطة. وماتشتغلش في مكان مقفول؛ الغاز بيطرد الأكسجين.' }
  : { id: 'cylinder', name: 'أسطوانة الأرجون / الخليط', en: 'Argon / Ar+CO₂ cylinder', far: 1.0,
    desc: 'الأرجون غاز خامل مابيتفاعلش مع المعدن المنصهر. نقي للألومنيوم، ومخلوط بشوية CO₂ للصلب عشان القوس يبقى هادي ورذاذه قليل.',
    facts: ['لونها رمادي بكتف أخضر غامق.'], safety: 'ثبّت الأسطوانة بالجنزير.' },
  CO2 ? { id: 'flow', name: 'منظم CO₂ بالسخّان', en: 'Heated CO₂ regulator', far: 0.4,
    desc: 'الـCO₂ لما بيتمدد بيبرد جداً وممكن يجمّد المنظم ويسدّه؛ عشان كده المنظم فيه سخّان كهربا بيتوصّل في الماكينة (٣٦ فولت).',
    facts: ['التصرف المناسب ١٢–١٨ لتر/دقيقة.', 'لو المنظم اتلج من بره يبقى السخّان مش شغال.'], safety: '' }
  : { id: 'flow', name: 'عداد الغاز', en: 'Flowmeter', far: 0.4, desc: 'التصرف المناسب غالباً ١٢–١٦ لتر/دقيقة.', facts: [], safety: '' },
  { id: 'clamp', name: 'ماسك الأرضي', en: 'Work clamp', far: 0.4, desc: 'في MAG بالسلك الصلب بيتوصل على السالب.', facts: [], safety: '' },
  { id: 'plates', name: 'قطع الشغل', en: 'Workpieces 6 mm', far: 0.4, desc: 'صلب ٦ مم، وصلة تناكبية.', facts: [], safety: '' }
];

let ctxRef, m, cyl, flow, torch, wire, clamp, plugT, plugG, cableT, cableG, gasHose, spool, spoolBox, door, rolls;
const st = { wd: 0.8, thick: 6, volt: 16, wfs: 8, flowR: 0, power: true, ppe: {}, heater: false };
const FLOW = CO2 ? [12, 18] : [12, 16];
let heater, heaterCable;
const asm = {};
const DL = V3(0.5, -0.866, 0);
const ROOT = V3(-0.62, 0, 0.02);
const W = 0.3, H = 0.5, D = 0.6, Y0 = 0.13;
const idealV = s => (s.wd === 0.8 ? 13.2 : 14) + (s.wd === 0.8 ? 0.95 : 1.15) * s.wfs;
const WFS_RANGE = s => s.wd === 0.8 ? (s.thick === 6 ? [6, 8.5] : [4, 6]) : (s.thick === 6 ? [5, 7] : [3, 5]);

function buildTorch(M) {
  const g = new THREE.Group();
  const grip = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.7, bumpMap: Textures.knurl().bumpMap, bumpScale: 1 });
  const handle = mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.15, 24), grip); handle.rotation.z = Math.PI / 2 - 0.1; handle.position.set(-0.11, 0.012, 0); g.add(handle);
  const trig = mesh(new RoundedBoxGeometry(0.03, 0.012, 0.012, 2, 0.004), new THREE.MeshStandardMaterial({ color: 0x8a1d18, roughness: 0.4 })); trig.position.set(-0.07, -0.012, 0); g.add(trig);
  const gooseC = new THREE.CatmullRomCurve3([V3(-0.035, 0.008, 0), V3(-0.01, 0.006, 0), DL.clone().multiplyScalar(0.015), DL.clone().multiplyScalar(0.05)]);
  g.add(mesh(new THREE.TubeGeometry(gooseC, 20, 0.008, 12), new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.35, metalness: 0.7 })));
  const nz = new THREE.Group(); nz.quaternion.setFromUnitVectors(V3(0, -1, 0), DL); nz.position.copy(DL.clone().multiplyScalar(0.05)); g.add(nz);
  const nozzle = mesh(new THREE.CylinderGeometry(0.0085, 0.011, 0.04, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xc69a55, roughness: 0.3, metalness: 1, side: THREE.DoubleSide })); nozzle.position.y = -0.02; nz.add(nozzle);
  const ct = mesh(new THREE.CylinderGeometry(0.0028, 0.0035, 0.03, 12), M.copper); ct.position.y = -0.024; nz.add(ct);
  const w = mesh(new THREE.CylinderGeometry(0.0004, 0.0004, 1, 6), M.copper); nz.add(w);
  g.userData = { tipL: DL.clone().multiplyScalar(0.05 + 0.039), wire: w, nz, anchor: V3(-0.19, 0.02, 0) };
  return g;
}

S.build = ctx => {
  ctxRef = ctx;
  const M = ctx.M, R = S.root;
  m = buildInverter(M, {
    w: W, h: H, d: D, y: Y0, color: CO2 ? 0x1f5fa8 : 0x3a4250, cart: true, dispW: 0.08,
    dispUV: [0.3, 0.16], swUV: [0.2, 0.47], ledUV: [0.12, 0.3], knobs: [[0.3, 0.33], [0.72, 0.33]],
    sockets: [['euro', 0.5, 0.82, false], ['minus', 0.82, 0.82, false], ['plus', 0.18, 0.82, true]],
    draw: (c, w, h) => {
      c.fillStyle = '#c9cfd9'; c.textAlign = 'center'; c.font = '600 34px "IBM Plex Mono", monospace'; c.fillText(CO2 ? 'CO2 MAG 250' : 'MIG 250', w / 2, 52);
      c.fillStyle = '#3ddc97'; c.fillRect(w / 2 - 100, 64, 200, 4);
      c.font = '600 22px "IBM Plex Sans Arabic", sans-serif'; c.fillStyle = '#9aa3b1'; c.fillText('الجهد V', w * 0.3, 330); c.fillText('سرعة السلك', w * 0.72, 330);
      c.font = '600 42px "IBM Plex Mono", monospace'; c.fillStyle = '#ff7b6b'; c.fillText('+', w * 0.18, 690); c.fillStyle = '#e1e5ea'; c.fillText('−', w * 0.82, 690);
    }
  });
  m.root.position.copy(ROOT); R.add(m.root);
  // second display for wire speed
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 128; const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
  const d2 = mesh(new THREE.BoxGeometry(0.08, 0.045, 0.004), [M.blackPlastic, M.blackPlastic, M.blackPlastic, M.blackPlastic, new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: dt, emissiveIntensity: 1.4 }), M.blackPlastic], false, false);
  d2.position.set((0.72 - 0.5) * (W - 0.03), (0.5 - 0.16) * (H - 0.03), D / 2 + 0.01); m.body.add(d2);
  m.draw2 = (txt, on) => { const c = dc.getContext('2d'); c.fillStyle = '#030405'; c.fillRect(0, 0, 256, 128); c.textAlign = 'right'; c.font = '600 84px "IBM Plex Mono", monospace'; c.fillStyle = '#0a2214'; c.fillText('8.8', 236, 100); if (on) { c.fillStyle = '#5cf0a6'; c.fillText(txt, 236, 100); } dt.needsUpdate = true; };
  // euro socket detail
  const eu = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 24), M.brass); eu.rotation.x = Math.PI / 2; m.sockets.euro.add(eu);
  // side door open on +X with spool inside
  door = mesh(new THREE.BoxGeometry(0.004, H - 0.06, D - 0.16), new THREE.MeshPhysicalMaterial({ color: CO2 ? 0x1f5fa8 : 0x3a4250, roughness: 0.45, clearcoat: 0.3 }));
  const hinge = new THREE.Group(); hinge.position.set(W / 2 + 0.003, 0, D / 2 - 0.08); m.body.add(hinge);
  door.position.set(0, 0, -(D - 0.16) / 2); hinge.add(door); hinge.rotation.y = -1.95;
  const cavity = mesh(new THREE.BoxGeometry(0.002, H - 0.07, D - 0.17), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 })); cavity.position.set(W / 2 + 0.0015, 0, 0); m.body.add(cavity);
  spool = new THREE.Group();
  const flange = new THREE.CylinderGeometry(0.1, 0.1, 0.006, 40);
  [-0.026, 0.026].forEach(z => { const f = mesh(flange, M.blackPlastic); f.position.y = z; spool.add(f); });
  const wound = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 40), new THREE.MeshStandardMaterial({ color: 0xb8743f, roughness: 0.35, metalness: 1, bumpMap: Textures.knurl().bumpMap, bumpScale: 0.5 })); spool.add(wound);
  spool.rotation.z = Math.PI / 2;
  // wire-drive unit mounted on the compartment wall (in front of / below the spool), clearly visible when the door is open
  rolls = new THREE.Group();
  const steelR = new THREE.MeshStandardMaterial({ color: 0xd2d7dc, roughness: 0.22, metalness: 1 });
  const plate = mesh(new RoundedBoxGeometry(0.012, 0.1, 0.13, 2, 0.004), new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.55, metalness: 0.6 })); rolls.add(plate);
  const motor = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 28), new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.5, metalness: 0.5 })); motor.rotation.z = Math.PI / 2; motor.position.set(-0.012, -0.02, 0.02); rolls.add(motor);
  const rollG = new THREE.CylinderGeometry(0.022, 0.022, 0.014, 32), grooveG = new THREE.TorusGeometry(0.0205, 0.0022, 8, 32);
  const mkRoll = (y, z) => { const g = new THREE.Group(); const r = mesh(rollG, steelR); r.rotation.z = Math.PI / 2; g.add(r); const gr = mesh(grooveG, new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.4, metalness: 1 })); gr.rotation.y = Math.PI / 2; g.add(gr); const hub = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.018, 16), M.brass); hub.rotation.z = Math.PI / 2; g.add(hub); g.position.set(0.014, y, z); rolls.add(g); return g; };
  const rDown = mkRoll(-0.02, 0.02), rUp = mkRoll(0.025, 0.02);
  // orange pressure arm that swings down onto the upper roll + tension knob
  const armPivot = new THREE.Group(); armPivot.position.set(0.022, 0.03, -0.035); rolls.add(armPivot);
  const armMat = new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, roughness: 0.35, clearcoat: 0.6 });
  const armB = mesh(new RoundedBoxGeometry(0.012, 0.016, 0.1, 2, 0.004), armMat); armB.position.set(0, 0.006, 0.05); armPivot.add(armB);
  const knob = new THREE.Group(); const kc = mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.03, 18), M.blackPlastic); knob.add(kc); const ks = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 8), steelR); ks.position.y = -0.02; knob.add(ks);
  knob.position.set(0, 0.02, 0.092); armPivot.add(knob);
  // wire guides in/out
  const guide = new THREE.CylinderGeometry(0.004, 0.004, 0.04, 10);
  const gIn = mesh(guide, M.brass); gIn.rotation.x = Math.PI / 2; gIn.position.set(0.014, 0.0025, -0.035); rolls.add(gIn);
  const gOut = mesh(guide, M.brass); gOut.rotation.x = Math.PI / 2; gOut.position.set(0.014, 0.0025, 0.075); rolls.add(gOut);
  // invisible, generous touch target
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.17), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0.02, 0, 0.015); hit.userData.noHi = true; rolls.add(hit);
  rolls.userData.setArm = (closed, ctx) => {
    const to = closed ? 0 : -0.75;
    if (!ctx) { armPivot.rotation.x = to; return; }
    const from = armPivot.rotation.x; ctx.E.tween(0.5, k => { armPivot.rotation.x = from + (to - from) * ctx.ease(k); rUp.rotation.x = rDown.rotation.x = -k * 3; });
  };
  rolls.userData.setArm(false);
  rolls.position.set(W / 2 + 0.003, -0.13, 0.1); m.body.add(rolls);
  spoolBox = new THREE.Group();
  const bx = mesh(new THREE.BoxGeometry(0.22, 0.07, 0.22), M.cardboard); bx.position.y = 0.035; spoolBox.add(bx);
  spoolBox.position.set(-0.2, 0, 0.45); R.add(spoolBox);
  R.add(spool);

  cyl = CO2 ? buildCylinder(M, { h: 1.3, r: 0.11, color: 0x8a9096, shoulder: 0x55595e, labelAr: 'ثاني أكسيد الكربون', labelEn: 'CO₂', valve: 'wheel' })
    : buildCylinder(M, { h: 1.25, r: 0.1, color: 0x6c7076, shoulder: 0x1f5a3a, labelAr: 'أرجون', labelEn: 'Ar', valve: 'wheel' });
  cyl.position.set(-0.98, 0, -0.2); R.add(cyl);
  flow = buildFlowmeter(M); R.add(flow);
  if (CO2) {
    heater = new THREE.Group();
    const hb = mesh(new RoundedBoxGeometry(0.045, 0.05, 0.04, 2, 0.006), new THREE.MeshPhysicalMaterial({ color: 0xb8261e, roughness: 0.4, clearcoat: 0.5 })); heater.add(hb);
    for (let i = 0; i < 5; i++) { const f = mesh(new THREE.BoxGeometry(0.047, 0.003, 0.042), new THREE.MeshStandardMaterial({ color: 0x5a1210, roughness: 0.6 })); f.position.y = -0.02 + i * 0.01; heater.add(f); }
    const lamp = mesh(new THREE.SphereGeometry(0.004, 10, 8), new THREE.MeshStandardMaterial({ color: 0x331a08 })); lamp.position.set(0, 0.012, 0.021); heater.add(lamp); heater.userData.lamp = lamp;
    heater.position.set(0.03, -0.035, 0); flow.add(heater);
    heaterCable = new Cable(M, 0.0035); R.add(heaterCable.mesh);
  }
  torch = buildTorch(M); R.add(torch); wire = torch.userData.wire;
  clamp = buildClamp(M); R.add(clamp);
  plugT = new THREE.Group();
  const pb = mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.06, 24), M.blackPlastic); pb.rotation.x = Math.PI / 2; pb.position.z = 0.03; plugT.add(pb);
  const pn = mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 24), M.brass); pn.rotation.x = Math.PI / 2; pn.position.z = 0.004; plugT.add(pn);
  plugT.userData.cableAnchor = V3(0, 0, 0.06); R.add(plugT);
  plugG = buildPlug(M, false); R.add(plugG);
  cableT = new Cable(M, 0.011); cableG = new Cable(M); R.add(cableT.mesh, cableG.mesh);
  gasHose = new Cable({ rubber: new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.6 }) }, 0.004); R.add(gasHose.mesh);
  const tag = (o, id) => { o.userData.pick = id; };
  tag(m.body, 'machine'); tag(m.disp, 'panel'); tag(d2, 'panel'); m.knobs.forEach(k => tag(k, 'panel')); tag(m.sockets.euro, 'euro'); tag(m.sockets.minus, 'sockets'); tag(m.sockets.plus, 'sockets');
  tag(spool, 'spool'); tag(spoolBox, 'spoolBox'); tag(rolls, 'drive'); tag(cyl, 'cylinder'); tag(flow, 'flow'); if (heater) tag(heater, 'flow'); tag(torch, 'torch'); tag(clamp, 'clamp'); tag(plugT, 'plugT'); tag(plugG, 'plugG'); tag(m.sw, 'switch'); tag(cableT.mesh, 'torch'); tag(cableG.mesh, 'clamp');
  S._pick = [m.body, m.disp, d2, ...m.knobs, m.sockets.euro, m.sockets.minus, m.sockets.plus, spool, spoolBox, rolls, cyl, flow, torch, clamp, plugT, plugG, m.sw, cableT.mesh, cableG.mesh];
  S.setAssembled(true); setPower(true);
};
S.pickables = () => S._pick;
S.exploreMap = { plugT: 'euro', plugG: 'clamp', sockets: 'clamp', switch: 'machine', spoolBox: 'spool' };
S.enter = ctx => ctx.setPlates({ t: 0.006, kind: 'butt' });

const POSE = {
  torchRest: { p: V3(0.64, TABLE_Y + 0.021, 0.22), r: new THREE.Euler(0, Math.PI + 0.25, 0) },
  clampOn: { p: V3(0.86, TABLE_Y - 0.006, -0.06), r: new THREE.Euler(0, Math.PI, 0) },
  clampFloor: { p: V3(0.62, 0.018, 0.62), r: new THREE.Euler(Math.PI / 2, 0, 0.6) },
  plugTFloor: { p: V3(-0.25, 0.02, 0.62), r: new THREE.Euler(0, 1.9, 0) },
  plugGFloor: { p: V3(-0.05, 0.017, 0.7), r: new THREE.Euler(0, 1.2, 0) },
  flowShelf: { p: V3(-0.86, 0.14, 0.4), r: new THREE.Euler(0, 0.4, 0) }
};
const ap = (o, p) => { o.position.copy(p.p); o.rotation.copy(p.r); };
const sockW = k => { m.root.updateMatrixWorld(true); return m.socketWorld(k).add(V3(0, 0, 0.01)); };
const outletW = o => { o.updateMatrixWorld(true); return o.userData.outletLocal.clone().applyMatrix4(o.matrixWorld); };
const anc = (o, l) => { o.updateMatrixWorld(true); return l.clone().applyMatrix4(o.matrixWorld); };
const dirW = (o, l) => { o.updateMatrixWorld(true); return l.clone().transformDirection(o.matrixWorld); };
function spoolPose(inside) {
  if (inside) { m.root.updateMatrixWorld(true); spool.position.copy(anc(m.body, V3(W / 2 + 0.04, 0.07, -0.06))); spool.rotation.set(0, 0, Math.PI / 2); }
  else { spool.position.set(-0.2, 0.08, 0.45); spool.rotation.set(0, 0, 0); }
}
function updateCables(free) {
  cableT.update(anc(plugT, plugT.userData.cableAnchor), dirW(plugT, V3(0, 0, 1)), anc(torch, torch.userData.anchor), dirW(torch, V3(-1, 0.1, 0)).normalize(), { bSide: free ? 'free' : 'table', lipX: 0.58 });
  cableG.update(anc(plugG, plugG.userData.cableAnchor), dirW(plugG, V3(0, 0, 1)), anc(clamp, clamp.userData.cableAnchor), dirW(clamp, V3(-1, 0, 0)), { bSide: asm.clamp ? 'hang' : 'floor' });
  if (heaterCable) { heaterCable.mesh.visible = !!asm.gas; if (asm.gas) heaterCable.update(anc(heater, V3(0, -0.02, 0)), V3(0, -1, 0), anc(m.body, V3(-W / 2 + 0.04, -H / 2 + 0.06, D / 2 + 0.005)), V3(0, 0, 1), { bSide: 'floor' }); }
  gasHose.mesh.visible = !!asm.gas;
  if (asm.gas) gasHose.update(outletW(flow), V3(1, -0.4, 0.3).normalize(), anc(m.body, V3(0.1, -0.15, -D / 2 - 0.01)), V3(0, 0, -1), { bSide: 'floor' });
}
S.afterMove = () => updateCables();
function setPower(on) { st.power = on; m.sw.userData.rocker.rotation.x = on ? -0.18 : 0.18; m.led.material = on ? ctxRef.M.ledGreenOn : ctxRef.M.ledGreenOff; updateMachine(); }
function updateMachine() {
  if (heater) heater.userData.lamp.material = st.heater && st.power ? new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 3 }) : new THREE.MeshStandardMaterial({ color: 0x331a08 });
  m.knobs[0].rotation.z = THREE.MathUtils.degToRad(135 - ((st.volt - 12) / 18) * 270);
  m.knobs[1].rotation.z = THREE.MathUtils.degToRad(135 - ((st.wfs - 1) / 14) * 270);
  m.draw(st.volt.toFixed(1), st.power, '#ffae5c'); m.draw2(st.wfs.toFixed(1), st.power);
  flow.userData.setFlow(asm.gas ? st.flowR : 0); flow.userData.hp.set(asm.gas ? 170 : 0);
}
S.setAssembled = all => {
  ['spool', 'drive', 'torch', 'tip', 'ground', 'clamp', 'gas', 'feed'].forEach(k => asm[k] = all);
  spoolPose(all); rolls.userData.setArm(all);
  if (all) { plugT.position.copy(sockW('euro')); plugT.rotation.set(0, 0, 0); plugG.position.copy(sockW('minus')); plugG.rotation.set(0, 0, 0); ap(clamp, POSE.clampOn); flow.position.copy(outletW(cyl)); flow.rotation.set(0, 0, 0); }
  else { ap(plugT, POSE.plugTFloor); ap(plugG, POSE.plugGFloor); ap(clamp, POSE.clampFloor); ap(flow, POSE.flowShelf); }
  ap(torch, POSE.torchRest);
  torch.userData.nz.visible = true;
  setStickout(all ? 12 : 0);
  if (!all) st.flowR = 0; else if (!st.flowR) st.flowR = 14;
  updateCables(); m && updateMachine();
};
function setStickout(mm) { const L = Math.max(0.0005, mm / 1000); wire.visible = mm > 0.3; wire.scale.y = L; wire.position.y = -0.039 - L / 2; }

S.partObject = id => ({ machine: m.body, panel: m.disp, spool, drive: rolls, torch, euro: m.sockets.euro, cylinder: cyl, flow, clamp, plates: ctxRef.shared.plates }[id]);
S.partHighlight = id => id === 'panel' ? [m.disp, ...m.knobs] : [S.partObject(id)];
S.partAnchor = id => {
  const v = new THREE.Vector3();
  switch (id) {
    case 'machine': m.body.localToWorld(v.set(-0.15, 0.1, 0)); break;
    case 'panel': m.knobs[0].getWorldPosition(v); break;
    case 'spool': spool.getWorldPosition(v); v.x += 0.04; break;
    case 'drive': rolls.getWorldPosition(v); v.x += 0.02; break;
    case 'torch': torch.localToWorld(v.set(-0.08, 0.02, 0)); break;
    case 'euro': m.sockets.euro.getWorldPosition(v); break;
    case 'cylinder': cyl.localToWorld(v.set(0, 0.7, 0.1)); break;
    case 'flow': flow.localToWorld(v.set(0.1, 0.06, 0.02)); break;
    case 'clamp': clamp.getWorldPosition(v); break;
    case 'plates': v.set(0.3, JOINT.y, 0.05); break;
  }
  return v;
};
S.explodeItems = () => [{ o: spool, d: V3(0.25, 0.05, 0.1) }, { o: torch, d: V3(0, 0.15, 0.05) }, { o: flow, d: V3(0.12, 0.05, 0.1) }, { o: plugT, d: V3(0, 0.03, 0.14) }, { o: clamp, d: V3(0.1, 0.1, 0) }];
S.cams = {
  explore: () => ({ pos: V3(0.62, 1.32, 1.42), target: V3(-0.05, 0.6, 0.05) }),
  assemble: () => ({ pos: V3(0.25, 1.15, 1.45), target: V3(-0.35, 0.45, 0.15) }),
  operate: () => ({ pos: V3(-0.42, 0.72, 0.92), target: V3(-0.62, 0.42, 0.3) })
};

S.asmSteps = [
  { id: 'power', title: 'اطفي الماكينة وافتح باب البكرة', hint: 'المس مفتاح التشغيل اللي ورا الماكينة.' },
  { id: 'spool', title: 'ركّب بكرة السلك ٠٫٨ مم', hint: 'المس كرتونة البكرة اللي على الأرض.' },
  { id: 'drive', title: 'ركّب بكر التغذية المناسب للسلك واقفل ذراع الضغط', hint: 'المس وحدة التغذية: البكرتين الفضة والذراع البرتقاني تحت بكرة السلك جوه الباب المفتوح.' },
  { id: 'torch', title: 'وصّل التورش في وصلة اليورو', hint: 'المس فيشة التورش، وبعدين وصلة اليورو في نص الماكينة.' },
  { id: 'ground', title: 'وصّل كابل الأرضي بالسالب (−)', hint: 'المس فيشة الأرضي، وبعدين الطرف المناسب.' },
  { id: 'clamp', title: 'ثبّت ماسك الأرضي على الطاولة', hint: 'المس ماسك الأرضي.' },
  { id: 'gas', title: 'ركّب عداد الغاز ووصّل الخرطوم', hint: 'المس أسطوانة الغاز.' },
  { id: 'feed', title: 'سحّب السلك لحد ما يطلع من التورش، وركّب الفونية ٠٫٨ والفوهة', hint: 'المس التورش.' }
];
S.asmStart = () => { setPower(true); };
S.asmCam = step => {
  const id = S.asmSteps[step] && S.asmSteps[step].id;
  if (id === 'torch') return S.cams.assemble();
  if (id !== 'drive') return null;
  m.root.updateMatrixWorld(true);   // look into the open side compartment from behind the swung-open door
  return { pos: anc(m.body, V3(W / 2 + 0.52, 0.16, -0.12)), target: anc(m.body, V3(W / 2, -0.07, 0.04)) };
};
S.asmTargets = (step, ctx) => {
  const s = S.asmSteps[step]; if (!s) return [];
  const p = ctx.state.asm.picked;
  return { power: [m.sw], spool: [spoolBox, spool], drive: [rolls], torch: p ? [m.sockets.euro] : [plugT], ground: p ? [m.sockets.plus, m.sockets.minus] : [plugG], clamp: [clamp], gas: [cyl], feed: [torch] }[s.id];
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
    case 'power': if (id === 'switch') { setPower(false); ctx.audio.sfx('clunk'); ctx.next('الماكينة مطفية، وباب البكرة مفتوح.'); } else ctx.asmMsg('bad', 'اطفي الماكينة الأول.'); break;
    case 'spool': if (id === 'spoolBox' || id === 'spool') { m.root.updateMatrixWorld(true); const to = anc(m.body, V3(W / 2 + 0.04, 0.07, -0.06)); moveObj(ctx, spool, to, new THREE.Euler(0, 0, Math.PI / 2), 1.1, () => { asm.spool = true; ctx.next('البكرة اتركبت، وطرف السلك ماسكه عشان مايفكّش.'); }); } else ctx.asmMsg('bad', 'المس كرتونة البكرة.'); break;
    case 'drive': if (id === 'drive') { asm.drive = true; rolls.userData.setArm(true, ctx); ctx.audio.sfx('clunk'); ctx.next('تمام. ركّبنا بكر بمجرى ٠٫٨ على شكل حرف V عشان السلك الصلب، وقفلنا الذراع البرتقاني بضغط متوسط: لو الضغط زيادة السلك يتفرطح، ولو قليل يزحلق.'); } else ctx.asmMsg('bad', 'المس وحدة التغذية: البكرتين الفضة والذراع البرتقاني تحت بكرة السلك.'); break;
    case 'torch':
      if (!a.picked) { if (id === 'plugT') { a.picked = true; ctx.asmMsg('info', 'المس وصلة اليورو.'); ctx.E.setHighlight(S.asmTargets(a.step, ctx)); } else ctx.asmMsg('bad', 'المس فيشة التورش (الكبيرة السودا).'); return; }
      if (id !== 'euro') return ctx.asmMsg('bad', 'التورش بيتوصل في وصلة اليورو (الوسط)، مش في أطراف الأرضي.');
      a.picked = null; ctx.E.setHighlight([]); moveObj(ctx, plugT, sockW('euro'), new THREE.Euler(0, 0, 0), 1, () => { asm.torch = true; ctx.audio.sfx('clunk'); ctx.next('التورش اتوصّل واتربط. وصلة اليورو فيها التيار والغاز والسلك.'); });
      break;
    case 'ground':
      if (!a.picked) { if (id === 'plugG') { a.picked = true; ctx.asmMsg('info', 'المس الطرف المناسب.'); ctx.E.setHighlight(S.asmTargets(a.step, ctx)); } else ctx.asmMsg('bad', 'المس فيشة الأرضي.'); return; }
      if (id !== 'sockets') return ctx.asmMsg('bad', 'المس واحد من أطراف التوصيل.');
      if (r && r.object === m.sockets.plus) return ctx.asmMsg('bad', 'الأرضي على الموجب ده للسلك المتغلف ذاتي الحماية (FCAW). مع السلك الصلب والغاز الأرضي على السالب.');
      a.picked = null; ctx.E.setHighlight([]); moveObj(ctx, plugG, sockW('minus'), new THREE.Euler(0, 0, 0), 1, () => { asm.ground = true; ctx.audio.sfx('clunk'); ctx.next('الأرضي على السالب، والتورش موجب (DCEP).'); });
      break;
    case 'clamp': if (id === 'clamp') { ctx.E.setHighlight([]); moveObj(ctx, clamp, POSE.clampOn.p, POSE.clampOn.r, 1, () => { asm.clamp = true; updateCables(); ctx.next('ماسك الأرضي متثبّت.'); }); } else ctx.asmMsg('bad', 'المس ماسك الأرضي.'); break;
    case 'gas': if (id === 'cylinder' || id === 'flow') { ctx.E.setHighlight([]); moveObj(ctx, flow, outletW(cyl), new THREE.Euler(0, 0, 0), 1, () => { asm.gas = true; updateCables(); updateMachine(); ctx.next('العداد اتركّب وخرطوم الغاز اتوصّل لضهر الماكينة.'); }); } else ctx.asmMsg('bad', 'المس أسطوانة الغاز.'); break;
    case 'feed': if (id === 'torch') { asm.feed = true; ctx.state.asm.busy = true; ctx.E.tween(1.4, k => setStickout(12 * k), () => { ctx.state.asm.busy = false; ctx.next('السلك طلع من التورش. ركّبت الفونية والفوهة، وقصّيت السلك ١٢ مم.'); }); ctx.E.flyTo(V3(0.78, TABLE_Y + 0.14, 0.42), anc(torch, torch.userData.tipL)); } else ctx.asmMsg('bad', 'المس التورش.'); break;
  }
};
S.asmAuto = ctx => {
  const a = ctx.state.asm, s = S.asmSteps[a.step]; if (!s) return;
  if (s.id === 'power') S.asmPick('switch', ctx);
  else if (s.id === 'torch') { if (!a.picked) S.asmPick('plugT', ctx); S.asmPick('euro', ctx); }
  else if (s.id === 'ground') { if (!a.picked) S.asmPick('plugG', ctx); S.asmPick('sockets', ctx, { object: m.sockets.minus }); }
  else S.asmPick({ spool: 'spoolBox', drive: 'drive', clamp: 'clamp', gas: 'cylinder', feed: 'torch' }[s.id], ctx);
};

const pen = (v, [a, b], k) => v < a ? (a - v) * k : v > b ? (v - b) * k : 0;
function vStatus() { const iv = idealV(st), d = st.volt - iv; return Math.abs(d) <= 1.2 ? ['ok', 'متناسب'] : d < 0 ? ['low', 'جهد قليل (تخبيط)'] : ['high', 'جهد عالي (رذاذ)']; }
S.operateEnter = () => updateMachine();
S.operatePick = (id, ctx) => { if (id === 'switch') { setPower(!st.power); ctx.renderPanel(); } };
S.operateHTML = () => {
  const wr = WFS_RANGE(st), vs = vStatus(), iv = idealV(st);
  const ppe = [['helmet', 'ماسك عدسة ١١'], ['gloves', 'جوانتي جلد'], ['jacket', 'جاكيت لحام'], ['nozzle', 'نضّفت الفوهة ورشيت مانع رذاذ']];
  return `
    <section class="card"><h3 class="sm">قطر السلك والسُمك</h3>
      <div class="seg2"><button type="button" class="${st.wd === 0.8 ? 'on' : ''}" data-op="wd:0.8"><span class="mono">0.8</span> مم</button><button type="button" class="${st.wd === 1 ? 'on' : ''}" data-op="wd:1"><span class="mono">1.0</span> مم</button></div>
      <div class="seg2" style="margin-top:.5rem"><button type="button" class="${st.thick === 3 ? 'on' : ''}" data-op="th:3">صاج ٣ مم</button><button type="button" class="${st.thick === 6 ? 'on' : ''}" data-op="th:6">لوح ٦ مم</button></div>
      <p class="muted small">الشغل على الطاولة: لوح ٦ مم.</p></section>
    <section class="card"><div class="ph"><h3 class="sm">سرعة السلك</h3><span class="tag ${st.wfs >= wr[0] && st.wfs <= wr[1] ? 'ok' : 'low'}">${wr[0]}–${wr[1]} m/min</span></div>
      <div class="lbl-row"><span>السرعة</span><b class="mono">${st.wfs.toFixed(1)} m/min</b></div>
      <input type="range" min="1" max="15" step="0.5" value="${st.wfs}" data-op="wfs" aria-label="سرعة السلك"></section>
    <section class="card"><div class="ph"><h3 class="sm">الجهد</h3><span class="tag ${vs[0]}">${vs[1]}</span></div>
      <div class="lbl-row"><span>الجهد</span><b class="mono">${st.volt.toFixed(1)} V</b></div>
      <input type="range" min="12" max="30" step="0.5" value="${st.volt}" data-op="volt" aria-label="الجهد">
      <p class="muted small">مع السرعة دي الجهد المناسب حوالي <b class="mono">${iv.toFixed(1)} V</b>. اسمع صوت القوس: الصح بيبقى «طشطشة» منتظمة زي القلي.</p></section>
    <section class="card"><div class="ph"><h3 class="sm">تصرّف الغاز</h3><span class="tag ${st.flowR >= FLOW[0] && st.flowR <= FLOW[1] ? 'ok' : 'low'}">${st.flowR} L/min</span></div>
      ${CO2 ? `<button type="button" class="btn ${st.heater ? 'on-green' : ''}" data-op="heater" style="width:100%;margin-bottom:.5rem">${st.heater ? ICON.check + 'سخّان المنظم شغال' : 'شغّل سخّان منظم CO₂'}</button>` : ''}
      <input type="range" min="0" max="25" step="1" value="${st.flowR}" data-op="flowR" aria-label="تصرف الغاز"></section>
    <section class="card"><h3 class="sm">قبل ما تبدأ</h3><div class="ppe">${ppe.map(([k, n]) => `<button type="button" class="${st.ppe[k] ? 'on' : ''}" data-op="ppe:${k}">${st.ppe[k] ? ICON.check : ICON.shield}${n}</button>`).join('')}</div></section>
    <button type="button" class="btn ${st.power ? 'on-green' : ''}" data-op="power">${ICON.bolt}${st.power ? 'الماكينة شغالة' : 'شغّل الماكينة'}</button>`;
};
S.operateAction = (op, el, ctx) => {
  if (op.startsWith('range:')) { st[op.slice(6)] = +el.value; updateMachine(); clearTimeout(S._t); S._t = setTimeout(() => ctx.renderPanel(), 150); return; }
  if (op.startsWith('wd:')) st.wd = +op.slice(3);
  else if (op.startsWith('th:')) st.thick = +op.slice(3);
  else if (op.startsWith('ppe:')) { const k = op.slice(4); st.ppe[k] = !st.ppe[k]; }
  else if (op === 'power') setPower(!st.power);
  else if (op === 'heater') st.heater = !st.heater;
  ctx.audio.click(); updateMachine(); ctx.renderPanel();
};
S.operateReady = () => {
  if (!st.power) return { ok: false, label: 'شغّل الماكينة' };
  if (!['helmet', 'gloves', 'jacket', 'nozzle'].every(k => st.ppe[k])) return { ok: false, label: 'كمّل قائمة «قبل ما تبدأ»' };
  if (st.flowR < 4) return { ok: false, label: 'افتح الغاز' };
  if (CO2 && !st.heater) return { ok: false, label: 'شغّل سخّان منظم CO₂' };
  const wr = WFS_RANGE(st), ok = vStatus()[0] === 'ok' && st.wfs >= wr[0] && st.wfs <= wr[1] && st.flowR >= FLOW[0] && st.flowR <= FLOW[1];
  return { ok: true, label: ok ? 'ابدأ اللحام' : 'ابدأ (الإعدادات مش متناسبة)' };
};

S.weldSettings = () => ({ ...st });
S.weldProc = () => {
  const wr = WFS_RANGE(st), dv = st.volt - idealV(st), gasOK = st.flowR >= FLOW[0] && st.flowR <= FLOW[1];
  const heat = THREE.MathUtils.clamp((st.wfs - wr[0]) / (wr[1] - wr[0]), -0.8, 1.8);
  return {
    kind: 'arc', distName: 'طول السلك البارز', angleName: 'زاوية التورش', settingName: 'الجهد والسرعة والغاز', angleShort: 'زاوية التورش',
    ideal: { angle: [70, 82], speed: [4, 8], dist: [10, 15] }, idealStart: 12,
    strikeBelow: 40, stickBelow: 4, breakAbove: 30, grace: 0.2,
    stickMsg: 'الفوهة لمست الشغلانة! السلك البارز قصير جداً. ارفع التورش شوية.',
    breakMsg: 'التورش بعيد جداً؛ الغاز مش واصل والقوس مش مستقر.',
    pauseMsg: 'سبت الزناد. دوس تاني وكمّل من آخر نقطة.',
    spacing: 0.0013, distPerMM: 1.2, relDistPerPx: 0.08, arcColor: 0xfff2e0, arcSize: 0.03, lightIntensity: 0.35, smoke: 7, sound: 'mig',
    bead: { color: [0.62, 0.64, 0.68], hot: [3.2, 1.4, 0.4], metal: 0.82, rough: 0.35, tint: (r, i, n, c) => c.setRGB(0.6 + (i % 3) * 0.01, 0.62, 0.68) },
    dims: s => {
      const sp = THREE.MathUtils.clamp(s.speed || 6, 1, 16);
      const w = 8.2 * (0.85 + heat * 0.22) * Math.pow(6 / sp, 0.45) * (1 + Math.max(0, dv) * 0.05);
      const h = 2.6 * Math.pow(6 / sp, 0.5) * (1 - Math.max(0, dv) * 0.06) * (1 + Math.max(0, -dv) * 0.08);
      return { w: THREE.MathUtils.clamp(w, 4, 15), h: THREE.MathUtils.clamp(h, 0.8, 4.5), wobble: 0.6 + Math.abs(dv) * 0.3 };
    },
    flags: s => ({ spatter: Math.min(0.95, Math.abs(dv) * 0.18 + (s.dist > 17 ? 0.3 : 0) + (CO2 ? 0.22 : 0)), pore: (!gasOK ? 0.25 : 0) + (s.dist > 20 ? 0.2 : 0), undercut: (s.speed > 9.5 || dv > 2.5) ? 0.5 : 0 }),
    sparks: s => 60 + Math.abs(dv) * 70 + Math.max(0, s.dist - 15) * 20,
    poolMM: () => 7,
    settingScore: set => ({ v: Math.max(15, 100 - Math.max(0, Math.abs(set.volt - idealV(set)) - 1.2) * 14 - pen(set.wfs, WFS_RANGE(set), 10) - pen(set.flowR, FLOW, 6)), note: Math.abs(dv) > 1.2 ? `الجهد ${dv > 0 ? 'أعلى' : 'أقل'} من المناسب لسرعة السلك بحوالي ${Math.abs(dv).toFixed(1)} V.` : '' }),
    penetration: () => THREE.MathUtils.clamp(0.7 + heat * 0.3, 0.3, 1.3),
    defects: c => {
      const out = [];
      if (dv < -1.2) out.push({ name: 'تخبيط السلك وخط عالي', en: 'Stubbing / ropey bead', cause: 'الجهد قليل بالنسبة لسرعة السلك.', fix: 'زوّد الجهد أو قلّل سرعة السلك.' });
      if (dv > 1.2 || c.sim.spatter.count > 25) out.push({ name: 'رذاذ كتير', en: 'Excess spatter', cause: dv > 1.2 ? 'الجهد عالي (قوس طويل).' : 'السلك البارز طويل.', fix: 'اظبط الجهد على السرعة، وخلّي السلك البارز ١٠–١٥ مم.' });
      if (!gasOK || c.sim.pores.count > 2) out.push({ name: 'مسامية', en: 'Porosity', cause: gasOK ? 'التورش بعيد عن الشغلانة فالغاز ماغطاش.' : 'تصرّف الغاز ' + st.flowR + ' لتر/دقيقة خارج المناسب.', fix: 'اضبط الغاز ' + FLOW[0] + '–' + FLOW[1] + ' لتر/دقيقة وقرّب التورش.' });
      if (c.count('fast')) out.push({ name: 'تآكل الحواف / خط رفيع', en: 'Undercut', cause: 'سرعة تقدّم عالية.', fix: 'بطّأ الحركة.' });
      if (c.count('slow')) out.push({ name: 'تراكب', en: 'Overlap / cold lap', cause: 'الحركة بطيئة فالمعدن اتكوّم قدام القوس.', fix: 'زوّد السرعة وخلّي القوس على الحافة الأمامية للبركة.' });
      if (st.wfs < wr[0]) out.push({ name: 'نقص الاختراق', en: 'Lack of penetration', cause: 'سرعة السلك (التيار) قليلة على السُمك ده.', fix: 'زوّد سرعة السلك والجهد مع بعض.' });
      if (c.events.stuck) out.push({ name: 'الفوهة لمست الشغلانة', en: 'Nozzle contact', cause: c.AR(c.events.stuck) + ' مرة.', fix: 'حافظ على السلك البارز ١٠–١٥ مم.' });
      return out;
    },
    hint: 'دوس على بداية الوصلة (الزناد) واتحرك بثبات. فوق الخط الأخضر = سلك بارز أطول.'
  };
};
S.hud = ctx => {
  const w = ctx.state.weld, sim = ctx.sim;
  return [
    { id: 'angle', label: 'زاوية التورش', hint: '70–82°', get: () => ({ val: ctx.state.angle, txt: ctx.state.angle + '°', min: 30, max: 90, lo: 70, hi: 82 }) },
    { id: 'speed', label: 'سرعة التقدّم', hint: '4–8 mm/s', get: o => ({ val: sim.on ? o.speed : null, txt: sim.on ? o.speed.toFixed(1) : '--', min: 0, max: 14, lo: 4, hi: 8 }) },
    { id: 'dist', label: 'السلك البارز', hint: '10–15 مم', get: () => ({ val: w.pressing ? w.eff : null, txt: w.pressing ? (w.eff ?? 0).toFixed(0) + ' mm' : '--', min: 0, max: 30, lo: 10, hi: 15 }) },
    { id: 'set', label: 'الجهد / السلك', bar: false, get: () => ({ txt: st.volt.toFixed(1) + 'V • ' + st.wfs.toFixed(1) }) }
  ];
};
S.coach = (ctx, o) => {
  const w = ctx.state.weld;
  if (o.speed > 9) return 'بطّأ شوية';
  if (o.speed < 3 && ctx.sim.time > 1) return 'MIG أسرع؛ اتحرك بثبات';
  if (w.eff > 16.5) return 'التورش بعيد، قرّب';
  if (w.eff < 8.5) return 'التورش قريب قوي';
  if (ctx.state.angle < 66 || ctx.state.angle > 86) return 'اظبط الزاوية ٧٠–٨٠°';
  return null;
};
let tick = 0;
S.weldEnter = ctx => { S.enter(ctx); ctx.state.angle = 75; setStickout(12); ctx.resetTip(JOINT.x0 - 0.02, JOINT.y + 0.03); if (!st.power) setPower(true); };
S.weldPose = (ctx, tip) => {
  const a = THREE.MathUtils.degToRad(ctx.state.angle);
  const dw = V3(Math.cos(a), -Math.sin(a), -0.12).normalize();
  orientTool(torch, DL, V3(-1, 0.3, 0), dw, V3(-0.8, 0.5, 0.3));
  torch.updateMatrixWorld(true);
  const so = THREE.MathUtils.clamp((tip.y - JOINT.y) * 1000, 0, 35);
  setStickout(so);
  const ctW = DL.clone().multiplyScalar(0.05 + 0.039).applyQuaternion(torch.quaternion);
  const puddle = V3(tip.x, JOINT.y, JOINT.z);
  torch.position.copy(puddle.addScaledVector(dw, -so / 1000)).sub(ctW);
  if ((tick++ & 1) === 0) updateCables(true);
};
S.weldExit = () => { ap(torch, POSE.torchRest); setStickout(12); updateCables(); };
S.inspectEnter = () => { ap(torch, POSE.torchRest); setStickout(12); updateCables(); };

return S;
}
export default makeWire;
