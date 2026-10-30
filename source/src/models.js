// All 3D models of the SMAW station, built procedurally with PBR materials (units: meters).
import * as THREE from 'three';
import { buildBrandSign } from './brand.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Textures } from './textures.js';

export const TABLE_Y = 0.86;          // table top surface
export const PLATE_T = 0.006;          // default plate thickness
export const JOINT = { x0: 0.215, x1: 0.385, z: 0.05, y: TABLE_Y + PLATE_T, t: PLATE_T, kind: 'butt' };

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function makeMaterials() {
  const paint = Textures.paint(), brushed = Textures.brushed(), rubber = Textures.rubber();
  const mill = Textures.millScale(), top = Textures.tableTop(), knurl = Textures.knurl();
  return {
    orange: new THREE.MeshPhysicalMaterial({ color: 0xd8641c, roughness: 0.42, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.4, bumpMap: paint.bumpMap, bumpScale: 0.6 }),
    orangeDark: new THREE.MeshStandardMaterial({ color: 0x8f3f10, roughness: 0.6, metalness: 0.1 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.55, metalness: 0.2, bumpMap: paint.bumpMap, bumpScale: 0.3 }),
    blackPlastic: new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.5, metalness: 0.0 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.82, metalness: 0.0, bumpMap: rubber.bumpMap, bumpScale: 0.8 }),
    redPlastic: new THREE.MeshPhysicalMaterial({ color: 0xa82a22, roughness: 0.35, clearcoat: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4cad0, roughness: 0.35, metalness: 1.0, roughnessMap: brushed.roughnessMap, bumpMap: brushed.bumpMap, bumpScale: 0.15 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.5, metalness: 0.9 }),
    tube: new THREE.MeshStandardMaterial({ color: 0x2c3137, roughness: 0.55, metalness: 0.6, bumpMap: paint.bumpMap, bumpScale: 0.3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd9a55c, roughness: 0.3, metalness: 1.0 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xc7774a, roughness: 0.32, metalness: 1.0 }),
    plate: new THREE.MeshStandardMaterial({ map: mill.map, roughnessMap: mill.roughnessMap, bumpMap: mill.bumpMap, bumpScale: 0.4, color: 0xa4aab0, roughness: 1, metalness: 0.7 }),
    plateEdge: new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.3, metalness: 1.0, roughnessMap: brushed.roughnessMap }),
    tableTop: new THREE.MeshStandardMaterial({ map: top.map, roughnessMap: top.roughnessMap, bumpMap: top.bumpMap, bumpScale: 0.5, roughness: 1, metalness: 0.7 }),
    flux: new THREE.MeshStandardMaterial({ color: 0xb9b19a, roughness: 0.9, metalness: 0.0 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.65, metalness: 0.0 }),
    knob: new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.45, metalness: 0.1, bumpMap: knurl.bumpMap, bumpScale: 1.5 }),
    cardboard: new THREE.MeshStandardMaterial({ color: 0x9c8f73, roughness: 0.9 }),
    ledGreenOff: new THREE.MeshStandardMaterial({ color: 0x0f2a1c, roughness: 0.3 }),
    ledGreenOn: new THREE.MeshStandardMaterial({ color: 0x2bd47f, emissive: 0x2bd47f, emissiveIntensity: 3, roughness: 0.3 }),
    ledAmber: new THREE.MeshStandardMaterial({ color: 0x3a2a08, roughness: 0.3 })
  };
}

