// Collects every Arabic text the app can speak, splits into sentences with the same rules as the runtime,
// and writes app/voice/lines.json  ({ id: text }) for the voice generator.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { speakable, sentences, keyWords, clipId } from '../src/core/voice.js';

const files = []; (function rd(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) rd(p); else if (p.endsWith('.js')) files.push(p); } })('src');
const AR = /[؀-ۿ]/;
const raw = new Set();
for (const f of files) {
  const ast = acorn.parse(readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  walk.full(ast, n => {
    if (n.type === 'Literal' && typeof n.value === 'string' && AR.test(n.value)) raw.add(n.value);
    if (n.type === 'TemplateLiteral') for (const q of n.quasis) if (AR.test(q.value.cooked || '')) raw.add(q.value.cooked);
  });
}
// dynamic phrases
for (let i = 0; i <= 100; i++) { raw.add('درجتك ' + i + ' من مية.'); raw.add(String(i)); }
for (let i = 1; i <= 15; i++) raw.add('الخطوة ' + i + ':');
const extra = JSON.parse(existsSync('tools/voice-extra.json') ? readFileSync('tools/voice-extra.json', 'utf8') : '[]');
extra.forEach(t => raw.add(t));

const lines = {};
const add = t => { const w = keyWords(t); if (!w.length) return; const id = clipId(w); if (!lines[id]) lines[id] = t.replace(/[:؛]$/, '').trim(); };
for (const r of raw) {
  const s = speakable(r); if (!s) continue;
  for (const st of sentences(s)) { add(st); if (st.includes('،')) st.split('،').forEach(x => x.trim() && add(x.trim())); }
}
mkdirSync('app/voice', { recursive: true });
writeFileSync('app/voice/lines.json', JSON.stringify(lines, null, 0));
console.log('lines', Object.keys(lines).length, 'chars', Object.values(lines).join('').length);
