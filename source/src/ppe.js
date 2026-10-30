// Detailed personal protective equipment models (meters). Each builder returns a Group resting on y=0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Textures } from './textures.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, cast = true, receive = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; }

// ---------- procedural material textures
let _leather, _fabric, _foam;
function leatherTex() {
  if (_leather) return _leather;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const x = Math.random() * S, y = Math.random() * S, r = 1 + Math.random() * 3; g.fillStyle = `rgba(${Math.random() < 0.5 ? 40 : 200},${Math.random() < 0.5 ? 40 : 200},${Math.random() < 0.5 ? 40 : 200},0.18)`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < 90; i++) { g.strokeStyle = 'rgba(30,30,30,0.25)'; g.lineWidth = 1; g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return (_leather = t);
}
function fabricTex() {
  if (_fabric) return _fabric;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = 110 + ((x % 4 < 2) ^ (y % 4 < 2) ? 40 : -10) + Math.random() * 30; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14);
  return (_fabric = t);
}
function foamTex() {
  if (_foam) return _foam;
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  for (let i = 0; i < S * S; i++) { const v = 100 + Math.random() * 120; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i % S, Math.floor(i / S), 1, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4);
  return (_foam = t);
}
const leather = (color, rough = 0.78) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, bumpMap: leatherTex(), bumpScale: 1.6 });
const fabric = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, bumpMap: fabricTex(), bumpScale: 0.9 });
const plastic = (color, rough = 0.42) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.5 });
const clear = (tint = 0xeaf4ff, op = 0.22) => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.04, metalness: 0, transmission: 0.92, thickness: 0.002, transparent: true, opacity: op, side: THREE.DoubleSide, clearcoat: 1, depthWrite: false });
const steel = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, roughness: 0.3, metalness: 1 });
const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 1 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.85 });

// Stitch line along a curve
function stitches(curve, n, color = 0xe8dcc0) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const geo = new THREE.CapsuleGeometry(0.0006, 0.0028, 2, 4);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = curve.getPointAt(t), d = curve.getTangentAt(t); const s = mesh(geo, mat, false, false); s.position.copy(p); s.quaternion.setFromUnitVectors(V3(0, 1, 0), d); g.add(s); }
  return g;
}

