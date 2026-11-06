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

/** Ayarlardaki tercihe veya kaliteye göre en iyi sesi seçer. */
export function pickVoice(langPrefix, preferredURI) {
  const list = getVoicesForLang(langPrefix);
  if (!list.length) return null;
  if (preferredURI) {
    const found = list.find((v) => v.voiceURI === preferredURI);
    if (found) return found;
  }
  // Doğal/online sesleri tercih et
  const score = (v) =>
    (/natural/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) +
    (/microsoft/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

/** Metni hedef dilde seslendirir; Promise okuma bitince çözülür. */
export function speak(text, ttsLang, { rate = 1, voiceURI = null } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported || !text) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const prefix = ttsLang.split('-')[0];
    const voice = pickVoice(prefix, voiceURI);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : ttsLang;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel();
}

// ── Mikrofon (STT) ───────────────────────────────────────────────

/**
 * Sürekli dinleme yapan tanıyıcı oluşturur.
 * handlers: { onFinal(text), onInterim(text), onError(err), onEnd() }
 */
export function createRecognizer(sttLang, handlers) {
  if (!sttSupported) throw new Error('Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome veya Edge kullanın.');

  const rec = new SR();
  rec.lang = sttLang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalBuffer = '';

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalBuffer += r[0].transcript + ' ';
      else interim += r[0].transcript;
    }
    if (interim && handlers.onInterim) handlers.onInterim(interim);
    if (finalBuffer.trim() && handlers.onFinal) {
      const text = finalBuffer.trim();
      finalBuffer = '';
      handlers.onFinal(text);
    }
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      handlers.onError(new Error('Mikrofon izni verilmedi. Tarayıcının adres çubuğundaki mikrofon simgesinden izin verin.'));
    } else if (e.error === 'audio-capture') {
      handlers.onError(new Error('Mikrofon bulunamadı. Bağlı olduğundan emin olun.'));
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      handlers.onError(new Error(`Tanıma hatası: ${e.error}`));
    }
  };

  rec.onend = () => {
    // Bekleyen son metni temizle
    if (finalBuffer.trim() && handlers.onFinal) {
      const text = finalBuffer.trim();
      finalBuffer = '';
      handlers.onFinal(text);
    }
    if (handlers.onEnd) handlers.onEnd();
  };

  return rec;
}
