import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import * as acorn from 'acorn'; import * as walk from 'acorn-walk';
export const SEG = /[^<>"=\n{}`$]*[؀-ۿ][^<>"=\n{}`$]*/g;
export const SKIP = ['src/core/voice.js', 'src/weld.js'];
export function files() { const a = []; (function rd(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) rd(p); else if (p.endsWith('.js') && !SKIP.includes(p)) a.push(p); } })('src'); return a; }
export function nodes(src) { const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); const out = []; walk.full(ast, x => { if (x.type === 'Literal' && typeof x.value === 'string' && /[؀-ۿ]/.test(x.value)) out.push(x); if (x.type === 'TemplateElement' && /[؀-ۿ]/.test(x.value.cooked || '')) out.push(x); }); return out; }
if (process.argv[2] === 'extract') {
  const segs = new Map();
  for (const f of files()) for (const n of nodes(readFileSync(f, 'utf8'))) { const v = n.type === 'Literal' ? n.value : n.value.cooked; for (const m of v.match(SEG) || []) { const t = m.trim(); if (t && !segs.has(t)) segs.set(t, f); } }
  const arr = [...segs.keys()]; writeFileSync('/tmp/claude-0/msa/segs.json', JSON.stringify(arr, null, 0));
  console.log(arr.length, arr.join('').length);
}
if (process.argv[2] === 'apply') {
  const map = JSON.parse(readFileSync('/tmp/claude-0/msa/map.json', 'utf8'));
  let changed = 0, missing = new Set();
  const tr = v => v.replace(SEG, m => { const t = m.trim(); if (!t) return m; if (!(t in map)) { missing.add(t); return m; } const lead = m.match(/^\s*/)[0], tail = m.match(/\s*$/)[0]; return lead + map[t] + tail; });
  for (const f of files()) {
    let src = readFileSync(f, 'utf8'); const ns = nodes(src).sort((a, b) => b.start - a.start);
    for (const n of ns) {
      if (n.type === 'Literal') { const q = n.raw[0]; const nv = tr(n.value); if (nv === n.value) continue; const raw = q + nv.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q).replace(/\n/g, '\\n') + q; src = src.slice(0, n.start) + raw + src.slice(n.end); changed++; }
      else { const raw = src.slice(n.start, n.end); const nr = tr(raw); if (nr !== raw) { src = src.slice(0, n.start) + nr + src.slice(n.end); changed++; } }
    }
    writeFileSync(f, src);
  }
  console.log('changed', changed, 'missing', missing.size); [...missing].slice(0, 20).forEach(m => console.log(' ?', m));
}