// ---------- 1. Auto-darkening welding helmet
export function buildHelmet() {
  const g = new THREE.Group();
  const shellMat = plastic(0x1a1c20, 0.5); shellMat.bumpMap = Textures.paint().bumpMap; shellMat.bumpScale = 0.4;
  // shell: a sphere segment shaped into a mask (front + sides), open at the back
  const geo = new THREE.SphereGeometry(0.115, 64, 40, -0.32, Math.PI + 0.64, Math.PI * 0.1, Math.PI * 0.82);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // flatter sides, longer chin, pointed front ridge
    x *= 0.92; y *= 1.32;
    const front = Math.max(0, z / 0.115);
    z = z * 1.05 + front * front * 0.012 * (1 - Math.abs(x) / 0.1);
    if (y < -0.05) z += (y + 0.05) * -0.25 * front;   // chin flares forward
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  shellMat.side = THREE.DoubleSide;
  const shell = mesh(geo, shellMat); g.add(shell);
  // inner rim
  const rim = mesh(new THREE.TorusGeometry(0.1, 0.0035, 8, 64, Math.PI * 1.5), rubber); rim.rotation.set(0, Math.PI / 2, 0); rim.scale.set(1.28, 1, 1); rim.position.z = -0.005; // decorative
  // decal (flame stripes)
  const decal = Textures.label((c, w, h) => { c.clearRect(0, 0, w, h); const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ff8a2b'); gr.addColorStop(1, '#ffd34a'); c.fillStyle = gr;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(40 + k * 60, h); c.quadraticCurveTo(70 + k * 60, h * 0.5, 30 + k * 70, h * 0.12); c.quadraticCurveTo(110 + k * 60, h * 0.55, 90 + k * 60, h); c.fill(); } }, 256, 256);
  [-1, 1].forEach(s => { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshStandardMaterial({ map: decal, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 })); d.position.set(s * 0.1, -0.02, 0.035); d.rotation.y = s * 1.25; g.add(d); });
  // lens frame + auto-darkening filter (gold mirror) + solar cell + sensors
  const frame = mesh(new RoundedBoxGeometry(0.115, 0.07, 0.02, 3, 0.008), plastic(0x0d0e10, 0.6)); frame.position.set(0, 0.035, 0.122); frame.rotation.x = -0.18; g.add(frame);
  const lens = mesh(new RoundedBoxGeometry(0.098, 0.052, 0.004, 2, 0.004), new THREE.MeshPhysicalMaterial({ color: 0x3d4a2a, metalness: 0.9, roughness: 0.06, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.6 }));
  lens.position.set(0, 0.035, 0.1325); lens.rotation.x = -0.18; g.add(lens);
  const solar = mesh(new THREE.BoxGeometry(0.03, 0.007, 0.002), new THREE.MeshStandardMaterial({ color: 0x1a2340, roughness: 0.2, metalness: 0.6 })); solar.position.set(-0.025, 0.069, 0.13); solar.rotation.x = -0.18; g.add(solar);
  [-1, 1].forEach(s => { const sn = mesh(new THREE.CircleGeometry(0.0025, 12), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 }), false, false); sn.position.set(s * 0.04, 0.07, 0.1335); sn.rotation.x = -0.18; g.add(sn); });
  // headgear: ratchet band + crown strap + pivot knobs
  const band = mesh(new THREE.TorusGeometry(0.085, 0.006, 8, 48), plastic(0x2a2c30, 0.7)); band.rotation.x = Math.PI / 2; band.scale.set(0.95, 1.15, 1); band.position.set(0, 0.03, -0.01); g.add(band);
  const crown = mesh(new THREE.TorusGeometry(0.075, 0.005, 8, 32, Math.PI), plastic(0x2a2c30, 0.7)); crown.position.set(0, 0.03, -0.01); crown.rotation.y = Math.PI / 2; g.add(crown);
  const ratchet = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 24), plastic(0x8a1d18, 0.4)); ratchet.rotation.x = Math.PI / 2; ratchet.position.set(0, 0.0, -0.105); g.add(ratchet);
  for (let i = 0; i < 12; i++) { const r = mesh(new THREE.BoxGeometry(0.003, 0.004, 0.017), ratchet.material, false); const a = i / 12 * Math.PI * 2; r.position.set(Math.cos(a) * 0.018, Math.sin(a) * 0.018, -0.105); r.rotation.z = a; g.add(r); }
  [-1, 1].forEach(s => { const k = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 24), plastic(0x2a2c30, 0.5)); k.rotation.z = Math.PI / 2; k.position.set(s * 0.104, 0.02, -0.005); g.add(k); });
  g.position.y = 0.155;   // rests on its chin
  const root = new THREE.Group(); root.add(g); g.rotation.x = -0.25;
  return root;
}

// ---------- 2. Leather gauntlet glove
export function buildGlove(color = 0xb98a56, thin = false, left = false) {
  const g = new THREE.Group(), mat = leather(color, thin ? 0.6 : 0.82);
  const cuffMat = leather(thin ? color : 0xa86b3a, 0.85);
  const s = left ? -1 : 1;
  // palm: subdivided rounded box, gently curved
  const palmGeo = new RoundedBoxGeometry(0.09, 0.03, 0.105, 6, 0.014);
  const pp = palmGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i); pp.setY(i, pp.getY(i) + (x * x) * -1.5 + z * 0.08); }
  palmGeo.computeVertexNormals();
  const palm = mesh(palmGeo, mat); g.add(palm);
  // fingers: 3 segments each, slightly curled
  const lens = [0.05, 0.058, 0.055, 0.045], xs = [-0.031, -0.011, 0.01, 0.03];
  xs.forEach((x, i) => {
    let parent = new THREE.Group(); parent.position.set(x * s, 0.002, 0.05); g.add(parent);
    const L = lens[i], r = thin ? 0.0085 : 0.0105;
    for (let k = 0; k < 3; k++) {
      const seg = mesh(new THREE.CapsuleGeometry(r * (1 - k * 0.08), L / 3, 6, 12), mat);
      seg.rotation.x = Math.PI / 2; seg.position.z = L / 6; parent.add(seg);
      const nx = new THREE.Group(); nx.position.z = L / 3; nx.rotation.x = 0.16 + (i === 0 ? 0.05 : 0); parent.add(nx); parent = nx;
    }
  });
  // thumb
  const th = new THREE.Group(); th.position.set(0.048 * s, -0.002, 0.005); th.rotation.set(0, s * 0.9, s * -0.3); g.add(th);
  const t1 = mesh(new THREE.CapsuleGeometry(thin ? 0.01 : 0.012, 0.03, 6, 12), mat); t1.rotation.x = Math.PI / 2; t1.position.z = 0.018; th.add(t1);
  const t2 = mesh(new THREE.CapsuleGeometry(thin ? 0.009 : 0.011, 0.022, 6, 12), mat); t2.rotation.x = Math.PI / 2 + 0.3; t2.position.set(0, -0.004, 0.044); th.add(t2);
  // gauntlet cuff (flared cone, elliptical)
  const cuffLen = thin ? 0.06 : 0.15;
  const prof = thin ? [[0.042, 0], [0.046, cuffLen]] : [[0.042, 0], [0.05, 0.03], [0.064, cuffLen * 0.7], [0.07, cuffLen]];
  const cuffGeo = new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), 40);
  cuffGeo.rotateX(-Math.PI / 2); cuffGeo.scale(1, 0.55, 1);
  const cuff = mesh(cuffGeo, new THREE.MeshStandardMaterial({ color: cuffMat.color, roughness: 0.85, bumpMap: leatherTex(), bumpScale: 1.6, side: THREE.DoubleSide }));
  cuff.position.z = -0.05; g.add(cuff);
  // trim band + stitching around palm
  if (!thin) { const trim = mesh(new THREE.TorusGeometry(0.069, 0.0045, 6, 40), leather(0x8a1d18)); trim.scale.set(1, 0.55, 1); trim.position.z = -0.05 - cuffLen; g.add(trim); }
  const sc = new THREE.CatmullRomCurve3([V3(-0.045, 0.016, -0.045), V3(-0.046, 0.016, 0.04), V3(0.046, 0.016, 0.04), V3(0.045, 0.016, -0.045)]);
  g.add(stitches(sc, 40));
  g.position.y = 0.016;
  const root = new THREE.Group(); root.add(g);
  return root;
}

