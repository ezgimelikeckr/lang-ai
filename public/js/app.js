// ─────────────────────────────────────────────────────────────────
// Uygulama girişi: API durumunu kontrol eder, ekranları yönlendirir.
// ─────────────────────────────────────────────────────────────────
import { appState } from './router.js';
import { api } from './api.js';
import { ensureVoicesReady } from './speech.js';
import { getSettings } from './storage.js';

import * as home from './screens/home.js';
import * as setup from './screens/setup.js';
import * as talk from './screens/talk.js';
import * as analysis from './screens/analysis.js';
import * as history from './screens/history.js';
import * as vocab from './screens/vocab.js';
import * as settings from './screens/settings.js';

const screens = { home, setup, talk, analysis, history, vocab, settings };

const app = document.getElementById('app');

function render() {
  // Ekran değişirken bekleyen TTS'i durdur
  window.speechSynthesis?.cancel();

  const mod = screens[appState.screen] || home;
  app.innerHTML = '';

  // Ayarlar ekranı async (ses listesi bekliyor); diğerleri senkron
  Promise.resolve(mod.render(app, appState.params)).catch((e) => {
    console.error(e);
    app.innerHTML = `<div class="screen"><div class="empty-state">
      <div class="icon">😵</div><div>Ekran yüklenirken hata oluştu.</div>
      <div style="font-size:.8rem;color:var(--muted);margin-top:6px">${String(e.message || e)}</div>
    </div></div>`;
  });
}

window.addEventListener('route', render);

async function init() {
  appState.settings = getSettings();

  // API durumu (çevrimdışıysa da uygulama açılsın, uyarı gösterilsin)
  try {
    appState.status = await api.status();
  } catch {
    appState.status = { configured: false, model: '', offline: true };
  }

  // Ses listesi arka plada ısıtılır (ayalar ekranı ve sohbet için)
  ensureVoicesReady();

  render();
}

init();
