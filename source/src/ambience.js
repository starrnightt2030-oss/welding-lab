// Each station is a different corner of the Alexandria Shipyard training workshop:
// wall/curtain colours, light temperature and props change when the student enters it.
import * as THREE from 'three';
import { Textures } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, cast = true, receive = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function signTex(lines, bg = '#c8102e', fg = '#fff') {
  const t = canvasTex(512, 256, () => {});
  const draw = () => { const c = t.image.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, 512, 256); c.strokeStyle = fg; c.lineWidth = 10; c.strokeRect(12, 12, 488, 232);
    c.fillStyle = fg; c.textAlign = 'center'; c.direction = 'rtl'; lines.forEach(([txt, size, y]) => { c.font = `700 ${size}px "IBM Plex Sans Arabic",sans-serif`; c.fillText(txt, 256, y); }); t.needsUpdate = true; };
  draw(); if (document.fonts) document.fonts.ready.then(draw);
  return t;
}

// --- props
function brickWall() {
  const g = new THREE.Group();
  const tex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#7a3b26'; c.fillRect(0, 0, w, h);
    const bh = 32, bw = 96;
    for (let r = 0; r < h / bh; r++) for (let x = -(r % 2) * bw / 2; x < w; x += bw) {
      const k = Math.random() * 30 - 15; c.fillStyle = `rgb(${150 + k},${72 + k / 2},${48 + k / 3})`; c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x + 3, r * bh + bh - 8, bw - 6, 5);
    }
    const sg = c.createLinearGradient(0, 0, 0, h * 0.45); sg.addColorStop(0, 'rgba(25,18,14,.45)'); sg.addColorStop(1, 'rgba(25,18,14,0)'); c.fillStyle = sg; c.fillRect(0, 0, w, h * 0.45);   // soot near the top
  }, [2.5, 2]);
  const wall = mesh(new THREE.BoxGeometry(2.4, 2.1, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, bumpMap: tex, bumpScale: 1.5 }));
  wall.position.set(0.32, 1.05, -0.78); g.add(wall);
  const sign = mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshStandardMaterial({ map: signTex([['ممنوع التدخين', 64, 105], ['خطر — غازات قابلة للاشتعال', 38, 185]]), roughness: 0.5 }), false, false);
  sign.position.set(0.32, 1.72, -0.675); g.add(sign);
  // cylinder storage cage on the left
  const cage = new THREE.Group(), bar = new THREE.MeshStandardMaterial({ color: 0xd9a400, roughness: 0.5, metalness: 0.5 });
  for (let i = 0; i <= 6; i++) { const p = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 8), bar); p.position.set(-0.45 + i * 0.15, 0.75, 0); cage.add(p); }
  [0.05, 0.75, 1.48].forEach(y => { const r = mesh(new THREE.BoxGeometry(0.95, 0.03, 0.03), bar); r.position.set(0, y, 0); cage.add(r); });
  for (let i = 0; i < 3; i++) { const c = mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.3, 20), new THREE.MeshStandardMaterial({ color: i === 1 ? 0x8f1d1d : 0x1b1d20, roughness: 0.45, metalness: 0.3 })); c.position.set(-0.3 + i * 0.3, 0.66, -0.2); cage.add(c); }
  cage.position.set(-1.55, 0, -1.25); g.add(cage);
  return g;
}
function hullSection() {
  // a block of ship hull under construction: curved shell plating with frames and longitudinals
  const g = new THREE.Group();
  const W = 3.4, H = 2.8, segs = 40;
  const geo = new THREE.PlaneGeometry(W, H, segs, 12), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, -Math.pow((y + H / 2) / H, 2) * 0.9); }
  geo.computeVertexNormals();
  const tex = canvasTex(1024, 1024, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6f7880'); gr.addColorStop(0.55, '#5c656d'); gr.addColorStop(0.56, '#8c2a22'); gr.addColorStop(1, '#6e2019'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(20,20,22,.6)'; c.lineWidth = 4; for (let x = 0; x < w; x += 170) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 256) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '700 54px "IBM Plex Mono",monospace'; c.fillText('BLOCK 214-S', 60, 120); c.fillText('FR 46', 60, 190);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '120,60,30' : '40,40,40'},${Math.random() * 0.25})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1 + Math.random() * 4); }
  });
  const shell = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.55, side: THREE.DoubleSide }));
  g.add(shell);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x5c656d, roughness: 0.55, metalness: 0.6 });
  for (let i = 0; i <= 6; i++) {   // transverse frames (bent T-bars) on the inside face
    const x = -W / 2 + 0.15 + i * (W - 0.3) / 6, pts = [];
    for (let k = 0; k <= 12; k++) { const y = -H / 2 + (k / 12) * H; pts.push(V(x, y, -Math.pow((y + H / 2) / H, 2) * 0.9 + 0.09)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 6), frameM));
  }
  g.position.set(-1.45, H / 2, -0.75); g.rotation.y = 0.85; g.scale.setScalar(0.85);
  // stacked steel plates + I-beam on the floor
  const stack = new THREE.Group(), plateM = new THREE.MeshStandardMaterial({ map: Textures.brushed().map, color: 0x9aa0a6, roughness: 0.45, metalness: 0.85 });
  for (let i = 0; i < 6; i++) { const p = mesh(new THREE.BoxGeometry(1.2, 0.02, 0.6), plateM); p.position.set((Math.random() - 0.5) * 0.04, 0.03 + i * 0.022, (Math.random() - 0.5) * 0.04); stack.add(p); }
  [0, 0.25].forEach(z => { const s = mesh(new THREE.BoxGeometry(1.3, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 })); s.position.set(0, 0.0, z - 0.1); stack.add(s); });
  stack.position.set(1.85, 0, -0.35); stack.rotation.y = -0.4;
  const root = new THREE.Group(); root.add(g, stack);
  return root;
}
function oldWorkshop() {
  const g = new THREE.Group();
  // pendant lamp with warm light above the bench
  const shade = mesh(new THREE.ConeGeometry(0.22, 0.18, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }));
  shade.position.set(0.3, 2.05, 0.05); g.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb060, emissiveIntensity: 3 }), false, false); bulb.position.set(0.3, 1.97, 0.05); g.add(bulb);
  const wire = mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); wire.position.set(0.3, 2.62, 0.05); g.add(wire);
  const lamp = new THREE.PointLight(0xffb469, 2.2, 3.5, 2); lamp.position.set(0.3, 1.95, 0.05); g.add(lamp);
  // wooden crates
  const wood = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#7a5530'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 42) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, w, 3); } for (let i = 0; i < 80; i++) { c.fillStyle = 'rgba(40,25,10,.25)'; c.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 80, 1); } }), roughness: 0.9 });
  [[1.7, 0.2, -0.5, 0.4], [1.75, 0.6, -0.5, 0.32], [1.3, 0.18, -0.9, 0.36]].forEach(([x, y, z, s]) => { const b = mesh(new THREE.BoxGeometry(s, s, s), wood); b.position.set(x, y, z); b.rotation.y = Math.random(); g.add(b); });
  return g;
}
function cleanRoom() {
  const g = new THREE.Group();
  const ss = new THREE.MeshStandardMaterial({ map: Textures.brushed().map, color: 0xd9dde2, roughness: 0.3, metalness: 0.9 });
  const cab = mesh(new THREE.BoxGeometry(0.9, 1.0, 0.45), ss); cab.position.set(1.75, 0.5, -0.9); g.add(cab);
  [0.25, 0.75].forEach(y => { const h = mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x222 })); h.position.set(1.75, y, -0.67); g.add(h); });
  const sign = mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: signTex([['منطقة نظيفة', 60, 105], ['لحام الصلب الذي لا يصدأ والألومنيوم', 30, 180]], '#0d6b5e'), roughness: 0.5 }), false, false);
  sign.position.set(1.75, 1.45, -1.59); g.add(sign);
  // epoxy floor mat
  const mat = mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x5f8f86, roughness: 0.35, metalness: 0.05 }), false, true);
  mat.rotation.x = -Math.PI / 2; mat.position.set(0.3, 0.003, 0.1); g.add(mat);
  return g;
}

