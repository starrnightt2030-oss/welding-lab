// Station: TIG / GTAW (اللحام بقطب التنجستن والغاز الخامل)
import * as THREE from 'three';
import { buildClamp, buildPlug, Cable, TABLE_Y, JOINT } from '../models.js';
import { buildCylinder, buildFlowmeter, buildInverter, orientTool, mesh } from '../gasparts.js';
import { Textures } from '../textures.js';
import { ICON } from '../core/icons.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const S = {
  id: 'tig', name: 'التنجستن والغاز الخامل', code: 'TIG / GTAW', icon: ICON.tig, ready: true,
  stages: [['explore', 'اتعرّف'], ['assemble', 'ركّب'], ['operate', 'شغّل'], ['weld', 'الحم'], ['inspect', 'افحص']]
};
S.parts = [
  { id: 'machine', name: 'ماكينة TIG (إنفرتر AC/DC)', en: 'TIG inverter power source', far: 0.9,
    desc: 'ماكينة تيار ثابت بتطلع تيار مستمر للصلب والاستانلس، أو متردد للألومنيوم. فيها إشعال بالتردد العالي (HF) يولّع القوس من غير ما التنجستن يلمس الشغلانة.',
    facts: ['زرار 2T/4T بيحدد طريقة الضغط على زرار التورش.', 'زمن الغاز بعد اللحام (Post-flow) بيحمي التنجستن والخط وهما بيبردوا.'], safety: 'التردد العالي ممكن يأثر على الأجهزة الطبية زي منظم ضربات القلب.' },
  { id: 'display', name: 'الشاشة ومنظّم التيار', en: 'Display & current knob', far: 0.42,
    desc: 'بتضبط شدة التيار. قاعدة تقريبية للصلب: حوالي ٣٥–٤٠ أمبير لكل ١ مم سُمك.', facts: [], safety: '' },
  { id: 'sockets', name: 'أطراف التوصيل', en: 'Output terminals', far: 0.45,
    desc: 'في لحام TIG للصلب التورش بيتوصل على السالب (DCEN) والأرضي على الموجب.',
    facts: ['DCEN: حوالي ٧٠٪ من الحرارة في الشغلانة و٣٠٪ في التنجستن، فالتنجستن مايسيحش.'], safety: 'لو وصّلت التورش على الموجب، التنجستن هيسخن جداً ويسيح في البركة.' },
  { id: 'cylinder', name: 'أسطوانة الأرجون', en: 'Argon cylinder', far: 1.0,
    desc: 'الأرجون غاز خامل؛ مابيتفاعلش مع المعدن المنصهر، فبيحمي البركة والتنجستن من الهوا.',
    facts: ['لونها رمادي بكتف أخضر غامق (حسب المواصفة).'], safety: 'الأرجون أتقل من الهوا وممكن يطرد الأكسجين في الأماكن المقفولة؛ اشتغل في مكان متهوّي.' },
  { id: 'flow', name: 'منظم الأرجون بالعدّاد الزجاجي', en: 'Regulator / flowmeter', far: 0.4,
    desc: 'عداد بيبيّن ضغط الأسطوانة، وأنبوبة زجاج فيها كورة بتقيس التصرف باللتر/دقيقة.', facts: ['التصرف المناسب غالباً ٧–١٢ لتر/دقيقة.'], safety: '' },
  { id: 'torch', name: 'تورش TIG', en: 'TIG torch', far: 0.35, view: V3(0.3, 0.5, 1),
    desc: 'فيه الكوليت اللي بيمسك التنجستن، والفوهة السيراميك اللي بتوجّه الغاز، والغطا الخلفي، وزرار التشغيل.',
    facts: ['مقاس الفوهة (رقم ٥–٨) بيتحدد حسب التيار ونوع الوصلة.'], safety: 'رأس التورش بتسخن جداً؛ ماتمسكهاش بعد اللحام.' },
  { id: 'tungsten', name: 'قطب التنجستن', en: 'Tungsten electrode', far: 0.25, view: V3(0.3, 0.5, 1),
    desc: 'قطب غير مستهلك (مابيدوبش)، بيتبرى سن قلم للتيار المستمر، وبيطلع من الفوهة ٣–٥ مم.',
    facts: ['اللون على طرفه بيبيّن نوعه: أحمر (ثوريوم ٢٪)، رمادي (سيريوم)، ذهبي (لانثانم)، أخضر (نقي للألومنيوم AC).', 'البرد يكون طولي في اتجاه السن، مش لف.'], safety: 'لو التنجستن لمس البركة اتلوّث ولازم يتبرى تاني.' },
  { id: 'rods', name: 'أسلاك الإضافة', en: 'Filler rods (ER70S-6)', far: 0.4,
    desc: 'أسلاك بتتمسك باليد التانية وبتتغمس في طرف البركة الأمامي.', facts: ['اليد التانية بتغمس السلك والتورش ثابت؛ ماتلمسش التنجستن بالسلك.'], safety: '' },
  { id: 'pedal', name: 'دواسة القدم', en: 'Foot pedal', far: 0.5,
    desc: 'بتتحكم في التيار وانت شغال: تدوس أكتر = تيار أعلى، وتشيل رجلك تدريجياً في آخر الخط عشان مايحصلش شرخ في النهاية.', facts: [], safety: '' },
  { id: 'clamp', name: 'ماسك الأرضي', en: 'Work clamp', far: 0.4, desc: 'بيقفل الدائرة من الشغلانة للماكينة.', facts: [], safety: 'لازم يكون على سطح نضيف من الصدأ والدهان.' },
  { id: 'plates', name: 'قطع الشغل', en: 'Workpieces 3 mm', far: 0.4, desc: 'صاج صلب ٣ مم، وصلة تناكبية. في TIG النضافة أهم من أي طريقة تانية: لازم المعدن يتنضّف بالفرشاة والمذيب.', facts: [], safety: '' }
];

