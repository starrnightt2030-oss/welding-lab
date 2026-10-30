import { readFileSync, readdirSync } from 'fs';
import { speakable, sentences, keyWords, clipId, Voice } from '../src/core/voice.js';
const ids = new Set(Object.keys(JSON.parse(readFileSync('app/voice/lines.json', 'utf8'))));
const v = Object.create(Voice.prototype); v.ids = ids;
const dir = process.argv[2]; let tot = 0, miss = 0; const bad = new Map();
for (const f of readdirSync(dir).filter(f => f.startsWith('spoken-'))) for (const t of JSON.parse(readFileSync(dir + '/' + f, 'utf8'))) {
  for (const st of sentences(speakable(t))) { const pl = v.plan(st); tot++; const fb = pl.filter(p => p.text); if (fb.length) { miss++; bad.set(st, fb.map(p => p.text).join(' | ')); } else if (pl.length > 2) bad.set(st, 'segments:' + pl.length); }
}
console.log('sentences', tot, 'with fallback', miss); for (const [k, x] of bad) console.log(' -', k, '=>', x);
