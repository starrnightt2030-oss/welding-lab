// Generic welding / cutting simulation shared by all stations.
// A station passes a "proc" config describing the process (arc, flame or cut) and its ideal ranges.
import * as THREE from 'three';
import { JOINT } from '../models.js';
import { Textures } from '../textures.js';
import { AR } from '../data.js';

const MAX_RIPPLES = 1000;
const MAX_SPARKS = 320;
const HEAT_BIN = 0.002;

export class WeldSim {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const rippleGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.beadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.78 });
    this.bead = new THREE.InstancedMesh(rippleGeo, this.beadMat, MAX_RIPPLES);
    this.bead.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RIPPLES * 3), 3);
    this.bead.castShadow = true; this.bead.receiveShadow = true;
    this.glow = new THREE.InstancedMesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), MAX_RIPPLES);
    this.glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RIPPLES * 3), 3);
    this.slag = new THREE.InstancedMesh(rippleGeo, new THREE.MeshPhysicalMaterial({ color: 0x3a2a1e, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.2 }), MAX_RIPPLES);
    this.slag.castShadow = true;
    const ball = new THREE.SphereGeometry(1, 10, 8);
    this.spatter = new THREE.InstancedMesh(ball, new THREE.MeshStandardMaterial({ color: 0x55565a, roughness: 0.45, metalness: 0.85 }), 500);
    this.pores = new THREE.InstancedMesh(ball, new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 }), 240);
    this.under = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6, metalness: 0.6 }), 500);
    // dark kerf for cutting
    this.kerf = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }), MAX_RIPPLES);
    this.dross = new THREE.InstancedMesh(ball, new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.6, metalness: 0.4 }), 400);
    this.all = [this.bead, this.glow, this.slag, this.spatter, this.pores, this.under, this.kerf, this.dross];
    this.all.forEach(m => { m.count = 0; m.frustumCulled = false; this.group.add(m); });

    this.light = new THREE.PointLight(0xd6ecff, 0, 1.5, 2);
    this.group.add(this.light);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: Textures.glowSprite(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    this.sprite.visible = false; this.group.add(this.sprite);
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 7, 8), toneMapped: false }));
    this.core.visible = false; this.group.add(this.core);
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.4, 0.9), toneMapped: false, transparent: true }));
    this.pool.rotation.x = -Math.PI / 2; this.pool.visible = false; this.group.add(this.pool);

    this.sparkPos = new Float32Array(MAX_SPARKS * 6);
    this.sparkCol = new Float32Array(MAX_SPARKS * 6);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparkLines = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    this.sparkLines.frustumCulled = false; this.group.add(this.sparkLines);
    this.sparks = [];
    this.smoke = [];
    const smokeMat = new THREE.SpriteMaterial({ map: Textures.smoke(), color: 0xb8bcc0, transparent: true, depthWrite: false, opacity: 0 });
    for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(smokeMat.clone()); s.visible = false; this.group.add(s); this.smoke.push({ s, life: 0 }); }

    this.M4 = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.S = new THREE.Vector3(); this.P = new THREE.Vector3();
    this.proc = null;
    this.reset();
  }

  configure(proc, settings) { this.proc = proc; this.settings = settings; this.reset(); }

  reset() {
    const p = this.proc;
    this.ripples = []; this.samples = [];
    this.events = { stuck: 0, outs: 0, strikes: 0, lost: 0, early: 0 };
    this.on = false; this.stuck = false; this.lastX = null;
    this.progress = JOINT.x0; this.gap = 0; this.grace = 0;
    this.speed = 0; this.speedEMA = 0; this.time = 0;
    this.consumable = p && p.consumable ? p.consumable.len : 0;
    this.distS = null;
    this.filler = p && p.fillerLen ? p.fillerLen : 0;
    this.heat = new Float32Array(Math.ceil(0.3 / HEAT_BIN));
    this.all.forEach(m => { m.count = 0; m.instanceMatrix.needsUpdate = true; });
    this.sparks.length = 0;
    this.slagRemoved = false; this.slagAnim = null;
    if (p) {
      this.beadMat.metalness = p.bead?.metal ?? 0.78; this.beadMat.roughness = p.bead?.rough ?? 0.38;
      this.sprite.material.color.set(p.arcColor ?? 0xffffff);
      this.light.color.set(p.lightColor ?? 0xd6ecff);
    }
    this.setVisible(false);
  }

  setVisible(on) {
    const arc = this.proc && this.proc.kind === 'arc';
    this.sprite.visible = on && arc; this.core.visible = on && arc; this.pool.visible = on;
    if (!on) this.light.intensity = 0;
  }

  heatAt(x) { const i = Math.floor((x - JOINT.x0 + 0.05) / HEAT_BIN); return i >= 0 && i < this.heat.length ? this.heat[i] : 0; }
  addHeat(x, amount) {
    const i0 = Math.floor((x - JOINT.x0 + 0.05) / HEAT_BIN);
    for (let k = -3; k <= 3; k++) { const i = i0 + k; if (i >= 0 && i < this.heat.length) this.heat[i] += amount * Math.exp(-k * k / 4); }
  }

  // input: {pressing, x, dist (mm), angle, aux (filler feed / cutting oxygen)}
  step(input, dt) {
    const p = this.proc; this.time += dt;
    const out = { msg: null };
    const x = THREE.MathUtils.clamp(input.x, JOINT.x0 - 0.03, JOINT.x1 + 0.01);
    const d = input.dist;
    const sNow = { speed: this.speed, dist: d, angle: input.angle, aux: !!input.aux, settings: this.settings, heat: this.heatAt(x) };
    // cool down everything
    for (let i = 0; i < this.heat.length; i++) this.heat[i] *= Math.pow(0.55, dt);

    if (!input.pressing) {
      if (this.on) { this.on = false; this.setVisible(false); if (p.kind === 'arc') out.msg = { t: 'info', s: p.pauseMsg || 'وقفت. كمّل من آخر نقطة.' }; }
      this.stuck = false; this.lastX = null;
    } else if (this.stuck) {
      out.stuck = true;
    } else if (!this.on) {
      if (p.kind !== 'arc' || d < p.strikeBelow) {
        this.on = true; this.events.strikes++; this.lastX = x; this.setVisible(true); this.grace = p.grace ?? 0.35;
        if (x > this.progress + 0.006 && this.progress < JOINT.x1 && p.kind !== 'cut') { this.gap += Math.min(x, JOINT.x1) - this.progress; this.progress = x; }
        if (p.kind === 'arc') this.emitSparks(30, x, JOINT.y);
        out.struck = true;
      }
    } else {
      this.grace -= dt;
      if (p.stickBelow != null && d < p.stickBelow && this.grace <= 0) { this.on = false; this.stuck = true; this.events.stuck++; this.setVisible(false); out.msg = { t: 'bad', s: p.stickMsg }; }
      else if (p.breakAbove != null && d > p.breakAbove) { this.on = false; this.events.outs++; this.setVisible(false); out.msg = { t: 'bad', s: p.breakMsg }; }
    }

    if (this.on && this.lastX != null && dt > 0) {
      const inst = Math.max(0, (x - this.lastX) * 1000) / dt;
      this.speedEMA = this.speedEMA * 0.88 + inst * 0.12; this.speed = this.speedEMA; this.lastX = x;
    }
    if (!this.on) this.speedEMA *= 0.9;

    if (this.on) {
      // heat input at the torch
      this.addHeat(x, (p.heatRate ? p.heatRate(sNow) : 1) * dt);
      if (p.consumable) {
        this.consumable = Math.max(p.consumable.min, this.consumable - p.consumable.rate(this.settings) * dt);
        if (this.consumable <= p.consumable.min) { this.on = false; this.setVisible(false); out.msg = { t: 'info', s: p.consumable.outMsg }; out.consumableOut = true; }
      }
      if (p.fillerLen && input.aux) { this.filler = Math.max(0.02, this.filler - 0.0022 * dt); }

      const heatOK = !p.heatNeed || this.heatAt(x) >= p.heatNeed;
      let depositing = heatOK;
      if (p.kind === 'cut') {
        if (input.aux && !heatOK) { if (!this.earlyFlag) { this.events.early++; this.earlyFlag = true; out.msg = { t: 'bad', s: 'لسه الحديد ماوصلش للون الأحمر. سخّن الأول وبعدين افتح أكسجين القطع.' }; } }
        if (!input.aux) this.earlyFlag = false;
        depositing = heatOK && input.aux;
        if (depositing && this.speed > p.ideal.speed[1] * 1.8) { depositing = false; if (!this.lostFlag) { this.events.lost++; this.lostFlag = true; out.msg = { t: 'bad', s: 'القطع وقف! السرعة عالية جداً والحرارة ماكفتش. ارجع لآخر نقطة وسخّن تاني.' }; } }
        else this.lostFlag = false;
      } else if (p.heatNeed && !heatOK) {
        out.preheat = THREE.MathUtils.clamp(this.heatAt(x) / p.heatNeed, 0, 1);
      }

      if (depositing && x > this.progress - 0.0005) {
        while (this.progress <= Math.min(x, JOINT.x1)) { this.addRipple(this.progress, sNow); this.progress += p.spacing || 0.0011; }
      }
      this.samples.push({ x, t: this.time, speed: this.speed, dist: d, angle: input.angle, aux: !!input.aux, dep: depositing, heat: this.heatAt(x) });

      const rate = p.sparks ? p.sparks(sNow) : 60;
      this.emitSparks(Math.round(rate * dt + Math.random() * 0.5), x, JOINT.y, p.sparkDir);
      if (Math.random() < dt * (p.smoke ?? 6)) this.emitSmoke(x, JOINT.y);

      const flick = 0.75 + Math.random() * 0.5;
      const len = d / 1000;
      this.light.position.set(x, JOINT.y + len * 0.6 + 0.004, JOINT.z);
      this.light.intensity = (p.lightIntensity ?? 0.35) * flick;
      if (p.kind === 'arc') {
        this.sprite.position.set(x, JOINT.y + len * 0.5, JOINT.z);
        this.sprite.scale.setScalar(((p.arcSize ?? 0.035) + d * 0.006) * flick);
        this.core.position.set(x, JOINT.y + len * 0.5, JOINT.z);
        this.core.scale.set(1, Math.max(0.6, d / 3), 1);
      }
      const pw = (p.poolMM ? p.poolMM(sNow) : 5) / 1000;
      this.pool.visible = heatOK;
      this.pool.position.set(x - 0.0008, JOINT.y + (p.kind === 'cut' ? 0.0003 : 0.0016), JOINT.z);
      this.pool.scale.set(pw * 0.65, pw * 0.5, 1);
      out.heat = this.heatAt(x) / (p.heatNeed || 1);
    }

    this.updateRipples(dt); this.updateSparks(dt); this.updateSmoke(dt);
    out.on = this.on;
    out.speed = this.speed;
    out.progress = (Math.min(this.progress, JOINT.x1) - JOINT.x0) / (JOINT.x1 - JOINT.x0);
    out.consumable = this.consumable;
    return out;
  }

  addRipple(x, s) {
    if (this.ripples.length >= MAX_RIPPLES) return;
    const p = this.proc;
    const dims = p.dims(s);
    const w = dims.w / 1000, h = dims.h / 1000;
    const wob = (Math.random() - 0.5) * 0.0004 * (dims.wobble ?? 1);
    const r = { x, w, h, z: JOINT.z + wob, born: this.time, s: { speed: s.speed, dist: s.dist, angle: s.angle, aux: s.aux } };
    this.ripples.push(r);
    const i = this.ripples.length - 1;
    if (p.kind === 'cut') {
      this.inst(this.kerf, this.kerf.count++, x, JOINT.y - JOINT.t / 2, r.z, 0.0016, JOINT.t + 0.0004, w);
      this.kerf.instanceMatrix.needsUpdate = true;
      this.inst(this.glow, i, x, JOINT.y, r.z, 0.0012, 0.0008, w * 0.9);
      this.glow.count = i + 1; this.glow.setColorAt(i, new THREE.Color(3.5, 1.2, 0.2));
      this.glow.instanceMatrix.needsUpdate = true; this.glow.instanceColor.needsUpdate = true;
      if (dims.dross && Math.random() < dims.dross) {
        const k = this.dross.count; if (k < 400) { const rr = 0.0007 + Math.random() * 0.0009; this.inst(this.dross, k, x, JOINT.y - JOINT.t - 0.0006, r.z + (Math.random() - 0.5) * w, rr, rr * 0.7, rr); this.dross.count++; this.dross.instanceMatrix.needsUpdate = true; }
      }
      return;
    }
    this.inst(this.bead, i, x, JOINT.y, r.z, w * 0.42, h, w * 0.5);
    this.inst(this.glow, i, x, JOINT.y, r.z, w * 0.44, h * 1.04, w * 0.52);
    this.bead.count = this.glow.count = i + 1;
    const base = p.bead?.color || [0.75, 0.74, 0.72];
    this.bead.setColorAt(i, new THREE.Color(...base));
    const hot = p.bead?.hot || [3, 1.3, 0.35];
    this.glow.setColorAt(i, new THREE.Color(...hot));
    this.bead.instanceMatrix.needsUpdate = this.glow.instanceMatrix.needsUpdate = true;
    this.bead.instanceColor.needsUpdate = this.glow.instanceColor.needsUpdate = true;
    const f = p.flags ? p.flags(s) : {};
    if (f.spatter && Math.random() < f.spatter) this.addSpatter(x, 1 + Math.floor(Math.random() * 2));
    if (f.pore && Math.random() < f.pore) this.addPore(x, r.z, w, h);
    if (f.undercut && Math.random() < f.undercut) this.addUndercut(x, r.z, w);
  }

  inst(mesh, i, x, y, z, sx, sy, sz) {
    this.P.set(x, y, z); this.S.set(sx, sy, sz); this.Q.identity();
    this.M4.compose(this.P, this.Q, this.S); mesh.setMatrixAt(i, this.M4);
  }
  addSpatter(x, n) {
    for (let k = 0; k < n; k++) {
      const i = this.spatter.count; if (i >= 500) return;
      const r = (0.4 + Math.random() * 0.7) / 1000;
      const dz = (Math.random() < 0.5 ? -1 : 1) * (0.006 + Math.random() * 0.025);
      this.inst(this.spatter, i, x + (Math.random() - 0.5) * 0.02, JOINT.y + r * 0.3, JOINT.z + dz, r, r * 0.7, r);
      this.spatter.count++; this.spatter.instanceMatrix.needsUpdate = true;
    }
  }
  addPore(x, z, w, h) {
    const i = this.pores.count; if (i >= 240) return;
    const r = (0.35 + Math.random() * 0.4) / 1000;
    this.inst(this.pores, i, x, JOINT.y + h * 0.92, z + (Math.random() - 0.5) * w * 0.4, r, r * 0.5, r);
    this.pores.count++; this.pores.instanceMatrix.needsUpdate = true;
  }
  addUndercut(x, z, w) {
    [-1, 1].forEach(s => { const i = this.under.count; if (i >= 500) return; this.inst(this.under, i, x, JOINT.y + 0.00002, z + s * (w * 0.5 + 0.0004), 0.0012, 0.00008, 0.0007); this.under.count++; });
    this.under.instanceMatrix.needsUpdate = true;
  }

  updateRipples() {
    const n = this.ripples.length; if (!n) return;
    const p = this.proc, c = new THREE.Color();
    const hot = p.bead?.hot || [3, 1.3, 0.35];
    let g = false, sl = false;
    for (let i = Math.max(0, n - 400); i < n; i++) {
      const r = this.ripples[i], age = this.time - r.born;
      if (age < 7) {
        const k = Math.max(0, 1 - age / (p.coolTime ?? 4.5));
        c.setRGB(hot[0] * k * k, hot[1] * k * k * k, hot[2] * k * k * k * k); this.glow.setColorAt(i, c); g = true;
      }
      if (p.slag && !this.slagRemoved && age > 0.25 && !r.slag) {
        r.slag = true;
        this.inst(this.slag, i, r.x, JOINT.y + r.h * 0.08, r.z, r.w * 0.47, r.h * 1.22, r.w * 0.55);
        this.slag.count = Math.max(this.slag.count, i + 1); sl = true;
      }
      // TIG/oxy style heat tint once cooled
      if (p.bead?.tint && age > 2 && !r.tinted) {
        r.tinted = true;
        this.bead.setColorAt(i, p.bead.tint(r, i, n, c)); this.bead.instanceColor.needsUpdate = true;
      }
    }
    if (g) this.glow.instanceColor.needsUpdate = true;
    if (sl) this.slag.instanceMatrix.needsUpdate = true;
  }

  emitSparks(n, x, y, dir) {
    for (let k = 0; k < n && this.sparks.length < MAX_SPARKS; k++) {
      const a = Math.random() * Math.PI * 2;
      let v;
      if (dir === 'down') v = new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.5 - Math.random() * 1.5, (Math.random() - 0.5) * 0.6 + 0.3);
      else { const up = 0.4 + Math.random() * 1.6, sp = 0.4 + Math.random() * 1.4; v = new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp); }
      this.sparks.push({ p: new THREE.Vector3(x, dir === 'down' ? y - JOINT.t : y + 0.002, JOINT.z), v, life: 0.25 + Math.random() * 0.7, age: 0 });
    }
  }
  updateSparks(dt) {
    const floorY = 0.86 - 0.0005;
    let j = 0;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]; s.age += dt; if (s.age > s.life) continue;
      s.v.y -= 9.8 * dt; s.v.multiplyScalar(1 - 0.6 * dt); s.p.addScaledVector(s.v, dt);
      if (s.p.y < JOINT.y - 0.006 && s.p.y > floorY - 0.02 && Math.abs(s.p.z - JOINT.z) > 0.09) { /* falling past table edge */ }
      if (s.p.y < 0.002) { s.p.y = 0.002; s.v.y *= -0.3; s.v.x *= 0.5; s.v.z *= 0.5; }
      this.sparks[j++] = s;
    }
    this.sparks.length = j;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const o = i * 6;
      if (i < j) {
        const s = this.sparks[i], k = 1 - s.age / s.life, tail = 0.012;
        this.sparkPos[o] = s.p.x; this.sparkPos[o + 1] = s.p.y; this.sparkPos[o + 2] = s.p.z;
        this.sparkPos[o + 3] = s.p.x - s.v.x * tail; this.sparkPos[o + 4] = s.p.y - s.v.y * tail; this.sparkPos[o + 5] = s.p.z - s.v.z * tail;
        this.sparkCol[o] = 4 * k; this.sparkCol[o + 1] = 2.4 * k * k; this.sparkCol[o + 2] = 0.8 * k * k * k;
        this.sparkCol[o + 3] = 1.2 * k; this.sparkCol[o + 4] = 0.4 * k; this.sparkCol[o + 5] = 0.05 * k;
      } else for (let q = 0; q < 6; q++) { this.sparkPos[o + q] = 0; this.sparkCol[o + q] = 0; }
    }
    this.sparkLines.geometry.attributes.position.needsUpdate = true;
    this.sparkLines.geometry.attributes.color.needsUpdate = true;
  }
  emitSmoke(x, y) {
    const s = this.smoke.find(q => q.life <= 0); if (!s) return;
    s.life = 2.5 + Math.random(); s.max = s.life; s.s.visible = true;
    s.s.position.set(x, y + 0.01, JOINT.z); s.s.scale.setScalar(0.02); s.vx = (Math.random() - 0.5) * 0.02;
  }
  updateSmoke(dt) {
    this.smoke.forEach(q => {
      if (q.life <= 0) { q.s.visible = false; return; }
      q.life -= dt; const k = 1 - q.life / q.max;
      q.s.position.y += dt * 0.08; q.s.position.x += q.vx * dt;
      q.s.scale.setScalar(0.02 + k * 0.16); q.s.material.opacity = Math.sin(Math.PI * k) * 0.22;
    });
  }

  startSlagRemoval() { if (!this.proc.slag || this.slagRemoved) return false; this.slagRemoved = true; this.slagAnim = { t: 0 }; return true; }
  updateSlag(dt) {
    if (!this.slagAnim) return false;
    this.slagAnim.t += dt;
    const n = this.ripples.length, dur = 1.6;
    for (let i = 0; i < n; i++) {
      const r = this.ripples[i], local = THREE.MathUtils.clamp((this.slagAnim.t - (i / n) * dur) / 0.35, 0, 1), s = 1 - local;
      this.inst(this.slag, i, r.x, JOINT.y + r.h * 0.08 + local * 0.02, r.z + local * 0.01 * Math.sin(i), r.w * 0.47 * s, r.h * 1.22 * s, r.w * 0.55 * s);
    }
    this.slag.instanceMatrix.needsUpdate = true;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) { const u = i / n, e = Math.min(u, 1 - u); if (e < 0.08) c.setRGB(0.62, 0.55, 0.42); else c.setRGB(0.8, 0.8, 0.79); this.bead.setColorAt(i, c); }
    this.bead.instanceColor.needsUpdate = true;
    if (this.slagAnim.t > dur + 0.4) { this.slagAnim = null; this.slag.count = 0; }
    return true;
  }

  // ------------- scoring -------------
  evaluate() {
    const p = this.proc, S = this.samples.filter(s => p.kind !== 'cut' || s.aux);
    const id = p.ideal;
    const coverage = Math.max(0, (Math.min(this.progress, JOINT.x1) - JOINT.x0 - this.gap) / (JOINT.x1 - JOINT.x0));
    if (!S.length || !this.ripples.length) return { empty: true, total: 0, coverage: 0, crit: [], defects: [], bins: [] };
    const pen = (v, a, b, k) => v < a ? (a - v) * k : v > b ? (v - b) * k : 0;
    const avg = a => a.reduce((q, c) => q + c, 0) / Math.max(1, a.length);
    const std = a => { const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };
    const moving = S.filter(s => s.speed > 0.3);
    const angle = Math.round(avg(S.map(s => Math.max(0, 100 - pen(s.angle, id.angle[0], id.angle[1], 4)))));
    const distK = 100 / Math.max(0.5, (id.dist[1] - id.dist[0]));
    const dist = Math.round(avg(S.map(s => Math.max(0, 100 - pen(s.dist, id.dist[0], id.dist[1], distK * 1.4)))));
    const speedK = 100 / Math.max(0.5, (id.speed[1] - id.speed[0])) * 1.1;
    const speed = Math.round(moving.length ? avg(moving.map(s => Math.max(0, 100 - pen(s.speed, id.speed[0], id.speed[1], speedK)))) : 0);
    const dv = S.map(s => s.dist), sv = moving.map(s => s.speed);
    const steady = Math.round(THREE.MathUtils.clamp(100 - std(dv) * (18 * 3.4 / Math.max(1, (id.dist[0] + id.dist[1]) / 2)) - std(sv) * 10 - this.events.outs * 8 - this.events.stuck * 6 - this.events.lost * 8, 0, 100));
    const set = p.settingScore ? p.settingScore(this.settings) : { v: 100 };
    const crit = [
      { label: p.angleName || 'زاوية الميل', v: angle },
      { label: 'سرعة التقدّم', v: speed },
      { label: p.distName, v: dist },
      { label: 'ثبات الحركة', v: steady },
      { label: p.settingName || 'ضبط الماكينة', v: Math.round(set.v) }
    ];
    let fill = null;
    if (p.fillerLen) {
      const dep = S.filter(s => s.dep);
      const fr = dep.length ? dep.filter(s => s.aux).length / dep.length : 0;
      fill = Math.round(THREE.MathUtils.clamp(100 - Math.abs(fr - 0.45) * 160, 0, 100));
      crit.push({ label: 'إضافة السلك', v: fill });
    }
    const w = p.weights || [0.15, 0.27, 0.27, 0.16, 0.15];
    let total = crit.slice(0, 5).reduce((a, c, i) => a + c.v * w[i], 0);
    if (fill != null) total = total * 0.85 + fill * 0.15;
    total = Math.round(THREE.MathUtils.clamp(total * Math.min(1, coverage / 0.95), 0, 100));

    const nb = Math.ceil((JOINT.x1 - JOINT.x0) / 0.01);
    const bins = Array.from({ length: nb }, (_, i) => ({ i, n: 0, sp: 0, dist: 0, aux: 0 }));
    S.forEach(s => { const b = Math.floor((s.x - JOINT.x0) / 0.01); if (b >= 0 && b < nb) { const q = bins[b]; q.n++; q.sp += s.speed; q.dist += s.dist; q.aux += s.aux ? 1 : 0; } });
    bins.forEach(b => {
      if (!b.n) { b.state = 'none'; return; }
      b.sp /= b.n; b.dist /= b.n; b.aux /= b.n;
      const is = [];
      if (b.sp > id.speed[1] * 1.25) is.push('fast'); if (b.sp < id.speed[0] * 0.7) is.push('slow');
      if (b.dist > id.dist[1] * 1.12) is.push('long'); if (b.dist < id.dist[0] * 0.85) is.push('short');
      if (p.fillerLen && b.aux < 0.15) is.push('nofill');
      b.issues = is; b.state = is.length ? (is.length > 1 ? 'bad' : 'warn') : 'good';
    });
    const count = k => bins.filter(b => b.issues && b.issues.includes(k)).length;
    const ctx = { bins, count, events: this.events, settings: this.settings, coverage, sim: this, AR };
    const defects = p.defects ? p.defects(ctx) : [];
    if (coverage < 0.95) defects.push({ name: p.kind === 'cut' ? 'قطع غير مكتمل' : 'خط غير مكتمل', en: 'Incomplete', cause: (p.kind === 'cut' ? 'القطع' : 'الخط') + ' ما غطاش الطول كله (' + AR(Math.round(coverage * 100)) + '٪).', fix: 'كمّل لحد آخر الخط.' });
    const W = avg(this.ripples.map(r => r.w)) * 1000, H = avg(this.ripples.map(r => r.h)) * 1000;
    const grade = total >= 90 ? 'ممتاز' : total >= 75 ? 'جيد جداً' : total >= 60 ? 'جيد' : total >= 50 ? 'مقبول' : 'محتاج تدريب';
    return { total, grade, crit, defects, bins, coverage, width: W, height: H, penetration: p.penetration ? p.penetration(this.settings) : 1, avgSpeed: avg(sv), avgDist: avg(dv), kind: p.kind, distName: p.distName, setNote: set.note };
  }
}

