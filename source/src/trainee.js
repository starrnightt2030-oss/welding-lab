// A trainee in the Alexandria Shipyard blue coverall. The PPE the student chooses appears ON him.
import * as THREE from 'three';
import { LOGO } from './brandlogo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
function M(geo, mat, p, r, s) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; if (p) m.position.copy(p); if (r) m.rotation.set(...r); if (s) m.scale.set(...s); return m; }
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);

export function buildTrainee() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = std(0xc28a5e, { roughness: 0.6 }), cover = std(0x2a63c4, { roughness: 0.8 }), coverD = std(0x1d4a9a, { roughness: 0.8 });
  const refl = std(0xd7dde6, { roughness: 0.3, metalness: 0.4 }), red = std(0xe4232a, { roughness: 0.6 }), dark = std(0x16181c, { roughness: 0.5 });
  // ---- body in coverall
  const torso = M(cap(0.165, 0.34), cover, V(0, 1.22, 0), null, [1.12, 1, 0.68]); body.add(torso);
  body.add(M(cap(0.15, 0.08), coverD, V(0, 0.95, 0), null, [1.1, 1, 0.72]));
  body.add(M(new THREE.CylinderGeometry(0.172, 0.172, 0.05, 24), dark, V(0, 0.98, 0), null, [1.1, 1, 0.7]));   // belt
  [-1, 1].forEach(s => {
    body.add(M(cap(0.072, 0.7), cover, V(s * 0.095, 0.52, 0)));                                       // leg
    body.add(M(new THREE.CylinderGeometry(0.077, 0.077, 0.03, 16), refl, V(s * 0.095, 0.36, 0)));       // reflective band
    body.add(M(new THREE.CylinderGeometry(0.077, 0.077, 0.022, 16), red, V(s * 0.095, 0.335, 0)));
    body.add(M(new THREE.BoxGeometry(0.1, 0.07, 0.24), dark, V(s * 0.095, 0.035, 0.04)));              // work shoes
    // arms hang slightly away from the body
    const arm = new THREE.Group(); arm.position.set(s * 0.215, 1.42, 0); arm.rotation.z = s * 0.1;
    arm.add(M(new THREE.SphereGeometry(0.07, 16, 12), cover, V(0, 0, 0)));                               // shoulder
    arm.add(M(cap(0.056, 0.24), cover, V(0, -0.16, 0)));
    arm.add(M(cap(0.05, 0.22), cover, V(0, -0.43, 0.01)));
    arm.add(M(new THREE.CylinderGeometry(0.058, 0.058, 0.025, 14), red, V(0, -0.2, 0)));
    arm.add(M(new THREE.SphereGeometry(0.048, 14, 10), skin, V(0, -0.6, 0.015), null, [0.9, 1.15, 0.7])); // hand
    arm.userData.hand = V(0, -0.6, 0.015); body.add(arm); body.userData['arm' + (s > 0 ? 'R' : 'L')] = arm;
  });
  // chest: zip, pocket, centre logo patch
  body.add(M(new THREE.BoxGeometry(0.008, 0.36, 0.01), refl, V(0, 1.2, 0.114)));
  const lt = new THREE.TextureLoader().load(LOGO); lt.colorSpace = THREE.SRGBColorSpace;
  body.add(M(new THREE.CircleGeometry(0.045, 32), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.6 }), V(0.09, 1.3, 0.113), [0, 0.2, 0]));
  body.add(M(new THREE.BoxGeometry(0.08, 0.07, 0.01), coverD, V(-0.09, 1.27, 0.11), [0, -0.2, 0]));
  body.add(M(new THREE.BoxGeometry(0.4, 0.025, 0.25), refl, V(0, 1.08, 0), null, [1, 1, 1]));
  // head
  const head = new THREE.Group(); head.position.set(0, 1.63, 0.01); body.add(head);
  body.add(M(new THREE.CylinderGeometry(0.048, 0.055, 0.1, 14), skin, V(0, 1.52, 0)));
  body.add(M(new THREE.TorusGeometry(0.058, 0.018, 8, 20), cover, V(0, 1.49, 0), [Math.PI / 2, 0, 0]));   // collar
  head.add(M(new THREE.SphereGeometry(0.105, 28, 20), skin, V(0, 0, 0), null, [0.9, 1.08, 0.97]));
  head.add(M(new THREE.SphereGeometry(0.108, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), std(0x1a1410, { roughness: 0.9 }), V(0, 0.012, -0.006), [-0.25, 0, 0], [0.93, 1.08, 1]));   // hair
  [-1, 1].forEach(s => {
    head.add(M(new THREE.SphereGeometry(0.022, 10, 8), skin, V(s * 0.094, 0, 0), null, [0.5, 1, 0.8]));   // ears
    head.add(M(new THREE.SphereGeometry(0.011, 10, 8), std(0x15100c, { roughness: 0.3 }), V(s * 0.034, 0.018, 0.093)));   // eyes
    head.add(M(new THREE.BoxGeometry(0.03, 0.006, 0.006), std(0x2a1d14), V(s * 0.034, 0.042, 0.094), [0, 0, s * -0.12]));   // brows
  });
  head.add(M(new THREE.ConeGeometry(0.014, 0.035, 8), skin, V(0, -0.005, 0.106), [Math.PI / 2, 0, 0]));
  head.add(M(new THREE.BoxGeometry(0.035, 0.006, 0.006), std(0x7a3b2e), V(0, -0.045, 0.094)));
  body.userData.head = head;

  // ---- wearable PPE (built once, toggled)
  const W = {};
  const add = (k, parent, objs) => { const g = new THREE.Group(); objs.forEach(o => g.add(o)); g.visible = false; parent.add(g); W[k] = g; return g; };
  const helmetM = std(0x1f2329, { roughness: 0.4, metalness: 0.2 });
  add('helmet', head, [
    M(new THREE.SphereGeometry(0.135, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetM, V(0, 0.01, 0), null, [0.95, 1.05, 1.05]),
    M(new THREE.CylinderGeometry(0.128, 0.115, 0.22, 28, 1, true, -1.15, 2.3), new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.4, side: THREE.DoubleSide }), V(0, -0.04, 0)),
    M(new THREE.BoxGeometry(0.1, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0x0f3d24, emissive: 0x0b5a2c, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.6 }), V(0, 0.0, 0.13)),
    M(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 14), dark, V(0.13, -0.01, 0), [0, 0, Math.PI / 2]), M(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 14), dark, V(-0.13, -0.01, 0), [0, 0, Math.PI / 2])
  ]);
  add('shield', head, [
    M(new THREE.TorusGeometry(0.1, 0.008, 8, 28), dark, V(0, 0.06, 0), [Math.PI / 2, 0, 0], [0.95, 1.05, 1]),
    M(new THREE.CylinderGeometry(0.13, 0.12, 0.22, 28, 1, true, -1.2, 2.4), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.3, roughness: 0.05, transmission: 0.6, side: THREE.DoubleSide }), V(0, -0.04, 0.01))
  ]);
  add('goggles', head, [
    M(new THREE.TorusGeometry(0.103, 0.01, 8, 28), dark, V(0, 0.02, 0), [Math.PI / 2, 0, 0], [0.92, 1.02, 1]),
    ...[-1, 1].map(s => M(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0x0b3a22, emissive: 0x062b18, roughness: 0.1, metalness: 0.5 }), V(s * 0.036, 0.02, 0.1), [Math.PI / 2, 0, 0]))
  ]);
  add('glasses', head, [
    M(new THREE.BoxGeometry(0.15, 0.04, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35, roughness: 0.05 }), V(0, 0.02, 0.105)),
    M(new THREE.BoxGeometry(0.155, 0.008, 0.012), std(0xe0b020), V(0, 0.042, 0.105)),
    ...[-1, 1].map(s => M(new THREE.BoxGeometry(0.006, 0.006, 0.1), std(0xe0b020), V(s * 0.078, 0.035, 0.055)))
  ]);
  add('ear', head, [-1, 1].map(s => M(new THREE.SphereGeometry(0.012, 10, 8), std(0xff7a1a), V(s * 0.1, 0, 0.005))));
  add('resp', head, [
    M(new THREE.SphereGeometry(0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x50565e, { roughness: 0.5 }), V(0, -0.045, 0.075), [Math.PI / 2, 0, 0], [1.1, 0.9, 1]),
    ...[-1, 1].map(s => M(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 20), std(0xe86fa0, { roughness: 0.6 }), V(s * 0.06, -0.055, 0.1), [Math.PI / 2, 0, s * 0.5])),
    M(new THREE.TorusGeometry(0.1, 0.005, 6, 24), dark, V(0, -0.02, 0), [Math.PI / 2 - 0.3, 0, 0])
  ]);
  const leather = std(0x5e3a1e, { roughness: 0.85 });
  add('jacket', body, [
    M(cap(0.178, 0.3), leather, V(0, 1.25, 0), null, [1.12, 1, 0.7]),
    M(new THREE.TorusGeometry(0.065, 0.025, 8, 20), leather, V(0, 1.49, 0), [Math.PI / 2, 0, 0])
  ]);
  ['L', 'R'].forEach(k => { const arm = body.userData['arm' + k]; const j = new THREE.Group(); j.add(M(cap(0.064, 0.26), leather, V(0, -0.17, 0)), M(cap(0.058, 0.2), leather, V(0, -0.42, 0.01))); j.visible = false; arm.add(j); (W.jacketArms = W.jacketArms || []).push(j); });
  add('apron', body, [
    M(new THREE.BoxGeometry(0.36, 0.86, 0.012), std(0x6e4424, { roughness: 0.9 }), V(0, 0.95, 0.13)),
    M(new THREE.TorusGeometry(0.075, 0.008, 6, 20, Math.PI), std(0x6b4423), V(0, 1.47, 0.06), [0, 0, 0])
  ]);
  ['glovesL', 'glovesT'].forEach(k => {
    ['L', 'R'].forEach(side => {
      const arm = body.userData['arm' + side], h = arm.userData.hand, g = new THREE.Group();
      if (k === 'glovesL') { g.add(M(new THREE.SphereGeometry(0.058, 14, 10), std(0xb98a56), h, null, [0.95, 1.2, 0.8]), M(new THREE.CylinderGeometry(0.07, 0.055, 0.16, 16), std(0xb98a56), V(h.x, h.y + 0.1, h.z))); }
      else { g.add(M(new THREE.SphereGeometry(0.052, 14, 10), std(0xe2d6c2), h, null, [0.92, 1.18, 0.75]), M(new THREE.CylinderGeometry(0.056, 0.05, 0.07, 16), std(0xe2d6c2), V(h.x, h.y + 0.07, h.z))); }
      g.visible = false; arm.add(g); (W[k + 'Parts'] = W[k + 'Parts'] || []).push(g);
    });
  });
  add('boots', body, [-1, 1].flatMap(s => [M(new THREE.BoxGeometry(0.115, 0.17, 0.27), std(0x2a1d14, { roughness: 0.6 }), V(s * 0.095, 0.085, 0.045)), M(new THREE.BoxGeometry(0.118, 0.05, 0.07), std(0x7a7f86, { metalness: 0.8, roughness: 0.3 }), V(s * 0.095, 0.03, 0.15))]));

  const pops = [];
  function parts(k) { return [W[k], ...(k === 'jacket' ? W.jacketArms : []), ...(W[k + 'Parts'] || [])].filter(Boolean); }
  root.userData.set = sel => {
    Object.keys({ helmet: 1, shield: 1, goggles: 1, glasses: 1, ear: 1, resp: 1, jacket: 1, apron: 1, glovesL: 1, glovesT: 1, boots: 1 }).forEach(k => {
      const on = !!sel[k];
      parts(k).forEach(g => { if (on && !g.visible) { g.visible = true; g.children.forEach(c => { c.userData.s0 = c.userData.s0 || c.scale.clone(); c.scale.copy(c.userData.s0).multiplyScalar(0.6); pops.push({ g: c, t: 0 }); }); } else if (!on) g.visible = false; });
    });
  };
  root.userData.frame = dt => {
    body.rotation.y = Math.sin(performance.now() / 2600) * 0.12;   // idle sway
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt / 0.35; const k = Math.min(1, p.t), e = 1 + Math.sin(k * Math.PI) * 0.12; p.g.scale.copy(p.g.userData.s0).multiplyScalar(0.6 + 0.4 * k * e); if (k >= 1) { p.g.scale.copy(p.g.userData.s0); pops.splice(i, 1); } }
  };
  return root;
}
