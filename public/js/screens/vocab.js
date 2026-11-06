// ─────────────────────────────────────────────────────────────────
// Kelime defteri: dil bazlı kelime/ifade koleksiyonu
// ─────────────────────────────────────────────────────────────────
import { el, icon, escapeHtml, toast } from '../ui.js';
import { navigate } from '../router.js';
import { screenHeader, topbar } from './parts.js';
import { LANGUAGES, getVocab, addVocab, deleteVocab } from '../storage.js';
import { speak } from '../speech.js';

export function render(root, params) {
  const activeLang = params.lang || 'en';
  const info = LANGUAGES[activeLang];

  root.appendChild(topbar('vocab'));

  const screen = el(`
    <div class="screen">
      <div id="vb-header"></div>
      <div class="tab-row" id="lang-tabs"></div>

      <div class="card" style="margin-bottom:20px">
        <div class="row" style="align-items:flex-start">
          <div class="field" style="flex:2;margin:0;min-width:160px"><label>Kelime / ifade</label><input type="text" id="v-word" placeholder="ör. ça va ?"></div>
          <div class="field" style="flex:2;margin:0;min-width:140px"><label>Türkçe anlamı</label><input type="text" id="v-meaning" placeholder="ör. nasıl gidiyor?"></div>
        </div>
        <div class="row" style="align-items:flex-start;margin-top:12px">
          <div class="field" style="flex:2;margin:0;min-width:140px"><label>Telaffuz</label><input type="text" id="v-pron" placeholder="ör. sa va"></div>
          <div class="field" style="flex:3;margin:0;min-width:160px"><label>Örnek cümle</label><input type="text" id="v-example" placeholder="ör. Salut, ça va ?"></div>
          <button class="btn primary small" id="v-add" style="margin-top:26px">${icon('plus')} Ekle</button>
        </div>
      </div>

      <div id="v-list"></div>
    </div>`);

  screen.querySelector('#vb-header').appendChild(
    screenHeader('📚 Kelime Defteri', 'Öğrendiğin kelimeler ve ifadeler', null)
  );

  const tabs = screen.querySelector('#lang-tabs');
  Object.entries(LANGUAGES).forEach(([code, li]) => {
    const t = el(`<button class="chip ${code === activeLang ? 'active' : ''}">${li.flag} ${li.name}</button>`);
    t.addEventListener('click', () => navigate('vocab', { lang: code }));
    tabs.appendChild(t);
  });

  const list = screen.querySelector('#v-list');

  const renderList = () => {
    list.innerHTML = '';
    const entries = getVocab(activeLang);
    if (!entries.length) {
      list.appendChild(el(`
        <div class="empty-state">
          <div class="icon">📓</div>
          <div>${info.name} için defterin henüz boş.</div>
          <div style="font-size:.85rem;margin-top:6px">Seans analizindeki “💡 Öğrenilecek ifadeler” bölümünden tek tıkla ekleyebilirsin.</div>
        </div>`));
      return;
    }
    entries.forEach((e) => {
      const row = el(`
        <div class="phrase-row" style="align-items:flex-start">
          <div style="min-width:0">
            <div class="p">${escapeHtml(e.word)}</div>
            ${e.pronunciation ? `<div class="m" style="font-style:italic">🔊 ${escapeHtml(e.pronunciation)}</div>` : ''}
            ${e.meaning ? `<div class="m">🇹🇷 ${escapeHtml(e.meaning)}</div>` : ''}
            ${e.example ? `<div class="m" style="margin-top:4px;color:var(--text)">“${escapeHtml(e.example)}”</div>` : ''}
          </div>
          <div class="actions">
            <button class="icon-btn speak" title="Dinle">${icon('speaker')}</button>
            <button class="icon-btn" title="Sil">${icon('trash')}</button>
          </div>
        </div>`);
      const btns = row.querySelectorAll('button');
      btns[0].addEventListener('click', () => speak(e.word, info.ttsLang, { rate: 0.85 }));
      btns[1].addEventListener('click', () => { deleteVocab(activeLang, e.id); renderList(); toast('Silindi.'); });
      list.appendChild(row);
    });
  };

  const doAdd = () => {
    const word = screen.querySelector('#v-word').value.trim();
    if (!word) { toast('Önce kelimeyi yaz.'); return; }
    const ok = addVocab(activeLang, {
      word,
      meaning: screen.querySelector('#v-meaning').value.trim(),
      pronunciation: screen.querySelector('#v-pron').value.trim(),
      example: screen.querySelector('#v-example').value.trim(),
    });
    if (ok) {
      ['#v-word', '#v-meaning', '#v-pron', '#v-example'].forEach((s) => (screen.querySelector(s).value = ''));
      toast('Deftere eklendi ✨', 'ok');
      renderList();
    } else {
      toast('Bu kelime zaten defterde.');
    }
  };

  screen.querySelector('#v-add').addEventListener('click', doAdd);
  ['#v-word', '#v-meaning', '#v-pron', '#v-example'].forEach((s) =>
    screen.querySelector(s).addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); })
  );

  renderList();
  root.appendChild(screen);
}
