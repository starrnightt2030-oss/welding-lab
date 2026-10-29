// Station: Safety & tools (السلامة والأدوات) — PPE explorer, "dress for the job" quiz, hazard hunt.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TABLE_Y, Cable } from '../models.js';
import { buildCylinder, mesh } from '../gasparts.js';
import { Textures } from '../textures.js';
import { ICON } from '../core/icons.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const S = {
  id: 'safety', name: 'السلامة والأدوات', code: 'PPE', icon: ICON.shield, ready: true,
  stages: [['explore', 'اتعرّف'], ['wear', 'البس صح'], ['hazards', 'اكتشف المخاطر']]
};
S.parts = [
  { id: 'helmet', name: 'ماسك اللحام', en: 'Welding helmet', far: 0.45, desc: 'بيحمي العين والوش من الأشعة فوق البنفسجية وتحت الحمرا والشرار. العدسة بتتحدد درجتها حسب التيار.', facts: ['لحام القوس: عدسة ١٠–١٣ حسب التيار.', 'الماسك الأوتوماتيك بيغمق لوحده لحظة القدح.'], safety: 'ماتبصش للقوس أبداً من غير ماسك؛ ثواني كفاية تعمل «حرقة عين» مؤلمة.' },
  { id: 'goggles', name: 'نظارة لحام الغاز', en: 'Gas welding goggles', far: 0.35, desc: 'عدسة ٤–٦ للحام والقطع بالغاز.', facts: [], safety: 'مش كفاية للحام القوس الكهربي.' },
  { id: 'glasses', name: 'نظارة السلامة الشفافة', en: 'Safety glasses', far: 0.35, desc: 'بتتلبس تحت الماسك وأثناء التخبيط والتنضيف عشان الخبث المتطاير.', facts: [], safety: '' },
  { id: 'shield', name: 'واقي الوش الشفاف', en: 'Face shield', far: 0.4, desc: 'للتجليخ والقطع بالصاروخ (الجلاخة). بيتلبس فوق نظارة السلامة.', facts: [], safety: 'مش بيحمي من أشعة اللحام.' },
  { id: 'glovesL', name: 'جوانتي جلد تقيل', en: 'Leather welding gloves', far: 0.4, desc: 'للحام القوس والغاز والقطع؛ عازل حرارياً وطويل يغطي الرسغ.', facts: [], safety: 'لازم يكون ناشف؛ الجوانتي المبلول بيوصّل الكهربا.' },
  { id: 'glovesT', name: 'جوانتي TIG رفيع', en: 'TIG gloves', far: 0.4, desc: 'جلد ماعز رفيع عشان الإحساس بالأصابع وانت بتغمس السلك.', facts: [], safety: '' },
  { id: 'jacket', name: 'جاكيت لحام', en: 'Welding jacket (FR)', far: 0.55, desc: 'قماش قطن مقاوم للحريق أو جلد؛ أكمام طويلة وزراير مقفولة.', facts: ['ممنوع الهدوم الصناعي (بوليستر)؛ بتسيح على الجلد.'], safety: '' },
  { id: 'apron', name: 'مريلة جلد', en: 'Leather apron', far: 0.55, desc: 'بتحمي الجسم والرجلين من الشرار والمعدن المنصهر.', facts: [], safety: '' },
  { id: 'boots', name: 'حذاء السلامة', en: 'Safety boots', far: 0.5, desc: 'مقدمة صلب ونعل عازل ومقاوم للحرارة. البنطلون يغطي فتحة الحذاء.', facts: [], safety: '' },
  { id: 'ear', name: 'سدادات الأذن', en: 'Ear plugs', far: 0.3, desc: 'للتجليخ والقطع بالكربون والهوا. وكمان بتمنع الشرار يدخل الودن.', facts: [], safety: '' },
  { id: 'resp', name: 'كمامة الأبخرة', en: 'Fume respirator', far: 0.35, desc: 'بفلاتر للأبخرة المعدنية، خصوصاً مع الصاج المجلفن والاستانلس أو في الأماكن قليلة التهوية.', facts: [], safety: 'أبخرة الزنك من الحديد المجلفن بتعمل «حمى أبخرة المعادن».' },
  { id: 'ext', name: 'طفاية الحريق', en: 'Fire extinguisher', far: 0.7, desc: 'بودرة أو CO₂؛ لازم تكون قريبة ومكانها مكشوف وتعرف تستخدمها.', facts: ['الطريقة: اسحب الفيشة، وجّه للقاعدة، اضغط، حرّك يمين وشمال.'], safety: 'ممنوع تطفي حريق كهربا بالمية.' },
  { id: 'firstaid', name: 'صندوق الإسعافات', en: 'First aid kit', far: 0.6, desc: 'فيه مرهم حروق وشاش وغسول عين.', facts: ['الحرق: ميّه جارية باردة ١٠–٢٠ دقيقة.'], safety: '' },
  { id: 'fume', name: 'شفاط الأبخرة', en: 'Fume extractor', far: 0.9, desc: 'بيسحب الدخان من قرب مكان اللحام قبل ما يوصل لوشّك.', facts: [], safety: '' },
  { id: 'curtain', name: 'ستارة اللحام', en: 'Welding curtain', far: 1.3, desc: 'بتحمي زمايلك اللي حواليك من ضوء القوس والشرار.', facts: [], safety: '' }
];

