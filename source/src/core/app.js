// App controller: stations, stages, panels, weld input. Station modules plug in through a common interface.
import * as THREE from 'three';
import { createEngine, V3, ease } from './engine.js';
import { WeldSim, WEAVE } from './weldsim.js';
import { makeMaterials, buildRoom, buildTable, buildPlates, TABLE_Y, JOINT } from '../models.js';
import { ArcAudio } from '../audio.js';
import { AR } from '../data.js';
import { ICON } from './icons.js';
import { Voice } from './voice.js';
import { runIntro, WELCOME } from '../intro.js';
import { createCleaning } from './cleaning.js';
import { createFitup } from './fitup.js';
import { createAmbience } from '../ambience.js';
import { HUB, INTRO } from '../voicescript.js';
import { buildChippingHammer, buildWireBrush } from '../ppe.js';
import { Textures } from '../textures.js';

const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('weldlab.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('weldlab.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};

export function startApp(STATIONS) {
  const viewport = $('#viewport');
  // every welding station gets a fit-up stage (choose the exercise, clean, tack with the machine, mount) after the machine is set up
  STATIONS.forEach(st => { if (st.stages && st.stages.some(x => x[0] === 'weld') && !st.stages.some(x => x[0] === 'fitup')) { st.stages.splice(st.stages.findIndex(x => x[0] === 'weld'), 0, ['fitup', 'جهّز الوصلة']); } });
  const E = createEngine(viewport);
  const audio = new ArcAudio();
  const intro = runIntro();
  const voice = new Voice({ getCtx: () => { audio.ensure(); return audio.ctx; } });
  voice.enabled = store.get('voice', true);
  const state = {
    station: null, stage: 'hub', done: store.get('done2', {}),
    explore: { sel: 0, labels: false, exploded: false },
    asm: { step: 0, picked: null, msg: null },
    lens: true, assist: store.get('level', 'beg') !== 'adv', level: store.get('level', 'beg'), angle: 72, sound: true, control: store.get('control', (E.isMobile || matchMedia('(pointer: coarse)').matches) ? 'sticks' : 'direct'),
    weld: { pressing: false, x: JOINT.x0, dist: 20, aux: false },
    report: null, showDef: false, drawer: true, op: {}, voice: voice.enabled
  };
  let clean = null, fitup = null, ambience = null, M, sim, plates, hammer, brush, platesOpts = '', booted = false, camFill = null;
  const shared = {};

  const ctx = {
    E, THREE, state, audio, store, AR, V3, ease, $, get M() { return M; }, get sim() { return sim; }, shared,
    toast: (t, s) => showToast(t, s), renderPanel: () => renderPanel(), renderHUD: () => renderHUD(),
    asmMsg: (t, s) => { state.asm.msg = { t, s }; renderPanel(); if (t === 'bad') audio.sfx('err'); voice.say(s); },
    next: msg => asmNext(msg), markDone: k => markDone(k),
    setPlates: opts => setPlates(opts), joint: JOINT, TABLE_Y,
    say: (t, kind) => voice.say(t, kind === 'low' ? 'low' : 'normal'), voice
  };

  // ---------------------------------------------------------------- build
  async function build() {
    try { await Promise.all(['600 34px "IBM Plex Mono"', '600 26px "IBM Plex Sans Arabic"'].map(f => document.fonts.load(f))); } catch (e) { /* optional */ }
    M = makeMaterials();
    ambience = createAmbience(E.scene, buildRoom(E.scene), E);
    E.scene.add(buildTable(M));
    hammer = buildChippingHammer(); hammer.position.set(0.7, TABLE_Y, -0.17); hammer.rotation.y = 0.5; E.scene.add(hammer);
    brush = buildWireBrush(); brush.position.set(0.02, TABLE_Y, -0.2); brush.rotation.y = -0.3; E.scene.add(brush);
    hammer.traverse(o => { if (o.isMesh) o.castShadow = true; });
    hammer.userData.pick = 'hammer'; brush.userData.pick = 'brush';
    shared.hammer = hammer; shared.brush = brush;
    setPlates({ t: 0.006, kind: 'butt' });
    fitup = createFitup({ E, audio, toast: (t, m) => showToast(t, m), say: t => voice.say(t) });
    fitup.posFrame.add(plates);
    sim = new WeldSim(E.scene); fitup.jointFrame.add(sim.group);
    // a soft light from the trainee's eyes (like a helmet/work lamp) so the bead's ripples read in every position
    if (!E.camera.parent) E.scene.add(E.camera);
    camFill = new THREE.DirectionalLight(0xfff1dc, 0); camFill.position.set(0.15, 0.25, 0.2); camFill.target.position.set(0, -0.05, -1);
    E.camera.add(camFill, camFill.target);
    clean = createCleaning({ E, audio, sim, hammer, brush, onChange: onClean, workFrame: fitup.posFrame });
    for (const S of STATIONS) {
      if (!S.ready) continue;
      S.root = new THREE.Group(); S.root.visible = false; E.scene.add(S.root);
      S.build(ctx);
    }
    E.onResize = () => { applyViewOffset(); if (state.stage === 'weld' && !E.tweening()) { const c = weldCamera(); E.camera.position.copy(c.pos); E.controls.target.copy(c.target); } };
  }
  function setPlates(opts) {
    // the chosen fit-up exercise decides the plates (except the single plate used for cutting)
    if (fitup && opts.kind !== 'single' && state.station && fitup.st.byStation[state.station]) opts = fitup.plateOpts(state.station);
    const key = JSON.stringify(opts);
    if (key === platesOpts) return;
    platesOpts = key;
    if (plates) { plates.parent && plates.parent.remove(plates); plates.traverse(o => o.geometry && o.geometry.dispose()); }
    plates = buildPlates(M, opts); plates.userData.pick = 'plates'; (fitup ? fitup.posFrame : E.scene).add(plates);
    if (clean) clean.freshRust();   // a new piece arrives with fresh mill scale / rust on its joint faces
    shared.plates = plates;
  }

  const S = () => STATIONS.find(s => s.id === state.station);
  function pickables() { const s = S(); return (s ? s.pickables() : []).concat([plates, hammer, brush]); }
  function markDone(k) { const id = state.station; (state.done[id] = state.done[id] || {})[k] = true; store.set('done2', state.done); }

  // ---------------------------------------------------------------- stage flow
  function enterStation(id) {
    STATIONS.forEach(s => { if (s.root) s.root.visible = s.id === id; });
    state.station = id; ambience && ambience(id);
    if (fitup) { fitup.unmount(id, false); fitup.reset(); }
    if (clean) clean.freshRust();
    state.explore = { sel: 0, labels: false, exploded: false };
    state.op = {};
    const s = S();
    if (shared.plates) shared.plates.visible = true;
    s.enter && s.enter(ctx);
    // establishing shot: start wide so the student sees this corner of the workshop, then the camera flies in
    E.camera.position.set(2.4, 2.0, 3.3); E.controls.target.set(0.1, 0.95, -0.4); E.controls.update();
    goStage(s.stages[0][0]);
  }
  function goHub() {
    leaveStage();
    state.stage = 'hub';
    document.body.dataset.stage = 'hub';
    STATIONS.forEach(s => { if (s.root) s.root.visible = s.id === (state.station || 'smaw'); });
    ambience && ambience(state.station || 'smaw');
    E.controls.enabled = true; E.controls.autoRotate = true; E.controls.autoRotateSpeed = 0.45;
    E.setHighlight([]);
    renderAll();
    E.flyTo(V3(1.7, 1.85, 2.5), V3(0.15, 1.1, -0.4), 1.2);
    if (booted) voice.say(HUB);
  }
  function leaveStage() {
    const s = S(), prev = state.stage;
    if (prev === 'weld') { audio.update(false); $('#lens').classList.remove('on'); E.renderer.toneMappingExposure = 1.12; sim.setVisible(false); s && s.weldExit && s.weldExit(ctx); }
    if (prev === 'explore' && explodeK > 0) resetExplode();
    if (assist) { assist.visible = false; assist.userData.ring.visible = false; }
    $('#coach').classList.remove('on');
    if (hold) releaseHold(true);
    if (clean) clean.stop(); renderClean();
    showDefects(false);
  }
  function goStage(st) {
    const s = S();
    leaveStage();
    const prev = state.stage;
    state.stage = st;
    document.body.dataset.stage = st;
    E.controls.enabled = st !== 'weld';
    E.controls.autoRotate = false;
    E.setHighlight([]);
    state.asm.msg = null;
    if (fitup && st !== 'weld' && st !== 'operate' && st !== 'fitup' && st !== 'inspect') fitup.unmount(state.station, false);
    if (st === 'explore') { s.setAssembled(true); selectPart(state.explore.sel, false); }
    if (st === 'fitup') fitupEnter();
    if (st === 'assemble') { state.asm = { step: 0, picked: null, msg: null, busy: false }; s.setAssembled(false); s.asmStart && s.asmStart(ctx); highlightAsm(); }
    if (st === 'operate') { s.setAssembled(true); s.operateEnter && s.operateEnter(ctx); }
    if (st === 'weld') {
      s.setAssembled(true);
      const proc = s.weldProc(ctx);
      sim.configure(proc, s.weldSettings(ctx));
      state.report = null; state.showDef = false;
      state.weld = { pressing: false, x: JOINT.x0 - 0.02, dist: 25, aux: false, rel: null };
      s.weldEnter && s.weldEnter(ctx);
      setAssist(state.assist);
      const fx = fitup.st, isCut = proc.kind === 'cut';
      if (isCut) fitup.unmount(state.station, false);
      else {
        // the weld is ALWAYS done in the chosen position: if the trainee skipped the fit-up steps, the piece is tacked
        // and mounted in the positioner for him (unclean edges still cost porosity)
        if (!fx.done) { fx.tacks = [true, true, true]; fx.done = true; fx.cleaned = fx.cleanDone ? fx.cleaned : clean.cleanFrac(); const P = fitup.POS[fitup.cur(state.station).pos]; setTimeout(() => showToast('info', 'تم تثبيت القطعة بالمشبك في وضع ' + P.name + '. ' + (fx.cleaned < 0.8 ? 'لم تنظّف الحواف من الصدأ، فقد تظهر مسامية.' : '')), 400); }
        if (!fx.mounted || fitup.st.k < 1) fitup.mount(state.station, false);
        syncTacks();
      }
      state.prep = { clean: isCut ? 1 : fx.done ? fx.cleaned : 0, done: isCut || fx.done };
      const ex = isCut ? null : fitup.cur(state.station);
      sim.gLocal = fitup.gravityLocal(); sim.exercise = fx.done ? ex : null;
      state.weave = 'none'; sim.weave = 'none';
      state.work = 0; state.workF = null; state.angleF = null; state.workIdeal = sim.exercise && sim.exercise.work != null ? sim.exercise.work : null;
      sim.dirty = Math.max(0, 0.85 - state.prep.clean);
      if (!state.prep.done) clean.start('pre');
      clean.showRust(!isCut && state.prep.clean < 0.97);   // whatever rust was left stays on the mounted piece
    }
    if (st === 'fitup') clean.showRust(!isCutTask());
    if (st !== 'weld' && st !== 'fitup' && clean) clean.showRust(false);
    E.controls.maxPolarAngle = st === 'weld' || st === 'inspect' || st === 'fitup' ? 2.7 : 1.52;   // overhead work is watched from below
    if (camFill) camFill.intensity = st === 'weld' ? 0.45 : st === 'inspect' || st === 'fitup' ? 0.55 : 0;
    E.poke(st === 'inspect' ? 9000 : 2500);
    if (st === 'inspect') {
      if (!state.report) state.report = sim.proc ? sim.evaluate() : null; s.inspectEnter && s.inspectEnter(ctx);
      state.showDef = false;
      if (state.report && !state.report.empty) {
        if (sim.proc.slag && sim.slagLeft() > 0.03) clean.start('chip');
        else if (sim.proc.sound === 'mig' && sim.brushedFrac() < 0.85) clean.start('post');
        else state.showDef = true;
      }
    }
    if (s.custom && s.custom[st] && s.custom[st].enter) s.custom[st].enter(ctx);
    renderAll();
    E.resize();
    const cam = st === 'weld' ? (clean.active ? cleanCamera() : weldCamera()) : st === 'inspect' ? (clean.active ? cleanCamera() : inspectCamera()) : st === 'fitup' ? fitupCamera() : s.cams[st]();
    renderClean(); if (st === 'fitup') renderTacks(); if (state.showDef) setTimeout(() => state.stage === 'inspect' && showDefects(true), 900);
    E.flyTo(cam.pos, cam.target, prev === st ? 0.01 : prev === 'hub' || !prev ? 2.2 : 1.2);
    const intro = INTRO[s.id] && INTRO[s.id][st];
    if (st === 'assemble') voice.say((intro ? intro + ' ' : '') + stepSpeech());
    else if (st === 'inspect' && state.report && !state.report.empty) voice.say('درجتك ' + state.report.total + ' من مئة. التقدير ' + state.report.grade + '. ' + (state.report.defects.length ? 'العيوب التي ظهرت: ' + state.report.defects.map(d => d.name).join('، ') + '.' : 'لا توجد عيوب واضحة، عمل نظيف.'));
    else if (intro) voice.say(intro);
  }
  function stepSpeech() { const s = S(), x = s.asmSteps && s.asmSteps[state.asm.step]; return x ? 'الخطوة ' + (state.asm.step + 1) + ': ' + x.title + '. ' + x.hint : 'انتهى التركيب. اضغط التالي.'; }
  // keep the 3D subject centred in the free area beside the open drawer
  function applyViewOffset() {
    const w = viewport.clientWidth, h = viewport.clientHeight, dr = $('#drawer');
    const open = state.drawer && state.stage !== 'weld' && w > 700 && h > 300 && !matchMedia('(orientation: portrait) and (max-width: 820px)').matches;
    if (open) { const dw = dr.offsetWidth + 12; E.camera.setViewOffset(w, h, dw / 2, 0, w, h); }
    else E.camera.clearViewOffset();
  }
  function renderAll() { renderTopbar(); renderPanel(); renderHotspots(); renderHUD(); applyViewOffset(); }


  function weldCamera() {
    const c = weldCameraLocal(); if (!fitup) return c;
    fitup.posFrame.updateMatrixWorld(true);
    const W = fitup.W(), d = c.pos.distanceTo(c.target);
    const n = new THREE.Vector3(0, 1, 0).transformDirection(W);   // outward normal of the joint (bisector for fillets)
    c.target.applyMatrix4(W);
    let dir;
    if (n.y > 0.7) dir = new THREE.Vector3(0, 0.62, 0.78).transformDirection(fitup.posFrame.matrixWorld);   // flat: as before
    else {   // look INTO the joint along its open side, from the trainee's side; a little above unless the joint faces down
      dir = n.clone().multiplyScalar(0.8).add(V3(0, n.y > -0.3 ? 0.28 : 0, 0.55));
      if (dir.clone().normalize().dot(n) < 0.55) dir.lerp(n, 0.5);
      dir.normalize().add(V3(n.y < -0.3 ? 0.55 : 0.35, 0, 0));   // stand a little to the side so the electrode / torch never blocks the view (or the lens)
    }
    if (dir.y < 0 && c.target.y + dir.y * d < TABLE_Y + 0.03) dir.y = (TABLE_Y + 0.05 - c.target.y) / d;     // never under the bench top
    c.pos.copy(c.target).addScaledVector(dir.normalize(), d);
    return c;
  }
  function weldCameraLocal() {
    const aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
    const vf = THREE.MathUtils.degToRad(E.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const dist = Math.max(0.22, (0.25 / 2) / Math.tan(hf / 2));
    const t = V3(0.3, JOINT.y, JOINT.z - 0.004);
    return { pos: t.clone().addScaledVector(V3(0, 0.62, 0.78).normalize(), dist), target: t };
  }
  // ---------------------------------------------------------------- fit-up stage
  function fitupCamera() { return { pos: V3(0.36, JOINT.y + 0.33, JOINT.z + 0.36), target: V3(0.3, JOINT.y + 0.01, JOINT.z) }; }
  function fitupEnter() {
    const sid = state.station, s = S();
    if (!fitup.st.byStation[sid]) fitup.select(sid, fitup.list(sid)[0].id);
    fitup.unmount(sid, false); setPlates({ kind: 'butt' }); fitup.apply(fitup.cur(sid), 0);
    s.onExercise && s.onExercise(fitup.cur(sid), ctx);
    renderTacks();
  }
  function isCutTask() { const s = S(); return s.id === 'oaw' && s.weldSettings && s.weldSettings(ctx).task === 'cut'; }
  function fitupHTML() {
    const sid = state.station, fx = fitup.st, ex = fitup.cur(sid);
    if (isCutTask()) return `<section class="card"><h3 class="sm">القطع لا يحتاج تجهيز وصلة</h3><p class="muted small">في القطع نستخدم لوحًا واحدًا عليه خط القطع. اختر «لحام» في مرحلة الضبط لتجهيز وصلة.</p></section><button type="button" class="btn primary big" data-go="operate" data-mark="fitup">التالي ${ICON.next}</button>`;
    const steps = [[!!fx.cleanDone, 'نظّف حواف الوصلة بالفرشاة'], [fx.tacks.every(Boolean), 'نقّط القطعتين بماكينة اللحام: الطرفان ثم المنتصف'], [fx.mounted, 'ثبّت القطعة في وضع اللحام']];
    const next = steps.findIndex(x => !x[0]), ready = S().operateReady(ctx).ok, TN = ['الطرف الأول', 'الطرف الثاني', 'المنتصف'];
    const tackUI = !ready ? `<div class="msg bad" role="status">${ICON.x}<span>التنقيط يتم بماكينة اللحام نفسها. شغّل الماكينة واضبطها أولًا.</span></div><button type="button" class="btn" data-go="operate">${ICON.reset}ارجع لضبط الماكينة</button>`
      : `<p class="small"><b>اضغط مطوّلًا</b> على كل دائرة برتقالية لتشعل قوسًا قصيرًا (حوالي ثانية) ثم ارفع إصبعك. ابدأ بالطرفين ثم المنتصف حتى لا تتحرك القطعتان.</p>
        <div class="row3">${[0, 1, 2].map(i => `<button type="button" class="btn sm ${fx.tacks[i] ? 'on-green' : ''}" data-act="tack:${i}" title="تنقيط تلقائي">${fx.tacks[i] ? ICON.check : ''}${TN[i]}${fx.tackQ && fx.tackQ[i] === 'big' ? ' (كبيرة)' : ''}</button>`).join('')}</div>`;
    return `<section class="card"><h3 class="sm">اختر التمرين</h3><div class="ex-list">${fitup.list(sid).map(e => `<button type="button" class="ex ${e.id === ex.id ? 'on' : ''}" data-act="ex:${e.id}"><b>${e.name}</b><span>${e.ship}</span><i>${fitup.JOINT_NAME[e.kind]} • ${e.t === e.t2 ? e.t + ' مم' : e.t + ' + ' + e.t2 + ' مم'} • ${fitup.POS[e.pos].name}</i></button>`).join('')}</div></section>
      <section class="card"><h3 class="sm">خطوات التجهيز</h3><ol class="steps">${steps.map(([ok, t], i) => `<li class="${ok ? 'done' : i === next ? 'cur' : ''}"><i>${ok ? ICON.check : AR(i + 1)}</i><span>${t}</span></li>`).join('')}</ol>
        ${next === 0 ? `<button type="button" class="btn primary" data-act="fit-clean">${ICON.hand}ابدأ التنظيف بالفرشاة</button>` : next === 1 ? tackUI : next === 2 ? `<button type="button" class="btn primary" data-act="fit-mount">${ICON.target}ثبّت في وضع ${fitup.POS[ex.pos].name}</button>` : ''}
        <p class="small">${fitup.POS_TIP[ex.pos]}${ex.work != null && ex.work > 0 ? ' وجّه الأداة نحو اللوح الأسمك بزاوية عمل حوالي ' + AR(ex.work) + '° حتى تنصهر حافتاه بالتساوي.' : ''}</p></section>
      <button type="button" class="btn primary big" data-go="weld" data-mark="fitup" ${fx.mounted ? '' : 'disabled'}>ابدأ اللحام ${ICON.next}</button>`;
  }
  const tackLayer = $('#tacks');
  const TACK_X = () => [JOINT.x0 + 0.006, JOINT.x1 - 0.006, (JOINT.x0 + JOINT.x1) / 2];
  // the plates' ready-made tacks are only shown when the trainee skipped tacking (then they were done for him);
  // tacks he made himself replace them, and before tacking there are none
  function syncTacks() {
    if (!plates || !fitup) return; const fx = fitup.st, mine = (fx.tackQ || []).some(Boolean);
    plates.children.forEach(o => { if (o.userData.tack0) o.visible = fx.tacks.every(Boolean) && !mine; if (o.userData.tack && !fx.tacks.some(Boolean) && !(tack && tack.m === o)) { plates.remove(o); o.geometry.dispose(); } });
  }
  function renderTacks() {
    syncTacks();
    [...document.querySelectorAll('.tackpt')].forEach(b => b.remove());
    if (state.stage !== 'fitup' || isCutTask() || !fitup.st.cleanDone || fitup.st.tacks.every(Boolean)) return;
    const ready = S().operateReady(ctx).ok;
    TACK_X().forEach((x, i) => {
      if (fitup.st.tacks[i]) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tackpt' + (ready ? '' : ' off'); b.dataset.ti = i; b.setAttribute('aria-label', 'نقطة تكميل ' + (i + 1) + ': اضغط مطوّلًا'); b._x = x;
      b.innerHTML = '<i></i>'; tackLayer.appendChild(b);
    });
  }
  function updateTacks() {
    const els = document.querySelectorAll('.tackpt'); if (!els.length) return;
    const w = viewport.clientWidth, h = viewport.clientHeight;
    els.forEach(b => { _dp.set(b._x, JOINT.y + 0.002, JOINT.z + 0.002); _dp.project(E.camera); b.style.transform = `translate(${(_dp.x * 0.5 + 0.5) * w}px, ${(-_dp.y * 0.5 + 0.5) * h}px)`; });
  }
  // ---- tack welding with the machine: press and hold on a tack point = a short arc; the tack grows while the arc burns
  let tack = null, tackFx = null;
  function tackVisual() {
    if (tackFx) return tackFx;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: Textures.glowSprite(), color: 0xd6ecff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    const li = new THREE.PointLight(0xbfe0ff, 0, 0.9, 1.6); sp.visible = false; fitup.posFrame.add(sp, li);
    return (tackFx = { sp, li });
  }
  function startTack(i, ts) {
    const fx = fitup.st; if (tack || fx.tacks[i] || state.stage !== 'fitup') return;
    const s = S(); if (!s.operateReady(ctx).ok) { showToast('bad', 'التنقيط يتم بماكينة اللحام. شغّل الماكينة واضبطها أولًا.'); return; }
    if (i === 2 && !(fx.tacks[0] && fx.tacks[1]) && fx.tackOrder !== false) { fx.tackOrder = false; showToast('bad', 'الأصح أن تنقّط الطرفين أولًا ثم المنتصف؛ وإلا قد تتحرك القطعتان وتضيق الفتحة.'); }
    const proc = s.weldProc(ctx), x = TACK_X()[i], gas = proc.sound === 'flame';
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.005, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.55, metalness: 0.8, emissive: 0xff7a1a, emissiveIntensity: 2.4 }));
    m.scale.setScalar(0.001); m.userData.tack = true; m.position.set(x, JOINT.y + 0.001, JOINT.z + (JOINT.kind === 'butt' ? 0 : 0.0018)); plates.add(m);
    const v = tackVisual(); v.sp.visible = true; v.sp.material.color.set(gas ? 0xffb070 : 0xd6ecff); v.sp.position.set(x, JOINT.y + 0.004, JOINT.z + 0.002); v.li.position.copy(v.sp.position);
    tack = { i, t: 0, t0: ts ?? performance.now(), m, gas, sound: proc.sound, shade: proc.lensShade || 'arc' };
    audio.ensure(); if (state.lens !== false) { $('#lens').dataset.shade = tack.shade; $('#lens').classList.add('on'); }
    E.always = true;
  }
  function tackFrame(dt) {
    if (!tack) return;
    tack.t = (performance.now() - tack.t0) / 1000; const k = Math.min(1.7, tack.t / 1.1), fl = 0.7 + Math.random() * 0.6, v = tackVisual();
    tack.m.scale.set(1.3 * k, 0.5 * k, 0.95 * k);
    v.sp.scale.setScalar((tack.gas ? 0.03 : 0.05) * fl); v.li.intensity = (tack.gas ? 0.25 : 0.6) * fl;
    audio.update(true, 1, tack.sound);
    if (!tack.gas && sim) sim.emitSparks(Math.round(40 * dt + Math.random() * 0.6), tack.m.position.x, JOINT.y, 'up');
    if (tack.t > 3.2 && !tack.auto) endTack();   // nobody holds a tack that long: stop it for him
  }
  function endTack(ts) {
    if (!tack) return;
    const T = tack, fx = fitup.st, v = tackVisual(); tack = null; T.t = ((ts ?? performance.now()) - T.t0) / 1000;   // real time the finger was held (event timestamps, not frame time)
    T.m.scale.set(1.3 * Math.min(1.7, T.t / 1.1), 0.5 * Math.min(1.7, T.t / 1.1), 0.95 * Math.min(1.7, T.t / 1.1));
    v.sp.visible = false; v.li.intensity = 0; audio.update(false); $('#lens').classList.remove('on');
    fx.tackQ = fx.tackQ || [null, null, null];
    if (T.t < 0.55) {   // too short: a cold, weak tack that would crack — remove it, do it again
      E.tween(0.6, k => { T.m.material.emissiveIntensity = 2.4 * (1 - k); }, () => { plates.remove(T.m); T.m.geometry.dispose(); });
      showToast('bad', 'النقطة قصيرة جدًا فخرجت باردة وضعيفة وقد تنكسر. أعد التنقيط واضغط حوالي ثانية.'); audio.sfx('err'); renderTacks(); return;
    }
    fx.tacks[T.i] = true; fx.tackQ[T.i] = T.t > 2.3 ? 'big' : 'ok'; audio.sfx('chip');
    E.tween(1.6, k => { T.m.material.emissiveIntensity = 2.4 * (1 - k); });
    if (fx.tackQ[T.i] === 'big') showToast('bad', 'النقطة كبيرة جدًا وبارزة، وستعيق خط اللحام فوقها. النقطة الجيدة صغيرة: ثانية إلى ثانيتين فقط.');
    renderTacks(); renderPanel();
    if (fx.tacks.every(Boolean)) showToast('good', 'تم تنقيط القطعتين' + (fx.tackOrder === false ? '، لكن تذكّر: الطرفان أولًا ثم المنتصف.' : ' بالترتيب الصحيح.') + ' الآن ثبّتها في وضع اللحام.');
  }
  // panel buttons: a correct tack done for him (accessibility / quick demo)
  function doTack(i) { if (tack || fitup.st.tacks[i]) return; startTack(i); if (tack) { tack.auto = true; const t0 = tack.t0; setTimeout(() => tack && tack.i === i && endTack(t0 + 1100), 1100); } }   // a correct ~1 s tack, whatever the timer delay
  window.addEventListener('pointerdown', ev => { const b = ev.target.closest && ev.target.closest('.tackpt'); if (!b) return; ev.preventDefault(); try { b.setPointerCapture(ev.pointerId); } catch (e) { /* */ } startTack(+b.dataset.ti, ev.timeStamp); });
  ['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, ev => { if (tack) endTack(ev.timeStamp); }));
  function cleanCamera() { return { pos: V3(0.3, JOINT.y + 0.27, JOINT.z + 0.17), target: V3(0.3, JOINT.y, JOINT.z) }; }
  // ---- hands-on cleaning (wire brush before welding, chipping hammer + brush after)
  const CLEAN_TXT = {
    pre: ['نظّف مكان اللحام بالفرشاة السلكية', 'اسحب الفرشاة ذهابًا وإيابًا على حواف الوصلة حتى يختفي الصدأ ويظهر المعدن لامعًا.'],
    chip: ['أزل الخبث بمطرقة التكسير', 'اطرق على خط اللحام من بدايته إلى نهايته حتى يتكسر الخبث كله.'],
    post: ['نظّف خط اللحام بالفرشاة السلكية', 'اسحب الفرشاة على الخط لإزالة بقايا الخبث والرذاذ، ثم افحص العيوب.']
  };
  function renderClean() {
    const el = $('#clean-ui'); if (!el) return;
    const k = clean && clean.active ? clean.kind : null; el.hidden = !k; document.body.classList.toggle('cleaning', !!k);
    if (!k) return;
    const [t, h] = CLEAN_TXT[k], pr = Math.round(clean.prog * 100);
    el.innerHTML = `<div class="cl-ic">${k === 'chip' ? ICON.hammer : ICON.hand}</div><div class="cl-tx"><b>${t}</b><span>${h}</span><div class="bar" dir="ltr"><i style="width:${pr}%"></i></div></div><button type="button" class="btn sm" data-act="clean-skip">${k === 'pre' ? 'ابدأ اللحام دون تنظيف' : 'تخطَّ'}</button>`;
  }
  function onClean(e) {
    if (e.prog != null && !e.done) { const b = document.querySelector('#clean-ui .bar i'); if (b) b.style.width = Math.round(e.prog * 100) + '%'; return; }
    if (e.done === 'pre' && state.stage === 'fitup') {
      fitup.st.cleaned = clean.cleanFrac(); fitup.st.cleanDone = true;
      if (fitup.st.cleaned < 0.8) { showToast('bad', 'لم تُنظَّف الحواف جيدًا؛ قد تظهر مسامية في الخط.'); renderPanel(); renderTacks(); renderClean(); return; }
      showToast('good', 'الحواف نظيفة. الآن نقّط القطعتين بالماكينة: الطرفان ثم المنتصف.'); const c = fitupCamera(); E.flyTo(c.pos, c.target, 0.8); renderPanel(); renderTacks(); renderClean(); return;
    }
    if (e.done === 'pre') {
      state.prep = { clean: clean.cleanFrac(), done: true }; sim.dirty = Math.max(0, 0.85 - state.prep.clean);
      showToast(state.prep.clean > 0.8 ? 'good' : 'bad', state.prep.clean > 0.8 ? 'ممتاز، أصبح سطح الوصلة نظيفًا. الآن ابدأ اللحام.' : 'لم يُنظَّف السطح جيدًا؛ قد تظهر مسامية في الخط.');
      const c = weldCamera(); E.flyTo(c.pos, c.target, 0.8); E.controls.enabled = false;
    } else if (e.done === 'chip') {
      showToast('good', 'تمت إزالة الخبث. الآن نظّف الخط بالفرشاة.'); clean.start('post');
    } else if (e.done === 'post') {
      showToast('good', 'أصبح الخط نظيفًا. شاهد العيوب على الخط نفسه.'); state.showDef = true; const c = inspectCamera(); E.flyTo(c.pos, c.target, 0.8); setTimeout(() => showDefects(true), 700); renderPanel();
    }
    renderClean();
  }
  function inspectCamera() { return { pos: V3(0.3, JOINT.y + 0.24, 0.2), target: V3(0.3, JOINT.y, 0.05) }; }

  // ---------------------------------------------------------------- explore
  function partSpeech(p) { return p.name + '. ' + p.desc + (p.facts && p.facts.length ? ' ' + p.facts.join(' ') : '') + (p.safety ? ' تحذير: ' + p.safety : ''); }
  function selectPart(i, fly, speak = fly) {
    const s = S(); state.explore.sel = i;
    const p = s.parts[i];
    if (speak) voice.say(partSpeech(p));
    if (fly && canHold(p.id)) { renderPanel(); holdPart(s.partObject(p.id)); return; }
    E.setHighlight(s.partHighlight ? s.partHighlight(p.id) : [s.partObject(p.id)]);
    if (fly) {
      const a = s.partAnchor(p.id);
      const far = p.far ?? 0.5;
      const dir = p.view ? p.view.clone().normalize() : E.camera.position.clone().sub(E.controls.target).normalize();
      E.flyTo(a.clone().addScaledVector(dir, far), a, 0.9);
    }
    renderPanel();
  }
  let explodeBase = null, explodeK = 0;
  function setExploded(on) {
    const s = S();
    if (!explodeBase) explodeBase = s.explodeItems().map(it => ({ ...it, base: it.o.position.clone() }));
    const from = explodeK, to = on ? 1 : 0;
    E.tween(0.9, k => {
      explodeK = from + (to - from) * ease(k);
      explodeBase.forEach(it => it.o.position.copy(it.base).addScaledVector(it.d, explodeK));
      s.afterMove && s.afterMove(ctx);
    }, () => { if (!on) explodeBase = null; });
  }
  function resetExplode() { if (explodeBase) explodeBase.forEach(it => it.o.position.copy(it.base)); explodeK = 0; explodeBase = null; state.explore.exploded = false; const s = S(); s && s.afterMove && s.afterMove(ctx); }

  const hotLayer = $('#hotspots');
  function renderHotspots() {
    hotLayer.innerHTML = '';
    if (state.stage !== 'explore') return;
    S().parts.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'hot'; b.type = 'button'; b.dataset.i = i; b.setAttribute('aria-label', p.name);
      b.innerHTML = `<span class="n">${AR(i + 1)}</span><span class="t">${p.name}</span>`;
      b.addEventListener('click', () => selectPart(i, true));
      hotLayer.appendChild(b);
    });
  }
  const _p = new THREE.Vector3();
  function updateHotspots() {
    if (state.stage !== 'explore') return;
    const s = S(), w = viewport.clientWidth, h = viewport.clientHeight;
    [...hotLayer.children].forEach(b => {
      const i = +b.dataset.i;
      _p.copy(s.partAnchor(s.parts[i].id)).project(E.camera);
      const vis = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
      b.style.display = vis ? '' : 'none';
      b.style.transform = `translate(${(_p.x * 0.5 + 0.5) * w}px, ${(-_p.y * 0.5 + 0.5) * h}px)`;
      b.classList.toggle('on', i === state.explore.sel);
      b.classList.toggle('lbl', state.explore.labels || i === state.explore.sel);
    });
  }


  // ---------------------------------------------------------------- hold & inspect (pick up a tool, turn it, put it back)
  const DEFAULT_HOLD = ['machine', 'cylinder', 'cylO', 'cylA', 'plates', 'drive', 'hammer', 'brush', 'holder', 'electrode', 'clamp', 'torch', 'lighter', 'goggles', 'rods', 'regO', 'regA', 'flow', 'spool', 'twin', 'gouge', 'carbon', 'tungsten', 'pedal', 'cutter'];
  function canHold(id) { const s = S(); return s && state.stage === 'explore' && (s.holdable ? s.holdable(id) : DEFAULT_HOLD.includes(id)) && !!(s.partObject && s.partObject(id) || id === 'hammer' || id === 'brush'); }
  let hold = null;
  const holdScene = new THREE.Scene();
  holdScene.environment = E.scene.environment;
  holdScene.add(new THREE.HemisphereLight(0xdfe8f5, 0x3a3028, 0.75));
  const hKey = new THREE.DirectionalLight(0xfff2e0, 1.7); hKey.position.set(1, 2, 2); holdScene.add(hKey);
  const hRim = new THREE.DirectionalLight(0x9cc4ff, 1.4); hRim.position.set(-2, 1, -2); holdScene.add(hRim);
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x07090c, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  const dimScene = new THREE.Scene(); dimScene.add(dim);
  E.overlay = holdScene; E.overlayBg = dimScene;
  function holdPart(obj) {
    if (!obj || !obj.isObject3D) return;
    if (hold) { if (hold.obj === obj) return; releaseHold(true); }
    E.setHighlight([]);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.position.copy(center);
    const clone = obj.clone(true);
    obj.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    clone.position.sub(center);
    pivot.add(clone); holdScene.add(pivot);
    obj.visible = false;
    const cam = E.camera, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const dist = 0.5, fitH = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * dist * 0.62;
    const sc = fitH / Math.max(size.x, size.y, size.z, 0.02);
    hold = { obj, pivot, center, size, dist, scale: sc, zoom: 1, spin: true, idle: 0, vx: 0, vy: 0, ptrs: new Map(), ready: false };
    const p0 = center.clone(), q0 = new THREE.Quaternion(), target = () => cam.position.clone().addScaledVector(dir, dist);
    const qT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.6).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.25));
    E.controls.enabled = false;
    audio.sfx('lift');
    E.tween(0.75, k => {
      const e = ease(k);
      pivot.position.lerpVectors(p0, target(), e); pivot.position.y += Math.sin(Math.PI * e) * 0.06;
      pivot.scale.setScalar(1 + (sc - 1) * e); pivot.quaternion.slerpQuaternions(q0, qT, e);
      dim.material.opacity = 0.86 * e;
    }, () => { hold && (hold.ready = true); });
    renderHoldUI();
  }
  function releaseHold(instant) {
    if (!hold) return;
    const h = hold; hold = null;
    const finish = () => { holdScene.remove(h.pivot); h.obj.visible = true; dim.material.opacity = 0; if (state.stage !== 'weld') E.controls.enabled = true; };
    renderHoldUI();
    if (instant) return finish();
    audio.sfx('place');
    const p0 = h.pivot.position.clone(), q0 = h.pivot.quaternion.clone(), s0 = h.pivot.scale.x, qI = new THREE.Quaternion();
    E.tween(0.7, k => {
      const e = ease(k);
      h.pivot.position.lerpVectors(p0, h.center, e); h.pivot.position.y += Math.sin(Math.PI * e) * 0.05;
      h.pivot.quaternion.slerpQuaternions(q0, qI, e); h.pivot.scale.setScalar(s0 + (1 - s0) * e);
      dim.material.opacity = 0.86 * (1 - e);
    }, finish);
  }
  function holdPointer(ev, phase) {
    const h = hold; if (!h) return;
    if (phase === 'down') { cv.setPointerCapture(ev.pointerId); h.ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); h.idle = 0; h.pinch = null; return; }
    const prev = h.ptrs.get(ev.pointerId); if (!prev) return;
    if (phase === 'up') { h.ptrs.delete(ev.pointerId); h.pinch = null; return; }
    if (h.ptrs.size >= 2) {
      h.ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const [a, b] = [...h.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (h.pinch) h.zoom = THREE.MathUtils.clamp(h.zoom * d / h.pinch, 0.55, 2.2);
      h.pinch = d; return;
    }
    const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
    h.ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    rotateHold(dx * 0.011, dy * 0.011); h.vx = dx * 0.011; h.vy = dy * 0.011; h.idle = 0; h.spin = false;
  }
  const _axY = new THREE.Vector3(0, 1, 0), _axR = new THREE.Vector3();
  function rotateHold(ax, ay) { _axR.setFromMatrixColumn(E.camera.matrixWorld, 0); hold.pivot.rotateOnWorldAxis(_axY, ax); hold.pivot.rotateOnWorldAxis(_axR, ay); }
  function holdFrame(dt) {
    const h = hold; if (!h) return;
    const cam = E.camera, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    // keep a dark backdrop between the room and the held tool
    dim.position.copy(cam.position).addScaledVector(dir, 0.15); dim.quaternion.copy(cam.quaternion); dim.scale.setScalar(2);
    if (!h.ready) return;
    h.pivot.position.copy(cam.position).addScaledVector(dir, h.dist);
    h.pivot.scale.setScalar(h.scale * h.zoom);
    if (!h.ptrs.size) {
      h.idle += dt;
      if (Math.abs(h.vx) + Math.abs(h.vy) > 0.0005) { rotateHold(h.vx, h.vy); h.vx *= 0.92; h.vy *= 0.92; }
      else if (h.spin || h.idle > 2.5) { h.spin = true; h.pivot.rotateOnWorldAxis(_axY, dt * 0.55); }
    }
  }
  function renderHoldUI() {
    const el = $('#hold-ui'); if (!el) return;
    el.hidden = !hold; hotLayer.style.visibility = hold ? 'hidden' : '';
    if (hold) { const s = S(), p = s && s.parts && s.parts[state.explore.sel]; $('#hold-name').textContent = p ? p.name : ''; }
  }

  // ---------------------------------------------------------------- assemble
  function highlightAsm() { const s = S(); E.setHighlight(s.asmTargets(state.asm.step, ctx)); const c = s.asmCam && s.asmCam(state.asm.step, ctx); if (c) E.flyTo(c.pos, c.target, 0.9); renderPanel(); }
  function asmNext(msg) {
    const s = S();
    state.asm.step++; state.asm.picked = null; state.asm.msg = { t: 'good', s: msg };
    if (state.asm.step >= s.asmSteps.length) markDone('assemble');
    audio.sfx('ok');
    highlightAsm();
    voice.say(msg + ' ' + stepSpeech());
  }

  // ---------------------------------------------------------------- picking / pointer
  let downAt = null;
  const cv = E.renderer.domElement;
  ['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach(t => window.addEventListener(t, () => E.poke(1200, t !== 'pointermove'), { passive: true }));
  ['click', 'input', 'change'].forEach(t => document.addEventListener(t, () => E.poke(900), true));
  cv.addEventListener('pointerdown', ev => {
    audio.ensure(); tryLandscape();
    if (hold) { holdPointer(ev, 'down'); return; }
    if (clean && clean.active) { clean.pointer(ev, 'down'); return; }
    downAt = { x: ev.clientX, y: ev.clientY };
    if (state.stage === 'weld' && state.control !== 'sticks') { cv.setPointerCapture(ev.pointerId); weldPointer(ev, 'down'); }
  });
  cv.addEventListener('pointermove', ev => { if (hold) { holdPointer(ev, 'move'); return; } if (clean && clean.active) { clean.pointer(ev, 'move'); return; } if (state.stage === 'weld' && state.weld.pressing) weldPointer(ev, 'move'); });
  cv.addEventListener('wheel', ev => { if (hold) { ev.preventDefault(); hold.zoom = THREE.MathUtils.clamp(hold.zoom * (ev.deltaY > 0 ? 0.92 : 1.08), 0.55, 2.2); } }, { passive: false });
  const up = ev => {
    if (hold) { holdPointer(ev, 'up'); return; }
    if (clean && clean.active) { clean.pointer(ev, 'up'); return; }
    if (state.stage === 'weld') { if (state.weld.pid === ev.pointerId) { state.weld.pressing = false; state.weld.rel = null; } return; }
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y); downAt = null;
    if (moved > 8 || ev.target !== cv) return;
    const r = E.pick(ev, pickables());
    if (r) onPick(r.id, r);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  function onPick(id, r) {
    const s = S(); if (!s) return;
    if (state.stage === 'explore') {
      const pid = (s.exploreMap && s.exploreMap[id]) || id;
      const i = s.parts.findIndex(p => p.id === pid);
      if (i >= 0) selectPart(i, true);
      else if (canHold(id)) holdPart(r.object);
    } else if (state.stage === 'assemble') { if (!state.asm.busy) s.asmPick(id, ctx, r); }
    else if (state.stage === 'operate') { s.operatePick && s.operatePick(id, ctx, r); }
    else if (s.custom && s.custom[state.stage] && s.custom[state.stage].pick) s.custom[state.stage].pick(id, ctx, r);
  }

  // ---------------------------------------------------------------- weld input
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function weldPointer(ev, phase) {
    const w = state.weld, proc = sim.proc;
    const k = proc.distPerMM ?? 0.42;
    if (phase === 'down') w.pid = ev.pointerId;
    if (state.control === 'rel') {
      // relative (trackpad-like) control: finger can be anywhere; torch moves by finger delta
      const pxPerM = viewport.clientWidth / 0.25;
      if (phase === 'down') {
        const startX = sim.progress > JOINT.x0 + 0.001 ? Math.min(sim.progress, JOINT.x1) : JOINT.x0;
        w.rel = { sx: ev.clientX, sy: ev.clientY, x0: startX, d0: w.lastDist ?? proc.idealStart ?? (proc.ideal.dist[0] + proc.ideal.dist[1]) / 2 };
        w.x = w.rel.x0; w.dist = w.rel.d0;
      } else if (w.rel) {
        const sens = 0.9;
        w.x = w.rel.x0 + ((ev.clientX - w.rel.sx) / pxPerM) * sens;
        w.dist = Math.max(0, w.rel.d0 - (ev.clientY - w.rel.sy) * (proc.relDistPerPx ?? 0.025));
      }
      w.lastDist = w.dist;
    } else {
      plane.constant = -JOINT.y;
      E.setRay(ev);
      const ray = E.ray.ray.clone(); if (fitup) ray.applyMatrix4(fitup.W().clone().invert());
      if (!ray.intersectPlane(plane, hit)) return;
      w.x = hit.x;
      w.dist = Math.max(0, (JOINT.z - hit.z) * 1000 * k);
    }
    w.pressing = true;
  }
  let tipPos = new THREE.Vector3();
  // ---- tools follow the work frame (positions + fillet joints) and the work angle (tilt around the joint axis)
  const _snap = new Map(), _qW = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
  const isIdentity = m => { const e = m.elements; return Math.abs(e[0] - 1) + Math.abs(e[5] - 1) + Math.abs(e[10] - 1) + Math.abs(e[12]) + Math.abs(e[13]) + Math.abs(e[14]) + Math.abs(e[1]) + Math.abs(e[2]) + Math.abs(e[4]) < 1e-6; };
  function snapTools(s) { _snap.clear(); s.root.children.forEach(o => _snap.set(o, [o.position.clone(), o.quaternion.clone()])); }
  let _fk = 0;
  function frameTools(s, W) {
    _qW.setFromRotationMatrix(W); _qa.setFromAxisAngle(_ax, -THREE.MathUtils.degToRad(state.work || 0));
    const pivot = V3(tipPos.x, JOINT.y, JOINT.z);
    s.root.children.forEach(o => {
      const p = _snap.get(o); if (!p || (p[0].equals(o.position) && p[1].equals(o.quaternion))) return;
      if (state.work) { o.position.sub(pivot).applyQuaternion(_qa).add(pivot); o.quaternion.premultiply(_qa); }
      o.position.applyMatrix4(W); o.quaternion.premultiply(_qW);
    });
    if ((_fk++ & 1) === 0 && s.afterMove) s.afterMove(ctx);
  }
  const LEVELS = { beg: 'مبتدئ', mid: 'متوسط', adv: 'متقدم' };
  const LEVEL_TIP = {
    beg: 'المستوى المبتدئ: الأداة تتحرك وحدها بالسرعة الصحيحة، وتتحكم أنت في المسافة فقط.',
    mid: 'المستوى المتوسط: تتحكم في الحركة والمسافة، مع مساعدة في تثبيت المسافة.',
    adv: 'المستوى المتقدم: تتحكم في كل شيء: الحركة والمسافة والزاوية، دون مساعدة.'
  };
  const CTRL_NAME = { sticks: 'تحكم بإصبعين', rel: 'تحكم دقيق', direct: 'تحكم مباشر' };
  const CTRL_TIP = {
    sticks: 'التحكم بإصبعين: الإبهام الأيسر للحركة على الخط، والإبهام الأيمن للمسافة.',
    rel: 'التحكم الدقيق: اسحب إصبعك في أي مكان، فتنتقل الحركة إلى الأداة بهدوء.',
    direct: 'التحكم المباشر: المس الخط نفسه.'
  };
  function weldFrame(dt) {
    const s = S(), w = state.weld;
    sticksFrame(dt);
    // smooth the finger input (removes touch jitter); in training mode keep the arc in a safe band
    const proc = sim.proc, mid = (proc.ideal.dist[0] + proc.ideal.dist[1]) / 2;
    if (!w.pressing) w.distS = null;
    w.distS = w.distS == null ? w.dist : w.distS + (w.dist - w.distS) * (1 - Math.pow(0.002, dt));
    let d = w.distS;
    if (state.assist && w.pressing) {
      d = d + (mid - d) * 0.35;
      const lo = (proc.stickBelow ?? 0) + 0.5, hi = proc.breakAbove != null ? proc.breakAbove - 1.5 : 1e9;
      if (sim.on) d = THREE.MathUtils.clamp(d, lo, hi);
    }
    w.eff = d;
    // beginner: torch travels by itself at the right speed (waits for heat in gas welding/cutting); filler/cutting O2 automatic
    if (state.level === 'beg' && w.pressing) {
      const pr = sim.proc, v = (pr.ideal.speed[0] + pr.ideal.speed[1]) / 2 * (WEAVE[sim.weave] || WEAVE.none).k, heatOK = !pr.heatNeed || sim.heatAt(w.autoX ?? w.x) >= pr.heatNeed;
      if (w.autoX == null) w.autoX = Math.max(JOINT.x0, Math.min(sim.progress, JOINT.x1));
      if (sim.on && heatOK) w.autoX += v / 1000 * dt;
      w.x = w.autoX;
      if (pr.aux && !w.auxHeld) w.aux = pr.kind === 'cut' ? heatOK : Math.sin(sim.time * 5.5) > 0.35;
    } else if (!w.pressing) w.autoX = null;
    if (state.level === 'mid' && w.pressing && sim.proc.fillerLen && !w.auxHeld) w.aux = Math.sin(sim.time * 5.5) > 0.35;
    if (state.workIdeal != null && state.level === 'beg') state.work = state.workIdeal;
    const out = sim.step({ pressing: w.pressing, x: w.x, dist: d, angle: state.angle, aux: w.aux, work: state.work || 0 }, dt);
    if (out.msg) showToast(out.msg.t, out.msg.s);
    const target = V3(w.x, JOINT.y + (w.pressing && !sim.stuck ? Math.max(0.0003, d / 1000) : w.pressing ? 0.0002 : 0.025), JOINT.z + (sim.on ? sim.weaveZ : 0));
    if (!w.pressing && state.control === 'rel') target.x = Math.max(JOINT.x0 - 0.01, Math.min(sim.progress, JOINT.x1));
    tipPos.lerp(target, 1 - Math.pow(0.0004, dt));
    const W = fitup.W(), moved = !isIdentity(W) || state.work;
    if (moved) snapTools(s);
    s.weldPose(ctx, tipPos, dt, out);
    if (moved) frameTools(s, W);
    audio.update(sim.on, d / mid, sim.proc.kind === 'cut' && w.aux ? 'cut' : sim.proc.sound);
    const lensOn = state.lens && sim.on && sim.proc.lens !== false;
    $('#lens').classList.toggle('on', lensOn);
    $('#lens').dataset.shade = sim.proc.lensShade || 'arc';
    E.renderer.toneMappingExposure = THREE.MathUtils.lerp(E.renderer.toneMappingExposure, lensOn ? (sim.proc.lensExposure ?? 0.28) : 1.12, 1 - Math.pow(0.001, dt));
    updateHUD(out); haptics(d, mid, out);
    if (out.progress >= 0.999 && !sim.on && !w.done) { w.done = true; showToast('good', 'أحسنت! اضغط «افحص» لترى النتيجة.'); }
  }
  // ---- two-thumb control (touch): left pad = travel along the joint, right pad = arc length (↕) + torch angle (↔)
  const sticks = { L: null, R: null };
  function bindSticks() {
    const l = $('#stick-l'), r = $('#stick-r'); if (!r) return;
    const bind = (el, key) => {
      const set = ev => { if (state.padEdit) return; const b = el.getBoundingClientRect(), o = sticks[key] && sticks[key].id === ev.pointerId ? sticks[key] : {}; sticks[key] = Object.assign(o, { x: THREE.MathUtils.clamp((ev.clientX - b.left) / b.width, 0, 1), y: THREE.MathUtils.clamp(1 - (ev.clientY - b.top) / b.height, 0, 1), id: ev.pointerId }); drawStick(el, sticks[key]); };
      el.addEventListener('pointerdown', ev => { ev.preventDefault(); audio.ensure(); try { el.setPointerCapture(ev.pointerId); } catch (e) {} set(ev); const k = sticks[key]; k.x0 = k.x; k.y0 = k.y; k.a0 = state.angle; k.w0 = state.work || 0; if (key === 'R') { const w = state.weld; w.pid = ev.pointerId; } });
      el.addEventListener('pointermove', ev => { if (sticks[key] && sticks[key].id === ev.pointerId) set(ev); });
      const end = ev => { if (sticks[key] && sticks[key].id === ev.pointerId) { sticks[key] = null; drawStick(el, null); if (key === 'R') { state.weld.pressing = false; } } };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    if (l) bind(l, 'L'); bind(r, 'R');
  }
  // ---- movable / resizable controls: the trainer can drag the pads to where his hands are on the big touch screen
  const PADS = ['stick-l', 'stick-r', 'aux-btn'];
  function applyPads() {
    document.documentElement.style.setProperty('--pad', store.get('padScale', 1));
    PADS.forEach(id => { const el = document.getElementById(id), p = store.get('pad.' + id, null); if (!el) return;
      if (p) { el.style.position = 'fixed'; el.style.left = (p.x * innerWidth) + 'px'; el.style.top = (p.y * innerHeight) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0'; }
      else { el.style.position = ''; el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.margin = ''; } });
  }
  let padDrag = null;
  window.addEventListener('pointerdown', ev => {
    if (!state.padEdit) return; const el = ev.target.closest('#stick-l,#stick-r,#aux-btn'); if (!el) return;
    ev.preventDefault(); ev.stopPropagation(); const r = el.getBoundingClientRect(); padDrag = { el, dx: ev.clientX - r.left, dy: ev.clientY - r.top, id: ev.pointerId };
  }, true);
  window.addEventListener('pointermove', ev => {
    if (!padDrag || ev.pointerId !== padDrag.id) return; ev.stopPropagation();
    const el = padDrag.el, r = el.getBoundingClientRect(), x = THREE.MathUtils.clamp(ev.clientX - padDrag.dx, 0, innerWidth - r.width), y = THREE.MathUtils.clamp(ev.clientY - padDrag.dy, 0, innerHeight - r.height);
    el.style.position = 'fixed'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0';
  }, true);
  window.addEventListener('pointerup', ev => {
    if (!padDrag || ev.pointerId !== padDrag.id) return; const el = padDrag.el, r = el.getBoundingClientRect();
    store.set('pad.' + el.id, { x: r.left / innerWidth, y: r.top / innerHeight }); padDrag = null;
  }, true);
  function drawStick(el, v) { const k = el.querySelector('.knob'); if (!k) return; el.classList.toggle('on', !!v); if (el.id === 'stick-l' && !el.classList.contains('xy')) k.style.left = (v ? v.x * 100 : 50) + '%'; else { k.style.left = (v ? v.x * 100 : 50) + '%'; k.style.bottom = (v ? v.y * 100 : 50) + '%'; } }
  function stickRange() { const p = sim.proc; return { max: p.breakAbove != null ? p.breakAbove + 1 : p.ideal.dist[1] * 2.2 }; }
  // hand sensitivity: how many degrees a full sweep of the thumb turns the torch, and how much the hand is steadied
  const SENS = { low: { name: 'هادئة', range: 26, smooth: 0.02 }, mid: { name: 'متوسطة', range: 45, smooth: 0.004 }, high: { name: 'عالية', range: 75, smooth: 0.0006 } };
  state.sens = store.get('sens', 'mid');
  // both torch angles are steered RELATIVE to where the thumb landed (no jump when you touch), with a small dead zone
  const rel = (v, v0) => { const d = v - v0; return Math.abs(d) < 0.02 ? 0 : d - Math.sign(d) * 0.02; };
  function sticksFrame(dt) {
    if (state.control !== 'sticks' || state.stage !== 'weld') return;
    const w = state.weld, p = sim.proc, R = sticks.R, L = sticks.L, G = SENS[state.sens] || SENS.mid, k = 1 - Math.pow(G.smooth, dt);
    if (R) {
      if (!w.pressing) { w.x = Math.max(JOINT.x0, Math.min(sim.progress, JOINT.x1)); }
      w.pressing = true; w.dist = R.y * stickRange().max;
      // right thumb ↔ : WORK angle (tilt between the two plates) on fillet / unequal joints
      if (state.workIdeal != null && state.level !== 'beg' && R.w0 != null) {
        const tgt = THREE.MathUtils.clamp(R.w0 + rel(R.x, R.x0) * G.range, -30, 30);
        state.workF = (state.workF ?? state.work ?? 0) + (tgt - (state.workF ?? state.work ?? 0)) * k; state.work = Math.round(state.workF);
        const wv = $('#work-v'); if (wv) wv.textContent = state.work + '°'; const wi = $('#work'); if (wi) wi.value = state.work;
      }
    }
    // left thumb ↔ : travel along the joint;  ↕ : TRAVEL angle (lean of the electrode / torch along the line)
    if (L && w.pressing && state.level !== 'beg') { const v = (L.x - 0.5) * 2, vmax = p.ideal.speed[1] * 1.9; w.x = THREE.MathUtils.clamp(w.x + (Math.abs(v) < 0.06 ? 0 : v) * vmax / 1000 * dt, JOINT.x0 - 0.02, JOINT.x1 + 0.01); }
    if (L && state.level !== 'beg' && p.angle !== false && L.a0 != null) {
      const tgt = THREE.MathUtils.clamp(L.a0 + rel(L.y, L.y0) * G.range, 30, 90);
      state.angleF = (state.angleF ?? state.angle) + (tgt - (state.angleF ?? state.angle)) * k; state.angle = Math.round(state.angleF);
      const av = $('#angle-v'); if (av) av.textContent = state.angle + '°'; const a = $('#angle'); if (a) a.value = state.angle;
    }
  }
  let lastBuzz = 0;
  function haptics(d, mid, out) {
    if (!navigator.vibrate || !state.weld.pressing) return;
    const t = performance.now(), p = sim.proc, bad = (p.breakAbove != null && d > p.breakAbove - 1) || (p.stickBelow != null && d < p.stickBelow + 0.4) || sim.stuck;
    if (bad && t - lastBuzz > 450) { lastBuzz = t; try { navigator.vibrate(sim.stuck ? 120 : 35); } catch (e) {} }
  }
  ctx.tipPos = () => tipPos;
  ctx.resetTip = (x, y) => tipPos.set(x, y, JOINT.z);

  let assist;
  function setAssist(on) {
    const proc = sim.proc;
    if (!assist) {
      assist = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.22, depthWrite: false }));
      assist.rotation.x = -Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0052, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 0.3), toneMapped: false, depthWrite: false, transparent: true }));
      ring.rotation.x = -Math.PI / 2; assist.userData.ring = ring;
      (fitup ? fitup.jointFrame : E.scene).add(assist, ring);
    }
    const ideal = ((proc.ideal.dist[0] + proc.ideal.dist[1]) / 2) / (proc.distPerMM ?? 0.42) / 1000;
    const band = ((proc.ideal.dist[1] - proc.ideal.dist[0]) / (proc.distPerMM ?? 0.42)) / 1000;
    assist.scale.set(JOINT.x1 - JOINT.x0, Math.max(0.003, band), 1);
    assist.position.set((JOINT.x0 + JOINT.x1) / 2, JOINT.y + 0.0004, JOINT.z - ideal);
    assist.visible = on && state.control === 'direct';
    assist.userData.ring.position.set(JOINT.x0 + 0.002, JOINT.y + 0.0006, JOINT.z - (state.control === 'direct' ? ideal : 0));
    assist.userData.ring.visible = on;
  }

  // ---------------------------------------------------------------- inspect overlays
  // defects drawn ON the bead: a coloured band over each stretch + a numbered marker you can tap for cause & fix
  let defectGroup; const DCOL = [0xff4d4d, 0xffb020, 0x4da3ff, 0xc77dff, 0x3ddc97, 0xff7ab8, 0x00d1c1];
  const defLayer = $('#defmarks'), _dp = new THREE.Vector3();
  function showDefects(on) {
    if (defectGroup) { defectGroup.parent && defectGroup.parent.remove(defectGroup); defectGroup = null; }
    defLayer.innerHTML = ''; const card = $('#defcard'); if (card) card.hidden = true;
    if (!on || !state.report || !state.report.defects) return;
    defectGroup = new THREE.Group();
    const R = state.report, h = Math.max(0.0015, (R.height || 2) / 1000);
    R.defects.forEach((d, i) => (d.spots || []).forEach((sp, j) => {
      // a coloured bracket BESIDE the bead (never over it) so the defect itself stays visible
      const len = Math.max(0.006, sp.x1 - sp.x0), col = DCOL[i % DCOL.length], zz = JOINT.z + 0.011 + (i % 3) * 0.0035;
      const band = new THREE.Mesh(new THREE.BoxGeometry(len, 0.0006, 0.0022), new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: sp.all, opacity: sp.all ? 0.55 : 1 }));
      band.position.set((sp.x0 + sp.x1) / 2, JOINT.y + 0.0003, zz); defectGroup.add(band);
      [sp.x0, sp.x0 + len].forEach(ex => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0006, 0.007), band.material); t.position.set(ex, JOINT.y + 0.0003, zz - 0.0025); defectGroup.add(t); });
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'defmark' + (sp.all ? ' all' : ''); b.dataset.act = 'def-focus'; b.dataset.i = i; b.dataset.j = j;
      b.style.setProperty('--c', '#' + col.toString(16).padStart(6, '0'));
      b.innerHTML = `<i>${AR(i + 1)}</i><span>${d.name}${sp.all ? ' — على طول الخط' : ''}</span>`;
      b._pos = { x: sp.all ? JOINT.x0 + 0.015 + i * 0.022 : (sp.x0 + sp.x1) / 2, y: JOINT.y + h * 1.6, z: JOINT.z + 0.011 + (i % 3) * 0.0035 };
      defLayer.appendChild(b);
    }));
    (fitup ? fitup.jointFrame : E.scene).add(defectGroup);
    updateDefMarks();
  }
  function updateDefMarks() {
    if (!defLayer.children.length) return;
    const w = viewport.clientWidth, hh = viewport.clientHeight;
    [...defLayer.children].forEach((b, k) => {
      _dp.set(b._pos.x, b._pos.y, b._pos.z); if (fitup) _dp.applyMatrix4(fitup.W()); _dp.project(E.camera);
      const vis = _dp.z < 1 && Math.abs(_dp.x) < 1.05 && Math.abs(_dp.y) < 1.05;
      b.style.display = vis ? '' : 'none';
      b.style.transform = `translate(${(_dp.x * 0.5 + 0.5) * w}px, ${(-_dp.y * 0.5 + 0.5) * hh + 34 + (k % 3) * 30}px)`;
    });
  }
  function focusDefect(i, j) {
    const R = state.report, d = R && R.defects[i]; if (!d) return;
    if (!state.showDef) { state.showDef = true; showDefects(true); renderPanel(); }
    const sp = (d.spots || [])[j] || (d.spots || [])[0];
    if (sp) { const cx = (sp.x0 + sp.x1) / 2, span = Math.max(0.04, sp.x1 - sp.x0); E.flyTo(V3(cx, JOINT.y + 0.06 + span * 0.5, JOINT.z + 0.08 + span * 0.6), V3(cx, JOINT.y, JOINT.z), 0.9); }
    const card = $('#defcard');
    card.style.setProperty('--c', '#' + DCOL[i % DCOL.length].toString(16).padStart(6, '0'));
    card.innerHTML = `<div class="dc-h"><i>${AR(i + 1)}</i><b>${d.name}</b><small class="mono">${d.en}</small><button type="button" class="icon-btn sm" data-act="def-close" aria-label="إغلاق">${ICON.close || '×'}</button></div>
      <p><b>السبب:</b> ${d.cause}</p><p><b>العلاج:</b> ${d.fix}</p>
      ${R.defects.length > 1 ? `<button type="button" class="btn sm" data-act="def-focus" data-i="${(i + 1) % R.defects.length}">العيب التالي</button>` : ''}`;
    card.hidden = false;
    voice.say(d.name + '. السبب: ' + d.cause + ' العلاج: ' + d.fix, 'high');
  }

  // ---------------------------------------------------------------- UI
  function renderTopbar() {
    const s = S(), st = state.stage, inSt = st !== 'hub' && s;
    $('#tb-back').hidden = !inSt;
    $('#tb-title').innerHTML = inSt ? `<b>${s.name}</b><small class="mono">${s.code}</small>` : `<b>مركز التدريب — ترسانة الإسكندرية</b><small>قسم اللحام والقطع بالغاز</small>`;
    const nav = $('#stepper'); nav.hidden = !inSt;
    if (inSt) {
      const cur = s.stages.findIndex(x => x[0] === st), dn = state.done[s.id] || {};
      nav.innerHTML = s.stages.map(([k, label], i) => {
        const cls = i === cur ? 'on' : (dn[k] ? 'done' : '');
        return `<button type="button" class="step ${cls}" data-go="${k}"><i>${dn[k] && i !== cur ? ICON.check : AR(i + 1)}</i><span>${label}</span></button>`;
      }).join('');
    }
    $('#tb-sound').innerHTML = state.sound ? ICON.sound : ICON.mute;
    $('#tb-voice').classList.toggle('on', state.voice);
    $('#drawer-toggle').hidden = st === 'weld';
    document.body.classList.toggle('drawer-closed', !state.drawer);
  }

  function hubHTML() {
    return `<div class="ph"><h2>محطات المعمل</h2><span class="muted">${AR(STATIONS.length)} محطات</span></div>` + STATIONS.map(s => {
      const n = Object.keys(state.done[s.id] || {}).length, total = s.stages.length;
      return `<button type="button" class="station ${s.ready ? 'ready' : ''} ${state.station === s.id ? 'cur' : ''}" ${s.ready ? `data-station="${s.id}"` : 'disabled'}>
        <span class="ic">${s.icon}</span>
        <span class="tx"><b>${s.name}</b><small class="mono">${s.code}</small>${s.ready ? `<span class="pbar"><i style="width:${n / total * 100}%"></i></span>` : ''}</span>
        <span class="st">${s.ready ? (n ? `${AR(n)}/${AR(total)}` : 'ابدأ') : 'قريباً'}</span></button>`;
    }).join('');
  }

  function exploreHTML() {
    const s = S(), p = s.parts[state.explore.sel];
    return `
      <div class="chips">${s.parts.map((q, i) => `<button type="button" class="chip ${i === state.explore.sel ? 'on' : ''}" data-part="${i}" aria-label="${q.name}">${AR(i + 1)}</button>`).join('')}</div>
      <article class="card part">
        <header><span class="badge">${AR(state.explore.sel + 1)}</span><div><h3>${p.name}</h3><span class="mono muted">${p.en}</span></div></header>
        <p>${p.desc}</p>
        ${p.facts && p.facts.length ? `<ul class="facts">${p.facts.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
        ${p.safety ? `<div class="safety">${ICON.shield}<div><b>سلامة</b><span>${p.safety}</span></div></div>` : ''}
        <div class="row2" style="margin-top:.8rem">
          <button type="button" class="btn" data-act="speak-part">${ICON.sound}اسمع الشرح</button>
          ${canHold(p.id) ? `<button type="button" class="btn" data-act="hold-part">${ICON.hand}أمسكه وقلّبه</button>` : `<button type="button" class="btn" data-act="cam-part">${ICON.eye}قرّب الكاميرا</button>`}
        </div>
      </article>
      <div class="row2">
        <button type="button" class="btn ${state.explore.labels ? 'on' : ''}" data-act="labels">${ICON.list}الأسماء</button>
        ${s.explodeItems ? `<button type="button" class="btn ${state.explore.exploded ? 'on' : ''}" data-act="explode">${ICON.explode}${state.explore.exploded ? 'تجميع' : 'تفكيك'}</button>` : `<button type="button" class="btn" data-act="cam-reset">${ICON.reset}المنظر العام</button>`}
      </div>
      ${nextBtn('explore')}`;
  }
  function nextBtn(cur) {
    const s = S(), i = s.stages.findIndex(x => x[0] === cur), nx = s.stages[i + 1];
    return nx ? `<button type="button" class="btn primary big" data-go="${nx[0]}" data-mark="${cur}">التالي: ${nx[1]} ${ICON.next}</button>` : '';
  }
  function assembleHTML() {
    const s = S(), st = state.asm.step, steps = s.asmSteps;
    const list = steps.map((x, i) => `<li class="${i < st ? 'done' : i === st ? 'cur' : ''}"><i>${i < st ? ICON.check : AR(i + 1)}</i><div><b>${x.title}</b>${i === st ? `<span>${x.hint}</span>` : ''}</div></li>`).join('');
    const m = state.asm.msg, done = st >= steps.length;
    return `
      <div class="ph"><h2>خطوات التركيب</h2><span class="mono accent">${Math.min(st, steps.length)} / ${steps.length}</span></div>
      <ol class="steps">${list}</ol>
      ${m ? `<div class="msg ${m.t}" role="status">${m.t === 'bad' ? ICON.x : m.t === 'good' ? ICON.check : ICON.info}<span>${m.s}</span></div>` : ''}
      <div class="row2">
        <button type="button" class="btn" data-act="asm-reset">${ICON.reset}من الأول</button>
        <button type="button" class="btn" data-act="asm-auto" ${done ? 'disabled' : ''}>${ICON.play}أرني الخطوة</button>
      </div>
      ${done ? nextBtn('assemble') : `<button type="button" class="btn primary big" disabled>أكمل خطوات التركيب</button>`}`;
  }
  function operateHTML() {
    const s = S(), r = s.operateReady(ctx);
    const toFit = s.stages.some(x => x[0] === 'fitup') && !isCutTask();
    return s.operateHTML(ctx) + `<button type="button" class="btn primary big" data-go="${toFit ? 'fitup' : 'weld'}" data-mark="operate" ${r.ok ? '' : 'disabled'}>${toFit && r.ok ? 'التالي: جهّز الوصلة' : r.label} ${ICON.next}</button>`;
  }
  function inspectHTML() {
    const s = S(), R = state.report;
    if (!R || R.empty) return `<div class="card"><h3>لا يوجد عمل بعد</h3><p class="muted">ارجع إلى مرحلة «${s.stages.find(x => x[0] === 'weld')[1]}» ونفّذ على الوصلة.</p></div><button type="button" class="btn primary big" data-go="weld">ارجع ${ICON.next}</button>`;
    const C = 2 * Math.PI * 62;
    const attempts = store.get('attempts.' + s.id, []).slice(-6).reverse();
    return `
      <section class="card score">
        <svg viewBox="0 0 150 150" class="ring" role="img" aria-label="الدرجة ${R.total} من ١٠٠"><circle cx="75" cy="75" r="62" class="bg"/><circle cx="75" cy="75" r="62" class="fg" stroke-dasharray="${(C * R.total / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 75 75)"/><text x="75" y="86" class="mono">${R.total}</text></svg>
        <div><b class="grade">${R.grade}</b><span class="muted small">غطّيت ${AR(Math.round(R.coverage * 100))}٪ • السرعة <span class="mono">${R.avgSpeed.toFixed(1)}</span> مم/ث • ${R.distName} <span class="mono">${R.avgDist.toFixed(1)}</span> مم</span></div>
      </section>
      <section class="card"><h3 class="sm">تفاصيل الأداء</h3>
        ${R.crit.map(c => `<div class="crit"><span>${c.label}</span><div class="bar" dir="ltr"><i style="width:${c.v}%" class="${c.v >= 75 ? 'g' : c.v >= 50 ? 'w' : 'b'}"></i></div><b class="mono">${c.v}</b></div>`).join('')}
        ${R.setNote ? `<p class="muted small">${R.setNote}</p>` : ''}
      </section>
      <section class="card"><h3 class="sm">العيوب التي ظهرت</h3>
        ${clean && clean.active ? '<p class="muted small">ستظهر العيوب على الخط بعد التنظيف.</p>' : ''}${R.defects.length ? R.defects.map((d, i) => `<div class="defect" data-act="def-focus" data-i="${i}" role="button" tabindex="0" style="--c:#${DCOL[i % DCOL.length].toString(16).padStart(6, '0')}"><i>${AR(i + 1)}</i><div><b>${d.name} <small class="mono muted">${d.en}</small></b><span><b>السبب:</b> ${d.cause}</span><span><b>العلاج:</b> ${d.fix}</span></div></div>`).join('') : '<p class="good-t">لا توجد عيوب واضحة. عمل نظيف!</p>'}
      </section>
      ${R.kind !== 'cut' ? `<section class="card"><h3 class="sm">المقطع العرضي للخط</h3>${sectionSVG(R)}</section>` : ''}
      ${s.inspectExtra ? s.inspectExtra(ctx) : ''}
      ${attempts.length > 1 ? `<section class="card"><h3 class="sm">آخر محاولاتك</h3><div class="attempts">${attempts.map(a => `<span><b class="mono">${a.total}</b><small>${a.when}</small></span>`).join('')}</div></section>` : ''}
      <div class="row2">
        <button type="button" class="btn" data-act="cam-inspect">${ICON.target}منظر قريب</button>
        <button type="button" class="btn ${state.showDef ? 'on' : ''}" data-act="defects">${ICON.target}${state.showDef ? 'إخفاء العيوب' : 'العيوب على الخط'}</button>
      </div>
      <div class="row2">
        <button type="button" class="btn" data-go="weld">${ICON.reset}حاول مرة أخرى</button>
        <button type="button" class="btn primary" data-act="finish-station" data-mark="inspect">إنهاء المحطة</button>
      </div>`;
  }
  // ---- macro section: the coupon is cut across the middle of the bead, polished and etched — the trainee sees
  // the real profile of the joint (both plates, bevel / taper, web), the weld metal, the heat-affected zone,
  // how deep it fused, the leg / throat of a fillet, and the defects that live inside the weld.
  function sectionSVG(R) {
    const ex = sim.exercise, kind = ex ? ex.kind : JOINT.kind === 'single' ? 'butt' : JOINT.kind, t1 = ex ? ex.t : JOINT.t * 1000, t2 = ex ? (ex.t2 ?? ex.t) : t1;
    const names = R.defects.map(d => d.name).join(' '), has = re => re.test(names);
    const pen = R.penetration ?? 1, W = Math.max(2, R.width), H = Math.max(0.4, R.height);
    const sag = has(/ترهّل|تدلّي|تساقط/), por = has(/مسامية/), uc = has(/تآكل|حرق/), lof = has(/عدم انصهار|انصهار ناقص|تراكب|مرتفع وعريض/), lop = has(/اختراق/) || pen < 0.7;
    const VW = 380, VH = 280, cx = 190;
    // fit the drawing: horizontal span and vertical extent (top of cap / web … bottom of the thickest plate)
    const thickB = Math.max(t1, t2), legE = THREE.MathUtils.clamp(W * 0.55, 2, 14);
    const span = kind === 'butt' ? thickB * 2.6 + W * 1.1 : Math.max(thickB, legE) * 2.6 + 6;
    const topMM = kind === 'butt' ? H * 2 + 3.5 + (t1 !== t2 ? Math.abs(t1 - t2) : 0) : kind === 'tee' ? Math.max(legE * 2.2, 10) : t2 + legE * 0.3 + 2;
    const botMM = kind === 'butt' ? Math.min(t1, t2) + 1.5 : t1 + 0.8;
    const sc = Math.min(15, 330 / span, (VH - 70) / (topMM + botMM)), cy = 30 + topMM * sc, X = x => (cx + x * sc).toFixed(1), Y = y => (cy - y * sc).toFixed(1), P = (x, y) => X(x) + ',' + Y(y);
    const Lx = (VW / 2 - 14) / sc;
    let plates = '', weld = '', extra = '', dims = '', title = '';
    if (kind === 'butt') {
      const g = 0.8, thin = Math.min(t1, t2), thick = Math.max(t1, t2), tap = (thick - thin) * 4;
      plates = `<path class="pl" d="M${P(-Lx, 0)} L${P(-g / 2, 0)} L${P(-g / 2, -thin)} L${P(-Lx, -thin)} Z"/>` +
        `<path class="pl" d="M${P(g / 2, 0)} L${P(g / 2 + tap, thick - thin)} L${P(Lx, thick - thin)} L${P(Lx, -thin)} L${P(g / 2, -thin)} Z"/>`;
      const pd = thin * Math.min(1, pen), toeR = W / 2, yR = thick > thin ? Math.min(thick - thin, (toeR - g / 2) / Math.max(0.1, tap) * (thick - thin)) : 0;
      const capY = H + yR / 2 + (sag ? -H * 0.25 : 0), lowShift = sag ? -W * 0.18 : 0;
      const root = pen >= 1 ? `Q${P(0, -thin - 1)} ${P(-g / 2 - 0.4, -thin)}` : `Q${P(0, -pd - 0.6)} ${P(-g / 2 - 0.4, -pd)}`;
      weld = `M${P(-W / 2 + lowShift, 0)} Q${P(lowShift * 0.5, capY * 2)} ${P(toeR, yR)} L${P(g / 2 + 0.4, pen >= 1 ? -thin : -pd)} ${root} Z`;
      if (lop) extra += `<path class="lof" d="M${P(0, -pd - 0.2)} L${P(0, -thin)}"/>`;
      if (uc) extra += `<path class="cut" d="M${P(toeR - 0.1, yR + 0.05)} l${(0.9 * sc).toFixed(1)},0 l${(-0.45 * sc).toFixed(1)},${(0.6 * sc).toFixed(1)} Z"/>`;
      if (lof) extra += `<path class="lof" d="M${P(-W / 2 + lowShift, 0.02)} L${P(-W / 2 - 0.9 + lowShift, 0.02)}"/>`;
      dims = `<path class="dim" d="M${P(-W / 2, capY + 1.6)} L${P(toeR, capY + 1.6)}"/><text x="${X(0)}" y="${+Y(capY + 1.6) - 7}" text-anchor="middle">عرض الخط ${W.toFixed(1)} مم • التحدّب ${H.toFixed(1)} مم</text>` +
        `<text x="${cx}" y="${VH - 12}" text-anchor="middle" class="${pen >= 0.95 ? 'ok' : 'bad'}">${pen >= 0.95 ? 'اختراق كامل حتى الجذر' : 'الاختراق ' + AR(Math.round(Math.min(1, pen) * 100)) + '٪ من السُمك — الجذر غير منصهر'}</text>`;
      title = t1 === t2 ? `وصلة تناكبية ${AR(t1)} مم` : `وصلة تناكبية ${AR(thin)} + ${AR(thick)} مم (اللوح السميك مشطوف ١:٤)`;
    } else {
      const tee = kind === 'tee', tb = t1, tw = t2, leg = legE, legV = tee ? leg : Math.min(leg, tw + 0.2);
      const webH = tee ? Math.max(leg * 2.2, 10) : tw;
      plates = `<path class="pl" d="M${P(-Lx, 0)} L${P(Lx, 0)} L${P(Lx, -tb)} L${P(-Lx, -tb)} Z"/>` +
        (tee ? `<path class="pl" d="M${P(-tw, 0)} L${P(0, 0)} L${P(0, webH)} L${P(-tw, webH)} Z"/>` : `<path class="pl" d="M${P(-Lx, 0)} L${P(0, 0)} L${P(0, tw)} L${P(-Lx, tw)} Z"/>`);
      const pd = 0.6 + 1.6 * Math.min(1.2, pen), conv = (H - leg * 0.75) * 0.6, sh = sag ? leg * 0.25 : 0;
      const cxF = leg * 0.5 + conv + 0.3, cyF = legV * 0.5 + conv + 0.3 - sh;
      weld = `M${P(leg + sh, 0)} Q${P(leg * 0.45, -pd)} ${P(-pd * 0.55, -pd * 0.55)} Q${P(-pd, legV * 0.45)} ${P(0, legV - sh * 0.5)} Q${P(cxF, cyF + legV * 0.15)} ${P(leg + sh, 0)} Z`;
      if (lop) extra += `<path class="lof" d="M${P(-0.1, -0.1)} L${P(-pd * 0.3, -pd * 0.3)}"/>`;
      if (uc) extra += `<path class="cut" d="M${P(0.05, legV - 0.1)} l${(-0.7 * sc).toFixed(1)},0 l${(0.35 * sc).toFixed(1)},${(-0.6 * sc).toFixed(1)} Z"/>`;
      if (lof) extra += `<path class="lof" d="M${P(leg + sh, 0.03)} L${P(leg + sh + 1, 0.03)}"/>`;
      const a = Math.min(leg, legV) * 0.707, want = Math.min(tb, tw);
      dims = `<path class="dim" d="M${P(0.2, -0.5)} L${P(leg + sh, -0.5)}"/><text x="${+X(leg + sh) + 8}" y="${+Y(-0.5) + 5}">طول الساق ${leg.toFixed(1)} مم</text>` +
        `<path class="dim thr" d="M${P(0, 0)} L${P(a * 0.707, a * 0.707)}"/><text x="${+X(Math.max(leg, a) * 0.85) + 10}" y="${Y(legV * 0.95)}">الحلق ≈ ${a.toFixed(1)} مم</text>` +
        `<text x="${cx}" y="${VH - 12}" text-anchor="middle" class="${Math.abs(leg - want) <= want * 0.35 ? 'ok' : 'bad'}">المطلوب: ساق ≈ سُمك اللوح الأرق (${AR(want)} مم) • ${conv > 0.6 ? 'سطح محدّب زيادة' : conv < -0.6 ? 'سطح مقعّر' : 'سطح مستوٍ تقريبًا'}</text>`;
      title = tee ? `وصلة زاوية T: عصب ${AR(tw)} مم على لوح ${AR(tb)} مم` : `وصلة تراكبية: ${AR(tw)} مم فوق ${AR(tb)} مم`;
    }
    const pores = por ? [[-0.15, 0.35], [0.12, 0.55], [0.3, 0.2]].map(([u, v]) => `<circle class="pore" cx="${X(u * W * (kind === 'butt' ? 1 : 0.8) + (kind === 'butt' ? 0 : W * 0.15))}" cy="${Y(v * Math.max(H, kind === 'butt' ? H : W * 0.3) * (kind === 'butt' ? 1 : 1))}" r="${Math.max(2.2, 0.35 * sc).toFixed(1)}"/>`).join('') : '';
    const grains = Array.from({ length: 7 }, (_, i) => { const u = (i - 3) / 3.5; return `<path class="gr" d="M${P(u * W * 0.4 + (kind === 'butt' ? 0 : W * 0.2), kind === 'butt' ? -0.4 : 0.3)} L${P(u * W * 0.15 + (kind === 'butt' ? 0 : W * 0.22), kind === 'butt' ? H * 0.7 : W * 0.22)}"/>`; }).join('');
    return `<p class="muted small">${title} — مقطع في منتصف الخط بعد قطعه وصقله وحفره بالحمض (Macro-etch). مكبّر حوالي ×${AR(Math.round(sc / 3.8))}.</p>
      <svg viewBox="0 0 ${VW} ${VH}" class="xsec" role="img" aria-label="مقطع عرضي للخط">
        <defs><pattern id="xs-h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,.07)" stroke-width="2"/></pattern>
          <clipPath id="xs-w"><path d="${weld}"/></clipPath></defs>
        <rect width="${VW}" height="${VH}" rx="12" class="bg"/>
        ${plates}<g fill="url(#xs-h)">${plates.replace(/class="pl"/g, 'class="plh"')}</g>
        <path class="haz" d="${weld}"/><path class="wm2" d="${weld}"/><g clip-path="url(#xs-w)">${grains}</g>${pores}${extra}
        ${dims}
      </svg>
      <div class="xs-leg"><span><i class="k-pl"></i>معدن الأساس</span><span><i class="k-haz"></i>المنطقة المتأثرة بالحرارة</span><span><i class="k-wm"></i>معدن اللحام</span>${por ? '<span><i class="k-po"></i>مسامية</span>' : ''}${lof || lop ? '<span><i class="k-lf"></i>عدم انصهار / اختراق ناقص</span>' : ''}${uc ? '<span><i class="k-uc"></i>تآكل الحافة</span>' : ''}</div>`;
  }

  function renderPanel() {
    const panel = $('#panel'), s = S(), st = state.stage;
    let html = '';
    if (st === 'hub') html = hubHTML();
    else if (s.custom && s.custom[st]) html = s.custom[st].html(ctx) + (s.custom[st].noNext ? '' : nextBtn(st));
    else if (st === 'explore') html = exploreHTML();
    else if (st === 'assemble') html = assembleHTML();
    else if (st === 'operate') html = operateHTML();
    else if (st === 'fitup') html = fitupHTML();
    else if (st === 'inspect') html = inspectHTML();
    const sc = panel.scrollTop; panel.innerHTML = html; panel.scrollTop = sc;
    $('#drawer-title').textContent = st === 'hub' ? 'المحطات' : (s && s.stages.find(x => x[0] === st) || [, ''])[1];
    panel.querySelectorAll('input[type=range][data-op]').forEach(r => r.addEventListener('input', () => { s.operateAction && s.operateAction('range:' + r.dataset.op, r, ctx); }));
  }

  function renderHUD() {
    const hud = $('#hud'), s = S();
    if (state.stage !== 'weld') { hud.innerHTML = ''; return; }
    const proc = sim.proc;
    const gauges = s.hud(ctx);
    hud.innerHTML = `
      <div class="gauges">${(state.workIdeal != null && state.level !== 'beg' ? gauges.concat([{ id: 'work', label: 'زاوية العمل', hint: 'المثالي ≈ ' + AR(state.workIdeal) + '°' }]) : gauges).map(g => `<div class="g" id="g-${g.id}"><span class="l">${g.label}</span><b class="mono v">--</b>${g.bar === false ? '' : '<div class="m" dir="ltr"><i class="z"></i><i class="n"></i></div>'}<small class="mono t">${g.hint || ''}</small></div>`).join('')}</div>
      ${state.workIdeal != null && state.level !== 'beg' ? `<div class="work-ctl glass"><label for="work">زاوية العمل <small>${state.workIdeal > 0 ? '(نحو اللوح الأسمك ≈ ' + AR(state.workIdeal) + '°)' : '(على منتصف الزاوية)'}</small></label><div class="wk"><input id="work" type="range" min="-30" max="30" value="${state.work || 0}" aria-label="زاوية العمل"><i class="ideal" style="left:${((state.workIdeal + 30) / 60 * 100).toFixed(1)}%"></i></div><b class="mono" id="work-v">${state.work || 0}°</b></div>` : ''}
      ${proc.angle !== false ? `<div class="angle-ctl"><label for="angle">${proc.angleShort || 'الزاوية'}</label><input id="angle" type="range" min="30" max="90" value="${state.angle}" aria-label="${proc.angleName || 'زاوية الميل'}"><b class="mono" id="angle-v">${state.angle}°</b></div>` : ''}
      <div class="weld-tools">
        ${proc.lens !== false ? `<button type="button" class="btn ${state.lens ? 'on-green' : ''}" data-act="lens">${ICON.lens}<span>${proc.lensName || 'الماسك'}</span></button>` : ''}
        <button type="button" class="btn" data-act="control">${ICON.hand}<span>${CTRL_NAME[state.control]}</span></button>
        ${state.control === 'sticks' ? `<button type="button" class="btn ${state.padEdit ? 'on' : ''}" data-act="pad-edit" aria-label="ترتيب أدوات التحكم">${ICON.target}<span>${state.padEdit ? 'تم' : 'ترتيب التحكم'}</span></button>` : ''}
        ${proc.kind !== 'cut' ? `<button type="button" class="btn ${state.optsOpen ? 'on' : ''}" data-act="weld-opts" aria-expanded="${!!state.optsOpen}">${ICON.target}<span>الحركة: ${(WEAVE[state.weave] || WEAVE.none).name}</span></button>` : ''}
        <div class="lvl" role="group" aria-label="مستوى الصعوبة">${Object.entries(LEVELS).map(([k, v]) => `<button type="button" class="${state.level === k ? 'on' : ''}" data-act="level:${k}">${v}</button>`).join('')}</div>
        ${proc.consumable ? `<button type="button" class="btn" data-act="new-consumable">${ICON.reset}<span>${proc.consumable.newName}</span></button>` : ''}
        <button type="button" class="btn primary" data-act="finish">افحص ${ICON.next}</button>
      </div>
      ${state.optsOpen && proc.kind !== 'cut' ? `<div class="weld-opts glass" role="dialog" aria-label="حركة الأداة وحساسية اليد">
        <b>حركة الأداة</b><div class="lvl weave" role="group">${Object.entries(WEAVE).map(([k, v]) => `<button type="button" class="${(state.weave || 'none') === k ? 'on' : ''}" data-act="weave:${k}">${v.name}</button>`).join('')}</div>
        <small>${(state.weave || 'none') === 'none' ? 'خط مستقيم (Stringer): للمسطح والأفقي والصاج الرقيق.' : state.weave === 'tri' ? 'مثلث: من حافة لحافة مع توقف لحظة عند كل حافة؛ تقدّم ٢–٣ مم كل دورة. الأفضل للرأسي الصاعد.' : 'زجزاج: تذبذب منتظم يعرّض الخط؛ أبطئ التقدّم قليلًا.'}</small>
        ${state.control === 'sticks' && state.level !== 'beg' ? `<b>حساسية اليد</b><div class="lvl sens" role="group">${Object.entries(SENS).map(([k, v]) => `<button type="button" class="${state.sens === k ? 'on' : ''}" data-act="sens:${k}">${v.name}</button>`).join('')}</div><small>الهادئة: الزاوية تتغير ببطء وثبات (للمبتدئ). العالية: حركة سريعة مثل اليد الحقيقية.</small>` : ''}
        <button type="button" class="btn sm primary" data-act="weld-opts">تم</button></div>` : ''}
      ${state.padEdit ? `<div class="pad-bar glass"><b>اسحب لوحات التحكم إلى المكان المريح ليديك</b><span>الحجم</span>${[0.85, 1, 1.25, 1.5].map(z => `<button type="button" class="${+store.get('padScale', 1) === z ? 'on' : ''}" data-act="pad-size:${z}">${z === 0.85 ? 'صغير' : z === 1 ? 'عادي' : z === 1.25 ? 'كبير' : 'كبير جدًا'}</button>`).join('')}<button type="button" data-act="pad-reset">الأماكن الأصلية</button><button type="button" class="primary" data-act="pad-edit">تم</button></div>` : ''}
      ${state.control === 'sticks' ? `<div class="sticks">
        ${state.level !== 'beg' ? `<div id="stick-l" class="stick ${proc.angle !== false ? 'xy lxy' : 'h'}"><span class="cap">الحركة على الخط${proc.angle !== false ? ' + ' + (proc.angleShort || 'زاوية التقدّم') : ''}</span><i class="rail"></i><b class="knob"></b><small class="lr"><span>رجوع</span><span>تقدّم</span></small>${proc.angle !== false ? '<small class="ud">↕ الزاوية</small>' : ''}</div>` : `<div class="stick-note">المستوى المبتدئ: الأداة تتحرك وحدها بالسرعة الصحيحة.<br>تحكّم أنت في ${proc.distName}.</div>`}
        <div id="stick-r" class="stick xy"><span class="cap">${proc.distName}${state.workIdeal != null && state.level !== 'beg' ? ' + زاوية العمل ↔' : ''}</span><i class="zone" style="bottom:${(proc.ideal.dist[0] / stickRange().max * 100).toFixed(1)}%;height:${((proc.ideal.dist[1] - proc.ideal.dist[0]) / stickRange().max * 100).toFixed(1)}%"></i><b class="knob"></b><small>المس لتبدأ • أعلى = أبعد</small></div>
      </div>` : ''}
      ${proc.aux && !(state.level === 'beg') && !(state.level === 'mid' && proc.fillerLen) ? `<button type="button" class="aux-btn ${state.control === 'sticks' ? 'near-l' : ''}" id="aux-btn">${proc.aux.icon || ICON.plus}<span>${proc.aux.label}</span><small>${proc.aux.hint || 'اضغط واستمر'}</small></button>` : ''}
      <div class="weld-bottom">
        <div class="prog"><span>${proc.kind === 'cut' ? 'تقدّم القطع' : 'تقدّم الخط'}</span><div class="bar"><i id="prog-i"></i></div><b class="mono" id="prog-v">0%</b></div>
        ${proc.consumable ? `<div class="elec"><span>${proc.consumable.name}</span><div class="bar"><i id="elec-i"></i></div><b class="mono" id="elec-v"></b></div>` : proc.heatNeed ? `<div class="elec"><span>التسخين</span><div class="bar heat"><i id="heat-i"></i></div><b class="mono" id="heat-v"></b></div>` : ''}
        <div class="hint">${state.control === 'sticks' ? 'الإبهام الأيمن يشعل القوس: لأعلى وأسفل = ' + proc.distName + (state.workIdeal != null && state.level !== 'beg' ? '، ويمينًا ويسارًا = زاوية العمل بين اللوحين' : '') + '. والإبهام الأيسر: يمينًا ويسارًا = الحركة على الخط' + (proc.angle !== false && state.level !== 'beg' ? '، ولأعلى وأسفل = زاوية الميل في اتجاه السير' : '') + '. الزاوية تتغير من مكان لمس إصبعك، فلا تقفز.' : state.control === 'rel' ? 'المس أي مكان واسحب: يمينًا ويسارًا = الحركة على الخط، وأعلى وأسفل = ' + proc.distName + '. إصبعك لن يغطي العمل.' : proc.hint}</div>
      </div>`;
    const a = $('#angle');
    if (a) a.addEventListener('input', () => { state.angle = +a.value; state.angleF = state.angle; $('#angle-v').textContent = state.angle + '°'; });
    const wk = $('#work');
    if (wk) wk.addEventListener('input', () => { state.work = +wk.value; state.workF = state.work; $('#work-v').textContent = state.work + '°'; });
    const ab = $('#aux-btn');
    if (ab) {
      const on = e => { e.preventDefault(); state.weld.aux = true; state.weld.auxHeld = true; ab.classList.add('on'); audio.ensure(); };
      const off = () => { state.weld.aux = false; state.weld.auxHeld = false; ab.classList.remove('on'); };
      ab.addEventListener('pointerdown', on); ab.addEventListener('pointerup', off); ab.addEventListener('pointercancel', off); ab.addEventListener('pointerleave', off);
    }
    bindSticks(); document.body.classList.toggle('sticks-mode', state.control === 'sticks'); applyPads(); document.body.classList.toggle('pad-edit', !!state.padEdit);
  }
  function gauge(id, val, txt, min, max, lo, hi) {
    const g = document.getElementById('g-' + id); if (!g) return;
    g.querySelector('.v').textContent = txt;
    const pct = v => THREE.MathUtils.clamp((v - min) / (max - min) * 100, 0, 100);
    const z = g.querySelector('.z'), n = g.querySelector('.n');
    if (z && lo != null) { z.style.left = pct(lo) + '%'; z.style.width = (pct(hi) - pct(lo)) + '%'; }
    if (n && val != null) n.style.left = pct(val) + '%';
    const st = val == null || lo == null ? '' : (val < lo || val > hi) ? 'warn' : 'good';
    const far = val != null && lo != null && (val < lo - (hi - lo) * 0.8 || val > hi + (hi - lo) * 0.8);
    g.dataset.s = far ? 'bad' : st;
  }
  let hudT = 0, lastTip = '', lastTipT = 0;
  function updateHUD(out) {
    if ((hudT += 1) % 3) return;
    const s = S(), proc = sim.proc, w = state.weld;
    s.hud(ctx).forEach(g => { const r = g.get(out); if (r) gauge(g.id, r.val, r.txt, r.min, r.max, r.lo, r.hi); });
    if (state.workIdeal != null) gauge('work', state.work || 0, (state.work || 0) + '°', -30, 30, state.workIdeal - 4, state.workIdeal + 4);
    const pi = $('#prog-i'); if (pi) { pi.style.width = (out.progress * 100) + '%'; $('#prog-v').textContent = Math.round(out.progress * 100) + '%'; }
    const ei = $('#elec-i'); if (ei && proc.consumable) { const c = proc.consumable; ei.style.width = ((out.consumable - c.min) / (c.len - c.min) * 100) + '%'; $('#elec-v').textContent = Math.round(out.consumable * 1000) + ' mm'; }
    const hi = $('#heat-i'); if (hi) { const k = THREE.MathUtils.clamp(out.heat || 0, 0, 1.2); hi.style.width = Math.min(100, k * 100) + '%'; hi.dataset.ok = k >= 1 ? '1' : ''; $('#heat-v').textContent = k >= 1 ? 'جاهز' : Math.round(k * 100) + '%'; }
    const coach = $('#coach');
    const tip = sim.on ? s.coach(ctx, out) : (out.preheat != null ? null : null);
    if (tip) { coach.textContent = tip; coach.classList.add('on'); if (tip !== lastTip || performance.now() - lastTipT > 6000) { voice.say(tip, 'low'); lastTip = tip; lastTipT = performance.now(); } } else coach.classList.remove('on');
  }

  let toastTimer;
  function showToast(t, s, silent) {
    if (!silent) { voice.say(s); if (t === 'bad') audio.sfx('err'); }
    const el = $('#toast');
    el.className = 'toast on ' + t; el.innerHTML = (t === 'bad' ? ICON.x : t === 'good' ? ICON.check : ICON.info) + `<span>${s}</span>`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 4200);
  }

  function finishWeld() {
    if (!sim.samples.length) { showToast('info', 'لم تبدأ بعد. المس بداية الخط وابدأ.'); return; }
    state.weld.pressing = false;
    state.report = sim.evaluate();
    if (state.prep && !state.prep.done) { clean.stop(); state.prep.done = true; }
    if (state.prep && state.prep.clean < 0.8 && sim.proc.kind !== 'cut') {
      const R = state.report; R.total = Math.max(0, R.total - 8); R.grade = R.total >= 90 ? 'ممتاز' : R.total >= 75 ? 'جيد جداً' : R.total >= 60 ? 'جيد' : R.total >= 50 ? 'مقبول' : 'يحتاج إلى تدريب';
      R.defects.unshift({ name: 'مسامية بسبب سطح غير نظيف', en: 'Porosity (dirty surface)', cause: 'لم تُنظَّف حواف الوصلة من الصدأ والزيوت قبل اللحام.', fix: 'نظّف مكان اللحام بالفرشاة السلكية حتى يظهر المعدن لامعًا قبل أن تبدأ.', spots: [{ x0: JOINT.x0 + 0.004, x1: JOINT.x0 + (JOINT.x1 - JOINT.x0) * Math.min(1, R.coverage) - 0.004, all: true }] });
      R.crit.push({ label: 'تنظيف السطح', v: Math.round(state.prep.clean * 100) });
    }
    { // fit-up quality: oversized tacks stand proud under the bead; tacking the middle first lets the gap close
      const fx = fitup.st, R = state.report;
      if (sim.proc.kind !== 'cut' && fx.tackQ && fx.tackQ.some(q => q === 'big')) {
        R.total = Math.max(0, R.total - 3);
        R.defects.push({ name: 'نقاط تكميل كبيرة', en: 'Oversized tack welds', cause: 'استمر القوس طويلًا عند التنقيط، فتكوّنت نقاط كبيرة بارزة يصعب أن ينصهر الخط فوقها.', fix: 'النقطة الجيدة صغيرة: قوس قصير لمدة ثانية إلى ثانيتين فقط عند كل نقطة.', spots: fx.tackQ.map((q, i) => q === 'big' ? { x0: TACK_X()[i] - 0.004, x1: TACK_X()[i] + 0.004 } : null).filter(Boolean) });
      }
      if (sim.proc.kind !== 'cut' && fx.tackOrder === false) {
        R.total = Math.max(0, R.total - 2);
        R.defects.push({ name: 'ترتيب تنقيط غير صحيح', en: 'Wrong tack sequence', cause: 'بدأت التنقيط بالمنتصف، فتتحرك القطعتان وتتغير الفتحة بينهما على طول الوصلة.', fix: 'نقّط الطرف الأول ثم الطرف الثاني ثم المنتصف.', all: true, spots: [{ x0: JOINT.x0 + 0.004, x1: JOINT.x1 - 0.004, all: true }] });
      }
      R.grade = R.total >= 90 ? 'ممتاز' : R.total >= 75 ? 'جيد جداً' : R.total >= 60 ? 'جيد' : R.total >= 50 ? 'مقبول' : 'يحتاج إلى تدريب';
    }
    markDone('weld');
    const s = S(), at = store.get('attempts.' + s.id, []), d = new Date();
    at.push({ total: state.report.total, when: d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) });
    store.set('attempts.' + s.id, at.slice(-30));
    if (fitup.st.mounted) { state.weld.pressing = false; fitup.unmount(state.station, true, () => goStage('inspect')); showToast('info', 'فكّ القطعة من الحامل وضعها على الطاولة للفحص.'); }
    else goStage('inspect');
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-go],[data-act],[data-part],[data-station],[data-op]');
    if (!el || el.disabled) return;
    audio.ensure();
    const s = S();
    if (el.dataset.mark) markDone(el.dataset.mark);
    if (el.dataset.station) { enterStation(el.dataset.station); return; }
    if (el.dataset.go) { goStage(el.dataset.go); return; }
    if (el.dataset.part) { selectPart(+el.dataset.part, true); return; }
    if (el.dataset.op) { s.operateAction(el.dataset.op, el, ctx); return; }
    const a = el.dataset.act;
    if (a === 'labels') { state.explore.labels = !state.explore.labels; renderPanel(); }
    else if (a === 'explode') { state.explore.exploded = !state.explore.exploded; setExploded(state.explore.exploded); renderPanel(); }
    else if (a === 'cam-reset') { const c = s.cams[state.stage](); E.flyTo(c.pos, c.target); }
    else if (a === 'cam-inspect') { const c = inspectCamera(); E.flyTo(c.pos.clone().add(V3(0, -0.1, -0.06)), c.target); }
    else if (a === 'asm-reset') goStage('assemble');
    else if (a === 'asm-auto') { if (!state.asm.busy) s.asmAuto(ctx); }
    else if (a === 'lens') { state.lens = !state.lens; renderHUD(); if (!state.lens) showToast('bad', 'تحذير: في الورشة يُمنع النظر إلى القوس أو اللهب دون قناع أو نظارة مناسبة. هذا للعرض فقط.'); }
    else if (a === 'control') { const o = ['sticks', 'rel', 'direct']; state.control = o[(o.indexOf(state.control) + 1) % 3]; store.set('control', state.control); setAssist(state.assist); renderHUD(); showToast('info', CTRL_TIP[state.control]); }
    else if (a === 'pad-edit') { state.padEdit = !state.padEdit; renderHUD(); }
    else if (a && a.startsWith('pad-size:')) { store.set('padScale', +a.slice(9)); renderHUD(); }
    else if (a === 'pad-reset') { PADS.forEach(id => store.set('pad.' + id, null)); store.set('padScale', 1); renderHUD(); }
    else if (a && a.startsWith('level:')) { state.level = a.slice(6); store.set('level', state.level); state.assist = state.level !== 'adv'; setAssist(state.assist); renderHUD(); showToast('info', LEVEL_TIP[state.level]); }
    else if (a === 'assist') { state.assist = !state.assist; setAssist(state.assist); renderHUD(); }
    else if (a === 'weld-opts') { state.optsOpen = !state.optsOpen; renderHUD(); }
    else if (a && a.startsWith('weave:')) { state.weave = a.slice(6); sim.weave = state.weave; renderHUD(); showToast('info', state.weave === 'none' ? 'حركة مستقيمة (Stringer): مناسبة للمسطح والأفقي والصاج الرقيق.' : state.weave === 'tri' ? 'حركة المثلث: من حافة لحافة مع توقف لحظة عند كل حافة، وتقدّم ٢–٣ مم كل دورة. الأفضل للرأسي الصاعد.' : 'حركة الزجزاج: تذبذب منتظم يعرّض الخط. أبطئ التقدّم قليلًا.'); }
    else if (a && a.startsWith('sens:')) { state.sens = a.slice(5); store.set('sens', state.sens); renderHUD(); showToast('info', 'حساسية اليد: ' + SENS[state.sens].name + (state.sens === 'low' ? ' — حركة هادئة مناسبة للمبتدئ.' : state.sens === 'high' ? ' — حركة سريعة مثل اليد الحقيقية.' : '.')); }
    else if (a === 'new-consumable') { sim.consumable = sim.proc.consumable.len; showToast('info', sim.proc.consumable.newMsg); }
    else if (a === 'finish') finishWeld();
    else if (a === 'slag') { if (sim.startSlagRemoval()) { showToast('info', 'جارٍ تكسير الخبث بالمطرقة…'); [0, 180, 360, 540, 720, 900].forEach(d => setTimeout(() => audio.sfx('chip'), d)); } }
    else if (a === 'clean-skip') { clean.skip(); }
    else if (a && a.startsWith('ex:')) { state.fitBusy = false; fitup.select(state.station, a.slice(3)); platesOpts = ''; setPlates({ kind: 'butt' }); fitup.apply(fitup.cur(state.station), 0); clean.showRust(true); s.onExercise && s.onExercise(fitup.cur(state.station), ctx); const c = fitupCamera(); E.flyTo(c.pos, c.target, 0.8); renderPanel(); renderTacks();
      // short preview: the work is lifted into its welding position and put back, so the student sees the position before preparing it
      const sid = state.station, exx = fitup.cur(sid); if (fitup.POS[exx.pos].lift > 0 || exx.pos === '1F') { showToast('info', 'معاينة الوضع: ' + fitup.POS[exx.pos].name); setTimeout(() => state.stage === 'fitup' && fitup.cur(sid) === exx && !fitup.st.done && !state.fitBusy && fitup.mount(sid, true, () => setTimeout(() => state.stage === 'fitup' && !fitup.st.done && fitup.unmount(sid, true), 1400)), 900); } }
    else if (a === 'fit-clean') { state.fitBusy = true; fitup.unmount(state.station, false); clean.start('pre'); renderClean(); const c = cleanCamera(); E.flyTo(c.pos, c.target, 0.8); }
    else if (a && a.startsWith('tack:')) doTack(+a.slice(5));
    else if (a === 'fit-mount') { fitup.st.done = true; fitup.mount(state.station, true, () => { fitup.st.done = true; renderPanel(); showToast('good', 'القطعة مثبتة في وضع ' + fitup.POS[fitup.cur(state.station).pos].name + '. الآن ابدأ اللحام.'); E.controls.maxPolarAngle = 2.7; const c = weldCamera(); E.flyTo(c.pos.clone().lerp(c.target, -0.35), c.target, 1.0); }); }
    else if (a === 'def-focus') { focusDefect(+el.dataset.i, +(el.dataset.j || 0)); }
    else if (a === 'def-close') { $('#defcard').hidden = true; }
    else if (a === 'defects') { state.showDef = !state.showDef; showDefects(state.showDef); renderPanel(); }
    else if (a === 'finish-station') goHub();
    else if (a === 'sound') { state.sound = audio.enabled = !state.sound; renderTopbar(); }
    else if (a === 'voice') { state.voice = voice.enabled = !state.voice; store.set('voice', state.voice); if (!state.voice) voice.stop(); else voice.say('تم تشغيل الشرح الصوتي.'); renderTopbar(); }
    else if (a === 'speak-part') { const p = s.parts[state.explore.sel]; voice.lastT = 0; voice.say(partSpeech(p)); }
    else if (a === 'hold-part') { holdPart(s.partObject(s.parts[state.explore.sel].id)); }
    else if (a === 'cam-part') selectPart(state.explore.sel, true, false);
    else if (a === 'hold-return') releaseHold(false);
    else if (a === 'hold-spin') { if (hold) { hold.spin = !hold.spin; hold.idle = 0; } }
    else if (a === 'hold-reset') { if (hold) { hold.pivot.quaternion.identity(); hold.zoom = 1; hold.vx = hold.vy = 0; } }
    else if (a === 'full') toggleFull();
    else if (a === 'present') { document.documentElement.classList.toggle('present'); setTimeout(E.resize, 50); }
    else if (a === 'home') goHub();
    else if (a === 'drawer') { state.drawer = !state.drawer; renderTopbar(); applyViewOffset(); }
    else if (a === 'rotate-skip') document.body.classList.add('portrait-ok');
  });
  window.addEventListener('keydown', e => {
    if (state.stage === 'weld' && e.code === 'Space' && sim.proc && sim.proc.aux) { state.weld.aux = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') state.weld.aux = false; });

  function toggleFull() {
    const d = document;
    if (!d.fullscreenElement) d.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    else d.exitFullscreen?.();
  }
  let triedLandscape = false;
  function tryLandscape() {
    if (triedLandscape || !E.isMobile) return; triedLandscape = true;
    // games-like: go fullscreen and lock to landscape on the first touch (Android). iOS ignores this.
    toggleFull();
  }

  // ---------------------------------------------------------------- loop & boot
  E.onFrame(dt => {
    holdFrame(dt); clean && clean.frame(dt); tackFrame(dt);
    { const st = S(); E.always = state.stage === 'weld' || !!hold || !!tack || !!(clean && clean.active) || state.stage === 'wear' || !!(st && st.animating && st.animating(ctx)) || explodeK > 0 && explodeK < 1;
      E.glow = state.stage === 'weld' || state.stage === 'inspect' || !!(st && st.animating && st.animating(ctx)); }
    const s = S();
    if (state.stage === 'weld') weldFrame(dt);
    else if (sim) { sim.time += dt; if (state.stage === 'inspect') sim.updateSlag(dt); sim.updateRipples(); sim.updateSparks(dt); sim.updateSmoke(dt); }
    s && s.frame && s.frame(ctx, dt);
    updateHotspots(); updateDefMarks(); updateTacks();
  });

  (async function boot() {
    try {
      await build();
      state.station = 'smaw';
      goHub();
      E.start();
      await intro.ready();
      audio.ensure(); tryLandscape();
      audio.sfx('intro');
      const said = voice.say(WELCOME, 'high');
      await Promise.race([Promise.all([said, new Promise(r => setTimeout(r, 3600))]), new Promise(r => setTimeout(r, 9000))]);
      intro.finish();
      booted = true;
      setTimeout(() => voice.say(HUB), 700);
    } catch (e) {
      console.error(e);
      $('#loading').innerHTML = `<p>حدثت مشكلة في تشغيل المعمل على هذا الجهاز.</p><small class="mono">${String(e && e.message || e)}</small><button type="button" id="hard-reload" style="margin-top:1rem;padding:.8rem 1.2rem;border-radius:.8rem;border:none;background:#FF8A2B;color:#0E1014;font:700 1rem inherit">تنظيف وإعادة التحميل</button>`;
      const hr = $('#hard-reload'); if (hr) hr.onclick = hardReload;
    }
  })();

  if (/[?&]debug/.test(location.search)) window.__wl = {
    state, ctx, JOINT, fitup: () => fitup, weldCamera: () => weldCamera(), goStage, enterStation, goHub, finishWeld, E, sim: () => sim, S, voice, spoken: (() => { const a = []; const o = voice.say.bind(voice); voice.say = (t, p) => { a.push(t); return o(t, p); }; return a; })(),
    simulate(secs = 50, opts = {}) {
      const dt = 1 / 60, proc = sim.proc; let x = JOINT.x0;
      const sp = opts.speed ?? (proc.ideal.speed[0] + proc.ideal.speed[1]) / 2, dd = opts.dist ?? (proc.ideal.dist[0] + proc.ideal.dist[1]) / 2;
      for (let t = 0; t < secs && x < JOINT.x1 + 0.002; t += dt) {
        const f = (x - JOINT.x0) / (JOINT.x1 - JOINT.x0);
        const heatOk = !proc.heatNeed || sim.heatAt(x) >= proc.heatNeed;
        const v = !heatOk ? 0 : (f > 0.45 && f < 0.52 ? sp * 2 : sp + Math.sin(t * 3) * sp * 0.1);
        x += v / 1000 * dt;
        state.weld.pressing = true; state.weld.x = x; state.weld.dist = dd + Math.sin(t * 5) * dd * 0.1; state.weld.aux = opts.aux === 'always' ? true : opts.aux === 'pulse' ? (Math.sin(t * 6) > 0) : false;
        weldFrame(dt);
      }
      state.weld.pressing = false; state.weld.aux = false; weldFrame(dt);
    }
  };

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // a newer build takes over → reload once so the student always sees the latest lab
    const hadCtrl = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded && !booted) { reloaded = true; location.reload(); } else if (hadCtrl && !reloaded) { reloaded = true; showToast('info', 'وصل تحديث جديد للمعمل. أعد فتح التطبيق لرؤيته.', true); } });
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(r => r.update && r.update()).catch(() => {});
  }
  // in-app install button (Chrome / Edge / Android)
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = $('#install-btn'); if (b) b.hidden = false; });
  window.addEventListener('appinstalled', () => { const b = $('#install-btn'); if (b) b.hidden = true; showToast('good', 'تم تثبيت المعمل كتطبيق على الجهاز.', true); });
  document.addEventListener('click', e => { if (e.target.closest('#install-btn') && deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; $('#install-btn').hidden = true; }); } });
  window.addEventListener('error', ev => { if (!booted) { const l = $('#loading'); if (l && !l.querySelector('#hard-reload')) { l.insertAdjacentHTML('beforeend', '<button type="button" id="hard-reload" style="margin-top:1rem;padding:.8rem 1.2rem;border-radius:.8rem;border:none;background:#FF8A2B;color:#0E1014;font-weight:700">تنظيف وإعادة التحميل</button>'); $('#hard-reload').onclick = hardReload; } } });
  async function hardReload() {
    try { const regs = await navigator.serviceWorker?.getRegistrations?.() || []; await Promise.all(regs.map(r => r.unregister())); const keys = await caches?.keys?.() || []; await Promise.all(keys.map(k => caches.delete(k))); } catch (e) { /* ignore */ }
    location.replace(location.pathname + '?r=' + Date.now());
  }
  return ctx;
}
