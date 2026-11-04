// Fit-up & positions: the student chooses a real shipyard exercise (joint type, two plate thicknesses, welding position),
// cleans the edges, tack-welds the parts and mounts them in the positioner. The whole weld then happens in a rotated
// "work frame", so the same welding simulation works flat, horizontal, vertical-up and overhead.
import * as THREE from 'three';
import { JOINT, TABLE_Y } from '../models.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const MM = v => v / 1000;
// position → rotation of the work about the joint root, and where the fixture holds it
const POS = {
  '1G': { name: 'مسطح 1G', rot: [0, 0, 0], lift: 0 },
  '2G': { name: 'أفقي 2G', rot: [Math.PI / 2, 0, 0], lift: 0.13, dz: -0.03 },
  '3G': { name: 'رأسي صاعد 3G', rot: [Math.PI / 2, 0, Math.PI / 2], lift: 0.16, dz: -0.03 },
  '4G': { name: 'فوق الرأس 4G', rot: [0, 0, Math.PI], lift: 0.42, dz: 0.02 },
  '1F': { name: 'زاوية مسطح 1F', rot: [-Math.PI / 4, 0, 0], lift: 0.07 },
  '2F': { name: 'زاوية أفقي 2F', rot: [0, 0, 0], lift: 0 },
  '3F': { name: 'زاوية رأسي 3F', rot: [0, 0, Math.PI / 2], lift: 0.16, dz: -0.02 },
  '4F': { name: 'زاوية فوق الرأس 4F', rot: [0, 0, Math.PI], lift: 0.42, dz: 0.02 }
};
const JOINT_NAME = { butt: 'تناكبية', tee: 'زاوية (حرف T)', lap: 'تراكبية' };
// exercise sets per process family. work = ideal work-angle bias (°) toward the thicker plate (null: not needed)
const SETS = {
  arc: [
    { id: 'coupon', name: 'لوح اختبار', ship: 'تمرين أساسي على لوحين متساويين', kind: 'butt', t: 6, t2: 6, pos: '1G', work: null },
    { id: 'deck', name: 'عصب تقوية على سطح السفينة', ship: 'لحام عصب (Stiffener) ٦ مم على لوح سطح ١٠ مم', kind: 'tee', t: 10, t2: 6, pos: '2F', work: 10 },
    { id: 'bottom', name: 'لوح البدن مع لوح القاع', ship: 'وصلة تناكبية بين سمكين ٦ و١٠ مم بعد شطف اللوح السميك', kind: 'butt', t: 6, t2: 10, pos: '1G', work: 8 },
    { id: 'side', name: 'ألواح جانب السفينة', ship: 'وصلة تناكبية ٨ مم في الوضع الأفقي على جانب البدن', kind: 'butt', t: 8, t2: 8, pos: '2G', work: null },
    { id: 'bulkhead', name: 'لوح الحاجز المائي', ship: 'وصلة تناكبية ٨ مم في الوضع الرأسي الصاعد (Bulkhead)', kind: 'butt', t: 8, t2: 8, pos: '3G', work: null },
    { id: 'frame', name: 'إطار البدن (Frame)', ship: 'وصلة زاوية رأسية: إطار ٨ مم على لوح البدن ١٠ مم', kind: 'tee', t: 10, t2: 8, pos: '3F', work: 8 },
    { id: 'patch', name: 'رقعة إصلاح على البدن', ship: 'وصلة تراكبية: رقعة ٦ مم فوق لوح ٨ مم', kind: 'lap', t: 8, t2: 6, pos: '2F', work: 10 },
    { id: 'underdeck', name: 'عصب تحت السطح', ship: 'وصلة زاوية فوق الرأس: عصب ٦ مم تحت لوح سطح ٨ مم', kind: 'tee', t: 8, t2: 6, pos: '4F', work: 8 }
  ],
  thin: [
    { id: 'sheet', name: 'صاج رقيق', ship: 'تمرين أساسي على لوحين ٣ مم', kind: 'butt', t: 3, t2: 3, pos: '1G', work: null },
    { id: 'tank', name: 'ركن خزان من الصلب الذي لا يصدأ', ship: 'وصلة زاوية ٣ مم على ٣ مم', kind: 'tee', t: 3, t2: 3, pos: '2F', work: 0 },
    { id: 'pipe', name: 'شفة على صاج ٤ مم', ship: 'وصلة تراكبية ٢ مم فوق ٤ مم', kind: 'lap', t: 4, t2: 2, pos: '2F', work: 12 },
    { id: 'vsheet', name: 'صاج رأسي', ship: 'وصلة تناكبية ٣ مم في الوضع الرأسي الصاعد', kind: 'butt', t: 3, t2: 3, pos: '3G', work: null }
  ],
  gas: [
    { id: 'gsheet', name: 'صاج رقيق', ship: 'وصلة تناكبية ٢ مم', kind: 'butt', t: 2, t2: 2, pos: '1G', work: null },
    { id: 'glap', name: 'رقعة صاج', ship: 'وصلة تراكبية ٢ مم فوق ٢ مم', kind: 'lap', t: 2, t2: 2, pos: '2F', work: 0 },
    { id: 'gtee', name: 'زاوية صاج', ship: 'وصلة زاوية ٢ مم على ٣ مم', kind: 'tee', t: 3, t2: 2, pos: '2F', work: 8 }
  ]
};
const FAMILY = { smaw: 'arc', mig: 'arc', co2: 'arc', caw: 'gas', tig: 'thin', oaw: 'gas' };
const POS_TIP = {
  '1G': 'الوضع المسطح هو الأسهل: حافظ على السرعة وطول القوس.',
  '2G': 'في الوضع الأفقي يميل المعدن المنصهر إلى النزول: امشِ بخط مستقيم بلا تذبذب، وأمِل الأداة ١٠–١٥° لأعلى، وقلّل الحرارة قليلًا، وزِد السرعة.',
  '3G': 'في الوضع الرأسي الصاعد: قلّل التيار ١٠–١٥٪، واختر حركة «المثلث» من حافة لحافة، واصعد ٢–٣ مم في كل دورة، ولا تتأخر وإلا تدلّى المعدن.',
  '4G': 'فوق الرأس: قوس قصير جدًا، وحرارة أقل، وحركة سريعة ثابتة حتى لا يتساقط المعدن.',
  '1F': 'وصلة الزاوية في الوضع المسطح: وجّه الأداة على منتصف الزاوية.',
  '2F': 'وصلة الزاوية الأفقية: وجّه الأداة على منتصف الزاوية، ومِل قليلًا نحو اللوح السميك.',
  '3F': 'وصلة الزاوية الرأسية: قلّل التيار، واستخدم حركة «المثلث» لتوزيع الحرارة على اللوحين، واصعد ببطء منتظم.',
  '4F': 'وصلة الزاوية فوق الرأس: قوس قصير وحرارة أقل وسرعة ثابتة.'
};

