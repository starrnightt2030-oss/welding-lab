import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeMaterials, buildRoom, buildTable, buildPlates, buildMachine, buildHolder, buildElectrode, buildClamp, buildPlug, buildHammer, buildBrush, buildElectrodeBox, Cable, TABLE_Y, JOINT } from './models.js';
import { WeldSim, CURRENT_RANGE, IDEAL } from './weld.js';
import { ArcAudio } from './audio.js';
import { PARTS, STATIONS, ASSEMBLY_STEPS, PPE, AR } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const isMobile = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;

const store = {
  get(k, d) { try { const v = localStorage.getItem('weldlab.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('weldlab.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};

const state = {
  stage: 'hub',
  done: store.get('done', {}),
  explore: { sel: 6, labels: false, exploded: false },
  asm: { step: 0, picked: null, msg: null },
  dia: 3.25, current: 150, power: true, ppe: {},
  lens: true, assist: true, angle: 72, sound: true,
  weld: { pressing: false, x: JOINT.x0, arc: 20, msg: null, msgT: 0, out: null },
  report: null
};

// ---------------------------------------------------------------- renderer & scene
const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const PR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
renderer.setPixelRatio(PR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0e11);
scene.fog = new THREE.Fog(0x0c0e11, 4.5, 10);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 30);
camera.position.set(1.7, 1.6, 2.3);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.5; controls.minDistance = 0.12; controls.maxDistance = 4.5;
controls.target.set(0.1, 0.55, 0);

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isMobile ? 2 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 2.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// lights
scene.add(new THREE.HemisphereLight(0xb8c7d9, 0x2e2620, 0.55));
const key = new THREE.SpotLight(0xfff0dc, 42, 9, 0.8, 0.65, 2);
key.position.set(0.9, 2.8, 1.7); key.target.position.set(0.05, 0.5, 0);
key.castShadow = true; key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.camera.near = 0.8; key.shadow.camera.far = 6;
scene.add(key, key.target);
const over = new THREE.SpotLight(0xffe7c4, 6, 4, 0.55, 0.8, 2);
over.position.set(0.3, 2.2, 0.15); over.target.position.set(0.3, TABLE_Y, 0.05); scene.add(over, over.target);
const fill = new THREE.DirectionalLight(0x9cbcff, 0.55); fill.position.set(-2, 1.4, 2.2); scene.add(fill);

// ---------------------------------------------------------------- models
let M, machine, holder, electrode, clamp, plugH, plugG, cableH, cableG, plates, hammer, brush, box, sim;
const audio = new ArcAudio();
const pickables = [];

async function build() {
  try {
    await Promise.all(['600 34px "IBM Plex Mono"', '600 26px "IBM Plex Sans Arabic"'].map(f => document.fonts.load(f)));
  } catch (e) { /* fonts optional */ }
  M = makeMaterials();
  buildRoom(scene);
  scene.add(buildTable(M));
  plates = buildPlates(M); scene.add(plates);
  machine = buildMachine(M); scene.add(machine.root);
  holder = buildHolder(M); scene.add(holder);
  electrode = buildElectrode(M); electrode.position.x = 0.035; holder.add(electrode);
  clamp = buildClamp(M); scene.add(clamp);
  plugH = buildPlug(M, true); plugG = buildPlug(M, false); scene.add(plugH, plugG);
  cableH = new Cable(M); cableG = new Cable(M); scene.add(cableH.mesh, cableG.mesh);
  hammer = buildHammer(M); hammer.position.set(0.68, TABLE_Y + 0.012, -0.15); hammer.rotation.set(0, 0.5, Math.PI / 2 * 0); scene.add(hammer);
  hammer.rotation.x = Math.PI / 2; hammer.rotation.z = 0.4;
  brush = buildBrush(M); brush.position.set(0.05, TABLE_Y, -0.18); brush.rotation.y = -0.3; scene.add(brush);
  box = buildElectrodeBox(M); box.position.set(-0.05, TABLE_Y, 0.2); box.rotation.y = 0.12; scene.add(box);
  sim = new WeldSim(scene);

  const tag = (obj, id) => { obj.userData.pick = id; pickables.push(obj); };
  tag(machine.body, 'machine'); tag(machine.knob, 'knob'); tag(machine.disp, 'display');
  tag(machine.sockets.plus, 'sockets'); tag(machine.sockets.minus, 'sockets');
  tag(cableH.mesh, 'holderCable'); tag(cableG.mesh, 'groundCable');
  tag(holder, 'holder'); tag(electrode, 'electrode'); tag(clamp, 'clamp'); tag(plates, 'plates');
  tag(hammer, 'hammer'); tag(brush, 'brush'); tag(box, 'box'); tag(machine.sw, 'switch');
  tag(plugH, 'plugH'); tag(plugG, 'plugG');
  machine.sw.userData.pick = 'switch';

  setAssembled(true);
  setPower(true);
  updateMachineUI();
}

// ---------------------------------------------------------------- poses
const POSE = {
  holderRest: { p: V3(0.66, TABLE_Y + 0.019, 0.21), r: new THREE.Euler(0, Math.PI + 0.25, -0.05) },
  clampOn: { p: V3(0.86, TABLE_Y - 0.006, -0.06), r: new THREE.Euler(0, Math.PI, 0) },
  clampFloor: { p: V3(0.62, 0.018, 0.62), r: new THREE.Euler(Math.PI / 2, 0, 0.6) },
  plugHFloor: { p: V3(-0.3, 0.017, 0.62), r: new THREE.Euler(0, 1.9, 0) },
  plugGFloor: { p: V3(-0.1, 0.017, 0.7), r: new THREE.Euler(0, 1.2, 0) }
};
const asm = { power: true, plugH: true, plugG: true, clamp: true, electrode: true };

function plugInSocket(plug, k) {
  const s = machine.socketWorld(k);
  plug.position.copy(s).add(V3(0, 0, 0.012));
  plug.rotation.set(0, 0, 0);
}
function applyPose(obj, pose) { obj.position.copy(pose.p); obj.rotation.copy(pose.r); }

function setAssembled(all) {
  Object.keys(asm).forEach(k => asm[k] = all);
  machine.root.updateMatrixWorld(true);
  if (all) { plugInSocket(plugH, 'plus'); plugInSocket(plugG, 'minus'); applyPose(clamp, POSE.clampOn); }
  else { applyPose(plugH, POSE.plugHFloor); applyPose(plugG, POSE.plugGFloor); applyPose(clamp, POSE.clampFloor); }
  applyPose(holder, POSE.holderRest);
  electrode.visible = all;
  electrode.userData.setLength(0.35);
  updateCables();
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3();
function anchorWorld(obj, out) { obj.updateMatrixWorld(true); return out.copy(obj.userData.cableAnchor).applyMatrix4(obj.matrixWorld); }
function dirWorld(obj, local, out) { obj.updateMatrixWorld(true); return out.copy(local).transformDirection(obj.matrixWorld); }
function updateCables(free) {
  anchorWorld(plugH, _a); dirWorld(plugH, V3(0, 0, 1), _d1);
  anchorWorld(holder, _b); dirWorld(holder, V3(-1, 0, 0), _d2);
  cableH.update(_a, _d1, _b, _d2, { bSide: free ? 'free' : 'table', lipX: 0.6 });
  anchorWorld(plugG, _a); dirWorld(plugG, V3(0, 0, 1), _d1);
  anchorWorld(clamp, _b); dirWorld(clamp, V3(-1, 0, 0), _d2);
  cableG.update(_a, _d1, _b, _d2, { bSide: asm.clamp ? 'hang' : 'floor' });
}

function setPower(on) {
  state.power = on;
  machine.sw.userData.rocker.rotation.x = on ? -0.18 : 0.18;
  machine.ledG.material = on ? M.ledGreenOn : M.ledGreenOff;
  machine.drawDisplay(state.current, on);
}
function updateMachineUI() {
  const cur = state.current;
  machine.knob.rotation.z = THREE.MathUtils.degToRad(135 - ((cur - 40) / 160) * 270);
  machine.drawDisplay(cur, state.power);
}

// ---------------------------------------------------------------- highlight
const hiCache = new Map(), hiMats = new Set();
function hiMat(mat) {
  if (Array.isArray(mat)) return mat.map(hiMat);
  if (!mat.emissive) return mat;
  if (!hiCache.has(mat)) { const c = mat.clone(); c.emissive = new THREE.Color(0xff8a2b); c.emissiveIntensity = 0.3; if ('emissiveMap' in c) c.emissiveMap = null; hiCache.set(mat, c); hiMats.add(c); }
  return hiCache.get(mat);
}
let highlighted = [];
function setHighlight(objs) {
  highlighted.forEach(o => o.traverse(m => { if (m.isMesh && m.userData.origMat) { m.material = m.userData.origMat; delete m.userData.origMat; } }));
  highlighted = objs.filter(Boolean);
  highlighted.forEach(o => o.traverse(m => { if (m.isMesh && !m.userData.origMat && !m.userData.noHi) { m.userData.origMat = m.material; m.material = hiMat(m.material); } }));
}

// ---------------------------------------------------------------- tweens & camera
const tweens = [];
function tween(dur, fn, done) { tweens.push({ t: 0, dur, fn, done }); }
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function flyTo(pos, target, dur = 1.1) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  tween(dur, k => { const e = ease(k); camera.position.lerpVectors(p0, pos, e); controls.target.lerpVectors(t0, target, e); });
}
function moveObj(obj, toP, toR, dur = 0.9, onDone, cableFree) {
  const p0 = obj.position.clone(), q0 = obj.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(toR);
  tween(dur, k => {
    const e = ease(k);
    obj.position.lerpVectors(p0, toP, e);
    obj.position.y += Math.sin(Math.PI * e) * 0.12;
    obj.quaternion.slerpQuaternions(q0, q1, e);
    updateCables(cableFree);
  }, onDone);
}

function weldCamera() {
  const aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
  const vf = THREE.MathUtils.degToRad(camera.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  const need = 0.26;  // meters of joint area visible horizontally
  const dist = Math.max(0.24, (need / 2) / Math.tan(hf / 2));
  const t = V3(0.3, JOINT.y, JOINT.z - 0.005);
  const dir = V3(0, 0.62, 0.78).normalize();
  return { pos: t.clone().addScaledVector(dir, dist), target: t };
}

const CAM = {
  hub: () => ({ pos: V3(1.75, 1.55, 2.25), target: V3(0.1, 0.55, 0) }),
  explore: () => ({ pos: V3(0.62, 1.3, 1.42), target: V3(0.08, 0.6, 0.08) }),
  assemble: () => ({ pos: V3(0.3, 1.32, 1.72), target: V3(0.05, 0.42, 0.18) }),
  operate: () => ({ pos: V3(-0.42, 0.56, 0.86), target: V3(-0.6, 0.37, 0.28) }),
  weld: weldCamera,
  inspect: () => ({ pos: V3(0.3, 1.1, 0.2), target: V3(0.3, JOINT.y, 0.05) })
};

// ---------------------------------------------------------------- picking
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.pick) o = o.parent;
    if (o && o.visible !== false) return o.userData.pick;
  }
  return null;
}

