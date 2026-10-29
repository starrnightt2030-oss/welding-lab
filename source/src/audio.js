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
  click() {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 900; o.type = 'square'; g.gain.value = 0.05;
    o.connect(g).connect(this.ctx.destination);
    const t = this.ctx.currentTime; g.gain.setTargetAtTime(0, t + 0.02, 0.02); o.start(); o.stop(t + 0.1);
  }
}
