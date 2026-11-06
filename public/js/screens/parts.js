// ─────────────────────────────────────────────────────────────────
// Ekranların paylaştığı parçalar: üst çubuk, uyarı bantları,
// ekran başlığı.
// ─────────────────────────────────────────────────────────────────
import { el, icon } from '../ui.js';
import { navigate, appState } from '../router.js';
import { sttSupported, ttsSupported } from '../speech.js';

export function topbar(active) {
  const bar = el(`
    <header class="topbar">
      <div class="brand">
        <div class="logo">🗣️</div>
        <span class="title-text">Konuşma Pratiği</span>
      </div>
      <nav></nav>
    </header>`);

  const items = [
    { key: 'vocab', icon: 'book', label: 'Defter', title: 'Kelime Defteri' },
    { key: 'history', icon: 'history', label: 'Geçmiş', title: 'Konuşma Geçmişi' },
    { key: 'settings', icon: 'settings', label: 'Ayarlar', title: 'Ayarlar' },
  ];
  const nav = bar.querySelector('nav');
  items.forEach((it) => {
    const b = el(
      `<button class="nav-btn ${active === it.key ? 'active' : ''}" title="${it.title}">` +
      `${icon(it.icon)}<span class="nav-label">${it.label}</span></button>`
    );
    b.addEventListener('click', () => navigate(it.key));
    nav.appendChild(b);
  });

  bar.querySelector('.brand').addEventListener('click', () => navigate('home'));
  bar.querySelector('.brand').style.cursor = 'pointer';
  return bar;
}

/** API + tarayıcı destek uyarıları (yalnız eksikse göster). */
export function statusBanners() {
  const wrap = el('<div></div>');
  const { status } = appState;

  if (!status.configured) {
    wrap.appendChild(el(`
      <div class="banner error">⚠️ <div><b>API anahtarı eksik.</b> Yapay zekâ sohbeti çalışmaz.
      Proje klasöründeki <code>.env</code> dosyasını açın, <code>LLM_API_KEY=</code> satırına OpenRouter anahtarınızı yazın ve sunucuyu yeniden başlatın. <code>.env.example</code> dosyasında örnek var.</div></div>`));
  }

  if (!sttSupported) {
    wrap.appendChild(el(`
      <div class="banner warn">🎙️ <div><b>Bu tarayıcı mikrofonla konuşma tanımayı desteklemiyor.</b>
      Google Chrome veya Microsoft Edge kullanın (uygulama <code>http://localhost</code> üzerinden açılmalı).</div></div>`));
  }

  if (!ttsSupported) {
    wrap.appendChild(el(`
      <div class="banner warn">🔊 <div><b>Bu tarayıcı sesli okumayı desteklemiyor.</b> Chrome veya Edge kullanın.</div></div>`));
  }

  return wrap;
}

export function screenHeader(title, sub, backTo) {
  const h = el(`
    <div class="screen-header">
      ${backTo ? `<button class="back-btn" title="Geri">${icon('back')}</button>` : ''}
      <div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    </div>`);
  if (backTo) {
    h.querySelector('.back-btn').addEventListener('click', () => navigate(backTo));
  }
  return h;
}
