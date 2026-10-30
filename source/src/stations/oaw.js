// Station: Oxy-acetylene welding & cutting (اللحام والقطع بالغاز)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Cable, TABLE_Y, JOINT } from '../models.js';
import { buildCylinder, buildRegulator, buildFlame, flameType, FLAME_NAMES, mesh } from '../gasparts.js';
import { Textures } from '../textures.js';
import { ICON } from '../core/icons.js';
import { AR } from '../data.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

const S = {
  id: 'oaw', name: 'اللحام والقطع بالغاز', code: 'OAW / OFC', icon: ICON.flame, ready: true,
  stages: [['explore', 'تعرّف'], ['assemble', 'ركّب'], ['operate', 'أشعل واضبط'], ['weld', 'الحم / اقطع'], ['inspect', 'افحص']]
};

S.parts = [
  { id: 'cylO', name: 'أسطوانة الأكسجين', en: 'Oxygen cylinder', far: 1.1,
    desc: 'أسطوانة صلب طويلة مملوءة بالأكسجين المضغوط (حوالي ١٥٠–٢٠٠ بار). الأكسجين نفسه لا يشتعل، لكنه يساعد أي مادة على الاشتعال بعنف.',
    facts: ['لونها المعتمد لدينا: جسم أسود وكتف أبيض (حسب المواصفة).', 'يُفتح صمامها بالكامل أثناء العمل حتى لا يسرّب الحشو.'],
    safety: 'يُمنع الزيت والشحم نهائيًا على صمامات الأكسجين ووصلاته؛ فقد يشتعل وينفجر.' },
  { id: 'cylA', name: 'أسطوانة الأسيتيلين', en: 'Acetylene cylinder', far: 1.0,
    desc: 'الأسيتيلين غاز قابل للاشتعال، ومذاب داخل الأسطوانة في مادة الأسيتون مع حشو مسامي حتى لا يكون خطرًا تحت الضغط.',
    facts: ['ضغطها حوالي ١٥–١٨ بار فقط، ولونها أحمر طوبي (مارون).', 'يجب أن تظل واقفة رأسيًا حتى لا يخرج الأسيتون مع الغاز.', 'يُفتح صمامها من ربع إلى نصف لفة فقط، ويظل المفتاح عليه للإغلاق السريع.'],
    safety: 'ضغط تشغيل الأسيتيلين يجب ألا يتجاوز ١ بار (١٥ psi)؛ فوق ذلك يصبح غير مستقر ومعرّضًا للانفجار.' },
  { id: 'chain', name: 'سلسلة التثبيت والعربة', en: 'Cylinder cart & chain', far: 0.9,
    desc: 'عربة بعجلتين تحمل الأسطوانتين معًا، وسلسلة تربطهما حتى لا تسقطا.',
    facts: ['إذا سقطت الأسطوانة وانكسر الصمام فقد تتحول إلى صاروخ.'], safety: 'اربط الأسطوانات دائمًا، حتى لو ستستخدمها دقائق.' },
  { id: 'valves', name: 'صمامات الأسطوانات', en: 'Cylinder valves', far: 0.45,
    desc: 'صمام الأكسجين بعجلة يد، وصمام الأسيتيلين بمفتاح مربع. قبل تركيب المنظم نفتح الصمام ونغلقه بسرعة لتنظيف المخرج من الأتربة.',
    facts: ['تُسمّى هذه العملية «تنظيف الصمام» (Cracking).'], safety: 'قف بجانب مخرج الصمام وليس أمامه أثناء فتحه.' },
  { id: 'regO', name: 'منظم الأكسجين', en: 'Oxygen regulator', far: 0.42,
    desc: 'يخفض ضغط الأسطوانة العالي إلى ضغط تشغيل ثابت. فيه عدادان: عداد المحتوى (ضغط الأسطوانة) وعداد التشغيل (الضغط الخارج إلى البوري).',
    facts: ['وصلته ذات سن يمين عادي.', 'نزيد ضغط التشغيل بإدارة مسمار الضبط مع عقارب الساعة.'], safety: 'فُكّ مسمار الضبط قبل فتح صمام الأسطوانة حتى لا يتلف العداد.' },
  { id: 'regA', name: 'منظم الأسيتيلين', en: 'Acetylene regulator', far: 0.42,
    desc: 'نفس فكرة منظم الأكسجين، لكن عداد التشغيل فيه منطقة حمراء فوق ١ بار.',
    facts: ['وصلته ذات سن شمال، وعلى الصامولة حزّة تدل على أنها لغاز الوقود.'], safety: 'لا تعمل أبدًا بضغط أسيتيلين فوق ١ بار.' },
  { id: 'arrest', name: 'صمامات منع الارتداد', en: 'Flashback arrestors', far: 0.4,
    desc: 'تمنع اللهب إذا ارتد داخل الخرطوم من الوصول إلى المنظم أو الأسطوانة، وتمنع أيضًا رجوع الغاز.',
    facts: ['تُركّب على مخرج كل منظم، وأحيانًا أيضًا عند مقبض البوري.'], safety: 'يُمنع تشغيل جهاز الغاز بدون صمامات منع الارتداد.' },
  { id: 'hoses', name: 'الخراطيم', en: 'Twin hoses', far: 0.95,
    desc: 'خرطوم أزرق للأكسجين، وخرطوم أحمر للأسيتيلين.',
    facts: ['وصلة خرطوم الأسيتيلين ذات سن شمال أيضًا.'], safety: 'افحص الخراطيم من التشقق، ولا تضعها تحت الشرر أو الحديد الساخن.' },
  { id: 'torch', name: 'بوري اللحام', en: 'Welding torch (blowpipe)', far: 0.42,
    desc: 'في المقبض صمامان (أحمر للأسيتيلين وأزرق للأكسجين) وغرفة خلط، وفي نهايته الفونية. يُحدد حجم الفونية حسب سُمك المعدن.',
    facts: ['الإشعال: افتح الأسيتيلين أولًا وأشعل، ثم زِد الأكسجين.', 'الإطفاء: أغلق الأسيتيلين أولًا، ثم الأكسجين.'], safety: 'إذا سمعت صفيرًا أو فرقعة داخل البوري (ارتداد اللهب) أغلق الأكسجين فورًا، ثم الأسيتيلين.' },
  { id: 'cutter', name: 'بوري القطع', en: 'Cutting attachment', far: 0.42,
    desc: 'يسخّن الحديد حتى الاحمرار بلهب التسخين، ثم يُخرج ذراع أكسجين القطع تيارًا من الأكسجين النقي يؤكسد الحديد ويطرده.',
    facts: ['القطع بالأكسجين يصلح للصلب الكربوني فقط، وليس للألومنيوم أو الصلب الذي لا يصدأ.'], safety: 'يتطاير الشرر لمسافات بعيدة تحت القطعة؛ أبعِد أي مواد قابلة للاشتعال.' },
  { id: 'lighter', name: 'الولاعة ذات الحجر', en: 'Spark lighter', far: 0.35,
    desc: 'نُشعل بها البوري بأمان.', facts: [], safety: 'يُمنع إشعال البوري بالكبريت أو بالولاعة العادية.' },
  { id: 'rods', name: 'أسلاك الإضافة', en: 'Filler rods', far: 0.4,
    desc: 'أسلاك من الصلب مطلية بالنحاس، تُغمس في البركة المنصهرة لملء الوصلة.', facts: ['قطر السلك تقريبًا نصف سُمك الصاج + ١ مم.'], safety: '' },
  { id: 'goggles', name: 'نظارة لحام الغاز', en: 'Gas welding goggles (shade 5)', far: 0.32,
    desc: 'نظارة بعدسة درجة ٤–٦ لحماية العين من ضوء اللهب والشرر. وهي أخف من عدسة قناع لحام القوس.', facts: [], safety: 'لا تستخدمها في لحام القوس الكهربائي؛ فهي غير كافية.' }
];
S.exploreMap = { valveO: 'valves', valveA: 'valves', hoseO: 'hoses', hoseA: 'hoses', arrO: 'arrest', arrA: 'arrest', soap: 'lighter' };

let ctxRef, cylO, cylA, regO, regA, arrO, arrA, hoseO, hoseA, torch, flame, chain, cart, lighter, rods, goggles, rod, soap, puff;
const st = { task: 'weld', valveO: 0, valveA: 0, pO: 0, pA: 0, tA: 0, tO: 0, lit: false, leak: false, ppe: {}, fails: 0 };
const asm = {};
const CYL_O = V3(-0.86, 0.05, -0.1), CYL_A = V3(-0.53, 0.05, -0.1);

