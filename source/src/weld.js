// SMAW weld simulation: arc, weld pool, bead ripples, slag, sparks, smoke, defects, scoring.
import * as THREE from 'three';
import { JOINT } from './models.js';
import { Textures } from './textures.js';
import { AR } from './data.js';

const MAX_RIPPLES = 900;
const MAX_SPARKS = 260;

export const IDEAL = {
  angle: [65, 80],          // electrode angle to plate (deg)
  speed: [2.5, 4.5],        // travel speed mm/s
  arcK: [0.8, 1.35]         // arc length as multiple of electrode diameter
};

export const CURRENT_RANGE = { 2.5: [60, 90], 3.25: [90, 130], 4: [120, 170] };

export class WeldSim {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    const rippleGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

    this.beadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.78 });
    this.bead = new THREE.InstancedMesh(rippleGeo, this.beadMat, MAX_RIPPLES);
    this.bead.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RIPPLES * 3), 3);
    this.bead.castShadow = true; this.bead.receiveShadow = true;

    this.glow = new THREE.InstancedMesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), MAX_RIPPLES);
    this.glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RIPPLES * 3), 3);

    this.slagMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2a1e, roughness: 0.22, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    this.slag = new THREE.InstancedMesh(rippleGeo, this.slagMat, MAX_RIPPLES);
    this.slag.castShadow = true;

    const ballGeo = new THREE.SphereGeometry(1, 10, 8);
    this.spatter = new THREE.InstancedMesh(ballGeo, new THREE.MeshStandardMaterial({ color: 0x55565a, roughness: 0.45, metalness: 0.85 }), 400);
    this.pores = new THREE.InstancedMesh(ballGeo, new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 }), 200);
    this.under = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6, metalness: 0.6 }), 400);
    [this.bead, this.glow, this.slag, this.spatter, this.pores, this.under].forEach(m => { m.count = 0; m.frustumCulled = false; this.group.add(m); });

    // Arc light & visuals
    this.arcLight = new THREE.PointLight(0xd6ecff, 0, 1.5, 2);
    this.group.add(this.arcLight);
    this.arcSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: Textures.glowSprite(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    this.arcSprite.scale.setScalar(0.05); this.arcSprite.visible = false; this.group.add(this.arcSprite);
    this.arcCore = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 7, 8), toneMapped: false }));
    this.arcCore.visible = false; this.group.add(this.arcCore);
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.4, 0.9), toneMapped: false, transparent: true }));
    this.pool.rotation.x = -Math.PI / 2; this.pool.visible = false; this.group.add(this.pool);

    // sparks as line segments
    this.sparkPos = new Float32Array(MAX_SPARKS * 6);
    this.sparkCol = new Float32Array(MAX_SPARKS * 6);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparkLines = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    this.sparkLines.frustumCulled = false; this.group.add(this.sparkLines);
    this.sparks = [];

    // smoke
    this.smoke = [];
    const smokeMat = new THREE.SpriteMaterial({ map: Textures.smoke(), color: 0xb8bcc0, transparent: true, depthWrite: false, opacity: 0 });
    for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(smokeMat.clone()); s.visible = false; this.group.add(s); this.smoke.push({ s, life: 0 }); }

    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpS = new THREE.Vector3(); this.tmpP = new THREE.Vector3();
    this.reset({ dia: 3.25, current: 120 });
  }

  reset(settings) {
    this.settings = settings;
    this.ripples = [];            // {x, w, h, born, z, slagT}
    this.samples = [];            // per-frame telemetry while arc on
    this.events = { stuck: 0, outs: 0, strikes: 0 };
    this.arcOn = false; this.stuck = false;
    this.lastX = null; this.progress = JOINT.x0; this.speed = 0; this.speedEMA = 0;
    this.electrodeLen = 0.35; this.time = 0; this.gap = 0; this.grace = 0;
    [this.bead, this.glow, this.slag, this.spatter, this.pores, this.under].forEach(m => { m.count = 0; m.instanceMatrix.needsUpdate = true; });
    this.sparks.length = 0;
    this.slagRemoved = false; this.slagAnim = null;
    this.setArcVisible(false);
  }

  setArcVisible(on) {
    this.arcSprite.visible = on; this.arcCore.visible = on; this.pool.visible = on;
    if (!on) this.arcLight.intensity = 0;
  }

  get dia() { return this.settings.dia; }
  currentRange() { return CURRENT_RANGE[this.settings.dia]; }

  // Called every frame during the weld stage.
  // input: {pressing, x (world), arcLen (mm), angle (deg), dt}
  step(input, dt) {
    this.time += dt;
    const out = { msg: null };
    const tipY = JOINT.y;
    const x = THREE.MathUtils.clamp(input.x, JOINT.x0 - 0.01, JOINT.x1 + 0.01);
    const arcMM = input.arcLen;

    if (!input.pressing) {
      if (this.arcOn) { this.arcOn = false; this.setArcVisible(false); out.msg = { t: 'info', s: 'وقفت القوس. المس مكان آخر نقطة عشان تكمّل.' }; }
      this.stuck = false; this.lastX = null;
    } else if (this.stuck) {
      out.stuck = true;
    } else if (!this.arcOn) {
      if (arcMM < 4) {          // strike
        this.arcOn = true; this.events.strikes++; this.lastX = x; this.setArcVisible(true); this.grace = 0.35;
        if (x > this.progress + 0.006 && this.progress < JOINT.x1) { this.gap += Math.min(x, JOINT.x1) - this.progress; this.progress = x; }
        this.emitSparks(40, x, tipY);
        out.struck = true;
      }
    } else {
      this.grace -= dt;
      if (arcMM < 0.6 && this.grace <= 0) { this.arcOn = false; this.stuck = true; this.events.stuck++; this.setArcVisible(false); out.msg = { t: 'bad', s: 'القطب لزق في الشغلانة! القوس قصير جداً. ارفع صباعك وابدأ تاني.' }; }
      else if (arcMM > 9) { this.arcOn = false; this.events.outs++; this.setArcVisible(false); out.msg = { t: 'bad', s: 'القوس اتقطع لأنه طويل جداً. قرّب القطب من الشغلانة.' }; }
    }

    // travel speed (mm/s) along joint
    if (this.arcOn && this.lastX != null && dt > 0) {
      const dxmm = (x - this.lastX) * 1000;
      const inst = Math.max(0, dxmm) / dt;
      this.speedEMA = this.speedEMA * 0.88 + inst * 0.12;
      this.speed = this.speedEMA;
      this.lastX = x;
    }
    if (!this.arcOn) this.speedEMA *= 0.9;

    const cur = this.settings.current;
    if (this.arcOn) {
      // electrode burn-off
      const burn = (cur / 120) * 4.2 * (this.dia === 2.5 ? 1.25 : this.dia === 4 ? 0.8 : 1) / 1000; // m/s
      this.electrodeLen = Math.max(0.05, this.electrodeLen - burn * dt);
      if (this.electrodeLen <= 0.05) { this.arcOn = false; this.setArcVisible(false); out.msg = { t: 'info', s: 'القطب خلص. غيّر القطب وكمّل.' }; out.electrodeOut = true; }

      // deposit ripples
      if (x > this.progress - 0.0005) {
        while (this.progress <= Math.min(x, JOINT.x1)) {
          this.addRipple(this.progress, arcMM, input.angle);
          this.progress += 0.0011;
        }
      }
      this.samples.push({ x, t: this.time, speed: this.speed, arc: arcMM, angle: input.angle, cur });

      // spark emission
      const [lo, hi] = this.currentRange();
      let rate = 90 + (cur - lo) * 1.2 + Math.max(0, arcMM - this.dia * 1.2) * 60;
      this.emitSparks(Math.round(rate * dt + Math.random()), x, tipY);
      if (Math.random() < dt * 6) this.emitSmoke(x, tipY);

      // arc visuals
      const flick = 0.75 + Math.random() * 0.5;
      const len = arcMM / 1000;
      this.arcLight.position.set(x, tipY + len * 0.6 + 0.003, JOINT.z);
      this.arcLight.intensity = 0.35 * flick * (cur / 120);
      this.arcSprite.position.set(x, tipY + len * 0.5, JOINT.z);
      this.arcSprite.scale.setScalar((0.035 + arcMM * 0.006) * flick);
      this.arcCore.position.set(x, tipY + len * 0.5, JOINT.z);
      this.arcCore.scale.set(1, Math.max(0.6, arcMM / 3), 1);
      const pw = (this.dia * 1.6 + (cur - 100) * 0.015) / 1000;
      this.pool.position.set(x - 0.0008, tipY + 0.0016, JOINT.z);
      this.pool.scale.set(pw * 1.3, pw, 1);
    }

    this.updateRipples(dt);
    this.updateSparks(dt);
    this.updateSmoke(dt);
    out.arcOn = this.arcOn;
    out.speed = this.speed;
    out.progress = (Math.min(this.progress, JOINT.x1) - JOINT.x0) / (JOINT.x1 - JOINT.x0);
    out.electrodeLen = this.electrodeLen;
    return out;
  }

  beadDims(arcMM, speed) {
    const d = this.dia, cur = this.settings.current, [lo, hi] = this.currentRange();
    const heat = THREE.MathUtils.clamp((cur - lo) / (hi - lo), -0.6, 1.6);
    const sp = THREE.MathUtils.clamp(speed || 3.2, 0.8, 12);
    let w = d * 2.6 * (0.85 + heat * 0.25) * Math.pow(3.4 / sp, 0.45) * (1 + Math.max(0, arcMM - d * 1.3) * 0.06);
    let h = 1.9 * Math.pow(3.4 / sp, 0.55) * (1.15 - heat * 0.18) * (1 - Math.max(0, arcMM - d * 1.3) * 0.04);
    w = THREE.MathUtils.clamp(w, 3.5, 16); h = THREE.MathUtils.clamp(h, 0.5, 4.2);
    return { w: w / 1000, h: h / 1000 };
  }

  addRipple(x, arcMM, angle) {
    if (this.ripples.length >= MAX_RIPPLES) return;
    const { w, h } = this.beadDims(arcMM, this.speed);
    const wob = (Math.random() - 0.5) * 0.0004 * (1 + Math.max(0, arcMM - 4) * 0.4);
    const r = { x, w, h, z: JOINT.z + wob, born: this.time, arc: arcMM, speed: this.speed, angle };
    this.ripples.push(r);
    const i = this.ripples.length - 1;
    this.setInst(this.bead, i, x, JOINT.y, r.z, w * 0.42, h, w * 0.5);
    this.setInst(this.glow, i, x, JOINT.y, r.z, w * 0.44, h * 1.04, w * 0.52);
    this.bead.count = this.glow.count = i + 1;
    // fresh bead color: slightly warm until cooled (handled in updateRipples)
    this.bead.setColorAt(i, new THREE.Color(0.75, 0.74, 0.72));
    this.glow.setColorAt(i, new THREE.Color(3, 1.3, 0.35));
    this.bead.instanceMatrix.needsUpdate = this.glow.instanceMatrix.needsUpdate = true;
    this.bead.instanceColor.needsUpdate = this.glow.instanceColor.needsUpdate = true;

    const [lo, hi] = this.currentRange();
    const cur = this.settings.current;
    // defects geometry
    if ((arcMM > this.dia * 1.45 || cur > hi) && Math.random() < 0.55) this.addSpatter(x, 1 + Math.floor(Math.random() * 2));
    if (arcMM > this.dia * 1.7 && Math.random() < 0.18) this.addPore(x, r.z, w, h);
    if ((this.speed > 5.5 || cur > hi + 5) && Math.random() < 0.7) this.addUndercut(x, r.z, w);
  }

  setInst(mesh, i, x, y, z, sx, sy, sz) {
    this.tmpP.set(x, y, z); this.tmpS.set(sx, sy, sz); this.tmpQ.identity();
    this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
    mesh.setMatrixAt(i, this.tmpM);
  }

  addSpatter(x, n) {
    for (let k = 0; k < n; k++) {
      const i = this.spatter.count; if (i >= 400) return;
      const r = (0.4 + Math.random() * 0.7) / 1000;
      const dz = (Math.random() < 0.5 ? -1 : 1) * (0.006 + Math.random() * 0.025);
      this.setInst(this.spatter, i, x + (Math.random() - 0.5) * 0.02, JOINT.y + r * 0.3, JOINT.z + dz, r, r * 0.7, r);
      this.spatter.count++; this.spatter.instanceMatrix.needsUpdate = true;
    }
  }
  addPore(x, z, w, h) {
    const i = this.pores.count; if (i >= 200) return;
    const r = (0.35 + Math.random() * 0.4) / 1000;
    this.setInst(this.pores, i, x, JOINT.y + h * 0.92, z + (Math.random() - 0.5) * w * 0.4, r, r * 0.5, r);
    this.pores.count++; this.pores.instanceMatrix.needsUpdate = true;
  }
  addUndercut(x, z, w) {
    [-1, 1].forEach(s => {
      const i = this.under.count; if (i >= 400) return;
      this.setInst(this.under, i, x, JOINT.y + 0.00002, z + s * (w * 0.5 + 0.0004), 0.0012, 0.00008, 0.0007);
      this.under.count++;
    });
    this.under.instanceMatrix.needsUpdate = true;
  }

  updateRipples() {
    const n = this.ripples.length; if (!n) return;
    const c = new THREE.Color();
    let glowDirty = false, slagDirty = false;
    for (let i = Math.max(0, n - 400); i < n; i++) {
      const r = this.ripples[i];
      const age = this.time - r.born;
      if (age < 6) {
        const k = Math.max(0, 1 - age / 4.5);
        c.setRGB(3.2 * k * k, 1.3 * k * k * k, 0.35 * k * k * k * k);
        this.glow.setColorAt(i, c); glowDirty = true;
      }
      // slag forms on top behind the pool
      if (!this.slagRemoved && age > 0.25 && !r.slag) {
        r.slag = true;
        this.setInst(this.slag, i, r.x, JOINT.y + r.h * 0.08, r.z, r.w * 0.47, r.h * 1.22, r.w * 0.55);
        this.slag.count = Math.max(this.slag.count, i + 1); slagDirty = true;
      }
    }
    if (glowDirty) this.glow.instanceColor.needsUpdate = true;
    if (slagDirty) this.slag.instanceMatrix.needsUpdate = true;
  }

  emitSparks(n, x, y) {
    for (let k = 0; k < n && this.sparks.length < MAX_SPARKS; k++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 1.6;
      const sp = 0.4 + Math.random() * 1.4;
      this.sparks.push({ p: new THREE.Vector3(x, y + 0.002, JOINT.z), v: new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp), life: 0.25 + Math.random() * 0.7, age: 0 });
    }
  }
  updateSparks(dt) {
    const g = 9.8, floorY = JOINT.y - 0.006;
    let j = 0;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]; s.age += dt;
      if (s.age > s.life) continue;
      s.v.y -= g * dt; s.v.multiplyScalar(1 - 0.6 * dt);
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < floorY) { s.p.y = floorY; s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; }
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
      } else {
        for (let q = 0; q < 6; q++) { this.sparkPos[o + q] = 0; this.sparkCol[o + q] = 0; }
      }
    }
    this.sparkLines.geometry.attributes.position.needsUpdate = true;
    this.sparkLines.geometry.attributes.color.needsUpdate = true;
  }

  emitSmoke(x, y) {
    const s = this.smoke.find(q => q.life <= 0); if (!s) return;
    s.life = 2.5 + Math.random(); s.max = s.life; s.s.visible = true;
    s.s.position.set(x, y + 0.01, JOINT.z); s.s.scale.setScalar(0.02);
    s.vx = (Math.random() - 0.5) * 0.02;
  }
  updateSmoke(dt) {
    this.smoke.forEach(q => {
      if (q.life <= 0) { q.s.visible = false; return; }
      q.life -= dt; const k = 1 - q.life / q.max;
      q.s.position.y += dt * 0.08; q.s.position.x += q.vx * dt;
      q.s.scale.setScalar(0.02 + k * 0.16);
      q.s.material.opacity = Math.sin(Math.PI * k) * 0.22;
    });
  }

  // ---- inspection ----
  startSlagRemoval() {
    if (this.slagRemoved) return;
    this.slagRemoved = true;
    this.slagAnim = { t: 0, order: this.ripples.map((_, i) => i) };
  }
  updateSlag(dt) {
    if (!this.slagAnim) return false;
    this.slagAnim.t += dt;
    const n = this.ripples.length, dur = 1.6;
    for (let i = 0; i < n; i++) {
      const r = this.ripples[i];
      const local = THREE.MathUtils.clamp((this.slagAnim.t - (i / n) * dur) / 0.35, 0, 1);
      const s = 1 - local;
      this.setInst(this.slag, i, r.x, JOINT.y + r.h * 0.08 + local * 0.02, r.z + local * 0.01 * Math.sin(i), r.w * 0.47 * s, r.h * 1.22 * s, r.w * 0.55 * s);
    }
    this.slag.instanceMatrix.needsUpdate = true;
    // reveal heat tint on cleaned bead
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const edge = Math.min(u, 1 - u);
      if (edge < 0.08) c.setRGB(0.62, 0.55, 0.42); else c.setRGB(0.8, 0.8, 0.79);
      this.bead.setColorAt(i, c);
    }
    this.bead.instanceColor.needsUpdate = true;
    if (this.slagAnim.t > dur + 0.4) { this.slagAnim = null; this.slag.count = 0; }
    return true;
  }

  // ---- scoring ----
  evaluate() {
    const S = this.samples, d = this.dia;
    const [lo, hi] = this.currentRange();
    const cur = this.settings.current;
    const coverage = Math.max(0, (Math.min(this.progress, JOINT.x1) - JOINT.x0 - this.gap) / (JOINT.x1 - JOINT.x0));
    const inR = (v, a, b) => v >= a && v <= b;
    const pen = (v, a, b, k) => v < a ? (a - v) * k : v > b ? (v - b) * k : 0;
    if (!S.length) return { empty: true, total: 0, coverage: 0, crit: [], defects: [], bins: [] };
    let aS = 0, sS = 0, rS = 0, speedVals = [], arcVals = [];
    const moving = S.filter(s => s.speed > 0.3);
    S.forEach(s => {
      aS += Math.max(0, 100 - pen(s.angle, IDEAL.angle[0], IDEAL.angle[1], 4));
      rS += Math.max(0, 100 - pen(s.arc / d, IDEAL.arcK[0], IDEAL.arcK[1], 120));
      arcVals.push(s.arc);
    });
    moving.forEach(s => { sS += Math.max(0, 100 - pen(s.speed, IDEAL.speed[0], IDEAL.speed[1], 22)); speedVals.push(s.speed); });
    const avg = a => a.reduce((p, c) => p + c, 0) / Math.max(1, a.length);
    const std = a => { const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };
    const angle = Math.round(aS / S.length);
    const arc = Math.round(rS / S.length);
    const speed = Math.round(moving.length ? sS / moving.length : 0);
    const steady = Math.round(THREE.MathUtils.clamp(100 - std(arcVals) * 18 - std(speedVals) * 10 - this.events.outs * 8 - this.events.stuck * 6, 0, 100));
    const current = inR(cur, lo, hi) ? 100 : Math.max(30, 100 - pen(cur, lo, hi, 2.2));
    const crit = [
      { label: 'زاوية القطب', v: angle },
      { label: 'سرعة التقدّم', v: speed },
      { label: 'طول القوس', v: arc },
      { label: 'ثبات الحركة', v: steady },
      { label: 'ضبط التيار', v: Math.round(current) }
    ];
    let total = (angle * 0.15 + speed * 0.27 + arc * 0.27 + steady * 0.16 + current * 0.15) * Math.min(1, coverage / 0.95);
    total = Math.round(THREE.MathUtils.clamp(total, 0, 100));

    // per-bin analysis (10 mm bins)
    const nb = Math.ceil((JOINT.x1 - JOINT.x0) / 0.01);
    const bins = Array.from({ length: nb }, (_, i) => ({ i, n: 0, sp: 0, arc: 0, ang: 0 }));
    S.forEach(s => { const b = Math.floor((s.x - JOINT.x0) / 0.01); if (b >= 0 && b < nb) { const q = bins[b]; q.n++; q.sp += s.speed; q.arc += s.arc; q.ang += s.angle; } });
    bins.forEach(b => {
      if (!b.n) { b.state = 'none'; return; }
      b.sp /= b.n; b.arc /= b.n; b.ang /= b.n;
      const issues = [];
      if (b.sp > 5.5) issues.push('fast'); if (b.sp < 1.8) issues.push('slow');
      if (b.arc > d * 1.45) issues.push('long'); if (b.arc < d * 0.7) issues.push('short');
      b.issues = issues; b.state = issues.length ? (issues.length > 1 ? 'bad' : 'warn') : 'good';
    });

    const defects = [];
    const count = k => bins.filter(b => b.issues && b.issues.includes(k)).length;
    if (count('fast') || cur > hi + 5) defects.push({ k: 'undercut', name: 'تآكل الحواف', en: 'Undercut', cause: cur > hi + 5 ? 'التيار أعلى من المدى المناسب.' : 'سرعة تقدّم عالية في ' + AR(count('fast')) + ' منطقة.', fix: 'بطّأ الحركة، وقلّل التيار لو كان عالي، وخلّي القطب يملا الحواف.' });
    if (count('slow')) defects.push({ k: 'overlap', name: 'خط عالي وعريض (تراكب)', en: 'Overlap / excess', cause: 'الحركة بطيئة زيادة فالمعدن اتكوّم.', fix: 'زوّد سرعة التقدّم بانتظام.' });
    if (count('long') || this.spatter.count > 20) defects.push({ k: 'spatter', name: 'رذاذ', en: 'Spatter', cause: 'القوس طويل' + (cur > hi ? ' والتيار عالي.' : '.'), fix: 'خلّي طول القوس قريب من قطر القطب (حوالي ' + d + ' مم).' });
    if (this.pores.count > 2) defects.push({ k: 'porosity', name: 'مسامية', en: 'Porosity', cause: 'القوس طويل جداً فالغاز الواقي ماقدرش يحمي المنصهر.', fix: 'قصّر القوس وحافظ عليه ثابت.' });
    if (cur < lo || count('short')) defects.push({ k: 'lof', name: 'نقص الاندماج / الاختراق', en: 'Lack of fusion', cause: cur < lo ? 'التيار أقل من المدى المناسب.' : 'القوس قصير جداً.', fix: 'اظبط التيار في المدى المناسب وحافظ على طول القوس.' });
    if (coverage < 0.95) defects.push({ k: 'incomplete', name: 'خط غير مكتمل', en: 'Incomplete weld', cause: 'الخط ما غطاش الوصلة كلها (' + Math.round(coverage * 100) + '٪).', fix: 'كمّل لحد آخر الوصلة.' });
    if (this.events.stuck) defects.push({ k: 'stuck', name: 'التصاق القطب', en: 'Electrode sticking', cause: 'القطب لزق ' + AR(this.events.stuck) + ' مرة.', fix: 'بعد القدح ارفع القطب بسرعة لطول القوس الصحيح.' });

    const W = avg(this.ripples.map(r => r.w)) * 1000, H = avg(this.ripples.map(r => r.h)) * 1000;
    const penetr = THREE.MathUtils.clamp(((cur - lo) / (hi - lo)) * 0.6 + 0.6, 0.2, 1.3);
    let grade = total >= 90 ? 'ممتاز' : total >= 75 ? 'جيد جداً' : total >= 60 ? 'جيد' : total >= 50 ? 'مقبول' : 'محتاج تدريب';
    return { total, grade, crit, defects, bins, coverage, width: W, height: H, penetration: penetr, avgSpeed: avg(speedVals), avgArc: avg(arcVals) };
  }
}
