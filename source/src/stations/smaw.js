// Station: Shielded Metal Arc Welding (اللحام بالقوس الكهربي)
import * as THREE from 'three';
import { buildMachine, buildHolder, buildElectrode, buildClamp, buildPlug, buildElectrodeBox, Cable, TABLE_Y, JOINT } from '../models.js';
import { PARTS, PPE, AR } from '../data.js';
import { ICON } from '../core/icons.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const RANGE = { 2.5: [60, 90], 3.25: [90, 130], 4: [120, 170] };

const S = {
  id: 'smaw', name: 'اللحام بالقوس الكهربي', code: 'SMAW', icon: ICON.bolt, ready: true,
  stages: [['explore', 'اتعرّف'], ['assemble', 'ركّب'], ['operate', 'شغّل'], ['weld', 'الحم'], ['inspect', 'افحص']],
  parts: PARTS.map(p => ({ ...p })),
  exploreMap: { plugH: 'sockets', plugG: 'sockets', switch: 'machine', box: 'electrode' }
};
const VIEWS = { machine: [0.95], knob: [0.42, V3(0.25, 0.25, 1)], display: [0.42, V3(0.25, 0.25, 1)], sockets: [0.45, V3(0.25, 0.3, 1)], holderCable: [0.95], groundCable: [0.95] };
S.parts.forEach(p => { const v = VIEWS[p.id]; p.far = v ? v[0] : 0.55; if (v && v[1]) p.view = v[1]; });

let m, holder, electrode, clamp, plugH, plugG, cableH, cableG, box, ctxRef;
const st = { dia: 3.25, current: 150, power: true, ppe: {} };
const asm = { plugH: true, plugG: true, clamp: true, electrode: true };
const POSE = {
  holderRest: { p: V3(0.66, TABLE_Y + 0.019, 0.21), r: new THREE.Euler(0, Math.PI + 0.25, -0.05) },
  clampOn: { p: V3(0.86, TABLE_Y - 0.006, -0.06), r: new THREE.Euler(0, Math.PI, 0) },
  clampFloor: { p: V3(0.62, 0.018, 0.62), r: new THREE.Euler(Math.PI / 2, 0, 0.6) },
  plugHFloor: { p: V3(-0.3, 0.017, 0.62), r: new THREE.Euler(0, 1.9, 0) },
  plugGFloor: { p: V3(-0.1, 0.017, 0.7), r: new THREE.Euler(0, 1.2, 0) }
};
const apply = (o, p) => { o.position.copy(p.p); o.rotation.copy(p.r); };

S.build = ctx => {
  ctxRef = ctx;
  const M = ctx.M, R = S.root;
  m = buildMachine(M); R.add(m.root);
  holder = buildHolder(M); R.add(holder);
  electrode = buildElectrode(M); electrode.position.x = 0.035; holder.add(electrode);
  clamp = buildClamp(M); R.add(clamp);
  plugH = buildPlug(M, true); plugG = buildPlug(M, false); R.add(plugH, plugG);
  cableH = new Cable(M); cableG = new Cable(M); R.add(cableH.mesh, cableG.mesh);
  box = buildElectrodeBox(M); box.position.set(-0.05, TABLE_Y, 0.2); box.rotation.y = 0.12; R.add(box);
  const tag = (o, id) => { o.userData.pick = id; };
  tag(m.body, 'machine'); tag(m.knob, 'knob'); tag(m.disp, 'display'); tag(m.sockets.plus, 'sockets'); tag(m.sockets.minus, 'sockets');
  tag(cableH.mesh, 'holderCable'); tag(cableG.mesh, 'groundCable'); tag(holder, 'holder'); tag(electrode, 'electrode');
  tag(clamp, 'clamp'); tag(box, 'box'); tag(m.sw, 'switch'); tag(plugH, 'plugH'); tag(plugG, 'plugG');
  S._pick = [m.body, m.knob, m.disp, m.sockets.plus, m.sockets.minus, cableH.mesh, cableG.mesh, holder, clamp, box, m.sw, plugH, plugG];
  S.setAssembled(true); setPower(true); updateMachine();
};
S.pickables = () => S._pick;
S.enter = ctx => { ctx.setPlates({ t: 0.006, kind: 'butt' }); };