// ---------- 3. Gas welding goggles (cup type, shade 5)
export function buildGoggles() {
  const g = new THREE.Group();
  const cupMat = plastic(0x1a1b1e, 0.55);
  [-1, 1].forEach(s => {
    const cup = mesh(new THREE.LatheGeometry([V2(0.019, -0.012), V2(0.024, -0.004), V2(0.025, 0.006), V2(0.023, 0.012)], 32), cupMat);
    cup.rotation.x = Math.PI / 2; cup.position.x = s * 0.031; g.add(cup);
    const ring = mesh(new THREE.TorusGeometry(0.0235, 0.0028, 8, 32), new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.35, metalness: 0.6 })); ring.position.set(s * 0.031, 0, 0.012); g.add(ring);
    for (let i = 0; i < 16; i++) { const k = mesh(new THREE.BoxGeometry(0.0015, 0.0035, 0.004), ring.material, false); const a = i / 16 * Math.PI * 2; k.position.set(s * 0.031 + Math.cos(a) * 0.026, Math.sin(a) * 0.026, 0.012); k.rotation.z = a; g.add(k); }
    const glass = mesh(new THREE.CircleGeometry(0.021, 32), new THREE.MeshPhysicalMaterial({ color: 0x1e5a2a, roughness: 0.03, metalness: 0.3, clearcoat: 1, transparent: true, opacity: 0.92 }), false, false);
    glass.position.set(s * 0.031, 0, 0.0125); g.add(glass);
    [0, 1, 2, 3].forEach(i => { const v = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.004, 8), cupMat, false); const a = i * Math.PI / 2 + Math.PI / 4; v.position.set(s * 0.031 + Math.cos(a) * 0.022, Math.sin(a) * 0.022, -0.004); v.rotation.x = Math.PI / 2; g.add(v); });
  });
  const bridge = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-0.009, 0.004, 0.004), V3(0, 0.008, 0.006), V3(0.009, 0.004, 0.004)]), 8, 0.0028, 8), cupMat); g.add(bridge);
  // elastic strap (flat band loop behind)
  const strapC = new THREE.CatmullRomCurve3([V3(0.054, 0, 0), V3(0.075, 0, -0.04), V3(0.06, 0, -0.1), V3(0, 0, -0.12), V3(-0.06, 0, -0.1), V3(-0.075, 0, -0.04), V3(-0.054, 0, 0)]);
  const strap = mesh(new THREE.TubeGeometry(strapC, 60, 0.003, 6), fabric(0x2a3a5a)); strap.scale.y = 3.5; g.add(strap);
  g.position.y = 0.025; g.rotation.x = -Math.PI / 2 + 0.25;
  const root = new THREE.Group(); root.add(g); return root;
}