let downAt = null;
renderer.domElement.addEventListener('pointerdown', ev => {
  audio.ensure();
  downAt = { x: ev.clientX, y: ev.clientY };
  if (state.stage === 'weld') weldPointer(ev, true);
});
renderer.domElement.addEventListener('pointermove', ev => { if (state.stage === 'weld' && state.weld.pressing) weldPointer(ev, true); });
window.addEventListener('pointerup', ev => {
  if (state.stage === 'weld') { state.weld.pressing = false; return; }
  if (!downAt || ev.target !== renderer.domElement) { downAt = null; return; }
  const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
  downAt = null;
  if (moved > 8) return;
  const id = pick(ev);
  if (id) onPick(id);
});

function onPick(id) {
  if (state.stage === 'explore') {
    const map = { plugH: 'sockets', plugG: 'sockets', switch: 'machine', box: 'electrode' };
    const pid = map[id] || id;
    const i = PARTS.findIndex(p => p.id === pid);
    if (i >= 0) selectPart(i, true);
  } else if (state.stage === 'assemble') asmPick(id);
  else if (state.stage === 'operate' && id === 'switch') { setPower(!state.power); audio.click(); renderPanel(); }
}

// ---------------------------------------------------------------- EXPLORE
function partObject(id) {
  return { machine: machine.body, knob: machine.knob, display: machine.disp, sockets: machine.sockets.plus, holderCable: cableH.mesh, groundCable: cableG.mesh, holder, electrode, clamp, plates, hammer, brush }[id];
}
function partAnchor(id) {
  const v = new THREE.Vector3();
  switch (id) {
    case 'machine': machine.body.localToWorld(v.set(0.15, 0.08, 0.0)); break;
    case 'knob': machine.knob.getWorldPosition(v); break;
    case 'display': machine.disp.getWorldPosition(v); break;
    case 'sockets': machine.sockets.plus.getWorldPosition(v); v.x += 0.06; break;
    case 'holderCable': v.set(0.05, 0.03, 0.62); break;
    case 'groundCable': v.set(0.98, 0.45, 0.12); break;
    case 'holder': holder.localToWorld(v.set(-0.06, 0, 0)); break;
    case 'electrode': holder.localToWorld(v.set(0.25, 0, 0)); break;
    case 'clamp': clamp.getWorldPosition(v); break;
    case 'plates': v.set(0.3, JOINT.y, 0.05); break;
    case 'hammer': hammer.getWorldPosition(v); break;
    case 'brush': brush.getWorldPosition(v); v.y += 0.02; break;
  }
  return v;
}
function selectPart(i, fly) {
  state.explore.sel = i;
  const p = PARTS[i];
  setHighlight([partObject(p.id)].concat(p.id === 'sockets' ? [machine.sockets.minus] : []));
  if (fly) {
    const a = partAnchor(p.id);
    const far = ['machine', 'holderCable', 'groundCable'].includes(p.id) ? 0.95 : ['plates', 'clamp', 'holder', 'electrode', 'hammer', 'brush'].includes(p.id) ? 0.55 : 0.42;
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (['knob', 'display', 'sockets'].includes(p.id)) dir.set(0.25, 0.25, 1).normalize();
    flyTo(a.clone().addScaledVector(dir, far), a, 0.9);
  }
  renderPanel();
}

