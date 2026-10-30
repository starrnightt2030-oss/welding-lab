// Station: Safety & tools (السلامة والأدوات) — PPE explorer, "dress for the job" quiz, hazard hunt.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TABLE_Y, Cable } from '../models.js';
import { buildCylinder, mesh } from '../gasparts.js';
import { Textures } from '../textures.js';
import { ICON } from '../core/icons.js';
import { buildHelmet, buildGlove, buildGoggles, buildGlasses, buildFaceShield, buildJacket, buildApron, buildBoots, buildEarPlugs, buildRespirator, buildExtinguisher, buildFirstAid } from '../ppe.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const S = {
  id: 'safety', name: 'السلامة والأدوات', code: 'PPE', icon: ICON.shield, ready: true,
  stages: [['explore', 'تعرّف'], ['wear', 'ارتدِ المهمات الصحيحة'], ['hazards', 'اكتشف المخاطر']]
};
S.parts = [
  { id: 'helmet', name: 'قناع اللحام', en: 'Welding helmet', far: 0.45, desc: 'يحمي العين والوجه من الأشعة فوق البنفسجية وتحت الحمراء والشرر. تُحدد درجة العدسة حسب التيار.', facts: ['لحام القوس: عدسة ١٠–١٣ حسب التيار.', 'القناع الأوتوماتيكي يُعتم تلقائيًا لحظة إشعال القوس.'], safety: 'لا تنظر إلى القوس أبدًا بدون قناع؛ فثوانٍ قليلة تكفي لإصابة العين بحروق مؤلمة.' },
  { id: 'goggles', name: 'نظارة لحام الغاز', en: 'Gas welding goggles', far: 0.35, desc: 'عدسة ٤–٦ للحام والقطع بالغاز.', facts: [], safety: 'غير كافية للحام القوس الكهربائي.' },
  { id: 'glasses', name: 'نظارة السلامة الشفافة', en: 'Safety glasses', far: 0.35, desc: 'تُرتدى تحت القناع وأثناء تكسير الخبث والتنظيف للحماية من الخبث المتطاير.', facts: [], safety: '' },
  { id: 'shield', name: 'واقي الوجه الشفاف', en: 'Face shield', far: 0.4, desc: 'للتجليخ والقطع بالجلّاخة. يُرتدى فوق نظارة السلامة.', facts: [], safety: 'لا يحمي من أشعة اللحام.' },
  { id: 'glovesL', name: 'قفاز جلدي ثقيل', en: 'Leather welding gloves', far: 0.4, desc: 'للحام القوس والغاز والقطع؛ عازل للحرارة وطويل يغطي الرسغ.', facts: [], safety: 'يجب أن يكون جافًا؛ فالقفاز المبتل يوصّل الكهرباء.' },
  { id: 'glovesT', name: 'قفاز TIG رقيق', en: 'TIG gloves', far: 0.4, desc: 'من جلد الماعز الرقيق ليحافظ على الإحساس بالأصابع أثناء غمس السلك.', facts: [], safety: '' },
  { id: 'jacket', name: 'سترة لحام', en: 'Welding jacket (FR)', far: 0.55, desc: 'قماش قطني مقاوم للحريق أو جلد؛ أكمام طويلة وأزرار مغلقة.', facts: ['تُمنع الملابس الصناعية (البوليستر)؛ فهي تنصهر على الجلد.'], safety: '' },
  { id: 'apron', name: 'مريلة جلدية', en: 'Leather apron', far: 0.55, desc: 'تحمي الجسم والساقين من الشرر والمعدن المنصهر.', facts: [], safety: '' },
  { id: 'boots', name: 'حذاء السلامة', en: 'Safety boots', far: 0.5, desc: 'مقدمة من الصلب ونعل عازل ومقاوم للحرارة. ويغطي البنطلون فتحة الحذاء.', facts: [], safety: '' },
  { id: 'ear', name: 'سدادات الأذن', en: 'Ear plugs', far: 0.3, desc: 'للتجليخ والقطع بالكربون والهواء. وتمنع أيضًا دخول الشرر إلى الأذن.', facts: [], safety: '' },
  { id: 'resp', name: 'كمامة الأبخرة', en: 'Fume respirator', far: 0.35, desc: 'بفلاتر للأبخرة المعدنية، خاصة مع الصاج المجلفن والصلب الذي لا يصدأ أو في الأماكن ضعيفة التهوية.', facts: [], safety: 'أبخرة الزنك من الحديد المجلفن تسبب «حمى أبخرة المعادن».' },
  { id: 'ext', name: 'طفاية الحريق', en: 'Fire extinguisher', far: 0.7, desc: 'مسحوق أو CO₂؛ يجب أن تكون قريبة وفي مكان ظاهر، وأن تعرف كيف تستخدمها.', facts: ['الطريقة: اسحب مسمار الأمان، ووجّه إلى قاعدة اللهب، واضغط، وحرّك يمينًا ويسارًا.'], safety: 'يُمنع إطفاء حريق كهربائي بالماء.' },
  { id: 'firstaid', name: 'صندوق الإسعافات الأولية', en: 'First aid kit', far: 0.6, desc: 'فيه مرهم للحروق وشاش وغسول للعين.', facts: ['الحروق: ماء جارٍ بارد لمدة ١٠–٢٠ دقيقة.'], safety: '' },
  { id: 'fume', name: 'شفاط الأبخرة', en: 'Fume extractor', far: 0.9, desc: 'يسحب الدخان من مكان اللحام قبل أن يصل إلى وجهك.', facts: [], safety: '' },
  { id: 'curtain', name: 'ستارة اللحام', en: 'Welding curtain', far: 1.3, desc: 'تحمي زملاءك من حولك من ضوء القوس والشرر.', facts: [], safety: '' }
];

