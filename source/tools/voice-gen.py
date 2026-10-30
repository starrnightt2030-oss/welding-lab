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
sem = asyncio.Semaphore(6); done = []; fail = []
async def one(i, t):
    p = os.path.join(D, i + '.mp3')
    if os.path.exists(p) and os.path.getsize(p) > 500: done.append(i); return
    async with sem:
        for k in range(4):
            try:
                await edge_tts.Communicate(t, VOICE, rate=RATE, pitch=PITCH).save(p)
                if os.path.getsize(p) > 500: done.append(i); return
            except Exception as e: err = e
            await asyncio.sleep(1 + k * 2)
        fail.append((i, t))
async def main(): await asyncio.gather(*[one(i, t) for i, t in lines.items()])
asyncio.run(main())
for f in os.listdir(D):   # drop clips no longer used
    if f.endswith('.mp3') and f[:-4] not in lines: os.remove(os.path.join(D, f))
json.dump({'voice': VOICE + RATE + PITCH, 'ids': sorted(done)}, open(idx_path, 'w'))
print('ok', len(done), 'failed', len(fail)); [print(' ', x) for x in fail[:20]]