let ctxRef, m, cyl, flow, torch, tung, clamp, plugT, plugG, cableT, cableG, gasHose, pedal, pedalCable, rods, rod, tbox;
const st = { material: 'steel', mode: 'DC', current: 140, flowR: 0, post: 2, power: true, ppe: {} };
const asm = {};
const RANGE = { steel: [85, 125], alu: [110, 150] };
const DL = V3(0.34, -0.94, 0).normalize();   // torch tip direction in torch local space
const ROOT = V3(-0.62, 0, 0.02);

function buildTorch(M) {
  const g = new THREE.Group();
  const grip = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.75, bumpMap: Textures.knurl().bumpMap, bumpScale: 1.2 });
  const handle = mesh(new THREE.CylinderGeometry(0.0125, 0.014, 0.14, 24), grip); handle.rotation.z = Math.PI / 2 - 0.12; handle.position.set(-0.095, 0.01, 0); g.add(handle);
  const btn = mesh(new THREE.BoxGeometry(0.018, 0.006, 0.01), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.4 })); btn.position.set(-0.05, 0.022, 0); g.add(btn);
  const neck = mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.03, 16), M.blackPlastic); neck.rotation.z = Math.PI / 2; neck.position.set(-0.02, 0.004, 0); g.add(neck);
  const head = new THREE.Group(); head.quaternion.setFromUnitVectors(V3(0, -1, 0), DL); g.add(head);
  const hb = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.032, 20), M.blackPlastic); head.add(hb);
  const cap = mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.05, 16), M.blackPlastic); cap.position.y = 0.04; head.add(cap);
  const capEnd = mesh(new THREE.SphereGeometry(0.0085, 14, 10), M.blackPlastic); capEnd.position.y = 0.065; head.add(capEnd);
  const cup = mesh(new THREE.CylinderGeometry(0.0085, 0.006, 0.026, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8a08c, roughness: 0.75, side: THREE.DoubleSide })); cup.position.y = -0.029; head.add(cup);
  const collet = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 10), M.copper); collet.position.y = -0.025; head.add(collet);
  const tg = new THREE.Group();
  const w = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.35, metalness: 1 })); w.position.y = -0.035; tg.add(w);
  const point = mesh(new THREE.ConeGeometry(0.0012, 0.003, 10), w.material); point.rotation.x = Math.PI; point.position.y = -0.0515; tg.add(point);
  head.add(tg);
  g.userData = { tung: tg, tipL: DL.clone().multiplyScalar(0.053), anchor: V3(-0.17, 0.018, 0) };
  return g;
}