function mesh(geo, mat, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

// ---------------- Room ----------------
export function buildRoom(scene) {
  const c = Textures.concrete();
  const floor = mesh(new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ map: c.map, roughnessMap: c.roughnessMap, bumpMap: c.bumpMap, bumpScale: 0.6, roughness: 1, metalness: 0 }), false, true);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const w = Textures.wall();
  const wallMat = new THREE.MeshStandardMaterial({ map: w.map, roughness: 0.9 });
  const back = mesh(new THREE.PlaneGeometry(12, 4), wallMat, false, true);
  back.position.set(0, 2, -1.6); scene.add(back);
  const side = mesh(new THREE.PlaneGeometry(12, 4), wallMat, false, true);
  side.rotation.y = Math.PI / 2; side.position.set(-2.2, 2, 0); scene.add(side);
  // training-center sign on the back wall and the side wall
  const sign = buildBrandSign(1.9); sign.position.set(0.3, 2.3, -1.585); scene.add(sign);
  const sign2 = buildBrandSign(1.3); sign2.rotation.y = Math.PI / 2; sign2.position.set(-2.185, 1.75, -0.35); scene.add(sign2);

  // yellow safety line on floor around the booth
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd9a400, roughness: 0.7 });
  const l1 = mesh(new THREE.PlaneGeometry(3.2, 0.06), lineMat, false, true);
  l1.rotation.x = -Math.PI / 2; l1.position.set(-0.1, 0.002, 0.95); scene.add(l1);

  // Welding curtain (translucent orange) on a frame behind the table
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.5, metalness: 0.7 });
  const g = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.9, 12);
  [-0.5, 1.15].forEach(x => { const p = mesh(postGeo, frameMat); p.position.set(x, 0.95, -0.62); g.add(p); });
  const bar = mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.7, 12), frameMat);
  bar.rotation.z = Math.PI / 2; bar.position.set(0.325, 1.88, -0.62); g.add(bar);
  [-0.5, 1.15].forEach(x => { const f = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.5), frameMat); f.position.set(x, 0.015, -0.62); g.add(f); });
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.68, 40, 1),
    new THREE.MeshStandardMaterial({ color: 0x7a3216, roughness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
  const pos = curtain.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.012);
  curtain.geometry.computeVertexNormals();
  curtain.position.set(0.325, 1.02, -0.62);
  g.add(curtain);
  scene.add(g);

  // Fume extraction arm (adds realism to the booth)
  const arm = new THREE.Group();
  const duct = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.5, metalness: 0.6 });
  const curve = new THREE.CatmullRomCurve3([V(1.0, 2.6, -1.5), V(1.0, 2.1, -1.2), V(0.75, 1.75, -0.7), V(0.55, 1.5, -0.42)]);
  const ductMesh = mesh(new THREE.TubeGeometry(curve, 40, 0.055, 16, false), duct);
  arm.add(ductMesh);
  const hood = mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.12, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xb08400, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }));
  hood.position.set(0.53, 1.44, -0.38); hood.rotation.x = 0.5;
  arm.add(hood);
  scene.add(arm);
  return { floor, wallMat, back, side, curtain, curtainFrame: g, lineMat, fume: arm };
}

// ---------------- Table ----------------
export function buildTable(M) {
  const g = new THREE.Group();
  const W = 1.1, D = 0.62, cx = 0.3;
  const top = mesh(new THREE.BoxGeometry(W, 0.012, D), M.tableTop);
  top.position.set(cx, TABLE_Y - 0.006, 0); g.add(top);
  // angle-iron rim
  const rimGeo = new THREE.BoxGeometry(W, 0.04, 0.004);
  [D / 2, -D / 2].forEach(z => { const r = mesh(rimGeo, M.tube); r.position.set(cx, TABLE_Y - 0.032, z); g.add(r); });
  const legGeo = new THREE.BoxGeometry(0.04, TABLE_Y - 0.012, 0.04);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const l = mesh(legGeo, M.tube); l.position.set(cx + sx * (W / 2 - 0.04), (TABLE_Y - 0.012) / 2, sz * (D / 2 - 0.04)); g.add(l);
    const foot = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.012, 16), M.blackPlastic);
    foot.position.set(cx + sx * (W / 2 - 0.04), 0.006, sz * (D / 2 - 0.04)); g.add(foot);
  });
  const railGeo = new THREE.BoxGeometry(W - 0.08, 0.03, 0.03);
  [D / 2 - 0.04, -D / 2 + 0.04].forEach(z => { const r = mesh(railGeo, M.tube); r.position.set(cx, 0.18, z); g.add(r); });
  const shelf = mesh(new THREE.BoxGeometry(W - 0.1, 0.008, D - 0.1), M.darkSteel);
  shelf.position.set(cx, 0.2, 0); g.add(shelf);
  return g;
}