// exploded view
const explodeItems = () => [
  { o: machine.knob, d: V3(0, 0, 0.07), local: true },
  { o: machine.disp, d: V3(0, 0, 0.045), local: true },
  { o: plugH, d: V3(0, 0.02, 0.12) },
  { o: plugG, d: V3(0, 0.02, 0.12) },
  { o: holder, d: V3(0.04, 0.16, 0.06) },
  { o: electrode, d: V3(0.09, 0, 0), local: true },
  { o: clamp, d: V3(0.12, 0.1, 0.0) },
  { o: hammer, d: V3(0.0, 0.1, -0.05) },
  { o: brush, d: V3(0.0, 0.1, -0.05) }
];
let explodeBase = null, explodeK = 0;
function setExploded(on) {
  if (!explodeBase) explodeBase = explodeItems().map(it => ({ ...it, base: it.o.position.clone() }));
  const from = explodeK, to = on ? 1 : 0;
  tween(0.9, k => {
    explodeK = from + (to - from) * ease(k);
    explodeBase.forEach(it => it.o.position.copy(it.base).addScaledVector(it.d, explodeK));
    updateCables();
  }, () => { if (!on) explodeBase = null; });
}

// hotspots (projected HTML badges)
const hotLayer = $('#hotspots');
function renderHotspots() {
  hotLayer.innerHTML = '';
  if (state.stage !== 'explore') return;
  PARTS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'hot'; b.type = 'button'; b.dataset.i = i;
    b.setAttribute('aria-label', p.name);
    b.innerHTML = `<span class="n">${AR(i + 1)}</span><span class="t">${p.name}</span>`;
    b.addEventListener('click', () => selectPart(i, true));
    hotLayer.appendChild(b);
  });
}
const _p = new THREE.Vector3();
function updateHotspots() {
  if (state.stage !== 'explore') return;
  const w = viewport.clientWidth, h = viewport.clientHeight;
  [...hotLayer.children].forEach(b => {
    const i = +b.dataset.i, p = PARTS[i];
    _p.copy(partAnchor(p.id)).project(camera);
    const vis = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
    b.style.display = vis ? '' : 'none';
    b.style.transform = `translate(${(_p.x * 0.5 + 0.5) * w}px, ${(-_p.y * 0.5 + 0.5) * h}px)`;
    b.classList.toggle('on', i === state.explore.sel);
    b.classList.toggle('lbl', state.explore.labels || i === state.explore.sel);
  });
}

// ---------------------------------------------------------------- ASSEMBLE
function startAssembly() {
  state.asm = { step: 0, picked: null, msg: null };
  if (explodeK > 0) { explodeBase && explodeBase.forEach(it => it.o.position.copy(it.base)); explodeK = 0; explodeBase = null; }
  setAssembled(false);
  setPower(true);
  asm.power = false;
  highlightAsmTarget();
}
function asmTargets() {
  const s = ASSEMBLY_STEPS[state.asm.step];
  if (!s) return [];
  if (s.id === 'power') return [machine.sw];
  if (s.id === 'holderPlug') return state.asm.picked ? [machine.sockets.plus, machine.sockets.minus] : [plugH];
  if (s.id === 'groundPlug') return state.asm.picked ? [machine.sockets.minus] : [plugG];
  if (s.id === 'clamp') return [clamp];
  if (s.id === 'electrode') return [box];
  return [];
}
function highlightAsmTarget() { setHighlight(asmTargets()); renderPanel(); }
function asmMsg(t, s) { state.asm.msg = { t, s }; renderPanel(); }

function asmPick(id) {
  const step = ASSEMBLY_STEPS[state.asm.step];
  if (!step) return;
  // safety: anything else while power is on
  if (state.power && step.id !== 'power' && id !== 'switch') { asmMsg('bad', 'خطر! الماكينة لسه شغالة. ماينفعش توصّل أي كابل والماكينة شغالة.'); return; }
  const sockId = (id === 'sockets') ? null : id;
  switch (step.id) {
    case 'power':
      if (id === 'switch') { setPower(false); audio.click(); next('الماكينة اتطفت. كده آمن تبدأ التوصيل.'); }
      else asmMsg('bad', 'استنى! أول خطوة دايماً إنك تطفي الماكينة قبل أي توصيل.');
      break;
    case 'holderPlug':
    case 'groundPlug': {
      const isH = step.id === 'holderPlug';
      const plug = isH ? plugH : plugG;
      if (!state.asm.picked) {
        if (id === (isH ? 'plugH' : 'plugG')) { state.asm.picked = true; asmMsg('info', 'تمام. دلوقتي المس الطرف اللي هتوصّل فيه الفيشة.'); highlightAsmTarget(); }
        else if (id === (isH ? 'plugG' : 'plugH')) asmMsg('bad', isH ? 'دي فيشة كابل الأرضي. ابدأ بكابل الماسك (الكابل اللي رايح لماسك القطب).' : 'كابل الماسك اتوصّل خلاص. المس فيشة كابل الأرضي.');
        else asmMsg('bad', 'المس الفيشة اللي على الأرض الأول.');
        return;
      }
      // waiting for socket: identify which socket by raycast object
      if (id !== 'sockets') { asmMsg('bad', 'المس واحد من أطراف التوصيل في الماكينة (+ أو −).'); return; }
      const which = lastSocketHit;
      if (isH && which === 'minus') { asmMsg('bad', 'كده القطبية مباشرة (DCEN). في التمرين ده بنستخدم القطبية العكسية: الماسك على الموجب (+).'); return; }
      if (!isH && which === 'plus') { asmMsg('bad', 'الطرف الموجب عليه كابل الماسك خلاص. الأرضي بيروح للسالب (−).'); return; }
      const s = machine.socketWorld(which).add(V3(0, 0, 0.012));
      state.asm.picked = null; setHighlight([]);
      moveObj(plug, s, new THREE.Euler(0, 0, 0), 1.0, () => { asm[isH ? 'plugH' : 'plugG'] = true; audio.click(); next(isH ? 'ممتاز! الماسك على الموجب = قطبية عكسية DCEP.' : 'تمام! كابل الأرضي على السالب، والدايرة قربت تكمل.'); });
      break;
    }
    case 'clamp':
      if (id === 'clamp') { setHighlight([]); moveObj(clamp, POSE.clampOn.p, POSE.clampOn.r, 1.0, () => { asm.clamp = true; updateCables(); next('ماسك الأرضي متثبّت على الطاولة المعدنية. الطاولة متلامسة مع قطع الشغل.'); }); }
      else asmMsg('bad', 'المس ماسك الأرضي (المشبك الأحمر اللي على الأرض).');
      break;
    case 'electrode':
      if (id === 'box') {
        setHighlight([]);
        electrode.visible = true;
        electrode.position.set(0.25, 0.05, 0.25);
        const p0 = electrode.position.clone();
        tween(0.9, k => { electrode.position.lerpVectors(p0, V3(0.035, 0, 0), ease(k)); }, () => { asm.electrode = true; next('القطب اتركّب من طرفه العاري. المعدة جاهزة للتشغيل!'); });
      } else asmMsg('bad', 'المس علبة الأقطاب اللي على الطاولة.');
      break;
  }
}
let lastSocketHit = null;
renderer.domElement.addEventListener('pointerup', ev => {
  // find which socket was hit (for polarity check)
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hp = ray.intersectObject(machine.sockets.plus, true)[0], hm = ray.intersectObject(machine.sockets.minus, true)[0];
  lastSocketHit = hp && (!hm || hp.distance < hm.distance) ? 'plus' : hm ? 'minus' : null;
}, true);

