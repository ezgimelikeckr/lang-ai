// ─────────────────────────────────────────────────────────────────
// Ses katmanı: SpeechRecognition (mikrofon) + SpeechSynthesis
// (seslendirme) sarmalayıcıları ve tarayıcı destek kontrolleri.
// ─────────────────────────────────────────────────────────────────

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const sttSupported = Boolean(SR);
export const ttsSupported = 'speechSynthesis' in window;

// ── Ses (TTS) listesi ────────────────────────────────────────────
let voicesCache = [];
let voicesLoaded = false;

function loadVoices() {
  voicesCache = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (voicesCache.length) voicesLoaded = true;
}

if (ttsSupported) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/** Ses listesi hazır olana dek bekler (Chrome'da asenkron yüklenir). */
export async function ensureVoicesReady() {
  if (!ttsSupported) return [];
  if (voicesLoaded && voicesCache.length) return voicesCache;
  loadVoices();
  for (let i = 0; i < 20 && !voicesCache.length; i++) {
    await new Promise((r) => setTimeout(r, 150));
    loadVoices();
  }
  return voicesCache;
}

/** Belirli bir dil için yüklü sesleri döndürür (ör. 'en' → en-US, en-GB…). */
export function getVoicesForLang(langPrefix) {
  return voicesCache.filter((v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
}

const GENDER_NAMES = {
  f: /\b(aria|jenny|sonia|libby|maisie|michelle|ana|denise|eloise|brigitte|julie|elvira|dalia|helena|paloma|sabina|salome|zira|hazel|susan|catherine|linda|samantha|amelie|marie|monica|paulina|lucia)\b/i,
  m: /\b(guy|ryan|davis|thomas|henri|claude|antoine|alvaro|jorge|pablo|raul|george|mark|david|daniel|diego|miguel|jacques)\b/i,
};

/**
 * Ayarlardaki tercihe, karakterin yerel aksanına (locale) ve kaliteye göre
 * en iyi sesi seçer. Ayarlardan elle seçilmiş ses her zaman önceliklidir.
 */
export function pickVoice(langPrefix, preferredURI, locale = null, gender = null) {
  let list = getVoicesForLang(langPrefix);
  if (!list.length) return null;
  if (preferredURI) {
    const found = list.find((v) => v.voiceURI === preferredURI);
    if (found) return found;
  }
  if (locale) {
    const norm = (l) => String(l || '').toLowerCase().replace('_', '-');
    const same = list.filter((v) => norm(v.lang) === norm(locale));
    if (same.length) list = same;
  }
  // Doğal/neural/online sesleri öne al, eski robotik SAPI seslerini geriye at
  const score = (v) =>
    (/natural|neural/i.test(v.name) ? 6 : 0) +
    (/online/i.test(v.name) ? 2 : 0) +
    (/premium|enhanced/i.test(v.name) ? 3 : 0) +
    (/google/i.test(v.name) ? 3 : 0) +
    (/microsoft/i.test(v.name) ? 1 : 0) +
    (v.localService ? 0 : 1) +
    (gender && GENDER_NAMES[gender] && GENDER_NAMES[gender].test(v.name) ? 4 : 0) -
    (/\b(david|zira|mark|hazel|george|compact|espeak)\b/i.test(v.name) && !/natural|neural/i.test(v.name) ? 3 : 0);
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

// ── Konuşma metnini doğal sese hazırlama ─────────────────────────
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** Emoji ve biçim işaretlerini temizler (seslendirme onları okumasın). */
function cleanForSpeech(text) {
  return String(text || '')
    .replace(EMOJI_RE, '')
    .replace(/[*_`#~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Metni cümlelere böler; çok kısa parçaları sonrakiyle birleştirir. */
export function prepareSpeechChunks(text) {
  const clean = cleanForSpeech(text);
  if (!clean) return [];
  const parts = (clean.match(/[^.!?…]+[.!?…]*/g) || [clean]).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  for (const p of parts) {
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length < 14) chunks[last] += ' ' + p;
    else chunks.push(p);
  }
  return chunks;
}

let speakToken = 0;      // yeni konuşma veya durdurma gelince eskisini iptal eder
let voicesWaited = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function speakChunk(text, voice, ttsLang, rate, token) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : ttsLang;
    u.rate = rate;
    u.pitch = 1;

    let done = false;
    let watchdog = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      resolve();
    };

    // Chrome'da onend bazen hiç gelmez: tahmini süre dolunca devam et
    const maxMs = Math.max(3000, (text.length * 90) / rate + 2500);
    watchdog = setTimeout(() => {
      console.warn('[TTS] onend gelmedi, zaman aşımıyla devam ediliyor');
      synth.cancel();
      finish();
    }, maxMs);

    u.onend = finish;
    u.onerror = finish;

    // cancel() ile speak() arasına kısa boşluk: Chrome'daki takılmayı azaltır
    setTimeout(() => {
      if (done) return;
      if (token !== speakToken) return finish();
      synth.speak(u);
    }, 50);
  });
}

/**
 * Metni hedef dilde seslendirir; Promise okuma bitince çözülür.
 * Cümle cümle okunur, aralarda kısa duraklama ve çok hafif hız farkı vardır;
 * bu, tek parça okumaya göre çok daha az robotik duyulur.
 */
export async function speak(text, ttsLang, { rate = 1, voiceURI = null, locale = null, gender = null } = {}) {
  const chunks = prepareSpeechChunks(text);
  if (!ttsSupported || !chunks.length) return;

  const synth = window.speechSynthesis;
  const token = ++speakToken;
  synth.cancel();

  if (!voicesCache.length && !voicesWaited) {
    voicesWaited = true;
    await ensureVoicesReady();
  }
  if (token !== speakToken) return;
  const voice = pickVoice(ttsLang.split('-')[0], voiceURI, locale, gender);

  for (let i = 0; i < chunks.length; i++) {
    if (token !== speakToken) return;
    const r = Math.min(1.3, Math.max(0.6, rate + (Math.random() * 0.06 - 0.03)));
    await speakChunk(chunks[i], voice, ttsLang, r, token);
    if (token !== speakToken) return;
    if (i < chunks.length - 1) await sleep(150);
  }
}

export function stopSpeaking() {
  speakToken++;
  if (ttsSupported) window.speechSynthesis.cancel();
}

// ── Mikrofon (STT) ───────────────────────────────────────────────

/** Mikrofona tarayıcı düzeyinde erişilebiliyor mu? Ayrıntılı hata adı döndürür. */
export async function checkMic() {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, error: 'unsupported' };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.name }; // NotAllowedError, NotFoundError, NotReadableError…
  }
}

/**
 * Sürekli dinleme yapan tanıyıcı oluşturur.
 * handlers: { onFinal(text), onInterim(text), onError(err), onEnd(), getSilenceMs() }
 *
 * Duraksayınca cümleyi hemen göndermez: son sözcükten sonra getSilenceMs()
 * kadar (varsayılan 2,5 sn) sessizlik olursa konuşmayı bitmiş sayar. Böylece
 * düşünürken verdiğin kısa aralar seni kesmez. rec.flushNow() ile hemen
 * göndermek de mümkündür ("Bitirdim" düğmesi).
 * onError'a gelen Error nesnesinde `code` alanı tarayıcının hata kodunu taşır.
 */
export function createRecognizer(sttLang, handlers) {
  if (!sttSupported) throw new Error('Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome veya Edge kullanın.');

  const rec = new SR();
  rec.lang = sttLang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalBuffer = '';
  let interimBuffer = '';
  let silenceTimer = null;

  const flush = () => {
    clearTimeout(silenceTimer);
    silenceTimer = null;
    const text = `${finalBuffer} ${interimBuffer}`.trim();
    finalBuffer = '';
    interimBuffer = '';
    if (text && handlers.onFinal) handlers.onFinal(text);
    return text;
  };
  rec.flushNow = flush;

  const fail = (code, message) => {
    const err = new Error(message);
    err.code = code;
    handlers.onError?.(err);
  };

  // Tanılama günlükleri (F12 → Konsol)
  rec.onstart = () => console.debug('[SR] başladı', sttLang);
  rec.onaudiostart = () => console.debug('[SR] mikrofondan ses alınıyor');
  rec.onspeechstart = () => console.debug('[SR] konuşma algılandı');

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) {
        finalBuffer += r[0].transcript + ' ';
        // Tanıyıcının güveni: telaffuzun ne kadar anlaşıldığının kaba bir göstergesi
        if (handlers.onConfidence && typeof r[0].confidence === 'number' && r[0].confidence > 0) handlers.onConfidence(r[0].confidence);
      } else {
        interim += r[0].transcript;
      }
    }
    interimBuffer = interim;

    // Ekranda o ana kadar söylediğin her şey görünür
    const sofar = `${finalBuffer} ${interim}`.trim();
    if (sofar && handlers.onInterim) handlers.onInterim(sofar);

    // Her yeni sözcükte sessizlik sayacı sıfırlanır; süre dolunca gönderilir
    clearTimeout(silenceTimer);
    if (sofar) {
      const wait = handlers.getSilenceMs ? handlers.getSilenceMs() : 2500;
      silenceTimer = setTimeout(flush, wait);
    }
  };

  rec.onerror = (e) => {
    console.debug('[SR] hata:', e.error);
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      fail(e.error, 'Mikrofon izni verilmedi. Tarayıcının adres çubuğundaki mikrofon simgesinden izin verin.');
    } else if (e.error === 'audio-capture') {
      fail(e.error, 'Mikrofon bulunamadı veya kullanılamıyor. Bağlı olduğundan ve başka uygulamanın kullanmadığından emin olun.');
    } else if (e.error === 'network') {
      fail(e.error, 'Konuşma tanıma servisine ulaşılamadı. İnternet bağlantını kontrol et (Chrome sesi Google sunucularına gönderir).');
    } else if (e.error === 'language-not-supported') {
      fail(e.error, 'Seçilen konuşma tanıma dili desteklenmiyor.');
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      fail(e.error, `Tanıma hatası: ${e.error}`);
    }
  };

  rec.onend = () => {
    // Bekleyen son metni gönder
    flush();
    if (handlers.onEnd) handlers.onEnd();
  };

  return rec;
}