// ---------------- Plates ----------------
// kind: 'butt' (two plates, square butt joint with tack welds) | 'single' (one plate with a soapstone cut line)
export function buildPlates(M, opts = {}) {
  const T = opts.t ?? PLATE_T, kind = opts.kind || 'butt';
  const R = kind === 'single' ? 0.035 : 0;   // cutting plate sits on two steel bars so the kerf is open underneath
  JOINT.t = T; JOINT.y = TABLE_Y + R + T; JOINT.kind = kind;
  const g = new THREE.Group();
  const L = 0.2, Wd = 0.08, gap = kind === 'butt' ? 0.0016 : 0;
  const mats = [M.plateEdge, M.plateEdge, M.plate, M.plateEdge, M.plateEdge, M.plateEdge];
  if (kind === 'butt') {
    const a = mesh(new THREE.BoxGeometry(L, T, Wd), mats); a.position.set(0.3, TABLE_Y + T / 2, JOINT.z - gap / 2 - Wd / 2);
    const b = mesh(new THREE.BoxGeometry(L, T, Wd), mats); b.position.set(0.3, TABLE_Y + T / 2, JOINT.z + gap / 2 + Wd / 2);
    const uv = b.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9 + 0.3, uv.getY(i) * 0.6 + 0.4);
    g.add(a, b);
    const tackMat = new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.55, metalness: 0.8 });
    [0.205, 0.395].forEach(x => {
      const t = mesh(new THREE.SphereGeometry(0.006, 16, 10), tackMat);
      t.scale.set(1.3, 0.35 * Math.max(0.6, T / 0.006), 0.9); t.position.set(x, JOINT.y + 0.0006, JOINT.z); g.add(t);
    });
  } else {
    const a = mesh(new THREE.BoxGeometry(L, T, Wd * 2), mats); a.position.set(0.3, TABLE_Y + R + T / 2, JOINT.z);
    g.add(a);
    [-0.05, 0.05].forEach(dz => { const bar = mesh(new THREE.BoxGeometry(0.24, R, 0.025), M.darkSteel); bar.position.set(0.3, TABLE_Y + R / 2, JOINT.z + dz); g.add(bar); });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.02, 0.0008), new THREE.MeshStandardMaterial({ color: 0x9ea4a9, roughness: 0.95 }));
    line.rotation.x = -Math.PI / 2; line.position.set(0.3, JOINT.y + 0.0002, JOINT.z); g.add(line);
  }
  return g;
}

