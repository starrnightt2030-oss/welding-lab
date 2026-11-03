// 3D hero shot for the welcome screen: an Alexandria Shipyard welder in the blue coverall, welding a plate
// on a stand — live arc light, sparks, glowing bead, brand-coloured rim lights, slow cinematic camera.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LOGO } from './brandlogo.js';
import { makeMaterials, buildMachine } from './models.js';
import { buildCylinder } from './gasparts.js';
import { Textures } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function M(geo, mat, p, r, s) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; if (p) m.position.copy(p); if (r) m.rotation.set(...r); if (s) m.scale.set(...s); return m; }
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

function fabricTex() {   // woven cotton + seams for the coverall
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.05})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 2) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.05})`; g.fillRect(x, 0, 1, 256); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.lineWidth = 6 + Math.random() * 10; g.beginPath(); const y = Math.random() * 256; g.moveTo(0, y); g.bezierCurveTo(80, y + 20, 170, y - 20, 256, y + 10); g.stroke(); }   // soft folds
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}

function buildHero() {
  const root = new THREE.Group();
  const fab = fabricTex();
  const cover = new THREE.MeshPhysicalMaterial({ color: 0x1d4fae, roughness: 0.82, sheen: 0.25, sheenColor: new THREE.Color(0x6c95e6), sheenRoughness: 0.7, bumpMap: fab, bumpScale: 1.4 });
  const coverD = new THREE.MeshPhysicalMaterial({ color: 0x163c84, roughness: 0.8, sheen: 0.2, sheenColor: new THREE.Color(0x6c95e6), bumpMap: fab, bumpScale: 1.2 });
  const refl = new THREE.MeshStandardMaterial({ color: 0xc9d0d9, roughness: 0.5, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe4232a, roughness: 0.5 });
  const leather = new THREE.MeshStandardMaterial({ color: 0xc08a4e, roughness: 0.72, bumpMap: Textures.leather ? Textures.leather().bumpMap : null, bumpScale: 1 });
  const boot = new THREE.MeshPhysicalMaterial({ color: 0x3a2618, roughness: 0.45, clearcoat: 0.4 });
  const helmetM = new THREE.MeshPhysicalMaterial({ color: 0x15181d, roughness: 0.28, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc58f63, roughness: 0.55 });

  // legs (slight A-stance, weight on the back leg)
  const legP = lathe([[0.001, 0], [0.07, 0.02], [0.074, 0.1], [0.08, 0.24], [0.078, 0.4], [0.092, 0.56], [0.108, 0.72], [0.118, 0.84], [0.001, 0.88]], 28);   // baggy coverall trousers
  [[-1, 0.04, -0.05], [1, -0.04, 0.06]].forEach(([s, rz, rx]) => {
    const leg = M(legP, cover, V(s * 0.1, 0.06, 0), [rx, 0, rz]); root.add(leg);
    [0.3, 0.27].forEach((y, i) => { const b = M(new THREE.CylinderGeometry(0.083, 0.083, i ? 0.018 : 0.03, 24, 1, true), i ? red : refl, V(s * 0.1 + Math.sin(rz) * -y, 0.06 + y + 0.1, Math.sin(rx) * y)); root.add(b); });
    // safety boot with steel toe cap
    const bt = new THREE.Group(); bt.position.set(s * 0.1, 0, 0.03);
    bt.add(M(new RoundedBoxGeometry(0.115, 0.1, 0.27, 4, 0.04), boot, V(0, 0.05, 0.02)));
    bt.add(M(new RoundedBoxGeometry(0.1, 0.1, 0.12, 4, 0.04), boot, V(0, 0.12, -0.04)));
    bt.add(M(new THREE.SphereGeometry(0.058, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b9199, metalness: 0.9, roughness: 0.25 }), V(0, 0.03, 0.12), null, [1, 0.7, 0.9]));
    bt.add(M(new THREE.BoxGeometry(0.12, 0.018, 0.28), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }), V(0, 0.009, 0.02)));
    root.add(bt);
  });
  // torso: chest → waist → hips, slightly flattened front-to-back
  const torso = M(lathe([[0.001, 0.9], [0.17, 0.92], [0.165, 1.02], [0.158, 1.12], [0.178, 1.26], [0.2, 1.38], [0.19, 1.45], [0.12, 1.5], [0.06, 1.52], [0.001, 1.52]], 40), cover, null, null, [1.08, 1, 0.66]); root.add(torso);
  root.add(M(new THREE.TorusGeometry(0.075, 0.022, 10, 26), coverD, V(0, 1.5, 0), [Math.PI / 2, 0, 0], [1, 1, 0.8]));   // collar
  root.add(M(new THREE.BoxGeometry(0.01, 0.42, 0.01), refl, V(0, 1.24, 0.131)));                                         // zip
  const lt = new THREE.TextureLoader().load(LOGO); lt.colorSpace = THREE.SRGBColorSpace;
  root.add(M(new THREE.CircleGeometry(0.048, 40), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.5 }), V(0.085, 1.33, 0.127), [-0.08, 0.32, 0]));
  root.add(M(new THREE.RingGeometry(0.048, 0.055, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), V(0.085, 1.33, 0.126), [-0.08, 0.32, 0]));
  root.add(M(new RoundedBoxGeometry(0.085, 0.075, 0.012, 2, 0.004), coverD, V(-0.085, 1.3, 0.124), [-0.06, -0.32, 0]));  // chest pocket
  [1.0, 1.035].forEach((y, i) => root.add(M(new THREE.CylinderGeometry(0.183, 0.183, i ? 0.02 : 0.035, 40, 1, true), i ? red : refl, V(0, y, 0), null, [1.08, 1, 0.68])));   // waist band
  // head + flip-down welding helmet (lens glows with the arc)
  const head = new THREE.Group(); head.position.set(0, 1.64, 0.015); head.rotation.x = 0.42; root.add(head);
  root.add(M(new THREE.CylinderGeometry(0.05, 0.058, 0.1, 18), skin, V(0, 1.55, 0)));
  head.add(M(new THREE.SphereGeometry(0.1, 28, 20), skin, null, null, [0.92, 1.05, 1]));
  head.add(M(new THREE.SphereGeometry(0.135, 36, 24), helmetM, V(0, 0.0, 0.025), null, [0.93, 1.12, 1.08]));
  head.add(M(new RoundedBoxGeometry(0.15, 0.16, 0.06, 4, 0.025), helmetM, V(0, -0.05, 0.11)));   // chin/face plate
  const lens = M(new RoundedBoxGeometry(0.105, 0.05, 0.014, 2, 0.007), new THREE.MeshStandardMaterial({ color: 0x0c3a20, emissive: 0x1d8a4a, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.6 }), V(0, 0.0, 0.143), [-0.05, 0, 0]);
  head.add(lens);
  head.add(M(new THREE.TorusGeometry(0.14, 0.005, 6, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe4232a, emissive: 0x5a0a0c, roughness: 0.4 }), V(0, 0.04, 0.025), [0, 0, 0], [0.96, 1.16, 1]));   // red stripe
  [-1, 1].forEach(s => head.add(M(new THREE.CylinderGeometry(0.024, 0.024, 0.024, 18), new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.4 }), V(s * 0.14, -0.005, 0), [0, 0, Math.PI / 2])));
  // arms: shoulder → elbow chain, posed for welding
  const arm = (s, sh, el) => {
    const a = new THREE.Group(); a.position.set(s * 0.215, 1.42, 0); a.rotation.set(...sh); root.add(a);
    a.add(M(new THREE.SphereGeometry(0.072, 20, 14), cover));
    a.add(M(new THREE.CapsuleGeometry(0.068, 0.22, 6, 18), cover, V(0, -0.15, 0)));
    a.add(M(new THREE.CylinderGeometry(0.071, 0.071, 0.03, 20, 1, true), refl, V(0, -0.2, 0)));
    a.add(M(new THREE.CylinderGeometry(0.071, 0.071, 0.02, 20, 1, true), red, V(0, -0.225, 0)));
    const f = new THREE.Group(); f.position.y = -0.29; f.rotation.set(...el); a.add(f);
    f.add(M(new THREE.SphereGeometry(0.058, 18, 12), cover));
    f.add(M(new THREE.CapsuleGeometry(0.052, 0.17, 6, 16), cover, V(0, -0.12, 0)));
    f.add(M(new THREE.CylinderGeometry(0.075, 0.058, 0.13, 20), leather, V(0, -0.25, 0)));               // gauntlet
    f.add(M(new THREE.SphereGeometry(0.06, 18, 14), leather, V(0, -0.34, 0.012), null, [0.9, 1.1, 0.75]));  // mitt
    f.add(M(new THREE.CapsuleGeometry(0.018, 0.05, 4, 10), leather, V(s * -0.045, -0.31, 0.04), [0.4, 0, s * 0.5]));   // thumb
    f.userData.hand = V(0, -0.35, 0.02); return f;
  };
  const fR = arm(1, [-0.5, 0, 0.12], [-0.95, 0, 0]);
  arm(-1, [-0.35, 0, -0.18], [-1.1, 0, 0.25]);
  // electrode holder in the right hand
  const holder = new THREE.Group(); holder.position.copy(fR.userData.hand); holder.rotation.set(0.35, 0, -0.15); fR.add(holder);
  holder.add(M(new THREE.CylinderGeometry(0.016, 0.018, 0.13, 16), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5 }), V(0, 0.02, 0)));
  holder.add(M(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.3 }), V(0, -0.07, 0)));
  holder.add(M(new THREE.BoxGeometry(0.012, 0.04, 0.02), red, V(0, 0.0, 0.017)));
  const rod = M(new THREE.CylinderGeometry(0.0022, 0.0022, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xa9a28f, roughness: 0.6 }), V(0, -0.19, 0)); holder.add(rod);
  root.userData = { lens, holder, rodTip: V(0, -0.29, 0), rod };
  return root;
}

export function createIntro3D(host, onReady) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  const W = () => host.clientWidth || 400, H = () => host.clientHeight || 450;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(W(), H()); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(32, W() / H(), 0.05, 20);

  scene.add(new THREE.HemisphereLight(0x9fb8e8, 0x1a1410, 0.35));
  const key = new THREE.SpotLight(0xfff0dc, 14, 7, 0.55, 0.6, 1.6); key.position.set(1.6, 3, 2.4); key.target.position.set(0, 0.9, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key, key.target);
  const rimB = new THREE.DirectionalLight(0x3d8bff, 2.6); rimB.position.set(-2.2, 2.2, -2); scene.add(rimB);
  const rimR = new THREE.DirectionalLight(0xff3b3f, 1.8); rimR.position.set(2.4, 1.6, -2.2); scene.add(rimR);
  const arcL = new THREE.PointLight(0x9fd2ff, 3, 2.6, 1.6); arcL.castShadow = true; arcL.shadow.mapSize.set(512, 512); scene.add(arcL);

  // floor: dark polished concrete fading into the background
  const fc = document.createElement('canvas'); fc.width = fc.height = 512; { const g = fc.getContext('2d'); const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshStandardMaterial({ color: 0x1a2232, roughness: 0.32, metalness: 0.35, alphaMap: new THREE.CanvasTexture(fc), transparent: true }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.08, 96), new THREE.MeshBasicMaterial({ color: 0x2f7ff0, transparent: true, opacity: 0.35 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; scene.add(ring);

  const hero = buildHero(); hero.rotation.y = -0.55; hero.position.set(0.1, 0, 0); scene.add(hero);
  // welding stand + plates in front of him
  const Mt = makeMaterials();
  const stand = new THREE.Group(); stand.position.set(-0.32, 0, 0.36); scene.add(stand);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3c4450, roughness: 0.4, metalness: 0.85 });
  stand.add(M(new THREE.CylinderGeometry(0.03, 0.04, 0.78, 16), steel, V(0, 0.39, 0)));
  stand.add(M(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32), steel, V(0, 0.015, 0)));
  stand.add(M(new RoundedBoxGeometry(0.42, 0.025, 0.3, 2, 0.006), steel, V(0, 0.79, 0)));
  const plateM = Mt.plate;
  [-1, 1].forEach(s => stand.add(M(new THREE.BoxGeometry(0.34, 0.008, 0.11), plateM, V(0, 0.807, s * 0.056))));
  // glowing fresh bead + arc point at the hero's electrode tip
  const bead = M(new THREE.CapsuleGeometry(0.006, 0.16, 4, 12), new THREE.MeshStandardMaterial({ color: 0x7a7570, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.6 }), V(0.06, 0.813, 0), [0, 0, Math.PI / 2], [1, 1, 0.6]);
  stand.add(bead);
  hero.updateMatrixWorld(true);
  { const t = hero.userData.rodTip.clone(); hero.userData.holder.localToWorld(t); stand.position.set(t.x - 0.06, Math.max(0.3, t.y - 0.8125), t.z); }
  const machine = buildMachine(Mt).root; machine.position.set(0.85, 0, -0.55); machine.rotation.y = -0.6; scene.add(machine);
  const cyl = buildCylinder(Mt, { h: 1.3, r: 0.1, color: 0x8a9096, shoulder: 0x1f5a3a, labelAr: 'أرجون', labelEn: 'Ar', valve: 'wheel' }); cyl.position.set(-0.95, 0, -0.75); scene.add(cyl);
  const cyl2 = buildCylinder(Mt, { h: 1.25, r: 0.1, color: 0x8c2424, shoulder: 0x5a1010, labelAr: 'أسيتيلين', labelEn: 'C2H2', valve: 'wheel' }); cyl2.position.set(-0.72, 0, -0.95); scene.add(cyl2);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Textures.glowSprite(), color: 0xcfe8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(0.22); scene.add(glow);
  // sparks
  const N = 260, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffc070, size: 0.014, map: Textures.glowSprite(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sparks.frustumCulled = false; scene.add(sparks);

  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W() / 2, H() / 2), 0.75, 0.5, 0.9); composer.addPass(bloom); composer.addPass(new OutputPass());
  const resize = () => { renderer.setSize(W(), H()); composer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host); resize();

  const tip = new THREE.Vector3(); let alive = true, t0 = performance.now(), boost = 0, T = 0;
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now; T += dt;
    // cinematic orbit
    const a = Math.sin(T * 0.18) * 0.32 + 0.35;
    camera.position.set(Math.sin(a) * 3.45, 1.3 + Math.sin(T * 0.25) * 0.05, Math.cos(a) * 3.45); camera.lookAt(-0.05, 0.86, 0.05);
    hero.updateMatrixWorld(true);
    const H0 = hero.userData; tip.copy(H0.rodTip); H0.holder.localToWorld(tip);

    const fl = 0.7 + Math.random() * 0.6;
    arcL.position.copy(tip).add(V(0, 0.02, 0)); arcL.intensity = 2.4 * fl * (1 + boost);
    glow.position.copy(tip); glow.scale.setScalar((0.16 + Math.random() * 0.08) * (1 + boost * 0.6));
    H0.lens.material.emissiveIntensity = 0.4 + fl * 0.9;
    bead.material.emissiveIntensity = 1.2 + Math.sin(T * 7) * 0.2;
    // sparks: spray from the arc, bounce on the plate / floor
    const spawn = Math.round((3 + boost * 10) * (dt * 60));
    for (let k = 0, i = 0; i < N && k < spawn; i++) if (life[i] <= 0) {
      const ang = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.8;
      pos.set([tip.x, tip.y + 0.005, tip.z], i * 3); vel.set([Math.cos(ang) * sp * 0.6, 0.8 + Math.random() * 1.8, Math.sin(ang) * sp * 0.6], i * 3); life[i] = 0.4 + Math.random() * 0.9; k++;
    }
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { pos[i * 3 + 1] = -10; continue; }
      life[i] -= dt; vel[i * 3 + 1] -= 9.8 * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.01) { pos[i * 3 + 1] = 0.01; vel[i * 3 + 1] *= -0.3; vel[i * 3] *= 0.6; vel[i * 3 + 2] *= 0.6; }
    }
    sg.attributes.position.needsUpdate = true;
    boost = Math.max(0, boost - dt * 0.8);
    composer.render();
    if (onReady) { const f = onReady; onReady = null; setTimeout(f, 60); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    boost() { boost = 1.6; },
    stop() { alive = false; setTimeout(() => { renderer.dispose(); renderer.domElement.remove(); }, 50); }
  };
}