// ---------- 4. Wraparound safety glasses
export function buildGlasses() {
  const g = new THREE.Group();
  const lensGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.042, 48, 1, true, -0.85, 1.7);
  const lens = mesh(lensGeo, clear(0xf2f8ff, 0.3), false, false); lens.rotation.y = Math.PI / 2; g.add(lens);
  const browC = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const a = -0.85 + i * (1.7 / 8); return V3(Math.sin(a) * 0.076, 0.021, Math.cos(a) * 0.076); }));
  g.add(mesh(new THREE.TubeGeometry(browC, 30, 0.0032, 8), plastic(0x1b1d22, 0.4)));
  const nose = mesh(new THREE.BoxGeometry(0.012, 0.016, 0.006), plastic(0x3a3d44, 0.6)); nose.position.set(0, -0.012, 0.073); g.add(nose);
  [-1, 1].forEach(s => {
    const a = s * 0.85, hx = Math.sin(a) * 0.076, hz = Math.cos(a) * 0.076;
    const hinge = mesh(new THREE.BoxGeometry(0.006, 0.01, 0.008), plastic(0x1b1d22)); hinge.position.set(hx, 0.016, hz); g.add(hinge);
    const temple = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(hx, 0.016, hz), V3(s * 0.07, 0.016, -0.02), V3(s * 0.068, 0.012, -0.08), V3(s * 0.064, -0.004, -0.1)]), 20, 0.0026, 8), plastic(0x1b1d22)); temple.scale.y = 1; g.add(temple);
    const tip = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(s * 0.068, 0.012, -0.07), V3(s * 0.066, 0.004, -0.095), V3(s * 0.064, -0.006, -0.104)]), 10, 0.0038, 8), plastic(0xff8a2b, 0.6)); g.add(tip);
  });
  g.position.y = 0.022;
  const root = new THREE.Group(); root.add(g); return root;
}

// ---------- 5. Face shield (grinding)
export function buildFaceShield() {
  const g = new THREE.Group();
  const visorGeo = new THREE.CylinderGeometry(0.105, 0.115, 0.21, 48, 6, true, -1.05, 2.1);
  const vp = visorGeo.attributes.position; for (let i = 0; i < vp.count; i++) { const y = vp.getY(i); if (y < -0.08) vp.setZ(i, vp.getZ(i) * (1 - (y + 0.08) * 1.2)); }
  visorGeo.computeVertexNormals();
  const visor = mesh(visorGeo, clear(0xe2f1ff, 0.26), false, false); visor.rotation.y = Math.PI / 2; visor.position.y = -0.1; g.add(visor);
  const edgeC = new THREE.CatmullRomCurve3(Array.from({ length: 11 }, (_, i) => { const a = -1.05 + i * 0.21; return V3(Math.sin(a) * 0.107, 0, Math.cos(a) * 0.107); }));
  const brow = mesh(new THREE.TubeGeometry(edgeC, 40, 0.012, 10), plastic(0xf2c230, 0.45)); brow.scale.y = 1.6; g.add(brow);
  const band = mesh(new THREE.TorusGeometry(0.085, 0.006, 8, 48), plastic(0x2a2c30, 0.6)); band.rotation.x = Math.PI / 2; band.scale.set(0.95, 1.15, 1); band.position.z = -0.01; g.add(band);
  const crown = mesh(new THREE.TorusGeometry(0.075, 0.005, 8, 32, Math.PI), plastic(0x2a2c30, 0.6)); crown.rotation.y = Math.PI / 2; crown.position.z = -0.01; g.add(crown);
  const knob = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 24), plastic(0x2a2c30, 0.5)); knob.rotation.x = Math.PI / 2; knob.position.z = -0.105; g.add(knob);
  [-1, 1].forEach(s => { const k = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), plastic(0xf2c230)); k.rotation.z = Math.PI / 2; k.position.set(s * 0.1, -0.005, 0.01); g.add(k); });
  g.position.y = 0.215;
  const root = new THREE.Group(); root.add(g); return root;
}