// ---------------- Welding machine on cart ----------------
export function buildMachine(M) {
  const root = new THREE.Group();
  root.position.set(-0.6, 0, 0.02);
  // cart
  const cart = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(0.38, 0.02, 0.62), M.tube); deck.position.y = 0.11; cart.add(deck);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const wheel = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24), M.rubber);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 0.15, 0.045, sz * 0.25); cart.add(wheel);
    const hub = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.034, 16), M.steel);
    hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); cart.add(hub);
    const fork = mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), M.tube); fork.position.set(sx * 0.15, 0.085, sz * 0.25); cart.add(fork);
  });
  const handleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.75, 12);
  [-0.15, 0.15].forEach(x => { const h = mesh(handleGeo, M.tube); h.position.set(x, 0.48, -0.3); cart.add(h); });
  const hb = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 12), M.rubber); hb.rotation.z = Math.PI / 2; hb.position.set(0, 0.85, -0.3); cart.add(hb);
  root.add(cart);

  // body
  const body = new THREE.Group();
  body.position.set(0, 0.12 + 0.21, 0);
  const W = 0.3, H = 0.42, D = 0.52;
  const shell = mesh(new RoundedBoxGeometry(W, H, D, 4, 0.018), M.orange);
  body.add(shell);
  // front bezel
  const bezel = mesh(new RoundedBoxGeometry(W + 0.006, H + 0.006, 0.03, 3, 0.01), M.blackPlastic);
  bezel.position.z = D / 2 - 0.01; body.add(bezel);
  const panel = mesh(new THREE.BoxGeometry(W - 0.03, H - 0.03, 0.004), M.panel);
  panel.position.z = D / 2 + 0.006; body.add(panel);
  // printed panel graphics
  const gfx = Textures.label((c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
    c.fillStyle = '#c9cfd9'; c.textAlign = 'center';
    c.font = '600 34px "IBM Plex Mono", monospace'; c.fillText('ARC 200', w / 2, 70);
    c.fillStyle = '#ff8a2b'; c.fillRect(w / 2 - 120, 86, 240, 4);
    c.fillStyle = '#9aa3b1'; c.font = '600 26px "IBM Plex Sans Arabic", sans-serif';
    c.fillText('التيار', w * 0.73, 400);
    c.fillText('تشغيل', w * 0.17, 330); c.fillText('حرارة', w * 0.36, 330);
    c.font = '600 54px "IBM Plex Mono", monospace';
    c.fillStyle = '#ff7b6b'; c.fillText('+', w * 0.3, 905);
    c.fillStyle = '#e1e5ea'; c.fillText('−', w * 0.7, 905);
    c.strokeStyle = '#4a5260'; c.lineWidth = 3;
    c.beginPath(); c.arc(w * 0.73, 250, 100, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
    c.font = '500 22px "IBM Plex Mono", monospace'; c.fillStyle = '#7b8494';
    [['40', 0.75], ['120', 1.5], ['200', 2.25]].forEach(([t, a]) => { const ang = a * Math.PI; c.fillText(t, w * 0.73 + Math.cos(ang) * 132, 258 + Math.sin(ang) * 132); });
    c.fillStyle = '#7b8494'; c.font = '500 20px "IBM Plex Mono", monospace'; c.fillText('U₀ 65V   I₂ 40–200A   IP21S', w / 2, 990);
  }, 512, 1024);
  const gfxPlane = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, H - 0.03), new THREE.MeshStandardMaterial({ map: gfx, transparent: true, roughness: 0.6 }));
  gfxPlane.position.z = D / 2 + 0.0085; body.add(gfxPlane);
  const fx = (u) => (u - 0.5) * (W - 0.03), fy = (v) => (0.5 - v) * (H - 0.03);

  // display
  const dispCanvas = document.createElement('canvas'); dispCanvas.width = 256; dispCanvas.height = 128;
  const dispTex = new THREE.CanvasTexture(dispCanvas); dispTex.colorSpace = THREE.SRGBColorSpace;
  const dispMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: dispTex, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0 });
  const disp = mesh(new THREE.BoxGeometry(0.105, 0.05, 0.004), [M.blackPlastic, M.blackPlastic, M.blackPlastic, M.blackPlastic, dispMat, M.blackPlastic], false, false);
  disp.position.set(fx(0.3), fy(0.2), D / 2 + 0.01); body.add(disp);
  const drawDisplay = (val, on) => {
    const c = dispCanvas.getContext('2d');
    c.fillStyle = '#050403'; c.fillRect(0, 0, 256, 128);
    c.textAlign = 'right'; c.font = '600 92px "IBM Plex Mono", monospace';
    c.fillStyle = '#1d1208'; c.fillText('888', 236, 102);
    if (on) { c.fillStyle = '#ffae5c'; c.fillText(String(val).padStart(3, ' '), 236, 102); }
    dispTex.needsUpdate = true;
  };
  drawDisplay(0, false);

  // knob
  const knob = new THREE.Group();
  const knobBody = mesh(new THREE.CylinderGeometry(0.026, 0.029, 0.026, 48), M.knob);
  knobBody.rotation.x = Math.PI / 2; knob.add(knobBody);
  const cap = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.004, 48), M.blackPlastic); cap.rotation.x = Math.PI / 2; cap.position.z = 0.014; knob.add(cap);
  const pointer = mesh(new THREE.BoxGeometry(0.004, 0.016, 0.002), new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xff8a2b, emissiveIntensity: 0.4 }));
  pointer.position.set(0, 0.012, 0.0165); knob.add(pointer);
  knob.position.set(fx(0.73), fy(0.243), D / 2 + 0.022);
  body.add(knob);

  // LEDs
  const ledG = mesh(new THREE.SphereGeometry(0.0045, 16, 12), M.ledGreenOff); ledG.position.set(fx(0.17), fy(0.29), D / 2 + 0.009); body.add(ledG);
  const ledA = mesh(new THREE.SphereGeometry(0.0045, 16, 12), M.ledAmber); ledA.position.set(fx(0.36), fy(0.29), D / 2 + 0.009); body.add(ledA);

  // power rocker switch
  const sw = new THREE.Group();
  const swBase = mesh(new THREE.BoxGeometry(0.03, 0.044, 0.008), M.blackPlastic); sw.add(swBase);
  const rocker = mesh(new THREE.BoxGeometry(0.024, 0.038, 0.01), new THREE.MeshPhysicalMaterial({ color: 0x8a1d18, roughness: 0.3, clearcoat: 0.6, transmission: 0.0 }));
  rocker.position.z = 0.006; rocker.rotation.x = 0.18; sw.add(rocker);
  sw.position.set(fx(0.2), fy(0.55), D / 2 + 0.012); body.add(sw);
  sw.userData.rocker = rocker;

  // Dinse sockets
  const sockets = {};
  [['plus', 0.3, M.redPlastic], ['minus', 0.7, M.blackPlastic]].forEach(([k, u, mat]) => {
    const s = new THREE.Group();
    const ring = mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.018, 32), mat); ring.rotation.x = Math.PI / 2; s.add(ring);
    const core = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 24), M.brass); core.rotation.x = Math.PI / 2; core.position.z = 0.002; s.add(core);
    const hole = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.021, 16), M.blackPlastic); hole.rotation.x = Math.PI / 2; hole.position.z = 0.003; s.add(hole);
    s.position.set(fx(u), fy(0.83), D / 2 + 0.012);
    body.add(s); sockets[k] = s;
  });

  // carry handle on top
  const hCurve = new THREE.CatmullRomCurve3([V(0, 0, -0.14), V(0, 0.05, -0.12), V(0, 0.06, 0), V(0, 0.05, 0.12), V(0, 0, 0.14)]);
  const handle = mesh(new THREE.TubeGeometry(hCurve, 30, 0.012, 12), M.blackPlastic); handle.position.y = H / 2; body.add(handle);

  // side vents
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x1a0d05, roughness: 0.9 });
  for (let i = 0; i < 9; i++) {
    [1, -1].forEach(s => {
      const v = mesh(new THREE.BoxGeometry(0.002, 0.008, 0.16), ventMat, false, false);
      v.position.set(s * (W / 2 + 0.0005), 0.08 - i * 0.022, -0.05); body.add(v);
    });
  }
  // rubber feet
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const f = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), M.rubber); f.position.set(sx * 0.11, -H / 2 - 0.004, sz * 0.2); body.add(f); });

  root.add(body);

  // power cord from back to wall
  const cord = new THREE.CatmullRomCurve3([V(0.08, 0.2, -0.27), V(0.1, 0.12, -0.4), V(0.2, 0.012, -0.6), V(0.0, 0.012, -1.1), V(-0.3, 0.012, -1.5), V(-0.35, 0.35, -1.58)]);
  const cordMesh = mesh(new THREE.TubeGeometry(cord, 60, 0.008, 8), M.rubber); cordMesh.position.y = 0.12; root.add(cordMesh);

  return {
    root, body, knob, disp, drawDisplay, sw, sockets, ledG, ledA,
    socketWorld(k) { const v = new THREE.Vector3(); sockets[k].getWorldPosition(v); return v; }
  };
}