let ctxRef, items = {}, hazards = [], hazGroup, decoys = [];
const TASKS = {
  smaw: { name: 'لحام بالقوس الكهربي', need: ['helmet', 'glasses', 'glovesL', 'jacket', 'boots'], ok: ['apron', 'resp', 'ear'], bad: { goggles: 'عدسة نظارة الغاز مش كفاية لضوء القوس', shield: 'الواقي الشفاف مش بيحمي من أشعة القوس' } },
  oaw: { name: 'لحام وقطع بالغاز', need: ['goggles', 'glovesL', 'apron', 'boots'], ok: ['jacket', 'glasses', 'resp'], bad: { helmet: 'عدسة ماسك القوس غامقة جداً على لهب الغاز؛ مش هتشوف البركة', shield: 'الواقي الشفاف مش بيحمي من ضوء اللهب' } },
  grind: { name: 'تجليخ وتنضيف بالصاروخ', need: ['shield', 'glasses', 'ear', 'glovesL', 'boots'], ok: ['jacket', 'apron', 'resp'], bad: { goggles: 'نظارة الغاز غامقة ومش مناسبة للتجليخ', glovesT: 'الجوانتي الرفيع مش هيحميك من الشرار والحواف' } },
  tig: { name: 'لحام TIG', need: ['helmet', 'glasses', 'glovesT', 'jacket', 'boots'], ok: ['apron', 'resp'], bad: { goggles: 'عدسة نظارة الغاز مش كفاية لقوس TIG', shield: 'الواقي الشفاف مش بيحمي من أشعة القوس' } }
};
const wear = { task: 'smaw', sel: {}, result: null, solved: {} };
const HAZ = [
  { id: 'hz-oil', name: 'زيت جنب صمام الأكسجين', why: 'الأكسجين مع الزيت أو الشحم ممكن يولّع ويفرقع حتى من غير شرارة.' },
  { id: 'hz-cyl', name: 'أسطوانة مش متربطة ومايلة', why: 'لو وقعت والصمام اتكسر، الغاز بيخرج بضغط ١٥٠ بار وتطير زي الصاروخ.' },
  { id: 'hz-cable', name: 'كابل لحام عازله مقشور', why: 'النحاس العريان ممكن يكهرب أي حد يلمسه أو يعمل شرارة مع الأرض.' },
  { id: 'hz-paper', name: 'كراتين وقماش زيتي تحت مكان اللحام', why: 'الشرار بيطير لحد ١٠ متر وممكن يولّع المواد دي ويعمل حريق.' },
  { id: 'hz-water', name: 'مية على الأرض جنب الماكينة', why: 'المية بتوصّل الكهربا؛ الوقوف فيها وانت بتلحم خطر صعق.' },
  { id: 'hz-grinder', name: 'صاروخ (جلاخة) من غير واقي', why: 'لو الحجر اتكسر ممكن يطير في الوش أو الجسم؛ ممنوع تشيل الواقي.' }
];
const haz = { found: {}, last: null };