export function createFitup({ E, audio, toast, say, onMounted }) {
  const posFrame = new THREE.Group(), jointFrame = new THREE.Group();
  posFrame.matrixAutoUpdate = false; jointFrame.matrixAutoUpdate = false;
  posFrame.add(jointFrame); E.scene.add(posFrame);
  // fixture (positioner arm) shown when the work is mounted off the bench
  const fixture = new THREE.Group(); fixture.visible = false; E.scene.add(fixture);
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a5563, roughness: 0.45, metalness: 0.8 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1, 16), steel); post.castShadow = true; fixture.add(post);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), steel); fixture.add(base);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.16), steel); fixture.add(arm);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.5, metalness: 0.4 })); fixture.add(jaw);

  const st = { byStation: {}, mounted: false, k: 0, cleaned: 0, tacks: [false, false, false], done: false };
  const root = () => V3(0.3, JOINT.y, JOINT.z);
  const list = sid => SETS[FAMILY[sid] || 'arc'];
  const cur = sid => list(sid).find(e => e.id === st.byStation[sid]) || list(sid)[0];

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function posMatrix(ex, k) {   // k: 0 = on the bench (flat), 1 = mounted in the position
    const P = POS[ex.pos], r = root();
    _e.set(P.rot[0] * k, P.rot[1] * k, P.rot[2] * k, 'ZYX'); _q.setFromEuler(_e);
    const to = r.clone().add(V3(0, P.lift * k, (P.dz || 0) * k));
    return new THREE.Matrix4().makeTranslation(to.x, to.y, to.z).multiply(_m.makeRotationFromQuaternion(_q)).multiply(new THREE.Matrix4().makeTranslation(-r.x, -r.y, -r.z));
  }
  function jointMatrix(ex) {
    const r = root(), a = ex && (ex.kind === 'tee' || ex.kind === 'lap') ? Math.PI / 4 : 0;
    return new THREE.Matrix4().makeTranslation(r.x, r.y, r.z).multiply(new THREE.Matrix4().makeRotationX(a)).multiply(new THREE.Matrix4().makeTranslation(-r.x, -r.y, -r.z));
  }
  function apply(ex, k) {
    st.k = k;
    posFrame.matrix.copy(posMatrix(ex, k)); jointFrame.matrix.copy(jointMatrix(ex));
    posFrame.updateMatrixWorld(true);
    const P = POS[ex.pos], on = P.lift > 0 && k > 0.02;
    fixture.visible = on;
    if (on) {   // post from the bench up to the work, arm + jaw holding the plates' back edge
      const r = root(), top = r.y + P.lift * k;
      post.scale.y = Math.max(0.01, top - TABLE_Y + 0.02); post.position.set(r.x + 0.16, TABLE_Y + post.scale.y / 2, r.z - 0.12);
      base.position.set(r.x + 0.16, TABLE_Y + 0.01, r.z - 0.12);
      arm.position.set(r.x + 0.16, top, r.z - 0.06); jaw.position.set(r.x + 0.13, top, r.z - 0.02);
    }
    E.poke && E.poke(300);
  }
  let tw = null;   // only one positioner motion at a time (a preview must never fight the real mount)
  const stopTw = () => { if (tw) { const i = E.tweens.indexOf(tw); if (i >= 0) E.tweens.splice(i, 1); tw = null; } };
  function mount(sid, animate = true, done) {
    const ex = cur(sid);
    if (!animate) { stopTw(); apply(ex, 1); st.mounted = true; done && done(); return; }
    audio.sfx('clunk'); stopTw(); const k0 = st.k;
    tw = E.tween(1.3 * (1 - k0) + 0.05, k => { k = k * k * (3 - 2 * k); apply(ex, k0 + (1 - k0) * k); }, () => { tw = null; st.mounted = true; onMounted && onMounted(ex); done && done(); });
  }
  function unmount(sid, animate = true, done) {
    const ex = cur(sid);
    if (!st.mounted && st.k === 0 && !tw) { apply(ex, 0); done && done(); return; }
    if (!animate) { stopTw(); apply(ex, 0); st.mounted = false; done && done(); return; }
    stopTw(); const k0 = st.k;
    tw = E.tween(1.0 * k0 + 0.05, k => apply(ex, k0 * (1 - k * k * (3 - 2 * k))), () => { tw = null; st.mounted = false; done && done(); });
  }
  const W = () => { jointFrame.updateMatrixWorld(true); return jointFrame.matrixWorld; };
  const flat = () => st.k === 0 && (!jointFrame.matrix || jointFrame.matrix.equals(new THREE.Matrix4()));
  function gravityLocal() { const inv = new THREE.Matrix4().copy(W()).invert(); return V3(0, -1, 0).transformDirection(inv); }

  return {
    posFrame, jointFrame, fixture, POS, JOINT_NAME, POS_TIP,
    list, cur, st, apply, mount, unmount, W, flat, gravityLocal,
    plateOpts: sid => { const e = cur(sid); return { kind: e.kind, t: MM(e.t), t2: MM(e.t2) }; },
    select(sid, id) { st.byStation[sid] = id; st.done = false; st.tacks = [false, false, false]; st.tackQ = [null, null, null]; st.tackOrder = true; st.cleaned = 0; st.cleanDone = false; st.mounted = false; st.k = 0; },
    reset() { st.done = false; st.tacks = [false, false, false]; st.tackQ = [null, null, null]; st.tackOrder = true; st.cleaned = 0; st.cleanDone = false; }
  };
}