S.build = ctx => {
  ctxRef = ctx;
  const M = ctx.M, R = S.root;
  m = buildInverter(M, {
    w: 0.26, h: 0.34, d: 0.48, y: 0.13, color: 0x2b4c6f, cart: true,
    dispUV: [0.3, 0.2], swUV: [0.18, 0.55], ledUV: [0.12, 0.33], knobs: [[0.72, 0.24]],
    sockets: [['plus', 0.22, 0.84, true], ['minus', 0.5, 0.84, false], ['ctrl', 0.78, 0.84, false]],
    draw: (c, w, h) => {
      c.fillStyle = '#c9cfd9'; c.textAlign = 'center'; c.font = '600 34px "IBM Plex Mono", monospace'; c.fillText('TIG 200 AC/DC', w / 2, 52);
      c.fillStyle = '#7cc8ff'; c.fillRect(w / 2 - 130, 64, 260, 4);
      c.font = '600 24px "IBM Plex Sans Arabic", sans-serif'; c.fillStyle = '#9aa3b1'; c.fillText('التيار', w * 0.72, 250);
      c.font = '600 22px "IBM Plex Mono", monospace'; c.fillText('AC  DC', w * 0.3, 205); c.fillText('2T  4T', w * 0.62, 400); c.fillText('POST GAS', w * 0.3, 400);
      c.font = '600 48px "IBM Plex Mono", monospace'; c.fillStyle = '#ff7b6b'; c.fillText('+', w * 0.22, 600); c.fillStyle = '#e1e5ea'; c.fillText('−', w * 0.5, 600);
      c.font = '600 20px "IBM Plex Sans Arabic", sans-serif'; c.fillText('الدواسة', w * 0.78, 600);
    }
  });
  m.root.position.copy(ROOT); R.add(m.root);
  cyl = buildCylinder(M, { h: 1.2, r: 0.1, color: 0x7a7f86, shoulder: 0x1f5a3a, labelAr: 'أرجون', labelEn: 'Ar', valve: 'wheel' });
  cyl.position.set(-0.98, 0, -0.18); R.add(cyl);
  const strap = mesh(new THREE.TorusGeometry(0.105, 0.006, 6, 30), M.tube); strap.rotation.x = Math.PI / 2; strap.position.set(-0.98, 0.9, -0.18); R.add(strap);
  flow = buildFlowmeter(M); R.add(flow);
  torch = buildTorch(M); R.add(torch); tung = torch.userData.tung;
  clamp = buildClamp(M); R.add(clamp);
  plugT = buildPlug(M, false); plugG = buildPlug(M, true); R.add(plugT, plugG);
  cableT = new Cable(M, 0.008); cableG = new Cable(M); R.add(cableT.mesh, cableG.mesh);
  gasHose = new Cable({ rubber: new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.6 }) }, 0.004); R.add(gasHose.mesh);
  pedal = new THREE.Group();
  const pb = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.26), M.blackPlastic); pb.position.y = 0.015; pedal.add(pb);
  const pt = mesh(new THREE.BoxGeometry(0.14, 0.012, 0.2), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.8 })); pt.position.set(0, 0.05, 0.01); pt.rotation.x = -0.18; pedal.add(pt);
  pedal.position.set(-0.05, 0, 0.55); R.add(pedal);
  pedalCable = new Cable(M, 0.004); R.add(pedalCable.mesh);
  rods = new THREE.Group();
  for (let i = 0; i < 6; i++) { const r = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.9, 8), M.steel); r.rotation.z = Math.PI / 2; r.position.set(0, 0.0013, i * 0.003); rods.add(r); }
  rods.position.set(0.32, TABLE_Y, -0.2); R.add(rods);
  rod = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 8), M.steel); rod.visible = false; R.add(rod);
  tbox = new THREE.Group();
  const tb = mesh(new THREE.BoxGeometry(0.19, 0.016, 0.05), new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.8 })); tb.position.y = 0.008; tbox.add(tb);
  [0xcf2b23, 0x8f969c, 0xd1a032, 0x2f9a52].forEach((c, i) => { const t = mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.17, 8), M.steel); t.rotation.z = Math.PI / 2; t.position.set(0, 0.018, -0.015 + i * 0.01); tbox.add(t); const tip = mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.01, 8), new THREE.MeshStandardMaterial({ color: c })); tip.rotation.z = Math.PI / 2; tip.position.set(0.085, 0.018, -0.015 + i * 0.01); tbox.add(tip); });
  tbox.position.set(-0.02, TABLE_Y, 0.22); R.add(tbox);
  const tag = (o, id) => { o.userData.pick = id; };
  tag(m.body, 'machine'); tag(m.disp, 'display'); tag(m.knobs[0], 'display'); tag(m.sockets.plus, 'sockets'); tag(m.sockets.minus, 'sockets'); tag(m.sockets.ctrl, 'ctrl');
  tag(cyl, 'cylinder'); tag(flow, 'flow'); tag(torch, 'torch'); tag(clamp, 'clamp'); tag(plugT, 'plugT'); tag(plugG, 'plugG'); tag(pedal, 'pedal'); tag(rods, 'rods'); tag(tbox, 'tbox'); tag(m.sw, 'switch');
  tag(cableT.mesh, 'torch'); tag(cableG.mesh, 'clamp');
  S._pick = [m.body, m.disp, m.knobs[0], m.sockets.plus, m.sockets.minus, m.sockets.ctrl, cyl, flow, torch, clamp, plugT, plugG, pedal, rods, tbox, m.sw, cableT.mesh, cableG.mesh];
  S.setAssembled(true); setPower(true);
};
S.pickables = () => S._pick;
S.exploreMap = { plugT: 'sockets', plugG: 'sockets', ctrl: 'pedal', switch: 'machine', tbox: 'tungsten' };
S.enter = ctx => ctx.setPlates({ t: 0.003, kind: 'butt' });