function leather(c = 0xb98a56) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, bumpMap: Textures.paint().bumpMap, bumpScale: 1.2 }); }
function buildHelmet(M) {
  const g = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(0.12, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshPhysicalMaterial({ color: 0x1b1d21, roughness: 0.35, clearcoat: 0.5 }));
  shell.scale.set(0.85, 1.25, 1); shell.rotation.x = Math.PI / 2; g.add(shell);
  const lens = mesh(new RoundedBoxGeometry(0.1, 0.05, 0.01, 2, 0.006), new THREE.MeshPhysicalMaterial({ color: 0x0c2a14, roughness: 0.05, metalness: 0.3, clearcoat: 1 })); lens.position.set(0, 0.03, 0.115); g.add(lens);
  const band = mesh(new THREE.TorusGeometry(0.085, 0.006, 6, 30), M.blackPlastic); band.rotation.x = Math.PI / 2 - 0.3; band.position.set(0, 0.02, 0.03); g.add(band);
  return g;
}
function buildGlove(c, thin) {
  const g = new THREE.Group(), mat = leather(c);
  const palm = mesh(new RoundedBoxGeometry(0.085, 0.024, 0.1, 2, 0.01), mat); g.add(palm);
  for (let i = 0; i < 4; i++) { const f = mesh(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), mat); f.rotation.x = Math.PI / 2; f.position.set(-0.03 + i * 0.02, 0, 0.08); g.add(f); }
  const th = mesh(new THREE.CapsuleGeometry(0.01, 0.04, 4, 8), mat); th.rotation.set(Math.PI / 2, 0, 0.8); th.position.set(0.055, 0, 0.03); g.add(th);
  const cuff = mesh(new THREE.CylinderGeometry(0.05, 0.055, thin ? 0.06 : 0.14, 20, 1, true), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })); cuff.rotation.x = Math.PI / 2; cuff.scale.y = 1; cuff.position.z = thin ? -0.075 : -0.115; cuff.scale.set(1, 1, 0.45); g.add(cuff);
  return g;
}
function buildGoggles(M) {
  const g = new THREE.Group();
  [-1, 1].forEach(s => { const l = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 24), M.blackPlastic); l.rotation.x = Math.PI / 2; l.position.x = s * 0.028; g.add(l); const gl = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshPhysicalMaterial({ color: 0x1d5a2a, roughness: 0.05, metalness: 0.2 })); gl.position.set(s * 0.028, 0, 0.0092); g.add(gl); });
  const strap = mesh(new THREE.TorusGeometry(0.07, 0.004, 6, 30, Math.PI), M.rubber); strap.rotation.x = Math.PI / 2; strap.position.z = -0.01; g.add(strap);
  return g;
}
function buildGlasses(M) {
  const g = new THREE.Group();
  const lens = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 30, 1, true, -0.7, 1.4), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }), false);
  lens.rotation.y = Math.PI / 2; g.add(lens);
  [-1, 1].forEach(s => { const t = mesh(new THREE.BoxGeometry(0.004, 0.006, 0.12), M.blackPlastic); t.position.set(s * 0.06, 0.01, -0.06); g.add(t); });
  return g;
}
function buildShield(M) {
  const g = new THREE.Group();
  const v = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 30, 1, true, -0.9, 1.8), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transmission: 0.9, transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide }), false);
  v.rotation.y = Math.PI / 2; g.add(v);
  const hb = mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 30), M.blackPlastic); hb.rotation.x = Math.PI / 2; hb.position.set(0, 0.1, -0.05); g.add(hb);
  return g;
}
function buildExt(M) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 30), new THREE.MeshPhysicalMaterial({ color: 0xc0201a, roughness: 0.35, clearcoat: 0.6 })); body.position.y = 0.25; g.add(body);
  const top = mesh(new THREE.SphereGeometry(0.075, 30, 12, 0, Math.PI * 2, 0, Math.PI / 2), body.material); top.position.y = 0.5; g.add(top);
  const valve = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12), M.darkSteel); valve.position.y = 0.6; g.add(valve);
  const lever = mesh(new THREE.BoxGeometry(0.12, 0.008, 0.02), M.blackPlastic); lever.position.set(0.04, 0.64, 0); lever.rotation.z = 0.2; g.add(lever);
  const hose = new THREE.CatmullRomCurve3([V3(0, 0.6, 0.02), V3(0.05, 0.58, 0.06), V3(0.08, 0.4, 0.08), V3(0.08, 0.25, 0.08)]);
  g.add(mesh(new THREE.TubeGeometry(hose, 20, 0.008, 8), M.rubber));
  const lbl = Textures.label((c, w, h) => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0201a'; c.textAlign = 'center'; c.font = '700 70px "IBM Plex Sans Arabic", sans-serif'; c.fillText('بودرة', w / 2, 120); c.font = '600 44px "IBM Plex Mono", monospace'; c.fillStyle = '#222'; c.fillText('ABC 6kg', w / 2, 200); }, 256, 256);
  const lp = mesh(new THREE.CylinderGeometry(0.0755, 0.0755, 0.16, 30, 1, true, -0.6, 1.2), new THREE.MeshStandardMaterial({ map: lbl }), false, false); lp.position.y = 0.28; lp.rotation.y = Math.PI / 2 - 0.0; g.add(lp);
  return g;
}

