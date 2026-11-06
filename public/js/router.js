// ─────────────────────────────────────────────────────────────────
// Minik yönlendirici: ekran durumu + gezinme. Döngüsel içe aktarmayı
// önlemek için app.js ve ekranlar bu modül üzerinden konuşur.
// ─────────────────────────────────────────────────────────────────

export const appState = {
  screen: 'home',
  params: {},
  status: { configured: false, model: '', baseUrl: '' },
  settings: null,
};

export function navigate(screen, params = {}) {
  appState.screen = screen;
  appState.params = params;
  window.dispatchEvent(new CustomEvent('route'));
}