let ctxRef, items = {}, hazards = [], hazGroup, decoys = [];
// Each requirement is a group: any one item in the group satisfies it.
const TASKS = {
  smaw: { name: 'لحام بالقوس الكهربائي',
    need: [['helmet', 'حماية العين والوجه من أشعة القوس'], ['glovesL', 'حماية اليدين'], [['jacket', 'apron'], 'حماية الجسم من الشرار'], ['boots', 'حماية القدمين']],
    ok: ['glasses', 'apron', 'jacket', 'resp', 'ear'],
    bad: { goggles: 'عدسة نظارة الغاز (درجة ٥) غير كافية لضوء القوس؛ يلزم قناع بعدسة ١٠ أو أغمق', shield: 'الواقي الشفاف لا يحمي من الأشعة فوق البنفسجية للقوس', glovesT: 'قفاز TIG رقيق ولن يتحمل حرارة القوس الكهربائي وشرره' } },
  oaw: { name: 'لحام وقطع بالغاز',
    need: [['goggles', 'نظارة لحام غاز بعدسة ٤–٦'], ['glovesL', 'حماية اليدين'], [['jacket', 'apron'], 'حماية الجسم من الشرر والمعدن المنصهر'], ['boots', 'حماية القدمين']],
    ok: ['jacket', 'apron', 'glasses', 'resp', 'ear'],
    bad: { helmet: 'عدسة قناع القوس غامقة جدًا للهب الغاز؛ لن ترى البركة جيدًا', shield: 'الواقي الشفاف لا يحمي العين من ضوء اللهب', glovesT: 'قفاز TIG رقيق وغير مناسب لحرارة القطع بالغاز' } },
  grind: { name: 'تجليخ وتنظيف بالجلّاخة',
    need: [['glasses', 'نظارة السلامة تحت الواقي'], ['shield', 'واقي الوجه من الشظايا'], ['ear', 'حماية السمع'], ['glovesL', 'حماية اليدين'], ['boots', 'حماية القدمين']],
    ok: ['jacket', 'apron', 'resp'],
    bad: { goggles: 'نظارة الغاز غامقة ولن ترى بها العمل أثناء التجليخ', helmet: 'عدسة قناع اللحام غامقة ولن ترى بها العمل أثناء التجليخ', glovesT: 'القفاز الرقيق لن يحميك من الشرر والحواف الحادة' } },
  tig: { name: 'لحام TIG',
    need: [['helmet', 'ماسك بعدسة ١٠–١١'], ['glovesT', 'قفاز TIG رقيق للإحساس بالسلك'], [['jacket', 'apron'], 'حماية الجسم'], ['boots', 'حماية القدمين']],
    ok: ['glasses', 'jacket', 'apron', 'resp', 'glovesL'],
    bad: { goggles: 'عدسة نظارة الغاز غير كافية لقوس TIG', shield: 'الواقي الشفاف لا يحمي من أشعة القوس' } }
};
const wear = { task: 'smaw', sel: {}, result: null, solved: {} };
const HAZ = [
  { id: 'hz-oil', name: 'زيت بجانب صمام الأكسجين', why: 'الأكسجين مع الزيت أو الشحم قد يشتعل وينفجر حتى بدون شرارة.' },
  { id: 'hz-cyl', name: 'أسطوانة غير مربوطة ومائلة', why: 'إذا سقطت وانكسر الصمام يخرج الغاز بضغط ١٥٠ بار وتنطلق مثل الصاروخ.' },
  { id: 'hz-cable', name: 'كابل لحام عازله تالف', why: 'النحاس العاري قد يصعق من يلمسه أو يسبب شرارة مع الأرض.' },
  { id: 'hz-paper', name: 'كراتين وقماش ملوث بالزيت تحت مكان اللحام', why: 'يتطاير الشرر حتى ١٠ أمتار وقد يشعل هذه المواد ويسبب حريقًا.' },
  { id: 'hz-water', name: 'ماء على الأرض بجانب الماكينة', why: 'الماء يوصّل الكهرباء؛ والوقوف فيه أثناء اللحام خطر صعق.' },
  { id: 'hz-grinder', name: 'جلّاخة بدون واقٍ', why: 'إذا انكسر القرص فقد يصيب الوجه أو الجسم؛ يُمنع نزع الواقي.' }
];
const haz = { found: {}, last: null };