S.build = ctx => {
  ctxRef = ctx;
  const M = ctx.M, R = S.root;
  const T = TABLE_Y;
  const put = (id, o, p, r) => { o.position.copy(p); if (r) o.rotation.set(...r); o.userData.pick = id; items[id] = o; R.add(o); };
  put('helmet', buildHelmet(M), V3(0.1, T + 0.07, 0.05), [0, 0.5, 0]);
  put('goggles', buildGoggles(M), V3(0.33, T + 0.02, 0.17), [-Math.PI / 2 + 0.3, 0, 0]);
  put('glasses', buildGlasses(M), V3(0.5, T + 0.03, 0.18), [0, 0.3, 0]);
  put('shield', buildShield(M), V3(0.72, T + 0.11, 0.05), [0, -0.5, 0]);
  put('glovesL', buildGlove(0xb98a56), V3(0.32, T + 0.014, -0.08), [0, 0.4, 0]);
  put('glovesT', buildGlove(0xd8d0c0, true), V3(0.52, T + 0.014, -0.12), [0, -0.3, 0]);
  const ear = new THREE.Group(); [-1, 1].forEach(s => { const p = mesh(new THREE.CapsuleGeometry(0.006, 0.012, 4, 8), new THREE.MeshStandardMaterial({ color: 0xff8a1a, roughness: 0.6 })); p.position.x = s * 0.012; p.rotation.z = Math.PI / 2; ear.add(p); });
  put('ear', ear, V3(0.62, T + 0.007, 0.22));
  const resp = new THREE.Group();
  const rm = mesh(new THREE.SphereGeometry(0.05, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6 })); rm.rotation.x = -Math.PI / 2; resp.add(rm);
  [-1, 1].forEach(s => { const f = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.018, 24), new THREE.MeshStandardMaterial({ color: 0xd65b9a, roughness: 0.6 })); f.rotation.z = Math.PI / 2; f.position.set(s * 0.05, 0, 0.02); resp.add(f); });
  put('resp', resp, V3(-0.08, T + 0.035, -0.12), [0, 0.6, 0]);
  // stand with jacket & apron
  const stand = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.7, 12), M.tube); pole.position.y = 0.85; stand.add(pole);
  const base = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 24), M.tube); base.position.y = 0.015; stand.add(base);
  const arm = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 10), M.tube); arm.rotation.z = Math.PI / 2; arm.position.y = 1.62; stand.add(arm);
  stand.position.set(-0.6, 0, -0.1); R.add(stand);
  const jacket = new THREE.Group(), jm = new THREE.MeshStandardMaterial({ color: 0x2c4a6a, roughness: 0.9, bumpMap: Textures.paint().bumpMap, bumpScale: 1 });
  const torso = mesh(new RoundedBoxGeometry(0.4, 0.55, 0.14, 4, 0.05), jm); jacket.add(torso);
  [-1, 1].forEach(s => { const sl = mesh(new THREE.CapsuleGeometry(0.055, 0.45, 6, 12), jm); sl.position.set(s * 0.24, -0.08, 0); sl.rotation.z = s * 0.18; jacket.add(sl); });
  const collar = mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 20), jm); collar.rotation.x = Math.PI / 2; collar.position.y = 0.28; jacket.add(collar);
  put('jacket', jacket, V3(-0.73, 1.28, -0.1));
  const apron = mesh(new THREE.PlaneGeometry(0.42, 0.85, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.85, side: THREE.DoubleSide, bumpMap: Textures.paint().bumpMap, bumpScale: 1.5 }));
  { const p = apron.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) * 6) * 0.03 + 0.03); apron.geometry.computeVertexNormals(); }
  put('apron', apron, V3(-0.43, 1.18, -0.06), [0, 0.15, 0]);
  const boots = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: 0x241b14, roughness: 0.6 });
  [-1, 1].forEach(s => { const b = mesh(new RoundedBoxGeometry(0.11, 0.1, 0.28, 3, 0.04), bm); b.position.set(s * 0.07, 0.05, 0); boots.add(b); const sh = mesh(new RoundedBoxGeometry(0.1, 0.17, 0.11, 3, 0.04), bm); sh.position.set(s * 0.07, 0.13, -0.07); boots.add(sh); const sole = mesh(new THREE.BoxGeometry(0.115, 0.02, 0.29), new THREE.MeshStandardMaterial({ color: 0xb08a30, roughness: 0.8 })); sole.position.set(s * 0.07, 0.01, 0); boots.add(sole); });
  put('boots', boots, V3(-0.15, 0, 0.62), [0, 0.3, 0]);
  put('ext', buildExt(M), V3(-1.25, 0, 0.35));
  const fa = new THREE.Group();
  const fb = mesh(new RoundedBoxGeometry(0.32, 0.24, 0.1, 3, 0.02), new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.5 })); fa.add(fb);
  const cr1 = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.005), new THREE.MeshStandardMaterial({ color: 0x1c9a4a })); cr1.position.z = 0.051; fa.add(cr1);
  const cr2 = cr1.clone(); cr2.rotation.z = Math.PI / 2; fa.add(cr2);
  put('firstaid', fa, V3(-1.2, 1.4, -1.55));
  items.fume = { position: V3(0.53, 1.44, -0.38) }; items.curtain = { position: V3(0.33, 1.2, -0.62) };

  // ----- hazard scene (only visible in the hazards stage)
  hazGroup = new THREE.Group(); hazGroup.visible = false; R.add(hazGroup);
  const cyl = buildCylinder(M, { h: 1.3, r: 0.1, color: 0x17191c, shoulder: 0xf1f1ee, labelAr: 'أكسجين', labelEn: 'O₂', valve: 'wheel' });
  cyl.position.set(-1.25, 0, -0.55); cyl.rotation.set(0.08, 0, 0.12); cyl.userData.pick = 'hz-cyl'; hazGroup.add(cyl);
  const can = new THREE.Group();
  const cb = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 20), new THREE.MeshStandardMaterial({ color: 0xd9b21a, roughness: 0.4, metalness: 0.5 })); cb.position.y = 0.07; can.add(cb);
  const sp = mesh(new THREE.CylinderGeometry(0.005, 0.01, 0.12, 8), cb.material); sp.position.set(0.04, 0.17, 0); sp.rotation.z = -0.8; can.add(sp);
  const lb = Textures.label((c, w, h) => { c.fillStyle = '#1b1d21'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd34a'; c.textAlign = 'center'; c.font = '700 90px "IBM Plex Sans Arabic", sans-serif'; c.fillText('زيت', w / 2, 160); }, 256, 256);
  const ll = mesh(new THREE.CylinderGeometry(0.0505, 0.0505, 0.07, 20, 1, true, -0.8, 1.6), new THREE.MeshStandardMaterial({ map: lb }), false, false); ll.position.y = 0.07; ll.rotation.y = Math.PI / 2; can.add(ll);
  can.position.set(-1.08, 0, -0.42); can.userData.pick = 'hz-oil'; hazGroup.add(can);
  const cab = new Cable(M); const pts = [V3(-1.0, 0.012, 0.75), V3(-0.4, 0.012, 0.8), V3(0.2, 0.012, 0.85), V3(0.8, 0.012, 0.8)];
  cab.update(pts[0], V3(1, 0, 0), pts[3], V3(1, 0, 0), { bSide: 'floor', via: [pts[1], pts[2]] }); cab.mesh.userData.pick = 'hz-cable'; hazGroup.add(cab.mesh);
  const bare = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 12), M.copper); bare.rotation.z = Math.PI / 2; bare.position.set(-0.2, 0.012, 0.82); bare.userData.pick = 'hz-cable'; hazGroup.add(bare);
  const paper = new THREE.Group();
  const box1 = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), M.cardboard); box1.position.set(0, 0.1, 0); box1.rotation.y = 0.3; paper.add(box1);
  const rag = mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })); rag.scale.set(1.4, 0.4, 1); rag.position.set(0.22, 0.03, 0.08); paper.add(rag);
  paper.position.set(0.45, 0, 0.1); paper.userData.pick = 'hz-paper'; hazGroup.add(paper);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.35, 40), new THREE.MeshPhysicalMaterial({ color: 0x3c5a6e, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(1.2, 0.8, 1); water.position.set(-0.6, 0.003, 0.32); water.userData.pick = 'hz-water'; hazGroup.add(water);
  const grinder = new THREE.Group();
  const gb = mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.25, 20), new THREE.MeshStandardMaterial({ color: 0x1f6fb5, roughness: 0.4 })); gb.rotation.z = Math.PI / 2; grinder.add(gb);
  const gh = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), M.darkSteel); gh.position.x = 0.15; grinder.add(gh);
  const disc = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.006, 32), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9 })); disc.position.set(0.16, -0.045, 0); grinder.add(disc);
  grinder.position.set(0.0, TABLE_Y + 0.05, 0.12); grinder.rotation.y = -0.6; grinder.userData.pick = 'hz-grinder'; hazGroup.add(grinder);
  hazards = [can, cyl, cab.mesh, bare, paper, water, grinder];
  const ext2 = items.ext; decoys = [ext2];
  S._pick = Object.values(items).filter(o => o.isObject3D).concat(hazards);
};
S.pickables = () => S._pick;
S.enter = ctx => { ctx.setPlates({ t: 0.006, kind: 'butt' }); ctx.shared.plates.visible = false; };
S.leave = ctx => { ctx.shared.plates.visible = true; };
S.setAssembled = () => { if (hazGroup) hazGroup.visible = false; };
S.partObject = id => items[id] && items[id].isObject3D ? items[id] : null;
S.partAnchor = id => { const o = items[id]; const v = o.isObject3D ? o.getWorldPosition(new THREE.Vector3()) : o.position.clone(); if (id === 'jacket') v.y += 0.05; return v; };
S.cams = {
  explore: () => ({ pos: V3(0.55, 1.45, 1.6), target: V3(-0.1, 0.75, 0.0) }),
  wear: () => ({ pos: V3(0.4, 1.5, 1.4), target: V3(-0.05, 0.85, 0.0) }),
  hazards: () => ({ pos: V3(0.9, 1.8, 2.1), target: V3(-0.25, 0.3, 0.1) })
};