// ---------------- Electrode holder ----------------
export function buildHolder(M) {
  const g = new THREE.Group(); // local +X points towards jaws/electrode
  const pts = [];
  // lathe profile for insulated handle (x along length)
  const prof = [[0, 0.004], [0.004, 0.015], [0.02, 0.017], [0.05, 0.016], [0.08, 0.017], [0.11, 0.018], [0.125, 0.02], [0.135, 0.016], [0.14, 0.0]];
  prof.forEach(([x, r]) => pts.push(new THREE.Vector2(r, x)));
  const handleGeo = new THREE.LatheGeometry(pts, 32);
  handleGeo.rotateZ(-Math.PI / 2);
  const handle = mesh(handleGeo, M.blackPlastic); handle.position.x = -0.14; g.add(handle);
  for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(0.0168, 0.0016, 8, 32), M.rubber); r.rotation.y = Math.PI / 2; r.position.x = -0.12 + i * 0.016; g.add(r); }
  const head = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.035, 24), new THREE.MeshStandardMaterial({ color: 0xa31f19, roughness: 0.45 }));
  head.rotation.z = Math.PI / 2; head.position.x = 0.012; g.add(head);
  const jawL = mesh(new THREE.BoxGeometry(0.04, 0.008, 0.022), M.copper); jawL.position.set(0.048, -0.006, 0); g.add(jawL);
  const jawU = mesh(new THREE.BoxGeometry(0.04, 0.008, 0.022), M.copper); jawU.position.set(0.048, 0.006, 0); g.add(jawU);
  const lever = mesh(new RoundedBoxGeometry(0.09, 0.012, 0.022, 2, 0.005), new THREE.MeshStandardMaterial({ color: 0xa31f19, roughness: 0.45 }));
  lever.position.set(-0.02, 0.026, 0); lever.rotation.z = -0.12; g.add(lever);
  const spring = mesh(new THREE.TorusGeometry(0.006, 0.0015, 6, 16), M.steel); spring.position.set(0.018, 0.017, 0); g.add(spring);
  g.userData.cableAnchor = new THREE.Vector3(-0.14, 0, 0);
  return g;
}