const POSE = {
  torchRest: { p: V3(0.66, TABLE_Y + 0.016, 0.22), r: new THREE.Euler(0, Math.PI + 0.25, 0) },
  clampOn: { p: V3(0.86, TABLE_Y - 0.006, -0.06), r: new THREE.Euler(0, Math.PI, 0) },
  clampFloor: { p: V3(0.62, 0.018, 0.62), r: new THREE.Euler(Math.PI / 2, 0, 0.6) },
  plugTFloor: { p: V3(-0.3, 0.017, 0.62), r: new THREE.Euler(0, 1.9, 0) },
  plugGFloor: { p: V3(-0.1, 0.017, 0.7), r: new THREE.Euler(0, 1.2, 0) },
  flowShelf: { p: V3(-0.82, 0.14, 0.38), r: new THREE.Euler(0, 0.4, 0) }
};
const ap = (o, p) => { o.position.copy(p.p); o.rotation.copy(p.r); };
const sockW = k => { m.root.updateMatrixWorld(true); return m.socketWorld(k).add(V3(0, 0, 0.012)); };
function outletW(o) { o.updateMatrixWorld(true); return (o.userData.outletLocal).clone().applyMatrix4(o.matrixWorld); }
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3();
const anc = (o, l) => { o.updateMatrixWorld(true); return l.clone().applyMatrix4(o.matrixWorld); };
const dirW = (o, l) => { o.updateMatrixWorld(true); return l.clone().transformDirection(o.matrixWorld); };
function updateCables(free) {
  cableT.update(anc(plugT, plugT.userData.cableAnchor), dirW(plugT, V3(0, 0, 1)), anc(torch, torch.userData.anchor), dirW(torch, V3(-1, 0.1, 0)).normalize(), { bSide: free ? 'free' : 'table', lipX: 0.6 });
  cableG.update(anc(plugG, plugG.userData.cableAnchor), dirW(plugG, V3(0, 0, 1)), anc(clamp, clamp.userData.cableAnchor), dirW(clamp, V3(-1, 0, 0)), { bSide: asm.clamp ? 'hang' : 'floor' });
  gasHose.mesh.visible = !!asm.hose;
  if (asm.hose) { const a = outletW(flow); const b = anc(m.body, V3(0.13, -0.12, -0.2)); gasHose.update(a, V3(1, -0.4, 0.3).normalize(), b, V3(-1, 0, 0), { bSide: 'floor' }); }
  pedalCable.mesh.visible = true;
  const pa = pedal.localToWorld(V3(0, 0.02, -0.13));
  const pb = asm.pedal ? sockW('ctrl') : pa.clone().add(V3(-0.15, -0.015, -0.1));
  pedalCable.update(pa, V3(0, 0, -1), pb, asm.pedal ? V3(0, 0, 1) : V3(1, 0, 0), { bSide: 'floor' });
}
S.afterMove = () => updateCables();
function setPower(on) { st.power = on; m.sw.userData.rocker.rotation.x = on ? -0.18 : 0.18; m.led.material = on ? ctxRef.M.ledGreenOn : ctxRef.M.ledGreenOff; updateMachine(); }
function updateMachine() { m.knobs[0].rotation.z = THREE.MathUtils.degToRad(135 - ((st.current - 10) / 190) * 270); m.draw(String(st.current), st.power); flow.userData.setFlow(asm.flow ? st.flowR : 0); flow.userData.hp.set(asm.flow ? 180 : 0); }
S.setAssembled = all => {
  ['plugT', 'plugG', 'clamp', 'flow', 'hose', 'tung', 'pedal'].forEach(k => asm[k] = all);
  if (all) { plugT.position.copy(sockW('minus')); plugT.rotation.set(0, 0, 0); plugG.position.copy(sockW('plus')); plugG.rotation.set(0, 0, 0); ap(clamp, POSE.clampOn); flow.position.copy(outletW(cyl)); flow.rotation.set(0, 0, 0); }
  else { ap(plugT, POSE.plugTFloor); ap(plugG, POSE.plugGFloor); ap(clamp, POSE.clampFloor); ap(flow, POSE.flowShelf); }
  ap(torch, POSE.torchRest); tung.visible = all;
  if (!all) st.flowR = 0; else if (!st.flowR) st.flowR = 10;
  updateCables(); updateMachine && m && updateMachine();
};

// explore
S.partObject = id => ({ machine: m.body, display: m.disp, sockets: m.sockets.minus, cylinder: cyl, flow, torch, tungsten: tung, rods, pedal, clamp, plates: ctxRef.shared.plates }[id]);
S.partHighlight = id => id === 'sockets' ? [m.sockets.plus, m.sockets.minus] : id === 'tungsten' ? [tung, tbox] : [S.partObject(id)];
S.partAnchor = id => {
  const v = new THREE.Vector3();
  switch (id) {
    case 'machine': m.body.localToWorld(v.set(0.13, 0.05, 0)); break;
    case 'display': m.disp.getWorldPosition(v); break;
    case 'sockets': m.sockets.minus.getWorldPosition(v); break;
    case 'cylinder': cyl.localToWorld(v.set(0, 0.7, 0.1)); break;
    case 'flow': flow.localToWorld(v.set(0.1, 0.06, 0.02)); break;
    case 'torch': torch.localToWorld(v.set(-0.08, 0.02, 0)); break;
    case 'tungsten': torch.localToWorld(v.copy(torch.userData.tipL)); break;
    case 'rods': rods.getWorldPosition(v); break;
    case 'pedal': pedal.getWorldPosition(v); v.y += 0.05; break;
    case 'clamp': clamp.getWorldPosition(v); break;
    case 'plates': v.set(0.3, JOINT.y, 0.05); break;
  }
  return v;
};
S.explodeItems = () => [{ o: torch, d: V3(0, 0.15, 0.05) }, { o: flow, d: V3(0.12, 0.05, 0.1) }, { o: plugT, d: V3(0, 0.02, 0.12) }, { o: plugG, d: V3(0, 0.02, 0.12) }, { o: clamp, d: V3(0.1, 0.1, 0) }];
S.cams = {
  explore: () => ({ pos: V3(0.6, 1.3, 1.42), target: V3(-0.05, 0.6, 0.06) }),
  assemble: () => ({ pos: V3(0.15, 1.25, 1.6), target: V3(-0.25, 0.45, 0.15) }),
  operate: () => ({ pos: V3(-0.45, 0.6, 0.82), target: V3(-0.62, 0.32, 0.28) })
};

