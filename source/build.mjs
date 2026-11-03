import { build } from 'esbuild';
import { readdirSync, writeFileSync, readFileSync } from 'fs';
const ver = 'weldlab-' + Date.now();
const vnum = new Date().toLocaleString('sv-SE', { timeZone: 'Africa/Cairo' }).slice(0, 16);
await build({ entryPoints: ['src/main.js'], bundle: true, minify: !process.env.DEV, format: 'iife', define: { __BUILD__: JSON.stringify(ver), __BUILD_DATE__: JSON.stringify(vnum) }, target: ['chrome100', 'safari15'], outfile: 'app/app.js', legalComments: 'none' });
const files = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './brand/logo-160.png', './brand/logo-256.webp', ...readdirSync('app/fonts').map(f => './fonts/' + f)];
writeFileSync('app/version.json', JSON.stringify({ v: ver, date: vnum }));
// Network-first for pages/code (always fresh when online), cache fallback when offline.
writeFileSync('app/sw.js', `const C='${ver}';const F=${JSON.stringify(files)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(F.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;
const fresh=r.mode==='navigate'||/\\.(js|css|webmanifest|html|json)(\\?|$)/.test(r.url);
if(fresh){e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));}return res;}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))));return;}
e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>m||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));}return res;})))});
`);
// cache-busting: the page always asks for this exact build of the code and styles, and shows the version
let html = readFileSync('app/index.html', 'utf8');
html = html.replace(/href="style\.css(\?v=[^"]*)?"/, `href="style.css?v=${ver}"`).replace(/src="app\.js(\?v=[^"]*)?"/, `src="app.js?v=${ver}"`).replace(/<meta name="build"[^>]*>/, '').replace('<meta name="author"', `<meta name="build" content="${vnum}">\n<meta name="author"`);
writeFileSync('app/index.html', html);
console.log('built', ver);
// collect every spoken sentence → app/voice/lines.json (recorded by the GitHub "voice" workflow)
await build({ entryPoints: ['tools/voice-extract.mjs'], bundle: true, platform: 'node', format: 'esm', outfile: 'node_modules/.cache/vx.mjs', logLevel: 'warning' });
await import('./node_modules/.cache/vx.mjs?' + Date.now());
