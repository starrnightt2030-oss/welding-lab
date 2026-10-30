// Alexandria Shipyard training-center sign hung in the workshop (logo + names), drawn into a canvas texture.
import * as THREE from 'three';
import { LOGO } from './brandlogo.js';

export const BRAND = {
  ar1: 'شركة ترسانة الإسكندرية', ar2: 'مركز التدريب — قسم اللحام والقطع بالغاز',
  en: 'ALEXANDRIA SHIPYARD · TRAINING CENTER · WELDING & GAS CUTTING DEPT.'
};
export function buildBrandSign(w = 1.7) {
  const W = 2048, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = img => {
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12306e'); g.addColorStop(1, '#0a1c44'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e4232a'; c.fillRect(0, H - 34, W / 2, 34); c.fillStyle = '#2f7ff0'; c.fillRect(W / 2, H - 34, W / 2, 34);
    c.fillStyle = '#e4232a'; c.fillRect(0, 0, W, 10);
    // logo disc on the right (RTL reading start)
    const cx = W - 260, cy = H / 2 - 12, r = 200;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r + 14, 0, 7); c.fill();
    if (img) c.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    c.fillStyle = '#fff'; c.textAlign = 'right'; c.direction = 'rtl';
    c.font = '700 120px "Readex Pro","IBM Plex Sans Arabic",sans-serif'; c.fillText(BRAND.ar1, W - 520, 180);
    c.fillStyle = '#9ec5ff'; c.font = '600 72px "IBM Plex Sans Arabic",sans-serif'; c.fillText(BRAND.ar2, W - 520, 300);
    c.fillStyle = '#c9d6ea'; c.direction = 'ltr'; c.textAlign = 'left'; c.font = '600 44px "IBM Plex Mono",monospace'; c.fillText(BRAND.en, 60, 420);
    tex.needsUpdate = true;
  };
  draw(null);
  const img = new Image(); img.onload = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => draw(img)); img.src = LOGO;
  const g = new THREE.Group();
  const h = w * H / W;
  const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.4, metalness: 0.6 }));
  board.position.z = -0.016; g.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }));
  g.add(face);
  return g;
}