// ---------- 6. Welding jacket on a hanger (FR cotton / leather sleeves)
export function buildJacket(color = 0x2c4a6a) {
  const g = new THREE.Group(), mat = fabric(color), leatherM = leather(0x8a5a33);
  // torso via lathe (elliptical cross-section)
  const prof = [[0.0, 0.32], [0.07, 0.31], [0.16, 0.27], [0.19, 0.22], [0.185, 0.0], [0.18, -0.2], [0.185, -0.3], [0.0, -0.3]];
  const torsoGeo = new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), 48);
  torsoGeo.scale(1, 1, 0.42);
  const tp = torsoGeo.attributes.position; for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i); tp.setZ(i, tp.getZ(i) + Math.sin(y * 18 + x * 9) * 0.003); }
  torsoGeo.computeVertexNormals();
  const torso = mesh(torsoGeo, mat); g.add(torso);
  // sleeves (leather), hanging
  [-1, 1].forEach(s => {
    const c = new THREE.CatmullRomCurve3([V3(s * 0.17, 0.25, 0), V3(s * 0.24, 0.12, 0.01), V3(s * 0.26, -0.08, 0.02), V3(s * 0.25, -0.26, 0.03)]);
    const sl = mesh(new THREE.TubeGeometry(c, 30, 0.058, 20), leatherM); sl.scale.z = 0.85; g.add(sl);
    const cuff = mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 24), mat); cuff.position.copy(c.getPoint(1)); cuff.rotation.x = Math.PI / 2; g.add(cuff);
  });
  // collar, zipper/snaps, pocket
  const collar = mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 32, Math.PI * 1.6), mat); collar.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); collar.scale.set(1, 0.5, 1); collar.position.y = 0.315; g.add(collar);
  const placket = mesh(new THREE.BoxGeometry(0.03, 0.6, 0.006), mat); placket.position.set(0, 0.0, 0.08); g.add(placket);
  for (let i = 0; i < 6; i++) { const sn = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16), steel); sn.rotation.x = Math.PI / 2; sn.position.set(0, 0.24 - i * 0.1, 0.084); g.add(sn); }
  const pocket = mesh(new RoundedBoxGeometry(0.08, 0.09, 0.008, 2, 0.003), mat); pocket.position.set(-0.09, 0.12, 0.078); g.add(pocket);
  const flap = mesh(new RoundedBoxGeometry(0.084, 0.03, 0.01, 2, 0.003), mat); flap.position.set(-0.09, 0.16, 0.082); g.add(flap);
  // hanger
  const hc = new THREE.CatmullRomCurve3([V3(-0.19, 0.29, 0), V3(0, 0.36, 0), V3(0.19, 0.29, 0)]);
  g.add(mesh(new THREE.TubeGeometry(hc, 20, 0.006, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.5 })));
  const hook = mesh(new THREE.TorusGeometry(0.025, 0.003, 8, 20, Math.PI * 1.4), steel); hook.position.set(0, 0.39, 0); hook.rotation.z = Math.PI * 0.8; g.add(hook);
  return g;
}

// ---------- 7. Leather apron (bib type)
export function buildApron() {
  const g = new THREE.Group(), mat = leather(0x8a5a33, 0.8);
  const sh = new THREE.Shape();
  sh.moveTo(-0.11, 0.42); sh.lineTo(0.11, 0.42); sh.quadraticCurveTo(0.12, 0.25, 0.25, 0.18); sh.lineTo(0.26, -0.42);
  sh.quadraticCurveTo(0.26, -0.48, 0.2, -0.48); sh.lineTo(-0.2, -0.48); sh.quadraticCurveTo(-0.26, -0.48, -0.26, -0.42); sh.lineTo(-0.25, 0.18); sh.quadraticCurveTo(-0.12, 0.25, -0.11, 0.42);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.002, bevelSegments: 2, curveSegments: 24 });
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) + Math.cos(x * 9) * 0.012 + (y < 0 ? Math.sin(x * 14) * 0.006 * -y : 0)); }
  geo.computeVertexNormals();
  g.add(mesh(geo, mat));
  // neck strap and waist ties
  const neck = new THREE.CatmullRomCurve3([V3(-0.1, 0.42, 0), V3(-0.08, 0.55, -0.02), V3(0, 0.6, -0.03), V3(0.08, 0.55, -0.02), V3(0.1, 0.42, 0)]);
  g.add(mesh(new THREE.TubeGeometry(neck, 30, 0.006, 6), leather(0x5e3a1e)));
  [-1, 1].forEach(s => { const t = new THREE.CatmullRomCurve3([V3(s * 0.25, 0.16, 0), V3(s * 0.28, 0.08, 0.01), V3(s * 0.27, -0.1, 0.02)]); g.add(mesh(new THREE.TubeGeometry(t, 20, 0.005, 6), leather(0x5e3a1e))); });
  const edge = new THREE.CatmullRomCurve3(sh.getSpacedPoints(80).map(v => V3(v.x * 0.97, v.y * 0.97, 0.008)), true);
  g.add(stitches(edge, 140, 0xd8c7a0));
  return g;
}