// assemble
S.asmSteps = [
  { id: 'power', title: 'اطفي الماكينة', hint: 'المس مفتاح التشغيل الأحمر.' },
  { id: 'plugT', title: 'وصّل كابل التورش بالطرف السالب (−)', hint: 'المس فيشة التورش اللي على الأرض، وبعدين الطرف المناسب.' },
  { id: 'plugG', title: 'وصّل كابل الأرضي بالطرف الموجب (+)', hint: 'المس فيشة الأرضي، وبعدين الطرف الفاضي.' },
  { id: 'clamp', title: 'ثبّت ماسك الأرضي على الطاولة', hint: 'المس ماسك الأرضي اللي على الأرض.' },
  { id: 'flow', title: 'نضّف صمام الأرجون وركّب العداد', hint: 'المس أسطوانة الأرجون.' },
  { id: 'hose', title: 'وصّل خرطوم الغاز من العداد للماكينة', hint: 'المس عداد الأرجون.' },
  { id: 'tung', title: 'ركّب التنجستن (أحمر ٢٪، مبري سن قلم) وطلّعه ٤ مم', hint: 'المس علبة التنجستن.' },
  { id: 'pedal', title: 'وصّل دواسة القدم', hint: 'المس الدواسة اللي على الأرض.' }
];
S.asmStart = () => { setPower(true); };
S.asmTargets = (step, ctx) => {
  const s = S.asmSteps[step]; if (!s) return [];
  const p = ctx.state.asm.picked;
  return { power: [m.sw], plugT: p ? [m.sockets.plus, m.sockets.minus] : [plugT], plugG: p ? [m.sockets.plus] : [plugG], clamp: [clamp], flow: [cyl], hose: [flow], tung: [tbox], pedal: [pedal] }[s.id];
};
function moveObj(ctx, obj, toP, toR, dur, done0) {
  ctx.state.asm.busy = true; const done = () => { ctx.state.asm.busy = false; done0 && done0(); };
  const p0 = obj.position.clone(), q0 = obj.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(toR);
  ctx.E.tween(dur, k => { const e = ctx.ease(k); obj.position.lerpVectors(p0, toP, e); obj.position.y += Math.sin(Math.PI * e) * 0.1; obj.quaternion.slerpQuaternions(q0, q1, e); updateCables(); }, done);
}
S.asmPick = (id, ctx, r) => {
  const a = ctx.state.asm, s = S.asmSteps[a.step]; if (!s) return;
  if (st.power && s.id !== 'power' && id !== 'switch' && ['plugT', 'plugG'].includes(s.id)) return ctx.asmMsg('bad', 'اطفي الماكينة الأول قبل توصيل الكابلات.');
  switch (s.id) {
    case 'power': if (id === 'switch') { setPower(false); ctx.audio.click(); ctx.next('الماكينة مطفية.'); } else ctx.asmMsg('bad', 'أول خطوة: اطفي الماكينة.'); break;
    case 'plugT': case 'plugG': {
      const isT = s.id === 'plugT', plug = isT ? plugT : plugG;
      if (!a.picked) { if (id === s.id) { a.picked = true; ctx.asmMsg('info', 'المس الطرف اللي هتوصّل فيه.'); ctx.E.setHighlight(S.asmTargets(a.step, ctx)); } else ctx.asmMsg('bad', isT ? 'المس فيشة كابل التورش الأول.' : 'المس فيشة كابل الأرضي.'); return; }
      if (id !== 'sockets') return ctx.asmMsg('bad', 'المس طرف توصيل في الماكينة.');
      const which = r && r.object === m.sockets.plus ? 'plus' : 'minus';
      if (isT && which === 'plus') return ctx.asmMsg('bad', 'لأ! في TIG للصلب التورش على السالب (DCEN). لو على الموجب التنجستن هيسخن ويسيح.');
      if (!isT && which === 'minus') return ctx.asmMsg('bad', 'الطرف السالب عليه التورش. الأرضي على الموجب.');
      a.picked = null; ctx.E.setHighlight([]);
      moveObj(ctx, plug, sockW(which), new THREE.Euler(0, 0, 0), 1, () => { asm[s.id] = true; ctx.audio.click(); ctx.next(isT ? 'التورش على السالب = DCEN. ٧٠٪ من الحرارة في الشغلانة.' : 'الأرضي على الموجب.'); });
      break;
    }
    case 'clamp': if (id === 'clamp') { ctx.E.setHighlight([]); moveObj(ctx, clamp, POSE.clampOn.p, POSE.clampOn.r, 1, () => { asm.clamp = true; updateCables(); ctx.next('ماسك الأرضي متثبّت.'); }); } else ctx.asmMsg('bad', 'المس ماسك الأرضي.'); break;
    case 'flow': if (id === 'cylinder' || id === 'flow') { ctx.E.setHighlight([]); moveObj(ctx, flow, outletW(cyl), new THREE.Euler(0, 0, 0), 1, () => { asm.flow = true; updateMachine(); ctx.next('نضّفت الصمام وركّبت العداد. عداد المحتوى بيقرا ضغط الأسطوانة.'); }); } else ctx.asmMsg('bad', 'المس أسطوانة الأرجون.'); break;
    case 'hose': if (id === 'flow') { asm.hose = true; updateCables(); ctx.audio.click(); ctx.next('خرطوم الغاز اتوصّل لمدخل الغاز في ضهر الماكينة.'); } else ctx.asmMsg('bad', 'المس عداد الأرجون.'); break;
    case 'tung': if (id === 'tbox') { tung.visible = true; asm.tung = true; ctx.next('اخترت التنجستن الأحمر (٢٪ ثوريوم) للتيار المستمر، مبري سن قلم، وطالع ٤ مم من الفوهة.'); ctx.E.flyTo(V3(0.75, TABLE_Y + 0.12, 0.38), anc(torch, torch.userData.tipL)); } else ctx.asmMsg('bad', 'المس علبة التنجستن.'); break;
    case 'pedal': if (id === 'pedal' || id === 'ctrl') { asm.pedal = true; updateCables(); ctx.next('الدواسة اتوصّلت. المعدة جاهزة.'); } else ctx.asmMsg('bad', 'المس دواسة القدم.'); break;
  }
};
S.asmAuto = ctx => {
  const a = ctx.state.asm, s = S.asmSteps[a.step]; if (!s) return;
  if (s.id === 'power') S.asmPick('switch', ctx);
  else if (s.id === 'plugT' || s.id === 'plugG') { if (!a.picked) S.asmPick(s.id, ctx); S.asmPick('sockets', ctx, { object: s.id === 'plugT' ? m.sockets.minus : m.sockets.plus }); }
  else S.asmPick({ clamp: 'clamp', flow: 'cylinder', hose: 'flow', tung: 'tbox', pedal: 'pedal' }[s.id], ctx);
};