const LOOK = {
  safety: { wall: 0xffffff, curtain: 0x7a3216, curtainOn: true, key: 0xffffff, props: null },
  smaw: { wall: 0xffffff, curtain: 0x7a3216, curtainOn: true, key: 0xfff4e6, props: null },
  oaw: { wall: 0xe6d6c8, curtain: 0x2b5d3a, curtainOn: false, key: 0xffe8cc, props: brickWall },
  caw: { wall: 0xb9a48c, curtain: 0x5a1a14, curtainOn: true, key: 0xffd9a8, props: oldWorkshop, dim: 0.8 },
  co2: { wall: 0xc7cfd8, curtain: 0x1d3f7a, curtainOn: true, key: 0xeef4ff, props: hullSection },
  mig: { wall: 0xc7cfd8, curtain: 0x1d3f7a, curtainOn: true, key: 0xeef4ff, props: hullSection },
  tig: { wall: 0xeef3f7, curtain: 0x1f6b70, curtainOn: true, key: 0xf2f8ff, props: cleanRoom, curtainOpacity: 0.7 }
};

export function createAmbience(scene, room, E) {
  const built = {}; let cur = null;
  const baseKey = E.key ? E.key.intensity : 1;
  return function set(id) {
    const L = LOOK[id] || LOOK.smaw;
    if (cur && built[cur]) built[cur].visible = false;
    cur = id;
    if (L.props) { if (!built[id]) { built[id] = L.props(); scene.add(built[id]); } built[id].visible = true; }
    room.wallMat.color.set(L.wall);
    room.curtain.material.color.set(L.curtain); room.curtain.material.opacity = L.curtainOpacity ?? 0.88;
    room.curtainFrame.visible = L.curtainOn;
    if (E.key) { E.key.color.set(L.key); E.key.intensity = baseKey * (L.dim ?? 1); }
  };
}