// ---------- 8. Safety boots (pair) — extruded side profile
function bootGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.13, 0); s.lineTo(0.12, 0); s.quadraticCurveTo(0.155, 0.002, 0.155, 0.035); s.quadraticCurveTo(0.15, 0.075, 0.08, 0.085);
  s.lineTo(0.0, 0.11); s.quadraticCurveTo(-0.03, 0.12, -0.03, 0.17); s.lineTo(-0.035, 0.2); s.lineTo(-0.14, 0.2); s.quadraticCurveTo(-0.15, 0.1, -0.135, 0.04); s.quadraticCurveTo(-0.14, 0.01, -0.13, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.012, bevelSegments: 5, curveSegments: 20 });
  geo.translate(0, 0, -0.035);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); if (x > 0.06) p.setZ(i, z * (1 - (x - 0.06) * 2.2)); }   // tapered toe
  geo.computeVertexNormals();
  return geo;
}
export function buildBoots() {
  const g = new THREE.Group();
  const upper = leather(0x2a1f17, 0.55), soleM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }), lace = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.7 });
  const geo = bootGeo();
  [-1, 1].forEach(sd => {
    const b = new THREE.Group();
    b.add(mesh(geo, upper));
    const sole = mesh(new RoundedBoxGeometry(0.31, 0.022, 0.1, 3, 0.008), soleM); sole.position.set(0.012, 0.004, 0); b.add(sole);
    for (let i = 0; i < 9; i++) { const tr = mesh(new THREE.BoxGeometry(0.008, 0.008, 0.09), soleM); tr.position.set(-0.13 + i * 0.032, -0.005, 0); b.add(tr); }
    const heel = mesh(new RoundedBoxGeometry(0.08, 0.03, 0.095, 2, 0.006), soleM); heel.position.set(-0.1, 0.012, 0); b.add(heel);
    const toe = mesh(new THREE.SphereGeometry(0.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.35 })); toe.scale.set(1.25, 0.9, 1.05); toe.position.set(0.1, 0.035, 0); b.add(toe);
    const collarB = mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 24), leather(0x4a3424)); collarB.rotation.x = Math.PI / 2; collarB.scale.set(1.25, 1, 1); collarB.position.set(-0.088, 0.205, 0); b.add(collarB);
    for (let i = 0; i < 5; i++) {
      [-1, 1].forEach(s2 => { const ey = mesh(new THREE.TorusGeometry(0.0035, 0.0012, 6, 12), brass); ey.position.set(-0.03 - i * 0.004 + i * 0.022 * 0.0, 0.12 + i * 0.018, s2 * 0.028); ey.position.x = 0.01 - i * 0.012; ey.rotation.y = Math.PI / 2; b.add(ey); });
      const l = mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.058, 6), lace); l.rotation.x = Math.PI / 2; l.rotation.y = (i % 2 ? 0.4 : -0.4); l.position.set(0.01 - i * 0.012, 0.125 + i * 0.018, 0); b.add(l);
    }
    const tongue = mesh(new RoundedBoxGeometry(0.03, 0.12, 0.05, 2, 0.01), leather(0x3a2a1e)); tongue.position.set(-0.03, 0.16, 0); tongue.rotation.z = 0.4; b.add(tongue);
    b.position.set(0, 0.011, sd * 0.07); b.rotation.y = sd * 0.08;
    g.add(b);
  });
  return g;
}

// ---------- 9. Foam ear plugs with cord
export function buildEarPlugs() {
  const g = new THREE.Group(), foam = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.95, bumpMap: foamTex(), bumpScale: 1.5 });
  const geo = new THREE.LatheGeometry([V2(0, 0), V2(0.0055, 0.001), V2(0.0065, 0.006), V2(0.0068, 0.014), V2(0.006, 0.02), V2(0, 0.021)], 20);
  [-1, 1].forEach(s => { const p = mesh(geo, foam); p.rotation.z = Math.PI / 2; p.position.set(s * 0.04, 0.0068, 0); p.rotation.y = s > 0 ? Math.PI : 0; g.add(p); });
  const cord = new THREE.CatmullRomCurve3([V3(-0.04, 0.003, 0), V3(-0.02, 0.002, 0.04), V3(0.02, 0.002, 0.05), V3(0.04, 0.003, 0)]);
  g.add(mesh(new THREE.TubeGeometry(cord, 30, 0.0012, 6), new THREE.MeshStandardMaterial({ color: 0x1f6fb5, roughness: 0.5 })));
  return g;
}

