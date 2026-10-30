// Synthesized arc sound (crackle / "frying bacon") — no audio files needed.
export class ArcAudio {
  constructor() { this.ctx = null; this.enabled = true; this.level = 0; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // crackle: sparse impulses over hiss
      const imp = Math.random() < 0.004 ? (Math.random() * 2 - 1) * 3 : 0;
      d[i] = (Math.random() * 2 - 1) * 0.35 + imp;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.frequency.value = 2600; this.bp.Q.value = 0.6;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    this.gain = ctx.createGain(); this.gain.gain.value = 0;
    // low hum of the machine/arc
    this.hum = ctx.createOscillator(); this.hum.type = 'sawtooth'; this.hum.frequency.value = 100;
    const humF = ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 300;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    src.connect(this.bp).connect(hp).connect(this.gain).connect(ctx.destination);
    this.hum.connect(humF).connect(this.humGain).connect(ctx.destination);
    src.start(); this.hum.start();
  }
  // on: arc burning; arcK: arc length / diameter
  update(on, arcK = 1, mode = 'arc') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, en = on && this.enabled;
    let g = 0.55 + Math.random() * 0.35, f = 1800 + Math.min(4, arcK) * 900, hum = 0.025, hf = 100, q = 0.6;
    if (mode === 'flame') { g = 0.32 + Math.random() * 0.05; f = 650; hum = 0; q = 0.35; }
    else if (mode === 'cut') { g = 0.6; f = 1500; hum = 0; q = 0.3; }
    else if (mode === 'tig') { g = 0.18 + Math.random() * 0.04; f = 4200; hum = 0.012; hf = 50; }
    else if (mode === 'mig') { g = 0.45 + Math.random() * 0.4; f = 2200; hum = 0.06; hf = 110 + Math.random() * 30; }
    this.gain.gain.setTargetAtTime(en ? g : 0, t, 0.03);
    this.humGain.gain.setTargetAtTime(en ? hum : 0, t, 0.05);
    this.hum.frequency.setTargetAtTime(hf, t, 0.02);
    this.bp.frequency.setTargetAtTime(f, t, 0.1); this.bp.Q.setTargetAtTime(q, t, 0.1);
  }
  // short synthesized effects: ok, err, lift, place, chip, hiss, pop, clunk
  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime, out = c.destination;
    const tone = (f, d, type = 'sine', v = 0.08, f2) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02); };
    const noise = (d, f, q, v) => { const n = c.createBufferSource(), b = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; n.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); n.connect(bp).connect(g).connect(out); n.start(t); };
    if (name === 'ok') { tone(660, 0.12, 'sine', 0.07); setTimeout(() => this.ctx && tone(990, 0.16, 'sine', 0.06), 90); }
    else if (name === 'err') tone(220, 0.25, 'square', 0.04, 160);
    else if (name === 'lift') tone(300, 0.18, 'sine', 0.05, 520);
    else if (name === 'place') { tone(420, 0.15, 'sine', 0.05, 220); noise(0.08, 900, 2, 0.12); }
    else if (name === 'chip') noise(0.06, 3500, 3, 0.4);
    else if (name === 'hiss') noise(0.7, 5000, 0.6, 0.25);
    else if (name === 'pop') { noise(0.18, 300, 0.8, 0.9); tone(90, 0.2, 'sine', 0.2, 40); }
    else if (name === 'intro') {   // cinematic sting: arc strike crackle + whoosh + low boom + bright chord
      const n = c.createBufferSource(), len = Math.ceil(c.sampleRate * 1.6), b = c.createBuffer(1, len, c.sampleRate), x = b.getChannelData(0);
      for (let i = 0; i < len; i++) { const k = i / len; x[i] = ((Math.random() * 2 - 1) * 0.5 + (Math.random() < 0.01 ? (Math.random() * 2 - 1) * 2.5 : 0)) * Math.pow(1 - k, 1.6); }
      n.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.setValueAtTime(5200, t); bp.frequency.exponentialRampToValueAtTime(700, t + 1.4);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      n.connect(bp).connect(g).connect(out); n.start(t);
      tone(70, 1.6, 'sine', 0.45, 34); tone(140, 0.9, 'triangle', 0.08, 70);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.setValueAtTime(0.0001, t + 0.25 + i * 0.06); og.gain.exponentialRampToValueAtTime(0.05, t + 0.35 + i * 0.06); og.gain.exponentialRampToValueAtTime(0.0001, t + 2.6); o.connect(og).connect(out); o.start(t + 0.25 + i * 0.06); o.stop(t + 2.7); });
    }
    else if (name === 'clunk') { noise(0.06, 600, 1.5, 0.5); tone(140, 0.12, 'triangle', 0.12, 80); }
  }
  click() {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 900; o.type = 'square'; g.gain.value = 0.05;
    o.connect(g).connect(this.ctx.destination);
    const t = this.ctx.currentTime; g.gain.setTargetAtTime(0, t + 0.02, 0.02); o.start(); o.stop(t + 0.1);
  }
}
