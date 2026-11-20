// ─────────────────────────────────────────────────────────────────
// Ekran: Dil ve isim seçimi (ilk kurulum + yeni dil ekleme)
// ─────────────────────────────────────────────────────────────────
import { navigate } from '../router.js';
import { LANGUAGES, LANG_ORDER } from '../data.js';
import { getProfile, updateProfile } from '../storage.js';
import { el, icon, brand, escapeHtml, toast } from '../ui.js';

export function render(root, params = {}) {
  const profile = getProfile();
  const isAdding = Boolean(params.add && profile.onboarded);
  let selected = new Set(profile.languages.length ? profile.languages : ['en']);
  let name = profile.name || '';

  const screen = el(`
    <div class="screen no-tabs">
      <div class="topbar">
        ${isAdding ? `<button class="back-btn" id="btn-back" aria-label="Geri">${icon('back')}</button>` : brand()}
        ${isAdding ? '<div class="title">Yeni dil ekle</div><div style="width:44px"></div>' : '<span class="pill">Adım 1 / 2</span>'}
      </div>

      <div class="hero-row">
        <div>
          <h1 class="big">${isAdding ? 'Hangi dili öğrenmek istersin?' : 'Hangi dilleri konuşmak istersin?'}</h1>
          <p class="lead">Birden fazla dil seçebilirsin; istediğin zaman aralarında geçiş yapabilirsin.</p>
        </div>
        <img src="assets/mia.png" alt="Mia" />
      </div>

      ${!isAdding ? `
        <div class="name-field">
          <label for="inp-name">Sana nasıl seslenelim?</label>
          <input id="inp-name" type="text" placeholder="Adın (isteğe bağlı)" value="${escapeHtml(name)}" maxlength="30" />
        </div>
      ` : ''}

      <div class="lang-list" id="lang-list"></div>

      <div class="info-box">
        <div style="color:var(--blue-deep);flex:none;margin-top:2px">${icon('bulb', 22)}</div>
        <div>
          <b>Kısa bir seviye sohbeti</b>
          Seçtiğin ilk dil için Mia sana 4 kısa soru soracak ve sana en uygun başlangıç noktasını belirleyecek.
        </div>
      </div>

      <div class="footer-cta">
        <button class="btn-primary" id="btn-next">
          <span>Devam et</span>
          ${icon('arrow', 20)}
        </button>
        <div class="tiny">Dilediğin zaman yeni dil ekleyebilir veya seviyeni yenileyebilirsin.</div>
      </div>
    </div>
  `);

  const list = screen.querySelector('#lang-list');
  const nextBtn = screen.querySelector('#btn-next');
  const nameInp = screen.querySelector('#inp-name');

  function drawList() {
    list.innerHTML = LANG_ORDER.map((code) => {
      const l = LANGUAGES[code];
      const on = selected.has(code);
      const lvl = profile.levels[code];
      return `
        <button type="button" class="lang-card ${on ? 'on' : ''}" data-lang="${code}">
          <div class="lang-badge" style="background:${l.badge}">${l.code}</div>
          <div class="grow">
            <div class="name">${l.name}</div>
            <div class="sub">${l.native}${lvl ? ` · Mevcut seviye: ${lvl}` : ''}</div>
          </div>
          <div class="check">${icon('check', 16, 2.6)}</div>
        </button>
      `;
    }).join('');

    list.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.lang;
        if (selected.has(c)) {
          if (selected.size === 1) {
            toast('En az bir dil seçili kalmalıdır.');
            return;
          }
          selected.delete(c);
        } else {
          selected.add(c);
        }
        drawList();
      });
    });

    nextBtn.disabled = selected.size === 0;
  }

  drawList();

  if (isAdding) {
    screen.querySelector('#btn-back')?.addEventListener('click', () => navigate('home'));
  }

  nextBtn.addEventListener('click', () => {
    const chosen = LANG_ORDER.filter((c) => selected.has(c));
    if (!chosen.length) return;

    const cleanName = nameInp ? nameInp.value.trim() : profile.name;
    // Seviyesi henüz belirlenmemiş ilk dili teste al; hepsi belirlenmişse yeni seçileni al
    const targetLang = chosen.find((c) => !profile.levels[c]) || (params.lang && chosen.includes(params.lang) ? params.lang : chosen[0]);

    updateProfile((p) => {
      p.name = cleanName;
      p.languages = chosen;
      if (!p.active || !chosen.includes(p.active)) p.active = targetLang;
    });

    navigate('test', { lang: targetLang });
  });

  root.appendChild(screen);
}
