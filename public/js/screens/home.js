// ─────────────────────────────────────────────────────────────────
// Ekran: Bahçem (ana sayfa) — aktif dil, karakterler, günün adımı, puanlar
// ─────────────────────────────────────────────────────────────────
import { appState, navigate } from '../router.js';
import { LANGUAGES, LEVELS, FRIENDS, FRIEND_ORDER, recommendedFriend, sceneFor } from '../data.js';
import { getProfile, updateProfile } from '../storage.js';
import { el, icon, tabBar, hillsSvg, openSheet, escapeHtml } from '../ui.js';

export function render(root) {
  const profile = getProfile();
  const activeCode = profile.active && LANGUAGES[profile.active] ? profile.active : (profile.languages[0] || 'en');
  const lang = LANGUAGES[activeCode] || LANGUAGES.en;
  const level = profile.levels[activeCode] || 'A2';
  const recFriend = recommendedFriend(level);
  const scene = sceneFor(recFriend, level);

  const screen = el(`
    <div class="screen">
      <div class="topbar">
        <button type="button" class="lang-chip" id="btn-lang">
          <b>${lang.name} · ${level}</b>
          <span>${LEVELS[level] || ''} ▾</span>
        </button>
        <div class="pill star">
          ${icon('star', 18, 2.2)}
          <span>${profile.points}</span>
        </div>
      </div>

      <h1 class="big">${profile.name ? `Merhaba, ${escapeHtml(profile.name)}` : 'Bahçene hoş geldin'}</h1>
      <p class="lead">Bugün kiminle küçük bir sohbet etmek istersin?</p>

      <div class="scene">
        ${hillsSvg()}
        <div class="bubble">Bugün 5 dakika konuşalım mı?</div>
        <div class="chars">
          ${FRIEND_ORDER.map((fid) => {
            const f = FRIENDS[fid];
            return `
              <div data-char="${f.id}" style="cursor:pointer">
                <img src="${f.img}" alt="${f.name}" style="height:${f.id === recFriend.id ? '96px' : '84px'}" />
                <span class="name-pill">${f.name}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="go">
          <button type="button" class="btn-primary" id="btn-quick-chat">
            <span>${recFriend.name} ile konuşmaya başla</span>
            ${icon('arrow', 20)}
          </button>
        </div>
      </div>

      ${appState.dailyEarned ? `
        <div class="points-card">
          <div class="ico">${icon('gift', 26)}</div>
          <div>
            <b>Günlük giriş ödülü: +${appState.dailyEarned.earned} puan!</b>
            <p>${appState.dailyEarned.streak} günlük serin devam ediyor. Konuştukça puan kazanırsın.</p>
          </div>
        </div>
      ` : ''}

      <div class="section-title">Bugünün önerilen adımı</div>
      <button type="button" class="step-card" id="btn-step">
        <div class="grow">
          <span class="chip">${escapeHtml(scene.step.tag)} · ${recFriend.name}</span>
          <b style="margin-top:8px">${escapeHtml(scene.step.title)}</b>
          <p>${escapeHtml(scene.step.text)}</p>
        </div>
        <div class="btn-soft">${icon('arrow', 18)}</div>
      </button>
    </div>
  `);

  // Dil değiştirme alt sayfası
  screen.querySelector('#btn-lang').addEventListener('click', () => {
    const userLangs = profile.languages.length ? profile.languages : [activeCode];
    const sheetBox = el(`
      <div>
        <h2>Çalıştığın dil</h2>
        <p class="sub">Diller arasında geçiş yap veya yeni bir dil ekle.</p>
        ${userLangs.map((c) => {
          const l = LANGUAGES[c];
          const lv = profile.levels[c] || 'Belirlenmedi';
          return `
            <button type="button" class="opt" data-pick="${c}">
              <div class="lang-badge" style="background:${l.badge};width:44px;height:44px">${l.code}</div>
              <div class="grow">
                <b>${l.name}</b>
                <small>Seviye: ${lv}</small>
              </div>
              ${c === activeCode ? `<span class="chip">Aktif</span>` : ''}
            </button>
          `;
        }).join('')}
        <button type="button" class="btn-primary" id="btn-add-lang" style="margin-top:8px">+ Yeni dil ekle</button>
      </div>
    `);

    const { close } = openSheet(sheetBox);
    sheetBox.querySelectorAll('[data-pick]').forEach((b) => {
      b.addEventListener('click', () => {
        const picked = b.dataset.pick;
        close();
        if (!profile.levels[picked]) {
          navigate('test', { lang: picked });
        } else {
          updateProfile((p) => { p.active = picked; });
          navigate('home');
        }
      });
    });

    sheetBox.querySelector('#btn-add-lang').addEventListener('click', () => {
      close();
      navigate('languages', { add: true });
    });
  });

  // Karakterlere tıklayınca doğrudan sohbete geç
  screen.querySelectorAll('[data-char]').forEach((box) => {
    box.addEventListener('click', () => {
      navigate('chat', { friendId: box.dataset.char });
    });
  });

  const startRecChat = () => navigate('chat', { friendId: recFriend.id });
  screen.querySelector('#btn-quick-chat').addEventListener('click', startRecChat);
  screen.querySelector('#btn-step').addEventListener('click', startRecChat);

  root.appendChild(screen);
  root.appendChild(tabBar('home'));
}
