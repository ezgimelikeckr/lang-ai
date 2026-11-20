// ─────────────────────────────────────────────────────────────────
// Uygulama girişi: profil + günlük puan + ekran yönlendirme
// ─────────────────────────────────────────────────────────────────
import { appState, navigate } from './router.js';
import { api } from './api.js';
import { ensureVoicesReady, stopSpeaking } from './speech.js';
import { getProfile, claimDailyPoints } from './storage.js';
import { escapeHtml } from './ui.js';

import * as languages from './screens/languages.js';
import * as test from './screens/test.js';
import * as result from './screens/result.js';
import * as home from './screens/home.js';
import * as friends from './screens/friends.js';
import * as chat from './screens/chat.js';

const screens = { languages, test, result, home, friends, chat};
const app = document.getElementById('app');

function render() {
  stopSpeaking(); // ekran değişirken bekleyen seslendirmeyi kes
  const mod = screens[appState.screen] || home;
  app.innerHTML = '';
  Promise.resolve(mod.render(app, appState.params)).catch((e) => {
    console.error(e);
    app.innerHTML = `<div class="screen no-tabs"><p class="empty">Ekran yüklenirken hata oluştu.<br><small>${escapeHtml(e.message || e)}</small></p></div>`;
  });
}

window.addEventListener('route', render);

async function init() {
  try {
    appState.status = await api.status();
  } catch {
    appState.status = { configured: false, offline: true };
  }
  ensureVoicesReady();

  const profile = getProfile();
  if (profile.onboarded) appState.dailyEarned = claimDailyPoints();

  const params = profile.onboarded ? {} : {};
  navigate(profile.onboarded ? 'home' : 'languages', params);
}

init();
