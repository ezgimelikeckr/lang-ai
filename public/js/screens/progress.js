// ─────────────────────────────────────────────────────────────────
// Ekran: Gelişim — puanlar, seri, dil seviyeleri ve sohbet geçmişi
// ─────────────────────────────────────────────────────────────────
import { navigate } from '../router.js';
import { LANGUAGES, LEVELS } from '../data.js';
import { getProfile } from '../storage.js';
import { el, icon, tabBar, escapeHtml } from '../ui.js';

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function render(root) {
  const profile = getProfile();
  const userLangs = profile.languages.length ? profile.languages : ['en'];
  const totalSessions = profile.sessions.length;

  const screen = el(`
    <div class="screen">
      <div class="topbar">
        <div class="title" style="text-align:left;font-size:1.4rem">Gelişim</div>
        <button type="button" class="btn-soft" id="btn-langs">Dillerim</button>
      </div>
      <p class="lead">Düzenli küçük sohbetler zamanla büyük özgüven kazandırır.</p>

      <div class="stats">
        <div class="stat">
          <b>${profile.points}</b>
          <span>Toplam puan</span>
        </div>
        <div class="stat">
          <b>${profile.streak} gün</b>
          <span>Günlük seri</span>
        </div>
        <div class="stat">
          <b>${totalSessions}</b>
          <span>Sohbet</span>
        </div>
      </div>

      <div class="section-title">Dil seviyelerin</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${userLangs.map((code) => {
          const l = LANGUAGES[code];
          if (!l) return '';
          const lv = profile.levels[code];
          return `
            <div class="card" style="display:flex;align-items:center;gap:12px">
              <div class="lang-badge" style="background:${l.badge};width:46px;height:46px">${l.code}</div>
              <div style="flex:1">
                <b>${l.name}</b>
                <div class="tiny">${lv ? `${lv} · ${LEVELS[lv] || ''}` : 'Henüz seviye belirlenmedi'}</div>
              </div>
              <button type="button" class="btn-soft" data-retest="${code}">
                ${lv ? 'Testi yenile' : 'Teste başla'}
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <div class="section-title">Son sohbetlerin</div>
      ${totalSessions === 0 ? `
        <div class="card empty">
          Henüz tamamlanmış bir sohbetin yok.<br>
          <button type="button" class="btn-soft" id="btn-start-first" style="margin-top:12px">İlk sohbetine başla</button>
        </div>
      ` : `
        <div>
          ${profile.sessions.map((s) => {
            const l = LANGUAGES[s.lang] || LANGUAGES.en;
            return `
              <div class="hist">
                <div class="t">
                  <span>${escapeHtml(s.friendName)} · ${escapeHtml(s.sceneTitle || 'Sohbet')}</span>
                  <span style="color:var(--green)">+${s.points || 10} puan</span>
                </div>
                <div class="d" style="margin-top:4px">
                  ${l.name} (${s.level}) · ${s.turns || 0} tur · ${s.words || 0} kelime · ${formatDate(s.date)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `);

  screen.querySelector('#btn-langs').addEventListener('click', () => navigate('languages', { add: true }));
  screen.querySelector('#btn-start-first')?.addEventListener('click', () => navigate('friends'));

  screen.querySelectorAll('[data-retest]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate('test', { lang: btn.dataset.retest });
    });
  });

  root.appendChild(screen);
  root.appendChild(tabBar('progress'));
}
