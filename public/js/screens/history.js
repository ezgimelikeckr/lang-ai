// ─────────────────────────────────────────────────────────────────
// Geçmiş ekranı: dil bazlı seans listesi
// ─────────────────────────────────────────────────────────────────
import { el, icon, escapeHtml, toast, modal } from '../ui.js';
import { navigate } from '../router.js';
import { screenHeader, topbar } from './parts.js';
import { LANGUAGES, MODES, SCENARIOS, getSessions, deleteSession, formatDuration } from '../storage.js';

export function render(root, params) {
  const activeLang = params.lang || 'en';

  root.appendChild(topbar('history'));

  const screen = el(`
    <div class="screen">
      <div id="hi-header"></div>
      <div class="tab-row" id="lang-tabs"></div>
      <div id="list"></div>
    </div>`);

  screen.querySelector('#hi-header').appendChild(
    screenHeader('🕘 Konuşma Geçmişi', 'Gelişimini seanlar üzerinden takip et', null)
  );

  const tabs = screen.querySelector('#lang-tabs');
  Object.entries(LANGUAGES).forEach(([code, info]) => {
    const t = el(`<button class="chip ${code === activeLang ? 'active' : ''}">${info.flag} ${info.name}</button>`);
    t.addEventListener('click', () => navigate('history', { lang: code }));
    tabs.appendChild(t);
  });

  const list = screen.querySelector('#list');
  const sessions = getSessions(activeLang);

  if (!sessions.length) {
    list.appendChild(el(`
      <div class="empty-state">
        <div class="icon">🗺️</div>
        <div>Bu dilde henüz kayıtlı seans yok.</div>
        <button class="btn primary small mt" id="go-talk">İlk sohbeti başlat</button>
      </div>`));
    list.querySelector('#go-talk').addEventListener('click', () => navigate('setup', { lang: activeLang }));
  } else {
    sessions.forEach((s) => {
      const item = el(`
        <button class="history-item">
          <span class="emoji">${MODES[s.mode]?.icon || '💬'}</span>
          <span class="meta">
            <span class="t">${MODES[s.mode]?.label || s.mode}${s.scenario ? ` · ${SCENARIOS[s.scenario]?.label || ''}` : ''}${s.topic ? ` · ${escapeHtml(s.topic)}` : ''}</span>
            <span class="d">${new Date(s.date).toLocaleString('tr-TR')} · Seviye ${s.level}</span>
          </span>
          <span class="nums">
            <span><b>${formatDuration(s.durationSec)}</b>süre</span>
            <span><b>${s.userWords || 0}</b>kelime</span>
            <span><b>${s.corrections?.length || 0}</b>düzeltme</span>
          </span>
        </button>`);

      // Tıkla → detay. Uzun basma/sil butonu yerine yan küçük buton:
      const del = el(`<span class="icon-btn" title="Seansı sil">${icon('trash')}</span>`);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        modal({
          title: 'Seansı sil?',
          sub: 'Bu işlem geri alınamaz.',
          actions: [
            { label: 'Vazgeç', class: 'ghost' },
            { label: 'Sil', class: 'danger', onClick: () => { deleteSession(activeLang, s.id); toast('Seans silindi.'); navigate('history', { lang: activeLang }); } },
          ],
        });
      });
      item.appendChild(del);
      item.addEventListener('click', () => navigate('analysis', { session: s, live: false }));
      list.appendChild(item);
    });
  }

  root.appendChild(screen);
}
