// ─────────────────────────────────────────────────────────────────
// Ekran: Arkadaşlar — konuşma partneri ve sahne seçimi
// ─────────────────────────────────────────────────────────────────
import { navigate } from '../router.js';
import { LANGUAGES, FRIENDS, FRIEND_ORDER, recommendedFriend, sceneFor } from '../data.js';
import { getProfile } from '../storage.js';
import { el, icon, tabBar, escapeHtml } from '../ui.js';

export function render(root) {
  const profile = getProfile();
  const activeCode = profile.active || profile.languages[0] || 'en';
  const lang = LANGUAGES[activeCode] || LANGUAGES.en;
  const level = profile.levels[activeCode] || 'A2';
  const rec = recommendedFriend(level);

  let filter = 'all';

  const screen = el(`<div class="screen"></div>`);
  root.appendChild(screen);
  root.appendChild(tabBar('friends'));

  function draw() {
    const list = FRIEND_ORDER.filter((id) => filter === 'all' || id === filter);

    screen.innerHTML = `
      <div class="topbar">
        <div class="title" style="text-align:left;font-size:1.4rem">Arkadaşlar</div>
        <span class="pill">${lang.name} · ${level}</span>
      </div>
      <p class="lead">Her arkadaşın farklı bir temposu ve sohbet konusu var. Birini seç ve konuşmaya başla.</p>

      <div class="filters">
        <button type="button" class="chip big ${filter === 'all' ? '' : 'light'}" data-f="all">Tümü</button>
        ${FRIEND_ORDER.map((id) => `
          <button type="button" class="chip big ${filter === id ? '' : 'light'}" data-f="${id}">${FRIENDS[id].name}</button>
        `).join('')}
      </div>

      <div id="friends-cards">
        ${list.map((id) => {
          const f = FRIENDS[id];
          const sc = sceneFor(f, level);
          return `
            <div class="friend ${f.cls}">
              <div class="nm">
                <h2>${f.name}</h2>
                ${f.id === rec.id ? '<span class="badge">Sana önerilen</span>' : ''}
              </div>
              <div class="tag">${escapeHtml(f.tag)}</div>
              <div class="topics">${escapeHtml(f.topics)} · Sahne: ${escapeHtml(sc.label)}</div>
              <button type="button" class="talk" data-talk="${f.id}">
                <span>${escapeHtml(sc.step.title)}</span>
                ${icon('arrow', 18)}
              </button>
              <img src="${f.img}" alt="${f.name}" />
            </div>
          `;
        }).join('')}
      </div>
    `;

    screen.querySelectorAll('[data-f]').forEach((b) => {
      b.addEventListener('click', () => {
        filter = b.dataset.f;
        draw();
      });
    });

    screen.querySelectorAll('[data-talk]').forEach((b) => {
      b.addEventListener('click', () => {
        navigate('chat', { friendId: b.dataset.talk });
      });
    });
  }

  draw();
}