// ---------------- Electrode (E6013 Ø3.25 x 350) ----------------
export function buildElectrode(M) {
  const g = new THREE.Group(); // starts at origin, extends along +X
  const bare = mesh(new THREE.CylinderGeometry(0.001625, 0.001625, 0.025, 12), M.steel);
  bare.rotation.z = Math.PI / 2; bare.position.x = 0.0125; g.add(bare);
  const coat = mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 16), M.flux);
  coat.rotation.z = Math.PI / 2; g.add(coat);
  const tipCore = mesh(new THREE.CircleGeometry(0.0016, 12), M.steel); tipCore.rotation.y = Math.PI / 2; g.add(tipCore);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.003, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0 }));
  g.add(glow);
  g.userData.setLength = (L) => {   // total length incl. bare 25 mm
    const coatLen = Math.max(0.005, L - 0.025);
    coat.scale.y = coatLen; coat.position.x = 0.025 + coatLen / 2;
    tipCore.position.x = 0.025 + coatLen + 0.0002;
    glow.position.x = 0.025 + coatLen;
    g.userData.length = L;
  };
  g.userData.setHot = (h) => { glow.material.opacity = h; };
  g.userData.setLength(0.35);
  return g;
}

// ---------------- Ground clamp ----------------
export function buildClamp(M) {
  const g = new THREE.Group(); // jaws open toward +X, cable leaves toward -X
  const jawMat = M.copper;
  const armMat = new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.5, metalness: 0.2 });
  const top = mesh(new RoundedBoxGeometry(0.11, 0.012, 0.03, 2, 0.005), armMat); top.position.set(0, 0.018, 0); top.rotation.z = 0.12; g.add(top);
  const bot = mesh(new RoundedBoxGeometry(0.11, 0.012, 0.03, 2, 0.005), armMat); bot.position.set(0, -0.018, 0); bot.rotation.z = -0.12; g.add(bot);
  const jt = mesh(new THREE.BoxGeometry(0.03, 0.008, 0.034), jawMat); jt.position.set(0.05, 0.008, 0); g.add(jt);
  const jb = mesh(new THREE.BoxGeometry(0.03, 0.008, 0.034), jawMat); jb.position.set(0.05, -0.008, 0); g.add(jb);
  const pivot = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 12), M.steel); pivot.rotation.x = Math.PI / 2; pivot.position.x = 0.01; g.add(pivot);
  const spring = mesh(new THREE.TorusGeometry(0.012, 0.002, 8, 20), M.steel); spring.position.x = -0.01; g.add(spring);
  const tipT = mesh(new THREE.BoxGeometry(0.04, 0.014, 0.034), new THREE.MeshStandardMaterial({ color: 0xa31f19, roughness: 0.45 })); tipT.position.set(-0.06, 0.03, 0); tipT.rotation.z = 0.25; g.add(tipT);
  const tipB = tipT.clone(); tipB.position.set(-0.06, -0.03, 0); tipB.rotation.z = -0.25; g.add(tipB);
  g.userData.cableAnchor = new THREE.Vector3(-0.07, -0.02, 0);
  return g;
}