// ---------- 10. Half-face respirator with P100 filters
export function buildRespirator() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.055, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * 0.95); p.setZ(i, p.getZ(i) * 1.15); p.setY(i, p.getY(i) * 0.9); }
  geo.computeVertexNormals(); geo.rotateX(Math.PI / 2);
  const body = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.55, side: THREE.DoubleSide })); body.position.z = 0.0; g.add(body);
  const valve = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 24), plastic(0x2a2c30)); valve.rotation.x = Math.PI / 2; valve.position.set(0, -0.012, 0.058); g.add(valve);
  for (let i = 0; i < 6; i++) { const sl = mesh(new THREE.BoxGeometry(0.02, 0.0015, 0.002), plastic(0x111214), false); sl.position.set(0, -0.018 + i * 0.0025, 0.0645); g.add(sl); }
  [-1, 1].forEach(s => {
    const f = new THREE.Group(); f.position.set(s * 0.055, -0.005, 0.02); f.rotation.y = s * 0.55;
    const disc = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 32), plastic(0xd65b9a, 0.5)); disc.rotation.z = Math.PI / 2; f.add(disc);
    const face = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.002, 32), new THREE.MeshStandardMaterial({ color: 0xf0e6ee, roughness: 0.95, bumpMap: foamTex(), bumpScale: 1 })); face.rotation.z = Math.PI / 2; face.position.x = s * 0.009; f.add(face);
    g.add(f);
  });
  const strap = mesh(new THREE.TorusGeometry(0.075, 0.003, 6, 40, Math.PI * 1.2), fabric(0x1f2a3a)); strap.rotation.set(Math.PI / 2, 0, Math.PI * 0.9); strap.scale.y = 1; strap.position.z = -0.03; g.add(strap);
  g.position.y = 0.032; g.rotation.x = -0.4;
  const root = new THREE.Group(); root.add(g); return root;
}

// ---------- 11. Fire extinguisher (6 kg ABC powder)
export function buildExtinguisher() {
  const g = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: 0xc0201a, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const body = mesh(new THREE.LatheGeometry([V2(0, 0), V2(0.072, 0.0), V2(0.078, 0.012), V2(0.078, 0.45), V2(0.07, 0.5), V2(0.045, 0.53), V2(0.02, 0.545), V2(0, 0.545)], 48), red); g.add(body);
  const base = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 })); base.position.y = 0.01; g.add(base);
  const neck = mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.03, 20), brass); neck.position.y = 0.56; g.add(neck);
  const head = mesh(new RoundedBoxGeometry(0.045, 0.04, 0.035, 2, 0.006), steel); head.position.y = 0.59; g.add(head);
  const lever = mesh(new RoundedBoxGeometry(0.13, 0.008, 0.03, 2, 0.003), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 0.8 })); lever.position.set(0.035, 0.625, 0); lever.rotation.z = 0.18; g.add(lever);
  const handle = mesh(new RoundedBoxGeometry(0.12, 0.008, 0.03, 2, 0.003), lever.material); handle.position.set(0.04, 0.6, 0); g.add(handle);
  const pin = mesh(new THREE.TorusGeometry(0.008, 0.0015, 6, 16), new THREE.MeshStandardMaterial({ color: 0xffd34a, metalness: 0.8, roughness: 0.3 })); pin.position.set(-0.03, 0.605, 0.02); g.add(pin);
  const gauge = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 20), steel); gauge.rotation.x = Math.PI / 2; gauge.position.set(-0.02, 0.585, 0.02); g.add(gauge);
  const gf = mesh(new THREE.CircleGeometry(0.01, 20), new THREE.MeshStandardMaterial({ color: 0x3ddc97 })); gf.position.set(-0.02, 0.585, 0.0245); g.add(gf);
  const hoseC = new THREE.CatmullRomCurve3([V3(0.015, 0.58, 0), V3(0.06, 0.56, 0.03), V3(0.085, 0.45, 0.05), V3(0.085, 0.3, 0.06), V3(0.08, 0.22, 0.06)]);
  g.add(mesh(new THREE.TubeGeometry(hoseC, 30, 0.007, 10), rubber));
  const nozzle = mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.05, 12), rubber); nozzle.position.set(0.08, 0.195, 0.06); g.add(nozzle);
  const clip = mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), steel); clip.position.set(0.075, 0.25, 0.06); g.add(clip);
  const lbl = Textures.label((c, w, h) => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0201a'; c.fillRect(0, 0, w, 40); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 30px "IBM Plex Sans Arabic", sans-serif'; c.fillText('طفاية حريق', w / 2, 30); c.fillStyle = '#1b1d21'; c.font = '700 64px "IBM Plex Sans Arabic", sans-serif'; c.fillText('بودرة', w / 2, 120); c.font = '600 40px "IBM Plex Mono", monospace'; c.fillText('ABC 6kg', w / 2, 180); c.font = '600 22px "IBM Plex Sans Arabic", sans-serif'; c.fillText('اسحب • وجّه • اضغط • حرّك', w / 2, 230); }, 256, 256);
  const lp = mesh(new THREE.CylinderGeometry(0.0785, 0.0785, 0.2, 48, 1, true, -0.65, 1.3), new THREE.MeshStandardMaterial({ map: lbl, roughness: 0.5 }), false, false); lp.position.y = 0.26; g.add(lp);
  return g;
}