function torchTipDir(cut) { return cut ? V3(0, -1, 0) : V3(0.86, -0.5, 0).normalize(); }

function buildTorch(M) {
  const g = new THREE.Group(); // handle along +X, tip at the +X end
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.2, metalness: 1, bumpMap: Textures.knurl().bumpMap, bumpScale: 0.8 });
  const handle = mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.16, 24), chrome); handle.rotation.z = Math.PI / 2; handle.position.x = -0.08; g.add(handle);
  const body = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 20), M.brass); body.rotation.z = Math.PI / 2; body.position.x = -0.17; g.add(body);
  const kns = {};
  [[0x1d5fb8, 1], [0xb3261e, -1]].forEach(([c, s]) => {
    const kn = kns[s > 0 ? 'O' : 'A'] = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
    kn.position.set(-0.17, 0, s * 0.02); kn.rotation.x = Math.PI / 2; g.add(kn);
    const nip = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 10), M.brass); nip.rotation.z = Math.PI / 2; nip.position.set(-0.2, 0, s * 0.007); g.add(nip);
  });
  const mixer = mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.04, 16), M.brass); mixer.rotation.z = Math.PI / 2; mixer.position.x = 0.02; g.add(mixer);
  // welding neck (bent) + copper tip
  const weld = new THREE.Group();
  const neck = new THREE.CatmullRomCurve3([V3(0.04, 0, 0), V3(0.1, 0, 0), V3(0.13, -0.008, 0), V3(0.155, -0.023, 0)]);
  weld.add(mesh(new THREE.TubeGeometry(neck, 20, 0.0045, 10), M.copper));
  const tip = mesh(new THREE.CylinderGeometry(0.0025, 0.0048, 0.025, 14), M.copper); tip.position.set(0.166, -0.03, 0); tip.rotation.z = Math.PI / 2 + 0.52; weld.add(tip);
  g.add(weld);
  // cutting head: two tubes + 90° head + oxygen lever
  const cut = new THREE.Group();
  cut.add(mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V3(0.04, 0.004, 0), V3(0.17, 0.004, 0)), 4, 0.0045, 10), M.copper));
  cut.add(mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V3(0.04, -0.006, 0), V3(0.17, -0.006, 0)), 4, 0.0035, 10), M.copper));
  const head = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 16), M.brass); head.position.set(0.18, -0.008, 0); cut.add(head);
  const ctip = mesh(new THREE.CylinderGeometry(0.0045, 0.0065, 0.025, 16), M.copper); ctip.position.set(0.18, -0.035, 0); cut.add(ctip);
  const lever = mesh(new RoundedBoxGeometry(0.1, 0.006, 0.014, 2, 0.002), M.steel); lever.position.set(0.05, 0.02, 0); lever.rotation.z = -0.08; cut.add(lever);
  cut.visible = false; g.add(cut);
  g.userData = { knO: kns.O, knA: kns.A, weld, cut, lever, tipW: V3(0.178, -0.037, 0), tipC: V3(0.18, -0.048, 0), anchor: V3(-0.215, 0, 0) };
  return g;
}

function buildChain(M) {
  const g = new THREE.Group();
  const linkGeo = new THREE.TorusGeometry(0.009, 0.0022, 6, 12);
  // links follow an ellipse hugging both cylinders
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, b = ((i + 0.5) / N) * Math.PI * 2;
    const p = V3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.14), q = V3(Math.cos(b) * 0.3, 0, Math.sin(b) * 0.14);
    const l = mesh(linkGeo, M.steel, true, false);
    l.position.copy(p);
    l.quaternion.setFromUnitVectors(V3(1, 0, 0), q.sub(p).normalize());
    if (i % 2) l.rotateX(Math.PI / 2);
    g.add(l);
  }
  return g;
}

S.build = ctx => {
  ctxRef = ctx;
  const M = ctx.M, R = S.root;
  // cart
  cart = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(0.66, 0.03, 0.34), M.tube); deck.position.set(-0.695, 0.035, -0.1); cart.add(deck);
  [-1, 1].forEach(s => {
    const w = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 28), M.rubber); w.rotation.z = Math.PI / 2; w.position.set(-0.695 + s * 0.35, 0.08, -0.24); cart.add(w);
    const up = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 12), M.tube); up.position.set(-0.695 + s * 0.3, 0.6, -0.29); cart.add(up);
  });
  const bar = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.62, 12), M.rubber); bar.rotation.z = Math.PI / 2; bar.position.set(-0.695, 1.17, -0.29); cart.add(bar);
  const shelf = mesh(new THREE.BoxGeometry(0.6, 0.012, 0.12), M.tube); shelf.position.set(-0.695, 0.95, -0.33); cart.add(shelf);
  R.add(cart);
  cylO = buildCylinder(M, { h: 1.3, r: 0.1, color: 0x17191c, shoulder: 0xf1f1ee, labelAr: 'أكسجين', labelEn: 'O₂', valve: 'wheel' }); cylO.position.copy(CYL_O); R.add(cylO);
  cylA = buildCylinder(M, { h: 1.02, r: 0.125, color: 0x6e1a17, labelAr: 'أسيتيلين', labelEn: 'C₂H₂', valve: 'key' }); cylA.position.copy(CYL_A); R.add(cylA);
  chain = buildChain(M); chain.position.set(-0.695, 0.8, -0.1); R.add(chain);
  regO = buildRegulator(M, { tint: 0x1d4f8f, hpMax: 300, lpMax: 10 }); R.add(regO);
  regA = buildRegulator(M, { tint: 0x8e1e18, hpMax: 40, lpMax: 2.5, lpRed: 1.0, leftHand: true }); R.add(regA);
  const arrGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.045, 18);
  arrO = mesh(arrGeo, new THREE.MeshStandardMaterial({ color: 0x2a64b0, roughness: 0.35, metalness: 0.6 })); arrO.rotation.z = Math.PI / 2;
  arrA = mesh(arrGeo, new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.35, metalness: 0.6 })); arrA.rotation.z = Math.PI / 2;
  R.add(arrO, arrA);
  const hoseMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, bumpMap: Textures.rubber().bumpMap, bumpScale: 0.6 });
  hoseO = new Cable({ rubber: hoseMat(0x1f57a8) }, 0.0068); hoseA = new Cable({ rubber: hoseMat(0xa52a22) }, 0.0068);
  R.add(hoseO.mesh, hoseA.mesh);
  torch = buildTorch(M); R.add(torch);
  flame = buildFlame(); torch.add(flame);
  lighter = new THREE.Group();
  const cup = mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.03, 18, 1, true), M.darkSteel); cup.position.y = 0.04; lighter.add(cup);
  const arm = mesh(new THREE.TorusGeometry(0.04, 0.0025, 8, 20, Math.PI), M.steel); arm.rotation.z = Math.PI / 2; arm.position.set(-0.03, 0.03, 0); lighter.add(arm);
  lighter.position.set(0.02, TABLE_Y, 0.2); lighter.rotation.z = Math.PI / 2; R.add(lighter);
  rods = new THREE.Group();
  for (let i = 0; i < 6; i++) { const r = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.5, 8), M.copper); r.rotation.z = Math.PI / 2; r.position.set(0, 0.0013 + (i % 2) * 0.0024, i * 0.003); rods.add(r); }
  rods.position.set(0.38, TABLE_Y, -0.2); R.add(rods);
  rod = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 8), M.copper); rod.visible = false; R.add(rod);
  goggles = new THREE.Group();
  [-1, 1].forEach(s => { const l = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 24), M.blackPlastic); l.rotation.x = Math.PI / 2; l.position.x = s * 0.028; goggles.add(l); const gl = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshPhysicalMaterial({ color: 0x1d5a2a, roughness: 0.05, transmission: 0.2, metalness: 0.2 })); gl.position.set(s * 0.028, 0, 0.0092); goggles.add(gl); });
  const strap = mesh(new THREE.TorusGeometry(0.07, 0.004, 6, 30, Math.PI), M.rubber); strap.rotation.x = Math.PI / 2; strap.position.z = -0.01; goggles.add(strap);
  goggles.position.set(-0.08, TABLE_Y + 0.02, -0.05); goggles.rotation.x = -Math.PI / 2 + 0.3; R.add(goggles);
  soap = new THREE.Group();
  const bottle = mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.14, 20), new THREE.MeshPhysicalMaterial({ color: 0x8fd0ff, roughness: 0.15, transmission: 0.5, transparent: true, opacity: 0.8 })); bottle.position.y = 0.07; soap.add(bottle);
  const nozzle = mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.04, 14), M.blackPlastic); nozzle.position.y = 0.16; soap.add(nozzle);
  soap.position.set(-0.36, 0, 0.42); R.add(soap);
  puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: Textures.smoke(), color: 0xdfe6ee, transparent: true, opacity: 0, depthWrite: false })); R.add(puff);

  const tag = (o, id) => { o.userData.pick = id; };
  tag(cylO, 'cylO'); tag(cylA, 'cylA'); tag(chain, 'chain'); tag(regO, 'regO'); tag(regA, 'regA'); tag(arrO, 'arrO'); tag(arrA, 'arrA');
  tag(hoseO.mesh, 'hoseO'); tag(hoseA.mesh, 'hoseA'); tag(torch, 'torch'); tag(lighter, 'lighter'); tag(rods, 'rods'); tag(goggles, 'goggles'); tag(soap, 'soap');
  cylO.userData.valve.userData.pick = 'valveO'; cylA.userData.valve.userData.pick = 'valveA';
  S._pick = [cylO.userData.valve, cylA.userData.valve, cylO, cylA, chain, regO, regA, arrO, arrA, hoseO.mesh, hoseA.mesh, torch, lighter, rods, goggles, soap];
  S.setAssembled(true);
};
S.pickables = () => S._pick;
S.enter = ctx => { ctx.setPlates(st.task === 'cut' ? { t: 0.006, kind: 'single' } : { t: 0.002, kind: 'butt' }); };

