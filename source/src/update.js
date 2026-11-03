// Mandatory update: every time the online lab opens (or comes back to the foreground) it asks the server which build
// is current. If this copy is older, a blocking banner asks the trainee to update; the update clears the old cache
// and reloads, then a short confirmation shows the new version.
/* global __BUILD__, __BUILD_DATE__ */
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';
const KEY = 'wl-updated-to';
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }, del: k => { try { localStorage.removeItem(k); } catch (e) { /* */ } } };

async function hardUpdate(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التحديث…'; }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []; await Promise.all(regs.map(r => r.unregister()));
    const keys = (await caches?.keys?.()) || []; await Promise.all(keys.map(k => caches.delete(k)));
  } catch (e) { /* ignore */ }
  location.replace(location.pathname + '?u=' + Date.now() + location.hash);
}

function showBanner(info) {
  if (document.getElementById('upd-modal')) return;
  ls.set(KEY, info.v + '|' + (info.date || ''));
  const d = document.createElement('div'); d.id = 'upd-modal'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
  d.innerHTML = `<div class="upd-card"><img src="brand/logo-160.png" alt="" width="84" height="84"><div class="upd-tag">تحديث إلزامي</div>
    <h2>يوجد إصدار أحدث من المعمل</h2><p>يجب تحديث المعمل قبل المتابعة حتى تعمل التمارين والأصوات الجديدة بشكل صحيح.</p>
    <div class="upd-ver"><span>نسختك: <b dir="ltr">${DATE || '—'}</b></span><span>الإصدار الجديد: <b dir="ltr">${info.date || ''}</b></span></div>
    <button type="button" class="btn primary" id="upd-go">حدّث الآن</button></div>`;
  document.body.appendChild(d);
  d.querySelector('#upd-go').onclick = e => hardUpdate(e.currentTarget);
}

function confirmToast() {
  const was = ls.get(KEY); if (!was) return;
  ls.del(KEY);
  if (was.split('|')[0] !== BUILD) return;   // still old: the check below will ask again
  const t = document.createElement('div'); t.id = 'upd-ok';
  t.innerHTML = `<b>تم التحديث بنجاح ✓</b><span>الإصدار <bdi dir="ltr">${DATE}</bdi></span>`;
  document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 5000);
}

let busy = false, last = 0;
async function check() {
  if (busy || BUILD === 'dev' || !location.protocol.startsWith('http') || !navigator.onLine) return;
  if (Date.now() - last < 15000) return;
  busy = true; last = Date.now();
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (r.ok) { const info = await r.json(); if (info && info.v && info.v !== BUILD) showBanner(info); }
  } catch (e) { /* offline: keep working with this copy */ }
  busy = false;
}

export function startUpdateCheck() {
  const go = () => { confirmToast(); check(); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', check);
  setInterval(check, 10 * 60 * 1000);
}
