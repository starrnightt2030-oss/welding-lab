import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as acorn from 'acorn'; import * as walk from 'acorn-walk';
const files = []; (function rd(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) rd(p); else if (p.endsWith('.js')) files.push(p); } })('src');
const AR = /[؀-ۿ]/; const out = {}; let n = 0, ch = 0;
for (const f of files) {
  const ast = acorn.parse(readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  const set = new Set();
  walk.full(ast, x => { if (x.type === 'Literal' && typeof x.value === 'string' && AR.test(x.value)) set.add(x.value); if (x.type === 'TemplateElement' && AR.test(x.value.cooked || '')) set.add(x.value.cooked); });
  if (set.size) { out[f] = [...set]; n += set.size; ch += [...set].join('').length; }
}
mkdirSync(process.argv[2], { recursive: true });
for (const [f, a] of Object.entries(out)) writeFileSync(join(process.argv[2], f.replace(/[\/]/g, '__') + '.json'), JSON.stringify(Object.fromEntries(a.map((s, i) => [i, s])), null, 1));
console.log(n, ch); for (const [f, a] of Object.entries(out)) console.log(f, a.length, a.join('').length);
