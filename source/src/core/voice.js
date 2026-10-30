// Egyptian-Arabic narration. Plays pre-recorded neural voice clips (voice/<id>.mp3, generated from the
// app's own texts — see tools/voice-extract.mjs and .github/workflows/voice.yml). The device's speech engine
// is only a last-resort fallback for a sentence that has no recorded clip.
const DICT = [
  [/\s*\((DCEP|DCEN|DC\+|DC[−-]|AC|DC|HF|CV|MIG|MAG|TIG|FCAW|Cracking|Post-flow)\)/g, ''],
  [/E6013/g, 'إي ستة صفر واحد ثلاثة'], [/E7018/g, 'إي سبعة صفر واحد ثمانية'], [/ER70S-6/g, 'إي آر سبعين إس ستة'],
  [/\bSMAW\b/g, ''], [/\bGTAW\b/g, ''], [/\bOAW\b/g, ''], [/\bOFC\b/g, ''], [/\bCAW\b/g, ''], [/\bPPE\b/g, ''], [/\bFCAW\b/g, 'السلك المغلّف'],
  [/\bTIG\b/g, 'تيج'], [/\bMIG\b/g, 'ميج'], [/\bMAG\b/g, 'ماج'], [/CO₂|CO2/g, 'ثاني أكسيد الكربون'], [/C₂H₂/g, 'أسيتيلين'], [/\bO₂\b/g, 'أكسجين'], [/\bAr\b/g, 'أرجون'],
  [/DCEP|DC\+/g, 'قطبية عكسية'], [/DCEN|DC[−-]/g, 'قطبية مباشرة'], [/\bAC\b/g, 'تيار متردد'], [/\bDC\b/g, 'تيار مستمر'], [/\bHF\b/g, 'التردد العالي'], [/\bCV\b/g, 'جهد ثابت'],
  [/2T\/4T/g, 'تو تي وفور تي'], [/Post-flow/gi, 'الغاز بعد اللحام'],
  [/L\/min|لتر\/دقيقة/g, ' لتر في الدقيقة'], [/mm\/s|مم\/ث/g, ' مليمتر في الثانية'], [/m\/min/g, ' متر في الدقيقة'],
  [/(\d)\s*mm\b/g, '$1 مليمتر'], [/(\d)\s*مم/g, '$1 مليمتر'], [/(\d)\s*A\b/g, '$1 أمبير'], [/(\d)\s*V\b/g, '$1 فولت'], [/(\d)\s*bar\b/gi, '$1 بار'], [/(\d)\s*psi\b/gi, '$1 بي إس آي'], [/(\d)\s*kg\b/gi, '$1 كيلو'],
  [/(\d)\s*°/g, '$1 درجة'], [/(\d)\s*[٪%]/g, '$1 بالمئة'], [/مم²/g, 'مليمتر مربع'],
  [/(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)/g, 'من $1 إلى $2'],
  [/\s*\(\s*[+−-]\s*\)/g, ''], [/(^|\s)[+−](?=\s|$|[،.])/g, '$1'],
  [/\(([^()]*[A-Za-z][^()]*)\)/g, ''], [/[«»"]/g, ''], [/[←→]/g, ' بعدين '], [/•/g, '، '], [/\s*\/\s*/g, ' أو '],
  [/\bE\b/g, 'إي'], [/\s=\s/g, ' تعني '], [/[()]/g, '، '], [/مع من /g, 'مع '], [/بين من /g, 'بين ']
];
const W = (w, d) => [new RegExp('(^|[^\\u0621-\\u064A])([وفبلك]?(?:ال|لل)?)' + w + '(?=$|[^\\u0621-\\u064A])', 'g'), '$1$2' + d];
const TASHKEEL = [W('بركة', 'بِرْكَة'), W('البركة', 'البِرْكَة'), W('قطب', 'قُطْب'), W('القطب', 'القُطْب'), W('خبث', 'خَبَث'), W('الخبث', 'الخَبَث'), W('مبري', 'مَبْرِيّ'), W('مبريًا', 'مَبْرِيًّا'),
  W('مقوّم', 'مُقَوِّم'), W('مقوم', 'مُقَوِّم'), W('المصمت', 'المُصْمَت'), W('رذاذ', 'رَذَاذ'), W('الرذاذ', 'الرَّذَاذ'), W('تصرف', 'تَصَرُّف'), W('التصرف', 'التَّصَرُّف'), W('أبطئ', 'أَبْطِئ'), W('زِد', 'زِدْ'),
  W('اِبرِ', 'اِبْرِ'), W('يُبرى', 'يُبْرَى'), W('الشد', 'الشَّدّ'), W('الفونية', 'الفُونْيَة'), W('فونية', 'فُونْيَة'), W('الجذر', 'الجَذْر'), W('شطف', 'شَطْف'), W('سُمك', 'سُمْك'), W('السُمك', 'السُّمْك'),
  W('التنجستن', 'التَّنْجِسْتِن'), W('بالمئة', 'بالمِئة'), W('مئة', 'مِئة'), W('عالٍ', 'عالٍ'), W('القوس', 'القَوْس'), W('قوس', 'قَوْس'), W('المنصهر', 'المُنْصَهِر'), W('ينصهر', 'يَنْصَهِر'), W('مطفأة', 'مُطْفَأة'), W('أطفئ', 'أَطْفِئ')];
const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.' };

export function speakable(t) {
  let s = String(t || '').replace(/<[^>]+>/g, ' ').replace(/[٠-٩٫]/g, d => AR_DIGITS[d]);
  for (const [re, rep] of DICT) s = s.replace(re, rep);
  s = s.replace(/[A-Za-z][A-Za-z\s\-+/.&—]*[A-Za-z]/g, m => /^(E|ER|TIG|MIG|MAG)$/.test(m) ? m : '');   // drop leftover English
  for (const [re, rep] of TASHKEEL) s = s.replace(re, rep);
  return s.replace(/،\s*،/g, '،').replace(/،\s*([.:؛])/g, '$1').replace(/\s+([،.؟!:])/g, '$1').replace(/\s{2,}/g, ' ').replace(/(^[\s،.]+)|([\s،]+$)/g, '').trim();
}
// sentences: split after . ! ؟ ? : ؛ (not inside decimals like 0.8)
export function sentences(s) {
  return s.split(/(?<=[!؟?:؛\n])\s*|(?<=[^\d]\.)\s*|(?<=\d\.)(?=\s)\s*/).map(x => x.trim()).filter(x => /[؀-ۿ\d]/.test(x));
}
// lookup key: no diacritics/punctuation, unified letter forms
export function keyWords(s) {
  return s.replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/(\d)\.(\d)/g, '$1d$2').replace(/[^ء-ي\d\sd]/g, ' ').split(/\s+/).filter(Boolean);
}
export function clipId(words) {   // FNV-1a 32 → base36
  let h = 0x811c9dc5; const s = words.join(' ');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

export class Voice {
  constructor({ getCtx, base = 'voice/' } = {}) {
    this.enabled = true; this.getCtx = getCtx; this.base = base;
    this.ids = null; this.buf = new Map(); this.queue = []; this.src = null; this.token = 0;
    this.last = ''; this.lastT = 0; this.busy = false; this.missing = new Set();
    // file:// (offline folder): fetch() is blocked, so the clip list comes from voice/index.js and clips play through <audio>
    this.fileMode = location.protocol === 'file:';
    this.ready = this.fileMode
      ? new Promise(res => { const sc = document.createElement('script'); sc.src = base + 'index.js'; sc.onload = () => { this.ids = new Set((window.VOICE_INDEX && window.VOICE_INDEX.ids) || []); res(); }; sc.onerror = () => { this.ids = new Set(); res(); }; document.head.appendChild(sc); })
      : fetch(base + 'index.json').then(r => r.ok ? r.json() : null).then(j => { this.ids = new Set(j && j.ids || []); }).catch(() => { this.ids = new Set(); });
    this.tts = 'speechSynthesis' in window; this.ttsVoice = null;
    if (this.tts) { const pick = () => { const vs = speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang)); this.ttsVoice = vs.find(v => /EG/i.test(v.lang)) || vs[0] || null; }; pick(); speechSynthesis.onvoiceschanged = pick; }
  }
  get speaking() { return this.busy; }
  // split a sentence into the fewest recorded clips (dynamic programming over words)
  plan(sent) {
    const w = keyWords(sent); if (!w.length) return [];
    const whole = clipId(w); if (this.ids.has(whole)) return [{ id: whole }];
    const n = w.length, best = new Array(n + 1).fill(null); best[0] = [];
    for (let i = 0; i < n; i++) {
      if (!best[i]) continue;
      for (let j = Math.min(n, i + 40); j > i; j--) {
        const id = clipId(w.slice(i, j));
        if (this.ids.has(id) && (!best[j] || best[j].length > best[i].length + 1)) best[j] = best[i].concat([{ id }]);
      }
      if (!best[i + 1]) best[i + 1] = best[i].concat([{ text: w[i] }]);   // unknown word → fallback
    }
    // merge consecutive fallback words into one TTS chunk
    const out = [];
    for (const p of best[n]) { const l = out[out.length - 1]; if (p.text && l && l.text) l.text += ' ' + p.text; else out.push({ ...p }); }
    return out;
  }
  async load(id) {
    if (this.fileMode) return { file: this.base + id + '.mp3' };
    if (this.buf.has(id)) return this.buf.get(id);
    const ctx = this.getCtx && this.getCtx(); if (!ctx) return null;
    const pr = fetch(this.base + id + '.mp3').then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).catch(() => null);
    this.buf.set(id, pr); if (this.buf.size > 80) this.buf.delete(this.buf.keys().next().value);
    return pr;
  }
  // priority: 'high'/'normal' interrupt; 'low' (coach tips) only when idle
  async say(text, prio = 'normal') {
    if (!this.enabled) return;
    const s = speakable(text); if (!s) return;
    const now = performance.now();
    if (s === this.last && now - this.lastT < 5000) return;
    if (prio === 'low' && this.busy) return;
    this.last = s; this.lastT = now;
    this.stop(); const tok = ++this.token;
    if (!this.ids) await this.ready;
    if (tok !== this.token) return;
    const parts = []; for (const st of sentences(s)) { parts.push(...this.plan(st)); parts.push({ gap: 0.18 }); }
    parts.forEach(p => p.id && this.load(p.id));   // prefetch all
    this.busy = true;
    for (const p of parts) {
      if (tok !== this.token) return;
      if (p.gap) { await new Promise(r => setTimeout(r, p.gap * 1000)); continue; }
      if (p.id) { const b = await this.load(p.id); if (tok !== this.token) return; if (b) await this.play(b, tok); }
      else if (p.text) { this.missing.add(p.text); await this.speakTTS(p.text, tok); }
    }
    if (tok === this.token) this.busy = false;
  }
  play(b, tok) {
    if (b.file) return new Promise(res => { const a = this.el = new Audio(b.file); a.volume = 1; a.onended = a.onerror = () => res(); a.play().catch(() => res()); });
    const ctx = this.getCtx(); if (!ctx) return Promise.resolve();
    if (ctx.state === 'suspended') ctx.resume();
    return new Promise(res => {
      const src = ctx.createBufferSource(); src.buffer = b;
      if (!this.out) { this.out = ctx.createGain(); this.out.gain.value = 1.15; this.out.connect(ctx.destination); }
      src.connect(this.out); src.onended = () => { if (this.src === src) this.src = null; res(); };
      this.src = src; src.start();
      setTimeout(res, b.duration * 1000 + 400);   // safety if onended never fires
    });
  }
  speakTTS(t, tok) {
    if (!this.tts || !this.ttsVoice) return Promise.resolve();
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(t); u.voice = this.ttsVoice; u.lang = this.ttsVoice.lang; u.rate = 0.95;
      u.onend = u.onerror = () => res(); speechSynthesis.speak(u); setTimeout(res, 400 + t.length * 120);
    });
  }
  stop() {
    this.token++; this.busy = false;
    if (this.src) { try { this.src.stop(); } catch (e) {} this.src = null; }
    if (this.el) { try { this.el.pause(); } catch (e) {} this.el = null; }
    if (this.tts) speechSynthesis.cancel();
  }
}
