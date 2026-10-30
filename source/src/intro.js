// Animated welcome screen: sparks from the cartoon welder's arc, then "enter" → sting + spoken welcome.
export const WELCOME = 'مرحباً بكم في معمل محاكاة عمليات اللحام الافتراضي.';
export function runIntro() {
  const root = document.getElementById('loading'), g = document.getElementById('sparks');
  if (!root || !g) return { ready() {}, };
  const NS = 'http://www.w3.org/2000/svg', pool = [];
  for (let i = 0; i < 70; i++) { const l = document.createElementNS(NS, 'line'); l.setAttribute('class', 'spk'); l.setAttribute('stroke-linecap', 'round'); l.style.display = 'none'; g.appendChild(l); pool.push({ el: l, life: 0 }); }
  let t0 = performance.now(), alive = true, boost = 0;
  const step = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    const n = (Math.random() < 0.7 ? 2 : 1) + (boost > 0 ? 6 : 0); boost = Math.max(0, boost - dt);
    for (let k = 0; k < n; k++) {
      const p = pool.find(q => q.life <= 0); if (!p) break;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 120 + Math.random() * 260;
      Object.assign(p, { x: 76, y: 348, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.8 }); p.max = p.life;
      p.el.style.display = '';
    }
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > 440) { p.y = 440; p.vy *= -0.35; p.vx *= 0.6; }
      if (p.life <= 0) { p.el.style.display = 'none'; continue; }
      const k = p.life / p.max, e = p.el;
      e.setAttribute('x1', p.x); e.setAttribute('y1', p.y); e.setAttribute('x2', p.x - p.vx * 0.018); e.setAttribute('y2', p.y - p.vy * 0.018);
      e.setAttribute('stroke', k > 0.6 ? '#fff4d6' : k > 0.3 ? '#ffb347' : '#ff6a1a'); e.setAttribute('stroke-width', 1.2 + k * 1.8); e.setAttribute('opacity', Math.min(1, k * 1.6));
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return {
    // app is loaded: show the start button; resolves when the user taps it
    ready() {
      const btn = document.getElementById('intro-start'), ld = root.querySelector('.intro-load');
      if (ld) ld.hidden = true; if (btn) btn.hidden = false;
      if (/[?&]nointro/.test(location.search)) { root.classList.add('go'); return Promise.resolve(); }
      return new Promise(res => { const go = () => { boost = 1.2; root.classList.add('go'); res(); }; btn ? btn.addEventListener('click', go, { once: true }) : go(); });
    },
    finish() { root.classList.add('done'); setTimeout(() => { alive = false; root.style.display = 'none'; }, 1000); }
  };
}