// ---------------- Cable lug (Dinse plug) ----------------
export function buildPlug(M, red) {
  const g = new THREE.Group(); // plug axis along -Z into socket; cable leaves along +Z
  const body = mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.06, 24), new THREE.MeshStandardMaterial({ color: red ? 0x1d1f22 : 0x1d1f22, roughness: 0.5 }));
  body.rotation.x = Math.PI / 2; body.position.z = 0.03; g.add(body);
  const band = mesh(new THREE.CylinderGeometry(0.0172, 0.0172, 0.008, 24), red ? M.redPlastic : M.blackPlastic); band.rotation.x = Math.PI / 2; band.position.z = 0.012; g.add(band);
  const pin = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 12), M.brass); pin.rotation.x = Math.PI / 2; pin.position.z = -0.006; g.add(pin);
  g.userData.cableAnchor = new THREE.Vector3(0, 0, 0.06);
  return g;
}

// ---------------- Cable (dynamic tube) ----------------
export class Cable {
  constructor(M, radius = 0.0095) {
    this.radius = radius;
    this.mesh = mesh(new THREE.BufferGeometry(), M.rubber);
    this.mesh.frustumCulled = false;
  }
  // a/b: world endpoints, da/db: unit directions the cable leaves each end
  update(a, da, b, db, opts = {}) {
    const floorY = this.radius + 0.0005;
    const p = [];
    p.push(a.clone());
    p.push(a.clone().addScaledVector(da, 0.06));
    const aDrop = a.clone().addScaledVector(da, 0.16); aDrop.y = Math.max(floorY, a.y * 0.35);
    p.push(aDrop);
    const fa = a.clone().addScaledVector(da, 0.26); fa.y = floorY; p.push(fa);
    if (opts.via) opts.via.forEach(v => p.push(v.clone()));
    const side = opts.bSide || (b.y > 0.3 ? 'table' : 'floor');
    if (side === 'table') {
      // end is on the table: rise over the front edge
      const edgeZ = opts.edgeZ ?? 0.31;
      const lx = opts.lipX ?? b.x;
      const fb = new THREE.Vector3(lx - 0.05, floorY, edgeZ + 0.24); p.push(fb);
      const up = new THREE.Vector3(lx - 0.02, TABLE_Y * 0.55, edgeZ + 0.1); p.push(up);
      const lip = new THREE.Vector3(lx, TABLE_Y + this.radius + 0.003, edgeZ + 0.012); p.push(lip);
      const on = new THREE.Vector3((lx + b.x) / 2, TABLE_Y + this.radius + 0.001, (edgeZ + b.z) / 2 + 0.02);
      if (Math.hypot(on.x - b.x, on.z - b.z) > 0.08) p.push(on);
    } else if (side === 'free') {
      // end is held in the air (welding): hang loosely down to the floor in front of the table
      const mid = b.clone().addScaledVector(db, 0.12); mid.y = Math.max(mid.y - 0.05, TABLE_Y + 0.05); mid.z = Math.max(mid.z, 0.2);
      const fb = new THREE.Vector3(b.x + 0.1, floorY, 0.62);
      const hang = new THREE.Vector3(b.x + 0.12, TABLE_Y * 0.7, 0.42);
      p.push(fb, hang, mid);
    } else if (side === 'hang') {
      // end clamped at table edge, cable drops down beside the table
      const fb = new THREE.Vector3(b.x + 0.12, floorY, b.z + 0.3); p.push(fb);
      const down = new THREE.Vector3(b.x + 0.1, TABLE_Y * 0.55, b.z + 0.06); p.push(down);
    } else {
      const fb = b.clone().addScaledVector(db, 0.2); fb.y = floorY; p.push(fb);
    }
    p.push(b.clone().addScaledVector(db, 0.07));
    p.push(b.clone());
    const rough = new THREE.CatmullRomCurve3(p, false, 'centripetal', 0.5);
    // sample densely and keep every point resting on (never under) the floor
    const pts = rough.getSpacedPoints(120);
    for (const q of pts) if (q.y < floorY) q.y = floorY;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(curve, 160, this.radius, 10, false);
  }
}

