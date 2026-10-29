// App controller: stations, stages, panels, weld input. Station modules plug in through a common interface.
import * as THREE from 'three';
import { createEngine, V3, ease } from './engine.js';
import { WeldSim } from './weldsim.js';
import { makeMaterials, buildRoom, buildTable, buildPlates, buildHammer, buildBrush, TABLE_Y, JOINT } from '../models.js';
import { ArcAudio } from '../audio.js';
import { AR } from '../data.js';
import { ICON } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('weldlab.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('weldlab.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};

export function startApp(STATIONS) {
  const viewport = $('#viewport');
  const E = createEngine(viewport);
  const audio = new ArcAudio();
  const state = {
    station: null, stage: 'hub', done: store.get('done2', {}),
    explore: { sel: 0, labels: false, exploded: false },
    asm: { step: 0, picked: null, msg: null },
    lens: true, assist: true, angle: 72, sound: true, control: E.isMobile ? 'rel' : 'direct',
    weld: { pressing: false, x: JOINT.x0, dist: 20, aux: false },
    report: null, showDef: false, drawer: true, op: {}
  };
  let M, sim, plates, hammer, brush, platesOpts = '';
  const shared = {};

  const ctx = {
    E, THREE, state, audio, store, AR, V3, ease, $, get M() { return M; }, get sim() { return sim; }, shared,
    toast: (t, s) => showToast(t, s), renderPanel: () => renderPanel(), renderHUD: () => renderHUD(),
    asmMsg: (t, s) => { state.asm.msg = { t, s }; renderPanel(); },
    next: msg => asmNext(msg), markDone: k => markDone(k),
    setPlates: opts => setPlates(opts), joint: JOINT, TABLE_Y
  };

  // ---------------------------------------------------------------- build
  async function build() {
    try { await Promise.all(['600 34px "IBM Plex Mono"', '600 26px "IBM Plex Sans Arabic"'].map(f => document.fonts.load(f))); } catch (e) { /* optional */ }
    M = makeMaterials();
    buildRoom(E.scene);
    E.scene.add(buildTable(M));
    hammer = buildHammer(M); hammer.position.set(0.68, TABLE_Y + 0.012, -0.15); hammer.rotation.set(Math.PI / 2, 0.5, 0.4); E.scene.add(hammer);
    brush = buildBrush(M); brush.position.set(0.05, TABLE_Y, -0.18); brush.rotation.y = -0.3; E.scene.add(brush);
    hammer.userData.pick = 'hammer'; brush.userData.pick = 'brush';
    shared.hammer = hammer; shared.brush = brush;
    setPlates({ t: 0.006, kind: 'butt' });
    sim = new WeldSim(E.scene);
    for (const S of STATIONS) {
      if (!S.ready) continue;
      S.root = new THREE.Group(); S.root.visible = false; E.scene.add(S.root);
      S.build(ctx);
    }
    E.onResize = () => { applyViewOffset(); if (state.stage === 'weld' && !E.tweening()) { const c = weldCamera(); E.camera.position.copy(c.pos); E.controls.target.copy(c.target); } };
  }
  function setPlates(opts) {
    const key = JSON.stringify(opts);
    if (key === platesOpts) return;
    platesOpts = key;
    if (plates) { E.scene.remove(plates); plates.traverse(o => o.geometry && o.geometry.dispose()); }
    plates = buildPlates(M, opts); plates.userData.pick = 'plates'; E.scene.add(plates);
    shared.plates = plates;
  }

  const S = () => STATIONS.find(s => s.id === state.station);
  function pickables() { const s = S(); return (s ? s.pickables() : []).concat([plates, hammer, brush]); }
  function markDone(k) { const id = state.station; (state.done[id] = state.done[id] || {})[k] = true; store.set('done2', state.done); }

  // ---------------------------------------------------------------- stage flow
  function enterStation(id) {
    STATIONS.forEach(s => { if (s.root) s.root.visible = s.id === id; });
    state.station = id;
    state.explore = { sel: 0, labels: false, exploded: false };
    state.op = {};
    const s = S();
    if (shared.plates) shared.plates.visible = true;
    s.enter && s.enter(ctx);
    goStage(s.stages[0][0]);
  }
  function goHub() {
    leaveStage();
    state.stage = 'hub';
    document.body.dataset.stage = 'hub';
    STATIONS.forEach(s => { if (s.root) s.root.visible = s.id === (state.station || 'smaw'); });
    E.controls.enabled = true; E.controls.autoRotate = true; E.controls.autoRotateSpeed = 0.45;
    E.setHighlight([]);
    renderAll();
    E.flyTo(V3(1.75, 1.55, 2.25), V3(0.1, 0.55, 0), 1.2);
  }
  function leaveStage() {
    const s = S(), prev = state.stage;
    if (prev === 'weld') { audio.update(false); $('#lens').classList.remove('on'); E.renderer.toneMappingExposure = 1; sim.setVisible(false); s && s.weldExit && s.weldExit(ctx); }
    if (prev === 'explore' && explodeK > 0) resetExplode();
    if (assist) { assist.visible = false; assist.userData.ring.visible = false; }
    $('#coach').classList.remove('on');
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
    if (st === 'explore') { s.setAssembled(true); selectPart(state.explore.sel, false); }
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
    }
    if (st === 'inspect') { if (!state.report) state.report = sim.proc ? sim.evaluate() : null; s.inspectEnter && s.inspectEnter(ctx); }
    if (s.custom && s.custom[st] && s.custom[st].enter) s.custom[st].enter(ctx);
    renderAll();
    E.resize();
    const cam = st === 'weld' ? weldCamera() : st === 'inspect' ? inspectCamera() : s.cams[st]();
    E.flyTo(cam.pos, cam.target, prev === st ? 0.01 : 1.2);
  }
  // keep the 3D subject centred in the free area beside the open drawer
  function applyViewOffset() {
    const w = viewport.clientWidth, h = viewport.clientHeight, dr = $('#drawer');
    const open = state.drawer && state.stage !== 'weld' && w > 700 && h > 300 && !matchMedia('(orientation: portrait) and (max-width: 820px)').matches;
    if (open) { const dw = dr.offsetWidth + 12; E.camera.setViewOffset(w, h, dw / 2, 0, w, h); }
    else E.camera.clearViewOffset();
  }
  function renderAll() { renderTopbar(); renderPanel(); renderHotspots(); renderHUD(); applyViewOffset(); }

  function weldCamera() {
    const aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
    const vf = THREE.MathUtils.degToRad(E.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const dist = Math.max(0.22, (0.25 / 2) / Math.tan(hf / 2));
    const t = V3(0.3, JOINT.y, JOINT.z - 0.004);
    return { pos: t.clone().addScaledVector(V3(0, 0.62, 0.78).normalize(), dist), target: t };
  }
  function inspectCamera() { return { pos: V3(0.3, JOINT.y + 0.24, 0.2), target: V3(0.3, JOINT.y, 0.05) }; }

  // ---------------------------------------------------------------- explore
  function selectPart(i, fly) {
    const s = S(); state.explore.sel = i;
    const p = s.parts[i];
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

  // ---------------------------------------------------------------- assemble
  function highlightAsm() { const s = S(); E.setHighlight(s.asmTargets(state.asm.step, ctx)); renderPanel(); }
  function asmNext(msg) {
    const s = S();
    state.asm.step++; state.asm.picked = null; state.asm.msg = { t: 'good', s: msg };
    if (state.asm.step >= s.asmSteps.length) markDone('assemble');
    highlightAsm();
  }

  // ---------------------------------------------------------------- picking / pointer
  let downAt = null;
  const cv = E.renderer.domElement;
  cv.addEventListener('pointerdown', ev => {
    audio.ensure(); tryLandscape();
    downAt = { x: ev.clientX, y: ev.clientY };
    if (state.stage === 'weld') { cv.setPointerCapture(ev.pointerId); weldPointer(ev, 'down'); }
  });
  cv.addEventListener('pointermove', ev => { if (state.stage === 'weld' && state.weld.pressing) weldPointer(ev, 'move'); });
  const up = ev => {
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
      if (!E.ray.ray.intersectPlane(plane, hit)) return;
      w.x = hit.x;
      w.dist = Math.max(0, (JOINT.z - hit.z) * 1000 * k);
    }
    w.pressing = true;
  }
  let tipPos = new THREE.Vector3();
  function weldFrame(dt) {
    const s = S(), w = state.weld;
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
    const out = sim.step({ pressing: w.pressing, x: w.x, dist: d, angle: state.angle, aux: w.aux }, dt);
    if (out.msg) showToast(out.msg.t, out.msg.s);
    const target = V3(w.x, JOINT.y + (w.pressing && !sim.stuck ? Math.max(0.0003, d / 1000) : w.pressing ? 0.0002 : 0.025), JOINT.z);
    if (!w.pressing && state.control === 'rel') target.x = Math.max(JOINT.x0 - 0.01, Math.min(sim.progress, JOINT.x1));
    tipPos.lerp(target, 1 - Math.pow(0.0004, dt));
    s.weldPose(ctx, tipPos, dt, out);
    audio.update(sim.on, d / mid, sim.proc.kind === 'cut' && w.aux ? 'cut' : sim.proc.sound);
    const lensOn = state.lens && sim.on && sim.proc.lens !== false;
    $('#lens').classList.toggle('on', lensOn);
    $('#lens').dataset.shade = sim.proc.lensShade || 'arc';
    E.renderer.toneMappingExposure = THREE.MathUtils.lerp(E.renderer.toneMappingExposure, lensOn ? (sim.proc.lensExposure ?? 0.28) : 1, 1 - Math.pow(0.001, dt));
    updateHUD(out);
    if (out.progress >= 0.999 && !sim.on && !w.done) { w.done = true; showToast('good', 'خلّصت! دوس «افحص» عشان تشوف النتيجة.'); }
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
      E.scene.add(assist, ring);
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
  let defectGroup;
  function showDefects(on) {
    if (defectGroup) { E.scene.remove(defectGroup); defectGroup = null; }
    if (!on || !state.report || !state.report.bins) return;
    defectGroup = new THREE.Group();
    const col = { good: 0x3ddc97, warn: 0xffb020, bad: 0xff6b5c };
    state.report.bins.forEach(b => {
      if (b.state === 'none') return;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.0095, 0.004), new THREE.MeshBasicMaterial({ color: col[b.state], toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(JOINT.x0 + b.i * 0.01 + 0.005, JOINT.y + 0.0003, JOINT.z + 0.016);
      defectGroup.add(m);
    });
    E.scene.add(defectGroup);
  }

  // ---------------------------------------------------------------- UI
  function renderTopbar() {
    const s = S(), st = state.stage, inSt = st !== 'hub' && s;
    $('#tb-back').hidden = !inSt;
    $('#tb-title').innerHTML = inSt ? `<b>${s.name}</b><small class="mono">${s.code}</small>` : `<b>معمل اللحام الافتراضي</b><small>قسم اللحام — الثانوي الصناعي</small>`;
    const nav = $('#stepper'); nav.hidden = !inSt;
    if (inSt) {
      const cur = s.stages.findIndex(x => x[0] === st), dn = state.done[s.id] || {};
      nav.innerHTML = s.stages.map(([k, label], i) => {
        const cls = i === cur ? 'on' : (dn[k] ? 'done' : '');
        return `<button type="button" class="step ${cls}" data-go="${k}"><i>${dn[k] && i !== cur ? ICON.check : AR(i + 1)}</i><span>${label}</span></button>`;
      }).join('');
    }
    $('#tb-sound').innerHTML = state.sound ? ICON.sound : ICON.mute;
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
        <button type="button" class="btn" data-act="asm-auto" ${done ? 'disabled' : ''}>${ICON.play}وريني الخطوة</button>
      </div>
      ${done ? nextBtn('assemble') : `<button type="button" class="btn primary big" disabled>كمّل خطوات التركيب</button>`}`;
  }
  function operateHTML() {
    const s = S(), r = s.operateReady(ctx);
    return s.operateHTML(ctx) + `<button type="button" class="btn primary big" data-go="weld" data-mark="operate" ${r.ok ? '' : 'disabled'}>${r.label} ${ICON.next}</button>`;
  }
  function inspectHTML() {
    const s = S(), R = state.report;
    if (!R || R.empty) return `<div class="card"><h3>مافيش شغل لسه</h3><p class="muted">ارجع لمرحلة «${s.stages.find(x => x[0] === 'weld')[1]}» ونفّذ على الوصلة.</p></div><button type="button" class="btn primary big" data-go="weld">ارجع ${ICON.next}</button>`;
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
      <section class="card"><h3 class="sm">العيوب اللي ظهرت</h3>
        ${R.defects.length ? R.defects.map((d, i) => `<div class="defect"><i>${AR(i + 1)}</i><div><b>${d.name} <small class="mono muted">${d.en}</small></b><span><b>السبب:</b> ${d.cause}</span><span><b>العلاج:</b> ${d.fix}</span></div></div>`).join('') : '<p class="good-t">مافيش عيوب واضحة. شغل نضيف!</p>'}
      </section>
      ${R.kind !== 'cut' ? `<section class="card"><h3 class="sm">قطاع عرضي تقريبي</h3>${sectionSVG(R)}</section>` : ''}
      ${s.inspectExtra ? s.inspectExtra(ctx) : ''}
      ${attempts.length > 1 ? `<section class="card"><h3 class="sm">آخر محاولاتك</h3><div class="attempts">${attempts.map(a => `<span><b class="mono">${a.total}</b><small>${a.when}</small></span>`).join('')}</div></section>` : ''}
      <div class="row2">
        ${sim.proc && sim.proc.slag ? `<button type="button" class="btn" data-act="slag">${ICON.hammer}شيل الخبث</button>` : `<button type="button" class="btn" data-act="cam-inspect">${ICON.target}منظر قريب</button>`}
        <button type="button" class="btn ${state.showDef ? 'on' : ''}" data-act="defects">${ICON.target}إظهار الأخطاء</button>
      </div>
      <div class="row2">
        <button type="button" class="btn" data-go="weld">${ICON.reset}حاول تاني</button>
        <button type="button" class="btn primary" data-act="finish-station" data-mark="inspect">إنهاء المحطة</button>
      </div>`;
  }
  function sectionSVG(R) {
    const w = R.width, h = R.height, p = R.penetration, sx = 12, cx = 190, top = 70, T = Math.max(2, JOINT.t * 1000) * sx;
    const hw = w / 2 * sx, hh = h * sx, pen = T * Math.min(1.1, p);
    return `<svg viewBox="0 0 380 ${top + T + 50}" class="xsec" role="img" aria-label="قطاع عرضي: عرض ${w.toFixed(1)} مم وارتفاع ${h.toFixed(1)} مم">
      <rect x="20" y="${top}" width="${cx - 22}" height="${T}" class="pl"/><rect x="${cx + 2}" y="${top}" width="${cx - 22}" height="${T}" class="pl"/>
      <path d="M${cx - hw},${top} Q${cx},${top - hh * 2} ${cx + hw},${top} L${cx + 4},${top + pen} Q${cx},${top + pen + 6} ${cx - 4},${top + pen} Z" class="wm"/>
      <line x1="${cx - hw}" y1="${top - hh - 16}" x2="${cx + hw}" y2="${top - hh - 16}" class="dim"/>
      <text x="${cx}" y="${top - hh - 24}" text-anchor="middle">عرض ${w.toFixed(1)} مم</text>
      <text x="${cx + hw + 10}" y="${top - hh / 2}">ارتفاع ${h.toFixed(1)} مم</text>
      <text x="${cx}" y="${top + T + 34}" text-anchor="middle">${p >= 0.95 ? 'اختراق كامل للجذر' : p >= 0.7 ? 'اختراق جزئي' : 'اختراق ضعيف'}</text></svg>`;
  }

  function renderPanel() {
    const panel = $('#panel'), s = S(), st = state.stage;
    let html = '';
    if (st === 'hub') html = hubHTML();
    else if (s.custom && s.custom[st]) html = s.custom[st].html(ctx) + (s.custom[st].noNext ? '' : nextBtn(st));
    else if (st === 'explore') html = exploreHTML();
    else if (st === 'assemble') html = assembleHTML();
    else if (st === 'operate') html = operateHTML();
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
      <div class="gauges">${gauges.map(g => `<div class="g" id="g-${g.id}"><span class="l">${g.label}</span><b class="mono v">--</b>${g.bar === false ? '' : '<div class="m" dir="ltr"><i class="z"></i><i class="n"></i></div>'}<small class="mono t">${g.hint || ''}</small></div>`).join('')}</div>
      ${proc.angle !== false ? `<div class="angle-ctl"><label for="angle">${proc.angleShort || 'الزاوية'}</label><input id="angle" type="range" min="30" max="90" value="${state.angle}" aria-label="${proc.angleName || 'زاوية الميل'}"><b class="mono" id="angle-v">${state.angle}°</b></div>` : ''}
      <div class="weld-tools">
        ${proc.lens !== false ? `<button type="button" class="btn ${state.lens ? 'on-green' : ''}" data-act="lens">${ICON.lens}<span>${proc.lensName || 'الماسك'}</span></button>` : ''}
        <button type="button" class="btn ${state.control === 'rel' ? 'on' : ''}" data-act="control">${ICON.hand}<span>${state.control === 'rel' ? 'تحكم دقيق' : 'تحكم مباشر'}</span></button>
        <button type="button" class="btn ${state.assist ? 'on' : ''}" data-act="assist">${ICON.target}<span>وضع التدريب</span></button>
        ${proc.consumable ? `<button type="button" class="btn" data-act="new-consumable">${ICON.reset}<span>${proc.consumable.newName}</span></button>` : ''}
        <button type="button" class="btn primary" data-act="finish">افحص ${ICON.next}</button>
      </div>
      ${proc.aux ? `<button type="button" class="aux-btn" id="aux-btn">${proc.aux.icon || ICON.plus}<span>${proc.aux.label}</span><small>${proc.aux.hint || 'اضغط واستمر'}</small></button>` : ''}
      <div class="weld-bottom">
        <div class="prog"><span>${proc.kind === 'cut' ? 'تقدّم القطع' : 'تقدّم الخط'}</span><div class="bar"><i id="prog-i"></i></div><b class="mono" id="prog-v">0%</b></div>
        ${proc.consumable ? `<div class="elec"><span>${proc.consumable.name}</span><div class="bar"><i id="elec-i"></i></div><b class="mono" id="elec-v"></b></div>` : proc.heatNeed ? `<div class="elec"><span>التسخين</span><div class="bar heat"><i id="heat-i"></i></div><b class="mono" id="heat-v"></b></div>` : ''}
        <div class="hint">${state.control === 'rel' ? 'المس في أي مكان واسحب: يمين وشمال = الحركة على الخط، فوق وتحت = ' + proc.distName + '. صباعك مش هيغطّي الشغل.' : proc.hint}</div>
      </div>`;
    const a = $('#angle');
    if (a) a.addEventListener('input', () => { state.angle = +a.value; $('#angle-v').textContent = state.angle + '°'; });
    const ab = $('#aux-btn');
    if (ab) {
      const on = e => { e.preventDefault(); state.weld.aux = true; ab.classList.add('on'); audio.ensure(); };
      const off = () => { state.weld.aux = false; ab.classList.remove('on'); };
      ab.addEventListener('pointerdown', on); ab.addEventListener('pointerup', off); ab.addEventListener('pointercancel', off); ab.addEventListener('pointerleave', off);
    }
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
  let hudT = 0;
  function updateHUD(out) {
    if ((hudT += 1) % 3) return;
    const s = S(), proc = sim.proc, w = state.weld;
    s.hud(ctx).forEach(g => { const r = g.get(out); if (r) gauge(g.id, r.val, r.txt, r.min, r.max, r.lo, r.hi); });
    const pi = $('#prog-i'); if (pi) { pi.style.width = (out.progress * 100) + '%'; $('#prog-v').textContent = Math.round(out.progress * 100) + '%'; }
    const ei = $('#elec-i'); if (ei && proc.consumable) { const c = proc.consumable; ei.style.width = ((out.consumable - c.min) / (c.len - c.min) * 100) + '%'; $('#elec-v').textContent = Math.round(out.consumable * 1000) + ' mm'; }
    const hi = $('#heat-i'); if (hi) { const k = THREE.MathUtils.clamp(out.heat || 0, 0, 1.2); hi.style.width = Math.min(100, k * 100) + '%'; hi.dataset.ok = k >= 1 ? '1' : ''; $('#heat-v').textContent = k >= 1 ? 'جاهز' : Math.round(k * 100) + '%'; }
    const coach = $('#coach');
    const tip = sim.on ? s.coach(ctx, out) : (out.preheat != null ? null : null);
    if (tip) { coach.textContent = tip; coach.classList.add('on'); } else coach.classList.remove('on');
  }

  let toastTimer;
  function showToast(t, s) {
    const el = $('#toast');
    el.className = 'toast on ' + t; el.innerHTML = (t === 'bad' ? ICON.x : t === 'good' ? ICON.check : ICON.info) + `<span>${s}</span>`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 4200);
  }

  function finishWeld() {
    if (!sim.samples.length) { showToast('info', 'لسه ماعملتش حاجة. المس بداية الخط وابدأ.'); return; }
    state.weld.pressing = false;
    state.report = sim.evaluate();
    markDone('weld');
    const s = S(), at = store.get('attempts.' + s.id, []), d = new Date();
    at.push({ total: state.report.total, when: d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) });
    store.set('attempts.' + s.id, at.slice(-30));
    goStage('inspect');
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
    else if (a === 'lens') { state.lens = !state.lens; renderHUD(); if (!state.lens) showToast('bad', 'تحذير: في الورشة ممنوع تبص للقوس أو اللهب من غير الماسك أو النظارة المناسبة. ده للعرض بس.'); }
    else if (a === 'control') { state.control = state.control === 'rel' ? 'direct' : 'rel'; setAssist(state.assist); renderHUD(); showToast('info', state.control === 'rel' ? 'التحكم الدقيق: اسحب صباعك في أي مكان والحركة بتتنقل للأداة بهدوء.' : 'التحكم المباشر: المس الخط نفسه.'); }
    else if (a === 'assist') { state.assist = !state.assist; setAssist(state.assist); renderHUD(); }
    else if (a === 'new-consumable') { sim.consumable = sim.proc.consumable.len; showToast('info', sim.proc.consumable.newMsg); }
    else if (a === 'finish') finishWeld();
    else if (a === 'slag') { if (sim.startSlagRemoval()) showToast('info', 'بتخبّط الخبث بالشاكوش…'); }
    else if (a === 'defects') { state.showDef = !state.showDef; showDefects(state.showDef); renderPanel(); }
    else if (a === 'finish-station') goHub();
    else if (a === 'sound') { state.sound = audio.enabled = !state.sound; renderTopbar(); }
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
    const s = S();
    if (state.stage === 'weld') weldFrame(dt);
    else if (sim) { sim.time += dt; if (state.stage === 'inspect') sim.updateSlag(dt); sim.updateRipples(); sim.updateSparks(dt); sim.updateSmoke(dt); }
    s && s.frame && s.frame(ctx, dt);
    updateHotspots();
  });

  (async function boot() {
    try {
      await build();
      state.station = 'smaw';
      goHub();
      E.start();
      $('#loading').classList.add('done');
    } catch (e) {
      console.error(e);
      $('#loading').innerHTML = `<p>حصلت مشكلة في تشغيل المجسمات ثلاثية الأبعاد على الجهاز ده.</p><small class="mono">${String(e && e.message || e)}</small>`;
    }
  })();

  if (/[?&]debug/.test(location.search)) window.__wl = {
    state, ctx, goStage, enterStation, goHub, finishWeld, E, sim: () => sim, S,
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

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  return ctx;
}
