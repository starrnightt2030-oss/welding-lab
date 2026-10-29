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
  update(on, arcK = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = on && this.enabled ? 0.55 + Math.random() * 0.35 : 0;
    this.gain.gain.setTargetAtTime(target, t, 0.03);
    this.humGain.gain.setTargetAtTime(on && this.enabled ? 0.025 : 0, t, 0.05);
    // longer arc → harsher, higher hiss
    this.bp.frequency.setTargetAtTime(1800 + Math.min(4, arcK) * 900, t, 0.1);
  }
  click() {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 900; o.type = 'square'; g.gain.value = 0.05;
    o.connect(g).connect(this.ctx.destination);
    const t = this.ctx.currentTime; g.gain.setTargetAtTime(0, t + 0.02, 0.02); o.start(); o.stop(t + 0.1);
  }
}
