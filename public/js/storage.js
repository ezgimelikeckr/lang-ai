// ─────────────────────────────────────────────────────────────────
// localStorage katmanı — ayarlar, seans geçmişi (dil başına),
// kelime defteri (dil başına). Her şey "kp_" önekiyle saklanır.
// ─────────────────────────────────────────────────────────────────

export const LANGUAGES = {
  en: { name: 'İngilizce', flag: '🇬🇧', sttLang: 'en-US', ttsLang: 'en-US', sample: 'Hello! How is your day going?' },
  fr: { name: 'Fransızca', flag: '🇫🇷', sttLang: 'fr-FR', ttsLang: 'fr-FR', sample: 'Bonjour ! Comment ça va ?' },
  es: { name: 'İspanyolca', flag: '🇪🇸', sttLang: 'es-ES', ttsLang: 'es-ES', sample: '¡Hola! ¿Cómo estás?' },
};

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const MODES = {
  daily: { label: 'Günlük Sohbet', icon: '☕', desc: 'Arkadaş gibi doğal diyalog' },
  free: { label: 'Serbest Konuşma', icon: '🎈', desc: 'Konu seçmeden, özgürce' },
  roleplay: { label: 'Rol Yapma', icon: '🎭', desc: 'Restoran, otel, mülakat…' },
  debate: { label: 'Fikir Alışverişi', icon: '💭', desc: 'Bir konuyu karşılıklı tartış' },
  story: { label: 'Hikâye Anlatımı', icon: '📖', desc: 'Yapay zekâ başlatır, sen sürdür' },
};

export const SCENARIOS = {
  restaurant: { label: 'Restoran', icon: '🍽️' },
  hotel: { label: 'Otel', icon: '🏨' },
  airport: { label: 'Havaalanı', icon: '✈️' },
  shopping: { label: 'Alışveriş', icon: '🛍️' },
  friends: { label: 'Arkadaşlık', icon: '👋' },
  interview: { label: 'İş Görüşmesi', icon: '💼' },
};

const DEFAULT_SETTINGS = {
  levels: { en: 'B1', fr: 'A2', es: 'A1' },
  defaultDifficulty: 'medium',
  defaultCorrectionMode: 'instant',
  voices: {}, // dil → voiceURI
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Ayarlar ──────────────────────────────────────────────────────
export function getSettings() {
  const s = read('kp_settings', {});
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    levels: { ...DEFAULT_SETTINGS.levels, ...(s.levels || {}) },
    voices: { ...(s.voices || {}) },
  };
}

export function updateSettings(patch) {
  const s = { ...getSettings(), ...patch };
  write('kp_settings', s);
  return s;
}

export function setLevel(lang, level) {
  const s = getSettings();
  s.levels[lang] = level;
  write('kp_settings', s);
  return s;
}

export function setVoice(lang, voiceURI) {
  const s = getSettings();
  s.voices[lang] = voiceURI;
  write('kp_settings', s);
  return s;
}

// ── Seans geçmişi ────────────────────────────────────────────────
export function getSessions(lang) {
  return read(`kp_history_${lang}`, []);
}

export function saveSession(lang, session) {
  const list = getSessions(lang);
  list.unshift(session);
  write(`kp_history_${lang}`, list.slice(0, 100)); // en fazla 100 seans
}

export function getSession(lang, id) {
  return getSessions(lang).find((s) => s.id === id) || null;
}

export function deleteSession(lang, id) {
  write(`kp_history_${lang}`, getSessions(lang).filter((s) => s.id !== id));
}

export function getLanguageStats(lang) {
  const sessions = getSessions(lang);
  return {
    count: sessions.length,
    totalSec: sessions.reduce((a, s) => a + (s.durationSec || 0), 0),
    totalWords: sessions.reduce((a, s) => a + (s.userWords || 0), 0),
  };
}

export function formatDuration(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h} sa ${m % 60} dk`;
  }
  return m > 0 ? `${m} dk ${s} sn` : `${s} sn`;
}

// ── Kelime defteri ───────────────────────────────────────────────
export function getVocab(lang) {
  return read(`kp_vocab_${lang}`, []);
}

export function addVocab(lang, entry) {
  const list = getVocab(lang);
  // Aynı kelimeyi tekrar ekleme
  if (list.some((e) => e.word.toLowerCase() === entry.word.toLowerCase())) return false;
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    word: entry.word,
    meaning: entry.meaning || '',
    pronunciation: entry.pronunciation || '',
    example: entry.example || '',
    date: new Date().toISOString(),
  });
  write(`kp_vocab_${lang}`, list);
  return true;
}

export function deleteVocab(lang, id) {
  write(`kp_vocab_${lang}`, getVocab(lang).filter((e) => e.id !== id));
}