function next(msg) {
  state.asm.step++;
  state.asm.msg = { t: 'good', s: msg };
  if (state.asm.step >= ASSEMBLY_STEPS.length) markDone('assemble');
  highlightAsmTarget();
}

// ---------------------------------------------------------------- WELD
const weldPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -JOINT.y);
const _hit = new THREE.Vector3();
function weldPointer(ev, pressing) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(weldPlane, _hit)) return;
  state.weld.pressing = pressing;
  state.weld.x = _hit.x;
  // finger above the joint line on screen (= farther away, negative z) lengthens the arc
  const dzmm = (JOINT.z - _hit.z) * 1000;
  state.weld.arc = Math.max(0, dzmm * 0.42);
}

const tipPos = new THREE.Vector3(0.22, JOINT.y + 0.03, JOINT.z);
function poseHolderForWeld(dt) {
  const w = state.weld;
  const target = new THREE.Vector3(w.x, JOINT.y + (w.pressing ? Math.max(0.0003, w.arc / 1000) : 0.025), JOINT.z);
  tipPos.lerp(target, 1 - Math.pow(0.0005, dt));
  const tilt = THREE.MathUtils.degToRad(90 - state.angle);
  const side = THREE.MathUtils.degToRad(12);
  const dir = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt) * Math.cos(side), Math.cos(tilt) * Math.sin(side)).normalize();
  const L = sim.electrodeLen;
  electrode.userData.setLength(L);
  holder.quaternion.setFromUnitVectors(V3(1, 0, 0), dir.clone().negate());
  holder.position.copy(tipPos).addScaledVector(dir, 0.035 + L);
}

let cableTick = 0;
function weldFrame(dt) {
  const w = state.weld;
  const out = sim.step({ pressing: w.pressing, x: w.x, arcLen: w.arc, angle: state.angle }, dt);
  w.out = out;
  if (out.msg) showToast(out.msg.t, out.msg.s);
  poseHolderForWeld(dt);
  electrode.userData.setHot(sim.arcOn ? 1 : Math.max(0, (electrode.userData.hot || 0) - dt));
  if ((cableTick++ & 1) === 0) updateCables(true);
  audio.update(sim.arcOn, w.arc / state.dia);
  // helmet lens view
  const lensOn = state.lens && sim.arcOn;
  $('#lens').classList.toggle('on', lensOn);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, lensOn ? 0.28 : 1, 1 - Math.pow(0.001, dt));
  updateHUD(out);
  if (out.progress >= 0.999 && !sim.arcOn && !w.finishedPrompted) { w.finishedPrompted = true; showToast('good', 'خلّصت الخط! دوس «افحص الخط» عشان تشوف النتيجة.'); }
}

let assistMesh;
function setAssist(on) {
  if (!assistMesh) {
    const g = new THREE.PlaneGeometry(JOINT.x1 - JOINT.x0, 0.006);
    assistMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.22, depthWrite: false }));
    assistMesh.rotation.x = -Math.PI / 2;
    const ideal = state.dia / 0.42 / 1000; // finger offset for ideal arc
    assistMesh.position.set((JOINT.x0 + JOINT.x1) / 2, JOINT.y + 0.0004, JOINT.z - ideal);
    const startM = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0052, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 0.3), toneMapped: false, depthWrite: false, transparent: true }));
    startM.rotation.x = -Math.PI / 2; assistMesh.userData.ring = startM;
    scene.add(assistMesh, startM);
  }
  const ideal = state.dia / 0.42 / 1000;
  assistMesh.position.z = JOINT.z - ideal;
  assistMesh.visible = on;
  assistMesh.userData.ring.position.set(JOINT.x0 + 0.002, JOINT.y + 0.0006, JOINT.z - ideal);
  assistMesh.userData.ring.visible = on;
}