function plugIn(plug, k) { m.root.updateMatrixWorld(true); plug.position.copy(m.socketWorld(k)).add(V3(0, 0, 0.012)); plug.rotation.set(0, 0, 0); }
S.setAssembled = all => {
  Object.keys(asm).forEach(k => asm[k] = all);
  if (all) { plugIn(plugH, 'plus'); plugIn(plugG, 'minus'); apply(clamp, POSE.clampOn); }
  else { apply(plugH, POSE.plugHFloor); apply(plugG, POSE.plugGFloor); apply(clamp, POSE.clampFloor); }
  apply(holder, POSE.holderRest);
  electrode.visible = all; electrode.position.set(0.035, 0, 0); electrode.userData.setLength(0.35); electrode.userData.setHot(0);
  updateCables();
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3();
const anchor = (o, out) => { o.updateMatrixWorld(true); return out.copy(o.userData.cableAnchor).applyMatrix4(o.matrixWorld); };
const dirW = (o, l, out) => { o.updateMatrixWorld(true); return out.copy(l).transformDirection(o.matrixWorld); };
function updateCables(free) {
  anchor(plugH, _a); dirW(plugH, V3(0, 0, 1), _d1); anchor(holder, _b); dirW(holder, V3(-1, 0, 0), _d2);
  cableH.update(_a, _d1, _b, _d2, { bSide: free ? 'free' : 'table', lipX: 0.6 });
  anchor(plugG, _a); dirW(plugG, V3(0, 0, 1), _d1); anchor(clamp, _b); dirW(clamp, V3(-1, 0, 0), _d2);
  cableG.update(_a, _d1, _b, _d2, { bSide: asm.clamp ? 'hang' : 'floor' });
}
S.afterMove = () => updateCables();
function setPower(on) {
  st.power = on;
  m.sw.userData.rocker.rotation.x = on ? -0.18 : 0.18;
  m.ledG.material = on ? ctxRef.M.ledGreenOn : ctxRef.M.ledGreenOff;
  m.drawDisplay(st.current, on);
}
function updateMachine() { m.knob.rotation.z = THREE.MathUtils.degToRad(135 - ((st.current - 40) / 160) * 270); m.drawDisplay(st.current, st.power); }

// ---------------- explore
S.partObject = id => ({ machine: m.body, knob: m.knob, display: m.disp, sockets: m.sockets.plus, holderCable: cableH.mesh, groundCable: cableG.mesh, holder, electrode, clamp, plates: ctxRef.shared.plates, hammer: ctxRef.shared.hammer, brush: ctxRef.shared.brush }[id]);
S.partHighlight = id => id === 'sockets' ? [m.sockets.plus, m.sockets.minus] : [S.partObject(id)];
S.partAnchor = id => {
  const v = new THREE.Vector3();
  switch (id) {
    case 'machine': m.body.localToWorld(v.set(0.15, 0.08, 0)); break;
    case 'knob': m.knob.getWorldPosition(v); break;
    case 'display': m.disp.getWorldPosition(v); break;
    case 'sockets': m.sockets.plus.getWorldPosition(v); v.x += 0.06; break;
    case 'holderCable': v.set(0.05, 0.03, 0.6); break;
    case 'groundCable': v.set(0.97, 0.45, 0.1); break;
    case 'holder': holder.localToWorld(v.set(-0.06, 0, 0)); break;
    case 'electrode': holder.localToWorld(v.set(0.25, 0, 0)); break;
    case 'clamp': clamp.getWorldPosition(v); break;
    case 'plates': v.set(0.3, JOINT.y, 0.05); break;
    case 'hammer': ctxRef.shared.hammer.getWorldPosition(v); break;
    case 'brush': ctxRef.shared.brush.getWorldPosition(v); v.y += 0.02; break;
  }
  return v;
};
S.explodeItems = () => [
  { o: m.knob, d: V3(0, 0, 0.07) }, { o: m.disp, d: V3(0, 0, 0.045) },
  { o: plugH, d: V3(0, 0.02, 0.12) }, { o: plugG, d: V3(0, 0.02, 0.12) },
  { o: holder, d: V3(0.04, 0.16, 0.06) }, { o: electrode, d: V3(0.09, 0, 0) }, { o: clamp, d: V3(0.12, 0.1, 0) }
];
S.cams = {
  explore: () => ({ pos: V3(0.62, 1.3, 1.42), target: V3(0.08, 0.6, 0.08) }),
  assemble: () => ({ pos: V3(0.3, 1.32, 1.72), target: V3(0.05, 0.42, 0.18) }),
  operate: () => ({ pos: V3(-0.42, 0.56, 0.86), target: V3(-0.6, 0.37, 0.28) })
};

// ---------------- assemble
S.asmSteps = [
  { id: 'power', title: 'اطفي الماكينة قبل أي توصيل', hint: 'المس مفتاح التشغيل الأحمر في الماكينة عشان تحوّله لوضع الإيقاف (O).' },
  { id: 'holderPlug', title: 'وصّل كابل الماسك بالطرف الموجب (+)', hint: 'المس فيشة كابل الماسك اللي على الأرض، وبعدين المس الطرف المناسب في الماكينة.' },
  { id: 'groundPlug', title: 'وصّل كابل الأرضي بالطرف السالب (−)', hint: 'المس فيشة كابل الأرضي، وبعدين المس الطرف الفاضي.' },
  { id: 'clamp', title: 'ثبّت ماسك الأرضي على طاولة اللحام', hint: 'المس ماسك الأرضي اللي على الأرض عشان تثبّته على حرف الطاولة المعدنية.' },
  { id: 'electrode', title: 'ركّب القطب في فكوك الماسك', hint: 'المس علبة الأقطاب عشان تاخد قطب وتركّبه من طرفه العاري.' }
];
S.asmStart = () => { setPower(true); };
S.asmTargets = (step, ctx) => {
  const s = S.asmSteps[step]; if (!s) return [];
  const picked = ctx.state.asm.picked;
  return { power: [m.sw], holderPlug: picked ? [m.sockets.plus, m.sockets.minus] : [plugH], groundPlug: picked ? [m.sockets.minus] : [plugG], clamp: [clamp], electrode: [box] }[s.id];
};
function moveObj(ctx, obj, toP, toR, dur, done0) {
  ctx.state.asm.busy = true; const done = () => { ctx.state.asm.busy = false; done0 && done0(); };
  const p0 = obj.position.clone(), q0 = obj.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(toR);
  ctx.E.tween(dur, k => { const e = ctx.ease(k); obj.position.lerpVectors(p0, toP, e); obj.position.y += Math.sin(Math.PI * e) * 0.12; obj.quaternion.slerpQuaternions(q0, q1, e); updateCables(); }, done);
}
S.asmPick = (id, ctx, r) => {
  const step = S.asmSteps[ctx.state.asm.step]; if (!step) return;
  const a = ctx.state.asm;
  if (st.power && step.id !== 'power' && id !== 'switch') return ctx.asmMsg('bad', 'خطر! الماكينة لسه شغالة. ماينفعش توصّل أي كابل والماكينة شغالة.');
  switch (step.id) {
    case 'power':
      if (id === 'switch') { setPower(false); ctx.audio.click(); ctx.next('الماكينة اتطفت. كده آمن تبدأ التوصيل.'); }
      else ctx.asmMsg('bad', 'استنى! أول خطوة دايماً إنك تطفي الماكينة قبل أي توصيل.');
      break;
    case 'holderPlug': case 'groundPlug': {
      const isH = step.id === 'holderPlug', plug = isH ? plugH : plugG;
      if (!a.picked) {
        if (id === (isH ? 'plugH' : 'plugG')) { a.picked = true; ctx.asmMsg('info', 'تمام. دلوقتي المس الطرف اللي هتوصّل فيه الفيشة.'); ctx.E.setHighlight(S.asmTargets(a.step, ctx)); }
        else if (id === (isH ? 'plugG' : 'plugH')) ctx.asmMsg('bad', isH ? 'دي فيشة كابل الأرضي. ابدأ بكابل الماسك (الكابل اللي رايح لماسك القطب).' : 'كابل الماسك اتوصّل خلاص. المس فيشة كابل الأرضي.');
        else ctx.asmMsg('bad', 'المس الفيشة اللي على الأرض الأول.');
        return;
      }
      if (id !== 'sockets') return ctx.asmMsg('bad', 'المس واحد من أطراف التوصيل في الماكينة (+ أو −).');
      const which = r && r.object === m.sockets.minus ? 'minus' : 'plus';
      if (isH && which === 'minus') return ctx.asmMsg('bad', 'كده القطبية مباشرة (DCEN). في التمرين ده بنستخدم القطبية العكسية: الماسك على الموجب (+).');
      if (!isH && which === 'plus') return ctx.asmMsg('bad', 'الطرف الموجب عليه كابل الماسك خلاص. الأرضي بيروح للسالب (−).');
      a.picked = null; ctx.E.setHighlight([]);
      moveObj(ctx, plug, m.socketWorld(which).add(V3(0, 0, 0.012)), new THREE.Euler(0, 0, 0), 1.0, () => { asm[isH ? 'plugH' : 'plugG'] = true; ctx.audio.click(); ctx.next(isH ? 'ممتاز! الماسك على الموجب = قطبية عكسية DCEP.' : 'تمام! كابل الأرضي على السالب، والدايرة قربت تكمل.'); });
      break;
    }
    case 'clamp':
      if (id === 'clamp') { ctx.E.setHighlight([]); moveObj(ctx, clamp, POSE.clampOn.p, POSE.clampOn.r, 1.0, () => { asm.clamp = true; updateCables(); ctx.next('ماسك الأرضي متثبّت على الطاولة المعدنية، والطاولة متلامسة مع قطع الشغل.'); }); }
      else ctx.asmMsg('bad', 'المس ماسك الأرضي (المشبك الأحمر اللي على الأرض).');
      break;
    case 'electrode':
      if (id === 'box') {
        ctx.E.setHighlight([]); electrode.visible = true; electrode.position.set(0.25, 0.05, 0.25);
        const p0 = electrode.position.clone();
        ctx.state.asm.busy = true; ctx.E.tween(0.9, k => electrode.position.lerpVectors(p0, V3(0.035, 0, 0), ctx.ease(k)), () => { ctx.state.asm.busy = false; asm.electrode = true; ctx.next('القطب اتركّب من طرفه العاري. المعدة جاهزة للتشغيل!'); });
      } else ctx.asmMsg('bad', 'المس علبة الأقطاب اللي على الطاولة.');
      break;
  }
};
S.asmAuto = ctx => {
  const s = S.asmSteps[ctx.state.asm.step]; if (!s) return;
  if (s.id === 'power') S.asmPick('switch', ctx);
  else if (s.id === 'holderPlug' || s.id === 'groundPlug') {
    const isH = s.id === 'holderPlug';
    if (!ctx.state.asm.picked) S.asmPick(isH ? 'plugH' : 'plugG', ctx);
    S.asmPick('sockets', ctx, { object: isH ? m.sockets.plus : m.sockets.minus });
  } else if (s.id === 'clamp') S.asmPick('clamp', ctx);
  else S.asmPick('box', ctx);
};

// ---------------- operate
S.operateEnter = ctx => { updateMachine(); ctx.E.setHighlight([m.knob]); setTimeout(() => ctx.state.stage === 'operate' && ctx.E.setHighlight([]), 1500); };
S.operatePick = (id, ctx) => { if (id === 'switch') { setPower(!st.power); ctx.audio.click(); ctx.renderPanel(); } };
function status() {
  const [lo, hi] = RANGE[st.dia], c = st.current;
  return c < lo ? ['low', 'أقل من اللازم', 'التيار قليل: القطب هيلزق في الشغلانة والاختراق هيبقى ضعيف. زوّد التيار.']
    : c > hi ? ['high', 'أعلى من اللازم', 'التيار عالي: رذاذ كتير وتآكل في الحواف، والقطب هيسخن ويحمرّ. قلّل التيار.']
    : ['ok', 'مظبوط', 'التيار في المدى المناسب. ابدأ بالقيمة دي وعدّلها حسب شكل الخط.'];
}
S.operateHTML = () => {
  const [lo, hi] = RANGE[st.dia], c = st.current, s = status(), pct = v => ((v - 40) / 160) * 100;
  return `
    <section class="card"><h3 class="sm">قطر القطب (E6013)</h3>
      <div class="seg3">${[2.5, 3.25, 4].map(d => `<button type="button" class="${st.dia === d ? 'on' : ''}" data-op="dia:${d}"><span class="mono">${d}</span> مم</button>`).join('')}</div></section>
    <section class="card"><div class="ph"><h3 class="sm">شدة التيار</h3><span class="tag ${s[0]}">${s[1]}</span></div>
      <div class="cur-ctl">
        <button type="button" class="round" data-op="cur-" aria-label="قلّل التيار">${ICON.minus}</button>
        <div class="cur-val"><span class="mono">${c}</span><small class="mono">A</small></div>
        <button type="button" class="round acc" data-op="cur+" aria-label="زوّد التيار">${ICON.plus}</button>
      </div>
      <input type="range" min="40" max="200" step="5" value="${c}" data-op="current" aria-label="شدة التيار بالأمبير">
      <div class="meter" dir="ltr"><div class="zone" style="left:${pct(lo)}%;width:${pct(hi) - pct(lo)}%"></div><div class="mark ${s[0]}" style="left:${pct(c)}%"></div></div>
      <div class="scale mono" dir="ltr"><span>40</span><span class="ok-t">${lo}–${hi} A</span><span>200</span></div>
      <p class="muted small">${s[2]}</p></section>
    <section class="card"><h3 class="sm">القطبية</h3><p class="small">الماسك على الموجب = <b class="mono accent">DC+</b> قطبية عكسية (اختراق أعمق). اتحددت من التوصيل في «ركّب».</p></section>
    <section class="card"><h3 class="sm">قبل ما تقدح القوس، البس مهمات الوقاية</h3>
      <div class="ppe">${PPE.map(p => `<button type="button" class="${st.ppe[p.id] ? 'on' : ''}" data-op="ppe:${p.id}">${st.ppe[p.id] ? ICON.check : ICON.shield}${p.name}</button>`).join('')}</div></section>
    <button type="button" class="btn ${st.power ? 'on-green' : ''}" data-op="power">${ICON.bolt}${st.power ? 'الماكينة شغالة' : 'شغّل الماكينة'}</button>`;
};
S.operateAction = (op, el, ctx) => {
  if (op.startsWith('dia:')) st.dia = +op.slice(4);
  else if (op === 'cur-' || op === 'cur+') st.current = THREE.MathUtils.clamp(st.current + (op === 'cur+' ? 5 : -5), 40, 200);
  else if (op === 'range:current') { st.current = +el.value; updateMachine(); clearTimeout(S._t); S._t = setTimeout(() => ctx.renderPanel(), 140); return; }
  else if (op.startsWith('ppe:')) { const k = op.slice(4); st.ppe[k] = !st.ppe[k]; ctx.audio.click(); }
  else if (op === 'power') { setPower(!st.power); ctx.audio.click(); }
  updateMachine(); ctx.renderPanel();
};
S.operateReady = () => {
  const ok = status()[0] === 'ok', ppe = PPE.every(p => st.ppe[p.id]);
  return { ok: ok && ppe && st.power, label: ok && ppe && st.power ? 'ابدأ اللحام' : !ppe ? 'البس مهمات الوقاية الأول' : !st.power ? 'شغّل الماكينة الأول' : 'اظبط التيار الأول' };
};

// ---------------- weld
S.weldSettings = () => ({ dia: st.dia, current: st.current });
S.weldProc = () => {
  const d = st.dia, [lo, hi] = RANGE[d];
  return {
    kind: 'arc', distName: 'طول القوس', angleName: 'زاوية القطب', settingName: 'ضبط التيار',
    ideal: { angle: [65, 80], speed: [2.5, 4.5], dist: [d * 0.8, d * 1.35] },
    strikeBelow: 4, stickBelow: 0.6, breakAbove: 9,
    stickMsg: 'القطب لزق في الشغلانة! القوس قصير جداً. ارفع صباعك وابدأ تاني.',
    breakMsg: 'القوس اتقطع لأنه طويل جداً. قرّب القطب من الشغلانة.',
    pauseMsg: 'وقفت القوس. المس تاني وكمّل من آخر نقطة.',
    consumable: { len: 0.35, min: 0.05, rate: s => (s.current / 120) * 4.2 * (d === 2.5 ? 1.25 : d === 4 ? 0.8 : 1) / 1000, name: 'القطب', newName: 'قطب جديد', outMsg: 'القطب خلص. غيّر القطب وكمّل.', newMsg: 'ركّبت قطب جديد. كمّل من آخر نقطة.' },
    slag: true, spacing: 0.0011, distPerMM: 0.3, arcColor: 0xffffff,
    dims: s => {
      const heat = THREE.MathUtils.clamp((s.settings.current - lo) / (hi - lo), -0.6, 1.6);
      const sp = THREE.MathUtils.clamp(s.speed || 3.4, 0.8, 12);
      let w = d * 2.6 * (0.85 + heat * 0.25) * Math.pow(3.4 / sp, 0.45) * (1 + Math.max(0, s.dist - d * 1.3) * 0.06);
      let h = 1.9 * Math.pow(3.4 / sp, 0.55) * (1.15 - heat * 0.18) * (1 - Math.max(0, s.dist - d * 1.3) * 0.04);
      return { w: THREE.MathUtils.clamp(w, 3.5, 16), h: THREE.MathUtils.clamp(h, 0.5, 4.2), wobble: 1 + Math.max(0, s.dist - 4) * 0.4 };
    },
    flags: s => ({ spatter: (s.dist > d * 1.45 || s.settings.current > hi) ? 0.55 : 0, pore: s.dist > d * 1.7 ? 0.18 : 0, undercut: (s.speed > 5.5 || s.settings.current > hi + 5) ? 0.7 : 0 }),
    sparks: s => 90 + (s.settings.current - lo) * 1.2 + Math.max(0, s.dist - d * 1.2) * 60,
    poolMM: s => d * 1.6 + (s.settings.current - 100) * 0.015,
    settingScore: set => ({ v: set.current >= lo && set.current <= hi ? 100 : Math.max(30, 100 - (set.current < lo ? lo - set.current : set.current - hi) * 2.2) }),
    penetration: set => THREE.MathUtils.clamp(((set.current - lo) / (hi - lo)) * 0.6 + 0.6, 0.2, 1.3),
    defects: c => {
      const out = [], cur = c.settings.current;
      if (c.count('fast') || cur > hi + 5) out.push({ name: 'تآكل الحواف', en: 'Undercut', cause: cur > hi + 5 ? 'التيار أعلى من المدى المناسب.' : 'سرعة تقدّم عالية في ' + c.AR(c.count('fast')) + ' منطقة.', fix: 'بطّأ الحركة، وقلّل التيار لو عالي، وخلّي القطب يملا الحواف.' });
      if (c.count('slow')) out.push({ name: 'خط عالي وعريض (تراكب)', en: 'Overlap', cause: 'الحركة بطيئة زيادة فالمعدن اتكوّم.', fix: 'زوّد سرعة التقدّم بانتظام.' });
      if (c.count('long') || c.sim.spatter.count > 20) out.push({ name: 'رذاذ', en: 'Spatter', cause: 'القوس طويل' + (cur > hi ? ' والتيار عالي.' : '.'), fix: 'خلّي طول القوس قريب من قطر القطب (حوالي ' + d + ' مم).' });
      if (c.sim.pores.count > 2) out.push({ name: 'مسامية', en: 'Porosity', cause: 'القوس طويل جداً فالغاز الواقي ماقدرش يحمي المنصهر.', fix: 'قصّر القوس وحافظ عليه ثابت.' });
      if (cur < lo || c.count('short')) out.push({ name: 'نقص الاندماج', en: 'Lack of fusion', cause: cur < lo ? 'التيار أقل من المدى المناسب.' : 'القوس قصير جداً.', fix: 'اظبط التيار في المدى المناسب وحافظ على طول القوس.' });
      if (c.events.stuck) out.push({ name: 'التصاق القطب', en: 'Electrode sticking', cause: 'القطب لزق ' + c.AR(c.events.stuck) + ' مرة.', fix: 'بعد القدح ارفع القطب بسرعة لطول القوس الصحيح.' });
      return out;
    },
    hint: 'المس الدايرة البرتقالي عند بداية الوصلة وحرّك صباعك ببطء لليمين. فوق الخط الأخضر = قوس أطول، تحته = أقصر.'
  };
};
S.hud = ctx => {
  const d = st.dia, [lo, hi] = RANGE[d], w = ctx.state.weld, sim = ctx.sim;
  return [
    { id: 'angle', label: 'زاوية القطب', hint: '65–80°', get: () => ({ val: ctx.state.angle, txt: ctx.state.angle + '°', min: 30, max: 90, lo: 65, hi: 80 }) },
    { id: 'speed', label: 'سرعة التقدّم', hint: '2.5–4.5 mm/s', get: o => ({ val: sim.on ? o.speed : null, txt: sim.on ? o.speed.toFixed(1) : '--', min: 0, max: 9, lo: 2.5, hi: 4.5 }) },
    { id: 'dist', label: 'طول القوس', hint: '≈ قطر القطب (' + d + ' مم)', get: () => ({ val: w.pressing ? w.eff : null, txt: w.pressing ? (w.eff ?? 0).toFixed(1) + ' mm' : '--', min: 0, max: 9, lo: d * 0.8, hi: d * 1.35 }) },
    { id: 'cur', label: 'شدة التيار', hint: lo + '–' + hi + ' A', bar: false, get: () => ({ txt: st.current + ' A' }) }
  ];
};
S.coach = (ctx, o) => {
  const d = st.dia, w = ctx.state.weld, a = ctx.state.angle;
  if (o.speed > 5.3) return 'سرعتك عالية، بطّأ حركة إيدك';
  if (o.speed < 1.7 && ctx.sim.time > 1) return 'سرعتك بطيئة، حرّك أسرع شوية';
  if (w.eff > d * 1.35 + 0.4) return 'القوس طويل، قرّب القطب';
  if (w.eff < d * 0.8 - 0.3) return 'القوس قصير، ارفع القطب شوية';
  if (a < 62 || a > 83) return 'اظبط زاوية القطب بين ٦٥ و٨٠ درجة';
  return null;
};
let tick = 0;
S.weldEnter = ctx => { if (!st.power) setPower(true); electrode.userData.setLength(0.35); ctx.resetTip(JOINT.x0 - 0.02, JOINT.y + 0.03); };
S.weldPose = (ctx, tip, dt) => {
  const tilt = THREE.MathUtils.degToRad(90 - ctx.state.angle), side = THREE.MathUtils.degToRad(12);
  const dir = V3(Math.sin(tilt), Math.cos(tilt) * Math.cos(side), Math.cos(tilt) * Math.sin(side)).normalize();
  const L = ctx.sim.consumable;
  electrode.userData.setLength(L);
  holder.quaternion.setFromUnitVectors(V3(1, 0, 0), dir.clone().negate());
  holder.position.copy(tip).addScaledVector(dir, 0.035 + L);
  electrode.userData.setHot(ctx.sim.on ? 1 : 0);
  if ((tick++ & 1) === 0) updateCables(true);
};
S.weldExit = () => { apply(holder, POSE.holderRest); electrode.userData.setHot(0); updateCables(); };
S.inspectEnter = ctx => { apply(holder, POSE.holderRest); electrode.userData.setLength(ctx.sim.consumable || 0.35); updateCables(); };

export default S;
