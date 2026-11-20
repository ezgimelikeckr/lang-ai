// ─────────────────────────────────────────────────────────────────
// Yerel kayıt (localStorage): profil, diller, seviyeler, puanlar, sohbet geçmişi
// ─────────────────────────────────────────────────────────────────
const KEY = 'lingo:v1';

const DEFAULTS = {
  name: '',
  languages: [],     // seçilme sırasına göre ['en', 'es']
  active: null,      // şu an çalışılan dil
  levels: {},        // { en: 'B1' }
  points: 0,
  lastVisit: '',     // son giriş günü (YYYY-MM-DD)
  streak: 0,
  sessions: [],      // son sohbetler
  onboarded: false,
};

export function getProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* yoksay */ }
  return { ...DEFAULTS, languages: [], levels: {}, sessions: [] };
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* yoksay */ }
  return p;
}

export function updateProfile(fn) {
  const p = getProfile();
  const next = fn(p) || p;
  return saveProfile(next);
}

export function todayStr(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Günün ilk girişinde +10 puan verir. Verdiyse {earned, streak}, vermediyse null. */
export function claimDailyPoints() {
  const p = getProfile();
  const today = todayStr();
  if (p.lastVisit === today) return null;
  const y = new Date(); y.setDate(y.getDate() - 1);
  p.streak = p.lastVisit === todayStr(y) ? p.streak + 1 : 1;
  p.lastVisit = today;
  p.points += 10;
  saveProfile(p);
  return { earned: 10, streak: p.streak };
}

export function addPoints(n) {
  return updateProfile((p) => { p.points += n; }).points;
}

export function setLevel(lang, level) {
  updateProfile((p) => {
    p.levels = { ...p.levels, [lang]: level };
    p.active = lang;
    p.onboarded = true;
  });
}

export function addSession(s) {
  updateProfile((p) => { p.sessions = [s, ...p.sessions].slice(0, 30); });
}
