// ─────────────────────────────────────────────────────────────────
// Seans kurulum ekranı: mod, senaryo/konu, zorluk, düzeltme modu
// ─────────────────────────────────────────────────────────────────
import { el, escapeHtml } from '../ui.js';
import { navigate, appState } from '../router.js';
import { screenHeader, topbar } from './parts.js';
import { LANGUAGES, LEVELS, MODES, SCENARIOS, getSettings, setLevel } from '../storage.js';
import { sttSupported } from '../speech.js';

export function render(root, params) {
  const lang = params.lang;
  const info = LANGUAGES[lang];
  const settings = getSettings();

  // Form durumu
  const form = {
    lang,
    level: settings.levels[lang],
    mode: 'daily',
    scenario: 'restaurant',
    topic: '',
    difficulty: settings.defaultDifficulty,
    correctionMode: settings.defaultCorrectionMode,
    voiceURI: settings.voices[lang] || null,
  };

  root.appendChild(topbar('home'));

  const screen = el(`
    <div class="screen">
      <div id="setup-header"></div>
      <div class="card" style="margin-bottom:18px">
        <div class="field"><label>Dil seviyem</label><div id="level-row" class="segmented"></div></div>
        <div class="field" style="margin-bottom:0"><label>Konuşma modu</label><div class="mode-grid" id="mode-grid"></div></div>
        <div id="extra-area"></div>
      </div>
      <div class="card" style="margin-bottom:22px">
        <div class="field"><label>Zorluk seviyesi</label><div id="diff-row" class="segmented"></div>
          <div class="sub" style="font-size:.8rem;color:var(--muted);margin-top:6px">Kolay: yavaş ve basit · Orta: doğal ama açık · Zor: doğal hız, karmaşık ifadeler</div></div>
        <div class="field" style="margin-bottom:0"><label>Hata düzeltme</label><div id="corr-row" class="segmented"></div>
          <div class="sub" style="font-size:.8rem;color:var(--muted);margin-top:6px">Anlık: mesajının altında sessizce gösterilir, okunmaz · Seans sonu: hepsi sonda listelenir</div></div>
      </div>
      <button class="btn primary" id="start-btn" style="width:100%;padding:16px">🎙️ Konuşmayı Başlat</button>
    </div>`);

  screen.querySelector('#setup-header').appendChild(
    screenHeader(`${info.flag} ${info.name}`, `Seviye ${form.level} · Pratik seansı hazırla`, 'home')
  );

  // ── Seviye seçimi ──
  const levelRow = screen.querySelector('#level-row');
  LEVELS.forEach((lv) => {
    const b = el(`<button class="${form.level === lv ? 'active' : ''}">${lv}</button>`);
    b.addEventListener('click', () => {
      form.level = lv;
      setLevel(lang, lv);
      levelRow.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      screen.querySelector('#setup-header h1').textContent = `${info.flag} ${info.name}`;
      screen.querySelector('#setup-header .sub').textContent = `Seviye ${lv} · Pratik seansı hazırla`;
    });
    levelRow.appendChild(b);
  });

  // ── Mod seçimi ──
  const modeGrid = screen.querySelector('#mode-grid');
  const extraArea = screen.querySelector('#extra-area');

  const renderExtra = () => {
    extraArea.innerHTML = '';
    if (form.mode === 'roleplay') {
      const wrap = el(`
        <div class="field" style="margin-top:18px;margin-bottom:0"><label>Senaryo</label><div class="chip-row" id="scn-row"></div></div>`);
      const row = wrap.querySelector('#scn-row');
      Object.entries(SCENARIOS).forEach(([key, s]) => {
        const c = el(`<button class="chip ${form.scenario === key ? 'active' : ''}">${s.icon} ${s.label}</button>`);
        c.addEventListener('click', () => {
          form.scenario = key;
          row.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
          c.classList.add('active');
        });
        row.appendChild(c);
      });
      extraArea.appendChild(wrap);
    } else if (form.mode === 'debate') {
      extraArea.appendChild(el(`
        <div class="field" style="margin-top:18px;margin-bottom:0">
          <label>Tartışma konusu (isteğe bağlı)</label>
          <input type="text" id="topic-input" placeholder="Örn: sosyal medya iyi mi kötü mü?" value="${escapeHtml(form.topic)}" />
        </div>`));
      extraArea.querySelector('#topic-input').addEventListener('input', (e) => { form.topic = e.target.value; });
    }
  };

  Object.entries(MODES).forEach(([key, m]) => {
    const c = el(`
      <button class="mode-card ${form.mode === key ? 'active' : ''}">
        <div class="icon">${m.icon}</div><h3>${m.label}</h3><p>${m.desc}</p>
      </button>`);
    c.addEventListener('click', () => {
      form.mode = key;
      modeGrid.querySelectorAll('.mode-card').forEach((x) => x.classList.remove('active'));
      c.classList.add('active');
      renderExtra();
    });
    modeGrid.appendChild(c);
  });
  renderExtra();

  // ── Zorluk ──
  const diffRow = screen.querySelector('#diff-row');
  [['easy', 'Kolay'], ['medium', 'Orta'], ['hard', 'Zor']].forEach(([key, label]) => {
    const b = el(`<button class="${form.difficulty === key ? 'active' : ''}">${label}</button>`);
    b.addEventListener('click', () => {
      form.difficulty = key;
      diffRow.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    diffRow.appendChild(b);
  });

  // ── Düzeltme modu ──
  const corrRow = screen.querySelector('#corr-row');
  [['instant', 'Anlık düzeltme'], ['end', 'Seans sonunda toplu']].forEach(([key, label]) => {
    const b = el(`<button class="${form.correctionMode === key ? 'active' : ''}">${label}</button>`);
    b.addEventListener('click', () => {
      form.correctionMode = key;
      corrRow.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    corrRow.appendChild(b);
  });

  // ── Başlat ──
  const startBtn = screen.querySelector('#start-btn');
  if (!appState.status.configured || !sttSupported) {
    startBtn.disabled = true;
    startBtn.textContent = '⚠️ Yapılandırma eksik — yukarıdaki uyarıya bakın';
  }
  startBtn.addEventListener('click', () => navigate('talk', { config: { ...form } }));

  root.appendChild(screen);
}
