// Arabic (Egyptian) narration via the device's speech engine, with text normalisation for correct pronunciation.
const DICT = [
  [/\s*\((DCEP|DCEN|DC\+|DC[−-]|AC|DC|HF|CV|MIG|MAG|TIG|FCAW|Cracking|Post-flow)\)/g, ''],
  [/E6013/g, 'إي ستة صفر واحد تلاتة'], [/E7018/g, 'إي سبعة صفر واحد تمانية'], [/ER70S-6/g, 'إي آر سبعين إس ستة'],
  [/\bSMAW\b/g, ''], [/\bGTAW\b/g, ''], [/\bOAW\b/g, ''], [/\bOFC\b/g, ''], [/\bCAW\b/g, ''], [/\bPPE\b/g, ''], [/\bFCAW\b/g, 'السلك المتغلّف'],
  [/\bTIG\b/g, 'تيج'], [/\bMIG\b/g, 'ميج'], [/\bMAG\b/g, 'ماج'], [/CO₂|CO2/g, 'سي أو تو'], [/C₂H₂/g, 'أسيتيلين'], [/\bO₂\b/g, 'أكسجين'], [/\bAr\b/g, 'أرجون'],
  [/DCEP|DC\+/g, 'قطبية عكسية'], [/DCEN|DC[−-]/g, 'قطبية مباشرة'], [/\bAC\b/g, 'تيار متردد'], [/\bDC\b/g, 'تيار مستمر'], [/\bHF\b/g, 'التردد العالي'], [/\bCV\b/g, 'جهد ثابت'],
  [/2T\/4T/g, 'تو تي وفور تي'], [/Post-flow/gi, 'الغاز بعد اللحام'],
  [/L\/min|لتر\/دقيقة/g, ' لتر في الدقيقة'], [/mm\/s|مم\/ث/g, ' مللي في الثانية'], [/m\/min/g, ' متر في الدقيقة'],
  [/(\d)\s*mm\b/g, '$1 مللي'], [/(\d)\s*مم/g, '$1 مللي'], [/(\d)\s*A\b/g, '$1 أمبير'], [/(\d)\s*V\b/g, '$1 فولت'], [/(\d)\s*bar\b/gi, '$1 بار'], [/(\d)\s*psi\b/gi, '$1 بي إس آي'], [/(\d)\s*kg\b/gi, '$1 كيلو'],
  [/(\d)\s*°/g, '$1 درجة'], [/(\d)\s*[٪%]/g, '$1 في المية'], [/مم²/g, 'مللي مربع'],
  [/(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)/g, 'من $1 لـ $2'],
  [/\(([^()]*[A-Za-z][^()]*)\)/g, ''], [/[«»"]/g, ''], [/[←→]/g, ' بعدين '], [/•/g, '، '], [/\s*\/\s*/g, ' أو '],
  [/\bE\b/g, 'إي'], [/\s=\s/g, ' يعني '], [/[()]/g, '، '], [/مع من /g, 'مع '], [/بين من /g, 'بين '],
  [/(^|[\s،.])الخبث(?=$|[\s،.؟!])/g, '$1الخَبَث'], [/(^|[\s،.])القطب(?=$|[\s،.؟!])/g, '$1القُطب'], [/(^|[\s،.])البركة(?=$|[\s،.؟!])/g, '$1البِركة'], [/(^|[\s،.])مبري(?=$|[\s،.؟!])/g, '$1مَبْري']
];
const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.' };

export function speakable(t) {
  let s = String(t || '').replace(/<[^>]+>/g, ' ').replace(/[٠-٩٫]/g, d => AR_DIGITS[d]);
  for (const [re, rep] of DICT) s = s.replace(re, rep);
  s = s.replace(/[A-Za-z][A-Za-z\s\-+/.&—]*[A-Za-z]/g, m => /^(E|ER|TIG|MIG|MAG)$/.test(m) ? m : '');   // drop leftover English
  return s.replace(/،\s*،/g, '،').replace(/،\s*([.:؛])/g, '$1').replace(/\s+([،.؟!:])/g, '$1').replace(/\s{2,}/g, ' ').replace(/(^[\s،.]+)|([\s،]+$)/g, '').trim();
}

export class Voice {
  constructor() {
    this.enabled = true; this.voice = null; this.ok = 'speechSynthesis' in window; this.last = ''; this.lastT = 0; this.warned = false;
    if (!this.ok) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang));
      const score = v => (/ar[-_]EG/i.test(v.lang) ? 100 : /ar[-_](SA|AE|JO|LB)/i.test(v.lang) ? 40 : 20) + (/natural|online|neural|wavenet|salma|shakir|hamed|zariyah/i.test(v.name) ? 50 : 0) + (v.localService ? 0 : 5);
      this.voice = vs.sort((a, b) => score(b) - score(a))[0] || null;
    };
    pick(); speechSynthesis.onvoiceschanged = pick;
  }
  get available() { return this.ok && !!this.voice; }
  // priority: 'high' interrupts anything; 'normal' interrupts lower; 'low' (coach tips) only if idle
  say(text, prio = 'normal') {
    if (!this.ok || !this.enabled) return;
    const s = speakable(text); if (!s) return;
    const now = performance.now();
    if (s === this.last && now - this.lastT < 5000) return;
    if (prio === 'low' && speechSynthesis.speaking) return;
    if (!this.voice) { this.voice = speechSynthesis.getVoices().find(v => /^ar/i.test(v.lang)) || null; }
    if (!this.voice) { if (!this.warned && this.onMissing) { this.warned = true; this.onMissing(); } return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(s);
    u.voice = this.voice; u.lang = this.voice.lang; u.rate = 0.96; u.pitch = 1; u.volume = 1;
    this.last = s; this.lastT = now;
    speechSynthesis.speak(u);
  }
  stop() { if (this.ok) speechSynthesis.cancel(); }
}
