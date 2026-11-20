// ─────────────────────────────────────────────────────────────────
// Ekran: Seviye belirleme testi sonucu ve bahçeye geçiş
// ─────────────────────────────────────────────────────────────────
import { navigate } from '../router.js';
import { LANGUAGES, LEVELS, LEVEL_PREP, levelBand, recommendedFriend } from '../data.js';
import { getProfile } from '../storage.js';
import { el, icon, brand, escapeHtml } from '../ui.js';

export function render(root, params = {}) {
  const profile = getProfile();
  const langCode = params.lang || profile.active || 'en';
  const lang = LANGUAGES[langCode] || LANGUAGES.en;
  const level = params.level || profile.levels[langCode] || 'A2';
  const levelName = LEVELS[level] || 'Temel';
  const band = levelBand(level);
  const prepItems = (LEVEL_PREP[band] || LEVEL_PREP.mid).map((s) => s.replace('{L}', `${level} (${levelName})`));
  const rec = recommendedFriend(level);

  const scores = params.scores || { fluency: 62, vocab: 58, grammar: 60 };

  const screen = el(`
    <div class="screen no-tabs">
      <div class="topbar">
        ${brand()}
        <span class="pill">${lang.name}</span>
      </div>

      <h1 class="big">${profile.name ? `Harika gidiyorsun, ${escapeHtml(profile.name)}!` : 'Seviyen hazır!'}</h1>
      <p class="lead">Sohbetlerin tam sana uygun hızda ve zorlukta başlayacak.</p>

      <div class="level-card">
        <div class="level-circle">
          <b>${escapeHtml(level)}</b>
          <span>${escapeHtml(levelName.toUpperCase())}</span>
        </div>
        <div style="flex:1;padding-left:14px">
          <div class="cap">SENİN SEVİYEN</div>
          <h2 style="margin-top:4px;font-size:1.3rem">${lang.name}</h2>
          <p class="level-foot">${rec.name} seninle tanışmak için bahçede bekliyor.</p>
        </div>
        <img src="${rec.img}" alt="${rec.name}" />
      </div>

      <div class="section-title">Beceri dağılımın</div>
      <div class="bars">
        <div class="bar-row">
          <div class="top"><b>Akıcılık</b><span>%${scores.fluency}</span></div>
          <div class="bar"><i style="width:${scores.fluency}%"></i></div>
        </div>
        <div class="bar-row">
          <div class="top"><b>Kelime dağarcığı</b><span>%${scores.vocab}</span></div>
          <div class="bar"><i style="width:${scores.vocab}%"></i></div>
        </div>
        <div class="bar-row">
          <div class="top"><b>Dil bilgisi</b><span>%${scores.grammar}</span></div>
          <div class="bar"><i style="width:${scores.grammar}%"></i></div>
        </div>
      </div>

      <div class="prep">
        <h3>${icon('leaf', 20)} Senin için hazırladıklarımız</h3>
        ${prepItems.map((item) => `<p>• ${escapeHtml(item)}</p>`).join('')}
      </div>

      <div class="footer-cta">
        <button type="button" class="btn-primary" id="btn-garden">
          <span>Bahçeme git</span>
          ${icon('arrow', 20)}
        </button>
        <button type="button" class="tiny" id="btn-retake" style="margin-top:10px;display:inline-block">Testi tekrar çöz</button>
      </div>
    </div>
  `);

  screen.querySelector('#btn-garden').addEventListener('click', () => navigate('home'));
  screen.querySelector('#btn-retake').addEventListener('click', () => navigate('test', { lang: langCode }));

  root.appendChild(screen);
}