// operate
S.operateEnter = ctx => { updateMachine(); };
S.operatePick = (id, ctx) => { if (id === 'switch') { setPower(!st.power); ctx.renderPanel(); } };
const pen = (v, [a, b], k) => v < a ? (a - v) * k : v > b ? (v - b) * k : 0;
S.operateHTML = () => {
  const r = RANGE[st.material], c = st.current, pct = (v, lo, hi) => ((v - lo) / (hi - lo)) * 100;
  const okMode = (st.material === 'steel') === (st.mode === 'DC');
  const ppe = [['helmet', 'ماسك عدسة ١٠–١١'], ['gloves', 'جوانتي TIG رفيع'], ['jacket', 'جاكيت لحام'], ['clean', 'نضّفت المعدن']];
  return `
    <section class="card"><h3 class="sm">المعدن</h3><div class="seg2"><button type="button" class="${st.material === 'steel' ? 'on' : ''}" data-op="mat:steel">صلب ٣ مم</button><button type="button" class="${st.material === 'alu' ? 'on' : ''}" data-op="mat:alu">ألومنيوم ٣ مم</button></div></section>
    <section class="card"><div class="ph"><h3 class="sm">نوع التيار</h3><span class="tag ${okMode ? 'ok' : 'high'}">${okMode ? 'مناسب' : 'غير مناسب'}</span></div>
      <div class="seg2"><button type="button" class="${st.mode === 'DC' ? 'on' : ''}" data-op="mode:DC">DC− مستمر</button><button type="button" class="${st.mode === 'AC' ? 'on' : ''}" data-op="mode:AC">AC متردد</button></div>
      <p class="muted small">الصلب والاستانلس: تيار مستمر والتورش سالب. الألومنيوم: تيار متردد عشان يكسّر طبقة الأكسيد (ومعاه تنجستن أخضر أو زيركونيوم).</p></section>
    <section class="card"><div class="ph"><h3 class="sm">شدة التيار</h3><span class="tag ${c >= r[0] && c <= r[1] ? 'ok' : c < r[0] ? 'low' : 'high'}">${r[0]}–${r[1]} A</span></div>
      <div class="cur-ctl"><button type="button" class="round" data-op="cur-" aria-label="قلّل">${ICON.minus}</button><div class="cur-val"><span class="mono">${c}</span><small class="mono">A</small></div><button type="button" class="round acc" data-op="cur+" aria-label="زوّد">${ICON.plus}</button></div>
      <input type="range" min="10" max="200" step="5" value="${c}" data-op="current" aria-label="التيار"></section>
    <section class="card"><div class="ph"><h3 class="sm">تصرّف الأرجون</h3><span class="tag ${st.flowR >= 7 && st.flowR <= 12 ? 'ok' : 'low'}">${st.flowR} L/min</span></div>
      <input type="range" min="0" max="25" step="1" value="${st.flowR}" data-op="flowR" aria-label="تصرف الغاز">
      <p class="muted small">المناسب ٧–١٢ لتر/دقيقة. القليل مش هيحمي البركة، والكتير بيعمل دوامات تسحب هوا.</p>
      <div class="lbl-row"><span>غاز بعد اللحام (Post-flow)</span><b class="mono">${st.post} s</b></div>
      <input type="range" min="0" max="15" step="1" value="${st.post}" data-op="post" aria-label="زمن الغاز بعد اللحام"></section>
    <section class="card"><h3 class="sm">قبل ما تبدأ</h3><div class="ppe">${ppe.map(([k, n]) => `<button type="button" class="${st.ppe[k] ? 'on' : ''}" data-op="ppe:${k}">${st.ppe[k] ? ICON.check : ICON.shield}${n}</button>`).join('')}</div></section>
    <button type="button" class="btn ${st.power ? 'on-green' : ''}" data-op="power">${ICON.bolt}${st.power ? 'الماكينة شغالة' : 'شغّل الماكينة'}</button>`;
};
S.operateAction = (op, el, ctx) => {
  if (op.startsWith('range:')) { const k = op.slice(6); st[k === 'current' ? 'current' : k] = +el.value; updateMachine(); clearTimeout(S._t); S._t = setTimeout(() => ctx.renderPanel(), 150); return; }
  if (op.startsWith('mat:')) st.material = op.slice(4);
  else if (op.startsWith('mode:')) st.mode = op.slice(5);
  else if (op === 'cur-' || op === 'cur+') st.current = THREE.MathUtils.clamp(st.current + (op === 'cur+' ? 5 : -5), 10, 200);
  else if (op.startsWith('ppe:')) { const k = op.slice(4); st.ppe[k] = !st.ppe[k]; }
  else if (op === 'power') setPower(!st.power);
  ctx.audio.click(); updateMachine(); ctx.renderPanel();
};
S.operateReady = () => {
  const r = RANGE[st.material];
  if (!st.power) return { ok: false, label: 'شغّل الماكينة' };
  if (!['helmet', 'gloves', 'jacket', 'clean'].every(k => st.ppe[k])) return { ok: false, label: 'كمّل قائمة «قبل ما تبدأ»' };
  if (st.flowR < 3) return { ok: false, label: 'افتح الغاز' };
  const ok = st.current >= r[0] && st.current <= r[1] && st.flowR >= 7 && st.flowR <= 12 && (st.material === 'steel') === (st.mode === 'DC') && st.post >= 4;
  return { ok: true, label: ok ? 'ابدأ اللحام' : 'ابدأ (في إعدادات مش مظبوطة)' };
};

