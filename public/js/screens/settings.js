// ─────────────────────────────────────────────────────────────────
// Ayarlar: dil seviyeleri, varsayılanlar, ses kontrolü (dil başına
// yüklü sesler + test), tarayıcı/API durumu
// ─────────────────────────────────────────────────────────────────
import { el, icon, escapeHtml, toast } from '../ui.js';
import { appState } from '../router.js';
import { screenHeader, topbar } from './parts.js';
import { LANGUAGES, LEVELS, getSettings, updateSettings, setLevel, setVoice } from '../storage.js';
import { ensureVoicesReady, getVoicesForLang, speak, sttSupported, ttsSupported } from '../speech.js';

export async function render(root) {
  const settings = getSettings();

  root.appendChild(topbar('settings'));

  const screen = el(`
    <div class="screen">
      <div id="st-header"></div>

      <div class="settings-grid">
        <div class="card">
          <h3 style="font-size:1rem;margin-bottom:6px">🎓 Dil seviyeleri</h3>
          <div id="level-rows"></div>
        </div>

        <div class="card">
          <h3 style="font-size:1rem;margin-bottom:6px">⚙️ Varsayılanlar</h3>
          <div class="setting-row">
            <div><div class="label">Zorluk</div><div class="desc">Yeni seanslarda başlangıç değeri</div></div>
            <select id="def-diff">
              <option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option>
            </select>
          </div>
          <div class="setting-row">
            <div><div class="label">Hata düzeltme</div><div class="desc">Yeni seanslarda başlangıç değeri</div></div>
            <select id="def-corr">
              <option value="instant">Anlık</option><option value="end">Seans sonu</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card mt" style="margin-bottom:20px">
        <h3 style="font-size:1rem;margin-bottom:4px">🔊 Ses desteği kontrolü</h3>
        <div style="font-size:.85rem;color:var(--text-soft);margin-bottom:14px">
          Her dil için tarayıcında yüklü seslendirme sesleri. Ses yoksa: Windows <b>Ayarlar → Saat ve dil → Dil ve bölge</b> bölümünden o dilin konuşma paketini ekleyebilirsin. Mikrofon tanıma (STT) Chrome/Edge tarafından çevrimiçi sağlanır.
        </div>
        <div id="voice-check"></div>
      </div>

      <div class="card">
        <h3 style="font-size:1rem;margin-bottom:6px">🩺 Sistem durumu</h3>
        <div class="setting-row">
          <div><div class="label">Mikrofonla konuşma tanıma</div><div class="desc">Chrome veya Edge gerektirir</div></div>
          <div>${sttSupported ? '<span style="color:var(--success);font-weight:700">✓ Destekleniyor</span>' : '<span style="color:var(--danger);font-weight:700">✗ Desteklenmiyor</span>'}</div>
        </div>
        <div class="setting-row">
          <div><div class="label">Sesli okuma (TTS)</div></div>
          <div>${ttsSupported ? '<span style="color:var(--success);font-weight:700">✓ Destekleniyor</span>' : '<span style="color:var(--danger);font-weight:700">✗ Desteklenmiyor</span>'}</div>
        </div>
        <div class="setting-row">
          <div><div class="label">Yapay zekâ (LLM)</div><div class="desc">${escapeHtml(appState.status.model || '—')}</div></div>
          <div>${appState.status.configured
            ? '<span style="color:var(--success);font-weight:700">✓ Bağlı</span>'
            : '<span style="color:var(--danger);font-weight:700">✗ Anahtar eksik</span>'}</div>
        </div>
      </div>
    </div>`);

  screen.querySelector('#st-header').appendChild(
    screenHeader('⚙️ Ayarlar', 'Seviyeler, sesler ve sistem durumu', null)
  );

  // ── Seviye satırları ──
  const levelRows = screen.querySelector('#level-rows');
  Object.entries(LANGUAGES).forEach(([code, info]) => {
    const row = el(`
      <div class="setting-row">
        <div class="label">${info.flag} ${info.name}</div>
        <select data-lang="${code}">${LEVELS.map((l) => `<option value="${l}" ${settings.levels[code] === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>`);
    row.querySelector('select').addEventListener('change', (e) => {
      setLevel(code, e.target.value);
      toast(`${info.name} seviyesi ${e.target.value} olarak kaydedildi.`, 'ok');
    });
    levelRows.appendChild(row);
  });

  // ── Varsayılanlar ──
  const defDiff = screen.querySelector('#def-diff');
  defDiff.value = settings.defaultDifficulty;
  defDiff.addEventListener('change', () => updateSettings({ defaultDifficulty: defDiff.value }));

  const defCorr = screen.querySelector('#def-corr');
  defCorr.value = settings.defaultCorrectionMode;
  defCorr.addEventListener('change', () => updateSettings({ defaultCorrectionMode: defCorr.value }));

  root.appendChild(screen);

  // ── Ses kontrolü (sesler asenkron yüklenir) ──
  const voiceCheck = screen.querySelector('#voice-check');
  voiceCheck.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  await ensureVoicesReady();

  voiceCheck.innerHTML = '';
  Object.entries(LANGUAGES).forEach(([code, info]) => {
    const voices = getVoicesForLang(code);
    const box = el(`
      <div style="padding:10px 0;border-bottom:1px dashed var(--border)">
        <div class="row" style="justify-content:space-between">
          <div class="label" style="font-weight:700;font-size:.92rem">${info.flag} ${info.name} <span style="color:var(--muted);font-weight:400;font-size:.82rem">(${info.ttsLang})</span></div>
          <div class="row">
            <select id="voice-${code}" style="padding:7px 10px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface);font-size:.82rem;max-width:250px"></select>
            <button class="btn ghost small" id="test-${code}">🔊 Test</button>
          </div>
        </div>
        <div style="font-size:.8rem;margin-top:5px;${voices.length ? 'color:var(--muted)' : 'color:var(--danger);font-weight:600'}">
          ${voices.length ? `${voices.length} ses bulundu` : '⚠ Ses bulunamadı — bu dil sesli okunamayacak. Windows dil paketini ekleyin.'}
        </div>
      </div>`);

    const sel = box.querySelector(`#voice-${code}`);
    if (voices.length) {
      voices.forEach((v) => {
        const o = el(`<option value="${escapeHtml(v.voiceURI)}" ${settings.voices[code] === v.voiceURI ? 'selected' : ''}>${escapeHtml(v.name)}</option>`);
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => setVoice(code, sel.value));
      box.querySelector(`#test-${code}`).addEventListener('click', () => {
        speak(info.sample, info.ttsLang, { rate: 0.9, voiceURI: sel.value });
      });
    } else {
      sel.disabled = true;
      sel.appendChild(el('<option>Ses yok</option>'));
      box.querySelector(`#test-${code}`).disabled = true;
    }

    voiceCheck.appendChild(box);
  });
}