// ---------------------------------------------------------------- INSPECT
let defectGroup;
function showDefects(on) {
  if (defectGroup) { scene.remove(defectGroup); defectGroup = null; }
  if (!on || !state.report) return;
  defectGroup = new THREE.Group();
  const col = { good: 0x3ddc97, warn: 0xffb020, bad: 0xff6b5c };
  state.report.bins.forEach(b => {
    if (b.state === 'none') return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.0095, 0.004), new THREE.MeshBasicMaterial({ color: col[b.state], toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(JOINT.x0 + b.i * 0.01 + 0.005, JOINT.y + 0.0003, JOINT.z + 0.016);
    defectGroup.add(m);
  });
  scene.add(defectGroup);
}

// ---------------------------------------------------------------- stage control
function markDone(k) { state.done[k] = true; store.set('done', state.done); }

function goStage(st) {
  const prev = state.stage;
  if (prev === 'weld') { audio.update(false); $('#lens').classList.remove('on'); renderer.toneMappingExposure = 1; sim.setArcVisible(false); }
  if (prev === 'explore' && explodeK > 0 && explodeBase) { explodeBase.forEach(it => it.o.position.copy(it.base)); explodeK = 0; explodeBase = null; state.explore.exploded = false; updateCables(); }
  state.stage = st;
  document.body.dataset.stage = st;
  controls.enabled = st !== 'weld';
  controls.autoRotate = st === 'hub';
  controls.autoRotateSpeed = 0.5;
  setHighlight([]);
  if (st !== 'inspect') showDefects(false);
  if (assistMesh) { assistMesh.visible = false; assistMesh.userData.ring.visible = false; }

  if (st === 'explore') { if (!asm.electrode || !asm.plugH) setAssembled(true); applyPose(holder, POSE.holderRest); updateCables(); selectPart(state.explore.sel, false); }
  if (st === 'assemble') startAssembly();
  if (st === 'operate') { if (!asm.electrode) setAssembled(true); applyPose(holder, POSE.holderRest); updateCables(); updateMachineUI(); setHighlight([machine.knob]); setTimeout(() => setHighlight([]), 1500); }
  if (st === 'weld') {
    if (!asm.electrode) setAssembled(true);
    if (!state.power) setPower(true);
    sim.reset({ dia: state.dia, current: state.current });
    state.report = null; state.showDef = false;
    state.weld = { pressing: false, x: JOINT.x0 - 0.02, arc: 25, out: null };
    tipPos.set(JOINT.x0 - 0.02, JOINT.y + 0.03, JOINT.z);
    setAssist(state.assist);
    electrode.userData.setLength(0.35);
  }
  if (st === 'inspect') {
    if (!state.report) state.report = sim.evaluate();
    applyPose(holder, POSE.holderRest); electrode.userData.setLength(sim.electrodeLen); updateCables();
  }
  renderTopbar(); renderPanel(); renderHotspots(); renderHUD();
  onResize();
  const c = CAM[st]();
  flyTo(c.pos, c.target, prev === st ? 0.01 : 1.2);
}

// ---------------------------------------------------------------- UI rendering
const STEPS = [['explore', 'اتعرّف'], ['assemble', 'ركّب'], ['operate', 'شغّل'], ['weld', 'الحم'], ['inspect', 'افحص']];
const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  present: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v5h5"/></svg>',
  explode: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7"/></svg>',
  lens: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9c0-3 3.6-5 8-5s8 2 8 5v4c0 4-3.6 7-8 7s-8-3-8-7V9z"/><rect x="7" y="9" width="10" height="4" rx="1"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c4 0 7-2.7 7-6.5 0-3.7-3-6-4-9.5-2 2-2.5 4-2.5 4S10 7 9 3C6.5 6 5 9.5 5 15.5 5 19.3 8 22 12 22z"/></svg>'
};
const STATION_ICON = { safety: ICON.shield, smaw: ICON.bolt, oaw: ICON.flame, caw: '<svg viewBox="0 0 24 24"><path d="M5 19L19 5M15 5h4v4M5 15l4 4"/></svg>', tig: '<svg viewBox="0 0 24 24"><path d="M4 20l6-6M10 14l7-7 3 3-7 7zM14 4l6 6"/></svg>', mig: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>' };

function renderTopbar() {
  const st = state.stage;
  const inStation = st !== 'hub';
  $('#tb-back').hidden = !inStation;
  $('#tb-title').innerHTML = inStation
    ? `<b>اللحام بالقوس الكهربي</b><small class="mono">SMAW</small>`
    : `<b>معمل اللحام الافتراضي</b><small>قسم اللحام — المدرسة الثانوية الصناعية</small>`;
  const nav = $('#stepper');
  nav.hidden = !inStation;
  if (inStation) {
    const cur = STEPS.findIndex(s => s[0] === st);
    nav.innerHTML = STEPS.map(([k, label], i) => {
      const cls = i === cur ? 'on' : (state.done[k] ? 'done' : '');
      return `<button type="button" class="step ${cls}" data-go="${k}">${state.done[k] && i !== cur ? `<i>${ICON.check}</i>` : `<i>${AR(i + 1)}</i>`}<span>${label}</span></button>`;
    }).join('<span class="sep" aria-hidden="true"></span>');
  }
  $('#tb-sound').innerHTML = state.sound ? ICON.sound : ICON.mute;
}

function panelHTML() {
  const st = state.stage;
  if (st === 'hub') return hubHTML();
  if (st === 'explore') {
    const p = PARTS[state.explore.sel];
    return `
      <div class="ph"><h2>المكونات</h2><span class="muted">المس رقم في المجسم أو هنا</span></div>
      <div class="chips">${PARTS.map((q, i) => `<button type="button" class="chip ${i === state.explore.sel ? 'on' : ''}" data-part="${i}" aria-label="${q.name}">${AR(i + 1)}</button>`).join('')}</div>
      <article class="card part">
        <header><span class="badge">${AR(state.explore.sel + 1)}</span><div><h3>${p.name}</h3><span class="mono muted">${p.en}</span></div></header>
        <p>${p.desc}</p>
        <ul class="facts">${p.facts.map(f => `<li>${f}</li>`).join('')}</ul>
        <div class="safety">${ICON.shield}<div><b>سلامة</b><span>${p.safety}</span></div></div>
      </article>
      <div class="row2">
        <button type="button" class="btn ${state.explore.labels ? 'on' : ''}" data-act="labels">${ICON.list}الأسماء</button>
        <button type="button" class="btn ${state.explore.exploded ? 'on' : ''}" data-act="explode">${ICON.explode}${state.explore.exploded ? 'تجميع' : 'تفكيك'}</button>
      </div>
      <button type="button" class="btn primary big" data-go="assemble" data-mark="explore">التالي: ركّب المعدة ${ICON.next}</button>`;
  }
  if (st === 'assemble') {
    const s = state.asm.step;
    const list = ASSEMBLY_STEPS.map((x, i) => {
      const cls = i < s ? 'done' : i === s ? 'cur' : '';
      return `<li class="${cls}"><i>${i < s ? ICON.check : AR(i + 1)}</i><div><b>${x.title}</b>${i === s ? `<span>${x.hint}</span>` : ''}</div></li>`;
    }).join('');
    const m = state.asm.msg;
    const done = s >= ASSEMBLY_STEPS.length;
    return `
      <div class="ph"><h2>خطوات التركيب</h2><span class="mono accent">${Math.min(s, 5)} / 5</span></div>
      <ol class="steps">${list}</ol>
      ${m ? `<div class="msg ${m.t}" role="status">${m.t === 'bad' ? ICON.x : m.t === 'good' ? ICON.check : ICON.info}<span>${m.s}</span></div>` : ''}
      <div class="grow"></div>
      <div class="row2">
        <button type="button" class="btn" data-act="asm-reset">${ICON.reset}ابدأ من الأول</button>
        <button type="button" class="btn" data-act="asm-auto">${ICON.next}نفّذ الخطوة</button>
      </div>
      <button type="button" class="btn primary big" data-go="operate" ${done ? '' : 'disabled'}>التالي: شغّل الماكينة ${ICON.next}</button>`;
  }
  if (st === 'operate') {
    const [lo, hi] = CURRENT_RANGE[state.dia];
    const cur = state.current;
    const status = cur < lo ? ['low', 'أقل من اللازم', 'التيار قليل: القطب هيلزق في الشغلانة والاختراق هيبقى ضعيف. زوّد التيار.']
      : cur > hi ? ['high', 'أعلى من اللازم', 'التيار عالي: رذاذ كتير وتآكل في الحواف، والقطب هيسخن ويحمرّ. قلّل التيار.']
      : ['ok', 'مظبوط', 'التيار في المدى المناسب. ابدأ بالقيمة دي وعدّلها حسب شكل الخط.'];
    const pct = v => ((v - 40) / 160) * 100;
    const ppeOK = PPE.every(p => state.ppe[p.id]);
    const ready = status[0] === 'ok' && ppeOK && state.power;
    return `
      <section class="card">
        <h3 class="sm">قطر القطب (E6013)</h3>
        <div class="seg3">${[2.5, 3.25, 4].map(d => `<button type="button" class="${state.dia === d ? 'on' : ''}" data-dia="${d}"><span class="mono">${d}</span> مم</button>`).join('')}</div>
      </section>
      <section class="card">
        <div class="ph"><h3 class="sm">شدة التيار</h3><span class="tag ${status[0]}">${status[1]}</span></div>
        <div class="cur-ctl">
          <button type="button" class="round" data-act="cur-" aria-label="قلّل التيار"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
          <div class="cur-val"><span class="mono">${cur}</span><small class="mono">A</small></div>
          <button type="button" class="round acc" data-act="cur+" aria-label="زوّد التيار"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
        </div>
        <input type="range" min="40" max="200" step="5" value="${cur}" id="cur-range" aria-label="شدة التيار بالأمبير">
        <div class="meter" dir="ltr"><div class="zone" style="left:${pct(lo)}%;width:${pct(hi) - pct(lo)}%"></div><div class="mark ${status[0]}" style="left:${pct(cur)}%"></div></div>
        <div class="scale mono" dir="ltr"><span>40</span><span class="ok-t">${lo}–${hi} A</span><span>200</span></div>
        <p class="muted small">${status[2]}</p>
      </section>
      <section class="card">
        <h3 class="sm">القطبية</h3>
        <p class="small">الماسك متوصّل على الموجب = <b class="mono accent">DC+</b> قطبية عكسية (اختراق أعمق). القطبية بتتحدد من التوصيل في مرحلة «ركّب».</p>
      </section>
      <section class="card">
        <h3 class="sm">قبل ما تقدح القوس — البس مهمات الوقاية</h3>
        <div class="ppe">${PPE.map(p => `<button type="button" class="${state.ppe[p.id] ? 'on' : ''}" data-ppe="${p.id}">${state.ppe[p.id] ? ICON.check : ICON.shield}${p.name}</button>`).join('')}</div>
      </section>
      <div class="row2">
        <button type="button" class="btn ${state.power ? 'on-green' : ''}" data-act="power">${ICON.bolt}${state.power ? 'الماكينة شغالة' : 'شغّل الماكينة'}</button>
      </div>
      <button type="button" class="btn primary big" data-go="weld" data-mark="operate" ${ready ? '' : 'disabled'}>${ready ? 'ابدأ اللحام' : !ppeOK ? 'البس مهمات الوقاية الأول' : !state.power ? 'شغّل الماكينة الأول' : 'اظبط التيار الأول'} ${ICON.next}</button>`;
  }
  if (st === 'inspect') {
    const R = state.report;
    if (!R || R.empty) return `<div class="card"><h3>مافيش خط لحام لسه</h3><p class="muted">ارجع لمرحلة «الحم» ونفّذ خط على الوصلة.</p></div><button type="button" class="btn primary big" data-go="weld">ارجع للحام ${ICON.next}</button>`;
    const C = 2 * Math.PI * 62;
    const attempts = store.get('attempts', []).slice(-5).reverse();
    return `
      <section class="card score">
        <svg viewBox="0 0 150 150" class="ring" role="img" aria-label="الدرجة ${R.total} من ١٠٠"><circle cx="75" cy="75" r="62" class="bg"/><circle cx="75" cy="75" r="62" class="fg" stroke-dasharray="${(C * R.total / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 75 75)"/><text x="75" y="86" class="mono">${R.total}</text></svg>
        <div><b class="grade">${R.grade}</b><span class="muted small">غطّيت ${AR(Math.round(R.coverage * 100))}٪ من الوصلة • متوسط السرعة <span class="mono">${R.avgSpeed.toFixed(1)}</span> مم/ث • متوسط القوس <span class="mono">${R.avgArc.toFixed(1)}</span> مم</span></div>
      </section>
      <section class="card">
        <h3 class="sm">تفاصيل الأداء</h3>
        ${R.crit.map(c => `<div class="crit"><span>${c.label}</span><div class="bar" dir="ltr"><i style="width:${c.v}%" class="${c.v >= 75 ? 'g' : c.v >= 50 ? 'w' : 'b'}"></i></div><b class="mono">${c.v}</b></div>`).join('')}
      </section>
      <section class="card">
        <h3 class="sm">العيوب اللي ظهرت</h3>
        ${R.defects.length ? R.defects.map((d, i) => `<div class="defect"><i>${AR(i + 1)}</i><div><b>${d.name} <small class="mono muted">${d.en}</small></b><span><b>السبب:</b> ${d.cause}</span><span><b>العلاج:</b> ${d.fix}</span></div></div>`).join('') : '<p class="good-t">مافيش عيوب واضحة. شغل نضيف!</p>'}
      </section>
      <section class="card">
        <h3 class="sm">قطاع عرضي تقريبي</h3>
        ${sectionSVG(R)}
      </section>
      ${attempts.length > 1 ? `<section class="card"><h3 class="sm">آخر محاولاتك</h3><div class="attempts">${attempts.map(a => `<span><b class="mono">${a.total}</b><small>${a.when}</small></span>`).join('')}</div></section>` : ''}
      <div class="row2">
        <button type="button" class="btn" data-act="slag">${ICON.reset}شيل الخبث</button>
        <button type="button" class="btn ${state.showDef ? 'on' : ''}" data-act="defects">${ICON.target}إظهار الأخطاء</button>
      </div>
      <div class="row2">
        <button type="button" class="btn" data-go="weld">${ICON.reset}حاول تاني</button>
        <button type="button" class="btn primary" data-go="hub" data-mark="inspect">إنهاء المحطة</button>
      </div>`;
  }
  return '';
}

function sectionSVG(R) {
  const w = R.width, h = R.height, p = R.penetration;
  const sx = 12; // px per mm
  const cx = 190, top = 70, T = 6 * sx;
  const hw = w / 2 * sx, hh = h * sx, pen = T * Math.min(1.1, p);
  return `<svg viewBox="0 0 380 200" class="xsec" role="img" aria-label="قطاع عرضي: عرض ${w.toFixed(1)} مم وارتفاع ${h.toFixed(1)} مم">
    <rect x="20" y="${top}" width="${cx - 22}" height="${T}" class="pl"/><rect x="${cx + 2}" y="${top}" width="${cx - 22}" height="${T}" class="pl"/>
    <path d="M${cx - hw},${top} Q${cx},${top - hh * 2} ${cx + hw},${top} L${cx + 4},${top + pen} Q${cx},${top + pen + 6} ${cx - 4},${top + pen} Z" class="wm"/>
    <line x1="${cx - hw}" y1="${top - hh - 16}" x2="${cx + hw}" y2="${top - hh - 16}" class="dim"/>
    <text x="${cx}" y="${top - hh - 24}" text-anchor="middle">عرض ${w.toFixed(1)} مم</text>
    <text x="${cx + hw + 10}" y="${top - hh / 2}" >ارتفاع ${h.toFixed(1)} مم</text>
    <text x="${cx}" y="${top + T + 34}" text-anchor="middle">${p >= 0.95 ? 'اختراق كامل للجذر' : p >= 0.7 ? 'اختراق جزئي' : 'اختراق ضعيف'}</text>
  </svg>`;
}

function renderPanel() {
  const panel = $('#panel');
  if (state.stage === 'weld') { panel.innerHTML = ''; return; }
  const scroll = panel.scrollTop;
  panel.innerHTML = panelHTML();
  panel.scrollTop = scroll;
  const r = $('#cur-range');
  if (r) r.addEventListener('input', () => { state.current = +r.value; updateMachineUI(); renderPanelSoon(); });
}
let panelTimer;
function renderPanelSoon() { clearTimeout(panelTimer); panelTimer = setTimeout(renderPanel, 120); }

// weld HUD
function renderHUD() {
  const hud = $('#hud');
  if (state.stage !== 'weld') { hud.innerHTML = ''; return; }
  const [lo, hi] = CURRENT_RANGE[state.dia];
  hud.innerHTML = `
    <div class="gauges">
      <div class="g" id="g-angle"><span class="l">زاوية القطب</span><b class="mono v">--</b><div class="m" dir="ltr"><i class="z"></i><i class="n"></i></div><small class="mono t">${IDEAL.angle[0]}–${IDEAL.angle[1]}°</small></div>
      <div class="g" id="g-speed"><span class="l">سرعة التقدّم</span><b class="mono v">--</b><div class="m" dir="ltr"><i class="z"></i><i class="n"></i></div><small class="mono t">${IDEAL.speed[0]}–${IDEAL.speed[1]} mm/s</small></div>
      <div class="g" id="g-arc"><span class="l">طول القوس</span><b class="mono v">--</b><div class="m" dir="ltr"><i class="z"></i><i class="n"></i></div><small class="t">≈ قطر القطب (${state.dia} مم)</small></div>
      <div class="g" id="g-cur"><span class="l">شدة التيار</span><b class="mono v">${state.current} A</b><small class="mono t">${lo}–${hi} A</small></div>
    </div>
    <div class="angle-ctl"><label for="angle">الزاوية</label><input id="angle" type="range" min="40" max="90" value="${state.angle}" orient="vertical" aria-label="زاوية القطب"><b class="mono" id="angle-v">${state.angle}°</b></div>
    <div class="weld-tools">
      <button type="button" class="btn ${state.lens ? 'on-green' : ''}" data-act="lens">${ICON.lens}<span>العدسة</span></button>
      <button type="button" class="btn ${state.assist ? 'on' : ''}" data-act="assist">${ICON.target}<span>مساعد</span></button>
      <button type="button" class="btn" data-act="new-electrode">${ICON.reset}<span>قطب جديد</span></button>
      <button type="button" class="btn primary" data-act="finish">افحص الخط ${ICON.next}</button>
    </div>
    <div class="weld-bottom">
      <div class="prog"><span>تقدّم الخط</span><div class="bar"><i id="prog-i"></i></div><b class="mono" id="prog-v">0%</b></div>
      <div class="elec"><span>القطب</span><div class="bar"><i id="elec-i"></i></div><b class="mono" id="elec-v">350 mm</b></div>
      <div class="hint" id="weld-hint">المس الدايرة البرتقالي عند بداية الوصلة وحرّك صباعك ببطء لليمين. ارفع صباعك فوق الخط الأخضر يطوّل القوس، ونزّله يقصّره.</div>
    </div>`;
  const a = $('#angle');
  a.addEventListener('input', () => { state.angle = +a.value; $('#angle-v').textContent = state.angle + '°'; });
}
function gauge(id, val, txt, min, max, lo, hi) {
  const g = document.getElementById(id); if (!g) return;
  g.querySelector('.v').textContent = txt;
  const pct = v => THREE.MathUtils.clamp((v - min) / (max - min) * 100, 0, 100);
  const z = g.querySelector('.z'), n = g.querySelector('.n');
  if (z) { z.style.left = pct(lo) + '%'; z.style.width = (pct(hi) - pct(lo)) + '%'; }
  if (n) n.style.left = pct(val) + '%';
  const st = val == null ? '' : val < lo ? 'warn' : val > hi ? 'warn' : 'good';
  const far = val != null && (val < lo - (hi - lo) * 0.8 || val > hi + (hi - lo) * 0.8);
  g.dataset.s = far ? 'bad' : st;
}
let hudT = 0;
function updateHUD(out) {
  if ((hudT += 1) % 3) return;
  const w = state.weld, d = state.dia;
  gauge('g-angle', state.angle, state.angle + '°', 40, 90, IDEAL.angle[0], IDEAL.angle[1]);
  gauge('g-speed', sim.arcOn ? out.speed : null, sim.arcOn ? out.speed.toFixed(1) : '--', 0, 9, IDEAL.speed[0], IDEAL.speed[1]);
  gauge('g-arc', w.pressing ? w.arc : null, w.pressing ? w.arc.toFixed(1) + ' mm' : '--', 0, 9, d * IDEAL.arcK[0], d * IDEAL.arcK[1]);
  const pi = $('#prog-i'); if (pi) { pi.style.width = (out.progress * 100) + '%'; $('#prog-v').textContent = Math.round(out.progress * 100) + '%'; }
  const ei = $('#elec-i'); if (ei) { ei.style.width = ((out.electrodeLen - 0.05) / 0.3 * 100) + '%'; $('#elec-v').textContent = Math.round(out.electrodeLen * 1000) + ' mm'; }
  // live coaching
  if (sim.arcOn) {
    let tip = null;
    if (out.speed > IDEAL.speed[1] + 0.8) tip = 'سرعتك عالية — بطّأ حركة إيدك';
    else if (out.speed < IDEAL.speed[0] - 0.8 && sim.time > 1) tip = 'سرعتك بطيئة — حرّك أسرع شوية';
    else if (w.arc > d * IDEAL.arcK[1] + 0.4) tip = 'القوس طويل — قرّب القطب';
    else if (w.arc < d * IDEAL.arcK[0] - 0.3) tip = 'القوس قصير — ارفع القطب شوية';
    else if (state.angle < IDEAL.angle[0] - 3 || state.angle > IDEAL.angle[1] + 3) tip = 'اظبط زاوية القطب بين ٦٥ و٨٠ درجة';
    const h = $('#coach');
    if (tip) { h.textContent = tip; h.classList.add('on'); } else h.classList.remove('on');
  } else $('#coach').classList.remove('on');
}

let toastTimer;
function showToast(t, s) {
  const el = $('#toast');
  el.className = 'toast on ' + t; el.innerHTML = (t === 'bad' ? ICON.x : t === 'good' ? ICON.check : ICON.info) + `<span>${s}</span>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 3800);
}

// hub
function renderHub() { if (state.stage === 'hub') renderPanel(); }
function hubHTML() {
  const n = Object.keys(state.done).filter(k => STEPS.some(s => s[0] === k)).length;
  return `<div class="ph"><h2>محطات المعمل</h2><span class="muted">${AR(STATIONS.length)} محطات</span></div>` + STATIONS.map(s => `
    <button type="button" class="station ${s.ready ? 'ready' : ''}" ${s.ready ? `data-go="explore"` : 'disabled'}>
      <span class="ic">${STATION_ICON[s.id]}</span>
      <span class="tx"><b>${s.name}</b><small class="mono">${s.code}</small></span>
      <span class="st">${s.ready ? (n ? `${AR(n)} من ٥` : 'ابدأ') : 'قريباً'}</span>
    </button>`).join('') + `<p class="muted small hub-note">المحطة المتاحة دلوقتي: القوس الكهربي. باقي المحطات بتتبني بنفس الطريقة.</p>`;
}

// ---------------------------------------------------------------- events
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-go],[data-act],[data-part],[data-dia],[data-ppe]');
  if (!el || el.disabled) return;
  audio.ensure();
  if (el.dataset.mark) markDone(el.dataset.mark);
  if (el.dataset.go) {
    if (el.dataset.go === 'inspect' && state.stage === 'weld') state.report = null;
    if (el.dataset.go === 'hub') renderHub();
    goStage(el.dataset.go); return;
  }
  if (el.dataset.part) { selectPart(+el.dataset.part, true); return; }
  if (el.dataset.dia) { state.dia = +el.dataset.dia; renderPanel(); return; }
  if (el.dataset.ppe) { state.ppe[el.dataset.ppe] = !state.ppe[el.dataset.ppe]; audio.click(); renderPanel(); return; }
  const a = el.dataset.act;
  if (a === 'labels') { state.explore.labels = !state.explore.labels; renderPanel(); }
  if (a === 'explode') { state.explore.exploded = !state.explore.exploded; setExploded(state.explore.exploded); renderPanel(); }
  if (a === 'asm-reset') startAssembly();
  if (a === 'asm-auto') autoStep();
  if (a === 'cur-' || a === 'cur+') { state.current = THREE.MathUtils.clamp(state.current + (a === 'cur+' ? 5 : -5), 40, 200); updateMachineUI(); renderPanel(); }
  if (a === 'power') { setPower(!state.power); audio.click(); renderPanel(); }
  if (a === 'lens') { state.lens = !state.lens; renderHUD(); if (!state.lens) showToast('bad', 'تحذير: في الورشة ممنوع تبص للقوس من غير ماسك اللحام؛ ضوء القوس بيحرق العين. ده للعرض بس.'); }
  if (a === 'assist') { state.assist = !state.assist; setAssist(state.assist); renderHUD(); }
  if (a === 'new-electrode') { sim.electrodeLen = 0.35; showToast('info', 'ركّبت قطب جديد. كمّل من آخر نقطة.'); }
  if (a === 'finish') { finishWeld(); }
  if (a === 'slag') { sim.startSlagRemoval(); }
  if (a === 'defects') { state.showDef = !state.showDef; showDefects(state.showDef); renderPanel(); }
  if (a === 'sound') { state.sound = audio.enabled = !state.sound; renderTopbar(); }
  if (a === 'full') { const d = document; if (!d.fullscreenElement) d.documentElement.requestFullscreen?.().catch(() => {}); else d.exitFullscreen?.(); }
  if (a === 'present') { document.documentElement.classList.toggle('present'); setTimeout(onResize, 50); }
  if (a === 'home') { renderHub(); goStage('hub'); }
});

function autoStep() {
  const s = ASSEMBLY_STEPS[state.asm.step]; if (!s) return;
  if (s.id === 'power') asmPick('switch');
  else if (s.id === 'holderPlug' || s.id === 'groundPlug') {
    const isH = s.id === 'holderPlug';
    if (!state.asm.picked) asmPick(isH ? 'plugH' : 'plugG');
    lastSocketHit = isH ? 'plus' : 'minus'; asmPick('sockets');
  } else if (s.id === 'clamp') asmPick('clamp');
  else if (s.id === 'electrode') asmPick('box');
}

function finishWeld() {
  if (!sim.samples.length) { showToast('info', 'لسه ماعملتش خط لحام. المس بداية الوصلة وابدأ.'); return; }
  state.weld.pressing = false;
  state.report = sim.evaluate();
  markDone('weld');
  const at = store.get('attempts', []);
  const d = new Date();
  at.push({ total: state.report.total, when: d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }), dia: state.dia, current: state.current });
  store.set('attempts', at.slice(-30));
  goStage('inspect');
}

// ---------------------------------------------------------------- resize & loop
function onResize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (state.stage === 'weld' && !tweens.length) { const c = weldCamera(); camera.position.copy(c.pos); controls.target.copy(c.target); }
}
new ResizeObserver(onResize).observe(viewport);

const clock = new THREE.Clock();
function loop() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  adapt(rawDt);
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i]; t.t += Math.min(rawDt, 0.1); const k = Math.min(1, t.t / t.dur); t.fn(k);
    if (k >= 1) { tweens.splice(i, 1); t.done && t.done(); }
  }
  const pulse = 0.18 + (Math.sin(performance.now() / 260) * 0.5 + 0.5) * 0.35;
  hiMats.forEach(m => m.emissiveIntensity = pulse);
  if (sim) {
    if (state.stage === 'weld') weldFrame(dt);
    else if (state.stage === 'inspect') { if (sim.updateSlag(dt)) {} sim.updateRipples(dt); sim.updateSparks(dt); sim.updateSmoke(dt); }
  }
  controls.update();
  updateHotspots();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot
(async function boot() {
  try {
    await build();
    renderHub();
    goStage('hub');
    onResize();
    $('#loading').classList.add('done');
    loop();
  } catch (e) {
    console.error(e);
    $('#loading').innerHTML = `<p>حصلت مشكلة في تشغيل المجسمات ثلاثية الأبعاد على الجهاز ده.</p><small class="mono">${String(e && e.message || e)}</small>`;
  }
})();

if (/[?&]debug/.test(location.search)) window.__wl = {
  state, goStage, sim: () => sim, asmPick, autoStep, finishWeld, camera, controls,
  project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); const r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
  // deterministic test weld: optional bad zone between fraction a..b moving fast
  simulate(secs = 50, bad = [0.45, 0.52]) {
    const dt = 1 / 60; let x = JOINT.x0;
    for (let t = 0; t < secs && x < JOINT.x1 + 0.002; t += dt) {
      const f = (x - JOINT.x0) / (JOINT.x1 - JOINT.x0);
      const v = (f > bad[0] && f < bad[1]) ? 7 : 3.4 + Math.sin(t * 3) * 0.4;
      x += v / 1000 * dt;
      state.weld.pressing = true; state.weld.x = x; state.weld.arc = 3.4 + Math.sin(t * 5) * 0.4 + (f > 0.8 && f < 0.86 ? 3 : 0);
      weldFrame(dt);
    }
    state.weld.pressing = false; weldFrame(dt);
  }
};

// adaptive quality for weaker devices
let slowFrames = 0, lowered = false;

function adapt(dt) {
  if (lowered) return;
  if (dt > 0.045) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
  if (slowFrames > 90) { lowered = true; renderer.setPixelRatio(1); key.shadow.mapSize.set(1024, 1024); onResize(); }
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
