// ─────────────────────────────────────────────────────────────────
// Basit ekran yönlendirici. Ekranlar onCleanup ile temizlik işlevi kaydeder
// (mikrofonu, seslendirmeyi ve sayaçları kapatmak için).
// ─────────────────────────────────────────────────────────────────
export const appState = {
  screen: 'home',
  params: {},
  status: null,        // sunucu durumu (LLM bağlı mı?)
  dailyEarned: null,   // bugün kazanılan giriş puanı
  cleanup: null,
};

export function onCleanup(fn) {
  appState.cleanup = fn;
}

export function navigate(screen, params = {}) {
  if (typeof appState.cleanup === 'function') {
    try { appState.cleanup(); } catch (e) { console.error(e); }
  }
  appState.cleanup = null;
  appState.screen = screen;
  appState.params = params;
  window.dispatchEvent(new Event('route'));
  window.scrollTo?.(0, 0);
}