S.build = ctx => {
  ctxRef = ctx;
  const M = ctx.M, R = S.root;
  const T = TABLE_Y;
  const put = (id, o, p, r) => { o.position.copy(p); if (r) o.rotation.set(...r); o.userData.pick = id; items[id] = o; R.add(o); };
  // display mat on the table
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.56), new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.95, bumpMap: Textures.paint().bumpMap, bumpScale: 0.5 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0.3, T + 0.0015, 0); mat.receiveShadow = true; R.add(mat);
  put('helmet', buildHelmet(), V3(0.04, T, -0.12), [0, 0.35, 0]);
  put('shield', buildFaceShield(), V3(0.62, T, -0.14), [0, -0.4, 0]);
  put('goggles', buildGoggles(), V3(0.24, T, -0.15), [0, 0.15, 0]);
  put('glasses', buildGlasses(), V3(0.4, T, -0.16), [0, -0.1, 0]);
  put('glovesL', buildGlove(0xb98a56), V3(0.08, T, 0.14), [0, 0.55, 0]);
  put('glovesT', buildGlove(0xe2d6c2, true), V3(0.3, T, 0.16), [0, -0.2, 0]);
  put('ear', buildEarPlugs(), V3(0.49, T, 0.08), [0, 0.3, 0]);
  put('resp', buildRespirator(), V3(0.66, T, 0.14), [0, -0.5, 0]);
  // stand with jacket & apron
  const stand = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.75, 12), M.tube); pole.position.y = 0.875; stand.add(pole);
  const base = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32), M.tube); base.position.y = 0.015; stand.add(base);
  const arm = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 10), M.tube); arm.rotation.z = Math.PI / 2; arm.position.y = 1.72; stand.add(arm);
  stand.position.set(-0.62, 0, -0.16); R.add(stand);
  put('jacket', buildJacket(), V3(-0.8, 1.33, -0.16), [0, 0.12, 0]);
  put('apron', buildApron(), V3(-0.45, 1.13, -0.13), [0, -0.1, 0]);
  put('boots', buildBoots(), V3(-0.2, 0, 0.55), [0, 0.5, 0]);
  put('ext', buildExtinguisher(), V3(-1.3, 0, 0.3), [0, 0.6, 0]);
  put('firstaid', buildFirstAid(), V3(-1.2, 1.4, -1.55));
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
  paper.position.set(0.35, 0, 0.05); paper.userData.pick = 'hz-paper'; hazGroup.add(paper);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.35, 40), new THREE.MeshPhysicalMaterial({ color: 0x3c5a6e, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(1.2, 0.8, 1); water.position.set(-0.6, 0.003, 0.32); water.userData.pick = 'hz-water'; hazGroup.add(water);
  const grinder = new THREE.Group();
  const gb = mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.25, 20), new THREE.MeshStandardMaterial({ color: 0x1f6fb5, roughness: 0.4 })); gb.rotation.z = Math.PI / 2; grinder.add(gb);
  const gh = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), M.darkSteel); gh.position.x = 0.15; grinder.add(gh);
  const disc = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.006, 32), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9 })); disc.position.set(0.16, -0.045, 0); grinder.add(disc);
  grinder.position.set(0.95, 0.04, 0.35); grinder.rotation.y = -0.9; grinder.userData.pick = 'hz-grinder'; hazGroup.add(grinder);
  hazards = [can, cyl, cab.mesh, bare, paper, water, grinder];
  const ext2 = items.ext; decoys = [ext2];
  S._pick = Object.values(items).filter(o => o.isObject3D).concat(hazards);
};
S.pickables = () => S._pick;
S.enter = ctx => { ctx.setPlates({ t: 0.006, kind: 'butt' }); ctx.shared.plates.visible = false; };
S.leave = ctx => { ctx.shared.plates.visible = true; };
S.setAssembled = () => { if (hazGroup) hazGroup.visible = false; };
S.partObject = id => items[id] && items[id].isObject3D ? items[id] : null;
S.holdable = id => ['helmet', 'shield', 'goggles', 'glasses', 'glovesL', 'glovesT', 'ear', 'resp', 'boots', 'ext', 'jacket', 'apron'].includes(id);
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
  const has = g => (Array.isArray(g) ? g : [g]).some(k => wear.sel[k]);
  const missing = t.need.filter(([g]) => !has(g)).map(([g, why]) => ({ items: Array.isArray(g) ? g : [g], why }));
  const wrong = sel.filter(k => t.bad[k]);
  const needIds = t.need.flatMap(([g]) => Array.isArray(g) ? g : [g]);
  const extra = sel.filter(k => !needIds.includes(k) && !t.ok.includes(k) && !t.bad[k]);
  wear.result = { missing, wrong, extra, ok: !missing.length && !wrong.length };
  if (wear.result.ok) wear.solved[wear.task] = true;
  return wear.result;
}
S.custom = {
  wear: {
    enter: ctx => { wear.result = null; hazGroup.visible = false; ctx.E.setHighlight(Object.keys(wear.sel).filter(k => wear.sel[k]).map(k => items[k])); },
    html: () => {
      const t = TASKS[wear.task], r = wear.result;
      const needIds = t.need.flatMap(([g]) => Array.isArray(g) ? g : [g]);
      const cls = k => {
        const on = wear.sel[k];
        if (!r) return on ? 'ok' : '';
        if (on) return t.bad[k] ? 'no' : (needIds.includes(k) || t.ok.includes(k)) ? 'ok' : '';
        return r.missing.some(m => m.items.includes(k)) ? 'hint' : '';
      };
      const msg = !r ? '' : r.ok
        ? `<div class="msg good" role="status">${ICON.check}<span>ممتاز! ما ترتديه مناسب لـ«${t.name}».${r.extra.length ? ' (' + r.extra.map(nameOf).join('، ') + ' غير ضروري هنا، لكنه لا يضر.)' : ''}</span></div>`
        : `<div class="msg bad" role="status">${ICON.x}<span>${[
            ...r.missing.map(m => 'ينقصك ' + m.why + ': ' + m.items.map(nameOf).join(' أو ') + '.'),
            ...r.wrong.map(k => nameOf(k) + ': ' + t.bad[k] + '.')].join('<br>')}</span></div>`;
      return `
        <section class="card"><h3 class="sm">اختر نوع العمل</h3>
          <div class="seg2">${Object.entries(TASKS).map(([k, v]) => `<button type="button" class="${wear.task === k ? 'on' : ''}" data-op="task:${k}">${wear.solved[k] ? '✓ ' : ''}${v.name}</button>`).join('')}</div></section>
        <section class="card"><h3 class="sm">ارتدِ ما تحتاجه لـ«${t.name}»</h3>
          <div class="quiz">${ALL.map(k => `<button type="button" class="${cls(k)}" data-op="item:${k}">${wear.sel[k] ? ICON.check : ICON.plus}${nameOf(k)}</button>`).join('')}</div>
          <p class="muted small">اختر من هنا أو المس القطعة نفسها في المجسم.</p></section>
        ${msg}
        <div class="row2"><button type="button" class="btn" data-op="clear">${ICON.reset}امسح الاختيار</button><button type="button" class="btn primary" data-op="check">${ICON.check}تحقّق</button></div>
        <p class="muted small">تم ${Object.keys(wear.solved).length} من ${Object.keys(TASKS).length}.</p>
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
        <section class="card"><div class="ph"><h3 class="sm">في الورشة ${HAZ.length} مخاطر. اكتشفها!</h3><span class="mono accent">${n} / ${HAZ.length}</span></div>
          <div class="meter" dir="ltr"><div class="zone" style="left:0;width:${n / HAZ.length * 100}%"></div></div>
          <p class="muted small">أدر الكاميرا وقرّب، والمس أي شيء تراه خطرًا.</p></section>
        ${haz.last ? `<div class="msg ${haz.last.t}" role="status">${haz.last.t === 'good' ? ICON.check : ICON.info}<span>${haz.last.s}</span></div>` : ''}
        <section class="card"><h3 class="sm">ما اكتشفته</h3>
          ${HAZ.filter(h => haz.found[h.id]).map((h, i) => `<div class="defect"><i>${i + 1}</i><div><b>${h.name}</b><span>${h.why}</span></div></div>`).join('') || '<p class="muted small">لم تكتشف شيئًا بعد.</p>'}
        </section>
        ${n === HAZ.length ? `<div class="msg good">${ICON.check}<span>أحسنت! اكتشفت جميع المخاطر. افحص مكان العمل دائمًا قبل أن تبدأ.</span></div><button type="button" class="btn primary big" data-act="finish-station" data-mark="hazards">إنهاء المحطة</button>` : `<button type="button" class="btn" data-op="hint">${ICON.eye}تلميح</button>`}`;
    },
    noNext: true,
    pick: (id, ctx) => {
      const h = HAZ.find(x => x.id === id);
      if (h) {
        if (!haz.found[id]) { haz.found[id] = true; ctx.audio.click(); haz.last = { t: 'good', s: 'صحيح! ' + h.name + ': ' + h.why }; }
        ctx.E.setHighlight(Object.keys(haz.found).map(k => hazards.filter(o => o.userData.pick === k)).flat());
      } else if (id === 'ext') haz.last = { t: 'info', s: 'طفاية الحريق في مكانها وقريبة؛ هذا ليس خطرًا، بل هو المطلوب.' };
      else haz.last = { t: 'info', s: 'هذا ليس خطرًا. ابحث مرة أخرى.' };
      ctx.renderPanel();
    }
  }
};
S.operateAction = (op, el, ctx) => {
  if (op.startsWith('task:')) { wear.task = op.slice(5); wear.result = null; wear.sel = {}; }
  else if (op === 'clear') { wear.sel = {}; wear.result = null; }
  else if (op.startsWith('item:')) { const k = op.slice(5); wear.sel[k] = !wear.sel[k]; wear.result = null; ctx.audio.click(); }
  else if (op === 'check') { const r = checkWear(); ctx.say && ctx.say(r.ok ? 'ممتاز، ما ترتديه مناسب لهذا العمل.' : [...r.missing.map(m => 'ينقصك ' + m.why), ...r.wrong.map(k => nameOf(k) + '. ' + TASKS[wear.task].bad[k])].join('. '), r.ok ? 'good' : 'bad'); }
  else if (op === 'hint') { const left = HAZ.filter(h => !haz.found[h.id]); if (left.length) { const o = hazards.find(x => x.userData.pick === left[0].id); const p = o.getWorldPosition(new THREE.Vector3()); ctx.E.flyTo(p.clone().add(V3(0.35, 0.55, 0.75)), p); haz.last = { t: 'info', s: 'انظر حول هذا المكان جيدًا.' }; } }
  if (ctx.state.stage === 'wear') ctx.E.setHighlight(Object.keys(wear.sel).filter(k => wear.sel[k]).map(k => items[k]));
  ctx.renderPanel();
};

export default S;