// ----- placement helpers
function outletWorld(cyl) { cyl.updateMatrixWorld(true); return cyl.userData.outletLocal.clone().applyMatrix4(cyl.matrixWorld); }
function regOnCyl(reg, cyl) { reg.position.copy(outletWorld(cyl)); reg.rotation.set(0, 0, 0); }
const REG_LOOSE = { O: { p: V3(-0.86, 0.99, -0.33), r: new THREE.Euler(0, 0.3, 0) }, A: { p: V3(-0.6, 0.99, -0.33), r: new THREE.Euler(0, -0.3, 0) } };
const TORCH_REST = { p: V3(0.62, TABLE_Y + 0.016, 0.2), r: new THREE.Euler(0, Math.PI + 0.3, 0) };
const TORCH_HELD = { p: V3(0.12, TABLE_Y + 0.2, 0.2), r: new THREE.Euler(0, Math.PI * 0.9, 0.45) };

function regOutWorld(reg) { reg.updateMatrixWorld(true); return reg.userData.outletLocal.clone().applyMatrix4(reg.matrixWorld); }
function placeArrestors() {
  [[arrO, regO, asm.arrO], [arrA, regA, asm.arrA]].forEach(([a, reg, on]) => {
    a.visible = !!on;
    if (on) { a.position.copy(regOutWorld(reg)).add(V3(0.022, 0, 0)); }
  });
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
function updateHoses(free) {
  torch.updateMatrixWorld(true);
  const t = torch.userData.anchor.clone().applyMatrix4(torch.matrixWorld);
  const tdir = V3(-1, 0, 0).transformDirection(torch.matrixWorld);
  [[hoseO, regO, arrO, asm.hoseO, 0.012], [hoseA, regA, arrA, asm.hoseA, -0.012]].forEach(([h, reg, arr, on, off]) => {
    if (on) { _a.copy(regOutWorld(reg)).add(V3(asm[reg === regO ? 'arrO' : 'arrA'] ? 0.045 : 0, 0, 0)); _d.set(1, -0.3, 0.3).normalize(); }
    else { _a.set(-0.42 + off * 4, 0.012, 0.36 + off * 3); _d.set(-1, 0, 0.2).normalize(); }
    _b.copy(t).add(V3(0, 0, off * 0.5));
    h.update(_a, _d, _b, tdir, { bSide: free ? 'free' : 'table', lipX: 0.55 + off * 2 });
  });
}
S.afterMove = () => { placeArrestors(); updateHoses(); };

S.setAssembled = all => {
  ['chain', 'regO', 'regA', 'arrO', 'arrA', 'hoseO', 'hoseA', 'torchClosed'].forEach(k => asm[k] = all);
  chain.scale.setScalar(all ? 1 : 0.001); chain.visible = all;
  if (all) { regOnCyl(regO, cylO); regOnCyl(regA, cylA); }
  else { regO.position.copy(REG_LOOSE.O.p); regO.rotation.copy(REG_LOOSE.O.r); regA.position.copy(REG_LOOSE.A.p); regA.rotation.copy(REG_LOOSE.A.r); }
  torch.position.copy(TORCH_REST.p); torch.rotation.copy(TORCH_REST.r);
  setTask(st.task);
  if (!all) { st.valveO = st.valveA = 0; st.pO = st.pA = 0; st.tA = st.tO = 0; st.lit = false; st.leak = false; }
  placeArrestors(); updateHoses(); updateGauges();
};
function setTask(t) { st.task = t; torch.userData.weld.visible = t !== 'cut'; torch.userData.cut.visible = t === 'cut'; }
function updateGauges() {
  regO.userData.hp.set(asm.regO && st.valveO ? 165 : 0);
  regA.userData.hp.set(asm.regA && st.valveA ? 16 : 0);
  regO.userData.lp.set(asm.regO && st.valveO ? st.pO : 0);
  regA.userData.lp.set(asm.regA && st.valveA ? st.pA : 0);
  regO.userData.screw.rotation.z = -st.pO * 0.6; regA.userData.screw.rotation.z = -st.pA * 2.4;
  if (torch && torch.userData.knO) { torch.userData.knO.rotation.y = -st.tO * Math.PI * 2.5; torch.userData.knA.rotation.y = -st.tA * Math.PI * 2.5; }
  cylO.userData.valve.rotation.y = -st.valveO * Math.PI * 2; cylA.userData.valve.rotation.y = -st.valveA * Math.PI * 0.5;
}
function flameState() {
  if (!st.lit) return null;
  const ratio = st.tA > 0 ? (st.tO * (st.pO > 0 ? 1 : 0)) / st.tA : 0;
  return { ratio: st.tO === 0 ? 0.45 : ratio, size: 0.5 + st.tA * 0.6 };
}
function applyFlame(cut) {
  const f = flameState();
  flame.visible = !!f;
  if (!f) return;
  const tipL = cut ? torch.userData.tipC : torch.userData.tipW;
  flame.position.copy(tipL);
  flame.quaternion.setFromUnitVectors(V3(0, -1, 0), torchTipDir(cut));
  flame.userData.set(f.ratio, f.size, cut && ctxRef.state.weld.aux && ctxRef.state.stage === 'weld');
}

// ----- explore
S.partObject = id => ({ cylO, cylA, chain, valves: cylO.userData.valve, regO, regA, arrest: arrO, hoses: hoseO.mesh, torch, cutter: torch, lighter, rods, goggles }[id]);
S.partHighlight = id => id === 'valves' ? [cylO.userData.valve, cylA.userData.valve] : id === 'arrest' ? [arrO, arrA] : id === 'hoses' ? [hoseO.mesh, hoseA.mesh] : [S.partObject(id)];
S.partAnchor = id => {
  const v = new THREE.Vector3();
  switch (id) {
    case 'cylO': cylO.localToWorld(v.set(0, 0.75, 0.1)); break;
    case 'cylA': cylA.localToWorld(v.set(0, 0.6, 0.125)); break;
    case 'chain': chain.getWorldPosition(v); v.z += 0.14; break;
    case 'valves': cylO.userData.valve.getWorldPosition(v); break;
    case 'regO': regO.localToWorld(v.set(0.085, -0.06, 0.03)); break;
    case 'regA': regA.localToWorld(v.set(0.085, -0.06, 0.03)); break;
    case 'arrest': arrA.getWorldPosition(v); break;
    case 'hoses': v.set(-0.1, 0.02, 0.5); break;
    case 'torch': torch.localToWorld(v.set(-0.08, 0, 0)); break;
    case 'cutter': torch.localToWorld(v.set(0.12, 0, 0)); break;
    case 'lighter': lighter.getWorldPosition(v); break;
    case 'rods': rods.getWorldPosition(v); break;
    case 'goggles': goggles.getWorldPosition(v); break;
  }
  return v;
};
S.cams = {
  explore: () => ({ pos: V3(0.55, 1.45, 1.55), target: V3(-0.15, 0.75, 0.0) }),
  assemble: () => ({ pos: V3(-0.05, 1.5, 1.15), target: V3(-0.6, 1.0, -0.05) }),
  operate: () => ({ pos: V3(-0.28, 1.42, 0.78), target: V3(-0.6, 1.2, -0.06) })
};
S.explodeItems = () => [
  { o: regO, d: V3(0.12, 0.06, 0.1) }, { o: regA, d: V3(0.14, 0.04, 0.12) }, { o: arrO, d: V3(0.2, 0.06, 0.12) }, { o: arrA, d: V3(0.22, 0.04, 0.14) },
  { o: torch, d: V3(-0.05, 0.15, 0.08) }
];

// ----- assemble
S.asmSteps = [
  { id: 'chain', title: 'اربط الأسطوانات بالسلسلة', hint: 'المس الأسطوانات أو العربة لتربطها بالسلسلة.' },
  { id: 'crack', title: 'نظّف مخارج الصمامات (فتح وإغلاق سريع)', hint: 'المس صمام كل أسطوانة. قف بجانب المخرج وليس أمامه.' },
  { id: 'regO', title: 'ركّب منظم الأكسجين على أسطوانته', hint: 'المس المنظم الأزرق الموجود على الرف، ثم الأسطوانة المناسبة.' },
  { id: 'regA', title: 'ركّب منظم الأسيتيلين (سن شمال)', hint: 'المس المنظم الأحمر، ثم أسطوانة الأسيتيلين.' },
  { id: 'arrest', title: 'ركّب صمامات منع الارتداد على المنظمات', hint: 'المس كل منظم لتركّب عليه صمام منع الارتداد.' },
  { id: 'hoses', title: 'وصّل الخراطيم: الأزرق للأكسجين، والأحمر للأسيتيلين', hint: 'المس طرف خرطوم من الأرض، ثم المنظم المناسب له.' },
  { id: 'torchClosed', title: 'تأكد أن صمامات البوري مغلقة', hint: 'المس البوري لتتأكد أن الصمامين مغلقان قبل فتح الأسطوانات.' }
];
S.asmStart = () => { asm.crackO = asm.crackA = false; st.lit = false; };
S.asmTargets = (step, ctx) => {
  const s = S.asmSteps[step]; if (!s) return [];
  const p = ctx.state.asm.picked;
  switch (s.id) {
    case 'chain': return [chain.visible ? chain : cylO, cylA];
    case 'crack': return [!asm.crackO && cylO.userData.valve, !asm.crackA && cylA.userData.valve].filter(Boolean);
    case 'regO': return p ? [cylO, cylA] : [regO];
    case 'regA': return p ? [cylA] : [regA];
    case 'arrest': return [!asm.arrO && regO, !asm.arrA && regA].filter(Boolean);
    case 'hoses': return p ? [regO, regA] : [!asm.hoseO && hoseO.mesh, !asm.hoseA && hoseA.mesh].filter(Boolean);
    case 'torchClosed': return [torch];
  }
  return [];
};
function puffAt(v, ctx) {
  puff.position.copy(v); puff.material.opacity = 0.6;
  ctx.E.tween(0.9, k => { puff.scale.setScalar(0.03 + k * 0.15); puff.position.x += 0.002; puff.material.opacity = 0.6 * (1 - k); });
}
function moveObj(ctx, obj, toP, toR, dur, done0) {
  ctx.state.asm.busy = true; const done = () => { ctx.state.asm.busy = false; done0 && done0(); };
  const p0 = obj.position.clone(), q0 = obj.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(toR);
  ctx.E.tween(dur, k => { const e = ctx.ease(k); obj.position.lerpVectors(p0, toP, e); obj.position.y += Math.sin(Math.PI * e) * 0.08; obj.quaternion.slerpQuaternions(q0, q1, e); placeArrestors(); updateHoses(); }, done);
}
S.asmPick = (id, ctx) => {
  const a = ctx.state.asm, s = S.asmSteps[a.step]; if (!s) return;
  const refresh = () => ctx.E.setHighlight(S.asmTargets(a.step, ctx));
  switch (s.id) {
    case 'chain':
      if (['cylO', 'cylA', 'chain'].includes(id)) {
        chain.visible = true;
        ctx.state.asm.busy = true; ctx.E.tween(0.6, k => chain.scale.setScalar(Math.max(0.001, k)), () => { ctx.state.asm.busy = false; asm.chain = true; ctx.audio.click(); ctx.next('الأسطوانات مربوطة جيدًا في العربة.'); });
      } else ctx.asmMsg('bad', 'اربط الأسطوانات أولًا؛ فالأسطوانة التي تسقط قد ينكسر صمامها.');
      break;
    case 'crack':
      if (id === 'valveO' || id === 'valveA') {
        const isO = id === 'valveO';
        if (asm[isO ? 'crackO' : 'crackA']) return;
        asm[isO ? 'crackO' : 'crackA'] = true;
        puffAt(outletWorld(isO ? cylO : cylA), ctx); ctx.audio.sfx('hiss');
        if (asm.crackO && asm.crackA) ctx.next('تم تنظيف الصمامين. لو كانت هناك أتربة في المخرج لدخلت المنظم وأتلفته.');
        else { ctx.asmMsg('good', isO ? 'تم تنظيف صمام الأكسجين. بقي صمام الأسيتيلين.' : 'تم تنظيف صمام الأسيتيلين. بقي صمام الأكسجين.'); refresh(); }
      } else ctx.asmMsg('bad', 'المس صمام الأسطوانة نفسه (في الأعلى).');
      break;
    case 'regO': case 'regA': {
      const isO = s.id === 'regO', reg = isO ? regO : regA;
      if (!a.picked) {
        if (id === s.id) { a.picked = true; ctx.asmMsg('info', 'جيد. الآن المس الأسطوانة التي سيُركّب عليها.'); refresh(); }
        else if (id === (isO ? 'regA' : 'regO')) ctx.asmMsg('bad', isO ? 'هذا منظم الأسيتيلين (الأحمر). ابدأ بمنظم الأكسجين الأزرق.' : 'تم تركيب منظم الأكسجين. المس المنظم الأحمر.');
        else ctx.asmMsg('bad', 'المس المنظم الموجود على رف العربة أولًا.');
        return;
      }
      if (id !== (isO ? 'cylO' : 'cylA') && id !== (isO ? 'valveO' : 'valveA')) {
        if (id === 'cylA' || id === 'cylO' || id === 'valveA' || id === 'valveO') return ctx.asmMsg('bad', isO ? 'لا! منظم الأكسجين ذو سن يمين ولا يُركّب على الأسيتيلين؛ وتركيبه خطأً خطير جدًا.' : 'لا! هذا منظم الأسيتيلين ذو السن الشمال، ومكانه على أسطوانة الأسيتيلين الحمراء.');
        return ctx.asmMsg('bad', 'المس الأسطوانة.');
      }
      a.picked = null; ctx.E.setHighlight([]);
      const cyl = isO ? cylO : cylA;
      moveObj(ctx, reg, outletWorld(cyl), new THREE.Euler(0, 0, 0), 1.0, () => { asm[s.id] = true; ctx.audio.click(); ctx.next(isO ? 'تم تركيب منظم الأكسجين وربطه بالمفتاح (بدون زيت أو شحم).' : 'تم تركيب منظم الأسيتيلين. لاحظ الحزّة على الصامولة = سن شمال.'); });
      break;
    }
    case 'arrest':
      if (id === 'regO' || id === 'regA' || id === 'arrO' || id === 'arrA') {
        const k = id.endsWith('O') ? 'arrO' : 'arrA';
        if (asm[k]) return;
        asm[k] = true; placeArrestors(); updateHoses(); ctx.audio.click();
        if (asm.arrO && asm.arrA) ctx.next('تم تركيب صمامات منع الارتداد على المنظمين.');
        else { ctx.asmMsg('good', 'تم التركيب. بقي المنظم الآخر.'); refresh(); }
      } else ctx.asmMsg('bad', 'المس المنظم لتركّب على مخرجه صمام منع الارتداد.');
      break;
    case 'hoses':
      if (!a.picked) {
        if (id === 'hoseO' || id === 'hoseA') { if (asm[id]) return ctx.asmMsg('info', 'هذا الخرطوم موصّل بالفعل.'); a.picked = id; ctx.asmMsg('info', id === 'hoseO' ? 'أمسكت الخرطوم الأزرق. المس المنظم الخاص به.' : 'أمسكت الخرطوم الأحمر. المس المنظم الخاص به.'); refresh(); }
        else ctx.asmMsg('bad', 'المس طرف أحد الخراطيم الموجودة على الأرض.');
        return;
      }
      if (id !== 'regO' && id !== 'regA' && id !== 'arrO' && id !== 'arrA') return ctx.asmMsg('bad', 'المس المنظم الذي ستوصّل به.');
      {
        const toO = id.endsWith('O');
        if ((a.picked === 'hoseO') !== toO) return ctx.asmMsg('bad', a.picked === 'hoseO' ? 'الخرطوم الأزرق للأكسجين فقط. هذا منظم الأسيتيلين.' : 'الخرطوم الأحمر للأسيتيلين فقط. هذا منظم الأكسجين.');
        asm[a.picked] = true; a.picked = null; updateHoses(); ctx.audio.click();
        if (asm.hoseO && asm.hoseA) ctx.next('تم توصيل الخراطيم بالألوان الصحيحة.');
        else { ctx.asmMsg('good', 'تم التوصيل. أكمل الخرطوم الآخر.'); refresh(); }
      }
      break;
    case 'torchClosed':
      if (id === 'torch') { asm.torchClosed = true; st.tA = st.tO = 0; ctx.next('صمامات البوري مغلقة. المعدات جاهزة؛ ننتقل إلى التشغيل والإشعال.'); }
      else ctx.asmMsg('bad', 'المس البوري الموجود على الطاولة.');
      break;
  }
};
S.asmAuto = ctx => {
  const a = ctx.state.asm, s = S.asmSteps[a.step]; if (!s) return;
  if (s.id === 'chain') S.asmPick('chain', ctx);
  else if (s.id === 'crack') { if (!asm.crackO) S.asmPick('valveO', ctx); else S.asmPick('valveA', ctx); }
  else if (s.id === 'regO' || s.id === 'regA') { if (!a.picked) S.asmPick(s.id, ctx); S.asmPick(s.id === 'regO' ? 'cylO' : 'cylA', ctx); }
  else if (s.id === 'arrest') S.asmPick(!asm.arrO ? 'regO' : 'regA', ctx);
  else if (s.id === 'hoses') { const h = !asm.hoseO ? 'hoseO' : 'hoseA'; if (!a.picked) S.asmPick(h, ctx); S.asmPick(h === 'hoseO' ? 'regO' : 'regA', ctx); }
  else S.asmPick('torch', ctx);
};

// ----- operate (pressures, leak test, lighting sequence, flame adjustment)
const REC = { weld: { O: [1.0, 2.0], A: [0.2, 0.5] }, cut: { O: [2.5, 4.0], A: [0.3, 0.6] } };
S.operateEnter = ctx => { bindDials(ctx); torch.position.copy(TORCH_HELD.p); torch.rotation.copy(TORCH_HELD.r); updateHoses(); updateGauges(); applyFlame(st.task === 'cut'); };
S.operatePick = (id, ctx) => {
  if (id === 'valveO') S.operateAction('valveO', null, ctx);
  else if (id === 'valveA') S.operateAction('valveA', null, ctx);
  else if (id === 'torch' && st.lit) { const c = ctx.E.camera; ctx.E.flyTo(V3(0.32, TABLE_Y + 0.32, 0.55), V3(0.15, TABLE_Y + 0.17, 0.2)); }
};
function dialHTML(k, label, v, cls) {
  const turns = v * 1.25, ang = Math.min(1, v) * 300 - 150;
  return `<div class="dial ${cls}" data-dial="${k}" role="slider" aria-label="${label}" aria-valuenow="${Math.round(v * 100)}" tabindex="0">
    <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="trk"/><path class="arc" d="${arcPath(Math.min(1, v))}"/><g transform="rotate(${ang} 50 50)"><circle cx="50" cy="50" r="30" class="cap"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="48" y="21" width="4" height="9" rx="2" class="rib" transform="rotate(${a} 50 50)"/>`).join('')}<rect x="47" y="14" width="6" height="16" rx="3" class="ind"/></g></svg>
    <b>${label}</b><small class="mono">${turns < 0.02 ? 'مغلق' : turns.toFixed(2) + ' لفة'}</small>
    <span class="fine"><button type="button" data-op="nudge:${k}:-1" aria-label="أغلق قليلًا">−</button><button type="button" data-op="nudge:${k}:1" aria-label="افتح قليلًا">+</button></span></div>`;
}
function arcPath(f) { if (f <= 0.001) return ''; const a0 = -150 * Math.PI / 180 - Math.PI / 2, a1 = a0 + f * 300 * Math.PI / 180, r = 44; const p = a => [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${f * 300 > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; }
// finger drag on a dial = turning the valve (vertical drag, 220 px = fully open)
let dialDrag = null;
function bindDials(ctx) {
  if (S._dialsBound) return; S._dialsBound = true;
  document.addEventListener('pointerdown', ev => { const d = ev.target.closest('.dial'); if (!d || ev.target.closest('.fine')) return; ev.preventDefault(); dialDrag = { k: d.dataset.dial, y: ev.clientY, v0: st[d.dataset.dial], id: ev.pointerId }; });
  document.addEventListener('pointermove', ev => { if (!dialDrag || ev.pointerId !== dialDrag.id) return; setValve(dialDrag.k, THREE.MathUtils.clamp(dialDrag.v0 + (dialDrag.y - ev.clientY) / 220, 0, dialDrag.k === 'tO' ? 1.4 : 1), ctxRef); });
  document.addEventListener('pointerup', () => { if (dialDrag) { dialDrag = null; ctxRef.renderPanel(); } });
}
function setValve(k, v, ctx) {
  const was = st[k]; st[k] = Math.round(v * 100) / 100;
  if (Math.abs(was - st[k]) > 0.04) ctx.audio.sfx('hiss');
  if (st.lit) checkFlame(ctx);
  updateGauges(); applyFlame(st.task === 'cut');
  // light update of the dial without re-rendering the whole panel (keeps the drag smooth)
  const el = document.querySelector(`.dial[data-dial="${k}"]`);
  if (el) { const tmp = document.createElement('div'); tmp.innerHTML = dialHTML(k, el.querySelector('b').textContent, st[k], el.classList.contains('a') ? 'a' : 'o'); el.replaceWith(tmp.firstElementChild); }
  const fs = document.querySelector('.flame-state');
  if (fs && st.lit) { const f = flameState(), ft = flameType(f.ratio); fs.className = 'flame-state ' + ft; fs.querySelector('b').textContent = FLAME_NAMES[ft]; }
  clearTimeout(S._t); S._t = setTimeout(() => { if (!dialDrag) ctx.renderPanel(); }, 400);
}
// flame physics: flow too high → flame lifts off and blows out; too low → it burns back (pop) and goes out; too much oxygen → blows out
function flameOut(ctx, msg) { st.lit = false; st.fails = (st.fails || 0) + 1; ctx.audio.sfx('pop'); ctx.toast('bad', msg); applyFlame(st.task === 'cut'); }
function checkFlame(ctx) {
  if (!st.lit) return;
  if (st.tA > 0.72) return flameOut(ctx, 'انطفأ اللهب! كمية الأسيتيلين كبيرة جدًا فانفصل اللهب عن الفونية. أغلق الصمامات، ثم افتح الأسيتيلين قليلًا وأعد الإشعال.');
  if (st.tA < 0.08) return flameOut(ctx, st.tO > 0.05 ? 'فرقعة وانطفاء! الأسيتيلين قليل جدًا بالنسبة للأكسجين فارتد اللهب. أغلق صمام الأكسجين، ثم أعد الإشعال.' : 'انطفأ اللهب لأنك أغلقت الأسيتيلين.');
  if (st.tO / Math.max(0.05, st.tA) > 1.75) return flameOut(ctx, 'انطفأ اللهب بفرقعة! الأكسجين زائد جدًا. أغلق صمام الأكسجين، ثم أعد الإشعال وزِد الأكسجين ببطء.');
}
function pressOK(k) { const r = REC[st.task][k], v = k === 'O' ? st.pO : st.pA; return v >= r[0] && v <= r[1]; }
S.operateHTML = () => {
  const f = flameState(), ft = f ? flameType(f.ratio) : null, r = REC[st.task];
  const pct = (v, max) => (v / max) * 100;
  const ppe = [['goggles', 'نظارة غاز بعدسة ٥'], ['gloves', 'قفاز جلدي'], ['apron', 'مريلة جلدية'], ['cotton', 'ملابس قطنية مغلقة']];
  const stepCls = ok => ok ? 'ok' : '';
  return `
    <section class="card"><h3 class="sm">نوع العمل</h3>
      <div class="seg2"><button type="button" class="${st.task === 'weld' ? 'on' : ''}" data-op="task:weld">لحام صاج ٢ مم</button><button type="button" class="${st.task === 'cut' ? 'on' : ''}" data-op="task:cut">قطع صلب ٦ مم</button></div></section>
    <section class="card"><h3 class="sm">١. افتح صمامات الأسطوانات</h3>
      <div class="seg2">
        <button type="button" class="${st.valveO ? 'on' : ''}" data-op="valveO">${st.valveO ? ICON.check : ''} الأكسجين (بالكامل)</button>
        <button type="button" class="${st.valveA ? 'on' : ''}" data-op="valveA">${st.valveA ? ICON.check : ''} الأسيتيلين (نصف لفة)</button>
      </div><p class="muted small">افتح ببطء، واترك مسامير الضبط مفكوكة. سيرتفع عداد المحتوى.</p></section>
    <section class="card"><h3 class="sm">٢. اضبط ضغط التشغيل</h3>
      <div class="lbl-row"><span>الأكسجين</span><b class="mono">${st.pO.toFixed(1)} bar</b></div>
      <input type="range" min="0" max="6" step="0.1" value="${st.pO}" data-op="pO" ${st.valveO ? '' : 'disabled'} aria-label="ضغط الأكسجين">
      <div class="meter" dir="ltr"><div class="zone" style="left:${pct(r.O[0], 6)}%;width:${pct(r.O[1] - r.O[0], 6)}%"></div><div class="mark ${pressOK('O') ? 'ok' : 'low'}" style="left:${pct(st.pO, 6)}%"></div></div>
      <div class="lbl-row"><span>الأسيتيلين</span><b class="mono ${st.pA > 1 ? 'bad-t' : ''}">${st.pA.toFixed(2)} bar</b></div>
      <input type="range" min="0" max="1.5" step="0.05" value="${st.pA}" data-op="pA" ${st.valveA ? '' : 'disabled'} aria-label="ضغط الأسيتيلين">
      <div class="meter" dir="ltr"><div class="zone" style="left:${pct(r.A[0], 1.5)}%;width:${pct(r.A[1] - r.A[0], 1.5)}%"></div><div class="zone red" style="left:${pct(1, 1.5)}%;width:${pct(0.5, 1.5)}%"></div><div class="mark ${pressOK('A') ? 'ok' : st.pA > 1 ? 'high' : 'low'}" style="left:${pct(st.pA, 1.5)}%"></div></div>
      <p class="muted small">المناسب لـ${st.task === 'cut' ? 'القطع' : 'اللحام'}: الأكسجين ${r.O[0]}–${r.O[1]} بار، والأسيتيلين ${r.A[0]}–${r.A[1]} بار. ${st.pA > 1 ? '<b class="bad-t">خطر: الأسيتيلين فوق ١ بار!</b>' : ''}</p></section>
    <section class="card"><h3 class="sm">٣. اختبار التسرب</h3>
      <button type="button" class="btn ${st.leak ? 'on-green' : ''}" data-op="leak" ${st.pO && st.pA ? '' : 'disabled'}>${st.leak ? ICON.check + 'لا توجد فقاعات = لا يوجد تسريب' : 'رُشّ ماءً وصابونًا على الوصلات'}</button></section>
    <section class="card torch-card"><h3 class="sm">٤. الإشعال وضبط اللهب</h3>
      <p class="muted small">أدر مقبض الصمام بإصبعك (اسحب لأعلى للفتح ولأسفل للغلق). الترتيب: افتح الأسيتيلين قليلًا ← اقدح الولاعة ← زِد الأكسجين تدريجيًا حتى يصبح اللهب متعادلًا.</p>
      <div class="dials">
        ${dialHTML('tA', 'صمام الأسيتيلين', st.tA, 'a')}
        <button type="button" class="striker ${st.lit ? 'lit' : ''}" data-op="light"><span class="spk"></span>${st.lit ? 'مشتعل' : 'اقدح الولاعة'}</button>
        ${dialHTML('tO', 'صمام الأكسجين', st.tO, 'o')}
      </div>
      <div class="flame-state ${st.lit ? ft : 'off'}"><b>${st.lit ? FLAME_NAMES[ft] : (st.tA > 0 ? 'الأسيتيلين يخرج… اقدح الآن' : 'اللهب مطفأ')}</b>
      <span>${!st.lit ? (st.tO > 0.02 ? 'تنبيه: صمام الأكسجين مفتوح! أغلقه قبل الإشعال.' : 'افتح صمام الأسيتيلين من ربع إلى نصف لفة.') : st.tO < 0.02 ? 'لهب أصفر يتصاعد منه سخام أسود. افتح الأكسجين ببطء.' : ft === 'neutral' ? 'المخروط الداخلي واضح وحاد، ولا توجد ريشة. هذا هو المطلوب للصلب.' : ft === 'carb' ? 'توجد ريشة بيضاء حول المخروط الداخلي. زِد الأكسجين حتى تختفي الريشة.' : 'المخروط الداخلي قصير ومدبب وصوت اللهب عالٍ. قلّل الأكسجين.'}</span></div>
      ${st.fails ? `<p class="small muted">محاولات الإشعال الفاشلة: <b class="mono">${st.fails}</b></p>` : ''}
      ${st.lit ? `<button type="button" class="btn" data-op="off">${ICON.x}أطفئ (الأسيتيلين أولًا ثم الأكسجين)</button>` : ''}
    </section>
    <section class="card"><h3 class="sm">مهمات الوقاية</h3>
      <div class="ppe">${ppe.map(([k, n]) => `<button type="button" class="${st.ppe[k] ? 'on' : ''}" data-op="ppe:${k}">${st.ppe[k] ? ICON.check : ICON.shield}${n}</button>`).join('')}</div></section>`;
};
S.operateAction = (op, el, ctx) => {
  const say = (t, s) => ctx.toast(t, s);
  if (op.startsWith('range:')) {
    const k = op.slice(6), v = +el.value;
    if (k === 'pO') st.pO = v; else if (k === 'pA') { st.pA = v; if (v > 1) say('bad', 'خطر! ضغط الأسيتيلين فوق ١ بار. أرجعه إلى المدى الآمن.'); }
    else if (k === 'tA') st.tA = v; else if (k === 'tO') st.tO = v;
    updateGauges(); applyFlame(st.task === 'cut');
    clearTimeout(S._t); S._t = setTimeout(() => ctx.renderPanel(), 160); return;
  }
  if (op.startsWith('task:')) { setTask(op.slice(5)); S.enter(ctx); applyFlame(st.task === 'cut'); }
  else if (op === 'valveO') { st.valveO = st.valveO ? 0 : 1; if (!st.valveO) st.pO = 0; ctx.audio.sfx('hiss'); }
  else if (op === 'valveA') { st.valveA = st.valveA ? 0 : 1; if (!st.valveA) st.pA = 0; ctx.audio.sfx('hiss'); }
  else if (op === 'leak') { st.leak = true; say('good', 'رششت ماءً وصابونًا على جميع الوصلات. لا توجد فقاعات؛ الوصلات سليمة.'); }
  else if (op === 'openA') { if (!(st.valveA && st.pA > 0)) say('bad', 'لا يصل أسيتيلين إلى البوري. افتح صمام الأسطوانة واضبط الضغط أولًا.'); else { st.tA = 0.35; say('info', 'فتحت أسيتيلين البوري حوالي ربع لفة. أشعل فورًا بالولاعة.'); } }
  else if (op === 'light') {
    ctx.audio.sfx('chip');
    if (st.lit) { /* already burning */ }
    else if (!(st.valveA && st.pA > 0) || !(st.tA > 0.02)) say('bad', 'شرارة بلا لهب: لا يخرج أسيتيلين. افتح صمام الأسيتيلين في البوري أولًا.');
    else if (st.tO > 0.05) { st.fails = (st.fails || 0) + 1; ctx.audio.sfx('pop'); say('bad', 'فرقعة خطيرة! أشعلت والأكسجين مفتوح. أغلق صمام الأكسجين تمامًا، وأشعل الأسيتيلين وحده.'); }
    else if (st.tA > 0.65) { st.fails = (st.fails || 0) + 1; say('bad', 'اشتعل اللهب ثم انفصل عن الفونية وانطفأ: الأسيتيلين مفتوح أكثر من اللازم. قلّله إلى ربع أو نصف لفة.'); }
    else if (st.tA < 0.1) { st.fails = (st.fails || 0) + 1; ctx.audio.sfx('pop'); say('bad', 'اشتعل اللهب ضعيفًا ثم ارتد بفرقعة وانطفأ: الأسيتيلين قليل جدًا. افتحه أكثر قليلًا.'); }
    else { st.lit = true; ctx.audio.sfx('pop'); say('good', 'تم الإشعال! اللهب أصفر ويتصاعد منه سخام. الآن افتح الأكسجين تدريجيًا.'); ctx.E.flyTo(V3(0.32, TABLE_Y + 0.32, 0.55), V3(0.15, TABLE_Y + 0.17, 0.2)); }
  }
  else if (op.startsWith('nudge:')) { const [, k, d] = op.split(':'); setValve(k, THREE.MathUtils.clamp(st[k] + (+d) * 0.02, 0, k === 'tO' ? 1.4 : 1), ctx); return; }
  else if (op === 'openO') { if (!st.lit) say('bad', 'لا يصح فتح أكسجين البوري قبل الإشعال.'); else if (!(st.valveO && st.pO > 0)) say('bad', 'لا يصل أكسجين. افتح صمام الأسطوانة واضبط الضغط.'); else { st.tO = Math.max(st.tO, 0.2); say('info', 'الآن زِد الأكسجين من الشريط حتى تختفي الريشة البيضاء.'); } }
  else if (op === 'off') { st.lit = false; st.tA = 0; st.tO = 0; say('info', 'تم الإطفاء: أغلقت الأسيتيلين أولًا، ثم الأكسجين.'); }
  else if (op.startsWith('ppe:')) { const k = op.slice(4); st.ppe[k] = !st.ppe[k]; ctx.audio.click(); }
  updateGauges(); applyFlame(st.task === 'cut'); ctx.renderPanel();
};
S.operateReady = () => {
  const f = flameState(), ppe = ['goggles', 'gloves', 'apron', 'cotton'].every(k => st.ppe[k]);
  const neutral = f && flameType(f.ratio) === 'neutral';
  if (!st.valveO || !st.valveA) return { ok: false, label: 'افتح صمامات الأسطوانات' };
  if (st.pA > 1) return { ok: false, label: 'ضغط الأسيتيلين خطر' };
  if (!pressOK('O') || !pressOK('A')) return { ok: false, label: 'اضبط ضغط التشغيل' };
  if (!st.leak) return { ok: false, label: 'قم باختبار التسرب' };
  if (!st.lit) return { ok: false, label: 'أشعل البوري' };
  if (!ppe) return { ok: false, label: 'ارتدِ مهمات الوقاية' };
  if (!neutral) return { ok: true, label: 'ابدأ (اللهب غير متعادل!)' };
  return { ok: true, label: st.task === 'cut' ? 'ابدأ القطع' : 'ابدأ اللحام' };
};
const soot = [];
function sootFrame(dt) {
  if (!soot.length) { const m = new THREE.SpriteMaterial({ map: Textures.glowSprite(), color: 0x151210, transparent: true, opacity: 0.55, depthWrite: false }); for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(m.clone()); sp.visible = false; S.root.add(sp); soot.push({ sp, t: 0, v: new THREE.Vector3() }); } }
  const on = flame.visible && st.lit && st.tO < 0.03;
  for (const q of soot) {
    if (q.t <= 0) { if (on && Math.random() < dt * 14) { const p = flame.getWorldPosition(new THREE.Vector3()); S.root.worldToLocal(p); q.sp.position.copy(p).add(V3(0.02, 0.01, 0)); q.v.set((Math.random() - 0.3) * 0.03, 0.08 + Math.random() * 0.06, (Math.random() - 0.5) * 0.03); q.t = 1.6; q.sp.visible = true; } else continue; }
    q.t -= dt; q.sp.position.addScaledVector(q.v, dt); const k = 1 - q.t / 1.6; q.sp.scale.setScalar(0.01 + k * 0.05); q.sp.material.opacity = 0.5 * (1 - k);
    if (q.t <= 0) q.sp.visible = false;
  }
}
S.frame = (ctx, dt) => {
  sootFrame(dt);
  if (flame.visible) flame.userData.flicker(performance.now() / 1000);
  if (ctx.state.stage === 'operate') ctx.audio.update(st.lit, 1, 'flame');
};

// ----- weld / cut
S.weldSettings = () => { const f = flameState() || { ratio: 1, size: 1 }; return { flame: flameType(f.ratio), ratio: f.ratio, pO: st.pO, pA: st.pA, task: st.task }; };
function flameScore(set) {
  const base = set.flame === 'neutral' ? 100 : set.flame === 'carb' ? 65 : 55;
  const r = REC[set.task], pen = (v, [a, b]) => v < a ? (a - v) * 30 : v > b ? (v - b) * 30 : 0;
  return { v: Math.max(20, base - pen(set.pO, r.O) - pen(set.pA, r.A)), note: 'نوع اللهب المستخدم: ' + FLAME_NAMES[set.flame] + '.' };
}
S.weldProc = ctx => {
  const set = S.weldSettings(), oxid = set.flame === 'oxid', carb = set.flame === 'carb';
  const common = {
    distName: 'بُعد المخروط', angleName: 'زاوية البوري', settingName: 'اللهب والضغط', angleShort: 'زاوية البوري',
    stickBelow: 0.7, grace: 0.2, stickMsg: 'فرقعة! اقترب طرف البوري كثيرًا من الحديد (ارتداد اللهب). ابتعد قليلًا وأكمل.',
    lensShade: 'gas', lensExposure: 0.6, lensName: 'النظارة', distPerMM: 0.3, relDistPerPx: 0.03, sound: 'flame',
    lightColor: 0xbcd4ff, lightIntensity: 0.12, smoke: 1.5, settingScore: flameScore
  };
  if (st.task === 'cut') return {
    ...common, kind: 'cut',
    ideal: { angle: [80, 90], speed: [3, 6.5], dist: [2, 5] },
    heatNeed: 2.4, heatRate: s => 1.5 * THREE.MathUtils.clamp(1.4 - Math.abs(s.dist - 3.5) * 0.15, 0.3, 1.4),
    aux: { label: 'أكسجين القطع', hint: 'اضغط بعد أن يحمرّ', icon: ICON.bolt },
    spacing: 0.0012, sparkDir: 'down',
    sparks: s => s.aux ? 420 : 8,
    poolMM: () => 4,
    dims: s => ({ w: 1.6 + Math.max(0, 2.5 - s.speed) * 0.5 + Math.max(0, s.dist - 5) * 0.2, h: 0, dross: s.speed < 2.6 ? 0.7 : 0.12 }),
    defects: c => {
      const out = [];
      if (c.events.lost) out.push({ name: 'انقطاع القطع', en: 'Lost cut', cause: 'زادت السرعة فلم يسخن الحديد بما يكفي ' + c.AR(c.events.lost) + ' مرة.', fix: 'حافظ على سرعة ثابتة، وإذا توقف القطع ارجع وسخّن مرة أخرى.' });
      if (c.count('slow') || c.sim.dross.count > 30) out.push({ name: 'خبث ملتصق تحت القطع', en: 'Heavy dross', cause: 'الحركة بطيئة، فالتحم الحديد المنصهر أسفل القطعة.', fix: 'زِد السرعة قليلًا.' });
      if (c.count('long')) out.push({ name: 'حواف علوية مدوّرة', en: 'Rounded top edge', cause: 'الفونية بعيدة عن الحديد.', fix: 'اجعل المخروط الداخلي على بُعد ٢–٥ مم.' });
      if (c.events.early) out.push({ name: 'فتح الأكسجين مبكرًا', en: 'Premature cutting oxygen', cause: 'فتحت أكسجين القطع قبل أن يحمرّ الحديد.', fix: 'سخّن حتى اللون الأحمر الفاتح، ثم افتح.' });
      if (set.flame !== 'neutral') out.push({ name: 'لهب تسخين غير متعادل', en: 'Wrong preheat flame', cause: FLAME_NAMES[set.flame] + '.', fix: 'اضبط لهب التسخين على متعادل.' });
      return out;
    },
    hint: 'ضع البوري على بداية الخط الأبيض وانتظر حتى يحمرّ الحديد، ثم اضغط «أكسجين القطع» وتحرك على الخط.'
  };
  return {
    ...common, kind: 'flame',
    ideal: { angle: [35, 55], speed: [1.0, 2.4], dist: [2, 4] },
    heatNeed: 1.5, heatRate: s => 1.25 * THREE.MathUtils.clamp(1.35 - Math.abs(s.dist - 3) * 0.18, 0.25, 1.35) * (carb ? 0.85 : 1),
    fillerLen: 0.45, aux: { label: 'سلك الإضافة', hint: 'اغمس وارفع', icon: ICON.plus },
    spacing: 0.0011,
    sparks: () => oxid ? 45 : 4,
    poolMM: s => 5 + (s.heat > 2.5 ? 1.5 : 0),
    bead: { color: [0.55, 0.55, 0.57], hot: [3, 1.5, 0.45], metal: 0.65, rough: 0.5, tint: (r, i, n, c) => c.setRGB(0.42 + Math.random() * 0.04, 0.43, 0.48 + (oxid ? 0.08 : 0)) },
    coolTime: 6,
    dims: s => {
      const sp = THREE.MathUtils.clamp(s.speed || 1.6, 0.4, 6);
      return { w: THREE.MathUtils.clamp(5.6 * Math.pow(1.6 / sp, 0.35), 3.5, 9), h: s.aux ? 1.1 : 0.35, wobble: 0.6 };
    },
    flags: s => ({ pore: oxid ? 0.12 : 0, spatter: oxid ? 0.25 : 0, undercut: !s.aux ? 0.06 : 0 }),
    penetration: () => 1,
    defects: c => {
      const out = [];
      if (c.count('nofill')) out.push({ name: 'نقص امتلاء (خط مقعر)', en: 'Underfill', cause: 'لم تُضف سلكًا كافيًا في ' + c.AR(c.count('nofill')) + ' منطقة.', fix: 'اغمس سلك الإضافة في البركة بانتظام كلما تقدمت.' });
      if (c.count('fast')) out.push({ name: 'عدم انصهار كامل', en: 'Lack of fusion', cause: 'تقدمت قبل أن تتكوّن البركة جيدًا.', fix: 'انتظر حتى تتكوّن البركة اللامعة، ثم تحرّك.' });
      if (c.count('slow')) out.push({ name: 'انصهار وثقوب', en: 'Burn-through', cause: 'تركّزت الحرارة في مكان واحد على صاج رقيق.', fix: 'زِد السرعة قليلًا أو ارفع البوري.' });
      if (oxid) out.push({ name: 'أكسدة واحتراق المعدن', en: 'Oxidized weld', cause: 'اللهب مؤكسد (أكسجين زائد).', fix: 'قلّل أكسجين البوري حتى يصبح اللهب متعادلًا.' });
      if (carb) out.push({ name: 'تكربُن الخط (هش)', en: 'Carburized weld', cause: 'اللهب مكربن (أسيتيلين زائد).', fix: 'زِد الأكسجين حتى تختفي الريشة.' });
      if (c.events.stuck) out.push({ name: 'ارتداد لهب (فرقعة)', en: 'Backfire', cause: 'طرف الفونية لمس البركة ' + c.AR(c.events.stuck) + ' مرة.', fix: 'حافظ على المخروط الداخلي ٢–٤ مم فوق البركة.' });
      return out;
    },
    hint: 'وجّه اللهب على بداية الوصلة وانتظر حتى تلمع البركة، ثم تحرّك ببطء واغمس سلك الإضافة بالزر.'
  };
};
S.hud = ctx => {
  const p = ctx.sim.proc, w = ctx.state.weld, sim = ctx.sim, set = ctx.sim.settings;
  return [
    { id: 'angle', label: 'زاوية البوري', hint: p.ideal.angle.join('–') + '°', get: () => ({ val: ctx.state.angle, txt: ctx.state.angle + '°', min: 30, max: 90, lo: p.ideal.angle[0], hi: p.ideal.angle[1] }) },
    { id: 'speed', label: 'سرعة التقدّم', hint: p.ideal.speed.join('–') + ' mm/s', get: o => ({ val: sim.on ? o.speed : null, txt: sim.on ? o.speed.toFixed(1) : '--', min: 0, max: 9, lo: p.ideal.speed[0], hi: p.ideal.speed[1] }) },
    { id: 'dist', label: 'بُعد المخروط', hint: p.ideal.dist.join('–') + ' مم', get: () => ({ val: w.pressing ? w.eff : null, txt: w.pressing ? (w.eff ?? 0).toFixed(1) + ' mm' : '--', min: 0, max: 10, lo: p.ideal.dist[0], hi: p.ideal.dist[1] }) },
    { id: 'flame', label: 'اللهب', bar: false, hint: '', get: () => ({ txt: { carb: 'مكربن', neutral: 'متعادل', oxid: 'مؤكسد' }[set.flame] }) }
  ];
};
S.coach = (ctx, o) => {
  const p = ctx.sim.proc, w = ctx.state.weld;
  if (o.preheat != null && o.preheat < 1) return p.kind === 'cut' ? 'سخّن… انتظر حتى يحمرّ الحديد' : 'انتظر حتى تتكوّن البركة اللامعة';
  if (p.kind === 'cut' && !w.aux && o.heat >= 1) return 'احمرّ الحديد! اضغط أكسجين القطع وتحرّك';
  if (o.speed > p.ideal.speed[1] * 1.2) return 'سرعتك عالية، أبطئ';
  if (o.speed < p.ideal.speed[0] * 0.6 && ctx.sim.time > 3) return 'تحرّك قليلًا';
  if (w.eff > p.ideal.dist[1] + 0.6) return 'البوري بعيد، قرّب';
  if (w.eff < p.ideal.dist[0] - 0.4) return 'البوري قريب جدًا، ارفعه';
  if (p.kind === 'flame' && ctx.sim.time > 4 && !w.aux && Math.random() < 0.02) return 'لا تنسَ غمس سلك الإضافة';
  return null;
};
let tick = 0;
S.weldEnter = ctx => {
  S.enter(ctx);
  ctx.state.angle = st.task === 'cut' ? 86 : 45;
  if (!st.lit) { st.lit = true; st.tA = 0.4; st.tO = 0.4; }
  rod.visible = st.task !== 'cut';
  ctx.resetTip(JOINT.x0 - 0.02, JOINT.y + 0.03);
};
const _q = new THREE.Quaternion(), _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
function orientTorch(dirWorld, cut) {
  // map local tip direction → world dir, keeping the handle up and behind the flame
  const dl = torchTipDir(cut);
  const ul = V3(-1, 0.25, 0); ul.sub(dl.clone().multiplyScalar(ul.dot(dl))).normalize();
  const dw = dirWorld.clone().normalize();
  const uw = V3(-0.75, 0.55, 0.35); uw.sub(dw.clone().multiplyScalar(uw.dot(dw))).normalize();
  _m1.makeBasis(dl, ul, dl.clone().cross(ul)); _m2.makeBasis(dw, uw, dw.clone().cross(uw));
  _m2.multiply(_m1.transpose());
  torch.quaternion.setFromRotationMatrix(_m2);
}
S.weldPose = (ctx, tip, dt) => {
  const cut = st.task === 'cut', w = ctx.state.weld;
  const a = THREE.MathUtils.degToRad(ctx.state.angle);
  // flame points towards travel direction (forehand) → torch body is behind (−X)
  const toPuddle = V3(Math.cos(a), -Math.sin(a), -0.15).normalize();
  orientTorch(toPuddle, cut);
  const tipL = cut ? torch.userData.tipC : torch.userData.tipW;
  const coneL = 0.005;
  torch.updateMatrixWorld(true);
  const tipW = tipL.clone().applyQuaternion(torch.quaternion);
  // nozzle sits (dist + inner cone length) back along the flame axis from the puddle
  const puddle = V3(tip.x, JOINT.y, JOINT.z), dm = Math.max(0, tip.y - JOINT.y);
  const nozzle = puddle.addScaledVector(toPuddle, -(dm + coneL));
  torch.position.copy(nozzle).sub(tipW);
  applyFlame(cut);
  if (rod.visible) {
    const dip = w.aux && w.pressing;
    const rt = V3(tip.x + 0.004, JOINT.y + (dip ? 0.0012 : 0.007), JOINT.z + 0.004);
    const rdir = V3(0.8, 0.45, 0.4).normalize();
    rod.quaternion.setFromUnitVectors(V3(0, 1, 0), rdir);
    rod.scale.y = Math.max(0.05, ctx.sim.filler || 0.45);
    rod.position.copy(rt).addScaledVector(rdir, rod.scale.y / 2);
  }
  if ((tick++ & 1) === 0) updateHoses(true);
};
S.weldExit = () => { rod.visible = false; torch.position.copy(TORCH_REST.p); torch.rotation.copy(TORCH_REST.r); applyFlame(st.task === 'cut'); updateHoses(); };
S.inspectEnter = ctx => { torch.position.copy(TORCH_HELD.p); torch.rotation.copy(TORCH_HELD.r); updateHoses(); applyFlame(st.task === 'cut'); };

export default S;
