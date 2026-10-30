// Rendering engine shared by all stations: renderer, post-processing, camera, controls, tweens, picking, highlight.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TABLE_Y } from '../models.js';

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createEngine(viewport) {
  const isMobile = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0e11);
  scene.fog = new THREE.Fog(0x0c0e11, 6, 14);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  renderer.toneMappingExposure = 1.12;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 30);
  camera.position.set(1.7, 1.6, 2.3);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.075;
  controls.rotateSpeed = isMobile ? 0.7 : 0.8; controls.zoomSpeed = 0.9; controls.panSpeed = 0.8;
  controls.maxPolarAngle = 1.52; controls.minDistance = 0.1; controls.maxDistance = 4.5;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.target.set(0.1, 0.55, 0);

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isMobile ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 2.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  scene.add(new THREE.HemisphereLight(0xc4d2e4, 0x2e2620, 0.7));
  // rim light from behind: separates silhouettes from the background
  const rim = new THREE.DirectionalLight(0xbcd6ff, 1.1); rim.position.set(-0.6, 2.4, -2.2); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xffe2c4, 0.35); bounce.position.set(1.5, 0.3, 1.2); scene.add(bounce);
  const key = new THREE.SpotLight(0xfff0dc, 42, 9, 0.8, 0.65, 2);
  key.position.set(0.9, 2.8, 1.7); key.target.position.set(0.05, 0.5, 0);
  key.castShadow = true; key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.012; key.shadow.radius = 3; key.shadow.camera.near = 0.8; key.shadow.camera.far = 6;
  scene.add(key, key.target);
  const over = new THREE.SpotLight(0xffe7c4, 6, 4, 0.55, 0.8, 2);
  over.position.set(0.3, 2.2, 0.15); over.target.position.set(0.3, TABLE_Y, 0.05); scene.add(over, over.target);
  const fill = new THREE.DirectionalLight(0x9cbcff, 0.55); fill.position.set(-2, 1.4, 2.2); scene.add(fill);

  // ---- tweens
  const tweens = [];
  const tween = (dur, fn, done) => { const t = { t: 0, dur, fn, done }; tweens.push(t); return t; };
  const flyTo = (pos, target, dur = 1.1) => {
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].cam) tweens.splice(i, 1);
    const tw = tween(dur, k => { const e = ease(k); camera.position.lerpVectors(p0, pos, e); controls.target.lerpVectors(t0, target, e); });
    tw.cam = true;
  };

  // ---- highlight (pulsing emissive copy of the material)
  const hiCache = new Map(), hiMats = new Set();
  const hiMat = mat => {
    if (Array.isArray(mat)) return mat.map(hiMat);
    if (!mat.emissive) return mat;
    if (!hiCache.has(mat)) { const c = mat.clone(); c.emissive = new THREE.Color(0xff8a2b); c.emissiveIntensity = 0.3; if ('emissiveMap' in c) c.emissiveMap = null; hiCache.set(mat, c); hiMats.add(c); }
    return hiCache.get(mat);
  };
  let highlighted = [];
  const setHighlight = objs => {
    highlighted.forEach(o => o.traverse(m => { if (m.isMesh && m.userData.origMat) { m.material = m.userData.origMat; delete m.userData.origMat; } }));
    highlighted = (objs || []).filter(Boolean);
    highlighted.forEach(o => o.traverse(m => { if (m.isMesh && !m.userData.origMat && !m.userData.noHi) { m.userData.origMat = m.material; m.material = hiMat(m.material); } }));
  };

  // ---- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const setRay = ev => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
  };
  const visibleChain = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
  const pick = (ev, list) => {
    setRay(ev);
    const hits = ray.intersectObjects(list, true);
    for (const h of hits) {
      if (!visibleChain(h.object)) continue;
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) return { id: o.userData.pick, object: o, hit: h };
    }
    return null;
  };

  // ---- loop
  const hooks = new Set();
  const clock = new THREE.Clock();
  let slow = 0, lowered = false;
  const resize = () => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    E.onResize && E.onResize();
  };
  new ResizeObserver(resize).observe(viewport);
  const loop = () => {
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
    if (!lowered) { if (raw > 0.045) slow++; else slow = Math.max(0, slow - 1); if (slow > 90) { lowered = true; renderer.setPixelRatio(1); key.shadow.mapSize.set(1024, 1024); resize(); } }
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i]; t.t += Math.min(raw, 0.1); const k = Math.min(1, t.t / t.dur); t.fn(k);
      if (k >= 1) { tweens.splice(i, 1); t.done && t.done(); }
    }
    const pulse = 0.18 + (Math.sin(performance.now() / 260) * 0.5 + 0.5) * 0.35;
    hiMats.forEach(m => m.emissiveIntensity = pulse);
    hooks.forEach(f => f(dt, raw));
    controls.update();
    composer.render();
    if (E.overlay && E.overlay.children.length > 4) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(E.overlay, camera); renderer.autoClear = true; }
    requestAnimationFrame(loop);
  };

  const E = {
    THREE, renderer, scene, camera, controls, composer, bloom, key, isMobile, tweens,
    tween, flyTo, setHighlight, pick, setRay, ray, resize,
    onFrame: f => hooks.add(f),
    start: () => { resize(); loop(); },
    tweening: () => tweens.some(t => t.cam)
  };
  return E;
}