// ---------------- Hand tools & consumables ----------------
export function buildHammer(M) {
  const g = new THREE.Group();
  const handle = mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.2, 16), M.wood); handle.rotation.z = Math.PI / 2; handle.position.x = -0.1; g.add(handle);
  const coil = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 16), M.steel); coil.rotation.z = Math.PI / 2; coil.position.x = 0.02; g.add(coil);
  const head = mesh(new THREE.BoxGeometry(0.016, 0.016, 0.13), M.darkSteel); head.position.set(0.05, 0, 0); g.add(head);
  const chisel = mesh(new THREE.ConeGeometry(0.011, 0.035, 4), M.darkSteel); chisel.rotation.x = Math.PI / 2; chisel.position.set(0.05, 0, 0.082); g.add(chisel);
  const point = mesh(new THREE.ConeGeometry(0.009, 0.04, 12), M.darkSteel); point.rotation.x = -Math.PI / 2; point.position.set(0.05, 0, -0.085); g.add(point);
  return g;
}

export function buildBrush(M) {
  const g = new THREE.Group();
  const block = mesh(new RoundedBoxGeometry(0.14, 0.018, 0.03, 2, 0.006), M.wood); block.position.set(0.04, 0.02, 0); g.add(block);
  const handle = mesh(new RoundedBoxGeometry(0.16, 0.014, 0.022, 2, 0.006), M.wood); handle.position.set(-0.1, 0.022, 0); handle.rotation.z = 0.08; g.add(handle);
  const bristleGeo = new THREE.CylinderGeometry(0.0005, 0.0005, 0.018, 4);
  const inst = new THREE.InstancedMesh(bristleGeo, M.steel, 180);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < 30; i++) for (let j = 0; j < 6; j++) {
    m.makeTranslation(-0.025 + i * 0.0045, 0.002, -0.011 + j * 0.0045); inst.setMatrixAt(k++, m);
  }
  inst.castShadow = true; g.add(inst);
  return g;
}

export function buildElectrodeBox(M) {
  const g = new THREE.Group();
  const lbl = Textures.label((c, w, h) => {
    c.fillStyle = '#e9e2cf'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f4e8c'; c.fillRect(0, 60, w, 130);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '600 64px "IBM Plex Mono", monospace'; c.fillText('E6013', w / 2, 150);
    c.fillStyle = '#1f2a37'; c.font = '500 34px "IBM Plex Mono", monospace'; c.fillText('Ø 3.25 × 350 mm', w / 2, 232);
  }, 512, 256);
  const side = new THREE.MeshStandardMaterial({ map: lbl, roughness: 0.85 });
  const box = mesh(new THREE.BoxGeometry(0.36, 0.045, 0.07), [M.cardboard, M.cardboard, M.cardboard, M.cardboard, side, M.cardboard]);
  box.position.y = 0.0225; g.add(box);
  // a few electrodes sticking out of open end
  for (let i = 0; i < 5; i++) {
    const e = buildElectrode(M); e.position.set(-0.155 + (i % 2) * 0.006, 0.012 + (i % 3) * 0.007, -0.022 + i * 0.011); g.add(e);
  }
  return g;
}