// weld
S.weldSettings = () => ({ ...st });
S.weldProc = () => {
  const r = RANGE[st.material], gasOK = st.flowR >= 7 && st.flowR <= 12, modeOK = (st.material === 'steel') === (st.mode === 'DC'), postOK = st.post >= 4;
  return {
    kind: 'arc', distName: 'طول القوس', angleName: 'زاوية التورش', settingName: 'الإعدادات (تيار/غاز)', angleShort: 'زاوية التورش',
    ideal: { angle: [70, 82], speed: [1.4, 3.0], dist: [1.5, 3.0] },
    strikeBelow: 3.5, stickBelow: 0.5, breakAbove: 7, grace: 0.15,
    stickMsg: 'التنجستن لمس البركة واتلوّث! في الحقيقة لازم توقف وتبري التنجستن تاني. ارفع صباعك وكمّل وانت بعيد شوية.',
    breakMsg: 'القوس طويل جداً واتقطع. في TIG القوس قصير: حوالي قطر التنجستن.',
    pauseMsg: 'وقفت. خلّي التورش مكانه ثواني عشان الغاز بعد اللحام يحمي الخط.',
    fillerLen: 0.9, aux: { label: 'سلك الإضافة', hint: 'اغمس في طرف البركة', icon: ICON.plus },
    spacing: 0.0016, distPerMM: 0.25, relDistPerPx: 0.018, arcColor: 0xcfe6ff, arcSize: 0.022, lightIntensity: 0.3, smoke: 0.4, sound: 'tig',
    bead: { color: [0.82, 0.8, 0.76], hot: [3.2, 1.6, 0.6], metal: 0.92, rough: 0.22, tint: (rr, i, n, c) => gasOK && postOK ? (i % 2 ? c.setRGB(0.86, 0.78, 0.55) : c.setRGB(0.78, 0.8, 0.86)) : c.setRGB(0.45, 0.45, 0.46) },
    coolTime: 3.5,
    dims: s => {
      const heat = THREE.MathUtils.clamp((s.settings.current - r[0]) / (r[1] - r[0]), -0.6, 1.6), sp = THREE.MathUtils.clamp(s.speed || 2, 0.5, 8);
      return { w: THREE.MathUtils.clamp(5.2 * (0.85 + heat * 0.25) * Math.pow(2.2 / sp, 0.4), 3, 10), h: s.aux ? 1.3 * Math.pow(2.2 / sp, 0.4) : 0.35, wobble: 0.35 };
    },
    flags: s => ({ pore: (!gasOK ? 0.2 : 0) + (s.dist > 3.6 ? 0.1 : 0), spatter: 0, undercut: (s.speed > 3.8 || s.settings.current > r[1] + 5) ? 0.5 : 0 }),
    sparks: () => 3,
    poolMM: s => 4.5 + (s.settings.current - r[0]) * 0.02,
    settingScore: set => ({ v: Math.max(15, 100 - pen(set.current, r, 1.8) - pen(set.flowR, [7, 12], 8) - (modeOK ? 0 : 50) - (postOK ? 0 : 15)), note: `${modeOK ? '' : 'نوع التيار مش مناسب للمعدن. '}${gasOK ? '' : 'تصرّف الغاز خارج ٧–١٢ لتر/دقيقة. '}${postOK ? '' : 'زمن الغاز بعد اللحام قليل.'}` }),
    penetration: set => THREE.MathUtils.clamp(((set.current - r[0]) / (r[1] - r[0])) * 0.5 + 0.7, 0.3, 1.3),
    defects: c => {
      const out = [];
      if (c.events.stuck) out.push({ name: 'تلوّث التنجستن', en: 'Tungsten contamination', cause: 'التنجستن لمس البركة ' + c.AR(c.events.stuck) + ' مرة؛ ده بيدخّل تنجستن في الخط ويبوّظ القوس.', fix: 'حافظ على مسافة ١٫٥–٣ مم، وبري التنجستن بعد أي لمسة.' });
      if (c.count('nofill')) out.push({ name: 'نقص امتلاء', en: 'Underfill', cause: 'ماغمستش سلك كفاية في ' + c.AR(c.count('nofill')) + ' منطقة.', fix: 'اغمس السلك في طرف البركة الأمامي بإيقاع ثابت.' });
      if (!gasOK || c.sim.pores.count > 2) out.push({ name: 'مسامية', en: 'Porosity', cause: gasOK ? 'القوس طويل فالغاز ماغطاش البركة كويس.' : 'تصرّف الأرجون ' + st.flowR + ' لتر/دقيقة، خارج المدى المناسب.', fix: 'اضبط الغاز ٧–١٢ لتر/دقيقة وقصّر القوس.' });
      if (!postOK || !gasOK) out.push({ name: 'أكسدة الخط (لون رمادي باهت)', en: 'Oxidation', cause: !postOK ? 'زمن الغاز بعد اللحام قليل؛ الخط اتأكسد وهو سخن.' : 'الحماية بالغاز ضعيفة.', fix: 'خلّي الـ Post-flow ٤ ثواني على الأقل وخلّي التورش مكانه لحد ما الغاز يقف.' });
      if (!modeOK) out.push({ name: 'نوع تيار غلط', en: 'Wrong polarity/mode', cause: st.material === 'steel' ? 'لحمت صلب على AC.' : 'لحمت ألومنيوم على DC؛ طبقة الأكسيد ماتكسرتش.', fix: 'الصلب: DC−. الألومنيوم: AC.' });
      if (c.count('fast') || st.current > r[1] + 5) out.push({ name: 'تآكل الحواف', en: 'Undercut', cause: st.current > r[1] + 5 ? 'التيار عالي.' : 'السرعة عالية.', fix: 'بطّأ واضبط التيار.' });
      if (st.current < r[0]) out.push({ name: 'نقص الاختراق', en: 'Incomplete penetration', cause: 'التيار أقل من المناسب.', fix: 'زوّد التيار أو بطّأ.' });
      return out;
    },
    hint: 'المس بداية الوصلة: القوس بيولّع لوحده (HF) من غير لمس. اتحرك ببطء واغمس السلك بالزرار.'
  };
};
S.hud = ctx => {
  const p = ctx.sim.proc, w = ctx.state.weld, sim = ctx.sim, r = RANGE[st.material];
  return [
    { id: 'angle', label: 'زاوية التورش', hint: '70–82°', get: () => ({ val: ctx.state.angle, txt: ctx.state.angle + '°', min: 30, max: 90, lo: 70, hi: 82 }) },
    { id: 'speed', label: 'سرعة التقدّم', hint: '1.4–3 mm/s', get: o => ({ val: sim.on ? o.speed : null, txt: sim.on ? o.speed.toFixed(1) : '--', min: 0, max: 6, lo: 1.4, hi: 3 }) },
    { id: 'dist', label: 'طول القوس', hint: '1.5–3 مم', get: () => ({ val: w.pressing ? w.eff : null, txt: w.pressing ? (w.eff ?? 0).toFixed(1) + ' mm' : '--', min: 0, max: 7, lo: 1.5, hi: 3 }) },
    { id: 'cur', label: 'التيار / الغاز', bar: false, hint: r.join('–') + ' A', get: () => ({ txt: st.current + 'A • ' + st.flowR + 'L' }) }
  ];
};
S.coach = (ctx, o) => {
  const w = ctx.state.weld;
  if (o.speed > 3.6) return 'بطّأ… TIG أبطأ من القوس العادي';
  if (o.speed < 0.9 && ctx.sim.time > 2) return 'اتحرك شوية';
  if (w.eff > 3.4) return 'القوس طويل، قرّب التورش';
  if (w.eff < 1.2) return 'خلي بالك! التنجستن قرب يلمس البركة';
  if (ctx.state.angle < 66 || ctx.state.angle > 86) return 'اظبط زاوية التورش ٧٠–٨٠°';
  if (ctx.sim.time > 3 && !w.aux && Math.random() < 0.015) return 'اغمس سلك الإضافة';
  return null;
};
let tick = 0;
S.weldEnter = ctx => { S.enter(ctx); ctx.state.angle = 75; rod.visible = true; tung.visible = true; ctx.resetTip(JOINT.x0 - 0.02, JOINT.y + 0.03); if (!st.power) setPower(true); };
S.weldPose = (ctx, tip, dt) => {
  const a = THREE.MathUtils.degToRad(ctx.state.angle);
  const dw = V3(Math.cos(a), -Math.sin(a), -0.12).normalize();   // push angle: torch leans back, tip points forward
  orientTool(torch, DL, V3(-1, 0.3, 0), dw, V3(-0.8, 0.5, 0.3));
  torch.updateMatrixWorld(true);
  const tipW = torch.userData.tipL.clone().applyQuaternion(torch.quaternion);
  const puddle = V3(tip.x, JOINT.y, JOINT.z), dm = Math.max(0.0002, tip.y - JOINT.y);
  torch.position.copy(puddle.addScaledVector(dw, -dm)).sub(tipW);
  const w = ctx.state.weld, dip = w.aux && w.pressing;
  const rt = V3(tip.x + 0.004, JOINT.y + (dip ? 0.001 : 0.006), JOINT.z + 0.003), rdir = V3(0.75, 0.35, 0.55).normalize();
  rod.quaternion.setFromUnitVectors(V3(0, 1, 0), rdir); rod.scale.y = Math.max(0.05, ctx.sim.filler || 0.9); rod.position.copy(rt).addScaledVector(rdir, rod.scale.y / 2);
  if ((tick++ & 1) === 0) updateCables(true);
};
S.weldExit = () => { rod.visible = false; ap(torch, POSE.torchRest); updateCables(); };
S.inspectEnter = () => { ap(torch, POSE.torchRest); updateCables(); };

export default S;
