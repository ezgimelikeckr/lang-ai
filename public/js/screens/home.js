// ─────────────────────────────────────────────────────────────────
// Ana ekran: üç dil kartı + durum
// ─────────────────────────────────────────────────────────────────
import { el, icon } from '../ui.js';
import { navigate } from '../router.js';
import { topbar, statusBanners } from './parts.js';
import { LANGUAGES, getSettings, getLanguageStats, formatDuration } from '../storage.js';

const ACCENTS = { en: ['var(--en)', 'var(--en-soft)'], fr: ['var(--fr)', 'var(--fr-soft)'], es: ['var(--es)', 'var(--es-soft)'] };

export function render(root) {
  const settings = getSettings();
  root.appendChild(topbar('home'));
  root.appendChild(statusBanners());

  const screen = el('<div class="screen"><div class="lang-grid"></div></div>');
  const grid = screen.querySelector('.lang-grid');

  Object.entries(LANGUAGES).forEach(([code, info]) => {
    const stats = getLanguageStats(code);
    const [accent, accentSoft] = ACCENTS[code];
    const card = el(`
      <button class="lang-card" data-lang="${code}" style="--accent:${accent};--accent-soft:${accentSoft}">
        <div class="flag">${info.flag}</div>
        <h2>${info.name}</h2>
        <span class="level-badge">Seviye ${settings.levels[code]}</span>
        <div class="stats">
          <div><b>${stats.count}</b>seans</div>
          <div><b>${formatDuration(stats.totalSec)}</b>konuşma</div>
          <div><b>${stats.totalWords}</b>kelime</div>
        </div>
        <span class="go">Konuşmaya başla →</span>
      </button>`);
    card.addEventListener('click', () => navigate('setup', { lang: code }));
    grid.appendChild(card);
  });

  root.appendChild(screen);
}
