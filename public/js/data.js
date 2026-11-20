// ─────────────────────────────────────────────────────────────────
// Sabit veriler: diller, seviyeler, arkadaşlar, sahneler, mini test soruları
// ─────────────────────────────────────────────────────────────────

export const LANGUAGES = {
  en: { code: 'EN', name: 'İngilizce', native: 'English', sttLang: 'en-US', ttsLang: 'en-US', badge: '#dcebec' },
  es: { code: 'ES', name: 'İspanyolca', native: 'Español', sttLang: 'es-ES', ttsLang: 'es-ES', badge: '#f5e6b0' },
  de: { code: 'DE', name: 'Almanca', native: 'Deutsch', sttLang: 'de-DE', ttsLang: 'de-DE', badge: '#e4e6d8' },
  fr: { code: 'FR', name: 'Fransızca', native: 'Français', sttLang: 'fr-FR', ttsLang: 'fr-FR', badge: '#e0e6f5' },
};
export const LANG_ORDER = ['en', 'es', 'de', 'fr'];

export const LEVELS = { A1: 'Başlangıç', A2: 'Temel', B1: 'Orta', B2: 'Orta üstü', C1: 'İleri', C2: 'Uzman' };

export function levelBand(level) {
  if (level === 'A1' || level === 'A2') return 'low';
  if (level === 'B1' || level === 'B2') return 'mid';
  return 'high';
}

export function difficultyFor(level) {
  const b = levelBand(level);
  return b === 'low' ? 'easy' : b === 'mid' ? 'medium' : 'hard';
}

export const LEVEL_PREP = {
  low: ['{L} düzeyinde kısa ve basit sohbetler', 'Yavaş ve sabırlı konuşan arkadaşlar', 'Her adımda ipucu desteği'],
  mid: ['{L} düzeyinde günlük sohbetler', 'Yavaş ve anlaşılır konuşan arkadaşlar', 'Günde 5 dakikalık kısa pratikler'],
  high: ['{L} düzeyinde derin sohbetler', 'Doğal hızda konuşan arkadaşlar', 'Deyim ve nüans odaklı pratikler'],
};

// Bir sohbet sahnesi kaç konuşma turu sürer
export const MAX_TURNS = 5;

export const FRIENDS = {
  mia: {
    id: 'mia', name: 'Mia', tag: 'Sakin ve destekleyici', topics: 'Günlük yaşam · Kafe', cls: 'f-mia', img: 'assets/mia.png',
    scene: { id: 'cafe', label: 'Kafede', mode: 'roleplay', scenario: 'cafe', step: { title: 'Bir kahve, bir sohbet', text: 'Mia ile kafede sipariş ver.', tag: 'Günlük yaşam' } },
  },
  leo: {
    id: 'leo', name: 'Leo', tag: 'Meraklı ve enerjik', topics: 'Hobiler · Yeni yerler', cls: 'f-leo', img: 'assets/leo.png',
    scene: { id: 'park', label: 'Parkta', mode: 'roleplay', scenario: 'park', step: { title: 'Hafta sonu planı', text: 'Leo ile hobilerini konuş.', tag: 'Hobiler' } },
  },
  lina: {
    id: 'lina', name: 'Lina', tag: 'Neşeli ve yaratıcı', topics: 'Sanat · Seyahat', cls: 'f-lina', img: 'assets/lina.png',
    scene: { id: 'trip', label: 'Seyahat planı', mode: 'roleplay', scenario: 'trip', step: { title: 'Küçük bir kaçamak', text: 'Lina ile bir gezi planla.', tag: 'Seyahat' } },
  },
};
export const FRIEND_ORDER = ['mia', 'leo', 'lina'];

/** Seviyene göre sahne: A1–A2'de Leo ile klasik tanışma (selamlaşma) sohbeti. */
export function sceneFor(friend, level) {
  if (friend.id === 'leo' && levelBand(level) === 'low') {
    return { id: 'meet', label: 'Tanışma', mode: 'daily', scenario: '', step: { title: 'Merhaba, ben Leo', text: 'Leo ile tanış ve kendini tanıt.', tag: 'Tanışma' } };
  }
  return friend.scene;
}

/** Önerilen arkadaş (seviyeye göre). */
export function recommendedFriend(level) {
  if (level === 'B2') return FRIENDS.leo;
  if (level === 'C1' || level === 'C2') return FRIENDS.lina;
  return FRIENDS.mia;
}

// Mini test sorularını soran Mia'nın sesi (aksan)
export const MIA_VOICE = { en: 'en-GB', es: 'es-ES', de: 'de-DE', fr: 'fr-FR' };

// 4 soru, giderek zorlaşır (serbest zaman → geçmiş → fikir → varsayım)
export const TEST_QUESTIONS = {
  en: [
    'What do you like to do in your free time?',
    'Tell me about something you did last weekend.',
    'What do you think is the best way to learn a new language, and why?',
    'If you could live in any city in the world, where would you choose, and what would your life be like?',
  ],
  es: [
    '¿Qué te gusta hacer en tu tiempo libre?',
    'Cuéntame algo que hiciste el fin de semana pasado.',
    '¿Cuál crees que es la mejor manera de aprender un idioma y por qué?',
    'Si pudieras vivir en cualquier ciudad del mundo, ¿dónde vivirías y cómo sería tu vida?',
  ],
  de: [
    'Was machst du gern in deiner Freizeit?',
    'Erzähl mir etwas, das du letztes Wochenende gemacht hast.',
    'Was ist deiner Meinung nach der beste Weg, eine Sprache zu lernen, und warum?',
    'Wenn du in jeder Stadt der Welt leben könntest, wo würdest du wohnen und wie würde dein Leben aussehen?',
  ],
  fr: [
    "Qu'est-ce que tu aimes faire pendant ton temps libre ?",
    "Raconte-moi quelque chose que tu as fait le week-end dernier.",
    'Selon toi, quelle est la meilleure façon d\'apprendre une langue, et pourquoi ?',
    "Si tu pouvais vivre dans n'importe quelle ville du monde, où irais-tu et comment serait ta vie ?",
  ],
};
