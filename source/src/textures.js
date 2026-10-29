// Procedural textures: generated on canvas so the app needs no image files and works offline.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Smooth value noise (tileable) on a grid
function valueNoise(size, cells, seed) {
  const r = rng(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % cells) * cells + (x0 % cells)];
      const b = g[(y0 % cells) * cells + ((x0 + 1) % cells)];
      const c = g[((y0 + 1) % cells) * cells + (x0 % cells)];
      const d = g[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
      out[y * size + x] = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    }
  }
  return out;
}

function fbm(size, seed, octaves = 4, base = 4) {
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, base << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function canvasFrom(size, fill) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = fill(i, i % size, Math.floor(i / size));
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(canvas, repeat = 1, srgb = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

export const Textures = {
  concrete: () => once('concrete', () => {
    const S = 512, n = fbm(S, 11, 5, 4), m = fbm(S, 37, 3, 16);
    const col = canvasFrom(S, (i) => {
      const v = 0.36 + n[i] * 0.22 + (m[i] - 0.5) * 0.08;
      const speck = Math.random() < 0.004 ? -0.12 : 0;
      const c = Math.max(0, Math.min(1, v + speck)) * 255;
      return [c * 0.98, c * 0.99, c];
    });
    const rough = canvasFrom(S, (i) => { const c = (0.75 + n[i] * 0.2) * 255; return [c, c, c]; });
    const bump = canvasFrom(S, (i) => { const c = (m[i] * 0.6 + n[i] * 0.4) * 255; return [c, c, c]; });
    return { map: tex(col, 6, true), roughnessMap: tex(rough, 6), bumpMap: tex(bump, 6) };
  }),

  brushed: () => once('brushed', () => {
    const S = 512, r = rng(5);
    const rows = new Float32Array(S);
    for (let y = 0; y < S; y++) rows[y] = r();
    const n = fbm(S, 3, 3, 8);
    const rough = canvasFrom(S, (i, x, y) => {
      const v = 0.32 + rows[y] * 0.18 + n[i] * 0.12; const c = v * 255; return [c, c, c];
    });
    const bump = canvasFrom(S, (i, x, y) => { const c = (rows[y] * 0.8 + n[i] * 0.2) * 255; return [c, c, c]; });
    return { roughnessMap: tex(rough, 2), bumpMap: tex(bump, 2) };
  }),

  paint: () => once('paint', () => {
    const S = 256, n = fbm(S, 21, 3, 32);
    const bump = canvasFrom(S, (i) => { const c = n[i] * 255; return [c, c, c]; });
    return { bumpMap: tex(bump, 3) };
  }),

  rubber: () => once('rubber', () => {
    const S = 256, n = fbm(S, 77, 3, 32);
    const bump = canvasFrom(S, (i) => { const c = n[i] * 255; return [c, c, c]; });
    const t = tex(bump, 1); t.repeat.set(40, 1);
    return { bumpMap: t };
  }),

  millScale: () => once('millScale', () => {
    const S = 512, n = fbm(S, 9, 5, 3), m = fbm(S, 41, 3, 24);
    const col = canvasFrom(S, (i) => {
      const v = 0.3 + n[i] * 0.12 + (m[i] - 0.5) * 0.05;
      return [v * 205, v * 214, v * 226];
    });
    const rough = canvasFrom(S, (i) => { const c = (0.45 + n[i] * 0.35) * 255; return [c, c, c]; });
    const bump = canvasFrom(S, (i) => { const c = m[i] * 255; return [c, c, c]; });
    return { map: tex(col, 1, true), roughnessMap: tex(rough, 1), bumpMap: tex(bump, 1) };
  }),

  tableTop: () => once('tableTop', () => {
    const S = 512, n = fbm(S, 61, 5, 4), m = fbm(S, 62, 3, 32);
    const col = canvasFrom(S, (i) => {
      const v = 0.22 + n[i] * 0.16;
      const burn = m[i] > 0.78 ? -0.06 : 0;
      const c = Math.max(0, v + burn);
      return [c * 255, c * 250, c * 245];
    });
    const rough = canvasFrom(S, (i) => { const c = (0.55 + n[i] * 0.3) * 255; return [c, c, c]; });
    return { map: tex(col, 1, true), roughnessMap: tex(rough, 1), bumpMap: tex(rough, 1) };
  }),

  knurl: () => once('knurl', () => {
    const S = 256;
    const bump = canvasFrom(S, (i, x) => { const v = (Math.sin((x / S) * Math.PI * 2 * 48) * 0.5 + 0.5) * 255; return [v, v, v]; });
    return { bumpMap: tex(bump, 1) };
  }),

  wall: () => once('wall', () => {
    const S = 512, n = fbm(S, 99, 4, 4);
    const col = canvasFrom(S, (i, x, y) => {
      const seam = (x % 256 < 3) ? -0.05 : 0;
      const v = 0.24 + n[i] * 0.07 + seam; const c = v * 255; return [c * 0.95, c, c * 1.04];
    });
    return { map: tex(col, 3, true) };
  }),

  label(draw, w = 512, h = 256) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  },

  glowSprite: () => once('glowSprite', () => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.15, 'rgba(220,245,255,0.9)');
    grd.addColorStop(0.4, 'rgba(120,200,255,0.35)');
    grd.addColorStop(1, 'rgba(40,120,200,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }),

  smoke: () => once('smoke', () => {
    const S = 128, n = fbm(S, 5, 4, 4);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      const a = Math.max(0, 1 - d) ** 1.5 * (0.5 + n[y * S + x] * 0.8);
      const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 200; img.data[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })
};