// ---------- 12. First-aid box (wall mounted)
export function buildFirstAid() {
  const g = new THREE.Group();
  const box = mesh(new RoundedBoxGeometry(0.32, 0.24, 0.1, 3, 0.015), plastic(0xf0f0ee, 0.4)); g.add(box);
  const lid = mesh(new RoundedBoxGeometry(0.3, 0.22, 0.012, 3, 0.005), plastic(0xe6e6e2, 0.35)); lid.position.z = 0.052; g.add(lid);
  const c1 = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.004), plastic(0x1c9a4a, 0.4)); c1.position.z = 0.059; g.add(c1);
  const c2 = c1.clone(); c2.rotation.z = Math.PI / 2; g.add(c2);
  const latch = mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), plastic(0x1c9a4a)); latch.position.set(0, -0.11, 0.06); g.add(latch);
  return g;
}

// ---------- 13. Chipping hammer (spring handle) and wire brush
export function buildChippingHammer() {
  const g = new THREE.Group();
  const head = mesh(new RoundedBoxGeometry(0.018, 0.018, 0.12, 2, 0.003), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.45, metalness: 0.9 })); g.add(head);
  const chisel = mesh(new THREE.CylinderGeometry(0.0, 0.013, 0.04, 4), head.material); chisel.rotation.x = Math.PI / 2; chisel.rotation.y = Math.PI / 4; chisel.position.z = 0.08; chisel.scale.set(1, 1, 0.3); g.add(chisel);
  const point = mesh(new THREE.ConeGeometry(0.009, 0.04, 12), head.material); point.rotation.x = -Math.PI / 2; point.position.z = -0.08; g.add(point);
  const spring = new THREE.Curve(); spring.getPoint = t => V3(Math.cos(t * 50) * 0.008, -0.01 - t * 0.17, Math.sin(t * 50) * 0.008);
  g.add(mesh(new THREE.TubeGeometry(spring, 400, 0.0016, 6), steel));
  const grip = mesh(new THREE.CylinderGeometry(0.013, 0.012, 0.07, 16), plastic(0xc0201a, 0.6)); grip.position.y = -0.15; g.add(grip);
  const root = new THREE.Group(); g.rotation.x = Math.PI / 2; g.position.y = 0.011; root.add(g); return root;
}
export function buildWireBrush() {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.6, bumpMap: leatherTex(), bumpScale: 0.6 });
  const shape = new THREE.Shape(); shape.moveTo(-0.07, 0); shape.lineTo(0.07, 0); shape.lineTo(0.07, 0.016); shape.quadraticCurveTo(0.1, 0.02, 0.14, 0.03); shape.lineTo(0.25, 0.034); shape.quadraticCurveTo(0.265, 0.03, 0.25, 0.022); shape.lineTo(0.14, 0.018); shape.quadraticCurveTo(0.1, 0.012, -0.07, 0.016); shape.lineTo(-0.07, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }); geo.translate(0, 0.012, -0.013);
  g.add(mesh(geo, wood));
  const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.016, 4), steel, 4 * 26);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < 26; i++) for (let j = 0; j < 4; j++) { m4.makeRotationZ((Math.random() - 0.5) * 0.15); m4.setPosition(-0.062 + i * 0.005, 0.006, -0.009 + j * 0.006); inst.setMatrixAt(k++, m4); }
  inst.castShadow = true; g.add(inst);
  return g;
}