// ----- wear (dress for the job)
const ALL = ['helmet', 'goggles', 'glasses', 'shield', 'glovesL', 'glovesT', 'jacket', 'apron', 'boots', 'ear', 'resp'];
const nameOf = id => S.parts.find(p => p.id === id).name;
function checkWear() {
  const t = TASKS[wear.task], sel = Object.keys(wear.sel).filter(k => wear.sel[k]);
  const missing = t.need.filter(k => !wear.sel[k]);
  const wrong = sel.filter(k => t.bad[k]);
  const extra = sel.filter(k => !t.need.includes(k) && !t.ok.includes(k) && !t.bad[k]);
  wear.result = { missing, wrong, extra, ok: !missing.length && !wrong.length };
  if (wear.result.ok) wear.solved[wear.task] = true;
}
S.custom = {
  wear: {
    enter: ctx => { wear.result = null; hazGroup.visible = false; ctx.E.setHighlight(Object.keys(wear.sel).filter(k => wear.sel[k]).map(k => items[k])); },
    html: () => {
      const t = TASKS[wear.task], r = wear.result;
      return `
        <section class="card"><h3 class="sm">اختار الشغلانة</h3>
          <div class="seg2">${Object.entries(TASKS).map(([k, v]) => `<button type="button" class="${wear.task === k ? 'on' : ''}" data-op="task:${k}">${wear.solved[k] ? '✓ ' : ''}${v.name}</button>`).join('')}</div></section>
        <section class="card"><h3 class="sm">البس اللي محتاجه لـ«${t.name}»</h3>
          <div class="quiz">${ALL.map(k => {
            const on = wear.sel[k];
            const cls = r ? (on ? (t.bad[k] ? 'no' : (t.need.includes(k) || t.ok.includes(k)) ? 'ok' : '') : (t.need.includes(k) ? 'no' : '')) : (on ? 'ok' : '');
            return `<button type="button" class="${cls}" data-op="item:${k}">${on ? ICON.check : ICON.plus}${nameOf(k)}</button>`;
          }).join('')}</div>
          <p class="muted small">المس العنصر هنا أو في المجسم.</p></section>
        ${r ? `<div class="msg ${r.ok ? 'good' : 'bad'}" role="status">${r.ok ? ICON.check : ICON.x}<span>${r.ok ? 'ممتاز! لبسك مناسب للشغلانة دي.' : [
          r.missing.length ? 'ناقصك: ' + r.missing.map(nameOf).join('، ') + '.' : '',
          ...r.wrong.map(k => nameOf(k) + ': ' + t.bad[k] + '.')].filter(Boolean).join(' ')}</span></div>` : ''}
        <button type="button" class="btn primary big" data-op="check">${ICON.check}اتأكد</button>
        <p class="muted small">اتحلّ ${Object.keys(wear.solved).length} من ${Object.keys(TASKS).length}.</p>
        ${Object.keys(wear.solved).length === Object.keys(TASKS).length ? `<button type="button" class="btn primary big" data-go="hazards" data-mark="wear">التالي: اكتشف المخاطر ${ICON.next}</button>` : ''}`;
    },
    noNext: true,
    pick: (id, ctx) => { if (ALL.includes(id)) S.operateAction('item:' + id, null, ctx); }
  },
  hazards: {
    enter: ctx => { hazGroup.visible = true; haz.last = null; ctx.E.setHighlight(Object.keys(haz.found).map(k => hazards.find(h => h.userData.pick === k))); },
    html: () => {
      const n = Object.keys(haz.found).length;
      return `
        <section class="card"><div class="ph"><h3 class="sm">في الورشة ${HAZ.length} مخاطر. لاقيهم!</h3><span class="mono accent">${n} / ${HAZ.length}</span></div>
          <div class="meter" dir="ltr"><div class="zone" style="left:0;width:${n / HAZ.length * 100}%"></div></div>
          <p class="muted small">لف الكاميرا وقرّب، والمس أي حاجة شايفها خطر.</p></section>
        ${haz.last ? `<div class="msg ${haz.last.t}" role="status">${haz.last.t === 'good' ? ICON.check : ICON.info}<span>${haz.last.s}</span></div>` : ''}
        <section class="card"><h3 class="sm">اللي لقيته</h3>
          ${HAZ.filter(h => haz.found[h.id]).map((h, i) => `<div class="defect"><i>${i + 1}</i><div><b>${h.name}</b><span>${h.why}</span></div></div>`).join('') || '<p class="muted small">لسه ماكتشفتش حاجة.</p>'}
        </section>
        ${n === HAZ.length ? `<div class="msg good">${ICON.check}<span>برافو! اكتشفت كل المخاطر. دايماً افحص مكان الشغل قبل ما تبدأ.</span></div><button type="button" class="btn primary big" data-act="finish-station" data-mark="hazards">إنهاء المحطة</button>` : `<button type="button" class="btn" data-op="hint">${ICON.eye}تلميح</button>`}`;
    },
    noNext: true,
    pick: (id, ctx) => {
      const h = HAZ.find(x => x.id === id);
      if (h) {
        if (!haz.found[id]) { haz.found[id] = true; ctx.audio.click(); haz.last = { t: 'good', s: 'صح! ' + h.name + ': ' + h.why }; }
        ctx.E.setHighlight(Object.keys(haz.found).map(k => hazards.filter(o => o.userData.pick === k)).flat());
      } else if (id === 'ext') haz.last = { t: 'info', s: 'طفاية الحريق في مكانها وقريبة؛ ده مش خطر، ده المطلوب.' };
      else haz.last = { t: 'info', s: 'ده مش خطر. دوّر تاني.' };
      ctx.renderPanel();
    }
  }
};
S.operateAction = (op, el, ctx) => {
  if (op.startsWith('task:')) { wear.task = op.slice(5); wear.result = null; }
  else if (op.startsWith('item:')) { const k = op.slice(5); wear.sel[k] = !wear.sel[k]; wear.result = null; ctx.audio.click(); }
  else if (op === 'check') checkWear();
  else if (op === 'hint') { const left = HAZ.filter(h => !haz.found[h.id]); if (left.length) { const o = hazards.find(x => x.userData.pick === left[0].id); const p = o.getWorldPosition(new THREE.Vector3()); ctx.E.flyTo(p.clone().add(V3(0.35, 0.55, 0.75)), p); haz.last = { t: 'info', s: 'بص حوالين المكان ده كويس.' }; } }
  if (ctx.state.stage === 'wear') ctx.E.setHighlight(Object.keys(wear.sel).filter(k => wear.sel[k]).map(k => items[k]));
  ctx.renderPanel();
};

export default S;
