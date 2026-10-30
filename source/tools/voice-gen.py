# Generates the narration clips with an Egyptian neural voice (edge-tts). Runs in GitHub Actions.
# Usage: python voice-gen.py <voice_dir>   (reads lines.json, writes <id>.mp3 + index.json)
import asyncio, json, os, sys, edge_tts
D = sys.argv[1] if len(sys.argv) > 1 else 'voice'
VOICE = os.environ.get('VOICE', 'ar-EG-ShakirNeural'); RATE = os.environ.get('RATE', '-6%'); PITCH = os.environ.get('PITCH', '-2Hz')
lines = json.load(open(os.path.join(D, 'lines.json'), encoding='utf-8'))
idx_path = os.path.join(D, 'index.json')
old = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
if old.get('voice') != VOICE + RATE + PITCH:   # voice changed → regenerate everything
    for f in os.listdir(D):
        if f.endswith('.mp3'): os.remove(os.path.join(D, f))
sem = asyncio.Semaphore(5); done = []; fail = []
LOG = open(os.path.join(D, 'gen-log.txt'), 'w', encoding='utf-8')
def log(*a): print(*a, flush=True); print(*a, file=LOG, flush=True)
log('edge-tts', getattr(edge_tts, '__version__', '?'), VOICE, RATE, PITCH, 'lines', len(lines))
async def probe():
    try:
        await asyncio.wait_for(edge_tts.Communicate('أهلاً بيكم في معمل اللحام.', VOICE).save(os.path.join(D, 'probe.mp3.part')), 40)
        log('probe ok', os.path.getsize(os.path.join(D, 'probe.mp3.part')))
    except Exception as e:
        log('probe FAILED', type(e).__name__, repr(e)[:500]); LOG.close(); sys.exit(1)
asyncio.run(probe())
def save_index():
    d = {'voice': VOICE + RATE + PITCH, 'ids': sorted(done)}
    json.dump(d, open(idx_path, 'w'))
    open(os.path.join(D, 'index.js'), 'w').write('window.VOICE_INDEX=' + json.dumps(d) + ';')
async def one(i, t):
    p = os.path.join(D, i + '.mp3')
    if os.path.exists(p) and os.path.getsize(p) > 500: done.append(i); return
    async with sem:
        for k in range(4):
            try:
                await asyncio.wait_for(edge_tts.Communicate(t, VOICE, rate=RATE, pitch=PITCH).save(p + '.part'), 45)
                if os.path.getsize(p + '.part') > 500:
                    os.replace(p + '.part', p)
                    done.append(i)
                    if len(done) % 50 == 0: save_index(); print('progress', len(done), '/', len(lines), flush=True)
                    return
            except Exception as e: log('retry', i, type(e).__name__, repr(e)[:200])
            await asyncio.sleep(1 + k * 2)
        fail.append((i, t))
async def main(): await asyncio.gather(*[one(i, t) for i, t in lines.items()])
asyncio.run(main())
for f in os.listdir(D):   # drop clips no longer used
    if (f.endswith('.mp3') and f[:-4] not in lines) or f.endswith('.part'): os.remove(os.path.join(D, f))
save_index()
log('ok', len(done), 'failed', len(fail)); [log(' ', x) for x in fail[:20]]
LOG.close()
