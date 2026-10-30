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
// Each requirement is a group: any one item in the group satisfies it.
const TASKS = {
  smaw: { name: 'لحام بالقوس الكهربي',
    need: [['helmet', 'حماية العين والوش من أشعة القوس'], ['glovesL', 'حماية الإيد'], [['jacket', 'apron'], 'حماية الجسم من الشرار'], ['boots', 'حماية الرجل']],
    ok: ['glasses', 'apron', 'jacket', 'resp', 'ear'],
    bad: { goggles: 'عدسة نظارة الغاز (درجة ٥) مش كفاية لضوء القوس؛ لازم ماسك عدسة ١٠ أو أغمق', shield: 'الواقي الشفاف مش بيحمي من أشعة القوس فوق البنفسجية', glovesT: 'جوانتي TIG رفيع ومش هيستحمل حرارة وشرار القوس الكهربي' } },
  oaw: { name: 'لحام وقطع بالغاز',
    need: [['goggles', 'نظارة لحام غاز بعدسة ٤–٦'], ['glovesL', 'حماية الإيد'], [['jacket', 'apron'], 'حماية الجسم من الشرار والمعدن المنصهر'], ['boots', 'حماية الرجل']],
    ok: ['jacket', 'apron', 'glasses', 'resp', 'ear'],
    bad: { helmet: 'عدسة ماسك القوس غامقة جداً على لهب الغاز؛ مش هتشوف البركة كويس', shield: 'الواقي الشفاف مش بيحمي العين من ضوء اللهب', glovesT: 'جوانتي TIG رفيع ومش مناسب لحرارة القطع بالغاز' } },
  grind: { name: 'تجليخ وتنضيف بالصاروخ',
    need: [['glasses', 'نظارة السلامة تحت الواقي'], ['shield', 'واقي الوش من الشظايا'], ['ear', 'حماية السمع'], ['glovesL', 'حماية الإيد'], ['boots', 'حماية الرجل']],
    ok: ['jacket', 'apron', 'resp'],
    bad: { goggles: 'نظارة الغاز غامقة ومش هتشوف بيها الشغل وانت بتجلّخ', helmet: 'ماسك اللحام عدسته غامقة ومش هتشوف بيه الشغل وانت بتجلّخ', glovesT: 'الجوانتي الرفيع مش هيحميك من الشرار والحواف الحادة' } },
  tig: { name: 'لحام TIG',
    need: [['helmet', 'ماسك بعدسة ١٠–١١'], ['glovesT', 'جوانتي TIG رفيع للإحساس بالسلك'], [['jacket', 'apron'], 'حماية الجسم'], ['boots', 'حماية الرجل']],
    ok: ['glasses', 'jacket', 'apron', 'resp', 'glovesL'],
    bad: { goggles: 'عدسة نظارة الغاز مش كفاية لقوس TIG', shield: 'الواقي الشفاف مش بيحمي من أشعة القوس' } }
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
        ? `<div class="msg good" role="status">${ICON.check}<span>ممتاز! لبسك مناسب لـ«${t.name}».${r.extra.length ? ' (' + r.extra.map(nameOf).join('، ') + ' مش ضروري هنا، بس مايضرش.)' : ''}</span></div>`
        : `<div class="msg bad" role="status">${ICON.x}<span>${[
            ...r.missing.map(m => 'ناقصك ' + m.why + ': ' + m.items.map(nameOf).join(' أو ') + '.'),
            ...r.wrong.map(k => nameOf(k) + ': ' + t.bad[k] + '.')].join('<br>')}</span></div>`;
      return `
        <section class="card"><h3 class="sm">اختار الشغلانة</h3>
          <div class="seg2">${Object.entries(TASKS).map(([k, v]) => `<button type="button" class="${wear.task === k ? 'on' : ''}" data-op="task:${k}">${wear.solved[k] ? '✓ ' : ''}${v.name}</button>`).join('')}</div></section>
        <section class="card"><h3 class="sm">البس اللي محتاجه لـ«${t.name}»</h3>
          <div class="quiz">${ALL.map(k => `<button type="button" class="${cls(k)}" data-op="item:${k}">${wear.sel[k] ? ICON.check : ICON.plus}${nameOf(k)}</button>`).join('')}</div>
          <p class="muted small">اختار من هنا أو المس الحاجة نفسها في المجسم.</p></section>
        ${msg}
        <div class="row2"><button type="button" class="btn" data-op="clear">${ICON.reset}امسح الاختيار</button><button type="button" class="btn primary" data-op="check">${ICON.check}اتأكد</button></div>
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
  if (op.startsWith('task:')) { wear.task = op.slice(5); wear.result = null; wear.sel = {}; }
  else if (op === 'clear') { wear.sel = {}; wear.result = null; }
  else if (op.startsWith('item:')) { const k = op.slice(5); wear.sel[k] = !wear.sel[k]; wear.result = null; ctx.audio.click(); }
  else if (op === 'check') { const r = checkWear(); ctx.say && ctx.say(r.ok ? 'ممتاز، لبسك مناسب للشغلانة دي.' : [...r.missing.map(m => 'ناقصك ' + m.why), ...r.wrong.map(k => nameOf(k) + '. ' + TASKS[wear.task].bad[k])].join('. '), r.ok ? 'good' : 'bad'); }
  else if (op === 'hint') { const left = HAZ.filter(h => !haz.found[h.id]); if (left.length) { const o = hazards.find(x => x.userData.pick === left[0].id); const p = o.getWorldPosition(new THREE.Vector3()); ctx.E.flyTo(p.clone().add(V3(0.35, 0.55, 0.75)), p); haz.last = { t: 'info', s: 'بص حوالين المكان ده كويس.' }; } }
  if (ctx.state.stage === 'wear') ctx.E.setHighlight(Object.keys(wear.sel).filter(k => wear.sel[k]).map(k => items[k]));
  ctx.renderPanel();
};

export default S;
